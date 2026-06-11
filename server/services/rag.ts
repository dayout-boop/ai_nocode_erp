/**
 * RAG (Retrieval Augmented Generation) 유틸리티
 *
 * 키워드 기반 의도 분류 및 DB 컨텍스트 조회
 * 추가 AI 호출 없이 처리하여 토큰 비용 절감
 */
import { like, desc, eq, and, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { packages, bookings, settlements, incomeRecords } from "../../drizzle/schema";
import type { ChatMessage } from "./openrouter";

// ────────────────────────────────────────────────────────────────────────────
// 의도 분류
// ────────────────────────────────────────────────────────────────────────────

const PACKAGE_KEYWORDS = ["패키지", "상품", "코스", "여행", "골프장", "투어", "상품명", "추천"];
const RESERVATION_KEYWORDS = ["예약", "정산", "결제", "취소", "환불", "예약자", "입금", "미수금"];
const DEV_KEYWORDS = ["개발", "수정", "추가", "버그", "오류", "에러", "기능", "구현", "배포", "업데이트"];
const STATS_KEYWORDS = ["통계", "현황", "얼마", "몇 건", "몇 개", "집계", "합계", "총", "이번 달", "오늘"];

export interface IntentResult {
  needsPackages: boolean;
  needsReservations: boolean;
  needsDevRequest: boolean;
  needsStats: boolean;
  complexity: "high" | "medium" | "low";
}

export function classifyIntent(message: string): IntentResult {
  const lower = message.toLowerCase();

  const needsPackages = PACKAGE_KEYWORDS.some((kw) => lower.includes(kw));
  const needsReservations = RESERVATION_KEYWORDS.some((kw) => lower.includes(kw));
  const needsDevRequest = DEV_KEYWORDS.some((kw) => lower.includes(kw));
  const needsStats = STATS_KEYWORDS.some((kw) => lower.includes(kw));

  // 복잡도 결정
  let complexity: "high" | "medium" | "low" = "medium";
  if (needsDevRequest || needsStats || message.length > 300) {
    complexity = "high";
  } else if (!needsPackages && !needsReservations && message.length < 100) {
    complexity = "low";
  }

  return { needsPackages, needsReservations, needsDevRequest, needsStats, complexity };
}

// ────────────────────────────────────────────────────────────────────────────
// 민감정보 마스킹
// ────────────────────────────────────────────────────────────────────────────

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  return phone.replace(/(\d{3})-?(\d{3,4})-?(\d{4})/, "$1-****-$3");
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "-";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const masked = local.slice(0, 2) + "***";
  return `${masked}@${domain}`;
}

export function maskCardNumber(card: string | null | undefined): string {
  if (!card) return "-";
  return "****-****-****-****";
}

// ────────────────────────────────────────────────────────────────────────────
// 패키지 컨텍스트 조회
// ────────────────────────────────────────────────────────────────────────────

