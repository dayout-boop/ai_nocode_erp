// ============================================================
// DOGOLF Packages Page — "Verdant Journey" Design
// ============================================================

import { useState } from 'react';
import { useParams } from 'wouter';
import { Filter, Search } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PackageCard from '@/components/PackageCard';
import KakaoFloat from '@/components/KakaoFloat';
import { packages, destinations } from '@/lib/data';

const destinationImages: Record<string, string> = {
  all: '/manus-storage/hero_main_aa4ec84e.jpg',
  korea: '/manus-storage/hero_korea_853e915a.jpg',
  thailand: '/manus-storage/hero_thailand_36cfbb15.jpg',
  vietnam: '/manus-storage/hero_vietnam_84cd2877.jpg',
  philippines: '/manus-storage/hero_philippines_1d03eac3.jpg',
  china: '/manus-storage/hero_china_e9244f94.jpg',
  japan: '/manus-storage/hero_japan_866efe7e.jpg',
};

export default function Packages() {
  const params = useParams<{ destination?: string }>();
  const [activeDestination, setActiveDestination] = useState(params.destination || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular');

  const currentDest = destinations.find((d) => d.id === activeDestination) || destinations[0];
  const heroImage = destinationImages[activeDestination] || destinationImages.all;

  const filtered = packages
    .filter((p) => {
      const matchDest = activeDestination === 'all' || p.country === activeDestination;
      const matchSearch = !searchQuery || p.title.includes(searchQuery) || p.destination.includes(searchQuery);
      return matchDest && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      return (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0);
    });

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
          <p className="text-sm text-gray-500 font-body mb-6">
            총 <span className="font-semibold text-dogolf-green">{filtered.length}개</span>의 패키지가 있습니다
          </p>
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">⛳</p>
              <p className="text-gray-500 font-body">검색 결과가 없습니다</p>
            </div>
          )}
        </div>
      </section>

      <Footer />
      <KakaoFloat />
    </div>
  );
}
