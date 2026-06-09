import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * invokeLLM 듀얼 폴백 검증
 *  1) forge 키가 있으면 forge 먼저 호출
 *  2) forge 실패 시 OpenRouter로 폴백
 *  3) forge 키가 없으면 처음부터 OpenRouter 호출
 *
 * ENV는 모듈 로드 시점에 평가되므로, 각 시나리오마다 vi.resetModules() 후
 * 환경변수를 세팅하고 모듈을 동적 import 한다.
 */

const OK_RESPONSE = {
  id: "test",
  created: 0,
  model: "gemini-2.5-flash",
  choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("./erpApiKeyManager");
  process.env = { ...ORIGINAL_ENV };
});

describe("invokeLLM 듀얼 폴백", () => {
  it("forge 키가 있으면 forge를 먼저 호출한다", async () => {
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example.com";

    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(String(url));
      return jsonResponse(OK_RESPONSE);
    }));

    const { invokeLLM } = await import("./_core/llm");
    const res = await invokeLLM({ messages: [{ role: "user", content: "hi" }] });

    expect(res.choices[0].message.content).toBe("ok");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("forge.example.com");
  });

  it("forge 실패 시 OpenRouter로 폴백한다", async () => {
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example.com";
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.OPENROUTER_BASE_URL = "https://openrouter.example.com/api/v1";

    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(String(url));
      if (String(url).includes("forge.example.com")) {
        return jsonResponse({ error: "forge down" }, false, 503);
      }
      return jsonResponse(OK_RESPONSE);
    }));

    const { invokeLLM } = await import("./_core/llm");
    const res = await invokeLLM({ messages: [{ role: "user", content: "hi" }] });

    expect(res.choices[0].message.content).toBe("ok");
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("forge.example.com");
    expect(calls[1]).toContain("openrouter.example.com");
  });

  it("forge 키가 없으면 처음부터 OpenRouter를 호출한다", async () => {
    delete process.env.BUILT_IN_FORGE_API_KEY;
    process.env.OPENROUTER_API_KEY = "or-key";
    process.env.OPENROUTER_BASE_URL = "https://openrouter.example.com/api/v1";

    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(String(url));
      return jsonResponse(OK_RESPONSE);
    }));

    const { invokeLLM } = await import("./_core/llm");
    const res = await invokeLLM({ messages: [{ role: "user", content: "hi" }] });

    expect(res.choices[0].message.content).toBe("ok");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("openrouter.example.com");
  });

  it("제공자 선호도 openrouter면 forge 키가 있어도 OpenRouter를 먼저 호출한다", async () => {
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example.com";
    process.env.OPENROUTER_BASE_URL = "https://openrouter.example.com/api/v1";

    vi.doMock("./erpApiKeyManager", () => ({
      getApiKey: vi.fn(async (svc: string) => {
        if (svc === "llm_provider_preference") return "openrouter";
        if (svc === "openrouter") return "or-key";
        return "";
      }),
    }));

    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(String(url));
      return jsonResponse(OK_RESPONSE);
    }));

    const { invokeLLM } = await import("./_core/llm");
    const res = await invokeLLM({ messages: [{ role: "user", content: "hi" }] });

    expect(res.choices[0].message.content).toBe("ok");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("openrouter.example.com");
  });

  it("제공자 선호도 forge면 forge만 호출하고 폴백하지 않는다", async () => {
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.example.com";
    process.env.OPENROUTER_API_KEY = "or-key";

    vi.doMock("./erpApiKeyManager", () => ({
      getApiKey: vi.fn(async (svc: string) =>
        svc === "llm_provider_preference" ? "forge" : ""
      ),
    }));

    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(String(url));
      return jsonResponse(OK_RESPONSE);
    }));

    const { invokeLLM } = await import("./_core/llm");
    const res = await invokeLLM({ messages: [{ role: "user", content: "hi" }] });

    expect(res.choices[0].message.content).toBe("ok");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("forge.example.com");
  });

  it("forge도 OpenRouter도 모두 실패하면 에러를 던진다", async () => {
    process.env.BUILT_IN_FORGE_API_KEY = "forge-key";
    process.env.OPENROUTER_API_KEY = "or-key";

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "down" }, false, 500)));

    const { invokeLLM } = await import("./_core/llm");
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow(/OpenRouter LLM invoke failed/);
  });
});
