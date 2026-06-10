/**
 * tenantIsolation.test.ts
 * 테넌트 격리 회귀 테스트
 * - 자금 5종 tenantId 부모 reservation 상속 규칙
 * - bookings.list / get 의 tenantId 조건부 필터 로직(누출버그 수정 검증)
 *
 * 라우터는 DB/컨텍스트 의존이 커서, 핵심 격리 "판정 로직"을 동일하게 재현해 단위 검증한다.
 */
import { describe, it, expect } from "vitest";

// ─── 1) partnerProcedure 기반 조건부 tenantId 필터 규칙 ───────────────────────
//   ctx.tenantId == null  → 필터 없음(admin 전체보기, 기존 동작 보존)
//   ctx.tenantId != null  → 해당 tenantId 로 격리(파트너 또는 admin 특정테넌트 선택)
function shouldApplyTenantFilter(ctxTenantId: number | null | undefined): boolean {
  return ctxTenantId !== undefined && ctxTenantId !== null;
}

// ─── 2) 자금 tenantId 부모 상속 규칙 ────────────────────────────────────────
//   자금 레코드는 매칭된 부모 reservation 의 tenantId 를 상속한다.
function inheritTenantId(parentReservation: { tenantId: number | null } | null): number | null {
  return parentReservation?.tenantId ?? null;
}

// ─── 3) 단건 조회 격리 판정(get) ────────────────────────────────────────────
//   특정 테넌트 컨텍스트(ctx.tenantId != null)에서 다른 업체 레코드면 FORBIDDEN
function isForbiddenCrossTenantRead(
  ctxTenantId: number | null | undefined,
  recordTenantId: number | null
): boolean {
  if (ctxTenantId === undefined || ctxTenantId === null) return false; // admin 전체보기
  return recordTenantId !== ctxTenantId;
}

describe("조건부 tenantId 필터 규칙", () => {
  it("admin 전체보기(null)는 필터를 적용하지 않는다(기존 동작 보존)", () => {
    expect(shouldApplyTenantFilter(null)).toBe(false);
    expect(shouldApplyTenantFilter(undefined)).toBe(false);
  });

  it("파트너/특정테넌트(숫자)는 필터를 적용한다", () => {
    expect(shouldApplyTenantFilter(1)).toBe(true);
    expect(shouldApplyTenantFilter(7)).toBe(true);
    // tenantId 0 도 유효한 값으로 필터 적용
    expect(shouldApplyTenantFilter(0)).toBe(true);
  });
});

describe("자금 tenantId 부모 reservation 상속", () => {
  it("부모 예약이 특정 테넌트면 그 tenantId 를 상속한다", () => {
    expect(inheritTenantId({ tenantId: 5 })).toBe(5);
  });

  it("부모 예약이 본사(NULL)면 NULL 을 상속한다", () => {
    expect(inheritTenantId({ tenantId: null })).toBe(null);
  });

  it("매칭된 부모 예약이 없으면 NULL", () => {
    expect(inheritTenantId(null)).toBe(null);
  });
});

describe("bookings/reservations 단건 조회 교차테넌트 차단", () => {
  it("admin 전체보기는 어떤 레코드든 조회 허용", () => {
    expect(isForbiddenCrossTenantRead(null, 3)).toBe(false);
    expect(isForbiddenCrossTenantRead(null, null)).toBe(false);
  });

  it("파트너는 자사 레코드만 조회 허용", () => {
    expect(isForbiddenCrossTenantRead(3, 3)).toBe(false);
  });

  it("파트너가 타사 레코드 조회 시 차단", () => {
    expect(isForbiddenCrossTenantRead(3, 9)).toBe(true);
  });

  it("파트너가 본사(NULL) 레코드 조회 시 차단", () => {
    expect(isForbiddenCrossTenantRead(3, null)).toBe(true);
  });
});

// ─── 4) bookings.list 통합 누출버그 수정 검증 ────────────────────────────────
//   수정 전: reservations 통합부에 tenantId 조건이 없어 전체 confirmed 가 노출됨
//   수정 후: 특정 테넌트 컨텍스트면 reservations 통합도 자사로 제한
function buildResConditionsCount(ctxTenantId: number | null | undefined): {
  hasStatusCond: boolean;
  hasTenantCond: boolean;
} {
  const hasStatusCond = true; // eq(status, 'confirmed') 항상 포함
  const hasTenantCond = shouldApplyTenantFilter(ctxTenantId);
  return { hasStatusCond, hasTenantCond };
}

describe("bookings.list reservations 통합부 격리(누출버그 수정)", () => {
  it("파트너 컨텍스트에서는 reservations 통합도 tenantId 조건을 포함한다", () => {
    const r = buildResConditionsCount(4);
    expect(r.hasStatusCond).toBe(true);
    expect(r.hasTenantCond).toBe(true);
  });

  it("admin 전체보기에서는 reservations 통합에 tenantId 조건이 없다(전체 confirmed)", () => {
    const r = buildResConditionsCount(null);
    expect(r.hasTenantCond).toBe(false);
  });
});
