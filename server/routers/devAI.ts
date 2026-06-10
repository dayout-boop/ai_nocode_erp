/**
 * devAI 라우터 — 개발 요청 관리, AI 엔진, 정확도 분석, 비용 통계
 * routers.ts에서 분리됨 (2026-06-11)
 *
 * 담당 프로시저 (46개):
 * - 개발 요청 CRUD: listRequests, createRequest, updateRequest, deleteRequest, getRequest, dashboardStats
 * - AI 실행 엔진: ask, analyzeRequest, generateFix, runReview, autoFixer, selfDevelop, detectAndComplete
 * - 정확도/비용 통계: accuracyStats, engineAccuracyComparison, getCostStats, getModelPricing 등
 */
import { publicProcedure, protectedProcedure, partnerProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import {
  devRequests, devFeatures, devVersions,
  aiCostLogs, aiEngineLogs, aiFixRequests, aiReviewResults,
  aiLogs,
  bookings, packages, payments, packageVideos,
} from "../../drizzle/schema";
import { eq, desc, and, gte, lte, sql, count, asc, or, max, min, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { orchestrate, getModelPricing, detectComplexity, MODEL_CATALOG, getCacheStats, clearCache, type TaskType, type TaskComplexity } from "../_core/orchestrator";
import { invokeLLM } from "../_core/llm";
import { generateFixCode, searchErpFeature } from "../_core/autoFixer";
import { runFullReview } from "../_core/reviewEngine";
import { ENV } from "../_core/env";
import { createPaymentIntent, getPaymentStatus } from "../stripe";
import { generateGolfVideo, getVideoGenerationStatus } from "../_core/runway";
import { reportError, isCriticalError } from "../_core/errorWatcher";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});

