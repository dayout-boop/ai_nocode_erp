/**
 * 두골프 마스터 Tool Calling 서비스
 * AI가 직접 DB를 조회하는 도구 모음 (10개)
 * 사실 기반 응답을 위한 핵심 인프라
 */

import { getDb } from "../db";
import {
  bookings,
  packages,
  settlements,
  inquiries,
  devRequests,
  aiCostLogs,
  aiEngineLogs,
  aiFixRequests,
  users,
  aiLogs,
  aiScheduledTasks,
  aiSessionState,
} from "../../drizzle/schema";
import { eq, gte, lte, and, sql, desc, count, sum, isNull, countDistinct } from "drizzle-orm";
import { maskPhone, maskEmail } from "./rag";

// ─── Tool 정의 (OpenRouter Tool Calling 형식) ───────────────────

export const MASTER_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_bookings_summary",
      description: "예약 현황을 조회합니다. 오늘/주간/월간 신규 예약 수, 상태별 집계, 총 매출을 반환합니다.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "week", "month", "all"],
            description: "조회 기간: today=오늘, week=이번 주, month=이번 달, all=전체",
          },
          status: {
            type: "string",
            enum: ["pending", "confirmed", "cancelled", "completed", "all"],
            description: "예약 상태 필터 (기본값: all)",
          },
          limit: {
            type: "number",
            description: "최대 반환 건수 (기본값: 20, 최대: 100)",
          },
        },
        required: ["period"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_packages_list",
      description: "등록된 골프 패키지 상품 목록과 통계를 조회합니다.",
      parameters: {
        type: "object",
        properties: {
          country: {
            type: "string",
            description: "국가 필터 (예: 태국, 베트남, 필리핀, 전체)",
          },
          status: {
            type: "string",
            enum: ["active", "inactive", "all"],
            description: "상품 상태 필터",
          },
          limit: {
            type: "number",
            description: "최대 반환 건수 (기본값: 20)",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_settlement_summary",
      description: "정산 현황을 조회합니다. 미정산 금액, 완료 금액, 연체 건수를 반환합니다.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "week", "month", "all"],
            description: "조회 기간",
          },
          status: {
            type: "string",
            enum: ["pending", "paid", "overdue", "all"],
            description: "정산 상태 필터",
          },
        },
        required: ["period"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ai_cost_summary",
      description: "AI 사용 비용 현황을 조회합니다. 모델별, 날짜별 비용 집계를 반환합니다.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "week", "month"],
            description: "조회 기간",
          },
          groupBy: {
            type: "string",
            enum: ["model", "date", "assistant"],
            description: "집계 기준",
          },
        },
        required: ["period"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dev_requests",
      description: "개발 요청 목록을 조회합니다. 상태별, 우선순위별 필터링이 가능합니다.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["pending", "in_progress", "completed", "cancelled", "all"],
            description: "요청 상태 필터",
          },
          priority: {
            type: "string",
            enum: ["critical", "high", "medium", "low", "all"],
            description: "우선순위 필터",
          },
          limit: {
            type: "number",
            description: "최대 반환 건수 (기본값: 20)",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_error_logs",
      description: "시스템 오류 로그를 조회합니다. 최근 오류, 미처리 오류를 반환합니다.",
      parameters: {
        type: "object",
        properties: {
          hours: {
            type: "number",
            description: "최근 N시간 이내 오류 (기본값: 24)",
          },
          status: {
            type: "string",
            enum: ["new", "analyzing", "fixed", "ignored", "all"],
            description: "처리 상태 필터",
          },
          errorType: {
            type: "string",
            enum: ["runtime", "api", "validation", "unknown", "all"],
            description: "오류 유형 필터",
          },
          limit: {
            type: "number",
            description: "최대 반환 건수 (기본값: 20)",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_customer_info",
      description: "고객 정보를 조회합니다. 연락처는 마스킹 처리됩니다.",
      parameters: {
        type: "object",
        properties: {
          search: {
            type: "string",
            description: "검색어 (이름, 이메일, 전화번호 일부)",
          },
          limit: {
            type: "number",
            description: "최대 반환 건수 (기본값: 10)",
          },
        },
        required: ["search"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inquiry_summary",
      description: "고객 문의 현황을 조회합니다. 미처리 문의, 최근 문의를 반환합니다.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "week", "month", "all"],
            description: "조회 기간",
          },
          status: {
            type: "string",
            enum: ["pending", "replied", "closed", "all"],
            description: "처리 상태 필터",
          },
          limit: {
            type: "number",
            description: "최대 반환 건수 (기본값: 20)",
          },
        },
        required: ["period"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ai_chat_logs",
      description: "AI 채팅 로그를 조회합니다. 어시스턴트별, 날짜별 대화 기록을 반환합니다.",
      parameters: {
        type: "object",
        properties: {
          assistant: {
            type: "string",
            enum: ["master", "golftalk", "manager", "all"],
            description: "어시스턴트 필터",
          },
          period: {
            type: "string",
            enum: ["today", "week", "month"],
            description: "조회 기간",
          },
          limit: {
            type: "number",
            description: "최대 반환 건수 (기본값: 20)",
          },
        },
        required: ["period"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_system_health",
      description: "시스템 전체 상태를 조회합니다. 오늘의 핵심 지표(예약/매출/AI비용/오류)를 한눈에 반환합니다.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_task",
      description: "특정 시각에 AI 작업을 예약합니다. '15분 후 예약 현황 보고', '내일 오전 9시 매출 분석' 등 시간 기반 작업을 등록합니다. 사용자가 미래 시각에 보고나 알림을 요청할 때 사용하세요.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "작업 제목 (예: '15분 후 예약 현황 보고')",
          },
          prompt: {
            type: "string",
            description: "실행 시 AI에게 전달할 프롬프트 (예: '현재 예약 현황을 조회하고 오늘 신규 예약 수, 총 매출을 보고해주세요')",
          },
          scheduledAt: {
            type: "string",
            description: "실행 예정 시각 (ISO 8601 형식, 예: '2026-05-02T10:30:00.000Z')",
          },
          taskType: {
            type: "string",
            enum: ["report", "reminder", "analysis", "custom"],
            description: "작업 유형: report=보고서, reminder=리마인더, analysis=분석, custom=사용자정의",
          },
          notifyOnComplete: {
            type: "boolean",
            description: "완료 시 알림 전송 여부 (기본값: true)",
          },
        },
        required: ["title", "prompt", "scheduledAt"],
        additionalProperties: false,
      },
    },
  },
  // ─── 외부 연동 도구 (관리자 승인 필요) ───────────────────────────────────────
  {
    type: "function",
    function: {
      name: "web_search",
      description: "[관리자 승인 필요] 인터넷에서 최신 정보를 검색합니다. 골프장 정보, 환율, 날씨, 뉴스 등 외부 정보가 필요할 때 사용합니다. 이 도구는 관리자 승인 후 실행됩니다.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "검색 쿼리 (예: '태국 골프장 추천 2026', '원달러 환율')",
          },
          count: {
            type: "number",
            description: "검색 결과 수 (기본값: 5, 최대: 10)",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "[관리자 승인 필요] 특정 URL의 웹 페이지 내용을 가져옵니다. 골프장 공식 사이트, 환율 API 등 외부 URL에서 데이터를 가져올 때 사용합니다. 이 도구는 관리자 승인 후 실행됩니다.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "가져올 URL (예: 'https://www.golfclub.com/info')",
          },
          extractText: {
            type: "boolean",
            description: "HTML에서 텍스트만 추출할지 여부 (기본값: true)",
          },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
  // ─── 세션 상태 관리 도구 ────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "set_session_state",
      description: "현재 대화 세션에 정보를 임시 저장합니다. 여러 단계에 걸쳐 정보를 유지해야 할 때 사용합니다.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "저장 키" },
          value: { type: "string", description: "저장할 값 (텍스트 또는 JSON 문자열)" },
          ttlMinutes: { type: "number", description: "만료 시간(분) (기본값: 60)" },
        },
        required: ["key", "value"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_session_state",
      description: "현재 대화 세션에 저장된 정보를 조회합니다.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "조회할 키" },
        },
        required: ["key"],
        additionalProperties: false,
      },
    },
  },
];

