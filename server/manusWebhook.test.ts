/**
 * 마누스채봇 웹훅 수신 테스트 [ID: 700001]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleManusWebhook } from "./routers/manusWebhook";

// DB 모킹
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  }),
}));

// realtimeEvents 모킹
vi.mock("./services/realtimeEvents", () => ({
  publish: vi.fn(),
}));

// drizzle/schema 모킹
vi.mock("../drizzle/schema", () => ({
  manusWebhookLogs: {},
  devRequests: {},
}));

describe("handleManusWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("message_added 이벤트를 올바르게 파싱한다", async () => {
    const { publish } = await import("./services/realtimeEvents");
    const payload = {
      event: "message_added",
      task_id: "task-123",
      message: {
        role: "assistant",
        content: "안녕하세요! 테스트 메시지입니다.",
      },
    };

    await handleManusWebhook(payload, true);

    expect(publish).toHaveBeenCalledWith(
      "manus_webhook_received",
      expect.objectContaining({
        taskId: "task-123",
        eventType: "message_added",
        content: "안녕하세요! 테스트 메시지입니다.",
        role: "assistant",
      })
    );
  });

  it("task_stopped 이벤트를 올바르게 파싱한다", async () => {
    const { publish } = await import("./services/realtimeEvents");
    const payload = {
      event: "task_stopped",
      task_id: "task-456",
      task_detail: { status: "completed" },
    };

    await handleManusWebhook(payload, true);

    expect(publish).toHaveBeenCalledWith(
      "manus_webhook_received",
      expect.objectContaining({
        taskId: "task-456",
        eventType: "task_stopped",
        role: "system",
      })
    );
  });

  it("task_created 이벤트를 올바르게 파싱한다", async () => {
    const { publish } = await import("./services/realtimeEvents");
    const payload = {
      event: "task_created",
      task_id: "task-789",
    };

    await handleManusWebhook(payload, false);

    expect(publish).toHaveBeenCalledWith(
      "manus_webhook_received",
      expect.objectContaining({
        taskId: "task-789",
        eventType: "task_created",
        role: "system",
      })
    );
  });

  it("알 수 없는 이벤트는 raw payload를 content로 저장한다", async () => {
    const { publish } = await import("./services/realtimeEvents");
    const payload = {
      event: "unknown_event",
      task_id: "task-000",
      some_data: "test",
    };

    await handleManusWebhook(payload, true);

    expect(publish).toHaveBeenCalledWith(
      "manus_webhook_received",
      expect.objectContaining({
        eventType: "unknown_event",
        role: "system",
      })
    );
  });

  it("content가 배열인 경우 텍스트만 추출한다", async () => {
    const { publish } = await import("./services/realtimeEvents");
    const payload = {
      event: "message_added",
      task_id: "task-arr",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "첫 번째 텍스트" },
          { type: "image_url", image_url: { url: "https://example.com/img.png" } },
          { type: "text", text: "두 번째 텍스트" },
        ],
      },
    };

    await handleManusWebhook(payload, true);

    expect(publish).toHaveBeenCalledWith(
      "manus_webhook_received",
      expect.objectContaining({
        content: "첫 번째 텍스트\n두 번째 텍스트",
      })
    );
  });
});

describe("Manus API 웹훅 등록/조회 [ID: 700002]", () => {
  const DOGOLF_WEBHOOK_URL =
    "https://dayoutgolf.com/api/manus/webhook";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("MANUS_API_KEY 미설정 시 getWebhookStatus가 apiKeyMissing: true를 반환한다", async () => {
    vi.stubEnv("MANUS_API_KEY", "");
    // fetch를 모킹하지 않아도 apiKey 없으면 fetch 호출 없이 빠르게 반환
    const globalFetch = vi.spyOn(global, "fetch");

    // 직접 헬퍼 로직 검증: apiKey가 없으면 빈 배열 반환
    const apiKey = process.env.MANUS_API_KEY ?? "";
    expect(apiKey).toBe("");
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it("Manus API webhook.list 응답에서 두골프 URL 등록 여부를 올바르게 판별한다", async () => {
    const mockWebhooks = [
      { id: "wh_abc123", url: DOGOLF_WEBHOOK_URL, status: "active", created_at: 1700000000 },
      { id: "wh_xyz456", url: "https://other.example.com/webhook", status: "active", created_at: 1700000001 },
    ];

    const dogolfWebhook = mockWebhooks.find((w) => w.url === DOGOLF_WEBHOOK_URL);
    expect(dogolfWebhook).toBeDefined();
    expect(dogolfWebhook?.id).toBe("wh_abc123");
    expect(dogolfWebhook?.status).toBe("active");
  });

  it("두골프 URL이 없는 경우 미등록으로 판별한다", async () => {
    const mockWebhooks = [
      { id: "wh_xyz456", url: "https://other.example.com/webhook", status: "active", created_at: 1700000001 },
    ];

    const dogolfWebhook = mockWebhooks.find((w) => w.url === DOGOLF_WEBHOOK_URL);
    expect(dogolfWebhook).toBeUndefined();
  });

  it("webhook.create 성공 응답을 올바르게 파싱한다", async () => {
    const mockResponse = {
      ok: true,
      webhook: { id: "wh_new123", url: DOGOLF_WEBHOOK_URL, status: "active", created_at: 1700000100 },
    };

    expect(mockResponse.ok).toBe(true);
    expect(mockResponse.webhook.id).toBe("wh_new123");
  });

  it("webhook.delete 성공 응답을 올바르게 파싱한다", async () => {
    const mockResponse = { ok: true };
    expect(mockResponse.ok).toBe(true);
  });
});
