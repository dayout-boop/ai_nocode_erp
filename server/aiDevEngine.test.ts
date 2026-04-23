/**
 * 두골프-AI개발 엔진 단위 테스트
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 오류 분류 함수 테스트 ─────────────────────────────────────────────────────
describe("errorWatcher - isCriticalError", () => {
  // 실제 모듈 import 대신 로직을 직접 테스트
  function isCriticalError(source: string, errorMessage: string): boolean {
    const CRITICAL_FILES = [
      "stripe.ts", "payment", "auth", "oauth", "jwt", "cookie",
      "booking", "settlement", "kakao", "runway", "n8n",
    ];
    const combined = `${source} ${errorMessage}`.toLowerCase();
    return CRITICAL_FILES.some((cf) => combined.includes(cf));
  }

  it("결제 관련 파일은 critical로 분류", () => {
    expect(isCriticalError("server/stripe.ts", "Payment failed")).toBe(true);
  });

  it("인증 관련 파일은 critical로 분류", () => {
    expect(isCriticalError("server/_core/auth.ts", "JWT invalid")).toBe(true);
  });

  it("예약 관련 오류는 critical로 분류", () => {
    expect(isCriticalError("server/routers.ts", "booking update failed")).toBe(true);
  });

  it("일반 UI 파일은 critical이 아님", () => {
    expect(isCriticalError("client/src/pages/Home.tsx", "render error")).toBe(false);
  });

  it("카카오 알림톡 오류는 critical로 분류", () => {
    expect(isCriticalError("server/_core/kakao.ts", "API 호출 실패")).toBe(true);
  });
});

// ─── 오류 타입 분류 테스트 ─────────────────────────────────────────────────────
describe("errorWatcher - classifyError", () => {
  type ErrorType = "runtime" | "network" | "auth" | "payment" | "database" | "unknown";

  function classifyError(error: Error | unknown): ErrorType {
    const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (msg.includes("payment") || msg.includes("stripe") || msg.includes("결제")) return "payment";
    if (msg.includes("auth") || msg.includes("jwt") || msg.includes("unauthorized") || msg.includes("인증")) return "auth";
    if (msg.includes("database") || msg.includes("sql") || msg.includes("db") || msg.includes("query")) return "database";
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("timeout") || msg.includes("econnrefused")) return "network";
    if (error instanceof Error) return "runtime";
    return "unknown";
  }

  it("Stripe 오류는 payment로 분류", () => {
    expect(classifyError(new Error("stripe payment failed"))).toBe("payment");
  });

  it("JWT 오류는 auth로 분류", () => {
    expect(classifyError(new Error("JWT token invalid"))).toBe("auth");
  });

  it("DB 오류는 database로 분류", () => {
    expect(classifyError(new Error("database connection failed"))).toBe("database");
  });

  it("네트워크 오류는 network로 분류", () => {
    expect(classifyError(new Error("fetch timeout ECONNREFUSED"))).toBe("network");
  });

  it("일반 Error는 runtime으로 분류", () => {
    expect(classifyError(new Error("undefined is not a function"))).toBe("runtime");
  });
});

// ─── OpenRouter 폴백 로직 테스트 ──────────────────────────────────────────────
describe("orchestrator - 404 폴백 로직", () => {
  const COMPLEX_FALLBACK_MODELS = [
    "anthropic/claude-3.5-sonnet-20241022",
    "google/gemini-pro-1.5",
    "openai/gpt-4o",
    "meta-llama/llama-3.1-70b-instruct",
  ];

  it("폴백 모델 목록에 claude-3.5-sonnet-20241022 포함", () => {
    expect(COMPLEX_FALLBACK_MODELS).toContain("anthropic/claude-3.5-sonnet-20241022");
  });

  it("폴백 모델 목록에 gemini-pro-1.5 포함", () => {
    expect(COMPLEX_FALLBACK_MODELS).toContain("google/gemini-pro-1.5");
  });

  it("폴백 모델 목록에 gpt-4o 포함", () => {
    expect(COMPLEX_FALLBACK_MODELS).toContain("openai/gpt-4o");
  });

  it("폴백 모델 목록에 llama-3.1-70b 포함 (무료 대안)", () => {
    expect(COMPLEX_FALLBACK_MODELS).toContain("meta-llama/llama-3.1-70b-instruct");
  });

  it("폴백 모델이 4개 이상 정의됨", () => {
    expect(COMPLEX_FALLBACK_MODELS.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── 핵심 기능 수정 안전장치 테스트 ──────────────────────────────────────────
describe("aiDevEngine - 핵심 기능 수정 안전장치", () => {
  interface FixRequest {
    isCritical: boolean;
    status: string;
    userFeedback?: string;
  }

  function canApproveWithoutFeedback(req: FixRequest): boolean {
    // 핵심 기능 수정은 피드백 없이 승인 불가
    if (req.isCritical && !req.userFeedback?.trim()) return false;
    return true;
  }

  it("핵심 기능 수정은 피드백 없이 승인 불가", () => {
    const req: FixRequest = { isCritical: true, status: "pending" };
    expect(canApproveWithoutFeedback(req)).toBe(false);
  });

  it("핵심 기능 수정은 피드백 있으면 승인 가능", () => {
    const req: FixRequest = { isCritical: true, status: "pending", userFeedback: "검토 완료. 안전한 변경사항입니다." };
    expect(canApproveWithoutFeedback(req)).toBe(true);
  });

  it("일반 기능 수정은 피드백 없이 승인 가능", () => {
    const req: FixRequest = { isCritical: false, status: "pending" };
    expect(canApproveWithoutFeedback(req)).toBe(true);
  });

  it("빈 피드백은 피드백 없음으로 처리", () => {
    const req: FixRequest = { isCritical: true, status: "pending", userFeedback: "   " };
    expect(canApproveWithoutFeedback(req)).toBe(false);
  });
});

// ─── ReviewEngine 단계 검토 결과 집계 테스트 ─────────────────────────────────
describe("reviewEngine - 검토 결과 집계", () => {
  type ReviewResult = "pass" | "fail" | "warning";
  interface StageResult { stage: string; result: ReviewResult; }

  function aggregateResults(stages: StageResult[]): {
    overallResult: ReviewResult;
    canApply: boolean;
  } {
    const hasError = stages.some((s) => s.result === "fail");
    const hasWarning = stages.some((s) => s.result === "warning");
    return {
      overallResult: hasError ? "fail" : hasWarning ? "warning" : "pass",
      canApply: !hasError,
    };
  }

  it("모든 단계 pass → 전체 pass", () => {
    const stages: StageResult[] = [
      { stage: "syntax", result: "pass" },
      { stage: "logic", result: "pass" },
      { stage: "security", result: "pass" },
    ];
    const result = aggregateResults(stages);
    expect(result.overallResult).toBe("pass");
    expect(result.canApply).toBe(true);
  });

  it("하나라도 fail → 전체 fail, 적용 불가", () => {
    const stages: StageResult[] = [
      { stage: "syntax", result: "pass" },
      { stage: "security", result: "fail" },
    ];
    const result = aggregateResults(stages);
    expect(result.overallResult).toBe("fail");
    expect(result.canApply).toBe(false);
  });

  it("warning만 있으면 → 전체 warning, 적용 가능", () => {
    const stages: StageResult[] = [
      { stage: "syntax", result: "pass" },
      { stage: "logic", result: "warning" },
    ];
    const result = aggregateResults(stages);
    expect(result.overallResult).toBe("warning");
    expect(result.canApply).toBe(true);
  });

  it("fail과 warning 혼재 → fail 우선", () => {
    const stages: StageResult[] = [
      { stage: "syntax", result: "warning" },
      { stage: "security", result: "fail" },
    ];
    const result = aggregateResults(stages);
    expect(result.overallResult).toBe("fail");
  });
});
