import ERPLayout from "@/components/ERPLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from "recharts";
import {
  Calendar, Package, MessageSquare, Users, TrendingUp, Clock, CheckCircle, XCircle
} from "lucide-react";
import { Link } from "wouter";

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
  title, value, icon, color, sub,
}: {
  title: string; value: string | number; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-500 text-xs font-medium mb-1">{title}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: monthlyRevenue } = trpc.dashboard.monthlyRevenue.useQuery();

  const chartData = monthlyRevenue?.map((d) => ({
    month: d.month,
    매출: Number(d.revenue) / 10000,
    예약수: d.bookingCount,
  })) || [];

  return (
    <ERPLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">대시보드</h1>
          <p className="text-slate-500 text-sm mt-1">두골프 ERP 관리 현황</p>
        </div>

        {/* KPI Cards */}
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
              value={stats?.totalBookings || 0}
              icon={<Calendar size={18} className="text-indigo-600" />}
              color="bg-indigo-50"
              sub={`대기 ${stats?.pendingBookings || 0}건`}
            />
            <KPICard
              title="활성 상품"
              value={stats?.activePackages || 0}
              icon={<Package size={18} className="text-emerald-600" />}
              color="bg-emerald-50"
              sub={`전체 ${stats?.totalPackages || 0}개`}
            />
            <KPICard
              title="새 문의"
              value={stats?.newInquiries || 0}
              icon={<MessageSquare size={18} className="text-amber-600" />}
              color="bg-amber-50"
              sub="미처리 문의"
            />
            <KPICard
              title="총 매출"
              value={`${(stats?.totalRevenue || 0).toLocaleString()}원`}
              icon={<TrendingUp size={18} className="text-purple-600" />}
              color="bg-purple-50"
              sub="결제 완료 기준"
            />
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-700">월별 매출 추이 (만원)</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}만원`, "매출"]} />
                    <Bar dataKey="매출" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
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
              <CardTitle className="text-base font-semibold text-slate-700">월별 예약 건수</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="예약수" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                  데이터가 없습니다
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent data */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Bookings */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-700">최근 예약</CardTitle>
              <Link href="/erp/bookings">
                <span className="text-xs text-indigo-600 hover:underline cursor-pointer">전체보기</span>
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

          {/* Recent Inquiries */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-700">최근 문의</CardTitle>
              <Link href="/erp/inquiries">
                <span className="text-xs text-indigo-600 hover:underline cursor-pointer">전체보기</span>
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
    </ERPLayout>
  );
}
