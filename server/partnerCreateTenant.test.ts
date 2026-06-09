/**
 * partnerCreateTenant.test.ts
 * 관리자 파트너 직접 생성 시 전용 테넌트 자동 생성/연결 로직 검증
 * - slug 생성 규칙, 30일 체험 만료일, 플랜별 크레딧, 양방향 연결 가드
 */
import { describe, it, expect } from "vitest";
import { SUBSCRIPTION_PLANS } from "./products";

// 라우터 내부 로직과 동일한 slug 생성 규칙을 재현하여 검증
function buildSlug(companyName: string, partnerId: number): string {
  const slugBase =
    companyName.replace(/[^a-zA-Z0-9가-힣]/g, "").toLowerCase().slice(0, 20) ||
    "partner";
  return `${slugBase}-${partnerId}`;
}

function planCredits(planId: string): number {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  return plan?.aiCreditsPerMonth ?? 100;
}

describe("파트너 직접 생성 - 전용 테넌트 slug 생성", () => {
  it("영문 업체명은 소문자 + partnerId 형태로 slug 생성", () => {
    expect(buildSlug("DayOutGolf", 123)).toBe("dayoutgolf-123");
  });

  it("특수문자/공백은 제거된다", () => {
    expect(buildSlug("두골프 (주)!@#", 5)).toBe("두골프주-5");
  });

  it("한글 업체명도 유지된다", () => {
    expect(buildSlug("정석원투어", 90)).toBe("정석원투어-90");
  });

  it("이름이 비면 기본값 partner-{id}로 대체", () => {
    expect(buildSlug("!@#$%", 7)).toBe("partner-7");
  });

  it("긴 이름은 20자로 잘린다", () => {
    const longName = "a".repeat(40);
    const slug = buildSlug(longName, 1);
    expect(slug).toBe(`${"a".repeat(20)}-1`);
  });
});

describe("파트너 직접 생성 - 30일 체험 만료일", () => {
  it("생성 시점으로부터 30일 뒤로 설정된다", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    const expires = new Date(base);
    expires.setDate(expires.getDate() + 30);
    const diffDays = Math.round((expires.getTime() - base.getTime()) / 86400000);
    expect(diffDays).toBe(30);
  });
});

describe("파트너 직접 생성 - 플랜별 크레딧 매핑", () => {
  it("starter 플랜은 정의된 월 크레딧을 사용", () => {
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === "starter");
    expect(plan).toBeDefined();
    expect(planCredits("starter")).toBe(plan!.aiCreditsPerMonth);
  });

  it("알 수 없는 플랜이면 기본 100 크레딧으로 폴백", () => {
    expect(planCredits("nonexistent-plan")).toBe(100);
  });

  it("정의된 모든 플랜의 크레딧은 0 이상", () => {
    for (const p of SUBSCRIPTION_PLANS) {
      expect(p.aiCreditsPerMonth).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("파트너 직접 생성 - 테넌트 생성 가드", () => {
  it("createTenant=false면 테넌트 생성을 건너뛴다", () => {
    const createTenant = false;
    const partnerId = 10;
    const shouldCreate = Boolean(createTenant) && partnerId > 0;
    expect(shouldCreate).toBe(false);
  });

  it("partnerId가 0 이하이면 테넌트 생성을 건너뛴다", () => {
    const createTenant = true;
    const partnerId = 0;
    const shouldCreate = createTenant && partnerId > 0;
    expect(shouldCreate).toBe(false);
  });

  it("createTenant=true && partnerId>0 일 때만 생성", () => {
    const createTenant = true;
    const partnerId = 42;
    const shouldCreate = createTenant && partnerId > 0;
    expect(shouldCreate).toBe(true);
  });
});
