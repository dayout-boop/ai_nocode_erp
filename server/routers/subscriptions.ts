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
import { partnerOnboarding } from "../../drizzle/schema";
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

  /** 전체 구독 목록 조회 (관리자) - partnerOnboarding 테이블 기반 */
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(partnerOnboarding)
      .orderBy(desc(partnerOnboarding.createdAt));
    // ERP 구독 관리 UI에 맞는 형태로 변환
    return rows.map((r) => ({
      id: String(r.id),
      partnerId: r.partnerId ?? r.id,
      planId: r.subscriptionPlan ?? "starter",
      status: r.status === "active" ? "active"
        : r.status === "approved" ? "active"
        : r.status === "pending" && r.portonePaymentId ? "pending"
        : r.status === "pending" ? "trial"
        : r.status === "rejected" ? "cancelled"
        : "pending",
      billingCycle: r.billingCycle ?? "monthly",
      startedAt: r.createdAt,
      expiresAt: null as Date | null,
      portonePaymentId: r.portonePaymentId,
      companyName: r.companyName,
    }));
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
});
