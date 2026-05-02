/**
 * AI 에이전트 승인 tRPC 라우터
 * Human-in-the-Loop: AI가 외부 연동 등 민감한 작업 수행 전 관리자 승인 요청/처리
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, lt } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { aiAgentApprovals, aiSessionState } from "../../drizzle/schema";

// 관리자 전용 프로시저
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});

export const agentApprovalsRouter = router({
  /**
   * 승인 요청 생성 (서버 내부 또는 AI 도구에서 호출)
   */
  create: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1).max(100),
        toolName: z.string().min(1).max(100),
        toolArgs: z.record(z.string(), z.unknown()).optional(),
        planDescription: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 후 만료

      const [result] = await db.insert(aiAgentApprovals).values({
        sessionId: input.sessionId,
        toolName: input.toolName,
        toolArgs: input.toolArgs ?? null,
        planDescription: input.planDescription ?? null,
        status: "pending",
        requestedBy: ctx.user.id,
        expiresAt,
      });

      return { id: (result as unknown as { insertId: number }).insertId, expiresAt };
    }),

  /**
   * 대기 중인 승인 요청 목록 조회
   */
  getPending: adminProcedure
    .input(z.object({ sessionId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 만료된 pending 항목 자동 처리
      await db
        .update(aiAgentApprovals)
        .set({ status: "expired", updatedAt: new Date() })
        .where(
          and(
            eq(aiAgentApprovals.status, "pending"),
            lt(aiAgentApprovals.expiresAt, new Date())
          )
        );

      const conditions = [eq(aiAgentApprovals.status, "pending")];
      if (input.sessionId) {
        conditions.push(eq(aiAgentApprovals.sessionId, input.sessionId));
      }

      return db
        .select()
        .from(aiAgentApprovals)
        .where(and(...conditions))
        .orderBy(desc(aiAgentApprovals.createdAt))
        .limit(50);
    }),

  /**
   * 승인 요청 목록 조회 (전체 이력)
   */
  list: adminProcedure
    .input(
      z.object({
        sessionId: z.string().optional(),
        status: z.enum(["pending", "approved", "rejected", "expired"]).optional(),
        limit: z.number().int().min(1).max(100).default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [];
      if (input.sessionId) conditions.push(eq(aiAgentApprovals.sessionId, input.sessionId));
      if (input.status) conditions.push(eq(aiAgentApprovals.status, input.status));

      return db
        .select()
        .from(aiAgentApprovals)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(aiAgentApprovals.createdAt))
        .limit(input.limit);
    }),

  /**
   * 승인 처리
   */
  approve: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [approval] = await db
        .select()
        .from(aiAgentApprovals)
        .where(eq(aiAgentApprovals.id, input.id))
        .limit(1);

      if (!approval) throw new TRPCError({ code: "NOT_FOUND", message: "승인 요청을 찾을 수 없습니다." });
      if (approval.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `이미 처리된 요청입니다. (상태: ${approval.status})` });
      }
      if (approval.expiresAt && approval.expiresAt < new Date()) {
        await db.update(aiAgentApprovals).set({ status: "expired", updatedAt: new Date() }).where(eq(aiAgentApprovals.id, input.id));
        throw new TRPCError({ code: "BAD_REQUEST", message: "만료된 승인 요청입니다." });
      }

      await db
        .update(aiAgentApprovals)
        .set({ status: "approved", approvedBy: ctx.user.id, updatedAt: new Date() })
        .where(eq(aiAgentApprovals.id, input.id));

      return { success: true, approvalId: input.id };
    }),

  /**
   * 거부 처리
   */
  reject: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [approval] = await db
        .select()
        .from(aiAgentApprovals)
        .where(eq(aiAgentApprovals.id, input.id))
        .limit(1);

      if (!approval) throw new TRPCError({ code: "NOT_FOUND", message: "승인 요청을 찾을 수 없습니다." });
      if (approval.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `이미 처리된 요청입니다. (상태: ${approval.status})` });
      }

      await db
        .update(aiAgentApprovals)
        .set({
          status: "rejected",
          approvedBy: ctx.user.id,
          rejectionReason: input.reason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(aiAgentApprovals.id, input.id));

      return { success: true, approvalId: input.id };
    }),

  /**
   * 승인 상태 폴링 (AI가 승인 결과 대기 시 사용)
   */
  getStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [approval] = await db
        .select()
        .from(aiAgentApprovals)
        .where(eq(aiAgentApprovals.id, input.id))
        .limit(1);

      if (!approval) throw new TRPCError({ code: "NOT_FOUND" });
      return approval;
    }),

  // ─── 세션 상태 관리 ────────────────────────────────────────────────────────

  /**
   * 세션 상태 저장
   */
  setSessionState: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1).max(100),
        key: z.string().min(1).max(200),
        value: z.string(),
        isSensitive: z.boolean().default(false),
        ttlMinutes: z.number().int().min(1).max(1440).default(60), // 기본 1시간
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const expiresAt = new Date(Date.now() + input.ttlMinutes * 60 * 1000);

      await db
        .insert(aiSessionState)
        .values({
          sessionId: input.sessionId,
          stateKey: input.key,
          stateValue: input.value,
          isSensitive: input.isSensitive,
          expiresAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            stateValue: input.value,
            isSensitive: input.isSensitive,
            expiresAt,
          },
        });

      return { success: true };
    }),

  /**
   * 세션 상태 조회
   */
  getSessionState: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1).max(100),
        key: z.string().min(1).max(200),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [state] = await db
        .select()
        .from(aiSessionState)
        .where(
          and(
            eq(aiSessionState.sessionId, input.sessionId),
            eq(aiSessionState.stateKey, input.key)
          )
        )
        .limit(1);

      if (!state) return null;
      if (state.expiresAt && state.expiresAt < new Date()) return null; // 만료됨

      return { key: state.stateKey, value: state.stateValue, isSensitive: state.isSensitive };
    }),

  /**
   * 세션 상태 전체 삭제 (세션 종료 시 민감 정보 파기)
   */
  clearSessionState: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .delete(aiSessionState)
        .where(eq(aiSessionState.sessionId, input.sessionId));

      return { success: true };
    }),
});
