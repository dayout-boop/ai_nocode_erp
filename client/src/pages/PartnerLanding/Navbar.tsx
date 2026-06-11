import { useState, useEffect } from 'react'
import { PARTNER_SIGNUP_ENTRY } from './cta'
import { Menu, X, Zap } from 'lucide-react'

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { label: 'AI 챗봇', href: '#chatbot' },
    { label: '개발 이력', href: '#devhistory' },
    { label: '요금제', href: '#pricing' },
    { label: '샘플 사이트', href: '#sample' },
    { label: '가입 방법', href: '#joinflow' },
    { label: '고객센터', href: '/partner/support', external: true },
  ]

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'glass border-b border-[oklch(0.25_0.04_260/0.5)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'oklch(0.74 0.17 162)' }}
            >
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-sm">투어커뮤니케이션</span>
              <span
                className="block text-xs leading-none"
                style={{ color: 'oklch(0.74 0.17 162)' }}
              >
                AI 여행사 플랫폼
              </span>
            </div>
          </div>

          {/* 데스크탑 메뉴 */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={(link as any).external ? '_blank' : undefined}
                rel={(link as any).external ? 'noopener noreferrer' : undefined}
                className="text-sm transition-colors duration-200"
                style={{ color: 'oklch(0.65 0.03 240)' }}
                onMouseEnter={(e) => {
                  ;(e.target as HTMLElement).style.color = 'oklch(0.98 0 0)'
                }}
                onMouseLeave={(e) => {
                  ;(e.target as HTMLElement).style.color = 'oklch(0.65 0.03 240)'
                }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA 버튼 */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="/partner/login"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-2 rounded-lg border transition-all duration-200"
              style={{
                color: 'oklch(0.65 0.03 240)',
                borderColor: 'oklch(0.25 0.04 260)',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                el.style.color = 'oklch(0.98 0 0)'
                el.style.borderColor = 'oklch(0.74 0.17 162)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.color = 'oklch(0.65 0.03 240)'
                el.style.borderColor = 'oklch(0.25 0.04 260)'
              }}
            >
              파트너 로그인
            </a>
            <a
              href={PARTNER_SIGNUP_ENTRY}
              className="text-sm px-4 py-2 rounded-lg font-semibold text-white transition-all duration-200 glow-green"
              style={{ backgroundColor: 'oklch(0.74 0.17 162)' }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor =
                  'oklch(0.65 0.17 162)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor =
                  'oklch(0.74 0.17 162)'
              }}
            >
              무료로 시작하기
            </a>
          </div>

          {/* 모바일 메뉴 버튼 */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
          >
            {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {isMobileOpen && (
        <div className="md:hidden glass border-t border-[oklch(0.25_0.04_260/0.5)]">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={(link as any).external ? '_blank' : undefined}
                rel={(link as any).external ? 'noopener noreferrer' : undefined}
                className="block text-sm py-2 transition-colors"
                style={{ color: 'oklch(0.65 0.03 240)' }}
                onClick={() => setIsMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2 border-t border-[oklch(0.25_0.04_260/0.5)]">
              <a
                href={PARTNER_SIGNUP_ENTRY}
                className="block w-full text-center text-sm px-4 py-2.5 rounded-lg font-semibold text-white mt-2"
                style={{ backgroundColor: 'oklch(0.74 0.17 162)' }}
              >
                무료로 시작하기
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
