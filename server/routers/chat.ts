/**
 * 상담 세션 tRPC 라우터
 * - createSession: 상담 세션 생성
 * - getSession: 세션 조회
 * - closeSession: 세션 종료 + AI 요약 생성
 * - listSessions: 세션 목록 (관리자)
 * - listMasterSessions: 마스터AI AI 대화 이력 목록 (300012)
 * - getMasterSessionMessages: 특정 세션 메시지 조회 (300012)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, count, sql, ne } from "drizzle-orm";
import { publicProcedure, protectedProcedure, partnerProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { chatSessions, aiLogs, masterSessionSummaries } from "../../drizzle/schema";
import { orchestratorChat } from "../services/openrouter";
import { nanoid } from "nanoid";

// 관리자 전용 프로시저
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});

export const chatRouter = router({
  /**
   * 상담 세션 생성
   * 골프톡(비로그인 가능) / 매니저(인증 필요)
   */
  createSession: publicProcedure
    .input(
      z.object({
        channel: z.enum(["golftalk", "manager"]),
        packageId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const sessionId = nanoid(20);

      await db.insert(chatSessions).values({
        sessionId,
        channel: input.channel,
        userId: ctx.user?.id ?? null,
        partnerId: null,
        status: "active",
        packageId: input.packageId ?? null,
      });

      return { sessionId };
    }),

  /**
   * 세션 조회
   */
  getSession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [session] = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.sessionId, input.sessionId))
        .limit(1);

      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "세션을 찾을 수 없습니다." });

      return session;
    }),

  /**
   * 세션 종료 + AI 요약 생성
   */
  closeSession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 세션 내 대화 내역 조회
      const messages = await db
        .select({ role: aiLogs.role, content: aiLogs.content })
        .from(aiLogs)
        .where(eq(aiLogs.sessionId, input.sessionId))
        .orderBy(aiLogs.createdAt)
        .limit(30);

      let summary = "";
      if (messages.length > 0) {
        // AI 요약 생성
        const conversationText = messages
          .map((m) => `${m.role === "user" ? "고객" : "AI"}: ${m.content.slice(0, 200)}`)
          .join("\n");

        try {
          const result = await orchestratorChat({
            messages: [
              {
                role: "user",
                content: `다음 상담 대화를 3줄 이내로 요약해주세요:\n\n${conversationText}`,
              },
            ],
            complexity: "low",
            assistant: "golftalk",
            sessionId: input.sessionId,
            systemPrompt: "당신은 상담 내용을 간결하게 요약하는 AI입니다. 핵심 내용만 3줄 이내로 요약하세요.",
          });
          summary = result.text;
        } catch {
          summary = `총 ${messages.length}개 메시지 상담 완료`;
        }
      }

      // 세션 상태 업데이트
      await db
        .update(chatSessions)
        .set({ status: "closed", summary, updatedAt: new Date() })
        .where(eq(chatSessions.sessionId, input.sessionId));

      return { success: true, summary };
    }),

  /**
   * 세션 목록 조회 (관리자)
   */
  listSessions: adminProcedure
    .input(
      z.object({
        channel: z.enum(["golftalk", "manager", "all"]).default("all"),
        status: z.enum(["active", "closed", "pending", "all"]).default("all"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [];
      if (input.channel !== "all") conditions.push(eq(chatSessions.channel, input.channel));
      if (input.status !== "all") conditions.push(eq(chatSessions.status, input.status));

      const sessions = await db
        .select()
        .from(chatSessions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(chatSessions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [total] = await db
        .select({ count: count() })
        .from(chatSessions)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { sessions, total: total.count };
    }),

  /**
   * [300012] 마스터AI AI 대화 이력 목록 조회
   * ai_logs 테이블에서 assistant="master" 세션을 그룹화하여 반환
   * 각 세션의 첫 번째 user 메시지를 제목으로 사용
   */
  listMasterSessions: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(30),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 세션별 최신 메시지 시각 + 메시지 수 집계
      const sessionStats = await db
        .select({
          sessionId: aiLogs.sessionId,
          messageCount: count(aiLogs.id),
          lastMessageAt: sql<Date>`MAX(${aiLogs.createdAt})`,
          firstMessageAt: sql<Date>`MIN(${aiLogs.createdAt})`,
        })
        .from(aiLogs)
        .where(eq(aiLogs.assistant, "master"))
        .groupBy(aiLogs.sessionId)
        .orderBy(desc(sql`MAX(${aiLogs.createdAt})`))
        .limit(input.limit)
        .offset(input.offset);

      if (sessionStats.length === 0) {
        return { sessions: [], total: 0 };
      }

      // 각 세션의 첫 번째 user 메시지 조회 (제목용)
      const sessionIds = sessionStats.map((s) => s.sessionId);
      const firstMessages = await Promise.all(
        sessionIds.map(async (sid) => {
          const [firstUserMsg] = await db
            .select({ content: aiLogs.content })
            .from(aiLogs)
            .where(and(eq(aiLogs.sessionId, sid), eq(aiLogs.role, "user")))
            .orderBy(aiLogs.createdAt)
            .limit(1);
          return { sessionId: sid, title: firstUserMsg?.content?.slice(0, 60) ?? "새 대화" };
        })
      );

      const titleMap = new Map(firstMessages.map((m) => [m.sessionId, m.title]));

      // 전체 세션 수
      const [totalResult] = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${aiLogs.sessionId})` })
        .from(aiLogs)
        .where(eq(aiLogs.assistant, "master"));

      const sessions = sessionStats.map((s) => ({
        sessionId: s.sessionId,
        title: titleMap.get(s.sessionId) ?? "새 대화",
        messageCount: Number(s.messageCount),
        lastMessageAt: s.lastMessageAt,
        firstMessageAt: s.firstMessageAt,
      }));

      return {
        sessions,
        total: Number(totalResult?.count ?? 0),
      };
    }),

  /**
   * [300012] 특정 세션의 메시지 전체 조회 (대화 이어가기용)
   */
  getMasterSessionMessages: adminProcedure
    .input(
      z.object({
        sessionId: z.string().min(1).max(100),
        limit: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const messages = await db
        .select({
          id: aiLogs.id,
          role: aiLogs.role,
          content: aiLogs.content,
          modelUsed: aiLogs.modelUsed,
          tokensIn: aiLogs.tokensIn,
          tokensOut: aiLogs.tokensOut,
          costUsd: aiLogs.costUsd,
          createdAt: aiLogs.createdAt,
        })
        .from(aiLogs)
        .where(
          and(
            eq(aiLogs.sessionId, input.sessionId),
            eq(aiLogs.assistant, "master"),
            ne(aiLogs.role, "system")
          )
        )
        .orderBy(aiLogs.createdAt)
        .limit(input.limit);

      return { messages, sessionId: input.sessionId };
    }),

  /**
   * 세션 ID로 이전 대화 내용을 history 형식으로 로드 (이어가기용)
   * 클라이언트에서 이전 세션 이어가기 시 호출
   */
  loadSessionHistory: adminProcedure
    .input(
      z.object({
        sessionId: z.string().min(1).max(100),
        // limit을 500으로 확장 - 긴 대화도 전체 로드 가능
        limit: z.number().min(1).max(500).default(500),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 전체 메시지 수 먼저 파악
      const totalRows = await db
        .select({ id: aiLogs.id })
        .from(aiLogs)
        .where(
          and(
            eq(aiLogs.sessionId, input.sessionId),
            eq(aiLogs.assistant, "master"),
            ne(aiLogs.role, "system")
          )
        );
      const totalCount = totalRows.length;

      // limit이 전체보다 작으면 최신 메시지부터 역순으로 가져온 뒤 다시 시간순 정렬
      // → 대화가 길어도 항상 최신 구간을 포함
      const rows = await db
        .select({
          id: aiLogs.id,
          role: aiLogs.role,
          content: aiLogs.content,
          modelUsed: aiLogs.modelUsed,
          costUsd: aiLogs.costUsd,
          createdAt: aiLogs.createdAt,
        })
        .from(aiLogs)
        .where(
          and(
            eq(aiLogs.sessionId, input.sessionId),
            eq(aiLogs.assistant, "master"),
            ne(aiLogs.role, "system")
          )
        )
        .orderBy(desc(aiLogs.createdAt)) // 최신순으로 가져와서
        .limit(input.limit);

      // 시간 오름차순으로 재정렬 (대화 흐름 복원)
      rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // history 형식으로 변환 (user/assistant만)
      const history = rows
        .filter((r) => r.role === "user" || r.role === "assistant")
        .map((r) => ({
          role: r.role as "user" | "assistant",
          content: r.content ?? "",
        }));

      // 저장된 세션 요약(있으면) 함께 반환 — 이어가기 시 전체 히스토리 대신 요약을 컨텍스트로 활용 가능
      const [savedSummary] = await db
        .select()
        .from(masterSessionSummaries)
        .where(eq(masterSessionSummaries.sessionId, input.sessionId))
        .limit(1);

      return {
        sessionId: input.sessionId,
        history,
        messageCount: history.length,
        totalCount, // DB의 전체 메시지 수 (제한 없이)
        messages: rows, // UI 표시용 전체 메시지
        summary: savedSummary ?? null, // 저장된 핵심 요약 (없으면 null)
      };
    }),

  /**
   * [Phase 5] 마스터 세션 핵심 요약 생성/저장
   *  - 세션 종료/전환 시 호출 (대화 종료 시점)
   *  - 저렴한 모델로 핵심 키워드 + 변경 DB + 개발이력을 요약 저장
   *  - 이어가기 클릭 시 loadSessionHistory가 이 요약본을 함께 반환
   *  - 신규 질문 시 자동 로드하지 않음 (요구사항)
   */
  summarizeMasterSession: adminProcedure
    .input(
      z.object({
        sessionId: z.string().min(1).max(100),
        force: z.boolean().default(false), // 기존 요약이 있어도 재생성
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 이미 요약이 있고 force가 아니면, 메시지 증가가 없을 때 스킵
      const [existing] = await db
        .select()
        .from(masterSessionSummaries)
        .where(eq(masterSessionSummaries.sessionId, input.sessionId))
        .limit(1);

      // 대화 메시지 로드 (user/assistant, system 제외)
      const rows = await db
        .select({ role: aiLogs.role, content: aiLogs.content })
        .from(aiLogs)
        .where(
          and(
            eq(aiLogs.sessionId, input.sessionId),
            eq(aiLogs.assistant, "master"),
            ne(aiLogs.role, "system")
          )
        )
        .orderBy(aiLogs.createdAt)
        .limit(200);

      if (rows.length === 0) {
        return { success: false, reason: "empty", summary: null as MasterSummaryResult | null };
      }

      // 변동 없으면 재생성 스킵 (메시지 수 동일)
      if (existing && !input.force && (existing.messageCount ?? 0) === rows.length) {
        return {
          success: true,
          reason: "unchanged",
          summary: {
            summary: existing.summary ?? "",
            keyTopics: existing.keyTopics ?? "",
            dbChanges: existing.dbChanges ?? "",
            devHistory: existing.devHistory ?? "",
          } as MasterSummaryResult,
        };
      }

      // 대화 텍스트 구성 (메시지당 길이 제한)
      const conversationText = rows
        .map((m) => `${m.role === "user" ? "관리자" : "마스터AI"}: ${(m.content ?? "").slice(0, 500)}`)
        .join("\n");

      let result: MasterSummaryResult = {
        summary: `총 ${rows.length}개 메시지 대화`,
        keyTopics: "",
        dbChanges: "",
        devHistory: "",
      };

      try {
        const llm = await orchestratorChat({
          messages: [
            {
              role: "user",
              content:
                `다음은 AI ERP '마스터 AI' 관리자 대화입니다. 다음 세션에서 이어가기 위한 핵심 요약을 JSON으로 작성하세요.\n\n` +
                `대화:\n${conversationText.slice(0, 12000)}`,
            },
          ],
          complexity: "low", // 저렴한 모델 사용
          assistant: "master",
          sessionId: input.sessionId,
          systemPrompt:
            "당신은 대화 요약 전문 AI입니다. 반드시 아래 JSON 스키마로만 응답하세요. 추측/창작 금지, 대화에 실제로 등장한 내용만 요약합니다.\n" +
            '{"summary":"3~5줄 핵심 요약","keyTopics":"핵심 키워드 쉼표구분","dbChanges":"언급된 DB/스키마 변경 요약(없으면 빈문자열)","devHistory":"개발 요청/배포 등 개발이력 요약(없으면 빈문자열)"}',
        });
        // 코드펜스(```json ... ```) 제거 후 파싱
        const cleaned = (llm.text || "{}").replace(/```(?:json)?\s*([\s\S]*?)\s*```/i, "$1").trim();
        const parsed = JSON.parse(cleaned || "{}");
        result = {
          summary: typeof parsed.summary === "string" ? parsed.summary : result.summary,
          keyTopics: typeof parsed.keyTopics === "string" ? parsed.keyTopics : "",
          dbChanges: typeof parsed.dbChanges === "string" ? parsed.dbChanges : "",
          devHistory: typeof parsed.devHistory === "string" ? parsed.devHistory : "",
        };
      } catch {
        // LLM 실패 시 폴백 요약 유지
      }

      // upsert (존재 시 갱신, 없으면 삽입)
      if (existing) {
        await db
          .update(masterSessionSummaries)
          .set({
            summary: result.summary,
            keyTopics: result.keyTopics,
            dbChanges: result.dbChanges,
            devHistory: result.devHistory,
            messageCount: rows.length,
            model: "orchestrator-low",
            updatedAt: new Date(),
          })
          .where(eq(masterSessionSummaries.sessionId, input.sessionId));
      } else {
        await db.insert(masterSessionSummaries).values({
          sessionId: input.sessionId,
          summary: result.summary,
          keyTopics: result.keyTopics,
          dbChanges: result.dbChanges,
          devHistory: result.devHistory,
          messageCount: rows.length,
          model: "orchestrator-low",
        });
      }

      return { success: true, reason: existing ? "updated" : "created", summary: result };
    }),

  /**
   * 파트너 매니저 대화 세션 목록 조회 (세션 이어가기용)
   * ai_logs 테이블에서 assistant="manager" 세션을 그룹화하여 반환
   */
  listManagerSessions: partnerProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tenantUserId: number = ctx.user?.id ?? ctx.partnerStaff?.staffId ?? ctx.partnerOwner?.partnerId ?? 0;

      // 세션별 최신 메시지 시각 + 메시지 수 집계
      const sessionStats = await db
        .select({
          sessionId: aiLogs.sessionId,
          messageCount: count(aiLogs.id),
          lastMessageAt: sql<Date>`MAX(${aiLogs.createdAt})`,
          firstMessageAt: sql<Date>`MIN(${aiLogs.createdAt})`,
        })
        .from(aiLogs)
        .where(and(eq(aiLogs.assistant, "manager"), eq(aiLogs.userId, tenantUserId)))
        .groupBy(aiLogs.sessionId)
        .orderBy(desc(sql`MAX(${aiLogs.createdAt})`))
        .limit(input.limit)
        .offset(input.offset);

      if (sessionStats.length === 0) {
        return { sessions: [], total: 0 };
      }

      // 각 세션의 첫 번째 user 메시지 조회 (제목용)
      const sessionIds = sessionStats.map((s) => s.sessionId);
      const firstMessages = await Promise.all(
        sessionIds.map(async (sid) => {
          const [firstUserMsg] = await db
            .select({ content: aiLogs.content })
            .from(aiLogs)
            .where(and(eq(aiLogs.sessionId, sid), eq(aiLogs.role, "user")))
            .orderBy(aiLogs.createdAt)
            .limit(1);
          return { sessionId: sid, title: firstUserMsg?.content?.slice(0, 60) ?? "새 대화" };
        })
      );

      const titleMap = new Map(firstMessages.map((m) => [m.sessionId, m.title]));

      const [totalResult] = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${aiLogs.sessionId})` })
        .from(aiLogs)
        .where(and(eq(aiLogs.assistant, "manager"), eq(aiLogs.userId, tenantUserId)));

      const sessions = sessionStats.map((s) => ({
        sessionId: s.sessionId,
        title: titleMap.get(s.sessionId) ?? "새 대화",
        messageCount: Number(s.messageCount),
        lastMessageAt: s.lastMessageAt,
        firstMessageAt: s.firstMessageAt,
      }));

      return {
        sessions,
        total: Number(totalResult?.count ?? 0),
      };
    }),

  /**
   * 파트너 매니저 특정 세션 메시지 조회 (대화 이어가기용)
   */
  getManagerSessionMessages: partnerProcedure
    .input(
      z.object({
        sessionId: z.string().min(1).max(100),
        limit: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tenantUserId: number = ctx.user?.id ?? ctx.partnerStaff?.staffId ?? ctx.partnerOwner?.partnerId ?? 0;

      const messages = await db
        .select({
          id: aiLogs.id,
          role: aiLogs.role,
          content: aiLogs.content,
          createdAt: aiLogs.createdAt,
        })
        .from(aiLogs)
        .where(
          and(
            eq(aiLogs.sessionId, input.sessionId),
            eq(aiLogs.assistant, "manager"),
            eq(aiLogs.userId, tenantUserId),
            ne(aiLogs.role, "system")
          )
        )
        .orderBy(aiLogs.createdAt)
        .limit(input.limit);

      return { messages, sessionId: input.sessionId };
    }),

  /**
   * [Phase 5] 저장된 마스터 세션 요약 단건 조회
   */
  getMasterSessionSummary: adminProcedure
    .input(z.object({ sessionId: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select()
        .from(masterSessionSummaries)
        .where(eq(masterSessionSummaries.sessionId, input.sessionId))
        .limit(1);
      return { summary: row ?? null };
    }),
});

// 마스터 세션 요약 결과 타입
interface MasterSummaryResult {
  summary: string;
  keyTopics: string;
  dbChanges: string;
  devHistory: string;
}
