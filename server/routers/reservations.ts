import { z } from "zod";
import { router, protectedProcedure, adminProcedure, partnerProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  reservations,
  incomeRecords,
  remittanceRecords,
  depositRecords,
  chargeRecords,
  prepaidRecords,
  packages,
  reservationItineraries,
} from "../../drizzle/schema";
import { eq, like, desc, asc, and, gte, lte, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { format } from "date-fns";

/**
 * [테넌트 동기화] 자금 레코드(5종)가 부모 reservation의 tenantId를 상속하도록 조회.
 * 근거: reservation이 자금 5종의 관리급 통합정본(부모). matchedReservationId가 없으면 null 반환.
 */
async function getReservationTenantId(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  matchedReservationId?: number | null
): Promise<number | null> {
  if (!matchedReservationId) return null;
  const [res] = await db
    .select({ tenantId: reservations.tenantId })
    .from(reservations)
    .where(eq(reservations.id, matchedReservationId));
  return res?.tenantId ?? null;
}

function generateReservationNo(): string {
  const now = new Date();
  const ym = format(now, "yyyyMM");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `OY-${ym}-${rand}`;
}

/**
 * 예약 소유권 검증 헬퍼
 * - admin: 모든 예약 접근 가능
 * - user: managerName이 본인 이름/이메일과 일치하는 예약만 수정/삭제 가능
 */
async function assertReservationOwnership(
  reservationId: number,
  user: { name?: string | null; email?: string | null; role: string },
  db: Awaited<ReturnType<typeof getDb>>
) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  if (user.role === "admin") return; // admin은 모든 예약 접근 가능

  const [reservation] = await db
    .select({ id: reservations.id, managerName: reservations.managerName })
    .from(reservations)
    .where(eq(reservations.id, reservationId));

  if (!reservation) {
    throw new TRPCError({ code: "NOT_FOUND", message: "예약을 찾을 수 없습니다." });
  }

  const userIdentifier = user.name || user.email || "";
  if (!userIdentifier || reservation.managerName !== userIdentifier) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "본인이 등록한 예약만 수정/삭제할 수 있습니다. 관리자에게 문의하세요.",
    });
  }
}

