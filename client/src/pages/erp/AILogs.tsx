import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  MessageSquare,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Globe,
  Zap,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const LIMIT = 15;
const TABS = [
  { id: "logs", label: "대화 로그", icon: MessageSquare },
  { id: "stats", label: "리전 통계", icon: BarChart2 },
];

const REGION_COLORS: Record<string, string> = {
  "us-central1": "#6366f1",
  "europe-west4": "#10b981",
  "asia-northeast1": "#f59e0b",
  "global": "#64748b",
  "none": "#ef4444",
};

export default function AILogs() {
  const [activeTab, setActiveTab] = useState<"logs" | "stats">("logs");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading, isError, refetch } = trpc.aiLogs.list.useQuery(
    { page, limit: LIMIT, search: search || undefined },
    { enabled: activeTab === "logs" }
  );

  const { data: regionData, isLoading: regionLoading, refetch: refetchRegion } = trpc.aiLogs.regionStats.useQuery(
    undefined,
    { enabled: activeTab === "stats" }
  );

  const { data: dailyData, isLoading: dailyLoading } = trpc.aiLogs.dailyStats.useQuery(
    undefined,
    { enabled: activeTab === "stats" }
  );

  const { data: modelData } = trpc.aiLogs.modelStats.useQuery(
    undefined,
    { enabled: activeTab === "stats" }
  );

  const deleteMutation = trpc.aiLogs.delete.useMutation({
    onSuccess: () => {
      toast.success("로그가 삭제되었습니다.");
      utils.aiLogs.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetCircuitMutation = trpc.aiLogs.resetCircuitBreaker.useMutation({
    onSuccess: () => {
      toast.success("서킷 브레이커가 초기화되었습니다.");
      refetchRegion();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
              <MessageSquare size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">파트너자동화AI 로그</h1>
              <p className="text-sm text-slate-500">파트너자동화AI 대화 내역 및 리전별 성능 통계</p>
            </div>
          </div>
          {activeTab === "logs" && (
            <Badge variant="outline" className="text-slate-500 border-slate-300">
              총 {total.toLocaleString()}건
            </Badge>
          )}
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ===== 대화 로그 탭 ===== */}
        {activeTab === "logs" && (
          <>
            {/* 검색 */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="질문 내용으로 검색..."
                  className="pl-9 bg-white border-slate-200"
                />
              </div>
              <Button type="submit" variant="default" size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                검색
              </Button>
              {search && (
                <Button type="button" variant="outline" size="sm" onClick={handleClearSearch}>
                  초기화
                </Button>
              )}
            </form>

            {/* 로그 목록 */}
            {isError ? (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="py-10 flex flex-col items-center gap-3 text-red-500">
                  <p className="text-sm font-medium">데이터를 불러오는 중 오류가 발생했습니다.</p>
                  <Button variant="outline" size="sm" onClick={() => refetch()} className="text-red-600 border-red-300">
                    다시 시도
                  </Button>
                </CardContent>
              </Card>
            ) : isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <Card className="border-dashed border-slate-200">
                <CardContent className="py-16 flex flex-col items-center gap-3 text-slate-400">
                  <Sparkles size={32} className="opacity-40" />
                  <p className="text-sm font-medium">
                    {search ? `"${search}" 검색 결과가 없습니다.` : "아직 AI 대화 로그가 없습니다."}
                  </p>
                  <p className="text-xs">파트너자동화AI와 대화하면 자동으로 저장됩니다.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <Card key={log.id} className="border-slate-200 hover:border-indigo-200 transition-colors">
                      <CardHeader className="pb-2 pt-4 px-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                              <User size={13} className="text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 leading-relaxed line-clamp-2">
                                {log.query}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="flex items-center gap-1 text-xs text-slate-400">
                                  <Clock size={11} />
                                  {new Date(log.createdAt).toLocaleString("ko-KR", {
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {log.userName && (
                                  <span className="text-xs text-slate-400">{log.userName}</span>
                                )}
                                <Badge className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-600 border-purple-200">
                                  {log.modelName ?? "gemini-2.5-flash"}
                                </Badge>
                                {log.regionUsed && log.regionUsed !== "global" && (
                                  <Badge className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200">
                                    {log.regionUsed}
                                  </Badge>
                                )}
                                {log.isSuccess === false && (
                                  <Badge className="text-[10px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200">
                                    실패
                                  </Badge>
                                )}
                                {log.responseTimeMs && (
                                  <span className="text-[10px] text-slate-400">{log.responseTimeMs}ms</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600"
                              onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            >
                              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>로그 삭제</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    이 대화 로그를 삭제하시겠습니까? 삭제된 로그는 복구할 수 없습니다.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-500 hover:bg-red-600"
                                    onClick={() => deleteMutation.mutate({ id: log.id })}
                                  >
                                    삭제
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>

                      {isExpanded && (
                        <CardContent className="px-5 pb-4 pt-0">
                          <div className="mt-2 border-t border-slate-100 pt-3">
                            <div className="flex items-start gap-2">
                              <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                <Sparkles size={12} className="text-white" />
                              </div>
                              <div className="flex-1 bg-indigo-50 rounded-xl p-3">
                                <p className="text-xs font-semibold text-indigo-700 mb-1.5">파트너자동화AI 응답</p>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                  {log.response}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft size={14} />
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (page <= 4) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = page - 3 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        className={`h-8 w-8 p-0 text-xs ${page === pageNum ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            )}
          </>
        )}

        {/* ===== 리전 통계 탭 ===== */}
        {activeTab === "stats" && (
          <div className="space-y-6">
            {/* 새로고침 버튼 */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { refetchRegion(); }}
                className="gap-2"
              >
                <RefreshCw size={14} />
                새로고침
              </Button>
            </div>

            {regionLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* 서킷 브레이커 상태 */}
                <Card className="border-slate-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Zap size={15} className="text-amber-500" />
                        서킷 브레이커 상태
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => resetCircuitMutation.mutate({})}
                        disabled={resetCircuitMutation.isPending}
                      >
                        <RefreshCw size={12} />
                        전체 초기화
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(regionData?.regions ?? []).map((region) => {
                        const status = regionData?.circuitBreaker?.[region.name];
                        const isOpen = status?.isOpen ?? false;
                        const failCount = status?.failures ?? 0;
                        return (
                          <div
                            key={region.name}
                            className={`rounded-xl p-3 border ${
                              isOpen
                                ? "bg-red-50 border-red-200"
                                : "bg-green-50 border-green-200"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-slate-600">{region.name}</span>
                              <span className={`w-2 h-2 rounded-full ${isOpen ? "bg-red-500" : "bg-green-500"}`} />
                            </div>
                            <p className={`text-xs font-semibold ${isOpen ? "text-red-600" : "text-green-600"}`}>
                              {isOpen ? "차단됨" : "정상"}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">실패 {failCount}회</p>
                            {isOpen && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] mt-1 text-red-600 hover:text-red-700 p-0"
                                onClick={() => resetCircuitMutation.mutate({ regionName: region.name })}
                              >
                                초기화
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* 리전별 성공/실패 막대 차트 */}
                <Card className="border-slate-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Globe size={15} className="text-indigo-500" />
                      리전별 성공/실패 통계
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(regionData?.stats ?? []).length === 0 ? (
                      <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
                        아직 데이터가 없습니다. AI 어시스턴트를 사용하면 통계가 쌓입니다.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={regionData?.stats ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="regionUsed" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            formatter={(value: any, name: string) => [
                              value,
                              name === "success" ? "성공" : name === "failure" ? "실패" : name,
                            ]}
                          />
                          <Legend formatter={(value) => value === "success" ? "성공" : value === "failure" ? "실패" : value} />
                          <Bar dataKey="success" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="failure" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                    {/* 성공률 테이블 */}
                    {(regionData?.stats ?? []).length > 0 && (
                      <div className="mt-4 space-y-2">
                        {regionData!.stats.map((s) => (
                          <div key={s.regionUsed} className="flex items-center gap-3">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: REGION_COLORS[s.regionUsed] ?? "#64748b" }}
                            />
                            <span className="text-xs text-slate-600 w-32 shrink-0">{s.regionUsed}</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-indigo-500 transition-all"
                                style={{ width: `${s.successRate}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 w-12 text-right">{s.successRate}%</span>
                            <span className="text-[10px] text-slate-400 w-20 text-right">
                              {s.total}건 / {s.avgResponseMs ? `${s.avgResponseMs}ms` : "-"}
                            </span>
                            {s.circuitOpen && (
                              <AlertTriangle size={12} className="text-red-500 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 일별 호출 추이 */}
                <Card className="border-slate-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-slate-700">최근 30일 일별 호출 추이</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dailyLoading ? (
                      <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
                    ) : (dailyData ?? []).length === 0 ? (
                      <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
                        아직 데이터가 없습니다.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={dailyData ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) => v?.slice(5) ?? ""}
                          />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            formatter={(value: any, name: string) => [
                              value,
                              name === "total" ? "전체" : name === "success" ? "성공" : "실패",
                            ]}
                          />
                          <Legend formatter={(v) => v === "total" ? "전체" : v === "success" ? "성공" : "실패"} />
                          <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="success" stroke="#10b981" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="failure" stroke="#ef4444" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* 모델별 사용 통계 */}
                {(modelData ?? []).length > 0 && (
                  <Card className="border-slate-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-slate-700">모델별 사용 통계</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {modelData!.map((m) => (
                          <div key={m.modelName} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                            <p className="text-xs font-semibold text-slate-700 truncate">{m.modelName ?? "unknown"}</p>
                            <p className="text-lg font-bold text-indigo-600 mt-1">{m.total.toLocaleString()}</p>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] text-green-600">성공 {m.success}</span>
                              <span className="text-[10px] text-red-500">실패 {m.failure}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </div>
  );
}
