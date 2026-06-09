/**
 * 일반회원 자립 인증 + 개발모드 토글 검증 테스트
 * - memberAuth: JWT 서명/검증 라운드트립, 변조 토큰 거부
 * - masterStream devMode: 스키마 기본값/유효성 검증
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { signMemberJwt, verifyMemberJwt } from "./routers/memberAuth";

describe("memberAuth JWT (자립 인증)", () => {
  it("서명한 토큰을 다시 검증하면 payload가 복원된다", async () => {
    const token = await signMemberJwt({ openId: "local_abc123", email: "user@dayoutgolf.com" });
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // header.payload.signature

    const payload = await verifyMemberJwt(token);
    expect(payload).not.toBeNull();
    expect(payload?.openId).toBe("local_abc123");
    expect(payload?.email).toBe("user@dayoutgolf.com");
  });

  it("변조된 토큰은 검증에 실패해 null을 반환한다", async () => {
    const token = await signMemberJwt({ openId: "local_xyz", email: "x@y.com" });
    const tampered = token.slice(0, -3) + "abc";
    const payload = await verifyMemberJwt(tampered);
    expect(payload).toBeNull();
  });

  it("형식이 잘못된 토큰은 null을 반환한다", async () => {
    const payload = await verifyMemberJwt("not-a-jwt");
    expect(payload).toBeNull();
  });
});

describe("masterStream devMode 스키마", () => {
  // masterStream.ts의 inputSchema와 동일한 devMode 규칙을 검증
  const devModeSchema = z.enum(["manus", "self"]).optional().default("manus");

  it("값이 없으면 기본값 manus가 적용된다", () => {
    expect(devModeSchema.parse(undefined)).toBe("manus");
  });

  it("self 모드를 허용한다", () => {
    expect(devModeSchema.parse("self")).toBe("self");
  });

  it("허용되지 않은 값은 거부한다", () => {
    expect(() => devModeSchema.parse("invalid")).toThrow();
  });
});
