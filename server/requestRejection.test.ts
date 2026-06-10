import { describe, it, expect } from "vitest";
import { checkRequestForBlockedKeywords } from "./services/knowledgeFilter";

describe("[Phase 3] checkRequestForBlockedKeywords — 타 데스크 키워드 요청 거절", () => {
  it("타 데스크 키워드(GitHub 연동)가 포함된 요청은 거절한다", () => {
    const r = checkRequestForBlockedKeywords("GitHub 연동 원칙에 따라 실시간 반영 최우선으로 처리해줘");
    expect(r.rejected).toBe(true);
    expect(r.matchedKeywords.length).toBeGreaterThan(0);
    expect(r.rejectionMessage).toContain("처리할 수 없는");
  });

  it("L-5 인가 스텁 키워드가 포함되면 거절한다", () => {
    const r = checkRequestForBlockedKeywords("외부 LLM 호출 인가 전에 L-5 인가 스텁을 배치해줘");
    expect(r.rejected).toBe(true);
    expect(r.ruleNames.length).toBeGreaterThan(0);
  });

  it("정상적인 두골프 ERP 개발 요청은 거절하지 않는다", () => {
    const r = checkRequestForBlockedKeywords("예약 목록 화면에 결제 상태 필터를 추가해줘");
    expect(r.rejected).toBe(false);
    expect(r.matchedKeywords).toEqual([]);
    expect(r.rejectionMessage).toBe("");
  });

  it("빈 문자열은 거절하지 않는다", () => {
    const r = checkRequestForBlockedKeywords("");
    expect(r.rejected).toBe(false);
  });

  it("거절 시 중복 키워드는 제거되어 반환된다", () => {
    const r = checkRequestForBlockedKeywords("IP 보호 IP 보호 IP 보호");
    expect(r.rejected).toBe(true);
    const ipCount = r.matchedKeywords.filter((k) => k === "IP 보호").length;
    expect(ipCount).toBe(1);
  });
});
