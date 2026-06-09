/**
 * CRM 파트너 관리 tRPC 라우터
 * - 파트너(거래처) CRUD
 * - 파트너 일정 CRUD
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import {
  getPartners,
  getPartnerById,
  createPartner,
  updatePartner,
  deletePartner,
  getPartnerSchedules,
  createPartnerSchedule,
  updatePartnerSchedule,
  deletePartnerSchedule,
} from "../db";

// ── 입력 스키마 ──────────────────────────────────────────────

const partnerInput = z.object({
  companyName: z.string().min(1, "업체명은 필수입니다"),
  businessNumber: z.string().optional(),
  tourismLicenseNo: z.string().optional(),
  onlineSalesNo: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountHolder: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  loginId: z.string().optional(),
  loginPw: z.string().optional(), // 평문 PW (서버에서 해시 처리)
  memo: z.string().optional(),
  isActive: z.boolean().optional(),
});

const scheduleInput = z.object({
  partnerId: z.number().int().positive(),
  title: z.string().min(1, "제목은 필수입니다"),
  memo: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
  assignedTo: z.string().optional(),
  color: z.string().optional(),
});

// ── 라우터 ───────────────────────────────────────────────────

export const crmRouter = router({
  // 파트너 목록 조회
  getPartners: protectedProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return await getPartners(input?.search);
    }),

  // 파트너 단건 조회
  getPartnerById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const partner = await getPartnerById(input.id);
      if (!partner) throw new TRPCError({ code: "NOT_FOUND", message: "파트너를 찾을 수 없습니다" });
      // PW 해시는 응답에서 제외
      const { loginPwHash: _, ...safe } = partner;
      return safe;
    }),

  // 파트너 등록
  createPartner: protectedProcedure
    .input(partnerInput)
    .mutation(async ({ input }) => {
      const { loginPw, ...rest } = input;
      let loginPwHash: string | undefined;
      if (loginPw) {
        // 간단한 해시 처리 (bcrypt 없이 SHA-256 기반)
        const encoder = new TextEncoder();
        const data = encoder.encode(loginPw + "dogolf_salt_2024");
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        loginPwHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      }
      await createPartner({
        ...rest,
        loginPwHash,
        contactEmail: rest.contactEmail || undefined,
      });
      return { success: true };
    }),

  // 파트너 수정
  updatePartner: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), data: partnerInput.partial() }))
    .mutation(async ({ input }) => {
      const { loginPw, ...rest } = input.data;
      const updateData: Record<string, unknown> = { ...rest };
      if (loginPw) {
        const encoder = new TextEncoder();
        const data = encoder.encode(loginPw + "dogolf_salt_2024");
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        updateData.loginPwHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      }
      await updatePartner(input.id, updateData as any);
      return { success: true };
    }),

  // 파트너 삭제
  deletePartner: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deletePartner(input.id);
      return { success: true };
    }),

  // 파트너 정지
  suspendPartner: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      reason: z.string().min(1, "정지 사유를 입력해주세요"),
    }))
    .mutation(async ({ input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const { eq } = await import("drizzle-orm");
      const { partners } = await import("../../drizzle/schema");
      const [existing] = await db.select({ id: partners.id, companyName: partners.companyName })
        .from(partners).where(eq(partners.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "파트너를 찾을 수 없습니다" });
      await db.update(partners).set({
        isActive: false,
        suspendedAt: new Date(),
        suspendReason: input.reason,
      }).where(eq(partners.id, input.id));
      return { success: true };
    }),

  // 파트너 복구
  resumePartner: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const { eq } = await import("drizzle-orm");
      const { partners } = await import("../../drizzle/schema");
      const [existing] = await db.select({ id: partners.id })
        .from(partners).where(eq(partners.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "파트너를 찾을 수 없습니다" });
      await db.update(partners).set({
        isActive: true,
        suspendedAt: null,
        suspendReason: null,
      }).where(eq(partners.id, input.id));
      return { success: true };
    }),

  // 파트너 상세 (온보딩 URL/adminNote 포함)
  getPartnerDetail: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const { eq } = await import("drizzle-orm");
      const { partners, partnerOnboarding } = await import("../../drizzle/schema");

      const [partner] = await db.select().from(partners).where(eq(partners.id, input.id)).limit(1);
      if (!partner) throw new TRPCError({ code: "NOT_FOUND", message: "파트너를 찾을 수 없습니다" });

      // partner_onboarding에서 URL/adminNote 조회 (이메일 기준)
      let onboardingData: {
        serviceName: string | null;
        websiteUrl: string | null;
        blogUrl: string | null;
        snsUrl: string | null;
        adminNote: string | null;
      } | null = null;

      const email = partner.contactEmail || partner.googleEmail;
      if (email) {
        const [onboarding] = await db
          .select({
            serviceName: partnerOnboarding.serviceName,
            websiteUrl: partnerOnboarding.websiteUrl,
            blogUrl: partnerOnboarding.blogUrl,
            snsUrl: partnerOnboarding.snsUrl,
            adminNote: partnerOnboarding.adminNote,
          })
          .from(partnerOnboarding)
          .where(eq(partnerOnboarding.contactEmail, email))
          .limit(1);
        if (onboarding) onboardingData = onboarding;
      }

      const { loginPwHash: _, ...safe } = partner;
      return {
        ...safe,
        onboarding: onboardingData,
      };
    }),

  // 일정 목록 조회 (파트너별 또는 월별)
  getSchedules: protectedProcedure
    .input(
      z.object({
        partnerId: z.number().int().positive().optional(),
        year: z.number().int().optional(),
        month: z.number().int().min(1).max(12).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return await getPartnerSchedules(input);
    }),

  // 일정 등록
  createSchedule: protectedProcedure
    .input(scheduleInput)
    .mutation(async ({ input }) => {
      await createPartnerSchedule(input);
      return { success: true };
    }),

  // 일정 수정
  updateSchedule: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), data: scheduleInput.partial() }))
    .mutation(async ({ input }) => {
      await updatePartnerSchedule(input.id, input.data as any);
      return { success: true };
    }),

  // 일정 삭제
  deleteSchedule: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deletePartnerSchedule(input.id);
      return { success: true };
    }),
});
