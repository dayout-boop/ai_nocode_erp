/**
 * 업체·직원 관리 tRPC 라우터
 * - 업체 정보 조회/수정 (수정권한자 또는 오너만)
 * - 직원 목록 조회 (뷰어: 모든 파트너 세션)
 * - 직원 등록/수정/삭제 (수정권한자 또는 오너만)
 * - 수정권한 지정/해제 (오너 또는 현재 수정권한자만)
 * - 중복 수정권한자 허용
 * - 오너 비밀번호 변경
 * - 담당자 삭제 시 대표아이디 자동 귀속
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { router, partnerProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  partners,
  partnerStaff,
  companyManagePermissions,
  packages,
  bookings,
} from "../../drizzle/schema";

/** 현재 세션의 partnerId 추출 헬퍼 */
function getPartnerId(ctx: { partnerOwner?: { partnerId: number } | null; partnerStaff?: { partnerId: number } | null }) {
  return ctx.partnerOwner?.partnerId ?? ctx.partnerStaff?.partnerId ?? null;
}

/** 현재 세션의 staffId 추출 헬퍼 (오너이면 null) */
function getStaffId(ctx: { partnerOwner?: unknown | null; partnerStaff?: { staffId: number } | null }) {
  return ctx.partnerStaff?.staffId ?? null;
}

/** 수정권한 확인: 오너이거나 companyManagePermissions에 canEdit=true인 직원 */
async function checkEditPermission(
  ctx: { partnerOwner?: { partnerId: number } | null; partnerStaff?: { staffId: number; partnerId: number } | null },
  tenantId: number | null
): Promise<boolean> {
  // 오너는 항상 수정 가능
  if (ctx.partnerOwner) return true;
  if (!ctx.partnerStaff) return false;

  const db = await getDb();
  if (!db) return false;

  const [perm] = await db
    .select({ canEdit: companyManagePermissions.canEdit })
    .from(companyManagePermissions)
    .where(
      and(
        eq(companyManagePermissions.staffId, ctx.partnerStaff.staffId),
        eq(companyManagePermissions.tenantId, tenantId ?? 0),
        eq(companyManagePermissions.canEdit, true)
      )
    )
    .limit(1);

  return perm?.canEdit === true;
}

