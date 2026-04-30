// ============================================================
// DOGOLF Home Page — "Verdant Journey" Design
// Full homepage with hero slider, packages, stats, reviews
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { Link } from 'wouter';
import { ChevronLeft, ChevronRight, ArrowRight, Star, Phone, TrendingUp, Zap, X } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import GolfTalkWidget from '@/components/GolfTalkWidget';
import { heroSlides as staticHeroSlides, destinations, stats, reviews, notices } from '@/lib/data';
import { trpc } from '@/lib/trpc';

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
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeDestination, setActiveDestination] = useState('all');
  const { ref: statsRef, inView: statsInView } = useInView();

  // DB 히어로 슬라이드 연동 (폴백: 정적 데이터)
  const { data: dbHeroSlides } = trpc.siteSettings.getHeroSlides.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const heroSlides = (dbHeroSlides && dbHeroSlides.length > 0)
    ? dbHeroSlides
        .filter((s: any) => s.isActive)
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
        .map((s: any) => ({
          id: s.id,
          image: s.imageUrl,
          title: s.title || '',
          subtitle: s.subtitle || '',
          description: s.description || '',
          cta: s.ctaText || '패키지 보기',
          destination: s.ctaLink || '',
        }))
    : staticHeroSlides;

  // Auto slide
  useEffect(() => {
    if (heroSlides.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % heroSlides.length);

  // DB에서 패키지 목록 조회
  const { data: pkgData } = trpc.packages.publicList.useQuery(
    { country: activeDestination !== 'all' ? activeDestination : undefined, limit: 8 },
    { keepPreviousData: true } as any
  );
  const { data: popularData } = trpc.packages.publicList.useQuery(
    { popular: true, limit: 4 },
    { staleTime: 60000 } as any
  );

  const filteredPackages = pkgData?.items ?? [];
  const popularPackages = popularData?.items ?? [];

  // Trending & Special Deal 쿼리
  const { data: trendingData } = trpc.packages.publicList.useQuery(
    { trending: true, limit: 4 },
    { staleTime: 60000 } as any
  );
  const { data: specialDealData } = trpc.packages.publicList.useQuery(
    { specialDeal: true, limit: 4 },
    { staleTime: 60000 } as any
  );
  const trendingPackages = trendingData?.items ?? [];
  const specialDealPackages = specialDealData?.items ?? [];

  // 최근 본 상품 (localStorage)
  const [recentlyViewed] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem('dogolf_recently_viewed');
      return stored ? JSON.parse(stored).slice(0, 4) : [];
    } catch { return []; }
  });
  const { data: allPackagesData } = trpc.packages.publicList.useQuery(
    { limit: 50 },
    { staleTime: 120000, enabled: recentlyViewed.length > 0 } as any
  );
  const recentlyViewedItems = (allPackagesData?.items ?? []).filter((p: any) => recentlyViewed.includes(p.id));

  // 코스 유형 필터
  const courseTypeLabels: Record<string, string> = {
    resort: '리조트', oceanfront: '오션뷰', mountain: '산악', tropical: '열대',
    parkland: '파크랜드', links: '링크스', desert: '사막', tournament: '토너먼트'
  };
  const courseTypeIcons: Record<string, string> = {
    resort: '🏨', oceanfront: '🌊', mountain: '⛰️', tropical: '🌴',
    parkland: '🌳', links: '🏌️', desert: '🏜️', tournament: '🏆'
  };
  const [activeCourseType, setActiveCourseType] = useState<string | null>(null);
  const { data: courseFilteredData } = trpc.packages.publicList.useQuery(
    { courseType: activeCourseType ?? undefined, limit: 8 },
    { enabled: activeCourseType !== null, staleTime: 30000 } as any
  );
  const courseFilteredPackages = activeCourseType ? (courseFilteredData?.items ?? []) : [];



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
            {filteredPackages.length > 0 ? filteredPackages.map((pkg: any) => (
              <DBHomeCard key={pkg.id} pkg={pkg} />
            )) : (
              <div className="col-span-4 text-center py-12">
                <p className="text-gray-400 font-body text-sm">등록된 패키지가 없습니다</p>
              </div>
            )}
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
            {popularPackages.length > 0 ? popularPackages.map((pkg: any) => (
              <DBHomeCard key={pkg.id} pkg={pkg} />
            )) : (
              <div className="col-span-4 text-center py-12">
                <p className="text-gray-400 font-body text-sm">등록된 인기 패키지가 없습니다</p>
              </div>
            )}
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

      {/* ===== TRENDING DESTINATIONS ===== */}
      {trendingPackages.length > 0 && (
        <section className="py-16 bg-white">
          <div className="container">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={18} className="text-dogolf-red" />
                  <p className="text-dogolf-red font-semibold text-sm font-body uppercase tracking-widest">Trending Now</p>
                </div>
                <h2 className="font-display-ko text-3xl font-bold text-gray-900">지금 뜨는 패키지</h2>
              </div>
              <Link href="/packages">
                <button className="text-dogolf-green text-sm font-semibold font-body flex items-center gap-1 hover:underline">
                  전체 보기 <ArrowRight size={14} />
                </button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {trendingPackages.map((pkg: any) => (
                <DBHomeCard key={pkg.id} pkg={pkg} badge="trending" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== COURSE TYPE FILTER ===== */}
      <section className="py-12 bg-dogolf-cream">
        <div className="container">
          <div className="text-center mb-8">
            <p className="text-dogolf-purple font-semibold text-sm font-body uppercase tracking-widest mb-2">Course Type</p>
            <h2 className="font-display-ko text-3xl font-bold text-gray-900">코스 유형으로 찾기</h2>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {Object.entries(courseTypeLabels).map(([type, label]) => (
              <button
                key={type}
                onClick={() => setActiveCourseType(activeCourseType === type ? null : type)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold font-body transition-all duration-200 border-2 ${
                  activeCourseType === type
                    ? 'bg-dogolf-green text-white border-dogolf-green shadow-md'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-dogolf-green hover:text-dogolf-green'
                }`}
              >
                <span>{courseTypeIcons[type]}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
          {activeCourseType && (
            <div>
              {courseFilteredPackages.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {courseFilteredPackages.map((pkg: any) => (
                    <DBHomeCard key={pkg.id} pkg={pkg} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-gray-400 font-body">{courseTypeLabels[activeCourseType]} 유형의 패키지가 없습니다</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ===== SPECIAL DEALS ===== */}
      {specialDealPackages.length > 0 && (
        <section className="py-16 bg-gradient-to-r from-dogolf-green-dark to-dogolf-green relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '30px 30px'}} />
          <div className="container relative">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={18} className="text-dogolf-gold" />
                  <p className="text-dogolf-gold font-semibold text-sm font-body uppercase tracking-widest">Special Deals</p>
                </div>
                <h2 className="font-display-ko text-3xl font-bold text-white">한정 특가 패키지</h2>
                <p className="text-white/70 font-body text-sm mt-1">지금 예약하면 더 저렴하게!</p>
              </div>
              <Link href="/packages">
                <button className="text-white/80 text-sm font-semibold font-body flex items-center gap-1 hover:text-white">
                  전체 보기 <ArrowRight size={14} />
                </button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {specialDealPackages.map((pkg: any) => (
                <DBHomeCard key={pkg.id} pkg={pkg} badge="deal" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== RECENTLY VIEWED ===== */}
      {recentlyViewedItems.length > 0 && (
        <section className="py-12 bg-gray-50">
          <div className="container">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-lg">👁️</span>
              <h3 className="font-display-ko text-xl font-bold text-gray-900">최근 본 상품</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {recentlyViewedItems.map((pkg: any) => (
                <DBHomeCard key={pkg.id} pkg={pkg} compact />
              ))}
            </div>
          </div>
        </section>
      )}


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
      <GolfTalkWidget />
    </div>
  );
}

// ─── DB 패키지 홈 카드 컴포넌트 ──────────────────────────────────────
const countryFlagMap: Record<string, string> = {
  korea: '🇰🇷', thailand: '🇹🇭', vietnam: '🇻🇳',
  philippines: '🇵🇭', china: '🇨🇳', japan: '🇯🇵',
};
const countryNameMap: Record<string, string> = {
  korea: '대한민국', thailand: '태국', vietnam: '베트남',
  philippines: '필리핀', china: '중국', japan: '일본',
};

function DBHomeCard({ pkg, badge, compact }: { pkg: any; badge?: 'trending' | 'deal'; compact?: boolean }) {
  const flag = countryFlagMap[pkg.country] ?? '🌏';
  const countryName = countryNameMap[pkg.country] ?? pkg.country;
  const image = pkg.imageUrl || '/manus-storage/hero_main_aa4ec84e.jpg';

  let firstHighlight = '';
  try {
    const hl = typeof pkg.highlights === 'string' ? JSON.parse(pkg.highlights) : pkg.highlights;
    if (Array.isArray(hl) && hl.length > 0) firstHighlight = hl[0];
  } catch {}

  // badgeType 배지
  const BADGE_CFG: Record<string, { label: string; color: string }> = {
    best:      { label: 'BEST',   color: 'bg-amber-500 text-white' },
    exclusive: { label: '단독특가', color: 'bg-dogolf-red text-white' },
    new:       { label: 'NEW',    color: 'bg-blue-500 text-white' },
    limited:   { label: '한정',   color: 'bg-orange-500 text-white' },
    hot:       { label: 'HOT🔥',  color: 'bg-rose-600 text-white' },
  };
  const badgeCfg = pkg.badgeType && pkg.badgeType !== 'none' ? BADGE_CFG[pkg.badgeType] : null;

  // 포함항목 아이콘 배지
  const includeIcons: string[] = [];
  if (pkg.includesAirfare) includeIcons.push('✈항공');
  if (pkg.includesGreenFee) includeIcons.push('⛳그린피');
  if (pkg.includesHotel) includeIcons.push('🏨숙박');

  return (
    <Link href={`/packages/detail/${pkg.id}`}>
      <div className={`group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer${compact ? ' text-sm' : ''}`}>
        <div className="relative h-52 overflow-hidden">
          <img src={image} alt={pkg.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {badgeCfg && <span className={`text-xs px-2 py-0.5 rounded-full font-bold font-body shadow-sm ${badgeCfg.color}`}>{badgeCfg.label}</span>}
            {!badgeCfg && badge === 'trending' && <span className="destination-badge bg-dogolf-red text-white text-xs px-2 py-0.5 rounded-full font-semibold">트렌딩</span>}
            {!badgeCfg && badge === 'deal' && <span className="destination-badge bg-dogolf-gold text-white text-xs px-2 py-0.5 rounded-full font-semibold">특가</span>}
            {!badgeCfg && pkg.isPopular && <span className="destination-badge bg-dogolf-red text-white text-xs px-2 py-0.5 rounded-full font-semibold">인기</span>}
            {!badgeCfg && pkg.isFeatured && <span className="destination-badge bg-dogolf-purple text-white text-xs px-2 py-0.5 rounded-full font-semibold">추천</span>}
            {pkg.isSpecialDeal && <span className="destination-badge bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">특가</span>}
          </div>
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
            <span className="text-sm">{flag}</span>
            <span className="text-xs font-semibold text-gray-700 font-body">{countryName}</span>
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="flex items-center gap-2 text-white text-xs">
              {pkg.duration && <span>⏱ {pkg.duration}</span>}
              {pkg.roundCount && <span>⛳ {pkg.roundCount}회</span>}
            </div>
            {includeIcons.length > 0 && (
              <div className="flex gap-1">
                {includeIcons.map((ic, i) => (
                  <span key={i} className="bg-white/20 backdrop-blur-sm text-white text-xs px-1.5 py-0.5 rounded-full">{ic}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="p-4">
          {pkg.region && <p className="text-xs text-dogolf-purple font-semibold font-body mb-1">{pkg.region}</p>}
          <h3 className="font-display-ko font-semibold text-gray-900 text-sm leading-snug mb-1 line-clamp-2">{pkg.title}</h3>
          {firstHighlight && <p className="text-xs text-gray-500 font-body mb-2 line-clamp-1">{firstHighlight}</p>}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div>
              {pkg.minPrice && pkg.minPrice > 0 ? (
                <div>
                  <p className="text-xs text-gray-400 font-body">최저가</p>
                  <p className="text-base font-bold text-dogolf-green font-number leading-tight">{pkg.minPrice.toLocaleString()}원~</p>
                </div>
              ) : (
                <p className="text-xs text-gray-400 font-body">조회 {(pkg.viewCount ?? 0).toLocaleString()}</p>
              )}
            </div>
            <button className="px-3 py-1.5 bg-dogolf-green text-white text-xs font-semibold font-body rounded-lg hover:bg-dogolf-green-dark transition-colors">
              자세히 보기
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
