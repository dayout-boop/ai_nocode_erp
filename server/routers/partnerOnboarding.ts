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
import { partnerOnboarding } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { onPartnerApproved } from "../services/sampleDataSeeder";
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

      // 중복 이메일 체크
      const [existing] = await db
        .select({ id: partnerOnboarding.id })
        .from(partnerOnboarding)
        .where(eq(partnerOnboarding.contactEmail, input.contactEmail))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 해당 이메일로 신청된 내역이 있습니다.",
        });
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

      // 승인 시 샘플 데이터 자동 생성
      if (input.status === "approved" || input.status === "active") {
        const wasNotApproved = current?.status !== "approved" && current?.status !== "active";
        if (wasNotApproved && current) {
          const category = (current.sampleCategory ?? "golf_tour_mixed") as
            | "golf_tour_domestic"
            | "golf_tour_overseas"
            | "golf_tour_mixed";
          // 비동기로 실행 (응답 블로킹 방지)
          onPartnerApproved(input.id, category).catch(console.error);
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
