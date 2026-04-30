// ============================================================
// DOGOLF Header — Verdant Journey Design
// Sticky navigation with logo, destination menu, search, CTA
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X, Phone, Search } from 'lucide-react';
import { trpc } from '@/lib/trpc';

const DEFAULT_NAV_ITEMS = [
  { label: '국내골프', href: '/packages/korea' },
  { label: '태국골프', href: '/packages/thailand' },
  { label: '베트남골프', href: '/packages/vietnam' },
  { label: '필리핀골프', href: '/packages/philippines' },
  { label: '중국골프', href: '/packages/china' },
  { label: '일본골프', href: '/packages/japan' },
  { label: '갤러리', href: '/gallery' },
  { label: '공지사항', href: '/notice' },
];

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: dbNavItems } = trpc.siteSettings.getNavItems.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const navItems = (dbNavItems && dbNavItems.length > 0)
    ? dbNavItems.filter((item) => item.isVisible)
    : DEFAULT_NAV_ITEMS;

  const [location, navigate] = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
    setIsSearchOpen(false);
  }, [location]);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isSearchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/packages?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const isHome = location === '/';

  return (
    <>
      {/* Top bar */}
      <div className="bg-dogolf-green-dark text-white text-xs py-2 hidden md:block">
        <div className="container flex justify-between items-center">
          <span className="font-body">🏌️ 국내외 골프투어 전문 여행사 두골프에 오신 것을 환영합니다</span>
          <div className="flex items-center gap-4">
            <a href="tel:1668-1739" className="flex items-center gap-1 hover:text-dogolf-gold transition-colors">
              <Phone size={12} />
              <span className="font-number font-semibold">1668-1739</span>
            </a>
            <span className="text-white/40">|</span>
            <span>평일 09:00~17:30</span>
          </div>
        </div>
      </div>

      {/* 검색 오버레이 */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-start justify-center pt-20 px-4"
          onClick={(e) => e.target === e.currentTarget && setIsSearchOpen(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-4">
            <form onSubmit={handleSearch} className="flex items-center gap-3">
              <Search size={20} className="text-dogolf-green shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="골프 패키지 검색 (예: 태국 3박4일, 제주도...)"
                className="flex-1 text-base font-body outline-none placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </form>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 font-body mb-2">인기 검색어</p>
              <div className="flex flex-wrap gap-2">
                {['태국 3박4일', '제주도 골프', '베트남 다낭', '필리핀 세부', '일본 온천'].map((kw) => (
                  <button
                    key={kw}
                    onClick={() => { setSearchQuery(kw); navigate(`/packages?q=${encodeURIComponent(kw)}`); setIsSearchOpen(false); setSearchQuery(''); }}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-body rounded-full hover:bg-green-50 hover:text-dogolf-green transition-colors"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main header */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white shadow-md'
            : isHome
            ? 'bg-white/95 backdrop-blur-sm'
            : 'bg-white shadow-sm'
        }`}
      >
        <div className="container">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer group">
                <img
                  src="/manus-storage/logo_dogolf_bd2382c7.png"
                  alt="두골프 로고"
                  className="h-10 md:h-12 w-auto object-contain"
                />
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <span
                    className={`nav-link px-3 py-2 text-sm font-medium font-body transition-colors cursor-pointer ${
                      location === item.href || location.startsWith(item.href)
                        ? 'text-dogolf-green active'
                        : 'text-gray-700 hover:text-dogolf-green'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>

            {/* CTA Buttons + Search */}
            <div className="hidden lg:flex items-center gap-2">
              {/* 검색 버튼 */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 text-gray-600 hover:text-dogolf-green transition-colors rounded-lg hover:bg-gray-50"
                aria-label="검색"
              >
                <Search size={20} />
              </button>
              <Link href="/inquiry">
                <button className="px-4 py-2 text-sm font-semibold font-body text-dogolf-green border-2 border-dogolf-green rounded-lg hover:bg-dogolf-green hover:text-white transition-all duration-200">
                  예약 문의
                </button>
              </Link>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('openGolfTalk'))}
                className="px-4 py-2 text-sm font-semibold font-body bg-dogolf-green text-white rounded-lg hover:bg-dogolf-green-dark transition-all duration-200 flex items-center gap-1"
              >
                <span>⛳</span> AI상담사 골프톡
              </button>
            </div>

            {/* Mobile: Search + Menu Button */}
            <div className="lg:hidden flex items-center gap-1">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 text-gray-700 hover:text-dogolf-green transition-colors"
                aria-label="검색"
              >
                <Search size={22} />
              </button>
              <button
                className="p-2 text-gray-700 hover:text-dogolf-green transition-colors"
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                aria-label="메뉴"
              >
                {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg">
            <div className="container py-4">
              <div className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <Link key={`mobile-${item.href}`} href={item.href}>
                    <span
                      className={`block px-4 py-3 text-sm font-medium font-body rounded-lg cursor-pointer transition-colors ${
                        location === item.href || location.startsWith(item.href)
                          ? 'bg-green-50 text-dogolf-green'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                ))}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <Link href="/inquiry">
                    <button className="flex-1 py-2.5 text-sm font-semibold font-body text-dogolf-green border-2 border-dogolf-green rounded-lg hover:bg-dogolf-green hover:text-white transition-all">
                      예약 문의
                    </button>
                  </Link>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('openGolfTalk'))}
                    className="flex-1 py-2.5 text-sm font-semibold font-body bg-dogolf-green text-white rounded-lg hover:bg-dogolf-green-dark transition-all text-center"
                  >
                    ⛳ AI상담사 골프톡
                  </button>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <a href="tel:1668-1739" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600">
                    <Phone size={14} className="text-dogolf-green" />
                    <span className="font-number font-semibold">1668-1739</span>
                    <span className="text-xs text-gray-400">평일 09:00~17:30</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
