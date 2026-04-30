// ============================================================
// DOGOLF Footer — DB 기반 동적 푸터 + 반응형 토글
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
  copyright: '© 2026 두골프(DOGOLF). All Rights Reserved.',
};

export default function Footer() {
  const { data: footerData } = trpc.siteSettings.getFooter.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5분 캐시
  });

  // DB 데이터와 기본값 병합
  const f = { ...DEFAULTS, ...(footerData as Record<string, string> ?? {}) };

  // 모바일 상세 토글 상태
  const [expanded, setExpanded] = useState(false);

  return (
    <footer className="bg-dogolf-green-dark text-white">
      {/* Main footer — 데스크톱 전체 노출 */}
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
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
                <a
                  href={f.kakaoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 bg-[#FEE500] rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                  aria-label="카카오채널"
                >
                  <span className="text-sm">💬</span>
                </a>
              )}
              {f.instagramUrl && (
                <a
                  href={f.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                  aria-label="인스타그램"
                >
                  <span className="text-sm">📸</span>
                </a>
              )}
              {f.youtubeUrl && (
                <a
                  href={f.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 bg-red-600 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                  aria-label="유튜브"
                >
                  <span className="text-sm">▶</span>
                </a>
              )}
              {f.naverBlogUrl && (
                <a
                  href={f.naverBlogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                  aria-label="네이버 블로그"
                >
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
                      <div key={i} className={i > 0 ? "text-xs text-white/50" : ""}>{i > 0 ? `(${part}` : part}</div>
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

      {/* Bottom bar — 사업자 정보 */}
      <div className="border-t border-white/10">
        <div className="container py-4 md:py-6">
          {/* 모바일: 최소 라인 + 토글 */}
          <div className="md:hidden">
            {/* 항상 노출되는 최소 정보 */}
            <div className="flex items-center justify-between">
              <div className="text-white/60 text-xs font-body space-y-0.5">
                <div className="font-semibold text-white/80">{f.companyName}</div>
                <div>{f.phone && <span>대표전화: {f.phone}</span>}</div>
                {f.businessNumber && <div>사업자등록번호: {f.businessNumber}</div>}
              </div>
              <button
                onClick={() => setExpanded((p) => !p)}
                aria-expanded={expanded}
                aria-controls="footer-detail"
                className="flex items-center gap-1 text-white/50 text-xs hover:text-white/80 transition-colors ml-2 flex-shrink-0"
              >
                <span>{expanded ? "접기" : "회사정보 더보기"}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            {/* 확장 영역 — 접힌 상태에서도 SEO 크롤 가능 (hidden 대신 max-h 트랜지션) */}
            <div
              id="footer-detail"
              className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded ? "max-h-96 mt-3" : "max-h-0"}`}
              aria-hidden={!expanded}
            >
              {/* 접힌 상태에서도 크롤 가능하도록 visually hidden이 아닌 max-h 사용 */}
              <div className="text-white/50 text-xs font-body space-y-1 pb-2">
                {f.ceoName && <div>대표자: {f.ceoName}</div>}
                {f.mailOrderNumber && <div>통신판매업신고: {f.mailOrderNumber}</div>}
                {f.tourismLicenseNumber && <div>관광사업등록: {f.tourismLicenseNumber}</div>}
                {f.address && <div>주소: {f.address}</div>}
                {f.email && <div>이메일: {f.email}</div>}
                {f.businessHours && <div>운영시간: {f.businessHours}</div>}
              </div>
            </div>

            <div className="text-white/30 text-xs font-body mt-2">{f.copyright}</div>
          </div>

          {/* 데스크톱: 전체 노출 */}
          <div className="hidden md:flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
    </footer>
  );
}