export const devAIRouter = router({
  listRequests: adminProcedure.input(z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    status: z.string().optional(),
    priority: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const offset = (input.page - 1) * input.limit;
    const conditions: ReturnType<typeof eq>[] = [];
    if (input.status) conditions.push(eq(devRequests.status, input.status));
    if (input.priority) conditions.push(eq(devRequests.priority, input.priority));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [items, totalResult] = await Promise.all([
      db.select().from(devRequests).where(where).orderBy(desc(devRequests.createdAt)).limit(input.limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(devRequests).where(where),
    ]);
    return { items, total: Number(totalResult[0]?.count ?? 0) };
  }),
  createRequest: adminProcedure.input(z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    priority: z.enum(["high", "medium", "low"]).default("medium"),
    featureId: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [result] = await db.insert(devRequests).values({
      title: input.title,
      description: input.description,
      priority: input.priority,
      featureId: input.featureId,
      createdBy: ctx.user.id,
      createdByName: ctx.user.name ?? "",
      source: "manual",
    });
    const newId = (result as any).insertId;
    // 백그라운드 AI 자동 분석 (응답 지연 없이 비동기 실행)
    setImmediate(async () => {
      try {
        const { analyzeDevRequest } = await import("../_core/geminiAIService.js");
        const analysis = await analyzeDevRequest(input.description);
        const dbInner = await getDb();
        if (dbInner && newId) {
          await dbInner.update(devRequests).set({
            aiCategory: analysis.category,
            aiSuggestedPriority: analysis.priority,
            estimatedHours: analysis.estimatedHours,
            suggestedTeam: analysis.suggestedTeam,
            aiAnalysis: `유형: ${analysis.category} | 우선순위: ${analysis.priority} | 예상공수: ${analysis.estimatedHours}h | 담당팀: ${analysis.suggestedTeam}\n\n${analysis.analysis}`,
            aiAnalyzed: true,
          }).where(eq(devRequests.id, newId));
        }
      } catch (e) {
        console.error("[createRequest] AI 자동 분석 실패:", e);
      }
    });
    return { id: newId, success: true };
  }),
  updateRequest: adminProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(["pending", "in_progress", "completed", "rejected", "approved"]).optional(),
    priority: z.enum(["high", "medium", "low"]).optional(),
    result: z.string().optional(),
    slackMessageTs: z.string().optional(),
    slackChannelId: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...rawData } = input;
    // undefined 필드 제거 (Drizzle ORM이 undefined를 null로 처리하는 버그 방지)
    const data = Object.fromEntries(
      Object.entries(rawData).filter(([, v]) => v !== undefined)
    ) as Partial<typeof rawData>;
    await db.update(devRequests).set({ ...data, updatedAt: new Date() }).where(eq(devRequests.id, id));
    return { success: true };
  }),
  deleteRequest: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(devRequests).where(eq(devRequests.id, input.id));
    return { success: true };
  }),

  /**
   * Manus 태스크 메시지에서 결과물 자동 수집
   * manusTaskId가 있는 요청에 대해 task.listMessages를 호출하여
   * 마지막 assistant_message를 result 필드에 저장
   */
  fetchManusResult: adminProcedure.input(z.object({
    id: z.number(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [req] = await db.select().from(devRequests).where(eq(devRequests.id, input.id)).limit(1);
    if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "요청을 찾을 수 없습니다." });
    if (!req.manusTaskId) throw new TRPCError({ code: "BAD_REQUEST", message: "Manus 태스크 ID가 없습니다. 먼저 Manus에 전송해주세요." });

    const apiKey = process.env.MANUS_API_KEY;
    if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "MANUS_API_KEY가 설정되지 않았습니다." });

    try {
      const res = await fetch(
        `https://api.manus.ai/v2/task.listMessages?task_id=${encodeURIComponent(req.manusTaskId)}&limit=50&order=desc`,
        {
          headers: {
            "x-manus-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Manus API 오류 [${res.status}]: ${errText.slice(0, 200)}` });
      }

      const data = await res.json() as {
        ok: boolean;
        messages?: Array<{
          type: string;
          assistant_message?: { content: string };
        }>;
      };

      if (!data.ok || !data.messages) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Manus API 응답 형식 오류" });
      }

      // 가장 최근 assistant_message 추출 (desc 순서이므로 첫 번째가 최신)
      const lastAssistant = data.messages.find(
        (m) => m.type === "assistant_message" && m.assistant_message?.content
      );

      if (!lastAssistant?.assistant_message?.content) {
        return { success: false, result: null, message: "Manus에서 아직 응답이 없습니다." };
      }

      const resultText = lastAssistant.assistant_message.content.slice(0, 2000);

      // 체크포인트 버전 ID 추출 (전체 메시지에서 manus-webdev:// 패턴 파싱)
      let extractedCheckpointId: string | null = null;
      const allContent = data.messages
        .filter((m) => m.type === "assistant_message" && m.assistant_message?.content)
        .map((m) => m.assistant_message!.content)
        .join(" ");
      const webdevMatch = allContent.match(/manus-webdev:\/\/([a-f0-9]{8,})/i);
      if (webdevMatch) {
        extractedCheckpointId = webdevMatch[1];
      } else {
        const versionMatch = allContent.match(/version[_\s:-]+([a-f0-9]{8,})/i);
        if (versionMatch) extractedCheckpointId = versionMatch[1];
      }

      // DB에 결과물 + 체크포인트 ID 저장
      await db.update(devRequests).set({
        result: resultText,
        ...(extractedCheckpointId ? { resultCheckpointId: extractedCheckpointId } : {}),
        updatedAt: new Date(),
      }).where(eq(devRequests.id, input.id));

      return {
        success: true,
        result: resultText,
        checkpointId: extractedCheckpointId,
        message: extractedCheckpointId
          ? `결과물이 수집되었습니다. 체크포인트 ID: ${extractedCheckpointId.slice(0, 8)}`
          : "결과물이 자동으로 수집되었습니다.",
      };
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `결과물 수집 실패: ${String(err)}` });
    }
  }),
  sendToSlack: adminProcedure.input(z.object({
    requestId: z.number(),
    webhookUrl: z.string().url().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [req] = await db.select().from(devRequests).where(eq(devRequests.id, input.requestId));
    if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "요청을 찾을 수 없습니다." });
    const webhookUrl = input.webhookUrl ?? ENV.slackWebhookUrl;
    if (!webhookUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "Slack Webhook URL이 설정되지 않았습니다. 설정 페이지에서 Slack Webhook URL을 입력해 주세요." });
    const priorityEmoji: Record<string, string> = { high: "🔴", medium: "🟡", low: "🟢" };
    const statusEmoji: Record<string, string> = { pending: "⏳", in_progress: "🔧", completed: "✅", rejected: "❌" };
    const payload = {
      blocks: [
        { type: "header", text: { type: "plain_text", text: `🔧 두골프 개발요청 #${req.id}`, emoji: true } },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*제목:*\n${req.title}` },
            { type: "mrkdwn", text: `*우선순위:*\n${priorityEmoji[req.priority] ?? "⚪"} ${req.priority}` },
            { type: "mrkdwn", text: `*상태:*\n${statusEmoji[req.status] ?? "❓"} ${req.status}` },
            { type: "mrkdwn", text: `*요청자:*\n${req.createdByName ?? "알 수 없음"}` },
          ],
        },
        { type: "section", text: { type: "mrkdwn", text: `*내용:*\n${req.description}` } },
        ...(req.result ? [{ type: "section", text: { type: "mrkdwn", text: `*결과물:*\n${req.result}` } }] : []),
        { type: "context", elements: [{ type: "mrkdwn", text: `등록일: ${new Date(req.createdAt).toLocaleString("ko-KR")}` }] },
      ],
    };
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Slack 전송 실패: ${response.status}` });
    return { success: true };
  }),
  listFeatures: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(devFeatures).orderBy(asc(devFeatures.category), asc(devFeatures.name));
  }),
  createFeature: adminProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    category: z.string().default("system"),
    currentVersion: z.string().default("1.0.0"),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [result] = await db.insert(devFeatures).values(input);
    return { id: (result as any).insertId, success: true };
  }),
  updateFeature: adminProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    description: z.string().optional(),
    currentVersion: z.string().optional(),
    status: z.enum(["active", "deprecated", "experimental"]).optional(),
    category: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    await db.update(devFeatures).set(data).where(eq(devFeatures.id, id));
    return { success: true };
  }),
  listVersions: adminProcedure.input(z.object({
    featureId: z.number().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const where = input.featureId ? eq(devVersions.featureId, input.featureId) : undefined;
    return db.select().from(devVersions).where(where).orderBy(desc(devVersions.createdAt));
  }),
  createVersion: adminProcedure.input(z.object({
    featureId: z.number(),
    version: z.string().min(1),
    description: z.string().min(1),
    changeType: z.enum(["feature", "bugfix", "refactor", "hotfix"]).default("feature"),
    checkpointId: z.string().optional(),
    isRollbackable: z.boolean().default(true),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [result] = await db.insert(devVersions).values({
      ...input,
      createdBy: ctx.user.id,
      createdByName: ctx.user.name ?? "",
    });
    await db.update(devFeatures).set({ currentVersion: input.version }).where(eq(devFeatures.id, input.featureId));
    return { id: (result as any).insertId, success: true };
  }),
  // ── AI 지능형 분석 프로시저 ──────────────────────────────────────────────
  analyzeRequest: adminProcedure.input(z.object({
    description: z.string().min(1).max(2000),
  })).mutation(async ({ input }) => {
    const { analyzeDevRequest } = await import("../_core/geminiAIService.js");
    return analyzeDevRequest(input.description);
  }),

  createRequestFromNaturalLanguage: adminProcedure.input(z.object({
    userInput: z.string().min(1).max(500),
  })).mutation(async ({ input, ctx }) => {
    const { processNaturalLanguageRequest } = await import("../_core/geminiAIService.js");
    const parsed = await processNaturalLanguageRequest(input.userInput);
    // AI 분석도 함께 실행
    const { analyzeDevRequest } = await import("../_core/geminiAIService.js");
    const analysis = await analyzeDevRequest(parsed.description);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [result] = await db.insert(devRequests).values({
      title: parsed.title,
      description: parsed.description,
      priority: analysis.priority === "critical" ? "high" : analysis.priority,
      createdBy: ctx.user.id,
      createdByName: ctx.user.name ?? "",
      aiCategory: analysis.category,
      aiSuggestedPriority: analysis.priority,
      estimatedHours: analysis.estimatedHours,
      suggestedTeam: analysis.suggestedTeam,
      aiAnalysis: analysis.analysis,
      aiAnalyzed: true,
      source: "manual",
    });
    return { id: (result as any).insertId, success: true, parsed, analysis };
  }),

  generateReleaseNotes: adminProcedure.input(z.object({
    versionId: z.number(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [version] = await db.select().from(devVersions).where(eq(devVersions.id, input.versionId));
    if (!version) throw new TRPCError({ code: "NOT_FOUND", message: "버전을 찾을 수 없습니다." });
    // 해당 버전 이전에 완료된 요청 목록 조회 (최대 50개)
    const completed = await db
      .select({ title: devRequests.title, description: devRequests.description, aiCategory: devRequests.aiCategory })
      .from(devRequests)
      .where(eq(devRequests.status, "completed"))
      .orderBy(desc(devRequests.updatedAt))
      .limit(50);
    const { generateReleaseNotes } = await import("../_core/geminiAIService.js");
    const result = await generateReleaseNotes(
      version.version,
      version.description,
      completed.map(r => ({ title: r.title, description: r.description, category: r.aiCategory ?? "FEATURE" }))
    );
    return result;
  }),

  generateFeatureDoc: adminProcedure.input(z.object({
    featureId: z.number(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [feature] = await db.select().from(devFeatures).where(eq(devFeatures.id, input.featureId));
    if (!feature) throw new TRPCError({ code: "NOT_FOUND", message: "기능을 찾을 수 없습니다." });
    const { generateFeatureDocumentation } = await import("../_core/geminiAIService.js");
    const result = await generateFeatureDocumentation(feature.name, feature.description ?? "");
    return result;
  }),

  recommendPipeline: adminProcedure.input(z.object({
    errorDescription: z.string().min(1).max(500),
    affectedModules: z.array(z.string().max(50)).max(10).default([]),
  })).mutation(async ({ input }) => {
    const { generatePipelineRecommendation } = await import("../_core/geminiAIService.js");
    return generatePipelineRecommendation(input.errorDescription, input.affectedModules);
  }),

  dashboardStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [reqStats, featureStats, versionStats] = await Promise.all([
      db.select({ status: devRequests.status, count: sql<number>`count(*)` }).from(devRequests).groupBy(devRequests.status),
      db.select({ count: sql<number>`count(*)` }).from(devFeatures).where(eq(devFeatures.status, "active")),
      db.select({ count: sql<number>`count(*)` }).from(devVersions),
    ]);
    const reqByStatus = Object.fromEntries(reqStats.map(r => [r.status, Number(r.count)]));
    return {
      totalRequests: Object.values(reqByStatus).reduce((a, b) => a + b, 0),
      pendingRequests: reqByStatus["pending"] ?? 0,
      inProgressRequests: reqByStatus["in_progress"] ?? 0,
      completedRequests: reqByStatus["completed"] ?? 0,
      activeFeatures: Number(featureStats[0]?.count ?? 0),
      totalVersions: Number(versionStats[0]?.count ?? 0),
    };
  }),

  /** 정확도 통계 조회 (AI 응답 정확도 분석) */
  accuracyStats: adminProcedure.input(z.object({
    period: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const now = new Date();
    let fromDate: Date | null = null;
    if (input.period === "7d") fromDate = new Date(now.getTime() - 7 * 86400000);
    else if (input.period === "30d") fromDate = new Date(now.getTime() - 30 * 86400000);
    else if (input.period === "90d") fromDate = new Date(now.getTime() - 90 * 86400000);

    const conditions: any[] = [isNotNull(devRequests.accuracyScore)];
    if (fromDate) conditions.push(gte(devRequests.createdAt, fromDate));
    const where = and(...conditions);

    const [rows, totalRows, dailyRows, categoryRows] = await Promise.all([
      db.select({
        score: devRequests.accuracyScore,
        engineType: devRequests.engineType,
        aiCategory: devRequests.aiCategory,
        createdAt: devRequests.createdAt,
      }).from(devRequests).where(where).orderBy(desc(devRequests.createdAt)),
      db.select({ count: sql<number>`count(*)` }).from(devRequests).where(where),
      db.select({
        date: sql<string>`DATE(createdAt)`,
        avgScore: sql<number>`AVG(accuracyScore)`,
        count: sql<number>`count(*)`,
      }).from(devRequests).where(where).groupBy(sql`DATE(createdAt)`).orderBy(sql`DATE(createdAt)`),
      db.select({
        feedbackCategory: devRequests.feedbackCategory,
        count: sql<number>`count(*)`,
      }).from(devRequests).where(and(...conditions, isNotNull(devRequests.feedbackCategory)))
        .groupBy(devRequests.feedbackCategory),
    ]);

    const total = Number(totalRows[0]?.count ?? 0);
    const avgScore = total > 0 ? rows.reduce((s, r) => s + (r.score ?? 0), 0) / total : 0;
    const highAccuracyCount = rows.filter(r => (r.score ?? 0) >= 4).length;
    const lowAccuracyCount = rows.filter(r => (r.score ?? 0) <= 2).length;

    const scoreDistribution = [1, 2, 3, 4, 5].map(s => ({
      score: s,
      count: rows.filter(r => r.score === s).length,
    }));

    const categoryBreakdown = {
      bug: 0,
      suggestion: 0,
      other: 0,
    };
    for (const row of categoryRows) {
      const cat = row.feedbackCategory as keyof typeof categoryBreakdown;
      if (cat in categoryBreakdown) categoryBreakdown[cat] = Number(row.count);
    }

    return {
      totalEvaluated: total,
      avgScore: Math.round(avgScore * 100) / 100,
      highAccuracyCount,
      lowAccuracyCount,
      highAccuracyRate: total > 0 ? Math.round((highAccuracyCount / total) * 100) : 0,
      scoreDistribution,
      dailyTrend: dailyRows.map(r => ({
        date: r.date,
        avgScore: Math.round(Number(r.avgScore) * 100) / 100,
        count: Number(r.count),
      })),
      categoryBreakdown,
    };
  }),

  /** 엔진별 정확도 비교 */
  engineAccuracyComparison: adminProcedure.input(z.object({
    period: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const now = new Date();
    let fromDate: Date | null = null;
    if (input.period === "7d") fromDate = new Date(now.getTime() - 7 * 86400000);
    else if (input.period === "30d") fromDate = new Date(now.getTime() - 30 * 86400000);
    else if (input.period === "90d") fromDate = new Date(now.getTime() - 90 * 86400000);

    const conditions: any[] = [isNotNull(devRequests.accuracyScore), isNotNull(devRequests.engineType)];
    if (fromDate) conditions.push(gte(devRequests.createdAt, fromDate));

    const rows = await db.select({
      engineType: devRequests.engineType,
      avgScore: sql<number>`AVG(accuracyScore)`,
      count: sql<number>`count(*)`,
      highCount: sql<number>`SUM(CASE WHEN accuracyScore >= 4 THEN 1 ELSE 0 END)`,
    }).from(devRequests).where(and(...conditions))
      .groupBy(devRequests.engineType)
      .orderBy(desc(sql`AVG(accuracyScore)`));

    return rows.map(r => ({
      engine: r.engineType ?? "unknown",
      avgScore: Math.round(Number(r.avgScore) * 100) / 100,
      count: Number(r.count),
      highAccuracyRate: Number(r.count) > 0 ? Math.round((Number(r.highCount) / Number(r.count)) * 100) : 0,
    }));
  }),

  /** 피드백 자동 분류 헬퍼 (LLM 기반) */
  // 내부 헬퍼 함수 - 라우터 외부에 선언하는 대신 프로시저 내부에서 직접 사용

  /** 정확도 점수 업데이트 (사용자 평가) + 피드백 자동 분류 */
  updateAccuracy: adminProcedure.input(z.object({
    requestId: z.number(),
    accuracyScore: z.number().min(1).max(5),
    userFeedback: z.string().max(1000).optional(),
    engineType: z.string().max(50).optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // LLM 기반 피드백 자동 분류
    let feedbackCategory: "bug" | "suggestion" | "other" = "other";
    if (input.userFeedback && input.userFeedback.trim().length > 0) {
      try {
        const classifyResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a feedback classifier for a golf ERP system. Classify user feedback into exactly one of these categories:\n- bug: Reports an error, malfunction, incorrect behavior, or something not working as expected\n- suggestion: Requests a new feature, improvement, or enhancement\n- other: General comments, praise, questions, or unclear feedback\n\nRespond with ONLY a JSON object: {"category": "bug"} or {"category": "suggestion"} or {"category": "other"}`,
            },
            {
              role: "user",
              content: `Classify this feedback: "${input.userFeedback}"`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "feedback_classification",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  category: { type: "string", enum: ["bug", "suggestion", "other"] },
                },
                required: ["category"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = classifyResult?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
          if (["bug", "suggestion", "other"].includes(parsed.category)) {
            feedbackCategory = parsed.category as "bug" | "suggestion" | "other";
          }
        }
      } catch (e) {
        // 분류 실패 시 'other'로 폴백
        console.error("[classifyFeedback] LLM classification failed:", e);
      }
    }

    await db.update(devRequests).set({
      accuracyScore: input.accuracyScore,
      userFeedback: input.userFeedback,
      engineType: input.engineType,
      feedbackCategory,
      accuracyEvaluated: true,
    }).where(eq(devRequests.id, input.requestId));
    return { success: true, feedbackCategory };
  }),

  /** 피드백 카테고리 수동 수정 */
  updateFeedbackCategory: adminProcedure.input(z.object({
    requestId: z.number(),
    feedbackCategory: z.enum(["bug", "suggestion", "other"]),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(devRequests).set({
      feedbackCategory: input.feedbackCategory,
    }).where(eq(devRequests.id, input.requestId));
    return { success: true };
  }),

  /** AI 기반 개선 제안 생성 */
  getImprovementSuggestions: adminProcedure.input(z.object({
    period: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const now = new Date();
    let fromDate: Date | null = null;
    if (input.period === "7d") fromDate = new Date(now.getTime() - 7 * 86400000);
    else if (input.period === "30d") fromDate = new Date(now.getTime() - 30 * 86400000);
    else if (input.period === "90d") fromDate = new Date(now.getTime() - 90 * 86400000);

    const conditions: any[] = [isNotNull(devRequests.accuracyScore)];
    if (fromDate) conditions.push(gte(devRequests.createdAt, fromDate));

    const lowAccuracyRows = await db.select({
      id: devRequests.id,
      title: devRequests.title,
      accuracyScore: devRequests.accuracyScore,
      userFeedback: devRequests.userFeedback,
      engineType: devRequests.engineType,
      aiCategory: devRequests.aiCategory,
    }).from(devRequests)
      .where(and(...conditions, lte(devRequests.accuracyScore, 2)))
      .orderBy(asc(devRequests.accuracyScore))
      .limit(10);

    const engineStats = await db.select({
      engineType: devRequests.engineType,
      avgScore: sql<number>`AVG(accuracyScore)`,
      count: sql<number>`count(*)`,
    }).from(devRequests).where(and(...conditions, isNotNull(devRequests.engineType)))
      .groupBy(devRequests.engineType);

    const worstEngine = [...engineStats].sort((a, b) => Number(a.avgScore) - Number(b.avgScore))[0];
    const suggestions: { type: string; title: string; description: string; priority: "high" | "medium" | "low" }[] = [];

    if (lowAccuracyRows.length > 0) {
      suggestions.push({
        type: "low_accuracy",
        title: `저정확도 요청 ${lowAccuracyRows.length}건 재검토 필요`,
        description: `정확도 2점 이하 요청 ${lowAccuracyRows.length}건이 발견되었습니다. 해당 요청의 요구사항을 재검토하고 프롬프트를 개선하세요.`,
        priority: "high",
      });
    }
    if (worstEngine && Number(worstEngine.avgScore) < 3 && Number(worstEngine.count) >= 3) {
      suggestions.push({
        type: "engine_switch",
        title: `${worstEngine.engineType} 엔진 성능 개선 필요`,
        description: `${worstEngine.engineType} 엔진의 평균 정확도가 ${Number(worstEngine.avgScore).toFixed(1)}점으로 낮습니다. 다른 엔진으로 전환하거나 프롬프트를 개선하세요.`,
        priority: "high",
      });
    }
    suggestions.push({
      type: "feedback_collection",
      title: "정확도 평가 수집 확대",
      description: "완료된 개발 요청에 대한 정확도 평가를 지속적으로 수집하여 엔진별 성능을 지속 모니터링하세요.",
      priority: "medium",
    });
    suggestions.push({
      type: "prompt_optimization",
      title: "시스템 프롬프트 최적화",
      description: "저정확도 요청의 패턴을 분석하여 시스템 프롬프트를 주기적으로 개선하세요.",
      priority: "low",
    });

    return {
      suggestions,
      lowAccuracyRequests: lowAccuracyRows,
    };
  }),
});

// ────────────────────────────────────────────────────────────────────────────
// 오케스트레이터 라우터
// ────────────────────────────────────────────────────────────────────────────

const orchestratorRouter = router({
  /** 오케스트레이터를 통한 AI 질의 */
  ask: adminProcedure.input(z.object({
    message: z.string().min(1).max(5000),
    taskType: z.enum(["text_summary", "hashtag_gen", "data_classify", "price_analysis", "schedule_optimize", "report_gen", "content_create", "layout_design", "code_review", "auto"]).default("auto"),
    complexity: z.enum(["SIMPLE", "MODERATE", "COMPLEX"]).optional(),
    systemPrompt: z.string().optional(),
    maxTokens: z.number().min(100).max(8192).optional(),
    temperature: z.number().min(0).max(2).optional(),
    useCache: z.boolean().default(true),
    useFreeModel: z.boolean().default(false),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    const startTime = Date.now();
    let result: Awaited<ReturnType<typeof orchestrate>> | null = null;
    let errorMessage: string | null = null;

    try {
      result = await orchestrate(input.message, {
        taskType: input.taskType as TaskType,
        complexity: input.complexity as TaskComplexity | undefined,
        systemPrompt: input.systemPrompt,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        useCache: input.useCache,
        useFreeModel: input.useFreeModel,
      });
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    // 비용 로그 저장
    if (db) {
      try {
        await db.insert(aiCostLogs).values({
          model: result?.model ?? input.complexity ?? "unknown",
          modelName: result?.model?.split("/")[1] ?? "unknown",
          complexity: result?.complexity ?? input.complexity ?? "MODERATE",
          taskType: result?.taskType ?? input.taskType,
          inputTokens: result?.inputTokens ?? 0,
          outputTokens: result?.outputTokens ?? 0,
          costUsd: String(result?.costUsd ?? 0),
          cacheSavedUsd: String(result?.cacheSavedUsd ?? 0),
          cacheHit: result?.cacheHit ?? false,
          durationMs: result?.durationMs ?? (Date.now() - startTime),
          isSuccess: !errorMessage,
          errorMessage: errorMessage ?? undefined,
          userId: ctx.user.id,
          promptPreview: input.message.slice(0, 200),
          assistant: "master",
        });
      } catch (logErr) {
        console.error("[Orchestrator] 비용 로그 저장 실패:", logErr);
      }
    }

    if (errorMessage) {
      return {
        success: false,
        errorMessage: `현재 AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요. (${errorMessage.slice(0, 100)})`,
        text: null,
        model: null,
        complexity: null,
        taskType: input.taskType,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        cacheHit: false,
        cacheSavedUsd: 0,
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      errorMessage: null,
      text: result!.text,
      model: result!.model,
      complexity: result!.complexity,
      taskType: result!.taskType,
      inputTokens: result!.inputTokens,
      outputTokens: result!.outputTokens,
      costUsd: result!.costUsd,
      cacheHit: result!.cacheHit,
      cacheSavedUsd: result!.cacheSavedUsd,
      durationMs: result!.durationMs,
    };
  }),

  /** 비용 통계 조회 */
  getCostStats: adminProcedure.input(z.object({
    days: z.number().min(1).max(90).default(30),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

    const [totalStats, byModel, byComplexity, byDay, cacheStats] = await Promise.all([
      // 전체 합계
      db.select({
        totalCost: sql<string>`COALESCE(SUM(costUsd), 0)`,
        totalCacheSaved: sql<string>`COALESCE(SUM(cacheSavedUsd), 0)`,
        totalRequests: count(),
        cacheHits: sql<number>`SUM(CASE WHEN cacheHit = 1 THEN 1 ELSE 0 END)`,
        successCount: sql<number>`SUM(CASE WHEN isSuccess = 1 THEN 1 ELSE 0 END)`,
        avgDuration: sql<number>`AVG(durationMs)`,
      }).from(aiCostLogs).where(gte(aiCostLogs.createdAt, since)),

      // 모델별 통계
      db.select({
        model: aiCostLogs.model,
        modelName: aiCostLogs.modelName,
        requests: count(),
        totalCost: sql<string>`COALESCE(SUM(costUsd), 0)`,
        totalTokens: sql<number>`SUM(inputTokens + outputTokens)`,
      }).from(aiCostLogs).where(gte(aiCostLogs.createdAt, since)).groupBy(aiCostLogs.model, aiCostLogs.modelName),

      // 복잡도별 통계
      db.select({
        complexity: aiCostLogs.complexity,
        requests: count(),
        totalCost: sql<string>`COALESCE(SUM(costUsd), 0)`,
      }).from(aiCostLogs).where(gte(aiCostLogs.createdAt, since)).groupBy(aiCostLogs.complexity),

      // 일별 비용 추이
      db.select({
        date: sql<string>`DATE(createdAt)`,
        totalCost: sql<string>`COALESCE(SUM(costUsd), 0)`,
        requests: count(),
        cacheHits: sql<number>`SUM(CASE WHEN cacheHit = 1 THEN 1 ELSE 0 END)`,
      }).from(aiCostLogs).where(gte(aiCostLogs.createdAt, since)).groupBy(sql`DATE(createdAt)`).orderBy(sql`DATE(createdAt)`),

      // 캐시 통계
      db.select({
        totalRequests: count(),
        cacheHits: sql<number>`SUM(CASE WHEN cacheHit = 1 THEN 1 ELSE 0 END)`,
        totalSaved: sql<string>`COALESCE(SUM(cacheSavedUsd), 0)`,
      }).from(aiCostLogs).where(gte(aiCostLogs.createdAt, since)),
    ]);

    return {
      summary: totalStats[0],
      byModel,
      byComplexity,
      byDay,
      cacheStats: cacheStats[0],
      inMemoryCacheStats: getCacheStats(),
    };
  }),

  /** 모델 가격 정보 */
  getModelPricing: adminProcedure.query(() => getModelPricing()),

  /** 인메모리 캐시 초기화 */
  clearCache: adminProcedure.mutation(() => {
    clearCache();
    return { success: true };
  }),

  /** 복잡도 자동 감지 미리보기 */
  detectComplexity: adminProcedure.input(z.object({
    prompt: z.string().min(1),
  })).query(({ input }) => ({
    complexity: detectComplexity(input.prompt),
    model: MODEL_CATALOG[detectComplexity(input.prompt)],
  })),

  /** 최근 비용 로그 */
  getRecentLogs: adminProcedure.input(z.object({
    limit: z.number().min(1).max(100).default(20),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(aiCostLogs).orderBy(desc(aiCostLogs.createdAt)).limit(input.limit);
  }),
});

// ─── Payment Router ─────────────────────────────────────────────
const paymentRouter = router({
  /** PaymentIntent 생성 (예약금 결제 시작) */
  createIntent: protectedProcedure
    .input(z.object({
      bookingId: z.number().int().positive(),
      amountKrw: z.number().int().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // 예약 존재 여부 확인
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId));
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "예약을 찾을 수 없습니다." });
      const result = await createPaymentIntent(
        input.bookingId,
        input.amountKrw,
        ctx.user.email ?? undefined,
        ctx.user.name ?? undefined,
      );
      return result;
    }),

  /** 결제 상태 조회 */
  getStatus: protectedProcedure
    .input(z.object({ paymentIntentId: z.string() }))
    .query(async ({ input }) => {
      return getPaymentStatus(input.paymentIntentId);
    }),

  /** 예약별 결제 이력 조회 */
  getHistory: protectedProcedure
    .input(z.object({ bookingId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(payments)
        .where(eq(payments.bookingId, input.bookingId))
        .orderBy(desc(payments.createdAt));
    }),

  /** 관리자: 전체 결제 이력 조회 */
  listAll: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(payments)
        .orderBy(desc(payments.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      const [total] = await db.select({ count: count() }).from(payments);
      return { rows, total: total.count };
    }),
});

// ─── Runway ML 동영상 생성 Router ───────────────────────────
const videoRouter = router({
  /** 동영상 생성 시작 */
  generate: adminProcedure
    .input(z.object({
      packageId: z.number().int().positive(),
      imageUrl: z.string().url(),
      durationSec: z.union([z.literal(5), z.literal(10)]).default(10),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [pkg] = await db.select().from(packages).where(eq(packages.id, input.packageId));
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "패키지를 찾을 수 없습니다." });

      const result = await generateGolfVideo({
        imageUrl: input.imageUrl,
        packageTitle: pkg.title,
        country: pkg.country,
        region: pkg.region ?? undefined,
        durationSec: input.durationSec,
      });

      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }

      // DB에 동영상 레코드 생성
      const [inserted] = await db.insert(packageVideos).values({
        packageId: input.packageId,
        videoUrl: "", // 완료 시 업데이트
        title: `${pkg.title} 홈보 영상`,
        durationSec: input.durationSec,
        generatedBy: "runway",
        status: "processing",
      }).$returningId();

      return {
        videoId: inserted.id,
        taskId: result.taskId,
        status: result.status,
      };
    }),

  /** 동영상 생성 상태 조회 */
  checkStatus: adminProcedure
    .input(z.object({
      taskId: z.string(),
      videoId: z.number().int().positive(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const status = await getVideoGenerationStatus(input.taskId);

      // 완료 시 DB 업데이트
      if (status.status === "succeeded" && status.output?.[0]) {
        await db.update(packageVideos)
          .set({ videoUrl: status.output[0], status: "ready" })
          .where(eq(packageVideos.id, input.videoId));
      } else if (status.status === "failed") {
        await db.update(packageVideos)
          .set({ status: "failed" })
          .where(eq(packageVideos.id, input.videoId));
      }

      return status;
    }),

  /** 패키지별 동영상 목록 */
  listByPackage: publicProcedure
    .input(z.object({ packageId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // 공개 API: ready 상태인 영상만 반환
      return db.select().from(packageVideos)
        .where(
          and(
            eq(packageVideos.packageId, input.packageId),
            eq(packageVideos.status, "ready")
          )
        )
        .orderBy(desc(packageVideos.createdAt));
    }),
});

// ============================================================
// 두골프-AI개발 엔진 라우터
// ============================================================
const aiDevEngineRouter = router({
  // 오류 로그 목록 조회
  getLogs: adminProcedure
    .input(z.object({
      status: z.enum(["new", "analyzing", "fixed", "ignored"]).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [];
      if (input.status) conditions.push(eq(aiEngineLogs.status, input.status));
      const rows = await db.select().from(aiEngineLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(aiEngineLogs.createdAt))
        .limit(input.limit).offset(input.offset);
      const [{ total }] = await db.select({ total: count() }).from(aiEngineLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      return { logs: rows, total };
    }),

  // 수정 요청 목록 조회
  getFixRequests: adminProcedure
    .input(z.object({
      status: z.enum(["pending", "in_review", "approved", "rejected", "applied", "failed"]).optional(),
      priority: z.enum(["critical", "high", "medium", "low"]).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [];
      if (input.status) conditions.push(eq(aiFixRequests.status, input.status));
      if (input.priority) conditions.push(eq(aiFixRequests.priority, input.priority));
      const rows = await db.select().from(aiFixRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(aiFixRequests.createdAt))
        .limit(input.limit).offset(input.offset);
      const [{ total }] = await db.select({ total: count() }).from(aiFixRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      return { requests: rows, total };
    }),

  // 수정 요청 단일 조회
  getFixRequest: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [req] = await db.select().from(aiFixRequests).where(eq(aiFixRequests.id, input.id));
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      const reviews = await db.select().from(aiReviewResults).where(eq(aiReviewResults.fixRequestId, input.id));
      return { request: req, reviews };
    }),

  // 수동 수정 요청 생성
  createFixRequest: adminProcedure
    .input(z.object({
      title: z.string().min(1).max(300),
      description: z.string().min(1),
      targetFile: z.string().optional(),
      targetFunction: z.string().optional(),
      priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const critical = isCriticalError(input.targetFile ?? "", input.description);
      const [inserted] = await db.insert(aiFixRequests).values({
        title: input.title,
        description: input.description,
        targetFile: input.targetFile,
        targetFunction: input.targetFunction,
        priority: input.priority,
        isCritical: critical,
        status: "pending",
        requestSource: "manual",
      });
      const newId = (inserted as any).insertId as number;
      // 백그라운드 AI 자동 분석 (비동기 - 응답 지연 없음)
      setImmediate(async () => {
        try {
          const { analyzeDevRequest } = await import("../_core/geminiAIService.js");
          const analysis = await analyzeDevRequest(input.description);
          const dbBg = await getDb();
          if (dbBg) {
            await dbBg.update(aiFixRequests)
              .set({
                aiCategory: analysis.category,
                aiSuggestedPriority: analysis.priority,
                aiEstimatedHours: analysis.estimatedHours,
                aiAnalyzed: true,
              })
              .where(eq(aiFixRequests.id, newId));
          }
        } catch (e) {
          console.error("[AI AutoAnalyze] 수정 요청 자동 분석 실패:", e);
        }
      });
      return { id: newId, isCritical: critical };
    }),

  // AI 코드 수정 제안 생성
  generateFix: adminProcedure
    .input(z.object({ fixRequestId: z.number() }))
    .mutation(async ({ input }) => {
      const result = await generateFixCode(input.fixRequestId);
      if (!result.success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      return result;
    }),

  // 다단계 재검토 실행
  runReview: adminProcedure
    .input(z.object({ fixRequestId: z.number() }))
    .mutation(async ({ input }) => {
      const result = await runFullReview(input.fixRequestId);
      return result;
    }),

  // 수정 요청 승인/거부 (핵심 기능 수정 시 사용자 승인 필요)
  approveFixRequest: adminProcedure
    .input(z.object({
      fixRequestId: z.number(),
      approved: z.boolean(),
      feedback: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [req] = await db.select().from(aiFixRequests).where(eq(aiFixRequests.id, input.fixRequestId));
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      // 핵심 기능 수정 승인 시 관리자 권한 확인
      if (req.isCritical && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "핵심 기능 수정은 관리자만 승인할 수 있습니다." });
      }
      // 핵심 기능 수정 승인 시 사용자 피드백 필수 안전장치
      if (req.isCritical && input.approved && (!input.feedback || input.feedback.trim().length < 5)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "핵심 기능 수정 승인은 최소 5자 이상의 검토 의견이 필요합니다. (예: \"안전한 변경사항 확인 완료\")"
        });
      }
      await db.update(aiFixRequests).set({
        status: input.approved ? "approved" : "rejected",
        userFeedback: input.feedback,
        approvedBy: ctx.user.id,
        updatedAt: new Date(),
      }).where(eq(aiFixRequests.id, input.fixRequestId));
      return { success: true, status: input.approved ? "approved" : "rejected" };
    }),

  // 오류 로그 상태 업데이트
  updateLogStatus: adminProcedure
    .input(z.object({
      logId: z.number(),
      status: z.enum(["new", "analyzing", "fixed", "ignored"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(aiEngineLogs).set({ status: input.status }).where(eq(aiEngineLogs.id, input.logId));
      return { success: true };
    }),

  // ERP 기능 검색 (AI 기반)
  searchFeature: adminProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      return searchErpFeature(input.query);
    }),

  // 수동 오류 보고 (Express 에러 핸들러에서 호출)
  reportError: publicProcedure
    .input(z.object({
      source: z.string(),
      errorMessage: z.string(),
      path: z.string().optional(),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const logId = await reportError({
        source: input.source,
        error: new Error(input.errorMessage),
        path: input.path,
        context: input.context,
      });
      return { logId };
    }),

  // 대시보드 통계
  getDashboardStats: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [newErrors] = await db.select({ count: count() }).from(aiEngineLogs).where(eq(aiEngineLogs.status, "new"));
      const [pendingFixes] = await db.select({ count: count() }).from(aiFixRequests).where(eq(aiFixRequests.status, "pending"));
      const [approvedFixes] = await db.select({ count: count() }).from(aiFixRequests).where(eq(aiFixRequests.status, "approved"));
      const [totalLogs] = await db.select({ count: count() }).from(aiEngineLogs);
      const recentLogs = await db.select().from(aiEngineLogs).orderBy(desc(aiEngineLogs.createdAt)).limit(5);
      // ai_logs 통계 추가 (실제 AI 호출 현황)
      const [totalAiCalls] = await db.select({ count: count() }).from(aiLogs);
      const [todayAiCalls] = await db.select({ count: count() }).from(aiLogs).where(
        gte(aiLogs.createdAt, new Date(new Date().setHours(0, 0, 0, 0)))
      );
      // 분석 완료 로그 (status != 'new')
      const [analyzedLogs] = await db.select({ count: count() }).from(aiEngineLogs).where(
        sql`${aiEngineLogs.status} != 'new'`
      );
      // 수정 요청 전체
      const [totalFixRequests] = await db.select({ count: count() }).from(aiFixRequests);
      // 승인 대기 (pending)
      const [pendingApproval] = await db.select({ count: count() }).from(aiFixRequests).where(eq(aiFixRequests.status, "pending"));
      return {
        newErrors: newErrors.count,
        pendingFixes: pendingFixes.count,
        approvedFixes: approvedFixes.count,
        totalLogs: totalLogs.count,
        recentLogs,
        totalAiCalls: totalAiCalls.count,
        todayAiCalls: todayAiCalls.count,
        analyzedLogs: analyzedLogs.count,
        totalFixRequests: totalFixRequests.count,
        pendingApproval: pendingApproval.count,
      };
    }),
});
