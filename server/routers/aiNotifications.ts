/**
 * AI 능동적 알림 라우터
 * 개발 완료, 배포, 주요 업데이트 시 AI가 자동으로 생성하는 알림 관리
 */
import { z } from "zod";
import { eq, desc, and, isNull, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { aiNotifications } from "../../drizzle/schema";

// ─── 알림 생성 헬퍼 (서버 내부에서 직접 호출 가능) ──────────────────────────────
export async function createAiNotification(params: {
  type: "dev_complete" | "deploy" | "feature" | "system" | "error";
  title: string;
  body: string;
  devRequestId?: number;
  checkpointVersionId?: string;
  actionUrl?: string;
  actionLabel?: string;
  priority?: "critical" | "high" | "medium" | "low";
  source?: "ai" | "system" | "manual";
}): Promise<number | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const [result] = await db.insert(aiNotifications).values({
      type: params.type,
      title: params.title,
      body: params.body,
      devRequestId: params.devRequestId ?? null,
      checkpointVersionId: params.checkpointVersionId ?? null,
      isRead: false,
      actionUrl: params.actionUrl ?? null,
      actionLabel: params.actionLabel ?? null,
      priority: params.priority ?? "medium",
      source: params.source ?? "ai",
    }).$returningId();
    return result?.id ?? null;
  } catch (e) {
    console.error("[aiNotifications] createAiNotification 오류:", e);
    return null;
  }
}

// ─── 라우터 정의 ──────────────────────────────────────────────────────────────
export const aiNotificationsRouter = router({
  /**
   * 미읽음 알림 목록 조회 (폴링용 - 30초 간격)
   */
  listUnread: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(50).default(20),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const limit = input?.limit ?? 20;
      const rows = await db
        .select()
        .from(aiNotifications)
        .where(eq(aiNotifications.isRead, false))
        .orderBy(desc(aiNotifications.createdAt))
        .limit(limit);
      return { notifications: rows, count: rows.length };
    }),

  /**
   * 전체 알림 목록 조회 (최근 50개)
   */
  list: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(50),
      onlyUnread: z.boolean().default(false),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const limit = input?.limit ?? 50;
      const onlyUnread = input?.onlyUnread ?? false;
      const rows = await db
        .select()
        .from(aiNotifications)
        .where(onlyUnread ? eq(aiNotifications.isRead, false) : undefined)
        .orderBy(desc(aiNotifications.createdAt))
        .limit(limit);
      return { notifications: rows };
    }),

  /**
   * 미읽음 알림 개수 조회 (배지 표시용)
   */
  getUnreadCount: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({ id: aiNotifications.id })
        .from(aiNotifications)
        .where(eq(aiNotifications.isRead, false));
      return { count: rows.length };
    }),

  /**
   * 특정 알림 읽음 처리
   */
  markRead: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(aiNotifications)
        .set({ isRead: true, updatedAt: new Date() })
        .where(eq(aiNotifications.id, input.id));
      return { success: true };
    }),

  /**
   * 모든 알림 읽음 처리
   */
  markAllRead: adminProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(aiNotifications)
        .set({ isRead: true, updatedAt: new Date() })
        .where(eq(aiNotifications.isRead, false));
      return { success: true };
    }),

  /**
   * 알림 수동 생성 (관리자 테스트용)
   */
  create: adminProcedure
    .input(z.object({
      type: z.enum(["dev_complete", "deploy", "feature", "system", "error"]),
      title: z.string().min(1).max(200),
      body: z.string().min(1),
      devRequestId: z.number().int().positive().optional(),
      checkpointVersionId: z.string().optional(),
      actionUrl: z.string().optional(),
      actionLabel: z.string().optional(),
      priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
      source: z.enum(["ai", "system", "manual"]).default("manual"),
    }))
    .mutation(async ({ input }) => {
      const id = await createAiNotification(input);
      if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "알림 생성 실패" });
      return { success: true, id };
    }),

  /**
   * 최근 N분 이내 새 알림 확인 (효율적 폴링)
   * 마지막 확인 시각 이후 새 알림만 반환
   */
  pollNew: adminProcedure
    .input(z.object({
      since: z.date().optional(), // 마지막 확인 시각
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // since가 없으면 최근 5분 이내 알림 반환
      const sinceDate = input?.since ?? new Date(Date.now() - 5 * 60 * 1000);
      const rows = await db
        .select()
        .from(aiNotifications)
        .where(
          and(
            eq(aiNotifications.isRead, false),
            gte(aiNotifications.createdAt, sinceDate)
          )
        )
        .orderBy(desc(aiNotifications.createdAt))
        .limit(10);
      return {
        notifications: rows,
        hasNew: rows.length > 0,
        checkedAt: new Date(),
      };
    }),
});
