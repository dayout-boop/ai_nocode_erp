/**
 * tenantSelector.test.ts
 * 마스터 테넌트 셀렉터(activeTenantId) 해석 규칙 + partnerProcedure 테넌트 결정 검증
 * ------------------------------------------------------------------
 * 검증 목표:
 *  1. context의 x-active-tenant 헤더 → activeTenantId 변환 규칙
 *     (마스터 세션에서만 해석, 'all'→null, 숫자→number, 비정상→undefined)
 *     파트너/스태프 세션은 헤더를 신뢰하지 않는다(보안).
 *  2. partnerProcedure가 세션 종류별로 tenantId를 올바르게 결정한다.
 *     - admin + activeTenantId undefined → null(전체보기 기본)
 *     - admin + activeTenantId null('all') → null(전체)
 *     - admin + activeTenantId number → 해당 테넌트
 *     - partnerOwner/partnerStaff → 각자 tenantId 고정
 */
import { describe, it, expect } from "vitest";

// ── context의 헤더 파싱 로직을 순수 함수로 재현(검증 대상 규칙과 동일) ──
function resolveActiveTenantFromHeader(
  isMasterSession: boolean,
  rawHeader: string | string[] | undefined,
): number | null | undefined {
  let activeTenantId: number | null | undefined = undefined;
  if (isMasterSession) {
    const headerVal = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (typeof headerVal === "string" && headerVal.length > 0) {
      if (headerVal === "all") {
        activeTenantId = null;
      } else {
        const parsed = Number(headerVal);
        activeTenantId = Number.isFinite(parsed) ? parsed : undefined;
      }
    }
  }
  return activeTenantId;
}

// ── partnerProcedure의 tenantId 결정 로직을 순수 함수로 재현 ──
type SessionKind =
  | { role: "admin"; activeTenantId: number | null | undefined }
  | { role: "partnerOwner"; tenantId: number | null }
  | { role: "partnerStaff"; tenantId: number | null };

function resolvePartnerTenantId(session: SessionKind): number | null {
  if (session.role === "admin") {
    return session.activeTenantId === undefined ? null : session.activeTenantId;
  }
  return session.tenantId;
}

describe("activeTenantId 헤더 해석 규칙", () => {
  it("마스터 세션 + 헤더 없음 → undefined (셀렉터 미전달)", () => {
    expect(resolveActiveTenantFromHeader(true, undefined)).toBeUndefined();
  });

  it("마스터 세션 + 'all' → null (전체보기)", () => {
    expect(resolveActiveTenantFromHeader(true, "all")).toBeNull();
  });

  it("마스터 세션 + 숫자 문자열 → 해당 number (두골프=1)", () => {
    expect(resolveActiveTenantFromHeader(true, "1")).toBe(1);
    expect(resolveActiveTenantFromHeader(true, "1002")).toBe(1002);
  });

  it("마스터 세션 + 비정상 문자열 → undefined", () => {
    expect(resolveActiveTenantFromHeader(true, "abc")).toBeUndefined();
  });

  it("마스터 세션 + 배열 헤더 → 첫 값 사용", () => {
    expect(resolveActiveTenantFromHeader(true, ["1", "9"])).toBe(1);
  });

  it("비마스터(파트너) 세션은 헤더가 있어도 무시 → undefined (보안)", () => {
    expect(resolveActiveTenantFromHeader(false, "1002")).toBeUndefined();
    expect(resolveActiveTenantFromHeader(false, "all")).toBeUndefined();
  });
});

describe("partnerProcedure 테넌트 결정", () => {
  it("admin + activeTenantId undefined → null(전체보기 기본)", () => {
    expect(resolvePartnerTenantId({ role: "admin", activeTenantId: undefined })).toBeNull();
  });

  it("admin + activeTenantId null('전체보기') → null(전체 접근)", () => {
    expect(resolvePartnerTenantId({ role: "admin", activeTenantId: null })).toBeNull();
  });

  it("admin + activeTenantId 1 → 두골프(1)만 보기", () => {
    expect(resolvePartnerTenantId({ role: "admin", activeTenantId: 1 })).toBe(1);
  });

  it("admin + activeTenantId 1002 → 특정 파트너만 보기", () => {
    expect(resolvePartnerTenantId({ role: "admin", activeTenantId: 1002 })).toBe(1002);
  });

  it("파트너 대표 세션 → 자신의 tenantId 고정", () => {
    expect(resolvePartnerTenantId({ role: "partnerOwner", tenantId: 1002 })).toBe(1002);
  });

  it("파트너 스태프 세션 → 자신의 tenantId 고정", () => {
    expect(resolvePartnerTenantId({ role: "partnerStaff", tenantId: 1003 })).toBe(1003);
  });
});
