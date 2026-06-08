import { describe, expect, it } from "vitest";
import { assertAllowedBranch, ALLOWED_BRANCHES } from "./gitEngine";
import { SelfAuditBot } from "./selfAuditBot";

describe("gitEngine — 브랜치 화이트리스트 가드", () => {
  it("허용 브랜치는 통과한다", () => {
    for (const b of ALLOWED_BRANCHES) {
      expect(() => assertAllowedBranch(b)).not.toThrow();
    }
  });

  it("허용되지 않은 브랜치는 차단한다", () => {
    expect(() => assertAllowedBranch("master")).toThrow();
    expect(() => assertAllowedBranch("feature/hack")).toThrow();
    expect(() => assertAllowedBranch("dev-3")).toThrow();
  });
});

describe("SelfAuditBot.scanForbiddenTokens — 외부도구 누수 차단(보안 4층)", () => {
  const bot = new SelfAuditBot();

  it("manager 경계 파일에 web_search 주입을 차단한다", () => {
    const r = bot.scanForbiddenTokens(
      "server/services/managerHandler.ts",
      "const x = web_search('골프장');",
    );
    expect(r.passed).toBe(false);
    expect(r.detail).toContain("web_search");
  });

  it("golftalk 경계 파일에 axios import 주입을 차단한다", () => {
    const r = bot.scanForbiddenTokens(
      "client/src/pages/golftalk.tsx",
      "import axios from 'axios';",
    );
    expect(r.passed).toBe(false);
  });

  it("manager 경계 파일에 new OpenAI 주입을 차단한다", () => {
    const r = bot.scanForbiddenTokens(
      "server/manager/engine.ts",
      "const c = new OpenAI({ apiKey });",
    );
    expect(r.passed).toBe(false);
  });

  it("비경계 파일은 스캔 대상에서 제외된다", () => {
    const r = bot.scanForbiddenTokens(
      "server/services/masterEngine.ts",
      "const x = web_search('ok');",
    );
    expect(r.passed).toBe(true);
  });

  it("경계 파일이라도 금지 토큰이 없으면 통과한다", () => {
    const r = bot.scanForbiddenTokens(
      "server/services/managerHandler.ts",
      "const reply = renderTemplate(data);",
    );
    expect(r.passed).toBe(true);
  });
});
