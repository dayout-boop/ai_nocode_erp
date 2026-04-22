/**
 * 중앙 AI 오케스트레이터 단위 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectComplexity, getModelPricing, getCacheStats, clearCache } from "./_core/orchestrator";

// ────────────────────────────────────────────────────────────────────────────
// detectComplexity 테스트
// ────────────────────────────────────────────────────────────────────────────

describe("detectComplexity", () => {
  it("짧은 텍스트는 SIMPLE로 분류", () => {
    const result = detectComplexity("안녕하세요");
    expect(result).toBe("SIMPLE");
  });

  it("요약 키워드가 포함된 텍스트는 SIMPLE", () => {
    const result = detectComplexity("이 내용을 요약해줘");
    expect(result).toBe("SIMPLE");
  });

  it("해시태그 요청은 SIMPLE (해시태그 키워드 포함)", () => {
    // '해시태그' 키워드는 SIMPLE, '생성'은 COMPLEX - COMPLEX가 우선
    // '생성' 없이 해시태그만 있으면 SIMPLE
    const result = detectComplexity("골프 여행 해시태그 추천해줘");
    expect(result).toBe("SIMPLE");
  });

  it("분류 요청은 SIMPLE", () => {
    const result = detectComplexity("데이터 분류 작업 해줘");
    expect(result).toBe("SIMPLE");
  });

  it("요금표 분석은 SIMPLE (짧은 텍스트, 키워드 없음)", () => {
    // '분석'은 키워드 없음 → 100자 미만이므로 SIMPLE
    const result = detectComplexity("이 요금표를 분석해서 최적 가격을 추천해줘");
    expect(result).toBe("SIMPLE");
  });

  it("일정 최적화는 SIMPLE (짧은 텍스트)", () => {
    // 100자 미만, SIMPLE/COMPLEX 키워드 없음 → SIMPLE
    const result = detectComplexity("골프 여행 일정을 최적화해줘");
    expect(result).toBe("SIMPLE");
  });

  it("리포트 작성은 COMPLEX (작성 키워드 포함)", () => {
    // '작성'은 COMPLEX 키워드
    const result = detectComplexity("월별 예약 현황 리포트 작성해줘");
    expect(result).toBe("COMPLEX");
  });

  it("콘텐츠 생성은 COMPLEX", () => {
    const result = detectComplexity("골프 패키지 상세 페이지 콘텐츠 생성");
    expect(result).toBe("COMPLEX");
  });

  it("레이아웃 설계는 COMPLEX", () => {
    const result = detectComplexity("홈페이지 레이아웃 설계해줘");
    expect(result).toBe("COMPLEX");
  });

  it("코드 리뷰는 COMPLEX", () => {
    const result = detectComplexity("이 코드를 리뷰해줘 function test() {}");
    expect(result).toBe("COMPLEX");
  });

  it("200자 이상 긴 텍스트는 MODERATE 이상", () => {
    const longText = "a".repeat(201);
    const result = detectComplexity(longText);
    expect(["MODERATE", "COMPLEX"]).toContain(result);
  });

  it("500자 이상 매우 긴 텍스트는 COMPLEX", () => {
    const veryLongText = "a".repeat(501);
    const result = detectComplexity(veryLongText);
    expect(result).toBe("COMPLEX");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getModelPricing 테스트
// ────────────────────────────────────────────────────────────────────────────

describe("getModelPricing", () => {
  it("3개 복잡도(SIMPLE, MODERATE, COMPLEX)에 대한 가격 정보 반환", () => {
    const pricing = getModelPricing();
    expect(pricing.length).toBeGreaterThanOrEqual(3);
    const complexities = pricing.map((p) => p.complexity);
    expect(complexities).toContain("SIMPLE");
    expect(complexities).toContain("MODERATE");
    expect(complexities).toContain("COMPLEX");
  });

  it("각 모델에 id, name, complexity, inputPricePerMillion, outputPricePerMillion 필드 포함", () => {
    const pricing = getModelPricing();
    for (const model of pricing) {
      expect(model).toHaveProperty("id");
      expect(model).toHaveProperty("name");
      expect(model).toHaveProperty("complexity");
      expect(model).toHaveProperty("inputPricePerMillion");
      expect(model).toHaveProperty("outputPricePerMillion");
    }
  });

  it("SIMPLE 모델의 입력 단가는 COMPLEX보다 저렴", () => {
    const pricing = getModelPricing();
    const simple = pricing.find((p) => p.complexity === "SIMPLE");
    const complex = pricing.find((p) => p.complexity === "COMPLEX");
    expect(simple).toBeDefined();
    expect(complex).toBeDefined();
    expect(simple!.inputPricePerMillion).toBeLessThan(complex!.inputPricePerMillion);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 캐시 테스트
// ────────────────────────────────────────────────────────────────────────────

describe("캐시 관리", () => {
  beforeEach(() => {
    clearCache();
  });

  it("clearCache 후 캐시 크기는 0", () => {
    const stats = getCacheStats();
    expect(stats.size).toBe(0);
  });

  it("getCacheStats는 size와 keys 필드 반환", () => {
    const stats = getCacheStats();
    expect(stats).toHaveProperty("size");
    expect(stats).toHaveProperty("keys");
    expect(Array.isArray(stats.keys)).toBe(true);
  });
});
