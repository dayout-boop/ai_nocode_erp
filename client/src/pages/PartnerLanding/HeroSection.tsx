import { ArrowRight, Play, Sparkles, Shield, Zap } from 'lucide-react'

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center particle-bg overflow-hidden">
      {/* 배경 그라디언트 오버레이 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, oklch(0.74 0.17 162 / 0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, oklch(0.85 0.15 85 / 0.08) 0%, transparent 50%)',
        }}
      />

      {/* 배경 그리드 패턴 */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(oklch(0.74 0.17 162) 1px, transparent 1px), linear-gradient(90deg, oklch(0.74 0.17 162) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* 플로팅 원형 장식 */}
      <div
        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-10 animate-float"
        style={{
          background:
            'radial-gradient(circle, oklch(0.74 0.17 162) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full opacity-8 animate-float"
        style={{
          background:
            'radial-gradient(circle, oklch(0.85 0.15 85) 0%, transparent 70%)',
          filter: 'blur(40px)',
          animationDelay: '1.5s',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* 배지 */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 glass border animate-fade-in"
          style={{ borderColor: 'oklch(0.74 0.17 162 / 0.3)' }}>
          <Sparkles size={14} style={{ color: 'oklch(0.74 0.17 162)' }} />
          <span className="text-sm font-medium" style={{ color: 'oklch(0.74 0.17 162)' }}>
            Powered by Google AI · 투어커뮤니케이션
          </span>
        </div>

        {/* 메인 헤드라인 */}
        <h1
          className="text-5xl sm:text-6xl md:text-7xl font-black leading-tight mb-6 animate-slide-up"
          style={{ animationDelay: '0.1s', opacity: 0 }}
        >
          <span className="text-white">AI가 운영하는</span>
          <br />
          <span className="gradient-text">여행사</span>
          <br />
          <span className="text-white">지금 시작하세요</span>
        </h1>

        {/* 서브 헤드라인 */}
        <p
          className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up"
          style={{
            color: 'oklch(0.65 0.03 240)',
            animationDelay: '0.2s',
            opacity: 0,
          }}
        >
          자율수행 AI 파트너 <strong style={{ color: 'oklch(0.98 0 0)' }}>'투어커뮤니케이션 매니저'</strong>가
          24시간 고객 상담, 예약 관리, 상품 생성을 자동으로 처리합니다
        </p>

        {/* CTA 버튼 */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up"
          style={{ animationDelay: '0.3s', opacity: 0 }}
        >
          <a
            href="/partner/login"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-lg transition-all duration-200 glow-green"
            style={{ backgroundColor: 'oklch(0.74 0.17 162)' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.backgroundColor = 'oklch(0.65 0.17 162)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.backgroundColor = 'oklch(0.74 0.17 162)'
            }}
          >
            무료로 시작하기
            <ArrowRight size={20} />
          </a>
          <a
            href="https://dogolf-tour-dkz3fsmp.manus.space"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-lg border transition-all duration-200"
            style={{ borderColor: 'oklch(0.25 0.04 260)' }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.borderColor = 'oklch(0.74 0.17 162)'
              el.style.backgroundColor = 'oklch(0.74 0.17 162 / 0.1)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.borderColor = 'oklch(0.25 0.04 260)'
              el.style.backgroundColor = 'transparent'
            }}
          >
            <Play size={18} />
            데모 보기
          </a>
        </div>

        {/* 통계 배지 */}
        <div
          className="flex flex-wrap justify-center gap-6 animate-slide-up"
          style={{ animationDelay: '0.4s', opacity: 0 }}
        >
          {[
            { icon: <Zap size={16} />, label: '24시간 자동 운영', color: 'oklch(0.74 0.17 162)' },
            { icon: <Shield size={16} />, label: 'Google Cloud 보안', color: 'oklch(0.85 0.15 85)' },
            { icon: <Sparkles size={16} />, label: 'AI 자동 개발', color: 'oklch(0.74 0.17 162)' },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-4 py-2 rounded-full glass"
              style={{ borderColor: `${item.color}30` }}
            >
              <span style={{ color: item.color }}>{item.icon}</span>
              <span className="text-sm font-medium text-white">{item.label}</span>
            </div>
          ))}
        </div>

        {/* 스크롤 인디케이터 */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-xs" style={{ color: 'oklch(0.65 0.03 240)' }}>
            스크롤하여 더 보기
          </span>
          <div
            className="w-5 h-8 rounded-full border-2 flex items-start justify-center p-1"
            style={{ borderColor: 'oklch(0.25 0.04 260)' }}
          >
            <div
              className="w-1 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: 'oklch(0.74 0.17 162)' }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
