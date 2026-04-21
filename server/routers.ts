import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  packages, packagePrices, packageOptions, packageSlots,
  bookings, travelers, settlements, inquiries, notices, banners, customerMemos, users
} from "../drizzle/schema";
import { eq, desc, and, gte, lte, like, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

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
      total: sql<string>`COALESCE(SUM(total_amount), 0)`
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
      month: sql<string>`DATE_FORMAT(created_at, '%Y-%m')`,
      revenue: sql<string>`COALESCE(SUM(total_amount), 0)`,
      bookingCount: count(),
    }).from(bookings)
      .where(and(
        eq(bookings.paymentStatus, "paid"),
        gte(bookings.createdAt, new Date(Date.now() - 180 * 24 * 60 * 60 * 1000))
      ))
      .groupBy(sql`DATE_FORMAT(created_at, '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(created_at, '%Y-%m')`);
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
    limit: z.number().default(12),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { items: [] };
    const conditions: any[] = [eq(packages.status, "active")];
    if (input.country) conditions.push(eq(packages.country, input.country));
    if (input.featured) conditions.push(eq(packages.isFeatured, true));
    const items = await db.select().from(packages).where(and(...conditions)).orderBy(packages.sortOrder, desc(packages.createdAt)).limit(input.limit);
    return { items };
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
