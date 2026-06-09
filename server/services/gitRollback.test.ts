import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * 자체 Git 롤백(rollbackToCommit) 검증 — 마누스 비종속 되돌리기
 * ------------------------------------------------------------------
 * GitHub REST API 는 전역 fetch 를 mock 하여 시뮬레이션한다.
 * 핵심 검증:
 *   1) main 브랜치 롤백은 영구 차단 (네트워크 호출 전 throw)
 *   2) 허용되지 않은 브랜치는 가드에서 차단
 *   3) 짧은/빈 SHA 는 거부
 *   4) 정상 롤백 시 history-preserving: targetSha 의 tree 로 새 커밋을 만들고
 *      부모는 현재 HEAD (force:false PATCH)
 *   5) HEAD 트리 == target 트리면 no-op (새 커밋 생성 안 함)
 */

// env / apiKey 모킹 — 토큰·레포 존재 가정
vi.mock("../_core/env", () => ({
  ENV: {
    githubToken: "ghp_test_token",
    githubRepoOwner: "dugolf",
    githubRepoName: "erp",
  },
}));
vi.mock("../erpApiKeyManager", () => ({
  getApiKey: vi.fn(async () => "ghp_test_token"),
}));

import { rollbackToCommit, isGitEngineEnabled } from "./gitEngine";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("rollbackToCommit — 안전 가드", () => {
  it("main 브랜치 롤백은 차단된다 (네트워크 호출 없이 throw)", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as any;
    await expect(rollbackToCommit("main" as any, "abc1234def")).rejects.toThrow(/main/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("허용되지 않은 브랜치는 차단된다", async () => {
    await expect(rollbackToCommit("dev-3" as any, "abc1234def")).rejects.toThrow();
  });

  it("너무 짧은 SHA 는 거부된다", async () => {
    await expect(rollbackToCommit("dev-1", "abc")).rejects.toThrow(/SHA/);
  });

  it("빈 SHA 는 거부된다", async () => {
    await expect(rollbackToCommit("dev-1", "")).rejects.toThrow(/SHA/);
  });
});

describe("rollbackToCommit — history-preserving 동작", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function makeFetch(handlers: Array<{ test: RegExp; method?: string; json: any; status?: number }>) {
    return vi.fn(async (url: string, init?: any) => {
      const method = (init?.method ?? "GET").toUpperCase();
      for (const h of handlers) {
        if (h.test.test(url) && (!h.method || h.method === method)) {
          return {
            ok: (h.status ?? 200) < 400,
            status: h.status ?? 200,
            statusText: "OK",
            json: async () => h.json,
            text: async () => JSON.stringify(h.json),
          } as any;
        }
      }
      throw new Error(`unexpected fetch: ${method} ${url}`);
    });
  }

  it("정상 롤백: target 트리로 새 커밋 생성 + force:false PATCH", async () => {
    const TARGET_SHA = "target1234567890";
    const TARGET_TREE = "tree_target_aaa";
    const HEAD_SHA = "head9876543210";
    const HEAD_TREE = "tree_head_bbb";
    const NEW_COMMIT = "newcommit000111";

    let createdCommitBody: any = null;
    let patchedRefBody: any = null;

    const fetchSpy = vi.fn(async (url: string, init?: any) => {
      const method = (init?.method ?? "GET").toUpperCase();
      // ensureBranch: 브랜치 존재 확인 (ok)
      if (/\/git\/ref\/heads\/dev-1$/.test(url) && method === "GET") {
        return resp({ object: { sha: HEAD_SHA } });
      }
      // target commit 조회
      if (new RegExp(`/git/commits/${TARGET_SHA}$`).test(url) && method === "GET") {
        return resp({ sha: TARGET_SHA, tree: { sha: TARGET_TREE } });
      }
      // head commit 조회
      if (new RegExp(`/git/commits/${HEAD_SHA}$`).test(url) && method === "GET") {
        return resp({ sha: HEAD_SHA, tree: { sha: HEAD_TREE } });
      }
      // 새 커밋 생성
      if (/\/git\/commits$/.test(url) && method === "POST") {
        createdCommitBody = JSON.parse(init.body);
        return resp({ sha: NEW_COMMIT });
      }
      // ref 갱신
      if (/\/git\/refs\/heads\/dev-1$/.test(url) && method === "PATCH") {
        patchedRefBody = JSON.parse(init.body);
        return resp({ ok: true });
      }
      throw new Error(`unexpected fetch: ${method} ${url}`);
    });
    globalThis.fetch = fetchSpy as any;

    const result = await rollbackToCommit("dev-1", TARGET_SHA, "테스트 롤백");

    expect(result.success).toBe(true);
    expect(result.newCommitSha).toBe(NEW_COMMIT);
    // 새 커밋의 tree 는 target 의 tree, 부모는 현재 HEAD (history preserve)
    expect(createdCommitBody.tree).toBe(TARGET_TREE);
    expect(createdCommitBody.parents).toEqual([HEAD_SHA]);
    expect(createdCommitBody.message).toContain("revert");
    expect(createdCommitBody.message).toContain("테스트 롤백");
    // ref 갱신은 force:false (강제 덮어쓰기 금지)
    expect(patchedRefBody.sha).toBe(NEW_COMMIT);
    expect(patchedRefBody.force).toBe(false);
  });

  it("HEAD 트리 == target 트리면 no-op (새 커밋 생성 안 함)", async () => {
    const TARGET_SHA = "same1234567890";
    const SAME_TREE = "tree_same_zzz";
    const HEAD_SHA = "headsame111222";

    const postSpy = vi.fn();

    const fetchSpy = vi.fn(async (url: string, init?: any) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (/\/git\/ref\/heads\/dev-1$/.test(url) && method === "GET") {
        return resp({ object: { sha: HEAD_SHA } });
      }
      if (new RegExp(`/git/commits/${TARGET_SHA}$`).test(url) && method === "GET") {
        return resp({ sha: TARGET_SHA, tree: { sha: SAME_TREE } });
      }
      if (new RegExp(`/git/commits/${HEAD_SHA}$`).test(url) && method === "GET") {
        return resp({ sha: HEAD_SHA, tree: { sha: SAME_TREE } });
      }
      if (method === "POST" || method === "PATCH") {
        postSpy();
        throw new Error("no-op 인데 쓰기 호출이 발생함");
      }
      throw new Error(`unexpected fetch: ${method} ${url}`);
    });
    globalThis.fetch = fetchSpy as any;

    const result = await rollbackToCommit("dev-1", TARGET_SHA);
    expect(result.success).toBe(true);
    expect(result.newCommitSha).toBe(HEAD_SHA); // 변경 없음
    expect(result.message).toContain("변경 없음");
    expect(postSpy).not.toHaveBeenCalled();
  });
});

describe("isGitEngineEnabled", () => {
  it("토큰·레포가 설정되어 있으면 활성으로 본다", () => {
    expect(isGitEngineEnabled()).toBe(true);
  });
});

function resp(json: any, status = 200) {
  return {
    ok: status < 400,
    status,
    statusText: "OK",
    json: async () => json,
    text: async () => JSON.stringify(json),
  } as any;
}
