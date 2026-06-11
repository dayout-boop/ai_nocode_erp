/**
 * 스케줄드 태스크 / 마스터AI → 개발 에이전트 파이프라인 엔드포인트
 *
 * POST /api/scheduled/dev-request
 *   - 마스터AI(LLM채팅)에서 개발 요청을 이 태스크로 직접 전달
 *   - 인증: app_session_id 쿠키 (user role 이상)
 *   - 요청 내용을 DB에 등록 + Manus API로 현재 태스크에 sendMessage
 *
 * POST /api/scheduled/pipeline-status
 *   - 파이프라인 상태 조회 (최근 전송 내역, 성공률 등)
 */
import type { Express, Request, Response } from "express";
import { getDb } from "./db";
import { devRequests, aiScheduledTasks } from "../drizzle/schema";
import { desc, eq, and, lte } from "drizzle-orm";
import { createAiNotification } from "./routers/aiNotifications";
import { publish } from "./services/realtimeEvents";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";

const MANUS_API_BASE = "https://api.manus.ai/v2";

// ─── 인증 미들웨어 (user role 이상) ──────────────────────────────────────────
async function requireAuth(req: Request, res: Response): Promise<{ userId: number; role: string } | null> {
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map(c => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
  const sessionId = cookies["app_session_id"];
  if (!sessionId) {
    res.status(401).json({ ok: false, error: "인증이 필요합니다" });
    return null;
  }
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) {
      res.status(401).json({ ok: false, error: "세션이 만료되었습니다" });
      return null;
    }
    return { userId: user.id, role: user.role };
  } catch {
    res.status(401).json({ ok: false, error: "인증 실패" });
    return null;
  }
}

