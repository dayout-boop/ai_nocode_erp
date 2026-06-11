import { reservationsRouter } from "./routers/reservations";
import { affiliatesRouter } from "./routers/affiliates";
import { settingsRouter } from "./routers/settings";
import { adminAccountsRouter } from "./routers/adminAccounts";
import { adminAuthRouter } from "./routers/adminAuth";
import { adminManagementRouter } from "./routers/adminManagement";
import { erpApiKeysRouter } from "./routers/erpApiKeys";
import { mailRouter } from "./routers/mail";
import { knowledgeBlockRouter } from "./routers/knowledgeBlock";
import { manusWebhookRouter } from "./routers/manusWebhook";
import { reservationInquiriesRouter, inquiryTemplatesRouter } from "./routers/reservationInquiries";
import { reservationItinerariesRouter, customVariablesRouter } from "./routers/reservationItineraries";
import { reservationAffiliateCostsRouter } from "./routers/reservationAffiliateCosts";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, partnerProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  packages, packagePrices, packageOptions, packageSlots,
  bookings, travelers, settlements, inquiries, notices, banners, customerMemos, users,
  packageImages, aiInteractionLogs,
  devRequests, devFeatures, devVersions,
  aiCostLogs,
  payments, kakaoNotifications, packageVideos,
  reservations,
  aiLogs,
  adminAccounts,
  partners,
  partnerOnboarding,
  tenants,
} from "../drizzle/schema";
import { SUBSCRIPTION_PLANS } from "./products";
// AI 엔진 테이블은 별도 import로 처리됨 (아래 참조)
import { eq, desc, and, gte, lte, like, sql, count, asc, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { storagePut, storageGetSignedUrl } from "./storage";
import { optimizeImage, optimizeBase64Image } from "./imageOptimizer";
import { generateImage } from "./_core/imageGeneration";
import { ENV } from "./_core/env";
import { geminiChat, DOGOLF_SYSTEM_CONTEXT, type GeminiMessage, getCircuitBreakerStatus, resetCircuitBreaker, GEMINI_REGION_ENDPOINTS } from "./_core/gemini";
import { orchestrate, getModelPricing, getCacheStats, clearCache, detectComplexity, MODEL_CATALOG, LLAMA_FREE_MODEL, type TaskType, type TaskComplexity } from "./_core/orchestrator";
import { invokeLLM } from "./_core/llm";
import { createPaymentIntent, getPaymentStatus } from "./stripe";
import {
  sendBookingConfirmedNotification,
  sendBookingCancelledNotification,
} from "./_core/kakao";
import { generateGolfVideo, getVideoGenerationStatus } from "./_core/runway";
import { reportError, isCriticalError } from "./_core/errorWatcher";
import { generateFixCode, searchErpFeature } from "./_core/autoFixer";
import { runFullReview, getReviewResults } from "./_core/reviewEngine";
import { aiEngineLogs, aiFixRequests, aiReviewResults, promptVersions, modelRoutingRules, aiRoutingLogs } from "../drizzle/schema";
import {
  generatePackageDescription,
  generateMarketingCopy,
  generateInquiryReply,
  analyzeErpDataWithAI,
  detectAnomaly,
  anonymizeText,
  getModelConfig,
} from "./_core/geminiAIService";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});

const dashboardRouter = router({
  stats: partnerProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // tenantId 필터 조건 (null이면 전체, 값이 있으면 해당 파트너만)
    const tFilter = ctx.tenantId !== undefined && ctx.tenantId !== null;
    const [totalBookings] = await db.select({ count: count() }).from(bookings).where(tFilter ? eq(bookings.tenantId, ctx.tenantId!) : undefined);
    const [pendingBookings] = await db.select({ count: count() }).from(bookings).where(tFilter ? and(eq(bookings.status, "pending"), eq(bookings.tenantId, ctx.tenantId!)) : eq(bookings.status, "pending"));
    const [confirmedBookings] = await db.select({ count: count() }).from(bookings).where(tFilter ? and(eq(bookings.status, "confirmed"), eq(bookings.tenantId, ctx.tenantId!)) : eq(bookings.status, "confirmed"));
    const [todayBookings] = await db.select({ count: count() }).from(bookings).where(tFilter ? and(gte(bookings.createdAt, todayStart), eq(bookings.tenantId, ctx.tenantId!)) : gte(bookings.createdAt, todayStart));
    const [totalPackages] = await db.select({ count: count() }).from(packages).where(tFilter ? eq(packages.tenantId, ctx.tenantId!) : undefined);
    const [activePackages] = await db.select({ count: count() }).from(packages).where(tFilter ? and(eq(packages.status, "active"), eq(packages.tenantId, ctx.tenantId!)) : eq(packages.status, "active"));
    const [newInquiries] = await db.select({ count: count() }).from(inquiries).where(tFilter ? and(eq(inquiries.status, "new"), eq(inquiries.tenantId, ctx.tenantId!)) : eq(inquiries.status, "new"));
    const [inProgressInquiries] = await db.select({ count: count() }).from(inquiries).where(tFilter ? and(eq(inquiries.status, "in_progress"), eq(inquiries.tenantId, ctx.tenantId!)) : eq(inquiries.status, "in_progress"));
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [totalPartners] = tFilter ? [{ count: 0 }] : await db.select({ count: count() }).from(partners);
    const revenueResult = await db.select({
      total: sql<string>`COALESCE(SUM(totalAmount), 0)`
    }).from(bookings).where(tFilter ? and(eq(bookings.paymentStatus, "paid"), eq(bookings.tenantId, ctx.tenantId!)) : eq(bookings.paymentStatus, "paid"));
    const monthRevenueResult = await db.select({
      total: sql<string>`COALESCE(SUM(totalAmount), 0)`
    }).from(bookings).where(tFilter ? and(eq(bookings.paymentStatus, "paid"), gte(bookings.createdAt, monthStart), eq(bookings.tenantId, ctx.tenantId!)) : and(eq(bookings.paymentStatus, "paid"), gte(bookings.createdAt, monthStart)));
    const recentBookings = await db.select().from(bookings).where(tFilter ? eq(bookings.tenantId, ctx.tenantId!) : undefined).orderBy(desc(bookings.createdAt)).limit(5);
    const recentInquiries = await db.select().from(inquiries).where(tFilter ? eq(inquiries.tenantId, ctx.tenantId!) : undefined).orderBy(desc(inquiries.createdAt)).limit(5);
    return {
      totalBookings: totalBookings.count,
      pendingBookings: pendingBookings.count,
      confirmedBookings: confirmedBookings.count,
      todayBookings: todayBookings.count,
      totalPackages: totalPackages.count,
      activePackages: activePackages.count,
      newInquiries: newInquiries.count,
      inProgressInquiries: inProgressInquiries.count,
      totalUsers: totalUsers.count,
      totalPartners: totalPartners.count,
      totalRevenue: Number(revenueResult[0]?.total || 0),
      monthRevenue: Number(monthRevenueResult[0]?.total || 0),
      recentBookings,
      recentInquiries,
    };
  }),
  monthlyRevenue: partnerProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const tFilter = ctx.tenantId !== undefined && ctx.tenantId !== null;
    const baseConditions = [
      eq(bookings.paymentStatus, "paid"),
      gte(bookings.createdAt, new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)),
    ];
    if (tFilter) baseConditions.push(eq(bookings.tenantId, ctx.tenantId!) as any);
    const result = await db.select({
      month: sql<string>`DATE_FORMAT(createdAt, '%Y-%m')`,
      revenue: sql<string>`COALESCE(SUM(totalAmount), 0)`,
      bookingCount: count(),
    }).from(bookings)
      .where(and(...baseConditions))
      .groupBy(sql`DATE_FORMAT(createdAt, '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(createdAt, '%Y-%m')`);
    return result;
  }),
});

