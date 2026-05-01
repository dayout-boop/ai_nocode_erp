// ============================================================
// DOGOLF Footer — DB 기반 동적 푸터 + 반응형 토글
// 모바일: 필수 정보만 최소 높이 노출, 클릭 시 부드럽게 확장
// 데스크톱: 4컬럼 전체 노출
// ============================================================

import { useState } from 'react';
import { Link } from 'wouter';
import { Phone, Mail, MapPin, Clock, ChevronDown } from 'lucide-react';
import { trpc } from '@/lib/trpc';

// 기본값 (DB 데이터 없을 때 폴백)
const DEFAULTS = {
  companyName: '두골프',
  ceoName: '홍길동',
  businessNumber: '000-00-00000',
  mailOrderNumber: '제 2022-서울광진-0000호',
  tourismLicenseNumber: '제2016-000000호',
  address: '서울특별시 광진구 자양로 126',
  phone: '1668-1739',
  email: 'info@dogolf.com',
  businessHours: '평일 09:00 ~ 17:30 (점심 12:00~13:00 / 주말·공휴일 휴무)',
  kakaoUrl: 'http://pf.kakao.com/_xbHHSV',
  instagramUrl: 'https://instagram.com/dogolf',
  youtubeUrl: '',
  naverBlogUrl: '',
  copyright: `© ${new Date().getFullYear()} 두골프(DOGOLF). All Rights Reserved.`,
};

// 모바일 아코디언 섹션 컴포넌트
function MobileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        className="w-full flex items-center justify-between py-3 text-left"
      >
        <span className="text-white/80 text-sm font-semibold font-body">{title}</span>
        <ChevronDown
          size={16}
          className={`text-white/50 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? 'max-h-96 pb-3' : 'max-h-0'
        }`}
        aria-hidden={!open}
      >
        {children}
      </div>
    </div>
  );
}