// ─── Manus API: 현재 태스크에 메시지 전송 ────────────────────────────────────
async function sendToCurrentTask(message: string): Promise<{
  success: boolean;
  taskId?: string;
  error?: string;
}> {
  const apiKey = process.env.MANUS_API_KEY;
  const taskId = process.env.MANUS_DOGOLF_TASK_ID; // hNUzrtQfkbnQkVX9BUZeeM

  if (!apiKey || !taskId) {
    return { success: false, error: "MANUS_API_KEY 또는 MANUS_DOGOLF_TASK_ID 미설정" };
  }

  try {
    const res = await fetch(`${MANUS_API_BASE}/task.sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-manus-api-key": apiKey,
      },
      body: JSON.stringify({
        task_id: taskId,
        message: {
          content: [{ type: "text", text: message }],
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { success: false, error: `API 오류 [${res.status}]: ${errText.slice(0, 200)}` };
    }

    const data = (await res.json()) as { ok: boolean };
    if (!data.ok) {
      return { success: false, error: `응답 오류: ${JSON.stringify(data)}` };
    }

    return { success: true, taskId };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── 개발 요청 메시지 포맷 ────────────────────────────────────────────────────
function formatDevRequestMessage(req: {
  title: string;
  description: string;
  priority: string;
  module?: string;
  estimatedHours?: number;
  requestedBy?: string;
  source?: string;
}): string {
  const priorityEmoji: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🟢",
  };
  const emoji = priorityEmoji[req.priority] ?? "🔵";

  return `[마스터AI → 개발 에이전트 자동 전달]

${emoji} **개발 요청: ${req.title}**

**우선순위:** ${req.priority.toUpperCase()}
**모듈:** ${req.module ?? "미지정"}
**예상 소요:** ${req.estimatedHours ?? "?"}시간
**요청자:** ${req.requestedBy ?? "마스터AI"}
**출처:** ${req.source ?? "master_ai"}

**상세 내용:**
${req.description}

---
이 메시지는 마스터AI AI가 자동으로 분석하여 전달한 개발 요청입니다.
즉시 검토하고 구현을 시작해 주세요.`;
}

// ─── 라우트 등록 ──────────────────────────────────────────────────────────────
export function registerScheduledRoutes(app: Express): void {
  /**
   * POST /api/scheduled/dev-request
   * 마스터AI → 개발 에이전트 직접 전달
   */
  app.post("/api/scheduled/dev-request", async (req: Request, res: Response) => {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { title, description, priority, module: mod, estimatedHours, source } = req.body as {
      title?: string;
      description?: string;
      priority?: string;
      module?: string;
      estimatedHours?: number;
      source?: string;
    };

    if (!title || !description) {
      res.status(400).json({ ok: false, error: "title과 description은 필수입니다" });
      return;
    }

    const validPriorities = ["critical", "high", "medium", "low"];
    const normalizedPriority = validPriorities.includes(priority ?? "") ? (priority as "critical" | "high" | "medium" | "low") : "medium";

    try {
      const db = await getDb();
      if (!db) {
        res.status(500).json({ ok: false, error: "DB 연결 실패" });
        return;
      }

      // 1. DB에 개발 요청 등록
      const [inserted] = await db.insert(devRequests).values({
        title,
        description,
        priority: normalizedPriority,
        status: "pending",
        module: mod ?? "general",
        estimatedHours: estimatedHours ?? 2,
        createdBy: user.userId,
        source: (source ?? "master_ai") as "master_ai" | "manual" | "auto_cycle",
        aiAnalyzed: false,
      }).$returningId();

      const devRequestId = inserted.id;

      // 2. Manus API로 현재 태스크에 전송
      const message = formatDevRequestMessage({
        title,
        description,
        priority: normalizedPriority,
        module: mod,
        estimatedHours,
        source: source ?? "master_ai",
      });

      const manusResult = await sendToCurrentTask(message);

      // 3. DB 상태 업데이트
      if (manusResult.success) {
        await db.update(devRequests).set({
          manusTaskId: manusResult.taskId,
          manusRoutingType: "send_message",
          manusRoutingReason: "마스터AI → 현재 태스크 직접 전달",
          status: "in_progress",
          updatedAt: new Date(),
        }).where(eq(devRequests.id, devRequestId));
      }

      // 4. 슬랙 알림 (선택)
      if (ENV.slackWebhookUrl && manusResult.success) {
        const priorityEmoji: Record<string, string> = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" };
        const emoji = priorityEmoji[normalizedPriority] ?? "🔵";
        fetch(ENV.slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `${emoji} *[두골프 개발요청 #${devRequestId}]* 마스터AI → 개발 에이전트 전달 완료\n*제목:* ${title}\n*우선순위:* ${normalizedPriority.toUpperCase()}`,
          }),
        }).catch(() => {});
      }

      publish("pipeline_done", { devRequestId, manusTaskId: manusResult.taskId, success: manusResult.success });
      res.json({
        ok: true,
        devRequestId,
        manusTaskId: manusResult.taskId,
        manusSuccess: manusResult.success,
        manusError: manusResult.error,
        message: manusResult.success
          ? `개발 요청 #${devRequestId} 등록 및 개발 에이전트 전달 완료`
          : `개발 요청 #${devRequestId} DB 등록 완료 (Manus 전달 실패: ${manusResult.error})`,
      });
    } catch (e) {
      console.error("[ScheduledRoutes] dev-request 오류:", e);
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  /**
   * POST /api/scheduled/run-tasks
   * 예약된 AI 작업 실행 (Manus 스케줄 기능으로 주기적 호출)
   */
  app.post("/api/scheduled/run-tasks", async (req: Request, res: Response) => {
    const user = await requireAuth(req, res);
    if (!user) return;

    try {
      const db = await getDb();
      if (!db) {
        res.status(500).json({ ok: false, error: "DB 연결 실패" });
        return;
      }

      const now = new Date();

      // 실행 예정인 대기 작업 조회
      const pendingTasks = await db
        .select()
        .from(aiScheduledTasks)
        .where(and(
          eq(aiScheduledTasks.status, "pending"),
          lte(aiScheduledTasks.scheduledAt, now)
        ))
        .limit(10);

      if (pendingTasks.length === 0) {
        res.json({ ok: true, executed: 0, message: "실행할 작업 없음" });
        return;
      }

      const results: { id: number; title: string; success: boolean; error?: string }[] = [];

      for (const task of pendingTasks) {
        // 실행중 상태로 변경
        await db.update(aiScheduledTasks).set({
          status: "running",
          executedAt: now,
          updatedAt: now,
        }).where(eq(aiScheduledTasks.id, task.id));

        try {
          // 작업 유형에 따라 실행
          let resultMessage = "";

          if (task.taskType === "report") {
            // 보고 작업: AI에게 리포트 요청
            const reportPrompt = `[AI 예약 보고 실행]
예약된 시간: ${task.scheduledAt.toLocaleString('ko-KR')}
작업: ${task.prompt}

위 내용을 지금 실행하여 결과를 알림으로 전달해주세요.`;
            resultMessage = `보고 작업 실행: ${task.title}`;

            // AI 알림 생성
            await createAiNotification({
              type: "system",
              title: `⏰ 예약 보고: ${task.title}`,
              body: `${task.prompt}\n\n예약된 시간에 도달하여 자동 실행되었습니다. 마스터 AI에게 문의하여 상세 보고를 받아보세요.`,
              priority: "high",
              source: "system",
              actionLabel: "마스터 AI 열기",
              actionUrl: "/admin/master-ai",
            });

            // Manus에 전달 (선택적)
            if (process.env.MANUS_API_KEY && process.env.MANUS_DOGOLF_TASK_ID) {
              await sendToCurrentTask(reportPrompt).catch(() => {});
            }
          } else if (task.taskType === "reminder") {
            // 리마인더 작업
            await createAiNotification({
              type: "system",
              title: task.title,
              body: task.prompt,
              priority: "medium",
              source: "system",
            });
            resultMessage = `리마인더 전송 완료: ${task.title}`;
          } else {
            resultMessage = `작업 실행 완료: ${task.title}`;
          }

          // 완료 상태로 업데이트
          await db.update(aiScheduledTasks).set({
            status: "completed",
            result: resultMessage,
            executedAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(aiScheduledTasks.id, task.id));

          results.push({ id: task.id, title: task.title, success: true });
        } catch (taskErr) {
          // 실패 상태로 업데이트
          const errMsg = String(taskErr);
          await db.update(aiScheduledTasks).set({
            status: "failed",
            result: `실패: ${errMsg}`,
            updatedAt: new Date(),
          }).where(eq(aiScheduledTasks.id, task.id));

          results.push({ id: task.id, title: task.title, success: false, error: errMsg });
        }
      }

      res.json({
        ok: true,
        executed: results.length,
        results,
        message: `${results.length}개 작업 실행 완료`,
      });
    } catch (e) {
      console.error("[ScheduledRoutes] run-tasks 오류:", e);
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  /**
   * GET /api/scheduled/pipeline-status
   * 파이프라인 상태 조회 (최근 전송 내역)
   */
  app.get("/api/scheduled/pipeline-status", async (req: Request, res: Response) => {
    const user = await requireAuth(req, res);
    if (!user) return;

    try {
      const db = await getDb();
      if (!db) {
        res.status(500).json({ ok: false, error: "DB 연결 실패" });
        return;
      }

      // 최근 20개 개발 요청 조회
      const recent = await db
        .select({
          id: devRequests.id,
          title: devRequests.title,
          priority: devRequests.priority,
          status: devRequests.status,
          source: devRequests.source,
          manusTaskId: devRequests.manusTaskId,
          manusRoutingType: devRequests.manusRoutingType,
          createdAt: devRequests.createdAt,
        })
        .from(devRequests)
        .orderBy(desc(devRequests.createdAt))
        .limit(20);

      const stats = {
        total: recent.length,
        inProgress: recent.filter(r => r.status === "in_progress").length,
        pending: recent.filter(r => r.status === "pending").length,
        completed: recent.filter(r => r.status === "completed").length,
        fromMasterAI: recent.filter(r => r.source === "master_ai").length,
        manusConnected: !!process.env.MANUS_API_KEY,
        currentTaskId: process.env.MANUS_DOGOLF_TASK_ID ?? null,
        projectId: process.env.MANUS_PROJECT_ID ?? null,
      };

      res.json({ ok: true, stats, recent });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 파트너 랜딩페이지용 공개 API (인증 불필요)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/public/dev-history
 * 날짜별 기능 개발 이력 (최근 50건, 완료된 것만)
 * 파트너 랜딩페이지에서 실시간 개발 현황 표시용
 */
export function registerPublicLandingRoutes(app: Express) {
  app.get("/api/public/dev-history", async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      if (!db) return res.status(503).json({ ok: false, error: "DB 연결 오류" });

      const history = await db
        .select({
          id: devRequests.id,
          title: devRequests.title,
          aiCategory: devRequests.aiCategory,
          module: devRequests.module,
          priority: devRequests.priority,
          estimatedHours: devRequests.estimatedHours,
          createdAt: devRequests.createdAt,
          updatedAt: devRequests.updatedAt,
        })
        .from(devRequests)
        .where(eq(devRequests.status, "completed"))
        .orderBy(desc(devRequests.updatedAt))
        .limit(50);

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=300"); // 5분 캐시
      res.json({ ok: true, history });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  /**
   * GET /api/public/stats
   * 플랫폼 통계 (파트너 수, 개발 완료 건수 등)
   */
  app.get("/api/public/stats", async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      if (!db) return res.status(503).json({ ok: false, error: "DB 연결 오류" });

      const [completedCount] = await db
        .select({ count: devRequests.id })
        .from(devRequests)
        .where(eq(devRequests.status, "completed"));

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json({
        ok: true,
        stats: {
          completedFeatures: completedCount?.count ?? 0,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });
}
