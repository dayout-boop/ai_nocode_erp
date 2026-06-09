/**
 * 서버 내장 Git 엔진 [STEP1·STEP3]
 * ------------------------------------------------------------------
 * 사양 근거: docs/step_specs_extracted.md (STEP 1, STEP 3)
 *
 * 핵심 원칙:
 *  - 마누스/외부 에이전트는 GitHub 레포에 직접 Push/Merge 권한이 없다.
 *    이들은 "소스 변경조각(Changeset)" 텍스트만 서버로 토스하며,
 *    실제 GitHub REST API 호출 주체는 오직 이 서버 엔진이다.
 *  - 제3자 git 라이브러리(isomorphic-git 등) 전면 배제.
 *    Node.js 네이티브 fetch 로 GitHub REST API 직접 호출. 런타임 의존성 0.
 *  - 소스 본체/Diff 는 Git 이 보관. DB 는 메타·SHA 인덱스만 보관.
 *  - 충돌(409) 시 자동/강제 병합 영구 금지 → 마스터 수동 처리 영역으로 토스.
 */
import { ENV } from "../_core/env";
import { getApiKey } from "../erpApiKeyManager";
import fs from "node:fs";
import path from "node:path";

const GITHUB_API = "https://api.github.com";

// 브랜치 화이트리스트 가드 — 명세된 3개 브랜치 외 조작 원천 차단
export const ALLOWED_BRANCHES = ["main", "dev-1", "dev-2-integration"] as const;
export type AllowedBranch = (typeof ALLOWED_BRANCHES)[number];

export function assertAllowedBranch(branch: string): asserts branch is AllowedBranch {
  if (!(ALLOWED_BRANCHES as readonly string[]).includes(branch)) {
    throw new Error(`[GitEngine] 허용되지 않은 브랜치 조작 차단: '${branch}'`);
  }
}

export interface ChangesetFile {
  filePath: string;
  action: "ADD" | "MODIFY" | "DELETE";
  /** UTF-8 또는 Base64 문자열 전문 (DELETE 시 생략 가능) */
  content?: string;
  /** content 가 base64 인코딩인지 여부 (바이너리) */
  isBase64?: boolean;
}

export interface CommitResult {
  commitSha: string;
  branch: string;
  treeSha: string;
}

async function ghHeaders(): Promise<Record<string, string>> {
  // DB 우선 조회 → ENV 폴백 (ERP 설정 페이지에서 등록한 키 자동 반영)
  const token = await getApiKey("github_token");
  if (!token) {
    throw new Error("[GitEngine] GITHUB_TOKEN 미설정 — Git 엔진 비활성 (ERP 설정 > v3 엔진 > GitHub Token 등록 필요)");
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "DuGolf-Server-Engine",
  };
}

function repoBase(): string {
  const { githubRepoOwner: owner, githubRepoName: repo } = ENV;
  if (!owner || !repo) {
    throw new Error("[GitEngine] GITHUB_REPO_OWNER / GITHUB_REPO_NAME 미설정");
  }
  return `${GITHUB_API}/repos/${owner}/${repo}`;
}

async function ghFetch(url: string, init?: RequestInit): Promise<Response> {
  const hdrs = await ghHeaders();
  return fetch(url, { ...init, headers: { ...hdrs, ...(init?.headers ?? {}) } });
}

