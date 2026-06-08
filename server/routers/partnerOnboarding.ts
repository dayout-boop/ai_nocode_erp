/**
 * 파트너 온보딩 tRPC 라우터
 *
 * - apply: 신규 파트너 가입 신청 (공개)
 * - list: 신청 목록 조회 (관리자)
 * - get: 단건 조회 (관리자)
 * - updateStatus: 상태 변경 (관리자)
 * - ocrBusinessLicense: 사업자등록증 OCR (공개 - 파일 업로드 후 호출)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { partnerOnboarding, tenants, partners } from "../../drizzle/schema";
import { or } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { onPartnerApproved } from "../services/sampleDataSeeder";
import { SUBSCRIPTION_PLANS } from "../products";
// 관리자 전용 프로시저
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});

export const partnerOnboardingRouter = router({
  /** 신규 파트너 가입 신청 */
  submit: publicProcedure
    .input(
      z.object({
        companyName: z.string().min(1, "업체명을 입력해주세요."),
        businessNumber: z.string().optional(),
        ceoName: z.string().optional(),
        businessType: z.string().optional(),
        businessItem: z.string().optional(),
        address: z.string().optional(),
        contactName: z.string().min(1, "담당자명을 입력해주세요."),
        contactEmail: z.string().email("올바른 이메일을 입력해주세요."),
        contactPhone: z.string().optional(),
        businessLicenseKey: z.string().optional(),
        businessLicenseUrl: z.string().optional(),
        ocrResult: z.string().optional(),
        sampleCategory: z.enum(["golf_tour_domestic", "golf_tour_overseas", "golf_tour_mixed"]).default("golf_tour_mixed"),
        subscriptionPlan: z.enum(["starter", "standard", "premium"]).default("starter"),
        billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      // 기존 행 조회 (pending/reviewing 상태인 경우 업데이트, 승인/활성 상태는 신규 삽입 거부)
      const [existing] = await db
        .select({ id: partnerOnboarding.id, status: partnerOnboarding.status })
        .from(partnerOnboarding)
        .where(eq(partnerOnboarding.contactEmail, input.contactEmail))
        .orderBy(desc(partnerOnboarding.createdAt))
        .limit(1);

      if (existing) {
        if (existing.status === 'approved' || existing.status === 'active') {
          throw new TRPCError({
            code: "CONFLICT",
            message: "이미 승인된 파트너 계정입니다. 파트너 대시보드로 이동해주세요.",
          });
        }
        // pending/reviewing 상태: 기존 행 업데이트 (upsert)
        await db.update(partnerOnboarding).set({
          companyName: input.companyName,
          businessNumber: input.businessNumber,
          ceoName: input.ceoName,
          businessType: input.businessType,
          businessItem: input.businessItem,
          address: input.address,
          contactName: input.contactName,
          contactPhone: input.contactPhone,
          businessLicenseKey: input.businessLicenseKey,
          businessLicenseUrl: input.businessLicenseUrl,
          ocrResult: input.ocrResult,
          sampleCategory: input.sampleCategory,
          subscriptionPlan: input.subscriptionPlan,
          billingCycle: input.billingCycle,
          status: "pending",
        }).where(eq(partnerOnboarding.id, existing.id));
        return { success: true, id: existing.id };
      }

      const [result] = await db.insert(partnerOnboarding).values({
        ...input,
        status: "pending",
      });

      return { success: true, id: (result as { insertId: number }).insertId };
    }),

  /** 신청 목록 조회 (관리자) */
  list: adminProcedure
    .input(
      z.object({
        status: z.enum(["pending", "reviewing", "approved", "rejected", "active", "all"]).default("all"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      let query = db.select().from(partnerOnboarding).$dynamic();

      if (input.status !== "all") {
        query = query.where(eq(partnerOnboarding.status, input.status));
      }

      const items = await query
        .orderBy(desc(partnerOnboarding.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return items;
    }),

  /** 단건 조회 (관리자) */
  get: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      const [item] = await db
        .select()
        .from(partnerOnboarding)
        .where(eq(partnerOnboarding.id, input.id))
        .limit(1);

      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "신청 내역을 찾을 수 없습니다." });

      return item;
    }),

  /** 상태 변경 (관리자) */
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["pending", "reviewing", "approved", "rejected", "active"]),
        adminNote: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      // 현재 신청 정보 조회
      const [current] = await db
        .select()
        .from(partnerOnboarding)
        .where(eq(partnerOnboarding.id, input.id))
        .limit(1);

      await db
        .update(partnerOnboarding)
        .set({
          status: input.status,
          adminNote: input.adminNote,
          reviewedBy: ctx.user.name ?? ctx.user.openId,
          reviewedAt: new Date(),
        })
        .where(eq(partnerOnboarding.id, input.id));

      // 승인 시 테넌트 자동 생성 + 샘플 데이터 자동 생성
      if (input.status === "approved" || input.status === "active") {
        const wasNotApproved = current?.status !== "approved" && current?.status !== "active";
        if (wasNotApproved && current) {
          // 1) tenants 테이블에 자동 생성 (없는 경우만)
          let tenantId: number | undefined;
          try {
            const plan = SUBSCRIPTION_PLANS.find(p => p.id === (current.subscriptionPlan ?? "starter"));
            const aiCreditsDefault = plan?.aiCreditsPerMonth ?? 100;
            // slug: 업체명 영문 변환 + onboardingId 조합
            const slugBase = current.companyName
              .replace(/[^a-zA-Z0-9가-힣]/g, "")
              .toLowerCase()
              .slice(0, 20) || "partner";
            const slug = `${slugBase}-${input.id}`;
            const trialExpires = new Date();
            trialExpires.setDate(trialExpires.getDate() + 30); // 30일 무료 체험

            const [insertResult] = await db.insert(tenants).values({
              onboardingId: input.id,
              slug,
              companyName: current.companyName,
              subscriptionPlan: (current.subscriptionPlan ?? "starter") as "starter" | "standard" | "premium",
              billingCycle: (current.billingCycle ?? "monthly") as "monthly" | "yearly",
              subscriptionStatus: "trial",
              subscriptionExpiresAt: trialExpires,
              isActive: true,
              sampleCategory: (current.sampleCategory ?? "golf_tour_mixed") as "golf_tour_domestic" | "golf_tour_overseas" | "golf_tour_mixed",
              sampleSeeded: false,
              aiCreditsBalance: aiCreditsDefault,
              aiCreditsMonthlyLimit: aiCreditsDefault,
            });
            tenantId = Number((insertResult as any).insertId);
            console.log(`[Onboarding] 테넌트 자동 생성 완료: tenant_id=${tenantId}, slug=${slug}`);
          } catch (tenantErr: any) {
            // slug 중복 등으로 이미 생성된 경우 무시
            console.warn(`[Onboarding] 테넌트 생성 스킵 (이미 존재할 수 있음):`, tenantErr?.message);
          }

          const category = (current.sampleCategory ?? "golf_tour_mixed") as
            | "golf_tour_domestic"
            | "golf_tour_overseas"
            | "golf_tour_mixed";
          // 2) 비동기로 샘플 데이터 생성 (응답 블로킹 방지)
          onPartnerApproved(input.id, category, tenantId).catch(console.error);
        }
      }

      return { success: true };
    }),

  /** 사업자등록증 OCR - Gemini Vision으로 텍스트 추출 */
  ocrBusinessLicense: publicProcedure
    .input(
      z.object({
        /** 이미지 URL (S3 presigned URL 또는 base64 data URL) */
        imageUrl: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `당신은 한국 사업자등록증에서 정보를 추출하는 OCR 전문가입니다.
이미지에서 다음 정보를 JSON 형식으로 추출해주세요:
- companyName: 상호(법인명)
- businessNumber: 사업자등록번호 (xxx-xx-xxxxx 형식)
- ceoName: 대표자 성명
- businessType: 업태
- businessItem: 종목
- address: 사업장 소재지
- openDate: 개업연월일

추출할 수 없는 필드는 null로 반환하세요.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: input.imageUrl, detail: "high" },
                },
                {
                  type: "text",
                  text: "이 사업자등록증에서 정보를 추출해주세요.",
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "business_license",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  companyName: { type: ["string", "null"] },
                  businessNumber: { type: ["string", "null"] },
                  ceoName: { type: ["string", "null"] },
                  businessType: { type: ["string", "null"] },
                  businessItem: { type: ["string", "null"] },
                  address: { type: ["string", "null"] },
                  openDate: { type: ["string", "null"] },
                },
                required: ["companyName", "businessNumber", "ceoName", "businessType", "businessItem", "address", "openDate"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) throw new Error("OCR 응답이 비어있습니다.");
        const contentStr = typeof content === "string" ? content : JSON.stringify(content);
        const parsed = JSON.parse(contentStr);
        return { success: true, data: parsed };
      } catch (err) {
        console.error("[OCR] 사업자등록증 OCR 실패:", err);
        return { success: false, data: null, error: String(err) };
      }
    }),

  /** 수동 샘플 데이터 시드 (관리자) */
  seedSampleData: adminProcedure
    .input(
      z.object({
        category: z.enum(["golf_tour_domestic", "golf_tour_overseas", "golf_tour_mixed"]),
      })
    )
    .mutation(async ({ input }) => {
      const { seedSampleData } = await import("../services/sampleDataSeeder");
      const result = await seedSampleData(input.category);
      return result;
    }),

  /** 내 온보딩 신청 상태 확인 (로그인 사용자) */
  getMyStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { hasApplication: false, status: null, data: null };
      const email = ctx.user?.email;
      if (!email) return { hasApplication: false, status: null, data: null };
      const [row] = await db
        .select()
        .from(partnerOnboarding)
        .where(eq(partnerOnboarding.contactEmail, email))
        .limit(1);
      if (!row) return { hasApplication: false, status: null, data: null };
      return {
        hasApplication: true,
        status: row.status,
        data: {
          id: row.id,
          companyName: row.companyName,
          contactName: row.contactName,
          contactEmail: row.contactEmail,
          contactPhone: (row as Record<string, unknown>).contactPhone as string | null ?? null,
          businessNumber: (row as Record<string, unknown>).businessNumber as string | null ?? null,
          ceoName: (row as Record<string, unknown>).ceoName as string | null ?? null,
          businessType: (row as Record<string, unknown>).businessType as string | null ?? null,
          businessItem: (row as Record<string, unknown>).businessItem as string | null ?? null,
          address: (row as Record<string, unknown>).address as string | null ?? null,
          tourismLicenseNo: (row as Record<string, unknown>).tourismLicenseNo as string | null ?? null,
          tourismLicenseType: (row as Record<string, unknown>).tourismLicenseType as string | null ?? null,
          tourismOpenDate: (row as Record<string, unknown>).tourismOpenDate as string | null ?? null,
          subscriptionPlan: row.subscriptionPlan,
          sampleCategory: row.sampleCategory,
          businessLicenseUrl: row.businessLicenseUrl ?? null,
          adminNote: row.adminNote ?? null,
          createdAt: row.createdAt,
        },
      };
    }),

  /** 관광사업자등록증 OCR - Gemini Vision으로 텍스트 추출 */
  ocrTourismLicense: publicProcedure
    .input(
      z.object({
        /** 이미지 URL (S3 presigned URL 또는 base64 data URL) */
        imageUrl: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `당신은 한국 관광사업자등록증에서 정보를 추출하는 OCR 전문가입니다.
이미지에서 다음 정보를 JSON 형식으로 추출해주세요:
- companyName: 업체명(상호)
- ceoName: 대표자 성명
- licenseNo: 등록번호
- licenseType: 업종 (예: 국외여행업, 국내여행업, 일반여행업)
- address: 소재지
- openDate: 등록일자
- businessNumber: 사업자등록번호 (있는 경우)

추출할 수 없는 필드는 null로 반환하세요.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: input.imageUrl, detail: "high" },
                },
                {
                  type: "text",
                  text: "이 관광사업자등록증에서 정보를 추출해주세요.",
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "tourism_license",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  companyName: { type: ["string", "null"] },
                  ceoName: { type: ["string", "null"] },
                  licenseNo: { type: ["string", "null"] },
                  licenseType: { type: ["string", "null"] },
                  address: { type: ["string", "null"] },
                  openDate: { type: ["string", "null"] },
                  businessNumber: { type: ["string", "null"] },
                },
                required: ["companyName", "ceoName", "licenseNo", "licenseType", "address", "openDate", "businessNumber"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) throw new Error("OCR 응답이 비어있습니다.");
        const contentStr = typeof content === "string" ? content : JSON.stringify(content);
        const parsed = JSON.parse(contentStr);
        return { success: true, data: parsed };
      } catch (err) {
        console.error("[OCR] 관광사업자등록증 OCR 실패:", err);
        return { success: false, data: null, error: String(err) };
      }
    }),

  /** 두 등록증 OCR 결과로 자동 가입 신청 (수기 입력 없음) */
  submitWithBothOcr: publicProcedure
    .input(
      z.object({
        // 담당자 연락처 (OCR로 추출 불가한 항목)
        contactName: z.string().min(1, "담당자명을 입력해주세요."),
        contactEmail: z.string().email("올바른 이메일을 입력해주세요."),
        contactPhone: z.string().optional(),
        // 사업자등록증 OCR 결과
        businessLicenseKey: z.string().optional(),
        businessLicenseUrl: z.string().optional(),
        ocrRawText: z.string().optional(),
        ocrResult: z.string().optional(), // JSON 문자열
        // 관광사업자등록증 OCR 결과
        tourismLicenseKey: z.string().optional(),
        tourismLicenseUrl: z.string().optional(),
        tourismOcrRawText: z.string().optional(),
        tourismOcrResult: z.string().optional(), // JSON 문자열
        // 구독 플랜
        sampleCategory: z.enum(["golf_tour_domestic", "golf_tour_overseas", "golf_tour_mixed"]).default("golf_tour_mixed"),
        subscriptionPlan: z.enum(["starter", "standard", "premium"]).default("starter"),
        billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      // 기존 행 조회 (pending/reviewing 상태인 경우 업데이트)
      const [existing] = await db
        .select({ id: partnerOnboarding.id, status: partnerOnboarding.status })
        .from(partnerOnboarding)
        .where(eq(partnerOnboarding.contactEmail, input.contactEmail))
        .orderBy(desc(partnerOnboarding.createdAt))
        .limit(1);

      if (existing && (existing.status === 'approved' || existing.status === 'active')) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 승인된 파트너 계정입니다. 파트너 대시보드로 이동해주세요.",
        });
      }

      // OCR 결과에서 회사 정보 파싱
      let bizOcr: Record<string, string | null> = {};
      let tourOcr: Record<string, string | null> = {};
      try { if (input.ocrResult) bizOcr = JSON.parse(input.ocrResult); } catch {}
      try { if (input.tourismOcrResult) tourOcr = JSON.parse(input.tourismOcrResult); } catch {}

      // 두 등록증이 모두 업로드된 경우 자동 승인 처리
      const hasBothLicenses = !!(input.businessLicenseUrl && input.tourismLicenseUrl);
      const autoApproved = hasBothLicenses;
      const finalStatus = autoApproved ? "approved" : "pending";

      const upsertValues = {
        companyName: (bizOcr.companyName ?? tourOcr.companyName ?? input.contactName) as string,
        businessNumber: bizOcr.businessNumber as string | undefined,
        ceoName: bizOcr.ceoName as string | undefined,
        businessType: bizOcr.businessType as string | undefined,
        businessItem: bizOcr.businessItem as string | undefined,
        address: (bizOcr.address ?? tourOcr.address) as string | undefined,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        businessLicenseKey: input.businessLicenseKey,
        businessLicenseUrl: input.businessLicenseUrl,
        ocrRawText: input.ocrRawText,
        ocrResult: input.ocrResult,
        tourismLicenseKey: input.tourismLicenseKey,
        tourismLicenseUrl: input.tourismLicenseUrl,
        tourismOcrRawText: input.tourismOcrRawText,
        tourismOcrResult: input.tourismOcrResult,
        tourismLicenseNo: tourOcr.licenseNo as string | undefined,
        tourismLicenseType: tourOcr.licenseType as string | undefined,
        tourismOpenDate: tourOcr.openDate as string | undefined,
        sampleCategory: input.sampleCategory,
        subscriptionPlan: input.subscriptionPlan,
        billingCycle: input.billingCycle,
        status: finalStatus as "pending" | "approved",
        reviewedBy: autoApproved ? "OCR_AUTO_APPROVE" : undefined,
        reviewedAt: autoApproved ? new Date() : undefined,
        adminNote: autoApproved ? "사업자등록증 + 관광사업자등록증 OCR 인식 완료 - 자동 승인" : undefined,
      };

      let newId: number;
      if (existing) {
        // 기존 pending 행 업데이트
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.update(partnerOnboarding).set(upsertValues as any).where(eq(partnerOnboarding.id, existing.id));
        newId = existing.id;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [result] = await db.insert(partnerOnboarding).values(upsertValues as any);
        newId = (result as { insertId: number }).insertId;
      }

      // 자동 승인 시: 테넌트 생성 + partners.isActive=true 업데이트 + 샘플 데이터 생성
      if (autoApproved) {
        const category = (input.sampleCategory ?? "golf_tour_mixed") as
          | "golf_tour_domestic"
          | "golf_tour_overseas"
          | "golf_tour_mixed";

        // 1) tenants 테이블에 자동 생성 (없는 경우만)
        let tenantId: number | undefined;
        try {
          const plan = SUBSCRIPTION_PLANS.find(p => p.id === (input.subscriptionPlan ?? "starter"));
          const aiCreditsDefault = plan?.aiCreditsPerMonth ?? 100;
          const companyName = (upsertValues.companyName ?? input.contactName) as string;
          const slugBase = companyName
            .replace(/[^a-zA-Z0-9가-힣]/g, "")
            .toLowerCase()
            .slice(0, 20) || "partner";
          const slug = `${slugBase}-${newId}`;
          const trialExpires = new Date();
          trialExpires.setDate(trialExpires.getDate() + 30);

          const [insertResult] = await db.insert(tenants).values({
            onboardingId: newId,
            slug,
            companyName,
            subscriptionPlan: (input.subscriptionPlan ?? "starter") as "starter" | "standard" | "premium",
            billingCycle: (input.billingCycle ?? "monthly") as "monthly" | "yearly",
            subscriptionStatus: "trial",
            subscriptionExpiresAt: trialExpires,
            isActive: true,
            sampleCategory: category,
            sampleSeeded: false,
            aiCreditsBalance: aiCreditsDefault,
            aiCreditsMonthlyLimit: aiCreditsDefault,
          });
          tenantId = Number((insertResult as any).insertId);
          console.log(`[AutoApprove] 테넌트 자동 생성 완료: tenant_id=${tenantId}, slug=${slug}`);
        } catch (tenantErr: any) {
          // slug 중복 등으로 이미 생성된 경우 기존 테넌트 조회
          console.warn(`[AutoApprove] 테넌트 생성 스킵 (이미 존재할 수 있음):`, tenantErr?.message);
          const [existingTenant] = await db
            .select({ id: tenants.id })
            .from(tenants)
            .where(eq(tenants.onboardingId, newId))
            .limit(1);
          if (existingTenant) tenantId = existingTenant.id;
        }

        // 2) partners 테이블에서 이메일로 파트너 조회 후 isActive=true + tenantId 업데이트
        if (tenantId) {
          try {
            const [existingPartner] = await db
              .select({ id: partners.id })
              .from(partners)
              .where(
                or(
                  eq(partners.googleEmail, input.contactEmail),
                  eq(partners.contactEmail, input.contactEmail)
                )
              )
              .limit(1);

            if (existingPartner) {
              await db
                .update(partners)
                .set({ isActive: true, tenantId })
                .where(eq(partners.id, existingPartner.id));
              console.log(`[AutoApprove] 파트너 활성화 완료: partner_id=${existingPartner.id}, tenant_id=${tenantId}`);
            } else {
              // partners 행이 없는 경우 (구글 로그인 전 온보딩 완료 케이스)
              // partnerGoogleAuth.ts 콜백에서 로그인 시 자동 처리됨
              console.log(`[AutoApprove] partners 행 없음 - 구글 로그인 시 자동 생성 예정 (email: ${input.contactEmail})`);
            }
          } catch (partnerErr: any) {
            console.error(`[AutoApprove] 파트너 활성화 실패:`, partnerErr?.message);
          }
        }

        // 3) 비동기로 샘플 데이터 생성 (응답 블로킹 방지)
        onPartnerApproved(newId, category, tenantId).catch(console.error);
      }

      return { success: true, id: newId, autoApproved };
    }),

  /** 내 파트너 정보 수정 (승인 후 - 로그인 사용자) */
  updateMyInfo: protectedProcedure
    .input(
      z.object({
        contactName: z.string().min(1).optional(),
        contactPhone: z.string().optional(),
        companyName: z.string().min(1).optional(),
        businessNumber: z.string().optional(),
        ceoName: z.string().optional(),
        businessType: z.string().optional(),
        businessItem: z.string().optional(),
        address: z.string().optional(),
        tourismLicenseNo: z.string().optional(),
        tourismLicenseType: z.string().optional(),
        tourismOpenDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      const email = ctx.user?.email;
      if (!email) throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." });

      const [row] = await db
        .select({ id: partnerOnboarding.id, status: partnerOnboarding.status })
        .from(partnerOnboarding)
        .where(eq(partnerOnboarding.contactEmail, email))
        .limit(1);

      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "파트너 신청 내역을 찾을 수 없습니다." });

      // 승인된 파트너만 수정 가능
      if (row.status !== "approved" && row.status !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "승인된 파트너만 정보를 수정할 수 있습니다." });
      }

      const updateData: Record<string, unknown> = {};
      if (input.contactName !== undefined) updateData.contactName = input.contactName;
      if (input.contactPhone !== undefined) updateData.contactPhone = input.contactPhone;
      if (input.companyName !== undefined) updateData.companyName = input.companyName;
      if (input.businessNumber !== undefined) updateData.businessNumber = input.businessNumber;
      if (input.ceoName !== undefined) updateData.ceoName = input.ceoName;
      if (input.businessType !== undefined) updateData.businessType = input.businessType;
      if (input.businessItem !== undefined) updateData.businessItem = input.businessItem;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.tourismLicenseNo !== undefined) updateData.tourismLicenseNo = input.tourismLicenseNo;
      if (input.tourismLicenseType !== undefined) updateData.tourismLicenseType = input.tourismLicenseType;
      if (input.tourismOpenDate !== undefined) updateData.tourismOpenDate = input.tourismOpenDate;

      await db
        .update(partnerOnboarding)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set(updateData as any)
        .where(eq(partnerOnboarding.id, row.id));

      return { success: true };
    }),

  /** 이메일로 온보딩 상태 조회 (파트너 구글 로그인 전용 - 공개 API) */
  getStatusByEmail: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { hasApplication: false, status: null, data: null };
      const [row] = await db
        .select()
        .from(partnerOnboarding)
        .where(eq(partnerOnboarding.contactEmail, input.email))
        .orderBy(desc(partnerOnboarding.createdAt))
        .limit(1);
      if (!row) return { hasApplication: false, status: null, data: null };
      return {
        hasApplication: true,
        status: row.status,
        data: {
          id: row.id,
          companyName: row.companyName,
          contactName: row.contactName,
          contactEmail: row.contactEmail,
          contactPhone: (row as Record<string, unknown>).contactPhone as string | null ?? null,
          businessNumber: (row as Record<string, unknown>).businessNumber as string | null ?? null,
          ceoName: (row as Record<string, unknown>).ceoName as string | null ?? null,
          businessType: (row as Record<string, unknown>).businessType as string | null ?? null,
          businessItem: (row as Record<string, unknown>).businessItem as string | null ?? null,
          address: (row as Record<string, unknown>).address as string | null ?? null,
          tourismLicenseNo: (row as Record<string, unknown>).tourismLicenseNo as string | null ?? null,
          tourismLicenseType: (row as Record<string, unknown>).tourismLicenseType as string | null ?? null,
          tourismOpenDate: (row as Record<string, unknown>).tourismOpenDate as string | null ?? null,
          subscriptionPlan: row.subscriptionPlan,
          sampleCategory: row.sampleCategory,
          businessLicenseUrl: row.businessLicenseUrl ?? null,
          tourismLicenseUrl: (row as Record<string, unknown>).tourismLicenseUrl as string | null ?? null,
          ocrResult: row.ocrResult ?? null,
          tourismOcrResult: (row as Record<string, unknown>).tourismOcrResult as string | null ?? null,
          adminNote: row.adminNote ?? null,
          createdAt: row.createdAt,
        },
      };
    }),

  /** 온보딩 임시 저장 / 진행 상태 업데이트 (이탈 후 재진입 복원용) */
  saveDraft: publicProcedure
    .input(
      z.object({
        contactEmail: z.string().email(),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        companyName: z.string().optional(),
        businessLicenseKey: z.string().optional(),
        businessLicenseUrl: z.string().optional(),
        ocrResult: z.string().optional(),
        ocrRawText: z.string().optional(),
        tourismLicenseKey: z.string().optional(),
        tourismLicenseUrl: z.string().optional(),
        tourismOcrResult: z.string().optional(),
        tourismOcrRawText: z.string().optional(),
        subscriptionPlan: z.enum(["starter", "standard", "premium"]).optional(),
        billingCycle: z.enum(["monthly", "yearly"]).optional(),
        sampleCategory: z.enum(["golf_tour_domestic", "golf_tour_overseas", "golf_tour_mixed"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      // 기존 pending 행 조회
      const [existing] = await db
        .select({ id: partnerOnboarding.id, status: partnerOnboarding.status })
        .from(partnerOnboarding)
        .where(eq(partnerOnboarding.contactEmail, input.contactEmail))
        .orderBy(desc(partnerOnboarding.createdAt))
        .limit(1);

      // pending 상태인 경우만 업데이트 (approved/active는 건드리지 않음)
      if (existing && (existing.status === 'pending' || existing.status === 'reviewing')) {
        const updateData: Record<string, unknown> = {};
        if (input.contactName !== undefined) updateData.contactName = input.contactName;
        if (input.contactPhone !== undefined) updateData.contactPhone = input.contactPhone;
        if (input.companyName !== undefined) updateData.companyName = input.companyName;
        if (input.businessLicenseKey !== undefined) updateData.businessLicenseKey = input.businessLicenseKey;
        if (input.businessLicenseUrl !== undefined) updateData.businessLicenseUrl = input.businessLicenseUrl;
        if (input.ocrResult !== undefined) updateData.ocrResult = input.ocrResult;
        if (input.ocrRawText !== undefined) updateData.ocrRawText = input.ocrRawText;
        if (input.tourismLicenseKey !== undefined) updateData.tourismLicenseKey = input.tourismLicenseKey;
        if (input.tourismLicenseUrl !== undefined) updateData.tourismLicenseUrl = input.tourismLicenseUrl;
        if (input.tourismOcrResult !== undefined) updateData.tourismOcrResult = input.tourismOcrResult;
        if (input.tourismOcrRawText !== undefined) updateData.tourismOcrRawText = input.tourismOcrRawText;
        if (input.subscriptionPlan !== undefined) updateData.subscriptionPlan = input.subscriptionPlan;
        if (input.billingCycle !== undefined) updateData.billingCycle = input.billingCycle;
        if (input.sampleCategory !== undefined) updateData.sampleCategory = input.sampleCategory;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.update(partnerOnboarding).set(updateData as any).where(eq(partnerOnboarding.id, existing.id));
        return { success: true, id: existing.id, action: 'updated' };
      }

      return { success: true, id: existing?.id ?? null, action: 'skipped' };
    }),

  /** 파일 업로드 URL 생성 (사업자등록증 이미지) */
  getUploadUrl: publicProcedure
    .input(
      z.object({
        fileName: z.string(),
        contentType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // 파일 키 생성
      const timestamp = Date.now();
      const ext = input.fileName.split(".").pop() ?? "jpg";
      const key = `partner-onboarding/business-license/${timestamp}.${ext}`;
      return { key, uploadPath: `/api/upload/partner-license?key=${encodeURIComponent(key)}` };
    }),
});
