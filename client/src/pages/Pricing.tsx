/**
 * AI ERP 구독 플랜 선택 페이지 (홈페이지용)
 * - 스타터(무료) / 스탠다드(월 99,000원) / 프리미엄(월 299,000원)
 * - 연간 결제 시 2개월 무료 혜택
 */
import { useState } from "react";
import { Link } from "wouter";
import { Check, Star, Zap, Crown, ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const plans = [
  {
    id: "starter",
    name: "스타터",
    icon: <Zap className="w-6 h-6" />,
    description: "소규모 골프투어 여행사를 위한 기본 플랜",
    monthlyPrice: 0,
    yearlyPrice: 0,
    badge: null,
    color: "border-gray-200",
    headerBg: "bg-gray-50",
    iconBg: "bg-gray-100 text-gray-600",
    buttonVariant: "outline" as const,
    buttonClass: "border-gray-300 text-gray-700 hover:bg-gray-50",
    features: [
      "패키지 최대 10개",
      "월 예약 최대 50건",
      "AI 크레딧 100회/월",
      "기본 ERP 기능",
      "이메일 지원",
    ],
    notIncluded: [
      "AI 자동 상품 생성",
      "카카오톡 알림",
      "API 연동 지원",
      "전용 담당자 배정",
    ],
    maxPackages: 10,
    maxBookings: 50,
  },
  {
    id: "standard",
    name: "스탠다드",
    icon: <Star className="w-6 h-6" />,
    description: "성장하는 골프투어 여행사를 위한 표준 플랜",
    monthlyPrice: 99000,
    yearlyPrice: 990000,
    badge: "인기",
    color: "border-dogolf-green",
    headerBg: "bg-dogolf-green",
    iconBg: "bg-white/20 text-white",
    buttonVariant: "default" as const,
    buttonClass: "bg-dogolf-green hover:bg-dogolf-green-dark text-white",
    features: [
      "패키지 최대 50개",
      "월 예약 최대 300건",
      "AI 크레딧 500회/월",
      "전체 ERP 기능",
      "AI 자동 상품 생성",
      "카카오톡 알림",
      "우선 지원",
    ],
    notIncluded: [
      "API 연동 지원",
      "전용 담당자 배정",
    ],
    maxPackages: 50,
    maxBookings: 300,
  },
  {
    id: "premium",
    name: "프리미엄",
    icon: <Crown className="w-6 h-6" />,
    description: "대형 골프투어 여행사를 위한 최고급 플랜",
    monthlyPrice: 299000,
    yearlyPrice: 2990000,
    badge: "최고급",
    color: "border-dogolf-purple",
    headerBg: "bg-gradient-to-br from-dogolf-purple to-purple-700",
    iconBg: "bg-white/20 text-white",
    buttonVariant: "default" as const,
    buttonClass: "bg-dogolf-purple hover:bg-purple-700 text-white",
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
    notIncluded: [],
    maxPackages: 9999,
    maxBookings: 9999,
  },
];

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  function formatPrice(price: number) {
    if (price === 0) return "무료";
    return `₩${price.toLocaleString()}`;
  }

  function getDisplayPrice(plan: (typeof plans)[0]) {
    if (billingCycle === "yearly") {
      return plan.yearlyPrice;
    }
    return plan.monthlyPrice;
  }

  function getPriceLabel(plan: (typeof plans)[0]) {
    if (plan.monthlyPrice === 0) return "영구 무료";
    if (billingCycle === "yearly") return "/ 년";
    return "/ 월";
  }

  function getYearlySavings(plan: (typeof plans)[0]) {
    if (plan.monthlyPrice === 0) return null;
    const yearlyFromMonthly = plan.monthlyPrice * 12;
    const savings = yearlyFromMonthly - plan.yearlyPrice;
    return savings;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* 히어로 섹션 */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="container text-center">
          <Badge className="mb-4 bg-dogolf-green/10 text-dogolf-green border-dogolf-green/20">
            AI ERP 파트너 플랜
          </Badge>
          <h1 className="font-display-ko text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            비즈니스에 맞는 플랜을 선택하세요
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto mb-8">
            소규모 여행사부터 대형 투어 운영사까지, AI ERP로 골프투어 비즈니스를 스마트하게 운영하세요.
          </p>

          {/* 월간/연간 토글 */}
          <div className="inline-flex items-center bg-gray-100 rounded-full p-1 gap-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                billingCycle === "monthly"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              월간 결제
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                billingCycle === "yearly"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              연간 결제
              <span className="bg-dogolf-green text-white text-xs px-2 py-0.5 rounded-full">
                2개월 무료
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* 플랜 카드 섹션 */}
      <section className="py-12 pb-20">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => {
              const displayPrice = getDisplayPrice(plan);
              const savings = billingCycle === "yearly" ? getYearlySavings(plan) : null;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border-2 overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 ${plan.color} ${
                    plan.badge === "인기" ? "scale-105 shadow-lg" : ""
                  }`}
                >
                  {/* 뱃지 */}
                  {plan.badge && (
                    <div className="absolute top-4 right-4 z-10">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full text-white ${
                          plan.badge === "인기" ? "bg-dogolf-green" : "bg-dogolf-purple"
                        }`}
                      >
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  {/* 헤더 */}
                  <div className={`p-6 ${plan.headerBg}`}>
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${plan.iconBg}`}
                    >
                      {plan.icon}
                    </div>
                    <h3
                      className={`font-display-ko text-xl font-bold mb-1 ${
                        plan.id === "starter" ? "text-gray-900" : "text-white"
                      }`}
                    >
                      {plan.name}
                    </h3>
                    <p
                      className={`text-sm ${
                        plan.id === "starter" ? "text-gray-500" : "text-white/80"
                      }`}
                    >
                      {plan.description}
                    </p>
                  </div>

                  {/* 가격 */}
                  <div className="px-6 py-5 border-b border-gray-100">
                    <div className="flex items-end gap-1">
                      <span className="font-number font-bold text-3xl text-gray-900">
                        {formatPrice(displayPrice)}
                      </span>
                      <span className="text-gray-400 text-sm mb-1">{getPriceLabel(plan)}</span>
                    </div>
                    {savings && savings > 0 && (
                      <p className="text-dogolf-green text-xs mt-1 font-semibold">
                        연간 결제 시 ₩{savings.toLocaleString()} 절약
                      </p>
                    )}
                    {plan.monthlyPrice === 0 && (
                      <p className="text-gray-400 text-xs mt-1">신용카드 불필요</p>
                    )}
                  </div>

                  {/* 기능 목록 */}
                  <div className="px-6 py-5 space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-dogolf-green mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>
                    ))}
                    {plan.notIncluded.map((feature) => (
                      <div key={feature} className="flex items-start gap-2.5 opacity-40">
                        <div className="w-4 h-4 mt-0.5 flex-shrink-0 flex items-center justify-center">
                          <div className="w-3 h-px bg-gray-400" />
                        </div>
                        <span className="text-sm text-gray-500">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA 버튼 */}
                  <div className="px-6 pb-6">
                    <Link href={`/partner/join?plan=${plan.id}`}>
                      <Button
                        className={`w-full flex items-center justify-center gap-2 ${plan.buttonClass}`}
                        variant={plan.buttonVariant}
                      >
                        {plan.monthlyPrice === 0 ? "무료로 시작하기" : "지금 시작하기"}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 엔터프라이즈 문의 */}
          <div className="mt-12 max-w-2xl mx-auto text-center">
            <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
              <h3 className="font-display-ko text-xl font-bold text-gray-900 mb-2">
                대규모 기업 고객이신가요?
              </h3>
              <p className="text-gray-500 text-sm mb-5">
                맞춤형 엔터프라이즈 플랜이 필요하신 경우 전담 팀이 최적의 솔루션을 제안해 드립니다.
              </p>
              <a href="tel:1668-1739">
                <Button variant="outline" className="flex items-center gap-2 mx-auto">
                  <Phone className="w-4 h-4" />
                  1668-1739 문의하기
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ 섹션 */}
      <section className="py-16 bg-gray-50">
        <div className="container max-w-3xl">
          <h2 className="font-display-ko text-2xl font-bold text-gray-900 text-center mb-10">
            자주 묻는 질문
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "무료 체험 기간이 있나요?",
                a: "스타터 플랜은 영구 무료입니다. 스탠다드/프리미엄 플랜은 14일 무료 체험 후 결제가 시작됩니다.",
              },
              {
                q: "결제는 어떻게 이루어지나요?",
                a: "포트원(PortOne) 결제 시스템을 통해 국내 카드 결제가 가능합니다. 연간 결제 시 2개월 요금이 무료입니다.",
              },
              {
                q: "플랜 변경이 가능한가요?",
                a: "언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 변경 사항은 다음 결제 주기부터 적용됩니다.",
              },
              {
                q: "데이터 이전이 가능한가요?",
                a: "기존 시스템에서 AI ERP로 데이터 이전을 지원합니다. 스탠다드 이상 플랜에서 이전 지원 서비스를 제공합니다.",
              },
            ].map((faq) => (
              <div key={faq.q} className="bg-white rounded-xl p-6 border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2">{faq.q}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
