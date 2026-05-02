/**
 * AI 모델 라우팅 설정 tRPC 라우터
 *
 * - list: 현재 라우팅 규칙 목록 조회
 * - update: 특정 복잡도 모델 변경
 * - reset: 기본값으로 초기화
 * - getLogs: 라우팅 호출 이력 조회
 * - getStats: 비용 통계 집계
 * - addLog: 라우팅 로그 기록 (내부 서비스용)
 * - getAvailableModels: OpenRouter 사용 가능 모델 목록
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, gte, sql } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { modelRoutingRules, aiRoutingLogs } from "../../drizzle/schema";
import { ENV } from "../_core/env";

// 관리자 전용 프로시저
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});

// 기본 모델 설정 (DB 초기화 또는 폴백용)
export const DEFAULT_MODEL_RULES = [
  {
    complexity: "high" as const,
    modelId: "google/gemini-2.5-pro-preview-05-06",
    modelName: "Gemini 2.5 Pro Preview",
    inputPricePerMillion: "1.25",
    outputPricePerMillion: "10.0",
    description: "추론·분석·오류검수 등 고복잡도 작업",
    isActive: true,
    priority: 1,
  },
  {
    complexity: "medium" as const,
    modelId: "google/gemini-2.5-flash",
    modelName: "Gemini 2.5 Flash",
    inputPricePerMillion: "0.15",
    outputPricePerMillion: "0.6",
    description: "생성·요약·상담 등 중간 복잡도 작업",
    isActive: true,
    priority: 2,
  },
  {
    complexity: "low" as const,
    modelId: "google/gemini-2.0-flash-lite-001",
    modelName: "Gemini 2.0 Flash Lite",
    inputPricePerMillion: "0.075",
    outputPricePerMillion: "0.3",
    description: "분류·태깅·단순응답 등 저복잡도 작업",
    isActive: true,
    priority: 3,
  },
];

/**
 * DB에서 복잡도별 모델 설정을 조회합니다.
 * 없으면 기본값을 반환합니다.
 */
export async function getModelRuleFromDb(
  complexity: "high" | "medium" | "low"
): Promise<{ modelId: string; modelName: string; inputPrice: number; outputPrice: number }> {
  try {
    const db = await getDb();
    if (!db) throw new Error("DB 연결 실패");

    const [rule] = await db
      .select()
      .from(modelRoutingRules)
      .where(eq(modelRoutingRules.complexity, complexity))
      .limit(1);

    if (rule && rule.isActive) {
      return {
        modelId: rule.modelId,
        modelName: rule.modelName,
        inputPrice: parseFloat(rule.inputPricePerMillion ?? "0"),
        outputPrice: parseFloat(rule.outputPricePerMillion ?? "0"),
      };
    }
  } catch (err) {
    console.warn(`[ModelRouting] DB 조회 실패, 기본값 사용: ${err}`);
  }

  // 폴백: 기본값
  const def = DEFAULT_MODEL_RULES.find((r) => r.complexity === complexity);
  return {
    modelId: def?.modelId ?? "google/gemini-2.5-flash",
    modelName: def?.modelName ?? "Gemini 2.5 Flash",
    inputPrice: parseFloat(def?.inputPricePerMillion ?? "0.15"),
    outputPrice: parseFloat(def?.outputPricePerMillion ?? "0.6"),
  };
}

/**
 * AI 라우팅 로그를 DB에 기록합니다.
 */
export async function recordRoutingLog(data: {
  taskType?: string;
  complexity: "high" | "medium" | "low";
  modelId: string;
  modelName?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  durationMs?: number;
  cacheHit?: boolean;
  isSuccess?: boolean;
  errorMessage?: string;
  assistantType?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(aiRoutingLogs).values({
      taskType: data.taskType,
      complexity: data.complexity,
      modelId: data.modelId,
      modelName: data.modelName,
      tokensIn: data.tokensIn ?? 0,
      tokensOut: data.tokensOut ?? 0,
      costUsd: String(data.costUsd ?? 0),
      durationMs: data.durationMs ?? 0,
      cacheHit: data.cacheHit ?? false,
      isSuccess: data.isSuccess ?? true,
      errorMessage: data.errorMessage,
      assistantType: data.assistantType,
    });
  } catch (err) {
    console.warn("[ModelRouting] 로그 기록 실패:", err);
  }
}

