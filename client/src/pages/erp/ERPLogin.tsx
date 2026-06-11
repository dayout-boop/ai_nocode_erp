import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Eye, EyeOff, Lock, User } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ERPLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 입력하세요.');
      setIsLoading(false);
      return;
    }

    try {
      // tRPC superjson 형식으로 API 호출
      const response = await fetch('/api/trpc/adminAuth.login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 쿠키 포함 (admin_session)
        body: JSON.stringify({
          json: {
            username: username.trim(),
            password: password.trim(),
          },
        }),
      });

      const data = await response.json();

      // tRPC 응답 형식 확인
      if (data.error) {
        // 단일 응답 오류 형식
        const msg = data.error?.json?.message || '로그인 실패';
        setError(msg);
        setIsLoading(false);
        return;
      }

      // 성공 응답: { result: { data: { json: { success, adminId, username, role } } } }
      const resultData = data.result?.data?.json || data.result?.data;
      if (resultData?.success) {
        // 로그인 성공 - 세션 쿠키가 자동으로 설정됨
        localStorage.setItem('adminLoginTime', new Date().toISOString());
        localStorage.setItem('adminUsername', resultData.username || username.trim());
        // 절대 URL로 /erp 이동
        window.location.href = window.location.origin + '/erp';
        return;
      }

      setError('로그인 실패. 응답을 확인하세요.');
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-dogolf-green/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-dogolf-gold/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-dogolf-green rounded-2xl mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AI ERP</h1>
          <p className="text-slate-400">마스터 관리자 로그인</p>
        </div>

        {/* Login Card */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-white">관리자 로그인</CardTitle>
            <CardDescription className="text-slate-400">
              등록된 관리자 계정으로 로그인하세요
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">아이디</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <Input
                    type="text"
                    placeholder="관리자 아이디"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-dogolf-green focus:ring-dogolf-green/20"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-dogolf-green focus:ring-dogolf-green/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert className="bg-red-500/10 border-red-500/50">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <AlertDescription className="text-red-400">{error}</AlertDescription>
                </Alert>
              )}

              {/* Login Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-dogolf-green hover:bg-dogolf-green-dark text-white font-semibold py-2 h-auto"
              >
                {isLoading ? '로그인 중...' : '로그인'}
              </Button>
            </form>

            {/* Security Info */}
            <div className="mt-6 pt-6 border-t border-slate-700">
              <p className="text-xs text-slate-500 text-center">
                🔒 보안 정보: 이 페이지는 암호화된 연결(HTTPS)을 사용합니다.
              </p>
              <p className="text-xs text-slate-500 text-center mt-2">
                비밀번호는 절대 공유하지 마세요.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              const baseUrl = window.location.origin;
              window.location.href = `${baseUrl}/`;
            }}
            className="text-slate-400 hover:text-slate-300 text-sm transition-colors"
          >
            ← 홀으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