const packagesRouter = router({
  list: partnerProcedure.input(z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    status: z.string().optional(),
    country: z.string().optional(),
    search: z.string().optional(),
  })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const offset = (input.page - 1) * input.limit;
    const conditions: any[] = [];
    // tenantId 필터: null이면 전체(마스터), 값이 있으면 해당 파트너 데이터만
    if (ctx.tenantId !== undefined && ctx.tenantId !== null) {
      conditions.push(eq(packages.tenantId, ctx.tenantId));
    }
    if (input.status) conditions.push(eq(packages.status, input.status as any));
    if (input.country) conditions.push(eq(packages.country, input.country));
    if (input.search) conditions.push(like(packages.title, `%${input.search}%`));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await db.select().from(packages).where(whereClause).orderBy(desc(packages.createdAt)).limit(input.limit).offset(offset);
    const [total] = await db.select({ count: count() }).from(packages).where(whereClause);
    return { items, total: total.count };
  }),
  get: partnerProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [pkg] = await db.select().from(packages).where(eq(packages.id, input.id));
    if (!pkg) throw new TRPCError({ code: "NOT_FOUND" });
    const prices = await db.select().from(packagePrices).where(eq(packagePrices.packageId, input.id));
    const options = await db.select().from(packageOptions).where(eq(packageOptions.packageId, input.id));
    const slots = await db.select().from(packageSlots).where(eq(packageSlots.packageId, input.id)).orderBy(packageSlots.departureDate);
    return { ...pkg, prices, options, slots };
  }),
  create: partnerProcedure.input(z.object({
    title: z.string().min(1),
    titleEn: z.string().optional(),
    country: z.string().min(1),
    region: z.string().optional(),
    duration: z.string().optional(),
    roundCount: z.number().default(2),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    status: z.enum(["draft", "active", "inactive", "sold_out"]).default("draft"),
    isFeatured: z.boolean().default(false),
    isPopular: z.boolean().default(false),
    isSpecialDeal: z.boolean().optional(),
    isTrending: z.boolean().optional(),
    courseType: z.enum(["resort", "oceanfront", "mountain", "tropical", "parkland", "links", "desert", "tournament"]).optional(),
    badgeType: z.enum(["none", "best", "exclusive", "new", "limited", "hot"]).optional(),
    departureCities: z.array(z.string()).optional(),
    includesAirfare: z.boolean().optional(),
    includesGreenFee: z.boolean().optional(),
    includesHotel: z.boolean().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // 생성 시 tenantId 자동 주입 (파트너는 자신의 tenantId, 마스터는 null)
    const result = await db.insert(packages).values({ ...input, tenantId: ctx.tenantId ?? null });
    return { id: Number((result as any)[0].insertId) };
  }),
  update: partnerProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    country: z.string().optional(),
    region: z.string().optional(),
    duration: z.string().optional(),
    roundCount: z.number().optional(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    status: z.enum(["draft", "active", "inactive", "sold_out"]).optional(),
    isFeatured: z.boolean().optional(),
    isPopular: z.boolean().optional(),
    isSpecialDeal: z.boolean().optional(),
    isTrending: z.boolean().optional(),
    courseType: z.enum(["resort", "oceanfront", "mountain", "tropical", "parkland", "links", "desert", "tournament"]).optional(),
    badgeType: z.enum(["none", "best", "exclusive", "new", "limited", "hot"]).optional(),
    departureCities: z.array(z.string()).optional(),
    includesAirfare: z.boolean().optional(),
    includesGreenFee: z.boolean().optional(),
    includesHotel: z.boolean().optional(),
    sortOrder: z.number().optional(),
    defaultItinerary: z.array(z.object({
      dayIndex: z.number(),
      dayType: z.string(),
      holeCount: z.number().optional(),
      teeTime: z.string().optional(),
      golfAffiliateId: z.number().optional().nullable(),
      accommodationAffiliateId: z.number().optional().nullable(),
      roomType: z.string().optional(),
      roomCount: z.number().optional(),
      flightInfo: z.any().optional().nullable(),
      notes: z.string().optional(),
    })).optional().nullable(),
    itinerary: z.array(z.object({
      day: z.number(),
      title: z.string(),
      content: z.string(),
      meals: z.array(z.string()).optional(),
    })).optional().nullable(),
    cancellationPolicy: z.string().optional().nullable(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    // 파트너는 자신의 tenantId 상품만 수정 가능
    const whereClause = ctx.tenantId !== null && ctx.tenantId !== undefined
      ? and(eq(packages.id, id), eq(packages.tenantId, ctx.tenantId))
      : eq(packages.id, id);
    await db.update(packages).set(data as any).where(whereClause);
    return { success: true };
  }),
  delete: partnerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // 파트너는 자신의 tenantId 상품만 삭제 가능
    const whereClause = ctx.tenantId !== null && ctx.tenantId !== undefined
      ? and(eq(packages.id, input.id), eq(packages.tenantId, ctx.tenantId))
      : eq(packages.id, input.id);
    await db.delete(packages).where(whereClause);
    return { success: true };
  }),
  addPrice: adminProcedure.input(z.object({
    packageId: z.number(),
    season: z.enum(["peak", "normal", "off"]).default("normal"),
    minPeople: z.number().default(1),
    maxPeople: z.number().default(99),
    pricePerPerson: z.string(),
    singleSupplement: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.insert(packagePrices).values(input);
    return { success: true };
  }),
  deletePrice: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(packagePrices).where(eq(packagePrices.id, input.id));
    return { success: true };
  }),
  addOption: adminProcedure.input(z.object({
    packageId: z.number(),
    optionType: z.enum(["cart", "caddie", "accommodation", "vehicle", "meal", "insurance", "other"]),
    name: z.string(),
    description: z.string().optional(),
    price: z.string().default("0"),
    isIncluded: z.boolean().default(false),
    isRequired: z.boolean().default(false),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.insert(packageOptions).values(input);
    return { success: true };
  }),
  deleteOption: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(packageOptions).where(eq(packageOptions.id, input.id));
    return { success: true };
  }),
  addSlot: adminProcedure.input(z.object({
    packageId: z.number(),
    departureDate: z.date(),
    returnDate: z.date().optional(),
    totalSlots: z.number().default(20),
    minPax: z.number().default(3),
    status: z.enum(["open", "closed", "sold_out"]).default("open"),
    priceOverride: z.string().optional(),
    adultPrice: z.string().optional(),
    adultDepositPrice: z.string().optional(),
    adultAffiliatePrice: z.string().optional(),
    childPrice: z.string().optional(),
    childDepositPrice: z.string().optional(),
    childAffiliatePrice: z.string().optional(),
    infantPrice: z.string().optional(),
    infantDepositPrice: z.string().optional(),
    infantAffiliatePrice: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.insert(packageSlots).values(input);
    return { success: true };
  }),
  // 일괄 슬롯 등록 (날짜 범위 + 요일 패턴)
  addSlotBatch: adminProcedure.input(z.object({
    packageId: z.number(),
    startDate: z.date(),
    endDate: z.date(),
    weekdays: z.array(z.number().min(0).max(6)).optional(), // 0=일, 1=월, ..., 6=토
    nights: z.number().default(1),
    totalSlots: z.number().default(20),
    minPax: z.number().default(3),
    adultPrice: z.string().optional(),
    adultDepositPrice: z.string().optional(),
    adultAffiliatePrice: z.string().optional(),
    childPrice: z.string().optional(),
    childDepositPrice: z.string().optional(),
    childAffiliatePrice: z.string().optional(),
    infantPrice: z.string().optional(),
    infantDepositPrice: z.string().optional(),
    infantAffiliatePrice: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { startDate, endDate, weekdays, nights, ...slotBase } = input;
    const dates: Date[] = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const dow = cur.getDay();
      if (!weekdays || weekdays.length === 0 || weekdays.includes(dow)) {
        dates.push(new Date(cur));
      }
      cur.setDate(cur.getDate() + 1);
    }
    if (dates.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: '조건에 맞는 날짜가 없습니다.' });
    for (const d of dates) {
      const returnDate = new Date(d);
      returnDate.setDate(returnDate.getDate() + nights);
      await db.insert(packageSlots).values({
        ...slotBase,
        departureDate: d,
        returnDate,
        status: 'open',
      });
    }
    return { success: true, count: dates.length };
  }),
  // 슬롯 수정
  updateSlot: adminProcedure.input(z.object({
    id: z.number(),
    totalSlots: z.number().optional(),
    minPax: z.number().optional(),
    status: z.enum(["open", "closed", "sold_out"]).optional(),
    priceOverride: z.string().optional(),
    adultPrice: z.string().optional(),
    adultDepositPrice: z.string().optional(),
    adultAffiliatePrice: z.string().optional(),
    childPrice: z.string().optional(),
    childDepositPrice: z.string().optional(),
    childAffiliatePrice: z.string().optional(),
    infantPrice: z.string().optional(),
    infantDepositPrice: z.string().optional(),
    infantAffiliatePrice: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    await db.update(packageSlots).set(data).where(eq(packageSlots.id, id));
    return { success: true };
  }),
  deleteSlot: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(packageSlots).where(eq(packageSlots.id, input.id));
    return { success: true };
  }),
  publicList: publicProcedure.input(z.object({
    country: z.string().optional(),
    featured: z.boolean().optional(),
    popular: z.boolean().optional(),
    trending: z.boolean().optional(),
    specialDeal: z.boolean().optional(),
    courseType: z.string().optional(),
    search: z.string().optional(),
    limit: z.number().default(12),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { items: [] };
    const conditions: any[] = [eq(packages.status, "active")];
    if (input.country) conditions.push(eq(packages.country, input.country));
    if (input.featured) conditions.push(eq(packages.isFeatured, true));
    if (input.popular) conditions.push(eq(packages.isPopular, true));
    if (input.trending) conditions.push(eq(packages.isTrending, true));
    if (input.specialDeal) conditions.push(eq(packages.isSpecialDeal, true));
    if (input.courseType) conditions.push(eq(packages.courseType, input.courseType as any));
    if (input.search) conditions.push(like(packages.title, `%${input.search}%`));
    const items = await db.select().from(packages).where(and(...conditions)).orderBy(packages.sortOrder, desc(packages.createdAt)).limit(input.limit);
    // 오늘 날짜 (자정 기준)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 각 상품의 최저가 조회 (오늘 이후 슬롯 기준)
    const itemsWithPrice = await Promise.all(
      items.map(async (item) => {
        // 오늘 이후 오픈 슬롯 조회
        const futureSlots = await db.select({ departureDate: packageSlots.departureDate, priceOverride: packageSlots.priceOverride })
          .from(packageSlots)
          .where(and(
            eq(packageSlots.packageId, item.id),
            eq(packageSlots.status, "open"),
            gte(packageSlots.departureDate, today)
          ))
          .orderBy(packageSlots.departureDate)
          .limit(1);
        const hasFutureSlots = futureSlots.length > 0;
        // 슬롯 priceOverride 있으면 우선, 없으면 packagePrices 기준
        let minPrice: number | null = null;
        if (hasFutureSlots && futureSlots[0].priceOverride) {
          minPrice = Number(futureSlots[0].priceOverride);
        } else {
          const prices = await db.select({ price: packagePrices.pricePerPerson })
            .from(packagePrices)
            .where(eq(packagePrices.packageId, item.id));
          minPrice = prices.length > 0
            ? Math.min(...prices.map((p) => Number(p.price)))
            : null;
        }
        return { ...item, minPrice, hasFutureSlots };
      })
    );
    // 미래 출발일 있는 상품 우선, 없는 상품 후순위
    itemsWithPrice.sort((a, b) => {
      if (a.hasFutureSlots && !b.hasFutureSlots) return -1;
      if (!a.hasFutureSlots && b.hasFutureSlots) return 1;
      return 0;
    });
    return { items: itemsWithPrice };
  }),
  publicGet: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [pkg] = await db.select().from(packages).where(and(eq(packages.id, input.id), eq(packages.status, "active")));
    if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "상품을 찾을 수 없습니다." });
    const prices = await db.select().from(packagePrices).where(eq(packagePrices.packageId, input.id));
    const options = await db.select().from(packageOptions).where(eq(packageOptions.packageId, input.id));
    // 오늘 이후 오픈 슬롯만 반환
    const todayForSlots = new Date();
    todayForSlots.setHours(0, 0, 0, 0);
    const slots = await db.select().from(packageSlots)
      .where(and(
        eq(packageSlots.packageId, input.id),
        eq(packageSlots.status, "open"),
        gte(packageSlots.departureDate, todayForSlots)
      ))
      .orderBy(packageSlots.departureDate);
    // increment view count
    await db.update(packages).set({ viewCount: sql`viewCount + 1` }).where(eq(packages.id, input.id));
    // 이미지 목록도 함께 반환
    const images = await db.select().from(packageImages)
      .where(eq(packageImages.packageId, input.id))
      .orderBy(asc(packageImages.sortOrder), asc(packageImages.id));
    return { ...pkg, prices, options, slots, images };
  }),

  // 이미지 목록 조회
  listImages: adminProcedure.input(z.object({ packageId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(packageImages)
      .where(eq(packageImages.packageId, input.packageId))
      .orderBy(asc(packageImages.sortOrder), asc(packageImages.id));
  }),

  // 이미지 업로드 (base64 → S3 저장)
  uploadImage: adminProcedure.input(z.object({
    packageId: z.number(),
    fileName: z.string(),
    mimeType: z.string(),
    base64Data: z.string(), // base64 인코딩된 이미지 데이터
    altText: z.string().optional(),
    isCover: z.boolean().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // base64 → Buffer 변환 후 최적화 (1200x800, WebP, 500KB 이하)
    const { buffer: optimizedBuffer, mimeType: optimizedMime } = await optimizeBase64Image(input.base64Data);
    // S3 업로드 (WebP로 변환됨)
    const baseName = input.fileName.replace(/\.[^.]+$/, '');
    const key = `packages/${input.packageId}/${Date.now()}_${baseName}.webp`;
    const { url, key: savedKey } = await storagePut(key, optimizedBuffer, optimizedMime);
    // 현재 이미지 수 조회 (sortOrder 결정)
    const [{ cnt }] = await db.select({ cnt: count() }).from(packageImages).where(eq(packageImages.packageId, input.packageId));
    const sortOrder = Number(cnt);
    // isCover=true이면 기존 커버 해제
    if (input.isCover) {
      await db.update(packageImages).set({ isCover: false }).where(eq(packageImages.packageId, input.packageId));
    }
    // DB 저장
    await db.insert(packageImages).values({
      packageId: input.packageId,
      imageUrl: url,
      imageKey: savedKey,
      altText: input.altText ?? null,
      sortOrder,
      isCover: input.isCover ?? sortOrder === 0,
    });
    // 첫 번째 이미지이면 packages.imageUrl도 업데이트
    if (sortOrder === 0) {
      await db.update(packages).set({ imageUrl: url }).where(eq(packages.id, input.packageId));
    }
    return { url, key: savedKey };
  }),

  // 이미지 삭제
  deleteImage: adminProcedure.input(z.object({ imageId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [img] = await db.select().from(packageImages).where(eq(packageImages.id, input.imageId));
    if (!img) throw new TRPCError({ code: "NOT_FOUND" });
    await db.delete(packageImages).where(eq(packageImages.id, input.imageId));
    // 삭제된 이미지가 커버였으면 첫 번째 이미지를 커버로 설정
    if (img.isCover) {
      const remaining = await db.select().from(packageImages)
        .where(eq(packageImages.packageId, img.packageId))
        .orderBy(asc(packageImages.sortOrder)).limit(1);
      if (remaining.length > 0) {
        await db.update(packageImages).set({ isCover: true }).where(eq(packageImages.id, remaining[0].id));
        await db.update(packages).set({ imageUrl: remaining[0].imageUrl }).where(eq(packages.id, img.packageId));
      } else {
        await db.update(packages).set({ imageUrl: null }).where(eq(packages.id, img.packageId));
      }
    }
    return { success: true };
  }),

  // 커버 이미지 변경
  setCover: adminProcedure.input(z.object({ imageId: z.number(), packageId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(packageImages).set({ isCover: false }).where(eq(packageImages.packageId, input.packageId));
    await db.update(packageImages).set({ isCover: true }).where(eq(packageImages.id, input.imageId));
    const [img] = await db.select().from(packageImages).where(eq(packageImages.id, input.imageId));
    if (img) await db.update(packages).set({ imageUrl: img.imageUrl }).where(eq(packages.id, input.packageId));
    return { success: true };
  }),

  // 이미지 순서 변경
  reorderImages: adminProcedure.input(z.object({
    packageId: z.number(),
    orderedIds: z.array(z.number()),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await Promise.all(
      input.orderedIds.map((id, idx) =>
        db.update(packageImages).set({ sortOrder: idx }).where(eq(packageImages.id, id))
      )
    );
    // 첫 번째 이미지를 커버로 동기화 (홈페이지 대표 이미지 업데이트)
    if (input.orderedIds.length > 0) {
      const [firstImg] = await db.select().from(packageImages).where(eq(packageImages.id, input.orderedIds[0]));
      if (firstImg) {
        await db.update(packageImages).set({ isCover: false }).where(eq(packageImages.packageId, input.packageId));
        await db.update(packageImages).set({ isCover: true }).where(eq(packageImages.id, input.orderedIds[0]));
        await db.update(packages).set({ imageUrl: firstImg.imageUrl }).where(eq(packages.id, input.packageId));
      }
    }
    return { success: true };
  }),

  // Pixabay 이미지 검색 (미리보기용 - 저장하지 않음)
  searchPixabay: adminProcedure.input(z.object({
    query: z.string(),
    page: z.number().default(1),
    perPage: z.number().default(12),
  })).query(async ({ input }) => {
    if (!ENV.pixabayApiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Pixabay API 키가 설정되지 않았습니다." });
    const q = encodeURIComponent(input.query);
    const url = `https://pixabay.com/api/?key=${ENV.pixabayApiKey}&q=${q}&image_type=photo&orientation=horizontal&category=travel&per_page=${input.perPage}&page=${input.page}&safesearch=true&lang=ko`;
    const res = await fetch(url);
    if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Pixabay 검색 실패" });
    const data = await res.json() as { totalHits: number; hits: Array<{ id: number; webformatURL: string; largeImageURL: string; tags: string; user: string; pageURL: string }> };
    return {
      total: data.totalHits,
      images: data.hits.map(h => ({
        id: h.id,
        previewUrl: h.webformatURL,
        fullUrl: h.largeImageURL,
        tags: h.tags,
        author: h.user,
        pageUrl: h.pageURL,
        license: 'Pixabay License (상업적 무료 사용 가능)',
      }))
    };
  }),

  // Pixabay 이미지 가져와서 최적화 후 S3 저장
  importPixabayImage: adminProcedure.input(z.object({
    packageId: z.number(),
    imageUrl: z.string(),
    altText: z.string().optional(),
    isCover: z.boolean().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // URL에서 이미지 다운로드 후 최적화
    const { buffer, mimeType } = await optimizeImage(input.imageUrl);
    const key = `packages/${input.packageId}/pixabay_${Date.now()}.webp`;
    const { url, key: savedKey } = await storagePut(key, buffer, mimeType);
    const [{ cnt }] = await db.select({ cnt: count() }).from(packageImages).where(eq(packageImages.packageId, input.packageId));
    const sortOrder = Number(cnt);
    if (input.isCover) {
      await db.update(packageImages).set({ isCover: false }).where(eq(packageImages.packageId, input.packageId));
    }
    await db.insert(packageImages).values({
      packageId: input.packageId,
      imageUrl: url,
      imageKey: savedKey,
      altText: input.altText ?? 'Pixabay 이미지',
      sortOrder,
      isCover: input.isCover ?? sortOrder === 0,
    });
    if (sortOrder === 0) {
      await db.update(packages).set({ imageUrl: url }).where(eq(packages.id, input.packageId));
    }
    return { url, key: savedKey };
  }),

  // AI 이미지 자동생성 (상품명 기반 프롬프트)
  generateAIImage: adminProcedure.input(z.object({
    packageId: z.number(),
    packageTitle: z.string(),
    country: z.string().optional(),
    region: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    isCover: z.boolean().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // 상품명 기반 영문 프롬프트 생성
    const countryMap: Record<string, string> = {
      '대한민국': 'South Korea', '태국': 'Thailand', '베트남': 'Vietnam',
      '필리핀': 'Philippines', '중국': 'China', '일본': 'Japan',
    };
    const countryEn = input.country ? (countryMap[input.country] ?? input.country) : 'Asia';
    const regionEn = input.region ?? '';
    // 키워드가 있으면 프롬프트에 추가
    const keywordStr = input.keywords && input.keywords.length > 0
      ? `, ${input.keywords.join(', ')}`
      : '';
    const prompt = `Luxury golf course in ${regionEn} ${countryEn}, beautiful green fairway, blue sky, professional golf photography, wide angle panoramic view, high quality travel brochure style, 4K ultra HD, no people, serene atmosphere${keywordStr}`;
    let storageUrl: string;
    try {
      const result = await generateImage({ prompt });
      if (!result.url) throw new Error('이미지 URL이 비어있습니다');
      storageUrl = result.url;
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      let userMsg = rawMsg;
      if (rawMsg.includes('usage exhausted') || rawMsg.includes('usage_exhausted')) {
        userMsg = 'AI 이미지 생성 한도를 초과했습니다. 잠시 후 다시 시도하거나 Pixabay 검색을 이용해 주세요.';
      } else if (rawMsg.includes('400') || rawMsg.includes('failed_precondition')) {
        userMsg = 'AI 이미지 생성 서비스에 문제가 발생했습니다. Pixabay 검색을 대신 이용해 주세요.';
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: userMsg });
    }
    // generateImage가 이미 S3에 저장하므로 중복 저장 안 함
    // storageUrl = /manus-storage/{key} 형식
    const savedKey = storageUrl.replace(/^\/manus-storage\//, '');
    const url = storageUrl;
    const [{ cnt }] = await db.select({ cnt: count() }).from(packageImages).where(eq(packageImages.packageId, input.packageId));
    const sortOrder = Number(cnt);
    if (input.isCover) {
      await db.update(packageImages).set({ isCover: false }).where(eq(packageImages.packageId, input.packageId));
    }
    await db.insert(packageImages).values({
      packageId: input.packageId,
      imageUrl: url,
      imageKey: savedKey,
      altText: `AI 생성: ${input.packageTitle}`,
      sortOrder,
      isCover: input.isCover ?? sortOrder === 0,
    });
    if (sortOrder === 0) {
      await db.update(packages).set({ imageUrl: url }).where(eq(packages.id, input.packageId));
    }
    return { url, key: savedKey, prompt };
  }),

  // AI 이미지 다중 생성 (미리보기용 - DB 저장 안 함, 임시 URL 반환)
  generateAIImages: adminProcedure.input(z.object({
    packageId: z.number(),
    packageTitle: z.string(),
    country: z.string().optional(),
    region: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    count: z.number().min(1).max(4).default(3),
  })).mutation(async ({ input }) => {
    const countryMap: Record<string, string> = {
      '대한민국': 'South Korea', '태국': 'Thailand', '베트남': 'Vietnam',
      '필리핀': 'Philippines', '중국': 'China', '일본': 'Japan',
    };
    const countryEn = input.country ? (countryMap[input.country] ?? input.country) : 'Asia';
    const regionEn = input.region ?? '';
    const keywordStr = input.keywords && input.keywords.length > 0
      ? `, ${input.keywords.join(', ')}`
      : '';
    // 장수만큼 병렬 생성 (각각 약간 다른 프롬프트 변형)
    const promptVariants = [
      `Luxury golf course in ${regionEn} ${countryEn}, beautiful green fairway, blue sky, professional golf photography, wide angle panoramic view, high quality travel brochure style, 4K ultra HD, no people, serene atmosphere${keywordStr}`,
      `Premium golf resort in ${regionEn} ${countryEn}, lush green course, golden hour lighting, aerial view, elegant clubhouse, travel magazine cover quality, ultra realistic${keywordStr}`,
      `Scenic golf course in ${regionEn} ${countryEn}, morning mist over fairway, dramatic landscape, professional sports photography, vibrant colors, luxury travel destination${keywordStr}`,
      `Golf course in ${regionEn} ${countryEn}, sunset panorama, manicured greens, water hazard reflection, cinematic photography, premium travel brochure${keywordStr}`,
    ];
    const selectedPrompts = promptVariants.slice(0, input.count);
    // 순차 생성 - 병렬 시 서버 부하 및 타임아웃 문제 방지
    const images: { url: string; key: string; storageUrl: string; prompt: string }[] = [];
    const errors: string[] = [];
    for (let i = 0; i < selectedPrompts.length; i++) {
      const prompt = selectedPrompts[i];
      try {
        console.log(`[AI Image] 생성 시작 ${i + 1}/${selectedPrompts.length}`);
        const { url: storageUrl } = await generateImage({ prompt });
        if (!storageUrl) throw new Error('이미지 URL이 비어있습니다');
        // storageUrl은 /manus-storage/{key} 형식이므로 key 추출
        const key = storageUrl.replace(/^\/manus-storage\//, '');
        // 프론트에서 이미지 표시를 위해 presigned URL 반환
        const signedUrl = await storageGetSignedUrl(key);
        images.push({ url: signedUrl, key, storageUrl, prompt });
        console.log(`[AI Image] 생성 완료 ${i + 1}/${selectedPrompts.length}: ${storageUrl}`);
      } catch (err) {
        const rawMsg = err instanceof Error ? err.message : String(err);
        // 사용량 초과 에러 사용자 친화적 메시지로 변환
        let msg = rawMsg;
        if (rawMsg.includes('usage exhausted') || rawMsg.includes('usage_exhausted')) {
          msg = 'AI 이미지 생성 한도를 초과했습니다. 잠시 후 다시 시도하거나 Pixabay 검색을 이용해 주세요.';
        } else if (rawMsg.includes('quota') || rawMsg.includes('rate limit') || rawMsg.includes('429')) {
          msg = 'AI 이미지 생성 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
        } else if (rawMsg.includes('400') || rawMsg.includes('failed_precondition')) {
          msg = 'AI 이미지 생성 서비스에 문제가 발생했습니다. Pixabay 검색을 대신 이용해 주세요.';
        }
        console.error(`[AI Image] 생성 실패 ${i + 1}/${selectedPrompts.length}:`, rawMsg);
        errors.push(msg);
      }
    }
    if (images.length === 0) {
      const reason = errors.length > 0 ? errors[0] : '알 수 없는 오류';
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `이미지 생성에 실패했습니다: ${reason}` });
    }
    return { images };
  }),

  // 선택한 AI 이미지를 상품 이미지로 등록 (DB 저장)
  saveSelectedAIImages: adminProcedure.input(z.object({
    packageId: z.number(),
    packageTitle: z.string(),
    selectedImages: z.array(z.object({
      storageUrl: z.string(), // /manus-storage/{key} 형식 - DB에 저장할 URL
      key: z.string(),
    })),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    const [{ cnt }] = await db.select({ cnt: count() }).from(packageImages).where(eq(packageImages.packageId, input.packageId));
    let sortOrder = Number(cnt);
    for (const img of input.selectedImages) {
      await db.insert(packageImages).values({
        packageId: input.packageId,
        imageUrl: img.storageUrl, // presigned URL 아닌 /manus-storage/ 경로 저장
        imageKey: img.key,
        altText: `AI 생성: ${input.packageTitle}`,
        sortOrder,
        isCover: sortOrder === 0,
      });
      if (sortOrder === 0) {
        await db.update(packages).set({ imageUrl: img.storageUrl }).where(eq(packages.id, input.packageId));
      }
      sortOrder++;
    }
    return { saved: input.selectedImages.length };
  }),

  // 이미지 공개 조회 (프론트용)
  publicImages: publicProcedure.input(z.object({ packageId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(packageImages)
      .where(eq(packageImages.packageId, input.packageId))
      .orderBy(asc(packageImages.sortOrder), asc(packageImages.id));
  }),
});

const bookingsRouter = router({
  list: partnerProcedure.input(z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    status: z.string().optional(),
    search: z.string().optional(),
  })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const offset = (input.page - 1) * input.limit;

    // ─── bookings 테이블 조회 ──────────────────────────────────────────────────────
    const bookingConditions: any[] = [];
    // tenantId 필터: 파트너는 자신의 데이터만
    if (ctx.tenantId !== undefined && ctx.tenantId !== null) {
      bookingConditions.push(eq(bookings.tenantId, ctx.tenantId));
    }
    if (input.status) bookingConditions.push(eq(bookings.status, input.status as any));
    if (input.search) bookingConditions.push(like(bookings.leaderName, `%${input.search}%`));
    const bookingWhereClause = bookingConditions.length > 0 ? and(...bookingConditions) : undefined;
    const bookingItems = await db.select().from(bookings).where(bookingWhereClause).orderBy(desc(bookings.createdAt));
    const bookingTotal = await db.select({ count: count() }).from(bookings).where(bookingWhereClause);

    // ─── reservations 확정 데이터 통합 ─────────────────────────
    // reservations 테이블의 confirmed 상태 데이터를 bookings 형식으로 변환하여 통합
    const resConditions: any[] = [eq(reservations.status, "confirmed")];
    // [테넌트 격리 버그 수정] 특정 테넌트 컨텍스트면 reservations 통합도 자사 데이터로 제한
    if (ctx.tenantId !== undefined && ctx.tenantId !== null) {
      resConditions.push(eq(reservations.tenantId, ctx.tenantId));
    }
    if (input.status && input.status !== "confirmed") {
      // 다른 상태 필터 시 reservations는 포함하지 않음
    } else {
      if (input.search) resConditions.push(like(reservations.customerName, `%${input.search}%`));
    }
    let reservationItems: any[] = [];
    if (!input.status || input.status === "confirmed") {
      const rawResItems = await db.select().from(reservations).where(
        resConditions.length > 1 ? and(...resConditions) : resConditions[0]
      ).orderBy(desc(reservations.createdAt));
      // reservations → bookings 형식으로 변환 (source: 'reservation' 표시)
      reservationItems = rawResItems.map((r) => ({
        id: r.id,
        bookingNumber: r.reservationNo,
        packageId: 0,
        slotId: null,
        userId: null,
        leaderName: r.customerName,
        leaderPhone: r.customerPhone ?? "",
        leaderEmail: r.customerEmail ?? null,
        adultCount: r.headcount ?? 1,
        childCount: 0,
        totalPeople: r.headcount ?? 1,
        departureDate: r.departureDate,
        returnDate: null,
        selectedOptions: null,
        roundCount: r.teams ?? 1,
        cartIncluded: false,
        caddieIncluded: false,
        basePrice: String(r.salePriceTotal ?? 0),
        optionPrice: "0",
        discountAmount: "0",
        totalAmount: String(r.salePriceTotal ?? 0),
        paidAmount: String(r.paidAmount ?? 0),
        status: r.status,
        paymentStatus: r.paymentStatus === "paid" ? "paid" : r.paymentStatus === "partial" ? "partial" : "unpaid",
        customerMemo: r.notes ?? null,
        adminMemo: r.agentName ?? null,
        cancelReason: null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        // 수기예약 구분 필드
        _source: "reservation" as const,
        _productName: r.productName,
        _golfCourseName: r.golfCourseName,
        _assignedTo: r.assignedTo,
        _teams: r.teams,
      }));
    }

    // 통합 후 정렬 및 페이지네이션
    const allItems = [
      ...bookingItems.map(b => ({ ...b, _source: "booking" as const })),
      ...reservationItems,
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = allItems.length;
    const items = allItems.slice(offset, offset + input.limit);

    return { items, total };
  }),
  get: partnerProcedure.input(z.object({ id: z.number(), source: z.enum(["booking", "reservation"]).optional() })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // 수기 예약(reservation)인 경우 reservations 테이블에서 조회
    if (input.source === "reservation") {
      const [res] = await db.select().from(reservations).where(eq(reservations.id, input.id));
      if (!res) throw new TRPCError({ code: "NOT_FOUND" });
      // [테넌트 격리] 특정 테넌트 컨텍스트는 자사 예약만
      if (ctx.tenantId != null && res.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 예약은 조회할 수 없습니다." });
      }
      return {
        id: res.id,
        bookingNumber: res.reservationNo,
        packageId: 0,
        slotId: null,
        userId: null,
        leaderName: res.customerName,
        leaderPhone: res.customerPhone ?? "",
        leaderEmail: res.customerEmail ?? null,
        adultCount: res.headcount ?? 1,
        childCount: 0,
        totalPeople: res.headcount ?? 1,
        departureDate: res.departureDate,
        returnDate: null,
        selectedOptions: null,
        roundCount: res.teams ?? 1,
        cartIncluded: false,
        caddieIncluded: false,
        basePrice: String(res.salePricePerPerson ?? 0),
        optionPrice: "0",
        discountAmount: "0",
        totalAmount: String(res.salePriceTotal ?? 0),
        paidAmount: String(res.paidAmount ?? 0),
        status: res.status,
        paymentStatus: (res.paymentStatus === "paid" ? "paid" : res.paymentStatus === "partial" ? "partial" : "unpaid") as "paid" | "partial" | "unpaid",
        customerMemo: res.notes ?? null,
        adminMemo: res.agentName ?? null,
        cancelReason: null,
        createdAt: res.createdAt,
        updatedAt: res.updatedAt,
        travelers: [] as any[],
        package: null as any,
        _source: "reservation" as const,
        _productName: res.productName,
        _golfCourseName: res.golfCourseName,
        _assignedTo: res.assignedTo,
        _teams: res.teams,
        _nights: res.nights,
        _salePricePerPerson: res.salePricePerPerson,
        _depositPrice: res.depositPrice,
        _extraFee: res.extraFee,
        _profit: res.profit,
        _remittedAmount: res.remittedAmount,
        _userType: res.userType,
        _partnerId: res.partnerId,
        _partnerCompanyName: res.partnerCompanyName,
        _partnerContactName: res.partnerContactName,
        _partnerContactPhone: res.partnerContactPhone,
        _managerName: res.managerName,
        _managerPhone: res.managerPhone,
        _progressStatus: res.progressStatus,
        _affiliateId: res.affiliateId,
      };
    }

    // 일반 예약: bookings 테이블에서 조회
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.id));
    if (!booking) throw new TRPCError({ code: "NOT_FOUND" });
    // [테넌트 격리] 특정 테넌트 컨텍스트는 자사 예약만
    if (ctx.tenantId != null && booking.tenantId !== ctx.tenantId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "다른 업체의 예약은 조회할 수 없습니다." });
    }
    const travelersData = await db.select().from(travelers).where(eq(travelers.bookingId, input.id));
    const [pkg] = await db.select().from(packages).where(eq(packages.id, booking.packageId));
    return { ...booking, travelers: travelersData, package: pkg, _source: "booking" as const };
  }),
  updateStatus: partnerProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
    adminMemo: z.string().optional(),
    cancelReason: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    await db.update(bookings).set(data).where(eq(bookings.id, id));

    // 카카오 알림톡 자동 발송 (확정/취소 시)
    if (input.status === "confirmed" || input.status === "cancelled") {
      try {
        const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
        const [pkg] = booking?.packageId
          ? await db.select().from(packages).where(eq(packages.id, booking.packageId))
          : [undefined];
        if (booking?.leaderPhone) {
          const messageType = input.status === "confirmed" ? "booking_confirmed" : "booking_cancelled";
          let kakaoResult;
          if (input.status === "confirmed") {
            kakaoResult = await sendBookingConfirmedNotification({
              phone: booking.leaderPhone,
              customerName: booking.leaderName,
              bookingNumber: booking.bookingNumber,
              packageTitle: pkg?.title ?? "알 수 없음",
              departureDate: booking.departureDate
                ? new Date(booking.departureDate).toLocaleDateString("ko-KR")
                : "예정",
              totalAmount: booking.totalAmount?.toString() ?? "0",
              totalPeople: (booking.adultCount ?? 0) + (booking.childCount ?? 0),
            });
          } else {
            kakaoResult = await sendBookingCancelledNotification({
              phone: booking.leaderPhone,
              customerName: booking.leaderName,
              bookingNumber: booking.bookingNumber,
              packageTitle: pkg?.title ?? "알 수 없음",
              cancelReason: input.cancelReason,
            });
          }
          // 알림톡 발송 이력 저장
          await db.insert(kakaoNotifications).values({
            bookingId: id,
            recipientPhone: booking.leaderPhone,
            templateCode: input.status === "confirmed" ? "DOGOLF_BOOKING_CONFIRMED" : "DOGOLF_BOOKING_CANCELLED",
            messageType,
            status: kakaoResult.success ? "sent" : "failed",
            errorMessage: kakaoResult.error,
            sentAt: kakaoResult.success ? new Date() : undefined,
          });
        }
      } catch (kakaoErr) {
        console.error("[Kakao] 알림톡 발송 실패:", kakaoErr);
        // 알림톡 실패는 예약 상태 변경을 실패시키지 않음
      }
    }
    return { success: true };
  }),
  /** D-1 알림톡 스케줄러용: 내일 출발 예약 목록 조회 */
  getDepartureTomorrow: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
    const results = await db.select({
      bookingId: bookings.id,
      bookingNumber: bookings.bookingNumber,
      customerName: bookings.leaderName,
      customerPhone: bookings.leaderPhone,
      departureDate: bookings.departureDate,
      adultCount: bookings.adultCount,
      childCount: bookings.childCount,
      packageTitle: packages.title,
    })
    .from(bookings)
    .leftJoin(packages, eq(bookings.packageId, packages.id))
    .where(
      and(
        eq(bookings.status, "confirmed"),
        sql`DATE(${bookings.departureDate}) = ${tomorrowStr}`
      )
    );
    return results.map(r => ({
      ...r,
      totalPeople: (r.adultCount ?? 0) + (r.childCount ?? 0),
    }));
  }),

  createInquiry: publicProcedure.input(z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email().optional().or(z.literal("")),
    packageId: z.number().optional(),
    packageName: z.string().optional(),
    travelDate: z.string().optional(),
    peopleCount: z.number().optional(),
    message: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const data = { ...input, email: input.email || undefined };
    await db.insert(inquiries).values(data);
    return { success: true };
  }),
});

