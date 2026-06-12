import { describe, it, expect } from "vitest";
import {
  normalizeBizNumber,
  isValidBizNumber,
  formatBizNumber,
} from "../shared/businessNumber";

/**
 * 사업자등록번호 = 테넌트 식별의 유일 기준이므로,
 * 정규화/검증/포맷이 일관되게 동작하는지 회귀 테스트로 고정한다.
 */
describe("normalizeBizNumber", () => {
  it("하이픈을 제거하고 숫자만 남긴다", () => {
    expect(normalizeBizNumber("123-45-67890")).toBe("1234567890");
  });

  it("공백/문자/기타 기호를 모두 제거한다", () => {
    expect(normalizeBizNumber(" 123 45 67890 ")).toBe("1234567890");
    expect(normalizeBizNumber("사업자: 123.45.67890")).toBe("1234567890");
  });

  it("null/undefined/빈 문자열은 빈 문자열을 반환한다", () => {
    expect(normalizeBizNumber(null)).toBe("");
    expect(normalizeBizNumber(undefined)).toBe("");
    expect(normalizeBizNumber("")).toBe("");
  });

  it("표기만 다른 동일 사업자번호는 정규화 후 동일해진다 (중복 테넌트 방지 핵심)", () => {
    const a = normalizeBizNumber("123-45-67890");
    const b = normalizeBizNumber("1234567890");
    const c = normalizeBizNumber("123 45 67890");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe("isValidBizNumber", () => {
  it("정규화 후 정확히 10자리여야 유효하다", () => {
    expect(isValidBizNumber("123-45-67890")).toBe(true);
    expect(isValidBizNumber("1234567890")).toBe(true);
  });

  it("자릿수가 부족하거나 초과하면 무효다", () => {
    expect(isValidBizNumber("123-45-678")).toBe(false); // 9자리
    expect(isValidBizNumber("123456789012")).toBe(false); // 12자리
    expect(isValidBizNumber("")).toBe(false);
    expect(isValidBizNumber(null)).toBe(false);
  });
});

describe("formatBizNumber", () => {
  it("10자리는 XXX-XX-XXXXX로 포맷한다", () => {
    expect(formatBizNumber("1234567890")).toBe("123-45-67890");
    expect(formatBizNumber("123-45-67890")).toBe("123-45-67890");
  });

  it("10자리가 아니면 정규화된 원본을 그대로 반환한다", () => {
    expect(formatBizNumber("12345")).toBe("12345");
    expect(formatBizNumber("")).toBe("");
  });
});
