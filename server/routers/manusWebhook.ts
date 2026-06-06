/**
 * Manus 웹훅 수신 라우터 [ID: 700001]
 *
 * Manus API → ERP 웹훅 수신 → SSE 실시간 푸시 → 마누스채봇 페이지 표시
 *
 * 웹훅 등록 방법:
 *   Manus API: POST /webhook.create
 *   url: https://dogolf-tour-dkz3fsmp.manus.space/api/manus/webhook
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
});