// 승인이 필요한 도구 목록
export const APPROVAL_REQUIRED_TOOLS = ["web_search", "fetch_url"];

// ─── Tool 실행 함수 ─────────────────────────────────────────────

export type ToolCallResult = {
  tool: string;
  success: boolean;
  data?: unknown;
  error?: string;
  queryTime: number;
};

export async function executeTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  const start = Date.now();
  const db = await getDb();
  if (!db) {
    return { tool: toolName, success: false, error: "DB 연결 실패", queryTime: Date.now() - start };
  }

  try {
    switch (toolName) {
      case "get_bookings_summary":
        return await getBookingsSummary(db, args, start);
      case "get_packages_list":
        return await getPackagesList(db, args, start);
      case "get_settlement_summary":
        return await getSettlementSummary(db, args, start);
      case "get_ai_cost_summary":
        return await getAiCostSummary(db, args, start);
      case "get_dev_requests":
        return await getDevRequests(db, args, start);
      case "get_error_logs":
        return await getErrorLogs(db, args, start);
      case "get_customer_info":
        return await getCustomerInfo(db, args, start);
      case "get_inquiry_summary":
        return await getInquirySummary(db, args, start);
      case "get_ai_chat_logs":
        return await getAiChatLogs(db, args, start);
      case "get_system_health":
        return await getSystemHealth(db, start);
      case "schedule_task":
        return await scheduleTask(db, args, start);
      case "web_search":
        return await webSearch(args, start);
      case "fetch_url":
        return await fetchUrl(args, start);
      case "set_session_state":
        return await setSessionState(db, args, start);
      case "get_session_state":
        return await getSessionState(db, args, start);
      default:
        return { tool: toolName, success: false, error: `알 수 없는 도구: ${toolName}`, queryTime: Date.now() - start };
    }
  } catch (err) {
    return {
      tool: toolName,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      queryTime: Date.now() - start,
    };
  }
}

