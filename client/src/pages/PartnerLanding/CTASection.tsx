import { ArrowRight, Sparkles } from 'lucide-react'
import { PARTNER_SIGNUP_ENTRY } from './cta'

export default function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* 배경 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, oklch(0.74 0.17 162 / 0.15) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(oklch(0.74 0.17 162) 1px, transparent 1px), linear-gradient(90deg, oklch(0.74 0.17 162) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 glass"
          style={{ border: '1px solid oklch(0.74 0.17 162 / 0.3)' }}
        >
          <Sparkles size={14} style={{ color: 'oklch(0.74 0.17 162)' }} />
          <span className="text-sm font-medium" style={{ color: 'oklch(0.74 0.17 162)' }}>
            지금 무료로 시작하세요
          </span>
        </div>

        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-6">
          AI 여행사의
          <br />
          <span className="gradient-text">새로운 시대</span>
        </h2>

        <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10" style={{ color: 'oklch(0.65 0.03 240)' }}>
          투어커뮤니케이션 매니저와 함께 여행사를 시작하세요.
          <br />
          AI가 모든 것을 자동으로 처리합니다.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={PARTNER_SIGNUP_ENTRY}
            className="flex items-center gap-2 px-10 py-4 rounded-xl font-bold text-white text-lg transition-all duration-200 glow-green"
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
            href="https://dayoutgolf.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-10 py-4 rounded-xl font-bold text-white text-lg border transition-all duration-200"
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
            샘플 사이트 보기
          </a>
        </div>
      </div>
    </section>
  )
}
