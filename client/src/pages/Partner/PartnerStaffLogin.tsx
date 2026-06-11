/**
 * 하위 담당자 로그인 페이지
 * - 통합 로그인: /partner/login 에서 오너/직원 모두 처리
 * - 이 페이지는 /partner/login 으로 자동 리다이렉트
 * - 비밀번호 재설정 기능은 유지 (직접 접근 시 사용 가능)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Eye, EyeOff, Loader2, LogIn, KeyRound, ArrowLeft, CheckCircle2, Mail,
} from "lucide-react";
import { Link } from "wouter";

type View = "login" | "forgot" | "forgot-sent" | "reset";

export default function PartnerStaffLogin() {
  const [view, setView] = useState<View>("login");
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [forgotLoginId, setForgotLoginId] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);

  // ─── 로그인 뮤테이션 (통합 로그인 /partner/login 으로 리다이렉트) ──────────
  const loginMutation = trpc.partnerStaff.login.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.staff.name}님, 환영합니다!`);
      // 통합 로그인 페이지로 이동 (쿠키 세션 방식 통일)
      window.location.href = "/partner/login";
    },
    onError: (err) => {
      toast.error(err.message || "로그인에 실패했습니다.");
    },
  });

  // ─── 비밀번호 재설정 요청 뮤테이션 ──────────────────────────────────────────
  const resetRequestMutation = trpc.partnerStaff.requestPasswordReset.useMutation({
    onSuccess: () => {
      setView("forgot-sent");
    },
    onError: (err) => {
      toast.error(err.message || "비밀번호 재설정 요청에 실패했습니다.");
    },
  });

  // ─── 비밀번호 재설정 완료 뮤테이션 ──────────────────────────────────────────
  const resetMutation = trpc.partnerStaff.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.");
      setView("login");
      setResetToken("");
      setNewPw("");
      setConfirmPw("");
    },
    onError: (err) => {
      toast.error(err.message || "비밀번호 변경에 실패했습니다.");
    },
  });

  const handleLogin = () => {
    if (!loginId.trim() || !loginPw.trim()) {
      toast.error("로그인 ID와 비밀번호를 입력해주세요.");
      return;
    }
    loginMutation.mutate({ loginId: loginId.trim(), loginPw });
  };

  const handleForgotRequest = () => {
    if (!forgotLoginId.trim() || !forgotEmail.trim()) {
      toast.error("로그인 ID와 이메일을 모두 입력해주세요.");
      return;
    }
    resetRequestMutation.mutate({ loginId: forgotLoginId.trim(), email: forgotEmail.trim() });
  };

  const handleReset = () => {
    if (!resetToken.trim() || !newPw || !confirmPw) {
      toast.error("모든 항목을 입력해주세요.");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPw.length < 8) {
      toast.error("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    resetMutation.mutate({ token: resetToken.trim(), newPassword: newPw });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        {/* 로고 */}
        <div className="text-center">
          <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-2xl">⛳</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">두골프 파트너 ERP</h1>
          <p className="text-sm text-muted-foreground mt-0.5">담당자 전용 로그인</p>
        </div>

        {/* ── 로그인 화면 ── */}
        {view === "login" && (
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <LogIn size={18} className="text-green-600" />
                담당자 로그인
              </CardTitle>
              <CardDescription className="text-xs">
                파트너 관리자가 발급한 로그인 ID와 비밀번호를 입력하세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">로그인 ID</Label>
                <Input
                  placeholder="로그인 ID 입력"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">비밀번호</Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="비밀번호 입력"
                    value={loginPw}
                    onChange={(e) => setLoginPw(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    autoComplete="current-password"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPw((v) => !v)}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleLogin}
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <><Loader2 size={15} className="animate-spin mr-1.5" /> 로그인 중...</>
                ) : (
                  <><LogIn size={15} className="mr-1.5" /> 로그인</>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-blue-600 underline"
                  onClick={() => setView("forgot")}
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── 비밀번호 재설정 요청 화면 ── */}
        {view === "forgot" && (
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound size={18} className="text-blue-600" />
                비밀번호 재설정
              </CardTitle>
              <CardDescription className="text-xs">
                로그인 ID와 등록된 이메일을 입력하면 재설정 링크를 보내드립니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">로그인 ID</Label>
                <Input
                  placeholder="로그인 ID 입력"
                  value={forgotLoginId}
                  onChange={(e) => setForgotLoginId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">등록된 이메일</Label>
                <Input
                  type="email"
                  placeholder="이메일 입력"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </div>

              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={handleForgotRequest}
                disabled={resetRequestMutation.isPending}
              >
                {resetRequestMutation.isPending ? (
                  <><Loader2 size={15} className="animate-spin mr-1.5" /> 전송 중...</>
                ) : (
                  <><Mail size={15} className="mr-1.5" /> 재설정 링크 발송</>
                )}
              </Button>

              <button
                type="button"
                className="w-full text-xs text-muted-foreground hover:text-gray-700 flex items-center justify-center gap-1"
                onClick={() => setView("login")}
              >
                <ArrowLeft size={12} /> 로그인으로 돌아가기
              </button>
            </CardContent>
          </Card>
        )}

        {/* ── 이메일 발송 완료 화면 ── */}
        {view === "forgot-sent" && (
          <Card className="shadow-md">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">이메일을 확인해주세요</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>{forgotEmail}</strong>으로<br />
                  비밀번호 재설정 링크를 발송했습니다.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                이메일이 오지 않으면 스팸함을 확인해주세요.<br />
                링크는 1시간 후 만료됩니다.
              </p>

              {/* 토큰 직접 입력 (이메일 없이 테스트용) */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs text-muted-foreground">이메일의 토큰을 직접 입력하여 비밀번호를 변경할 수도 있습니다.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setView("reset")}
                >
                  토큰으로 비밀번호 변경
                </Button>
              </div>

              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-gray-700 flex items-center justify-center gap-1 mx-auto"
                onClick={() => setView("login")}
              >
                <ArrowLeft size={12} /> 로그인으로 돌아가기
              </button>
            </CardContent>
          </Card>
        )}

        {/* ── 비밀번호 변경 화면 ── */}
        {view === "reset" && (
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound size={18} className="text-green-600" />
                새 비밀번호 설정
              </CardTitle>
              <CardDescription className="text-xs">
                이메일에서 받은 재설정 토큰을 입력하고 새 비밀번호를 설정하세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">재설정 토큰</Label>
                <Input
                  placeholder="이메일에서 받은 토큰 입력"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">새 비밀번호</Label>
                <div className="relative">
                  <Input
                    type={showNewPw ? "text" : "password"}
                    placeholder="8자 이상"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowNewPw((v) => !v)}
                  >
                    {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">새 비밀번호 확인</Label>
                <Input
                  type="password"
                  placeholder="비밀번호 재입력"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                />
                {confirmPw && newPw !== confirmPw && (
                  <p className="text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
                )}
              </div>

              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleReset}
                disabled={resetMutation.isPending || (!!confirmPw && newPw !== confirmPw)}
              >
                {resetMutation.isPending ? (
                  <><Loader2 size={15} className="animate-spin mr-1.5" /> 변경 중...</>
                ) : (
                  "비밀번호 변경 완료"
                )}
              </Button>

              <button
                type="button"
                className="w-full text-xs text-muted-foreground hover:text-gray-700 flex items-center justify-center gap-1"
                onClick={() => setView("login")}
              >
                <ArrowLeft size={12} /> 로그인으로 돌아가기
              </button>
            </CardContent>
          </Card>
        )}

        {/* 파트너 관리자 로그인 링크 */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            파트너 관리자이신가요?{" "}
            <Link href="/partner">
              <span className="text-green-600 hover:underline cursor-pointer">관리자 로그인</span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
