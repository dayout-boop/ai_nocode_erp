import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { reservationItineraries, affiliates, customVariables } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
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
  /** 견적 티오프 시간 */
  estimatedTeeTime: z.string().nullable().optional(),
  /** 확정 티오프 시간 (우선 사용) */
  confirmedTeeTime: z.string().nullable().optional(),
  /** @deprecated 하위 호환성 유지 */
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
          // 하위 호환: teeTime이 있으면 estimatedTeeTime으로 마이그레이션
          estimatedTeeTime: row.estimatedTeeTime ?? row.teeTime ?? null,
          confirmedTeeTime: row.confirmedTeeTime ?? null,
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

// ─── 자동 치환 변수 관리 라우터 ──────────────────────────────────
export const customVariablesRouter = router({
  // 전체 목록 조회
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db
      .select()
      .from(customVariables)
      .orderBy(asc(customVariables.category), asc(customVariables.sortOrder), asc(customVariables.id));
  }),

  // 신규 생성
  create: protectedProcedure
    .input(z.object({
      category: z.string().min(1),
      label: z.string().min(1),
      variableKey: z.string().min(3).regex(/^\{\{.+\}\}$/, "{{변수명}} 형식이어야 합니다"),
      description: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(customVariables).values({
        category: input.category,
        label: input.label,
        variableKey: input.variableKey,
        description: input.description,
        isSystem: false,
        isActive: true,
        sortOrder: input.sortOrder ?? 0,
      });
      return { id: (result as any).insertId };
    }),

  // 수정
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      category: z.string().min(1).optional(),
      label: z.string().min(1).optional(),
      variableKey: z.string().min(3).optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select().from(customVariables).where(eq(customVariables.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      const { id, ...rest } = input;
      await db.update(customVariables).set(rest).where(eq(customVariables.id, id));
      return { success: true };
    }),

  // 삭제 (시스템 변수 삭제 불가)
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select().from(customVariables).where(eq(customVariables.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (row.isSystem) throw new TRPCError({ code: "FORBIDDEN", message: "시스템 기본 변수는 삭제할 수 없습니다" });
      await db.delete(customVariables).where(eq(customVariables.id, input.id));
      return { success: true };
    }),

  // 시스템 기본 변수 시드 (최초 1회 실행)
  seedDefaults: protectedProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const DEFAULT_VARIABLES = [
        // 고객 정보
        { category: "고객 정보", label: "고객명", variableKey: "{{고객명}}", description: "예약자 이름", sortOrder: 1 },
        { category: "고객 정보", label: "연락처", variableKey: "{{연락처}}", description: "예약자 연락처", sortOrder: 2 },
        { category: "고객 정보", label: "이메일", variableKey: "{{이메일}}", description: "예약자 이메일", sortOrder: 3 },
        // 예약 정보
        { category: "예약 정보", label: "예약번호", variableKey: "{{예약번호}}", description: "예약 고유 번호", sortOrder: 1 },
        { category: "예약 정보", label: "출발일", variableKey: "{{출발일}}", description: "출발 날짜", sortOrder: 2 },
        { category: "예약 정보", label: "귀국일", variableKey: "{{귀국일}}", description: "귀국 날짜", sortOrder: 3 },
        { category: "예약 정보", label: "인원", variableKey: "{{인원}}", description: "예약 인원 수", sortOrder: 4 },
        { category: "예약 정보", label: "팀수", variableKey: "{{팀수}}", description: "예약 팀 수", sortOrder: 5 },
        { category: "예약 정보", label: "국가", variableKey: "{{국가}}", description: "여행 국가", sortOrder: 6 },
        { category: "예약 정보", label: "상품군", variableKey: "{{상품군}}", description: "상품 박수 구분 (예: 3박5일)", sortOrder: 7 },
        // 골프 정보
        { category: "골프 정보", label: "골프장", variableKey: "{{골프장}}", description: "골프장 이름", sortOrder: 1 },
        { category: "골프 정보", label: "견적시간", variableKey: "{{견적시간}}", description: "견적 단계 티오프 시간", sortOrder: 2 },
        { category: "골프 정보", label: "확정시간", variableKey: "{{확정시간}}", description: "확정 티오프 시간 (미입력 시 견적시간 사용)", sortOrder: 3 },
        { category: "골프 정보", label: "티타임", variableKey: "{{티타임}}", description: "확정시간 우선, 없으면 견적시간 사용", sortOrder: 4 },
        // 숙박 정보
        { category: "숙박 정보", label: "숙소", variableKey: "{{숙소}}", description: "숙박 시설 이름", sortOrder: 1 },
        // 금액 정보
        { category: "금액 정보", label: "판매가", variableKey: "{{판매가}}", description: "총 판매 금액", sortOrder: 1 },
        { category: "금액 정보", label: "입금가", variableKey: "{{입금가}}", description: "고객 입금 금액", sortOrder: 2 },
        { category: "금액 정보", label: "제휴가", variableKey: "{{제휴가}}", description: "제휴사 지급 금액", sortOrder: 3 },
        { category: "금액 정보", label: "결제상태", variableKey: "{{결제상태}}", description: "결제 진행 상태", sortOrder: 4 },
        { category: "금액 정보", label: "1인가격", variableKey: "{{1인가격}}", description: "1인당 금액 (판매가/인원)", sortOrder: 5 },
        // 담당자 정보
        { category: "담당자 정보", label: "담당자", variableKey: "{{담당자}}", description: "담당 직원 이름", sortOrder: 1 },
        // 일정 정보
        { category: "일정 정보", label: "일정표", variableKey: "{{일정표}}", description: "전체 여행 일정 자동 생성 블록", sortOrder: 1 },
        { category: "일정 정보", label: "발송일", variableKey: "{{발송일}}", description: "견적서 발송 날짜", sortOrder: 2 },
      ];
      let inserted = 0;
      for (const v of DEFAULT_VARIABLES) {
        const existing = await db.select().from(customVariables).where(eq(customVariables.variableKey, v.variableKey));
        if (existing.length === 0) {
          await db.insert(customVariables).values({ ...v, isSystem: true, isActive: true });
          inserted++;
        }
      }
      return { inserted, total: DEFAULT_VARIABLES.length };
    }),
  // 활성화/비활성화 토글
  toggleActive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select().from(customVariables).where(eq(customVariables.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await db.update(customVariables).set({ isActive: !row.isActive }).where(eq(customVariables.id, input.id));
      return { success: true, isActive: !row.isActive };
    }),
});
