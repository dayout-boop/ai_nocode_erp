import { Check, Star } from 'lucide-react'

const plans = [
  {
    name: '스타터',
    price: '무료',
    period: '',
    description: '소규모 여행사를 위한 시작 플랜',
    features: [
      '패키지 10개 등록',
      'AI 상담 100회/월',
      '골프톡 챗봇 기본',
      '기본 ERP 기능',
      '이메일 지원',
    ],
    cta: '무료로 시작',
    popular: false,
    color: 'oklch(0.65 0.03 240)',
  },
  {
    name: '스탠다드',
    price: '99,000',
    period: '원/월',
    description: '성장하는 여행사를 위한 추천 플랜',
    features: [
      '패키지 50개 등록',
      'AI 상담 500회/월',
      '골프톡 + 매니저 챗봇',
      '전체 ERP 기능',
      '사업자등록증 OCR',
      '카카오톡 연동',
      '우선 지원',
    ],
    cta: '지금 시작하기',
    popular: true,
    color: 'oklch(0.74 0.17 162)',
  },
  {
    name: '프리미엄',
    price: '299,000',
    period: '원/월',
    description: '대형 여행사를 위한 무제한 플랜',
    features: [
      '패키지 무제한 등록',
      'AI 상담 무제한',
      '전체 챗봇 3종 세트',
      '전체 ERP + 커스텀',
      'AI 자동 개발 포함',
      '전담 매니저 배정',
      '24시간 긴급 지원',
    ],
    cta: '문의하기',
    popular: false,
    color: 'oklch(0.85 0.15 85)',
  },
]

export default function PricingSection() {
  return (
    <section id="pricing" className="py-24 relative">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 100%, oklch(0.74 0.17 162 / 0.05) 0%, transparent 60%)',
        }}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 섹션 헤더 */}
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
            style={{
              backgroundColor: 'oklch(0.74 0.17 162 / 0.1)',
              color: 'oklch(0.74 0.17 162)',
              border: '1px solid oklch(0.74 0.17 162 / 0.3)',
            }}
          >
            투명한 요금제
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
            합리적인 가격으로
            <br />
            <span className="gradient-text">AI 여행사 시작</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: 'oklch(0.65 0.03 240)' }}>
            언제든지 플랜을 변경하거나 취소할 수 있습니다
          </p>
        </div>

        {/* 요금 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-6 flex flex-col ${
                plan.popular ? 'glow-green' : ''
              }`}
              style={{
                background: plan.popular
                  ? 'linear-gradient(135deg, oklch(0.13 0.04 260 / 0.9), oklch(0.16 0.04 260 / 0.9))'
                  : 'oklch(0.13 0.04 260 / 0.7)',
                border: plan.popular
                  ? `2px solid oklch(0.74 0.17 162 / 0.6)`
                  : `1px solid oklch(0.25 0.04 260 / 0.5)`,
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* 인기 배지 */}
              {plan.popular && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: 'oklch(0.74 0.17 162)' }}
                >
                  <Star size={10} fill="white" />
                  인기
                </div>
              )}

              {/* 플랜 정보 */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-xs mb-4" style={{ color: 'oklch(0.65 0.03 240)' }}>
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-4xl font-black"
                    style={{ color: plan.popular ? 'oklch(0.74 0.17 162)' : 'oklch(0.98 0 0)' }}
                  >
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm" style={{ color: 'oklch(0.65 0.03 240)' }}>
                      {plan.period}
                    </span>
                  )}
                </div>
              </div>

              {/* 기능 목록 */}
              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check size={14} style={{ color: plan.color, flexShrink: 0 }} />
                    <span style={{ color: 'oklch(0.80 0.02 240)' }}>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA 버튼 */}
              <a
                href="https://partner.dayoutgolf.com/partner/chat"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-3 rounded-xl font-bold text-sm transition-all duration-200"
                style={
                  plan.popular
                    ? {
                        backgroundColor: 'oklch(0.74 0.17 162)',
                        color: 'white',
                      }
                    : {
                        backgroundColor: `${plan.color}15`,
                        color: plan.color,
                        border: `1px solid ${plan.color}30`,
                      }
                }
                onMouseEnter={(e) => {
                  if (plan.popular) {
                    ;(e.currentTarget as HTMLElement).style.backgroundColor = 'oklch(0.65 0.17 162)'
                  } else {
                    ;(e.currentTarget as HTMLElement).style.backgroundColor = `${plan.color}25`
                  }
                }}
                onMouseLeave={(e) => {
                  if (plan.popular) {
                    ;(e.currentTarget as HTMLElement).style.backgroundColor = 'oklch(0.74 0.17 162)'
                  } else {
                    ;(e.currentTarget as HTMLElement).style.backgroundColor = `${plan.color}15`
                  }
                }}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        {/* 부가 설명 */}
        <p className="text-center text-sm mt-8" style={{ color: 'oklch(0.50 0.03 240)' }}>
          모든 플랜에는 SSL 보안, 자동 백업, 기본 SEO 최적화가 포함됩니다.
          <br />
          VAT 별도. 연간 결제 시 2개월 무료.
        </p>
      </div>
    </section>
  )
}
