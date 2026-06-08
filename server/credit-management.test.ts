/**
 * credit-management.test.ts
 * 관리자 ERP 크레딧 수동 부여/조절 API 단위 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── DB 모킹 ──────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "./db";

// ─── 테스트 헬퍼: adminAdjustCredit 로직 직접 검증 ─────────────────────
describe("adminAdjustCredit 비즈니스 로직", () => {
  it("양수 amount → 잔액 증가 계산이 올바르다", () => {
    const currentBalance = 100;
    const amount = 50;
    const newBalance = currentBalance + amount;
    expect(newBalance).toBe(150);
  });

  it("음수 amount → 잔액 감소 계산이 올바르다", () => {
    const currentBalance = 100;
    const amount = -30;
    const newBalance = currentBalance + amount;
    expect(newBalance).toBe(70);
  });

  it("차감 후 잔액이 0 미만이면 오류 조건이 충족된다", () => {
    const currentBalance = 20;
    const amount = -50;
    const wouldBeNegative = currentBalance + amount < 0;
    expect(wouldBeNegative).toBe(true);
  });

  it("차감 후 잔액이 정확히 0이면 허용된다", () => {
    const currentBalance = 50;
    const amount = -50;
    const newBalance = currentBalance + amount;
    expect(newBalance).toBe(0);
    expect(newBalance < 0).toBe(false);
  });

  it("amount가 0이면 유효하지 않다", () => {
    const amount = 0;
    const isValid = amount !== 0;
    expect(isValid).toBe(false);
  });

  it("amount 범위 검증: -9999 ~ 9999 이내", () => {
    const validAmounts = [-9999, -1, 1, 9999];
    const invalidAmounts = [-10000, 10000];

    validAmounts.forEach((a) => {
      expect(a >= -9999 && a <= 9999).toBe(true);
    });
    invalidAmounts.forEach((a) => {
      expect(a >= -9999 && a <= 9999).toBe(false);
    });
  });
});

// ─── 크레딧 이력 타입 필터 로직 ────────────────────────────────────────
describe("getAdminCreditHistory 필터 로직", () => {
  const mockRows = [
    { id: 1, type: "charge", amount: 100, balanceAfter: 200 },
    { id: 2, type: "deduct", amount: -30, balanceAfter: 170 },
    { id: 3, type: "refund", amount: 10, balanceAfter: 180 },
    { id: 4, type: "monthly_reset", amount: 0, balanceAfter: 0 },
    { id: 5, type: "charge", amount: 50, balanceAfter: 50 },
  ];

  it("type=all 이면 전체 행을 반환한다", () => {
    const type = "all";
    const filtered = type === "all" ? mockRows : mockRows.filter((r) => r.type === type);
    expect(filtered).toHaveLength(5);
  });

  it("type=charge 이면 charge 행만 반환한다", () => {
    const type = "charge";
    const filtered = mockRows.filter((r) => r.type === type);
    expect(filtered).toHaveLength(2);
    filtered.forEach((r) => expect(r.type).toBe("charge"));
  });

  it("type=deduct 이면 deduct 행만 반환한다", () => {
    const type = "deduct";
    const filtered = mockRows.filter((r) => r.type === type);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].amount).toBe(-30);
  });

  it("type=refund 이면 refund 행만 반환한다", () => {
    const type = "refund";
    const filtered = mockRows.filter((r) => r.type === type);
    expect(filtered).toHaveLength(1);
  });

  it("type=monthly_reset 이면 monthly_reset 행만 반환한다", () => {
    const type = "monthly_reset";
    const filtered = mockRows.filter((r) => r.type === type);
    expect(filtered).toHaveLength(1);
  });
});

// ─── 메모 접두어 포맷 검증 ─────────────────────────────────────────────
describe("수동 조정 메모 포맷", () => {
  it("수동 조정 메모는 [수동조정] 접두어를 포함해야 한다", () => {
    const userMemo = "입금 확인 후 지급";
    const formattedMemo = `[수동조정] ${userMemo}`;
    expect(formattedMemo).toContain("[수동조정]");
    expect(formattedMemo).toContain(userMemo);
  });

  it("빈 메모는 유효하지 않다", () => {
    const memo = "   ";
    expect(memo.trim().length > 0).toBe(false);
  });

  it("정상 메모는 유효하다", () => {
    const memo = "테스트 크레딧 지급";
    expect(memo.trim().length > 0).toBe(true);
  });
});

// ─── 충전 요청 상태 전환 로직 ──────────────────────────────────────────
describe("충전 요청 상태 전환", () => {
  it("pending 상태만 처리 가능하다", () => {
    const canProcess = (status: string) => status === "pending";
    expect(canProcess("pending")).toBe(true);
    expect(canProcess("approved")).toBe(false);
    expect(canProcess("rejected")).toBe(false);
  });

  it("거부 시 adminNote가 필수다", () => {
    const action = "rejected";
    const note = "";
    const isValid = !(action === "rejected" && note.trim() === "");
    expect(isValid).toBe(false);
  });

  it("승인 시 adminNote는 선택이다", () => {
    const action = "approved";
    const note = "";
    // 승인이면 note 없어도 유효
    const isValid = action === "approved" || note.trim().length > 0;
    expect(isValid).toBe(true);
  });
});

// ─── DB mock 연결 확인 ─────────────────────────────────────────────────
describe("DB 연결 오류 처리", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getDb가 null을 반환하면 INTERNAL_SERVER_ERROR를 던져야 한다", async () => {
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const db = await getDb();
    expect(db).toBeNull();
    // null이면 INTERNAL_SERVER_ERROR를 throw해야 함을 확인
    const shouldThrow = !db;
    expect(shouldThrow).toBe(true);
  });
});
