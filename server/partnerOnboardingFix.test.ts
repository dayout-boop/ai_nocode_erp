import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * #4 검증: 랜딩 가입 CTA 진입점이 구글 인증 경로로 고정돼 있어야 한다.
 * (모든 "무료로 시작하기/지금 시작하기" 버튼이 단일 진입점을 공유하는지 보장)
 */
describe("파트너 가입 진입점(cta.ts)", () => {
  const ctaSource = readFileSync(
    path.resolve(__dirname, "../client/src/pages/PartnerLanding/cta.ts"),
    "utf-8",
  );

  it("PARTNER_SIGNUP_ENTRY는 구글 인증 엔드포인트로 시작한다", () => {
    expect(ctaSource).toContain("/api/partner/auth/google");
  });

  it("구글 인증 후 onboarding-chat으로 돌아오도록 returnUrl이 설정돼 있다", () => {
    expect(ctaSource).toContain("/partner/onboarding-chat");
  });

  it("기존 파트너 로그인 페이지 상수가 보존돼 있다", () => {
    expect(ctaSource).toContain("/partner/login");
  });
});

/**
 * #2/#3 검증: 핵심 파트너(김주현·글로벌투어)가 테넌트와 양방향 연결되고
 * 활성 상태이며 로그인 가능(비밀번호 해시 존재)해야 한다.
 * DATABASE_URL이 없는 CI 환경에서는 안전하게 skip 한다.
 */
const hasDb = !!process.env.DATABASE_URL;

(hasDb ? describe : describe.skip)("파트너↔테넌트 연결 무결성", () => {
  const expectations = [
    { partnerId: 180001, tenantId: 1003, label: "김주현여행사" },
    { partnerId: 150003, tenantId: 1001, label: "글로벌투어" },
  ];

  it("핵심 파트너가 테넌트와 양방향 연결·활성·로그인 가능 상태다", async () => {
    const conn = await mysql.createConnection(process.env.DATABASE_URL as string);
    try {
      for (const exp of expectations) {
        const [pRows] = await conn.query(
          "SELECT tenantId, isActive, (loginPwHash IS NOT NULL) AS hasPw FROM partners WHERE id = ?",
          [exp.partnerId],
        );
        const partner = (pRows as any[])[0];
        expect(partner, `partner ${exp.label}`).toBeDefined();
        expect(partner.tenantId).toBe(exp.tenantId);
        expect(Number(partner.isActive)).toBe(1);
        expect(Number(partner.hasPw)).toBe(1);

        const [tRows] = await conn.query(
          "SELECT partnerId FROM tenants WHERE id = ?",
          [exp.tenantId],
        );
        const tenant = (tRows as any[])[0];
        expect(tenant, `tenant ${exp.tenantId}`).toBeDefined();
        expect(tenant.partnerId).toBe(exp.partnerId);
      }
    } finally {
      await conn.end();
    }
  });
});
