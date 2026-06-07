/**
 * Manus 웹훅 수신 라우터 [ID: 700001]
 *
 * Manus API → ERP 웹훅 수신 → SSE 실시간 푸시 → 마누스채봇 페이지 표시
 *
 * 웹훅 등록 방법:
 *   Manus API: POST /webhook.create
 *   url: https://dayoutgolf.com/api/manus/webhook
 *   events: ["task_stopped", "message_added", "task_created"]
 */
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { manusWebhookLogs } from "../../drizzle/schema";
import { desc, eq, and, gte } from "drizzle-orm";
import { publish } from "../services/realtimeEvents";
import type { Request, Response } from "express";

// ─── 웹훅 이벤트 처리 핵심 함수 ─────────────────────────────────────────────

/**
 * Manus 웹훅 페이로드를 파싱하여 DB에 저장하고 SSE로 실시간 푸시합니다.
 */
export async function handleManusWebhook(
  payload: Record<string, unknown>,
  isVerified: boolean
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[ManusWebhook] DB 연결 실패");
    return;
  }

  try {
    // 이벤트 유형 추출
    const eventType = (payload.event as string) || "unknown";
    const taskId = (payload.task_id as string) || null;

    // 메시지 내용 추출 (이벤트 유형별 파싱)
    let content: string | null = null;
    let role = "assistant";

    if (eventType === "message_added") {
      const msg = payload.message as Record<string, unknown> | undefined;
      if (msg) {
        role = (msg.role as string) || "assistant";
        // 텍스트 콘텐츠 추출
        const msgContent = msg.content;
        if (typeof msgContent === "string") {
          content = msgContent;
        } else if (Array.isArray(msgContent)) {
          // content 배열에서 텍스트 추출
          const textParts = msgContent
            .filter((c: unknown) => (c as Record<string, unknown>)?.type === "text")
            .map((c: unknown) => (c as Record<string, unknown>)?.text as string)
            .filter(Boolean);
          content = textParts.join("\n") || null;
        }
      }
    } else if (eventType === "task_stopped") {
      const detail = payload.task_detail as Record<string, unknown> | undefined;
      content = detail
        ? `작업 완료: ${JSON.stringify(detail).slice(0, 500)}`
        : "Manus 작업이 완료되었습니다.";
      role = "system";
    } else if (eventType === "task_created") {
      content = `새 작업이 생성되었습니다. Task ID: ${taskId}`;
      role = "system";
    } else {
      content = JSON.stringify(payload).slice(0, 1000);
      role = "system";
    }

    // devRequestId 매핑 (taskId로 연결된 개발 요청 찾기)
    let devRequestId: number | null = null;
    if (taskId) {
      try {
        const { devRequests } = await import("../../drizzle/schema");
        const [req] = await db
          .select({ id: devRequests.id })
          .from(devRequests)
          .where(eq(devRequests.manusTaskId, taskId))
          .limit(1);
        if (req) devRequestId = req.id;
      } catch {
        // 매핑 실패 시 무시
      }
    }

    // DB 저장
    await db.insert(manusWebhookLogs).values({
      taskId: taskId ?? undefined,
      eventType,
      content,
      role,
      devRequestId: devRequestId ?? undefined,
      rawPayload: JSON.stringify(payload).slice(0, 10000),
      isVerified,
      receivedAt: new Date(),
    });

    // SSE 실시간 푸시 (마누스채봇 페이지에서 수신)
    publish("manus_webhook_received", {
      taskId,
      eventType,
      content,
      role,
      devRequestId,
      receivedAt: new Date().toISOString(),
    });

    console.log(`[ManusWebhook] 수신 완료: event=${eventType}, taskId=${taskId}`);
  } catch (err) {
    console.error("[ManusWebhook] 처리 오류:", err);
  }
}

// ─── Express 웹훅 엔드포인트 등록 함수 ──────────────────────────────────────

/**
 * Express 앱에 /api/manus/webhook POST 엔드포인트를 등록합니다.
 * server/_core/index.ts에서 호출합니다.
 */
export function registerManusWebhookRoute(app: {
  post: (path: string, handler: (req: Request, res: Response) => void) => void;
}): void {
  app.post("/api/manus/webhook", (req: Request, res: Response) => {
    // 즉시 200 응답 (Manus 서버 타임아웃 방지)
    res.status(200).json({ ok: true });

    // 비동기로 처리 (응답 후 처리)
    const payload = req.body as Record<string, unknown>;

    // 서명 검증 (MANUS_WEBHOOK_SECRET이 설정된 경우)
    const webhookSecret = process.env.MANUS_WEBHOOK_SECRET;
    let isVerified = false;
    if (!webhookSecret) {
      // 시크릿 미설정 시 검증 없이 수신 (개발 환경)
      isVerified = true;
    } else {
      // TODO: Manus 웹훅 서명 검증 로직 (공개키 기반)
      // 현재는 시크릿 존재 여부만 확인
      isVerified = true;
    }

    handleManusWebhook(payload, isVerified).catch((err) => {
      console.error("[ManusWebhook] 비동기 처리 오류:", err);
    });
  });

  console.log("[ManusWebhook] /api/manus/webhook 엔드포인트 등록 완료");
}

// ─── Manus API 웹훅 관리 헬퍼 ──────────────────────────────────────────────

const MANUS_API_BASE = "https://api.manus.ai/v2";
const DOGOLF_WEBHOOK_URL = "https://dayoutgolf.com/api/manus/webhook";

function getManusApiKey(): string {
  return process.env.MANUS_API_KEY ?? "";
}

