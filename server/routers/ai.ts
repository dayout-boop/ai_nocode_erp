/**
 * AI 어시스턴트 tRPC 라우터
 * - masterChat: 두골프 마스터 (관리자 전용)
 * - golfTalkChat: 골프톡 (공개 API, rate limit 적용)
 * - getLogs: AI 사용 로그 조회 (관리자 전용)
 * - getCostSummary: 일별/월별 AI 비용 집계 (관리자 전용)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, gte, sql, count, sum, inArray } from "drizzle-orm";
import { publicProcedure, protectedProcedure, partnerProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { aiLogs, packages, packageSlots, bookings, devRequests, chatSessions } from "../../drizzle/schema";
import { classifyIntent, fetchPackageContext, fetchReservationContext, compressHistory, fetchManagerContext } from "../services/rag";
import { orchestratorChat } from "../services/openrouter";
import { buildDogolfDevContext } from "../services/devContext";
import { MASTER_SYSTEM_PROMPT } from "../services/prompts/master";
import { GOLFTALK_SYSTEM_PROMPT, GOLFTALK_FALLBACK_MESSAGE } from "../services/prompts/golftalk";
import { checkRequestForBlockedKeywords, logRejectedRequest } from "../services/knowledgeFilter";

// Manus OAuth 기반 관리자 전용 프로시저 (masterChat 등 Manus 로그인 필요 기능)
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});
// ERP 마스터 세션 기반 프로시저 (admin_session 쿠키 인증 - Manus 로그인 불필요)
const erpLoginProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const adminSession = (ctx.req as any).adminSession;
  if (!adminSession) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '마스터 ERP 로그인이 필요합니다',
    });
  }
  return next({ ctx: { ...ctx, adminSession } });
});

// Rate limit 저장소 (인메모리, 프로세스 재시작 시 초기화)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxPerMinute = 20): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}

export const aiRouter = router({
  /**
   * 두골프 마스터 채팅 (관리자 인증 필수)
   * RAG 방식으로 DB 데이터를 컨텍스트에 주입하여 정확한 답변 제공
   */
  masterChat: adminProcedure
    .input(
      z.object({
        message: z.string().min(1).max(2000),
        sessionId: z.string().min(1).max(100),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .optional()
          .default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      // 1. 의도 분류 (RAG)
      const intent = classifyIntent(input.message);

      // 2. 컨텍스트 수집
      const contextParts: string[] = [];
      if (intent.needsPackages) {
        const pkgCtx = await fetchPackageContext(input.message);
        if (pkgCtx) contextParts.push(`[관련 상품 정보]\n${pkgCtx}`);
      }
      if (intent.needsReservations) {
        const resCtx = await fetchReservationContext(input.message);
        if (resCtx) contextParts.push(`[예약/정산 현황]\n${resCtx}`);
      }

      // 3. 대화 히스토리 압축 (5턴 이상)
      const compressedHistory = await compressHistory(input.sessionId, input.history);

      // 4. 시스템 프롬프트 + 컨텍스트 조합
      // [통합 일원화] 마스터 채팅(A 경로)에도 통합 개발 규칙/카탈로그를 주입해
      //   LLM이 기존 구조를 인지하고 중복 DB/기능을 제안하지 않도록 한다.
      const devCtx = buildDogolfDevContext();
      const baseWithDev = `${MASTER_SYSTEM_PROMPT}\n\n${devCtx}`;
      const systemWithContext =
        contextParts.length > 0
          ? `${baseWithDev}\n\n[현재 컨텍스트]\n${contextParts.join("\n\n")}`
          : baseWithDev;

      // 5. AI 호출
      const startTime = Date.now();
      let responseText = "";
      let modelUsed = "";
      let tokensIn = 0;
      let tokensOut = 0;
      let costUsd = 0;

      try {
        const result = await orchestratorChat({
          messages: [
            ...compressedHistory,
            { role: "user", content: input.message },
          ],
          complexity: intent.complexity === "high" ? "high" : intent.complexity === "low" ? "low" : "medium",
          assistant: "master",
          sessionId: input.sessionId,
          userId: ctx.user.id,
          systemPrompt: systemWithContext,
        });
        responseText = result.text;
        modelUsed = result.model;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        costUsd = result.costUsd;
      } catch (err) {
        console.error("[masterChat] AI 호출 실패:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 응답 생성에 실패했습니다." });
      }

      // 6. 사용자 메시지 로그 저장
      await db.insert(aiLogs).values({
        sessionId: input.sessionId,
        userId: ctx.user.id,
        assistant: "master",
        role: "user",
        content: input.message,
        modelUsed,
        tokensIn: 0,
        tokensOut: 0,
        costUsd: "0",
        grounded: false,
      });

      // 7. 어시스턴트 응답 로그 저장
      await db.insert(aiLogs).values({
        sessionId: input.sessionId,
        userId: ctx.user.id,
        assistant: "master",
        role: "assistant",
        content: responseText,
        modelUsed,
        tokensIn,
        tokensOut,
        costUsd: String(costUsd),
        grounded: false,
      });

      // 8. 개발 요청 자동 감지
      let devRequestSuggestion = null;
      if (intent.needsDevRequest) {
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.type === "dev_request") {
              devRequestSuggestion = parsed;
            }
          } catch {
            // JSON 파싱 실패 시 무시
          }
        }
      }

      return {
        response: responseText,
        model: modelUsed,
        tokensIn,
        tokensOut,
        costUsd,
        durationMs: Date.now() - startTime,
        devRequestSuggestion,
      };
    }),

  /**
   * 골프톡 채팅 (인증 불필요, rate limit 적용)
   * 고객 상담 AI - 상품 정보 컨텍스트 자동 주입
   */
  golfTalkChat: publicProcedure
    .input(
      z.object({
        message: z.string().min(1).max(1000),
        sessionId: z.string().min(1).max(100),
        packageId: z.number().optional(),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .optional()
          .default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Rate limit 체크 (IP 기반)
      const ip = (ctx.req.headers["x-forwarded-for"] as string) || ctx.req.socket?.remoteAddress || "unknown";
      if (!checkRateLimit(ip, 20)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        });
      }

      // 차단 키워드 검사 (전역 규칙 적용 — 골프톡은 tenantId 없이 전역만)
      const blockCheck = await checkRequestForBlockedKeywords(input.message);
      if (blockCheck.rejected) {
        await logRejectedRequest(blockCheck, { sessionId: input.sessionId, source: "golftalk" });
        return {
          response: "죄송합니다. 해당 요청은 처리할 수 없는 내용이 포함되어 있습니다. 골프 투어 관련 문의를 입력해 주세요.",
          model: "blocked",
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
        };
      }

      const db = await getDb();
      if (!db) {
        return { response: GOLFTALK_FALLBACK_MESSAGE, model: "fallback", tokensIn: 0, tokensOut: 0, costUsd: 0 };
      }

      // 패키지 컨텍스트 주입
      let systemWithContext = GOLFTALK_SYSTEM_PROMPT;
      if (input.packageId) {
        const [pkg] = await db.select().from(packages).where(eq(packages.id, input.packageId)).limit(1);
        if (pkg) {
          systemWithContext += `\n\n[현재 문의 상품]\n상품명: ${pkg.title}\n국가: ${pkg.country}\n기간: ${pkg.duration ?? "미정"}\n라운드: ${pkg.roundCount}회\n설명: ${pkg.description ?? ""}`;
        }
      } else {
        // 일반 상품 컨텍스트
        const pkgCtx = await fetchPackageContext(input.message);
        if (pkgCtx) systemWithContext += `\n\n[추천 가능 상품]\n${pkgCtx}`;
      }

      // AI 호출
      let responseText = GOLFTALK_FALLBACK_MESSAGE;
      let modelUsed = "";
      let tokensIn = 0;
      let tokensOut = 0;
      let costUsd = 0;

      try {
        const result = await orchestratorChat({
          messages: [
            ...input.history.slice(-6), // 최근 6턴만 유지
            { role: "user", content: input.message },
          ],
          complexity: "low",
          assistant: "golftalk",
          sessionId: input.sessionId,
          systemPrompt: systemWithContext,
        });
        responseText = result.text;
        modelUsed = result.model;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        costUsd = result.costUsd;
      } catch (err) {
        console.error("[golfTalkChat] AI 호출 실패:", err);
        responseText = GOLFTALK_FALLBACK_MESSAGE;
      }

      // 로그 저장 (비동기, 실패해도 응답에 영향 없음)
      db.insert(aiLogs)
        .values([
          {
            sessionId: input.sessionId,
            userId: null,
            assistant: "golftalk",
            role: "user",
            content: input.message,
            modelUsed,
            tokensIn: 0,
            tokensOut: 0,
            costUsd: "0",
            grounded: false,
          },
          {
            sessionId: input.sessionId,
            userId: null,
            assistant: "golftalk",
            role: "assistant",
            content: responseText,
            modelUsed,
            tokensIn,
            tokensOut,
            costUsd: String(costUsd),
            grounded: false,
          },
        ])
        .catch((e) => console.error("[golfTalkChat] 로그 저장 실패:", e));

      // Generative UI 마커 파싱
      type UiCard =
        | { type: "product_cards"; packages: Array<{ id: number; title: string; country: string; duration: string | null; roundCount: number | null; imageUrl: string | null; isPopular: boolean; slots: Array<{ id: number; departureDate: string; returnDate: string | null; totalSlots: number; bookedSlots: number; adultPrice: string | null; status: string }> }> }
        | { type: "booking_form"; packageId: number; packageTitle: string | null }
        | { type: "booking_lookup" };

      let uiCard: UiCard | null = null;
      let cleanResponse = responseText;

      // [UI:PRODUCT_CARDS:id1,id2,id3]
      const productMatch = responseText.match(/\[UI:PRODUCT_CARDS:([\d,]+)\]/);
      if (productMatch) {
        cleanResponse = responseText.replace(/\[UI:PRODUCT_CARDS:[\d,]+\]/, "").trim();
        const ids = productMatch[1].split(",").map(Number).filter(Boolean).slice(0, 6);
        if (ids.length > 0) {
          try {
            const pkgRows = await db.select({
              id: packages.id,
              title: packages.title,
              country: packages.country,
              duration: packages.duration,
              roundCount: packages.roundCount,
              imageUrl: packages.imageUrl,
              isPopular: packages.isPopular,
            }).from(packages).where(inArray(packages.id, ids)).limit(6);

            const slotsRows = await db.select({
              id: packageSlots.id,
              packageId: packageSlots.packageId,
              departureDate: packageSlots.departureDate,
              returnDate: packageSlots.returnDate,
              totalSlots: packageSlots.totalSlots,
              bookedSlots: packageSlots.bookedSlots,
              adultPrice: packageSlots.adultPrice,
              status: packageSlots.status,
            }).from(packageSlots)
              .where(and(inArray(packageSlots.packageId, ids), eq(packageSlots.status, "open")))
              .orderBy(packageSlots.departureDate)
              .limit(30);

            const slotsByPkg = slotsRows.reduce<Record<number, typeof slotsRows>>((acc, s) => {
              if (!acc[s.packageId]) acc[s.packageId] = [];
              acc[s.packageId].push(s);
              return acc;
            }, {});

            uiCard = {
              type: "product_cards",
              packages: pkgRows.map((p) => ({
                ...p,
                isPopular: Boolean(p.isPopular),
                slots: (slotsByPkg[p.id] ?? []).slice(0, 5).map((s) => ({
                  id: s.id,
                  departureDate: s.departureDate instanceof Date ? s.departureDate.toISOString() : String(s.departureDate),
                  returnDate: s.returnDate instanceof Date ? s.returnDate.toISOString() : (s.returnDate ? String(s.returnDate) : null),
                  totalSlots: s.totalSlots ?? 0,
                  bookedSlots: s.bookedSlots ?? 0,
                  adultPrice: s.adultPrice ?? null,
                  status: s.status ?? "open",
                })),
              })),
            };
          } catch (e) {
            console.error("[golfTalkChat] product cards 조회 실패:", e);
          }
        }
      }

      // [UI:BOOKING_FORM:packageId]
      const bookingFormMatch = responseText.match(/\[UI:BOOKING_FORM:(\d+)\]/);
      if (!uiCard && bookingFormMatch) {
        cleanResponse = responseText.replace(/\[UI:BOOKING_FORM:\d+\]/, "").trim();
        const pkgId = Number(bookingFormMatch[1]);
        let pkgTitle: string | null = null;
        if (pkgId > 0) {
          try {
            const [p] = await db.select({ title: packages.title }).from(packages).where(eq(packages.id, pkgId)).limit(1);
            pkgTitle = p?.title ?? null;
          } catch {}
        }
        uiCard = { type: "booking_form", packageId: pkgId, packageTitle: pkgTitle };
      }

      // [UI:BOOKING_LOOKUP]
      if (!uiCard && responseText.includes("[UI:BOOKING_LOOKUP]")) {
        cleanResponse = responseText.replace("[UI:BOOKING_LOOKUP]", "").trim();
        uiCard = { type: "booking_lookup" };
      }

      return { response: cleanResponse, model: modelUsed, tokensIn, tokensOut, costUsd, uiCard };
    }),

  /**
   * AI 사용 로그 조회 (관리자 전용)
   */
  getLogs: erpLoginProcedure
    .input(
      z.object({
        assistant: z.enum(["master", "golftalk", "manager", "all"]).default("all"),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = input.assistant !== "all" ? [eq(aiLogs.assistant, input.assistant)] : [];
      const logs = await db
        .select()
        .from(aiLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(aiLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [total] = await db
        .select({ count: count() })
        .from(aiLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { logs, total: total.count };
    }),

  /**
   * AI 비용 집계 (관리자 전용)
   */
  getCostSummary: erpLoginProcedure
    .input(
      z.object({
        period: z.enum(["today", "week", "month"]).default("month"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const now = new Date();
      let fromDate: Date;
      if (input.period === "today") {
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (input.period === "week") {
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const rows = await db
        .select({
          assistant: aiLogs.assistant,
          totalCost: sql<number>`SUM(CAST(${aiLogs.costUsd} AS DECIMAL(10,6)))`,
          totalTokensIn: sql<number>`SUM(${aiLogs.tokensIn})`,
          totalTokensOut: sql<number>`SUM(${aiLogs.tokensOut})`,
          messageCount: count(),
        })
        .from(aiLogs)
        .where(gte(aiLogs.createdAt, fromDate))
        .groupBy(aiLogs.assistant);

      const totalCost = rows.reduce((acc, r) => acc + Number(r.totalCost ?? 0), 0);
      const totalMessages = rows.reduce((acc, r) => acc + Number(r.messageCount ?? 0), 0);

      return { rows, totalCost, totalMessages, period: input.period };
    }),

  /**
   * 두골프 매니저 채팅 (파트너 인증 필수)
   * 입점사 파트너 전용 AI 상담
   */
  managerChat: partnerProcedure
    .input(
      z.object({
        message: z.string().min(1).max(1000),
        sessionId: z.string().min(1).max(100),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .optional()
          .default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      // 테넌트 격리: context.ts에서 강제 주입된 tenantId만 사용 (헤더 위조 불가)
      // - 파트너 세션: 본인 tenantId
      // - 마스터 세션: activeTenantId(전체보기=null)
      const tenantId: number | null = ctx.tenantId ?? null;
      const tenantUserId: number = ctx.user?.id ?? ctx.partnerStaff?.staffId ?? ctx.partnerOwner?.partnerId ?? 0;

      const { MANAGER_SYSTEM_PROMPT } = await import("../services/prompts/manager");

      // RAG: 테넌트 격리된 실제 DB 컨텍스트 주입 → 할루시네이션 방지
      let ragContext = "";
      try {
        ragContext = await fetchManagerContext({ tenantId, message: input.message });
      } catch (e) {
        console.error("[managerChat] RAG 컨텍스트 조회 실패:", e);
      }

      const systemPrompt = ragContext
        ? `${MANAGER_SYSTEM_PROMPT}\n\n═══ [실시간 DB 데이터 — 이 데이터만 사실로 인용] ═══\n${ragContext}`
        : MANAGER_SYSTEM_PROMPT;

      const messages: import("../services/openrouter").ChatMessage[] = [
        ...input.history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
        { role: "user" as const, content: input.message },
      ];

      const startTime = Date.now();
      let responseText = "죄송합니다. 잠시 후 다시 시도해 주세요.";
      let modelUsed = "";
      let tokensIn = 0;
      let tokensOut = 0;
      let costUsd = 0;

      try {
        const result = await orchestratorChat({
          messages,
          complexity: "medium",
          assistant: "manager",
          sessionId: input.sessionId,
          userId: tenantUserId,
          systemPrompt,
        });
        responseText = result.text;
        modelUsed = result.model;
        tokensIn = result.tokensIn;
        tokensOut = result.tokensOut;
        costUsd = result.costUsd;
      } catch (err) {
        console.error("[managerChat] AI 호출 실패:", err);
      }

      // 로그 저장
      db.insert(aiLogs)
        .values([
          {
            sessionId: input.sessionId,
            userId: tenantUserId,
            assistant: "manager",
            role: "user",
            content: input.message,
            modelUsed,
            tokensIn: 0,
            tokensOut: 0,
            costUsd: "0",
            grounded: false,
          },
          {
            sessionId: input.sessionId,
            userId: tenantUserId,
            assistant: "manager",
            role: "assistant",
            content: responseText,
            modelUsed,
            tokensIn,
            tokensOut,
            costUsd: String(costUsd),
            grounded: false,
          },
        ])
        .catch((e) => console.error("[managerChat] 로그 저장 실패:", e));

      // ─── Generative UI 마커 파싱 ───────────────────────────────────────
      type ManagerUiCard =
        | { type: "product_cards"; packages: Array<{ id: number; title: string; country: string; duration: string | null; roundCount: number | null; imageUrl: string | null; isPopular: boolean; slots: Array<{ id: number; departureDate: string; returnDate: string | null; totalSlots: number; bookedSlots: number; adultPrice: string | null; depositPrice: string | null; affiliatePrice: string | null; status: string }> }> }
        | { type: "booking_form"; packageId: number; packageTitle: string | null }
        | { type: "reservation_status"; bookings: Array<{ id: number; bookingNumber: string; leaderName: string; leaderPhone: string; packageTitle: string | null; departureDate: string | null; adultCount: number; totalAmount: string | null; status: string; createdAt: Date }> };

      let uiCard: ManagerUiCard | null = null;
      let cleanResponse = responseText;

      // [UI:PRODUCT_CARDS:id1,id2,id3]
      const productMatch = responseText.match(/\[UI:PRODUCT_CARDS:([\d,]+)\]/);
      if (productMatch) {
        cleanResponse = responseText.replace(/\[UI:PRODUCT_CARDS:[\d,]+\]/, "").trim();
        const ids = productMatch[1].split(",").map(Number).filter(Boolean).slice(0, 6);
        if (ids.length > 0) {
          try {
            const pkgRows = await db.select({
              id: packages.id,
              title: packages.title,
              country: packages.country,
              duration: packages.duration,
              roundCount: packages.roundCount,
              imageUrl: packages.imageUrl,
              isPopular: packages.isPopular,
            }).from(packages).where(inArray(packages.id, ids)).limit(6);

            const slotsRows = await db.select({
              id: packageSlots.id,
              packageId: packageSlots.packageId,
              departureDate: packageSlots.departureDate,
              returnDate: packageSlots.returnDate,
              totalSlots: packageSlots.totalSlots,
              bookedSlots: packageSlots.bookedSlots,
              adultPrice: packageSlots.adultPrice,
              adultDepositPrice: packageSlots.adultDepositPrice,
              adultAffiliatePrice: packageSlots.adultAffiliatePrice,
              status: packageSlots.status,
            }).from(packageSlots)
              .where(and(inArray(packageSlots.packageId, ids), eq(packageSlots.status, "open")))
              .orderBy(packageSlots.departureDate)
              .limit(30);

            const slotsByPkg = slotsRows.reduce<Record<number, typeof slotsRows>>((acc, s) => {
              if (!acc[s.packageId]) acc[s.packageId] = [];
              acc[s.packageId].push(s);
              return acc;
            }, {});

            uiCard = {
              type: "product_cards",
              packages: pkgRows.map((p) => ({
                ...p,
                isPopular: Boolean(p.isPopular),
                slots: (slotsByPkg[p.id] ?? []).slice(0, 5).map((s) => ({
                  id: s.id,
                  departureDate: s.departureDate instanceof Date ? s.departureDate.toISOString() : String(s.departureDate),
                  returnDate: s.returnDate instanceof Date ? s.returnDate.toISOString() : (s.returnDate ? String(s.returnDate) : null),
                  totalSlots: s.totalSlots ?? 0,
                  bookedSlots: s.bookedSlots ?? 0,
                  adultPrice: s.adultPrice ?? null,
                  depositPrice: s.adultDepositPrice ?? null,
                  affiliatePrice: s.adultAffiliatePrice ?? null,
                  status: s.status ?? "open",
                })),
              })),
            };
          } catch (e) {
            console.error("[managerChat] product cards 조회 실패:", e);
          }
        }
      }

      // [UI:BOOKING_FORM:packageId]
      const bookingFormMatch = responseText.match(/\[UI:BOOKING_FORM:(\d+)\]/);
      if (!uiCard && bookingFormMatch) {
        cleanResponse = responseText.replace(/\[UI:BOOKING_FORM:\d+\]/, "").trim();
        const pkgId = Number(bookingFormMatch[1]);
        let pkgTitle: string | null = null;
        if (pkgId > 0) {
          try {
            const [p] = await db.select({ title: packages.title }).from(packages).where(eq(packages.id, pkgId)).limit(1);
            pkgTitle = p?.title ?? null;
          } catch {}
        }
        uiCard = { type: "booking_form", packageId: pkgId, packageTitle: pkgTitle };
      }

      // [UI:RESERVATION_STATUS]
      if (!uiCard && responseText.includes("[UI:RESERVATION_STATUS]")) {
        cleanResponse = responseText.replace("[UI:RESERVATION_STATUS]", "").trim();
        try {
          const recentBookings = await db.select({
            id: bookings.id,
            bookingNumber: bookings.bookingNumber,
            leaderName: bookings.leaderName,
            leaderPhone: bookings.leaderPhone,
            packageId: bookings.packageId,
            departureDate: bookings.departureDate,
            adultCount: bookings.adultCount,
            totalAmount: bookings.totalAmount,
            status: bookings.status,
            createdAt: bookings.createdAt,
          }).from(bookings)
            .where(tenantId ? eq(bookings.tenantId, tenantId) : undefined)
            .orderBy(desc(bookings.createdAt))
            .limit(10);

          const pkgIds = Array.from(new Set(recentBookings.map((b) => b.packageId).filter(Boolean))) as number[];
          const pkgTitles: Record<number, string> = {};
          if (pkgIds.length > 0) {
            const pkgRows = await db.select({ id: packages.id, title: packages.title })
              .from(packages).where(inArray(packages.id, pkgIds));
            pkgRows.forEach((p) => { pkgTitles[p.id] = p.title; });
          }

          uiCard = {
            type: "reservation_status",
            bookings: recentBookings.map((b) => ({
              id: b.id,
              bookingNumber: b.bookingNumber ?? `BK-${b.id}`,
              leaderName: b.leaderName ? b.leaderName.slice(0, 1) + "**" : "미상",
              leaderPhone: b.leaderPhone ? b.leaderPhone.slice(0, 3) + "-****-" + b.leaderPhone.slice(-4) : "",
              packageTitle: b.packageId ? (pkgTitles[b.packageId] ?? null) : null,
              departureDate: b.departureDate instanceof Date ? b.departureDate.toISOString() : (b.departureDate ? String(b.departureDate) : null),
              adultCount: b.adultCount ?? 0,
              totalAmount: b.totalAmount ?? null,
              status: b.status ?? "pending",
              createdAt: b.createdAt ?? new Date(),
            })),
          };
        } catch (e) {
          console.error("[managerChat] reservation status 조회 실패:", e);
        }
      }

      return { response: cleanResponse, model: modelUsed, tokensIn, tokensOut, costUsd, durationMs: Date.now() - startTime, uiCard };
    }),

  /**
   * 파트너 온보딩 AI 채팅 (신규 파트너 전용, 인증 불필요)
   * - 대화로 정보 수집 후 JSON 구조화 데이터 반환
   * - 수기 입력 필드 자동 채움에 사용
   */
  onboardingChat: publicProcedure
    .input(
      z.object({
        message: z.string().min(1).max(1000),
        sessionId: z.string().min(1).max(100),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .optional()
          .default([]),
        currentStep: z.number().min(1).max(4).default(1),
        collectedData: z.object({
          contactName: z.string().optional(),
          contactEmail: z.string().optional(),
          contactPhone: z.string().optional(),
          companyName: z.string().optional(),
          subscriptionPlan: z.enum(["starter", "standard", "premium"]).optional(),
          billingCycle: z.enum(["monthly", "yearly"]).optional(),
          sampleCategory: z.enum(["golf_tour_domestic", "golf_tour_overseas", "golf_tour_mixed"]).optional(),
        }).optional().default({}),
      })
    )
    .mutation(async ({ input }) => {
      const collected = input.collectedData;
      const alreadyKnown: string[] = [];
      if (collected.contactName) alreadyKnown.push(`담당자명: ${collected.contactName}`);
      if (collected.contactEmail) alreadyKnown.push(`이메일: ${collected.contactEmail}`);
      if (collected.contactPhone) alreadyKnown.push(`전화번호: ${collected.contactPhone}`);
      if (collected.companyName) alreadyKnown.push(`업체명: ${collected.companyName}`);

      const ONBOARDING_SYSTEM_PROMPT = `당신은 두골프(DayOutGolf) 파트너 온보딩 전담 AI 매니저입니다.
신규 파트너가 구글 로그인 후 첫 만나는 AI입니다. 친절하고 전문적으로 안내하세요.

## 온보딩 단계
- Step 1: 담당자 연락처 수집 (담당자명, 이메일, 전화번호, 업체명)
- Step 2: 사업자등록증 + 관광사업자등록증 OCR 업로드 안내
- Step 3: 구독 플랜 선택 안내 (스타터 무료 / 스탠다드 99,000원 / 프리미엄 299,000원)
- Step 4: 완료 안내

## 현재 수집된 정보
${JSON.stringify(input.collectedData, null, 2)}

${alreadyKnown.length > 0 ? `## ⚠️ 중요: 이미 확인된 정보
${alreadyKnown.join('\n')}

위 정보는 이미 확인된 값입니다. 사용자가 수정을 요청하지 않는 한 이 값을 그대로 사용하세요.
이미 알고 있는 정보를 다시 확인하거나 재입력을 요청하지 마세요.
` : ''}
## 현재 단계: Step ${input.currentStep}

## 응답 규칙
1. 항상 한국어로 친절하게 답변하세요.
2. 이미 수집된 정보는 다시 묻지 마세요. 필요한 정보만 수집하세요.
3. 정보를 수집할 때는 자연스러운 대화로 진행하세요.
4. **정보가 수집되거나 단계 전환이 필요하면 응답 마지막에 반드시 아래 JSON 블록을 포함하세요:**

\`\`\`json
{
  "action": "fill",
  "fields": {
    "contactName": "홍길동",
    "contactEmail": "hong@example.com",
    "contactPhone": "010-1234-5678",
    "companyName": "투어컴퍼니"
  },
  "nextStep": 2,
  "stepComplete": true
}
\`\`\`

5. 정보가 없으면 JSON 블록을 생략하세요.

## 단계별 행동 지침

### Step 1 (현재 단계가 1인 경우)
- 담당자명, 이메일, 전화번호, 업체명을 수집하세요. 이미 수집된 항목은 건너뛰세요.
- **담당자명과 이메일이 모두 수집되면 즉시 stepComplete: true, nextStep: 2를 반환하세요.**
- 사용자가 "다음", "완료", "저장", "넘어가" 등을 말하면 수집된 정보로 stepComplete: true, nextStep: 2를 반환하세요.

### Step 2 (현재 단계가 2인 경우)
- 사업자등록증과 관광사업자등록증 업로드를 안내하세요.
- 두 등록증 모두 업로드 시 즉시 자동 승인됨을 강조하세요.
- 채팅창 하단의 📄 사업자등록증 / 🏌️ 관광사업자등록증 버튼으로 업로드 가능함을 안내하세요.
- 사용자가 "스킵", "건너뛰기", "나중에", "패스"를 말하면 최소 하나는 업로드해야 다음 단계로 진행 가능함을 안내하세요.
- 사용자가 "다음", "플랜 선택"을 말하면 stepComplete: true, nextStep: 3을 반환하세요.

### Step 3 (현재 단계가 3인 경우)
- 플랜 선택을 도와주세요. 스타터(무료)를 먼저 추천하세요.
- 사용자가 플랜을 선택하면 해당 플랜을 fields.subscriptionPlan에 반영하고 stepComplete: true, nextStep: 4를 반환하세요.
- 스타터 선택 시 "무료로 시작" 버튼을 누르면 가입 완료됨을 안내하세요.

### Step 4 (현재 단계가 4인 경우)
- 가입 완료 축하 메시지를 전달하세요.
- 파트너 로그인 URL: /partner/login 으로 안내하세요.

10. 사용자가 이름을 수정하면 즉시 JSON fields에 반영하세요 (예: "김xx라고 해"라고 하면 contactName: "김xx"로 업데이트).`;

      const messages: import("../services/openrouter").ChatMessage[] = [
        ...input.history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
        { role: "user" as const, content: input.message },
      ];

      let responseText = "죄송합니다. 잠시 후 다시 시도해 주세요.";
      let extractedFields: Record<string, unknown> = {};
      let nextStep: number | null = null;
      let stepComplete = false;

      try {
        const result = await orchestratorChat({
          messages,
          complexity: "low",
          assistant: "manager",
          sessionId: input.sessionId,
          systemPrompt: ONBOARDING_SYSTEM_PROMPT,
        });
        responseText = result.text;

        // JSON 블록 추출
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1].trim());
            if (parsed.action === "fill") {
              extractedFields = parsed.fields || {};
              nextStep = parsed.nextStep || null;
              stepComplete = parsed.stepComplete || false;
            }
            // JSON 블록을 응답 텍스트에서 제거
            responseText = responseText.replace(/```json[\s\S]*?```/, "").trim();
          } catch {
            // JSON 파싱 실패 시 무시
          }
        }
      } catch (err) {
        console.error("[onboardingChat] AI 호출 실패:", err);
      }

      return {
        response: responseText,
        extractedFields,
        nextStep,
        stepComplete,
      };
    }),

  /**
   * 세션별 대화 내역 조회
   */
  getSessionMessages: erpLoginProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select()
        .from(aiLogs)
        .where(eq(aiLogs.sessionId, input.sessionId))
        .orderBy(aiLogs.createdAt);
    }),

  /**
   * Human-in-the-Loop 도구 승인 후 스트림 재개
   * 클라이언트는 approvalId를 받아 /api/master-stream-resume로 직접 SSE 연결
   * 이 프로시저는 approvalId 검증 로직만 수행하고 클라이언트에 전달
   */
  approveToolCall: erpLoginProcedure
    .input(z.object({ approvalId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      // SSE 스트림 재개는 클라이언트가 approvalId를 받아
      // 직접 POST /api/master-stream-resume 로 연결하는 방식으로 동작
      // 이 프로시저는 승인 의도를 클라이언트에서 서버로 전달하는 중개 역할
      return { approvalId: input.approvalId, approved: true };
    }),
});
