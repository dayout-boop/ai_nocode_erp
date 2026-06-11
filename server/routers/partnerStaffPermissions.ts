/**
 * 파트너 담당자 기능 권한 관리 tRPC 라우터
 * - listFeatures: 담당자별 기능 권한 목록 조회
 * - setPermission: 특정 담당자의 기능 권한 설정 (파트너 대표만)
 * - bulkSet: 담당자의 전체 권한 일괄 설정 (파트너 대표만)
 * - getMyPermissions: 내 권한 목록 조회 (담당자 본인)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray } from "drizzle-orm";
import { partnerProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { partnerStaffPermissions, partnerStaff } from "../../drizzle/schema";

// 파트너 대표만 허용
const partnerOwnerOnlyProcedure = partnerProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role === "admin") return next({ ctx });
  if (ctx.partnerOwner) return next({ ctx });
  throw new TRPCError({ code: "FORBIDDEN", message: "파트너 대표만 권한을 관리할 수 있습니다." });
});

// 기능 식별자 목록 (확장 가능)
export const FEATURE_LIST = [
  { key: "ai_package_pipeline", label: "AI 상품 자동생성 파이프라인", category: "AI 자동화" },
  { key: "ai_package_desc", label: "AI 상품 설명 초안 생성", category: "AI 자동화" },
  { key: "ai_marketing_copy", label: "AI 마케팅 문구 생성", category: "AI 자동화" },
  { key: "ai_inquiry_reply", label: "AI 문의 답변 초안 생성", category: "AI 자동화" },
  { key: "ai_erp_analysis", label: "AI ERP 데이터 분석", category: "AI 자동화" },
  { key: "file_analysis", label: "파일 분석 업로드", category: "파일 관리" },
  { key: "package_manage", label: "상품 관리 (등록/수정)", category: "상품 관리" },
  { key: "booking_manage", label: "예약 관리", category: "예약 관리" },
  { key: "inquiry_manage", label: "문의 관리 및 답변", category: "고객 관리" },
] as const;

export type FeatureKey = (typeof FEATURE_LIST)[number]["key"];

export const partnerStaffPermissionsRouter = router({
  /**
   * 기능 목록 조회 (UI 렌더링용)
   */
  listFeatureKeys: partnerProcedure
    .query(() => {
      return { features: FEATURE_LIST };
    }),

  /**
   * 특정 담당자의 권한 목록 조회
   * [partnerOwnerOnlyProcedure] 파트너 대표만 가능
   */
  listForStaff: partnerOwnerOnlyProcedure
    .input(z.object({ staffId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { permissions: [] };
      const tenantId: number | null = ctx.tenantId ?? null;

      // 담당자가 본인 테넌트 소속인지 확인
      if (tenantId !== null) {
        const [staff] = await db
          .select({ id: partnerStaff.id })
          .from(partnerStaff)
          .where(and(eq(partnerStaff.id, input.staffId), eq(partnerStaff.partnerId, tenantId)))
          .limit(1);
        if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "담당자를 찾을 수 없습니다." });
      }

      const perms = await db
        .select()
        .from(partnerStaffPermissions)
        .where(eq(partnerStaffPermissions.staffId, input.staffId));

      // 기능 목록과 병합 (설정 없으면 기본값 true)
      const permMap = new Map(perms.map(p => [p.feature, p.enabled]));
      const merged = FEATURE_LIST.map(f => ({
        feature: f.key,
        label: f.label,
        category: f.category,
        enabled: permMap.has(f.key) ? permMap.get(f.key)! : true,
      }));

      return { permissions: merged };
    }),

  /**
   * 특정 담당자의 기능 권한 단건 설정
   * [partnerOwnerOnlyProcedure] 파트너 대표만 가능
   */
  setPermission: partnerOwnerOnlyProcedure
    .input(
      z.object({
        staffId: z.number().int().positive(),
        feature: z.string().min(1).max(100),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const tenantId: number | null = ctx.tenantId ?? null;
      const updatedBy: number =
        ctx.user?.id ?? ctx.partnerOwner?.partnerId ?? 0;

      // 기존 레코드 확인
      const [existing] = await db
        .select({ id: partnerStaffPermissions.id })
        .from(partnerStaffPermissions)
        .where(
          and(
            eq(partnerStaffPermissions.staffId, input.staffId),
            eq(partnerStaffPermissions.feature, input.feature)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(partnerStaffPermissions)
          .set({ enabled: input.enabled, updatedBy })
          .where(eq(partnerStaffPermissions.id, existing.id));
      } else {
        await db.insert(partnerStaffPermissions).values({
          tenantId: tenantId ?? 0,
          staffId: input.staffId,
          feature: input.feature,
          enabled: input.enabled,
          updatedBy,
        });
      }

      return { success: true };
    }),

  /**
   * 담당자 전체 권한 일괄 설정
   * [partnerOwnerOnlyProcedure] 파트너 대표만 가능
   */
  bulkSet: partnerOwnerOnlyProcedure
    .input(
      z.object({
        staffId: z.number().int().positive(),
        permissions: z.array(
          z.object({
            feature: z.string().min(1).max(100),
            enabled: z.boolean(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const tenantId: number | null = ctx.tenantId ?? null;
      const updatedBy: number =
        ctx.user?.id ?? ctx.partnerOwner?.partnerId ?? 0;

      // 기존 권한 모두 삭제 후 재삽입
      await db
        .delete(partnerStaffPermissions)
        .where(eq(partnerStaffPermissions.staffId, input.staffId));

      if (input.permissions.length > 0) {
        await db.insert(partnerStaffPermissions).values(
          input.permissions.map(p => ({
            tenantId: tenantId ?? 0,
            staffId: input.staffId,
            feature: p.feature,
            enabled: p.enabled,
            updatedBy,
          }))
        );
      }

      return { success: true, count: input.permissions.length };
    }),

  /**
   * 내 권한 목록 조회 (담당자 본인)
   * [partnerProcedure] 담당자도 본인 권한 확인 가능
   */
  getMyPermissions: partnerProcedure
    .query(async ({ ctx }) => {
      // 마스터 또는 파트너 대표는 모든 기능 허용
      if (ctx.user?.role === "admin" || ctx.partnerOwner) {
        return {
          permissions: FEATURE_LIST.map(f => ({ feature: f.key, enabled: true })),
        };
      }
      // 파트너 스태프
      const staffId = ctx.partnerStaff?.staffId;
      if (!staffId) return { permissions: [] };

      const db = await getDb();
      if (!db) return { permissions: [] };

      const perms = await db
        .select({ feature: partnerStaffPermissions.feature, enabled: partnerStaffPermissions.enabled })
        .from(partnerStaffPermissions)
        .where(eq(partnerStaffPermissions.staffId, staffId));

      const permMap = new Map(perms.map(p => [p.feature, p.enabled]));
      return {
        permissions: FEATURE_LIST.map(f => ({
          feature: f.key,
          enabled: permMap.has(f.key) ? permMap.get(f.key)! : true,
        })),
      };
    }),
});
