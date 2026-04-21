// ============================================================
// DOGOLF Footer — Verdant Journey Design
// ============================================================

import { Link } from 'wouter';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-dogolf-green-dark text-white">
      {/* Main footer */}
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
              <a
                href="http://pf.kakao.com/_xbHHSV"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-[#FEE500] rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                aria-label="카카오톡"
              >
                <span className="text-sm">💬</span>
              </a>
              <a
                href="https://instagram.com/dogolf"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                aria-label="인스타그램"
              >
                <span className="text-sm">📸</span>
              </a>
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
                <li key={item.href}>
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
                { label: '자주 묻는 질문', href: '/notice' },
              ].map((item) => (
                <li key={item.href}>
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
              <li className="flex items-start gap-2">
                <Phone size={14} className="text-dogolf-gold mt-0.5 shrink-0" />
                <div>
                  <a href="tel:1668-1739" className="text-white font-number font-semibold hover:text-dogolf-gold transition-colors">
                    1668-1739
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Clock size={14} className="text-dogolf-gold mt-0.5 shrink-0" />
                <div className="text-white/70 text-sm font-body">
                  <div>평일 09:00 ~ 17:30</div>
                  <div className="text-xs text-white/50">(점심 12:00~13:00 / 주말·공휴일 휴무)</div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Mail size={14} className="text-dogolf-gold mt-0.5 shrink-0" />
                <a href="mailto:info@dogolf.com" className="text-white/70 text-sm font-body hover:text-white transition-colors">
                  info@dogolf.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={14} className="text-dogolf-gold mt-0.5 shrink-0" />
                <span className="text-white/70 text-sm font-body">
                  서울특별시 광진구 자양로 126
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="text-white/50 text-xs font-body space-y-1">
              <div>상호: 두골프 | 대표: 홍길동 | 사업자등록번호: 000-00-00000</div>
              <div>통신판매업신고번호: 제 2022-서울광진-0000호 | 관광사업자 등록번호: 제2016-000000호</div>
            </div>
            <div className="text-white/40 text-xs font-body">
              © 2026 두골프(DOGOLF). All Rights Reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
