/**
 * AI 예약 작업 tRPC 라우터 (scheduledTasks)
 * AI가 시간 기반 작업을 예약하고 관리하는 기능
 *
 * - create: 예약 작업 등록 (AI Tool Calling 또는 수동)
 * - list: 예약 작업 목록 조회
 * - cancel: 예약 작업 취소
 * - getUpcoming: 실행 예정 작업 조회 (run-tasks 엔드포인트용)
 * - markRunning: 실행 중 상태로 변경
 * - markCompleted: 완료 처리 + 알림 생성
 * - markFailed: 실패 처리
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, lte, gte } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { aiScheduledTasks } from "../../drizzle/schema";
import { createAiNotification } from "./aiNotifications";

// 관리자 전용 프로시저
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});

export const scheduledTasksRouter = router({
  /**
   * 예약 작업 등록
   * AI Tool Calling 또는 관리자 수동 등록
   */
  create: adminProcedure
    .input(
      z.object({
        taskType: z.enum(["report", "reminder", "analysis", "custom"]).default("custom"),
        title: z.string().min(1).max(200),
        prompt: z.string().min(1),
        scheduledAt: z.date(),
        notifyOnComplete: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 과거 시각 등록 방지 (5분 이상 과거)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (input.scheduledAt < fiveMinutesAgo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "예약 시각은 현재 시각 이후여야 합니다.",
        });
      }

      const [result] = await db
        .insert(aiScheduledTasks)
        .values({
          taskType: input.taskType,
          title: input.title,
          prompt: input.prompt,
          scheduledAt: input.scheduledAt,
          status: "pending",
          notifyOnComplete: input.notifyOnComplete,
          createdBy: ctx.user.id,
        })
        .$returningId();

      const id = result?.id;
      if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "작업 등록 실패" });

      return { success: true, id, scheduledAt: input.scheduledAt };
    }),

  /**
   * 예약 작업 목록 조회
   */
  list: adminProcedure
    .input(
      z
        .object({
          status: z.enum(["pending", "running", "completed", "cancelled", "failed", "all"]).default("all"),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const status = input?.status ?? "all";
      const limit = input?.limit ?? 50;

      const rows = await db
        .select()
        .from(aiScheduledTasks)
        .where(
          status !== "all"
            ? eq(aiScheduledTasks.status, status as "pending" | "running" | "completed" | "cancelled" | "failed")
            : undefined
        )
        .orderBy(desc(aiScheduledTasks.scheduledAt))
        .limit(limit);

      return { tasks: rows, count: rows.length };
    }),

  /**
   * 예약 작업 취소
   */
  cancel: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [task] = await db
        .select()
        .from(aiScheduledTasks)
        .where(eq(aiScheduledTasks.id, input.id))
        .limit(1);

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "작업을 찾을 수 없습니다." });
      }

      if (task.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `대기 중인 작업만 취소할 수 있습니다. (현재 상태: ${task.status})`,
        });
      }

      await db
        .update(aiScheduledTasks)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(aiScheduledTasks.id, input.id));

      return { success: true };
    }),

  /**
   * 실행 예정 작업 조회 (run-tasks 엔드포인트에서 사용)
   * 현재 시각 기준 실행 예정이며 아직 pending 상태인 작업 반환
   */
  getUpcoming: adminProcedure
    .input(
      z
        .object({
          withinMinutes: z.number().int().min(1).max(60).default(2),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = new Date();
      const futureLimit = new Date(now.getTime() + (input?.withinMinutes ?? 2) * 60 * 1000);

      const rows = await db
        .select()
        .from(aiScheduledTasks)
        .where(
          and(
            eq(aiScheduledTasks.status, "pending"),
            lte(aiScheduledTasks.scheduledAt, futureLimit)
          )
        )
        .orderBy(aiScheduledTasks.scheduledAt)
        .limit(20);

      return { tasks: rows };
    }),

  /**
   * 실행 중 상태로 변경 (run-tasks 엔드포인트에서 사용)
   */
  markRunning: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(aiScheduledTasks)
        .set({ status: "running", updatedAt: new Date() })
        .where(eq(aiScheduledTasks.id, input.id));
      return { success: true };
    }),

  /**
   * 완료 처리 + 알림 생성
   */
  markCompleted: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        result: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [task] = await db
        .select()
        .from(aiScheduledTasks)
        .where(eq(aiScheduledTasks.id, input.id))
        .limit(1);

      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(aiScheduledTasks)
        .set({
          status: "completed",
          result: input.result,
          executedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiScheduledTasks.id, input.id));

      // 알림 생성 (notifyOnComplete=true인 경우)
      if (task.notifyOnComplete) {
        await createAiNotification({
          type: "feature",
          title: `✅ 예약 작업 완료: ${task.title}`,
          body: `예약하신 작업이 완료되었습니다.\n\n**결과 요약:**\n${input.result.slice(0, 500)}${input.result.length > 500 ? "..." : ""}`,
          priority: "high",
          source: "ai",
          actionUrl: "/erp/master-ai",
          actionLabel: "마스터 AI에서 확인",
        });
      }

      return { success: true };
    }),

  /**
   * 실패 처리
   */
  markFailed: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        errorMessage: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(aiScheduledTasks)
        .set({
          status: "failed",
          errorMessage: input.errorMessage,
          executedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiScheduledTasks.id, input.id));

      return { success: true };
    }),

  /**
   * 오늘의 예약 작업 통계
   */
  getTodayStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const rows = await db
      .select()
      .from(aiScheduledTasks)
      .where(gte(aiScheduledTasks.createdAt, todayStart));

    const stats = {
      total: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      running: rows.filter((r) => r.status === "running").length,
      completed: rows.filter((r) => r.status === "completed").length,
      failed: rows.filter((r) => r.status === "failed").length,
      cancelled: rows.filter((r) => r.status === "cancelled").length,
    };

    return stats;
  }),
});
