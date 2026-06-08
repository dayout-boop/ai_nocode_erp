/**
 * 투어커뮤니케이션 파트너 로그인 페이지
 * - 구글 OAuth 직접 연동 (Manus 종속 없음)
 * - /api/partner/auth/google 엔드포인트로 직접 리다이렉트
 * - 승인 대기 상태 안내 포함
 */

import { useEffect, useState } from "react";
import { Link } from "wouter";
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
  Clock,
  Mail,
  FileText,
  AlertTriangle,
  XCircle,
  RefreshCw,
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

// URL 파라미터 파싱
function useUrlParams() {
  const [params, setParams] = useState<{ status?: string; error?: string; email?: string; reason?: string }>({});
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setParams({
      status: search.get('status') || undefined,
      error: search.get('error') || undefined,
      email: search.get('email') || undefined,
      reason: search.get('reason') || undefined,
    });
  }, []);
  return params;
}

// 에러 메시지 변환
function getErrorMessage(error?: string): string | null {
  if (!error) return null;
  const messages: Record<string, string> = {
    cancelled: '구글 로그인을 취소했습니다. 다시 시도해주세요.',
    no_code: '인증 코드를 받지 못했습니다. 다시 시도해주세요.',
    not_configured: '구글 OAuth가 설정되지 않았습니다. 관리자에게 문의해주세요.',
    token_exchange_failed: '구글 인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
    token_error: '구글 토큰 오류가 발생했습니다. 다시 시도해주세요.',
    userinfo_failed: '구글 사용자 정보를 가져오지 못했습니다. 다시 시도해주세요.',
    invalid_userinfo: '구글 계정 정보가 올바르지 않습니다.',
    email_not_verified: '구글 이메일 인증이 완료되지 않은 계정입니다.',
    db_error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    internal_error: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  };
  return messages[error] || '로그인 중 오류가 발생했습니다. 다시 시도해주세요.';
}

