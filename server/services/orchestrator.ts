/**
 * 두골프 개발엔진 오케스트레이터 [STEP5 §1]
 * ------------------------------------------------------------------
 * 1~4단계 모듈을 단일 상태 파이프라인으로 무중단 연속 가동.
 *
 *  [Stage 1] 외부 경계선 잠금 (runAgent 컨텍스트 검증 — 도구격리/partner_id)
 *  [Stage 2] Changeset 유도 (호출처가 이미 changeset 보유 시 생략 가능)
 *  [Stage 3] ai_dev_requests 라이프사이클 레코드 생성 (INIT)
 *  [Stage 4] 서버 Git 엔진으로 dev-1 강제 격리 커밋 (commitChangeset)
 *  [Stage 5] dev-2-integration 병합 (충돌 시 자동/강제 금지 → 마스터 토스)
 *  [Stage 6] 4종 정합성 셀프오딧 → INTEGRITY_PASSED / INTEGRITY_FAILED 동결
 *
 * main 반영은 절대 자동화하지 않으며, 마스터 수동 승인 버튼만 대기한다.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { aiDevRequests, aiDevRequestFiles, aiGitCommits } from "../../drizzle/schema";
import {
  commitChangeset,
  mergeBranch,
  isGitEngineEnabled,
  type ChangesetFile,
} from "./gitEngine";
import { SelfAuditBot } from "./selfAuditBot";
import { enforcePartnerLock, type AgentContext } from "./agentEngine";
import { checkTableDuplication } from "./devContext";

export type OrchestrationStage =
  | "INBOUND_REQUEST"
  | "CODE_SANDBOX"
  | "GIT_COMMITTED"
  | "INTEGRATION_TEST"
  | "AUDIT_LOCK"
  | "MASTER_PENDING";

export interface OrchestrationState {
  requestId: number;
  agentId: string;
  currentStage: OrchestrationStage;
  integrityStatus: "PENDING" | "SUCCESS" | "FAILED";
  message: string;
}

/** 변경 통계 산출(추가/삭제 라인 근사) — 메타 테이블 적재용 */
function computeLineStats(file: ChangesetFile): { additions: number; deletions: number } {
  if (file.action === "DELETE") return { additions: 0, deletions: 0 };
  const lines = (file.content ?? "").split("\n").length;
  return file.action === "ADD" ? { additions: lines, deletions: 0 } : { additions: lines, deletions: 0 };
}

/**
 * STEP5 §1 — 통합 파이프라인 실행.
 * @param skipBoundaryCheck 호출처가 이미 runAgent 경계검증을 마친 경우 true
 */
