/**
 * 탈마누스 자립전환 상태 판정 테스트 [STEP5 §2~3]
 * ------------------------------------------------------------------
 * resolveCurrentMode / getNeutralStatus 의 모드·Phase·준비도 판정과
 * '키 원문 미노출' 불변식을 환경변수 조합별로 고정한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ENV 는 모듈 로드시 1회 평가되므로, 각 케이스마다 process.env 세팅 후 모듈을 재로딩한다.
async function loadWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return await import("./vendorNeutral");
}

const SNAPSHOT = { ...process.env };

describe("resolveCurrentMode — LLM 호출 통로 판정", () => {
  afterEach(() => {
    process.env = { ...SNAPSHOT };
  });

  it("NEUTRAL 미설정이면 MANUS_GATEWAY", async () => {
    const m = await loadWith({
      AI_VEND_NEUTRAL_MODE: "",
      TARGET_LLM_PROVIDER: "",
      ANTHROPIC_API_KEY: "",
    });
    expect(m.resolveCurrentMode()).toBe("MANUS_GATEWAY");
  });

  it("NEUTRAL + ANTHROPIC + 키 있으면 NEUTRAL_ANTHROPIC", async () => {
    const m = await loadWith({
      AI_VEND_NEUTRAL_MODE: "true",
      TARGET_LLM_PROVIDER: "ANTHROPIC",
      ANTHROPIC_API_KEY: "sk-ant-xxxx",
    });
    expect(m.resolveCurrentMode()).toBe("NEUTRAL_ANTHROPIC");
  });

  it("NEUTRAL 이지만 ANTHROPIC 키 없으면 NEUTRAL_GEMINI 폴백", async () => {
    const m = await loadWith({
      AI_VEND_NEUTRAL_MODE: "true",
      TARGET_LLM_PROVIDER: "ANTHROPIC",
      ANTHROPIC_API_KEY: "",
    });
    expect(m.resolveCurrentMode()).toBe("NEUTRAL_GEMINI");
  });

  it("NEUTRAL 이지만 provider 미지정이면 NEUTRAL_GEMINI", async () => {
    const m = await loadWith({
      AI_VEND_NEUTRAL_MODE: "true",
      TARGET_LLM_PROVIDER: "",
      ANTHROPIC_API_KEY: "",
    });
    expect(m.resolveCurrentMode()).toBe("NEUTRAL_GEMINI");
  });
});

describe("getNeutralStatus — Phase/준비도 판정 + 키 미노출", () => {
  afterEach(() => {
    process.env = { ...SNAPSHOT };
  });

  it("아무 자립자산도 없으면 Phase1 / 낮은 준비도", async () => {
    const m = await loadWith({
      AI_VEND_NEUTRAL_MODE: "",
      TARGET_LLM_PROVIDER: "",
      ANTHROPIC_API_KEY: "",
      GEMINI_API_KEY: "",
      ENGINE_API_KEY: "",
      HEARTBEAT_SECRET_KEY: "",
    });
    const s = m.getNeutralStatus();
    expect(s.phase).toBe(1);
    expect(s.readinessScore).toBeLessThan(50);
  });

  it("Git엔진+Heartbeat 갖추면 최소 Phase3", async () => {
    const m = await loadWith({
      AI_VEND_NEUTRAL_MODE: "",
      ENGINE_API_KEY: "engine-token",
      HEARTBEAT_SECRET_KEY: "hb-token",
      GEMINI_API_KEY: "g-key",
    });
    const s = m.getNeutralStatus();
    expect(s.phase).toBeGreaterThanOrEqual(3);
  });

  it("모든 자산 + NEUTRAL_ANTHROPIC 면 Phase4 / 100%", async () => {
    const m = await loadWith({
      AI_VEND_NEUTRAL_MODE: "true",
      TARGET_LLM_PROVIDER: "ANTHROPIC",
      ANTHROPIC_API_KEY: "sk-ant",
      ENGINE_API_KEY: "engine-token",
      HEARTBEAT_SECRET_KEY: "hb-token",
    });
    const s = m.getNeutralStatus();
    expect(s.readinessScore).toBe(100);
    expect(s.phase).toBe(4);
  });

  it("상태 객체에 키 원문이 절대 포함되지 않는다", async () => {
    const m = await loadWith({
      AI_VEND_NEUTRAL_MODE: "true",
      TARGET_LLM_PROVIDER: "ANTHROPIC",
      ANTHROPIC_API_KEY: "sk-ant-SECRET-RAW-VALUE",
      ENGINE_API_KEY: "engine-RAW-SECRET",
      HEARTBEAT_SECRET_KEY: "hb-RAW-SECRET",
    });
    const s = m.getNeutralStatus();
    const serialized = JSON.stringify(s);
    expect(serialized).not.toContain("sk-ant-SECRET-RAW-VALUE");
    expect(serialized).not.toContain("engine-RAW-SECRET");
    expect(serialized).not.toContain("hb-RAW-SECRET");
  });

  it("로드맵은 항상 Phase 1~4 네 단계를 노출한다", async () => {
    const m = await loadWith({});
    expect(m.NEUTRAL_ROADMAP).toHaveLength(4);
    expect(m.NEUTRAL_ROADMAP.map((p) => p.phase)).toEqual([1, 2, 3, 4]);
  });
});
