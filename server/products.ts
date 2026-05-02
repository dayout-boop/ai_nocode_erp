/**
 * 두골프 ERP 구독 플랜 상품 정의
 * Stripe Price ID는 환경변수 또는 DB에서 관리
 */

export interface SubscriptionPlan {
  id: "starter" | "standard" | "premium";
  name: string;
  description: string;
  monthlyPriceKrw: number;
  yearlyPriceKrw: number;
  features: string[];
  maxPackages: number;
  maxBookingsPerMonth: number;
  aiCreditsPerMonth: number;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "starter",
    name: "스타터",
    description: "소규모 골프투어 여행사를 위한 기본 플랜",
    monthlyPriceKrw: 0, // 무료 체험
    yearlyPriceKrw: 0,
    features: [
      "패키지 최대 10개",
      "월 예약 최대 50건",
      "AI 크레딧 100회/월",
      "기본 ERP 기능",
      "이메일 지원",
    ],
    maxPackages: 10,
    maxBookingsPerMonth: 50,
    aiCreditsPerMonth: 100,
  },
  {
    id: "standard",
    name: "스탠다드",
    description: "성장하는 골프투어 여행사를 위한 표준 플랜",
    monthlyPriceKrw: 99000,
    yearlyPriceKrw: 990000, // 2개월 무료
    features: [
      "패키지 최대 50개",
      "월 예약 최대 300건",
      "AI 크레딧 500회/월",
      "전체 ERP 기능",
      "AI 자동 상품 생성",
      "카카오톡 알림",
      "우선 지원",
    ],
    maxPackages: 50,
    maxBookingsPerMonth: 300,
    aiCreditsPerMonth: 500,
  },
  {
    id: "premium",
    name: "프리미엄",
    description: "대형 골프투어 여행사를 위한 최고급 플랜",
    monthlyPriceKrw: 299000,
    yearlyPriceKrw: 2990000, // 2개월 무료
    features: [
      "패키지 무제한",
      "예약 무제한",
      "AI 크레딧 무제한",
      "전체 ERP 기능",
      "AI 마케팅 자동화",
      "전용 담당자 배정",
      "API 연동 지원",
      "24/7 전화 지원",
    ],
    maxPackages: 9999,
    maxBookingsPerMonth: 9999,
    aiCreditsPerMonth: 9999,
  },
];

export function getPlanById(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}
