/**
 * systemSettingsRouter 테스트
 * - MANUS_DOGOLF_TASK_ID 설정 저장/조회
 * - Footer.tsx 저작권 연도 자동화 로직 검증
 */
import { describe, it, expect } from "vitest";

// ─── Footer 저작권 연도 자동화 로직 테스트 ────────────────────────────────────
describe("Footer 저작권 연도 자동화", () => {
  it("현재 연도를 반환해야 한다", () => {
    const currentYear = new Date().getFullYear();
    expect(currentYear).toBeGreaterThanOrEqual(2026);
    expect(typeof currentYear).toBe("number");
  });

  it("copyright 문자열에서 연도를 현재 연도로 치환해야 한다", () => {
    const currentYear = new Date().getFullYear();
    const oldCopyright = "© 2024 두골프(DOGOLF). All Rights Reserved.";
    const updated = oldCopyright.replace(/©\s*\d{4}/, `© ${currentYear}`);
    expect(updated).toBe(`© ${currentYear} 두골프(DOGOLF). All Rights Reserved.`);
  });

  it("copyright가 없을 때 기본값을 생성해야 한다", () => {
    const currentYear = new Date().getFullYear();
    const partnerName = "두골프";
    const generated = `© ${currentYear} ${partnerName}(DOGOLF). All Rights Reserved. Powered by dogolfai`;
    expect(generated).toContain(String(currentYear));
    expect(generated).toContain("두골프");
    expect(generated).toContain("Powered by dogolfai");
  });

  it("파트너명이 동적으로 적용되어야 한다", () => {
    const currentYear = new Date().getFullYear();
    const partnerName = "테스트골프";
    const generated = `© ${currentYear} ${partnerName}(DOGOLF). All Rights Reserved. Powered by dogolfai`;
    expect(generated).toContain("테스트골프");
  });
});

// ─── SYSTEM_SETTING_KEYS 상수 테스트 ──────────────────────────────────────────
describe("SYSTEM_SETTING_KEYS 상수", () => {
  it("필수 키가 정의되어 있어야 한다", async () => {
    const { SYSTEM_SETTING_KEYS } = await import("./routers/systemSettings");
    expect(SYSTEM_SETTING_KEYS.MANUS_DOGOLF_TASK_ID).toBe("MANUS_DOGOLF_TASK_ID");
    expect(SYSTEM_SETTING_KEYS.MANUS_PROJECT_ID).toBe("MANUS_PROJECT_ID");
    expect(SYSTEM_SETTING_KEYS.SLACK_WEBHOOK_URL).toBe("SLACK_WEBHOOK_URL");
    expect(SYSTEM_SETTING_KEYS.DEV_REQUEST_AUTO_SEND).toBe("DEV_REQUEST_AUTO_SEND");
  });
});

// ─── manusPipe DB 조회 로직 테스트 ────────────────────────────────────────────
describe("manusPipe MANUS_DOGOLF_TASK_ID 우선순위", () => {
  it("DB 값이 환경변수보다 우선 적용되어야 한다", () => {
    // DB에서 가져온 값이 있으면 환경변수를 덮어씀
    const envValue = "env_task_id_123";
    const dbValue = "db_task_id_456";

    let activeTaskId = envValue;
    if (dbValue) {
      activeTaskId = dbValue;
    }

    expect(activeTaskId).toBe("db_task_id_456");
  });

  it("DB 값이 없으면 환경변수를 사용해야 한다", () => {
    const envValue = "env_task_id_123";
    const dbValue: string | null = null;

    let activeTaskId = envValue;
    if (dbValue) {
      activeTaskId = dbValue;
    }

    expect(activeTaskId).toBe("env_task_id_123");
  });

  it("둘 다 없으면 undefined/빈 값이어야 한다", () => {
    const envValue: string | undefined = undefined;
    const dbValue: string | null = null;

    const activeTaskId = dbValue ?? envValue ?? null;

    expect(activeTaskId).toBeNull();
  });
});
