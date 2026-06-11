/**
 * 시스템 설정 tRPC 라우터
 * - getSetting / setSetting: 키-값 시스템 설정 관리
 * - getManusTaskId / setManusTaskId: MANUS_DOGOLF_TASK_ID 전용 관리
 * - listTaskCandidates / addTaskCandidate / updateTaskCandidate / deleteTaskCandidate: 태스크 후보 관리
 * - analyzeAndRecommendTask: AI 기반 태스크 추천
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { systemSettings, manusTaskCandidates } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";

// 관리자 전용 프로시저
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});

export const systemSettingsRouter = router({
  /**
   * 단일 설정값 조회
   */
  getSetting: adminProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, input.key))
        .limit(1);
      return row ?? null;
    }),

  /**
   * 설정값 저장 (upsert)
   */
  setSetting: adminProcedure
    .input(
      z.object({
        key: z.string().min(1).max(100),
        value: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db
        .select({ id: systemSettings.id })
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, input.key))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(systemSettings)
          .set({
            settingValue: input.value,
            description: input.description,
            updatedBy: ctx.user.name ?? ctx.user.id.toString(),
            updatedAt: new Date(),
          })
          .where(eq(systemSettings.settingKey, input.key));
      } else {
        await db.insert(systemSettings).values({
          settingKey: input.key,
          settingValue: input.value,
          description: input.description,
          updatedBy: ctx.user.name ?? ctx.user.id.toString(),
        });
      }
      return { success: true };
    }),

  /**
   * MANUS_DOGOLF_TASK_ID 전용 조회
   * DB 값이 없으면 환경변수 폴백
   */
  getManusTaskId: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { taskId: process.env.MANUS_DOGOLF_TASK_ID ?? null, source: "env" as const };
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, "MANUS_DOGOLF_TASK_ID"))
      .limit(1);
    if (row?.settingValue) {
      return { taskId: row.settingValue, source: "db" as const, updatedBy: row.updatedBy, updatedAt: row.updatedAt };
    }
    return { taskId: process.env.MANUS_DOGOLF_TASK_ID ?? null, source: "env" as const };
  }),

  /**
   * MANUS_DOGOLF_TASK_ID 전용 저장
   */
  setManusTaskId: adminProcedure
    .input(z.object({ taskId: z.string().min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db
        .select({ id: systemSettings.id })
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, "MANUS_DOGOLF_TASK_ID"))
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(systemSettings)
          .set({
            settingValue: input.taskId,
            updatedBy: ctx.user.name ?? ctx.user.id.toString(),
            updatedAt: new Date(),
          })
          .where(eq(systemSettings.settingKey, "MANUS_DOGOLF_TASK_ID"));
      } else {
        await db.insert(systemSettings).values({
          settingKey: "MANUS_DOGOLF_TASK_ID",
          settingValue: input.taskId,
          description: "AI ERP 개발 Manus 태스크 ID (기본 라우팅 대상)',",
          updatedBy: ctx.user.name ?? ctx.user.id.toString(),
        });
      }
      return { success: true };
    }),

  // ─── 태스크 후보 관리 ────────────────────────────────────────────────────────

  /**
   * 태스크 후보 목록 조회
   */
  listTaskCandidates: adminProcedure
    .input(
      z.object({
        activeOnly: z.boolean().default(true),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = input.activeOnly ? [eq(manusTaskCandidates.isActive, true)] : [];
      const rows = await db
        .select()
        .from(manusTaskCandidates)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(manusTaskCandidates.isDefault), desc(manusTaskCandidates.lastUsedAt));
      return rows;
    }),

  /**
   * 태스크 후보 추가
   */
  addTaskCandidate: adminProcedure
    .input(
      z.object({
        taskId: z.string().min(1).max(100),
        taskName: z.string().min(1).max(200),
        projectName: z.string().max(200).optional(),
        description: z.string().optional(),
        taskType: z.enum(["erp", "homepage", "new_project", "other"]).default("erp"),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // 기본 태스크로 설정 시 기존 기본 태스크 해제
      if (input.isDefault) {
        await db
          .update(manusTaskCandidates)
          .set({ isDefault: false })
          .where(eq(manusTaskCandidates.isDefault, true));
      }
      const [inserted] = await db.insert(manusTaskCandidates).values({
        taskId: input.taskId,
        taskName: input.taskName,
        projectName: input.projectName,
        description: input.description,
        taskType: input.taskType,
        isDefault: input.isDefault,
        isActive: true,
      }).$returningId();
      return { id: inserted.id, success: true };
    }),

  /**
   * 태스크 후보 수정
   */
  updateTaskCandidate: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        taskName: z.string().min(1).max(200).optional(),
        projectName: z.string().max(200).optional(),
        description: z.string().optional(),
        taskType: z.enum(["erp", "homepage", "new_project", "other"]).optional(),
        isDefault: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // 기본 태스크로 설정 시 기존 기본 태스크 해제
      if (input.isDefault === true) {
        await db
          .update(manusTaskCandidates)
          .set({ isDefault: false })
          .where(and(eq(manusTaskCandidates.isDefault, true)));
      }
      const { id, ...updates } = input;
      await db
        .update(manusTaskCandidates)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(manusTaskCandidates.id, id));
      return { success: true };
    }),

  /**
   * 태스크 후보 삭제 (비활성화)
   */
  deleteTaskCandidate: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(manusTaskCandidates)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(manusTaskCandidates.id, input.id));
      return { success: true };
    }),

  /**
   * AI 기반 태스크 추천
   * 개발 요청 내용을 분석하여 가장 적합한 태스크를 추천합니다.
   */
  analyzeAndRecommendTask: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        module: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 활성 태스크 후보 목록 조회
      const candidates = await db
        .select()
        .from(manusTaskCandidates)
        .where(eq(manusTaskCandidates.isActive, true))
        .orderBy(desc(manusTaskCandidates.isDefault));

      if (candidates.length === 0) {
        return {
          recommended: null,
          reason: "등록된 태스크 후보가 없습니다. 시스템 설정에서 태스크를 추가해주세요.",
          allCandidates: [],
        };
      }

      // AI 분석으로 최적 태스크 추천
      const candidateList = candidates
        .map((c, i) => `${i + 1}. [${c.taskType}] ${c.taskName} (ID: ${c.taskId})${c.description ? ` - ${c.description}` : ""}${c.isDefault ? " [기본]" : ""}`)
        .join("\n");

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `당신은 AI ERP 개발 요청을 분석하여 가장 적합한 Manus 태스크를 추천하는 AI입니다.
다음 태스크 후보 목록에서 개발 요청에 가장 적합한 태스크를 선택하고 JSON으로 반환하세요.

태스크 후보 목록:
${candidateList}

선택 기준:
- erp: ERP 관리 시스템 기능 개선/버그 수정
- homepage: 홈페이지 프론트엔드 기능
- new_project: 완전히 새로운 프로젝트/시스템
- other: 기타

JSON 형식: {"recommendedIndex": 숫자(1부터 시작), "confidence": 0.0~1.0, "reason": "추천 이유"}`,
            },
            {
              role: "user",
              content: `개발 요청 제목: ${input.title}\n설명: ${input.description}${input.module ? `\n모듈: ${input.module}` : ""}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "task_recommendation",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  recommendedIndex: { type: "number" },
                  confidence: { type: "number" },
                  reason: { type: "string" },
                },
                required: ["recommendedIndex", "confidence", "reason"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) throw new Error("AI 응답 없음");
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        const idx = Math.max(0, Math.min(candidates.length - 1, (parsed.recommendedIndex as number) - 1));
        return {
          recommended: candidates[idx],
          confidence: parsed.confidence as number,
          reason: parsed.reason as string,
          allCandidates: candidates,
        };
      } catch {
        // AI 실패 시 기본 태스크 반환
        const defaultCandidate = candidates.find((c) => c.isDefault) ?? candidates[0];
        return {
          recommended: defaultCandidate,
          confidence: 0.5,
          reason: "AI 분석 실패 - 기본 태스크로 라우팅합니다.",
          allCandidates: candidates,
        };
      }
    }),

  /**
   * 태스크 사용 횟수 업데이트 (전송 성공 시 호출)
   */
  recordTaskUsage: adminProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db
        .update(manusTaskCandidates)
        .set({ lastUsedAt: new Date(), useCount: db.$count(manusTaskCandidates) as unknown as number })
        .where(eq(manusTaskCandidates.taskId, input.taskId));
      return { success: true };
    }),

  /**
   * 자동 완료 키워드 목록 조회
   */
  getCompletionKeywords: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { keywords: DEFAULT_COMPLETION_KEYWORDS, isCustom: false };
    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, SETTING_KEY_COMPLETION_KEYWORDS))
      .limit(1);
    if (rows.length === 0 || !rows[0].settingValue) {
      return { keywords: DEFAULT_COMPLETION_KEYWORDS, isCustom: false };
    }
    return { keywords: JSON.parse(rows[0].settingValue) as string[], isCustom: true };
  }),

  /**
   * 자동 완료 키워드 목록 업데이트
   */
  updateCompletionKeywords: adminProcedure
    .input(z.object({ keywords: z.array(z.string().min(1)).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('DB 연결 실패');
      const existing = await db
        .select({ id: systemSettings.id })
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, SETTING_KEY_COMPLETION_KEYWORDS))
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(systemSettings)
          .set({
            settingValue: JSON.stringify(input.keywords),
            updatedBy: ctx.user.name ?? ctx.user.openId,
            updatedAt: new Date(),
          })
          .where(eq(systemSettings.settingKey, SETTING_KEY_COMPLETION_KEYWORDS));
      } else {
        await db.insert(systemSettings).values({
          settingKey: SETTING_KEY_COMPLETION_KEYWORDS,
          settingValue: JSON.stringify(input.keywords),
          description: 'Manus AI 응답에서 개발 완료를 감지하는 키워드 목록 (JSON 배열)',
          updatedBy: ctx.user.name ?? ctx.user.openId,
        });
      }
      return { success: true, count: input.keywords.length };
    }),

  /**
   * 자동 완료 키워드를 기본값으로 초기화
   */
  resetCompletionKeywords: adminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('DB 연결 실패');
    await db
      .delete(systemSettings)
      .where(eq(systemSettings.settingKey, SETTING_KEY_COMPLETION_KEYWORDS));
    return { success: true, keywords: DEFAULT_COMPLETION_KEYWORDS };
  }),
});

// ─── 자동 완료 키워드 관리 (별도 export) ─────────────────────────────────────
// 기본 완료 키워드 목록
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

export const SETTING_KEY_COMPLETION_KEYWORDS = 'completion_keywords';

/**
 * DB에서 자동 완료 키워드 목록을 가져옵니다.
 * DB에 없으면 기본값을 반환합니다.
 */
export async function getCompletionKeywordsFromDb(): Promise<string[]> {
  try {
    const db = await getDb();
    if (!db) return DEFAULT_COMPLETION_KEYWORDS;
    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, SETTING_KEY_COMPLETION_KEYWORDS))
      .limit(1);
    if (rows.length === 0 || !rows[0].settingValue) return DEFAULT_COMPLETION_KEYWORDS;
    return JSON.parse(rows[0].settingValue) as string[];
  } catch {
    return DEFAULT_COMPLETION_KEYWORDS;
  }
}
