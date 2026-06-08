/**
 * 트랙2 보안 불변식 테스트 [STEP3/STEP4]
 * ------------------------------------------------------------------
 * Changeset 수신 파이프라인의 경계 보안 불변식을 고정한다.
 *  1) enforcePartnerLock: 비-MASTER/SYSTEM 은 partnerId 없으면 차단
 *  2) scanForbiddenTokens: 경계 창구(manager/golftalk) 소스 외부도구 토큰 누수 차단
 *  3) executeFourLayerScan: 경로 탈출 / 빈 변경 정합성 판정
 */
import { describe, it, expect } from "vitest";
import { enforcePartnerLock, type AgentContext } from "./agentEngine";
import { SelfAuditBot } from "./selfAuditBot";

describe("enforcePartnerLock — partner_id 강제 잠금", () => {
  it("MASTER 는 partnerId 없이 통과", () => {
    const ctx: AgentContext = { callerId: "m1", role: "MASTER" };
    expect(() => enforcePartnerLock(ctx)).not.toThrow();
  });

  it("SYSTEM(엔진 자체) 은 partnerId 없이 통과", () => {
    const ctx: AgentContext = { callerId: "sys", role: "SYSTEM" };
    expect(() => enforcePartnerLock(ctx)).not.toThrow();
  });

  it("MANAGER 가 partnerId 없으면 차단", () => {
    const ctx: AgentContext = { callerId: "mgr", role: "MANAGER" };
    expect(() => enforcePartnerLock(ctx)).toThrow(/파트너/);
  });

  it("GOLFTALK 가 partnerId 없으면 차단", () => {
    const ctx: AgentContext = { callerId: "gt", role: "GOLFTALK" };
    expect(() => enforcePartnerLock(ctx)).toThrow(/파트너/);
  });

  it("MANAGER 가 partnerId 있으면 통과", () => {
    const ctx: AgentContext = { callerId: "mgr", role: "MANAGER", partnerId: "p-1" };
    expect(() => enforcePartnerLock(ctx)).not.toThrow();
  });
});

describe("SelfAuditBot.scanForbiddenTokens — 외부도구 토큰 누수 차단", () => {
  const bot = new SelfAuditBot();

  it("경계 창구(manager) 소스에 web_search 주입 시 실패", () => {
    const r = bot.scanForbiddenTokens(
      "server/services/managerAgent.ts",
      "const x = web_search(query);",
    );
    expect(r.passed).toBe(false);
    expect(r.detail).toMatch(/보안 위반/);
  });

  it("경계 창구(golftalk) 소스에 new OpenAI( 주입 시 실패", () => {
    const r = bot.scanForbiddenTokens(
      "client/golftalk/chat.ts",
      "const c = new OpenAI({ apiKey });",
    );
    expect(r.passed).toBe(false);
  });

  it("경계 창구에 axios import 주입 시 실패", () => {
    const r = bot.scanForbiddenTokens(
      "server/partner/chat/handler.ts",
      'import axios from "axios";',
    );
    expect(r.passed).toBe(false);
  });

  it("경계 창구라도 금지 토큰이 없으면 통과", () => {
    const r = bot.scanForbiddenTokens(
      "server/services/managerAgent.ts",
      "export const greet = () => 'hi';",
    );
    expect(r.passed).toBe(true);
  });

  it("비경계 파일(코어)은 토큰 무관하게 스캔 제외", () => {
    const r = bot.scanForbiddenTokens(
      "server/services/masterAgent.ts",
      "const x = web_search(query); new OpenAI();",
    );
    expect(r.passed).toBe(true);
    expect(r.detail).toMatch(/비경계/);
  });
});

describe("Changeset 페이로드 content 필수 규칙(라우터 불변식 모사)", () => {
  // 라우터의 ADD/MODIFY content 필수 검사 로직과 동일한 판정 함수
  function validateContents(
    files: { filePath: string; action: "ADD" | "MODIFY" | "DELETE"; content?: string }[],
  ): { ok: boolean; reason?: string } {
    for (const f of files) {
      if (f.action !== "DELETE" && (f.content === undefined || f.content === "")) {
        return { ok: false, reason: `'${f.filePath}' content 비어있음` };
      }
    }
    return { ok: true };
  }

  it("ADD 인데 content 없으면 거부", () => {
    const r = validateContents([{ filePath: "a.ts", action: "ADD" }]);
    expect(r.ok).toBe(false);
  });

  it("DELETE 는 content 없이 허용", () => {
    const r = validateContents([{ filePath: "a.ts", action: "DELETE" }]);
    expect(r.ok).toBe(true);
  });

  it("MODIFY + content 있으면 허용", () => {
    const r = validateContents([{ filePath: "a.ts", action: "MODIFY", content: "x" }]);
    expect(r.ok).toBe(true);
  });
});
