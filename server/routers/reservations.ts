import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  reservations,
  incomeRecords,
  remittanceRecords,
  depositRecords,
  chargeRecords,
  prepaidRecords,
} from "../../drizzle/schema";
import { eq, like, desc, and, gte, lte, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { format } from "date-fns";

function generateReservationNo(): string {
  const now = new Date();
  const ym = format(now, "yyyyMM");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `OY-${ym}-${rand}`;
}

export const reservationsRouter = router({
  // ─── 예약 목록 조회 ───────────────────────────────────────────
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        search: z.string().optional(),
        status: z.enum(["pending", "confirmed", "cancelled", "completed", "all"]).default("all"),
        paymentStatus: z.enum(["unpaid", "partial", "paid", "all"]).default("all"),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const conditions: ReturnType<typeof eq>[] = [];

      if (input.search) {
        conditions.push(
          or(
            like(reservations.customerName, `%${input.search}%`),
            like(reservations.reservationNo, `%${input.search}%`),
            like(reservations.productName, `%${input.search}%`),
            like(reservations.golfCourseName, `%${input.search}%`),
            like(reservations.customerPhone, `%${input.search}%`)
          ) as any
        );
      }
      if (input.status !== "all") {
        conditions.push(eq(reservations.status, input.status) as any);
      }
      if (input.paymentStatus !== "all") {
        conditions.push(eq(reservations.paymentStatus, input.paymentStatus) as any);
      }
      if (input.dateFrom) {
        conditions.push(gte(reservations.departureDate, new Date(input.dateFrom)) as any);
      }
      if (input.dateTo) {
        conditions.push(lte(reservations.departureDate, new Date(input.dateTo)) as any);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, countRows] = await Promise.all([
        db
          .select()
          .from(reservations)
          .where(whereClause)
          .orderBy(desc(reservations.departureDate))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ id: reservations.id }).from(reservations).where(whereClause),
      ]);

      return {
        items: rows,
        total: countRows.length,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // ─── 예약 단건 조회 ───────────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [reservation] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, input.id));
      if (!reservation) throw new TRPCError({ code: "NOT_FOUND", message: "예약을 찾을 수 없습니다." });

      const [incomes, remittances, deposits, charges] = await Promise.all([
        db.select().from(incomeRecords).where(eq(incomeRecords.matchedReservationId, input.id)),
        db.select().from(remittanceRecords).where(eq(remittanceRecords.matchedReservationId, input.id)),
        db.select().from(depositRecords).where(eq(depositRecords.reservationId, input.id)),
        db.select().from(chargeRecords).where(eq(chargeRecords.matchedReservationId, input.id)),
      ]);

      return { reservation, incomes, remittances, deposits, charges };
    }),

  // ─── 예약 등록 ────────────────────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        productName: z.string().min(1),
        golfCourseName: z.string().optional(),
        affiliateId: z.number().optional(),
        departureDate: z.string(),
        nights: z.number().default(0),
        teams: z.number().default(1),
        headcount: z.number().default(1),
        customerName: z.string().min(1),
        customerPhone: z.string().optional(),
        customerEmail: z.string().optional(),
        assignedTo: z.string().optional(),
        agentName: z.string().optional(),
        salePricePerPerson: z.number().default(0),
        salePriceTotal: z.number().default(0),
        depositPrice: z.number().default(0),
        extraFee: z.number().default(0),
        profit: z.number().default(0),
        status: z.enum(["pending", "confirmed", "cancelled", "completed"]).default("pending"),
        notes: z.string().optional(),
        userType: z.enum(["customer", "partner", "manager"]).default("customer").optional(),
        partnerId: z.number().optional(),
        partnerCompanyName: z.string().optional(),
        partnerContactName: z.string().optional(),
        partnerContactPhone: z.string().optional(),
        managerName: z.string().optional(),
        managerPhone: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const reservationNo = generateReservationNo();
      // 담당자 정보 자동 기입
      const managerName = input.managerName || ctx.user.name || ctx.user.email || undefined;
      const [result] = await db.insert(reservations).values({
        ...input,
        reservationNo,
        departureDate: new Date(input.departureDate),
        paymentStatus: "unpaid",
        paidAmount: 0,
        remittedAmount: 0,
        managerName,
      });
      return { id: (result as any).insertId, reservationNo };
    }),

  // ─── 예약 수정 ────────────────────────────────────────────────
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        productName: z.string().optional(),
        golfCourseName: z.string().optional(),
        affiliateId: z.number().optional(),
        departureDate: z.string().optional(),
        nights: z.number().optional(),
        teams: z.number().optional(),
        headcount: z.number().optional(),
        customerName: z.string().optional(),
        customerPhone: z.string().optional(),
        customerEmail: z.string().optional(),
        assignedTo: z.string().optional(),
        agentName: z.string().optional(),
        salePricePerPerson: z.number().optional(),
        salePriceTotal: z.number().optional(),
        depositPrice: z.number().optional(),
        extraFee: z.number().optional(),
        profit: z.number().optional(),
        status: z.enum(["pending", "confirmed", "cancelled", "completed"]).optional(),
        paymentStatus: z.enum(["unpaid", "partial", "paid"]).optional(),
        paidAmount: z.number().optional(),
        remittedAmount: z.number().optional(),
        notes: z.string().optional(),
        userType: z.enum(["customer", "partner", "manager"]).optional(),
        partnerId: z.number().optional(),
        partnerCompanyName: z.string().optional(),
        partnerContactName: z.string().optional(),
        partnerContactPhone: z.string().optional(),
        managerName: z.string().optional(),
        managerPhone: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, departureDate, ...rest } = input;
      const updateData: Record<string, unknown> = { ...rest };
      if (departureDate) updateData.departureDate = new Date(departureDate);
      await db.update(reservations).set(updateData).where(eq(reservations.id, id));
      return { success: true };
    }),

  // ─── 예약 삭제 ────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(reservations).where(eq(reservations.id, input.id));
      return { success: true };
    }),

  // ─── 입금 내역 등록 ───────────────────────────────────────────
  addIncome: protectedProcedure
    .input(
      z.object({
        transactionDate: z.string(),
        bankName: z.string().optional(),
        amount: z.number(),
        depositorName: z.string().optional(),
        detail: z.string().optional(),
        reservationNo: z.string().optional(),
        matchedReservationId: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const matchStatus = input.matchedReservationId ? "matched" : "unmatched";
      const [result] = await db.insert(incomeRecords).values({
        ...input,
        transactionDate: new Date(input.transactionDate),
        matchStatus,
      });

      if (input.matchedReservationId) {
        const [res] = await db
          .select({ paidAmount: reservations.paidAmount, salePriceTotal: reservations.salePriceTotal })
          .from(reservations)
          .where(eq(reservations.id, input.matchedReservationId));
        if (res) {
          const newPaid = (res.paidAmount || 0) + input.amount;
          const paymentStatus =
            newPaid >= (res.salePriceTotal || 0) ? "paid" : newPaid > 0 ? "partial" : "unpaid";
          await db
            .update(reservations)
            .set({ paidAmount: newPaid, paymentStatus })
            .where(eq(reservations.id, input.matchedReservationId));
        }
      }

      return { id: (result as any).insertId };
    }),

  // ─── 송금 내역 등록 ───────────────────────────────────────────
  addRemittance: protectedProcedure
    .input(
      z.object({
        transactionDate: z.string(),
        bankName: z.string().optional(),
        amount: z.number(),
        recipientName: z.string().optional(),
        detail: z.string().optional(),
        reservationNo: z.string().optional(),
        matchedReservationId: z.number().optional(),
        affiliateId: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const matchStatus = input.matchedReservationId ? "matched" : "unmatched";
      const [result] = await db.insert(remittanceRecords).values({
        ...input,
        transactionDate: new Date(input.transactionDate),
        matchStatus,
      });

      if (input.matchedReservationId) {
        const [res] = await db
          .select({ remittedAmount: reservations.remittedAmount })
          .from(reservations)
          .where(eq(reservations.id, input.matchedReservationId));
        if (res) {
          const newRemitted = (res.remittedAmount || 0) + input.amount;
          await db
            .update(reservations)
            .set({ remittedAmount: newRemitted })
            .where(eq(reservations.id, input.matchedReservationId));
        }
      }

      return { id: (result as any).insertId };
    }),

  // ─── 입금 내역 목록 ───────────────────────────────────────────
  listIncome: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(30),
        matchStatus: z.enum(["unmatched", "matched", "partial", "all"]).default("all"),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const conditions: any[] = [];
      if (input.matchStatus !== "all") {
        conditions.push(eq(incomeRecords.matchStatus, input.matchStatus));
      }
      if (input.search) {
        conditions.push(
          or(
            like(incomeRecords.depositorName, `%${input.search}%`),
            like(incomeRecords.reservationNo, `%${input.search}%`),
            like(incomeRecords.detail, `%${input.search}%`)
          )
        );
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      return db
        .select()
        .from(incomeRecords)
        .where(whereClause)
        .orderBy(desc(incomeRecords.transactionDate))
        .limit(input.pageSize)
        .offset(offset);
    }),

  // ─── 송금 내역 목록 ───────────────────────────────────────────
  listRemittance: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(30),
        matchStatus: z.enum(["unmatched", "matched", "partial", "all"]).default("all"),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const conditions: any[] = [];
      if (input.matchStatus !== "all") {
        conditions.push(eq(remittanceRecords.matchStatus, input.matchStatus));
      }
      if (input.search) {
        conditions.push(
          or(
            like(remittanceRecords.recipientName, `%${input.search}%`),
            like(remittanceRecords.reservationNo, `%${input.search}%`)
          )
        );
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      return db
        .select()
        .from(remittanceRecords)
        .where(whereClause)
        .orderBy(desc(remittanceRecords.transactionDate))
        .limit(input.pageSize)
        .offset(offset);
    }),

  // ─── 예치금 목록 ──────────────────────────────────────────────
  listDeposit: protectedProcedure
    .input(z.object({ type: z.enum(["unpaid", "expected", "deduct_other", "deduct_shinhan", "all"]).default("all") }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(depositRecords)
        .where(input.type !== "all" ? eq(depositRecords.type, input.type) : undefined)
        .orderBy(desc(depositRecords.createdAt));
    }),

  // ─── 예치금 등록 ──────────────────────────────────────────────
  addDeposit: protectedProcedure
    .input(
      z.object({
        reservationId: z.number().optional(),
        reservationNo: z.string().optional(),
        type: z.enum(["unpaid", "expected", "deduct_other", "deduct_shinhan"]),
        amount: z.number(),
        memo: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(depositRecords).values(input);
      return { id: (result as any).insertId };
    }),

  // ─── 충전 내역 목록 ───────────────────────────────────────────
  listCharge: protectedProcedure
    .input(z.object({ page: z.number().default(1), pageSize: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      return db
        .select()
        .from(chargeRecords)
        .orderBy(desc(chargeRecords.transactionDate))
        .limit(input.pageSize)
        .offset(offset);
    }),

  // ─── 충전 내역 등록 ───────────────────────────────────────────
  addCharge: protectedProcedure
    .input(
      z.object({
        cardCompany: z.string().optional(),
        golfCourseName: z.string().optional(),
        amount: z.number(),
        transactionDate: z.string(),
        reservationNo: z.string().optional(),
        matchedReservationId: z.number().optional(),
        rawText: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const matchStatus = input.matchedReservationId ? "matched" : "unmatched";
      const [result] = await db.insert(chargeRecords).values({
        ...input,
        transactionDate: new Date(input.transactionDate),
        matchStatus,
      });
      return { id: (result as any).insertId };
    }),

  // ─── 데파짓 목록 ──────────────────────────────────────────────
  listPrepaid: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db
      .select()
      .from(prepaidRecords)
      .orderBy(desc(prepaidRecords.createdAt));
  }),

  // ─── 데파짓 등록 ──────────────────────────────────────────────
  addPrepaid: protectedProcedure
    .input(
      z.object({
        affiliateId: z.number().optional(),
        golfCourseName: z.string(),
        prepaidAmount: z.number(),
        usedAmount: z.number().default(0),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const remaining = input.prepaidAmount - (input.usedAmount || 0);
      const [result] = await db.insert(prepaidRecords).values({
        ...input,
        remainingAmount: remaining,
      });
      return { id: (result as any).insertId };
    }),

  // ─── 대시보드 요약 통계 ───────────────────────────────────────
  summary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [allReservations, monthReservations, unmatchedIncome, unmatchedRemittance] = await Promise.all([
      db.select({ id: reservations.id, status: reservations.status, salePriceTotal: reservations.salePriceTotal, paidAmount: reservations.paidAmount }).from(reservations),
      db.select({ id: reservations.id, salePriceTotal: reservations.salePriceTotal }).from(reservations).where(and(gte(reservations.departureDate, startOfMonth), lte(reservations.departureDate, endOfMonth))),
      db.select({ id: incomeRecords.id }).from(incomeRecords).where(eq(incomeRecords.matchStatus, "unmatched")),
      db.select({ id: remittanceRecords.id }).from(remittanceRecords).where(eq(remittanceRecords.matchStatus, "unmatched")),
    ]);

    const totalSales = allReservations.reduce((sum: number, r) => sum + (r.salePriceTotal || 0), 0);
    const totalPaid = allReservations.reduce((sum: number, r) => sum + (r.paidAmount || 0), 0);
    const monthSales = monthReservations.reduce((sum: number, r) => sum + (r.salePriceTotal || 0), 0);
    const statusCounts = allReservations.reduce((acc: Record<string, number>, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    return {
      totalReservations: allReservations.length,
      monthReservations: monthReservations.length,
      totalSales,
      totalPaid,
      monthSales,
      unpaidAmount: totalSales - totalPaid,
      unmatchedIncome: unmatchedIncome.length,
      unmatchedRemittance: unmatchedRemittance.length,
      statusCounts,
    };
  }),
});
