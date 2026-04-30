import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { reservationAffiliateCosts, affiliates } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// 비용 행 입력 스키마
const costRowSchema = z.object({
  id: z.number().optional(),
  affiliateId: z.number().nullable().optional(),
  affiliateName: z.string().nullable().optional(),
  costType: z.enum(["golf", "accommodation", "transport", "other"]).default("golf"),
  date: z.string().optional(), // ISO string
  confirmedTime: z.string().nullable().optional(),
  unitPrice: z.number().default(0),
  salePrice: z.number().default(0),
  quantity: z.number().default(1),
  notes: z.string().nullable().optional(),
});

export const reservationAffiliateCostsRouter = router({
  // ─── 예약별 제휴사 비용 조회 ──────────────────────────────────
  list: protectedProcedure
    .input(z.object({ reservationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select()
        .from(reservationAffiliateCosts)
        .where(eq(reservationAffiliateCosts.reservationId, input.reservationId))
        .orderBy(reservationAffiliateCosts.date, reservationAffiliateCosts.costType);

      // 제휴사 정보 조회
      const affiliateIds = new Set<number>();
      rows.forEach((r) => {
        if (r.affiliateId) affiliateIds.add(r.affiliateId);
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
        affiliate: r.affiliateId ? affiliateMap[r.affiliateId] ?? null : null,
      }));
    }),

  // ─── 예약별 제휴사 비용 합계 조회 ────────────────────────────
  summary: protectedProcedure
    .input(z.object({ reservationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select()
        .from(reservationAffiliateCosts)
        .where(eq(reservationAffiliateCosts.reservationId, input.reservationId));

      const totalUnitPrice = rows.reduce((sum, r) => sum + (r.unitPrice ?? 0) * (r.quantity ?? 1), 0);
      const totalSalePrice = rows.reduce((sum, r) => sum + (r.salePrice ?? 0) * (r.quantity ?? 1), 0);
      const totalProfit = totalSalePrice - totalUnitPrice;

      return {
        totalUnitPrice,
        totalSalePrice,
        totalProfit,
        count: rows.length,
      };
    }),

  // ─── 예약별 제휴사 비용 일괄 저장 (upsert) ───────────────────
  upsert: protectedProcedure
    .input(
      z.object({
        reservationId: z.number(),
        rows: z.array(costRowSchema),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 기존 비용 삭제 후 재삽입 (전체 교체 방식)
      await db
        .delete(reservationAffiliateCosts)
        .where(eq(reservationAffiliateCosts.reservationId, input.reservationId));

      if (input.rows.length === 0) return { success: true, count: 0 };

      const now = new Date();
      await db.insert(reservationAffiliateCosts).values(
        input.rows.map((row) => ({
          reservationId: input.reservationId,
          affiliateId: row.affiliateId ?? null,
          affiliateName: row.affiliateName ?? null,
          costType: row.costType,
          date: row.date ? new Date(row.date) : null,
          confirmedTime: row.confirmedTime ?? null,
          unitPrice: row.unitPrice,
          salePrice: row.salePrice,
          quantity: row.quantity,
          notes: row.notes ?? null,
          createdAt: now,
        }))
      );

      return { success: true, count: input.rows.length };
    }),

  // ─── 예약별 제휴사 비용 전체 삭제 ────────────────────────────
  deleteAll: protectedProcedure
    .input(z.object({ reservationId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .delete(reservationAffiliateCosts)
        .where(eq(reservationAffiliateCosts.reservationId, input.reservationId));

      return { success: true };
    }),
});