export default function Footer() {
  const { data: footerData } = trpc.siteSettings.getFooter.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const f = { ...DEFAULTS, ...(footerData as Record<string, string> ?? {}) };

  // 모바일 사업자정보 토글
  const [bizExpanded, setBizExpanded] = useState(false);

  return (
    <footer className="bg-dogolf-green-dark text-white">

      {/* ===== 데스크톱 메인 푸터 (md 이상) ===== */}
      <div className="hidden md:block">
        <div className="container py-12 lg:py-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-2 lg:col-span-1">
              <img
                src="/manus-storage/logo_dogolf_bd2382c7.png"
                alt="두골프"
                className="h-12 w-auto object-contain mb-4 brightness-0 invert"
              />
              <p className="text-white/70 text-sm font-body leading-relaxed mb-4">
                국내외 최고의 골프 코스를 연결하는<br />
                프리미엄 골프 여행 전문 여행사
              </p>
              <div className="flex gap-3">
                {f.kakaoUrl && (
                  <a href={f.kakaoUrl} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 bg-[#FEE500] rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                    aria-label="카카오채널">
                    <span className="text-sm">💬</span>
                  </a>
                )}
                {f.instagramUrl && (
                  <a href={f.instagramUrl} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                    aria-label="인스타그램">
                    <span className="text-sm">📸</span>
                  </a>
                )}
                {f.youtubeUrl && (
                  <a href={f.youtubeUrl} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 bg-red-600 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                    aria-label="유튜브">
                    <span className="text-sm">▶</span>
                  </a>
                )}
                {f.naverBlogUrl && (
                  <a href={f.naverBlogUrl} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                    aria-label="네이버 블로그">
                    <span className="text-sm font-bold text-white text-xs">N</span>
                  </a>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-display-ko font-semibold text-white mb-4 text-sm uppercase tracking-wider">골프 목적지</h4>
              <ul className="space-y-2">
                {[
                  { label: '국내 골프', href: '/packages/korea' },
                  { label: '태국 골프', href: '/packages/thailand' },
                  { label: '베트남 골프', href: '/packages/vietnam' },
                  { label: '필리핀 골프', href: '/packages/philippines' },
                  { label: '중국 골프', href: '/packages/china' },
                  { label: '일본 골프', href: '/packages/japan' },
                ].map((item) => (
                  <li key={item.label}>
                    <Link href={item.href}>
                      <span className="text-white/70 hover:text-white text-sm font-body transition-colors cursor-pointer">
                        {item.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Customer Service */}
            <div>
              <h4 className="font-display-ko font-semibold text-white mb-4 text-sm uppercase tracking-wider">고객 서비스</h4>
              <ul className="space-y-2">
                {[
                  { label: '예약 문의', href: '/inquiry' },
                  { label: '공지사항', href: '/notice' },
                  { label: '여행 갤러리', href: '/gallery' },
                  { label: '자주 묻는 질문', href: '/notice?tab=faq' },
                ].map((item) => (
                  <li key={item.label}>
                    <Link href={item.href}>
                      <span className="text-white/70 hover:text-white text-sm font-body transition-colors cursor-pointer">
                        {item.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-display-ko font-semibold text-white mb-4 text-sm uppercase tracking-wider">연락처</h4>
              <ul className="space-y-3">
                {f.phone && (
                  <li className="flex items-start gap-2">
                    <Phone size={14} className="text-dogolf-gold mt-0.5 shrink-0" />
                    <a href={`tel:${f.phone}`} className="text-white font-number font-semibold hover:text-dogolf-gold transition-colors">
                      {f.phone}
                    </a>
                  </li>
                )}
                {f.businessHours && (
                  <li className="flex items-start gap-2">
                    <Clock size={14} className="text-dogolf-gold mt-0.5 shrink-0" />
                    <div className="text-white/70 text-sm font-body">
                      {f.businessHours.split('(').map((part, i) => (
                        <div key={i} className={i > 0 ? 'text-xs text-white/50' : ''}>{i > 0 ? `(${part}` : part}</div>
                      ))}
                    </div>
                  </li>
                )}
                {f.email && (
                  <li className="flex items-start gap-2">
                    <Mail size={14} className="text-dogolf-gold mt-0.5 shrink-0" />
                    <a href={`mailto:${f.email}`} className="text-white/70 text-sm font-body hover:text-white transition-colors">
                      {f.email}
                    </a>
                  </li>
                )}
                {f.address && (
                  <li className="flex items-start gap-2">
                    <MapPin size={14} className="text-dogolf-gold mt-0.5 shrink-0" />
                    <span className="text-white/70 text-sm font-body">{f.address}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* 데스크톱 하단 사업자 정보 */}
        <div className="border-t border-white/10">
          <div className="container py-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
              <div className="text-white/50 text-xs font-body space-y-1">
                <div>
                  {f.companyName && <span>상호: {f.companyName}</span>}
                  {f.ceoName && <span> | 대표: {f.ceoName}</span>}
                  {f.businessNumber && <span> | 사업자등록번호: {f.businessNumber}</span>}
                </div>
                <div>
                  {f.mailOrderNumber && <span>통신판매업신고번호: {f.mailOrderNumber}</span>}
                  {f.tourismLicenseNumber && <span> | 관광사업자 등록번호: {f.tourismLicenseNumber}</span>}
                </div>
                {f.address && <div>주소: {f.address}</div>}
              </div>
              <div className="text-white/40 text-xs font-body">{f.copyright}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 모바일 푸터 (md 미만) ===== */}
      <div className="md:hidden">
        {/* 모바일 최상단 필수 정보 — 항상 노출 */}
        <div className="container py-4">
          <div className="flex items-center justify-between mb-3">
            <img
              src="/manus-storage/logo_dogolf_bd2382c7.png"
              alt="두골프"
              className="h-8 w-auto object-contain brightness-0 invert"
            />
            {/* SNS 아이콘 */}
            <div className="flex gap-2">
              {f.kakaoUrl && (
                <a href={f.kakaoUrl} target="_blank" rel="noopener noreferrer"
                  className="w-7 h-7 bg-[#FEE500] rounded-full flex items-center justify-center"
                  aria-label="카카오채널">
                  <span className="text-xs">💬</span>
                </a>
              )}
              {f.instagramUrl && (
                <a href={f.instagramUrl} target="_blank" rel="noopener noreferrer"
                  className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center"
                  aria-label="인스타그램">
                  <span className="text-xs">📸</span>
                </a>
              )}
            </div>
          </div>

          {/* 대표전화 — 항상 노출 */}
          {f.phone && (
            <a href={`tel:${f.phone}`}
              className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2.5 mb-3 active:bg-white/20 transition-colors">
              <Phone size={15} className="text-dogolf-gold shrink-0" />
              <div>
                <div className="text-white font-number font-bold text-base leading-none">{f.phone}</div>
                <div className="text-white/50 text-xs mt-0.5">탭하여 전화연결</div>
              </div>
            </a>
          )}

          {/* 아코디언 섹션들 */}
          <MobileSection title="골프 목적지">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                { label: '국내 골프', href: '/packages/korea' },
                { label: '태국 골프', href: '/packages/thailand' },
                { label: '베트남 골프', href: '/packages/vietnam' },
                { label: '필리핀 골프', href: '/packages/philippines' },
                { label: '중국 골프', href: '/packages/china' },
                { label: '일본 골프', href: '/packages/japan' },
              ].map((item) => (
                <Link key={item.label} href={item.href}>
                  <span className="text-white/60 hover:text-white text-sm font-body block">{item.label}</span>
                </Link>
              ))}
            </div>
          </MobileSection>

          <MobileSection title="고객 서비스">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                { label: '예약 문의', href: '/inquiry' },
                { label: '공지사항', href: '/notice' },
                { label: '여행 갤러리', href: '/gallery' },
                { label: '자주 묻는 질문', href: '/notice?tab=faq' },
              ].map((item) => (
                <Link key={item.label} href={item.href}>
                  <span className="text-white/60 hover:text-white text-sm font-body block">{item.label}</span>
                </Link>
              ))}
            </div>
          </MobileSection>

          <MobileSection title="연락처 및 운영시간">
            <ul className="space-y-2.5">
              {f.businessHours && (
                <li className="flex items-start gap-2">
                  <Clock size={13} className="text-dogolf-gold mt-0.5 shrink-0" />
                  <span className="text-white/60 text-xs font-body">{f.businessHours}</span>
                </li>
              )}
              {f.email && (
                <li className="flex items-start gap-2">
                  <Mail size={13} className="text-dogolf-gold mt-0.5 shrink-0" />
                  <a href={`mailto:${f.email}`} className="text-white/60 text-xs font-body hover:text-white">{f.email}</a>
                </li>
              )}
              {f.address && (
                <li className="flex items-start gap-2">
                  <MapPin size={13} className="text-dogolf-gold mt-0.5 shrink-0" />
                  <span className="text-white/60 text-xs font-body">{f.address}</span>
                </li>
              )}
            </ul>
          </MobileSection>
        </div>

        {/* 모바일 하단 사업자 정보 — 최소 라인 + 토글 */}
        <div className="border-t border-white/10">
          <div className="container py-3">
            <div className="flex items-center justify-between">
              <div className="text-white/40 text-xs font-body">
                <span>{f.companyName}</span>
                {f.businessNumber && <span className="ml-2">사업자: {f.businessNumber}</span>}
              </div>
              <button
                onClick={() => setBizExpanded((p) => !p)}
                aria-expanded={bizExpanded}
                aria-controls="mobile-biz-detail"
                className="flex items-center gap-1 text-white/40 text-xs hover:text-white/70 transition-colors flex-shrink-0 ml-2"
              >
                <span>{bizExpanded ? '접기' : '상세보기'}</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-300 ${bizExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            {/* 사업자 상세 — max-h 트랜지션으로 SEO 크롤 가능 */}
            <div
              id="mobile-biz-detail"
              className={`overflow-hidden transition-all duration-300 ease-in-out ${bizExpanded ? 'max-h-48 mt-2' : 'max-h-0'}`}
              aria-hidden={!bizExpanded}
            >
              <div className="text-white/40 text-xs font-body space-y-1 pb-1">
                {f.ceoName && <div>대표자: {f.ceoName}</div>}
                {f.mailOrderNumber && <div>통신판매업신고: {f.mailOrderNumber}</div>}
                {f.tourismLicenseNumber && <div>관광사업등록: {f.tourismLicenseNumber}</div>}
                {f.address && <div>주소: {f.address}</div>}
              </div>
            </div>

            <div className="text-white/25 text-xs font-body mt-2">{f.copyright}</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
