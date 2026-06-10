import { describe, it, expect } from "vitest";
import { detectPartnerSubdomain } from "./_core/context";

describe("[Phase 6] detectPartnerSubdomain — 파트너 전용 서브도메인 감지", () => {
  it("partner.dayoutgolf.com 은 파트너 서브도메인으로 판별한다", () => {
    const r = detectPartnerSubdomain("partner.dayoutgolf.com");
    expect(r.isPartnerSubdomain).toBe(true);
    expect(r.host).toBe("partner.dayoutgolf.com");
  });

  it("포트가 붙어도 정상 판별한다", () => {
    const r = detectPartnerSubdomain("partner.dayoutgolf.com:443");
    expect(r.isPartnerSubdomain).toBe(true);
    expect(r.host).toBe("partner.dayoutgolf.com");
  });

  it("대문자가 섞여도 소문자로 정규화하여 판별한다", () => {
    const r = detectPartnerSubdomain("Partner.DayOutGolf.com");
    expect(r.isPartnerSubdomain).toBe(true);
  });

  it("메인 도메인(dayoutgolf.com)은 파트너 서브도메인이 아니다", () => {
    expect(detectPartnerSubdomain("dayoutgolf.com").isPartnerSubdomain).toBe(false);
    expect(detectPartnerSubdomain("www.dayoutgolf.com").isPartnerSubdomain).toBe(false);
  });

  it("manus.space 프리뷰/기타 도메인은 파트너 서브도메인이 아니다", () => {
    expect(detectPartnerSubdomain("dogolf-tour-dkz3fsmp.manus.space").isPartnerSubdomain).toBe(false);
    expect(detectPartnerSubdomain("evil-partner.dayoutgolf.com.attacker.com").isPartnerSubdomain).toBe(false);
  });

  it("host 가 비어있거나 undefined 면 false 를 반환한다", () => {
    expect(detectPartnerSubdomain(undefined).isPartnerSubdomain).toBe(false);
    expect(detectPartnerSubdomain("").isPartnerSubdomain).toBe(false);
  });
});
