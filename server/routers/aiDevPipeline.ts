/**
 * AI 개발 파이프라인 라우터 [STEP1 §5.2 / STEP3 / STEP4]
 * ------------------------------------------------------------------
 * 마스터 ERP 'AI 변경 이력 및 정합성 검증 대시보드' 백엔드.
 *  - [A] 변경요청 목록/통계: DB 인덱스만 사용 (유료 LLM 호출 0, 고속)
 *  - [B] 소스 Diff: '소스 보기' 클릭 온디맨드 시점에만 Git API 호출
 *  - main 병합은 오직 마스터 수동 승인. AI 결정권 박탈.
 */
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { aiDevRequests, aiDevRequestFiles, aiGitCommits } from "../../drizzle/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  getCommitDiff,
  mergeBranch,
  isGitEngineEnabled,
  ALLOWED_BRANCHES,
} from "../services/gitEngine";

const STATUS_VALUES = [
  "INIT",
  "CODE_GENERATED",
  "INTEGRITY_PASSED",
  "INTEGRITY_FAILED",
  "INTEGRATED",
  "MASTER_APPROVED",
  "MASTER_REJECTED",
] as const;

export const aiDevPipelineRouter = router({
  /** [A] 변경요청 목록 (DB만 — 0.01초 고속) */
  listRequests: adminProcedure
    .input(
      z.object({
        status: z.enum(STATUS_VALUES).optional(),
        agentId: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const conds: any[] = [];
      if (input.status) conds.push(eq(aiDevRequests.status, input.status));
      if (input.agentId) conds.push(eq(aiDevRequests.agentId, input.agentId));
      const where = conds.length ? and(...conds) : undefined;
      const [rows, totalRows] = await Promise.all([
        db.select().from(aiDevRequests).where(where)
          .orderBy(desc(aiDevRequests.createdAt)).limit(input.limit).offset(input.offset),
        db.select({ c: sql<number>`count(*)` }).from(aiDevRequests).where(where),
      ]);
      return { items: rows, total: Number(totalRows[0]?.c ?? 0) };
    }),

  /** 변경요청 상세 + 변경파일 메타 + 커밋목록 (DB만) */
  getRequestDetail: adminProcedure
    .input(z.object({ requestId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const [req] = await db.select().from(aiDevRequests).where(eq(aiDevRequests.id, input.requestId)).limit(1);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "요청을 찾을 수 없습니다" });
      const [files, commits] = await Promise.all([
        db.select().from(aiDevRequestFiles).where(eq(aiDevRequestFiles.requestId, input.requestId)),
        db.select().from(aiGitCommits).where(eq(aiGitCommits.requestId, input.requestId)).orderBy(desc(aiGitCommits.committedAt)),
      ]);
      return { request: req, files, commits };
    }),

  /** 상태별 통계 (대시보드 헤더 카드용) */
  getStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
    const rows = await db
      .select({ status: aiDevRequests.status, c: sql<number>`count(*)` })
      .from(aiDevRequests)
      .groupBy(aiDevRequests.status);
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = Number(r.c);
    return {
      byStatus,
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      gitEngineEnabled: isGitEngineEnabled(),
      allowedBranches: ALLOWED_BRANCHES,
    };
  }),

  /** [B] 소스 Diff 온디맨드 조회 (Git API — 버튼 클릭 시점에만) */
  getCommitDiff: adminProcedure
    .input(z.object({ commitSha: z.string().min(7).max(40) }))
    .query(async ({ input }) => {
      if (!isGitEngineEnabled()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Git 엔진 비활성 (토큰/레포 미설정)" });
      }
      try {
        return await getCommitDiff(input.commitSha);
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  /**
   * 마스터 수동 통합 트리거 (dev-1 → dev-2-integration).
   * 충돌 시 자동/강제 병합 금지 → INTEGRITY_FAILED 로 마킹하여 마스터 TODO 노출.
   */
  integrateRequest: adminProcedure
    .input(z.object({ requestId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const [req] = await db.select().from(aiDevRequests).where(eq(aiDevRequests.id, input.requestId)).limit(1);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "요청을 찾을 수 없습니다" });
      if (req.status !== "INTEGRITY_PASSED" && req.status !== "CODE_GENERATED") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `현재 상태(${req.status})에서는 통합할 수 없습니다` });
      }
      const result = await mergeBranch("dev-2-integration", "dev-1", req.commitMessage ?? `integrate #${req.id}`);
      if (result.conflict) {
        await db.update(aiDevRequests)
          .set({ status: "INTEGRITY_FAILED", errorMessage: result.message })
          .where(eq(aiDevRequests.id, input.requestId));
        return { ok: false, conflict: true, message: result.message };
      }
      await db.update(aiDevRequests)
        .set({ status: "INTEGRATED", errorMessage: null })
        .where(eq(aiDevRequests.id, input.requestId));
      return { ok: true, conflict: false, mergeSha: result.mergeSha, message: result.message };
    }),

  /**
   * 마스터 최종 운영(main) 반영 승인 — 사람이 직접 누르는 버튼.
   * 여기서는 DB 상태만 MASTER_APPROVED 로 마킹 (실제 main 병합은 GitHub PR/UI에서 수동 처리).
   * AI/시스템이 자동으로 main 에 병합하는 경로는 존재하지 않는다.
   */
  masterApprove: adminProcedure
    .input(z.object({ requestId: z.number(), note: z.string().max(1000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const [req] = await db.select().from(aiDevRequests).where(eq(aiDevRequests.id, input.requestId)).limit(1);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "요청을 찾을 수 없습니다" });
      if (req.status !== "INTEGRATED" && req.status !== "INTEGRITY_PASSED") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `통합 완료(INTEGRATED) 상태에서만 승인 가능합니다 (현재 ${req.status})` });
      }
      await db.update(aiDevRequests)
        .set({ status: "MASTER_APPROVED", auditSummary: `${ctx.user.name ?? "master"} 승인: ${input.note ?? ""}` })
        .where(eq(aiDevRequests.id, input.requestId));
      return { ok: true };
    }),

  /** 마스터 반려 */
  masterReject: adminProcedure
    .input(z.object({ requestId: z.number(), reason: z.string().max(1000) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      await db.update(aiDevRequests)
        .set({ status: "MASTER_REJECTED", errorMessage: input.reason })
        .where(eq(aiDevRequests.id, input.requestId));
      return { ok: true };
    }),
});
