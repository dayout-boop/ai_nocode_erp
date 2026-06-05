/**
 * 공급처별 정산 페이지
 * - 공급처(골프장, 숙박, 항공 등)별 정산 현황 집계
 * - 정산 금액, 지급 완료, 미지급 현황 표시
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Building2, Search, TrendingUp, CheckCircle, Clock, BarChart3 } from "lucide-react";

export default function SettlementsSuppliers() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: supplierData, isLoading } = trpc.settlements.supplierSummary.useQuery();

  const filtered = (supplierData ?? []).filter((s: any) => {
    if (!searchQuery) return true;
    return (
      s.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.supplierType?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const totalAmount = (supplierData ?? []).reduce((sum: number, s: any) => sum + Number(s.totalAmount ?? 0), 0);
  const totalPaid = (supplierData ?? []).reduce((sum: number, s: any) => sum + Number(s.paidAmount ?? 0), 0);
  const totalPending = (supplierData ?? []).reduce((sum: number, s: any) => sum + Number(s.pendingAmount ?? 0), 0);

  const supplierTypeLabel: Record<string, string> = {
    golf: "골프장",
    hotel: "숙박",
    flight: "항공",
    transport: "교통",
    other: "기타",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">공급처별 정산</h1>
        <p className="text-sm text-slate-500 mt-1">골프장, 숙박, 항공 등 공급처별 정산 현황을 관리합니다</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <BarChart3 size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">총 정산 금액</p>
                <p className="text-lg font-bold text-slate-800">
                  {(totalAmount / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}만원
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <CheckCircle size={18} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">지급 완료</p>
                <p className="text-lg font-bold text-green-700">
                  {(totalPaid / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}만원
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Clock size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">미지급</p>
                <p className="text-lg font-bold text-amber-700">
                  {(totalPending / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}만원
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 공급처 목록 */}
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base font-semibold text-slate-700">공급처 목록</CardTitle>
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="공급처명 검색..."
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Building2 size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">공급처 정산 데이터가 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">공급처</th>
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">유형</th>
                    <th className="text-right px-5 py-3 text-slate-500 font-medium">총 정산금액</th>
                    <th className="text-right px-5 py-3 text-slate-500 font-medium">지급 완료</th>
                    <th className="text-right px-5 py-3 text-slate-500 font-medium">미지급</th>
                    <th className="text-right px-5 py-3 text-slate-500 font-medium">건수</th>
                    <th className="text-right px-5 py-3 text-slate-500 font-medium">지급률</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s: any, idx: number) => {
                    const total = Number(s.totalAmount ?? 0);
                    const paid = Number(s.paidAmount ?? 0);
                    const pending = Number(s.pendingAmount ?? 0);
                    const paidRate = total > 0 ? Math.round((paid / total) * 100) : 0;
                    return (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-slate-400" />
                            <span className="font-medium text-slate-800">{s.supplierName || "미지정"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant="outline" className="text-xs">
                            {supplierTypeLabel[s.supplierType] ?? s.supplierType ?? "기타"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-slate-800">
                          {(total / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만원
                        </td>
                        <td className="px-5 py-3 text-right text-green-700">
                          {(paid / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만원
                        </td>
                        <td className="px-5 py-3 text-right text-amber-600">
                          {(pending / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만원
                        </td>
                        <td className="px-5 py-3 text-right text-slate-600">{s.cnt}건</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${paidRate}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${paidRate === 100 ? "text-green-600" : paidRate >= 50 ? "text-amber-600" : "text-red-500"}`}>
                              {paidRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
