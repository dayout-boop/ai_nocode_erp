import { describe, expect, it } from "vitest";
import {
  AgentEngineFactory,
  enforcePartnerLock,
  runAgent,
  type AgentContext,
} from "./agentEngine";

describe("AgentEngineFactory.resolveTools — 도구 격리", () => {
  it("MASTER 는 외부 결합 도구를 보유한다", () => {
    const tools = AgentEngineFactory.resolveTools("MASTER");
    expect(tools).toContain("web_search");
    expect(tools).toContain("execute_git_engine");
  });

  it("MANAGER 는 외부 도구가 동결된다", () => {
    const tools = AgentEngineFactory.resolveTools("MANAGER");
    expect(AgentEngineFactory.hasExternalTool(tools)).toBe(false);
    expect(tools).not.toContain("web_search");
  });

  it("GOLFTALK 은 외부 도구가 동결된다", () => {
    const tools = AgentEngineFactory.resolveTools("GOLFTALK");
    expect(AgentEngineFactory.hasExternalTool(tools)).toBe(false);
  });

  it("SYSTEM 은 내부 도구만 보유한다", () => {
    const tools = AgentEngineFactory.resolveTools("SYSTEM");
    expect(AgentEngineFactory.hasExternalTool(tools)).toBe(false);
    expect(tools).toContain("read_service_db");
  });
});

describe("enforcePartnerLock — partner_id 강제 잠금", () => {
  it("MANAGER 가 partnerId 없으면 차단한다", () => {
    const ctx: AgentContext = { callerId: "u1", role: "MANAGER" };
    expect(() => enforcePartnerLock(ctx)).toThrow();
  });

  it("GOLFTALK 가 partnerId 없으면 차단한다", () => {
    const ctx: AgentContext = { callerId: "c1", role: "GOLFTALK" };
    expect(() => enforcePartnerLock(ctx)).toThrow();
  });

  it("MANAGER 가 partnerId 보유 시 통과한다", () => {
    const ctx: AgentContext = { callerId: "u1", role: "MANAGER", partnerId: "p1" };
    expect(() => enforcePartnerLock(ctx)).not.toThrow();
  });

  it("MASTER 는 partnerId 없이도 통과한다", () => {
    const ctx: AgentContext = { callerId: "m1", role: "MASTER" };
    expect(() => enforcePartnerLock(ctx)).not.toThrow();
  });
});

describe("runAgent — 보안 경계 검증(LLM 호출 전 차단 경로)", () => {
  it("agentId 와 context.role 불일치 시 실패한다", async () => {
    const res = await runAgent("manager_engine", "hi", {
      callerId: "x",
      role: "MASTER", // 불일치
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("역할 불일치");
  });

  it("manager_engine 호출 시 partnerId 없으면 실패한다", async () => {
    const res = await runAgent("manager_engine", "hi", {
      callerId: "x",
      role: "MANAGER",
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("파트너");
  });
});
