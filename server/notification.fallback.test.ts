import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * notifyOwner Slack 폴백 검증
 *  - forge 알림 서비스가 없을 때(서버 이전 환경) SLACK_WEBHOOK_URL로 폴백 전송
 *  - Slack도 없으면 false 반환 (ERP 무중단)
 */
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("notifyOwner Slack 폴백", () => {
  it("forge 미설정 + Slack 설정 시 Slack으로 폴백 전송한다", async () => {
    delete process.env.BUILT_IN_FORGE_API_URL;
    delete process.env.BUILT_IN_FORGE_API_KEY;
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/TEST/FALLBACK";

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));

    const { notifyOwner } = await import("./_core/notification");
    const result = await notifyOwner({ title: "테스트", content: "폴백 본문" });

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0][0];
    expect(String(calledUrl)).toContain("hooks.slack.com");
  });

  it("forge 미설정 + Slack 미설정 시 false 반환 (무중단)", async () => {
    delete process.env.BUILT_IN_FORGE_API_URL;
    delete process.env.BUILT_IN_FORGE_API_KEY;
    delete process.env.SLACK_WEBHOOK_URL;

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { notifyOwner } = await import("./_core/notification");
    const result = await notifyOwner({ title: "테스트", content: "본문" });

    expect(result).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
