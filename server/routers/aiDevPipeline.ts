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
import { aiDevRequests, aiDevRequestFiles, aiGitCommits, gitRollbackLogs } from "../../drizzle/schema";
import { recordDevActivity } from "../services/devLog";
import { runDeploy, isSelfDeployEnabled } from "../services/deployRunner";
import { deployLogs } from "../../drizzle/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  getCommitDiff,
  mergeBranch,
  isGitEngineEnabled,
  ALLOWED_BRANCHES,
  listBranchCommits,
  rollbackToCommit,
} from "../services/gitEngine";
import { SelfAuditBot } from "../services/selfAuditBot";
import { getNeutralStatus, NEUTRAL_ROADMAP } from "../services/vendorNeutral";

// 롤백 가능 브랜치 (main 제외 — main 은 마스터 수동 승인 전용)
const ROLLBACKABLE_BRANCHES = ["dev-1", "dev-2-integration"] as const;

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
  /**
   * 개발 활동 수동/외부 기록 — 마누스(에이전트)나 다른 파이프라인이
   * 개발 흐름을 놓치지 않도록 ai_dev_requests 에 1건 적재한다.
   * 실제 GitHub 커밋/병합과 무관하게 "무슨 개발을 했는지" 기록이 목적.
   */
  recordActivity: adminProcedure
    .input(
      z.object({
        summary: z.string().min(1).max(1000),
        source: z.enum(["manus", "engine", "manual", "system"]).default("manus"),
        tenantId: z.number().optional(),
        agentId: z.string().max(50).optional(),
        commitSha: z.string().max(40).optional(),
        branch: z.string().max(100).optional(),
        files: z
          .array(
            z.object({
              filePath: z.string().min(1).max(500),
              changeType: z.enum(["ADD", "MODIFY", "DELETE"]),
              additions: z.number().min(0).optional(),
              deletions: z.number().min(0).optional(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await recordDevActivity(input);
      if (!result.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `개발기록 실패: ${result.reason}` });
      }
      return { ok: true, requestId: result.requestId };
    }),

  /** [A] 변경요청 목록 (DB만 — 0.01초 고속) */
  listRequests: adminProcedure
    .input(
      z.object({
        status: z.enum(STATUS_VALUES).optional(),
        agentId: z.string().optional(),
        tenantId: z.number().optional(),
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
      if (input.tenantId !== undefined) conds.push(eq(aiDevRequests.tenantId, input.tenantId));
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

  /**
   * 마스터 수동 4종 정합성 오딩 재실행 [STEP4 §1].
   * 외부 유료 LLM 호출 0원 — 서버 내부 정적 스캔만 수행, 결과를 PASSED/FAILED 로 동결.
   */
  runAudit: adminProcedure
    .input(z.object({ requestId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const [req] = await db.select().from(aiDevRequests).where(eq(aiDevRequests.id, input.requestId)).limit(1);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "요청을 찾을 수 없습니다" });
      const bot = new SelfAuditBot();
      const report = await bot.executeFourLayerScan(input.requestId);
      await bot.processAuditResult(input.requestId, report);
      return { ok: true, isPerfect: report.isPerfect, layers: report.layers, summaryReport: report.summaryReport, reason: report.reason };
    }),

  /**
   * 선택적 레드팀 교차검증 수동 실행 [STEP4 §2].
   * 레드팀 모델 키 미설정 시 비활성 안내 텍스트 반환(비용 통제).
   * AI는 main 병합 결정권 없음 — 비판 보고만 auditSummary 에 추가.
   */
  runRedteam: adminProcedure
    .input(z.object({ requestId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const [req] = await db.select().from(aiDevRequests).where(eq(aiDevRequests.id, input.requestId)).limit(1);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "요청을 찾을 수 없습니다" });
      const commits = await db.select().from(aiGitCommits).where(eq(aiGitCommits.requestId, input.requestId));
      const messages = commits.map((c) => c.commitMessage).filter((m): m is string => !!m);
      const fallback = req.commitMessage ? [req.commitMessage] : [];
      const bot = new SelfAuditBot();
      const redteamReport = await bot.redteamCrossReview(input.requestId, messages.length ? messages : fallback);
      // 기존 요약에 레드팀 섹션 붙임(덮어쓰기 아닌 추기)
      const prev = req.auditSummary ?? "";
      const merged = `${prev}${prev ? "\n\n" : ""}—— 레드팀 교차검증 ——\n${redteamReport}`;
      await db.update(aiDevRequests).set({ auditSummary: merged }).where(eq(aiDevRequests.id, input.requestId));
      return { ok: true, redteamReport };
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

  /** STEP5 §2~3 — 탈마누스 자립전환 상태/로드맵 (키 원문 미노출, 설정여부만) */
  neutralStatus: adminProcedure.query(async () => {
    return { status: getNeutralStatus(), roadmap: NEUTRAL_ROADMAP };
  }),

  // ============================================================
  // 자체 Git 롤백 (마누스 비종속) — ERP 화면에서 직접 되돌리기
  // ============================================================

  /** 롤백 대상 브랜치의 커밋 이력 조회 (온디맨드 Git API) */
  listBranchCommits: adminProcedure
    .input(
      z.object({
        branch: z.enum(ROLLBACKABLE_BRANCHES).default("dev-1"),
        limit: z.number().min(1).max(100).default(30),
      }),
    )
    .query(async ({ input }) => {
      if (!isGitEngineEnabled()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Git 엔진 비활성 (ERP 설정 > v3 엔진 > GitHub Token 등록 필요)" });
      }
      try {
        const commits = await listBranchCommits(input.branch, input.limit);
        return { branch: input.branch, commits };
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  /**
   * 롤백 실행 — 특정 커밋 시점으로 dev 브랜치를 되돌린다 (마스터 권한 전용).
   * history-preserving: 기존 이력 파괴 없이 '되돌림 커밋' 하나를 새로 얹는다.
   * main 롤백은 gitEngine 레벨에서도 차단됨.
   */
  rollbackToCommit: adminProcedure
    .input(
      z.object({
        branch: z.enum(ROLLBACKABLE_BRANCHES).default("dev-1"),
        targetSha: z.string().min(7).max(40),
        reason: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!isGitEngineEnabled()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Git 엔진 비활성 (ERP 설정 > v3 엔진 > GitHub Token 등록 필요)" });
      }
      const db = await getDb();
      const performedBy = ctx.user?.id ?? null;
      const performedByName = ctx.user?.name ?? "master";
      try {
        const result = await rollbackToCommit(input.branch, input.targetSha, input.reason);
        // 감사 이력 적재 (DB 연결 시에만)
        if (db) {
          await db.insert(gitRollbackLogs).values({
            branch: input.branch,
            targetSha: input.targetSha,
            newCommitSha: result.newCommitSha,
            reason: input.reason ?? null,
            success: true,
            performedBy,
            performedByName,
          });
        }
        return { ok: true, ...result };
      } catch (err: any) {
        const msg = err?.message ?? "unknown";
        if (db) {
          await db.insert(gitRollbackLogs).values({
            branch: input.branch,
            targetSha: input.targetSha,
            reason: input.reason ?? null,
            success: false,
            errorMessage: msg.slice(0, 1000),
            performedBy,
            performedByName,
          });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ============================================================
  // 자체 배포 실행기 (외부서버 빌드·재시작) — 마누스 없이 반영
  // ============================================================

  /** 자체 배포 가능 여부/설정 상태 (화면 안내용) */
  deployStatus: adminProcedure.query(async () => {
    return {
      enabled: isSelfDeployEnabled(),
      hint: isSelfDeployEnabled()
        ? "자체 배포 활성 — 외부서버에서 빌드/재시작을 직접 실행합니다."
        : "자체 배포 비활성(SELF_DEPLOY_ENABLED!=true) — 마누스 Publish 또는 외부서버 수동 반영을 사용하세요.",
    };
  }),

  /**
   * 자체 배포 실행 (빌드/재시작) — 마스터 전용.
   * 안전가드: SELF_DEPLOY_ENABLED=true 일 때만 실제 쉘 실행.
   * main 자동 병합은 수행하지 않으며, 이미 반영된 소스를 외부서버에서 빌드/재기동만 한다.
   */
  triggerDeploy: adminProcedure
    .input(
      z.object({
        phase: z.enum(["pull", "build", "restart", "full"]).default("full"),
        tenantId: z.number().optional(),
        requestId: z.number().optional(),
        commitSha: z.string().max(40).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const result = await runDeploy({
        phase: input.phase,
        tenantId: input.tenantId,
        requestId: input.requestId,
        commitSha: input.commitSha,
        performedBy: ctx.user?.id ?? null,
        performedByName: ctx.user?.name ?? "master",
      });
      return result;
    }),

  /** 자체 배포 실행 이력 조회 (최신순) */
  listDeployLogs: adminProcedure
    .input(
      z
        .object({
          tenantId: z.number().optional(),
          limit: z.number().min(1).max(100).default(30),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [] as any[] };
      const where = input?.tenantId !== undefined ? eq(deployLogs.tenantId, input.tenantId) : undefined;
      const rows = await db
        .select()
        .from(deployLogs)
        .where(where)
        .orderBy(desc(deployLogs.createdAt))
        .limit(input?.limit ?? 30);
      return { items: rows };
    }),

  /** 롤백 감사 이력 조회 (최신순) */
  listRollbackLogs: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(30) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [] as any[] };
      const rows = await db
        .select()
        .from(gitRollbackLogs)
        .orderBy(desc(gitRollbackLogs.createdAt))
        .limit(input?.limit ?? 30);
      return { items: rows };
    }),
});
