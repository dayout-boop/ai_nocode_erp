/**
 * RAG (Retrieval Augmented Generation) 유틸리티
 *
 * 키워드 기반 의도 분류 및 DB 컨텍스트 조회
 * 추가 AI 호출 없이 처리하여 토큰 비용 절감
 */
import { like, desc, eq, and, gte } from "drizzle-orm";
import { getDb } from "../db";
import { packages, bookings, settlements } from "../../drizzle/schema";
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
// 예약/정산 컨텍스트 조회 (민감정보 마스킹 적용)
// ────────────────────────────────────────────────────────────────────────────

export async function fetchReservationContext(message: string): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  try {
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

    if (recentBookings.length === 0) return "최근 예약 내역이 없습니다.";

    const lines = recentBookings.map((b) => {
      const maskedPhone = maskPhone(b.leaderPhone);
      const departure = b.departureDate ? new Date(b.departureDate).toLocaleDateString("ko-KR") : "미정";
      return `- [${b.bookingNumber}] ${b.leaderName}(${maskedPhone}) | 출발: ${departure} | 총액: ${Number(b.totalAmount).toLocaleString()}원 | 상태: ${b.status} | 결제: ${b.paymentStatus}`;
    });

    return lines.join("\n");
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