// ─── 기간 계산 헬퍼 ─────────────────────────────────────────────

function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case "today": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "month": {
      const d = new Date(now);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    default:
      return new Date(0);
  }
}

// ─── 개별 Tool 구현 ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getBookingsSummary(db: any, args: Record<string, unknown>, start: number): Promise<ToolCallResult> {
  const period = (args.period as string) || "today";
  const statusFilter = (args.status as string) || "all";
  const limit = Math.min(Number(args.limit) || 20, 100);
  const periodStart = getPeriodStart(period);

  const conditions = [gte(bookings.createdAt, periodStart)];
  if (statusFilter !== "all") {
    conditions.push(eq(bookings.status, statusFilter as "pending" | "confirmed" | "cancelled" | "completed"));
  }

  const rows = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      leaderName: bookings.leaderName,
      leaderPhone: bookings.leaderPhone,
      totalAmount: bookings.totalAmount,
      paidAmount: bookings.paidAmount,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      departureDate: bookings.departureDate,
      totalPeople: bookings.totalPeople,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .where(and(...conditions))
    .orderBy(desc(bookings.createdAt))
    .limit(limit);

  // 집계
  const [agg] = await db
    .select({
      totalCount: count(),
      totalRevenue: sum(bookings.totalAmount),
      paidRevenue: sum(bookings.paidAmount),
    })
    .from(bookings)
    .where(and(...conditions));

  // 마스킹
  const maskedRows = rows.map((r: typeof rows[0]) => ({
    ...r,
    leaderPhone: maskPhone(r.leaderPhone),
  }));

  const now = new Date();
  return {
    tool: "get_bookings_summary",
    success: true,
    data: {
      period,
      queryAt: now.toTimeString().slice(0, 8),
      summary: {
        totalCount: agg?.totalCount ?? 0,
        totalRevenue: agg?.totalRevenue ?? "0",
        paidRevenue: agg?.paidRevenue ?? "0",
      },
      bookings: maskedRows,
      source: "bookings 테이블",
    },
    queryTime: Date.now() - start,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPackagesList(db: any, args: Record<string, unknown>, start: number): Promise<ToolCallResult> {
  const statusFilter = (args.status as string) || "all";
  const limit = Math.min(Number(args.limit) || 20, 100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];
  if (statusFilter === "active") conditions.push(eq(packages.status, "active"));
  else if (statusFilter === "inactive") conditions.push(eq(packages.status, "inactive"));
  if (args.country && args.country !== "전체") {
    conditions.push(eq(packages.country, args.country as string));
  }

  const rows = await db
    .select({
      id: packages.id,
      title: packages.title,
      country: packages.country,
      duration: packages.duration,
      status: packages.status,
      isFeatured: packages.isFeatured,
      isPopular: packages.isPopular,
      createdAt: packages.createdAt,
    })
    .from(packages)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(packages.createdAt))
    .limit(limit);

  const [agg] = await db
    .select({ total: count(), active: sql<number>`SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)` })
    .from(packages);

  return {
    tool: "get_packages_list",
    success: true,
    data: {
      queryAt: new Date().toTimeString().slice(0, 8),
      summary: { total: agg?.total ?? 0, active: agg?.active ?? 0 },
      packages: rows,
      source: "packages 테이블",
    },
    queryTime: Date.now() - start,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSettlementSummary(db: any, args: Record<string, unknown>, start: number): Promise<ToolCallResult> {
  const period = (args.period as string) || "month";
  const statusFilter = (args.status as string) || "all";
  const periodStart = getPeriodStart(period);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [gte(settlements.createdAt, periodStart)];
  if (statusFilter !== "all") {
    conditions.push(eq(settlements.status, statusFilter as "pending" | "paid" | "overdue"));
  }

  const rows = await db
    .select({
      id: settlements.id,
      supplierName: settlements.supplierName,
      supplierType: settlements.supplierType,
      amount: settlements.amount,
      currency: settlements.currency,
      dueDate: settlements.dueDate,
      paidDate: settlements.paidDate,
      status: settlements.status,
    })
    .from(settlements)
    .where(and(...conditions))
    .orderBy(desc(settlements.createdAt))
    .limit(50);

  const [agg] = await db
    .select({
      totalAmount: sum(settlements.amount),
      pendingCount: sql<number>`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`,
      overdueCount: sql<number>`SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END)`,
    })
    .from(settlements)
    .where(and(...conditions));

  return {
    tool: "get_settlement_summary",
    success: true,
    data: {
      period,
      queryAt: new Date().toTimeString().slice(0, 8),
      summary: {
        totalAmount: agg?.totalAmount ?? "0",
        pendingCount: agg?.pendingCount ?? 0,
        overdueCount: agg?.overdueCount ?? 0,
      },
      settlements: rows,
      source: "settlements 테이블",
    },
    queryTime: Date.now() - start,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAiCostSummary(db: any, args: Record<string, unknown>, start: number): Promise<ToolCallResult> {
  const period = (args.period as string) || "month";
  const groupBy = (args.groupBy as string) || "model";
  const periodStart = getPeriodStart(period);

  let groupExpr;
  if (groupBy === "model") groupExpr = aiCostLogs.model;
  else if (groupBy === "assistant") groupExpr = aiCostLogs.assistant;
  else if (groupBy === "taskType") groupExpr = aiCostLogs.taskType;
  else groupExpr = sql`DATE(createdAt)`;

  const rows = await db
    .select({
      group: groupExpr,
      totalCost: sum(aiCostLogs.costUsd),
      totalTokensIn: sum(aiCostLogs.inputTokens),
      totalTokensOut: sum(aiCostLogs.outputTokens),
      callCount: count(),
      avgDurationMs: sql<number>`AVG(duration_ms)`,
    })
    .from(aiCostLogs)
    .where(gte(aiCostLogs.createdAt, periodStart))
    .groupBy(groupExpr)
    .orderBy(desc(sum(aiCostLogs.costUsd)))
    .limit(20);

  const [total] = await db
    .select({
      totalCostUsd: sum(aiCostLogs.costUsd),
      totalCalls: count(),
    })
    .from(aiCostLogs)
    .where(gte(aiCostLogs.createdAt, periodStart));

  return {
    tool: "get_ai_cost_summary",
    success: true,
    data: {
      period,
      groupBy,
      queryAt: new Date().toTimeString().slice(0, 8),
      summary: {
        totalCostUsd: total?.totalCostUsd ?? "0",
        totalCalls: total?.totalCalls ?? 0,
      },
      breakdown: rows,
      source: "ai_cost_logs 테이블",
    },
    queryTime: Date.now() - start,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDevRequests(db: any, args: Record<string, unknown>, start: number): Promise<ToolCallResult> {
  const statusFilter = (args.status as string) || "all";
  const priorityFilter = (args.priority as string) || "all";
  const limit = Math.min(Number(args.limit) || 20, 100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];
  if (statusFilter !== "all") {
    conditions.push(eq(devRequests.status, statusFilter as "pending" | "in_progress" | "completed" | "cancelled"));
  }
  if (priorityFilter !== "all") {
    conditions.push(eq(devRequests.priority, priorityFilter as "critical" | "high" | "medium" | "low"));
  }

  const rows = await db
    .select({
      id: devRequests.id,
      title: devRequests.title,
      priority: devRequests.priority,
      status: devRequests.status,
      module: devRequests.module,
      estimatedHours: devRequests.estimatedHours,
      source: devRequests.source,
      manusTaskId: devRequests.manusTaskId,
      createdAt: devRequests.createdAt,
    })
    .from(devRequests)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(devRequests.createdAt))
    .limit(limit);

  const [agg] = await db
    .select({
      total: count(),
      pending: sql<number>`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`,
      inProgress: sql<number>`SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END)`,
      critical: sql<number>`SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END)`,
    })
    .from(devRequests);

  return {
    tool: "get_dev_requests",
    success: true,
    data: {
      queryAt: new Date().toTimeString().slice(0, 8),
      summary: {
        total: agg?.total ?? 0,
        pending: agg?.pending ?? 0,
        inProgress: agg?.inProgress ?? 0,
        critical: agg?.critical ?? 0,
      },
      requests: rows,
      source: "dev_requests 테이블",
    },
    queryTime: Date.now() - start,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getErrorLogs(db: any, args: Record<string, unknown>, start: number): Promise<ToolCallResult> {
  const hours = Number(args.hours) || 24;
  const statusFilter = (args.status as string) || "all";
  const errorTypeFilter = (args.errorType as string) || "all";
  const limit = Math.min(Number(args.limit) || 20, 100);

  const since = new Date(Date.now() - hours * 3600 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [gte(aiEngineLogs.createdAt, since)];
  if (statusFilter !== "all") {
    conditions.push(eq(aiEngineLogs.status, statusFilter as "new" | "analyzing" | "fixed" | "ignored"));
  }
  if (errorTypeFilter !== "all") {
    conditions.push(eq(aiEngineLogs.errorType, errorTypeFilter as "runtime" | "api" | "validation" | "unknown"));
  }

  const rows = await db
    .select({
      id: aiEngineLogs.id,
      source: aiEngineLogs.source,
      errorType: aiEngineLogs.errorType,
      errorMessage: aiEngineLogs.errorMessage,
      path: aiEngineLogs.path,
      status: aiEngineLogs.status,
      createdAt: aiEngineLogs.createdAt,
    })
    .from(aiEngineLogs)
    .where(and(...conditions))
    .orderBy(desc(aiEngineLogs.createdAt))
    .limit(limit);

  const [agg] = await db
    .select({
      total: count(),
      newCount: sql<number>`SUM(CASE WHEN ${aiEngineLogs.status} = 'new' THEN 1 ELSE 0 END)`,
      apiErrors: sql<number>`SUM(CASE WHEN ${aiEngineLogs.errorType} = 'api' THEN 1 ELSE 0 END)`,
    })
    .from(aiEngineLogs)
    .where(and(...conditions));

  return {
    tool: "get_error_logs",
    success: true,
    data: {
      period: `최근 ${hours}시간`,
      queryAt: new Date().toTimeString().slice(0, 8),
      summary: {
        total: agg?.total ?? 0,
        newCount: agg?.newCount ?? 0,
        apiErrors: agg?.apiErrors ?? 0,
      },
      logs: rows,
      source: "ai_engine_logs 테이블",
    },
    queryTime: Date.now() - start,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCustomerInfo(db: any, args: Record<string, unknown>, start: number): Promise<ToolCallResult> {
  const search = (args.search as string) || "";
  const limit = Math.min(Number(args.limit) || 10, 20);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      sql`name LIKE ${`%${search}%`} OR email LIKE ${`%${search}%`}`
    )
    .limit(limit);

  const maskedRows = rows.map((r: typeof rows[0]) => ({
    ...r,
    email: maskEmail(r.email),
  }));

  return {
    tool: "get_customer_info",
    success: true,
    data: {
      search,
      queryAt: new Date().toTimeString().slice(0, 8),
      customers: maskedRows,
      note: "연락처는 개인정보 보호를 위해 마스킹 처리됨",
      source: "users 테이블",
    },
    queryTime: Date.now() - start,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getInquirySummary(db: any, args: Record<string, unknown>, start: number): Promise<ToolCallResult> {
  const period = (args.period as string) || "week";
  const statusFilter = (args.status as string) || "all";
  const limit = Math.min(Number(args.limit) || 20, 100);
  const periodStart = getPeriodStart(period);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [gte(inquiries.createdAt, periodStart)];
  if (statusFilter !== "all") {
    conditions.push(eq(inquiries.status, statusFilter as "new" | "in_progress" | "replied" | "closed"));
  }

  const rows = await db
    .select({
      id: inquiries.id,
      name: inquiries.name,
      phone: inquiries.phone,
      packageName: inquiries.packageName,
      travelDate: inquiries.travelDate,
      peopleCount: inquiries.peopleCount,
      status: inquiries.status,
      createdAt: inquiries.createdAt,
    })
    .from(inquiries)
    .where(and(...conditions))
    .orderBy(desc(inquiries.createdAt))
    .limit(limit);

  const [agg] = await db
    .select({
      total: count(),
      pending: sql<number>`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`,
    })
    .from(inquiries)
    .where(and(...conditions));

  const maskedRows = rows.map((r: typeof rows[0]) => ({
    ...r,
    phone: maskPhone(r.phone),
  }));

  return {
    tool: "get_inquiry_summary",
    success: true,
    data: {
      period,
      queryAt: new Date().toTimeString().slice(0, 8),
      summary: { total: agg?.total ?? 0, pending: agg?.pending ?? 0 },
      inquiries: maskedRows,
      source: "inquiries 테이블",
    },
    queryTime: Date.now() - start,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAiChatLogs(db: any, args: Record<string, unknown>, start: number): Promise<ToolCallResult> {
  const assistantFilter = (args.assistant as string) || "all";
  const period = (args.period as string) || "today";
  const limit = Math.min(Number(args.limit) || 20, 100);
  const periodStart = getPeriodStart(period);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [gte(aiLogs.createdAt, periodStart)];
  if (assistantFilter !== "all") {
    conditions.push(eq(aiLogs.assistant, assistantFilter as "master" | "golftalk" | "manager"));
  }

  const rows = await db
    .select({
      id: aiLogs.id,
      sessionId: aiLogs.sessionId,
      assistant: aiLogs.assistant,
      role: aiLogs.role,
      modelUsed: aiLogs.modelUsed,
      tokensIn: aiLogs.tokensIn,
      tokensOut: aiLogs.tokensOut,
      costUsd: aiLogs.costUsd,
      createdAt: aiLogs.createdAt,
    })
    .from(aiLogs)
    .where(and(...conditions))
    .orderBy(desc(aiLogs.createdAt))
    .limit(limit);

  const [agg] = await db
    .select({
      totalCalls: count(),
      totalCost: sum(aiLogs.costUsd),
      uniqueSessions: countDistinct(aiLogs.sessionId),
    })
    .from(aiLogs)
    .where(and(...conditions));

  return {
    tool: "get_ai_chat_logs",
    success: true,
    data: {
      period,
      assistant: assistantFilter,
      queryAt: new Date().toTimeString().slice(0, 8),
      summary: {
        totalCalls: agg?.totalCalls ?? 0,
        totalCostUsd: agg?.totalCost ?? "0",
        uniqueSessions: agg?.uniqueSessions ?? 0,
      },
      logs: rows,
      source: "ai_logs 테이블",
    },
    queryTime: Date.now() - start,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSystemHealth(db: any, start: number): Promise<ToolCallResult> {
  const todayStart = getPeriodStart("today");
  const monthStart = getPeriodStart("month");

  const [bookingToday] = await db
    .select({ count: count(), revenue: sum(bookings.totalAmount) })
    .from(bookings)
    .where(gte(bookings.createdAt, todayStart));

  const [aiCostToday] = await db
    .select({ cost: sum(aiCostLogs.costUsd), calls: count() })
    .from(aiCostLogs)
    .where(gte(aiCostLogs.createdAt, todayStart));

  const [aiCostMonth] = await db
    .select({ cost: sum(aiCostLogs.costUsd) })
    .from(aiCostLogs)
    .where(gte(aiCostLogs.createdAt, monthStart));

  const [errorCount] = await db
    .select({ count: count() })
    .from(aiEngineLogs)
    .where(and(gte(aiEngineLogs.createdAt, todayStart), eq(aiEngineLogs.status, "new")));

  const [devPending] = await db
    .select({ count: count() })
    .from(devRequests)
    .where(eq(devRequests.status, "pending"));

  const [inquiryPending] = await db
    .select({ count: count() })
    .from(inquiries)
    .where(eq(inquiries.status, "new"));

  return {
    tool: "get_system_health",
    success: true,
    data: {
      queryAt: new Date().toTimeString().slice(0, 8),
      today: {
        newBookings: bookingToday?.count ?? 0,
        revenue: bookingToday?.revenue ?? "0",
        aiCostUsd: aiCostToday?.cost ?? "0",
        aiCalls: aiCostToday?.calls ?? 0,
        newErrors: errorCount?.count ?? 0,
      },
      month: {
        aiCostUsd: aiCostMonth?.cost ?? "0",
      },
      pending: {
        devRequests: devPending?.count ?? 0,
        inquiries: inquiryPending?.count ?? 0,
      },
      source: "bookings, ai_cost_logs, ai_engine_logs, dev_requests, inquiries 테이블",
    },
    queryTime: Date.now() - start,
  };
}

// ─── schedule_task 도구 구현 ─────────────────────────────────────

async function scheduleTask(
  db: Awaited<ReturnType<typeof getDb>>,
  args: Record<string, unknown>,
  start: number
): Promise<ToolCallResult> {
  if (!db) return { tool: "schedule_task", success: false, error: "DB 연결 실패", queryTime: Date.now() - start };

  const title = String(args.title ?? "");
  const prompt = String(args.prompt ?? "");
  const scheduledAtStr = String(args.scheduledAt ?? "");
  const taskType = (args.taskType as "report" | "reminder" | "analysis" | "custom") ?? "custom";
  const notifyOnComplete = args.notifyOnComplete !== false;

  if (!title || !prompt || !scheduledAtStr) {
    return {
      tool: "schedule_task",
      success: false,
      error: "title, prompt, scheduledAt 파라미터가 필요합니다.",
      queryTime: Date.now() - start,
    };
  }

  const scheduledAt = new Date(scheduledAtStr);
  if (isNaN(scheduledAt.getTime())) {
    return {
      tool: "schedule_task",
      success: false,
      error: `scheduledAt 형식이 올바르지 않습니다: ${scheduledAtStr}`,
      queryTime: Date.now() - start,
    };
  }

  // 과거 시각 방지 (5분 이상 과거)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (scheduledAt < fiveMinutesAgo) {
    return {
      tool: "schedule_task",
      success: false,
      error: "예약 시각은 현재 시각 이후여야 합니다.",
      queryTime: Date.now() - start,
    };
  }

  const [result] = await db
    .insert(aiScheduledTasks)
    .values({
      taskType,
      title,
      prompt,
      scheduledAt,
      status: "pending",
      notifyOnComplete,
    })
    .$returningId();

  const id = result?.id;
  if (!id) {
    return { tool: "schedule_task", success: false, error: "작업 등록 실패", queryTime: Date.now() - start };
  }

  // 한국 시간으로 표시
  const kstTime = new Date(scheduledAt.getTime() + 9 * 60 * 60 * 1000);
  const timeStr = kstTime.toLocaleString("ko-KR", { timeZone: "UTC" });

  return {
    tool: "schedule_task",
    success: true,
    data: {
      id,
      title,
      scheduledAt: scheduledAt.toISOString(),
      scheduledAtKST: timeStr,
      taskType,
      notifyOnComplete,
      message: `✅ 작업이 예약되었습니다. ID: ${id}\n예약 시각: ${timeStr} (KST)\n완료 시 알림: ${notifyOnComplete ? "예" : "아니오"}`,
    },
    queryTime: Date.now() - start,
  };
}

// ─── 외부 검색 도구 구현 ─────────────────────────────────────────
async function webSearch(args: Record<string, unknown>, start: number): Promise<ToolCallResult> {
  const query = String(args.query || "");
  const count = Math.min(Number(args.count || 5), 10);
  if (!query) {
    return { tool: "web_search", success: false, error: "검색 쿼리가 필요합니다", queryTime: Date.now() - start };
  }
  try {
    // Manus 내장 검색 API 활용 (BUILT_IN_FORGE_API)
    const forgeUrl = process.env.BUILT_IN_FORGE_API_URL?.replace(/\/+$/, "");
    const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;
    if (!forgeUrl || !forgeKey) {
      return { tool: "web_search", success: false, error: "검색 API 미설정", queryTime: Date.now() - start };
    }
    const resp = await fetch(`${forgeUrl}/v1/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${forgeKey}` },
      body: JSON.stringify({ query, count }),
    });
    if (!resp.ok) {
      // fallback: 간단한 결과 반환
      return {
        tool: "web_search",
        success: true,
        data: { query, results: [], message: `'${query}' 검색 완료 (결과 없음 - API 응답 오류: ${resp.status})` },
        queryTime: Date.now() - start,
      };
    }
    const data = await resp.json();
    return {
      tool: "web_search",
      success: true,
      data: { query, results: data.results || data, count: (data.results || data)?.length || 0 },
      queryTime: Date.now() - start,
    };
  } catch (err) {
    return {
      tool: "web_search",
      success: false,
      error: err instanceof Error ? err.message : String(err),
      queryTime: Date.now() - start,
    };
  }
}

async function fetchUrl(args: Record<string, unknown>, start: number): Promise<ToolCallResult> {
  const url = String(args.url || "");
  const extractText = args.extractText !== false;
  if (!url || !url.startsWith("http")) {
    return { tool: "fetch_url", success: false, error: "유효한 URL이 필요합니다", queryTime: Date.now() - start };
  }
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DogolfBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      return { tool: "fetch_url", success: false, error: `HTTP ${resp.status}: ${resp.statusText}`, queryTime: Date.now() - start };
    }
    const html = await resp.text();
    let content = html;
    if (extractText) {
      // 간단한 HTML 태그 제거
      content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 5000); // 최대 5000자
    }
    return {
      tool: "fetch_url",
      success: true,
      data: { url, content, length: content.length },
      queryTime: Date.now() - start,
    };
  } catch (err) {
    return {
      tool: "fetch_url",
      success: false,
      error: err instanceof Error ? err.message : String(err),
      queryTime: Date.now() - start,
    };
  }
}

async function setSessionState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  args: Record<string, unknown>,
  start: number
): Promise<ToolCallResult> {
  const sessionId = String(args.sessionId || "default");
  const key = String(args.key || "");
  const value = String(args.value || "");
  const ttlMinutes = Number(args.ttlMinutes || 60);
  if (!key) {
    return { tool: "set_session_state", success: false, error: "키가 필요합니다", queryTime: Date.now() - start };
  }
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  // upsert: 기존 키 있으면 업데이트
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .insert(aiSessionState)
    .values({ sessionId, stateKey: key, stateValue: value, expiresAt })
    .onDuplicateKeyUpdate({ set: { stateValue: value, expiresAt } });
  return {
    tool: "set_session_state",
    success: true,
    data: { key, saved: true, expiresAt: expiresAt.toISOString() },
    queryTime: Date.now() - start,
  };
}

async function getSessionState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  args: Record<string, unknown>,
  start: number
): Promise<ToolCallResult> {
  const sessionId = String(args.sessionId || "default");
  const key = String(args.key || "");
  if (!key) {
    return { tool: "get_session_state", success: false, error: "키가 필요합니다", queryTime: Date.now() - start };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (db as any)
    .select()
    .from(aiSessionState)
    .where(and(eq(aiSessionState.sessionId, sessionId), eq(aiSessionState.stateKey, key)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { tool: "get_session_state", success: true, data: { key, value: null, found: false }, queryTime: Date.now() - start };
  }
  // 만료 확인
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
    return { tool: "get_session_state", success: true, data: { key, value: null, found: false, expired: true }, queryTime: Date.now() - start };
  }
  return {
    tool: "get_session_state",
    success: true,
    data: { key, value: row.stateValue, found: true },
    queryTime: Date.now() - start,
  };
}

