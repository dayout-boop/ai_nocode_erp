import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * manusSync 자립 폴백 검증
 *  - MANUS_API_KEY가 없고 ERP DB에도 키가 없으면
 *    syncManusTaskStatuses가 폴링을 건너뛰고 {checked:0,...} 반환 (ERP 무중단)
 *  - 즉, 마누스 없이도 서버가 죽지 않고 안전하게 흘러감
 */
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.MANUS_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("../db");
  vi.doUnmock("./erpApiKeyManager");
  process.env = { ...ORIGINAL_ENV };
});

describe("manusSync 자립 폴백", () => {
  it("MANUS 키가 전혀 없으면 동기화를 안전하게 건너뛴다", async () => {
    // DB는 연결되지만 키는 없는 상황
    vi.doMock("../db", () => ({
      getDb: async () => ({}),
    }));
    vi.doMock("./erpApiKeyManager", () => ({
      getApiKey: async () => "",
    }));

    const { syncManusTaskStatuses } = await import("./services/manusSync");
    const result = await syncManusTaskStatuses();

    expect(result).toEqual({ checked: 0, completed: 0, errors: 0 });
  });

  it("DB 연결이 없으면 빈 결과로 안전 종료", async () => {
    vi.doMock("../db", () => ({
      getDb: async () => null,
    }));
    vi.doMock("./erpApiKeyManager", () => ({
      getApiKey: async () => "",
    }));

    const { syncManusTaskStatuses } = await import("./services/manusSync");
    const result = await syncManusTaskStatuses();

    expect(result.checked).toBe(0);
  });
});
