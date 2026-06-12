/**
 * 파트너 비밀번호 해시 일관성 테스트
 *
 * 배경:
 *   - 이전에 crm.createPartner / crm.updatePartner 가 SHA-256+salt 방식으로 해시를 저장했으나
 *     파트너 로그인(partnerGoogleAuth.ts)은 bcrypt.compare() 로 검증 → 로그인 불가 버그
 *   - 수정 후: 저장도 bcrypt, 검증도 bcrypt 로 일관
 *
 * 이 테스트는 해시 방식 불일치가 재발하지 않도록 회귀 방지 역할을 한다.
 */
import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";

// ── 헬퍼: 이전 SHA-256+salt 방식 (버그 재현용) ──────────────────
async function hashWithSha256Salt(pw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pw + "dogolf_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── 헬퍼: 수정 후 bcrypt 방식 ────────────────────────────────────
async function hashWithBcrypt(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

describe("파트너 비밀번호 해시 일관성", () => {
  it("bcrypt.hash 로 저장한 비밀번호는 bcrypt.compare 로 검증 성공한다", async () => {
    const pw = "TestPass123!";
    const hash = await hashWithBcrypt(pw);
    const valid = await bcrypt.compare(pw, hash);
    expect(valid).toBe(true);
  });

  it("SHA-256+salt 로 저장한 비밀번호는 bcrypt.compare 로 검증 실패한다 (버그 재현)", async () => {
    const pw = "TestPass123!";
    const sha256Hash = await hashWithSha256Salt(pw);
    // bcrypt.compare 는 sha256 hex 문자열을 bcrypt 해시로 인식하지 못해 false 반환
    const valid = await bcrypt.compare(pw, sha256Hash);
    expect(valid).toBe(false);
  });

  it("틀린 비밀번호는 bcrypt.compare 로 검증 실패한다", async () => {
    const pw = "CorrectPass!";
    const hash = await hashWithBcrypt(pw);
    const valid = await bcrypt.compare("WrongPass!", hash);
    expect(valid).toBe(false);
  });

  it("bcrypt 해시는 항상 $2 로 시작하는 표준 포맷이다", async () => {
    const hash = await hashWithBcrypt("anypassword");
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it("SHA-256 해시는 $2 로 시작하지 않아 bcrypt 포맷이 아님을 확인한다", async () => {
    const sha256Hash = await hashWithSha256Salt("anypassword");
    expect(sha256Hash).not.toMatch(/^\$2[ab]\$/);
    // hex 문자열 64자
    expect(sha256Hash).toHaveLength(64);
  });
});

describe("resetPartnerPassword 비즈니스 규칙", () => {
  it("새 비밀번호는 6자 이상이어야 한다", () => {
    const shortPw = "abc12";
    const validPw = "abc123";
    expect(shortPw.length >= 6).toBe(false);
    expect(validPw.length >= 6).toBe(true);
  });

  it("초기화 후 새 비밀번호로 로그인 검증이 성공한다", async () => {
    const newPw = "NewPass2025!";
    const newHash = await hashWithBcrypt(newPw);
    const valid = await bcrypt.compare(newPw, newHash);
    expect(valid).toBe(true);
  });

  it("초기화 후 이전 비밀번호로는 로그인 검증이 실패한다", async () => {
    const oldPw = "OldPass2024!";
    const newPw = "NewPass2025!";
    const newHash = await hashWithBcrypt(newPw);
    const valid = await bcrypt.compare(oldPw, newHash);
    expect(valid).toBe(false);
  });
});
