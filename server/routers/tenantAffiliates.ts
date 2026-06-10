/**
 * 업체별 제휴사(2계층) 라우터
 *
 * [2계층 구조]
 * - 마스터 affiliates(통합코드, 1600+건)는 공통 자원으로 검색 전용 공유
 * - 각 업체(테넌트)는 마스터 제휴사를 검색하여 재사용(masterAffiliateId 연결)하거나,
 *   마스터에 없으면 자체 신규 등록(masterAffiliateId = null)
 * - 자사 호칭/요금/잔액은 tenant_affiliates에 업체별로 독립 보관
 *
 * 모든 프로시저는 partnerProcedure로 ctx.tenantId 격리.
 * (admin은 activeTenantId 셀렉터 기반, 파트너는 자사 tenantId 강제)
 */
import { z } from "zod";
import { router, partnerProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { tenantAffiliates, affiliates } from "../../drizzle/schema";
import { eq, like, desc, and, or, count, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const categoryEnum = z.enum(["golf_domestic", "golf_overseas", "hotel", "attraction", "transport", "other"]);
const statusEnum = z.enum(["active", "inactive", "pending"]);

/** ctx.tenantId가 특정 테넌트로 지정되어야 하는 쓰기 작업용 가드 */
function requireTenant(tenantId: number | null | undefined): number {
  if (tenantId == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "업체(테넌트)를 먼저 선택해야 합니다. 마스터 전체보기 상태에서는 업체별 제휴사를 등록할 수 없습니다.",
    });
  }
  return tenantId;
}

export const tenantAffiliatesRouter = router({
  /**
   * 마스터 제휴사 검색 (재사용 대상 풀)
   * - 업체가 자사 제휴사로 추가하기 위해 마스터 통합코드를 검색
   */
  searchMaster: partnerProcedure
    .input(z.object({
      search: z.string().optional(),
      category: z.union([categoryEnum, z.literal("all")]).default("all"),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [];
      if (input.category !== "all") {
        conditions.push(eq(affiliates.type, input.category));
      }
      if (input.search) {
        conditions.push(
          or(
            like(affiliates.name, `%${input.search}%`),
            like(affiliates.region, `%${input.search}%`),
            like(affiliates.country, `%${input.search}%`)
          )
        );
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const items = await db
        .select({
          id: affiliates.id,
          name: affiliates.name,
          type: affiliates.type,
          region: affiliates.region,
          country: affiliates.country,
          greenFeeMin: affiliates.greenFeeMin,
          greenFeeMax: affiliates.greenFeeMax,
        })
        .from(affiliates)
        .where(where)
        .orderBy(desc(affiliates.createdAt))
        .limit(input.limit);
      return items;
    }),

  /**
   * 업체 제휴사 목록 (자사 tenant_affiliates만)
   */
  list: partnerProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      search: z.string().optional(),
      category: z.union([categoryEnum, z.literal("all")]).default("all"),
      status: z.union([statusEnum, z.literal("all")]).default("all"),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [];
      // 테넌트 격리: 특정 테넌트면 해당 건만, admin 전체보기(null)면 전체
      if (ctx.tenantId != null) {
        conditions.push(eq(tenantAffiliates.tenantId, ctx.tenantId));
      }
      if (input.category !== "all") {
        conditions.push(eq(tenantAffiliates.category, input.category));
      }
      if (input.status !== "all") {
        conditions.push(eq(tenantAffiliates.status, input.status));
      }
      if (input.search) {
        conditions.push(like(tenantAffiliates.customName, `%${input.search}%`));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (input.page - 1) * input.pageSize;
      const [items, [{ total }]] = await Promise.all([
        db.select().from(tenantAffiliates).where(where).orderBy(desc(tenantAffiliates.createdAt)).limit(input.pageSize).offset(offset),
        db.select({ total: count() }).from(tenantAffiliates).where(where),
      ]);
      return { items, total };
    }),

  /**
   * 업체 제휴사 추가
   * - masterAffiliateId 있으면 마스터 제휴사 재사용, 없으면 신규 등록
   */
  create: partnerProcedure
    .input(z.object({
      masterAffiliateId: z.number().nullable().optional(),
      customName: z.string().min(1),
      category: categoryEnum.default("golf_domestic"),
      customGreenFee: z.number().optional(),
      prepaidBalance: z.number().optional(),
      depositBalance: z.number().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      notes: z.string().optional(),
      status: statusEnum.default("active"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const tenantId = requireTenant(ctx.tenantId);

      // 마스터 재사용 시 유효성 검증
      if (input.masterAffiliateId != null) {
        const [master] = await db.select({ id: affiliates.id }).from(affiliates).where(eq(affiliates.id, input.masterAffiliateId)).limit(1);
        if (!master) throw new TRPCError({ code: "NOT_FOUND", message: "마스터 제휴사를 찾을 수 없습니다." });
      }

      const [result] = await db.insert(tenantAffiliates).values({
        tenantId,
        masterAffiliateId: input.masterAffiliateId ?? null,
        customName: input.customName,
        category: input.category,
        customGreenFee: input.customGreenFee ?? 0,
        prepaidBalance: input.prepaidBalance ?? 0,
        depositBalance: input.depositBalance ?? 0,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        notes: input.notes,
        status: input.status,
        isActive: true,
      } as any);
      return { id: (result as any).insertId };
    }),

  /** 업체 제휴사 수정 (자사 건만) */
  update: partnerProcedure
    .input(z.object({
      id: z.number(),
      customName: z.string().optional(),
      category: categoryEnum.optional(),
      customGreenFee: z.number().optional(),
      prepaidBalance: z.number().optional(),
      depositBalance: z.number().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      notes: z.string().optional(),
      status: statusEnum.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      // 소유권 검증
      const [row] = await db.select({ tenantId: tenantAffiliates.tenantId }).from(tenantAffiliates).where(eq(tenantAffiliates.id, id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.tenantId != null && row.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 제휴사는 수정할 수 없습니다." });
      }
      await db.update(tenantAffiliates).set(rest).where(eq(tenantAffiliates.id, id));
      return { success: true };
    }),

  /** 업체 제휴사 삭제 (자사 건만) */
  delete: partnerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select({ tenantId: tenantAffiliates.tenantId }).from(tenantAffiliates).where(eq(tenantAffiliates.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.tenantId != null && row.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 제휴사는 삭제할 수 없습니다." });
      }
      await db.delete(tenantAffiliates).where(eq(tenantAffiliates.id, input.id));
      return { success: true };
    }),
});
