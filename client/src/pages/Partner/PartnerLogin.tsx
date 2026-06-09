/**
 * 두골프 파트너 ERP 로그인 페이지
 * - 아이디/비밀번호 로그인이 기본 (메인)
 * - 구글 로그인은 보조 옵션
 */

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

// 구글 로고 SVG
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

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

export default function PartnerLogin() {
  const { error } = useUrlParams();
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const res = await fetch('/api/partner/auth/email/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ loginId, loginPw }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.redirectTo || '/partner/dashboard';
      } else {
        setLoginError(data.error || '로그인에 실패했습니다.');
      }
    } catch {
      setLoginError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    window.location.href = `/api/partner/auth/google?returnUrl=${encodeURIComponent('/partner/dashboard')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* 로고 */}
      <div className="mb-8 text-center">
        <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <span className="text-white font-bold text-xl">⛳</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">두골프 파트너 ERP</h1>
        <p className="text-sm text-gray-500 mt-1">파트너 전용 로그인</p>
      </div>

      {/* 로그인 카드 */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        {/* 구글 에러 메시지 */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
            <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-red-600 text-sm">구글 로그인 오류가 발생했습니다. 아이디/비밀번호로 로그인해주세요.</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* 아이디 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">아이디</label>
            <input
              type="text"
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              placeholder="아이디 또는 이메일 입력"
              className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              required
              autoComplete="username"
              autoFocus
            />
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={loginPw}
                onChange={e => setLoginPw(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* 에러 메시지 */}
          {loginError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-red-600 text-sm">{loginError}</p>
            </div>
          )}

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 text-sm mt-1"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 구분선 */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-xs">또는</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* 구글 로그인 */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2.5 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60 text-gray-700 font-medium py-2.5 rounded-lg transition-all duration-200 text-sm"
        >
          <GoogleIcon />
          <span>{googleLoading ? '연결 중...' : '구글 계정으로 로그인'}</span>
        </button>

        {/* 비밀번호 찾기 */}
        <div className="text-center mt-5">
          <Link href="/partner/reset-password">
            <span className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer transition-colors">
              비밀번호를 잊으셨나요?
            </span>
          </Link>
        </div>
      </div>

      {/* 하단 링크 */}
      <div className="mt-6 text-center space-y-2">
        <p className="text-sm text-gray-500">
          아직 파트너가 아니신가요?{' '}
          <Link href="/partner/onboarding-chat">
            <span className="text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer">
              무료로 시작하기
            </span>
          </Link>
        </p>
        <p className="text-xs text-gray-400">
          직원 계정으로 로그인하시려면{' '}
          <Link href="/partner/staff/login">
            <span className="text-gray-500 hover:text-gray-700 cursor-pointer underline">
              담당자 로그인
            </span>
          </Link>
        </p>
      </div>
    </div>
  );
}
