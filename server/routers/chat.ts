/**
 * 상담 세션 tRPC 라우터
 * - createSession: 상담 세션 생성
 * - getSession: 세션 조회
 * - closeSession: 세션 종료 + AI 요약 생성
 * - listSessions: 세션 목록 (관리자)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, count } from "drizzle-orm";
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
});
