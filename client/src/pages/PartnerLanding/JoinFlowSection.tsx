import { ArrowRight } from 'lucide-react'
import { PARTNER_SIGNUP_ENTRY } from './cta'

const steps = [
  {
    step: '01',
    icon: '🔑',
    title: '구글 간편 가입',
    description: '구글 계정으로 1초 만에 가입 완료. 별도 회원가입 양식 없이 바로 시작합니다.',
    color: 'oklch(0.74 0.17 162)',
  },
  {
    step: '02',
    icon: '📄',
    title: '사업자등록증 업로드',
    description: 'PDF 또는 이미지를 업로드하면 AI가 자동으로 사업자 정보를 인식합니다.',
    color: 'oklch(0.85 0.15 85)',
  },
  {
    step: '03',
    icon: '✅',
    title: '여행사 정보 자동 입력',
    description: 'OCR로 인식된 정보를 확인하고 추가 정보를 입력합니다. 대부분 자동 완성됩니다.',
    color: 'oklch(0.74 0.17 162)',
  },
  {
    step: '04',
    icon: '🚀',
    title: 'ERP + 홈페이지 자동 생성',
    description: 'AI가 여행사 전용 ERP와 홈페이지를 자동으로 생성합니다. 약 5분 소요됩니다.',
    color: 'oklch(0.85 0.15 85)',
  },
  {
    step: '05',
    icon: '👥',
    title: '담당자 계정 등록',
    description: '하위 담당자 계정을 추가하고 권한을 설정합니다. 팀 전체가 함께 사용할 수 있습니다.',
    color: 'oklch(0.74 0.17 162)',
  },
]

export default function JoinFlowSection() {
  return (
    <section id="joinflow" className="py-24 relative">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 0% 50%, oklch(0.74 0.17 162 / 0.05) 0%, transparent 50%)',
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
            5단계 간편 가입
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
            5분 안에
            <br />
            <span className="gradient-text">AI 여행사 오픈</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: 'oklch(0.65 0.03 240)' }}>
            복잡한 설정 없이 챗봇 대화만으로 여행사를 시작할 수 있습니다
          </p>
        </div>

        {/* 스텝 카드 */}
        <div className="relative">
          {/* 연결선 (데스크탑) */}
          <div
            className="hidden lg:block absolute top-16 left-[10%] right-[10%] h-0.5"
            style={{
              background:
                'linear-gradient(90deg, oklch(0.74 0.17 162 / 0.3), oklch(0.85 0.15 85 / 0.3), oklch(0.74 0.17 162 / 0.3))',
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {steps.map((step, index) => (
              <div key={step.step} className="relative flex flex-col items-center text-center">
                {/* 스텝 번호 원 */}
                <div
                  className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-4 font-bold"
                  style={{
                    backgroundColor: 'oklch(0.13 0.04 260)',
                    border: `2px solid ${step.color}50`,
                    boxShadow: `0 0 20px ${step.color}20`,
                  }}
                >
                  {step.icon}
                </div>

                {/* 스텝 번호 */}
                <div
                  className="text-xs font-bold mb-2"
                  style={{ color: step.color }}
                >
                  STEP {step.step}
                </div>

                {/* 제목 */}
                <h3 className="text-sm font-bold text-white mb-2">{step.title}</h3>

                {/* 설명 */}
                <p className="text-xs leading-relaxed" style={{ color: 'oklch(0.60 0.03 240)' }}>
                  {step.description}
                </p>

                {/* 화살표 (마지막 제외) */}
                {index < steps.length - 1 && (
                  <div
                    className="lg:hidden mt-4"
                    style={{ color: 'oklch(0.35 0.04 260)' }}
                  >
                    <ArrowRight size={16} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <a
            href={PARTNER_SIGNUP_ENTRY}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-lg transition-all duration-200 glow-green"
            style={{ backgroundColor: 'oklch(0.74 0.17 162)' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.backgroundColor = 'oklch(0.65 0.17 162)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.backgroundColor = 'oklch(0.74 0.17 162)'
            }}
          >
            지금 바로 시작하기
            <ArrowRight size={20} />
          </a>
          <p className="text-sm mt-3" style={{ color: 'oklch(0.50 0.03 240)' }}>
            신용카드 불필요 · 무료로 시작 · 언제든 취소 가능
          </p>
        </div>
      </div>
    </section>
  )
}