const settlementsRouter = router({
  list: partnerProcedure.input(z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    status: z.string().optional(),
  })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const offset = (input.page - 1) * input.limit;
    const conditions: any[] = [];
    // tenantId 필터: 파트너는 자신의 정산만
    if (ctx.tenantId !== undefined && ctx.tenantId !== null) {
      conditions.push(eq(settlements.tenantId, ctx.tenantId));
    }
    if (input.status) conditions.push(eq(settlements.status, input.status as any));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await db.select().from(settlements).where(whereClause).orderBy(desc(settlements.createdAt)).limit(input.limit).offset(offset);
    const [total] = await db.select({ count: count() }).from(settlements).where(whereClause);
    const summaryResult = await db.select({
      totalAmount: sql<string>`COALESCE(SUM(amount), 0)`,
      paidAmount: sql<string>`COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)`,
      pendingAmount: sql<string>`COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)`,
    }).from(settlements).where(whereClause);
    return { items, total: total.count, summary: summaryResult[0] };
  }),
  updateStatus: partnerProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["pending", "paid", "overdue"]),
    paidDate: z.date().optional(),
    memo: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    await db.update(settlements).set(data).where(eq(settlements.id, id));
    return { success: true };
  }),
  supplierSummary: partnerProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const tenantFilter = ctx.tenantId !== undefined && ctx.tenantId !== null
      ? eq(settlements.tenantId, ctx.tenantId) : undefined;
    return db.select({
      supplierName: settlements.supplierName,
      supplierType: settlements.supplierType,
      totalAmount: sql<string>`COALESCE(SUM(amount), 0)`,
      paidAmount: sql<string>`COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)`,
      pendingAmount: sql<string>`COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)`,
      cnt: count(),
    }).from(settlements).where(tenantFilter).groupBy(settlements.supplierName, settlements.supplierType).orderBy(desc(sql`SUM(amount)`));
  }),
});

