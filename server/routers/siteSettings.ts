/**
 * siteSettingsRouter
 * CMS > 홈페이지 관리 — 전역설정/네비/히어로/푸터/노출상품/OCR/감사로그
 */
import { z } from "zod";
import { eq, asc, desc } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  siteSettings,
  siteNavItems,
  siteHeroSlides,
  siteFooter,
  siteFeaturedPackages,
  siteAuditLogs,
  packages,
} from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";

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

// ─── 관리자 체크 헬퍼 ─────────────────────────────────────
function requireAdmin(role: string) {
  if (role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
  }
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
  // ─── 전역 설정 ───────────────────────────────────────────
  getSettings: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await db.select().from(siteSettings);
    // 초기값이 없으면 seed
    if (rows.length === 0) {
      await db.insert(siteSettings).values(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS.reduce((acc: Record<string, string | null>, s: { settingKey: string; settingValue: string }) => {
        acc[s.settingKey] = s.settingValue;
        return acc;
      }, {} as Record<string, string | null>);
    }
    return rows.reduce((acc: Record<string, string | null>, s: { settingKey: string; settingValue: string | null }) => {
      acc[s.settingKey] = s.settingValue ?? null;
      return acc;
    }, {} as Record<string, string | null>);
  }),

  updateSettings: protectedProcedure
    .input(z.record(z.string(), z.string().nullable()))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const old = await db.select().from(siteSettings);
    for (const [key, value] of Object.entries(input)) {
        const existing = old.find((r) => r.settingKey === key);
        if (existing) {
          await db.update(siteSettings)
            .set({ settingValue: value, updatedBy: ctx.user.name ?? ctx.user.openId })
            .where(eq(siteSettings.settingKey, key));
        } else {
          await db.insert(siteSettings).values({
            settingKey: key,
            settingValue: value,
            updatedBy: ctx.user.name ?? ctx.user.openId,
          });
        }
      }
      await writeAuditLog({
        tableName: "site_settings",
        action: "update",
        oldValue: old,
        newValue: input,
        changedBy: ctx.user.name ?? ctx.user.openId,
        changedByUserId: ctx.user.id,
      });
      return { success: true };
    }),

  // ─── 네비게이션 ──────────────────────────────────────────
  getNavItems: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await db.select().from(siteNavItems).orderBy(asc(siteNavItems.sortOrder));
    if (rows.length === 0) {
      await db.insert(siteNavItems).values(DEFAULT_NAV_ITEMS);
      return DEFAULT_NAV_ITEMS;
    }
    return rows;
  }),

  updateNavItems: protectedProcedure
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
      requireAdmin(ctx.user.role);
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const old = await db.select().from(siteNavItems);
      // 전체 교체 방식
      await db.delete(siteNavItems);
      if (input.length > 0) {
        await db.insert(siteNavItems).values(
          input.map((item, i) => ({
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
        changedBy: ctx.user.name ?? ctx.user.openId,
        changedByUserId: ctx.user.id,
      });
      return { success: true };
    }),

  // ─── 히어로 슬라이드 ─────────────────────────────────────
  getHeroSlides: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const slides = await db.select().from(siteHeroSlides).orderBy(asc(siteHeroSlides.sortOrder));
    const now = new Date();
    // startAt/endAt 기반 isActive 자동 계산:
    // - startAt/endAt 둘 다 null이면 수동 isActive 토글 우선 적용
    // - 하나라도 설정되어 있으면 날짜 범위 기준으로 자동 활성화/비활성화
    return slides.map((slide) => {
      const hasSchedule = slide.startAt != null || slide.endAt != null;
      if (!hasSchedule) return slide;
      const afterStart = slide.startAt == null || now >= new Date(slide.startAt as Date);
      const beforeEnd = slide.endAt == null || now <= new Date(slide.endAt as Date);
      return { ...slide, isActive: afterStart && beforeEnd };
    });
  }),

  createHeroSlide: protectedProcedure
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
      requireAdmin(ctx.user.role);
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(siteHeroSlides).values({
        ...input,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      });
      await writeAuditLog({
        tableName: "site_hero_slides",
        recordId: String(result.insertId),
        action: "create",
        newValue: input,
        changedBy: ctx.user.name ?? ctx.user.openId,
        changedByUserId: ctx.user.id,
      });
      return { success: true, id: result.insertId };
    }),

  updateHeroSlide: protectedProcedure
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
      requireAdmin(ctx.user.role);
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const [old] = await db.select().from(siteHeroSlides).where(eq(siteHeroSlides.id, id));
      await db.update(siteHeroSlides).set(data).where(eq(siteHeroSlides.id, id));
      await writeAuditLog({
        tableName: "site_hero_slides",
        recordId: String(id),
        action: "update",
        oldValue: old,
        newValue: data,
        changedBy: ctx.user.name ?? ctx.user.openId,
        changedByUserId: ctx.user.id,
      });
      return { success: true };
    }),

  deleteHeroSlide: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [old] = await db.select().from(siteHeroSlides).where(eq(siteHeroSlides.id, input.id));
      await db.delete(siteHeroSlides).where(eq(siteHeroSlides.id, input.id));
      await writeAuditLog({
        tableName: "site_hero_slides",
        recordId: String(input.id),
        action: "delete",
        oldValue: old,
        changedBy: ctx.user.name ?? ctx.user.openId,
        changedByUserId: ctx.user.id,
      });
      return { success: true };
    }),

  reorderHeroSlides: protectedProcedure
    .input(z.array(z.object({ id: z.number(), sortOrder: z.number() })))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);
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
  getFooter: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [row] = await db.select().from(siteFooter).limit(1);
    if (!row) {
      // 초기값 seed
      await db.insert(siteFooter).values(DEFAULT_FOOTER);
      return DEFAULT_FOOTER;
    }
    return row;
  }),

  updateFooter: protectedProcedure
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
      youtubeUrl: z.string().optional(),
      naverBlogUrl: z.string().optional(),
      copyright: z.string().optional(),
      businessLicenseImageUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select().from(siteFooter).limit(1);
      if (existing) {
        await db.update(siteFooter)
          .set({ ...input, updatedBy: ctx.user.name ?? ctx.user.openId })
          .where(eq(siteFooter.id, existing.id));
        await writeAuditLog({
          tableName: "site_footer",
          recordId: String(existing.id),
          action: "update",
          oldValue: existing,
          newValue: input,
          changedBy: ctx.user.name ?? ctx.user.openId,
          changedByUserId: ctx.user.id,
        });
      } else {
        await db.insert(siteFooter).values({
          ...input,
          updatedBy: ctx.user.name ?? ctx.user.openId,
        });
      }
      return { success: true };
    }),

  // ─── 노출 상품 구성 ──────────────────────────────────────
  getFeaturedPackages: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
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
      .orderBy(asc(siteFeaturedPackages.section), asc(siteFeaturedPackages.sortOrder));
    return rows;
  }),

  setFeaturedPackages: protectedProcedure
    .input(z.array(z.object({
      packageId: z.number(),
      section: z.string(),
      sortOrder: z.number(),
      isActive: z.boolean().optional(),
    })))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const old = await db.select().from(siteFeaturedPackages);
      await db.delete(siteFeaturedPackages);
      if (input.length > 0) {
        await db.insert(siteFeaturedPackages).values(
          input.map((item) => ({
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
        changedBy: ctx.user.name ?? ctx.user.openId,
        changedByUserId: ctx.user.id,
      });
      return { success: true };
    }),

  // ─── 사업자등록증 OCR ────────────────────────────────────
  ocrBusinessLicense: protectedProcedure
    .input(z.object({
      imageUrl: z.string(),   // 업로드된 이미지 URL
      imageBase64: z.string().optional(), // base64 인코딩된 이미지 (선택)
    }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);

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

      // Gemini Vision 호출 (기존 invokeLLM 재사용 — 비용 절감 경로)
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
          // 503 오류 시 잠시 대기 후 재시도
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

  // ─── 감사 로그 조회 ──────────────────────────────────────
  getAuditLogs: protectedProcedure
    .input(z.object({
      tableName: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const query = db.select().from(siteAuditLogs).orderBy(desc(siteAuditLogs.createdAt)).limit(input.limit);
      if (input.tableName) {
        return db.select().from(siteAuditLogs)
          .where(eq(siteAuditLogs.tableName, input.tableName))
          .orderBy(desc(siteAuditLogs.createdAt))
          .limit(input.limit);
      }
      return query;
    }),
});
