// ============================================================
// DOGOLF Packages Page — DB 연동 버전 (자동 개선 사이클 적용)
// ============================================================

import { useState, useMemo } from 'react';
import { useParams, Link } from 'wouter';
import { Search, Loader2, Plane, Flag, Hotel } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import KakaoFloat from '@/components/KakaoFloat';
import { destinations } from '@/lib/data';
import { trpc } from '@/lib/trpc';

const destinationImages: Record<string, string> = {
  all: '/manus-storage/hero_main_aa4ec84e.jpg',
  korea: '/manus-storage/hero_korea_853e915a.jpg',
  thailand: '/manus-storage/hero_thailand_36cfbb15.jpg',
  vietnam: '/manus-storage/hero_vietnam_84cd2877.jpg',
  philippines: '/manus-storage/hero_philippines_1d03eac3.jpg',
  china: '/manus-storage/hero_china_e9244f94.jpg',
  japan: '/manus-storage/hero_japan_866efe7e.jpg',
};

const countryFlagMap: Record<string, string> = {
  korea: '🇰🇷',
  thailand: '🇹🇭',
  vietnam: '🇻🇳',
  philippines: '🇵🇭',
  china: '🇨🇳',
  japan: '🇯🇵',
};

const countryNameMap: Record<string, string> = {
  korea: '대한민국',
  thailand: '태국',
  vietnam: '베트남',
  philippines: '필리핀',
  china: '중국',
  japan: '일본',
};

// 배지 설정
const BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  best:      { label: 'BEST',   color: 'bg-amber-500 text-white' },
  exclusive: { label: '단독특가', color: 'bg-dogolf-red text-white' },
  new:       { label: 'NEW',    color: 'bg-blue-500 text-white' },
  limited:   { label: '한정',   color: 'bg-orange-500 text-white' },
  hot:       { label: 'HOT🔥',  color: 'bg-rose-600 text-white' },
};

// 출발지 목록
const DEPARTURE_CITIES = [
  { id: 'all',    label: '전체 출발지' },
  { id: 'incheon', label: '인천' },
  { id: 'busan',   label: '부산' },
  { id: 'daegu',   label: '대구' },
  { id: 'cheongju', label: '청주' },
];

// 기간 목록
const DURATION_FILTERS = [
  { id: 'all',  label: '전체 기간' },
  { id: '2박3일', label: '2박3일' },
  { id: '3박4일', label: '3박4일' },
  { id: '4박5일', label: '4박5일' },
  { id: '5박6일', label: '5박6일' },
  { id: '7박8일', label: '7박8일 이상' },
];

// 코스 유형
const COURSE_TYPES = [
  { id: 'all',        label: '전체',     icon: '⛳' },
  { id: 'resort',     label: '리조트',   icon: '🏨' },
  { id: 'oceanfront', label: '오션뷰',   icon: '🌊' },
  { id: 'mountain',   label: '산악',     icon: '⛰️' },
  { id: 'tropical',   label: '열대',     icon: '🌴' },
  { id: 'parkland',   label: '파크랜드', icon: '🌳' },
  { id: 'links',      label: '링크스',   icon: '🏌️' },
  { id: 'tournament', label: '토너먼트', icon: '🏆' },
];

// 월간 인기 목적지 (viewCount 기반 정적 데이터 + 트렌드 표시)
const MONTHLY_POPULAR = [
  { country: 'japan',       rank: 1, trend: '↑', trendColor: 'text-dogolf-red' },
  { country: 'thailand',    rank: 2, trend: '→', trendColor: 'text-gray-400' },
  { country: 'vietnam',     rank: 3, trend: '↑', trendColor: 'text-dogolf-red' },
  { country: 'philippines', rank: 4, trend: '↓', trendColor: 'text-blue-400' },
  { country: 'china',       rank: 5, trend: '↑', trendColor: 'text-dogolf-red' },
];

