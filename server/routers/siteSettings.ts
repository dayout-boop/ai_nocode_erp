/**
 * siteSettingsRouter
 * CMS > 홈페이지 관리 — 전역설정/네비/히어로/푸터/노출상품/OCR/감사로그
 * [테넌트 지원] partnerProcedure 사용 — 파트너는 자신의 tenantId로만 접근
 */
import { z } from "zod";
import { eq, asc, desc, and, isNull } from "drizzle-orm";
import { partnerProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  siteSettings,
  siteNavItems,
  siteHeroSlides,
  siteFooter,
  siteFeaturedPackages,
  siteAuditLogs,
  packages,
  partnerOnboarding,
  tenants,
} from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";

// ─── 감사 로그 헬퍼 ─────────────────────────────────────────
async function writeAuditLog(opts: {
  tableName: string;
  recordId?: string;
  action: "create" | "update" | "delete";
  oldValue?: unknown;
  newValue?: unknown;
  changedBy?: string;
  changedByUserId?: number;
}) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(siteAuditLogs).values({
      tableName: opts.tableName,
      recordId: opts.recordId,
      action: opts.action,
      oldValue: opts.oldValue ? JSON.stringify(opts.oldValue) : null,
      newValue: opts.newValue ? JSON.stringify(opts.newValue) : null,
      changedBy: opts.changedBy,
      changedByUserId: opts.changedByUserId,
    });
  } catch {
    // 감사 로그 실패는 메인 작업을 중단하지 않음
  }
}

// ─── 호출자 이름/ID 헬퍼 ─────────────────────────────────────
function getCallerName(ctx: any): string {
  return ctx.user?.name ?? ctx.user?.openId ?? ctx.partnerOwner?.name ?? ctx.partnerStaff?.name ?? "unknown";
}
function getCallerUserId(ctx: any): number | undefined {
  return ctx.user?.id ?? ctx.partnerOwner?.id ?? ctx.partnerStaff?.id;
}

// ─── 기본 초기값 ─────────────────────────────────────────
const DEFAULT_FOOTER = {
  companyName: "두골프",
  ceoName: "홍길동",
  businessNumber: "000-00-00000",
  mailOrderNumber: "제 2022-서울광진-0000호",
  tourismLicenseNumber: "제2016-000000호",
  address: "서울특별시 광진구 자양로 126",
  phone: "1668-1739",
  email: "info@dogolf.com",
  businessHours: "평일 09:00 ~ 17:30 (점심 12:00~13:00 / 주말·공휴일 휴무)",
  bankAccounts: JSON.stringify([
    { bank: "국민은행", accountNumber: "000-0000-0000-00", accountHolder: "두골프" },
  ]),
  kakaoUrl: "http://pf.kakao.com/_xbHHSV",
  instagramUrl: "https://instagram.com/dogolf",
  youtubeUrl: "",
  naverBlogUrl: "",
  copyright: "© 2026 두골프(DOGOLF). All Rights Reserved.",
  businessLicenseImageUrl: "",
};

const DEFAULT_NAV_ITEMS = [
  { label: "국내골프", href: "/packages/korea", sortOrder: 1, isVisible: true, openInNewTab: false },
  { label: "태국골프", href: "/packages/thailand", sortOrder: 2, isVisible: true, openInNewTab: false },
  { label: "베트남골프", href: "/packages/vietnam", sortOrder: 3, isVisible: true, openInNewTab: false },
  { label: "필리핀골프", href: "/packages/philippines", sortOrder: 4, isVisible: true, openInNewTab: false },
  { label: "중국골프", href: "/packages/china", sortOrder: 5, isVisible: true, openInNewTab: false },
  { label: "일본골프", href: "/packages/japan", sortOrder: 6, isVisible: true, openInNewTab: false },
  { label: "갤러리", href: "/gallery", sortOrder: 7, isVisible: true, openInNewTab: false },
  { label: "공지사항", href: "/notice", sortOrder: 8, isVisible: true, openInNewTab: false },
];

