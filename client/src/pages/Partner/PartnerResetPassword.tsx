/**
 * 파트너 담당자 비밀번호 재설정 페이지
 * - 이메일 링크에서 토큰을 받아 새 비밀번호 설정
 * - URL: /partner/reset-password?token=xxx
 */
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Shield, Lock, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function PartnerResetPassword() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [view, setView] = useState<"loading" | "form" | "success" | "invalid">("loading");

  // URL에서 토큰 추출
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t && t.trim()) {
      setToken(t.trim());
      setView("form");
    } else {
      setView("invalid");
    }
  }, []);

  // 토큰 유효성 사전 검증
  const { data: tokenValid, isLoading: tokenChecking } = trpc.partnerStaff.verifyResetToken.useQuery(
    { token },
    {
      enabled: !!token && view === "form",
      retry: false,
    }
  );

  // 비밀번호 재설정 뮤테이션
  const resetMutation = trpc.partnerStaff.resetPassword.useMutation({
    onSuccess: () => {
      setView("success");
    },
    onError: (err) => {
      toast.error(err.message || "비밀번호 변경에 실패했습니다.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPw || !confirmPw) {
      toast.error("새 비밀번호를 입력해주세요.");
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
    resetMutation.mutate({ token, newPassword: newPw });
  };

  // 비밀번호 강도 체크
  const pwStrength = (() => {
    if (!newPw) return { level: 0, label: "", color: "" };
    let score = 0;
    if (newPw.length >= 8) score++;
    if (newPw.length >= 12) score++;
    if (/[A-Z]/.test(newPw)) score++;
    if (/[0-9]/.test(newPw)) score++;
    if (/[^A-Za-z0-9]/.test(newPw)) score++;
    if (score <= 1) return { level: 1, label: "약함", color: "bg-red-500" };
    if (score <= 3) return { level: 2, label: "보통", color: "bg-yellow-500" };
    return { level: 3, label: "강함", color: "bg-emerald-500" };
  })();

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col">
      {/* 배경 효과 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600/8 rounded-full blur-3xl" />
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
      </header>

      {/* 메인 */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">

          {/* 로딩 상태 */}
          {view === "loading" && (
            <div className="text-center">
              <Loader2 size={32} className="text-emerald-400 animate-spin mx-auto mb-4" />
              <p className="text-white/50 text-sm">링크 확인 중...</p>
            </div>
          )}

          {/* 유효하지 않은 토큰 */}
          {view === "invalid" && (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <XCircle size={32} className="text-red-400" />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">유효하지 않은 링크</h1>
              <p className="text-white/50 text-sm mb-6 leading-relaxed">
                비밀번호 재설정 링크가 만료되었거나 올바르지 않습니다.<br />
                다시 비밀번호 재설정을 요청해주세요.
              </p>
              <Link href="/partner/staff/login">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  로그인 페이지로 이동
                </Button>
              </Link>
            </div>
          )}

          {/* 재설정 폼 */}
          {view === "form" && (
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock size={24} className="text-emerald-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">새 비밀번호 설정</h1>
                <p className="text-white/50 text-sm">
                  안전한 새 비밀번호를 입력해주세요
                </p>
              </div>

              {tokenChecking ? (
                <div className="text-center py-8">
                  <Loader2 size={24} className="text-emerald-400 animate-spin mx-auto mb-2" />
                  <p className="text-white/40 text-sm">링크 유효성 확인 중...</p>
                </div>
              ) : tokenValid?.valid === false ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                  <XCircle size={20} className="text-red-400 mx-auto mb-2" />
                  <p className="text-red-300 text-sm">
                    링크가 만료되었거나 이미 사용된 링크입니다.<br />
                    새로운 재설정 링크를 요청해주세요.
                  </p>
                  <Link href="/partner/staff/login">
                    <Button variant="outline" size="sm" className="mt-3 border-red-500/30 text-red-300 hover:bg-red-500/10">
                      다시 요청하기
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                    {/* 새 비밀번호 */}
                    <div className="space-y-1.5">
                      <Label className="text-white/70 text-xs">새 비밀번호</Label>
                      <div className="relative">
                        <Input
                          type={showPw ? "text" : "password"}
                          placeholder="8자 이상 입력"
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-10 focus:border-emerald-500/50"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(!showPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                        >
                          {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {/* 비밀번호 강도 */}
                      {newPw && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex gap-1 flex-1">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className={`h-1 flex-1 rounded-full transition-colors ${
                                  pwStrength.level >= i ? pwStrength.color : "bg-white/10"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-white/40">{pwStrength.label}</span>
                        </div>
                      )}
                    </div>

                    {/* 비밀번호 확인 */}
                    <div className="space-y-1.5">
                      <Label className="text-white/70 text-xs">비밀번호 확인</Label>
                      <div className="relative">
                        <Input
                          type={showConfirmPw ? "text" : "password"}
                          placeholder="비밀번호 재입력"
                          value={confirmPw}
                          onChange={(e) => setConfirmPw(e.target.value)}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-10 focus:border-emerald-500/50"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPw(!showConfirmPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                        >
                          {showConfirmPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {confirmPw && newPw !== confirmPw && (
                        <p className="text-red-400 text-xs mt-1">비밀번호가 일치하지 않습니다</p>
                      )}
                      {confirmPw && newPw === confirmPw && (
                        <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1">
                          <CheckCircle2 size={12} /> 비밀번호가 일치합니다
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={resetMutation.isPending || newPw !== confirmPw || newPw.length < 8}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl"
                    >
                      {resetMutation.isPending ? (
                        <><Loader2 size={16} className="animate-spin mr-2" />변경 중...</>
                      ) : (
                        "비밀번호 변경"
                      )}
                    </Button>
                  </div>

                  {/* 보안 안내 */}
                  <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Shield size={12} className="text-emerald-400" />
                      <span className="text-emerald-400 text-xs font-medium">보안 안내</span>
                    </div>
                    <ul className="text-white/40 text-xs space-y-0.5">
                      <li>• 비밀번호는 8자 이상으로 설정해주세요</li>
                      <li>• 영문 대소문자, 숫자, 특수문자 조합을 권장합니다</li>
                      <li>• 이 링크는 30분 후 만료됩니다</li>
                    </ul>
                  </div>
                </form>
              )}
            </>
          )}

          {/* 성공 화면 */}
          {view === "success" && (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">비밀번호 변경 완료</h1>
              <p className="text-white/50 text-sm mb-6 leading-relaxed">
                새 비밀번호로 변경되었습니다.<br />
                로그인 페이지에서 새 비밀번호로 로그인해주세요.
              </p>
              <Link href="/partner/staff/login">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  로그인하러 가기
                </Button>
              </Link>
            </div>
          )}

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