export default function Packages() {
  const params = useParams<{ destination?: string }>();
  const [activeDestination, setActiveDestination] = useState(params.destination || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [activeCourseType, setActiveCourseType] = useState('all');
  const [activeDeparture, setActiveDeparture] = useState('all');
  const [activeDuration, setActiveDuration] = useState('all');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const currentDest = destinations.find((d) => d.id === activeDestination) || destinations[0];
  const heroImage = destinationImages[activeDestination] || destinationImages.all;

  // DB에서 상품 목록 조회
  const { data, isLoading, isError } = trpc.packages.publicList.useQuery(
    {
      country: activeDestination !== 'all' ? activeDestination : undefined,
      search: searchQuery || undefined,
      limit: 50,
    },
    { keepPreviousData: true } as any
  );

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    let result = [...items].sort((a: any, b: any) => {
      if (sortBy === 'price_asc') return (a.minPrice ?? 0) - (b.minPrice ?? 0);
      if (sortBy === 'price_desc') return (b.minPrice ?? 0) - (a.minPrice ?? 0);
      if (b.isPopular && !a.isPopular) return 1;
      if (a.isPopular && !b.isPopular) return -1;
      if (b.isFeatured && !a.isFeatured) return 1;
      if (a.isFeatured && !b.isFeatured) return -1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
    if (activeCourseType !== 'all') {
      result = result.filter((p: any) => p.courseType === activeCourseType);
    }
    if (activeDeparture !== 'all') {
      result = result.filter((p: any) => {
        const cities: string[] = Array.isArray(p.departureCities)
          ? p.departureCities
          : (typeof p.departureCities === 'string' ? JSON.parse(p.departureCities || '[]') : []);
        return cities.includes(activeDeparture);
      });
    }
    if (activeDuration !== 'all') {
      result = result.filter((p: any) => {
        if (!p.duration) return false;
        if (activeDuration === '7박8일') return p.duration.includes('7') || p.duration.includes('8') || p.duration.includes('9') || p.duration.includes('10');
        return p.duration.includes(activeDuration.replace('박', '박').replace('일', '일'));
      });
    }
    return result;
  }, [data, sortBy, activeCourseType, activeDeparture, activeDuration]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero */}
      <section className="relative h-56 md:h-72 overflow-hidden">
        <img src={heroImage} alt={currentDest.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30" />
        <div className="absolute inset-0 flex items-center">
          <div className="container">
            <p className="text-white/70 text-sm font-body mb-2">
              홈 &gt; 골프 패키지 {activeDestination !== 'all' && `> ${currentDest.name}`}
            </p>
            <h1 className="font-display-ko text-3xl md:text-5xl font-bold text-white">
              {currentDest.flag} {currentDest.name} 골프 패키지
            </h1>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="bg-white border-b border-gray-100 sticky top-[80px] z-40 shadow-sm">
        <div className="container py-3">
          {/* Row 1: 목적지 탭 */}
          <div className="flex flex-wrap gap-2 mb-2">
            {destinations.map((dest) => (
              <button
                key={dest.id}
                onClick={() => setActiveDestination(dest.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold font-body transition-all ${
                  activeDestination === dest.id
                    ? 'bg-dogolf-green text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {dest.flag} {dest.name}
              </button>
            ))}
          </div>

          {/* Row 2: 코스 유형 + 검색/정렬 */}
          <div className="flex flex-col md:flex-row gap-2 items-start md:items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {COURSE_TYPES.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setActiveCourseType(ct.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold font-body transition-all ${
                    activeCourseType === ct.id
                      ? 'bg-dogolf-purple text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {ct.icon} {ct.label}
                </button>
              ))}
              <button
                onClick={() => setShowMoreFilters(!showMoreFilters)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold font-body transition-all border ${
                  showMoreFilters ? 'border-dogolf-green text-dogolf-green bg-green-50' : 'border-gray-300 text-gray-500 hover:border-dogolf-green'
                }`}
              >
                {showMoreFilters ? '필터 접기 ▲' : '출발지/기간 ▼'}
              </button>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-44">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="패키지 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-dogolf-green font-body"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-dogolf-green font-body bg-white"
              >
                <option value="popular">인기순</option>
                <option value="price_asc">가격 낮은순</option>
                <option value="price_desc">가격 높은순</option>
              </select>
            </div>
          </div>

          {/* Row 3: 출발지/기간 필터 (토글) */}
          {showMoreFilters && (
            <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-3">
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-gray-500 font-body font-semibold mr-1">출발지</span>
                {DEPARTURE_CITIES.map((dc) => (
                  <button
                    key={dc.id}
                    onClick={() => setActiveDeparture(dc.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold font-body transition-all ${
                      activeDeparture === dc.id
                        ? 'bg-dogolf-green text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {dc.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-gray-500 font-body font-semibold mr-1">기간</span>
                {DURATION_FILTERS.map((df) => (
                  <button
                    key={df.id}
                    onClick={() => setActiveDuration(df.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold font-body transition-all ${
                      activeDuration === df.id
                        ? 'bg-dogolf-gold text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {df.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 월간 인기 목적지 */}
      <section className="bg-white border-b border-gray-100 py-3">
        <div className="container">
          <div className="flex items-center gap-4 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-dogolf-green font-body whitespace-nowrap shrink-0">🏆 이달의 인기</span>
            {MONTHLY_POPULAR.map((mp) => (
              <button
                key={mp.country}
                onClick={() => setActiveDestination(mp.country)}
                className="flex items-center gap-1.5 shrink-0 hover:opacity-80 transition-opacity"
              >
                <span className="text-xs font-bold text-gray-400 font-number w-4">{mp.rank}</span>
                <span className="text-base">{countryFlagMap[mp.country]}</span>
                <span className="text-xs font-semibold text-gray-700 font-body">{countryNameMap[mp.country]}</span>
                <span className={`text-xs font-bold ${mp.trendColor}`}>{mp.trend}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Package grid */}
      <section className="py-10 bg-gray-50 flex-1">
        <div className="container">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="animate-spin text-dogolf-green" size={32} />
              <p className="text-gray-500 font-body text-sm">패키지를 불러오는 중...</p>
            </div>
          ) : isError ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">⚠️</p>
              <p className="text-gray-500 font-body">패키지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 font-body mb-5">
                총 <span className="font-semibold text-dogolf-green">{filtered.length}개</span>의 패키지가 있습니다
              </p>
              {filtered.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filtered.map((pkg) => (
                    <DBPackageCard key={pkg.id} pkg={pkg} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <p className="text-4xl mb-4">⛳</p>
                  <p className="text-gray-500 font-body">등록된 패키지가 없습니다</p>
                  <p className="text-gray-400 font-body text-sm mt-2">다른 목적지를 선택하거나 검색어를 변경해 보세요</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
      <KakaoFloat />
    </div>
  );
}

// ─── DB 패키지 카드 컴포넌트 ─────────────────────────────────────────
interface DBPkg {
  id: number;
  title: string;
  country: string;
  region: string | null;
  duration: string | null;
  roundCount: number | null;
  imageUrl: string | null;
  isFeatured: boolean | null;
  isPopular: boolean | null;
  isSpecialDeal: boolean | null;
  isTrending: boolean | null;
  badgeType: string | null;
  highlights: unknown;
  includes: unknown;
  viewCount: number | null;
  minPrice?: number;
  includesAirfare: boolean | null;
  includesGreenFee: boolean | null;
  includesHotel: boolean | null;
}

function DBPackageCard({ pkg }: { pkg: DBPkg }) {
  const flag = countryFlagMap[pkg.country] ?? '🌏';
  const countryName = countryNameMap[pkg.country] ?? pkg.country;
  const image = pkg.imageUrl || '/manus-storage/hero_main_aa4ec84e.jpg';

  // highlights에서 첫 번째 항목을 부제목으로 사용
  let firstHighlight = '';
  try {
    const hl = typeof pkg.highlights === 'string' ? JSON.parse(pkg.highlights) : pkg.highlights;
    if (Array.isArray(hl) && hl.length > 0) firstHighlight = hl[0];
  } catch {}

  // 배지 결정 (badgeType 우선, 없으면 isPopular/isFeatured/isSpecialDeal/isTrending)
  const badge = pkg.badgeType && pkg.badgeType !== 'none' ? BADGE_CONFIG[pkg.badgeType] : null;

  // 포함 항목 아이콘 배지
  const includeIcons: { icon: React.ReactNode; label: string }[] = [];
  if (pkg.includesAirfare) includeIcons.push({ icon: <Plane size={10} />, label: '항공' });
  if (pkg.includesGreenFee) includeIcons.push({ icon: <Flag size={10} />, label: '그린피' });
  if (pkg.includesHotel) includeIcons.push({ icon: <Hotel size={10} />, label: '숙박' });

  return (
    <Link href={`/packages/detail/${pkg.id}`}>
      <div className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
        {/* Image */}
        <div className="relative h-52 overflow-hidden">
          <img
            src={image}
            alt={pkg.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* 상단 좌측: 배지 스택 */}
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {badge && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold font-body shadow-sm ${badge.color}`}>
                {badge.label}
              </span>
            )}
            {!badge && pkg.isPopular && (
              <span className="bg-dogolf-red text-white text-xs px-2 py-0.5 rounded-full font-semibold">인기</span>
            )}
            {!badge && pkg.isFeatured && (
              <span className="bg-dogolf-purple text-white text-xs px-2 py-0.5 rounded-full font-semibold">추천</span>
            )}
            {pkg.isSpecialDeal && (
              <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">특가</span>
            )}
            {pkg.isTrending && (
              <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">🔥트렌딩</span>
            )}
          </div>

          {/* 상단 우측: 국가 */}
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
            <span className="text-sm">{flag}</span>
            <span className="text-xs font-semibold text-gray-700 font-body">{countryName}</span>
          </div>

          {/* 하단: 기간/라운딩 + 포함항목 아이콘 */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="flex items-center gap-2 text-white text-xs">
              {pkg.duration && <span>⏱ {pkg.duration}</span>}
              {pkg.roundCount && <span>⛳ {pkg.roundCount}회</span>}
            </div>
            {includeIcons.length > 0 && (
              <div className="flex gap-1">
                {includeIcons.map((ic, i) => (
                  <span key={i} className="flex items-center gap-0.5 bg-white/20 backdrop-blur-sm text-white text-xs px-1.5 py-0.5 rounded-full">
                    {ic.icon} {ic.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {pkg.region && (
            <p className="text-xs text-dogolf-purple font-semibold font-body mb-1">{pkg.region}</p>
          )}
          <h3 className="font-display-ko font-semibold text-gray-900 text-sm leading-snug mb-1 line-clamp-2">
            {pkg.title}
          </h3>
          {firstHighlight && (
            <p className="text-xs text-gray-500 font-body mb-2 line-clamp-1">{firstHighlight}</p>
          )}

          {/* CTA */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div>
              {pkg.minPrice && pkg.minPrice > 0 ? (
                <div>
                  <p className="text-xs text-gray-400 font-body">최저가</p>
                  <p className="text-base font-bold text-dogolf-green font-number leading-tight">
                    {pkg.minPrice.toLocaleString()}원~
                  </p>
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
