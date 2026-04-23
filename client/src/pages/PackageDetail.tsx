// ============================================================
// DOGOLF Package Detail Page — DB 연동 버전 (훅 규칙 준수)
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import {
  ArrowLeft, Clock, RotateCcw, MapPin, CheckCircle2, XCircle,
  Calendar, Users, Phone, MessageCircle, Loader2, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, X, ZoomIn
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import KakaoFloat from '@/components/KakaoFloat';
import { trpc } from '@/lib/trpc';

const countryFlagMap: Record<string, string> = {
  korea: '🇰🇷', thailand: '🇹🇭', vietnam: '🇻🇳',
  philippines: '🇵🇭', china: '🇨🇳', japan: '🇯🇵',
};
const countryNameMap: Record<string, string> = {
  korea: '대한민국', thailand: '태국', vietnam: '베트남',
  philippines: '필리핀', china: '중국', japan: '일본',
};
const optionTypeLabel: Record<string, string> = {
  cart: '카트비', caddie: '캐디피', accommodation: '숙박', vehicle: '교통',
  meal: '식사', insurance: '보험', other: '기타',
};

// ─── 홍보 영상 플레이어 컴포넌트 ─────────────────────────────────────────
function PackageVideoSection({ packageId }: { packageId: number }) {
  const { data: videos, isLoading } = trpc.video.listByPackage.useQuery(
    { packageId },
    { enabled: packageId > 0 }
  );

  const completedVideos = (videos ?? []).filter((v: any) => v.videoUrl);

  if (isLoading) return null;
  if (completedVideos.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <h2 className="font-display-ko text-lg font-bold text-gray-900 mb-4">🎬 홍보 영상</h2>
      <div className="space-y-4">
        {completedVideos.map((v: any) => (
          <div key={v.id} className="rounded-xl overflow-hidden bg-gray-900">
            <video
              src={v.videoUrl}
              controls
              playsInline
              className="w-full max-h-64 object-contain"
              poster={v.thumbnailUrl ?? undefined}
            />
            <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-body">
                {v.durationSeconds ? `${v.durationSeconds}초` : ''}
                {v.createdAt ? ` · ${new Date(v.createdAt).toLocaleDateString('ko-KR')}` : ''}
              </span>
              <a
                href={v.videoUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-dogolf-green font-semibold hover:underline"
              >
                다운로드
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// JSON 파싱 헬퍼
function parseJsonArray(val: unknown): string[] {
  if (!val) return [];
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export default function PackageDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? '0', 10);

  // ✅ 모든 훅을 최상단에 선언 (조건부 return 이전)
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const { data, isLoading, isError } = trpc.packages.publicGet.useQuery(
    { id },
    { enabled: id > 0 }
  );

  // 최근 본 상품 localStorage 저장
  useEffect(() => {
    if (!id || id <= 0) return;
    try {
      const stored = localStorage.getItem('dogolf_recently_viewed');
      const prev: number[] = stored ? JSON.parse(stored) : [];
      const updated = [id, ...prev.filter((v) => v !== id)].slice(0, 8);
      localStorage.setItem('dogolf_recently_viewed', JSON.stringify(updated));
    } catch {}
  }, [id]);

  // 걤러리 이미지 배열 (데이터 없으면 빈 배열)
  const defaultImage = '/manus-storage/hero_main_aa4ec84e.jpg';
  const registeredImages: string[] = data?.images && data.images.length > 0
    ? (data.images as any[]).map((img: any) => img.imageUrl).filter(Boolean)
    : [];
  const galleryImages = registeredImages.length > 0
    ? registeredImages
    : (data?.imageUrl ? [data.imageUrl] : [defaultImage]);

  const prevImage = useCallback(() =>
    setActiveIdx((i) => (i - 1 + galleryImages.length) % galleryImages.length),
    [galleryImages.length]
  );
  const nextImage = useCallback(() =>
    setActiveIdx((i) => (i + 1) % galleryImages.length),
    [galleryImages.length]
  );
  const openLightbox = (idx: number) => { setLightboxIdx(idx); setLightboxOpen(true); };
  const closeLightbox = () => setLightboxOpen(false);
  const prevLightbox = () => setLightboxIdx((i) => (i - 1 + galleryImages.length) % galleryImages.length);
  const nextLightbox = () => setLightboxIdx((i) => (i + 1) % galleryImages.length);

  // ✅ 조건부 return은 모든 훅 선언 이후에만 사용
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-dogolf-green" size={36} />
          <p className="text-gray-500 font-body">상품 정보를 불러오는 중...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-4xl">⛳</p>
          <p className="text-gray-700 font-display-ko text-xl font-bold">상품을 찾을 수 없습니다</p>
          <Link href="/packages">
            <button className="px-5 py-2 bg-dogolf-green text-white rounded-xl font-body text-sm">
              패키지 목록으로 돌아가기
            </button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const pkg = data;
  const flag = countryFlagMap[pkg.country] ?? '🌏';
  const countryName = countryNameMap[pkg.country] ?? pkg.country;

  const highlights = parseJsonArray(pkg.highlights);
  const includesList = parseJsonArray(pkg.includes);
  const excludesList = parseJsonArray(pkg.excludes);

  // 최저가 계산
  const prices = pkg.prices ?? [];
  const minPrice = prices.length > 0
    ? Math.min(...prices.map((p: any) => Number(p.pricePerPerson)))
    : 0;

  // 출발 가능 슬롯
  const slots = (pkg.slots ?? []).filter((s: any) => s.status === 'open');

  // 불포함 옵션 (캐디피, 카트비 등)
  const requiredOptions = (pkg.options ?? []).filter((o: any) => o.isRequired && !o.isIncluded);
  const optionalOptions = (pkg.options ?? []).filter((o: any) => !o.isRequired && !o.isIncluded);

  const descLines = (pkg.description ?? '').split('\n');
  const shortDesc = descLines.slice(0, 8).join('\n');
  const hasMore = descLines.length > 8;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero Gallery */}
      <section className="relative overflow-hidden bg-gray-900">
        {/* 메인 이미지 */}
        <div className="relative h-64 md:h-[480px]">
          <img
            src={galleryImages[activeIdx] ?? defaultImage}
            alt={pkg.title}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* 이전/다음 버튼 (이미지 2장 이상일 때만) */}
          {galleryImages.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
              >
                <ChevronRight size={18} />
              </button>
              {/* 이미지 카운터 */}
              <div className="absolute top-4 right-4 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
                {activeIdx + 1} / {galleryImages.length}
              </div>
            </>
          )}

          {/* 라이트박스 버튼 */}
          <button
            onClick={() => openLightbox(activeIdx)}
            className="absolute top-4 left-4 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
            title="크게 보기"
          >
            <ZoomIn size={14} />
          </button>

          {/* 타이틀 오버레이 */}
          <div className="absolute inset-0 flex items-end">
            <div className="container pb-6">
              <Link href="/packages">
                <button className="flex items-center gap-1 text-white/70 hover:text-white text-sm font-body mb-3 transition-colors">
                  <ArrowLeft size={14} /> 패키지 목록
                </button>
              </Link>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {pkg.isPopular && (
                  <span className="bg-dogolf-red text-white text-xs px-2 py-0.5 rounded-full font-semibold">인기</span>
                )}
                {pkg.isFeatured && (
                  <span className="bg-dogolf-purple text-white text-xs px-2 py-0.5 rounded-full font-semibold">추천</span>
                )}
                <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full">
                  {flag} {countryName} {pkg.region ? `· ${pkg.region}` : ''}
                </span>
              </div>
              <h1 className="font-display-ko text-2xl md:text-4xl font-bold text-white leading-tight">
                {pkg.title}
              </h1>
            </div>
          </div>
        </div>

        {/* 썸네일 스트립 (이미지 2장 이상일 때만) */}
        {galleryImages.length > 1 && (
          <div className="bg-gray-900 px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {galleryImages.map((src, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIdx(idx)}
                className={`shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 transition-all ${
                  idx === activeIdx ? 'border-dogolf-green scale-105' : 'border-transparent opacity-60 hover:opacity-90'
                }`}
              >
                <img src={src} alt={`썸네일 ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 라이트박스 */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-colors"
            onClick={closeLightbox}
          >
            <X size={20} />
          </button>
          {galleryImages.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-colors"
                onClick={(e) => { e.stopPropagation(); prevLightbox(); }}
              >
                <ChevronLeft size={22} />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-colors"
                onClick={(e) => { e.stopPropagation(); nextLightbox(); }}
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}
          <img
            src={galleryImages[lightboxIdx] ?? defaultImage}
            alt="확대 이미지"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 text-white/60 text-sm">
            {lightboxIdx + 1} / {galleryImages.length}
          </div>
        </div>
      )}

      {/* Main content */}
      <section className="py-10 bg-gray-50 flex-1">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left: Details */}
            <div className="lg:col-span-2 space-y-6">

              {/* Quick info */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {pkg.duration && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                        <Clock size={18} className="text-dogolf-green" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-body">기간</p>
                        <p className="font-semibold text-gray-900 font-body text-sm">{pkg.duration}</p>
                      </div>
                    </div>
                  )}
                  {pkg.roundCount && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                        <RotateCcw size={18} className="text-dogolf-purple" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-body">라운딩</p>
                        <p className="font-semibold text-gray-900 font-body text-sm">{pkg.roundCount}회</p>
                      </div>
                    </div>
                  )}
                  {pkg.region && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                        <MapPin size={18} className="text-dogolf-red" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-body">지역</p>
                        <p className="font-semibold text-gray-900 font-body text-sm">{pkg.region}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Highlights */}
              {highlights.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h2 className="font-display-ko text-lg font-bold text-gray-900 mb-4">✨ 상품 하이라이트</h2>
                  <ul className="space-y-2">
                    {highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700 font-body">
                        <span className="text-dogolf-green mt-0.5 shrink-0">•</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Description */}
              {pkg.description && (
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h2 className="font-display-ko text-lg font-bold text-gray-900 mb-4">📋 상품 상세</h2>
                  <pre className={`text-sm text-gray-700 font-body whitespace-pre-wrap leading-relaxed ${!showFullDesc ? 'line-clamp-[8]' : ''}`}>
                    {showFullDesc ? pkg.description : shortDesc}
                  </pre>
                  {hasMore && (
                    <button
                      onClick={() => setShowFullDesc(!showFullDesc)}
                      className="mt-3 flex items-center gap-1 text-dogolf-green text-sm font-semibold font-body hover:underline"
                    >
                      {showFullDesc ? <><ChevronUp size={14} /> 접기</> : <><ChevronDown size={14} /> 더 보기</>}
                    </button>
                  )}
                </div>
              )}

              {/* Includes / Excludes */}
              {(includesList.length > 0 || excludesList.length > 0) && (
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h2 className="font-display-ko text-lg font-bold text-gray-900 mb-4">포함/불포함 사항</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {includesList.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-dogolf-green font-body mb-3 flex items-center gap-1">
                          <CheckCircle2 size={14} /> 포함 사항
                        </h3>
                        <ul className="space-y-2">
                          {includesList.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 font-body">
                              <CheckCircle2 size={13} className="text-dogolf-green mt-0.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {excludesList.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-dogolf-red font-body mb-3 flex items-center gap-1">
                          <XCircle size={14} /> 불포함 사항
                        </h3>
                        <ul className="space-y-2">
                          {excludesList.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 font-body">
                              <XCircle size={13} className="text-dogolf-red mt-0.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 홍보 영상 섹션 */}
              <PackageVideoSection packageId={id} />

              {/* Options (캐디피, 카트비 등) */}
              {(requiredOptions.length > 0 || optionalOptions.length > 0) && (
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h2 className="font-display-ko text-lg font-bold text-gray-900 mb-4">⚙️ 추가 옵션</h2>
                  {requiredOptions.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-dogolf-red font-semibold font-body mb-2">필수 (별도 현지 지불)</p>
                      <div className="space-y-2">
                        {requiredOptions.map((opt: any) => (
                          <div key={opt.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <div>
                              <span className="text-xs bg-red-50 text-dogolf-red px-2 py-0.5 rounded-full font-body mr-2">
                                {optionTypeLabel[opt.optionType] ?? opt.optionType}
                              </span>
                              <span className="text-sm text-gray-800 font-body">{opt.name}</span>
                              {opt.description && (
                                <p className="text-xs text-gray-400 font-body mt-0.5">{opt.description}</p>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-gray-900 font-number shrink-0 ml-4">
                              {Number(opt.price) > 0 ? `${Number(opt.price).toLocaleString()}원` : '현지 결제'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {optionalOptions.length > 0 && (
                    <div>
                      <p className="text-xs text-dogolf-green font-semibold font-body mb-2">선택 옵션</p>
                      <div className="space-y-2">
                        {optionalOptions.map((opt: any) => (
                          <div key={opt.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <div>
                              <span className="text-xs bg-green-50 text-dogolf-green px-2 py-0.5 rounded-full font-body mr-2">
                                {optionTypeLabel[opt.optionType] ?? opt.optionType}
                              </span>
                              <span className="text-sm text-gray-800 font-body">{opt.name}</span>
                              {opt.description && (
                                <p className="text-xs text-gray-400 font-body mt-0.5">{opt.description}</p>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-gray-900 font-number shrink-0 ml-4">
                              {Number(opt.price) > 0 ? `${Number(opt.price).toLocaleString()}원` : '문의'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Booking sidebar */}
            <div className="space-y-4">

              {/* Price card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-dogolf-green/20 sticky top-24">
                <p className="text-xs text-dogolf-green font-semibold font-body uppercase tracking-widest mb-1">요금 안내</p>
                {prices.length > 0 ? (
                  <div className="space-y-3 mb-5">
                    {prices.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-gray-800 font-body">
                            {p.minPeople === p.maxPeople
                              ? `${p.minPeople}인팩`
                              : `${p.minPeople}~${p.maxPeople}인`}
                          </p>
                          <p className="text-xs text-gray-400 font-body">
                            {p.season === 'peak' ? '성수기' : p.season === 'off' ? '비수기' : '일반'}
                            {p.validFrom && ` · ${new Date(p.validFrom).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}~${new Date(p.validTo).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}`}
                          </p>
                        </div>
                        <p className="text-base font-bold text-dogolf-green font-number">
                          {Number(p.pricePerPerson).toLocaleString()}원
                        </p>
                      </div>
                    ))}
                    {minPrice > 0 && (
                      <p className="text-xs text-gray-400 font-body text-right">최저 {minPrice.toLocaleString()}원~/인</p>
                    )}
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-dogolf-green font-number mb-5">가격 문의</p>
                )}

                {/* Departure slots */}
                {slots.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs text-gray-500 font-body mb-2 flex items-center gap-1">
                      <Calendar size={12} /> 출발 가능 일정
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {slots.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                          <span className="text-xs text-gray-700 font-body">
                            {new Date(s.departureDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                          </span>
                          <span className="text-xs text-dogolf-green font-semibold font-body">예약 가능</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA buttons */}
                <div className="space-y-2">
                  <Link href={`/inquiry?package=${pkg.id}&name=${encodeURIComponent(pkg.title)}`}>
                    <button className="w-full py-3.5 bg-dogolf-green text-white font-bold font-body rounded-xl hover:bg-dogolf-green-dark transition-colors flex items-center justify-center gap-2 shadow-md">
                      <Users size={16} /> 온라인 예약 문의
                    </button>
                  </Link>
                  <a
                    href="http://pf.kakao.com/_xbHHSV"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-[#FEE500] text-[#3A1D1D] font-bold font-body rounded-xl hover:bg-[#FFD700] transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={16} /> 카카오톡 실시간 상담
                  </a>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('openAIChat', { detail: { packageTitle: pkg.title } }))}
                    className="w-full py-3 bg-gradient-to-r from-dogolf-purple to-blue-600 text-white font-bold font-body rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    🤖 AI 스마트 상담 (즉시 응답)
                  </button>
                  <a
                    href="tel:1668-1739"
                    className="w-full py-3 bg-gray-100 text-gray-700 font-semibold font-body rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Phone size={16} /> 1668-1739 전화 상담
                  </a>
                </div>
                <p className="text-xs text-gray-400 font-body text-center mt-3">평일 09:00~17:30 | AI상담 24시간</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <KakaoFloat />
    </div>
  );
}