/** Manus API에 등록된 웹훅 목록 조회 */
async function fetchManusWebhooks(): Promise<Array<{
  id: string;
  url: string;
  status: "active" | "inactive";
  created_at: number;
}>> {
  const apiKey = getManusApiKey();
  if (!apiKey) return [];
  const res = await fetch(`${MANUS_API_BASE}/webhook.list`, {
    headers: { "x-manus-api-key": apiKey },
  });
  if (!res.ok) return [];
  const data = await res.json() as { ok: boolean; data?: unknown[] };
  if (!data.ok || !Array.isArray(data.data)) return [];
  return data.data as Array<{ id: string; url: string; status: "active" | "inactive"; created_at: number }>;
}

// ─── tRPC 라우터 ─────────────────────────────────────────────────────────────

export const manusWebhookRouter = router({
  /**
   * 웹훅 수신 로그 목록 조회
   */
  getLogs: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(100),
        taskId: z.string().optional(),
        eventType: z.string().optional(),
        since: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB 연결 실패");

      const conditions = [];
      if (input.taskId) conditions.push(eq(manusWebhookLogs.taskId, input.taskId));
      if (input.eventType) conditions.push(eq(manusWebhookLogs.eventType, input.eventType));
      if (input.since) conditions.push(gte(manusWebhookLogs.receivedAt, input.since));

      const logs = await db
        .select()
        .from(manusWebhookLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(manusWebhookLogs.receivedAt))
        .limit(input.limit);

      return { logs };
    }),

  /**
   * 웹훅 수신 통계
   */
  getStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB 연결 실패");

    const allLogs = await db
      .select({
        eventType: manusWebhookLogs.eventType,
        receivedAt: manusWebhookLogs.receivedAt,
      })
      .from(manusWebhookLogs)
      .orderBy(desc(manusWebhookLogs.receivedAt))
      .limit(1000);

    const total = allLogs.length;
    const byEventType: Record<string, number> = {};
    for (const log of allLogs) {
      byEventType[log.eventType] = (byEventType[log.eventType] || 0) + 1;
    }

    const last24h = allLogs.filter(
      (l) => new Date(l.receivedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length;

    return { total, byEventType, last24h };
  }),

  /**
   * 테스트용 웹훅 수동 발송 (관리자 전용)
   */
  sendTest: adminProcedure
    .input(
      z.object({
        message: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ input }) => {
      await handleManusWebhook(
        {
          event: "message_added",
          task_id: "test-task",
          message: {
            role: "assistant",
            content: input.message,
          },
        },
        true
      );
      return { success: true };
    }),

  /**
   * Manus API에 등록된 웹훅 상태 조회
   * - 두골프 ERP URL이 이미 등록되어 있는지 확인
   */
  getWebhookStatus: adminProcedure.query(async () => {
    const apiKey = getManusApiKey();
    if (!apiKey) {
      return { registered: false, webhooks: [], apiKeyMissing: true };
    }
    const webhooks = await fetchManusWebhooks();
    const dogolfWebhook = webhooks.find((w) => w.url === DOGOLF_WEBHOOK_URL);
    return {
      registered: !!dogolfWebhook,
      active: dogolfWebhook?.status === "active",
      webhookId: dogolfWebhook?.id ?? null,
      webhookUrl: DOGOLF_WEBHOOK_URL,
      webhooks: webhooks.map((w) => ({
        id: w.id,
        url: w.url,
        status: w.status,
        createdAt: new Date(w.created_at * 1000).toISOString(),
      })),
      apiKeyMissing: false,
    };
  }),

  /**
   * Manus API에 두골프 ERP 웹훅 등록
   */
  registerWebhook: adminProcedure.mutation(async () => {
    const apiKey = getManusApiKey();
    if (!apiKey) throw new Error("MANUS_API_KEY가 설정되지 않았습니다.");

    // 이미 등록된 경우 중복 등록 방지
    const existing = await fetchManusWebhooks();
    const alreadyRegistered = existing.find((w) => w.url === DOGOLF_WEBHOOK_URL);
    if (alreadyRegistered) {
      return {
        success: true,
        message: "이미 등록된 웹훅입니다.",
        webhookId: alreadyRegistered.id,
        alreadyExisted: true,
      };
    }

    const res = await fetch(`${MANUS_API_BASE}/webhook.create`, {
      method: "POST",
      headers: {
        "x-manus-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: DOGOLF_WEBHOOK_URL }),
    });

    const data = await res.json() as { ok: boolean; webhook?: { id: string }; error?: { message: string } };
    if (!data.ok) {
      throw new Error(data.error?.message ?? "웹훅 등록 실패");
    }

    console.log(`[ManusWebhook] Manus API 웹훅 등록 완료: ${data.webhook?.id}`);
    return {
      success: true,
      message: "웹훅이 성공적으로 등록되었습니다.",
      webhookId: data.webhook?.id,
      alreadyExisted: false,
    };
  }),

  /**
   * Manus API에서 두골프 ERP 웹훅 해제
   */
  unregisterWebhook: adminProcedure
    .input(z.object({ webhookId: z.string() }))
    .mutation(async ({ input }) => {
      const apiKey = getManusApiKey();
      if (!apiKey) throw new Error("MANUS_API_KEY가 설정되지 않았습니다.");

      const res = await fetch(`${MANUS_API_BASE}/webhook.delete`, {
        method: "POST",
        headers: {
          "x-manus-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ webhook_id: input.webhookId }),
      });

      const data = await res.json() as { ok: boolean; error?: { message: string } };
      if (!data.ok) {
        throw new Error(data.error?.message ?? "웹훅 해제 실패");
      }

      console.log(`[ManusWebhook] Manus API 웹훅 해제 완료: ${input.webhookId}`);
      return { success: true, message: "웹훅이 해제되었습니다." };
    }),
});
