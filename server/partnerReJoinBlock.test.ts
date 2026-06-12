import { describe, it, expect } from "vitest";
import { normalizeBizNumber } from "../shared/businessNumber";

/**
 * 활성 사업자번호 재가입 차단 정책 회귀 테스트
 *
 * 정책(확정):
 * - 차단 기준 = "활성화된 테넌트(tenants.isActive=true) 보유 여부".
 * - 테넌트 미활성(가입 진행 중) 단계에서는 동일 사업자번호 중복 입력을 허용한다.
 * - 표기(하이픈/공백)가 달라도 정규화값이 같으면 동일 회사로 본다.
 *
 * 실제 라우터(submit / submitWithBothOcr)는 DB를 조회하므로,
 * 여기서는 차단 판정의 "기준 함수(정규화 + 활성 테넌트 매칭 시뮬레이션)"를 검증한다.
 */

/** 활성 테넌트 목록(정규화된 사업자번호 집합)을 받아 재가입 차단 여부를 판정하는 순수 함수 */
function shouldBlockRejoin(
  inputBizNumber: string | null | undefined,
  activeTenantNormalizedBizNumbers: string[]
): boolean {
  const normalized = normalizeBizNumber(inputBizNumber);
  // 사업자번호가 없으면(선택 입력 미기재) 차단 기준 자체가 없으므로 통과
  if (!normalized) return false;
  return activeTenantNormalizedBizNumbers.includes(normalized);
}

describe("활성 사업자번호 재가입 차단 정책", () => {
  const activeTenants = [
    normalizeBizNumber("123-45-67890"), // 이미 활성 테넌트 보유 회사
    normalizeBizNumber("211-88-00099"),
  ];

  it("이미 활성 테넌트를 보유한 사업자번호로 재가입하면 차단한다", () => {
    expect(shouldBlockRejoin("123-45-67890", activeTenants)).toBe(true);
  });

  it("하이픈/공백 표기가 달라도 정규화값이 같으면 동일 회사로 보고 차단한다", () => {
    expect(shouldBlockRejoin("1234567890", activeTenants)).toBe(true);
    expect(shouldBlockRejoin("123 45 67890", activeTenants)).toBe(true);
    expect(shouldBlockRejoin(" 123-45-67890 ", activeTenants)).toBe(true);
  });

  it("활성 테넌트가 없는(가입 진행 중) 사업자번호는 중복 입력을 허용한다", () => {
    // 아직 활성 테넌트가 없는 신규 사업자번호
    expect(shouldBlockRejoin("999-99-99999", activeTenants)).toBe(false);
  });

  it("사업자번호 미기재(선택 입력 공란)면 차단하지 않는다", () => {
    expect(shouldBlockRejoin("", activeTenants)).toBe(false);
    expect(shouldBlockRejoin(null, activeTenants)).toBe(false);
    expect(shouldBlockRejoin(undefined, activeTenants)).toBe(false);
  });

  it("동일 사업자번호라도 테넌트가 아직 미활성이면(활성 목록에 없음) 통과한다", () => {
    // 가입 진행 중인 회사가 테넌트를 아직 활성화하지 않은 상태를 시뮬레이션:
    // 활성 테넌트 목록에 포함되지 않았으므로 통과되어야 한다.
    const pendingBiz = normalizeBizNumber("777-77-77777");
    expect(activeTenants.includes(pendingBiz)).toBe(false);
    expect(shouldBlockRejoin("777-77-77777", activeTenants)).toBe(false);
  });
});
