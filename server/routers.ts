import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  packages, packagePrices, packageOptions, packageSlots,
  bookings, travelers, settlements, inquiries, notices, banners, customerMemos, users,
  packageImages, aiInteractionLogs,
  devRequests, devFeatures, devVersions,
  aiCostLogs,
  payments, kakaoNotifications, packageVideos, automationLogs
} from "../drizzle/schema";
// AI 엔진 테이블은 별도 import로 처리됨 (아래 참조)
import { eq, desc, and, gte, lte, like, sql, count, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { storagePut, storageGetSignedUrl } from "./storage";
import { optimizeImage, optimizeBase64Image } from "./imageOptimizer";
import { generateImage } from "./_core/imageGeneration";
import { ENV } from "./_core/env";
import { geminiChat, DOGOLF_SYSTEM_CONTEXT, type GeminiMessage, getCircuitBreakerStatus, resetCircuitBreaker, GEMINI_REGION_ENDPOINTS } from "./_core/gemini";
import { orchestrate, getModelPricing, getCacheStats, clearCache, detectComplexity, MODEL_CATALOG, LLAMA_FREE_MODEL, type TaskType, type TaskComplexity } from "./_core/orchestrator";
import { createPaymentIntent, getPaymentStatus } from "./stripe";
import {
  sendBookingConfirmedNotification,
  sendBookingCancelledNotification,
} from "./_core/kakao";
import { generateGolfVideo, getVideoGenerationStatus } from "./_core/runway";
import { triggerPackagePublishPipeline } from "./_core/n8n";
import { reportError, isCriticalError } from "./_core/errorWatcher";
import { generateFixCode, searchErpFeature } from "./_core/autoFixer";
import { runFullReview, getReviewResults } from "./_core/reviewEngine";
import { aiEngineLogs, aiFixRequests, aiReviewResults, promptVersions, modelRoutingRules } from "../drizzle/schema";
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
  stats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [totalBookings] = await db.select({ count: count() }).from(bookings);
    const [pendingBookings] = await db.select({ count: count() }).from(bookings).where(eq(bookings.status, "pending"));
    const [confirmedBookings] = await db.select({ count: count() }).from(bookings).where(eq(bookings.status, "confirmed"));
    const [totalPackages] = await db.select({ count: count() }).from(packages);
    const [activePackages] = await db.select({ count: count() }).from(packages).where(eq(packages.status, "active"));
    const [newInquiries] = await db.select({ count: count() }).from(inquiries).where(eq(inquiries.status, "new"));
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const revenueResult = await db.select({
      total: sql<string>`COALESCE(SUM(totalAmount), 0)`
    }).from(bookings).where(eq(bookings.paymentStatus, "paid"));
    const recentBookings = await db.select().from(bookings).orderBy(desc(bookings.createdAt)).limit(5);
    const recentInquiries = await db.select().from(inquiries).orderBy(desc(inquiries.createdAt)).limit(5);
    return {
      totalBookings: totalBookings.count,
      pendingBookings: pendingBookings.count,
      confirmedBookings: confirmedBookings.count,
      totalPackages: totalPackages.count,
      activePackages: activePackages.count,
      newInquiries: newInquiries.count,
      totalUsers: totalUsers.count,
      totalRevenue: Number(revenueResult[0]?.total || 0),
      recentBookings,
      recentInquiries,
    };
  }),
  monthlyRevenue: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const result = await db.select({
      month: sql<string>`DATE_FORMAT(createdAt, '%Y-%m')`,
      revenue: sql<string>`COALESCE(SUM(totalAmount), 0)`,
      bookingCount: count(),
    }).from(bookings)
      .where(and(
        eq(bookings.paymentStatus, "paid"),
        gte(bookings.createdAt, new Date(Date.now() - 180 * 24 * 60 * 60 * 1000))
      ))
      .groupBy(sql`DATE_FORMAT(createdAt, '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(createdAt, '%Y-%m')`);
    return result;
  }),
});

