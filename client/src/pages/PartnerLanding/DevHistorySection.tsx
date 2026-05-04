import { useState, useEffect } from 'react'
import { Rocket, Bug, Zap, Wrench, RefreshCw, Clock } from 'lucide-react'

interface DevItem {
  id: number
  title: string
  aiCategory: string | null
  module: string | null
  priority: string
  createdAt: string
}

interface ApiResponse {
  items: DevItem[]
  total: number
  lastUpdated: string
}

const categoryConfig: Record<string, { icon: JSX.Element; label: string; color: string }> = {
  FEATURE: { icon: <Rocket size={14} />, label: '신기능', color: 'oklch(0.74 0.17 162)' },
  BUG: { icon: <Bug size={14} />, label: '버그수정', color: 'oklch(0.65 0.2 25)' },
  IMPROVEMENT: { icon: <Zap size={14} />, label: '개선', color: 'oklch(0.85 0.15 85)' },
  REFACTOR: { icon: <Wrench size={14} />, label: '리팩터', color: 'oklch(0.70 0.1 270)' },
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function getCategoryConfig(category: string | null) {
  if (!category) return categoryConfig['FEATURE']
  return categoryConfig[category] || categoryConfig['FEATURE']
}

export default function DevHistorySection() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        'https://dogolf-tour-dkz3fsmp.manus.space/api/public/dev-history?limit=12'
      )
      if (!res.ok) throw new Error('API 응답 오류')
      const json = await res.json()
      setData(json)
      setLastRefresh(new Date())
    } catch {
      setError('데이터를 불러오는 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // 5분마다 자동 갱신
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section id="devhistory" className="py-24 relative">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, oklch(0.74 0.17 162 / 0.05) 0%, transparent 70%)',
        }}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 섹션 헤더 */}
        <div className="text-center mb-12">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
            style={{
              backgroundColor: 'oklch(0.85 0.15 85 / 0.1)',
              color: 'oklch(0.85 0.15 85)',
              border: '1px solid oklch(0.85 0.15 85 / 0.3)',
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse-glow"
              style={{ backgroundColor: 'oklch(0.85 0.15 85)' }}
            />
            실시간 업데이트
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
            매일 진화하는
            <br />
            <span className="gradient-text">개발 이력</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto mb-4" style={{ color: 'oklch(0.65 0.03 240)' }}>
            두골프 ERP에서 실시간으로 가져오는 최신 개발 현황입니다.
            <br />
            플랫폼이 얼마나 빠르게 발전하는지 직접 확인하세요.
          </p>

          {/* 통계 */}
          {data && (
            <div className="flex flex-wrap justify-center gap-6 mb-6">
              <div className="text-center">
                <div
                  className="text-3xl font-black"
                  style={{ color: 'oklch(0.74 0.17 162)' }}
                >
                  {data.total}+
                </div>
                <div className="text-xs" style={{ color: 'oklch(0.65 0.03 240)' }}>
                  누적 개발 항목
                </div>
              </div>
              <div className="text-center">
                <div
                  className="text-3xl font-black"
                  style={{ color: 'oklch(0.85 0.15 85)' }}
                >
                  매일
                </div>
                <div className="text-xs" style={{ color: 'oklch(0.65 0.03 240)' }}>
                  업데이트
                </div>
              </div>
            </div>
          )}

          {/* 새로고침 버튼 */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 glass"
            style={{
              color: 'oklch(0.65 0.03 240)',
              border: '1px solid oklch(0.25 0.04 260 / 0.5)',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>

        {/* 개발 이력 그리드 */}
        {error ? (
          <div
            className="text-center py-12 rounded-2xl glass"
            style={{ border: '1px solid oklch(0.65 0.2 25 / 0.3)' }}
          >
            <p style={{ color: 'oklch(0.65 0.2 25)' }}>{error}</p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl glass animate-pulse"
                style={{ border: '1px solid oklch(0.25 0.04 260 / 0.5)' }}
              />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.items.map((item) => {
                const cat = getCategoryConfig(item.aiCategory)
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl glass card-hover"
                    style={{ border: '1px solid oklch(0.25 0.04 260 / 0.5)' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${cat.color}15`,
                          color: cat.color,
                          border: `1px solid ${cat.color}30`,
                        }}
                      >
                        {cat.icon}
                        {cat.label}
                      </span>
                      <div
                        className="flex items-center gap-1 text-xs flex-shrink-0"
                        style={{ color: 'oklch(0.50 0.03 240)' }}
                      >
                        <Clock size={10} />
                        {formatDate(item.createdAt)}
                      </div>
                    </div>
                    <p
                      className="text-sm font-medium leading-snug line-clamp-2"
                      style={{ color: 'oklch(0.85 0.02 240)' }}
                    >
                      {item.title}
                    </p>
                    {item.module && (
                      <p className="text-xs mt-1.5" style={{ color: 'oklch(0.50 0.03 240)' }}>
                        {item.module}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 마지막 업데이트 시간 */}
            <p className="text-center text-xs mt-6" style={{ color: 'oklch(0.45 0.03 240)' }}>
              마지막 업데이트: {lastRefresh.toLocaleTimeString('ko-KR')} · 두골프 ERP API 실시간 연동
            </p>
          </>
        ) : null}
      </div>
    </section>
  )
}
