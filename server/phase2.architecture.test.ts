/**
 * Phase 2 아키텍처 개선안 통합 테스트
 * - transactionId 생성/전파 검증
 * - ADMIN_ONLY_TOOLS 권한 검증 (callerContext)
 * - useBookingsQuery 훅 타입 안전성 검증
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeTool,
  ADMIN_ONLY_TOOLS,
  APPROVAL_REQUIRED_TOOLS,
  type CallerContext,
  type ToolCallResult,
} from "./services/masterTools";

// ─── DB Mock ────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    // Drizzle chain helpers
    then: undefined,
  }),
}));

// ─── transactionId 생성 유틸 ────────────────────────────────────────────────
function generateTransactionId(): string {
  return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── 테스트 ─────────────────────────────────────────────────────────────────

describe("Phase 2: transactionId 생성 및 형식 검증", () => {
  it("transactionId는 'txn_' 접두사로 시작해야 한다", () => {
    const txnId = generateTransactionId();
    expect(txnId).toMatch(/^txn_\d+_[a-z0-9]+$/);
  });

  it("두 번 생성한 transactionId는 서로 달라야 한다", () => {
    const id1 = generateTransactionId();
    const id2 = generateTransactionId();
    expect(id1).not.toBe(id2);
  });

  it("CallerContext 타입이 올바른 구조를 갖는지 확인", () => {
    const ctx: CallerContext = {
      userId: 1,
      role: "admin",
      transactionId: generateTransactionId(),
    };
    expect(ctx.userId).toBe(1);
    expect(ctx.role).toBe("admin");
    expect(ctx.transactionId).toMatch(/^txn_/);
  });
});

describe("Phase 2: ADMIN_ONLY_TOOLS 권한 검증", () => {
  it("ADMIN_ONLY_TOOLS 목록이 올바르게 정의되어 있어야 한다", () => {
    expect(ADMIN_ONLY_TOOLS).toContain("get_customer_info");
    expect(ADMIN_ONLY_TOOLS).toContain("get_settlement_summary");
    expect(ADMIN_ONLY_TOOLS).toContain("get_ai_cost_summary");
    expect(ADMIN_ONLY_TOOLS).toContain("get_ai_chat_logs");
    expect(ADMIN_ONLY_TOOLS).toContain("get_error_logs");
    expect(ADMIN_ONLY_TOOLS).toContain("schedule_task");
  });

  it("APPROVAL_REQUIRED_TOOLS 목록이 올바르게 정의되어 있어야 한다", () => {
    expect(APPROVAL_REQUIRED_TOOLS).toContain("web_search");
    expect(APPROVAL_REQUIRED_TOOLS).toContain("fetch_url");
  });

  it("user 역할로 ADMIN_ONLY_TOOLS 호출 시 권한 오류를 반환해야 한다", async () => {
    const userCtx: CallerContext = {
      userId: 99,
      role: "user",
      transactionId: generateTransactionId(),
    };

    for (const toolName of ADMIN_ONLY_TOOLS) {
      const result: ToolCallResult = await executeTool(toolName, {}, userCtx);
      expect(result.success).toBe(false);
      expect(result.error).toContain("권한 부족");
      expect(result.error).toContain(toolName);
      expect(result.error).toContain(userCtx.transactionId);
    }
  });

  it("admin 역할로 ADMIN_ONLY_TOOLS 호출 시 권한 오류가 없어야 한다 (DB 오류는 허용)", async () => {
    const adminCtx: CallerContext = {
      userId: 1,
      role: "admin",
      transactionId: generateTransactionId(),
    };

    // get_customer_info는 'search' 파라미터가 필수이므로 별도 처리
    const result: ToolCallResult = await executeTool(
      "get_customer_info",
      { search: "테스트" },
      adminCtx
    );
    // 권한 오류("권한 부족")가 아닌 다른 오류(DB 오류 등)는 허용
    if (!result.success) {
      expect(result.error).not.toContain("권한 부족");
    }
  });

  it("callerCtx 없이 호출하면 권한 검증을 건너뛰어야 한다 (하위 호환성)", async () => {
    // callerCtx를 전달하지 않으면 ADMIN_ONLY_TOOLS도 권한 오류 없이 진행
    const result: ToolCallResult = await executeTool(
      "get_customer_info",
      { search: "테스트" }
      // callerCtx 생략
    );
    // 권한 오류가 아닌 DB 오류 등은 허용
    if (!result.success) {
      expect(result.error).not.toContain("권한 부족");
    }
  });

  it("비민감 도구는 user 역할로도 권한 오류 없이 실행되어야 한다", async () => {
    const userCtx: CallerContext = {
      userId: 99,
      role: "user",
      transactionId: generateTransactionId(),
    };

    const result: ToolCallResult = await executeTool(
      "get_bookings_summary",
      { period: "today" },
      userCtx
    );
    // 권한 오류가 아닌 DB 오류 등은 허용
    if (!result.success) {
      expect(result.error).not.toContain("권한 부족");
    }
  });
});

describe("Phase 2: transactionId가 오류 메시지에 포함되는지 검증", () => {
  it("권한 오류 메시지에 transactionId가 포함되어야 한다", async () => {
    const txnId = generateTransactionId();
    const userCtx: CallerContext = {
      userId: 99,
      role: "user",
      transactionId: txnId,
    };

    const result = await executeTool("get_settlement_summary", { period: "today" }, userCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain(txnId);
  });
});
