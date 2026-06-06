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