const inquiriesRouter = router({
  list: partnerProcedure.input(z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    status: z.string().optional(),
    search: z.string().optional(),
  })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const offset = (input.page - 1) * input.limit;
    const conditions: any[] = [];
    // tenantId 필터: 파트너는 자신의 문의만
    if (ctx.tenantId !== undefined && ctx.tenantId !== null) {
      conditions.push(eq(inquiries.tenantId, ctx.tenantId));
    }
    if (input.status) conditions.push(eq(inquiries.status, input.status as any));
    if (input.search) {
      // 이름 또는 연락처(phone) 일부 번호로 검색
      conditions.push(
        sql`(${inquiries.name} LIKE ${`%${input.search}%`} OR ${inquiries.phone} LIKE ${`%${input.search}%`})`
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await db.select().from(inquiries).where(whereClause).orderBy(desc(inquiries.createdAt)).limit(input.limit).offset(offset);
    const [total] = await db.select({ count: count() }).from(inquiries).where(whereClause);
    return { items, total: total.count };
  }),
  reply: partnerProcedure.input(z.object({
    id: z.number(),
    adminReply: z.string().min(1),
    status: z.enum(["new", "in_progress", "replied", "closed"]).default("replied"),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(inquiries).set({ adminReply: input.adminReply, status: input.status, repliedAt: new Date() }).where(eq(inquiries.id, input.id));
    return { success: true };
  }),
  updateStatus: partnerProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["new", "in_progress", "replied", "closed"]),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(inquiries).set({ status: input.status }).where(eq(inquiries.id, input.id));
    return { success: true };
  }),
});

const cmsRouter = router({
  listNotices: adminProcedure.input(z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    category: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const offset = (input.page - 1) * input.limit;
    const conditions: any[] = [];
    if (input.category) conditions.push(eq(notices.category, input.category as any));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await db.select().from(notices).where(whereClause).orderBy(desc(notices.createdAt)).limit(input.limit).offset(offset);
    const [total] = await db.select({ count: count() }).from(notices).where(whereClause);
    return { items, total: total.count };
  }),
  createNotice: adminProcedure.input(z.object({
    category: z.enum(["notice", "event", "new_product", "tip"]).default("notice"),
    title: z.string().min(1),
    content: z.string().optional(),
    isImportant: z.boolean().default(false),
    isPublished: z.boolean().default(true),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.insert(notices).values(input);
    return { success: true };
  }),
  updateNotice: adminProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    content: z.string().optional(),
    isImportant: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    category: z.enum(["notice", "event", "new_product", "tip"]).optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    await db.update(notices).set(data).where(eq(notices.id, id));
    return { success: true };
  }),
  deleteNotice: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(notices).where(eq(notices.id, input.id));
    return { success: true };
  }),
  listBanners: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(banners).orderBy(banners.sortOrder);
  }),
  createBanner: adminProcedure.input(z.object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    imageUrl: z.string().min(1),
    linkUrl: z.string().optional(),
    isActive: z.boolean().default(true),
    sortOrder: z.number().default(0),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.insert(banners).values(input);
    return { success: true };
  }),
  updateBanner: adminProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    await db.update(banners).set(data).where(eq(banners.id, id));
    return { success: true };
  }),
  deleteBanner: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(banners).where(eq(banners.id, input.id));
    return { success: true };
  }),
  publicNotices: publicProcedure.input(z.object({ limit: z.number().default(10) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(notices).where(eq(notices.isPublished, true)).orderBy(desc(notices.createdAt)).limit(input.limit);
  }),
  publicBanners: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(banners).where(eq(banners.isActive, true)).orderBy(banners.sortOrder);
  }),
  // 배너 이미지 직접 업로드 (base64 방식)
  uploadBannerImage: adminProcedure.input(z.object({
    bannerId: z.number().optional(), // 업로드 후 배너 ID 업데이트
    fileName: z.string(),
    mimeType: z.string(),
    base64Data: z.string(),
  })).mutation(async ({ input }) => {
    const { buffer: optimizedBuffer, mimeType: optimizedMime } = await optimizeBase64Image(input.base64Data);
    const key = `banners/${Date.now()}_${input.fileName.replace(/\.[^.]+$/, '')}.webp`;
    const { url } = await storagePut(key, optimizedBuffer, optimizedMime);
    if (input.bannerId) {
      const db = await getDb();
      if (db) await db.update(banners).set({ imageUrl: url }).where(eq(banners.id, input.bannerId));
    }
    return { url };
  }),
  // 배너 AI 이미지 생성
  generateBannerImage: adminProcedure.input(z.object({
    bannerId: z.number().optional(),
    country: z.string().optional(),
    region: z.string().optional(),
    customPrompt: z.string().optional(),
  })).mutation(async ({ input }) => {
    const countryMap: Record<string, string> = {
      'korea': 'South Korea', 'thailand': 'Thailand', 'vietnam': 'Vietnam',
      'philippines': 'Philippines', 'china': 'China', 'japan': 'Japan',
    };
    const countryEn = input.country ? (countryMap[input.country] ?? input.country) : 'Asia';
    const regionEn = input.region ?? '';
    const prompt = input.customPrompt ||
      `Luxury golf course in ${regionEn} ${countryEn}, beautiful green fairway, blue sky, professional golf photography, wide angle panoramic view, high quality travel brochure style, 4K ultra HD, no people, serene atmosphere, cinematic landscape`;
    let storageUrl: string;
    try {
      const result = await generateImage({ prompt });
      if (!result.url) throw new Error('이미지 URL이 비어있습니다');
      storageUrl = result.url;
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      let userMsg = rawMsg;
      if (rawMsg.includes('usage exhausted') || rawMsg.includes('usage_exhausted')) {
        userMsg = 'AI 이미지 생성 한도를 초과했습니다. 직접 업로드를 이용해 주세요.';
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: userMsg });
    }
    if (input.bannerId) {
      const db = await getDb();
      if (db) await db.update(banners).set({ imageUrl: storageUrl }).where(eq(banners.id, input.bannerId));
    }
    return { url: storageUrl };
  }),
  // 배너 3개 자동 생성 (국가별)
  generateBannerBatch: adminProcedure.input(z.object({
    countries: z.array(z.string()).min(1).max(6),
  })).mutation(async ({ input }) => {
    const countryMap: Record<string, string> = {
      'korea': 'South Korea', 'thailand': 'Thailand', 'vietnam': 'Vietnam',
      'philippines': 'Philippines', 'china': 'China', 'japan': 'Japan',
    };
    const countryNameKo: Record<string, string> = {
      'korea': '대한민국', 'thailand': '태국', 'vietnam': '베트남',
      'philippines': '필리핀', 'china': '중국', 'japan': '일본',
    };
    const db = await getDb();
    if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    const results: { country: string; url: string; bannerId: number }[] = [];
    for (const country of input.countries) {
      const countryEn = countryMap[country] ?? country;
      const countryKo = countryNameKo[country] ?? country;
      const prompt = `Luxury golf resort in ${countryEn}, stunning golf course panoramic view, lush green fairways, tropical or scenic landscape, professional travel photography, wide angle, 4K, no people, golden hour lighting`;
      try {
        const result = await generateImage({ prompt });
        if (!result.url) continue;
        // 배너 DB 삽입
        const [inserted] = await db.insert(banners).values({
          title: `${countryKo} 골프 패키지`,
          subtitle: `${countryKo} 대표 골프 코스 특가 패키지`,
          imageUrl: result.url,
          linkUrl: `/packages/${country}`,
          isActive: true,
          sortOrder: results.length,
        }).$returningId();
        results.push({ country, url: result.url, bannerId: inserted.id });
      } catch (err) {
        console.error(`[generateBannerBatch] ${country} 실패:`, err);
      }
    }
    return { results, count: results.length };
  }),
  // 배너 수정 (전체 필드)
  updateBannerFull: adminProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    imageUrl: z.string().optional(),
    linkUrl: z.string().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    const { id, ...data } = input;
    await db.update(banners).set(data).where(eq(banners.id, id));
    return { success: true };
  }),
});

