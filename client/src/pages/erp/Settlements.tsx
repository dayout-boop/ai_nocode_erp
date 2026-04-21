import { useState } from "react";
import ERPLayout from "@/components/ERPLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, CreditCard, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "미정산", color: "bg-amber-100 text-amber-700" },
  confirmed: { label: "확인중", color: "bg-blue-100 text-blue-700" },
  paid: { label: "정산완료", color: "bg-green-100 text-green-700" },
  cancelled: { label: "취소", color: "bg-red-100 text-red-700" },
};

export default function SettlementsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.settlements.list.useQuery({
    page,
    limit: 15,
    status: statusFilter || undefined,
  });

  const { data: supplierSummary } = trpc.settlements.supplierSummary.useQuery();

  const updateMutation = trpc.settlements.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("정산 상태가 변경되었습니다.");
      utils.settlements.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const supplierChartData = supplierSummary?.map((s: any) => ({
    name: s.supplierName,
    금액: Number(s.totalAmount) / 10000,
  })) || [];

  const summary = data?.summary;

  return (
    <ERPLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">정산관리</h1>
          <p className="text-slate-500 text-sm mt-1">공급처별 정산 현황을 관리합니다</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">미정산 금액</p>
              <p className="text-xl font-bold text-amber-600 mt-1">
                {(summary?.pendingAmount || 0).toLocaleString()}원
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">정산완료 금액</p>
              <p className="text-xl font-bold text-green-600 mt-1">
                {(summary?.paidAmount || 0).toLocaleString()}원
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">전체 정산액</p>
              <p className="text-xl font-bold text-indigo-600 mt-1">
                {(Number(summary?.totalAmount) || 0).toLocaleString()}원
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">전체 정산 건수</p>
              <p className="text-xl font-bold text-slate-700 mt-1">
                {data?.total || 0}건
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Supplier Chart */}
        {supplierChartData.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-700">공급처별 정산 금액 (만원)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={supplierChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}만원`, "정산금액"]} />
                  <Bar dataKey="금액" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="공급처명 검색..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="pending">미정산</SelectItem>
                  <SelectItem value="confirmed">확인중</SelectItem>
                  <SelectItem value="paid">완료</SelectItem>
                  <SelectItem value="cancelled">취소</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 h-9" placeholder="시작일" />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 h-9" placeholder="종료일" />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-20 text-center text-slate-400">로딩 중...</div>
            ) : !data?.items?.length ? (
              <div className="py-20 text-center">
                <CreditCard size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400">정산 내역이 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">공급처</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">정산 유형</th>
                      <th className="text-right px-4 py-3 text-slate-500 font-medium">정산 금액</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">정산 기간</th>
                      <th className="text-center px-4 py-3 text-slate-500 font-medium">상태</th>
                      <th className="text-right px-5 py-3 text-slate-500 font-medium">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.items.map((settlement: any) => (
                      <tr key={settlement.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-800">{settlement.supplierName}</div>
                          <div className="text-xs text-slate-400">{settlement.supplierType}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{settlement.settlementType || "일반"}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {Number(settlement.totalAmount).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {settlement.periodStart ? new Date(settlement.periodStart).toLocaleDateString("ko-KR") : "-"}
                          {settlement.periodEnd ? ` ~ ${new Date(settlement.periodEnd).toLocaleDateString("ko-KR")}` : ""}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`text-xs ${STATUS_MAP[settlement.status]?.color}`}>
                            {STATUS_MAP[settlement.status]?.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex gap-1 justify-end">
                            {settlement.status === "pending" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => updateMutation.mutate({ id: settlement.id, status: "paid" })}
                              >
                                완료처리
                              </Button>
                            )}
                            {settlement.status === "pending" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => updateMutation.mutate({ id: settlement.id, status: "pending" })}
                              >
                                확인
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {data && data.total > 15 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">총 {data.total}건</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>이전</Button>
              <span className="text-sm text-slate-600 px-3 py-1.5">{page} / {Math.ceil(data.total / 15)}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(data.total / 15)}>다음</Button>
            </div>
          </div>
        )}
      </div>
    </ERPLayout>
  );
}