export const modelRoutingRouter = router({
  /** 현재 라우팅 규칙 목록 조회 */
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

    const rules = await db
      .select()
      .from(modelRoutingRules)
      .orderBy(modelRoutingRules.priority);

    return rules;
  }),

  /** 특정 복잡도 모델 설정 변경 */
  update: adminProcedure
    .input(
      z.object({
        complexity: z.enum(["high", "medium", "low"]),
        modelId: z.string().min(1),
        modelName: z.string().min(1),
        inputPricePerMillion: z.number().min(0),
        outputPricePerMillion: z.number().min(0),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      const [existing] = await db
        .select()
        .from(modelRoutingRules)
        .where(eq(modelRoutingRules.complexity, input.complexity))
        .limit(1);

      if (existing) {
        await db
          .update(modelRoutingRules)
          .set({
            modelId: input.modelId,
            modelName: input.modelName,
            inputPricePerMillion: String(input.inputPricePerMillion),
            outputPricePerMillion: String(input.outputPricePerMillion),
            description: input.description,
            isActive: input.isActive ?? true,
            updatedBy: ctx.user.name ?? ctx.user.openId,
          })
          .where(eq(modelRoutingRules.complexity, input.complexity));
      } else {
        await db.insert(modelRoutingRules).values({
          complexity: input.complexity,
          modelId: input.modelId,
          modelName: input.modelName,
          inputPricePerMillion: String(input.inputPricePerMillion),
          outputPricePerMillion: String(input.outputPricePerMillion),
          description: input.description,
          isActive: input.isActive ?? true,
          priority: input.complexity === "high" ? 1 : input.complexity === "medium" ? 2 : 3,
          updatedBy: ctx.user.name ?? ctx.user.openId,
        });
      }

      return { success: true };
    }),

  /** 기본값으로 초기화 */
  reset: adminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

    await db.delete(modelRoutingRules);
    for (const rule of DEFAULT_MODEL_RULES) {
      await db.insert(modelRoutingRules).values({
        ...rule,
        inputPricePerMillion: rule.inputPricePerMillion,
        outputPricePerMillion: rule.outputPricePerMillion,
        updatedBy: ctx.user.name ?? ctx.user.openId,
      });
    }

    return { success: true };
  }),

  /** 라우팅 로그 조회 (최근 200건) */
  getLogs: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(500).default(100),
        complexity: z.enum(["high", "medium", "low"]).optional(),
        assistantType: z.string().optional(),
        onlyErrors: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      let query = db.select().from(aiRoutingLogs).$dynamic();

      if (input.complexity) {
        query = query.where(eq(aiRoutingLogs.complexity, input.complexity));
      }

      const logs = await query
        .orderBy(desc(aiRoutingLogs.createdAt))
        .limit(input.limit);

      return logs;
    }),

  /** 비용 통계 집계 */
  getStats: adminProcedure
    .input(
      z.object({
        /** 집계 기간 (일 단위, 기본 30일) */
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const stats = await db
        .select({
          complexity: aiRoutingLogs.complexity,
          modelId: aiRoutingLogs.modelId,
          modelName: aiRoutingLogs.modelName,
          callCount: sql<number>`COUNT(*)`,
          totalTokensIn: sql<number>`SUM(tokensIn)`,
          totalTokensOut: sql<number>`SUM(tokensOut)`,
          totalCostUsd: sql<number>`SUM(costUsd)`,
          avgDurationMs: sql<number>`AVG(durationMs)`,
          errorCount: sql<number>`SUM(CASE WHEN isSuccess = 0 THEN 1 ELSE 0 END)`,
        })
        .from(aiRoutingLogs)
        .where(gte(aiRoutingLogs.createdAt, since))
        .groupBy(aiRoutingLogs.complexity, aiRoutingLogs.modelId, aiRoutingLogs.modelName);

      const totalCost = stats.reduce((sum, s) => sum + Number(s.totalCostUsd ?? 0), 0);
      const totalCalls = stats.reduce((sum, s) => sum + Number(s.callCount ?? 0), 0);

      return {
        stats,
        summary: {
          totalCostUsd: totalCost,
          totalCalls,
          periodDays: input.days,
        },
      };
    }),

  /** 라우팅 로그 기록 (내부 서비스 → tRPC 경유) */
  addLog: protectedProcedure
    .input(
      z.object({
        taskType: z.string().optional(),
        complexity: z.enum(["high", "medium", "low"]),
        modelId: z.string(),
        modelName: z.string().optional(),
        tokensIn: z.number().optional(),
        tokensOut: z.number().optional(),
        costUsd: z.number().optional(),
        durationMs: z.number().optional(),
        cacheHit: z.boolean().optional(),
        isSuccess: z.boolean().optional(),
        errorMessage: z.string().optional(),
        assistantType: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await recordRoutingLog(input);
      return { success: true };
    }),

  /** 사용 가능한 OpenRouter 모델 목록 조회 */
  getAvailableModels: adminProcedure.query(async () => {
    const apiKey = ENV.openrouterApiKey;
    if (!apiKey) {
      return { models: [], error: "OPENROUTER_API_KEY가 설정되지 않았습니다." };
    }

    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        data: Array<{
          id: string;
          name: string;
          pricing: { prompt: string; completion: string };
          context_length: number;
        }>;
      };

      // Gemini 계열 + 주요 모델만 필터링
      const filtered = data.data
        .filter((m) =>
          m.id.includes("gemini") ||
          m.id.includes("claude") ||
          m.id.includes("gpt-4") ||
          m.id.includes("llama")
        )
        .slice(0, 50)
        .map((m) => ({
          id: m.id,
          name: m.name,
          inputPricePerMillion: parseFloat(m.pricing.prompt) * 1_000_000,
          outputPricePerMillion: parseFloat(m.pricing.completion) * 1_000_000,
          contextLength: m.context_length,
        }));

      return { models: filtered, error: null };
    } catch (err) {
      return { models: [], error: String(err) };
    }
  }),
});
