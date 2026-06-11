/**
 * AI ERP - AI 차단 키워드 관리 라우터
 *
 * 마스터: 전역 차단 규칙 + 모든 업체 규칙 통합 관리
 * 파트너: 자기 업체(tenantId) 규칙만 관리
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { partnerProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  knowledgeBlockLogs,
  knowledgeBlockRules,
  tenants,
} from "../../drizzle/schema";
import {
  checkKnowledge,
  logBlockedKnowledge,
  getBlockLogs,
  getBlockRules,
  DEFAULT_BLOCK_RULES,
} from "../services/knowledgeFilter";
import { eq, desc, isNull, or } from "drizzle-orm";

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
   * - 마스터: 전체 로그 (tenantId 필터 옵션)
   * - 파트너: 자기 업체 로그만
   */
  getLogs: partnerProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        tenantId: z.number().nullable().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { logs: [] };

      const isMaster = (ctx as any).user?.role === "admin";

      let rows;
      if (isMaster) {
        // 마스터: tenantId 필터 옵션 (없으면 전체)
        rows = await db
          .select()
          .from(knowledgeBlockLogs)
          .orderBy(desc(knowledgeBlockLogs.createdAt))
          .limit(input.limit);

        if (input.tenantId !== undefined) {
          rows = rows.filter((r) =>
            input.tenantId === null
              ? r.tenantId === null
              : r.tenantId === input.tenantId
          );
        }
      } else {
        // 파트너: 자기 tenantId 로그만
        const myTenantId = (ctx as any).tenantId as number | null;
        rows = await db
          .select()
          .from(knowledgeBlockLogs)
          .orderBy(desc(knowledgeBlockLogs.createdAt))
          .limit(input.limit);
        rows = rows.filter((r) => r.tenantId === myTenantId);
      }

      return { logs: rows };
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
   * 차단 규칙 목록 조회
   * - 마스터: 전역(null) 규칙 + 옵션으로 특정 업체 규칙 조회
   * - 파트너: 전역(null) + 자기 업체 규칙
   */
  getRules: partnerProcedure
    .input(
      z.object({
        /** 마스터가 특정 업체 규칙을 조회할 때 사용 */
        filterTenantId: z.number().nullable().optional(),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const isMaster = (ctx as any).user?.role === "admin";
      const db = await getDb();
      if (!db) return { defaultRules: DEFAULT_BLOCK_RULES, customRules: [] };

      let customRules;
      if (isMaster) {
        const filterTenantId = input?.filterTenantId;
        if (filterTenantId !== undefined) {
          // 특정 tenantId 필터
          const all = await db
            .select()
            .from(knowledgeBlockRules)
            .where(eq(knowledgeBlockRules.isActive, true))
            .orderBy(desc(knowledgeBlockRules.createdAt));
          customRules = filterTenantId === null
            ? all.filter((r) => r.tenantId === null)
            : all.filter((r) => r.tenantId === filterTenantId);
        } else {
          // 전체 규칙 반환
          customRules = await db
            .select()
            .from(knowledgeBlockRules)
            .where(eq(knowledgeBlockRules.isActive, true))
            .orderBy(desc(knowledgeBlockRules.createdAt));
        }
      } else {
        // 파트너: 전역 + 자기 업체 규칙
        const myTenantId = (ctx as any).tenantId as number | null;
        customRules = await getBlockRules(myTenantId);
      }

      return {
        defaultRules: DEFAULT_BLOCK_RULES,
        customRules,
      };
    }),

  /**
   * 마스터용: 모든 업체 목록 + 각 업체별 규칙 수 조회
   */
  listTenantRuleSummary: erpLoginProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { tenantList: [] };

    const allTenants = await db
      .select({
        id: tenants.id,
        companyName: tenants.companyName,
        slug: tenants.slug,
        isActive: tenants.isActive,
      })
      .from(tenants)
      .orderBy(tenants.companyName);

    const allRules = await db
      .select()
      .from(knowledgeBlockRules)
      .where(eq(knowledgeBlockRules.isActive, true));

    const ruleCountByTenant: Record<number, number> = {};
    for (const rule of allRules) {
      if (rule.tenantId != null) {
        ruleCountByTenant[rule.tenantId] = (ruleCountByTenant[rule.tenantId] || 0) + 1;
      }
    }

    const globalRuleCount = allRules.filter((r) => r.tenantId === null).length;

    return {
      globalRuleCount,
      tenantList: allTenants.map((t) => ({
        ...t,
        ruleCount: ruleCountByTenant[t.id] || 0,
      })),
    };
  }),

  /**
   * 수동 차단 규칙 추가
   * - 마스터: tenantId=null(전역) 또는 특정 업체 지정 가능
   * - 파트너: 자기 tenantId로만 등록
   */
  addRule: partnerProcedure
    .input(
      z.object({
        ruleName: z.string().min(1).max(300),
        keywords: z.string().min(1),
        description: z.string().optional(),
        /** 마스터 전용: 특정 업체에 규칙 등록 시 사용 */
        targetTenantId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB 연결 실패");

      const isMaster = (ctx as any).user?.role === "admin";
      let tenantId: number | null;

      if (isMaster) {
        // 마스터: targetTenantId 지정 가능 (null=전역)
        tenantId = input.targetTenantId ?? null;
      } else {
        // 파트너: 자기 tenantId 강제
        tenantId = (ctx as any).tenantId as number;
        if (tenantId == null) {
          throw new TRPCError({ code: "FORBIDDEN", message: "업체 정보가 없습니다" });
        }
      }

      const createdBy =
        (ctx as any).adminSession?.username ||
        (ctx as any).partnerOwner?.email ||
        (ctx as any).partnerStaff?.name ||
        "unknown";

      await db.insert(knowledgeBlockRules).values({
        ruleName: input.ruleName,
        keywords: input.keywords,
        description: input.description,
        isActive: true,
        tenantId,
        createdBy,
      });

      return { success: true };
    }),

  /**
   * 차단 규칙 삭제 (비활성화)
   * - 마스터: 모든 규칙 삭제 가능
   * - 파트너: 자기 업체 규칙만 삭제 가능
   */
  deleteRule: partnerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB 연결 실패");

      const isMaster = (ctx as any).user?.role === "admin";

      if (!isMaster) {
        // 파트너: 자기 tenantId 규칙만 삭제 가능
        const myTenantId = (ctx as any).tenantId as number | null;
        const existing = await db
          .select()
          .from(knowledgeBlockRules)
          .where(eq(knowledgeBlockRules.id, input.id))
          .limit(1);
        if (!existing.length || existing[0].tenantId !== myTenantId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "해당 규칙을 삭제할 권한이 없습니다" });
        }
      }

      await db
        .update(knowledgeBlockRules)
        .set({ isActive: false })
        .where(eq(knowledgeBlockRules.id, input.id));

      return { success: true };
    }),

  /**
   * 사용자 정의 차단 규칙 수정
   * - 마스터: 모든 규칙 수정 가능
   * - 파트너: 자기 업체 규칙만 수정 가능
   */
  updateRule: partnerProcedure
    .input(
      z.object({
        id: z.number(),
        ruleName: z.string().min(1).max(300).optional(),
        keywords: z.string().min(1).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB 연결 실패");

      const isMaster = (ctx as any).user?.role === "admin";

      if (!isMaster) {
        // 파트너: 자기 tenantId 규칙만 수정 가능
        const myTenantId = (ctx as any).tenantId as number | null;
        const existing = await db
          .select()
          .from(knowledgeBlockRules)
          .where(eq(knowledgeBlockRules.id, input.id))
          .limit(1);
        if (!existing.length || existing[0].tenantId !== myTenantId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "해당 규칙을 수정할 권한이 없습니다" });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (input.ruleName !== undefined) updateData.ruleName = input.ruleName;
      if (input.keywords !== undefined) updateData.keywords = input.keywords;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      if (Object.keys(updateData).length === 0) {
        throw new Error("수정할 항목이 없습니다");
      }

      await db
        .update(knowledgeBlockRules)
        .set(updateData as any)
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
