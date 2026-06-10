/**
 * 업체별 거래처(파트너) 라우터
 *
 * - 각 업체(테넌트)가 예약/송금/정산을 진행하는 거래처(제휴여행사/숙소/대리점) 원장
 * - tenant_partners 테이블 기반, partnerProcedure로 ctx.tenantId 격리
 */
import { z } from "zod";
import { router, partnerProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { tenantPartners } from "../../drizzle/schema";
import { eq, like, desc, and, or, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const partnerTypeEnum = z.enum(["travel_agency", "accommodation", "agency", "other"]);
const statusEnum = z.enum(["active", "inactive", "pending"]);

function requireTenant(tenantId: number | null | undefined): number {
  if (tenantId == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "업체(테넌트)를 먼저 선택해야 합니다. 마스터 전체보기 상태에서는 거래처를 등록할 수 없습니다.",
    });
  }
  return tenantId;
}

export const tenantPartnersRouter = router({
  list: partnerProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      search: z.string().optional(),
      partnerType: z.union([partnerTypeEnum, z.literal("all")]).default("all"),
      status: z.union([statusEnum, z.literal("all")]).default("all"),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [];
      if (ctx.tenantId != null) {
        conditions.push(eq(tenantPartners.tenantId, ctx.tenantId));
      }
      if (input.partnerType !== "all") {
        conditions.push(eq(tenantPartners.partnerType, input.partnerType));
      }
      if (input.status !== "all") {
        conditions.push(eq(tenantPartners.status, input.status));
      }
      if (input.search) {
        conditions.push(
          or(
            like(tenantPartners.companyName, `%${input.search}%`),
            like(tenantPartners.contactName, `%${input.search}%`)
          )
        );
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (input.page - 1) * input.pageSize;
      const [items, [{ total }]] = await Promise.all([
        db.select().from(tenantPartners).where(where).orderBy(desc(tenantPartners.createdAt)).limit(input.pageSize).offset(offset),
        db.select({ total: count() }).from(tenantPartners).where(where),
      ]);
      return { items, total };
    }),

  create: partnerProcedure
    .input(z.object({
      companyName: z.string().min(1),
      partnerType: partnerTypeEnum.default("travel_agency"),
      businessNumber: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      bankName: z.string().optional(),
      accountNumber: z.string().optional(),
      accountHolder: z.string().optional(),
      notes: z.string().optional(),
      status: statusEnum.default("active"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const tenantId = requireTenant(ctx.tenantId);
      const [result] = await db.insert(tenantPartners).values({
        tenantId,
        ...input,
        isActive: true,
      } as any);
      return { id: (result as any).insertId };
    }),

  update: partnerProcedure
    .input(z.object({
      id: z.number(),
      companyName: z.string().optional(),
      partnerType: partnerTypeEnum.optional(),
      businessNumber: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      bankName: z.string().optional(),
      accountNumber: z.string().optional(),
      accountHolder: z.string().optional(),
      notes: z.string().optional(),
      status: statusEnum.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      const [row] = await db.select({ tenantId: tenantPartners.tenantId }).from(tenantPartners).where(eq(tenantPartners.id, id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.tenantId != null && row.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 거래처는 수정할 수 없습니다." });
      }
      await db.update(tenantPartners).set(rest).where(eq(tenantPartners.id, id));
      return { success: true };
    }),

  delete: partnerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select({ tenantId: tenantPartners.tenantId }).from(tenantPartners).where(eq(tenantPartners.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.tenantId != null && row.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 거래처는 삭제할 수 없습니다." });
      }
      await db.delete(tenantPartners).where(eq(tenantPartners.id, input.id));
      return { success: true };
    }),
});
