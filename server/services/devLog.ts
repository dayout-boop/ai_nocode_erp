/**
 * devLog — 개발 흐름 기록 단일 진입점 [멀티테넌트 추적]
 * ------------------------------------------------------------------
 * 목적: 마누스(에이전트)로 개발하든, 자체 changeset 파이프라인으로 개발하든,
 *       사람이 직접 편집하든 — 모든 개발 행위를 동일한 형식으로
 *       ai_dev_requests / ai_dev_request_files / ai_git_commits 에 기록한다.
 *
 * 원칙:
 *  - "개발 흐름을 놓치지 않는다": 어떤 파이프라인이든 이 헬퍼만 호출하면 DB에 남는다.
 *  - graceful: 기록 실패가 실제 개발을 막지 않는다(로그만 남기고 계속 진행).
 *  - 소스 본문은 저장하지 않는다(파일 경로/변경유형/라인 통계만). DB 비대화 방지.
 *  - tenantId 로 테넌트별(두골프=1) 개발 이력을 분리 추적한다.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  aiDevRequests,
  aiDevRequestFiles,
  aiGitCommits,
} from "../../drizzle/schema";
import { DOGOLF_TENANT_ID } from "../../shared/const";

export type DevSource = "manus" | "engine" | "manual" | "system";

export interface DevLogFile {
  filePath: string;
  changeType: "ADD" | "MODIFY" | "DELETE";
  additions?: number;
  deletions?: number;
}

export interface DevLogInput {
  /** 개발 요약(커밋 메시지 성격) */
  summary: string;
  /** 개발 파이프라인 출처 */
  source: DevSource;
  /** 수행 에이전트/주체 식별자 */
  agentId?: string;
  /** 테넌트 (기본 두골프=1) */
  tenantId?: number;
  /** 변경 파일 목록(메타만) */
  files?: DevLogFile[];
  /** 연결된 GitHub 커밋 SHA(있다면) */
  commitSha?: string;
  /** 커밋이 적재된 브랜치 */
  branch?: string;
  /** 초기 상태(기본 CODE_GENERATED — 실제 변경이 일어났음을 의미) */
  status?:
    | "INIT"
    | "CODE_GENERATED"
    | "INTEGRITY_PASSED"
    | "INTEGRITY_FAILED"
    | "INTEGRATED"
    | "MASTER_APPROVED"
    | "MASTER_REJECTED";
}

export interface DevLogResult {
  ok: boolean;
  requestId?: number;
  reason?: string;
}

/**
 * 개발 행위 1건을 기록한다.
 * 어떤 파이프라인(마누스/자체/수동)이든 이 함수를 호출하면 동일하게 추적된다.
 */
export async function recordDevActivity(input: DevLogInput): Promise<DevLogResult> {
  const db = await getDb();
  if (!db) {
    console.warn("[devLog] DB 미연결 — 개발기록 skip (개발은 계속 진행)");
    return { ok: false, reason: "db_unavailable" };
  }

  const tenantId = input.tenantId ?? DOGOLF_TENANT_ID;
  const status = input.status ?? "CODE_GENERATED";

  try {
    const inserted = await db.insert(aiDevRequests).values({
      tenantId,
      devSource: input.source,
      agentId: input.agentId ?? input.source,
      status,
      commitMessage: input.summary.slice(0, 1000),
    });
    const requestId = Number(
      (inserted as any)[0]?.insertId ?? (inserted as any).insertId,
    );
    if (!requestId) {
      return { ok: false, reason: "insert_failed" };
    }

    // 변경 파일 메타 적재 (본문 미저장)
    if (input.files?.length) {
      for (const f of input.files) {
        await db.insert(aiDevRequestFiles).values({
          requestId,
          filePath: f.filePath.slice(0, 500),
          changeType: f.changeType,
          additions: f.additions ?? 0,
          deletions: f.deletions ?? 0,
        });
      }
    }

    // 커밋 SHA 연동(있을 때만)
    if (input.commitSha) {
      await db.insert(aiGitCommits).values({
        commitSha: input.commitSha,
        requestId,
        commitMessage: input.summary.slice(0, 1000),
        branch: input.branch ?? "dev-1",
      });
    }

    return { ok: true, requestId };
  } catch (err: any) {
    // graceful: 기록 실패가 개발을 막지 않는다.
    console.warn(`[devLog] 개발기록 실패(무시하고 진행): ${err?.message ?? err}`);
    return { ok: false, reason: err?.message ?? "unknown" };
  }
}

/**
 * 기존 개발요청의 상태/요약을 갱신한다(예: 검증 통과/배포 완료 표시).
 * graceful — 실패해도 throw 하지 않는다.
 */
export async function updateDevActivityStatus(
  requestId: number,
  status: DevLogInput["status"],
  note?: string,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const set: Record<string, unknown> = {};
    if (status) set.status = status;
    if (note !== undefined) set.auditSummary = note.slice(0, 4000);
    if (Object.keys(set).length === 0) return false;
    await db.update(aiDevRequests).set(set).where(eq(aiDevRequests.id, requestId));
    return true;
  } catch (err: any) {
    console.warn(`[devLog] 상태 갱신 실패(무시): ${err?.message ?? err}`);
    return false;
  }
}
