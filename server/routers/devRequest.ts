/**
 * 개발 요청 tRPC 라우터
 * - create: 개발 요청 등록
 * - list: 개발 요청 목록 조회
 * - updateStatus: 상태 변경
 * - sendToManus: 단일 요청 Manus 전송
 * - sendPending: pending 전체 Manus 전송
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, count } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { devRequests } from "../../drizzle/schema";
import { sendSingleRequestToManus, sendPendingRequestsToManus } from "../services/manusPipe";

// 관리자 전용 프로시저
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});

export const devRequestRouter = router({
  /**
   * 개발 요청 등록
   */
  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1),
        priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
        module: z.string().max(100).optional(),
        estimatedHours: z.number().int().positive().optional(),
        source: z.enum(["manual", "auto_cycle", "master_ai"]).default("manual"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [inserted] = await db
        .insert(devRequests)
        .values({
          title: input.title,
          description: input.description,
          priority: input.priority,
          status: "pending",
          module: input.module,
          estimatedHours: input.estimatedHours,
          createdBy: ctx.user.id,
          source: input.source,
        })
        .$returningId();

      return { id: inserted.id, success: true };
    }),

  /**
   * 개발 요청 목록 조회 (필터링 지원)
   */
  list: adminProcedure
    .input(
      z.object({
        status: z.enum(["pending", "in_progress", "completed", "rejected", "all"]).default("all"),
        priority: z.enum(["critical", "high", "medium", "low", "all"]).default("all"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [];
      if (input.status !== "all") conditions.push(eq(devRequests.status, input.status));
      if (input.priority !== "all") conditions.push(eq(devRequests.priority, input.priority));

      const rows = await db
        .select()
        .from(devRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(devRequests.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [total] = await db
        .select({ count: count() })
        .from(devRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { rows, total: total.count };
    }),

  /**
   * 상태 변경
   */
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["pending", "in_progress", "completed", "rejected"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(devRequests)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(devRequests.id, input.id));

      return { success: true };
    }),

  /**
   * 단일 요청 Manus 전송
   */
  sendToManus: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const result = await sendSingleRequestToManus(input.id);
      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Manus 전송에 실패했습니다. MANUS_API_KEY 및 MANUS_DOGOLF_TASK_ID를 확인해주세요.",
        });
      }
      return { success: true, manusTaskId: result.manusTaskId };
    }),

  /**
   * pending 전체 Manus 일괄 전송
   */
  sendPending: adminProcedure.mutation(async () => {
    const result = await sendPendingRequestsToManus();
    return result;
  }),
});
