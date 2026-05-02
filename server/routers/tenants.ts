/**
 * 테넌트(파트너사) 관리 tRPC 라우터
 *
 * - list: 테넌트 목록 (관리자)
 * - get: 단건 조회 (관리자)
 * - create: 테넌트 생성 (관리자)
 * - update: 테넌트 정보 수정 (관리자)
 * - suspend: 구독 정지 (관리자)
 * - activate: 구독 활성화 (관리자)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, like, or } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { tenants } from "../../drizzle/schema";

// 관리자 전용 프로시저
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});

export const tenantsRouter = router({
  /** 테넌트 목록 조회 */
  list: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(["trial", "active", "suspended", "cancelled", "all"]).default("all"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      let query = db.select().from(tenants);

      const conditions = [];
      if (input.status !== "all") {
        conditions.push(eq(tenants.subscriptionStatus, input.status));
      }
      if (input.search) {
        conditions.push(
          or(
            like(tenants.companyName, `%${input.search}%`),
            like(tenants.slug, `%${input.search}%`)
          )
        );
      }

      const results = await db
        .select()
        .from(tenants)
        .where(conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : undefined) : undefined)
        .orderBy(desc(tenants.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return results;
    }),

  /** 단건 조회 */
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.id))
        .limit(1);

      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "테넌트를 찾을 수 없습니다." });
      return tenant;
    }),

  /** 테넌트 생성 (온보딩 승인 시 자동 호출 또는 수동 생성) */
  create: adminProcedure
    .input(
      z.object({
        companyName: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "소문자, 숫자, 하이픈만 허용"),
        subscriptionPlan: z.enum(["starter", "standard", "premium"]).default("starter"),
        billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
        onboardingId: z.number().optional(),
        partnerId: z.number().optional(),
        sampleCategory: z.enum(["golf_tour_domestic", "golf_tour_overseas", "golf_tour_mixed"]).default("golf_tour_mixed"),
        memo: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      // 슬러그 중복 확인
      const [existing] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, input.slug))
        .limit(1);

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 슬러그입니다." });
      }

      // 구독 만료일 설정 (trial: 14일, 그 외: 1개월/1년)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14); // 기본 14일 트라이얼

      const [result] = await db.insert(tenants).values({
        companyName: input.companyName,
        slug: input.slug,
        subscriptionPlan: input.subscriptionPlan,
        billingCycle: input.billingCycle,
        subscriptionStatus: "trial",
        subscriptionExpiresAt: expiresAt,
        onboardingId: input.onboardingId,
        partnerId: input.partnerId,
        sampleCategory: input.sampleCategory,
        memo: input.memo,
      });

      const tenantId = (result as { insertId: number }).insertId;
      return { success: true, tenantId };
    }),

  /** 테넌트 정보 수정 */
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        companyName: z.string().min(1).optional(),
        subscriptionPlan: z.enum(["starter", "standard", "premium"]).optional(),
        billingCycle: z.enum(["monthly", "yearly"]).optional(),
        subscriptionStatus: z.enum(["trial", "active", "suspended", "cancelled"]).optional(),
        subscriptionExpiresAt: z.date().optional(),
        isActive: z.boolean().optional(),
        memo: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      const { id, ...updateData } = input;
      const filtered = Object.fromEntries(
        Object.entries(updateData).filter(([, v]) => v !== undefined)
      );

      await db.update(tenants).set(filtered).where(eq(tenants.id, id));
      return { success: true };
    }),

  /** 구독 정지 */
  suspend: adminProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      await db
        .update(tenants)
        .set({
          subscriptionStatus: "suspended",
          isActive: false,
          memo: input.reason,
        })
        .where(eq(tenants.id, input.id));

      return { success: true };
    }),

  /** 구독 활성화 */
  activate: adminProcedure
    .input(
      z.object({
        id: z.number(),
        plan: z.enum(["starter", "standard", "premium"]).optional(),
        billingCycle: z.enum(["monthly", "yearly"]).optional(),
        expiresAt: z.date().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      const updateData: Record<string, unknown> = {
        subscriptionStatus: "active",
        isActive: true,
      };
      if (input.plan) updateData.subscriptionPlan = input.plan;
      if (input.billingCycle) updateData.billingCycle = input.billingCycle;
      if (input.expiresAt) updateData.subscriptionExpiresAt = input.expiresAt;

      await db.update(tenants).set(updateData).where(eq(tenants.id, input.id));
      return { success: true };
    }),

  /** 샘플 데이터 시드 실행 */
  seedSample: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.id))
        .limit(1);

      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "테넌트를 찾을 수 없습니다." });

      const { seedSampleData } = await import("../services/sampleDataSeeder");
      const result = await seedSampleData(
        (tenant.sampleCategory ?? "golf_tour_mixed") as
          | "golf_tour_domestic"
          | "golf_tour_overseas"
          | "golf_tour_mixed",
        tenant.id
      );

      if (result.success) {
        await db
          .update(tenants)
          .set({ sampleSeeded: true })
          .where(eq(tenants.id, input.id));
      }

      return result;
    }),
});