export const reservationsRouter = router({
  // ─── 예약 목록 조회 ───────────────────────────────────────────
  // [테넌트 격리] partnerProcedure: admin 전체보기(tenantId=null)=기존과 동일 전체조회,
  // 파트너 또는 admin이 특정 테넌트 선택 시 해당 tenantId 예약만 조회
  list: partnerProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        search: z.string().optional(),
        status: z.enum(["pending", "confirmed", "cancelled", "completed", "all"]).default("all"),
        paymentStatus: z.enum(["unpaid", "partial", "paid", "all"]).default("all"),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        sortBy: z.enum(["departureDate", "createdAt", "headcount"]).default("departureDate"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        warningOnly: z.boolean().default(false),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const conditions: ReturnType<typeof eq>[] = [];

      // 테넌트 격리: 특정 테넌트 컨텍스트면 해당 예약만
      if (ctx.tenantId != null) {
        conditions.push(eq(reservations.tenantId, ctx.tenantId) as any);
      }

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

      // 경고 필터: 출발일 15일 전 예약 중 완납 아닌 건
      if (input.warningOnly) {
        const warningDate = new Date();
        warningDate.setDate(warningDate.getDate() + 15);
        conditions.push(lte(reservations.departureDate, warningDate) as any);
        conditions.push(gte(reservations.departureDate, new Date()) as any);
        // 완납(paid) 아닌 것만
        conditions.push(
          or(
            eq(reservations.paymentStatus, "unpaid"),
            eq(reservations.paymentStatus, "partial")
          ) as any
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // 동적 정렬
      const sortCol =
        input.sortBy === "createdAt" ? reservations.createdAt
        : input.sortBy === "headcount" ? reservations.headcount
        : reservations.departureDate;
      const orderExpr = input.sortOrder === "asc" ? asc(sortCol) : desc(sortCol);

      const [rows, countRows] = await Promise.all([
        db
          .select()
          .from(reservations)
          .where(whereClause)
          .orderBy(orderExpr)
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
  // [테넌트 격리] 특정 테넌트 컨텍스트면 다른 테넌트 예약 접근 차단
  getById: partnerProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [reservation] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, input.id));
      if (!reservation) throw new TRPCError({ code: "NOT_FOUND", message: "예약을 찾을 수 없습니다." });
      // 테넌트 격리: 특정 테넌트 컨텍스트는 자사 예약만 열람 가능
      if (ctx.tenantId != null && reservation.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 예약은 조회할 수 없습니다." });
      }

      const [incomes, remittances, deposits, charges] = await Promise.all([
        db.select().from(incomeRecords).where(eq(incomeRecords.matchedReservationId, input.id)),
        db.select().from(remittanceRecords).where(eq(remittanceRecords.matchedReservationId, input.id)),
        db.select().from(depositRecords).where(eq(depositRecords.reservationId, input.id)),
        db.select().from(chargeRecords).where(eq(chargeRecords.matchedReservationId, input.id)),
      ]);

      return { reservation, incomes, remittances, deposits, charges };
    }),

  // ─── 예약 등록 ────────────────────────────────────────────────
  // 로그인한 모든 사용자가 등록 가능 (담당자 자동 기입)
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
        packageId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const reservationNo = generateReservationNo();
      // 담당자 정보 자동 기입
      const managerName = input.managerName || ctx.user.name || ctx.user.email || undefined;
      const { packageId, ...restInput } = input;
      const [result] = await db.insert(reservations).values({
        ...restInput,
        reservationNo,
        departureDate: new Date(input.departureDate),
        paymentStatus: "unpaid",
        paidAmount: 0,
        remittedAmount: 0,
        managerName,
      });
      const newReservationId = (result as any).insertId as number;

      // 상품의 기본 일정 템플릿 자동 복사
      if (packageId) {
        try {
          const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId));
          const defaultItinerary = pkg?.defaultItinerary as Array<{
            dayIndex: number;
            dayType: string;
            holeCount?: number;
            teeTime?: string;
            golfAffiliateId?: number;
            accommodationAffiliateId?: number;
            roomType?: string;
            roomCount?: number;
            flightInfo?: unknown;
            notes?: string;
          }> | null;

          if (defaultItinerary && defaultItinerary.length > 0) {
            const departureDateObj = new Date(input.departureDate);
            const itineraryValues = defaultItinerary.map((row) => {
              const d = new Date(departureDateObj);
              d.setDate(d.getDate() + row.dayIndex);
              return {
                reservationId: newReservationId,
                dayIndex: row.dayIndex,
                date: d,
                dayType: (row.dayType ?? "stay") as "departure" | "stay" | "arrival" | "daytrip",
                holeCount: row.holeCount ?? 18,
                teeTime: row.teeTime ?? null,
                golfAffiliateId: row.golfAffiliateId ?? null,
                accommodationAffiliateId: row.accommodationAffiliateId ?? null,
                roomType: row.roomType ?? null,
                roomCount: row.roomCount ?? 1,
                flightInfo: row.flightInfo ? JSON.stringify(row.flightInfo) : null,
                notes: row.notes ?? null,
              };
            });
            await db.insert(reservationItineraries).values(itineraryValues);
          }
        } catch (e) {
          // 일정 복사 실패는 예약 생성을 막지 않음
          console.error("[create reservation] 기본 일정 복사 실패:", e);
        }
      }

      return { id: newReservationId, reservationNo };
    }),

  // ─── 예약 수정 ────────────────────────────────────────────────
  // RBAC: admin은 모든 예약 수정 가능, user는 본인 등록 예약만 수정 가능
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
        progressStatus: z.enum(["proceeding", "impossible", "confirmed", "waiting"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // RBAC: 소유권 검증 (admin은 통과, user는 본인 예약만)
      await assertReservationOwnership(input.id, ctx.user, db);

      const { id, departureDate, ...rest } = input;
      const updateData: Record<string, unknown> = { ...rest };
      if (departureDate) updateData.departureDate = new Date(departureDate);
      await db.update(reservations).set(updateData).where(eq(reservations.id, id));
      return { success: true };
    }),

  // ─── 예약 삭제 ────────────────────────────────────────────────
  // RBAC: admin만 삭제 가능 (삭제는 더 엄격하게 관리)
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(reservations).where(eq(reservations.id, input.id));
      return { success: true };
    }),

  // ─── 입금 내역 등록 ───────────────────────────────────────────
  // RBAC: 로그인한 모든 사용자 가능 (입금 등록은 업무상 필요)
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
      const tenantId = await getReservationTenantId(db, input.matchedReservationId);
      const [result] = await db.insert(incomeRecords).values({
        ...input,
        transactionDate: new Date(input.transactionDate),
        matchStatus,
        tenantId,
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
  // RBAC: 로그인한 모든 사용자 가능
  addRemittance: protectedProcedure
    .input(
      z.object({
        transactionDate: z.string(),
        bankName: z.string().optional(),
        amount: z.number(),
        recipientName: z.string().optional(),
        recipientType: z.enum(["golf_course", "accommodation", "transport", "other"]).optional(),
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
      const tenantId = await getReservationTenantId(db, input.matchedReservationId);
      const [result] = await db.insert(remittanceRecords).values({
        ...input,
        transactionDate: new Date(input.transactionDate),
        matchStatus,
        tenantId,
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
  // [테넌트 격리] 특정 테넌트 컨텍스트면 자사 자금만
  listIncome: partnerProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(30),
        matchStatus: z.enum(["unmatched", "matched", "partial", "all"]).default("all"),
        search: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const conditions: any[] = [];
      if (ctx.tenantId != null) {
        conditions.push(eq(incomeRecords.tenantId, ctx.tenantId));
      }
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
  // [테넌트 격리]
  listRemittance: partnerProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(30),
        matchStatus: z.enum(["unmatched", "matched", "partial", "all"]).default("all"),
        search: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const conditions: any[] = [];
      if (ctx.tenantId != null) {
        conditions.push(eq(remittanceRecords.tenantId, ctx.tenantId));
      }
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
  // [테넌트 격리]
  listDeposit: partnerProcedure
    .input(z.object({ type: z.enum(["unpaid", "expected", "deduct_other", "deduct_shinhan", "all"]).default("all") }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [];
      if (ctx.tenantId != null) conditions.push(eq(depositRecords.tenantId, ctx.tenantId));
      if (input.type !== "all") conditions.push(eq(depositRecords.type, input.type));
      return db
        .select()
        .from(depositRecords)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
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
      const tenantId = await getReservationTenantId(db, input.reservationId);
      const [result] = await db.insert(depositRecords).values({ ...input, tenantId });
      return { id: (result as any).insertId };
    }),

  // ─── 충전 내역 목록 ───────────────────────────────────────────
  // [테넌트 격리]
  listCharge: partnerProcedure
    .input(z.object({ page: z.number().default(1), pageSize: z.number().default(30) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      return db
        .select()
        .from(chargeRecords)
        .where(ctx.tenantId != null ? eq(chargeRecords.tenantId, ctx.tenantId) : undefined)
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
      const tenantId = await getReservationTenantId(db, input.matchedReservationId);
      const [result] = await db.insert(chargeRecords).values({
        ...input,
        transactionDate: new Date(input.transactionDate),
        matchStatus,
        tenantId,
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

  // ─── 데파짓 사용금액 업데이트 ─────────────────────────────────
  updatePrepaid: protectedProcedure
    .input(z.object({
      id: z.number(),
      usedAmount: z.number().optional(),
      prepaidAmount: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.select().from(prepaidRecords).where(eq(prepaidRecords.id, input.id)).limit(1);
      if (!existing.length) throw new TRPCError({ code: "NOT_FOUND" });
      const current = existing[0];
      const prepaidAmount = input.prepaidAmount ?? current.prepaidAmount;
      const usedAmount = input.usedAmount ?? current.usedAmount ?? 0;
      await db.update(prepaidRecords).set({
        prepaidAmount,
        usedAmount,
        remainingAmount: prepaidAmount - usedAmount,
        notes: input.notes ?? current.notes,
      }).where(eq(prepaidRecords.id, input.id));
      return { success: true };
    }),

  // ─── 충전 내역 예약번호 매칭 업데이트 ────────────────────────
  matchCharge: protectedProcedure
    .input(z.object({
      id: z.number(),
      reservationNo: z.string().optional(),
      matchedReservationId: z.number().optional(),
      golfCourseName: z.string().optional(),
      matchStatus: z.enum(["unmatched", "matched", "partial"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updateData } = input;
      const matchStatus = updateData.matchedReservationId ? "matched" : (updateData.matchStatus ?? "unmatched");
      // 부모 reservation의 tenantId 상속 (매칭 시점 동기화)
      const tenantId = await getReservationTenantId(db, updateData.matchedReservationId);
      await db.update(chargeRecords)
        .set({ ...updateData, matchStatus, ...(updateData.matchedReservationId ? { tenantId } : {}) })
        .where(eq(chargeRecords.id, id));
      return { success: true };
    }),

  // ─── 예치금 삭제 ──────────────────────────────────────────────
  // RBAC: admin만 삭제 가능
  deleteDeposit: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(depositRecords).where(eq(depositRecords.id, input.id));
      return { success: true };
    }),

  // ─── 충전 내역 삭제 ───────────────────────────────────────────
  // RBAC: admin만 삭제 가능
  deleteCharge: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(chargeRecords).where(eq(chargeRecords.id, input.id));
      return { success: true };
    }),

  // ─── 데파짓 삭제 ──────────────────────────────────────────────
  // RBAC: admin만 삭제 가능
  deletePrepaid: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(prepaidRecords).where(eq(prepaidRecords.id, input.id));
      return { success: true };
    }),

  // ─── 전체 목록 조회 (엑셀 내보내기용, 최대 5000건) ────────────────
  // RBAC: admin만 전체 내보내기 가능
  listAll: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(["pending", "confirmed", "cancelled", "completed", "all"]).default("all"),
        paymentStatus: z.enum(["unpaid", "partial", "paid", "all"]).default("all"),
        sortBy: z.enum(["departureDate", "createdAt", "headcount"]).default("departureDate"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        warningOnly: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
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
      if (input.warningOnly) {
        const warningDate = new Date();
        warningDate.setDate(warningDate.getDate() + 15);
        conditions.push(lte(reservations.departureDate, warningDate) as any);
        conditions.push(gte(reservations.departureDate, new Date()) as any);
        conditions.push(
          or(
            eq(reservations.paymentStatus, "unpaid"),
            eq(reservations.paymentStatus, "partial")
          ) as any
        );
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const sortCol =
        input.sortBy === "createdAt" ? reservations.createdAt
        : input.sortBy === "headcount" ? reservations.headcount
        : reservations.departureDate;
      const orderExpr = input.sortOrder === "asc" ? asc(sortCol) : desc(sortCol);
      const rows = await db
        .select()
        .from(reservations)
        .where(whereClause)
        .orderBy(orderExpr)
        .limit(5000);
      return { items: rows };
    }),

  // ─── 대시보드 요약 통계 ───────────────────────────
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

    const totalCount = allReservations.length;
    const confirmedCount = allReservations.filter((r) => r.status === "confirmed").length;
    const pendingCount = allReservations.filter((r) => r.status === "pending").length;
    const cancelledCount = allReservations.filter((r) => r.status === "cancelled").length;
    const monthRevenue = monthReservations.reduce((sum, r) => sum + (r.salePriceTotal || 0), 0);
    const totalRevenue = allReservations.reduce((sum, r) => sum + (r.salePriceTotal || 0), 0);
    const unpaidCount = allReservations.filter((r) => r.paidAmount === 0 || r.paidAmount === null).length;

    return {
      totalCount,
      confirmedCount,
      pendingCount,
      cancelledCount,
      monthRevenue,
      totalRevenue,
      unpaidCount,
      unmatchedIncomeCount: unmatchedIncome.length,
      unmatchedRemittanceCount: unmatchedRemittance.length,
    };
  }),
});
