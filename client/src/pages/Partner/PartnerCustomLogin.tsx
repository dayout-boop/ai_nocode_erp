import { useState } from 'react';
import { ArrowRight, Loader2, Lock, Shield, Eye, EyeOff } from 'lucide-react';

// OAuth 제공자 아이콘 컴포넌트
function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="12" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="1" y="12" width="9" height="9" fill="#00A4EF"/>
      <rect x="12" y="12" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}

function MetaIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.55a11.3 11.3 0 1 1-13.6-11.048v2.747h-2.91V2.69h2.91V.277C10.39 0 11.432 0 12.814 0c3.804 0 4.844.3 5.769 1.644.533.804.906 2.718.906 4.762v1.254h2.909l-.454 3.426h-2.455v8.814c.964.096 1.96.147 2.97.147Z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.905-.08 1.77-.67 2.92-.78 1.54.08 2.7.76 3.36 1.84-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.61-2.84 3.38l-.03-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

export default function PartnerCustomLogin() {
  const [loading, setLoading] = useState<string | null>(null);
  const INVITATION_CODE = '4GFPMBWPCYQM6';

  const handleOAuthLogin = async (provider: 'google' | 'microsoft' | 'facebook' | 'apple') => {
    setLoading(provider);
    try {
      // 서버에서 OAuth URL 생성 요청
      const response = await fetch(`/api/oauth/custom-login/${provider}?code=${INVITATION_CODE}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get ${provider} login URL`);
      }

      const { url } = await response.json();
      
      // 새 탭에서 OAuth 화면으로 이동
      window.open(url, '_blank', 'width=500,height=600');
    } catch (error) {
      console.error(`${provider} login error:`, error);
      alert(`${provider} 로그인 준비 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`);
    } finally {
      setLoading(null);
    }
  };

  const securityBadges = [
    { icon: <Lock size={14} />, label: "SSL 256비트 암호화" },
    { icon: <Shield size={14} />, label: "개인정보 미수집" },
    { icon: <Eye size={14} />, label: "OAuth 2.0 인증" },
    { icon: <EyeOff size={14} />, label: "비밀번호 저장 없음" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col">
      {/* 배경 그라데이션 효과 */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-green-900/20 pointer-events-none" />

      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          {/* 헤더 */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-green-400 to-blue-500 rounded-xl mb-4 shadow-lg">
              <span className="text-xl sm:text-2xl font-bold text-white">⛳</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              파트너 로그인
            </h1>
            <p className="text-gray-400 text-sm sm:text-base">
              투어커뮤니케이션 파트너 센터에 접속하세요
            </p>
          </div>

          {/* 로그인 카드 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-sm mb-4">
            {/* OAuth 제공자 버튼들 */}
            <div className="space-y-3 mb-6">
              {/* Google */}
              <button
                onClick={() => handleOAuthLogin('google')}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-800 font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === 'google' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                <span className="text-sm sm:text-base">Google로 계속</span>
              </button>

              {/* Microsoft */}
              <button
                onClick={() => handleOAuthLogin('microsoft')}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-800 font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === 'microsoft' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <MicrosoftIcon />
                )}
                <span className="text-sm sm:text-base">Microsoft로 계속</span>
              </button>

              {/* Meta (Facebook) */}
              <button
                onClick={() => handleOAuthLogin('facebook')}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-800 font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === 'facebook' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <MetaIcon />
                )}
                <span className="text-sm sm:text-base">Meta로 계속</span>
              </button>

              {/* Apple */}
              <button
                onClick={() => handleOAuthLogin('apple')}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-800 font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === 'apple' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <AppleIcon />
                )}
                <span className="text-sm sm:text-base">Apple로 계속</span>
              </button>
            </div>

            {/* 안내 문구 */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-6">
              <p className="text-xs sm:text-sm text-blue-200">
                💡 <strong>팁:</strong> 계정이 없으면 선택한 서비스로 자동 가입됩니다. 초대 크레딧이 자동으로 적용됩니다.
              </p>
            </div>
          </div>

          {/* 보안 배지 */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <Shield size={16} className="text-green-400" />
              완벽한 보안설계
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {securityBadges.map((badge, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-gray-300">
                  <span className="text-green-400">{badge.icon}</span>
                  <span>{badge.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 하단 안내 */}
          <p className="text-center text-xs text-gray-500 mt-6">
            계속 진행하면 투어커뮤니케이션 서비스약관과 개인정보정책에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
