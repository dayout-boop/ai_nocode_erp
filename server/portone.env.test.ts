/**
 * 포트원 V2 환경변수 검증 테스트
 */
import { describe, it, expect } from "vitest";

describe("PortOne V2 환경변수", () => {
  it("VITE_PORTONE_STORE_ID가 설정되어 있어야 한다", () => {
    const storeId = process.env.VITE_PORTONE_STORE_ID;
    expect(storeId).toBeTruthy();
    expect(storeId).toMatch(/^store-/);
  });

  it("VITE_PORTONE_CHANNEL_KEY가 설정되어 있어야 한다", () => {
    const channelKey = process.env.VITE_PORTONE_CHANNEL_KEY;
    expect(channelKey).toBeTruthy();
    expect(channelKey).toMatch(/^channel-key-/);
  });

  it("PORTONE_API_SECRET가 설정되어 있어야 한다", () => {
    const apiSecret = process.env.PORTONE_API_SECRET;
    expect(apiSecret).toBeTruthy();
    expect(apiSecret!.length).toBeGreaterThan(0);
  });
});
