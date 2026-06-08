// ============================================================
// DOGOLF Partner Dashboard — 입점사 파트너 대시보드
// partner_session 쿠키 기반 인증 (Manus OAuth 독립)
// ============================================================
import { Link, useLocation } from "wouter";
import { usePartnerAuth } from "@/_core/hooks/usePartnerAuth";
import { trpc } from "@/lib/trpc";
import {
  Package,
  CalendarDays,
  DollarSign,
  MessageSquare,
  TrendingUp,
  Loader2,
  LogOut,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PartnerDashboard() {
  const { user, loading, isAuthenticated, logout } = usePartnerAuth();
  const [, navigate] = useLocation();

  // 온보딩 상태 조회 (이메일 기반 - 공개 API 사용)
  const myStatusQuery = trpc.partnerOnboarding.getStatusByEmail.useQuery(
    { email: user?.email ?? "" },
    { enabled: !!user?.email }
  );

  const handleLogout = async () => {
    await logout();
    navigate("/partner/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-green-600" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    // 파트너 로그인 페이지로 이동
    window.location.href = "/partner/login";
    return null;
  }

  // 온보딩 미완료 상태 처리
  const onboardingStatus = myStatusQuery.data?.status;
  const isPending = onboardingStatus === "pending" || onboardingStatus === "reviewing";
  const isRejected = onboardingStatus === "rejected";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              ⛳
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm font-body">두골프 파트너센터</p>
              <p className="text-xs text-gray-500 font-body">{user?.name ?? "파트너"} 님</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/partner/chat">
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1.5">
                <MessageSquare size={14} />
                <span className="hidden sm:inline">매니저 상담</span>
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-500 gap-1.5"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">로그아웃</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* 승인 대기 중 안내 */}
        {isPending && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
            <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-900 mb-1">가입 승인 대기 중</h3>
              <p className="text-sm text-amber-800">
                관리자 검토 후 1~2 영업일 내에 승인됩니다. 승인 완료 시 이메일로 안내드립니다.
              </p>
            </div>
          </div>
        )}

        {/* 반려 안내 */}
        {isRejected && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex gap-3">
            <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-900 mb-1">가입 신청 반려</h3>
              <p className="text-sm text-red-800">
                {myStatusQuery.data?.data?.adminNote || "가입 신청이 반려되었습니다. 관리자에게 문의해주세요."}
              </p>
              <Button
                size="sm"
                className="mt-3 bg-red-600 hover:bg-red-700"
                onClick={() => navigate("/partner/onboarding-chat?email=" + encodeURIComponent(user?.email ?? "") + "&name=" + encodeURIComponent(user?.name ?? ""))}
              >
                재신청하기
              </Button>
            </div>
          </div>
        )}

        {/* 환영 배너 */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-5 text-white">
          <p className="text-green-100 text-sm font-body mb-1">파트너 대시보드</p>
          <h1 className="text-xl font-bold font-body mb-1">
            안녕하세요, {user?.name ?? "파트너"} 님! 👋
          </h1>
          <p className="text-green-100 text-sm font-body">
            두골프 파트너센터에서 상품 관리와 정산 현황을 확인하세요.
          </p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Package, label: "등록 상품", value: "0", unit: "개", color: "text-blue-600", bg: "bg-blue-50" },
            { icon: CalendarDays, label: "이번 달 예약", value: "0", unit: "건", color: "text-green-600", bg: "bg-green-50" },
            { icon: DollarSign, label: "이번 달 정산", value: "0", unit: "만원", color: "text-amber-600", bg: "bg-amber-50" },
            { icon: TrendingUp, label: "조회수", value: "0", unit: "회", color: "text-purple-600", bg: "bg-purple-50" },
          ].map((stat) => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className={`w-9 h-9 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
                  <stat.icon size={18} className={stat.color} />
                </div>
                <p className="text-xs text-gray-500 font-body mb-0.5">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900 font-number">
                  {stat.value}
                  <span className="text-sm font-normal text-gray-500 ml-1">{stat.unit}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 빠른 액션 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 font-body">빠른 액션</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "상품 등록", icon: "📦", href: "#", desc: "새 패키지 등록" },
              { label: "예약 확인", icon: "📅", href: "#", desc: "예약 목록 조회" },
              { label: "정산 내역", icon: "💰", href: "#", desc: "정산 현황 확인" },
              { label: "AI 매니저 상담", icon: "🤖", href: "/partner/chat", desc: "운영 지원 AI" },
            ].map((action) => (
              <Link key={action.label} href={action.href}>
                <div className="border border-gray-200 rounded-xl p-3 hover:border-green-400 hover:bg-green-50 transition-all cursor-pointer group">
                  <div className="text-2xl mb-2">{action.icon}</div>
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-green-700 font-body">
                    {action.label}
                  </p>
                  <p className="text-xs text-gray-500 font-body">{action.desc}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* 공지사항 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 font-body">공지사항</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-400 text-sm">
              등록된 공지사항이 없습니다.
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