const crmRouter = router({
  // ── 파트너(거래처) 관리 ─────────────────────────────────────
  getPartners: protectedProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const { getPartners } = await import('./db.js');
      return await getPartners(input?.search);
    }),

  getPartnerById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const { getPartnerById } = await import('./db.js');
      const partner = await getPartnerById(input.id);
      if (!partner) throw new TRPCError({ code: 'NOT_FOUND', message: '파트너를 찾을 수 없습니다' });
      const { loginPwHash: _, ...safe } = partner;
      return safe;
    }),

  createPartner: adminProcedure
    .input(z.object({
      companyName: z.string().min(1),
      businessNumber: z.string().optional(),
      tourismLicenseNo: z.string().optional(),
      onlineSalesNo: z.string().optional(),
      bankName: z.string().optional(),
      accountNumber: z.string().optional(),
      accountHolder: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      loginId: z.string().optional(),
      loginPw: z.string().optional(),
      memo: z.string().optional(),
      isActive: z.boolean().optional(),
      createTenant: z.boolean().optional(),
      subscriptionPlan: z.enum(['starter', 'standard', 'premium']).optional(),
    }))
    .mutation(async ({ input }) => {
      const { createPartner } = await import('./db.js');
      const { loginPw, createTenant, subscriptionPlan, ...rest } = input;
      let loginPwHash: string | undefined;
      if (loginPw) {
        const encoder = new TextEncoder();
        const data = encoder.encode(loginPw + 'dogolf_salt_2024');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        loginPwHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      }
      const { insertId: partnerId } = await createPartner({ ...rest, loginPwHash });

      // 전용 테넌트 자동 생성 + 양방향 연결 (옵션)
      let tenantId: number | undefined;
      if (createTenant && partnerId > 0) {
        try {
          const db = await getDb();
          if (db) {
            const plan = SUBSCRIPTION_PLANS.find((p) => p.id === (subscriptionPlan ?? 'starter'));
            const aiCredits = plan?.aiCreditsPerMonth ?? 100;
            const slugBase = input.companyName.replace(/[^a-zA-Z0-9가-힣]/g, '').toLowerCase().slice(0, 20) || 'partner';
            const slug = `${slugBase}-${partnerId}`;
            const trialExpires = new Date();
            trialExpires.setDate(trialExpires.getDate() + 30);
            const [tRes] = await db.insert(tenants).values({
              partnerId,
              slug,
              companyName: input.companyName,
              subscriptionPlan: (subscriptionPlan ?? 'starter') as 'starter' | 'standard' | 'premium',
              subscriptionStatus: 'trial',
              subscriptionExpiresAt: trialExpires,
              isActive: true,
              aiCreditsBalance: aiCredits,
              aiCreditsMonthlyLimit: aiCredits,
            });
            tenantId = Number((tRes as unknown as { insertId?: number }).insertId ?? 0) || undefined;
            if (tenantId) {
              await db.update(partners).set({ tenantId }).where(eq(partners.id, partnerId));
            }
          }
        } catch (e) {
          console.warn('[CRM] 전용 테넌트 자동 생성 스킵:', (e as Error)?.message);
        }
      }

      return { success: true, partnerId: partnerId || undefined, tenantId };
    }),

  updatePartner: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      data: z.object({
        companyName: z.string().optional(),
        businessNumber: z.string().optional(),
        tourismLicenseNo: z.string().optional(),
        onlineSalesNo: z.string().optional(),
        bankName: z.string().optional(),
        accountNumber: z.string().optional(),
        accountHolder: z.string().optional(),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().optional(),
        loginId: z.string().optional(),
        loginPw: z.string().optional(),
        memo: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const { updatePartner } = await import('./db.js');
      const { loginPw, ...rest } = input.data;
      const updateData: Record<string, unknown> = { ...rest };
      if (loginPw) {
        const encoder = new TextEncoder();
        const data = encoder.encode(loginPw + 'dogolf_salt_2024');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        updateData.loginPwHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      }
      await updatePartner(input.id, updateData as any);
      return { success: true };
    }),

  deletePartner: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { deletePartner } = await import('./db.js');
      await deletePartner(input.id);
      return { success: true };
    }),

  getSchedules: protectedProcedure
    .input(z.object({
      partnerId: z.number().int().positive().optional(),
      year: z.number().int().optional(),
      month: z.number().int().min(1).max(12).optional(),
    }).optional())
    .query(async ({ input }) => {
      const { getPartnerSchedules } = await import('./db.js');
      return await getPartnerSchedules(input);
    }),

  createSchedule: protectedProcedure
    .input(z.object({
      partnerId: z.number().int().positive(),
      title: z.string().min(1),
      memo: z.string().optional(),
      startDate: z.date(),
      endDate: z.date(),
      assignedTo: z.string().optional(),
      color: z.string().optional(),
      recurrenceType: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).default('none'),
      recurrenceInterval: z.number().int().min(1).default(1),
      recurrenceEndDate: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const { createPartnerSchedule } = await import('./db.js');
      // 원본 일정 저장
      await createPartnerSchedule(input);

      // 반복 일정 인스턴스 자동 생성
      if (input.recurrenceType && input.recurrenceType !== 'none') {
        const maxOccurrences = 60; // 최대 60회 반복
        const duration = input.endDate.getTime() - input.startDate.getTime();
        const endLimit = input.recurrenceEndDate
          ? input.recurrenceEndDate
          : (() => { const d = new Date(input.startDate); d.setFullYear(d.getFullYear() + 2); return d; })();

        let current = new Date(input.startDate);
        let count = 0;

        while (count < maxOccurrences) {
          const interval = input.recurrenceInterval || 1;
          const next = new Date(current);
          if (input.recurrenceType === 'daily') {
            next.setDate(next.getDate() + interval);
          } else if (input.recurrenceType === 'weekly') {
            next.setDate(next.getDate() + interval * 7);
          } else if (input.recurrenceType === 'monthly') {
            next.setMonth(next.getMonth() + interval);
          } else if (input.recurrenceType === 'yearly') {
            next.setFullYear(next.getFullYear() + interval);
          }

          if (next > endLimit) break;

          const nextEnd = new Date(next.getTime() + duration);
          await createPartnerSchedule({
            ...input,
            startDate: next,
            endDate: nextEnd,
          });

          current = next;
          count++;
        }
      }

      return { success: true };
    }),

  getWeeklySchedules: protectedProcedure
    .query(async () => {
      const { getWeeklyPartnerSchedules } = await import('./db.js');
      return await getWeeklyPartnerSchedules();
    }),

  updateSchedule: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      data: z.object({
        title: z.string().optional(),
        memo: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        assignedTo: z.string().optional(),
        color: z.string().optional(),
        recurrenceType: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
        recurrenceInterval: z.number().int().min(1).optional(),
        recurrenceEndDate: z.date().optional().nullable(),
      }),
    }))
    .mutation(async ({ input }) => {
      const { updatePartnerSchedule } = await import('./db.js');
      await updatePartnerSchedule(input.id, input.data as any);
      return { success: true };
    }),

  deleteSchedule: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { deletePartnerSchedule } = await import('./db.js');
      await deletePartnerSchedule(input.id);
      return { success: true };
    }),

  // ── 기존 고객 관리 ────────────────────────────────────────
  searchCustomers: adminProcedure.input(z.object({
    search: z.string().optional(),
    page: z.number().default(1),
    limit: z.number().default(20),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const offset = (input.page - 1) * input.limit;
    const conditions: any[] = [];
    if (input.search) conditions.push(like(users.name, `%${input.search}%`));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await db.select().from(users).where(whereClause).orderBy(desc(users.createdAt)).limit(input.limit).offset(offset);
    const [total] = await db.select({ count: count() }).from(users).where(whereClause);
    return { items, total: total.count };
  }),
  getMemos: adminProcedure.input(z.object({ userId: z.number().optional(), customerPhone: z.string().optional() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    if (input.userId) return db.select().from(customerMemos).where(eq(customerMemos.userId, input.userId)).orderBy(desc(customerMemos.createdAt));
    if (input.customerPhone) return db.select().from(customerMemos).where(eq(customerMemos.customerPhone, input.customerPhone)).orderBy(desc(customerMemos.createdAt));
    return [];
  }),
  addMemo: adminProcedure.input(z.object({
    userId: z.number().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    content: z.string().min(1),
    memoType: z.enum(["call", "kakao", "email", "visit", "other"]).default("call"),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.insert(customerMemos).values({ ...input, createdBy: ctx.user.id });
    return { success: true };
  }),

  // 파트너 정지
  suspendPartner: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      reason: z.string().min(1, "정지 사유를 입력해주세요"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      const [existing] = await db.select({ id: partners.id })
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
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
      return { ...safe, onboarding: onboardingData };
    }),
});

// ────────────────────────────────────────────────────────────────────────────
// Gemini AI 어시스턴트 라우터
// ────────────────────────────────────────────────────────────────────────────
const geminiRouter = router({
  /**
   * Gemini에게 명령을 보내고 분석/제안을 받는다.
   * 관리자가 명령을 입력하면 Gemini가 실행 계획을 제안하고,
   * 관리자가 승인/거절을 결정한다.
   */
  ask: partnerProcedure.input(z.object({
    messages: z.array(z.object({
      role: z.enum(["user", "model"]),
      content: z.string(),
    })),
    // 추가 컨텍스트 (현재 페이지, 선택된 상품 등)
    extraContext: z.string().optional(),
  })).mutation(async ({ input }) => {
    const systemContext = input.extraContext
      ? `${DOGOLF_SYSTEM_CONTEXT}\n\n## 현재 컨텍스트\n${input.extraContext}`
      : DOGOLF_SYSTEM_CONTEXT;

    const result = await geminiChat({
      messages: input.messages as GeminiMessage[],
      systemContext,
    });
    return {
      response: result.text,
      modelUsed: result.modelUsed,
      wasFallback: result.wasFallback,
      regionUsed: result.regionUsed,
      errorMessage: result.errorMessage,
    };
  }),

  /**
   * 시스템 구조 요약을 반환한다 (Gemini가 현재 시스템을 파악하는 데 사용)
   */
  getSystemContext: partnerProcedure.query(() => {
    return { context: DOGOLF_SYSTEM_CONTEXT };
  }),
});

