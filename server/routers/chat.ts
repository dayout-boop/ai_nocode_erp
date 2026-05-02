/**
 * 상담 세션 tRPC 라우터
 * - createSession: 상담 세션 생성
 * - getSession: 세션 조회
 * - closeSession: 세션 종료 + AI 요약 생성
 * - listSessions: 세션 목록 (관리자)
 * - listMasterSessions: 두골프 마스터 AI 대화 이력 목록 (300012)
 * - getMasterSessionMessages: 특정 세션 메시지 조회 (300012)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, count, sql, ne } from "drizzle-orm";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { chatSessions, aiLogs } from "../../drizzle/schema";
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
   * [300012] 두골프 마스터 AI 대화 이력 목록 조회
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
});