const DEFAULT_SETTINGS = [
  { settingKey: "site_title", settingValue: "두골프 - 국내&해외 골프투어 전문 여행사", settingGroup: "general", description: "사이트 제목" },
  { settingKey: "site_description", settingValue: "국내외 최고의 골프 코스를 연결하는 프리미엄 골프 여행 전문 여행사", settingGroup: "seo", description: "사이트 설명" },
  { settingKey: "site_keywords", settingValue: "골프여행, 골프투어, 태국골프, 베트남골프, 필리핀골프, 해외골프", settingGroup: "seo", description: "SEO 키워드" },
  { settingKey: "logo_url", settingValue: "/manus-storage/logo_dogolf_bd2382c7.png", settingGroup: "general", description: "로고 이미지 URL" },
  { settingKey: "favicon_url", settingValue: "/favicon.ico", settingGroup: "general", description: "파비콘 URL" },
  { settingKey: "ga_id", settingValue: "", settingGroup: "analytics", description: "Google Analytics 측정 ID (G-XXXXXXXX)" },
  { settingKey: "kakao_channel_url", settingValue: "http://pf.kakao.com/_xbHHSV", settingGroup: "social", description: "카카오채널 URL" },
  { settingKey: "og_image_url", settingValue: "/manus-storage/hero_korea_853e915a.jpg", settingGroup: "seo", description: "OG 대표 이미지 URL" },
];

