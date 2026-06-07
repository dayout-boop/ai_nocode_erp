import { ExternalLink, Globe, Bot, BarChart3 } from 'lucide-react'

export default function SampleSiteSection() {
  return (
    <section id="sample" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 섹션 헤더 */}
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
            style={{
              backgroundColor: 'oklch(0.85 0.15 85 / 0.1)',
              color: 'oklch(0.85 0.15 85)',
              border: '1px solid oklch(0.85 0.15 85 / 0.3)',
            }}
          >
            실제 운영 샘플
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
            두골프로 만든
            <br />
            <span className="gradient-text">AI 여행사 샘플</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'oklch(0.65 0.03 240)' }}>
            두골프(dayoutgolf.com)는 투어커뮤니케이션 플랫폼으로 구축된 실제 운영 샘플 사이트입니다.
            <br />
            지금 바로 체험해보세요.
          </p>
        </div>

        {/* 샘플 사이트 카드 */}
        <div
          className="relative rounded-2xl overflow-hidden glass"
          style={{ border: '1px solid oklch(0.25 0.04 260 / 0.5)' }}
        >
          {/* 상단 바 */}
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: '1px solid oklch(0.25 0.04 260 / 0.5)' }}
          >
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'oklch(0.65 0.2 25)' }} />
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'oklch(0.85 0.15 85)' }} />
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'oklch(0.74 0.17 162)' }} />
            </div>
            <div
              className="flex-1 text-center text-xs px-3 py-1 rounded-md"
              style={{
                backgroundColor: 'oklch(0.09 0.03 260)',
                color: 'oklch(0.65 0.03 240)',
              }}
            >
              dayoutgolf.com
            </div>
          </div>

          {/* 콘텐츠 */}
          <div className="p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              {/* 왼쪽: 설명 */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'oklch(0.74 0.17 162 / 0.15)' }}
                  >
                    <Globe size={24} style={{ color: 'oklch(0.74 0.17 162)' }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">두골프 (DOGOLF)</h3>
                    <p className="text-sm" style={{ color: 'oklch(0.65 0.03 240)' }}>
                      국내·해외 골프투어 여행사
                    </p>
                  </div>
                </div>

                <p className="text-base leading-relaxed mb-6" style={{ color: 'oklch(0.75 0.02 240)' }}>
                  대한민국, 태국, 베트남, 필리핀, 중국, 일본 등 국내외 골프여행 패키지를 제공하는
                  실제 운영 중인 여행사입니다. 투어커뮤니케이션 플랫폼으로 구축되어 AI 챗봇, ERP,
                  홈페이지가 모두 자동으로 운영됩니다.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                  {[
                    { icon: <Globe size={16} />, label: '홈페이지', desc: 'AI 자동 생성' },
                    { icon: <Bot size={16} />, label: '골프톡', desc: '24시간 상담' },
                    { icon: <BarChart3 size={16} />, label: 'ERP', desc: '자동 관리' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl text-center"
                      style={{
                        backgroundColor: 'oklch(0.09 0.03 260)',
                        border: '1px solid oklch(0.25 0.04 260 / 0.5)',
                      }}
                    >
                      <div
                        className="flex justify-center mb-1.5"
                        style={{ color: 'oklch(0.74 0.17 162)' }}
                      >
                        {item.icon}
                      </div>
                      <div className="text-xs font-semibold text-white">{item.label}</div>
                      <div className="text-xs" style={{ color: 'oklch(0.55 0.03 240)' }}>
                        {item.desc}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://dayoutgolf.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
                    style={{ backgroundColor: 'oklch(0.74 0.17 162)' }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.backgroundColor = 'oklch(0.65 0.17 162)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.backgroundColor = 'oklch(0.74 0.17 162)'
                    }}
                  >
                    홈페이지 방문
                    <ExternalLink size={14} />
                  </a>
                  <a
                    href="https://partner.dayoutgolf.com/partner/chat"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                    style={{
                      color: 'oklch(0.74 0.17 162)',
                      border: '1px solid oklch(0.74 0.17 162 / 0.3)',
                      backgroundColor: 'oklch(0.74 0.17 162 / 0.1)',
                    }}
                  >
                    매니저 챗봇 체험
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>

              {/* 오른쪽: 특징 배지 */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { emoji: '🇰🇷', label: '국내 골프' },
                  { emoji: '🇹🇭', label: '태국 골프' },
                  { emoji: '🇻🇳', label: '베트남 골프' },
                  { emoji: '🇵🇭', label: '필리핀 골프' },
                  { emoji: '🇨🇳', label: '중국 골프' },
                  { emoji: '🇯🇵', label: '일본 골프' },
                ].map((dest, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-3 rounded-xl"
                    style={{
                      backgroundColor: 'oklch(0.09 0.03 260)',
                      border: '1px solid oklch(0.25 0.04 260 / 0.5)',
                    }}
                  >
                    <span className="text-xl">{dest.emoji}</span>
                    <span className="text-sm font-medium text-white">{dest.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
