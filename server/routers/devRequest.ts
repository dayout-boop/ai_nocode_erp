/**
 * 개발 요청 tRPC 라우터
 * - create: 개발 요청 등록
 * - list: 개발 요청 목록 조회
 * - updateStatus: 상태 변경
 * - sendToManus: 단일 요청 Manus 스마트 전송 (라우팅 결과 반환)
 * - sendPending: pending 전체 Manus 전송
 * - autoRegisterAndSend: 마스터AI AI → 자동 등록 + 스마트 전송
 * - classifyRequest: AI 엔진으로 요청 유형/우선순위/모듈 자동 분류
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, count, isNotNull } from "drizzle-orm";
import { protectedProcedure, partnerProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { devRequests, systemSettings, tenantApiDevRequests } from "../../drizzle/schema";
import {
  sendSingleRequestToManus,
  sendPendingRequestsToManus,
  autoRegisterAndSend,
  publishManusSite,
} from "../services/manusPipe";
import { runSelfDevelopment } from "../services/selfDevPipe";
import { invokeLLM } from "../_core/llm";
import { createAiNotification } from "./aiNotifications";
import { publish } from "../services/realtimeEvents";

// 자동 완료 키워드 기본값 (DB에 없으면 사용)
const DEFAULT_COMPLETION_KEYWORDS = [
  '체크포인트를 저장했습니다',
  '체크포인트 저장',
  'webdev_save_checkpoint',
  '배포 준비가 완료',
  '구현이 완료되었습니다',
  '구현 완료',
  '개발이 완료되었습니다',
  '개발 완료',
  '작업이 완료되었습니다',
  '작업 완료',
  '버그 수정 완료',
  '기능 구현 완료',
  '배포하시려면 Publish 버튼',
  '배포 후 확인',
  '수정 완료되었습니다',
  '수정 완료',
];

async function getCompletionKeywordsLocal(): Promise<string[]> {
  try {
    const db = await getDb();
    if (!db) return DEFAULT_COMPLETION_KEYWORDS;
    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, 'completion_keywords'))
      .limit(1);
    if (rows.length === 0 || !rows[0].settingValue) return DEFAULT_COMPLETION_KEYWORDS;
    return JSON.parse(rows[0].settingValue) as string[];
  } catch {
    return DEFAULT_COMPLETION_KEYWORDS;
  }
}

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

      publish("dev_request_created", { id: inserted.id, title: input.title, priority: input.priority, status: "pending" });

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
        status: z.enum(["pending", "approved", "in_progress", "completed", "rejected"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(devRequests)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(devRequests.id, input.id));
      publish("dev_request_updated", { id: input.id, status: input.status });

      // 승인(approved) 시 자율수행데스크(Manus)에 자동 전송
      if (input.status === "approved") {
        setImmediate(async () => {
          try {
            const result = await sendSingleRequestToManus(input.id);
            if (result.success) {
              console.log(`[DevRequest] 승인 자동 연동 성공: id=${input.id}, taskId=${result.manusTaskId}`);
              publish("dev_request_updated", { id: input.id, status: "in_progress", autoSent: true });
            } else {
              console.error(`[DevRequest] 승인 자동 연동 실패: id=${input.id}`);
            }
          } catch (e) {
            console.error(`[DevRequest] 승인 자동 연동 오류: id=${input.id}`, e);
          }
        });
      }

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
   * 마스터AI AI가 채팅에서 개발 요청을 감지하면 이 프로시저로 분류합니다.
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
      const systemPrompt = `당신은 AI ERP/홈페이지 개발 요청을 분류하는 AI 엔진입니다.
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
- GolfTalk: AI상담톡 채팅
- MasterAI: 마스터AI AI
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
        // [의도 보존 원칙] LLM 재가공은 분류(category/priority/module/hours/analysis)에 한정한다.
        //   title/description 은 마스터 1차 생성본을 절대 덮어쓰지 않으며,
        //   suggestedTitle 은 자동 적용되지 않는 "참고용 제안"일 뿐이다(UI에서 사용자가 명시적으로 채택할 때만 반영).
        return {
          success: true,
          aiCategory: parsed.aiCategory as string,
          priority: parsed.priority as "critical" | "high" | "medium" | "low",
          module: parsed.module as string,
          estimatedHours: parsed.estimatedHours as number,
          aiAnalysis: parsed.aiAnalysis as string,
          /** 참고용 제안 제목 — 원문 title 을 자동으로 대체하지 않음 (사용자 명시 채택 시에만 사용) */
          suggestedTitleHint: parsed.suggestedTitle as string,
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
          /** 참고용 제안 제목 — 분류 실패 시 원문 title 을 그대로 유지 */
          suggestedTitleHint: input.title,
        };
      }
    }),

  /**
   * 마스터AI AI → 자동 등록 + 스마트 Manus 전송
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
        /** 사용자(마스터)가 입력한 원문 — LLM 재가공 전 의도 보존용 */
        originalRequest: z.string().optional().nullable(),
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
          const systemPrompt = `AI ERP 개발 요청 분류 AI. JSON만 반환.`;
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
        originalRequest: input.originalRequest ?? input.description,
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
   * 탈마누스 자체 개발 실행 (마누스 API 미경유)
   * AI가 채팅에서 개발 요청을 감지하고 devMode='self'일 때 이 프로시저로 처리합니다.
   *
   * 플로우:
   * 1. dev_requests 등록 (source=master_ai, engineType=self)
   * 2. 자체 LLM으로 코드 변경조각(Changeset) 생성 → dev-1 격리 커밋 + 4종 감사 (runPipeline)
   * 3. 결과를 dev_requests에 반영 후 반환 (Manus 경로와 완전 분리)
   */
  selfDevelop: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1),
        priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
        module: z.string().max(100).default("ERP"),
        estimatedHours: z.number().int().positive().default(4),
        aiCategory: z.string().optional(),
        aiAnalysis: z.string().optional(),
        /** dev-2-integration 자동 병합 여부 (기본 false) */
        autoIntegrate: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 1. dev_requests 등록 (자체 엔진 출처 명시)
      const [inserted] = await db
        .insert(devRequests)
        .values({
          title: input.title,
          description: input.description,
          priority: input.priority,
          status: "in_progress",
          module: input.module,
          estimatedHours: input.estimatedHours,
          createdBy: ctx.user.id,
          source: "master_ai",
          engineType: "self",
          aiCategory: input.aiCategory,
          aiAnalysis: input.aiAnalysis,
          aiAnalyzed: !!input.aiAnalysis,
        })
        .$returningId();

      const devRequestId = inserted.id;
      publish("dev_request_created", {
        id: devRequestId,
        title: input.title,
        priority: input.priority,
        status: "in_progress",
      });

      // 2. 자체 개발 파이프 실행 (코드생성 → dev-1 커밋 → 4종 감사)
      const result = await runSelfDevelopment({
        devRequestId,
        title: input.title,
        description: input.description,
        module: input.module,
        aiCategory: input.aiCategory,
        requestedBy: ctx.user.id,
        autoIntegrate: input.autoIntegrate ?? false,
        tenantId: 1,
      });

      // 3. 결과 반영
      const newStatus = result.success ? "completed" : "pending";
      await db
        .update(devRequests)
        .set({
          status: newStatus,
          result: `[탈마누스 자체개발] ${result.message}\n변경파일: ${result.changedFiles.join(", ") || "없음"}\n단계: ${result.stage ?? "-"} / 정합성: ${result.integrityStatus ?? "-"}`,
          updatedAt: new Date(),
        })
        .where(eq(devRequests.id, devRequestId));

      publish("dev_request_updated", { id: devRequestId, status: newStatus });

      return {
        devRequestId,
        success: result.success,
        engine: "self" as const,
        pipelineRequestId: result.pipelineRequestId,
        changedFiles: result.changedFiles,
        model: result.model,
        codeGenCostUsd: result.codeGenCostUsd,
        stage: result.stage,
        integrityStatus: result.integrityStatus,
        message: result.message,
        summary: result.summary,
      };
    }),

  /**
   * Manus 응답 텍스트에서 완료 키워드를 감지하여 in_progress 요청을 자동 completed 전환
   * 마스터AI 채팅에서 AI 응답 후 자동으로 호출됩니다.
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
      const COMPLETION_KEYWORDS = await getCompletionKeywordsLocal();

      const isCompleted = COMPLETION_KEYWORDS.some((kw: string) => input.responseText.includes(kw));
      if (!isCompleted) return { detected: false, updatedCount: 0 };

      const db = await getDb();
      if (!db) return { detected: true, updatedCount: 0 };

      let updatedCount = 0;
      const matchedKeywords = COMPLETION_KEYWORDS.filter((kw: string) => input.responseText.includes(kw));

      if (input.devRequestId) {
        const [reqInfo] = await db.select().from(devRequests).where(eq(devRequests.id, input.devRequestId)).limit(1);
        const result = await db
          .update(devRequests)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(and(eq(devRequests.id, input.devRequestId), eq(devRequests.status, 'in_progress')));
        updatedCount = (result as unknown as { affectedRows?: number })?.affectedRows ?? 1;
        if (updatedCount > 0 && reqInfo) {
          const priorityMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
            critical: 'critical', high: 'high', medium: 'medium', low: 'low',
          };
          publish("dev_request_completed", { id: reqInfo.id, title: reqInfo.title });
          createAiNotification({
            type: 'dev_complete',
            title: `개발 완료: ${reqInfo.title}`,
            body: `개발 요청 [ID: ${reqInfo.id}] '${reqInfo.title}'이(가) 완료되었습니다.\n\n새로고침하여 변경사항을 확인하세요.`,
            devRequestId: reqInfo.id,
            actionUrl: '/erp/dev-requests',
            actionLabel: '개발 요청 목록 보기',
            priority: priorityMap[reqInfo.priority ?? 'medium'] ?? 'medium',
            source: 'ai',
          }).catch((e: unknown) => console.error('[devRequest] 알림 생성 실패:', e));
        }
      } else if (input.manusTaskId) {
        const rows = await db
          .select()
          .from(devRequests)
          .where(and(eq(devRequests.manusTaskId, input.manusTaskId), eq(devRequests.status, 'in_progress')))
          .limit(5);
        for (const row of rows) {
          await db.update(devRequests).set({ status: 'completed', updatedAt: new Date() }).where(eq(devRequests.id, row.id));
          updatedCount++;
          const priorityMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
            critical: 'critical', high: 'high', medium: 'medium', low: 'low',
          };
          createAiNotification({
            type: 'dev_complete',
            title: `개발 완료: ${row.title}`,
            body: `개발 요청 [ID: ${row.id}] '${row.title}'이(가) 완료되었습니다.\n\n새로고침하여 변경사항을 확인하세요.`,
            devRequestId: row.id,
            actionUrl: '/erp/dev-requests',
            actionLabel: '개발 요청 목록 보기',
            priority: priorityMap[row.priority ?? 'medium'] ?? 'medium',
            source: 'ai',
          }).catch((e: unknown) => console.error('[devRequest] 알림 생성 실패:', e));
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
      // 완료 전 요청 정보 조회
      const [req] = await db.select().from(devRequests).where(eq(devRequests.id, input.id)).limit(1);
      const result = await db
        .update(devRequests)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(and(eq(devRequests.id, input.id), eq(devRequests.status, 'in_progress')));
      const affected = (result as unknown as { affectedRows?: number })?.affectedRows ?? 0;
      // 완료 시 AI 알림 자동 생성
      if (affected > 0 && req) {
        const priorityMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
          critical: 'critical', high: 'high', medium: 'medium', low: 'low',
        };
        publish("dev_request_completed", { id: req.id, title: req.title });
        createAiNotification({
          type: 'dev_complete',
          title: `개발 완료: ${req.title}`,
          body: `개발 요청 [ID: ${req.id}] '${req.title}'이(가) 완료되었습니다.\n\n새로고침하여 변경사항을 확인하세요.`,
          devRequestId: req.id,
          actionUrl: '/erp/dev-requests',
          actionLabel: '개발 요청 목록 보기',
          priority: priorityMap[req.priority ?? 'medium'] ?? 'medium',
          source: 'system',
        }).catch((e: unknown) => console.error('[devRequest] 알림 생성 실패:', e));
        // Manus WebDev 자동 게시 (비동기, 실패해도 완료 처리에 영향 없음)
        publishManusSite()
          .then((publishResult) => {
            if (publishResult.ok) {
              console.log(`[devRequest] Manus 자동 게시 성공: versionId=${publishResult.versionId}`);
              publish('manus_published', { devRequestId: req.id, versionId: publishResult.versionId });
            } else {
              console.warn(`[devRequest] Manus 자동 게시 실패: ${publishResult.error}`);
            }
          })
          .catch((e: unknown) => console.error('[devRequest] Manus 자동 게시 오류:', e));
      }
      return { success: true };
    }),

  /**
   * 300009 마이그레이션: 잘못 매핑된 in_progress 요청 데이터 검증 및 정리
   * - manusTaskId가 없는 in_progress 요청을 pending으로 되돌림
   * - manusTaskId가 있는 in_progress 요청 목록 반환 (수동 검토용)
   */
  migrateOrphanedRequests: adminProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      // 1. manusTaskId 없는 in_progress 요청 → pending으로 되돌림
      const orphanRows = await db
        .select({ id: devRequests.id })
        .from(devRequests)
        .where(
          and(
            eq(devRequests.status, 'in_progress'),
            eq(devRequests.manusTaskId, null as unknown as string)
          )
        );
      let orphanFixed = 0;
      for (const row of orphanRows) {
        await db
          .update(devRequests)
          .set({ status: 'pending', updatedAt: new Date() })
          .where(eq(devRequests.id, row.id));
        orphanFixed++;
      }
      // 2. 현재 in_progress 중 manusTaskId가 있는 요청 목록 반환 (수동 검토용)
      const inProgressWithTask = await db
        .select({
          id: devRequests.id,
          title: devRequests.title,
          status: devRequests.status,
          manusTaskId: devRequests.manusTaskId,
          manusRoutingType: devRequests.manusRoutingType,
          updatedAt: devRequests.updatedAt,
        })
        .from(devRequests)
        .where(
          and(
            eq(devRequests.status, 'in_progress'),
            isNotNull(devRequests.manusTaskId)
          )
        )
        .limit(50);
      console.log(`[Migration 300009] orphanFixed=${orphanFixed}, inProgressWithTask=${inProgressWithTask.length}`);
      publish('migration_completed', { orphanFixed, inProgressCount: inProgressWithTask.length });
      return {
        success: true,
        orphanFixed,
        inProgressWithTask,
        message: `${orphanFixed}개 고아 요청을 pending으로 복구. ${inProgressWithTask.length}개 진행 중 요청 확인 필요.`,
      };
    }),

  /**
   * 파트너가 고객센터AI를 통해 개발 요청 접수
   * - partnerProcedure: 파트너 JWT 인증 필수
   * - Slack 알림 자동 발송
   */
  submitByPartner: partnerProcedure
    .input(
      z.object({
        title: z.string().min(5).max(200),
        description: z.string().min(10).max(2000),
        category: z.enum(["feature", "bug", "improvement", "question"]).default("feature"),
        tenantName: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const partner = (ctx as unknown as { partner?: { id: number; companyName?: string } }).partner;
      const tenantName = input.tenantName ?? partner?.companyName ?? "파트너";

      const categoryLabel = { feature: "신규기능", bug: "버그수정", improvement: "개선", question: "문의" }[input.category];

      const [inserted] = await db
        .insert(devRequests)
        .values({
          title: `[파트너요청:${tenantName}] ${input.title}`,
          description: `**요청 업체:** ${tenantName}\n**카테고리:** ${categoryLabel}\n\n${input.description}`,
          priority: "medium",
          status: "pending",
          source: "manual",
          createdBy: 0,
        })
        .$returningId();

      publish("dev_request_created", { id: inserted.id, title: input.title, priority: "medium", status: "pending" });

      // Slack 알림
      try {
        const slackUrl = process.env.SLACK_WEBHOOK_URL;
        if (slackUrl) {
          await fetch(slackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `🏢 *파트너 개발요청 접수*\n업체: ${tenantName}\n제목: ${input.title}\n카테고리: ${categoryLabel}`,
            }),
          });
        }
      } catch (e) {
        console.error("[submitByPartner] Slack 알림 실패:", e);
      }

      return { success: true, id: inserted.id, message: "개발 요청이 접수되었습니다. 검토 후 안내드리겠습니다." };
    }),

  /**
   * 파트너가 자신의 개발요청 목록 조회 (tenantApiDevRequests)
   */
  listByPartner: partnerProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const partner = (ctx as unknown as { partner?: { id: number } }).partner;
      if (!partner?.id) throw new TRPCError({ code: "UNAUTHORIZED" });
      const rows = await db
        .select({
          id: tenantApiDevRequests.id,
          title: tenantApiDevRequests.title,
          requestContent: tenantApiDevRequests.requestContent,
          approvalStatus: tenantApiDevRequests.approvalStatus,
          feasibility: tenantApiDevRequests.feasibility,
          approvalMemo: tenantApiDevRequests.approvalMemo,
          isGlobalImprovement: tenantApiDevRequests.isGlobalImprovement,
          createdAt: tenantApiDevRequests.createdAt,
          completedAt: tenantApiDevRequests.completedAt,
        })
        .from(tenantApiDevRequests)
        .where(eq(tenantApiDevRequests.tenantId, partner.id))
        .orderBy(desc(tenantApiDevRequests.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      return rows;
    }),
});
