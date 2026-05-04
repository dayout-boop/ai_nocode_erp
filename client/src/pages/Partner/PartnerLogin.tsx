/**
 * 투어커뮤니케이션 파트너 커스텀 로그인 페이지
 * - Manus/Meta 브랜드 완전 차단
 * - "10초 간편 가입 / 로그인" 버튼
 * - 보안 안심 메시지
 * - 모바일 최적화
 */

import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  Zap,
  Users,
  BarChart3,
  Bot,
} from "lucide-react";

// 구글 로고 SVG
function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// 파트너 혜택 목록
const BENEFITS = [
  {
    icon: <Bot size={18} className="text-emerald-400" />,
    title: "AI 자동화 ERP",
    desc: "예약·정산·고객관리 자동화",
  },
  {
    icon: <BarChart3 size={18} className="text-emerald-400" />,
    title: "실시간 매출 분석",
    desc: "일별·월별·상품별 통계 대시보드",
  },
  {
    icon: <Users size={18} className="text-emerald-400" />,
    title: "고객 상담 AI",
    desc: "24시간 자동 응대 챗봇 제공",
  },
  {
    icon: <Zap size={18} className="text-emerald-400" />,
    title: "5분 내 오픈",
    desc: "사업자등록증 하나로 즉시 시작",
  },
];

// 보안 배지 목록
const SECURITY_BADGES = [
  { icon: <Lock size={14} />, label: "SSL 256비트 암호화" },
  { icon: <Shield size={14} />, label: "개인정보 미수집" },
  { icon: <Eye size={14} />, label: "OAuth 2.0 인증" },
  { icon: <EyeOff size={14} />, label: "비밀번호 저장 없음" },
];

export default function PartnerLogin() {
  // 초대코드를 포함한 manus.im 로그인 URL 생성
  // 모든 OAuth 제공자(Google/Facebook/Apple/Microsoft)에서 자동으로 초대코드 크레딧 적용됨
  const INVITATION_CODE = '4GFPMBWPCYQM6';
  const loginUrl = `https://manus.im/login?code=${INVITATION_CODE}`;

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col">
      {/* 배경 그라데이션 효과 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <Link href="/partner-landing">
          <div className="flex items-center gap-2.5 cursor-pointer">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">TC</span>
            </div>
            <span className="text-white font-semibold text-sm">투어커뮤니케이션</span>
          </div>
        </Link>
        <Link href="/">
          <span className="text-white/40 hover:text-white/70 text-xs transition-colors cursor-pointer">
            두골프 홈으로
          </span>
        </Link>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* 타이틀 섹션 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full mb-5">
              <CheckCircle2 size={12} />
              <span>무료로 시작 · 신용카드 불필요</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3 leading-tight">
              투어커뮤니케이션<br />
              <span className="text-emerald-400">파트너 센터</span>
            </h1>
            <p className="text-white/50 text-sm leading-relaxed">
              골프투어 여행사를 위한 AI 기반 ERP 플랫폼<br />
              지금 바로 무료로 시작하세요
            </p>
          </div>

          {/* 로그인 카드 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-sm mb-4">
            {/* 10초 간편 가입/로그인 버튼 */}
            <a href={loginUrl} target="_blank" rel="noopener noreferrer" className="block mb-6">
              <button className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] group">
                <GoogleIcon />
                <span className="text-base">10초 간편 가입 / 로그인</span>
                <ArrowRight
                  size={16}
                  className="text-gray-400 group-hover:translate-x-0.5 transition-transform"
                />
              </button>
            </a>

            {/* 구분선 */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/30 text-xs">구글 계정으로 1단계 인증</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* 파트너 혜택 */}
            <div className="space-y-3">
              {BENEFITS.map((benefit, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    {benefit.icon}
                  </div>
                  <div>
                    <div className="text-white/80 text-sm font-medium">{benefit.title}</div>
                    <div className="text-white/40 text-xs">{benefit.desc}</div>
                  </div>
                  <CheckCircle2 size={14} className="text-emerald-500/60 ml-auto flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* 보안 안심 메시지 */}
          <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={14} className="text-emerald-400" />
              <span className="text-emerald-400 text-xs font-semibold">완벽한 보안 설계</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SECURITY_BADGES.map((badge, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-emerald-500/60">{badge.icon}</span>
                  <span className="text-white/50 text-xs">{badge.label}</span>
                </div>
              ))}
            </div>
            <p className="text-white/35 text-xs mt-3 leading-relaxed">
              투어커뮤니케이션은 구글 OAuth를 통해 인증만 처리하며,
              개인정보를 직접 수집하거나 저장하지 않습니다.
            </p>
          </div>

          {/* 하단 링크 */}
          <div className="text-center space-y-2">
            <p className="text-white/30 text-xs">
              이미 하위 담당자 계정이 있으신가요?{" "}
              <Link href="/partner/staff/login">
                <span className="text-emerald-400/70 hover:text-emerald-400 cursor-pointer underline underline-offset-2 transition-colors">
                  담당자 로그인
                </span>
              </Link>
            </p>
            <div className="flex items-center justify-center gap-3 text-white/20 text-xs">
              <Link href="/terms">
                <span className="hover:text-white/40 cursor-pointer transition-colors">이용약관</span>
              </Link>
              <span>·</span>
              <Link href="/privacy">
                <span className="hover:text-white/40 cursor-pointer transition-colors">개인정보처리방침</span>
              </Link>
              <span>·</span>
              <Link href="/partner-landing">
                <span className="hover:text-white/40 cursor-pointer transition-colors">서비스 소개</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="relative z-10 text-center py-4 border-t border-white/5">
        <p className="text-white/20 text-xs">
          © 2025 투어커뮤니케이션 · 두골프 파트너 플랫폼
        </p>
      </footer>
    </div>
  );
}
