/**
 * tenantAi.ts
 * 분양 테넌트 AI 관련 API 라우터
 *
 * - 크레딧 조회/충전/이력
 * - 외부 API 연결 관리 (암호화 저장)
 * - 외부 API 기반 개발 요청 승인 플로우
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure, partnerManagerProcedure, partnerProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  tenants,
  tenantAiCredits,
  tenantApiConnections,
  tenantApiDevRequests,
  tenantCreditRequests,
  aiCostLogs,
} from "../../drizzle/schema";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chargeCredits, getTenantCreditInfo, CREDIT_PACKAGES, PLAN_CREDIT_LIMITS } from "../services/creditGateway";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";
import { checkRequestForBlockedKeywords, logRejectedRequest, NO_CROSS_DESK_KNOWLEDGE_DIRECTIVE } from "../services/knowledgeFilter";
import crypto from "crypto";

// 간단한 암호화 헬퍼 (AES-256-GCM)
const ENCRYPT_KEY = process.env.JWT_SECRET?.slice(0, 32).padEnd(32, "0") ?? "dogolf-api-key-encrypt-key-32ch";

function encryptApiKey(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(ENCRYPT_KEY), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptApiKey(ciphertext: string): string {
  try {
    const buf = Buffer.from(ciphertext, "base64");
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const encrypted = buf.slice(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(ENCRYPT_KEY), iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final("utf8");
  } catch {
    return "[복호화 실패]";
  }
}

export const tenantAiRouter = router({
  // ─── 크레딧 조회 ──────────────────────────────────────────────
  getCreditInfo: adminProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      const info = await getTenantCreditInfo(input.tenantId);
      if (!info) throw new TRPCError({ code: "NOT_FOUND", message: "테넌트를 찾을 수 없습니다." });

      const planLimit = PLAN_CREDIT_LIMITS[info.subscriptionPlan] ?? 10;
      const usagePercent = planLimit > 0
        ? Math.round((info.aiCreditsUsedThisMonth / planLimit) * 100)
        : 0;

      return {
        ...info,
        planLimit,
        usagePercent,
        creditPackages: CREDIT_PACKAGES,
      };
    }),

  // ─── 전체 테넌트 크레딧 현황 (마스터 통합 뷰) ──────────────────
  getAllTenantsCredit: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const rows = await db
      .select({
        id: tenants.id,
        companyName: tenants.companyName,
        subscriptionPlan: tenants.subscriptionPlan,
        aiCreditsBalance: tenants.aiCreditsBalance,
        aiCreditsMonthlyLimit: tenants.aiCreditsMonthlyLimit,
        aiCreditsUsedThisMonth: tenants.aiCreditsUsedThisMonth,
        isActive: tenants.isActive,
      })
      .from(tenants)
      .where(eq(tenants.isActive, true))
      .orderBy(desc(tenants.aiCreditsUsedThisMonth));

    return rows;
  }),

  // ─── 크레딧 충전 (관리자) ──────────────────────────────────────
  chargeCredits: adminProcedure
    .input(
      z.object({
        tenantId: z.number(),
        credits: z.number().min(1).max(1000),
        paidAmountKrw: z.number().optional(),
        memo: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await chargeCredits(
        input.tenantId,
        input.credits,
        input.paidAmountKrw,
        ctx.user.id,
        input.memo
      );
      return result;
    }),

  // ─── 크레딧 이력 조회 ──────────────────────────────────────────
  getCreditHistory: adminProcedure
    .input(
      z.object({
        tenantId: z.number(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select()
        .from(tenantAiCredits)
        .where(eq(tenantAiCredits.tenantId, input.tenantId))
        .orderBy(desc(tenantAiCredits.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  // ─── 테넌트별 AI 비용 통계 ──────────────────────────────────────
  getTenantAiStats: adminProcedure
    .input(
      z.object({
        tenantId: z.number(),
        days: z.number().default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const rows = await db
        .select({
          assistant: aiCostLogs.assistant,
          model: aiCostLogs.model,
          totalCalls: sql<number>`COUNT(*)`,
          totalTokensIn: sql<number>`SUM(${aiCostLogs.inputTokens})`,
          totalTokensOut: sql<number>`SUM(${aiCostLogs.outputTokens})`,
          totalCostUsd: sql<number>`SUM(CAST(${aiCostLogs.costUsd} AS DECIMAL(12,8)))`,
        })
        .from(aiCostLogs)
        .where(
          and(
            eq(aiCostLogs.tenantId, input.tenantId),
            gte(aiCostLogs.createdAt, since)
          )
        )
        .groupBy(aiCostLogs.assistant, aiCostLogs.model)
        .orderBy(desc(sql`totalCostUsd`));

      return rows;
    }),

  // ─── 외부 API 연결 목록 ──────────────────────────────────────────
  listApiConnections: adminProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select({
          id: tenantApiConnections.id,
          tenantId: tenantApiConnections.tenantId,
          serviceName: tenantApiConnections.serviceName,
          serviceLabel: tenantApiConnections.serviceLabel,
          status: tenantApiConnections.status,
          lastTestedAt: tenantApiConnections.lastTestedAt,
          lastError: tenantApiConnections.lastError,
          aiAnalysisMemo: tenantApiConnections.aiAnalysisMemo,
          isActive: tenantApiConnections.isActive,
          createdAt: tenantApiConnections.createdAt,
          // API 키는 마스킹하여 반환 (복호화 후 앞 4자리만)
          apiKeyMasked: tenantApiConnections.apiKeyEncrypted,
        })
        .from(tenantApiConnections)
        .where(eq(tenantApiConnections.tenantId, input.tenantId))
        .orderBy(desc(tenantApiConnections.createdAt));

      // API 키 마스킹 처리
      return rows.map((row) => ({
        ...row,
        apiKeyMasked: row.apiKeyMasked
          ? decryptApiKey(row.apiKeyMasked).slice(0, 4) + "****"
          : null,
      }));
    }),

  // ─── 외부 API 연결 등록/수정 ──────────────────────────────────────
  upsertApiConnection: adminProcedure
    .input(
      z.object({
        id: z.number().optional(),
        tenantId: z.number(),
        serviceName: z.string().min(1),
        serviceLabel: z.string().optional(),
        apiKey: z.string().optional(),
        apiSecret: z.string().optional(),
        configJson: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const baseValues = {
        tenantId: input.tenantId,
        serviceName: input.serviceName,
        serviceLabel: input.serviceLabel ?? input.serviceName,
        status: "pending" as const,
        apiKeyEncrypted: input.apiKey ? encryptApiKey(input.apiKey) : undefined,
        apiSecretEncrypted: input.apiSecret ? encryptApiKey(input.apiSecret) : undefined,
        configJson: input.configJson ?? undefined,
      };

      if (input.id) {
        await db
          .update(tenantApiConnections)
          .set(baseValues)
          .where(eq(tenantApiConnections.id, input.id));
        return { success: true, id: input.id };
      } else {
        const [result] = await db.insert(tenantApiConnections).values(baseValues);
        const insertId = (result as { insertId: number }).insertId;

        // 두골프 매니저 AI 자동 분석 (비동기)
        analyzeApiConnectionAsync(insertId, input.tenantId, input.serviceName, input.serviceLabel).catch(
          console.error
        );

        return { success: true, id: insertId };
      }
    }),

  // ─── 외부 API 개발 요청 목록 ──────────────────────────────────────
  listApiDevRequests: adminProcedure
    .input(
      z.object({
        tenantId: z.number().optional(),
        approvalStatus: z.enum(["pending", "approved", "rejected", "in_progress", "completed"]).optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [];
      if (input.tenantId) conditions.push(eq(tenantApiDevRequests.tenantId, input.tenantId));
      if (input.approvalStatus) conditions.push(eq(tenantApiDevRequests.approvalStatus, input.approvalStatus));

      const rows = await db
        .select()
        .from(tenantApiDevRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(tenantApiDevRequests.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  // ─── 크레딧 충전 요청 생성 (파트너 매니저) ──────────────────────
  requestCreditCharge: partnerManagerProcedure
    .input(
      z.object({
        requestType: z.enum(["pg", "manual"]).default("manual"),
        packageId: z.string(),
        depositorName: z.string().optional(),
        depositMemo: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tenantId = ctx.tenantId;
      if (!tenantId) throw new TRPCError({ code: "UNAUTHORIZED", message: "테넌트 정보를 찾을 수 없습니다." });

      // 패키지 유효성 확인
      const pkg = CREDIT_PACKAGES.find((p) => p.credits.toString() === input.packageId);
      if (!pkg) throw new TRPCError({ code: "BAD_REQUEST", message: "유효하지 않은 충전 패키지입니다." });

      // 이미 대기 중인 요청이 있는지 확인
      const [existing] = await db
        .select({ id: tenantCreditRequests.id })
        .from(tenantCreditRequests)
        .where(
          and(
            eq(tenantCreditRequests.tenantId, tenantId),
            eq(tenantCreditRequests.status, "pending")
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 처리 대기 중인 충전 요청이 있습니다. 승인 후 새 요청을 생성해주세요.",
        });
      }

      const [result] = await db.insert(tenantCreditRequests).values({
        tenantId,
        requestType: input.requestType,
        packageId: input.packageId,
        credits: pkg.credits,
        amountKrw: pkg.priceKrw,
        status: "pending",
        depositorName: input.depositorName,
        depositMemo: input.depositMemo,
      });

      const insertId = (result as { insertId: number }).insertId;

      // 오너에게 알림
      await notifyOwner({
        title: `[두골프 ERP] 크레딧 충전 요청 (${pkg.label})`,
        content: `테넌트 ID ${tenantId}에서 크레딧 충전을 요청했습니다.\n\n패키지: ${pkg.label}\n금액: ${pkg.priceKrw.toLocaleString()}원\n유형: ${input.requestType === "manual" ? "수동 입금" : "PG 결제"}\n입금자명: ${input.depositorName ?? "-"}\n메모: ${input.depositMemo ?? "-"}\n\nERP > 분양 AI 콘솔에서 확인 후 승인해주세요.`,
      }).catch(console.error);

      return { success: true, requestId: insertId };
    }),

  // ─── 크레딧 충전 요청 목록 조회 (파트너 매니저 본인) ──────────────
  getMyCreditRequests: partnerManagerProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tenantId = ctx.tenantId;
      if (!tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const rows = await db
        .select()
        .from(tenantCreditRequests)
        .where(eq(tenantCreditRequests.tenantId, tenantId))
        .orderBy(desc(tenantCreditRequests.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  // ─── 파트너 크레딧 잔액 조회 (파트너 매니저) ──────────────────────
  getMyCredit: partnerManagerProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const tenantId = ctx.tenantId;
    if (!tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const [tenant] = await db
      .select({
        aiCreditsBalance: tenants.aiCreditsBalance,
        aiCreditsMonthlyLimit: tenants.aiCreditsMonthlyLimit,
        aiCreditsUsedThisMonth: tenants.aiCreditsUsedThisMonth,
        subscriptionPlan: tenants.subscriptionPlan,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

    // 전월 사용량 (지난달 1일~말일 기간의 deduct 합계)
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [lastMonthRow] = await db
      .select({ total: sql<number>`COALESCE(SUM(ABS(${tenantAiCredits.amount})), 0)` })
      .from(tenantAiCredits)
      .where(
        and(
          eq(tenantAiCredits.tenantId, tenantId),
          eq(tenantAiCredits.type, "deduct"),
          gte(tenantAiCredits.createdAt, lastMonthStart),
          sql`${tenantAiCredits.createdAt} <= ${lastMonthEnd}`
        )
      );

    const lastMonthUsed = lastMonthRow?.total ?? 0;
    const thisMonthUsed = tenant.aiCreditsUsedThisMonth;
    const diff = thisMonthUsed - lastMonthUsed;
    const planLimit = PLAN_CREDIT_LIMITS[tenant.subscriptionPlan] ?? 10;
    const usagePercent = planLimit > 0 ? Math.round((thisMonthUsed / planLimit) * 100) : 0;

    return {
      ...tenant,
      planLimit,
      usagePercent,
      lastMonthUsed,
      thisMonthUsed,
      monthDiff: diff,
      creditPackages: CREDIT_PACKAGES,
    };
  }),

  // ─── 크레딧 충전 요청 전체 목록 (관리자) ──────────────────────────
  getAllCreditRequests: adminProcedure
    .input(
      z.object({
        status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [];
      if (input.status !== "all") {
        conditions.push(eq(tenantCreditRequests.status, input.status));
      }

      const rows = await db
        .select({
          id: tenantCreditRequests.id,
          tenantId: tenantCreditRequests.tenantId,
          requestType: tenantCreditRequests.requestType,
          packageId: tenantCreditRequests.packageId,
          credits: tenantCreditRequests.credits,
          amountKrw: tenantCreditRequests.amountKrw,
          status: tenantCreditRequests.status,
          depositorName: tenantCreditRequests.depositorName,
          depositMemo: tenantCreditRequests.depositMemo,
          adminNote: tenantCreditRequests.adminNote,
          processedAt: tenantCreditRequests.processedAt,
          createdAt: tenantCreditRequests.createdAt,
          companyName: tenants.companyName,
        })
        .from(tenantCreditRequests)
        .leftJoin(tenants, eq(tenantCreditRequests.tenantId, tenants.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(tenantCreditRequests.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  // ─── 크레딧 충전 요청 승인 (관리자 - 입금 확인 후 크레딧 부여) ────
  approveCreditRequest: adminProcedure
    .input(
      z.object({
        requestId: z.number(),
        adminNote: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [req] = await db
        .select()
        .from(tenantCreditRequests)
        .where(eq(tenantCreditRequests.id, input.requestId))
        .limit(1);

      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "요청을 찾을 수 없습니다." });
      if (req.status !== "pending") {
        throw new TRPCError({ code: "CONFLICT", message: "이미 처리된 요청입니다." });
      }

      // 크레딧 부여
      await chargeCredits(
        req.tenantId,
        req.credits,
        req.amountKrw,
        ctx.user.id,
        `충전 요청 승인 (요청ID: ${req.id}, 입금자: ${req.depositorName ?? "-"})${input.adminNote ? " / " + input.adminNote : ""}`
      );

      // 요청 상태 업데이트
      await db
        .update(tenantCreditRequests)
        .set({
          status: "approved",
          adminNote: input.adminNote,
          approvedBy: ctx.user.id,
          processedAt: new Date(),
        })
        .where(eq(tenantCreditRequests.id, input.requestId));

      // 파트너에게 알림
      await notifyOwner({
        title: `[두골프 ERP] 크레딧 충전 승인 완료`,
        content: `테넌트 ID ${req.tenantId}의 크레딧 충전 요청이 승인되었습니다.\n${req.credits} 크레딧이 지급되었습니다.`,
      }).catch(console.error);

      return { success: true };
    }),

  // ─── 크레딧 충전 요청 거부 (관리자) ──────────────────────────────
  rejectCreditRequest: adminProcedure
    .input(
      z.object({
        requestId: z.number(),
        adminNote: z.string().min(1, "거부 사유를 입력해주세요."),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [req] = await db
        .select()
        .from(tenantCreditRequests)
        .where(eq(tenantCreditRequests.id, input.requestId))
        .limit(1);

      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      if (req.status !== "pending") {
        throw new TRPCError({ code: "CONFLICT", message: "이미 처리된 요청입니다." });
      }

      await db
        .update(tenantCreditRequests)
        .set({
          status: "rejected",
          adminNote: input.adminNote,
          approvedBy: ctx.user.id,
          processedAt: new Date(),
        })
        .where(eq(tenantCreditRequests.id, input.requestId));

      return { success: true };
    }),

  // ─── 외부 API 개발 요청 승인/거부 (마스터) ──────────────────────
  approveApiDevRequest: adminProcedure
    .input(
      z.object({
        id: z.number(),
        approvalStatus: z.enum(["approved", "rejected", "in_progress", "completed"]),
        approvalMemo: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await db
        .select()
        .from(tenantApiDevRequests)
        .where(eq(tenantApiDevRequests.id, input.id))
        .limit(1);

      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(tenantApiDevRequests)
        .set({
          approvalStatus: input.approvalStatus,
          approvalMemo: input.approvalMemo,
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
          completedAt: input.approvalStatus === "completed" ? new Date() : undefined,
        })
        .where(eq(tenantApiDevRequests.id, input.id));

      // 업체 알림 발송 (승인/거부/완료 시)
      if (["approved", "rejected", "completed"].includes(input.approvalStatus)) {
        const statusLabel = {
          approved: "승인",
          rejected: "거부",
          completed: "개발 완료",
        }[input.approvalStatus as string];

        await notifyOwner({
          title: `[두골프 ERP] API 개발 요청 ${statusLabel}`,
          content: `테넌트 ${existing.tenantId}의 개발 요청 "${existing.title}"이 ${statusLabel}되었습니다.\n${input.approvalMemo ?? ""}`,
        }).catch(console.error);

        // 업체 알림 발송 완료 기록
        await db
          .update(tenantApiDevRequests)
          .set({ notifiedTenant: true, notifiedAt: new Date() })
          .where(eq(tenantApiDevRequests.id, input.id));
      }

      return { success: true };
    }),

  // ─── 수동 크레딧 직접 조정 (관리자 - 증감 모두 지원) ──────────────
  adminAdjustCredit: adminProcedure
    .input(
      z.object({
        tenantId: z.number(),
        /** 양수=충전, 음수=차감 */
        amount: z.number().min(-9999).max(9999).refine((v) => v !== 0, { message: "0은 입력할 수 없습니다." }),
        memo: z.string().min(1, "조정 사유를 입력해주세요."),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 테넌트 존재 확인 + 현재 잔액 조회
      const [tenant] = await db
        .select({ id: tenants.id, aiCreditsBalance: tenants.aiCreditsBalance, companyName: tenants.companyName })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "테넌트를 찾을 수 없습니다." });

      // 차감 시 잔액 부족 체크
      if (input.amount < 0 && tenant.aiCreditsBalance + input.amount < 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `잔액 부족: 현재 ${tenant.aiCreditsBalance} 크레딧, 차감 요청 ${Math.abs(input.amount)} 크레딧`,
        });
      }

      const newBalance = tenant.aiCreditsBalance + input.amount;

      // 잔액 업데이트
      await db
        .update(tenants)
        .set({ aiCreditsBalance: newBalance })
        .where(eq(tenants.id, input.tenantId));

      // 이력 기록
      await db.insert(tenantAiCredits).values({
        tenantId: input.tenantId,
        type: input.amount > 0 ? "charge" : "deduct",
        amount: input.amount,
        balanceAfter: newBalance,
        processedBy: ctx.user.id,
        memo: `[수동조정] ${input.memo}`,
      });

      return { success: true, newBalance, companyName: tenant.companyName };
    }),

  // ─── 파트너별 크레딧 이력 전체 조회 (관리자 - 타입 필터 포함) ────
  getAdminCreditHistory: adminProcedure
    .input(
      z.object({
        tenantId: z.number(),
        type: z.enum(["all", "charge", "deduct", "refund", "monthly_reset"]).default("all"),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(tenantAiCredits.tenantId, input.tenantId)];
      if (input.type !== "all") {
        conditions.push(eq(tenantAiCredits.type, input.type));
      }

      const rows = await db
        .select()
        .from(tenantAiCredits)
        .where(and(...conditions))
        .orderBy(desc(tenantAiCredits.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countRow] = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(tenantAiCredits)
        .where(and(...conditions));

      return { rows, total: countRow?.total ?? 0 };
    }),

  // ─── 파트너 전용: 자신 테넌트 API 연동 목록 ─────────────────────────────────────────────
  getMyApiConnections: partnerProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const tenantId = (ctx as any).tenantId as number | null;
    if (!tenantId) return [];
    const rows = await db
      .select({
        id: tenantApiConnections.id,
        serviceName: tenantApiConnections.serviceName,
        serviceLabel: tenantApiConnections.serviceLabel,
        status: tenantApiConnections.status,
        lastTestedAt: tenantApiConnections.lastTestedAt,
        lastError: tenantApiConnections.lastError,
        aiAnalysisMemo: tenantApiConnections.aiAnalysisMemo,
        isActive: tenantApiConnections.isActive,
        createdAt: tenantApiConnections.createdAt,
        apiKeyMasked: tenantApiConnections.apiKeyEncrypted,
        configJson: tenantApiConnections.configJson,
      })
      .from(tenantApiConnections)
      .where(eq(tenantApiConnections.tenantId, tenantId))
      .orderBy(desc(tenantApiConnections.createdAt));
    return rows.map((row) => ({
      ...row,
      apiKeyMasked: row.apiKeyMasked
        ? decryptApiKey(row.apiKeyMasked).slice(0, 4) + "****"
        : null,
    }));
  }),

  // ─── 파트너 전용: API 연동 등록/수정 ─────────────────────────────────────────────────────
  upsertMyApiConnection: partnerProcedure
    .input(z.object({
      id: z.number().optional(),
      serviceName: z.string().min(1),
      serviceLabel: z.string().optional(),
      apiKey: z.string().optional(),
      apiSecret: z.string().optional(),
      configJson: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const tenantId = (ctx as any).tenantId as number | null;
      if (!tenantId) throw new TRPCError({ code: "FORBIDDEN", message: "테넌트 정보가 없습니다." });
      const baseValues = {
        tenantId,
        serviceName: input.serviceName,
        serviceLabel: input.serviceLabel ?? input.serviceName,
        status: "pending" as const,
        apiKeyEncrypted: input.apiKey ? encryptApiKey(input.apiKey) : undefined,
        apiSecretEncrypted: input.apiSecret ? encryptApiKey(input.apiSecret) : undefined,
        configJson: input.configJson ?? undefined,
      };
      if (input.id) {
        const [existing] = await db.select({ tenantId: tenantApiConnections.tenantId }).from(tenantApiConnections).where(eq(tenantApiConnections.id, input.id));
        if (!existing || existing.tenantId !== tenantId) throw new TRPCError({ code: "FORBIDDEN", message: "수정 권한이 없습니다." });
        await db.update(tenantApiConnections).set(baseValues).where(eq(tenantApiConnections.id, input.id));
        return { success: true, id: input.id };
      } else {
        const [result] = await db.insert(tenantApiConnections).values(baseValues);
        const insertId = (result as { insertId: number }).insertId;
        analyzeApiConnectionAsync(insertId, tenantId, input.serviceName, input.serviceLabel).catch(console.error);
        return { success: true, id: insertId };
      }
    }),

  // ─── 파트너 전용: API 연동 삭제 ───────────────────────────────────────────────────────────
  deleteMyApiConnection: partnerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const tenantId = (ctx as any).tenantId as number | null;
      if (!tenantId) throw new TRPCError({ code: "FORBIDDEN", message: "테넌트 정보가 없습니다." });
      const [existing] = await db.select({ tenantId: tenantApiConnections.tenantId }).from(tenantApiConnections).where(eq(tenantApiConnections.id, input.id));
      if (!existing || existing.tenantId !== tenantId) throw new TRPCError({ code: "FORBIDDEN", message: "삭제 권한이 없습니다." });
      await db.delete(tenantApiConnections).where(eq(tenantApiConnections.id, input.id));
      return { success: true };
    }),
});

