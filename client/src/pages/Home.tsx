// ============================================================
// DOGOLF Home Page — "Verdant Journey" Design
// Full homepage with hero slider, packages, stats, reviews
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, ChevronRight, ArrowRight, Star, Phone } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PackageCard from '@/components/PackageCard';
import KakaoFloat from '@/components/KakaoFloat';
import { heroSlides, packages, destinations, stats, reviews, notices } from '@/lib/data';

// Animated counter hook
function useCountUp(target: number, duration: number = 2000, start: boolean = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

// Intersection observer hook
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// Stat counter component
function StatCounter({ value, suffix, label, icon, start }: { value: number; suffix: string; label: string; icon: string; start: boolean }) {
  const count = useCountUp(value, 1800, start);
  return (
    <div className="text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="font-number font-bold text-3xl md:text-4xl text-white mb-1">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-white/70 text-sm font-body">{label}</div>
    </div>
  );
}

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeDestination, setActiveDestination] = useState('all');
  const { ref: statsRef, inView: statsInView } = useInView();

  // Auto slide
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % heroSlides.length);

  const filteredPackages = activeDestination === 'all'
    ? packages.slice(0, 8)
    : packages.filter((p) => p.country === activeDestination).slice(0, 8);

  const popularPackages = packages.filter((p) => p.isPopular).slice(0, 4);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* ===== HERO SLIDER ===== */}
      <section className="relative h-[560px] md:h-[680px] overflow-hidden">
        {heroSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={`hero-slide ${index === currentSlide ? 'active' : ''}`}
          >
            <img
              src={slide.image}
              alt={slide.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent" />
          </div>
        ))}

        {/* Hero Content */}
        <div className="absolute inset-0 flex items-center">
          <div className="container">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white text-xs font-body px-3 py-1.5 rounded-full mb-4 border border-white/20">
                <span>⛳</span>
                <span>{heroSlides[currentSlide].destination}</span>
              </div>
              <h1 className="font-display-ko text-4xl md:text-6xl font-bold text-white leading-tight mb-2">
                {heroSlides[currentSlide].title}
              </h1>
              <h2 className="font-display-en text-3xl md:text-5xl italic text-dogolf-gold mb-4">
                {heroSlides[currentSlide].subtitle}
              </h2>
              <p className="text-white/85 text-base md:text-lg font-body mb-8 leading-relaxed">
                {heroSlides[currentSlide].description}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/packages">
                  <button className="px-6 py-3 bg-dogolf-green text-white font-semibold font-body rounded-xl hover:bg-dogolf-green-dark transition-all duration-200 flex items-center gap-2 shadow-lg">
                    {heroSlides[currentSlide].cta}
                    <ArrowRight size={16} />
                  </button>
                </Link>
                <Link href="/inquiry">
                  <button className="px-6 py-3 bg-white/15 backdrop-blur-sm text-white font-semibold font-body rounded-xl border border-white/30 hover:bg-white/25 transition-all duration-200">
                    예약 문의
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Slide controls */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-white/35 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-white/35 transition-colors"
        >
          <ChevronRight size={20} />
        </button>

        {/* Slide dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`transition-all duration-300 rounded-full ${
                index === currentSlide ? 'w-8 h-2 bg-white' : 'w-2 h-2 bg-white/50'
              }`}
            />
          ))}
        </div>

        {/* Quick contact bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-dogolf-green/90 backdrop-blur-sm">
          <div className="container">
            <div className="flex items-center justify-between py-3 flex-wrap gap-2">
              <div className="flex items-center gap-6">
                <a href="tel:1668-1739" className="flex items-center gap-2 text-white hover:text-dogolf-gold transition-colors">
                  <Phone size={14} />
                  <span className="font-number font-bold text-sm">1668-1739</span>
                </a>
                <span className="text-white/50 text-xs hidden sm:block">평일 09:00~17:30</span>
              </div>
              <div className="flex items-center gap-3">
                {destinations.slice(1).map((dest) => (
                  <Link key={dest.id} href={`/packages/${dest.id}`}>
                    <span className="text-white/80 hover:text-white text-xs font-body cursor-pointer transition-colors">
                      {dest.flag} {dest.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== DESTINATION TABS ===== */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="text-center mb-10">
            <p className="text-dogolf-green font-semibold text-sm font-body uppercase tracking-widest mb-2">Golf Destinations</p>
            <h2 className="font-display-ko text-3xl md:text-4xl font-bold text-gray-900 mb-3 section-title-underline">
              인기 골프 패키지
            </h2>
            <p className="text-gray-500 font-body mt-6">국내외 최고의 골프 코스에서 잊지 못할 경험을 만들어 드립니다</p>
          </div>

          {/* Destination filter tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {destinations.map((dest) => (
              <button
                key={dest.id}
                onClick={() => setActiveDestination(dest.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold font-body transition-all duration-200 ${
                  activeDestination === dest.id
                    ? 'bg-dogolf-green text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {dest.flag} {dest.name}
              </button>
            ))}
          </div>

          {/* Package grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredPackages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/packages">
              <button className="px-8 py-3 border-2 border-dogolf-green text-dogolf-green font-semibold font-body rounded-xl hover:bg-dogolf-green hover:text-white transition-all duration-200 flex items-center gap-2 mx-auto">
                전체 패키지 보기
                <ArrowRight size={16} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== DESTINATION SHOWCASE ===== */}
      <section className="py-16 bg-dogolf-cream">
        <div className="container">
          <div className="text-center mb-10">
            <p className="text-dogolf-purple font-semibold text-sm font-body uppercase tracking-widest mb-2">Where to Play</p>
            <h2 className="font-display-ko text-3xl md:text-4xl font-bold text-gray-900 section-title-underline">
              여행 목적지
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { name: '대한민국', flag: '🇰🇷', id: 'korea', image: '/manus-storage/hero_korea_853e915a.jpg', desc: '사계절 아름다운 골프 명소' },
              { name: '태국', flag: '🇹🇭', id: 'thailand', image: '/manus-storage/hero_thailand_36cfbb15.jpg', desc: '열대의 럭셔리 골프 천국' },
              { name: '베트남', flag: '🇻🇳', id: 'vietnam', image: '/manus-storage/hero_vietnam_84cd2877.jpg', desc: '오션뷰 환상적인 골프장' },
              { name: '필리핀', flag: '🇵🇭', id: 'philippines', image: '/manus-storage/hero_philippines_1d03eac3.jpg', desc: '무제한 라운딩의 즐거움' },
              { name: '중국', flag: '🇨🇳', id: 'china', image: '/manus-storage/hero_china_e9244f94.jpg', desc: '역사와 골프의 만남' },
              { name: '일본', flag: '🇯🇵', id: 'japan', image: '/manus-storage/hero_japan_866efe7e.jpg', desc: '온천과 함께하는 골프' },
            ].map((dest) => (
              <Link key={dest.id} href={`/packages/${dest.id}`}>
                <div className="group relative rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer">
                  <img
                    src={dest.image}
                    alt={dest.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{dest.flag}</span>
                      <h3 className="font-display-ko font-bold text-white text-lg">{dest.name}</h3>
                    </div>
                    <p className="text-white/80 text-xs font-body">{dest.desc}</p>
                  </div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                      <ArrowRight size={14} className="text-white" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section
        ref={statsRef}
        className="py-16 bg-dogolf-green relative overflow-hidden"
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-white -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-white translate-x-1/3 translate-y-1/3" />
        </div>
        <div className="container relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <StatCounter
                key={stat.label}
                value={stat.value}
                suffix={stat.suffix}
                label={stat.label}
                icon={stat.icon}
                start={statsInView}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===== POPULAR PACKAGES ===== */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-dogolf-red font-semibold text-sm font-body uppercase tracking-widest mb-2">Most Popular</p>
              <h2 className="font-display-ko text-3xl md:text-4xl font-bold text-gray-900 section-title-underline">
                추천 인기 패키지
              </h2>
            </div>
            <Link href="/packages">
              <button className="hidden md:flex items-center gap-1 text-dogolf-green font-semibold text-sm font-body hover:gap-2 transition-all">
                전체보기 <ArrowRight size={14} />
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {popularPackages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== GALLERY PREVIEW ===== */}
      <section className="py-16 bg-gray-50">
        <div className="container">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-dogolf-purple font-semibold text-sm font-body uppercase tracking-widest mb-2">Photo Gallery</p>
              <h2 className="font-display-ko text-3xl md:text-4xl font-bold text-gray-900 section-title-underline">
                여행 갤러리
              </h2>
            </div>
            <Link href="/gallery">
              <button className="hidden md:flex items-center gap-1 text-dogolf-green font-semibold text-sm font-body hover:gap-2 transition-all">
                전체보기 <ArrowRight size={14} />
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="row-span-2 rounded-2xl overflow-hidden">
              <img
                src="/manus-storage/gallery1_d11c45f2.jpg"
                alt="골프 여행 갤러리"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="rounded-2xl overflow-hidden aspect-video">
              <img
                src="/manus-storage/gallery2_0b08ffeb.jpg"
                alt="골프 리조트"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="rounded-2xl overflow-hidden aspect-video">
              <img
                src="/manus-storage/gallery3_64c53d07.jpg"
                alt="골프 코스"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="rounded-2xl overflow-hidden aspect-video">
              <img
                src="/manus-storage/hero_vietnam_84cd2877.jpg"
                alt="베트남 골프"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="rounded-2xl overflow-hidden aspect-video">
              <img
                src="/manus-storage/hero_japan_866efe7e.jpg"
                alt="일본 골프"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== REVIEWS ===== */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="text-center mb-10">
            <p className="text-dogolf-green font-semibold text-sm font-body uppercase tracking-widest mb-2">Customer Reviews</p>
            <h2 className="font-display-ko text-3xl md:text-4xl font-bold text-gray-900 section-title-underline">
              고객 후기
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.map((review) => (
              <div key={review.id} className="bg-gray-50 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} size={14} className="fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 font-body text-sm leading-relaxed mb-4">
                  "{review.content}"
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-900 font-body">{review.author}</p>
                    <p className="text-xs text-dogolf-green font-body">{review.destination}</p>
                  </div>
                  <p className="text-xs text-gray-400 font-number">{review.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== NOTICE PREVIEW ===== */}
      <section className="py-16 bg-dogolf-cream">
        <div className="container">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-dogolf-red font-semibold text-sm font-body uppercase tracking-widest mb-2">News & Events</p>
              <h2 className="font-display-ko text-3xl font-bold text-gray-900 section-title-underline">
                공지사항 & 이벤트
              </h2>
            </div>
            <Link href="/notice">
              <button className="hidden md:flex items-center gap-1 text-dogolf-green font-semibold text-sm font-body hover:gap-2 transition-all">
                전체보기 <ArrowRight size={14} />
              </button>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {notices.slice(0, 5).map((notice, index) => (
              <div
                key={notice.id}
                className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                  index < notices.slice(0, 5).length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <span className={`destination-badge text-xs shrink-0 ${
                  notice.category === '이벤트' ? 'bg-red-50 text-dogolf-red' :
                  notice.category === '신상품' ? 'bg-purple-50 text-dogolf-purple' :
                  'bg-green-50 text-dogolf-green'
                }`}>
                  {notice.category}
                </span>
                {notice.isImportant && (
                  <span className="text-dogolf-red text-xs font-bold shrink-0">[중요]</span>
                )}
                <span className="flex-1 text-sm text-gray-800 font-body truncate">{notice.title}</span>
                <span className="text-xs text-gray-400 font-number shrink-0">{notice.date}</span>
                <span className="text-xs text-gray-400 font-number shrink-0 hidden sm:block">조회 {notice.views.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA BANNER ===== */}
      <section className="relative py-20 overflow-hidden">
        <img
          src="/manus-storage/hero_main_aa4ec84e.jpg"
          alt="CTA 배경"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-dogolf-green-dark/80" />
        <div className="container relative text-center">
          <h2 className="font-display-ko text-3xl md:text-5xl font-bold text-white mb-4">
            지금 바로 예약하세요
          </h2>
          <p className="text-white/80 font-body text-lg mb-8 max-w-xl mx-auto">
            두골프 전문 상담사가 최적의 골프 여행 패키지를 추천해 드립니다
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/inquiry">
              <button className="px-8 py-4 bg-white text-dogolf-green font-bold font-body rounded-xl hover:bg-gray-100 transition-all text-lg shadow-lg">
                온라인 예약 문의
              </button>
            </Link>
            <a
              href="http://pf.kakao.com/_xbHHSV"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-[#FEE500] text-[#3A1D1D] font-bold font-body rounded-xl hover:bg-[#FFD700] transition-all text-lg shadow-lg"
            >
              💬 카카오톡 상담
            </a>
          </div>
          <p className="text-white/60 font-body text-sm mt-6">
            📞 1668-1739 | 평일 09:00~17:30
          </p>
        </div>
      </section>

      <Footer />
      <KakaoFloat />
    </div>
  );
}
