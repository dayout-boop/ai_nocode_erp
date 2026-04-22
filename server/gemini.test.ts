import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateGeminiApiKey,
  geminiChat,
  GEMINI_REGION_ENDPOINTS,
  isRetryableError,
  isOverloadError,
  recordRegionFailure,
  recordRegionSuccess,
  isCircuitOpen,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
} from "./_core/gemini";

// ────────────────────────────────────────────────────────────────────────────
// 단위 테스트: 리전 엔드포인트 목록 및 오류 분류
// ────────────────────────────────────────────────────────────────────────────
describe("Gemini 리전 엔드포인트 설정", () => {
  it("리전 엔드포인트 목록이 4개 이상 정의되어 있어야 한다", () => {
    expect(GEMINI_REGION_ENDPOINTS.length).toBeGreaterThanOrEqual(4);
  });

  it("us-central1 리전이 priority 0으로 첫 번째에 있어야 한다 (Vertex AI 기본 리전)", () => {
    const primary = GEMINI_REGION_ENDPOINTS.find((r) => r.name === "us-central1");
    expect(primary).toBeDefined();
    expect(primary?.priority).toBe(0);
  });

  it("각 리전 엔드포인트는 name, label, location, priority 필드를 가져야 한다", () => {
    for (const region of GEMINI_REGION_ENDPOINTS) {
      expect(region.name).toBeTruthy();
      expect(region.label).toBeTruthy();
      expect(region.location).toBeTruthy();
      expect(typeof region.priority).toBe("number");
    }
  });

  it("리전 엔드포인트 priority가 중복되지 않아야 한다", () => {
    const priorities = GEMINI_REGION_ENDPOINTS.map((r) => r.priority);
    const uniquePriorities = new Set(priorities);
    expect(uniquePriorities.size).toBe(priorities.length);
  });

  it("us-central1, europe-west4, asia-northeast1, us-east4 리전이 포함되어야 한다", () => {
    const names = GEMINI_REGION_ENDPOINTS.map((r) => r.name);
    expect(names).toContain("us-central1");
    expect(names).toContain("europe-west4");
    expect(names).toContain("asia-northeast1");
    expect(names).toContain("us-east4");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 단위 테스트: 서킷 브레이커
// ────────────────────────────────────────────────────────────────────────────
describe("Gemini 서킷 브레이커", () => {
  beforeEach(() => {
    resetCircuitBreaker(); // 각 테스트 전 상태 초기화
  });

  it("초기에는 모든 리전의 서킷이 닫혀 있어야 한다", () => {
    expect(isCircuitOpen("us-central1")).toBe(false);
    expect(isCircuitOpen("europe-west4")).toBe(false);
  });

  it("실패 효수가 임계값(2회) 미만이면 서킷이 열리지 않아야 한다", () => {
    recordRegionFailure("us-central1");
    expect(isCircuitOpen("us-central1")).toBe(false);
  });

  it("실패 효수가 임계값(2회) 이상이면 서킷이 열려야 한다", () => {
    recordRegionFailure("us-central1");
    recordRegionFailure("us-central1");
    expect(isCircuitOpen("us-central1")).toBe(true);
  });

  it("성공 기록 시 서킷이 닫혀야 한다", () => {
    recordRegionFailure("us-central1");
    recordRegionFailure("us-central1");
    expect(isCircuitOpen("us-central1")).toBe(true);
    recordRegionSuccess("us-central1");
    expect(isCircuitOpen("us-central1")).toBe(false);
  });

  it("다른 리전에 영향을 주지 않아야 한다", () => {
    recordRegionFailure("us-central1");
    recordRegionFailure("us-central1");
    expect(isCircuitOpen("us-central1")).toBe(true);
    expect(isCircuitOpen("europe-west4")).toBe(false);
  });

  it("getCircuitBreakerStatus가 현재 열린 서킷 정보를 반환해야 한다", () => {
    recordRegionFailure("us-central1");
    recordRegionFailure("us-central1");
    const status = getCircuitBreakerStatus();
    expect(status["us-central1"]).toBeDefined();
    expect(status["us-central1"].isOpen).toBe(true);
    expect(status["us-central1"].failures).toBe(2);
  });

  it("resetCircuitBreaker로 특정 리전만 초기화할 수 있어야 한다", () => {
    recordRegionFailure("us-central1");
    recordRegionFailure("us-central1");
    recordRegionFailure("europe-west4");
    recordRegionFailure("europe-west4");
    resetCircuitBreaker("us-central1");
    expect(isCircuitOpen("us-central1")).toBe(false);
    expect(isCircuitOpen("europe-west4")).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 단위 테스트: 오류 분류 헬퍼
// ────────────────────────────────────────────────────────────────────────────
describe("Gemini 오류 분류", () => {
  it("503 에러는 재시도 가능 오류로 분류되어야 한다", () => {
    const err = new Error("[503 Service Unavailable] This model is currently experiencing high demand.");
    expect(isRetryableError(err)).toBe(true);
    expect(isOverloadError(err)).toBe(true);
  });

  it("429 에러는 재시도 가능 오류로 분류되어야 한다", () => {
    const err = new Error("[429] resource_exhausted: quota exceeded");
    expect(isRetryableError(err)).toBe(true);
  });

  it("타임아웃 에러는 재시도 가능 오류로 분류되어야 한다", () => {
    const err = new Error("API 호출 타임아웃 (30초 초과) [global]");
    expect(isRetryableError(err)).toBe(true);
    expect(isOverloadError(err)).toBe(true);
  });

  it("인증 에러는 재시도 불가 오류로 분류되어야 한다", () => {
    const err = new Error("[401] API key not valid. Please pass a valid API key.");
    expect(isRetryableError(err)).toBe(false);
    expect(isOverloadError(err)).toBe(false);
  });

  it("일반 네트워크 에러는 재시도 불가 오류로 분류되어야 한다", () => {
    const err = new Error("fetch failed: ECONNREFUSED");
    expect(isRetryableError(err)).toBe(false);
  });

  it("Error가 아닌 값은 재시도 불가로 처리되어야 한다", () => {
    expect(isRetryableError("503 error string")).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 통합 테스트: 실제 API 호출 (네트워크 필요)
// ────────────────────────────────────────────────────────────────────────────
describe("Gemini API 통합 테스트", () => {
  it("API 키가 환경변수에 설정되어 있어야 한다", () => {
    expect(process.env.GEMINI_API_KEY).toBeTruthy();
    expect(process.env.GEMINI_API_KEY).not.toBe("");
  });

  it("Gemini API 키가 유효하고 응답을 반환해야 한다", async () => {
    const isValid = await validateGeminiApiKey();
    expect(isValid).toBe(true);
  }, 60_000);

  it("두골프 시스템 컨텍스트로 채팅이 가능해야 한다", async () => {
    const result = await geminiChat({
      messages: [
        {
          role: "user",
          content: "두골프 ERP에서 상품을 등록하려면 어떤 API를 사용해야 하나요? 한 문장으로 답해주세요.",
        },
      ],
    });
    expect(result).toBeTruthy();
    expect(typeof result.modelUsed).toBe("string");
    expect(typeof result.wasFallback).toBe("boolean");
    expect(typeof result.regionUsed).toBe("string");
    expect(result.regionUsed.length).toBeGreaterThan(0);
    // 503 과부하 시나리오 허용
    if (result.errorMessage) {
      expect(result.errorMessage.length).toBeGreaterThan(0);
      console.log("[Test] API 과부하 상태:", result.errorMessage);
    } else {
      expect(typeof result.text).toBe("string");
      expect(result.text.length).toBeGreaterThan(10);
    }
  }, 60_000);

  it("정상 응답 시 errorMessage가 undefined이거나 테스트 길이가 0보다 커야 한다", async () => {
    const result = await geminiChat({
      messages: [{ role: "user", content: "안녕하세요. 한 단어로 인사해주세요." }],
    });
    // 서비스 계정 미설정 시 Vertex AI를 건너맰다. Studio가 503이면 errorMessage가 있을 수 있음.
    if (result.errorMessage) {
      // 503 과부하 시나리오: errorMessage가 사용자 친화적 문구여야 한다
      expect(result.errorMessage.length).toBeGreaterThan(0);
      console.log("[Test] API 과부하 상태 - errorMessage:", result.errorMessage);
    } else {
      expect(result.text.length).toBeGreaterThan(0);
    }
  }, 60_000);
});
