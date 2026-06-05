/**
 * 두골프 ERP - 타 데스크 지식 차단 관리 라우터
 *
 * 차단 이력 조회, 수동 차단 규칙 등록, 실시간 지식 검사 기능을 제공한다.
 * ERP 로그인 계정(admin/master)만 접근 가능하다.
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  knowledgeBlockLogs,
  knowledgeBlockRules,
} from "../../drizzle/schema";
import {
  checkKnowledge,
  logBlockedKnowledge,
  getBlockLogs,
  getBlockRules,
  DEFAULT_BLOCK_RULES,
} from "../services/knowledgeFilter";
import { eq, desc } from "drizzle-orm";

/**
 * ERP 로그인 계정(master/admin) 전용 프로시저
 */
const erpLoginProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const adminSession = (ctx.req as any).adminSession;
  if (!adminSession) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "마스터 ERP 로그인이 필요합니다",
    });
  }
  return next({
    ctx: {
      ...ctx,
      adminSession,
    },
  });
});

export const knowledgeBlockRouter = router({
  /**
   * 차단 로그 목록 조회
   */
  getLogs: erpLoginProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ input }) => {
      const logs = await getBlockLogs(input.limit);
      return { logs };
    }),

  /**
   * 차단 통계 조회
   */
  getStats: erpLoginProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, bySource: [] };

    const logs = await db
      .select()
      .from(knowledgeBlockLogs)
      .orderBy(desc(knowledgeBlockLogs.createdAt))
      .limit(500);

    const total = logs.length;
    const bySource: Record<string, number> = {};
    for (const log of logs) {
      const src = log.sourceDeskHint || "알 수 없음";
      bySource[src] = (bySource[src] || 0) + 1;
    }

    return {
      total,
      bySource: Object.entries(bySource)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    };
  }),

  /**
   * 차단 규칙 목록 조회 (기본 규칙 + DB 규칙)
   */
  getRules: erpLoginProcedure.query(async () => {
    const dbRules = await getBlockRules();
    return {
      defaultRules: DEFAULT_BLOCK_RULES,
      customRules: dbRules,
    };
  }),

  /**
   * 수동 차단 규칙 추가
   */
  addRule: erpLoginProcedure
    .input(
      z.object({
        ruleName: z.string().min(1).max(300),
        keywords: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB 연결 실패");

      await db.insert(knowledgeBlockRules).values({
        ruleName: input.ruleName,
        keywords: input.keywords,
        description: input.description,
        isActive: true,
        createdBy: (ctx as any).adminSession?.username || "master",
      });

      return { success: true };
    }),

  /**
   * 차단 규칙 삭제 (비활성화)
   */
  deleteRule: erpLoginProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB 연결 실패");

      await db
        .update(knowledgeBlockRules)
        .set({ isActive: false })
        .where(eq(knowledgeBlockRules.id, input.id));

      return { success: true };
    }),

  /**
   * 지식 이름/내용을 실시간으로 검사 (마스터가 직접 테스트용)
   */
  checkKnowledge: erpLoginProcedure
    .input(
      z.object({
        knowledgeName: z.string(),
        knowledgeContent: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = checkKnowledge(
        input.knowledgeName,
        input.knowledgeContent
      );

      if (result.isBlocked) {
        await logBlockedKnowledge(result, "manual-check");
      }

      return result;
    }),

  /**
   * 수동으로 차단 로그 기록 (마스터가 직접 차단 이력 추가)
   */
  addManualLog: erpLoginProcedure
    .input(
      z.object({
        knowledgeName: z.string().min(1).max(300),
        blockReason: z.string().optional(),
        sourceDeskHint: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB 연결 실패");

      await db.insert(knowledgeBlockLogs).values({
        knowledgeName: input.knowledgeName,
        blockReason: input.blockReason || "수동 등록",
        blockType: "manual",
        sourceDeskHint: input.sourceDeskHint || "마스터 수동 등록",
        isBlocked: true,
      });

      return { success: true };
    }),
});
