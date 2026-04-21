// ============================================================
// DOGOLF Packages Page — DB 연동 버전
// ============================================================

import { useState, useMemo } from 'react';
import { useParams, Link } from 'wouter';
import { Search, Loader2 } from 'lucide-react';
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

export default function Packages() {
  const params = useParams<{ destination?: string }>();
  const [activeDestination, setActiveDestination] = useState(params.destination || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular');

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
    return [...items].sort((a, b) => {
      if (sortBy === 'price_asc') {
        const aPrice = Number(a.highlights ? JSON.parse(a.highlights as string)?.[0] : 0) || 0;
        const bPrice = Number(b.highlights ? JSON.parse(b.highlights as string)?.[0] : 0) || 0;
        return aPrice - bPrice;
      }
      if (sortBy === 'price_desc') {
        const aPrice = Number(a.highlights ? JSON.parse(a.highlights as string)?.[0] : 0) || 0;
        const bPrice = Number(b.highlights ? JSON.parse(b.highlights as string)?.[0] : 0) || 0;
        return bPrice - aPrice;
      }
      // 인기순: isPopular → isFeatured → sortOrder → 최신순
      if (b.isPopular && !a.isPopular) return 1;
      if (a.isPopular && !b.isPopular) return -1;
      if (b.isFeatured && !a.isFeatured) return 1;
      if (a.isFeatured && !b.isFeatured) return -1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  }, [data, sortBy]);

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
        <div className="container py-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Destination tabs */}
            <div className="flex flex-wrap gap-2">
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

            {/* Search & Sort */}
            <div className="flex gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
        </div>
      </section>

      {/* Package grid */}
      <section className="py-12 bg-gray-50 flex-1">
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
              <p className="text-sm text-gray-500 font-body mb-6">
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
  highlights: unknown;
  includes: unknown;
  viewCount: number | null;
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

  // includes에서 주요 포함사항 파싱
  let includesList: string[] = [];
  try {
    const inc = typeof pkg.includes === 'string' ? JSON.parse(pkg.includes) : pkg.includes;
    if (Array.isArray(inc)) includesList = inc.slice(0, 3);
  } catch {}

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

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {pkg.isPopular && (
              <span className="destination-badge bg-dogolf-red text-white text-xs px-2 py-0.5 rounded-full font-semibold">인기</span>
            )}
            {pkg.isFeatured && (
              <span className="destination-badge bg-dogolf-purple text-white text-xs px-2 py-0.5 rounded-full font-semibold">추천</span>
            )}
          </div>

          {/* Country */}
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
            <span className="text-sm">{flag}</span>
            <span className="text-xs font-semibold text-gray-700 font-body">{countryName}</span>
          </div>

          {/* Duration & Rounds */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="flex items-center gap-2 text-white text-xs">
              {pkg.duration && (
                <span className="flex items-center gap-1">⏱ {pkg.duration}</span>
              )}
              {pkg.roundCount && (
                <span className="flex items-center gap-1">⛳ {pkg.roundCount}회 라운딩</span>
              )}
            </div>
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
            <p className="text-xs text-gray-500 font-body mb-3 line-clamp-1">{firstHighlight}</p>
          )}

          {/* Includes */}
          {includesList.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {includesList.map((item, i) => (
                <span key={i} className="text-xs bg-green-50 text-dogolf-green px-2 py-0.5 rounded-full font-body line-clamp-1 max-w-full">
                  {item.length > 12 ? item.slice(0, 12) + '…' : item}
                </span>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-body">조회 {(pkg.viewCount ?? 0).toLocaleString()}</p>
            <button className="px-3 py-1.5 bg-dogolf-green text-white text-xs font-semibold font-body rounded-lg hover:bg-dogolf-green-dark transition-colors">
              자세히 보기
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
