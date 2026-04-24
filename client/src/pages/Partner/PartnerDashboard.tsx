// ============================================================
// DOGOLF Partner Dashboard — 입점사 파트너 대시보드
// ============================================================
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Package,
  CalendarDays,
  DollarSign,
  MessageSquare,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Loader2,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PartnerDashboard() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-green-600" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

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
              onClick={() => logout()}
              className="text-gray-500 gap-1.5"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">로그아웃</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
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
            { icon: Package, label: "등록 상품", value: "12", unit: "개", color: "text-blue-600", bg: "bg-blue-50" },
            { icon: CalendarDays, label: "이번 달 예약", value: "34", unit: "건", color: "text-green-600", bg: "bg-green-50" },
            { icon: DollarSign, label: "이번 달 정산", value: "2,840", unit: "만원", color: "text-amber-600", bg: "bg-amber-50" },
            { icon: TrendingUp, label: "조회수", value: "1,204", unit: "회", color: "text-purple-600", bg: "bg-purple-50" },
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
                <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50 transition-all cursor-pointer text-center">
                  <span className="text-2xl">{action.icon}</span>
                  <p className="text-sm font-semibold text-gray-800 font-body">{action.label}</p>
                  <p className="text-xs text-gray-500 font-body">{action.desc}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* 최근 예약 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-700 font-body">최근 예약</CardTitle>
            <Button variant="ghost" size="sm" className="text-green-600 text-xs gap-1">
              전체보기 <ChevronRight size={12} />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "김○○", pkg: "태국 파타야 3박5일", date: "2026-05-10", status: "confirmed" },
                { name: "이○○", pkg: "베트남 다낭 4박6일", date: "2026-05-15", status: "pending" },
                { name: "박○○", pkg: "필리핀 세부 5박7일", date: "2026-05-20", status: "confirmed" },
              ].map((booking, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm">
                      👤
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 font-body">{booking.name}</p>
                      <p className="text-xs text-gray-500 font-body">{booking.pkg}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-400 font-body hidden sm:block">{booking.date}</p>
                    <Badge
                      variant={booking.status === "confirmed" ? "default" : "secondary"}
                      className={`text-xs ${booking.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {booking.status === "confirmed" ? "확정" : "대기"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI 매니저 배너 */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-xl">
              🤖
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm font-body">두골프 매니저 AI</p>
              <p className="text-xs text-gray-500 font-body">상품 등록, 정산 기준, ERP 사용법을 즉시 안내해 드립니다</p>
            </div>
          </div>
          <Link href="/partner/chat">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
              상담 시작
            </Button>
          </Link>
        </div>

        {/* 공지사항 */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 font-body flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-500" />
              파트너 공지
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { title: "2026년 5월 정산 일정 안내", date: "2026-04-20", isNew: true },
                { title: "여름 시즌 상품 등록 마감 안내", date: "2026-04-15", isNew: false },
                { title: "파트너 수수료 정책 변경 안내", date: "2026-04-10", isNew: false },
              ].map((notice, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    {notice.isNew && (
                      <Badge className="bg-red-100 text-red-600 text-xs px-1.5 py-0">NEW</Badge>
                    )}
                    <p className="text-sm text-gray-700 font-body">{notice.title}</p>
                  </div>
                  <p className="text-xs text-gray-400 font-body flex-shrink-0 ml-2">{notice.date}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