const packagesRouter = router({
  list: adminProcedure.input(z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    status: z.string().optional(),
    country: z.string().optional(),
    search: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const offset = (input.page - 1) * input.limit;
    const conditions: any[] = [];
    if (input.status) conditions.push(eq(packages.status, input.status as any));
    if (input.country) conditions.push(eq(packages.country, input.country));
    if (input.search) conditions.push(like(packages.title, `%${input.search}%`));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await db.select().from(packages).where(whereClause).orderBy(desc(packages.createdAt)).limit(input.limit).offset(offset);
    const [total] = await db.select({ count: count() }).from(packages).where(whereClause);
    return { items, total: total.count };
  }),
  get: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [pkg] = await db.select().from(packages).where(eq(packages.id, input.id));
    if (!pkg) throw new TRPCError({ code: "NOT_FOUND" });
    const prices = await db.select().from(packagePrices).where(eq(packagePrices.packageId, input.id));
    const options = await db.select().from(packageOptions).where(eq(packageOptions.packageId, input.id));
    const slots = await db.select().from(packageSlots).where(eq(packageSlots.packageId, input.id)).orderBy(packageSlots.departureDate);
    return { ...pkg, prices, options, slots };
  }),
  create: adminProcedure.input(z.object({
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
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const result = await db.insert(packages).values(input);
    return { id: Number((result as any)[0].insertId) };
  }),
  update: adminProcedure.input(z.object({
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
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    await db.update(packages).set(data as any).where(eq(packages.id, id));
    return { success: true };
  }),
  delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(packages).where(eq(packages.id, input.id));
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
    status: z.enum(["open", "closed", "sold_out"]).default("open"),
    priceOverride: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.insert(packageSlots).values(input);
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
    // 각 상품의 최저가 조회
    const itemsWithPrice = await Promise.all(
      items.map(async (item) => {
        const prices = await db.select({ price: packagePrices.pricePerPerson })
          .from(packagePrices)
          .where(eq(packagePrices.packageId, item.id));
        const minPrice = prices.length > 0
          ? Math.min(...prices.map((p) => Number(p.price)))
          : 0;
        return { ...item, minPrice };
      })
    );
    return { items: itemsWithPrice };
  }),
  publicGet: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [pkg] = await db.select().from(packages).where(and(eq(packages.id, input.id), eq(packages.status, "active")));
    if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "상품을 찾을 수 없습니다." });
    const prices = await db.select().from(packagePrices).where(eq(packagePrices.packageId, input.id));
    const options = await db.select().from(packageOptions).where(eq(packageOptions.packageId, input.id));
    const slots = await db.select().from(packageSlots)
      .where(and(eq(packageSlots.packageId, input.id), eq(packageSlots.status, "open")))
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
  list: adminProcedure.input(z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    status: z.string().optional(),
    search: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const offset = (input.page - 1) * input.limit;
    const conditions: any[] = [];
    if (input.status) conditions.push(eq(bookings.status, input.status as any));
    if (input.search) conditions.push(like(bookings.leaderName, `%${input.search}%`));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await db.select().from(bookings).where(whereClause).orderBy(desc(bookings.createdAt)).limit(input.limit).offset(offset);
    const [total] = await db.select({ count: count() }).from(bookings).where(whereClause);
    return { items, total: total.count };
  }),
  get: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, input.id));
    if (!booking) throw new TRPCError({ code: "NOT_FOUND" });
    const travelersData = await db.select().from(travelers).where(eq(travelers.bookingId, input.id));
    const [pkg] = await db.select().from(packages).where(eq(packages.id, booking.packageId));
    return { ...booking, travelers: travelersData, package: pkg };
  }),
  updateStatus: adminProcedure.input(z.object({
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
  /** D-1 알림톡 n8n 파이프라인용: 내일 출발 예약 목록 조회 */
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
  list: adminProcedure.input(z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    status: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const offset = (input.page - 1) * input.limit;
    const conditions: any[] = [];
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
  updateStatus: adminProcedure.input(z.object({
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
  supplierSummary: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select({
      supplierName: settlements.supplierName,
      supplierType: settlements.supplierType,
      totalAmount: sql<string>`COALESCE(SUM(amount), 0)`,
      paidAmount: sql<string>`COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)`,
      pendingAmount: sql<string>`COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)`,
      cnt: count(),
    }).from(settlements).groupBy(settlements.supplierName, settlements.supplierType).orderBy(desc(sql`SUM(amount)`));
  }),
});

const inquiriesRouter = router({
  list: adminProcedure.input(z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    status: z.string().optional(),
    search: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const offset = (input.page - 1) * input.limit;
    const conditions: any[] = [];
    if (input.status) conditions.push(eq(inquiries.status, input.status as any));
    if (input.search) conditions.push(like(inquiries.name, `%${input.search}%`));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await db.select().from(inquiries).where(whereClause).orderBy(desc(inquiries.createdAt)).limit(input.limit).offset(offset);
    const [total] = await db.select({ count: count() }).from(inquiries).where(whereClause);
    return { items, total: total.count };
  }),
  reply: adminProcedure.input(z.object({
    id: z.number(),
    adminReply: z.string().min(1),
    status: z.enum(["new", "in_progress", "replied", "closed"]).default("replied"),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(inquiries).set({ adminReply: input.adminReply, status: input.status, repliedAt: new Date() }).where(eq(inquiries.id, input.id));
    return { success: true };
  }),
  updateStatus: adminProcedure.input(z.object({
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

  createPartner: protectedProcedure
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
    }))
    .mutation(async ({ input }) => {
      const { createPartner } = await import('./db.js');
      const { loginPw, ...rest } = input;
      let loginPwHash: string | undefined;
      if (loginPw) {
        const encoder = new TextEncoder();
        const data = encoder.encode(loginPw + 'dogolf_salt_2024');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        loginPwHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      }
      await createPartner({ ...rest, loginPwHash });
      return { success: true };
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
  ask: adminProcedure.input(z.object({
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
  getSystemContext: adminProcedure.query(() => {
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
  generatePackageDesc: adminProcedure.input(z.object({
    title: z.string().min(1).max(100),
    country: z.string().min(1).max(50),
    duration: z.string().optional(),
    roundCount: z.number().optional(),
    region: z.string().optional(),
    extraInfo: z.string().max(500).optional(),
  })).mutation(async ({ input, ctx }) => {
    const result = await generatePackageDescription(input);
    const db = await getDb();
    if (db) {
      await db.insert(aiInteractionLogs).values({
        userId: ctx.user.id,
        userName: ctx.user.name ?? "",
        query: anonymizeText(`상품설명 초안: ${input.title} (${input.country})`),
        response: result.description.slice(0, 500),
        modelName: "gemini-2.5-flash",
        isSuccess: true,
        taskType: "packageDesc",
        cacheHit: result.cacheHit,
        responseTimeMs: result.durationMs,
      });
    }
    return result;
  }),
  /**
   * 마케팅 문구 생성
   */
  generateMarketingCopy: adminProcedure.input(z.object({
    title: z.string().min(1).max(100),
    country: z.string().min(1).max(50),
    highlights: z.array(z.string()).max(5),
    targetAudience: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const result = await generateMarketingCopy(input);
    const db = await getDb();
    if (db) {
      await db.insert(aiInteractionLogs).values({
        userId: ctx.user.id,
        userName: ctx.user.name ?? "",
        query: anonymizeText(`마케팅 문구: ${input.title}`),
        response: result.sns.slice(0, 500),
        modelName: "gemini-2.5-flash",
        isSuccess: true,
        taskType: "marketingCopy",
        cacheHit: result.cacheHit,
        responseTimeMs: result.durationMs,
      });
    }
    return result;
  }),
  /**
   * 1:1 문의 답변 초안 생성
   */
  generateInquiryReply: adminProcedure.input(z.object({
    inquiryId: z.number(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.id, input.inquiryId));
    if (!inquiry) throw new TRPCError({ code: "NOT_FOUND", message: "문의를 찾을 수 없습니다." });
    const result = await generateInquiryReply({
      inquiryName: inquiry.name,
      inquiryMessage: inquiry.message ?? "",
      packageName: inquiry.packageName ?? undefined,
      travelDate: inquiry.travelDate ?? undefined,
      peopleCount: inquiry.peopleCount ?? undefined,
    });
    await db.insert(aiInteractionLogs).values({
      userId: ctx.user.id,
      userName: ctx.user.name ?? "",
      query: anonymizeText(`문의답변 초안: ${inquiry.name}님 문의`),
      response: result.reply.slice(0, 500),
      modelName: "gemini-2.5-flash",
      isSuccess: true,
      taskType: "inquiryReply",
      responseTimeMs: result.durationMs,
    });
    return result;
  }),
  /**
   * ERP 데이터 기반 Function Calling AI 분석
   */
  analyzeErpData: adminProcedure.input(z.object({
    question: z.string().min(1).max(500),
    dataType: z.enum(["packages", "bookings", "inquiries", "revenue"]),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    let data: unknown;
    let functionName = "";
    if (input.dataType === "packages") {
      data = await db.select({ id: packages.id, title: packages.title, country: packages.country, status: packages.status, isPopular: packages.isPopular, viewCount: packages.viewCount }).from(packages).orderBy(desc(packages.viewCount)).limit(20);
      functionName = "packages.list";
    } else if (input.dataType === "bookings") {
      data = await db.select({ count: sql<number>`count(*)`, status: bookings.status }).from(bookings).groupBy(bookings.status);
      functionName = "bookings.statusSummary";
    } else if (input.dataType === "inquiries") {
      data = await db.select({ count: sql<number>`count(*)`, status: inquiries.status }).from(inquiries).groupBy(inquiries.status);
      functionName = "inquiries.statusSummary";
    } else {
      data = await db.select({ month: sql<string>`DATE_FORMAT(createdAt, '%Y-%m')`, revenue: sql<string>`COALESCE(SUM(totalAmount), 0)` }).from(bookings).where(eq(bookings.paymentStatus, "paid")).groupBy(sql`DATE_FORMAT(createdAt, '%Y-%m')`).orderBy(sql`DATE_FORMAT(createdAt, '%Y-%m') DESC`).limit(6);
      functionName = "bookings.monthlyRevenue";
    }
    const result = await analyzeErpDataWithAI({ question: input.question, functionName, data });
    await db.insert(aiInteractionLogs).values({
      userId: ctx.user.id,
      userName: ctx.user.name ?? "",
      query: anonymizeText(input.question),
      response: result.answer.slice(0, 500),
      modelName: "gemini-2.5-flash",
      isSuccess: true,
      taskType: "devAnalysis",
      responseTimeMs: result.durationMs,
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
// MODEL ROUTING ROUTER - 모델 라우팅 규칙 관리
// ============================================================
const modelRoutingRouter = router({
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const dbRules = await db.select().from(modelRoutingRules);
    // DB에 없는 기본 태스크타입은 DEFAULT_MODEL_ROUTING에서 보완
    const taskTypes = ["chat", "packageDesc", "marketingCopy", "inquiryReply", "devAnalysis", "releaseNote", "featureDoc", "pipelineRec"] as const;
    return taskTypes.map(tt => {
      const dbRule = dbRules.find(r => r.taskType === tt);
      const defaultCfg = getModelConfig(tt);
      return dbRule ?? {
        id: 0,
        taskType: tt,
        primaryModel: defaultCfg.primaryModel,
        fallbackModel: defaultCfg.fallbackModel,
        maxTokens: defaultCfg.maxTokens,
        temperature: String(defaultCfg.temperature),
        cacheTtlSeconds: defaultCfg.cacheTtlSeconds,
        isActive: true,
        description: null,
        updatedAt: new Date(),
      };
    });
  }),
  upsert: adminProcedure.input(z.object({
    taskType: z.string().min(1).max(50),
    primaryModel: z.string().min(1).max(100),
    fallbackModel: z.string().max(100).optional(),
    maxTokens: z.number().optional(),
    temperature: z.string().optional(),
    cacheTtlSeconds: z.number().optional(),
    isActive: z.boolean().optional(),
    description: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const existing = await db.select({ id: modelRoutingRules.id }).from(modelRoutingRules).where(eq(modelRoutingRules.taskType, input.taskType));
    if (existing.length > 0) {
      await db.update(modelRoutingRules).set(input).where(eq(modelRoutingRules.taskType, input.taskType));
    } else {
      await db.insert(modelRoutingRules).values({ ...input, primaryModel: input.primaryModel });
    }
    return { success: true };
  }),
});
// ============================================================
// DEV AI ROUTER - 두골프 개발AI 관리
// =============================================================
const devAIRouter = router({
  listRequests: adminProcedure.input(z.object({
    page: z.number().default(1),
    limit: z.number().default(20),
    status: z.string().optional(),
    priority: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const offset = (input.page - 1) * input.limit;
    const conditions: ReturnType<typeof eq>[] = [];
    if (input.status) conditions.push(eq(devRequests.status, input.status));
    if (input.priority) conditions.push(eq(devRequests.priority, input.priority));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [items, totalResult] = await Promise.all([
      db.select().from(devRequests).where(where).orderBy(desc(devRequests.createdAt)).limit(input.limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(devRequests).where(where),
    ]);
    return { items, total: Number(totalResult[0]?.count ?? 0) };
  }),
  createRequest: adminProcedure.input(z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    priority: z.enum(["high", "medium", "low"]).default("medium"),
    featureId: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [result] = await db.insert(devRequests).values({
      title: input.title,
      description: input.description,
      priority: input.priority,
      featureId: input.featureId,
      createdBy: ctx.user.id,
      createdByName: ctx.user.name ?? "",
    });
    const newId = (result as any).insertId;
    // 백그라운드 AI 자동 분석 (응답 지연 없이 비동기 실행)
    setImmediate(async () => {
      try {
        const { analyzeDevRequest } = await import("./_core/geminiAIService.js");
        const analysis = await analyzeDevRequest(input.description);
        const dbInner = await getDb();
        if (dbInner && newId) {
          await dbInner.update(devRequests).set({
            aiCategory: analysis.category,
            aiSuggestedPriority: analysis.priority,
            estimatedHours: analysis.estimatedHours,
            suggestedTeam: analysis.suggestedTeam,
            aiAnalysis: `유형: ${analysis.category} | 우선순위: ${analysis.priority} | 예상공수: ${analysis.estimatedHours}h | 담당팀: ${analysis.suggestedTeam}\n\n${analysis.analysis}`,
            aiAnalyzed: true,
          }).where(eq(devRequests.id, newId));
        }
      } catch (e) {
        console.error("[createRequest] AI 자동 분석 실패:", e);
      }
    });
    return { id: newId, success: true };
  }),
  updateRequest: adminProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(["pending", "in_progress", "completed", "rejected"]).optional(),
    priority: z.enum(["high", "medium", "low"]).optional(),
    result: z.string().optional(),
    slackMessageTs: z.string().optional(),
    slackChannelId: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    await db.update(devRequests).set(data).where(eq(devRequests.id, id));
    return { success: true };
  }),
  deleteRequest: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(devRequests).where(eq(devRequests.id, input.id));
    return { success: true };
  }),
  sendToSlack: adminProcedure.input(z.object({
    requestId: z.number(),
    webhookUrl: z.string().url().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [req] = await db.select().from(devRequests).where(eq(devRequests.id, input.requestId));
    if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "요청을 찾을 수 없습니다." });
    const webhookUrl = input.webhookUrl ?? ENV.slackWebhookUrl;
    if (!webhookUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "Slack Webhook URL이 설정되지 않았습니다. 설정 페이지에서 Slack Webhook URL을 입력해 주세요." });
    const priorityEmoji: Record<string, string> = { high: "🔴", medium: "🟡", low: "🟢" };
    const statusEmoji: Record<string, string> = { pending: "⏳", in_progress: "🔧", completed: "✅", rejected: "❌" };
    const payload = {
      blocks: [
        { type: "header", text: { type: "plain_text", text: `🔧 두골프 개발요청 #${req.id}`, emoji: true } },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*제목:*\n${req.title}` },
            { type: "mrkdwn", text: `*우선순위:*\n${priorityEmoji[req.priority] ?? "⚪"} ${req.priority}` },
            { type: "mrkdwn", text: `*상태:*\n${statusEmoji[req.status] ?? "❓"} ${req.status}` },
            { type: "mrkdwn", text: `*요청자:*\n${req.createdByName ?? "알 수 없음"}` },
          ],
        },
        { type: "section", text: { type: "mrkdwn", text: `*내용:*\n${req.description}` } },
        ...(req.result ? [{ type: "section", text: { type: "mrkdwn", text: `*결과물:*\n${req.result}` } }] : []),
        { type: "context", elements: [{ type: "mrkdwn", text: `등록일: ${new Date(req.createdAt).toLocaleString("ko-KR")}` }] },
      ],
    };
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Slack 전송 실패: ${response.status}` });
    return { success: true };
  }),
  listFeatures: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(devFeatures).orderBy(asc(devFeatures.category), asc(devFeatures.name));
  }),
  createFeature: adminProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    category: z.string().default("system"),
    currentVersion: z.string().default("1.0.0"),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [result] = await db.insert(devFeatures).values(input);
    return { id: (result as any).insertId, success: true };
  }),
  updateFeature: adminProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    description: z.string().optional(),
    currentVersion: z.string().optional(),
    status: z.enum(["active", "deprecated", "experimental"]).optional(),
    category: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    await db.update(devFeatures).set(data).where(eq(devFeatures.id, id));
    return { success: true };
  }),
  listVersions: adminProcedure.input(z.object({
    featureId: z.number().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const where = input.featureId ? eq(devVersions.featureId, input.featureId) : undefined;
    return db.select().from(devVersions).where(where).orderBy(desc(devVersions.createdAt));
  }),
  createVersion: adminProcedure.input(z.object({
    featureId: z.number(),
    version: z.string().min(1),
    description: z.string().min(1),
    changeType: z.enum(["feature", "bugfix", "refactor", "hotfix"]).default("feature"),
    checkpointId: z.string().optional(),
    isRollbackable: z.boolean().default(true),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [result] = await db.insert(devVersions).values({
      ...input,
      createdBy: ctx.user.id,
      createdByName: ctx.user.name ?? "",
    });
    await db.update(devFeatures).set({ currentVersion: input.version }).where(eq(devFeatures.id, input.featureId));
    return { id: (result as any).insertId, success: true };
  }),
  // ── AI 지능형 분석 프로시저 ──────────────────────────────────────────────
  analyzeRequest: adminProcedure.input(z.object({
    description: z.string().min(1).max(2000),
  })).mutation(async ({ input }) => {
    const { analyzeDevRequest } = await import("./_core/geminiAIService.js");
    return analyzeDevRequest(input.description);
  }),

  createRequestFromNaturalLanguage: adminProcedure.input(z.object({
    userInput: z.string().min(1).max(500),
  })).mutation(async ({ input, ctx }) => {
    const { processNaturalLanguageRequest } = await import("./_core/geminiAIService.js");
    const parsed = await processNaturalLanguageRequest(input.userInput);
    // AI 분석도 함께 실행
    const { analyzeDevRequest } = await import("./_core/geminiAIService.js");
    const analysis = await analyzeDevRequest(parsed.description);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [result] = await db.insert(devRequests).values({
      title: parsed.title,
      description: parsed.description,
      priority: analysis.priority === "critical" ? "high" : analysis.priority,
      createdBy: ctx.user.id,
      createdByName: ctx.user.name ?? "",
      aiCategory: analysis.category,
      aiSuggestedPriority: analysis.priority,
      estimatedHours: analysis.estimatedHours,
      suggestedTeam: analysis.suggestedTeam,
      aiAnalysis: analysis.analysis,
      aiAnalyzed: true,
    });
    return { id: (result as any).insertId, success: true, parsed, analysis };
  }),

  generateReleaseNotes: adminProcedure.input(z.object({
    versionId: z.number(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [version] = await db.select().from(devVersions).where(eq(devVersions.id, input.versionId));
    if (!version) throw new TRPCError({ code: "NOT_FOUND", message: "버전을 찾을 수 없습니다." });
    // 해당 버전 이전에 완료된 요청 목록 조회 (최대 50개)
    const completed = await db
      .select({ title: devRequests.title, description: devRequests.description, aiCategory: devRequests.aiCategory })
      .from(devRequests)
      .where(eq(devRequests.status, "completed"))
      .orderBy(desc(devRequests.updatedAt))
      .limit(50);
    const { generateReleaseNotes } = await import("./_core/geminiAIService.js");
    const result = await generateReleaseNotes(
      version.version,
      version.description,
      completed.map(r => ({ title: r.title, description: r.description, category: r.aiCategory ?? "FEATURE" }))
    );
    return result;
  }),

  generateFeatureDoc: adminProcedure.input(z.object({
    featureId: z.number(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [feature] = await db.select().from(devFeatures).where(eq(devFeatures.id, input.featureId));
    if (!feature) throw new TRPCError({ code: "NOT_FOUND", message: "기능을 찾을 수 없습니다." });
    const { generateFeatureDocumentation } = await import("./_core/geminiAIService.js");
    const result = await generateFeatureDocumentation(feature.name, feature.description ?? "");
    return result;
  }),

  recommendPipeline: adminProcedure.input(z.object({
    errorDescription: z.string().min(1).max(500),
    affectedModules: z.array(z.string().max(50)).max(10).default([]),
  })).mutation(async ({ input }) => {
    const { generatePipelineRecommendation } = await import("./_core/geminiAIService.js");
    return generatePipelineRecommendation(input.errorDescription, input.affectedModules);
  }),

  dashboardStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [reqStats, featureStats, versionStats] = await Promise.all([
      db.select({ status: devRequests.status, count: sql<number>`count(*)` }).from(devRequests).groupBy(devRequests.status),
      db.select({ count: sql<number>`count(*)` }).from(devFeatures).where(eq(devFeatures.status, "active")),
      db.select({ count: sql<number>`count(*)` }).from(devVersions),
    ]);
    const reqByStatus = Object.fromEntries(reqStats.map(r => [r.status, Number(r.count)]));
    return {
      totalRequests: Object.values(reqByStatus).reduce((a, b) => a + b, 0),
      pendingRequests: reqByStatus["pending"] ?? 0,
      inProgressRequests: reqByStatus["in_progress"] ?? 0,
      completedRequests: reqByStatus["completed"] ?? 0,
      activeFeatures: Number(featureStats[0]?.count ?? 0),
      totalVersions: Number(versionStats[0]?.count ?? 0),
    };
  }),
});

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

// ─── n8n 자동화 Router ────────────────────────────────────
const automationRouter = router({
  /** n8n 웹훅 트리거 (상품 등록 시 SNS 자동 배포) */
  triggerPackagePublish: adminProcedure
    .input(z.object({
      packageId: z.number().int().positive(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [pkg] = await db.select().from(packages).where(eq(packages.id, input.packageId));
      if (!pkg) throw new TRPCError({ code: "NOT_FOUND" });

      const result = await triggerPackagePublishPipeline({
        id: pkg.id,
        title: pkg.title,
        country: pkg.country,
        region: pkg.region,
        imageUrl: pkg.imageUrl,
      });
      const { durationMs, responseStatus, error: errorMessage } = result;
      // 자동화 실행 이력 저장
      await db.insert(automationLogs).values({
        pipelineName: "package_sns_publish",
        triggerType: "manual",
        triggerEntityId: input.packageId,
        status: errorMessage ? "failed" : "success",
        webhookUrl: ENV.n8nWebhookUrl || "dev_mode",
        requestPayload: { packageId: pkg.id, title: pkg.title },
        responseStatus,
        errorMessage,
        durationMs,
      });

      if (errorMessage) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: errorMessage });
      }
      return { success: true, durationMs };
    }),

  /** 자동화 실행 이력 조회 */
  getLogs: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      packageId: z.number().int().positive().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = input.packageId
        ? [eq(automationLogs.triggerEntityId, input.packageId)]
        : [];
      return db.select().from(automationLogs)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(automationLogs.createdAt))
        .limit(input.limit);
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
      return {
        newErrors: newErrors.count,
        pendingFixes: pendingFixes.count,
        approvedFixes: approvedFixes.count,
        totalLogs: totalLogs.count,
        recentLogs,
      };
    }),
});

// AI 어시스턴트 라우터 임포트
import { aiRouter } from "./routers/ai";
import { devRequestRouter } from "./routers/devRequest";
import { chatRouter } from "./routers/chat";

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
  automation: automationRouter,
   aiDevEngine: aiDevEngineRouter,
  promptVersions: promptVersionsRouter,
  modelRouting: modelRoutingRouter,
  aiAssistant: aiRouter,
  devRequest: devRequestRouter,
  chat: chatRouter,
});
export type AppRouter = typeof appRouter;
