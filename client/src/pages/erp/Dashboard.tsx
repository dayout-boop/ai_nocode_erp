import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area
} from "recharts";
import {
  Calendar, Package, MessageSquare, Users, TrendingUp, Clock, CheckCircle, XCircle,
  AlertCircle, ArrowRight, Building2, DollarSign, PackageSearch, Plus, RefreshCw,
  Activity, Zap, Star, Code2
} from "lucide-react";
import { Link } from "wouter";
import { usePartnerAuth } from "@/_core/hooks/usePartnerAuth";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "대기", color: "bg-amber-100 text-amber-700" },
  confirmed: { label: "확정", color: "bg-green-100 text-green-700" },
  cancelled: { label: "취소", color: "bg-red-100 text-red-700" },
  completed: { label: "완료", color: "bg-slate-100 text-slate-700" },
  new: { label: "신규", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "처리중", color: "bg-purple-100 text-purple-700" },
  replied: { label: "답변완료", color: "bg-green-100 text-green-700" },
  closed: { label: "종료", color: "bg-slate-100 text-slate-700" },
};

function KPICard({
  title, value, icon, color, sub, badge, href,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  sub?: string;
  badge?: { label: string; variant: "default" | "destructive" | "secondary" | "outline" };
  href?: string;
}) {
  const content = (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-slate-500 text-xs font-medium mb-1">{title}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
            {badge && (
              <Badge variant={badge.variant} className="mt-2 text-xs">
                {badge.label}
              </Badge>
            )}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

function QuickAction({ label, href, icon, color }: { label: string; href: string; icon: React.ReactNode; color: string }) {
  return (
    <Link href={href}>
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80 ${color}`}>
        {icon}
        <span>{label}</span>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading, refetch } = trpc.dashboard.stats.useQuery();
  const { data: monthlyRevenue } = trpc.dashboard.monthlyRevenue.useQuery();
  const { isAuthenticated: isPartnerMode } = usePartnerAuth();

  // 미처리 개발요청 (마스터 전용)
  const { data: pendingDevRequests } = trpc.tenantAi.listApiDevRequests.useQuery(
    { approvalStatus: "pending", limit: 100 },
    { enabled: !isPartnerMode }
  );
  const pendingDevCount = pendingDevRequests?.length ?? 0;

  const chartData = monthlyRevenue?.map((d) => ({
    month: d.month,
    매출: Number(d.revenue) / 10000,
    예약수: d.bookingCount,
  })) || [];

  const now = new Date();
  const greeting = now.getHours() < 12 ? "좋은 아침입니다" : now.getHours() < 18 ? "안녕하세요" : "수고하셨습니다";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">대시보드</h1>
          <p className="text-slate-500 text-sm mt-1">
            {greeting} · {now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-2 text-slate-600"
        >
          <RefreshCw size={14} />
          새로고침
        </Button>
      </div>

      {/* 빠른 액션 */}
      <div className="flex flex-wrap gap-2">
        <QuickAction label="예약 등록" href="/bookings" icon={<Plus size={14} />} color="bg-indigo-600 text-white" />
        <QuickAction label="상품 등록" href="/packages/new" icon={<Package size={14} />} color="bg-emerald-600 text-white" />
        <QuickAction label="문의 확인" href="/inquiries" icon={<MessageSquare size={14} />} color="bg-amber-500 text-white" />
        {!isPartnerMode && (
          <QuickAction label="마스터AI" href="/master-ai" icon={<Zap size={14} />} color="bg-purple-600 text-white" />
        )}
      </div>

      {/* 알림 배너 */}
      {!isLoading && ((stats?.newInquiries ?? 0) > 0 || (stats?.pendingBookings ?? 0) > 0 || pendingDevCount > 0) && (
        <div className="space-y-2">
          {((stats?.newInquiries ?? 0) > 0 || (stats?.pendingBookings ?? 0) > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle size={18} className="text-amber-600 shrink-0" />
              <div className="flex-1 text-sm text-amber-800">
                <span className="font-semibold">처리 필요 항목: </span>
                {(stats?.newInquiries ?? 0) > 0 && (
                  <span>신규 문의 <strong>{stats?.newInquiries}건</strong>{(stats?.pendingBookings ?? 0) > 0 ? " · " : ""}</span>
                )}
                {(stats?.pendingBookings ?? 0) > 0 && (
                  <span>대기 예약 <strong>{stats?.pendingBookings}건</strong></span>
                )}
              </div>
              <Link href="/inquiries">
                <Button variant="outline" size="sm" className="text-amber-700 border-amber-300 bg-white hover:bg-amber-50 gap-1">
                  확인하기 <ArrowRight size={12} />
                </Button>
              </Link>
            </div>
          )}
          {!isPartnerMode && pendingDevCount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <Code2 size={18} className="text-blue-600 shrink-0" />
              <div className="flex-1 text-sm text-blue-800">
                <span className="font-semibold">미처리 개발요청: </span>
                <span>파트너사에서 접수한 개발요청 <strong>{pendingDevCount}건</strong>이 검토 대기 중입니다.</span>
              </div>
              <Link href="/tenant-ai">
                <Button variant="outline" size="sm" className="text-blue-700 border-blue-300 bg-white hover:bg-blue-50 gap-1">
                  검토하기 <ArrowRight size={12} />
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* KPI 1행: 오늘/이번달 */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">오늘 · 이번달</p>
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-20" />
                    <div className="h-7 bg-slate-200 rounded w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="오늘 신규 예약"
              value={stats?.todayBookings ?? 0}
              icon={<Calendar size={18} className="text-indigo-600" />}
              color="bg-indigo-50"
              sub="오늘 접수된 예약"
              href="/bookings"
            />
            <KPICard
              title="이번달 매출"
              value={`${((stats?.monthRevenue ?? 0) / 10000).toFixed(0)}만원`}
              icon={<DollarSign size={18} className="text-emerald-600" />}
              color="bg-emerald-50"
              sub="결제 완료 기준"
            />
            <KPICard
              title="신규 문의"
              value={stats?.newInquiries ?? 0}
              icon={<MessageSquare size={18} className="text-amber-600" />}
              color="bg-amber-50"
              sub="미처리 신규 문의"
              badge={(stats?.newInquiries ?? 0) > 0 ? { label: "처리 필요", variant: "destructive" as const } : undefined}
              href="/inquiries"
            />
            <KPICard
              title="대기 예약"
              value={stats?.pendingBookings ?? 0}
              icon={<Clock size={18} className="text-orange-600" />}
              color="bg-orange-50"
              sub="확정 대기 중"
              badge={(stats?.pendingBookings ?? 0) > 0 ? { label: "확인 필요", variant: "outline" as const } : undefined}
              href="/bookings"
            />
          </div>
        )}
      </div>

      {/* KPI 2행: 누적 현황 */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">누적 현황</p>
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-20" />
                    <div className="h-7 bg-slate-200 rounded w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="전체 예약"
              value={stats?.totalBookings ?? 0}
              icon={<TrendingUp size={18} className="text-blue-600" />}
              color="bg-blue-50"
              sub={`확정 ${stats?.confirmedBookings ?? 0}건`}
              href="/bookings"
            />
            <KPICard
              title="활성 상품"
              value={stats?.activePackages ?? 0}
              icon={<PackageSearch size={18} className="text-teal-600" />}
              color="bg-teal-50"
              sub={`전체 ${stats?.totalPackages ?? 0}개`}
              href="/packages"
            />
            <KPICard
              title="파트너사"
              value={stats?.totalPartners ?? 0}
              icon={<Building2 size={18} className="text-violet-600" />}
              color="bg-violet-50"
              sub="등록된 파트너"
              href="/crm/partners"
            />
            <KPICard
              title="누적 매출"
              value={`${((stats?.totalRevenue ?? 0) / 10000).toFixed(0)}만원`}
              icon={<Star size={18} className="text-rose-600" />}
              color="bg-rose-50"
              sub="결제 완료 누계"
            />
          </div>
        )}
        {/* 마스터 전용: 미처리 개발요청 KPI 카드 */}
        {!isLoading && !isPartnerMode && (
          <div className="mt-4">
            <KPICard
              title="미처리 개발요청"
              value={pendingDevCount}
              icon={<Code2 size={18} className="text-blue-600" />}
              color="bg-blue-50"
              sub="파트너사 접수 · 검토 대기 중"
              badge={pendingDevCount > 0 ? { label: `${pendingDevCount}건 대기`, variant: "destructive" as const } : { label: "없음", variant: "secondary" as const }}
              href="/tenant-ai"
            />
          </div>
        )}
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
              <Activity size={16} className="text-indigo-500" />
              월별 매출 현황 (만원)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}만원`, "매출"]} />
                  <Area type="monotone" dataKey="매출" stroke="#6366f1" strokeWidth={2} fill="url(#colorRevenue)" dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                데이터가 없습니다
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
              <Calendar size={16} className="text-emerald-500" />
              월별 예약 건수
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="예약수" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                데이터가 없습니다
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 최근 데이터 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-700">최근 예약</CardTitle>
            <Link href="/bookings">
              <span className="text-xs text-indigo-600 hover:underline cursor-pointer flex items-center gap-1">
                전체보기 <ArrowRight size={12} />
              </span>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {stats?.recentBookings?.length ? (
              <div className="divide-y divide-slate-100">
                {stats.recentBookings.map((booking: any) => (
                  <div key={booking.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{booking.leaderName}</p>
                      <p className="text-xs text-slate-400">{booking.bookingNumber}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={`text-xs ${STATUS_MAP[booking.status]?.color || "bg-slate-100 text-slate-700"}`}>
                        {STATUS_MAP[booking.status]?.label || booking.status}
                      </Badge>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {Number(booking.totalAmount).toLocaleString()}원
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-slate-400 text-sm">예약 내역이 없습니다</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-700">최근 문의</CardTitle>
            <Link href="/inquiries">
              <span className="text-xs text-indigo-600 hover:underline cursor-pointer flex items-center gap-1">
                전체보기 <ArrowRight size={12} />
              </span>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {stats?.recentInquiries?.length ? (
              <div className="divide-y divide-slate-100">
                {stats.recentInquiries.map((inquiry: any) => (
                  <div key={inquiry.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{inquiry.name}</p>
                      <p className="text-xs text-slate-400 truncate">{inquiry.packageName || "패키지 미선택"}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={`text-xs ${STATUS_MAP[inquiry.status]?.color || "bg-slate-100 text-slate-700"}`}>
                        {STATUS_MAP[inquiry.status]?.label || inquiry.status}
                      </Badge>
                      <p className="text-xs text-slate-400 mt-0.5">{inquiry.phone}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-slate-400 text-sm">문의 내역이 없습니다</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