const aiLogsRouter = router({
  /**
   * AI 대화 로그 저장 (Gemini 대화 완료 시 자동 호용)
   */
  create: adminProcedure.input(z.object({
    query: z.string(),
    response: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.insert(aiInteractionLogs).values({
      userId: ctx.user.id,
      userName: ctx.user.name ?? "",
      query: input.query,
      response: input.response,
      modelName: "gemini-2.5-flash",
    });
    return { success: true };
  }),

  /**
   * AI 대화 로그 목록 조회 (페이지네이션 + 검색)
   */
  list: adminProcedure.input(z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    search: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const offset = (input.page - 1) * input.limit;
    const conditions = input.search
      ? like(aiInteractionLogs.query, `%${input.search}%`)
      : undefined;
    const [logs, totalResult] = await Promise.all([
      db.select().from(aiInteractionLogs)
        .where(conditions)
        .orderBy(desc(aiInteractionLogs.createdAt))
        .limit(input.limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(aiInteractionLogs).where(conditions),
    ]);
    return {
      logs,
      total: Number(totalResult[0]?.count ?? 0),
      page: input.page,
      limit: input.limit,
    };
  }),

  /**
   * AI 로그 단건 삭제
   */
  delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(aiInteractionLogs).where(eq(aiInteractionLogs.id, input.id));
    return { success: true };
  }),
  /**
   * 리전별 성공/실패 통계 (차트 시각화용)
   */
  regionStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const stats = await db
      .select({
        regionUsed: aiInteractionLogs.regionUsed,
        backend: aiInteractionLogs.backend,
        total: sql<number>`count(*)`,
        success: sql<number>`sum(case when ${aiInteractionLogs.isSuccess} = 1 then 1 else 0 end)`,
        failure: sql<number>`sum(case when ${aiInteractionLogs.isSuccess} = 0 then 1 else 0 end)`,
        avgResponseMs: sql<number>`avg(${aiInteractionLogs.responseTimeMs})`,
      })
      .from(aiInteractionLogs)
      .groupBy(aiInteractionLogs.regionUsed, aiInteractionLogs.backend);
    const circuitStatus = getCircuitBreakerStatus();
    return {
      stats: stats.map(s => ({
        regionUsed: s.regionUsed ?? "global",
        backend: s.backend ?? "studio",
        total: Number(s.total),
        success: Number(s.success),
        failure: Number(s.failure),
        avgResponseMs: s.avgResponseMs ? Math.round(Number(s.avgResponseMs)) : null,
        successRate: Number(s.total) > 0 ? Math.round((Number(s.success) / Number(s.total)) * 100) : 0,
        circuitOpen: circuitStatus[s.regionUsed ?? "global"]?.isOpen ?? false,
      })),
      circuitBreaker: circuitStatus,
      regions: GEMINI_REGION_ENDPOINTS,
    };
  }),
  circuitBreakerStatus: adminProcedure.query(() => {
    return { status: getCircuitBreakerStatus(), regions: GEMINI_REGION_ENDPOINTS };
  }),
  resetCircuitBreaker: adminProcedure.input(z.object({
    regionName: z.string().optional(),
  })).mutation(({ input }) => {
    resetCircuitBreaker(input.regionName);
    return { success: true };
  }),
  modelStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const stats = await db
      .select({
        modelName: aiInteractionLogs.modelName,
        total: sql<number>`count(*)`,
        success: sql<number>`sum(case when ${aiInteractionLogs.isSuccess} = 1 then 1 else 0 end)`,
        failure: sql<number>`sum(case when ${aiInteractionLogs.isSuccess} = 0 then 1 else 0 end)`,
      })
      .from(aiInteractionLogs)
      .groupBy(aiInteractionLogs.modelName);
    return stats.map(s => ({ modelName: s.modelName, total: Number(s.total), success: Number(s.success), failure: Number(s.failure) }));
  }),
  dailyStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const stats = await db
      .select({
        date: sql<string>`DATE(${aiInteractionLogs.createdAt})`,
        total: sql<number>`count(*)`,
        success: sql<number>`sum(case when ${aiInteractionLogs.isSuccess} = 1 then 1 else 0 end)`,
      })
      .from(aiInteractionLogs)
      .where(gte(aiInteractionLogs.createdAt, thirtyDaysAgo))
      .groupBy(sql`DATE(${aiInteractionLogs.createdAt})`)
      .orderBy(sql`DATE(${aiInteractionLogs.createdAt})`);
    return stats.map(s => ({ date: s.date, total: Number(s.total), success: Number(s.success), failure: Number(s.total) - Number(s.success) }));
  }),
  /**
   * AI 답변 피드백 기록 (thumbs_up / thumbs_down)
   */
  submitFeedback: adminProcedure.input(z.object({
    logId: z.number(),
    feedback: z.enum(["thumbs_up", "thumbs_down"]),
    feedbackNote: z.string().max(500).optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(aiInteractionLogs)
      .set({ feedback: input.feedback, feedbackNote: input.feedbackNote ?? null })
      .where(eq(aiInteractionLogs.id, input.logId));
    return { success: true };
  }),
  /**
   * 실시간 모니터링 통계 (최근 1시간 기준)
   */
  monitoringStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentLogs, dayLogs, feedbackStats, taskTypeStats, cacheStats] = await Promise.all([
      db.select({
        isSuccess: aiInteractionLogs.isSuccess,
        responseTimeMs: aiInteractionLogs.responseTimeMs,
        inputTokens: aiInteractionLogs.inputTokens,
        outputTokens: aiInteractionLogs.outputTokens,
      }).from(aiInteractionLogs).where(gte(aiInteractionLogs.createdAt, oneHourAgo)),
      db.select({ count: sql<number>`count(*)` }).from(aiInteractionLogs).where(gte(aiInteractionLogs.createdAt, oneDayAgo)),
      db.select({
        feedback: aiInteractionLogs.feedback,
        cnt: sql<number>`count(*)`,
      }).from(aiInteractionLogs)
        .where(and(gte(aiInteractionLogs.createdAt, oneDayAgo), sql`${aiInteractionLogs.feedback} IS NOT NULL`))
        .groupBy(aiInteractionLogs.feedback),
      db.select({
        taskType: aiInteractionLogs.taskType,
        cnt: sql<number>`count(*)`,
        avgMs: sql<number>`avg(${aiInteractionLogs.responseTimeMs})`,
      }).from(aiInteractionLogs)
        .where(gte(aiInteractionLogs.createdAt, oneDayAgo))
        .groupBy(aiInteractionLogs.taskType),
      db.select({
        cacheHit: aiInteractionLogs.cacheHit,
        cnt: sql<number>`count(*)`,
      }).from(aiInteractionLogs)
        .where(gte(aiInteractionLogs.createdAt, oneDayAgo))
        .groupBy(aiInteractionLogs.cacheHit),
    ]);
    const anomaly = detectAnomaly(recentLogs.map(l => ({ isSuccess: l.isSuccess ?? true, responseTimeMs: l.responseTimeMs })));
    const totalTokens = recentLogs.reduce((s, l) => s + (l.inputTokens ?? 0) + (l.outputTokens ?? 0), 0);
    const thumbsUp = feedbackStats.find(f => f.feedback === "thumbs_up")?.cnt ?? 0;
    const thumbsDown = feedbackStats.find(f => f.feedback === "thumbs_down")?.cnt ?? 0;
    const cacheHits = cacheStats.find(c => c.cacheHit)?.cnt ?? 0;
    const cacheMisses = cacheStats.find(c => !c.cacheHit)?.cnt ?? 0;
    return {
      lastHour: {
        totalRequests: anomaly.totalRequests,
        failedRequests: anomaly.failedRequests,
        errorRate: Math.round(anomaly.errorRate * 100),
        avgResponseMs: anomaly.avgResponseMs,
        totalTokens,
        isAnomaly: anomaly.isAnomaly,
        alertMessage: anomaly.alertMessage,
      },
      last24h: {
        totalRequests: Number(dayLogs[0]?.count ?? 0),
        thumbsUp: Number(thumbsUp),
        thumbsDown: Number(thumbsDown),
        satisfactionRate: (Number(thumbsUp) + Number(thumbsDown)) > 0
          ? Math.round((Number(thumbsUp) / (Number(thumbsUp) + Number(thumbsDown))) * 100)
          : null,
        cacheHitRate: (cacheHits + cacheMisses) > 0
          ? Math.round((cacheHits / (cacheHits + cacheMisses)) * 100)
          : 0,
      },
      taskTypeBreakdown: taskTypeStats.map(t => ({
        taskType: t.taskType ?? "chat",
        count: Number(t.cnt),
        avgResponseMs: t.avgMs ? Math.round(Number(t.avgMs)) : null,
      })),
    };
  }),
  /**
   * 상품 설명 초안 생성
   */
  generatePackageDesc: partnerProcedure.input(z.object({
    title: z.string().min(1).max(100),
    country: z.string().min(1).max(50),
    duration: z.string().optional(),
    roundCount: z.number().optional(),
    region: z.string().optional(),
    extraInfo: z.string().max(500).optional(),
  })).mutation(async ({ input, ctx }) => {
    const result = await generatePackageDescription(input);
    const db = await getDb();
    const _uid = ctx.user?.id ?? ctx.partnerOwner?.partnerId ?? ctx.partnerStaff?.staffId ?? 0;
    const _uname = ctx.user?.name ?? ctx.partnerOwner?.name ?? ctx.partnerStaff?.name ?? "";
    const _tid: number | null = ctx.tenantId ?? null;
    if (db) {
      await db.insert(aiInteractionLogs).values({
        userId: _uid,
        userName: _uname,
        query: anonymizeText(`상품설명 초안: ${input.title} (${input.country})`),
        response: result.description.slice(0, 500),
        modelName: "gemini-2.5-flash",
        isSuccess: true,
        taskType: "packageDesc",
        cacheHit: result.cacheHit,
        responseTimeMs: result.durationMs,
        tenantId: _tid,
      });
    }
    return result;
  }),
  /**
   * 마케팅 문구 생성
   */
  generateMarketingCopy: partnerProcedure.input(z.object({
    title: z.string().min(1).max(100),
    country: z.string().min(1).max(50),
    highlights: z.array(z.string()).max(5),
    targetAudience: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const result = await generateMarketingCopy(input);
    const db = await getDb();
    const _uid2 = ctx.user?.id ?? ctx.partnerOwner?.partnerId ?? ctx.partnerStaff?.staffId ?? 0;
    const _uname2 = ctx.user?.name ?? ctx.partnerOwner?.name ?? ctx.partnerStaff?.name ?? "";
    const _tid2: number | null = ctx.tenantId ?? null;
    if (db) {
      await db.insert(aiInteractionLogs).values({
        userId: _uid2,
        userName: _uname2,
        query: anonymizeText(`마케팅 문구: ${input.title}`),
        response: result.sns.slice(0, 500),
        modelName: "gemini-2.5-flash",
        isSuccess: true,
        taskType: "marketingCopy",
        cacheHit: result.cacheHit,
        responseTimeMs: result.durationMs,
        tenantId: _tid2,
      });
    }
    return result;
  }),
  /**
   * 1:1 문의 답변 초안 생성
   */
  generateInquiryReply: partnerProcedure.input(z.object({
    inquiryId: z.number(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const _uid3 = ctx.user?.id ?? ctx.partnerOwner?.partnerId ?? ctx.partnerStaff?.staffId ?? 0;
    const _uname3 = ctx.user?.name ?? ctx.partnerOwner?.name ?? ctx.partnerStaff?.name ?? "";
    const _tid3: number | null = ctx.tenantId ?? null;
    // 테넌트 격리: 파트너는 본인 테넌트 문의만 조회
    const inquiryWhere = _tid3 !== null
      ? and(eq(inquiries.id, input.inquiryId), eq(inquiries.tenantId, _tid3))
      : eq(inquiries.id, input.inquiryId);
    const [inquiry] = await db.select().from(inquiries).where(inquiryWhere);
    if (!inquiry) throw new TRPCError({ code: "NOT_FOUND", message: "문의를 찾을 수 없습니다." });
    const result = await generateInquiryReply({
      inquiryName: inquiry.name,
      inquiryMessage: inquiry.message ?? "",
      packageName: inquiry.packageName ?? undefined,
      travelDate: inquiry.travelDate ?? undefined,
      peopleCount: inquiry.peopleCount ?? undefined,
    });
    await db.insert(aiInteractionLogs).values({
      userId: _uid3,
      userName: _uname3,
      query: anonymizeText(`문의답변 초안: ${inquiry.name}님 문의`),
      response: result.reply.slice(0, 500),
      modelName: "gemini-2.5-flash",
      isSuccess: true,
      taskType: "inquiryReply",
      responseTimeMs: result.durationMs,
      tenantId: _tid3,
    });
    return result;
  }),
  /**
   * ERP 데이터 기반 Function Calling AI 분석
   */
  analyzeErpData: partnerProcedure.input(z.object({
    question: z.string().min(1).max(500),
    dataType: z.enum(["packages", "bookings", "inquiries", "revenue"]),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const _uid4 = ctx.user?.id ?? ctx.partnerOwner?.partnerId ?? ctx.partnerStaff?.staffId ?? 0;
    const _uname4 = ctx.user?.name ?? ctx.partnerOwner?.name ?? ctx.partnerStaff?.name ?? "";
    const _tid4: number | null = ctx.tenantId ?? null;
    let data: unknown;
    let functionName = "";
    if (input.dataType === "packages") {
      const pkgWhere = _tid4 !== null ? eq(packages.tenantId, _tid4) : undefined;
      data = await db.select({ id: packages.id, title: packages.title, country: packages.country, status: packages.status, isPopular: packages.isPopular, viewCount: packages.viewCount }).from(packages).where(pkgWhere).orderBy(desc(packages.viewCount)).limit(20);
      functionName = "packages.list";
    } else if (input.dataType === "bookings") {
      const bkWhere = _tid4 !== null ? eq(bookings.tenantId, _tid4) : undefined;
      data = await db.select({ count: sql<number>`count(*)`, status: bookings.status }).from(bookings).where(bkWhere).groupBy(bookings.status);
      functionName = "bookings.statusSummary";
    } else if (input.dataType === "inquiries") {
      const inqWhere = _tid4 !== null ? eq(inquiries.tenantId, _tid4) : undefined;
      data = await db.select({ count: sql<number>`count(*)`, status: inquiries.status }).from(inquiries).where(inqWhere).groupBy(inquiries.status);
      functionName = "inquiries.statusSummary";
    } else {
      const revWhere = _tid4 !== null
        ? and(eq(bookings.paymentStatus, "paid"), eq(bookings.tenantId, _tid4))
        : eq(bookings.paymentStatus, "paid");
      data = await db.select({ month: sql<string>`DATE_FORMAT(createdAt, '%Y-%m')`, revenue: sql<string>`COALESCE(SUM(totalAmount), 0)` }).from(bookings).where(revWhere).groupBy(sql`DATE_FORMAT(createdAt, '%Y-%m')`).orderBy(sql`DATE_FORMAT(createdAt, '%Y-%m') DESC`).limit(6);
      functionName = "bookings.monthlyRevenue";
    }
    const result = await analyzeErpDataWithAI({ question: input.question, functionName, data });
    await db.insert(aiInteractionLogs).values({
      userId: _uid4,
      userName: _uname4,
      query: anonymizeText(input.question),
      response: result.answer.slice(0, 500),
      modelName: "gemini-2.5-flash",
      isSuccess: true,
      taskType: "devAnalysis",
      responseTimeMs: result.durationMs,
      tenantId: _tid4,
    });
    return result;
  }),
});
// ============================================================
// PROMPT VERSIONS ROUTER - 프롬프트 버전 관리
// ============================================================
const promptVersionsRouter = router({
  list: adminProcedure.input(z.object({
    taskType: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const conditions = input.taskType ? eq(promptVersions.taskType, input.taskType) : undefined;
    return db.select().from(promptVersions).where(conditions).orderBy(desc(promptVersions.createdAt));
  }),
  create: adminProcedure.input(z.object({
    name: z.string().min(1).max(100),
    taskType: z.string().min(1).max(50),
    version: z.number().default(1),
    systemPrompt: z.string().min(1),
    userPromptTemplate: z.string().min(1),
    abGroup: z.enum(["a", "b"]).optional(),
    createdBy: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const result = await db.insert(promptVersions).values({
      ...input,
      createdBy: ctx.user.name ?? input.createdBy,
    });
    return { id: Number((result as any)[0].insertId) };
  }),
  activate: adminProcedure.input(z.object({
    id: z.number(),
    taskType: z.string(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // 같은 taskType의 기존 활성 버전 비활성화
    await db.update(promptVersions).set({ isActive: false }).where(eq(promptVersions.taskType, input.taskType));
    await db.update(promptVersions).set({ isActive: true }).where(eq(promptVersions.id, input.id));
    return { success: true };
  }),
  updateMetrics: adminProcedure.input(z.object({
    id: z.number(),
    metrics: z.record(z.string(), z.unknown()),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(promptVersions).set({ metrics: input.metrics }).where(eq(promptVersions.id, input.id));
    return { success: true };
  }),
});
// ============================================================
// MODEL ROUTING ROUTER - 모델 라우팅 규칙 관리 (복잡도 기반)
// ============================================================
const modelRoutingRouter = router({
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const rules = await db.select().from(modelRoutingRules).orderBy(modelRoutingRules.priority);
    return rules;
  }),
  upsert: adminProcedure.input(z.object({
    complexity: z.enum(["high", "medium", "low"]),
    modelId: z.string().min(1).max(200),
    modelName: z.string().min(1).max(200),
    inputPricePerMillion: z.number().optional(),
    outputPricePerMillion: z.number().optional(),
    isActive: z.boolean().optional(),
    description: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const existing = await db.select({ id: modelRoutingRules.id }).from(modelRoutingRules).where(eq(modelRoutingRules.complexity, input.complexity));
    if (existing.length > 0) {
      await db.update(modelRoutingRules).set({
        modelId: input.modelId,
        modelName: input.modelName,
        inputPricePerMillion: input.inputPricePerMillion != null ? String(input.inputPricePerMillion) : undefined,
        outputPricePerMillion: input.outputPricePerMillion != null ? String(input.outputPricePerMillion) : undefined,
        isActive: input.isActive,
        description: input.description,
        updatedBy: ctx.user.name ?? ctx.user.openId,
      }).where(eq(modelRoutingRules.complexity, input.complexity));
    } else {
      await db.insert(modelRoutingRules).values({
        complexity: input.complexity,
        modelId: input.modelId,
        modelName: input.modelName,
        inputPricePerMillion: input.inputPricePerMillion != null ? String(input.inputPricePerMillion) : "0",
        outputPricePerMillion: input.outputPricePerMillion != null ? String(input.outputPricePerMillion) : "0",
        isActive: input.isActive ?? true,
        description: input.description,
        priority: input.complexity === "high" ? 1 : input.complexity === "medium" ? 2 : 3,
        updatedBy: ctx.user.name ?? ctx.user.openId,
      });
    }
    return { success: true };
  }),

  /** 기본값으로 초기화 */
  reset: adminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(modelRoutingRules);
    const defaults = [
      { complexity: "high" as const, modelId: "google/gemini-2.5-pro-preview-05-06", modelName: "Gemini 2.5 Pro Preview", inputPricePerMillion: "1.25", outputPricePerMillion: "10.0", description: "추론·분석·오류검수 등 고복잡도 작업", isActive: true, priority: 1 },
      { complexity: "medium" as const, modelId: "google/gemini-2.5-flash", modelName: "Gemini 2.5 Flash", inputPricePerMillion: "0.15", outputPricePerMillion: "0.6", description: "생성·요약·상담 등 중간 복잡도 작업", isActive: true, priority: 2 },
      { complexity: "low" as const, modelId: "google/gemini-2.5-flash-lite", modelName: "Gemini 2.5 Flash Lite", inputPricePerMillion: "0.10", outputPricePerMillion: "0.40", description: "분류·태깅·단순응답 등 저복잡도 작업", isActive: true, priority: 3 },
    ];
    for (const d of defaults) {
      await db.insert(modelRoutingRules).values({ ...d, updatedBy: ctx.user.name ?? ctx.user.openId });
    }
    return { success: true };
  }),

  /** 비용 통계 집계 */
  getStats: adminProcedure.input(z.object({ days: z.number().min(1).max(365).default(30) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
    const stats = await db.select({
      complexity: aiRoutingLogs.complexity,
      modelId: aiRoutingLogs.modelId,
      modelName: aiRoutingLogs.modelName,
      callCount: sql<number>`COUNT(*)`,
      totalTokensIn: sql<number>`SUM(tokensIn)`,
      totalTokensOut: sql<number>`SUM(tokensOut)`,
      totalCostUsd: sql<number>`SUM(costUsd)`,
      avgDurationMs: sql<number>`AVG(durationMs)`,
      errorCount: sql<number>`SUM(CASE WHEN isSuccess = 0 THEN 1 ELSE 0 END)`,
    }).from(aiRoutingLogs).where(gte(aiRoutingLogs.createdAt, since)).groupBy(aiRoutingLogs.complexity, aiRoutingLogs.modelId, aiRoutingLogs.modelName);
    const totalCost = stats.reduce((s, r) => s + Number(r.totalCostUsd ?? 0), 0);
    const totalCalls = stats.reduce((s, r) => s + Number(r.callCount ?? 0), 0);
    return { stats, summary: { totalCostUsd: totalCost, totalCalls, periodDays: input.days } };
  }),

  /** 라우팅 로그 조회 */
  getLogs: adminProcedure.input(z.object({ limit: z.number().min(1).max(500).default(100) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(aiRoutingLogs).orderBy(desc(aiRoutingLogs.createdAt)).limit(input.limit);
  }),

  /** OpenRouter 사용 가능 모델 목록 */
  getAvailableModels: adminProcedure.query(async () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { models: [], error: "OPENROUTER_API_KEY가 설정되지 않았습니다." };
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { data: Array<{ id: string; name: string; pricing: { prompt: string; completion: string }; context_length: number }> };
      const filtered = data.data.filter(m => m.id.includes("gemini") || m.id.includes("claude") || m.id.includes("gpt-4") || m.id.includes("llama")).slice(0, 50).map(m => ({
        id: m.id, name: m.name,
        inputPricePerMillion: parseFloat(m.pricing.prompt) * 1_000_000,
        outputPricePerMillion: parseFloat(m.pricing.completion) * 1_000_000,
        contextLength: m.context_length,
      }));
      return { models: filtered, error: null };
    } catch (err) {
      return { models: [], error: String(err) };
    }
  }),
});

// ────────────────────────────────────────────────────────────────────────────
// 오케스트레이터 / 결제 / 비디오 / AI 개발엔진 라우터
// ────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
// 오케스트레이터 라우터
// ────────────────────────────────────────────────────────────────────────────

const orchestratorRouter = router({
  /** 오케스트레이터를 통한 AI 질의 */
  ask: adminProcedure.input(z.object({
    message: z.string().min(1).max(5000),
    taskType: z.enum(["text_summary", "hashtag_gen", "data_classify", "price_analysis", "schedule_optimize", "report_gen", "content_create", "layout_design", "code_review", "auto"]).default("auto"),
    complexity: z.enum(["SIMPLE", "MODERATE", "COMPLEX"]).optional(),
    systemPrompt: z.string().optional(),
    maxTokens: z.number().min(100).max(8192).optional(),
    temperature: z.number().min(0).max(2).optional(),
    useCache: z.boolean().default(true),
    useFreeModel: z.boolean().default(false),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    const startTime = Date.now();
    let result: Awaited<ReturnType<typeof orchestrate>> | null = null;
    let errorMessage: string | null = null;

    try {
      result = await orchestrate(input.message, {
        taskType: input.taskType as TaskType,
        complexity: input.complexity as TaskComplexity | undefined,
        systemPrompt: input.systemPrompt,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        useCache: input.useCache,
        useFreeModel: input.useFreeModel,
      });
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    // 비용 로그 저장
    if (db) {
      try {
        await db.insert(aiCostLogs).values({
          model: result?.model ?? input.complexity ?? "unknown",
          modelName: result?.model?.split("/")[1] ?? "unknown",
          complexity: result?.complexity ?? input.complexity ?? "MODERATE",
          taskType: result?.taskType ?? input.taskType,
          inputTokens: result?.inputTokens ?? 0,
          outputTokens: result?.outputTokens ?? 0,
          costUsd: String(result?.costUsd ?? 0),
          cacheSavedUsd: String(result?.cacheSavedUsd ?? 0),
          cacheHit: result?.cacheHit ?? false,
          durationMs: result?.durationMs ?? (Date.now() - startTime),
          isSuccess: !errorMessage,
          errorMessage: errorMessage ?? undefined,
          userId: ctx.user.id,
          promptPreview: input.message.slice(0, 200),
          assistant: "master",
        });
      } catch (logErr) {
        console.error("[Orchestrator] 비용 로그 저장 실패:", logErr);
      }
    }

    if (errorMessage) {
      return {
        success: false,
        errorMessage: `현재 AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요. (${errorMessage.slice(0, 100)})`,
        text: null,
        model: null,
        complexity: null,
        taskType: input.taskType,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        cacheHit: false,
        cacheSavedUsd: 0,
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      errorMessage: null,
      text: result!.text,
      model: result!.model,
      complexity: result!.complexity,
      taskType: result!.taskType,
      inputTokens: result!.inputTokens,
      outputTokens: result!.outputTokens,
      costUsd: result!.costUsd,
      cacheHit: result!.cacheHit,
      cacheSavedUsd: result!.cacheSavedUsd,
      durationMs: result!.durationMs,
    };
  }),

  /** 비용 통계 조회 */
  getCostStats: adminProcedure.input(z.object({
    days: z.number().min(1).max(90).default(30),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

    const [totalStats, byModel, byComplexity, byDay, cacheStats] = await Promise.all([
      // 전체 합계
      db.select({
        totalCost: sql<string>`COALESCE(SUM(costUsd), 0)`,
        totalCacheSaved: sql<string>`COALESCE(SUM(cacheSavedUsd), 0)`,
        totalRequests: count(),
        cacheHits: sql<number>`SUM(CASE WHEN cacheHit = 1 THEN 1 ELSE 0 END)`,
        successCount: sql<number>`SUM(CASE WHEN isSuccess = 1 THEN 1 ELSE 0 END)`,
        avgDuration: sql<number>`AVG(durationMs)`,
      }).from(aiCostLogs).where(gte(aiCostLogs.createdAt, since)),

      // 모델별 통계
      db.select({
        model: aiCostLogs.model,
        modelName: aiCostLogs.modelName,
        requests: count(),
        totalCost: sql<string>`COALESCE(SUM(costUsd), 0)`,
        totalTokens: sql<number>`SUM(inputTokens + outputTokens)`,
      }).from(aiCostLogs).where(gte(aiCostLogs.createdAt, since)).groupBy(aiCostLogs.model, aiCostLogs.modelName),

      // 복잡도별 통계
      db.select({
        complexity: aiCostLogs.complexity,
        requests: count(),
        totalCost: sql<string>`COALESCE(SUM(costUsd), 0)`,
      }).from(aiCostLogs).where(gte(aiCostLogs.createdAt, since)).groupBy(aiCostLogs.complexity),

      // 일별 비용 추이
      db.select({
        date: sql<string>`DATE(createdAt)`,
        totalCost: sql<string>`COALESCE(SUM(costUsd), 0)`,
        requests: count(),
        cacheHits: sql<number>`SUM(CASE WHEN cacheHit = 1 THEN 1 ELSE 0 END)`,
      }).from(aiCostLogs).where(gte(aiCostLogs.createdAt, since)).groupBy(sql`DATE(createdAt)`).orderBy(sql`DATE(createdAt)`),

      // 캐시 통계
      db.select({
        totalRequests: count(),
        cacheHits: sql<number>`SUM(CASE WHEN cacheHit = 1 THEN 1 ELSE 0 END)`,
        totalSaved: sql<string>`COALESCE(SUM(cacheSavedUsd), 0)`,
      }).from(aiCostLogs).where(gte(aiCostLogs.createdAt, since)),
    ]);

    return {
      summary: totalStats[0],
      byModel,
      byComplexity,
      byDay,
      cacheStats: cacheStats[0],
      inMemoryCacheStats: getCacheStats(),
    };
  }),

  /** 모델 가격 정보 */
  getModelPricing: adminProcedure.query(() => getModelPricing()),

  /** 인메모리 캐시 초기화 */
  clearCache: adminProcedure.mutation(() => {
    clearCache();
    return { success: true };
  }),

  /** 복잡도 자동 감지 미리보기 */
  detectComplexity: adminProcedure.input(z.object({
    prompt: z.string().min(1),
  })).query(({ input }) => ({
    complexity: detectComplexity(input.prompt),
    model: MODEL_CATALOG[detectComplexity(input.prompt)],
  })),

  /** 최근 비용 로그 */
  getRecentLogs: adminProcedure.input(z.object({
    limit: z.number().min(1).max(100).default(20),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(aiCostLogs).orderBy(desc(aiCostLogs.createdAt)).limit(input.limit);
  }),
});

// ─── Payment Router ─────────────────────────────────────────────
const paymentRouter = router({
  /** PaymentIntent 생성 (예약금 결제 시작) */
  createIntent: protectedProcedure
    .input(z.object({
      bookingId: z.number().int().positive(),
      amountKrw: z.number().int().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // 예약 존재 여부 확인
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.bookingId));
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "예약을 찾을 수 없습니다." });
      const result = await createPaymentIntent(
        input.bookingId,
        input.amountKrw,
        ctx.user.email ?? undefined,
        ctx.user.name ?? undefined,
      );
      return result;
    }),

  /** 결제 상태 조회 */
  getStatus: protectedProcedure
    .input(z.object({ paymentIntentId: z.string() }))
    .query(async ({ input }) => {
      return getPaymentStatus(input.paymentIntentId);
    }),

  /** 예약별 결제 이력 조회 */
  getHistory: protectedProcedure
    .input(z.object({ bookingId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(payments)
        .where(eq(payments.bookingId, input.bookingId))
        .orderBy(desc(payments.createdAt));
    }),

  /** 관리자: 전체 결제 이력 조회 */
  listAll: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(payments)
        .orderBy(desc(payments.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      const [total] = await db.select({ count: count() }).from(payments);
      return { rows, total: total.count };
    }),
});

// ─── Runway ML 동영상 생성 Router ───────────────────────────
const videoRouter = router({
  /** 동영상 생성 시작 */
  generate: adminProcedure
    .input(z.object({
      packageId: z.number().int().positive(),
      imageUrl: z.string().url(),
      durationSec: z.union([z.literal(5), z.literal(10)]).default(10),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [pkg] = await db.select().from(packages).where(eq(packages.id, input.packageId));
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "패키지를 찾을 수 없습니다." });

      const result = await generateGolfVideo({
        imageUrl: input.imageUrl,
        packageTitle: pkg.title,
        country: pkg.country,
        region: pkg.region ?? undefined,
        durationSec: input.durationSec,
      });

      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }

      // DB에 동영상 레코드 생성
      const [inserted] = await db.insert(packageVideos).values({
        packageId: input.packageId,
        videoUrl: "", // 완료 시 업데이트
        title: `${pkg.title} 홈보 영상`,
        durationSec: input.durationSec,
        generatedBy: "runway",
        status: "processing",
      }).$returningId();

      return {
        videoId: inserted.id,
        taskId: result.taskId,
        status: result.status,
      };
    }),

  /** 동영상 생성 상태 조회 */
  checkStatus: adminProcedure
    .input(z.object({
      taskId: z.string(),
      videoId: z.number().int().positive(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const status = await getVideoGenerationStatus(input.taskId);

      // 완료 시 DB 업데이트
      if (status.status === "succeeded" && status.output?.[0]) {
        await db.update(packageVideos)
          .set({ videoUrl: status.output[0], status: "ready" })
          .where(eq(packageVideos.id, input.videoId));
      } else if (status.status === "failed") {
        await db.update(packageVideos)
          .set({ status: "failed" })
          .where(eq(packageVideos.id, input.videoId));
      }

      return status;
    }),

  /** 패키지별 동영상 목록 */
  listByPackage: publicProcedure
    .input(z.object({ packageId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // 공개 API: ready 상태인 영상만 반환
      return db.select().from(packageVideos)
        .where(
          and(
            eq(packageVideos.packageId, input.packageId),
            eq(packageVideos.status, "ready")
          )
        )
        .orderBy(desc(packageVideos.createdAt));
    }),
});

// ============================================================
// 두골프-AI개발 엔진 라우터
// ============================================================
const aiDevEngineRouter = router({
  // 오류 로그 목록 조회
  getLogs: adminProcedure
    .input(z.object({
      status: z.enum(["new", "analyzing", "fixed", "ignored"]).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [];
      if (input.status) conditions.push(eq(aiEngineLogs.status, input.status));
      const rows = await db.select().from(aiEngineLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(aiEngineLogs.createdAt))
        .limit(input.limit).offset(input.offset);
      const [{ total }] = await db.select({ total: count() }).from(aiEngineLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      return { logs: rows, total };
    }),

  // 수정 요청 목록 조회
  getFixRequests: adminProcedure
    .input(z.object({
      status: z.enum(["pending", "in_review", "approved", "rejected", "applied", "failed"]).optional(),
      priority: z.enum(["critical", "high", "medium", "low"]).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [];
      if (input.status) conditions.push(eq(aiFixRequests.status, input.status));
      if (input.priority) conditions.push(eq(aiFixRequests.priority, input.priority));
      const rows = await db.select().from(aiFixRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(aiFixRequests.createdAt))
        .limit(input.limit).offset(input.offset);
      const [{ total }] = await db.select({ total: count() }).from(aiFixRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      return { requests: rows, total };
    }),

  // 수정 요청 단일 조회
  getFixRequest: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [req] = await db.select().from(aiFixRequests).where(eq(aiFixRequests.id, input.id));
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      const reviews = await db.select().from(aiReviewResults).where(eq(aiReviewResults.fixRequestId, input.id));
      return { request: req, reviews };
    }),

  // 수동 수정 요청 생성
  createFixRequest: adminProcedure
    .input(z.object({
      title: z.string().min(1).max(300),
      description: z.string().min(1),
      targetFile: z.string().optional(),
      targetFunction: z.string().optional(),
      priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const critical = isCriticalError(input.targetFile ?? "", input.description);
      const [inserted] = await db.insert(aiFixRequests).values({
        title: input.title,
        description: input.description,
        targetFile: input.targetFile,
        targetFunction: input.targetFunction,
        priority: input.priority,
        isCritical: critical,
        status: "pending",
        requestSource: "manual",
      });
      const newId = (inserted as any).insertId as number;
      // 백그라운드 AI 자동 분석 (비동기 - 응답 지연 없음)
      setImmediate(async () => {
        try {
          const { analyzeDevRequest } = await import("./_core/geminiAIService.js");
          const analysis = await analyzeDevRequest(input.description);
          const dbBg = await getDb();
          if (dbBg) {
            await dbBg.update(aiFixRequests)
              .set({
                aiCategory: analysis.category,
                aiSuggestedPriority: analysis.priority,
                aiEstimatedHours: analysis.estimatedHours,
                aiAnalyzed: true,
              })
              .where(eq(aiFixRequests.id, newId));
          }
        } catch (e) {
          console.error("[AI AutoAnalyze] 수정 요청 자동 분석 실패:", e);
        }
      });
      return { id: newId, isCritical: critical };
    }),

  // AI 코드 수정 제안 생성
  generateFix: adminProcedure
    .input(z.object({ fixRequestId: z.number() }))
    .mutation(async ({ input }) => {
      const result = await generateFixCode(input.fixRequestId);
      if (!result.success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      return result;
    }),

  // 다단계 재검토 실행
  runReview: adminProcedure
    .input(z.object({ fixRequestId: z.number() }))
    .mutation(async ({ input }) => {
      const result = await runFullReview(input.fixRequestId);
      return result;
    }),

  // 수정 요청 승인/거부 (핵심 기능 수정 시 사용자 승인 필요)
  approveFixRequest: adminProcedure
    .input(z.object({
      fixRequestId: z.number(),
      approved: z.boolean(),
      feedback: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [req] = await db.select().from(aiFixRequests).where(eq(aiFixRequests.id, input.fixRequestId));
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      // 핵심 기능 수정 승인 시 관리자 권한 확인
      if (req.isCritical && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "핵심 기능 수정은 관리자만 승인할 수 있습니다." });
      }
      // 핵심 기능 수정 승인 시 사용자 피드백 필수 안전장치
      if (req.isCritical && input.approved && (!input.feedback || input.feedback.trim().length < 5)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "핵심 기능 수정 승인은 최소 5자 이상의 검토 의견이 필요합니다. (예: \"안전한 변경사항 확인 완료\")"
        });
      }
      await db.update(aiFixRequests).set({
        status: input.approved ? "approved" : "rejected",
        userFeedback: input.feedback,
        approvedBy: ctx.user.id,
        updatedAt: new Date(),
      }).where(eq(aiFixRequests.id, input.fixRequestId));
      return { success: true, status: input.approved ? "approved" : "rejected" };
    }),

  // 오류 로그 상태 업데이트
  updateLogStatus: adminProcedure
    .input(z.object({
      logId: z.number(),
      status: z.enum(["new", "analyzing", "fixed", "ignored"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(aiEngineLogs).set({ status: input.status }).where(eq(aiEngineLogs.id, input.logId));
      return { success: true };
    }),

  // ERP 기능 검색 (AI 기반)
  searchFeature: adminProcedure
    .input(z.object({ query: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      return searchErpFeature(input.query);
    }),

  // 수동 오류 보고 (Express 에러 핸들러에서 호출)
  reportError: publicProcedure
    .input(z.object({
      source: z.string(),
      errorMessage: z.string(),
      path: z.string().optional(),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const logId = await reportError({
        source: input.source,
        error: new Error(input.errorMessage),
        path: input.path,
        context: input.context,
      });
      return { logId };
    }),

  // 대시보드 통계
  getDashboardStats: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [newErrors] = await db.select({ count: count() }).from(aiEngineLogs).where(eq(aiEngineLogs.status, "new"));
      const [pendingFixes] = await db.select({ count: count() }).from(aiFixRequests).where(eq(aiFixRequests.status, "pending"));
      const [approvedFixes] = await db.select({ count: count() }).from(aiFixRequests).where(eq(aiFixRequests.status, "approved"));
      const [totalLogs] = await db.select({ count: count() }).from(aiEngineLogs);
      const recentLogs = await db.select().from(aiEngineLogs).orderBy(desc(aiEngineLogs.createdAt)).limit(5);
      // ai_logs 통계 추가 (실제 AI 호출 현황)
      const [totalAiCalls] = await db.select({ count: count() }).from(aiLogs);
      const [todayAiCalls] = await db.select({ count: count() }).from(aiLogs).where(
        gte(aiLogs.createdAt, new Date(new Date().setHours(0, 0, 0, 0)))
      );
      // 분석 완료 로그 (status != 'new')
      const [analyzedLogs] = await db.select({ count: count() }).from(aiEngineLogs).where(
        sql`${aiEngineLogs.status} != 'new'`
      );
      // 수정 요청 전체
      const [totalFixRequests] = await db.select({ count: count() }).from(aiFixRequests);
      // 승인 대기 (pending)
      const [pendingApproval] = await db.select({ count: count() }).from(aiFixRequests).where(eq(aiFixRequests.status, "pending"));
      return {
        newErrors: newErrors.count,
        pendingFixes: pendingFixes.count,
        approvedFixes: approvedFixes.count,
        totalLogs: totalLogs.count,
        recentLogs,
        totalAiCalls: totalAiCalls.count,
        todayAiCalls: todayAiCalls.count,
        analyzedLogs: analyzedLogs.count,
        totalFixRequests: totalFixRequests.count,
        pendingApproval: pendingApproval.count,
      };
    }),
});

// ============================================================
// DEV AI ROUTER - 두골프 개발AI 관리
// =============================================================
import { devAIRouter } from "./routers/devAI";

/// AI 어시스턴트 라우터 임포트
import { aiRouter } from "./routers/ai";
import { devRequestRouter } from "./routers/devRequest";
import { chatRouter } from "./routers/chat";
import { openrouterAgentRouter } from "./routers/openrouterAgent";
import { customerEstimateTemplatesRouter, estimatesRouter } from "./routers/estimates";
import { featuresRouter } from "./routers/features";
import { siteSettingsRouter } from "./routers/siteSettings";
import { managedProjectsRouter } from "./routers/managedProjects";
import { systemSettingsRouter } from "./routers/systemSettings";
import { partnerOnboardingRouter } from "./routers/partnerOnboarding";
import { partnerStaffRouter } from "./routers/partnerStaff";
import { tenantsRouter } from "./routers/tenants";
import { subscriptionsRouter } from "./routers/subscriptions";
import { fileAnalysisRouter } from "./routers/fileAnalysis";
import { aiNotificationsRouter } from "./routers/aiNotifications";
import { scheduledTasksRouter } from "./routers/scheduledTasks";
import { agentApprovalsRouter } from "./routers/agentApprovals";
import { tenantAiRouter } from "./routers/tenantAi";
import { imageArchiveRouter } from "./routers/imageArchive";
import { aiDevPipelineRouter } from "./routers/aiDevPipeline";
import { tenantAffiliatesRouter } from "./routers/tenantAffiliates";
import { tenantPartnersRouter } from "./routers/tenantPartners";
import { aiPackagePipelineRouter } from "./routers/aiPackagePipeline";
import { partnerStaffPermissionsRouter } from "./routers/partnerStaffPermissions";
import { companyManageRouter } from "./routers/companyManage";
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: dashboardRouter,
  packages: packagesRouter,
  bookings: bookingsRouter,
  settlements: settlementsRouter,
  inquiries: inquiriesRouter,
  cms: cmsRouter,
  crm: crmRouter,
  gemini: geminiRouter,
  aiLogs: aiLogsRouter,
  devAI: devAIRouter,
  orchestrator: orchestratorRouter,
  payment: paymentRouter,
  video: videoRouter,
  aiDevEngine: aiDevEngineRouter,
  promptVersions: promptVersionsRouter,
  modelRouting: modelRoutingRouter,
  aiAssistant: aiRouter,
  devRequest: devRequestRouter,
  chat: chatRouter,
  reservations: reservationsRouter,
  affiliates: affiliatesRouter,
  settings: settingsRouter,
  adminAccounts: adminAccountsRouter,
  reservationInquiries: reservationInquiriesRouter,
  inquiryTemplates: inquiryTemplatesRouter,
  openrouterAgent: openrouterAgentRouter,
  customerEstimateTemplates: customerEstimateTemplatesRouter,
  estimates: estimatesRouter,
  reservationItineraries: reservationItinerariesRouter,
  reservationAffiliateCosts: reservationAffiliateCostsRouter,
  customVariables: customVariablesRouter,
  features: featuresRouter,
  siteSettings: siteSettingsRouter,
  managedProjects: managedProjectsRouter,
  systemSettings: systemSettingsRouter,
  partnerOnboarding: partnerOnboardingRouter,
  partnerStaff: partnerStaffRouter,
  tenants: tenantsRouter,
  subscriptions: subscriptionsRouter,
  fileAnalysis: fileAnalysisRouter,
  aiNotifications: aiNotificationsRouter,
  scheduledTasks: scheduledTasksRouter,
  agentApprovals: agentApprovalsRouter,
  adminAuth: adminAuthRouter,
  adminManagement: adminManagementRouter,
  erpApiKeys: erpApiKeysRouter,
  mail: mailRouter,
  knowledgeBlock: knowledgeBlockRouter,
  manusWebhook: manusWebhookRouter,
  tenantAi: tenantAiRouter,
  imageArchive: imageArchiveRouter,
  aiDevPipeline: aiDevPipelineRouter,
  tenantAffiliates: tenantAffiliatesRouter,
  tenantPartners: tenantPartnersRouter,
  aiPackagePipeline: aiPackagePipelineRouter,
  partnerStaffPermissions: partnerStaffPermissionsRouter,
  companyManage: companyManageRouter,
});
export type AppRouter = typeof appRouter;
