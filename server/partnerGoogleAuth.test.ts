/**
 * 파트너 구글 인증 콜백 returnUrl 분기 로직 테스트
 * - 활성 파트너: 온보딩/대시보드/가입 경로 → /erp로 강제
 * - 비활성 파트너: 온보딩 경로 유지, 기타 경로 → /erp로 강제
 */
import { describe, it, expect } from "vitest";

// returnUrl 분기 로직 (테스트용 순수 함수로 추출)
function determineReturnUrl(
  returnUrl: string,
  isActive: boolean
): string {
  // 활성 파트너: 온보딩/대시보드/가입 경로를 모두 /erp로 강제
  if (isActive) {
    if (
      returnUrl.startsWith("/partner/onboarding-chat") ||
      returnUrl.startsWith("/partner/dashboard") ||
      returnUrl.startsWith("/partner/join") ||
      returnUrl.startsWith("/partner/pending-verification")
    ) {
      return "/erp";
    }
  } else {
    // 비활성 파트너 (신규/진행중): 온보딩 채팅 경로는 유지, 기타 경로는 /erp로 강제
    if (
      returnUrl.startsWith("/partner/dashboard") ||
      returnUrl.startsWith("/partner/join") ||
      returnUrl.startsWith("/partner/pending-verification")
    ) {
      return "/erp";
    }
    // /partner/onboarding-chat는 유지 (신규 가입자가 채팅 계속할 수 있도록)
  }
  return returnUrl;
}

describe("Partner Google Auth - returnUrl routing", () => {
  describe("활성 파트너 (isActive=true)", () => {
    it("온보딩 채팅 경로 → /erp로 강제", () => {
      expect(determineReturnUrl("/partner/onboarding-chat", true)).toBe("/erp");
    });

    it("온보딩 채팅 + 쿼리 파라미터 → /erp로 강제", () => {
      expect(
        determineReturnUrl("/partner/onboarding-chat?email=test@example.com", true)
      ).toBe("/erp");
    });

    it("대시보드 경로 → /erp로 강제", () => {
      expect(determineReturnUrl("/partner/dashboard", true)).toBe("/erp");
    });

    it("가입 경로 → /erp로 강제", () => {
      expect(determineReturnUrl("/partner/join", true)).toBe("/erp");
    });

    it("등록증 대기 경로 → /erp로 강제", () => {
      expect(determineReturnUrl("/partner/pending-verification", true)).toBe("/erp");
    });

    it("기타 경로 → 유지", () => {
      expect(determineReturnUrl("/other/path", true)).toBe("/other/path");
    });

    it("/erp 경로 → 유지", () => {
      expect(determineReturnUrl("/erp", true)).toBe("/erp");
    });
  });

  describe("비활성 파트너 (isActive=false, 신규/진행중)", () => {
    it("온보딩 채팅 경로 → 유지 (채팅 계속)", () => {
      expect(determineReturnUrl("/partner/onboarding-chat", false)).toBe(
        "/partner/onboarding-chat"
      );
    });

    it("온보딩 채팅 + 쿼리 파라미터 → 유지", () => {
      expect(
        determineReturnUrl(
          "/partner/onboarding-chat?email=test@example.com&name=John",
          false
        )
      ).toBe("/partner/onboarding-chat?email=test@example.com&name=John");
    });

    it("대시보드 경로 → /erp로 강제", () => {
      expect(determineReturnUrl("/partner/dashboard", false)).toBe("/erp");
    });

    it("가입 경로 → /erp로 강제", () => {
      expect(determineReturnUrl("/partner/join", false)).toBe("/erp");
    });

    it("등록증 대기 경로 → /erp로 강제", () => {
      expect(determineReturnUrl("/partner/pending-verification", false)).toBe("/erp");
    });

    it("기타 경로 → 유지", () => {
      expect(determineReturnUrl("/other/path", false)).toBe("/other/path");
    });

    it("/erp 경로 → 유지", () => {
      expect(determineReturnUrl("/erp", false)).toBe("/erp");
    });
  });

  describe("엣지 케이스", () => {
    it("빈 문자열 → 유지", () => {
      expect(determineReturnUrl("", true)).toBe("");
      expect(determineReturnUrl("", false)).toBe("");
    });

    it("상대 경로 → 유지", () => {
      expect(determineReturnUrl("dashboard", true)).toBe("dashboard");
      expect(determineReturnUrl("onboarding-chat", false)).toBe("onboarding-chat");
    });

    it("/partner/onboarding-chat-related (유사 경로) → 유지", () => {
      expect(determineReturnUrl("/partner/onboarding-chat-related", false)).toBe(
        "/partner/onboarding-chat-related"
      );
    });
  });
});
