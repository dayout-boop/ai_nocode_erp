import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { reservationItineraries, affiliates } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// 항공 정보 스키마
const flightInfoSchema = z.object({
  airline: z.string().optional(),
  depAirport: z.string().optional(),
  depTime: z.string().optional(),
  arrAirport: z.string().optional(),
  arrTime: z.string().optional(),
}).nullable().optional();

// 일정 행 입력 스키마
const itineraryRowSchema = z.object({
  id: z.number().optional(),
  dayIndex: z.number(),
  date: z.string().optional(), // ISO string
  dayType: z.enum(["departure", "stay", "arrival", "daytrip"]).default("stay"),
  golfAffiliateId: z.number().nullable().optional(),
  holeCount: z.number().default(18),
  teeTime: z.string().nullable().optional(),
  accommodationAffiliateId: z.number().nullable().optional(),
  roomType: z.string().nullable().optional(),
  roomCount: z.number().default(1),
  flightInfo: flightInfoSchema,
  notes: z.string().nullable().optional(),
});

export const reservationItinerariesRouter = router({
  // ─── 예약 일정 조회 ───────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({ reservationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select()
        .from(reservationItineraries)
        .where(eq(reservationItineraries.reservationId, input.reservationId))
        .orderBy(reservationItineraries.dayIndex);

      // 제휴사 정보 조회 (골프장 + 숙소)
      const affiliateIds = new Set<number>();
      rows.forEach((r) => {
        if (r.golfAffiliateId) affiliateIds.add(r.golfAffiliateId);
        if (r.accommodationAffiliateId) affiliateIds.add(r.accommodationAffiliateId);
      });

      const affiliateMap: Record<number, { id: number; name: string; type: string | null }> = {};
      if (affiliateIds.size > 0) {
        const affiliateList = await db
          .select({ id: affiliates.id, name: affiliates.name, type: affiliates.type })
          .from(affiliates);
        affiliateList.forEach((a) => {
          affiliateMap[a.id] = a;
        });
      }

      return rows.map((r) => ({
        ...r,
        flightInfo: r.flightInfo ? JSON.parse(r.flightInfo) : null,
        golfAffiliate: r.golfAffiliateId ? affiliateMap[r.golfAffiliateId] ?? null : null,
        accommodationAffiliate: r.accommodationAffiliateId ? affiliateMap[r.accommodationAffiliateId] ?? null : null,
      }));
    }),

  // ─── 예약 일정 일괄 저장 (upsert) ────────────────────────────
  upsert: protectedProcedure
    .input(
      z.object({
        reservationId: z.number(),
        rows: z.array(itineraryRowSchema),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 기존 일정 삭제 후 재삽입 (전체 교체 방식)
      await db
        .delete(reservationItineraries)
        .where(eq(reservationItineraries.reservationId, input.reservationId));

      if (input.rows.length === 0) return { success: true, count: 0 };

      const now = new Date();
      await db.insert(reservationItineraries).values(
        input.rows.map((row) => ({
          reservationId: input.reservationId,
          dayIndex: row.dayIndex,
          date: row.date ? new Date(row.date) : null,
          dayType: row.dayType,
          golfAffiliateId: row.golfAffiliateId ?? null,
          holeCount: row.holeCount,
          teeTime: row.teeTime ?? null,
          accommodationAffiliateId: row.accommodationAffiliateId ?? null,
          roomType: row.roomType ?? null,
          roomCount: row.roomCount,
          flightInfo: row.flightInfo ? JSON.stringify(row.flightInfo) : null,
          notes: row.notes ?? null,
          createdAt: now,
        }))
      );

      return { success: true, count: input.rows.length };
    }),

  // ─── 예약 일정 전체 삭제 ─────────────────────────────────────
  deleteAll: protectedProcedure
    .input(z.object({ reservationId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .delete(reservationItineraries)
        .where(eq(reservationItineraries.reservationId, input.reservationId));

      return { success: true };
    }),
});
