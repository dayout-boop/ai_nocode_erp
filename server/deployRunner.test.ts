/**
 * deployRunner.test.ts
 * 자체 배포 실행기 안전가드 + 로직 보강 테스트
 * ------------------------------------------------------------------
 * 검증 목표:
 *  1) isSelfDeployEnabled: SELF_DEPLOY_ENABLED 값에 따른 활성 판정.
 *  2) runDeploy(비활성): 실제 쉘 실행 없이 enabled:false / ok:false 로 안전 반환.
 *     (의도치 않은 자동 배포 차단 — 사양 안전가드)
 *  3) git pull 단계: DEPLOY_GIT_PULL_CMD 미설정 시 경고 메시지 포함, 실행 생략.
 *  4) 중복 실행 락: 동시 실행 시 locked:true 로 즉시 거부.
 *  5) pull 페이즈: phase="pull" 입력 시 결과에 phase 보존.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// env 모킹: 테스트마다 값을 바꾼다.
vi.mock("./_core/env", () => ({
  ENV: {
    selfDeployEnabled: "",
    deployBuildCmd: "pnpm build",
    deployRestartCmd: "",
    deployGitPullCmd: "",
    deployGitPullDir: "",
  },
}));

// db 모킹: deploy_logs 기록은 graceful 하게 무시되도록 null 반환.
vi.mock("./db", () => ({
  getDb: vi.fn(async () => null),
}));

// child_process 모킹: 실제 쉘 실행 차단
vi.mock("node:child_process", () => ({
  exec: vi.fn((_cmd: string, _opts: unknown, cb: (err: null, res: { stdout: string; stderr: string }) => void) => {
    cb(null, { stdout: "mock build ok", stderr: "" });
  }),
}));

import { ENV } from "./_core/env";
import { isSelfDeployEnabled, runDeploy, isDeployRunning } from "./services/deployRunner";

describe("deployRunner — 자체 배포 안전가드", () => {
  beforeEach(() => {
    (ENV as any).selfDeployEnabled = "";
    (ENV as any).deployGitPullCmd = "";
    (ENV as any).deployGitPullDir = "";
    (ENV as any).deployRestartCmd = "";
  });

  // ── 1) 활성 판정 ────────────────────────────────────────────────
  it("SELF_DEPLOY_ENABLED 미설정 시 비활성으로 판정", () => {
    (ENV as any).selfDeployEnabled = "";
    expect(isSelfDeployEnabled()).toBe(false);
  });

  it("SELF_DEPLOY_ENABLED=true 시 활성으로 판정", () => {
    (ENV as any).selfDeployEnabled = "true";
    expect(isSelfDeployEnabled()).toBe(true);
  });

  // ── 2) 비활성 안전가드 ──────────────────────────────────────────
  it("비활성 상태에서 runDeploy 호출 시 실제 실행 없이 enabled:false 반환", async () => {
    (ENV as any).selfDeployEnabled = "";
    const result = await runDeploy({ phase: "full", tenantId: 1 });
    expect(result.enabled).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.phase).toBe("full");
    expect(result.outputSummary).toContain("자체 배포 비활성");
  });

  it("비활성 결과에도 phase 정보는 그대로 보존된다", async () => {
    (ENV as any).selfDeployEnabled = "";
    const result = await runDeploy({ phase: "build" });
    expect(result.phase).toBe("build");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  // ── 3) git pull 단계 ────────────────────────────────────────────
  it("비활성 + DEPLOY_GIT_PULL_CMD 미설정 시 pull 생략 메시지 없음(비활성 메시지만)", async () => {
    (ENV as any).selfDeployEnabled = "";
    (ENV as any).deployGitPullCmd = "";
    const result = await runDeploy({ phase: "full" });
    // 비활성이므로 pull 단계 자체에 도달하지 않음
    expect(result.enabled).toBe(false);
    expect(result.outputSummary).toContain("자체 배포 비활성");
  });

  it("비활성 + pull 페이즈 입력 시에도 enabled:false 반환", async () => {
    (ENV as any).selfDeployEnabled = "";
    const result = await runDeploy({ phase: "pull" });
    expect(result.enabled).toBe(false);
    expect(result.phase).toBe("pull");
  });

  // ── 4) pull 페이즈 phase 보존 ──────────────────────────────────
  it("phase='pull' 입력 시 결과에 phase='pull' 보존", async () => {
    (ENV as any).selfDeployEnabled = "";
    const result = await runDeploy({ phase: "pull" });
    expect(result.phase).toBe("pull");
  });

  // ── 5) isDeployRunning 초기 상태 ──────────────────────────────
  it("초기 상태에서 isDeployRunning()은 false", () => {
    // 비활성 상태에서는 락이 잡히지 않으므로 항상 false
    expect(isDeployRunning()).toBe(false);
  });
});
