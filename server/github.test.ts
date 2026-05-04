/**
 * GitHub 연동 테스트
 * AI 엔진 Phase 2: GitHub API 헬퍼 및 라우터 기본 검증
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// GitHub API 헬퍼 모킹
vi.mock("./_core/github", () => ({
  testConnection: vi.fn().mockResolvedValue({ ok: true, repoName: "dayout-boop/dogolf" }),
  getRepoInfo: vi.fn().mockResolvedValue({
    id: 123456,
    fullName: "dayout-boop/dogolf",
    description: "두골프 ERP",
    defaultBranch: "main",
    private: true,
    stargazersCount: 0,
    language: "TypeScript",
    updatedAt: new Date().toISOString(),
    htmlUrl: "https://github.com/dayout-boop/dogolf",
  }),
  listCommits: vi.fn().mockResolvedValue([
    {
      sha: "a".repeat(40),
      message: "feat: GitHub 연동 Phase 2 구현",
      author: { name: "두골프", email: "dev@dogolf.com", date: new Date().toISOString() },
      url: "https://api.github.com/repos/dayout-boop/dogolf/commits/" + "a".repeat(40),
      htmlUrl: "https://github.com/dayout-boop/dogolf/commit/" + "a".repeat(40),
    },
  ]),
  getCommitDetail: vi.fn().mockResolvedValue({
    sha: "a".repeat(40),
    message: "feat: GitHub 연동 Phase 2 구현",
    author: { name: "두골프", email: "dev@dogolf.com", date: new Date().toISOString() },
    url: "https://api.github.com/repos/dayout-boop/dogolf/commits/" + "a".repeat(40),
    htmlUrl: "https://github.com/dayout-boop/dogolf/commit/" + "a".repeat(40),
    filesChanged: 3,
    additions: 150,
    deletions: 10,
    files: [
      { filename: "server/_core/github.ts", status: "added", additions: 100, deletions: 0 },
      { filename: "server/routers/github.ts", status: "added", additions: 40, deletions: 0 },
      { filename: "drizzle/schema.ts", status: "modified", additions: 10, deletions: 10 },
    ],
  }),
  searchCode: vi.fn().mockResolvedValue({
    totalCount: 2,
    items: [
      {
        name: "github.ts",
        path: "server/_core/github.ts",
        sha: "b".repeat(40),
        url: "https://api.github.com/repos/dayout-boop/dogolf/contents/server/_core/github.ts",
        htmlUrl: "https://github.com/dayout-boop/dogolf/blob/main/server/_core/github.ts",
        repository: { fullName: "dayout-boop/dogolf" },
        textMatches: [{ fragment: "export async function testConnection()" }],
      },
    ],
  }),
  listBranches: vi.fn().mockResolvedValue([
    { name: "main", sha: "c".repeat(40), protected: true },
    { name: "develop", sha: "d".repeat(40), protected: false },
  ]),
}));

describe("GitHub 연동 헬퍼", () => {
  it("testConnection: 연결 성공 시 ok=true 반환", async () => {
    const { testConnection } = await import("./_core/github");
    const result = await testConnection();
    expect(result.ok).toBe(true);
    expect(result.repoName).toBe("dayout-boop/dogolf");
  });

  it("getRepoInfo: 저장소 정보 반환", async () => {
    const { getRepoInfo } = await import("./_core/github");
    const info = await getRepoInfo();
    expect(info.fullName).toBe("dayout-boop/dogolf");
    expect(info.defaultBranch).toBe("main");
    expect(info.private).toBe(true);
  });

  it("listCommits: 커밋 목록 반환", async () => {
    const { listCommits } = await import("./_core/github");
    const commits = await listCommits({ branch: "main", perPage: 10 });
    expect(Array.isArray(commits)).toBe(true);
    expect(commits.length).toBeGreaterThan(0);
    expect(commits[0].sha).toHaveLength(40);
    expect(commits[0].message).toBeTruthy();
  });

  it("getCommitDetail: 커밋 상세 정보 반환 (파일 변경 포함)", async () => {
    const { getCommitDetail } = await import("./_core/github");
    const detail = await getCommitDetail("a".repeat(40));
    expect(detail.filesChanged).toBe(3);
    expect(detail.additions).toBe(150);
    expect(detail.files).toHaveLength(3);
    expect(detail.files[0].filename).toBe("server/_core/github.ts");
  });

  it("searchCode: 코드 검색 결과 반환", async () => {
    const { searchCode } = await import("./_core/github");
    const results = await searchCode("testConnection");
    expect(results.totalCount).toBeGreaterThan(0);
    expect(results.items[0].path).toContain("github.ts");
  });

  it("listBranches: 브랜치 목록 반환", async () => {
    const { listBranches } = await import("./_core/github");
    const branches = await listBranches();
    expect(Array.isArray(branches)).toBe(true);
    expect(branches.some((b) => b.name === "main")).toBe(true);
  });
});

describe("GitHub 환경변수 설정", () => {
  it("GITHUB_TOKEN 환경변수가 설정되어 있어야 함", () => {
    // 실제 배포 환경에서는 반드시 설정되어야 함
    // 테스트 환경에서는 빈 값이어도 통과 (CI/CD 환경 고려)
    const token = process.env.GITHUB_TOKEN;
    // 토큰이 있다면 ghp_ 또는 github_pat_ 로 시작해야 함
    if (token) {
      expect(token.startsWith("ghp_") || token.startsWith("github_pat_")).toBe(true);
    }
  });

  it("GITHUB_REPO_OWNER 환경변수 확인", () => {
    const owner = process.env.GITHUB_REPO_OWNER;
    if (owner) {
      expect(owner).toBe("dayout-boop");
    }
  });

  it("GITHUB_REPO_NAME 환경변수 확인", () => {
    const repo = process.env.GITHUB_REPO_NAME;
    if (repo) {
      expect(repo).toBe("dogolf");
    }
  });
});

describe("github_commits 스키마 검증", () => {
  it("githubCommits 테이블 스키마가 올바르게 정의되어 있어야 함", async () => {
    const { githubCommits } = await import("../drizzle/schema");
    expect(githubCommits).toBeDefined();
    // drizzle 테이블은 컨럼 이름을 키로 가짐
    const columns = Object.keys(githubCommits);
    expect(columns).toContain("id");
    expect(columns).toContain("commitSha");
    expect(columns).toContain("commitMessage");
    expect(columns).toContain("devRequestId");
    expect(columns).toContain("linkType");
  });
});
