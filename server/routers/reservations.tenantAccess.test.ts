/**
 * 예약 테넌트 격리 접근 판정 테스트
 * ------------------------------------------------------------------
 * evaluateTenantAccess: 예약 행의 소유 테넌트와 세션 컨텍스트 테넌트를
 * 비교해 삭제/수정 접근 가부를 판정한다.
 *
 * 배경 결함(P1): reservations.delete 가 adminProcedure 로 막혀
 * 파트너가 자사 예약조차 삭제할 수 없었음. partnerProcedure + 테넌트
 * 가드로 전환하면서, 가드 분기 로직을 순수 함수로 추출해 고정한다.
 */
import { describe, it, expect } from "vitest";
import { evaluateTenantAccess } from "./reservations";

describe("evaluateTenantAccess — 예약 테넌트 격리 접근 판정", () => {
  it("마스터 세션(ctxTenantId=null)은 어떤 테넌트 행이든 허용", () => {
    expect(evaluateTenantAccess(1, null)).toBe("ok");
    expect(evaluateTenantAccess(999, null)).toBe("ok");
    expect(evaluateTenantAccess(null, null)).toBe("ok");
    expect(evaluateTenantAccess(undefined, null)).toBe("ok");
  });

  it("파트너 세션은 자사 테넌트 예약을 허용한다", () => {
    expect(evaluateTenantAccess(5, 5)).toBe("ok");
  });

  it("파트너 세션은 다른 테넌트 예약을 거부한다", () => {
    expect(evaluateTenantAccess(7, 5)).toBe("forbidden");
  });

  it("파트너 세션에서 행이 없거나 테넌트가 비어 있으면 not_found", () => {
    expect(evaluateTenantAccess(null, 5)).toBe("not_found");
    expect(evaluateTenantAccess(undefined, 5)).toBe("not_found");
  });

  it("테넌트 ID 0(falsy 경계값)도 정상 비교한다", () => {
    // ctxTenantId가 0인 경우 == null 비교에 걸리지 않아야 함
    expect(evaluateTenantAccess(0, 0)).toBe("ok");
    expect(evaluateTenantAccess(1, 0)).toBe("forbidden");
  });
});
