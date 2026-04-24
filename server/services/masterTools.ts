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
} from "../../drizzle/schema";
import { eq, gte, lte, and, sql, desc, count, sum, isNull } from "drizzle-orm";
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
];

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
  else if (groupBy === "assistant") groupExpr = aiCostLogs.taskType;
  else groupExpr = sql`DATE(created_at)`;

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
      newCount: sql<number>`SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END)`,
      apiErrors: sql<number>`SUM(CASE WHEN error_type = 'api' THEN 1 ELSE 0 END)`,
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
      uniqueSessions: sql<number>`COUNT(DISTINCT session_id)`,
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