export const siteSettingsRouter = router({
  // ─── 전역 설정 조회 (public — tenantId 파라미터로 분기) ──────
  getSettings: publicProcedure
    .input(z.object({ tenantId: z.number().nullable().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const tid = input?.tenantId ?? null;
      const rows = await db.select().from(siteSettings).where(
        tid === null ? isNull(siteSettings.tenantId) : eq(siteSettings.tenantId, tid)
      );
      // 초기값이 없으면 seed (두골프 본사만)
      if (rows.length === 0 && tid === null) {
        await db.insert(siteSettings).values(DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS.reduce((acc: Record<string, string | null>, s) => {
          acc[s.settingKey] = s.settingValue;
          return acc;
        }, {} as Record<string, string | null>);
      }
      return rows.reduce((acc: Record<string, string | null>, s) => {
        acc[s.settingKey] = s.settingValue ?? null;
        return acc;
      }, {} as Record<string, string | null>);
    }),

  updateSettings: partnerProcedure
    .input(z.record(z.string(), z.string().nullable()))
    .mutation(async ({ input, ctx }) => {
      const tenantId = (ctx as any).tenantId as number | null;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const old = await db.select().from(siteSettings).where(
        tenantId === null ? isNull(siteSettings.tenantId) : eq(siteSettings.tenantId, tenantId)
      );
      for (const [key, value] of Object.entries(input)) {
        const existing = old.find((r) => r.settingKey === key);
        if (existing) {
          await db.update(siteSettings)
            .set({ settingValue: value, updatedBy: getCallerName(ctx) })
            .where(eq(siteSettings.id, existing.id));
        } else {
          await db.insert(siteSettings).values({
            tenantId,
            settingKey: key,
            settingValue: value,
            updatedBy: getCallerName(ctx),
          });
        }
      }
      await writeAuditLog({
        tableName: "site_settings",
        action: "update",
        oldValue: old,
        newValue: input,
        changedBy: getCallerName(ctx),
        changedByUserId: getCallerUserId(ctx),
      });
      return { success: true };
    }),

  // ─── 네비게이션 ──────────────────────────────────────────
  getNavItems: publicProcedure
    .input(z.object({ tenantId: z.number().nullable().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const tid = input?.tenantId ?? null;
      const rows = await db.select().from(siteNavItems)
        .where(tid === null ? isNull(siteNavItems.tenantId) : eq(siteNavItems.tenantId, tid))
        .orderBy(asc(siteNavItems.sortOrder));
      if (rows.length === 0 && tid === null) {
        await db.insert(siteNavItems).values(DEFAULT_NAV_ITEMS);
        return DEFAULT_NAV_ITEMS;
      }
      return rows;
    }),

  updateNavItems: partnerProcedure
    .input(z.array(z.object({
      id: z.number().optional(),
      label: z.string(),
      href: z.string(),
      sortOrder: z.number(),
      isVisible: z.boolean(),
      openInNewTab: z.boolean().optional(),
      icon: z.string().optional().nullable(),
    })))
    .mutation(async ({ input, ctx }) => {
      const tenantId = (ctx as any).tenantId as number | null;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const old = await db.select().from(siteNavItems).where(
        tenantId === null ? isNull(siteNavItems.tenantId) : eq(siteNavItems.tenantId, tenantId)
      );
      // 해당 테넌트 항목만 삭제 후 재삽입
      await db.delete(siteNavItems).where(
        tenantId === null ? isNull(siteNavItems.tenantId) : eq(siteNavItems.tenantId, tenantId)
      );
      if (input.length > 0) {
        await db.insert(siteNavItems).values(
          input.map((item, i) => ({
            tenantId,
            label: item.label,
            href: item.href,
            sortOrder: item.sortOrder ?? i,
            isVisible: item.isVisible,
            openInNewTab: item.openInNewTab ?? false,
            icon: item.icon ?? null,
          }))
        );
      }
      await writeAuditLog({
        tableName: "site_nav_items",
        action: "update",
        oldValue: old,
        newValue: input,
        changedBy: getCallerName(ctx),
        changedByUserId: getCallerUserId(ctx),
      });
      return { success: true };
    }),

  // ─── 히어로 슬라이드 ─────────────────────────────────────
  getHeroSlides: publicProcedure
    .input(z.object({ tenantId: z.number().nullable().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const tid = input?.tenantId ?? null;
      const slides = await db.select().from(siteHeroSlides)
        .where(tid === null ? isNull(siteHeroSlides.tenantId) : eq(siteHeroSlides.tenantId, tid))
        .orderBy(asc(siteHeroSlides.sortOrder));
      const now = new Date();
      return slides.map((slide) => {
        const hasSchedule = slide.startAt != null || slide.endAt != null;
        if (!hasSchedule) return slide;
        const afterStart = slide.startAt == null || now >= new Date(slide.startAt as Date);
        const beforeEnd = slide.endAt == null || now <= new Date(slide.endAt as Date);
        return { ...slide, isActive: afterStart && beforeEnd };
      });
    }),

  createHeroSlide: partnerProcedure
    .input(z.object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      mobileImageUrl: z.string().optional(),
      ctaText: z.string().optional(),
      ctaLink: z.string().optional(),
      destination: z.string().optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
      startAt: z.date().optional().nullable(),
      endAt: z.date().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = (ctx as any).tenantId as number | null;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(siteHeroSlides).values({
        ...input,
        tenantId,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      });
      await writeAuditLog({
        tableName: "site_hero_slides",
        recordId: String(result.insertId),
        action: "create",
        newValue: input,
        changedBy: getCallerName(ctx),
        changedByUserId: getCallerUserId(ctx),
      });
      return { success: true, id: result.insertId };
    }),

  updateHeroSlide: partnerProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      subtitle: z.string().optional(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      mobileImageUrl: z.string().optional(),
      ctaText: z.string().optional(),
      ctaLink: z.string().optional(),
      destination: z.string().optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
      startAt: z.date().optional().nullable(),
      endAt: z.date().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = (ctx as any).tenantId as number | null;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      // 테넌트 소유 확인
      const [slide] = await db.select().from(siteHeroSlides).where(
        and(
          eq(siteHeroSlides.id, id),
          tenantId === null ? isNull(siteHeroSlides.tenantId) : eq(siteHeroSlides.tenantId, tenantId)
        )
      );
      if (!slide) throw new TRPCError({ code: "NOT_FOUND", message: "슬라이드를 찾을 수 없습니다." });
      await db.update(siteHeroSlides).set(data).where(eq(siteHeroSlides.id, id));
      await writeAuditLog({
        tableName: "site_hero_slides",
        recordId: String(id),
        action: "update",
        oldValue: slide,
        newValue: data,
        changedBy: getCallerName(ctx),
        changedByUserId: getCallerUserId(ctx),
      });
      return { success: true };
    }),

  deleteHeroSlide: partnerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = (ctx as any).tenantId as number | null;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [slide] = await db.select().from(siteHeroSlides).where(
        and(
          eq(siteHeroSlides.id, input.id),
          tenantId === null ? isNull(siteHeroSlides.tenantId) : eq(siteHeroSlides.tenantId, tenantId)
        )
      );
      if (!slide) throw new TRPCError({ code: "NOT_FOUND", message: "슬라이드를 찾을 수 없습니다." });
      await db.delete(siteHeroSlides).where(eq(siteHeroSlides.id, input.id));
      await writeAuditLog({
        tableName: "site_hero_slides",
        recordId: String(input.id),
        action: "delete",
        oldValue: slide,
        changedBy: getCallerName(ctx),
        changedByUserId: getCallerUserId(ctx),
      });
      return { success: true };
    }),

  reorderHeroSlides: partnerProcedure
    .input(z.array(z.object({ id: z.number(), sortOrder: z.number() })))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      for (const item of input) {
        await db.update(siteHeroSlides)
          .set({ sortOrder: item.sortOrder })
          .where(eq(siteHeroSlides.id, item.id));
      }
      return { success: true };
    }),

  // ─── 푸터 관리 ───────────────────────────────────────────
  getFooter: publicProcedure
    .input(z.object({ tenantId: z.number().nullable().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const tid = input?.tenantId ?? null;
      const [row] = await db.select().from(siteFooter).where(
        tid === null ? isNull(siteFooter.tenantId) : eq(siteFooter.tenantId, tid)
      ).limit(1);
      if (!row) {
        if (tid === null) {
          await db.insert(siteFooter).values(DEFAULT_FOOTER);
          return DEFAULT_FOOTER;
        }
        return null;
      }
      return row;
    }),

  updateFooter: partnerProcedure
    .input(z.object({
      companyName: z.string().optional(),
      ceoName: z.string().optional(),
      businessNumber: z.string().optional(),
      mailOrderNumber: z.string().optional(),
      tourismLicenseNumber: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      businessHours: z.string().optional(),
      bankAccounts: z.string().optional(),
      kakaoUrl: z.string().optional(),
      instagramUrl: z.string().optional(),
      facebookUrl: z.string().optional(),
      xUrl: z.string().optional(),
      youtubeUrl: z.string().optional(),
      naverBlogUrl: z.string().optional(),
      copyright: z.string().optional(),
      businessLicenseImageUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = (ctx as any).tenantId as number | null;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select().from(siteFooter).where(
        tenantId === null ? isNull(siteFooter.tenantId) : eq(siteFooter.tenantId, tenantId)
      ).limit(1);
      if (existing) {
        await db.update(siteFooter)
          .set({ ...input, updatedBy: getCallerName(ctx) })
          .where(eq(siteFooter.id, existing.id));
        await writeAuditLog({
          tableName: "site_footer",
          recordId: String(existing.id),
          action: "update",
          oldValue: existing,
          newValue: input,
          changedBy: getCallerName(ctx),
          changedByUserId: getCallerUserId(ctx),
        });
      } else {
        await db.insert(siteFooter).values({
          ...input,
          tenantId,
          updatedBy: getCallerName(ctx),
        });
      }
      return { success: true };
    }),

  // ─── 노출 상품 구성 ──────────────────────────────────────
  getFeaturedPackages: publicProcedure
    .input(z.object({ tenantId: z.number().nullable().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const tid = input?.tenantId ?? null;
      const rows = await db
        .select({
          id: siteFeaturedPackages.id,
          packageId: siteFeaturedPackages.packageId,
          section: siteFeaturedPackages.section,
          sortOrder: siteFeaturedPackages.sortOrder,
          isActive: siteFeaturedPackages.isActive,
          packageTitle: packages.title,
          packageCountry: packages.country,
          packageImageUrl: packages.imageUrl,
          packageStatus: packages.status,
        })
        .from(siteFeaturedPackages)
        .leftJoin(packages, eq(siteFeaturedPackages.packageId, packages.id))
        .where(tid === null ? isNull(siteFeaturedPackages.tenantId) : eq(siteFeaturedPackages.tenantId, tid))
        .orderBy(asc(siteFeaturedPackages.section), asc(siteFeaturedPackages.sortOrder));
      return rows;
    }),

  setFeaturedPackages: partnerProcedure
    .input(z.array(z.object({
      packageId: z.number(),
      section: z.string(),
      sortOrder: z.number(),
      isActive: z.boolean().optional(),
    })))
    .mutation(async ({ input, ctx }) => {
      const tenantId = (ctx as any).tenantId as number | null;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const old = await db.select().from(siteFeaturedPackages).where(
        tenantId === null ? isNull(siteFeaturedPackages.tenantId) : eq(siteFeaturedPackages.tenantId, tenantId)
      );
      await db.delete(siteFeaturedPackages).where(
        tenantId === null ? isNull(siteFeaturedPackages.tenantId) : eq(siteFeaturedPackages.tenantId, tenantId)
      );
      if (input.length > 0) {
        await db.insert(siteFeaturedPackages).values(
          input.map((item) => ({
            tenantId,
            packageId: item.packageId,
            section: item.section,
            sortOrder: item.sortOrder,
            isActive: item.isActive ?? true,
          }))
        );
      }
      await writeAuditLog({
        tableName: "site_featured_packages",
        action: "update",
        oldValue: old,
        newValue: input,
        changedBy: getCallerName(ctx),
        changedByUserId: getCallerUserId(ctx),
      });
      return { success: true };
    }),

  // ─── 사업자등록증 OCR ────────────────────────────────────
  ocrBusinessLicense: partnerProcedure
    .input(z.object({
      imageUrl: z.string(),
      imageBase64: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const prompt = `이 사업자등록증 이미지에서 다음 정보를 JSON 형식으로 추출해주세요.
각 필드에 대해 추출된 값과 신뢰도(0.0~1.0)를 함께 반환해주세요.
신뢰도가 0.7 미만인 경우 lowConfidence를 true로 설정해주세요.

반환 형식:
{
  "companyName": { "value": "...", "confidence": 0.95, "lowConfidence": false },
  "ceoName": { "value": "...", "confidence": 0.9, "lowConfidence": false },
  "businessNumber": { "value": "...", "confidence": 0.95, "lowConfidence": false },
  "address": { "value": "...", "confidence": 0.85, "lowConfidence": false },
  "businessType": { "value": "...", "confidence": 0.8, "lowConfidence": false },
  "businessCategory": { "value": "...", "confidence": 0.8, "lowConfidence": false },
  "openDate": { "value": "...", "confidence": 0.9, "lowConfidence": false }
}

이미지에서 해당 정보를 찾을 수 없는 경우 value를 빈 문자열로 설정하고 confidence를 0으로 설정하세요.`;

      let result;
      let retries = 0;
      const maxRetries = 2;

      while (retries <= maxRetries) {
        try {
          const messages = [
            {
              role: "system" as const,
              content: "당신은 사업자등록증에서 정보를 추출하는 전문 OCR 시스템입니다. 반드시 JSON 형식으로만 응답하세요.",
            },
            {
              role: "user" as const,
              content: [
                { type: "text" as const, text: prompt },
                {
                  type: "image_url" as const,
                  image_url: { url: input.imageUrl },
                },
              ],
            },
          ];

          result = await invokeLLM({
            messages,
            response_format: { type: "json_object" },
          });
          break;
        } catch (err: unknown) {
          retries++;
          const errMsg = err instanceof Error ? err.message : String(err);
          if (retries > maxRetries) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `OCR 처리 실패: ${errMsg}`,
            });
          }
          await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
        }
      }

      const content = result?.choices?.[0]?.message?.content ?? "{}";
      let parsed: Record<string, { value: string; confidence: number; lowConfidence: boolean }> = {};
      try {
        parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "OCR 결과 파싱 실패" });
      }

      return {
        success: true,
        data: parsed,
        hasLowConfidence: Object.values(parsed).some((v) => v.lowConfidence),
      };
    }),

  // ─── 파트너 홈페이지 URL 조회 ───────────────────────────────────────
  // 파트너 세션의 tenantId 기반으로 파트너 온보딩에서 websiteUrl 조회
  getMyHomepageUrl: partnerProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const tenantId = (ctx as any).tenantId as number | null;
    if (!tenantId) return { websiteUrl: null, hasHomepage: false };
    const [tenant] = await db
      .select({ onboardingId: tenants.onboardingId })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!tenant?.onboardingId) return { websiteUrl: null, hasHomepage: false };
    const [onboarding] = await db
      .select({ websiteUrl: partnerOnboarding.websiteUrl })
      .from(partnerOnboarding)
      .where(eq(partnerOnboarding.id, tenant.onboardingId))
      .limit(1);
    const websiteUrl = onboarding?.websiteUrl ?? null;
    return { websiteUrl, hasHomepage: !!websiteUrl };
  }),

  // ─── 감사 로그 조회 (마스터 전용) ───────────────────────
  getAuditLogs: partnerProcedure
    .input(z.object({
      tableName: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.tableName) {
        return db.select().from(siteAuditLogs)
          .where(eq(siteAuditLogs.tableName, input.tableName))
          .orderBy(desc(siteAuditLogs.createdAt))
          .limit(input.limit);
      }
      return db.select().from(siteAuditLogs)
        .orderBy(desc(siteAuditLogs.createdAt))
        .limit(input.limit);
    }),
});
