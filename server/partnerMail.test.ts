import { describe, expect, it } from "vitest";
import {
  buildWelcomeEmail,
  buildApprovedEmail,
  buildRejectedEmail,
} from "./partnerMail";

describe("파트너 메일 템플릿", () => {
  it("환영 메일: 담당자명/업체명/로그인 링크 포함", () => {
    const m = buildWelcomeEmail({ to: "a@b.com", companyName: "두골프투어", contactName: "홍길동", onboardingId: 1 });
    expect(m.subject).toContain("환영");
    expect(m.html).toContain("홍길동");
    expect(m.html).toContain("두골프투어");
    expect(m.html).toContain("/partner/login");
    expect(m.text).toContain("홍길동");
  });

  it("승인 메일: '승인' 문구 + 로그인 링크 포함", () => {
    const m = buildApprovedEmail({ to: "a@b.com", companyName: "두골프투어", contactName: "김담당" });
    expect(m.subject).toContain("승인");
    expect(m.html).toContain("승인");
    expect(m.html).toContain("/partner/login");
  });

  it("거부 메일: 사유 명시 시 본문에 사유 포함", () => {
    const m = buildRejectedEmail({ to: "a@b.com", companyName: "X여행", reason: "사업자등록증 사본이 흐립니다" });
    expect(m.subject).toContain("심사 결과");
    expect(m.html).toContain("사업자등록증 사본이 흐립니다");
    expect(m.text).toContain("사업자등록증 사본이 흐립니다");
  });

  it("거부 메일: 사유 미지정 시 기본 안내 문구로 대체", () => {
    const m = buildRejectedEmail({ to: "a@b.com", companyName: "X여행" });
    expect(m.html).toContain("승인이 보류");
  });

  it("연락처/담당자 미지정 시 '파트너'로 대체되어 깨지지 않는다", () => {
    const m = buildWelcomeEmail({ to: "a@b.com" });
    expect(m.html).toContain("파트너");
    expect(m.subject).toBeTruthy();
  });

  it("모든 템플릿은 완결된 HTML 문서를 반환한다", () => {
    for (const m of [
      buildWelcomeEmail({ to: "a@b.com" }),
      buildApprovedEmail({ to: "a@b.com" }),
      buildRejectedEmail({ to: "a@b.com" }),
    ]) {
      expect(m.html).toContain("<!DOCTYPE html>");
      expect(m.html).toContain("</html>");
    }
  });
});
