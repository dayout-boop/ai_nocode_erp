/**
 * creditGateway.ts
 * AI 크레딧 게이트웨이 미들웨어
 *
 * 역할:
 * 1. 분양 테넌트 AI 호출 전 크레딧 잔액 확인
 * 2. 호출 후 크레딧 차감 + ai_cost_logs에 tenantId 기록
 * 3. 한도 초과 시 결제 유도 에러 반환
 * 4. 두골프 자체(tenantId=undefined) 호출은 게이트웨이 통과 (두골프 부담)
 * 5. 업체 자체 API 키 등록 시 해당 키로 호출 (업체 부담, 크레딧 차감 없음)
 *
 * 크레딧 단위: 1 크레딧 = 10,000 토큰 묶음
 * 충전 단위: 50크레딧(5만원), 100크레딧(10만원), 200크레딧(20만원)
 */

import { getDb } from "../db";
import { tenants, tenantAiCredits, aiCostLogs } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { ChatOptions, ChatResult } from "./openrouter";
import { orchestratorChat } from "./openrouter";

/** 1 크레딧당 토큰 수 */
const TOKENS_PER_CREDIT = 10_000;

/** 플랜별 월간 크레딧 한도 */
export const PLAN_CREDIT_LIMITS: Record<string, number> = {
  starter: 10,
  standard: 50,
  premium: 200,
};

/** 충전 패키지 */
export const CREDIT_PACKAGES = [
  { credits: 50, priceKrw: 50_000, label: "50 크레딧 (5만원)" },
  { credits: 100, priceKrw: 100_000, label: "100 크레딧 (10만원)" },
  { credits: 200, priceKrw: 200_000, label: "200 크레딧 (20만원)" },
];

/**
 * 토큰 수를 크레딧으로 변환 (올림)
 */
function tokensToCreditCost(tokensIn: number, tokensOut: number): number {
  const totalTokens = tokensIn + tokensOut;
  return Math.ceil(totalTokens / TOKENS_PER_CREDIT);
}

/**
 * 테넌트 AI 크레딧 정보 조회
 */
