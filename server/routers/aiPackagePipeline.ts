/**
 * AI 상품 자동생성 파이프라인 tRPC 라우터 [Phase 3]
 * - startJob: 파일 분석 ID로 상품 자동생성 잡 시작
 * - getJobStatus: 잡 진행 상태 폴링
 * - listJobs: 내 테넌트 잡 목록
 * - approvePackage: 생성된 상품 초안 승인 (파트너 대표만)
 * - rejectPackage: 생성된 상품 초안 거부 (파트너 대표만)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { partnerProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { packages } from "../../drizzle/schema";
import { createJob, getJob, listJobsByTenant } from "../services/aiJobWorker";

// 파트너 대표만 허용하는 미들웨어 (파트너 스태프 제외)
const partnerOwnerOnlyProcedure = partnerProcedure.use(({ ctx, next }) => {
  // 마스터(admin)는 항상 허용
  if (ctx.user?.role === "admin") return next({ ctx });
  // 파트너 대표는 허용
  if (ctx.partnerOwner) return next({ ctx });
  // 파트너 스태프는 거부
  throw new TRPCError({ code: "FORBIDDEN", message: "파트너 대표만 승인/거부할 수 있습니다." });
});

export const aiPackagePipelineRouter = router({
  /**
   * 파일 분석 ID로 상품 자동생성 잡 시작
   * [partnerProcedure] 파트너 담당자도 시작 가능
   */
  startJob: partnerProcedure
    .input(
      z.object({
        fileAnalysisId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const requestedBy: number =
        ctx.user?.id ?? ctx.partnerOwner?.partnerId ?? ctx.partnerStaff?.staffId ?? 0;
      const tenantId: number | null = ctx.tenantId ?? null;

      const jobId = createJob({
        fileAnalysisId: input.fileAnalysisId,
        tenantId,
        requestedBy,
      });

      return { jobId, message: "상품 자동생성 잡이 시작되었습니다." };
    }),

  /**
   * 잡 진행 상태 폴링
   * [partnerProcedure] 파트너 담당자도 조회 가능
   */
  getJobStatus: partnerProcedure
    .input(z.object({ jobId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const job = getJob(input.jobId);
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "잡을 찾을 수 없습니다." });
      }
      // 테넌트 격리: 본인 테넌트 잡만 조회
      const tenantId: number | null = ctx.tenantId ?? null;
      if (tenantId !== null && job.tenantId !== tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "접근 권한이 없습니다." });
      }
      return {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        message: job.message,
        result: job.result,
        error: job.error,
        updatedAt: job.updatedAt,
      };
    }),

  /**
   * 내 테넌트 잡 목록 (최근 순)
   * [partnerProcedure] 파트너 담당자도 조회 가능
   */
  listJobs: partnerProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx }) => {
      const tenantId: number | null = ctx.tenantId ?? null;
      const jobs = listJobsByTenant(tenantId).slice(0, 20);
      return { jobs };
    }),

  /**
   * 생성된 상품 초안 승인 (approvalStatus → 'approved', status → 'draft' 유지)
   * [partnerOwnerOnlyProcedure] 파트너 대표만 가능
   */
  approvePackage: partnerOwnerOnlyProcedure
    .input(
      z.object({
        packageId: z.number().int().positive(),
        memo: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tenantId: number | null = ctx.tenantId ?? null;

      const whereClause = tenantId !== null
        ? and(eq(packages.id, input.packageId), eq(packages.tenantId, tenantId))
        : eq(packages.id, input.packageId);

      const [pkg] = await db
        .select({ id: packages.id, approvalStatus: packages.approvalStatus })
        .from(packages)
        .where(whereClause)
        .limit(1);

      if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "상품을 찾을 수 없습니다." });
      if (pkg.approvalStatus !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "승인 대기 상태의 상품만 승인할 수 있습니다." });
      }

      await db
        .update(packages)
        .set({ approvalStatus: "approved" })
        .where(whereClause);

      return { success: true, packageId: input.packageId, message: "상품 초안이 승인되었습니다." };
    }),

  /**
   * 생성된 상품 초안 거부 (approvalStatus → 'rejected')
   * [partnerOwnerOnlyProcedure] 파트너 대표만 가능
   */
  rejectPackage: partnerOwnerOnlyProcedure
    .input(
      z.object({
        packageId: z.number().int().positive(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tenantId: number | null = ctx.tenantId ?? null;

      const whereClause = tenantId !== null
        ? and(eq(packages.id, input.packageId), eq(packages.tenantId, tenantId))
        : eq(packages.id, input.packageId);

      const [pkg] = await db
        .select({ id: packages.id, approvalStatus: packages.approvalStatus })
        .from(packages)
        .where(whereClause)
        .limit(1);

      if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "상품을 찾을 수 없습니다." });
      if (pkg.approvalStatus !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "승인 대기 상태의 상품만 거부할 수 있습니다." });
      }

      await db
        .update(packages)
        .set({ approvalStatus: "rejected" })
        .where(whereClause);

      return { success: true, packageId: input.packageId, message: "상품 초안이 거부되었습니다." };
    }),

  /**
   * 승인 대기 중인 상품 목록 조회
   * [partnerProcedure] 파트너 담당자도 조회 가능
   */
  listPendingPackages: partnerProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { packages: [] };

      const tenantId: number | null = ctx.tenantId ?? null;

      const whereClause = tenantId !== null
        ? and(eq(packages.approvalStatus, "pending"), eq(packages.tenantId, tenantId))
        : eq(packages.approvalStatus, "pending");

      const pendingPackages = await db
        .select({
          id: packages.id,
          title: packages.title,
          country: packages.country,
          region: packages.region,
          duration: packages.duration,
          roundCount: packages.roundCount,
          description: packages.description,
          approvalStatus: packages.approvalStatus,
          aiGeneratedFrom: packages.aiGeneratedFrom,
          tenantId: packages.tenantId,
          createdAt: packages.createdAt,
        })
        .from(packages)
        .where(whereClause)
        .orderBy(packages.createdAt)
        .limit(20);

      return { packages: pendingPackages };
    }),
});
