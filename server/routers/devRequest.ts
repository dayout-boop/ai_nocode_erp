/**
 * 개발 요청 tRPC 라우터
 * - create: 개발 요청 등록
 * - list: 개발 요청 목록 조회
 * - updateStatus: 상태 변경
 * - sendToManus: 단일 요청 Manus 스마트 전송 (라우팅 결과 반환)
 * - sendPending: pending 전체 Manus 전송
 * - autoRegisterAndSend: 두골프 마스터 AI → 자동 등록 + 스마트 전송
 * - classifyRequest: AI 엔진으로 요청 유형/우선순위/모듈 자동 분류
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, count } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { devRequests } from "../../drizzle/schema";
import {
  sendSingleRequestToManus,
  sendPendingRequestsToManus,
  autoRegisterAndSend,
} from "../services/manusPipe";
import { invokeLLM } from "../_core/llm";
import { getCompletionKeywordsFromDb } from "./systemSettings";

// 관리자 전용 프로시저
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});

export const devRequestRouter = router({
  /**
   * 개발 요청 등록
   */
  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1),
        priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
        module: z.string().max(100).optional(),
        estimatedHours: z.number().int().positive().optional(),
        source: z.enum(["manual", "auto_cycle", "master_ai"]).default("manual"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [inserted] = await db
        .insert(devRequests)
        .values({
          title: input.title,
          description: input.description,
          priority: input.priority,
          status: "pending",
          module: input.module,
          estimatedHours: input.estimatedHours,
          createdBy: ctx.user.id,
          source: input.source,
        })
        .$returningId();

      return { id: inserted.id, success: true };
    }),

  /**
   * 개발 요청 목록 조회 (필터링 지원)
   */
  list: adminProcedure
    .input(
      z.object({
        status: z.enum(["pending", "in_progress", "completed", "rejected", "all"]).default("all"),
        priority: z.enum(["critical", "high", "medium", "low", "all"]).default("all"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [];
      if (input.status !== "all") conditions.push(eq(devRequests.status, input.status));
      if (input.priority !== "all") conditions.push(eq(devRequests.priority, input.priority));

      const rows = await db
        .select()
        .from(devRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(devRequests.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [total] = await db
        .select({ count: count() })
        .from(devRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { rows, total: total.count };
    }),

  /**
   * 상태 변경
   */
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["pending", "in_progress", "completed", "rejected"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(devRequests)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(devRequests.id, input.id));

      return { success: true };
    }),

  /**
   * 단일 요청 Manus 스마트 전송
   * 라우팅 결과(신규 생성 vs 기존 스레드 추가)를 반환합니다.
   */
  sendToManus: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const result = await sendSingleRequestToManus(input.id);
      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Manus 전송에 실패했습니다. MANUS_API_KEY 및 MANUS_PROJECT_ID를 확인해주세요.",
        });
      }
      return {
        success: true,
        manusTaskId: result.manusTaskId,
        routingType: result.routingType,
        routingReason: result.routingReason,
      };
    }),

  /**
   * pending 전체 Manus 일괄 전송
   */
  sendPending: adminProcedure.mutation(async () => {
    const result = await sendPendingRequestsToManus();
    return result;
  }),

  /**
   * AI 분류 엔진 - 요청 유형/우선순위/모듈 자동 분류
   * 두골프 마스터 AI가 채팅에서 개발 요청을 감지하면 이 프로시저로 분류합니다.
   */
  classifyRequest: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1),
        chatContext: z.string().optional(), // 채팅 대화 컨텍스트
      })
    )
    .mutation(async ({ input }) => {
      const systemPrompt = `당신은 두골프 ERP/홈페이지 개발 요청을 분류하는 AI 엔진입니다.
다음 기준으로 개발 요청을 분석하고 JSON으로 반환하세요.

모듈 목록:
- Packages: 상품 목록/상세 페이지
- PackageDetail: 상품 상세 (슬롯, 달력, 예약)
- Bookings: 예약 관리
- ERP: ERP 관리 시스템 전반
- Home: 홈페이지 메인
- CMS: 콘텐츠 관리 (배너, 공지)
- Auth: 로그인/회원
- Payment: 결제
- GolfTalk: 골프톡 채팅
- MasterAI: 두골프 마스터 AI
- AIDevEngine: AI 개발 엔진
- System: 시스템/인프라

카테고리:
- BUG: 오류 수정
- FEATURE: 신규 기능
- IMPROVEMENT: 기존 기능 개선
- REFACTOR: 코드 리팩터링

우선순위:
- critical: 서비스 중단 수준의 긴급 버그
- high: 핵심 기능 영향, 빠른 처리 필요
- medium: 일반적인 개선/기능 추가
- low: 사소한 개선, 여유 있게 처리 가능

예상 개발 시간 (시간 단위):
- BUG: 1~4시간
- FEATURE: 4~24시간
- IMPROVEMENT: 2~8시간
- REFACTOR: 4~16시간`;

      const userPrompt = `개발 요청 제목: ${input.title}
개발 요청 설명: ${input.description}
${input.chatContext ? `\n채팅 컨텍스트:\n${input.chatContext}` : ""}

위 요청을 분석하여 다음 JSON 형식으로 반환하세요:
{
  "aiCategory": "BUG|FEATURE|IMPROVEMENT|REFACTOR",
  "priority": "critical|high|medium|low",
  "module": "모듈명",
  "estimatedHours": 숫자,
  "aiAnalysis": "한국어로 2~3문장 분석 요약",
  "suggestedTitle": "개선된 제목 (선택사항)"
}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "dev_request_classification",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  aiCategory: { type: "string", enum: ["BUG", "FEATURE", "IMPROVEMENT", "REFACTOR"] },
                  priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                  module: { type: "string" },
                  estimatedHours: { type: "number" },
                  aiAnalysis: { type: "string" },
                  suggestedTitle: { type: "string" },
                },
                required: ["aiCategory", "priority", "module", "estimatedHours", "aiAnalysis", "suggestedTitle"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) throw new Error("AI 응답 없음");

        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        return {
          success: true,
          aiCategory: parsed.aiCategory as string,
          priority: parsed.priority as "critical" | "high" | "medium" | "low",
          module: parsed.module as string,
          estimatedHours: parsed.estimatedHours as number,
          aiAnalysis: parsed.aiAnalysis as string,
          suggestedTitle: parsed.suggestedTitle as string,
        };
      } catch (err) {
        console.error("[devRequest.classifyRequest] AI 분류 실패:", err);
        // 폴백: 기본값 반환
        return {
          success: false,
          aiCategory: "FEATURE",
          priority: "medium" as const,
          module: "ERP",
          estimatedHours: 4,
          aiAnalysis: "AI 분류 실패 - 수동으로 분류해주세요.",
          suggestedTitle: input.title,
        };
      }
    }),

  /**
   * 두골프 마스터 AI → 자동 등록 + 스마트 Manus 전송
   * AI가 채팅에서 개발 요청을 감지하면 이 프로시저로 자동 처리합니다.
   *
   * 플로우:
   * 1. AI 분류 (카테고리/우선순위/모듈 자동 판단)
   * 2. DB 등록 (dev_requests 테이블)
   * 3. 스마트 라우팅 (기존 태스크 재사용 vs 신규 생성)
   */
  autoRegisterAndSend: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1),
        priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
        module: z.string().max(100).default("ERP"),
        estimatedHours: z.number().int().positive().default(4),
        aiCategory: z.string().optional(),
        aiAnalysis: z.string().optional(),
        chatContext: z.string().optional(),
        /** UI에서 사용자가 선택한 Manus 태스크 ID (최우선 라우팅) */
        selectedTaskId: z.string().optional().nullable(),
        /** true이면 무조건 신규 태스크 생성 */
        forceNewTask: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // AI 분류가 없으면 자동 분류 실행
      let category = input.aiCategory;
      let analysis = input.aiAnalysis;
      let module = input.module;
      let priority = input.priority;
      let estimatedHours = input.estimatedHours;

      if (!category || !analysis) {
        try {
          const systemPrompt = `두골프 ERP 개발 요청 분류 AI. JSON만 반환.`;
          const userPrompt = `제목: ${input.title}\n설명: ${input.description}\n${input.chatContext ? `컨텍스트: ${input.chatContext}` : ""}\n\n{"aiCategory":"BUG|FEATURE|IMPROVEMENT|REFACTOR","priority":"critical|high|medium|low","module":"모듈명","estimatedHours":숫자,"aiAnalysis":"분석요약"}`;

          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "classification",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    aiCategory: { type: "string", enum: ["BUG", "FEATURE", "IMPROVEMENT", "REFACTOR"] },
                    priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                    module: { type: "string" },
                    estimatedHours: { type: "number" },
                    aiAnalysis: { type: "string" },
                  },
                  required: ["aiCategory", "priority", "module", "estimatedHours", "aiAnalysis"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
            category = parsed.aiCategory;
            analysis = parsed.aiAnalysis;
            module = parsed.module || module;
            priority = parsed.priority || priority;
            estimatedHours = parsed.estimatedHours || estimatedHours;
          }
        } catch {
          // 분류 실패 시 입력값 그대로 사용
        }
      }

      const result = await autoRegisterAndSend({
        title: input.title,
        description: input.description,
        priority: priority as "critical" | "high" | "medium" | "low",
        module,
        estimatedHours,
        requestedBy: ctx.user.id,
        aiCategory: category,
        aiAnalysis: analysis,
        selectedTaskId: input.selectedTaskId,
        forceNewTask: input.forceNewTask,
      });

      return {
        devRequestId: result.devRequestId,
        manusTaskId: result.manusTaskId,
        manusTaskUrl: result.manusTaskUrl,
        routingType: result.routingType,
        routingReason: result.routingReason,
        success: result.success,
        aiCategory: category,
        aiAnalysis: analysis,
        module,
        priority,
        estimatedHours,
      };
    }),

  /**
   * Manus 응답 텍스트에서 완료 키워드를 감지하여 in_progress 요청을 자동 completed 전환
   * 두골프 마스터 채팅에서 AI 응답 후 자동으로 호출됩니다.
   */
  detectAndCompleteFromResponse: adminProcedure
    .input(
      z.object({
        devRequestId: z.number().int().positive().optional(),
        responseText: z.string(),
        manusTaskId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // DB에서 완료 키워드 동적 조회 (없으면 기본값 사용)
      const COMPLETION_KEYWORDS = await getCompletionKeywordsFromDb();

      const isCompleted = COMPLETION_KEYWORDS.some((kw: string) => input.responseText.includes(kw));
      if (!isCompleted) return { detected: false, updatedCount: 0 };

      const db = await getDb();
      if (!db) return { detected: true, updatedCount: 0 };

      let updatedCount = 0;
      const matchedKeywords = COMPLETION_KEYWORDS.filter((kw: string) => input.responseText.includes(kw));

      if (input.devRequestId) {
        const result = await db
          .update(devRequests)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(and(eq(devRequests.id, input.devRequestId), eq(devRequests.status, 'in_progress')));
        updatedCount = (result as unknown as { affectedRows?: number })?.affectedRows ?? 1;
      } else if (input.manusTaskId) {
        const rows = await db
          .select({ id: devRequests.id })
          .from(devRequests)
          .where(and(eq(devRequests.manusTaskId, input.manusTaskId), eq(devRequests.status, 'in_progress')))
          .limit(5);
        for (const row of rows) {
          await db.update(devRequests).set({ status: 'completed', updatedAt: new Date() }).where(eq(devRequests.id, row.id));
          updatedCount++;
        }
      }

      return { detected: true, updatedCount, matchedKeywords };
    }),

  /**
   * 단일 요청 완료 체크 (ERP 리스트에서 수동 완료 처리)
   */
  markCompleted: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db
        .update(devRequests)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(and(eq(devRequests.id, input.id), eq(devRequests.status, 'in_progress')));
      return { success: true };
    }),
});
