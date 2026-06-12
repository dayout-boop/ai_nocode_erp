import { z } from "zod";
import { router, protectedProcedure, partnerProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { affiliates } from "../../drizzle/schema";
import { eq, like, desc, and, or, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const affiliateTypeEnum = z.enum(["golf_domestic", "golf_overseas", "hotel", "attraction", "transport", "other"]);
const affiliateStatusEnum = z.enum(["active", "inactive", "pending"]);

export const affiliatesRouter = router({
  // ─── 제휴사 목록 (페이지네이션 + 검색 + 타입 필터) ──────────────
  // 제휴사 통합코드는 공용 검색 자원(테넌트 격리 없음) → 파트너 읽기 허용
  list: partnerProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      search: z.string().optional(),
      type: z.union([affiliateTypeEnum, z.literal("all")]).default("all"),
      status: z.union([affiliateStatusEnum, z.literal("all")]).default("all"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [];
      if (input.type !== "all") {
        conditions.push(eq(affiliates.type, input.type));
      }
      if (input.status !== "all") {
        conditions.push(eq(affiliates.status, input.status));
      }
      if (input.search) {
        conditions.push(
          or(
            like(affiliates.name, `%${input.search}%`),
            like(affiliates.region, `%${input.search}%`),
            like(affiliates.country, `%${input.search}%`),
            like(affiliates.contactName, `%${input.search}%`),
            like(affiliates.contactPerson, `%${input.search}%`)
          )
        );
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (input.page - 1) * input.pageSize;
      const [items, [{ total }]] = await Promise.all([
        db.select().from(affiliates).where(whereClause).orderBy(desc(affiliates.createdAt)).limit(input.pageSize).offset(offset),
        db.select({ total: count() }).from(affiliates).where(whereClause),
      ]);
      return { items, total };
    }),

  // ─── 제휴사 단건 조회 ─────────────────────────────────────────
  getById: partnerProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.id, input.id));
      if (!affiliate) throw new TRPCError({ code: "NOT_FOUND", message: "제휴사를 찾을 수 없습니다." });
      return affiliate;
    }),

  // ─── 제휴사 등록 ──────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      type: affiliateTypeEnum.default("golf_domestic"),
      country: z.string().optional(),
      region: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      website: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      holeCount: z.number().optional(),
      courseCount: z.number().optional(),
      greenFeeMin: z.number().optional(),
      greenFeeMax: z.number().optional(),
      prepaidBalance: z.number().optional(),
      depositBalance: z.number().optional(),
      notes: z.string().optional(),
      status: affiliateStatusEnum.default("active"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(affiliates).values({ ...input, isActive: true } as any);
      return { id: (result as any).insertId };
    }),

  // ─── 제휴사 수정 ──────────────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      type: affiliateTypeEnum.optional(),
      country: z.string().optional(),
      region: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      website: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      holeCount: z.number().optional(),
      courseCount: z.number().optional(),
      greenFeeMin: z.number().optional(),
      greenFeeMax: z.number().optional(),
      prepaidBalance: z.number().optional(),
      depositBalance: z.number().optional(),
      notes: z.string().optional(),
      status: affiliateStatusEnum.optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db.update(affiliates).set(rest).where(eq(affiliates.id, id));
      return { success: true };
    }),

  // ─── 제휴사 삭제 ──────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(affiliates).where(eq(affiliates.id, input.id));
      return { success: true };
    }),

  // ─── 일괄 등록 (oyeo 데이터 등) ──────────────────────────────
  bulkCreate: protectedProcedure
    .input(z.array(z.object({
      name: z.string().min(1),
      type: affiliateTypeEnum.default("golf_domestic"),
      country: z.string().optional(),
      region: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      contactName: z.string().optional(),
      notes: z.string().optional(),
      oyeoId: z.string().optional(),
      oyeoCode: z.string().optional(),
      nameEn: z.string().optional(),
      continent: z.string().optional(),
      lat: z.string().nullable().optional(),
      lng: z.string().nullable().optional(),
    })))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.length === 0) return { count: 0 };
      // 100개씩 배치 삽입
      const batchSize = 100;
      let totalInserted = 0;
      for (let i = 0; i < input.length; i += batchSize) {
        const batch = input.slice(i, i + batchSize);
        await db.insert(affiliates).values(batch.map(item => ({
          ...item,
          category: (item.type === 'golf_domestic' ? 'golf_domestic' : item.type === 'golf_overseas' ? 'golf_overseas' : 'other') as any,
          isActive: true,
        })) as any[]);
        totalInserted += batch.length;
      }
      return { count: totalInserted };
    }),

  // ─── 타입별 통계 ─────────────────────────────────────────────
  typeCounts: partnerProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select({ type: affiliates.type, cnt: count() }).from(affiliates).groupBy(affiliates.type);
      const result: Record<string, number> = {};
      for (const row of rows) {
        result[row.type ?? 'other'] = row.cnt;
      }
      return result;
    }),
});