export async function fetchPackageContext(message: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    // 메시지에서 국가/지역 키워드 추출
    const countryKeywords: Record<string, string> = {
      태국: "thailand",
      베트남: "vietnam",
      필리핀: "philippines",
      일본: "japan",
      중국: "china",
      한국: "korea",
      발리: "indonesia",
      인도네시아: "indonesia",
    };

    let countryFilter: string | null = null;
    for (const [ko, en] of Object.entries(countryKeywords)) {
      if (message.includes(ko)) {
        countryFilter = en;
        break;
      }
    }

    const query = db
      .select({
        id: packages.id,
        title: packages.title,
        country: packages.country,
        duration: packages.duration,
        roundCount: packages.roundCount,
        description: packages.description,
        isPopular: packages.isPopular,
      })
      .from(packages)
      .where(
        and(
          eq(packages.status, "active"),
          countryFilter ? eq(packages.country, countryFilter) : undefined
        )
      )
      .orderBy(desc(packages.isPopular))
      .limit(3);

    const pkgs = await query;
    if (pkgs.length === 0) return "";

    return pkgs
      .map(
        (p) =>
          `- [ID:${p.id}] ${p.title} | 국가: ${p.country} | 기간: ${p.duration ?? "미정"} | 라운드: ${p.roundCount}회 | ${p.isPopular ? "⭐인기" : ""}`
      )
      .join("\n");
  } catch (err) {
    console.error("[RAG] fetchPackageContext 실패:", err);
    return "";
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 예약/자금 컨텍스트 조회 (민감정보 마스킹 적용)
// 주의: 이 함수는 bookings(통합조회 보조 테이블) 최근 10건 + income_records(자금 정본)
//       미매칭 요약을 함께 반환합니다. 정확한 자금 수치는 get_income_match_summary 도구를
//       통해 LLM이 직접 집계하도록 유도합니다(여기 수치는 컨텍스트 힌트 용도).
// ────────────────────────────────────────────────────────────────────────────

export async function fetchReservationContext(message: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
    // 자금(income_records) 미매칭 요약 — 자금 대사/미매칭 질의 대응
    let incomeSummaryLine = "";
    try {
      const [incomeAgg] = await db
        .select({
          unmatchedCount: sql<number>`SUM(CASE WHEN matchStatus = 'unmatched' THEN 1 ELSE 0 END)`,
          unmatchedAmount: sql<number>`COALESCE(SUM(CASE WHEN matchStatus = 'unmatched' THEN amount ELSE 0 END), 0)`,
          totalCount: sql<number>`COUNT(*)`,
        })
        .from(incomeRecords);
      if (incomeAgg) {
        incomeSummaryLine =
          `\n[자금 정본(income_records) 요약] 총 ${Number(incomeAgg.totalCount ?? 0).toLocaleString()}건 중 ` +
          `미매칭 ${Number(incomeAgg.unmatchedCount ?? 0).toLocaleString()}건` +
          ` (미매칭 금액 ${Number(incomeAgg.unmatchedAmount ?? 0).toLocaleString()}원). ` +
          `정확한 테넌트별 집계는 get_income_match_summary 도구를 사용하세요.`;
      }
    } catch (e) {
      console.error("[RAG] income 요약 조회 실패:", e);
    }

    const recentBookings = await db
      .select({
        id: bookings.id,
        bookingNumber: bookings.bookingNumber,
        leaderName: bookings.leaderName,
        leaderPhone: bookings.leaderPhone,
        totalAmount: bookings.totalAmount,
        paidAmount: bookings.paidAmount,
        status: bookings.status,
        paymentStatus: bookings.paymentStatus,
        departureDate: bookings.departureDate,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .orderBy(desc(bookings.createdAt))
      .limit(10);

    if (recentBookings.length === 0) {
      return (incomeSummaryLine ? incomeSummaryLine.trim() + "\n\n" : "") + "최근 bookings 내역이 없습니다.";
    }

    const lines = recentBookings.map((b) => {
      const maskedPhone = maskPhone(b.leaderPhone);
      const departure = b.departureDate ? new Date(b.departureDate).toLocaleDateString("ko-KR") : "미정";
      return `- [${b.bookingNumber}] ${b.leaderName}(${maskedPhone}) | 출발: ${departure} | 총액: ${Number(b.totalAmount).toLocaleString()}원 | 상태: ${b.status} | 결제: ${b.paymentStatus}`;
    });

    return `[최근 bookings 10건]\n` + lines.join("\n") + incomeSummaryLine;
  } catch (err) {
    console.error("[RAG] fetchReservationContext 실패:", err);
    return "";
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 대화 히스토리 압축 (5턴 이상 시 이전 대화 요약으로 압축)
// ────────────────────────────────────────────────────────────────────────────

export async function compressHistory(
  sessionId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ChatMessage[]> {
  // 5턴 이하이면 그대로 반환
  if (messages.length <= 10) {
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  // 오래된 메시지는 요약으로 압축 (최근 6턴 유지)
  const recent = messages.slice(-6);
  const older = messages.slice(0, -6);

  const summaryText = older
    .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content.slice(0, 100)}`)
    .join("\n");

  const summaryMessage: ChatMessage = {
    role: "system",
    content: `[이전 대화 요약]\n${summaryText}\n\n위 내용을 참고하여 현재 대화를 이어가세요.`,
  };

  return [summaryMessage, ...recent.map((m) => ({ role: m.role, content: m.content }))];
}

// ────────────────────────────────────────────────────────────────────────────
// AI파트너매니저(파트너용) 테넌트 격리 RAG
// - tenantId로 본인(파트너사) 데이터만 조회 → 테넌트 간 데이터 누출 원천 차단
// - tenantId === null 이면 두골프 본사(마스터 전체보기) → 전체 조회
// - 고객 개인정보는 마스킹
// ────────────────────────────────────────────────────────────────────────────

import { eq as _eq, and as _and, desc as _desc, sql as _sql, isNull as _isNull } from "drizzle-orm";
import { inquiries as _inquiries } from "../../drizzle/schema";

/**
 * tenantId 격리 조건 생성 헬퍼
 * - tenantId === null: 본사(마스터 전체보기) → 필터 없음(undefined)
 * - tenantId === number: 해당 테넌트만
 *
 * 주의: 파트너 세션은 context.ts에서 자신의 tenantId가 강제 주입되며,
 * x-active-tenant 헤더를 신뢰하지 않으므로 임의 테넌트 조회가 불가능하다.
 */
function tenantCond(column: AnyTenantColumn, tenantId: number | null) {
  if (tenantId === null || tenantId === undefined) return undefined;
  return _eq(column, tenantId);
}

// drizzle 컬럼 타입을 느슨하게 받기 위한 별칭 (런타임 안전, 컴파일 단순화)
type AnyTenantColumn = Parameters<typeof _eq>[0];

export interface ManagerContextOptions {
  /** 파트너 테넌트 ID (null = 본사 전체보기). context.ts에서 주입된 값만 전달할 것 */
  tenantId: number | null;
  /** 사용자 메시지 (의도 분류용) */
  message: string;
  /** 각 섹션 최대 건수 */
  limit?: number;
}

/**
 * AI파트너매니저 RAG 컨텍스트 생성 (테넌트 격리)
 * - 의도에 따라 예약/정산/상품/문의 컨텍스트를 합성
 * - 항상 tenantId로 필터링하여 본인 데이터만 노출
 */
export async function fetchManagerContext(opts: ManagerContextOptions): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  const { tenantId, message } = opts;
  const limit = Math.min(opts.limit ?? 8, 20);
  const intent = classifyIntent(message);
  const sections: string[] = [];

  const scopeLabel = tenantId === null ? "두골프 본사(전체)" : `파트너사 #${tenantId}`;

  try {
    // ── 상품 컨텍스트 (패키지 의도 또는 기본) ──
    if (intent.needsPackages || (!intent.needsReservations && !intent.needsStats)) {
      const pkgRows = await db
        .select({
          id: packages.id,
          title: packages.title,
          country: packages.country,
          status: packages.status,
        })
        .from(packages)
        .where(_and(tenantCond(packages.tenantId, tenantId), _eq(packages.status, "active")))
        .orderBy(_desc(packages.isPopular))
        .limit(limit);
      if (pkgRows.length > 0) {
        sections.push(
          `[상품 — ${scopeLabel}]\n` +
            pkgRows
              .map((p) => `- [ID:${p.id}] ${p.title} | 국가:${p.country} | 상태:${p.status}`)
              .join("\n")
        );
      }
    }

    // ── 예약 컨텍스트 (테넌트 격리, 개인정보 마스킹) ──
    if (intent.needsReservations || intent.needsStats) {
      const bookingRows = await db
        .select({
          bookingNumber: bookings.bookingNumber,
          leaderName: bookings.leaderName,
          leaderPhone: bookings.leaderPhone,
          totalAmount: bookings.totalAmount,
          paidAmount: bookings.paidAmount,
          status: bookings.status,
          paymentStatus: bookings.paymentStatus,
          departureDate: bookings.departureDate,
        })
        .from(bookings)
        .where(tenantCond(bookings.tenantId, tenantId))
        .orderBy(_desc(bookings.createdAt))
        .limit(limit);
      if (bookingRows.length > 0) {
        sections.push(
          `[예약 — ${scopeLabel}]\n` +
            bookingRows
              .map((b) => {
                const dep = b.departureDate
                  ? new Date(b.departureDate).toLocaleDateString("ko-KR")
                  : "미정";
                const name = b.leaderName ? b.leaderName.slice(0, 1) + "**" : "-";
                return `- [${b.bookingNumber}] ${name}(${maskPhone(b.leaderPhone)}) | 출발:${dep} | 총액:${Number(b.totalAmount).toLocaleString()}원 | 상태:${b.status}/${b.paymentStatus}`;
              })
              .join("\n")
        );
      } else {
        sections.push(`[예약 — ${scopeLabel}] 조회된 예약이 없습니다.`);
      }

      // ── 정산 요약 (집계) ──
      const settleRows = await db
        .select({
          status: settlements.status,
          cnt: _sql<number>`count(*)`,
          total: _sql<number>`coalesce(sum(${settlements.amount}), 0)`,
        })
        .from(settlements)
        .where(tenantCond(settlements.tenantId, tenantId))
        .groupBy(settlements.status);
      if (settleRows.length > 0) {
        sections.push(
          `[정산 요약 — ${scopeLabel}]\n` +
            settleRows
              .map(
                (s) =>
                  `- ${s.status}: ${Number(s.cnt).toLocaleString()}건 / ${Number(s.total).toLocaleString()}원`
              )
              .join("\n")
        );
      }
    }

    // ── 문의 컨텍스트 (테넌트 격리, 개인정보 마스킹) ──
    if (message.includes("문의") || message.includes("상담") || intent.needsStats) {
      const inqRows = await db
        .select({
          name: _inquiries.name,
          phone: _inquiries.phone,
          packageName: _inquiries.packageName,
          status: _inquiries.status,
          createdAt: _inquiries.createdAt,
        })
        .from(_inquiries)
        .where(tenantCond(_inquiries.tenantId, tenantId))
        .orderBy(_desc(_inquiries.createdAt))
        .limit(limit);
      if (inqRows.length > 0) {
        sections.push(
          `[고객 문의 — ${scopeLabel}]\n` +
            inqRows
              .map((q) => {
                const name = q.name ? q.name.slice(0, 1) + "**" : "-";
                const when = q.createdAt
                  ? new Date(q.createdAt).toLocaleDateString("ko-KR")
                  : "-";
                return `- ${name}(${maskPhone(q.phone)}) | ${q.packageName ?? "상품미지정"} | 상태:${q.status} | ${when}`;
              })
              .join("\n")
        );
      }
    }

    if (sections.length === 0) return "";
    return (
      `※ 아래 데이터는 ${scopeLabel} 범위로 격리 조회된 실제 DB 데이터입니다. 이 범위 밖 데이터는 존재하지 않습니다.\n\n` +
      sections.join("\n\n")
    );
  } catch (err) {
    console.error("[RAG] fetchManagerContext 실패:", err);
    return "";
  }
}