async function ghJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await ghFetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[GitEngine] GitHub API 오류 ${res.status} ${res.statusText}: ${body.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

/**
 * 브랜치가 없으면 base(기본 main)에서 분기 생성 (idempotent).
 */
export async function ensureBranch(branch: AllowedBranch, baseBranch: AllowedBranch = "main"): Promise<void> {
  assertAllowedBranch(branch);
  assertAllowedBranch(baseBranch);
  const base = repoBase();
  // 이미 존재하면 통과
  const exists = await ghFetch(`${base}/git/ref/heads/${branch}`);
  if (exists.ok) return;
  // base 의 최신 SHA 확보
  const baseRef = await ghJson<{ object: { sha: string } }>(`${base}/git/ref/heads/${baseBranch}`);
  await ghJson(`${base}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }),
  });
  console.log(`[GitEngine] 브랜치 생성: ${branch} (from ${baseBranch})`);
}

/**
 * STEP1 §2.2 — 5단계 REST 트랜잭션 시퀀스로 Changeset 을 브랜치에 커밋한다.
 *   1) ref → commit → root tree SHA 확보
 *   2) 신규 파일 Blob 생성
 *   3) 새 Tree 구축
 *   4) 커밋 오브젝트 생성
 *   5) 브랜치 Ref 업데이트(force:false)
 *
 * 예외 시: 메모리 소스를 로컬 백업으로 격리 덤프(영속 보존)하고 throw.
 */
export async function commitChangeset(
  branch: AllowedBranch,
  files: ChangesetFile[],
  commitMessage: string,
  devRequestId: number,
): Promise<CommitResult> {
  assertAllowedBranch(branch);
  if (branch === "main") {
    throw new Error("[GitEngine] main 브랜치 직접 커밋은 금지됩니다 (마스터 수동 승인 전용)");
  }
  if (!files.length) throw new Error("[GitEngine] 변경 파일이 비어 있습니다");

  const base = repoBase();
  try {
    await ensureBranch(branch, "main");

    // (1) 최신 커밋/Tree SHA
    const ref = await ghJson<{ object: { sha: string } }>(`${base}/git/ref/heads/${branch}`);
    const latestCommitSha = ref.object.sha;
    const latestCommit = await ghJson<{ tree: { sha: string } }>(`${base}/git/commits/${latestCommitSha}`);
    const baseTreeSha = latestCommit.tree.sha;

    // (2)+(3) Blob 생성 후 Tree 항목 구성
    const treeItems: Array<Record<string, unknown>> = [];
    for (const f of files) {
      if (f.action === "DELETE") {
        // tree 에서 sha:null 로 삭제 표기
        treeItems.push({ path: f.filePath, mode: "100644", type: "blob", sha: null });
        continue;
      }
      const blob = await ghJson<{ sha: string }>(`${base}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({
          content: f.content ?? "",
          encoding: f.isBase64 ? "base64" : "utf-8",
        }),
      });
      treeItems.push({ path: f.filePath, mode: "100644", type: "blob", sha: blob.sha });
    }

    const newTree = await ghJson<{ sha: string }>(`${base}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
    });

    // (4) 커밋 오브젝트
    const newCommit = await ghJson<{ sha: string }>(`${base}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: commitMessage,
        tree: newTree.sha,
        parents: [latestCommitSha],
        author: { name: "DuGolf-Server-Engine", email: "engine@dayoutgolf.com", date: new Date().toISOString() },
      }),
    });

    // (5) Ref 업데이트 (force:false 안전 영도)
    await ghJson(`${base}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha, force: false }),
    });

    console.log(`[GitEngine] 커밋 완료: ${newCommit.sha.slice(0, 8)} → ${branch}`);
    return { commitSha: newCommit.sha, branch, treeSha: newTree.sha };
  } catch (err: any) {
    // 핵심 예외: 메모리 소스를 로컬 백업으로 격리 덤프 (마누스 연결 끊겨도 보존)
    dumpBackup(devRequestId, files, commitMessage, err);
    throw err;
  }
}

/**
 * STEP3 §3 — dev-1 → dev-2-integration 기계적 병합.
 * 반환: { merged, conflict, conflictFiles?, mergeSha? }
 *  - 201/204 정상 병합
 *  - 409 충돌 시 자동 병합 즉시 중단 (강제 병합 금지). 충돌 사실만 보고.
 */
export interface MergeResult {
  merged: boolean;
  conflict: boolean;
  mergeSha?: string;
  message: string;
}

export async function mergeBranch(
  base: AllowedBranch,
  head: AllowedBranch,
  commitMessage?: string,
): Promise<MergeResult> {
  assertAllowedBranch(base);
  assertAllowedBranch(head);
  if (base === "main") {
    throw new Error("[GitEngine] main 으로의 병합은 마스터 수동 승인(PR)으로만 가능합니다");
  }
  await ensureBranch(base, "main");
  await ensureBranch(head, "main");

  const res = await ghFetch(`${repoBase()}/merges`, {
    method: "POST",
    body: JSON.stringify({ base, head, commit_message: commitMessage ?? `merge ${head} into ${base}` }),
  });

  if (res.status === 201) {
    const data = (await res.json()) as { sha: string };
    return { merged: true, conflict: false, mergeSha: data.sha, message: "병합 성공" };
  }
  if (res.status === 204) {
    return { merged: true, conflict: false, message: "이미 최신 상태 (Nothing to merge)" };
  }
  if (res.status === 409) {
    // 충돌: 강제 병합 금지. 마스터 수동 처리 영역으로 토스.
    return { merged: false, conflict: true, message: "병합 충돌(409) — 마스터 수동 처리 필요" };
  }
  const body = await res.text();
  throw new Error(`[GitEngine] 병합 실패 ${res.status}: ${body.slice(0, 400)}`);
}

/**
 * STEP1 §5.2[B] — 커밋 SHA 기반 Diff 온디맨드 조회 (DB 비대화 방지).
 */
export async function getCommitDiff(commitSha: string): Promise<{
  sha: string;
  message: string;
  files: Array<{ filename: string; status: string; additions: number; deletions: number; patch?: string }>;
}> {
  const data = await ghJson<any>(`${repoBase()}/commits/${commitSha}`);
  return {
    sha: data.sha,
    message: data.commit?.message ?? "",
    files: (data.files ?? []).map((f: any) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions ?? 0,
      deletions: f.deletions ?? 0,
      patch: f.patch,
    })),
  };
}

/** main 으로의 마스터 수동 승인 병합용 — dev-2-integration → main PR 생성/머지는 별도 단계에서. */
export async function compareBranches(base: AllowedBranch, head: AllowedBranch) {
  assertAllowedBranch(base);
  assertAllowedBranch(head);
  return ghJson<any>(`${repoBase()}/compare/${base}...${head}`);
}

/**
 * 브랜치 커밋 이력 조회 (롤백 대상 선택용). DB 비대화 방지 — 온디맨드 GitHub API.
 * 반환: 최신순 커밋 목록 (sha, message, author, date).
 */
export interface GitCommitListItem {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
}

export async function listBranchCommits(
  branch: AllowedBranch,
  limit = 30,
): Promise<GitCommitListItem[]> {
  assertAllowedBranch(branch);
  const perPage = Math.min(Math.max(limit, 1), 100);
  const data = await ghJson<any[]>(
    `${repoBase()}/commits?sha=${encodeURIComponent(branch)}&per_page=${perPage}`,
  );
  return (data ?? []).map((c: any) => ({
    sha: c.sha,
    shortSha: String(c.sha).slice(0, 8),
    message: (c.commit?.message ?? "").split("\n")[0],
    author: c.commit?.author?.name ?? "unknown",
    date: c.commit?.author?.date ?? "",
  }));
}

/**
 * STEP3 확장 — 롤백(Revert) [마누스 비종속 자체 되돌리기]
 * ------------------------------------------------------------------
 * 목적: 마누스 없이 ERP 화면에서 직접 특정 커밋 시점으로 브랜치를 되돌린다.
 *
 * 방식: "되돌릴 대상 커밋(targetSha)의 트리 스냅샷"을 브랜치 최신 위에
 *       **새 커밋으로 얹는다**(history-preserving rollback).
 *       force-push / history 파괴 없이 GitHub REST 트랜잭션만으로 안전 복원.
 *       → 기존 커밋 이력은 그대로 보존되고, '되돌림 커밋'이 하나 추가될 뿐.
 *
 * 안전 가드:
 *   - dev 브랜치(dev-1 / dev-2-integration) 한정. main 롤백 영구 금지.
 *   - targetSha 트리를 새 커밋의 tree 로 그대로 사용(부모는 현재 HEAD).
 *   - force:false 로 Ref 갱신 → 동시성 충돌 시 자동/강제 덮어쓰기 금지.
 */
export interface RollbackResult {
  success: boolean;
  newCommitSha: string;
  branch: string;
  targetSha: string;
  message: string;
}

export async function rollbackToCommit(
  branch: AllowedBranch,
  targetSha: string,
  reason?: string,
): Promise<RollbackResult> {
  assertAllowedBranch(branch);
  if (branch === "main") {
    throw new Error("[GitEngine] main 브랜치 롤백은 금지됩니다 (마스터 수동 승인 전용 영역)");
  }
  if (!targetSha || targetSha.length < 7) {
    throw new Error("[GitEngine] 롤백 대상 커밋 SHA 가 유효하지 않습니다 (최소 7자)");
  }

  const base = repoBase();
  await ensureBranch(branch, "main");

  // (1) 되돌릴 대상 커밋 → 그 시점의 트리 SHA 확보
  const targetCommit = await ghJson<{ sha: string; tree: { sha: string }; message?: string }>(
    `${base}/git/commits/${targetSha}`,
  );
  const targetTreeSha = targetCommit.tree.sha;

  // (2) 현재 브랜치 HEAD 커밋 SHA (새 커밋의 부모)
  const ref = await ghJson<{ object: { sha: string } }>(`${base}/git/ref/heads/${branch}`);
  const headSha = ref.object.sha;

  // 이미 같은 트리면(되돌릴 필요 없음) no-op 처리
  const headCommit = await ghJson<{ tree: { sha: string } }>(`${base}/git/commits/${headSha}`);
  if (headCommit.tree.sha === targetTreeSha) {
    return {
      success: true,
      newCommitSha: headSha,
      branch,
      targetSha,
      message: `이미 ${targetSha.slice(0, 8)} 시점과 동일한 상태입니다 (변경 없음)`,
    };
  }

  // (3) 대상 트리를 그대로 사용하는 '되돌림 커밋' 생성 (부모: 현재 HEAD → 이력 보존)
  const revertMessage =
    `revert: ${targetSha.slice(0, 8)} 시점으로 롤백` + (reason ? `\n\n사유: ${reason}` : "");
  const newCommit = await ghJson<{ sha: string }>(`${base}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: revertMessage,
      tree: targetTreeSha,
      parents: [headSha],
      author: { name: "DuGolf-Server-Engine", email: "engine@dayoutgolf.com", date: new Date().toISOString() },
    }),
  });

  // (4) Ref 안전 갱신 (force:false)
  await ghJson(`${base}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });

  console.log(`[GitEngine] 롤백 완료: ${branch} → ${targetSha.slice(0, 8)} 시점 (새 커밋 ${newCommit.sha.slice(0, 8)})`);
  return {
    success: true,
    newCommitSha: newCommit.sha,
    branch,
    targetSha,
    message: `${branch} 브랜치를 ${targetSha.slice(0, 8)} 시점으로 되돌렸습니다 (되돌림 커밋 ${newCommit.sha.slice(0, 8)})`,
  };
}

/** 트랜잭션 실패 시 로컬 백업 격리 덤프 */
function dumpBackup(devRequestId: number, files: ChangesetFile[], commitMessage: string, err: unknown): void {
  try {
    const dir = process.env.AI_CODE_BACKUP_DIR || "/var/backup/ai_code";
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `req_${devRequestId}_${Date.now()}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify({ devRequestId, commitMessage, error: String(err), files }, null, 2),
      "utf-8",
    );
    console.warn(`[GitEngine] 트랜잭션 실패 → 로컬 백업 격리 덤프: ${file}`);
  } catch (backupErr) {
    console.error("[GitEngine] 백업 덤프조차 실패:", backupErr);
  }
}

/** 엔진 활성 여부 (토큰·레포 환경변수 존재) */
export function isGitEngineEnabled(): boolean {
  return Boolean(ENV.githubToken && ENV.githubRepoOwner && ENV.githubRepoName);
}
