/**
 * devContext.unify.test.ts
 * 개발이력 3개 섬 일원화 + 통합 기능카탈로그 강제주입 회귀 테스트
 * - 모든 LLM 개발 경로(A 채팅 / B 코드생성 / 탈마누스 / 마누스)가 공통으로 사용하는
 *   buildDogolfDevContext() 가 기존 구조를 인지시키고 중복 DB 를 차단하는지 검증한다.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getExistingTableNames,
  checkTableDuplication,
  buildDogolfDevContext,
  resetDevContextCache,
} from "./services/devContext";

describe("devContext — 통합 기능카탈로그 동적 추출", () => {
  beforeEach(() => resetDevContextCache());

  it("drizzle/schema.ts 에서 기존 테이블을 다수 추출한다", () => {
    const tables = getExistingTableNames();
    expect(Array.isArray(tables)).toBe(true);
    // 마이그레이션 이후 80개 이상 테이블 존재
    expect(tables.length).toBeGreaterThan(50);
  });

  it("핵심 정본 테이블(reservations/bookings/tenants/affiliates/partners)이 카탈로그에 포함된다", () => {
    const tables = getExistingTableNames();
    for (const t of ["reservations", "bookings", "tenants", "affiliates", "partners"]) {
      expect(tables, `${t} 누락`).toContain(t);
    }
  });

  it("2계층 매핑 테이블(tenant_affiliates/tenant_partners)이 카탈로그에 포함된다", () => {
    const tables = getExistingTableNames();
    expect(tables).toContain("tenant_affiliates");
    expect(tables).toContain("tenant_partners");
  });
});

describe("devContext — 중복 DB 생성 차단 가드", () => {
  beforeEach(() => resetDevContextCache());

  it("기존 테이블명과 정확히 같으면 중복으로 판정한다", () => {
    const r = checkTableDuplication("reservations");
    expect(r.duplicate).toBe(true);
    expect(r.exact).toBe(true);
  });

  it("단/복수형 변형(reservation vs reservations)도 유사 중복으로 잡는다", () => {
    const r = checkTableDuplication("reservation");
    expect(r.duplicate).toBe(true);
    expect(r.similar).toContain("reservations");
  });

  it("booking → bookings 유사 중복을 감지한다", () => {
    const r = checkTableDuplication("booking");
    expect(r.duplicate).toBe(true);
    expect(r.similar).toContain("bookings");
  });

  it("완전히 새로운 테이블명은 중복이 아니다", () => {
    const r = checkTableDuplication("xyzzy_brand_new_feature_table");
    expect(r.duplicate).toBe(false);
    expect(r.exact).toBe(false);
    expect(r.similar).toEqual([]);
  });
});

describe("devContext — 통합 컨텍스트 주입 내용", () => {
  beforeEach(() => resetDevContextCache());

  it("중복 개발 금지 / 멀티테넌트 / 구신 DB 분리 핵심 규칙을 포함한다", () => {
    const ctx = buildDogolfDevContext();
    expect(ctx).toContain("중복 개발 금지");
    expect(ctx).toContain("멀티테넌트");
    expect(ctx).toContain("reservations(구)");
    expect(ctx).toContain("bookings(신)");
    // 자금 5종 부모 종속 규칙
    expect(ctx).toContain("자금 5종");
  });

  it("기존 테이블 카탈로그 목록을 본문에 실제로 포함한다", () => {
    const ctx = buildDogolfDevContext();
    expect(ctx).toContain("기존 DB 테이블 카탈로그");
    expect(ctx).toContain("reservations");
    expect(ctx).toContain("tenants");
  });

  it("동일 입력에 대해 캐시된 동일 문자열을 반환한다(성능)", () => {
    const a = buildDogolfDevContext();
    const b = buildDogolfDevContext();
    expect(a).toBe(b);
  });
});
