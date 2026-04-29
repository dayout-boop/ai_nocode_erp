import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { reservationInquiries, inquiryTemplates, reservations } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";

export const reservationInquiriesRouter = router({
  // ─── 예약별 문의 목록 조회 ───────────────────────────────────────
  listByReservation: protectedProcedure
    .input(z.object({ reservationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select()
        .from(reservationInquiries)
        .where(eq(reservationInquiries.reservationId, input.reservationId))
        .orderBy(reservationInquiries.sortOrder, reservationInquiries.createdAt);
      return rows;
    }),

  // ─── 문의 생성 ───────────────────────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        reservationId: z.number(),
        reservationNo: z.string().optional(),
        inquiryText: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // 현재 예약의 최대 sortOrder 조회
      const existing = await db
        .select({ sortOrder: reservationInquiries.sortOrder })
        .from(reservationInquiries)
        .where(eq(reservationInquiries.reservationId, input.reservationId))
        .orderBy(desc(reservationInquiries.sortOrder))
        .limit(1);
      const nextOrder = existing.length > 0 ? (existing[0].sortOrder ?? 0) + 1 : 0;
      const [result] = await db.insert(reservationInquiries).values({
        reservationId: input.reservationId,
        reservationNo: input.reservationNo,
        inquiryText: input.inquiryText ?? "",
        sortOrder: nextOrder,
        updatedBy: ctx.user.name ?? ctx.user.email ?? "unknown",
      });
      const [created] = await db
        .select()
        .from(reservationInquiries)
        .where(eq(reservationInquiries.id, (result as any).insertId));
      return created;
    }),

  // ─── 문의 내용 업데이트 (자동저장) ──────────────────────────────
  updateInquiry: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        inquiryText: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(reservationInquiries)
        .set({
          inquiryText: input.inquiryText,
          updatedBy: ctx.user.name ?? ctx.user.email ?? "unknown",
        })
        .where(eq(reservationInquiries.id, input.id));
      return { success: true };
    }),

  // ─── 답변 내용 업데이트 (자동저장) ──────────────────────────────
  updateReply: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        replyText: z.string(),
        inquiryStatus: z.enum(["draft", "sent", "replied", "confirmed"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(reservationInquiries)
        .set({
          replyText: input.replyText,
          inquiryStatus: input.inquiryStatus ?? "replied",
          updatedBy: ctx.user.name ?? ctx.user.email ?? "unknown",
        })
        .where(eq(reservationInquiries.id, input.id));
      return { success: true };
    }),

  // ─── AI 자동 문의 생성 ───────────────────────────────────────────
  generateAuto: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        reservationId: z.number(),
        inquiryText: z.string(),
        templateId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 예약 정보 조회
      const [reservation] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, input.reservationId));

      // 템플릿 조회 (있는 경우)
      let templateContent = "";
      if (input.templateId) {
        const [template] = await db
          .select()
          .from(inquiryTemplates)
          .where(eq(inquiryTemplates.id, input.templateId));
        if (template) templateContent = template.content;
      }

      const systemPrompt = `당신은 골프 여행사의 예약 담당자입니다. 거래처나 고객의 문의 내용을 골프장에 보낼 공식 문의 형식으로 변환해주세요.
문의 형식:
- 정중하고 전문적인 어투 사용
- 예약 정보(예약번호, 출발일, 인원, 팀수) 포함
- 구체적인 확인 요청 사항 명시
- 답변 기한 요청 포함
${templateContent ? `\n참고 템플릿:\n${templateContent}` : ""}`;

      const userPrompt = `다음 문의 내용을 골프장 공식 문의 형식으로 변환해주세요.

예약 정보:
- 예약번호: ${reservation?.reservationNo ?? "미정"}
- 골프장: ${reservation?.golfCourseName ?? "미정"}
- 출발일: ${reservation?.departureDate ? new Date(reservation.departureDate).toLocaleDateString("ko-KR") : "미정"}
- 인원: ${reservation?.headcount ?? 0}명 / ${reservation?.teams ?? 0}팀

거래처 문의 내용:
${input.inquiryText}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        const rawContent = response.choices?.[0]?.message?.content;
        const autoText = typeof rawContent === "string" ? rawContent : "";
        await db
          .update(reservationInquiries)
          .set({
            autoText,
            templateId: input.templateId,
            inquiryStatus: "sent",
            updatedBy: ctx.user.name ?? ctx.user.email ?? "unknown",
          })
          .where(eq(reservationInquiries.id, input.id));
        // 템플릿 사용 횟수 증가
        if (input.templateId) {
          await db
            .update(inquiryTemplates)
            .set({ useCount: 0 })
            .where(eq(inquiryTemplates.id, input.templateId));
        }
        return { success: true, autoText };
      } catch (e) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 생성 실패" });
      }
    }),

  // ─── 문의 삭제 ───────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(reservationInquiries).where(eq(reservationInquiries.id, input.id));
      return { success: true };
    }),
});

// ─── 문의 자동화 템플릿 라우터 ──────────────────────────────────────
export const inquiryTemplatesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        category: z.enum(["golf_booking", "accommodation", "transport", "general", "estimate", "all"]).default("all"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select()
        .from(inquiryTemplates)
        .where(
          input.category !== "all"
            ? and(eq(inquiryTemplates.category, input.category), eq(inquiryTemplates.isActive, true))
            : eq(inquiryTemplates.isActive, true)
        )
        .orderBy(desc(inquiryTemplates.useCount));
      return rows;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        category: z.enum(["golf_booking", "accommodation", "transport", "general", "estimate"]).default("golf_booking"),
        content: z.string().min(1),
        variables: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(inquiryTemplates).values({
        name: input.name,
        category: input.category,
        content: input.content,
        variables: input.variables,
      });
      return { id: (result as any).insertId };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        category: z.enum(["golf_booking", "accommodation", "transport", "general", "estimate"]).optional(),
        content: z.string().min(1).optional(),
        variables: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db.update(inquiryTemplates).set(rest).where(eq(inquiryTemplates.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(inquiryTemplates).where(eq(inquiryTemplates.id, input.id));
      return { success: true };
    }),
});