/**
 * 외부 API 연결 시 두골프 매니저 AI 자동 분석 (비동기)
 * - 어떤 기능과 연결될지 분석
 * - 개발 가능성 분류 (possible/conditional/impossible/global)
 * - 개발 요청 자동 생성 + 마스터에게 승인 알림
 */
async function analyzeApiConnectionAsync(
  connectionId: number,
  tenantId: number,
  serviceName: string,
  serviceLabel?: string
) {
  try {
    const db = await getDb();
    if (!db) return;

    // 타 데스크 지식 차단 키워드 거절 검사 (업체 입력 serviceName/serviceLabel 우회 주입 차단)
    const tenantRejection = checkRequestForBlockedKeywords(`${serviceName} ${serviceLabel ?? ""}`);
    if (tenantRejection.rejected) {
      await logRejectedRequest(tenantRejection, { source: `tenant-ai:${tenantId}` });
      console.warn(`[tenantAi] 업체 API 분석 거절 - tenantId=${tenantId}, 키워드=${tenantRejection.matchedKeywords.join(", ")}`);
      return;
    }

    const systemPrompt = NO_CROSS_DESK_KNOWLEDGE_DIRECTIVE + `

당신은 두골프 ERP 시스템의 AI 개발 분석가입니다.
분양 업체가 외부 API를 연결했을 때, 해당 API가 두골프 ERP에서 어떤 기능과 연결될 수 있는지 분석합니다.

분석 기준:
- possible: 현재 ERP 구조에서 바로 개발 가능
- conditional: 일부 로직 수정 후 개발 가능
- impossible: 핵심 아키텍처 변경이 필요하거나 보안상 불가
- global: 모든 분양 업체에게 유익한 공통 기능으로 통합 개발 권장

반드시 JSON 형식으로 응답하세요.`;

    const userPrompt = `서비스명: ${serviceName}
표시명: ${serviceLabel ?? serviceName}

이 API를 두골프 ERP에 연결했을 때:
1. 어떤 기능과 연결될 수 있는지 (구체적으로)
2. 개발 가능성 분류 (possible/conditional/impossible/global)
3. 개발 제안 제목 (30자 이내)
4. 개발 제안 내용 (200자 이내)

JSON 형식: {"analysis": "분석내용", "feasibility": "possible", "title": "제목", "content": "내용"}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "api_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              analysis: { type: "string" },
              feasibility: { type: "string", enum: ["possible", "conditional", "impossible", "global"] },
              title: { type: "string" },
              content: { type: "string" },
            },
            required: ["analysis", "feasibility", "title", "content"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw) return;

    const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));

    // API 연결에 분석 결과 저장
    await db
      .update(tenantApiConnections)
      .set({
        aiAnalysisMemo: parsed.analysis,
        status: "active",
      })
      .where(eq(tenantApiConnections.id, connectionId));

    // 개발 요청 자동 생성 (impossible 제외)
    if (parsed.feasibility !== "impossible") {
      const [devReqResult] = await db.insert(tenantApiDevRequests).values({
        tenantId,
        apiConnectionId: connectionId,
        title: parsed.title,
        requestContent: parsed.content,
        aiAnalysis: parsed.analysis,
        feasibility: parsed.feasibility as "possible" | "conditional" | "global",
        isGlobalImprovement: parsed.feasibility === "global",
        approvalStatus: "pending",
      });

      const devReqId = (devReqResult as { insertId: number }).insertId;

      // 마스터에게 승인 알림
      await notifyOwner({
        title: `[두골프 ERP] 새 API 개발 요청 (${parsed.feasibility})`,
        content: `테넌트 ${tenantId}가 ${serviceLabel ?? serviceName} API를 연결했습니다.\n\n제안: ${parsed.title}\n\n${parsed.analysis}\n\n승인 여부를 확인해주세요. (요청 ID: ${devReqId})`,
      }).catch(console.error);
    }
  } catch (err) {
    console.error("[analyzeApiConnectionAsync] 분석 실패:", err);
  }
}
