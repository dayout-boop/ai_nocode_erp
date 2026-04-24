/**
 * OpenRouter 연결 테스트
 * OPENROUTER_API_KEY 환경변수 유효성 검증
 */
import { describe, it, expect } from "vitest";
import { testConnection, routeModel } from "./services/openrouter";

describe("OpenRouter 연결 테스트", () => {
  it("모델 라우팅이 올바르게 설정되어야 한다", () => {
    expect(routeModel("high").id).toBe("google/gemini-2.5-pro");
    expect(routeModel("medium").id).toBe("google/gemini-2.5-flash");
    expect(routeModel("low").id).toBe("google/gemini-2.0-flash-lite");
  });

  it("OpenRouter API에 연결되어야 한다", async () => {
    const result = await testConnection();
    expect(result.ok).toBe(true);
    expect(result.model).toBeTruthy();
    expect(result.latencyMs).toBeGreaterThan(0);
    console.log(`[OpenRouter 연결 성공] 모델: ${result.model}, 응답시간: ${result.latencyMs}ms`);
  }, 30_000); // 30초 타임아웃
});
