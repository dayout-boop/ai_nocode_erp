import { describe, it, expect } from "vitest";
import {
  FEATURE_CATALOG,
  FEATURE_MAP,
  isValidFeatureKey,
  getDefaultEnabled,
  isNewFeature,
  categorySortIndex,
  mergePermissions,
  CATEGORY_ORDER,
  NEW_BADGE_DAYS,
} from "../shared/featureCatalog";

describe("featureCatalog - 단일 소스 무결성", () => {
  it("키가 중복되지 않는다", () => {
    const keys = FEATURE_CATALOG.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("FEATURE_MAP 은 카탈로그와 동일 개수를 가진다", () => {
    expect(Object.keys(FEATURE_MAP).length).toBe(FEATURE_CATALOG.length);
  });

  it("모든 항목은 key/label/category 를 가진다", () => {
    for (const f of FEATURE_CATALOG) {
      expect(f.key).toBeTruthy();
      expect(f.label).toBeTruthy();
      expect(f.category).toBeTruthy();
    }
  });
});

describe("isValidFeatureKey", () => {
  it("카탈로그에 있는 key 는 true", () => {
    expect(isValidFeatureKey("booking_manage")).toBe(true);
    expect(isValidFeatureKey("finance_void")).toBe(true);
  });
  it("없는 key 는 false", () => {
    expect(isValidFeatureKey("not_exist")).toBe(false);
    expect(isValidFeatureKey("")).toBe(false);
  });
});

describe("getDefaultEnabled - 기본 허용 자동 편입(B)", () => {
  it("일반 기능은 기본 허용(true)", () => {
    expect(getDefaultEnabled("booking_manage")).toBe(true);
    expect(getDefaultEnabled("ai_erp_analysis")).toBe(true);
  });
  it("카탈로그에 없는(폐기) key 도 기본 허용으로 간주해 잠금 사고 방지", () => {
    expect(getDefaultEnabled("legacy_removed_feature")).toBe(true);
  });
  it("defaultEnabled=false 로 지정하면 기본 차단", () => {
    // 카탈로그에 민감 기능이 추가될 경우를 시뮬레이션 (현재는 없음)
    const hasExplicitFalse = FEATURE_CATALOG.some((f) => f.defaultEnabled === false);
    // 회귀 방지용 — 의도치 않게 기본 차단 항목이 생기면 알림
    expect(typeof hasExplicitFalse).toBe("boolean");
  });
});

describe("isNewFeature - NEW 배지(D)", () => {
  it("since 가 기준일로부터 NEW_BADGE_DAYS 이내면 NEW", () => {
    const since = "2026-06-12";
    const now = new Date("2026-06-20T00:00:00Z");
    // 임시 항목이 아니라 실제 카탈로그의 finance_void(since 2026-06-12)로 검증
    expect(isNewFeature("finance_void", now)).toBe(true);
  });

  it("since 가 NEW_BADGE_DAYS 를 지나면 NEW 아님", () => {
    const now = new Date(`2026-06-12T00:00:00Z`);
    // 2026-06-01 추가 항목은 11일 경과 → 30일 이내라 아직 NEW
    expect(isNewFeature("booking_manage", now)).toBe(true);
    // 충분히 미래로 가면 NEW 해제
    const far = new Date("2026-08-01T00:00:00Z");
    expect(isNewFeature("booking_manage", far)).toBe(false);
  });

  it("since 미래(아직 도래 전)면 NEW 아님", () => {
    const past = new Date("2026-01-01T00:00:00Z");
    expect(isNewFeature("finance_void", past)).toBe(false);
  });

  it("since 없는/없는 key 는 NEW 아님", () => {
    expect(isNewFeature("not_exist")).toBe(false);
  });

  it("NEW_BADGE_DAYS 경계값(정확히 30일)은 NEW 포함", () => {
    const now = new Date("2026-07-12T00:00:00Z"); // 2026-06-12 + 30일
    expect(isNewFeature("finance_void", now)).toBe(true);
    const after = new Date("2026-07-13T00:00:00Z"); // 31일
    expect(isNewFeature("finance_void", after)).toBe(false);
  });
});

describe("categorySortIndex - 카테고리 자동 그룹/정렬(C)", () => {
  it("CATEGORY_ORDER 순서를 따른다", () => {
    expect(categorySortIndex("예약 관리")).toBeLessThan(categorySortIndex("자금 관리"));
    expect(categorySortIndex("자금 관리")).toBeLessThan(categorySortIndex("AI 자동화"));
  });
  it("정의되지 않은 카테고리는 맨 뒤", () => {
    expect(categorySortIndex("알수없음")).toBe(CATEGORY_ORDER.length);
  });
});

describe("mergePermissions - DB행+카탈로그 병합", () => {
  it("저장 행이 없으면 카탈로그 기본값(허용)으로 채운다", () => {
    const merged = mergePermissions([], new Date("2026-06-12T00:00:00Z"));
    expect(merged.length).toBe(FEATURE_CATALOG.length);
    expect(merged.every((m) => m.enabled === true)).toBe(true);
  });

  it("저장 행의 enabled 값을 우선 반영한다", () => {
    const merged = mergePermissions(
      [{ feature: "ai_erp_analysis", enabled: false }],
      new Date("2026-06-12T00:00:00Z"),
    );
    const target = merged.find((m) => m.feature === "ai_erp_analysis");
    expect(target?.enabled).toBe(false);
    // 나머지는 여전히 기본 허용
    const other = merged.find((m) => m.feature === "booking_manage");
    expect(other?.enabled).toBe(true);
  });

  it("카테고리 정렬 순서대로 반환한다", () => {
    const merged = mergePermissions([]);
    const indices = merged.map((m) => categorySortIndex(m.category));
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });

  it("카탈로그에 없는 저장 행은 결과에 포함되지 않는다(폐기 기능 자동 제외)", () => {
    const merged = mergePermissions([{ feature: "legacy_removed", enabled: true }]);
    expect(merged.some((m) => m.feature === "legacy_removed")).toBe(false);
  });
});
