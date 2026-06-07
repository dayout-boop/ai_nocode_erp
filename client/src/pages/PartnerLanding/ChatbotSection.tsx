import { Bot, Users, Briefcase, ArrowRight, Check } from 'lucide-react'

const chatbots = [
  {
    id: 'master',
    icon: <Bot size={28} />,
    badge: '관리자용',
    title: '투어커뮤니케이션 마스터',
    subtitle: '자율수행 AI 개발/운영 파트너',
    description: 'ERP 전체를 24시간 모니터링하고 자동으로 개발·운영하는 최고 수준의 AI 파트너입니다.',
    features: [
      '24시간 ERP 모니터링 및 자동 개발',
      '실시간 버그 감지 및 자동 수정',
      '개발 요청 자동 분류 및 처리',
      'AI 비용 최적화 및 성능 분석',
    ],
    color: 'oklch(0.74 0.17 162)',
    link: 'https://dayoutgolf.com/erp/master-ai',
  },
  {
    id: 'golftalk',
    icon: <Users size={28} />,
    badge: '고객용',
    title: '골프톡',
    subtitle: 'AI 골프여행 상담 챗봇',
    description: '고객이 언제든 질문하면 AI가 즉시 응답합니다. 패키지 추천부터 예약까지 자동으로 처리합니다.',
    features: [
      'AI 패키지 추천 및 예약 처리',
      '카카오톡 연동 자동 알림',
      '24시간 고객 응대',
      '다국어 지원 (한/영/중/일)',
    ],
    color: 'oklch(0.85 0.15 85)',
    link: 'https://dayoutgolf.com',
  },
  {
    id: 'manager',
    icon: <Briefcase size={28} />,
    badge: '파트너용',
    title: '투어커뮤니케이션 매니저',
    subtitle: '가입부터 운영까지 AI 파트너',
    description: '사업자등록증 하나로 가입 완료. AI가 ERP와 홈페이지를 자동으로 생성하고 운영을 도와줍니다.',
    features: [
      '사업자등록증 자동 인식 (OCR)',
      '구글 간편 가입 지원',
      'ERP + 홈페이지 자동 생성',
      '담당자 계정 자동 발급',
    ],
    color: 'oklch(0.74 0.17 162)',
    link: 'https://partner.dayoutgolf.com/partner/chat',
  },
]

export default function ChatbotSection() {
  return (
    <section id="chatbot" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
            AI 챗봇 3종 세트
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
            하나의 플랫폼,
            <br />
            <span className="gradient-text">세 가지 AI 파트너</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'oklch(0.65 0.03 240)' }}>
            관리자, 고객, 파트너 모두를 위한 전용 AI 챗봇이 여행사 운영의 모든 것을 자동화합니다
          </p>
        </div>

        {/* 챗봇 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {chatbots.map((bot) => (
            <div
              key={bot.id}
              className="relative rounded-2xl p-6 glass card-hover flex flex-col"
              style={{ border: `1px solid oklch(0.25 0.04 260 / 0.5)` }}
            >
              {/* 상단 배지 */}
              <div className="flex items-center justify-between mb-4">
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: `${bot.color}20`,
                    color: bot.color,
                    border: `1px solid ${bot.color}40`,
                  }}
                >
                  {bot.badge}
                </span>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${bot.color}15`, color: bot.color }}
                >
                  {bot.icon}
                </div>
              </div>

              {/* 제목 */}
              <h3 className="text-xl font-bold text-white mb-1">{bot.title}</h3>
              <p className="text-sm font-medium mb-3" style={{ color: bot.color }}>
                {bot.subtitle}
              </p>
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'oklch(0.65 0.03 240)' }}>
                {bot.description}
              </p>

              {/* 기능 목록 */}
              <ul className="space-y-2 mb-6 flex-1">
                {bot.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check size={14} style={{ color: bot.color, flexShrink: 0 }} />
                    <span style={{ color: 'oklch(0.80 0.02 240)' }}>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* 링크 버튼 */}
              <a
                href={bot.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  backgroundColor: `${bot.color}15`,
                  color: bot.color,
                  border: `1px solid ${bot.color}30`,
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  el.style.backgroundColor = `${bot.color}25`
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget
                  el.style.backgroundColor = `${bot.color}15`
                }}
              >
                체험하기
                <ArrowRight size={14} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
