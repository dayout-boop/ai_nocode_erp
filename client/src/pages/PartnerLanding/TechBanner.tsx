export default function TechBanner() {
  const techs = [
    { name: 'Google AI', icon: '🤖' },
    { name: 'Gemini', icon: '✨' },
    { name: 'Google Cloud', icon: '☁️' },
    { name: 'Google Maps', icon: '🗺️' },
    { name: 'Stripe', icon: '💳' },
    { name: 'Kakao', icon: '💬' },
    { name: 'OpenRouter', icon: '🔀' },
    { name: 'React 19', icon: '⚛️' },
  ]

  return (
    <section className="py-12 relative overflow-hidden" style={{ borderTop: '1px solid oklch(0.25 0.04 260 / 0.5)', borderBottom: '1px solid oklch(0.25 0.04 260 / 0.5)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium mb-8" style={{ color: 'oklch(0.65 0.03 240)' }}>
          최신 AI 기술로 구동되는 플랫폼
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {techs.map((tech, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-4 py-2 rounded-lg glass card-hover cursor-default"
              style={{ borderColor: 'oklch(0.25 0.04 260 / 0.5)' }}
            >
              <span className="text-lg">{tech.icon}</span>
              <span className="text-sm font-medium text-white">{tech.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
