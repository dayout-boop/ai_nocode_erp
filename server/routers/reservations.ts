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
import { eq, like, desc, asc, and, gte, lte, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { format } from "date-fns";
import {
  writeAuditLog,
  diffFields,
  resolveActorName,
  generateRecordNo,
  listEntityAuditLogs,
  type AuditEntityType,
} from "../services/auditLog";
import { buildDuplicateMessage } from "../../shared/duplicateWarning";

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

/**
 * [테넌트 격리] 행 소유 테넌트와 컨텍스트 테넌트를 비교해 접근 가부를 판정한다.
 * - ctxTenantId == null  → 마스터 세션(전체보기): 항상 허용
 * - ctxTenantId == number → 파트너 세션: 동일 테넌트 행만 허용
 * 반환값: 'ok' | 'not_found' | 'forbidden'
 */
export function evaluateTenantAccess(
  rowTenantId: number | null | undefined,
  ctxTenantId: number | null
): "ok" | "not_found" | "forbidden" {
  if (ctxTenantId == null) return "ok"; // 마스터: 전체 접근
  if (rowTenantId == null || rowTenantId === undefined) return "not_found";
  return rowTenantId === ctxTenantId ? "ok" : "forbidden";
}

/** 예약 필드 한글 라벨 (변경 이력 표시용) */
const RESERVATION_FIELD_LABELS: Record<string, string> = {
  productName: "상품명",
  golfCourseName: "골프장명",
  departureDate: "출발일",
  nights: "박수",
  teams: "팀수",
  headcount: "인원",
  customerName: "고객명",
  customerPhone: "고객 연락처",
  customerEmail: "고객 이메일",
  assignedTo: "담당자",
  agentName: "대리점명",
  salePricePerPerson: "판매가(1인)",
  salePriceTotal: "판매 합계",
  depositPrice: "입금가(공급가)",
  extraFee: "추가요금",
  profit: "수익",
  status: "예약 상태",
  paymentStatus: "입금 상태",
  paidAmount: "입금 합계",
  remittedAmount: "송금 합계",
  notes: "비고",
  managerName: "담당자명",
  managerPhone: "담당자 연락처",
  progressStatus: "진행 상태",
  partnerCompanyName: "파트너 업체명",
  partnerContactName: "파트너 담당자",
  partnerContactPhone: "파트너 연락처",
};

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
        status: z.enum(["pending", "confirmed", "cancelled", "completed", "voided", "all"]).default("all"),
        paymentStatus: z.enum(["unpaid", "partial", "paid", "all"]).default("all"),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        sortBy: z.enum(["departureDate", "createdAt", "headcount"]).default("departureDate"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        warningOnly: z.boolean().default(false),
        /** 삭제(voided) 건 포함 여부. 기본 false → 삭제건 숨김. status=voided 선택 시에만 노출 */
        includeVoided: z.boolean().default(false),
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

      // [삭제건 노출 제어] status 필터가 voided가 아니고 includeVoided=false면 삭제건 숨김
      if (input.status !== "voided" && !input.includeVoided) {
        conditions.push(sql`${reservations.status} <> 'voided'` as any);
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
  // 파트너(대표/스태프) 또는 마스터 모두 등록 가능 (담당자 자동 기입)
  create: partnerProcedure
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
        /** 중복 경고를 확인하고도 강행할 때 true */
        confirmDuplicate: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // [중복 경고] 동일 고객명 + 연락처 + 출발일 + 골프장명 예약이 이미 있으면 경고 반환
      if (!input.confirmDuplicate) {
        const dupConds: any[] = [
          eq(reservations.customerName, input.customerName),
          eq(reservations.departureDate, new Date(input.departureDate)),
        ];
        if (input.customerPhone) dupConds.push(eq(reservations.customerPhone, input.customerPhone));
        if (input.golfCourseName) dupConds.push(eq(reservations.golfCourseName, input.golfCourseName));
        if (ctx.tenantId != null) dupConds.push(eq(reservations.tenantId, ctx.tenantId));
        const dups = await db
          .select({ id: reservations.id, reservationNo: reservations.reservationNo })
          .from(reservations)
          .where(and(...dupConds))
          .limit(3);
        const activeDups = dups.filter(Boolean);
        if (activeDups.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: buildDuplicateMessage(activeDups.map((d) => d.reservationNo).filter((n): n is string => !!n)),
          });
        }
      }

      const reservationNo = generateReservationNo();
      // 담당자 정보 자동 기입 (파트너 대표/스태프/마스터 모두 지원)
      const managerName = input.managerName
        || (ctx as any).partnerOwner?.name
        || (ctx as any).partnerStaff?.name
        || (ctx as any).user?.name
        || (ctx as any).user?.email
        || undefined;
      // 테넌트 격리: 파트너 세션이면 해당 tenantId 자동 기입
      const tenantId = ctx.tenantId ?? undefined;
      const { packageId, ...restInput } = input;
      const [result] = await db.insert(reservations).values({
        ...restInput,
        reservationNo,
        departureDate: new Date(input.departureDate),
        paymentStatus: "unpaid",
        paidAmount: 0,
        remittedAmount: 0,
        managerName,
        tenantId: tenantId ?? null,
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

      // [감사 로그] 예약 생성 기록
      await writeAuditLog({
        ctx,
        entityType: "reservation",
        entityId: newReservationId,
        entityNo: reservationNo,
        action: "create",
        summary: `예약 등록 (${input.customerName} / ${input.golfCourseName ?? input.productName})`,
        tenantId: tenantId ?? null,
      });

      return { id: newReservationId, reservationNo };
    }),

  // ─── 예약 수정 ────────────────────────────────────────────────
  // RBAC: admin은 모든 예약 수정 가능, 파트너는 자사 테넌트 예약만 수정 가능
  update: partnerProcedure
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
        status: z.enum(["pending", "confirmed", "cancelled", "completed", "voided"]).optional(),
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

      // 수정 전 원본 조회 (변경 이력 diff 및 테넌트 검증용)
      const [before] = await db.select().from(reservations).where(eq(reservations.id, input.id));
      if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: '예약을 찾을 수 없습니다.' });

      // RBAC: 파트너 세션이면 자사 테넌트 예약만 수정 가능
      if (ctx.tenantId != null && before.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '다른 업체의 예약은 수정할 수 없습니다.' });
      }

      const { id, departureDate, ...rest } = input;
      const updateData: Record<string, unknown> = { ...rest };
      delete (updateData as any).confirmDuplicate;
      if (departureDate) updateData.departureDate = new Date(departureDate);
      await db.update(reservations).set(updateData).where(eq(reservations.id, id));

      // [감사 로그] 변경된 필드만 기록 (담당자/상태/금액 포함)
      const changes = diffFields(before as any, updateData, RESERVATION_FIELD_LABELS);
      if (changes.length > 0) {
        const hasStatus = changes.some((c) => c.field === "status");
        const hasManager = changes.some((c) => c.field === "managerName" || c.field === "assignedTo");
        const hasAmount = changes.some((c) =>
          ["salePricePerPerson", "salePriceTotal", "depositPrice", "extraFee", "profit", "paidAmount", "remittedAmount"].includes(c.field)
        );
        const action = hasStatus ? "status_change" : hasManager ? "manager_change" : hasAmount ? "amount_change" : "update";
        await writeAuditLog({
          ctx,
          entityType: "reservation",
          entityId: id,
          entityNo: before.reservationNo,
          action,
          summary: `예약 수정: ${changes.map((c) => c.label).join(", ")}`,
          fieldChanges: changes,
          tenantId: before.tenantId,
        });
      }
      return { success: true };
    }),

  // ─── 예약 삭제(= 상태 전환) ────────────────────────────────────
  // 정책: 물리 삭제 불가. status='voided'로 전환만 허용(마스터 포함).
  // 파트너 세션은 자사 테넌트 예약만 상태 전환 가능.
  delete: partnerProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await db
        .select({ tenantId: reservations.tenantId, reservationNo: reservations.reservationNo, status: reservations.status, customerName: reservations.customerName })
        .from(reservations)
        .where(eq(reservations.id, input.id));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: '예약을 찾을 수 없습니다.' });
      if (ctx.tenantId != null && existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '다른 업체의 예약은 삭제할 수 없습니다.' });
      }
      if (existing.status === "voided") {
        return { success: true, alreadyVoided: true };
      }

      const actorName = resolveActorName(ctx);
      await db.update(reservations).set({
        status: "voided",
        voidedAt: new Date(),
        voidedBy: actorName ?? null,
        voidReason: input.reason ?? null,
      }).where(eq(reservations.id, input.id));

      await writeAuditLog({
        ctx,
        entityType: "reservation",
        entityId: input.id,
        entityNo: existing.reservationNo,
        action: "void",
        summary: `예약 삭제(상태 전환) - ${existing.customerName}${input.reason ? ` / 사유: ${input.reason}` : ""}`,
        fieldChanges: [{ field: "status", label: "예약 상태", before: existing.status, after: "voided" }],
        tenantId: existing.tenantId,
      });
      return { success: true };
    }),

  // ─── 예약 복구(삭제 취소) ─────────────────────────────────────
  // void 상태를 pending으로 되돌림 (기록 유지)
  restore: partnerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db
        .select({ tenantId: reservations.tenantId, reservationNo: reservations.reservationNo, status: reservations.status })
        .from(reservations)
        .where(eq(reservations.id, input.id));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: '예약을 찾을 수 없습니다.' });
      if (ctx.tenantId != null && existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '다른 업체의 예약은 복구할 수 없습니다.' });
      }
      await db.update(reservations).set({ status: "pending", voidedAt: null, voidedBy: null, voidReason: null }).where(eq(reservations.id, input.id));
      await writeAuditLog({
        ctx,
        entityType: "reservation",
        entityId: input.id,
        entityNo: existing.reservationNo,
        action: "status_change",
        summary: "예약 복구(삭제 취소)",
        fieldChanges: [{ field: "status", label: "예약 상태", before: "voided", after: "pending" }],
        tenantId: existing.tenantId,
      });
      return { success: true };
    }),

  // ─── 입금 내역 등록 ───────────────────────────────────────────
  // RBAC: 파트너/마스터 모두 가능. 매칭 예약은 자사 테넌트 건만 허용.
  addIncome: partnerProcedure
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
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const matchStatus = input.matchedReservationId ? "matched" : "unmatched";
      const matchedTenantId = await getReservationTenantId(db, input.matchedReservationId);
      // [테넌트 격리] 파트너가 다른 업체 예약에 자금을 매칭하지 못하도록 차단
      if (ctx.tenantId != null && input.matchedReservationId && matchedTenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 예약에는 입금을 등록할 수 없습니다." });
      }
      const recordNo = generateRecordNo("income");
      const [result] = await db.insert(incomeRecords).values({
        ...input,
        recordNo,
        transactionDate: new Date(input.transactionDate),
        matchStatus,
        tenantId: matchedTenantId ?? ctx.tenantId ?? null,
      });
      const incomeId = (result as any).insertId;

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

      await writeAuditLog({
        ctx, entityType: "income", entityId: incomeId, entityNo: recordNo, action: "create",
        summary: `입금 등록 ${input.amount.toLocaleString()}원${input.depositorName ? ` / ${input.depositorName}` : ""}`,
        tenantId: matchedTenantId ?? ctx.tenantId ?? null,
      });

      return { id: incomeId, recordNo };
    }),

  // ─── 송금 내역 등록 ───────────────────────────────────────────
  // RBAC: 파트너/마스터 모두 가능. 매칭 예약은 자사 테넌트 건만 허용.
  addRemittance: partnerProcedure
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
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const matchStatus = input.matchedReservationId ? "matched" : "unmatched";
      const matchedTenantId = await getReservationTenantId(db, input.matchedReservationId);
      if (ctx.tenantId != null && input.matchedReservationId && matchedTenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 예약에는 송금을 등록할 수 없습니다." });
      }
      const recordNo = generateRecordNo("remittance");
      const [result] = await db.insert(remittanceRecords).values({
        ...input,
        recordNo,
        transactionDate: new Date(input.transactionDate),
        matchStatus,
        tenantId: matchedTenantId ?? ctx.tenantId ?? null,
      });
      const remitId = (result as any).insertId;

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

      await writeAuditLog({
        ctx, entityType: "remittance", entityId: remitId, entityNo: recordNo, action: "create",
        summary: `송금 등록 ${input.amount.toLocaleString()}원${input.recipientName ? ` / ${input.recipientName}` : ""}`,
        tenantId: matchedTenantId ?? ctx.tenantId ?? null,
      });

      return { id: remitId, recordNo };
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
        includeVoided: z.boolean().default(false),
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
      if (!input.includeVoided) {
        conditions.push(sql`${incomeRecords.recordStatus} <> 'void'`);
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
        includeVoided: z.boolean().default(false),
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
      if (!input.includeVoided) {
        conditions.push(sql`${remittanceRecords.recordStatus} <> 'void'`);
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
    .input(z.object({ type: z.enum(["unpaid", "expected", "deduct_other", "deduct_shinhan", "all"]).default("all"), includeVoided: z.boolean().default(false) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [];
      if (ctx.tenantId != null) conditions.push(eq(depositRecords.tenantId, ctx.tenantId));
      if (!input.includeVoided) conditions.push(sql`${depositRecords.recordStatus} <> 'void'`);
      if (input.type !== "all") conditions.push(eq(depositRecords.type, input.type));
      return db
        .select()
        .from(depositRecords)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(depositRecords.createdAt));
    }),

  // ─── 예치금 등록 ──────────────────────────────────────────────
  addDeposit: partnerProcedure
    .input(
      z.object({
        reservationId: z.number().optional(),
        reservationNo: z.string().optional(),
        type: z.enum(["unpaid", "expected", "deduct_other", "deduct_shinhan"]),
        amount: z.number(),
        memo: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const matchedTenantId = await getReservationTenantId(db, input.reservationId);
      if (ctx.tenantId != null && input.reservationId && matchedTenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 예약에는 예치금을 등록할 수 없습니다." });
      }
      const recordNo = generateRecordNo("deposit");
      const [result] = await db.insert(depositRecords).values({ ...input, recordNo, tenantId: matchedTenantId ?? ctx.tenantId ?? null });
      const depId = (result as any).insertId;
      await writeAuditLog({
        ctx, entityType: "deposit", entityId: depId, entityNo: recordNo, action: "create",
        summary: `예치금 등록 ${input.amount.toLocaleString()}원 (${input.type})`,
        tenantId: matchedTenantId ?? ctx.tenantId ?? null,
      });
      return { id: depId, recordNo };
    }),

  // ─── 충전 내역 목록 ───────────────────────────────────────────
  // [테넌트 격리]
  listCharge: partnerProcedure
    .input(z.object({ page: z.number().default(1), pageSize: z.number().default(30), includeVoided: z.boolean().default(false) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const conds: any[] = [];
      if (ctx.tenantId != null) conds.push(eq(chargeRecords.tenantId, ctx.tenantId));
      if (!input.includeVoided) conds.push(sql`${chargeRecords.recordStatus} <> 'void'`);
      return db
        .select()
        .from(chargeRecords)
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(chargeRecords.transactionDate))
        .limit(input.pageSize)
        .offset(offset);
    }),

  // ─── 충전 내역 등록 ───────────────────────────────────────────
  addCharge: partnerProcedure
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
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const matchStatus = input.matchedReservationId ? "matched" : "unmatched";
      const matchedTenantId = await getReservationTenantId(db, input.matchedReservationId);
      if (ctx.tenantId != null && input.matchedReservationId && matchedTenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 예약에는 충전 내역을 등록할 수 없습니다." });
      }
      const recordNo = generateRecordNo("charge");
      const [result] = await db.insert(chargeRecords).values({
        ...input,
        recordNo,
        transactionDate: new Date(input.transactionDate),
        matchStatus,
        tenantId: matchedTenantId ?? ctx.tenantId ?? null,
      });
      const chgId = (result as any).insertId;
      await writeAuditLog({
        ctx, entityType: "charge", entityId: chgId, entityNo: recordNo, action: "create",
        summary: `충전 등록 ${input.amount.toLocaleString()}원${input.golfCourseName ? ` / ${input.golfCourseName}` : ""}`,
        tenantId: matchedTenantId ?? ctx.tenantId ?? null,
      });
      return { id: chgId, recordNo };
    }),

  // ─── 데파짓 목록 ──────────────────────────────────────────────
  listPrepaid: partnerProcedure
    .input(z.object({ includeVoided: z.boolean().default(false) }).optional())
    .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const conds: any[] = [];
    if (ctx.tenantId != null) conds.push(eq(prepaidRecords.tenantId, ctx.tenantId));
    if (!input?.includeVoided) conds.push(sql`${prepaidRecords.recordStatus} <> 'void'`);
    return db
      .select()
      .from(prepaidRecords)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(prepaidRecords.createdAt));
  }),

  // ─── 데파짓 등록 ──────────────────────────────────────────────
  addPrepaid: partnerProcedure
    .input(
      z.object({
        affiliateId: z.number().optional(),
        golfCourseName: z.string(),
        prepaidAmount: z.number(),
        usedAmount: z.number().default(0),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const remaining = input.prepaidAmount - (input.usedAmount || 0);
      const recordNo = generateRecordNo("prepaid");
      const [result] = await db.insert(prepaidRecords).values({
        ...input,
        recordNo,
        remainingAmount: remaining,
        tenantId: ctx.tenantId ?? null,
      });
      const ppId = (result as any).insertId;
      await writeAuditLog({
        ctx, entityType: "prepaid", entityId: ppId, entityNo: recordNo, action: "create",
        summary: `데파짓 등록 ${input.prepaidAmount.toLocaleString()}원 / ${input.golfCourseName}`,
        tenantId: ctx.tenantId ?? null,
      });
      return { id: ppId, recordNo };
    }),

  // ─── 데파짓 사용금액 업데이트 ─────────────────────────────────
  updatePrepaid: partnerProcedure
    .input(z.object({
      id: z.number(),
      usedAmount: z.number().optional(),
      prepaidAmount: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await db.select().from(prepaidRecords).where(eq(prepaidRecords.id, input.id)).limit(1);
      if (!existing.length) throw new TRPCError({ code: "NOT_FOUND" });
      const current = existing[0];
      if (ctx.tenantId != null && current.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 데파짓은 수정할 수 없습니다." });
      }
      const prepaidAmount = input.prepaidAmount ?? current.prepaidAmount;
      const usedAmount = input.usedAmount ?? current.usedAmount ?? 0;
      await db.update(prepaidRecords).set({
        prepaidAmount,
        usedAmount,
        remainingAmount: prepaidAmount - usedAmount,
        notes: input.notes ?? current.notes,
      }).where(eq(prepaidRecords.id, input.id));
      const ppChanges = diffFields(
        { prepaidAmount: current.prepaidAmount, usedAmount: current.usedAmount ?? 0, notes: current.notes },
        { prepaidAmount: input.prepaidAmount, usedAmount: input.usedAmount, notes: input.notes },
        { prepaidAmount: "데파짓 금액", usedAmount: "사용 금액", notes: "비고" }
      );
      if (ppChanges.length > 0) {
        await writeAuditLog({
          ctx, entityType: "prepaid", entityId: input.id, entityNo: current.recordNo, action: "amount_change",
          summary: `데파짓 수정 (잔액 ${(prepaidAmount - usedAmount).toLocaleString()}원)`,
          fieldChanges: ppChanges, tenantId: current.tenantId,
        });
      }
      return { success: true };
    }),

  // ─── 충전 내역 예약번호 매칭 업데이트 ────────────────────────
  matchCharge: partnerProcedure
    .input(z.object({
      id: z.number(),
      reservationNo: z.string().optional(),
      matchedReservationId: z.number().optional(),
      golfCourseName: z.string().optional(),
      matchStatus: z.enum(["unmatched", "matched", "partial"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updateData } = input;
      const matchStatus = updateData.matchedReservationId ? "matched" : (updateData.matchStatus ?? "unmatched");
      // 부모 reservation의 tenantId 상속 (매칭 시점 동기화)
      const tenantId = await getReservationTenantId(db, updateData.matchedReservationId);
      // [테넌트 격리] 파트너는 자사 충전건만 매칭 가능, 자사 예약에만 매칭 가능
      if (ctx.tenantId != null) {
        const [chargeRow] = await db.select({ tenantId: chargeRecords.tenantId }).from(chargeRecords).where(eq(chargeRecords.id, id)).limit(1);
        if (chargeRow && chargeRow.tenantId != null && chargeRow.tenantId !== ctx.tenantId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 충전 내역은 수정할 수 없습니다." });
        }
        if (updateData.matchedReservationId && tenantId !== ctx.tenantId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 예약에는 매칭할 수 없습니다." });
        }
      }
      const [beforeChg] = await db.select({ recordNo: chargeRecords.recordNo, reservationNo: chargeRecords.reservationNo, matchedReservationId: chargeRecords.matchedReservationId, tenantId: chargeRecords.tenantId }).from(chargeRecords).where(eq(chargeRecords.id, id)).limit(1);
      await db.update(chargeRecords)
        .set({ ...updateData, matchStatus, ...(updateData.matchedReservationId ? { tenantId } : {}) })
        .where(eq(chargeRecords.id, id));
      await writeAuditLog({
        ctx, entityType: "charge", entityId: id, entityNo: beforeChg?.recordNo ?? null, action: "match_change",
        summary: `충전 예약번호 매칭 변경${updateData.reservationNo ? ` → ${updateData.reservationNo}` : " → 해제"}`,
        fieldChanges: [
          { field: "reservationNo", label: "매칭 예약번호", before: beforeChg?.reservationNo ?? null, after: updateData.reservationNo ?? null },
          { field: "matchedReservationId", label: "매칭 예약ID", before: beforeChg?.matchedReservationId ?? null, after: updateData.matchedReservationId ?? null },
        ],
        tenantId: beforeChg?.tenantId ?? ctx.tenantId ?? null,
      });
      return { success: true };
    }),

  // ─── 입금 내역 삭제(= void 전환) ──────────────────────────────
  // 정책: 물리 삭제 불가. recordStatus='void' 전환 + 매칭 예약 입금합계 롤백.
  voidIncome: partnerProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [rec] = await db.select().from(incomeRecords).where(eq(incomeRecords.id, input.id));
      if (!rec) throw new TRPCError({ code: "NOT_FOUND", message: "입금 내역을 찾을 수 없습니다." });
      if (ctx.tenantId != null && rec.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 입금 내역은 삭제할 수 없습니다." });
      }
      if (rec.recordStatus === "void") return { success: true, alreadyVoided: true };
      await db.update(incomeRecords).set({
        recordStatus: "void", voidedAt: new Date(), voidedBy: resolveActorName(ctx) ?? null, voidReason: input.reason ?? null,
      }).where(eq(incomeRecords.id, input.id));
      // 매칭 예약 입금합계 롤백
      if (rec.matchedReservationId) {
        const [res] = await db.select({ paidAmount: reservations.paidAmount, salePriceTotal: reservations.salePriceTotal }).from(reservations).where(eq(reservations.id, rec.matchedReservationId));
        if (res) {
          const newPaid = Math.max(0, (res.paidAmount || 0) - (rec.amount || 0));
          const paymentStatus = newPaid >= (res.salePriceTotal || 0) ? "paid" : newPaid > 0 ? "partial" : "unpaid";
          await db.update(reservations).set({ paidAmount: newPaid, paymentStatus }).where(eq(reservations.id, rec.matchedReservationId));
        }
      }
      await writeAuditLog({ ctx, entityType: "income", entityId: input.id, entityNo: rec.recordNo, action: "void", summary: `입금 삭제(상태 전환) ${(rec.amount||0).toLocaleString()}원${input.reason ? ` / 사유: ${input.reason}` : ""}`, fieldChanges: [{ field: "recordStatus", label: "상태", before: "active", after: "void" }], tenantId: rec.tenantId });
      return { success: true };
    }),

  // ─── 송금 내역 삭제(= void 전환) ──────────────────────────────
  voidRemittance: partnerProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [rec] = await db.select().from(remittanceRecords).where(eq(remittanceRecords.id, input.id));
      if (!rec) throw new TRPCError({ code: "NOT_FOUND", message: "송금 내역을 찾을 수 없습니다." });
      if (ctx.tenantId != null && rec.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 송금 내역은 삭제할 수 없습니다." });
      }
      if (rec.recordStatus === "void") return { success: true, alreadyVoided: true };
      await db.update(remittanceRecords).set({
        recordStatus: "void", voidedAt: new Date(), voidedBy: resolveActorName(ctx) ?? null, voidReason: input.reason ?? null,
      }).where(eq(remittanceRecords.id, input.id));
      if (rec.matchedReservationId) {
        const [res] = await db.select({ remittedAmount: reservations.remittedAmount }).from(reservations).where(eq(reservations.id, rec.matchedReservationId));
        if (res) {
          const newRemitted = Math.max(0, (res.remittedAmount || 0) - (rec.amount || 0));
          await db.update(reservations).set({ remittedAmount: newRemitted }).where(eq(reservations.id, rec.matchedReservationId));
        }
      }
      await writeAuditLog({ ctx, entityType: "remittance", entityId: input.id, entityNo: rec.recordNo, action: "void", summary: `송금 삭제(상태 전환) ${(rec.amount||0).toLocaleString()}원${input.reason ? ` / 사유: ${input.reason}` : ""}`, fieldChanges: [{ field: "recordStatus", label: "상태", before: "active", after: "void" }], tenantId: rec.tenantId });
      return { success: true };
    }),

  // ─── 예치금 삭제(= void 전환) ─────────────────────────────────
  // 정책: 물리 삭제 불가. 파트너도 자사 건 void 가능.
  deleteDeposit: partnerProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [rec] = await db.select().from(depositRecords).where(eq(depositRecords.id, input.id));
      if (!rec) throw new TRPCError({ code: "NOT_FOUND", message: "예치금 내역을 찾을 수 없습니다." });
      if (ctx.tenantId != null && rec.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 예치금은 삭제할 수 없습니다." });
      }
      if (rec.recordStatus === "void") return { success: true, alreadyVoided: true };
      await db.update(depositRecords).set({ recordStatus: "void", voidedAt: new Date(), voidedBy: resolveActorName(ctx) ?? null, voidReason: input.reason ?? null }).where(eq(depositRecords.id, input.id));
      await writeAuditLog({ ctx, entityType: "deposit", entityId: input.id, entityNo: rec.recordNo, action: "void", summary: `예치금 삭제(상태 전환) ${(rec.amount||0).toLocaleString()}원`, fieldChanges: [{ field: "recordStatus", label: "상태", before: "active", after: "void" }], tenantId: rec.tenantId });
      return { success: true };
    }),

  // ─── 충전 내역 삭제(= void 전환) ──────────────────────────────
  deleteCharge: partnerProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [rec] = await db.select().from(chargeRecords).where(eq(chargeRecords.id, input.id));
      if (!rec) throw new TRPCError({ code: "NOT_FOUND", message: "충전 내역을 찾을 수 없습니다." });
      if (ctx.tenantId != null && rec.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 충전 내역은 삭제할 수 없습니다." });
      }
      if (rec.recordStatus === "void") return { success: true, alreadyVoided: true };
      await db.update(chargeRecords).set({ recordStatus: "void", voidedAt: new Date(), voidedBy: resolveActorName(ctx) ?? null, voidReason: input.reason ?? null }).where(eq(chargeRecords.id, input.id));
      await writeAuditLog({ ctx, entityType: "charge", entityId: input.id, entityNo: rec.recordNo, action: "void", summary: `충전 삭제(상태 전환) ${(rec.amount||0).toLocaleString()}원`, fieldChanges: [{ field: "recordStatus", label: "상태", before: "active", after: "void" }], tenantId: rec.tenantId });
      return { success: true };
    }),

  // ─── 데파짓 삭제(= void 전환) ─────────────────────────────────
  deletePrepaid: partnerProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [rec] = await db.select().from(prepaidRecords).where(eq(prepaidRecords.id, input.id));
      if (!rec) throw new TRPCError({ code: "NOT_FOUND", message: "데파짓 내역을 찾을 수 없습니다." });
      if (ctx.tenantId != null && rec.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 데파짓은 삭제할 수 없습니다." });
      }
      if (rec.recordStatus === "void") return { success: true, alreadyVoided: true };
      await db.update(prepaidRecords).set({ recordStatus: "void", voidedAt: new Date(), voidedBy: resolveActorName(ctx) ?? null, voidReason: input.reason ?? null }).where(eq(prepaidRecords.id, input.id));
      await writeAuditLog({ ctx, entityType: "prepaid", entityId: input.id, entityNo: rec.recordNo, action: "void", summary: `데파짓 삭제(상태 전환) ${(rec.prepaidAmount||0).toLocaleString()}원`, fieldChanges: [{ field: "recordStatus", label: "상태", before: "active", after: "void" }], tenantId: rec.tenantId });
      return { success: true };
    }),

  // ─── 전체 목록 조회 (엑셀 내보내기용, 최대 5000건) ────────────────
  // RBAC: admin만 전체 내보내기 가능
  listAll: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(["pending", "confirmed", "cancelled", "completed", "voided", "all"]).default("all"),
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
  summary: partnerProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // [테넌트 격리] 파트너 또는 admin의 특정 테넌트 선택 시 자사 데이터만 집계
    const tid = ctx.tenantId;
    // voided(삭제) 예약은 통계에서 제외
    const notVoided = sql`${reservations.status} <> 'voided'`;
    const resTenant = tid != null
      ? and(eq(reservations.tenantId, tid), notVoided)
      : notVoided;
    const incomeTenant = tid != null ? eq(incomeRecords.tenantId, tid) : undefined;
    const remitTenant = tid != null ? eq(remittanceRecords.tenantId, tid) : undefined;

    const [allReservations, monthReservations, unmatchedIncome, unmatchedRemittance] = await Promise.all([
      db.select({ id: reservations.id, status: reservations.status, salePriceTotal: reservations.salePriceTotal, paidAmount: reservations.paidAmount }).from(reservations).where(resTenant),
      db.select({ id: reservations.id, salePriceTotal: reservations.salePriceTotal }).from(reservations).where(and(gte(reservations.departureDate, startOfMonth), lte(reservations.departureDate, endOfMonth), ...(resTenant ? [resTenant] : []))),
      db.select({ id: incomeRecords.id }).from(incomeRecords).where(and(eq(incomeRecords.matchStatus, "unmatched"), ...(incomeTenant ? [incomeTenant] : []))),
      db.select({ id: remittanceRecords.id }).from(remittanceRecords).where(and(eq(remittanceRecords.matchStatus, "unmatched"), ...(remitTenant ? [remitTenant] : []))),
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

  // ─── 감사 로그 조회 (건별) ────────────────────────────────────
  // 각 예약/자금 건의 변경 이력을 최신순으로 반환. 테넌트 격리 적용.
  auditByEntity: partnerProcedure
    .input(z.object({
      entityType: z.enum(["reservation", "income", "remittance", "deposit", "charge", "prepaid"]),
      entityId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const logs = await listEntityAuditLogs(input.entityType as AuditEntityType, input.entityId);
      // 테넌트 격리: 파트너는 자사 테넌트 로그만
      if (ctx.tenantId != null) {
        return logs.filter((l: any) => l.tenantId == null || l.tenantId === ctx.tenantId);
      }
      return logs;
    }),
});
