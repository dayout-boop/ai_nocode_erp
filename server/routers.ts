import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  packages, packagePrices, packageOptions, packageSlots,
  bookings, travelers, settlements, inquiries, notices, banners, customerMemos, users,
  packageImages
} from "../drizzle/schema";
import { eq, desc, and, gte, lte, like, sql, count, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { storagePut, storageGetSignedUrl } from "./storage";
import { optimizeImage, optimizeBase64Image } from "./imageOptimizer";
import { generateImage } from "./_core/imageGeneration";
import { ENV } from "./_core/env";

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
    sortOrder: z.number().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    await db.update(packages).set(data).where(eq(packages.id, id));
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
    search: z.string().optional(),
    limit: z.number().default(12),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { items: [] };
    const conditions: any[] = [eq(packages.status, "active")];
    if (input.country) conditions.push(eq(packages.country, input.country));
    if (input.featured) conditions.push(eq(packages.isFeatured, true));
    if (input.popular) conditions.push(eq(packages.isPopular, true));
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
    return { success: true };
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
});

export type AppRouter = typeof appRouter;