export const companyManageRouter = router({
  /**
   * 업체 정보 조회 (뷰어: 모든 파트너 세션)
   */
  getCompanyInfo: partnerProcedure.query(async ({ ctx }) => {
    const partnerId = getPartnerId(ctx);
    if (!partnerId) throw new TRPCError({ code: "UNAUTHORIZED", message: "파트너 세션이 필요합니다." });

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1);

    if (!partner) throw new TRPCError({ code: "NOT_FOUND", message: "업체 정보를 찾을 수 없습니다." });

    return partner;
  }),

  /**
   * 업체 정보 수정 (수정권한자 또는 오너만)
   */
  updateCompanyInfo: partnerProcedure
    .input(z.object({
      companyName: z.string().min(1).optional(),
      businessNumber: z.string().optional(),
      tourismLicenseNo: z.string().optional(),
      onlineSalesNo: z.string().optional(),
      bankName: z.string().optional(),
      accountNumber: z.string().optional(),
      accountHolder: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().email().optional(),
      memo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const partnerId = getPartnerId(ctx);
      if (!partnerId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const canEdit = await checkEditPermission(ctx, ctx.tenantId ?? null);
      if (!canEdit) throw new TRPCError({ code: "FORBIDDEN", message: "수정 권한이 없습니다. 오너 또는 지정된 담당자만 수정할 수 있습니다." });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(partners).set(input).where(eq(partners.id, partnerId));
      return { success: true };
    }),

  /**
   * 오너 비밀번호 변경 (오너만 가능)
   */
  changeOwnerPassword: partnerProcedure
    .input(z.object({
      currentPw: z.string().min(1, "현재 비밀번호를 입력해주세요."),
      newPw: z.string().min(8, "새 비밀번호는 8자 이상이어야 합니다."),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.partnerOwner) {
        throw new TRPCError({ code: "FORBIDDEN", message: "오너만 비밀번호를 변경할 수 있습니다." });
      }
      const partnerId = ctx.partnerOwner.partnerId;

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [partner] = await db
        .select({ loginPwHash: partners.loginPwHash })
        .from(partners)
        .where(eq(partners.id, partnerId))
        .limit(1);

      if (!partner?.loginPwHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "비밀번호가 설정되지 않은 계정입니다." });
      }

      const isValid = await bcrypt.compare(input.currentPw, partner.loginPwHash);
      if (!isValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "현재 비밀번호가 올바르지 않습니다." });
      }

      const newHash = await bcrypt.hash(input.newPw, 12);
      await db.update(partners).set({ loginPwHash: newHash }).where(eq(partners.id, partnerId));

      return { success: true };
    }),

  /**
   * 직원 목록 조회 (뷰어: 모든 파트너 세션)
   */
  listStaff: partnerProcedure.query(async ({ ctx }) => {
    const partnerId = getPartnerId(ctx);
    if (!partnerId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const staffList = await db
      .select({
        id: partnerStaff.id,
        name: partnerStaff.name,
        loginId: partnerStaff.loginId,
        email: partnerStaff.email,
        phone: partnerStaff.phone,
        position: partnerStaff.position,
        role: partnerStaff.role,
        isActive: partnerStaff.isActive,
        memo: partnerStaff.memo,
        lastLoginAt: partnerStaff.lastLoginAt,
        createdAt: partnerStaff.createdAt,
      })
      .from(partnerStaff)
      .where(eq(partnerStaff.partnerId, partnerId));

    // 수정권한 목록 조회
    const staffIds = staffList.map(s => s.id);
    let editPermMap: Record<number, boolean> = {};
    if (staffIds.length > 0 && ctx.tenantId) {
      const perms = await db
        .select({ staffId: companyManagePermissions.staffId, canEdit: companyManagePermissions.canEdit })
        .from(companyManagePermissions)
        .where(
          and(
            inArray(companyManagePermissions.staffId, staffIds),
            eq(companyManagePermissions.tenantId, ctx.tenantId),
          )
        );
      editPermMap = Object.fromEntries(perms.map(p => [p.staffId, p.canEdit]));
    }

    return staffList.map(s => ({
      ...s,
      canEdit: editPermMap[s.id] ?? false,
    }));
  }),

  /**
   * 직원 등록 (수정권한자 또는 오너만)
   * - 전체 테넌트에 걸쳐 로그인 ID 중복 방지
   */
  addStaff: partnerProcedure
    .input(z.object({
      name: z.string().min(1, "이름을 입력해주세요."),
      loginId: z.string().min(4, "로그인 ID는 4자 이상이어야 합니다.").max(50),
      loginPw: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      position: z.string().max(50).optional(),
      role: z.enum(["manager", "staff"]).default("staff"),
      memo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const partnerId = getPartnerId(ctx);
      if (!partnerId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const canEdit = await checkEditPermission(ctx, ctx.tenantId ?? null);
      if (!canEdit) throw new TRPCError({ code: "FORBIDDEN", message: "직원 등록 권한이 없습니다." });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 전체 테이블 로그인 ID 중복 체크 (파트너 전체)
      const [existing] = await db
        .select({ id: partnerStaff.id })
        .from(partnerStaff)
        .where(eq(partnerStaff.loginId, input.loginId))
        .limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 로그인 ID입니다. 다른 아이디를 사용해주세요." });

      const loginPwHash = await bcrypt.hash(input.loginPw, 12);
      const [result] = await db.insert(partnerStaff).values({
        partnerId,
        onboardingId: partnerId,
        name: input.name,
        loginId: input.loginId,
        loginPwHash,
        email: input.email,
        phone: input.phone,
        position: input.position,
        role: input.role,
        memo: input.memo,
        isActive: true,
      });
      return { success: true, staffId: (result as { insertId: number }).insertId };
    }),

  /**
   * 직원 정보 수정 (수정권한자 또는 오너만)
   * - 비밀번호 변경 포함, position 필드 포함
   */
  updateStaff: partnerProcedure
    .input(z.object({
      staffId: z.number(),
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      position: z.string().max(50).optional(),
      role: z.enum(["manager", "staff"]).optional(),
      memo: z.string().optional(),
      isActive: z.boolean().optional(),
      newLoginPw: z.string().min(8).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const partnerId = getPartnerId(ctx);
      if (!partnerId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const canEdit = await checkEditPermission(ctx, ctx.tenantId ?? null);
      if (!canEdit) throw new TRPCError({ code: "FORBIDDEN", message: "직원 수정 권한이 없습니다." });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 해당 직원이 이 파트너 소속인지 확인
      const [staff] = await db
        .select({ id: partnerStaff.id })
        .from(partnerStaff)
        .where(and(eq(partnerStaff.id, input.staffId), eq(partnerStaff.partnerId, partnerId)))
        .limit(1);
      if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "직원을 찾을 수 없습니다." });

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.position !== undefined) updateData.position = input.position;
      if (input.role !== undefined) updateData.role = input.role;
      if (input.memo !== undefined) updateData.memo = input.memo;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.newLoginPw) {
        updateData.loginPwHash = await bcrypt.hash(input.newLoginPw, 12);
      }

      await db.update(partnerStaff).set(updateData).where(eq(partnerStaff.id, input.staffId));
      return { success: true };
    }),

  /**
   * 직원 삭제 (오너만)
   * - 삭제 직원이 만든 상품/예약의 staffId를 오너 partnerId로 귀속
   * - 수정권한도 함께 삭제
   */
  deleteStaff: partnerProcedure
    .input(z.object({ staffId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // 오너만 삭제 가능
      if (!ctx.partnerOwner) {
        throw new TRPCError({ code: "FORBIDDEN", message: "직원 삭제는 오너만 가능합니다." });
      }
      const partnerId = ctx.partnerOwner.partnerId;

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [staff] = await db
        .select({ id: partnerStaff.id, partnerId: partnerStaff.partnerId })
        .from(partnerStaff)
        .where(and(eq(partnerStaff.id, input.staffId), eq(partnerStaff.partnerId, partnerId)))
        .limit(1);
      if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "직원을 찾을 수 없습니다." });

      // 수정권한도 함께 삭제
      await db.delete(companyManagePermissions).where(eq(companyManagePermissions.staffId, input.staffId));

      // 직원이 만든 상품의 tenantId는 이미 파트너 tenantId로 되어 있으므로 별도 처리 불필요
      // (staffId 컬럼이 packages/bookings에 없으므로 tenantId 기반으로 귀속됨)

      await db.delete(partnerStaff).where(eq(partnerStaff.id, input.staffId));
      return { success: true };
    }),

  /**
   * 수정권한 목록 조회
   */
  listEditPermissions: partnerProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "테넌트 정보가 없습니다." });

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const perms = await db
      .select({
        id: companyManagePermissions.id,
        staffId: companyManagePermissions.staffId,
        canEdit: companyManagePermissions.canEdit,
        grantedBy: companyManagePermissions.grantedBy,
        createdAt: companyManagePermissions.createdAt,
        staffName: partnerStaff.name,
        staffLoginId: partnerStaff.loginId,
        staffRole: partnerStaff.role,
      })
      .from(companyManagePermissions)
      .leftJoin(partnerStaff, eq(companyManagePermissions.staffId, partnerStaff.id))
      .where(eq(companyManagePermissions.tenantId, tenantId));

    return perms;
  }),

  /**
   * 수정권한 부여/수정 (오너 또는 현재 수정권한자만)
   * - 중복 수정권한자 허용 (여러 명 동시 지정 가능)
   */
  setEditPermission: partnerProcedure
    .input(z.object({
      staffId: z.number(),
      canEdit: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const canModify = await checkEditPermission(ctx, ctx.tenantId ?? null);
      if (!canModify) throw new TRPCError({ code: "FORBIDDEN", message: "권한 설정은 오너 또는 현재 수정권한자만 가능합니다." });

      const tenantId = ctx.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "테넌트 정보가 없습니다." });

      const grantedBy = getStaffId(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 이미 존재하는 권한 레코드 확인
      const [existing] = await db
        .select({ id: companyManagePermissions.id })
        .from(companyManagePermissions)
        .where(
          and(
            eq(companyManagePermissions.staffId, input.staffId),
            eq(companyManagePermissions.tenantId, tenantId)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(companyManagePermissions)
          .set({ canEdit: input.canEdit, grantedBy, updatedAt: new Date() })
          .where(eq(companyManagePermissions.id, existing.id));
      } else {
        await db.insert(companyManagePermissions).values({
          tenantId,
          staffId: input.staffId,
          canEdit: input.canEdit,
          grantedBy,
        });
      }

      return { success: true };
    }),

  /**
   * 수정권한 해제 (오너 또는 현재 수정권한자만)
   */
  revokeEditPermission: partnerProcedure
    .input(z.object({ staffId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const canModify = await checkEditPermission(ctx, ctx.tenantId ?? null);
      if (!canModify) throw new TRPCError({ code: "FORBIDDEN", message: "권한 해제는 오너 또는 현재 수정권한자만 가능합니다." });

      const tenantId = ctx.tenantId;
      if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .delete(companyManagePermissions)
        .where(
          and(
            eq(companyManagePermissions.staffId, input.staffId),
            eq(companyManagePermissions.tenantId, tenantId)
          )
        );

      return { success: true };
    }),

  /**
   * 현재 로그인한 사용자의 수정권한 여부 반환
   */
  checkCanEdit: partnerProcedure.query(async ({ ctx }) => {
    const canEdit = await checkEditPermission(ctx, ctx.tenantId ?? null);
    return { canEdit };
  }),
});
