/**
 * AI 어시스턴트 tRPC 라우터
 * - masterChat: 두골프 마스터 (관리자 전용)
 * - golfTalkChat: 골프톡 (공개 API, rate limit 적용)
 * - getLogs: AI 사용 로그 조회 (관리자 전용)
 * - getCostSummary: 일별/월별 AI 비용 집계 (관리자 전용)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, gte, sql, count, sum } from "drizzle-orm";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { aiLogs, packages, bookings, devRequests, chatSessions } from "../../drizzle/schema";
import { classifyIntent, fetchPackageContext, fetchReservationContext, compressHistory } from "../services/rag";
import { orchestratorChat } from "../services/openrouter";
import { MASTER_SYSTEM_PROMPT } from "../services/prompts/master";
import { GOLFTALK_SYSTEM_PROMPT, GOLFTALK_FALLBACK_MESSAGE } from "../services/prompts/golftalk";

// 관리자 전용 프로시저
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});

// Rate limit 저장소 (인메모리, 프로세스 재시작 시 초기화)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxPerMinute = 20): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}

export const aiRouter = router({
  /**
   * 두골프 마스터 채팅 (관리자 인증 필수)
   * RAG 방식으로 DB 데이터를 컨텍스트에 주입하여 정확한 답변 제공
   */
  masterChat: adminProcedure
    .input(
      z.object({
        message: z.string().min(1).max(2000),
        sessionId: z.string().min(1).max(100),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .optional()
          .default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      // 1. 의도 분류 (RAG)
      const intent = classifyIntent(input.message);

      // 2. 컨텍스트 수집
      const contextParts: string[] = [];
      if (intent.needsPackages) {
        const pkgCtx = await fetchPackageContext(input.message);
        if (pkgCtx) contextParts.push(`[관련 상품 정보]\n${pkgCtx}`);
      }
      if (intent.needsReservations) {
        const resCtx = await fetchReservationContext(input.message);
        if (resCtx) contextParts.push(`[예약/정산 현황]\n${resCtx}`);
      }

      // 3. 대화 히스토리 압축 (5턴 이상)
      const compressedHistory = await compressHistory(input.sessionId, input.history);

      // 4. 시스템 프롬프트 + 컨텍스트 조합
      const systemWithContext =
        contextParts.length > 0
          ? `${MASTER_SYSTEM_PROMPT}\n\n[현재 컨텍스트]\n${contextParts.join("\n\n")}`
          : MASTER_SYSTEM_PROMPT;

      // 5. AI 호출
      const startTime = Date.now();
      let responseText = "";
      let modelUsed = "";
      let tokensIn = 0;
      let tokensOut = 0;
      let costUsd = 0;

      try {
        const result = await orchestratorChat({
          messages: [
            ...compressedHistory,
            { role: "user", content: input.message },
          ],
          complexity: intent.complexity === "high" ? "high" : intent.complexity === "low" ? "low" : "medium",
          assistant: "master",
          sessionId: input.sessionId,
          userId: ctx.user.id,
          systemPrompt: systemWithContext,
        });
        responseText = result.text;
        modelUsed = result.model;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        costUsd = result.costUsd;
      } catch (err) {
        console.error("[masterChat] AI 호출 실패:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 응답 생성에 실패했습니다." });
      }

      // 6. 사용자 메시지 로그 저장
      await db.insert(aiLogs).values({
        sessionId: input.sessionId,
        userId: ctx.user.id,
        assistant: "master",
        role: "user",
        content: input.message,
        modelUsed,
        tokensIn: 0,
        tokensOut: 0,
        costUsd: "0",
        grounded: false,
      });

      // 7. 어시스턴트 응답 로그 저장
      await db.insert(aiLogs).values({
        sessionId: input.sessionId,
        userId: ctx.user.id,
        assistant: "master",
        role: "assistant",
        content: responseText,
        modelUsed,
        tokensIn,
        tokensOut,
        costUsd: String(costUsd),
        grounded: false,
      });

      // 8. 개발 요청 자동 감지
      let devRequestSuggestion = null;
      if (intent.needsDevRequest) {
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.type === "dev_request") {
              devRequestSuggestion = parsed;
            }
          } catch {
            // JSON 파싱 실패 시 무시
          }
        }
      }

      return {
        response: responseText,
        model: modelUsed,
        tokensIn,
        tokensOut,
        costUsd,
        durationMs: Date.now() - startTime,
        devRequestSuggestion,
      };
    }),

  /**
   * 골프톡 채팅 (인증 불필요, rate limit 적용)
   * 고객 상담 AI - 상품 정보 컨텍스트 자동 주입
   */
  golfTalkChat: publicProcedure
    .input(
      z.object({
        message: z.string().min(1).max(1000),
        sessionId: z.string().min(1).max(100),
        packageId: z.number().optional(),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .optional()
          .default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Rate limit 체크 (IP 기반)
      const ip = (ctx.req.headers["x-forwarded-for"] as string) || ctx.req.socket?.remoteAddress || "unknown";
      if (!checkRateLimit(ip, 20)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        });
      }

      const db = await getDb();
      if (!db) {
        return { response: GOLFTALK_FALLBACK_MESSAGE, model: "fallback", tokensIn: 0, tokensOut: 0, costUsd: 0 };
      }

      // 패키지 컨텍스트 주입
      let systemWithContext = GOLFTALK_SYSTEM_PROMPT;
      if (input.packageId) {
        const [pkg] = await db.select().from(packages).where(eq(packages.id, input.packageId)).limit(1);
        if (pkg) {
          systemWithContext += `\n\n[현재 문의 상품]\n상품명: ${pkg.title}\n국가: ${pkg.country}\n기간: ${pkg.duration ?? "미정"}\n라운드: ${pkg.roundCount}회\n설명: ${pkg.description ?? ""}`;
        }
      } else {
        // 일반 상품 컨텍스트
        const pkgCtx = await fetchPackageContext(input.message);
        if (pkgCtx) systemWithContext += `\n\n[추천 가능 상품]\n${pkgCtx}`;
      }

      // AI 호출
      let responseText = GOLFTALK_FALLBACK_MESSAGE;
      let modelUsed = "";
      let tokensIn = 0;
      let tokensOut = 0;
      let costUsd = 0;

      try {
        const result = await orchestratorChat({
          messages: [
            ...input.history.slice(-6), // 최근 6턴만 유지
            { role: "user", content: input.message },
          ],
          complexity: "low",
          assistant: "golftalk",
          sessionId: input.sessionId,
          systemPrompt: systemWithContext,
        });
        responseText = result.text;
        modelUsed = result.model;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        costUsd = result.costUsd;
      } catch (err) {
        console.error("[golfTalkChat] AI 호출 실패:", err);
        responseText = GOLFTALK_FALLBACK_MESSAGE;
      }

      // 로그 저장 (비동기, 실패해도 응답에 영향 없음)
      db.insert(aiLogs)
        .values([
          {
            sessionId: input.sessionId,
            userId: null,
            assistant: "golftalk",
            role: "user",
            content: input.message,
            modelUsed,
            tokensIn: 0,
            tokensOut: 0,
            costUsd: "0",
            grounded: false,
          },
          {
            sessionId: input.sessionId,
            userId: null,
            assistant: "golftalk",
            role: "assistant",
            content: responseText,
            modelUsed,
            tokensIn,
            tokensOut,
            costUsd: String(costUsd),
            grounded: false,
          },
        ])
        .catch((e) => console.error("[golfTalkChat] 로그 저장 실패:", e));

      return { response: responseText, model: modelUsed, tokensIn, tokensOut, costUsd };
    }),

  /**
   * AI 사용 로그 조회 (관리자 전용)
   */
  getLogs: adminProcedure
    .input(
      z.object({
        assistant: z.enum(["master", "golftalk", "manager", "all"]).default("all"),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = input.assistant !== "all" ? [eq(aiLogs.assistant, input.assistant)] : [];
      const logs = await db
        .select()
        .from(aiLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(aiLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [total] = await db
        .select({ count: count() })
        .from(aiLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { logs, total: total.count };
    }),

  /**
   * AI 비용 집계 (관리자 전용)
   */
  getCostSummary: adminProcedure
    .input(
      z.object({
        period: z.enum(["today", "week", "month"]).default("month"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = new Date();
      let fromDate: Date;
      if (input.period === "today") {
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (input.period === "week") {
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const rows = await db
        .select({
          assistant: aiLogs.assistant,
          totalCost: sql<number>`SUM(CAST(${aiLogs.costUsd} AS DECIMAL(10,6)))`,
          totalTokensIn: sql<number>`SUM(${aiLogs.tokensIn})`,
          totalTokensOut: sql<number>`SUM(${aiLogs.tokensOut})`,
          messageCount: count(),
        })
        .from(aiLogs)
        .where(gte(aiLogs.createdAt, fromDate))
        .groupBy(aiLogs.assistant);

      const totalCost = rows.reduce((acc, r) => acc + Number(r.totalCost ?? 0), 0);
      const totalMessages = rows.reduce((acc, r) => acc + Number(r.messageCount ?? 0), 0);

      return { rows, totalCost, totalMessages, period: input.period };
    }),

  /**
   * 세션별 대화 내역 조회
   */
  getSessionMessages: adminProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(aiLogs)
        .where(eq(aiLogs.sessionId, input.sessionId))
        .orderBy(aiLogs.createdAt);
    }),
});
