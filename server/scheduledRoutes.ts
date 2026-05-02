/**
 * 스케줄드 태스크 / 두골프마스터 → 개발 에이전트 파이프라인 엔드포인트
 *
 * POST /api/scheduled/dev-request
 *   - 두골프마스터(LLM채팅)에서 개발 요청을 이 태스크로 직접 전달
 *   - 인증: app_session_id 쿠키 (user role 이상)
 *   - 요청 내용을 DB에 등록 + Manus API로 현재 태스크에 sendMessage
 *
 * POST /api/scheduled/pipeline-status
 *   - 파이프라인 상태 조회 (최근 전송 내역, 성공률 등)
 */
import type { Express, Request, Response } from "express";
import { getDb } from "./db";
import { devRequests } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
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

  return `[두골프마스터 → 개발 에이전트 자동 전달]

${emoji} **개발 요청: ${req.title}**

**우선순위:** ${req.priority.toUpperCase()}
**모듈:** ${req.module ?? "미지정"}
**예상 소요:** ${req.estimatedHours ?? "?"}시간
**요청자:** ${req.requestedBy ?? "두골프마스터"}
**출처:** ${req.source ?? "master_ai"}

**상세 내용:**
${req.description}

---
이 메시지는 두골프마스터 AI가 자동으로 분석하여 전달한 개발 요청입니다.
즉시 검토하고 구현을 시작해 주세요.`;
}

// ─── 라우트 등록 ──────────────────────────────────────────────────────────────
export function registerScheduledRoutes(app: Express): void {
  /**
   * POST /api/scheduled/dev-request
   * 두골프마스터 → 개발 에이전트 직접 전달
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
          manusRoutingReason: "두골프마스터 → 현재 태스크 직접 전달",
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
            text: `${emoji} *[두골프 개발요청 #${devRequestId}]* 두골프마스터 → 개발 에이전트 전달 완료\n*제목:* ${title}\n*우선순위:* ${normalizedPriority.toUpperCase()}`,
          }),
        }).catch(() => {});
      }

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
        manusConnected: !!process.env.MANUS_API_KEY && !!process.env.MANUS_DOGOLF_TASK_ID,
        currentTaskId: process.env.MANUS_DOGOLF_TASK_ID ?? null,
        projectId: process.env.MANUS_PROJECT_ID ?? null,
      };

      res.json({ ok: true, stats, recent });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });
}
