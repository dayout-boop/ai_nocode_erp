/**
 * 구독 플랜 결제 tRPC 라우터 (포트원 V2 기반)
 *
 * - getPlans: 구독 플랜 목록 (공개)
 * - preparePayment: 결제 사전 등록 + 결제 ID 생성 (공개)
 * - verifyPayment: 결제 검증 후 구독 활성화 (공개)
 * - getMySubscription: 내 구독 정보 조회 (인증 필요)
 * - cancelSubscription: 구독 취소 (인증 필요)
 * - listAll: 전체 구독 목록 (관리자)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc } from "drizzle-orm";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { SUBSCRIPTION_PLANS, getPlanById } from "../products";
import { partnerOnboarding, tenants, partners } from "../../drizzle/schema";
import { verifyPayment, cancelPayment } from "../services/portone";

// 관리자 전용 프로시저
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});

// ─── partner_subscriptions 테이블 임시 인라인 타입 (스키마 추가 전) ───
// DB에서 직접 쿼리 (Drizzle 없이 raw SQL)
async function getRawDb() {
  const db = await getDb();
  return db;
}

export const subscriptionsRouter = router({
  /** 구독 플랜 목록 조회 */
  getPlans: publicProcedure.query(() => {
    return SUBSCRIPTION_PLANS;
  }),

  /** 테넌트 구독 현황 조회 (관리자 - 업체 ID로 조회) */
  getTenantStatus: adminProcedure
    .input(z.object({ tenantId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getRawDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "테넌트를 찾을 수 없습니다." });
      const plan = getPlanById(tenant.subscriptionPlan ?? "starter");
      return {
        tenantId: tenant.id,
        companyName: tenant.companyName,
        slug: tenant.slug,
        plan: plan ?? null,
        subscriptionStatus: tenant.subscriptionStatus,
        subscriptionExpiresAt: tenant.subscriptionExpiresAt,
        billingCycle: tenant.billingCycle,
        isActive: tenant.isActive,
        aiCreditsBalance: tenant.aiCreditsBalance,
        aiCreditsMonthlyLimit: tenant.aiCreditsMonthlyLimit,
        aiCreditsUsedThisMonth: tenant.aiCreditsUsedThisMonth,
        aiCreditsResetAt: tenant.aiCreditsResetAt,
      };
    }),

  /** 전체 테넌트 목록 (관리자) */
  listTenants: adminProcedure.query(async () => {
    const db = await getRawDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
    const rows = await db
      .select()
      .from(tenants)
      .orderBy(desc(tenants.id));
    return rows.map(t => ({
      ...t,
      plan: getPlanById(t.subscriptionPlan ?? "starter"),
    }));
  }),

  /** 테넌트 구독 플랜 변경 (관리자) */
  updateTenantPlan: adminProcedure
    .input(z.object({
      tenantId: z.number().int().positive(),
      plan: z.enum(["starter", "standard", "premium"]),
      billingCycle: z.enum(["monthly", "yearly"]).optional(),
      subscriptionStatus: z.enum(["trial", "active", "suspended", "cancelled"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getRawDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const newPlan = getPlanById(input.plan);
      if (!newPlan) throw new TRPCError({ code: "BAD_REQUEST", message: "유효하지 않은 플랜입니다." });
      const updateData: Record<string, any> = {
        subscriptionPlan: input.plan,
        aiCreditsMonthlyLimit: newPlan.aiCreditsPerMonth,
        updatedAt: new Date(),
      };
      if (input.billingCycle) updateData.billingCycle = input.billingCycle;
      if (input.subscriptionStatus) updateData.subscriptionStatus = input.subscriptionStatus;
      await db.update(tenants).set(updateData).where(eq(tenants.id, input.tenantId));
      return { success: true, plan: newPlan.name };
    }),

  /** 월간 AI 크레딧 리셋 (관리자 수동 또는 스케줄러 호출) */
  resetMonthlyAiCredits: adminProcedure
    .input(z.object({ tenantId: z.number().int().positive().optional() }))
    .mutation(async ({ input }) => {
      const db = await getRawDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const now = new Date();
      if (input.tenantId) {
        // 단일 테넌트 리셋
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, input.tenantId)).limit(1);
        if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "테넌트를 찾을 수 없습니다." });
        const plan = getPlanById(tenant.subscriptionPlan ?? "starter");
        const newBalance = plan?.aiCreditsPerMonth ?? 100;
        await db.update(tenants).set({
          aiCreditsBalance: newBalance,
          aiCreditsUsedThisMonth: 0,
          aiCreditsResetAt: now,
          updatedAt: now,
        }).where(eq(tenants.id, input.tenantId));
        return { success: true, reset: 1, newBalance };
      } else {
        // 전체 테넌트 일괄 리셋
        const allTenants = await db.select().from(tenants).where(eq(tenants.isActive, true));
        let resetCount = 0;
        for (const t of allTenants) {
          const plan = getPlanById(t.subscriptionPlan ?? "starter");
          const newBalance = plan?.aiCreditsPerMonth ?? 100;
          await db.update(tenants).set({
            aiCreditsBalance: newBalance,
            aiCreditsUsedThisMonth: 0,
            aiCreditsResetAt: now,
            updatedAt: now,
          }).where(eq(tenants.id, t.id));
          resetCount++;
        }
        return { success: true, reset: resetCount };
      }
    }),

  /**
   * 결제 사전 등록
   * 포트원 V2는 프론트엔드에서 직접 결제창을 띄우므로
   * 서버에서는 결제 ID와 금액만 생성해서 반환
   */
  preparePayment: publicProcedure
    .input(
      z.object({
        plan: z.enum(["starter", "standard", "premium"]),
        billingCycle: z.enum(["monthly", "yearly"]),
        companyName: z.string().min(1),
        contactEmail: z.string().email(),
        contactName: z.string().min(1),
        onboardingId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const plan = getPlanById(input.plan);
      if (!plan) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "유효하지 않은 플랜입니다." });
      }

      // Starter 플랜은 무료 - 결제 불필요
      if (plan.id === "starter") {
        return {
          isFree: true,
          paymentId: null,
          amount: 0,
          orderName: `두골프 ERP ${plan.name} 플랜 (무료)`,
          storeId: ENV.portoneStoreId,
          channelKey: ENV.portoneChannelKey,
        };
      }

      const amount =
        input.billingCycle === "yearly" ? plan.yearlyPriceKrw : plan.monthlyPriceKrw;

      // 고유 결제 ID 생성 (타임스탬프 + 랜덤)
      const paymentId = `dogolf-sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const orderName = `두골프 ERP ${plan.name} 플랜 (${input.billingCycle === "yearly" ? "연간" : "월간"})`;

      return {
        isFree: false,
        paymentId,
        amount,
        orderName,
        storeId: ENV.portoneStoreId,
        channelKey: ENV.portoneChannelKey,
        customerEmail: input.contactEmail,
        customerName: input.contactName,
        customData: JSON.stringify({
          plan: input.plan,
          billingCycle: input.billingCycle,
          companyName: input.companyName,
          onboardingId: input.onboardingId,
        }),
      };
    }),

  /**
   * 결제 검증 및 구독 활성화
   * 포트원 V2 결제 완료 후 서버에서 검증
   */
  verifyAndActivate: publicProcedure
    .input(
      z.object({
        paymentId: z.string(),
        plan: z.enum(["starter", "standard", "premium"]),
        billingCycle: z.enum(["monthly", "yearly"]),
        companyName: z.string(),
        contactEmail: z.string().email(),
        contactName: z.string(),
        onboardingId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const plan = getPlanById(input.plan);
      if (!plan) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "유효하지 않은 플랜입니다." });
      }

      // Starter 무료 플랜은 검증 없이 바로 활성화
      if (plan.id === "starter") {
        // 온보딩 상태 업데이트
        if (input.onboardingId) {
          const db = await getRawDb();
          if (db) {
            await db
              .update(partnerOnboarding)
              .set({
                subscriptionPlan: "starter",
                billingCycle: input.billingCycle,
                status: "pending", // 관리자 심사 대기
                updatedAt: new Date(),
              })
              .where(eq(partnerOnboarding.id, input.onboardingId));
          }
        }
        return {
          success: true,
          plan: plan.id,
          message: "스타터 플랜으로 신청이 완료되었습니다. 관리자 심사 후 활성화됩니다.",
        };
      }

      const expectedAmount =
        input.billingCycle === "yearly" ? plan.yearlyPriceKrw : plan.monthlyPriceKrw;

      // 포트원 결제 검증
      const result = await verifyPayment(input.paymentId, expectedAmount);

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error ?? "결제 검증에 실패했습니다.",
        });
      }

      // 온보딩 상태 업데이트 (결제 완료)
      if (input.onboardingId) {
        const db = await getRawDb();
        if (db) {
          await db
            .update(partnerOnboarding)
            .set({
              subscriptionPlan: input.plan,
              billingCycle: input.billingCycle,
              portonePaymentId: input.paymentId,
              status: "approved", // 결제 완료 → 자동 승인
              updatedAt: new Date(),
            })
            .where(eq(partnerOnboarding.id, input.onboardingId));
        }
      }

      return {
        success: true,
        plan: plan.id,
        paymentId: input.paymentId,
        amount: result.payment?.amount.total,
        message: `${plan.name} 플랜 결제가 완료되었습니다. ERP 시스템이 활성화됩니다.`,
      };
    }),

  /**
   * 전체 구독 목록 조회 (관리자) — tenants(구독 정본) 기반으로 재구성.
   *
   * [정본 원칙] 실제 구독 상태/플랜/만료일은 tenants 테이블이 정본이다.
   * partner_onboarding은 '신청서'일 뿐 만료일/코드연결 정보를 갖지 않는다.
   * 따라서 tenants를 기준으로 partners(코드연결·업체명)와 onboarding(접수일·결제ID)을
   * LEFT JOIN하여 통합한다. 또한 아직 테넌트가 생성되지 않은 신청서도
   * 누락 없이 'pending(테넌트 미생성)' 상태로 함께 노출한다.
   */
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    // 1) tenants 정본 + partners 코드연결 조인
    const tenantRows = await db
      .select({
        tenantId: tenants.id,
        partnerId: tenants.partnerId,
        onboardingId: tenants.onboardingId,
        slug: tenants.slug,
        companyName: tenants.companyName,
        subscriptionPlan: tenants.subscriptionPlan,
        subscriptionStatus: tenants.subscriptionStatus,
        billingCycle: tenants.billingCycle,
        subscriptionExpiresAt: tenants.subscriptionExpiresAt,
        isActive: tenants.isActive,
        memo: tenants.memo,
        createdAt: tenants.createdAt,
        partnerCompanyName: partners.companyName,
        partnerTenantId: partners.tenantId,
      })
      .from(tenants)
      .leftJoin(partners, eq(partners.id, tenants.partnerId))
      .orderBy(desc(tenants.createdAt));

    const linkedOnboardingIds = new Set(
      tenantRows.map((t) => t.onboardingId).filter((v): v is number => v != null)
    );

    const tenantList = tenantRows.map((t) => ({
      id: `tenant-${t.tenantId}`,
      source: "tenant" as const,
      tenantId: t.tenantId,
      partnerId: t.partnerId ?? null,
      // 코드연결: 파트너의 tenantId 역참조가 정상 연결되었는지 표시
      codeLinked: t.partnerTenantId === t.tenantId,
      companyName: t.companyName ?? t.partnerCompanyName ?? "(미지정)",
      planId: t.subscriptionPlan,
      status: t.subscriptionStatus,
      billingCycle: t.billingCycle,
      startedAt: t.createdAt,
      expiresAt: t.subscriptionExpiresAt,
      portonePaymentId: null as string | null,
      memo: t.memo ?? null,
    }));

    // 2) 테넌트가 아직 생성되지 않은 신청서(onboarding) 병합 노출
    const onboardingRows = await db
      .select()
      .from(partnerOnboarding)
      .orderBy(desc(partnerOnboarding.createdAt));

    const orphanOnboarding = onboardingRows
      .filter((r) => !linkedOnboardingIds.has(r.id))
      .map((r) => ({
        id: `onboarding-${r.id}`,
        source: "onboarding" as const,
        tenantId: null as number | null,
        partnerId: r.partnerId ?? null,
        codeLinked: false,
        companyName: r.companyName ?? "(미지정)",
        planId: r.subscriptionPlan ?? "starter",
        status: r.status === "approved" ? "active"
          : r.status === "pending" && r.portonePaymentId ? "pending"
          : r.status === "pending" ? "trial"
          : r.status === "rejected" ? "cancelled"
          : "pending",
        billingCycle: r.billingCycle ?? "monthly",
        startedAt: r.createdAt,
        expiresAt: null as Date | null,
        portonePaymentId: r.portonePaymentId ?? null,
        memo: null as string | null,
      }));

    return [...tenantList, ...orphanOnboarding];
  }),

  /** 결제 검증 (관리자) */
  verify: adminProcedure
    .input(z.object({
      paymentId: z.string(),
      subscriptionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      // partnerOnboarding에서 해당 레코드 찾기
      const rows = await db
        .select()
        .from(partnerOnboarding)
        .where(eq(partnerOnboarding.id, parseInt(input.subscriptionId)))
        .limit(1);
      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "구독 정보를 찾을 수 없습니다." });
      const row = rows[0];
      const plan = getPlanById(row.subscriptionPlan ?? "starter");
      if (!plan) throw new TRPCError({ code: "BAD_REQUEST", message: "유효하지 않은 플랜" });
      const expectedAmount = (row.billingCycle === "yearly") ? plan.yearlyPriceKrw : plan.monthlyPriceKrw;
      const result = await verifyPayment(input.paymentId, expectedAmount);
      if (result.success) {
        await db.update(partnerOnboarding)
          .set({ status: "approved", updatedAt: new Date() })
          .where(eq(partnerOnboarding.id, parseInt(input.subscriptionId)));
      }
      return result;
    }),

  /** 구독 취소 (관리자) */
  cancel: adminProcedure
    .input(z.object({ subscriptionId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const rows = await db
        .select()
        .from(partnerOnboarding)
        .where(eq(partnerOnboarding.id, parseInt(input.subscriptionId)))
        .limit(1);
      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "구독 정보를 찾을 수 없습니다." });
      const row = rows[0];
      // 포트원 결제 취소 (결제 ID가 있는 경우)
      if (row.portonePaymentId) {
        try {
          await cancelPayment(row.portonePaymentId, "관리자 구독 취소");
        } catch (e) {
          console.error("[Subscriptions] 포트원 취소 실패:", e);
        }
      }
      await db.update(partnerOnboarding)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(partnerOnboarding.id, parseInt(input.subscriptionId)));
      return { success: true };
    }),

  /**
   * 테넌트 구독 상태 변경 (관리자) — tenants 정본 직접 제어.
   * suspended(정지) / active(재개) / cancelled(해지) 전환과 isActive 동기화.
   */
  setTenantStatus: adminProcedure
    .input(z.object({
      tenantId: z.number().int().positive(),
      status: z.enum(["active", "suspended", "cancelled", "trial"]),
      memo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const rows = await db.select().from(tenants).where(eq(tenants.id, input.tenantId)).limit(1);
      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "테넌트를 찾을 수 없습니다." });
      await db.update(tenants)
        .set({
          subscriptionStatus: input.status,
          isActive: input.status === "active" || input.status === "trial",
          ...(input.memo !== undefined ? { memo: input.memo } : {}),
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, input.tenantId));
      return { success: true };
    }),
});