export async function runPipeline(params: {
  agentId: string;
  commitMessage: string;
  changeset: ChangesetFile[];
  context: AgentContext;
  autoIntegrate?: boolean;
  runAudit?: boolean;
  /** 멀티테넌트 추적 (두골프=1, 기본값) */
  tenantId?: number;
  /** 개발 파이프라인 출처 (기본 engine — 자체 changeset 입구) */
  devSource?: "manus" | "engine" | "manual" | "system";
  /** [일원화] 원본 dev_requests.id 역참조 (요청원장↔엔진라이프사이클 연결) */
  devRequestId?: number;
}): Promise<OrchestrationState> {
  const { agentId, commitMessage, changeset, context } = params;
  const autoIntegrate = params.autoIntegrate ?? false;
  const runAudit = params.runAudit ?? true;
  const tenantId = params.tenantId ?? 1;
  const devSource = params.devSource ?? "engine";
  const devRequestId = params.devRequestId ?? null;

  const db = await getDb();
  if (!db) throw new Error("[Orchestrator] Database not available");

  // [Stage 1] 외부 경계선 잠금 (partner_id 강제)
  enforcePartnerLock(context);

  // 보안 4층 강화: 경계 창구(manager/golftalk) 변경에 외부도구 토큰 누수 사전 차단
  const auditBot = new SelfAuditBot();
  for (const f of changeset) {
    if (f.content) {
      const scan = auditBot.scanForbiddenTokens(f.filePath, f.content);
      if (!scan.passed) {
        throw new Error(`[Orchestrator] ${scan.detail}`);
      }
    }
  }

  // [중복 DB 가드] 입구가 어디든(manus/engine/manual) schema.ts 신규 테이블이 기존과 유사하면 차단.
  for (const f of changeset) {
    if (f.action === "DELETE" || !f.content || !/drizzle\/schema\.ts$/.test(f.filePath)) continue;
    const re = /mysqlTable\(\s*["']([a-z_][a-z0-9_]*)["']/g;
    const dupWarnings: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.content)) !== null) {
      const dup = checkTableDuplication(m[1]);
      if (!dup.exact && dup.similar.length > 0) {
        dupWarnings.push(`'${m[1]}' ~ 기존 [${dup.similar.join(", ")}]`);
      }
    }
    if (dupWarnings.length > 0) {
      throw new Error(`[Orchestrator] 중복 DB 개발 가드 차단: ${dupWarnings.join(" / ")} — 기존 테이블에 컬럼 추가를 우선 검토하세요.`);
    }
  }

  // [Stage 3] 라이프사이클 레코드 생성 (INIT) — 테넌트/출처 함께 기록
  const inserted = await db
    .insert(aiDevRequests)
    .values({ agentId, status: "INIT", commitMessage, tenantId, devSource, devRequestId });
  // mysql2 insertId 추출
  const requestId = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  if (!requestId) throw new Error("[Orchestrator] 요청 레코드 생성 실패");

  // 변경 파일 메타 적재 (Diff 본문 미저장 — 통계만)
  for (const f of changeset) {
    const { additions, deletions } = computeLineStats(f);
    await db.insert(aiDevRequestFiles).values({
      requestId,
      filePath: f.filePath,
      changeType: f.action,
      additions,
      deletions,
    });
  }

  // Git 엔진 비활성 시: 코드 생성 단계까지만 기록하고 중단(메타는 보존)
  if (!isGitEngineEnabled()) {
    await db.update(aiDevRequests)
      .set({ status: "CODE_GENERATED", errorMessage: "Git 엔진 비활성(토큰/레포 미설정) — 커밋 보류" })
      .where(eq(aiDevRequests.id, requestId));
    return { requestId, agentId, currentStage: "CODE_SANDBOX", integrityStatus: "PENDING", message: "Git 엔진 비활성 — 메타만 기록" };
  }

  // [Stage 4] dev-1 강제 격리 커밋
  let commitSha: string;
  try {
    const commit = await commitChangeset("dev-1", changeset, commitMessage, requestId);
    commitSha = commit.commitSha;
    await db.insert(aiGitCommits).values({
      commitSha,
      requestId,
      commitMessage,
      branch: "dev-1",
    });
    await db.update(aiDevRequests)
      .set({ status: "CODE_GENERATED" })
      .where(eq(aiDevRequests.id, requestId));
  } catch (err: any) {
    await db.update(aiDevRequests)
      .set({ status: "INTEGRITY_FAILED", errorMessage: `dev-1 커밋 실패: ${err.message}` })
      .where(eq(aiDevRequests.id, requestId));
    return { requestId, agentId, currentStage: "CODE_SANDBOX", integrityStatus: "FAILED", message: err.message };
  }

  // [Stage 5] dev-2-integration 병합 (선택)
  if (autoIntegrate) {
    const merge = await mergeBranch("dev-2-integration", "dev-1", commitMessage);
    if (merge.conflict) {
      await db.update(aiDevRequests)
        .set({ status: "INTEGRITY_FAILED", errorMessage: merge.message })
        .where(eq(aiDevRequests.id, requestId));
      return { requestId, agentId, currentStage: "INTEGRATION_TEST", integrityStatus: "FAILED", message: merge.message };
    }
    await db.update(aiDevRequests)
      .set({ status: "INTEGRATED" })
      .where(eq(aiDevRequests.id, requestId));
  }

  // [Stage 6] 4종 정합성 셀프오딧 (외부 비용 0)
  if (runAudit) {
    const report = await auditBot.executeFourLayerScan(requestId);
    await auditBot.processAuditResult(requestId, report);
    return {
      requestId,
      agentId,
      currentStage: report.isPerfect ? "AUDIT_LOCK" : "INTEGRATION_TEST",
      integrityStatus: report.isPerfect ? "SUCCESS" : "FAILED",
      message: report.isPerfect ? "정합성 통과 — 마스터 승인 대기" : report.reason,
    };
  }

  return { requestId, agentId, currentStage: "GIT_COMMITTED", integrityStatus: "PENDING", message: "dev-1 커밋 완료" };
}

/**
 * STEP4 §3 — Heartbeat 정기 트리거가 호출하는 일괄 자가점검.
 * INIT/CODE_GENERATED 상태의 미검증 요청을 4종 스캔하여 상태 동결.
 */
export async function runDueAudits(): Promise<{ processedCount: number; results: OrchestrationState[] }> {
  const db = await getDb();
  if (!db) throw new Error("[Orchestrator] Database not available");
  const pending = await db
    .select()
    .from(aiDevRequests)
    .where(eq(aiDevRequests.status, "INIT"));

  const auditBot = new SelfAuditBot();
  const results: OrchestrationState[] = [];
  for (const req of pending) {
    const report = await auditBot.executeFourLayerScan(req.id);
    await auditBot.processAuditResult(req.id, report);
    results.push({
      requestId: req.id,
      agentId: req.agentId,
      currentStage: report.isPerfect ? "AUDIT_LOCK" : "INTEGRATION_TEST",
      integrityStatus: report.isPerfect ? "SUCCESS" : "FAILED",
      message: report.summaryReport,
    });
  }
  return { processedCount: pending.length, results };
}
