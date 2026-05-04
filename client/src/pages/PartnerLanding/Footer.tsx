import { Zap } from 'lucide-react'

export default function Footer() {
  const links = [
    { label: '파트너 로그인', href: 'https://dogolf-tour-dkz3fsmp.manus.space/partner/chat' },
    { label: '두골프 샘플', href: 'https://dayoutgolf.com' },
    { label: '개인정보처리방침', href: '#' },
    { label: '이용약관', href: '#' },
  ]

  return (
    <footer
      className="py-12 relative"
      style={{ borderTop: '1px solid oklch(0.25 0.04 260 / 0.5)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* 로고 및 회사명 */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'oklch(0.74 0.17 162)' }}
            >
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">주식회사 투어커뮤니케이션</div>
              <div className="text-xs" style={{ color: 'oklch(0.65 0.03 240)' }}>
                AI 여행사 플랫폼
              </div>
            </div>
          </div>

          {/* 링크 */}
          <div className="flex flex-wrap justify-center gap-4">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith('http') ? '_blank' : undefined}
                rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="text-xs transition-colors duration-200"
                style={{ color: 'oklch(0.55 0.03 240)' }}
                onMouseEnter={(e) => {
                  ;(e.target as HTMLElement).style.color = 'oklch(0.74 0.17 162)'
                }}
                onMouseLeave={(e) => {
                  ;(e.target as HTMLElement).style.color = 'oklch(0.55 0.03 240)'
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* 저작권 */}
        <div
          className="mt-8 pt-6 text-center text-xs"
          style={{
            borderTop: '1px solid oklch(0.20 0.03 260 / 0.5)',
            color: 'oklch(0.45 0.03 240)',
          }}
        >
          <p>© 2026 주식회사 투어커뮤니케이션. All Rights Reserved.</p>
          <p className="mt-1">
            contact@tourcommunication.co.kr · partner.dayoutgolf.com
          </p>
        </div>
      </div>
    </footer>
  )
}