export async function getTenantCreditInfo(tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 실패");

  const [tenant] = await db
    .select({
      id: tenants.id,
      companyName: tenants.companyName,
      subscriptionPlan: tenants.subscriptionPlan,
      aiCreditsBalance: tenants.aiCreditsBalance,
      aiCreditsMonthlyLimit: tenants.aiCreditsMonthlyLimit,
      aiCreditsUsedThisMonth: tenants.aiCreditsUsedThisMonth,
      aiCreditsResetAt: tenants.aiCreditsResetAt,
      customOpenrouterKeyEncrypted: tenants.customOpenrouterKeyEncrypted,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return tenant ?? null;
}

/**
 * 월 초기화 체크 및 실행
 * - aiCreditsResetAt이 이번 달 1일 이전이면 사용량 초기화
 */
async function checkAndResetMonthlyCredits(tenantId: number) {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [tenant] = await db
    .select({ aiCreditsResetAt: tenants.aiCreditsResetAt, aiCreditsUsedThisMonth: tenants.aiCreditsUsedThisMonth })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) return;

  const resetAt = tenant.aiCreditsResetAt;
  if (!resetAt || resetAt < firstOfMonth) {
    // 월 초기화
    await db
      .update(tenants)
      .set({
        aiCreditsUsedThisMonth: 0,
        aiCreditsResetAt: firstOfMonth,
      })
      .where(eq(tenants.id, tenantId));

    // 이력 기록
    const [updatedTenant] = await db
      .select({ aiCreditsBalance: tenants.aiCreditsBalance })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    await db.insert(tenantAiCredits).values({
      tenantId,
      type: "monthly_reset",
      amount: 0,
      balanceAfter: updatedTenant?.aiCreditsBalance ?? 0,
      memo: `${now.getFullYear()}년 ${now.getMonth() + 1}월 사용량 초기화`,
    });
  }
}

/**
 * 크레딧 차감 처리
 */
async function deductCredits(
  tenantId: number,
  creditCost: number,
  aiCostLogId?: number,
  memo?: string
) {
  const db = await getDb();
  if (!db) return;

  // 잔액 차감
  await db
    .update(tenants)
    .set({
      aiCreditsBalance: sql`GREATEST(0, ${tenants.aiCreditsBalance} - ${creditCost})`,
      aiCreditsUsedThisMonth: sql`${tenants.aiCreditsUsedThisMonth} + ${creditCost}`,
    })
    .where(eq(tenants.id, tenantId));

  // 차감 후 잔액 조회
  const [updated] = await db
    .select({ aiCreditsBalance: tenants.aiCreditsBalance })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  // 이력 기록
  await db.insert(tenantAiCredits).values({
    tenantId,
    type: "deduct",
    amount: -creditCost,
    balanceAfter: updated?.aiCreditsBalance ?? 0,
    aiCostLogId,
    memo: memo ?? `AI 호출 ${creditCost} 크레딧 차감`,
  });
}

/**
 * 메인 게이트웨이 함수
 * - tenantId가 없으면 두골프 자체 호출로 간주 (크레딧 체크 없음)
 * - tenantId가 있으면 크레딧 확인 → 호출 → 차감
 */
export async function gatewayChat(
  options: ChatOptions & { tenantId?: number }
): Promise<ChatResult & { creditCost?: number; creditsRemaining?: number }> {
  const { tenantId } = options;

  // 두골프 자체 호출: 게이트웨이 통과
  if (!tenantId) {
    const result = await orchestratorChat(options);

    // ai_cost_logs에 tenantId=null로 기록 (기존 로직 유지)
    try {
      const db = await getDb();
      if (db) {
        await db.insert(aiCostLogs).values({
          model: result.model,
          modelName: result.model,
          complexity: options.complexity,
          taskType: options.assistant,
          inputTokens: result.tokensIn,
          outputTokens: result.tokensOut,
          costUsd: String(result.costUsd),
          durationMs: result.durationMs,
          isSuccess: true,
          userId: options.userId,
          assistant: options.assistant,
          tenantId: null,
        });
      }
    } catch (logErr) {
      console.warn("[creditGateway] 비용 로그 기록 실패:", logErr);
    }

    return result;
  }

  // 분양 업체 호출: 크레딧 확인
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

  // 월 초기화 체크
  await checkAndResetMonthlyCredits(tenantId);

  const tenantInfo = await getTenantCreditInfo(tenantId);
  if (!tenantInfo) {
    throw new TRPCError({ code: "NOT_FOUND", message: "테넌트 정보를 찾을 수 없습니다." });
  }

  // 잔액 확인 (최소 1 크레딧 필요)
  if (tenantInfo.aiCreditsBalance <= 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: JSON.stringify({
        type: "CREDIT_EXHAUSTED",
        message: "AI 크레딧이 소진되었습니다. 크레딧을 충전해주세요.",
        creditsBalance: tenantInfo.aiCreditsBalance,
        packages: CREDIT_PACKAGES,
      }),
    });
  }

  // AI 호출 실행
  const result = await orchestratorChat({ ...options, tenantId });

  // 크레딧 계산 및 차감
  const creditCost = Math.max(1, tokensToCreditCost(result.tokensIn, result.tokensOut));

  // ai_cost_logs 기록
  let costLogId: number | undefined;
  try {
    const [inserted] = await db.insert(aiCostLogs).values({
      model: result.model,
      modelName: result.model,
      complexity: options.complexity,
      taskType: options.assistant,
      inputTokens: result.tokensIn,
      outputTokens: result.tokensOut,
      costUsd: String(result.costUsd),
      durationMs: result.durationMs,
      isSuccess: true,
      userId: options.userId,
      assistant: options.assistant,
      tenantId,
    });
    costLogId = (inserted as { insertId?: number }).insertId;
  } catch (logErr) {
    console.warn("[creditGateway] 비용 로그 기록 실패:", logErr);
  }

  // 크레딧 차감
  await deductCredits(
    tenantId,
    creditCost,
    costLogId,
    `${options.assistant} AI 호출 (${result.tokensIn + result.tokensOut} 토큰)`
  );

  // 차감 후 잔액
  const updatedInfo = await getTenantCreditInfo(tenantId);
  const creditsRemaining = updatedInfo?.aiCreditsBalance ?? 0;

  // 잔액 10% 이하 경고
  if (creditsRemaining <= Math.ceil(tenantInfo.aiCreditsMonthlyLimit * 0.1)) {
    console.warn(`[creditGateway] 테넌트 ${tenantId} 크레딧 잔액 부족 경고: ${creditsRemaining} 크레딧 남음`);
  }

  return {
    ...result,
    creditCost,
    creditsRemaining,
  };
}

/**
 * 크레딧 충전 (관리자용)
 */
export async function chargeCredits(
  tenantId: number,
  credits: number,
  paidAmountKrw?: number,
  processedBy?: number,
  memo?: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 실패");

  // 잔액 추가
  await db
    .update(tenants)
    .set({
      aiCreditsBalance: sql`${tenants.aiCreditsBalance} + ${credits}`,
    })
    .where(eq(tenants.id, tenantId));

  // 충전 후 잔액 조회
  const [updated] = await db
    .select({ aiCreditsBalance: tenants.aiCreditsBalance })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  // 이력 기록
  await db.insert(tenantAiCredits).values({
    tenantId,
    type: "charge",
    amount: credits,
    balanceAfter: updated?.aiCreditsBalance ?? 0,
    paidAmountKrw,
    processedBy,
    memo: memo ?? `${credits} 크레딧 충전`,
  });

  return { success: true, newBalance: updated?.aiCreditsBalance ?? 0 };
}
