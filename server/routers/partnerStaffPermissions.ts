/**
 * 파트너 담당자 기능 권한 관리 tRPC 라우터
 * - listFeatureKeys: 기능 카탈로그(목록) 조회 (UI 렌더링용)
 * - listForStaff: 담당자별 기능 권한 목록 조회 (파트너 대표만)
 * - setPermission: 특정 담당자의 기능 권한 단건 설정 (파트너 대표만)
 * - bulkSet: 담당자의 전체 권한 일괄 설정 (파트너 대표만)
 * - getMyPermissions: 내 권한 목록 조회 (담당자 본인)
 *
 * [단일 소스] 기능 목록/기본값/NEW 판정은 모두 shared/featureCatalog.ts 를 참조한다.
 *   신규 기능은 그 파일에 한 줄만 추가하면 이 라우터·UI에 자동 반영된다.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { partnerProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { partnerStaffPermissions, partnerStaff } from "../../drizzle/schema";
import {
  FEATURE_CATALOG,
  getDefaultEnabled,
  isValidFeatureKey,
  isNewFeature,
  mergePermissions,
} from "../../shared/featureCatalog";

// 파트너 대표만 허용 (마스터 admin 도 허용)
const partnerOwnerOnlyProcedure = partnerProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role === "admin") return next({ ctx });
  if (ctx.partnerOwner) return next({ ctx });
  throw new TRPCError({ code: "FORBIDDEN", message: "파트너 대표만 권한을 관리할 수 있습니다." });
});

/**
 * 현재 세션의 partnerId 추출 헬퍼.
 * - partnerStaff.partnerId 는 partners 테이블의 파트너 ID 이므로,
 *   담당자 소속 검증(테넌트 가드)은 tenantId 가 아니라 이 partnerId 로 비교해야 한다.
 * - 마스터(admin) 세션은 partnerId 가 없으므로 null → 가드 생략(전체 접근).
 */
function getSessionPartnerId(ctx: {
  partnerOwner?: { partnerId: number } | null;
  partnerStaff?: { partnerId: number } | null;
}): number | null {
  return ctx.partnerOwner?.partnerId ?? ctx.partnerStaff?.partnerId ?? null;
}

/**
 * 하위 호환용 별칭. 기존 코드가 FEATURE_LIST 를 import 하던 것을 카탈로그로 연결.
 * 신규 코드는 shared/featureCatalog 의 FEATURE_CATALOG 를 직접 사용할 것.
 */
export const FEATURE_LIST = FEATURE_CATALOG;
export type { FeatureKey } from "../../shared/featureCatalog";

export const partnerStaffPermissionsRouter = router({
  /**
   * 기능 카탈로그 조회 (UI 렌더링용) — NEW 배지 판정 포함
   */
  listFeatureKeys: partnerProcedure.query(() => {
    const now = new Date();
    return {
      features: FEATURE_CATALOG.map((f) => ({
        key: f.key,
        label: f.label,
        category: f.category,
        isNew: isNewFeature(f.key, now),
      })),
    };
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
      const sessionPartnerId = getSessionPartnerId(ctx);

      // 담당자가 본인 파트너 소속인지 확인 (소속 가드: partnerId 기준)
      if (sessionPartnerId !== null) {
        const [staff] = await db
          .select({ id: partnerStaff.id })
          .from(partnerStaff)
          .where(and(eq(partnerStaff.id, input.staffId), eq(partnerStaff.partnerId, sessionPartnerId)))
          .limit(1);
        if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "담당자를 찾을 수 없습니다." });
      }

      const perms = await db
        .select()
        .from(partnerStaffPermissions)
        .where(eq(partnerStaffPermissions.staffId, input.staffId));

      // 카탈로그와 병합 (행이 없으면 카탈로그 기본값) — NEW 배지 포함
      const merged = mergePermissions(
        perms.map((p) => ({ feature: p.feature, enabled: !!p.enabled })),
      );

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
      if (!isValidFeatureKey(input.feature)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "알 수 없는 기능 권한입니다." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const tenantId: number | null = ctx.tenantId ?? null;
      const sessionPartnerId = getSessionPartnerId(ctx);
      const updatedBy: number = ctx.user?.id ?? ctx.partnerOwner?.partnerId ?? 0;

      // 소속 가드: 담당자가 본인 파트너 소속인지 확인 (partnerId 기준)
      if (sessionPartnerId !== null) {
        const [staff] = await db
          .select({ id: partnerStaff.id })
          .from(partnerStaff)
          .where(and(eq(partnerStaff.id, input.staffId), eq(partnerStaff.partnerId, sessionPartnerId)))
          .limit(1);
        if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "담당자를 찾을 수 없습니다." });
      }

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
   * - 카탈로그에 없는 feature 는 무시 (방어)
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
      const sessionPartnerId = getSessionPartnerId(ctx);
      const updatedBy: number = ctx.user?.id ?? ctx.partnerOwner?.partnerId ?? 0;

      // 소속 가드 (partnerId 기준)
      if (sessionPartnerId !== null) {
        const [staff] = await db
          .select({ id: partnerStaff.id })
          .from(partnerStaff)
          .where(and(eq(partnerStaff.id, input.staffId), eq(partnerStaff.partnerId, sessionPartnerId)))
          .limit(1);
        if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "담당자를 찾을 수 없습니다." });
      }

      // 카탈로그에 존재하는 feature 만 저장
      const valid = input.permissions.filter((p) => isValidFeatureKey(p.feature));

      // 기존 권한 모두 삭제 후 재삽입
      await db
        .delete(partnerStaffPermissions)
        .where(eq(partnerStaffPermissions.staffId, input.staffId));

      if (valid.length > 0) {
        await db.insert(partnerStaffPermissions).values(
          valid.map((p) => ({
            tenantId: tenantId ?? 0,
            staffId: input.staffId,
            feature: p.feature,
            enabled: p.enabled,
            updatedBy,
          }))
        );
      }

      return { success: true, count: valid.length };
    }),

  /**
   * 내 권한 목록 조회 (담당자 본인)
   * [partnerProcedure] 담당자도 본인 권한 확인 가능
   * - 신규 기능은 행이 없으면 카탈로그 기본값(기본 허용)으로 자동 편입
   */
  getMyPermissions: partnerProcedure.query(async ({ ctx }) => {
    // 마스터 또는 파트너 대표는 모든 기능 허용
    if (ctx.user?.role === "admin" || ctx.partnerOwner) {
      return {
        permissions: FEATURE_CATALOG.map((f) => ({ feature: f.key, enabled: true })),
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

    const permMap = new Map(perms.map((p) => [p.feature, !!p.enabled]));
    return {
      permissions: FEATURE_CATALOG.map((f) => ({
        feature: f.key,
        enabled: permMap.has(f.key) ? permMap.get(f.key)! : getDefaultEnabled(f.key),
      })),
    };
  }),
});
