/**
 * deployRunner.test.ts
 * 자체 배포 실행기 안전가드 테스트
 * ------------------------------------------------------------------
 * 검증 목표:
 *  - isSelfDeployEnabled: SELF_DEPLOY_ENABLED 값에 따른 활성 판정.
 *  - runDeploy(비활성): 실제 쉘 실행 없이 enabled:false / ok:false 로 안전 반환.
 *    (의도치 않은 자동 배포 차단 — 사양 안전가드)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// env 모킹: selfDeployEnabled 값을 테스트마다 바꾼다.
vi.mock("./_core/env", () => ({
  ENV: {
    selfDeployEnabled: "",
    deployBuildCmd: "pnpm build",
    deployRestartCmd: "",
  },
}));

// db 모킹: deploy_logs 기록은 graceful 하게 무시되도록 null 반환.
vi.mock("./db", () => ({
  getDb: vi.fn(async () => null),
}));

import { ENV } from "./_core/env";
import { isSelfDeployEnabled, runDeploy } from "./services/deployRunner";

describe("deployRunner — 자체 배포 안전가드", () => {
  beforeEach(() => {
    (ENV as any).selfDeployEnabled = "";
  });

  it("SELF_DEPLOY_ENABLED 미설정 시 비활성으로 판정", () => {
    (ENV as any).selfDeployEnabled = "";
    expect(isSelfDeployEnabled()).toBe(false);
  });

  it("SELF_DEPLOY_ENABLED=true 시 활성으로 판정", () => {
    (ENV as any).selfDeployEnabled = "true";
    expect(isSelfDeployEnabled()).toBe(true);
  });

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
});
