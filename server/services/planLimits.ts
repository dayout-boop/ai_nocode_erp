/**
 * 플랜별 기능 제한 체크 헬퍼
 * - 패키지 수, 월 예약 수, AI 크레딧 한도 초과 여부 확인
 * - 모든 분양 ERP 라우터에서 사용
 */
import { eq, count, and, gte } from "drizzle-orm";
import { getDb } from "../db";
import { tenants, packages as packagesTable, bookings } from "../../drizzle/schema";
import { SUBSCRIPTION_PLANS, getPlanById } from "../products";
import { TRPCError } from "@trpc/server";

export interface PlanLimitResult {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
  planName: string;
}

/**
 * 테넌트 정보 + 플랜 조회
 */
export async function getTenantWithPlan(tenantId: number) {
  const db = await getDb();
  if (!db) return null;
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) return null;
  const plan = getPlanById(tenant.subscriptionPlan ?? "starter");
  return { tenant, plan };
}

/**
 * 패키지 수 제한 체크
 */
export async function checkPackageLimit(tenantId: number): Promise<PlanLimitResult> {
  const db = await getDb();
  if (!db) return { allowed: true, current: 0, limit: 9999, planName: "unknown" };

  const result = await getTenantWithPlan(tenantId);
  if (!result) return { allowed: true, current: 0, limit: 9999, planName: "unknown" };

  const { tenant, plan } = result;
  const maxPackages = plan?.maxPackages ?? 9999;
  const planName = plan?.name ?? "스타터";

  const [{ value: currentCount }] = await db
    .select({ value: count() })
    .from(packagesTable)
    .where(eq((packagesTable as any).tenantId, tenantId));

  const current = Number(currentCount ?? 0);
  const allowed = current < maxPackages;

  return {
    allowed,
    reason: allowed ? undefined : `${planName} 플랜 패키지 한도(${maxPackages}개)를 초과했습니다. 플랜을 업그레이드하세요.`,
    current,
    limit: maxPackages,
    planName,
  };
}

/**
 * 월 예약 수 제한 체크
 */
export async function checkBookingLimit(tenantId: number): Promise<PlanLimitResult> {
  const db = await getDb();
  if (!db) return { allowed: true, current: 0, limit: 9999, planName: "unknown" };

  const result = await getTenantWithPlan(tenantId);
  if (!result) return { allowed: true, current: 0, limit: 9999, planName: "unknown" };

  const { tenant, plan } = result;
  const maxBookings = plan?.maxBookingsPerMonth ?? 9999;
  const planName = plan?.name ?? "스타터";

  // 이번 달 1일 00:00:00
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [{ value: currentCount }] = await db
    .select({ value: count() })
    .from(bookings)
    .where(
      and(
        eq((bookings as any).tenantId, tenantId),
        gte(bookings.createdAt, monthStart)
      )
    );

  const current = Number(currentCount ?? 0);
  const allowed = current < maxBookings;

  return {
    allowed,
    reason: allowed ? undefined : `${planName} 플랜 월 예약 한도(${maxBookings}건)를 초과했습니다. 플랜을 업그레이드하세요.`,
    current,
    limit: maxBookings,
    planName,
  };
}

/**
 * AI 크레딧 잔액 체크
 */
export async function checkAiCreditLimit(tenantId: number): Promise<PlanLimitResult> {
  const db = await getDb();
  if (!db) return { allowed: true, current: 0, limit: 9999, planName: "unknown" };

  const result = await getTenantWithPlan(tenantId);
  if (!result) return { allowed: true, current: 0, limit: 9999, planName: "unknown" };

  const { tenant, plan } = result;
  const balance = tenant.aiCreditsBalance ?? 0;
  const monthlyLimit = tenant.aiCreditsMonthlyLimit ?? (plan?.aiCreditsPerMonth ?? 100);
  const planName = plan?.name ?? "스타터";

  // premium 플랜은 무제한
  if (plan?.id === "premium") {
    return { allowed: true, current: balance, limit: 9999, planName };
  }

  const allowed = balance > 0;

  return {
    allowed,
    reason: allowed ? undefined : `AI 크레딧이 소진되었습니다. 크레딧을 충전하거나 플랜을 업그레이드하세요.`,
    current: balance,
    limit: monthlyLimit,
    planName,
  };
}

/**
 * 플랜 제한 초과 시 TRPCError throw
 */
export function assertPlanLimit(result: PlanLimitResult): void {
  if (!result.allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: result.reason ?? "플랜 한도를 초과했습니다.",
    });
  }
}

/**
 * 구독 상태 체크 (suspended/cancelled 차단)
 */
export async function assertSubscriptionActive(tenantId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const [tenant] = await db
    .select({ subscriptionStatus: tenants.subscriptionStatus, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) return;

  if (!tenant.isActive) {
    throw new TRPCError({ code: "FORBIDDEN", message: "비활성화된 테넌트입니다. 관리자에게 문의하세요." });
  }

  if (tenant.subscriptionStatus === "suspended") {
    throw new TRPCError({ code: "FORBIDDEN", message: "구독이 정지되었습니다. 결제 정보를 확인하세요." });
  }

  if (tenant.subscriptionStatus === "cancelled") {
    throw new TRPCError({ code: "FORBIDDEN", message: "구독이 취소되었습니다. 재구독이 필요합니다." });
  }
}
