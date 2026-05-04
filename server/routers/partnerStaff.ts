/**
 * 파트너 하위 담당자 tRPC 라우터
 *
 * - create: 하위 담당자 생성 (파트너 승인 후)
 * - list: 담당자 목록 조회 (파트너 본인)
 * - update: 담당자 정보 수정
 * - deactivate: 담당자 비활성화
 * - login: 하위 담당자 로그인 (JWT 발급)
 * - requestPasswordReset: 비밀번호 재설정 이메일 발송
 * - resetPassword: 토큰으로 비밀번호 변경
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { partnerStaff, partnerOnboarding, partnerStaffPasswordReset } from "../../drizzle/schema";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { SignJWT } from "jose";
import { ENV } from "../_core/env";

// JWT 시크릿
const getJwtSecret = () => new TextEncoder().encode(ENV.cookieSecret);

// 파트너 본인 확인 (승인된 파트너만)
async function getApprovedPartnerByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
  // users 테이블에서 이메일 조회
  const { users } = await import("../../drizzle/schema");
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.email) throw new TRPCError({ code: "UNAUTHORIZED", message: "사용자 정보를 찾을 수 없습니다." });

  const [partner] = await db
    .select({
      id: partnerOnboarding.id,
      companyName: partnerOnboarding.companyName,
      status: partnerOnboarding.status,
    })
    .from(partnerOnboarding)
    .where(eq(partnerOnboarding.contactEmail, user.email))
    .limit(1);

  if (!partner) throw new TRPCError({ code: "NOT_FOUND", message: "파트너 신청 내역을 찾을 수 없습니다." });
  if (partner.status !== "approved" && partner.status !== "active") {
    throw new TRPCError({ code: "FORBIDDEN", message: "승인된 파트너만 담당자를 관리할 수 있습니다." });
  }
  return { db, partner, email: user.email };
}

export const partnerStaffRouter = router({
  /** 하위 담당자 생성 */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "이름을 입력해주세요."),
        loginId: z.string().min(4, "로그인 ID는 4자 이상이어야 합니다.").max(50),
        loginPw: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.enum(["manager", "staff"]).default("staff"),
        memo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, partner } = await getApprovedPartnerByUser(ctx.user.id);

      // 로그인 ID 중복 체크
      const [existing] = await db
        .select({ id: partnerStaff.id })
        .from(partnerStaff)
        .where(eq(partnerStaff.loginId, input.loginId))
        .limit(1);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "이미 사용 중인 로그인 ID입니다." });
      }

      // 비밀번호 해싱
      const loginPwHash = await bcrypt.hash(input.loginPw, 12);

      const [result] = await db.insert(partnerStaff).values({
        partnerId: partner.id,
        onboardingId: partner.id,
        name: input.name,
        loginId: input.loginId,
        loginPwHash,
        email: input.email,
        phone: input.phone,
        role: input.role,
        memo: input.memo,
        isActive: true,
      });

      return { success: true, staffId: (result as { insertId: number }).insertId };
    }),

  /** 하위 담당자 목록 조회 */
  list: protectedProcedure.query(async ({ ctx }) => {
    const { db, partner } = await getApprovedPartnerByUser(ctx.user.id);

    const staffList = await db
      .select({
        id: partnerStaff.id,
        name: partnerStaff.name,
        loginId: partnerStaff.loginId,
        email: partnerStaff.email,
        phone: partnerStaff.phone,
        role: partnerStaff.role,
        isActive: partnerStaff.isActive,
        memo: partnerStaff.memo,
        lastLoginAt: partnerStaff.lastLoginAt,
        createdAt: partnerStaff.createdAt,
      })
      .from(partnerStaff)
      .where(eq(partnerStaff.onboardingId, partner.id))
      .orderBy(desc(partnerStaff.createdAt));

    return staffList;
  }),

  /** 하위 담당자 정보 수정 */
  update: protectedProcedure
    .input(
      z.object({
        staffId: z.number(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.enum(["manager", "staff"]).optional(),
        memo: z.string().optional(),
        newPassword: z.string().min(8).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, partner } = await getApprovedPartnerByUser(ctx.user.id);

      // 본인 파트너 소속 담당자인지 확인
      const [staff] = await db
        .select({ id: partnerStaff.id })
        .from(partnerStaff)
        .where(and(eq(partnerStaff.id, input.staffId), eq(partnerStaff.onboardingId, partner.id)))
        .limit(1);
      if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "담당자를 찾을 수 없습니다." });

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.role !== undefined) updateData.role = input.role;
      if (input.memo !== undefined) updateData.memo = input.memo;
      if (input.newPassword) {
        updateData.loginPwHash = await bcrypt.hash(input.newPassword, 12);
      }

      await db
        .update(partnerStaff)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set(updateData as any)
        .where(eq(partnerStaff.id, input.staffId));

      return { success: true };
    }),

  /** 하위 담당자 비활성화 */
  deactivate: protectedProcedure
    .input(z.object({ staffId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { db, partner } = await getApprovedPartnerByUser(ctx.user.id);

      const [staff] = await db
        .select({ id: partnerStaff.id })
        .from(partnerStaff)
        .where(and(eq(partnerStaff.id, input.staffId), eq(partnerStaff.onboardingId, partner.id)))
        .limit(1);
      if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "담당자를 찾을 수 없습니다." });

      await db
        .update(partnerStaff)
        .set({ isActive: false })
        .where(eq(partnerStaff.id, input.staffId));

      return { success: true };
    }),

  /** 하위 담당자 로그인 (JWT 발급) */
  login: publicProcedure
    .input(
      z.object({
        loginId: z.string().min(1, "로그인 ID를 입력해주세요."),
        loginPw: z.string().min(1, "비밀번호를 입력해주세요."),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      const [staff] = await db
        .select()
        .from(partnerStaff)
        .where(eq(partnerStaff.loginId, input.loginId))
        .limit(1);

      if (!staff) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인 ID 또는 비밀번호가 올바르지 않습니다." });
      }
      if (!staff.isActive) {
        throw new TRPCError({ code: "FORBIDDEN", message: "비활성화된 계정입니다. 관리자에게 문의하세요." });
      }

      const isValid = await bcrypt.compare(input.loginPw, staff.loginPwHash);
      if (!isValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인 ID 또는 비밀번호가 올바르지 않습니다." });
      }

      // 마지막 로그인 시각 업데이트
      await db
        .update(partnerStaff)
        .set({ lastLoginAt: new Date() })
        .where(eq(partnerStaff.id, staff.id));

      // JWT 발급 (24시간 유효)
      const token = await new SignJWT({
        sub: String(staff.id),
        staffId: staff.id,
        partnerId: staff.partnerId,
        onboardingId: staff.onboardingId,
        name: staff.name,
        role: staff.role,
        type: "partner_staff",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(await getJwtSecret());

      return {
        token,
        staff: {
          id: staff.id,
          name: staff.name,
          loginId: staff.loginId,
          role: staff.role,
          email: staff.email,
          phone: staff.phone,
        },
      };
    }),

  /** 비밀번호 재설정 요청 (이메일 발송) */
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        loginId: z.string().min(1, "로그인 ID를 입력해주세요."),
        email: z.string().email("올바른 이메일을 입력해주세요."),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      // 로그인 ID + 이메일 일치 확인
      const [staff] = await db
        .select({ id: partnerStaff.id, name: partnerStaff.name, email: partnerStaff.email, isActive: partnerStaff.isActive })
        .from(partnerStaff)
        .where(and(eq(partnerStaff.loginId, input.loginId), eq(partnerStaff.email, input.email)))
        .limit(1);

      // 보안상 항상 성공 응답 (계정 존재 여부 노출 방지)
      if (!staff || !staff.isActive) {
        return { success: true, message: "이메일이 등록되어 있다면 재설정 링크를 발송했습니다." };
      }

      // 기존 미사용 토큰 삭제
      await db
        .delete(partnerStaffPasswordReset)
        .where(and(eq(partnerStaffPasswordReset.staffId, staff.id)));

      // 새 토큰 생성 (30분 유효)
      const token = crypto.randomBytes(64).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await db.insert(partnerStaffPasswordReset).values({
        staffId: staff.id,
        token,
        expiresAt,
      });

      // Slack으로 재설정 링크 발송 (이메일 서비스 없으므로 Slack 알림으로 대체)
      const resetUrl = `https://dogolf-tour-dkz3fsmp.manus.space/partner/reset-password?token=${token}`;
      const slackWebhook = process.env.SLACK_WEBHOOK_URL;
      if (slackWebhook) {
        await fetch(slackWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🔑 [파트너 담당자 비밀번호 재설정]\n담당자: ${staff.name} (${staff.email})\n재설정 링크: ${resetUrl}\n유효시간: 30분`,
          }),
        }).catch(() => {});
      }

      return { success: true, message: "이메일이 등록되어 있다면 재설정 링크를 발송했습니다." };
    }),

  /** 비밀번호 재설정 (토큰 검증 후 변경) */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, "토큰이 필요합니다."),
        newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      const [resetRecord] = await db
        .select()
        .from(partnerStaffPasswordReset)
        .where(eq(partnerStaffPasswordReset.token, input.token))
        .limit(1);

      if (!resetRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "유효하지 않은 재설정 링크입니다." });
      }
      if (resetRecord.usedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "이미 사용된 재설정 링크입니다." });
      }
      if (new Date() > resetRecord.expiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "만료된 재설정 링크입니다. 다시 요청해주세요." });
      }

      // 새 비밀번호 해싱 및 저장
      const loginPwHash = await bcrypt.hash(input.newPassword, 12);
      await db
        .update(partnerStaff)
        .set({ loginPwHash })
        .where(eq(partnerStaff.id, resetRecord.staffId));

      // 토큰 사용 완료 처리
      await db
        .update(partnerStaffPasswordReset)
        .set({ usedAt: new Date() })
        .where(eq(partnerStaffPasswordReset.id, resetRecord.id));

      return { success: true, message: "비밀번호가 성공적으로 변경되었습니다." };
    }),

  /** 토큰 유효성 확인 (비밀번호 재설정 페이지 진입 시) */
  verifyResetToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      const [resetRecord] = await db
        .select({ id: partnerStaffPasswordReset.id, expiresAt: partnerStaffPasswordReset.expiresAt, usedAt: partnerStaffPasswordReset.usedAt, staffId: partnerStaffPasswordReset.staffId })
        .from(partnerStaffPasswordReset)
        .where(eq(partnerStaffPasswordReset.token, input.token))
        .limit(1);

      if (!resetRecord || resetRecord.usedAt || new Date() > resetRecord.expiresAt) {
        return { valid: false };
      }

      // 담당자 이름 조회
      const [staff] = await db
        .select({ name: partnerStaff.name, loginId: partnerStaff.loginId })
        .from(partnerStaff)
        .where(eq(partnerStaff.id, resetRecord.staffId))
        .limit(1);

      return { valid: true, staffName: staff?.name, loginId: staff?.loginId };
    }),
});
