import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  customerEstimateTemplates,
  estimates,
  reservations,
  reservationItineraries,
  affiliates,
} from "../../drizzle/schema";

// ─── 고객 견적서 템플릿 라우터 ──────────────────────────────────────
export const customerEstimateTemplatesRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db
      .select()
      .from(customerEstimateTemplates)
      .where(eq(customerEstimateTemplates.isActive, true))
      .orderBy(desc(customerEstimateTemplates.useCount));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select()
        .from(customerEstimateTemplates)
        .where(eq(customerEstimateTemplates.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        includeItems: z.string().optional(),
        excludeItems: z.string().optional(),
        notes: z.string().optional(),
        schedule: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(customerEstimateTemplates).values({
        name: input.name,
        includeItems: input.includeItems,
        excludeItems: input.excludeItems,
        notes: input.notes,
        schedule: input.schedule,
      });
      return { id: (result as any).insertId };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        includeItems: z.string().optional(),
        excludeItems: z.string().optional(),
        notes: z.string().optional(),
        schedule: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db
        .update(customerEstimateTemplates)
        .set(rest)
        .where(eq(customerEstimateTemplates.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .delete(customerEstimateTemplates)
        .where(eq(customerEstimateTemplates.id, input.id));
      return { success: true };
    }),
});

// ─── 견적서 라우터 ──────────────────────────────────────────────────
export const estimatesRouter = router({
  // 견적서 생성
  create: protectedProcedure
    .input(
      z.object({
        reservationId: z.number(),
        templateId: z.number().optional(),
        estimateType: z.enum(["partner", "customer"]).default("customer"),
        customData: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 기존 견적서 확인 (같은 예약+유형)
      const [existing] = await db
        .select()
        .from(estimates)
        .where(
          and(
            eq(estimates.reservationId, input.reservationId),
            eq(estimates.estimateType, input.estimateType)
          )
        );

      if (existing) {
        // 기존 견적서 업데이트
        await db
          .update(estimates)
          .set({
            templateId: input.templateId,
            customData: input.customData,
            createdBy: ctx.user.name ?? ctx.user.email ?? "unknown",
          })
          .where(eq(estimates.id, existing.id));
        return { id: existing.id, token: existing.token };
      }

      // 새 견적서 생성 - 임시 토큰으로 삽입 후 ID 기반 토큰 업데이트
      const [result] = await db.insert(estimates).values({
        reservationId: input.reservationId,
        token: `tmp_${Date.now()}`,
        templateId: input.templateId,
        estimateType: input.estimateType,
        customData: input.customData,
        createdBy: ctx.user.name ?? ctx.user.email ?? "unknown",
      });
      const newId = (result as any).insertId as number;
      // base64 인코딩 토큰 생성
      const token = Buffer.from(String(newId)).toString("base64");
      await db
        .update(estimates)
        .set({ token })
        .where(eq(estimates.id, newId));

      // 템플릿 사용 횟수 증가
      if (input.templateId) {
        const [tmpl] = await db
          .select()
          .from(customerEstimateTemplates)
          .where(eq(customerEstimateTemplates.id, input.templateId));
        if (tmpl) {
          await db
            .update(customerEstimateTemplates)
            .set({ useCount: (tmpl.useCount ?? 0) + 1 })
            .where(eq(customerEstimateTemplates.id, input.templateId));
        }
      }

      return { id: newId, token };
    }),

  // 예약별 견적서 목록 조회
  listByReservation: protectedProcedure
    .input(z.object({ reservationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(estimates)
        .where(eq(estimates.reservationId, input.reservationId))
        .orderBy(desc(estimates.createdAt));
    }),

  // 공개 견적서 조회 (토큰 기반, 로그인 불필요)
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [estimate] = await db
        .select()
        .from(estimates)
        .where(eq(estimates.token, input.token));
      if (!estimate) throw new TRPCError({ code: "NOT_FOUND" });

      // 예약 정보 조회
      const [reservation] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, estimate.reservationId));

      // 템플릿 조회
      let template = null;
      if (estimate.templateId) {
        const [tmpl] = await db
          .select()
          .from(customerEstimateTemplates)
          .where(eq(customerEstimateTemplates.id, estimate.templateId));
        template = tmpl ?? null;
      }

      // 일정 데이터 조회 (골프장/숙소 제휴사명 포함)
      const itineraryRows = await db
        .select({
          id: reservationItineraries.id,
          dayIndex: reservationItineraries.dayIndex,
          date: reservationItineraries.date,
          dayType: reservationItineraries.dayType,
          holeCount: reservationItineraries.holeCount,
          estimatedTeeTime: reservationItineraries.estimatedTeeTime,
          confirmedTeeTime: reservationItineraries.confirmedTeeTime,
          roomType: reservationItineraries.roomType,
          roomCount: reservationItineraries.roomCount,
          flightInfo: reservationItineraries.flightInfo,
          notes: reservationItineraries.notes,
          golfAffiliateName: affiliates.name,
        })
        .from(reservationItineraries)
        .leftJoin(affiliates, eq(reservationItineraries.golfAffiliateId, affiliates.id))
        .where(eq(reservationItineraries.reservationId, estimate.reservationId))
        .orderBy(reservationItineraries.dayIndex);

      // 숙소 이름 별도 조회
      const itinerariesWithAccom = await Promise.all(
        itineraryRows.map(async (row) => {
          const fullRow = await db
            .select({ accommodationAffiliateName: affiliates.name })
            .from(reservationItineraries)
            .leftJoin(affiliates, eq(reservationItineraries.accommodationAffiliateId, affiliates.id))
            .where(eq(reservationItineraries.id, row.id))
            .limit(1);
          return {
            ...row,
            accommodationAffiliateName: fullRow[0]?.accommodationAffiliateName ?? null,
          };
        })
      );

      return { estimate, reservation, template, itineraries: itinerariesWithAccom };
    }),

  // 발송 처리
  markSent: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        sentVia: z.enum(["email", "kakao"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(estimates)
        .set({ isSent: true, sentAt: new Date(), sentVia: input.sentVia })
        .where(eq(estimates.id, input.id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(estimates).where(eq(estimates.id, input.id));
      return { success: true };
    }),
});