export default function PartnerLogin() {
  const { status, error, email, reason } = useUrlParams();
  const [isLoading, setIsLoading] = useState(false);

  // 구글 OAuth 직접 로그인 — /api/partner/auth/google 으로 리다이렉트
  const handleGoogleLogin = () => {
    setIsLoading(true);
    const returnUrl = encodeURIComponent('/partner/dashboard');
    window.location.href = `/api/partner/auth/google?returnUrl=${returnUrl}`;
  };

  // 공통 헤더 컴포넌트
  const StatusHeader = () => (
    <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
      <Link href="/partner-landing">
        <div className="flex items-center gap-2.5 cursor-pointer">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">TC</span>
          </div>
          <span className="text-white font-semibold text-sm">투어커뮤니케이션</span>
        </div>
      </Link>
    </header>
  );

  // ─── 등록증 미제출 (pending) 상태 ───
  if (status === 'pending_approval') {
    const pendingVerifyUrl = email
      ? `/partner/pending-verification?email=${encodeURIComponent(email)}`
      : '/partner/pending-verification';

    return (
      <div className="min-h-screen bg-[#0a0f1a] flex flex-col">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-600/8 rounded-full blur-3xl" />
        </div>
        <StatusHeader />
        <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            {/* 상단 아이콘 + 제목 */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText size={32} className="text-amber-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">사업자 인증 필요</h1>
              <p className="text-white/50 text-sm leading-relaxed">
                가입이 진행 중입니다. 사업자등록증을 제출하면<br />
                <strong className="text-emerald-400">즉시 자동 승인</strong>되어 ERP를 사용할 수 있습니다.
              </p>
            </div>

            {/* 구글 인증 계정 표시 */}
            {email && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span className="text-emerald-400 text-xs font-semibold">구글 인증 완료</span>
                </div>
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <Mail size={13} className="text-white/40" />
                  <span>{email}</span>
                </div>
                <p className="text-white/35 text-xs mt-1">이 계정으로 가입이 진행 중입니다.</p>
              </div>
            )}

            {/* 등록증 업로드 안내 카드 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <h3 className="text-white/80 text-sm font-semibold mb-3">📋 등록증 제출 방법</h3>
              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <p className="text-white/60 text-xs">아래 버튼을 클릭하여 인증 페이지로 이동</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <p className="text-white/60 text-xs">사업자등록증 또는 관광사업자등록증 업로드</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <p className="text-white/60 text-xs">AI 자동 인식 후 즉시 ERP 접속 가능</p>
                </div>
              </div>
              <a
                href={pendingVerifyUrl}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg"
              >
                <FileText size={16} />
                <span>사업자 인증 페이지로 이동</span>
                <ArrowRight size={14} />
              </a>
            </div>

            {/* 다른 계정 로그인 */}
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 font-medium py-3 px-6 rounded-xl transition-all duration-200 border border-white/10 text-sm"
            >
              <RefreshCw size={14} />
              <span>다른 구글 계정으로 로그인</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─── 업종 검토 중 (reviewing) 상태 ───
  if (status === 'reviewing') {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex flex-col">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl" />
        </div>
        <StatusHeader />
        <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} className="text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">업종 확인 중</h1>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              제출하신 사업자등록증의 업종을 확인 중입니다.<br />
              담당자가 검토 후 <strong className="text-blue-400">1~2 영업일 내</strong>에 안내드립니다.
            </p>
            {email && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 justify-center text-white/60 text-sm">
                  <Mail size={14} />
                  <span>{email}</span>
                </div>
                <p className="text-white/40 text-xs mt-2">검토 완료 시 위 이메일로 안내드립니다.</p>
              </div>
            )}
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mb-4 text-left">
              <p className="text-blue-300/80 text-xs font-semibold mb-2">📌 추가 자료 제출 안내</p>
              <p className="text-white/50 text-xs leading-relaxed">
                여행업/관광업 관련 홈페이지, 블로그, SNS 주소가 있으시면
                아래 이메일로 보내주시면 검토에 도움이 됩니다.
              </p>
              <a href="mailto:partner@dayoutgolf.com" className="text-blue-400 text-xs mt-2 block hover:underline">
                partner@dayoutgolf.com
              </a>
            </div>
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 font-medium py-3 px-6 rounded-xl transition-all duration-200 border border-white/10 text-sm"
            >
              <RefreshCw size={14} />
              <span>다른 구글 계정으로 로그인</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─── 승인 거부 (rejected) 상태 ───
  if (status === 'rejected') {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex flex-col">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-red-600/8 rounded-full blur-3xl" />
        </div>
        <StatusHeader />
        <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle size={32} className="text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">가입 신청 거부</h1>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              안타깝게도 가입 신청이 승인되지 않았습니다.
            </p>
            {reason && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6 text-left">
                <p className="text-red-300/80 text-xs font-semibold mb-1">거부 사유</p>
                <p className="text-white/60 text-sm">{decodeURIComponent(reason)}</p>
              </div>
            )}
            {email && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 justify-center text-white/60 text-sm">
                  <Mail size={14} />
                  <span>{email}</span>
                </div>
                <p className="text-white/40 text-xs mt-2">자세한 안내는 위 이메일로 발송되었습니다.</p>
              </div>
            )}
            <div className="space-y-3">
              <a
                href="/partner/onboarding-chat"
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg"
              >
                <RefreshCw size={14} />
                <span>재신청하기</span>
              </a>
              <a
                href="mailto:partner@dayoutgolf.com"
                className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 font-medium py-3 px-6 rounded-xl transition-all duration-200 border border-white/10 text-sm"
              >
                <Mail size={14} />
                <span>이의 신청 문의</span>
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

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

          {/* 오류 메시지 */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
              <p className="text-red-300 text-sm text-center">{getErrorMessage(error)}</p>
            </div>
          )}

          {/* 로그인 카드 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-sm mb-4">
            {/* 구글 로그인 버튼 */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-800 font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group mb-6"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              <span className="text-base">
                {isLoading ? '구글 로그인 중...' : '10초 간편 가입 / 로그인'}
              </span>
              {!isLoading && (
                <ArrowRight
                  size={16}
                  className="text-gray-400 group-hover:translate-x-0.5 transition-transform"
                />
              )}
            </button>

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
              구글 OAuth를 통해 인증만 처리하며,
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
