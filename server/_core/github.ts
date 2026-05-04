/**
 * GitHub API 헬퍼 모듈
 * 두골프 AI 엔진 Phase 2: 코드 히스토리 보관 및 중복 개발 방지
 */

import { ENV } from "./env";

const GITHUB_API_BASE = "https://api.github.com";

function getHeaders() {
  return {
    Authorization: `Bearer ${ENV.githubToken}`,
    Accept: "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function getRepoBase() {
  return `${GITHUB_API_BASE}/repos/${ENV.githubRepoOwner}/${ENV.githubRepoName}`;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
  htmlUrl: string;
  filesChanged?: number;
  additions?: number;
  deletions?: number;
}

export interface GitHubRepoInfo {
  id: number;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  private: boolean;
  stargazersCount: number;
  language: string | null;
  updatedAt: string;
  htmlUrl: string;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  content: string;
  encoding: string;
  htmlUrl: string;
}

export interface GitHubSearchResult {
  totalCount: number;
  items: Array<{
    name: string;
    path: string;
    sha: string;
    url: string;
    htmlUrl: string;
    repository: {
      fullName: string;
    };
    textMatches?: Array<{
      fragment: string;
    }>;
  }>;
}

/**
 * 저장소 기본 정보 조회
 */
export async function getRepoInfo(): Promise<GitHubRepoInfo> {
  const res = await fetch(getRepoBase(), { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return {
    id: data.id,
    fullName: data.full_name,
    description: data.description,
    defaultBranch: data.default_branch,
    private: data.private,
    stargazersCount: data.stargazers_count,
    language: data.language,
    updatedAt: data.updated_at,
    htmlUrl: data.html_url,
  };
}

/**
 * 커밋 목록 조회
 */
export async function listCommits(options?: {
  branch?: string;
  path?: string;
  since?: string;
  until?: string;
  perPage?: number;
  page?: number;
}): Promise<GitHubCommit[]> {
  const params = new URLSearchParams();
  if (options?.branch) params.set("sha", options.branch);
  if (options?.path) params.set("path", options.path);
  if (options?.since) params.set("since", options.since);
  if (options?.until) params.set("until", options.until);
  params.set("per_page", String(options?.perPage ?? 30));
  params.set("page", String(options?.page ?? 1));

  const res = await fetch(`${getRepoBase()}/commits?${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.map((c: any) => ({
    sha: c.sha,
    message: c.commit.message,
    author: {
      name: c.commit.author.name,
      email: c.commit.author.email,
      date: c.commit.author.date,
    },
    url: c.url,
    htmlUrl: c.html_url,
  }));
}

/**
 * 특정 커밋 상세 조회 (변경 파일 포함)
 */
export async function getCommitDetail(sha: string): Promise<GitHubCommit & { files: Array<{ filename: string; status: string; additions: number; deletions: number; patch?: string }> }> {
  const res = await fetch(`${getRepoBase()}/commits/${sha}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return {
    sha: data.sha,
    message: data.commit.message,
    author: {
      name: data.commit.author.name,
      email: data.commit.author.email,
      date: data.commit.author.date,
    },
    url: data.url,
    htmlUrl: data.html_url,
    filesChanged: data.files?.length ?? 0,
    additions: data.stats?.additions ?? 0,
    deletions: data.stats?.deletions ?? 0,
    files: (data.files ?? []).map((f: any) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    })),
  };
}

/**
 * 파일 내용 조회
 */
export async function getFileContent(path: string, ref?: string): Promise<GitHubFileContent> {
  const params = ref ? `?ref=${ref}` : "";
  const res = await fetch(`${getRepoBase()}/contents/${path}${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return {
    name: data.name,
    path: data.path,
    sha: data.sha,
    content: Buffer.from(data.content, "base64").toString("utf-8"),
    encoding: data.encoding,
    htmlUrl: data.html_url,
  };
}

/**
 * 코드 검색 (중복 개발 방지)
 */
export async function searchCode(query: string, options?: {
  language?: string;
  perPage?: number;
}): Promise<GitHubSearchResult> {
  const q = `${query} repo:${ENV.githubRepoOwner}/${ENV.githubRepoName}${options?.language ? ` language:${options.language}` : ""}`;
  const params = new URLSearchParams({
    q,
    per_page: String(options?.perPage ?? 10),
  });

  const res = await fetch(`${GITHUB_API_BASE}/search/code?${params}`, {
    headers: {
      ...getHeaders(),
      Accept: "application/vnd.github.text-match+json",
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub Search API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return {
    totalCount: data.total_count,
    items: (data.items ?? []).map((item: any) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      url: item.url,
      htmlUrl: item.html_url,
      repository: { fullName: item.repository?.full_name ?? "" },
      textMatches: item.text_matches?.map((m: any) => ({ fragment: m.fragment })),
    })),
  };
}

/**
 * 브랜치 목록 조회
 */
export async function listBranches(): Promise<Array<{ name: string; sha: string; protected: boolean }>> {
  const res = await fetch(`${getRepoBase()}/branches?per_page=50`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.map((b: any) => ({
    name: b.name,
    sha: b.commit.sha,
    protected: b.protected,
  }));
}

/**
 * 연결 상태 테스트
 */
export async function testConnection(): Promise<{ ok: boolean; repoName?: string; error?: string }> {
  try {
    const info = await getRepoInfo();
    return { ok: true, repoName: info.fullName };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
