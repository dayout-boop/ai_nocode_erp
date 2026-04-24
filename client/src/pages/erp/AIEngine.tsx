/**
 * AI 엔진 관리 페이지 (4탭)
 * 탭 1: 개발 요청 관리 (dev_requests)
 * 탭 2: AI 비용 모니터링
 * 탭 3: 상담 세션 관리 (chat_sessions)
 * 탭 4: 시스템 프롬프트 관리
 */
import { useState } from "react";
import ERPLayout from "@/components/ERPLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Zap, DollarSign, MessageSquare, Code2, Plus, Send, RefreshCw,
  CheckCircle2, Clock, XCircle, AlertTriangle, Loader2, Bot,
  BarChart3, Settings, Eye, ShieldAlert, ExternalLink,
} from "lucide-react";
import { Link } from "wouter";

// ─── 우선순위 배지 ────────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { label: string; className: string }> = {
    critical: { label: "CRITICAL", className: "bg-red-100 text-red-700 border-red-200" },
    high: { label: "HIGH", className: "bg-orange-100 text-orange-700 border-orange-200" },
    medium: { label: "MEDIUM", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    low: { label: "LOW", className: "bg-slate-100 text-slate-600 border-slate-200" },
  };
  const { label, className } = map[priority] ?? { label: priority, className: "bg-slate-100 text-slate-600" };
  return (
    <Badge variant="outline" className={`text-xs font-mono ${className}`}>
      {label}
    </Badge>
  );
}

// ─── 상태 배지 ────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    pending: { label: "대기중", icon: <Clock size={10} />, className: "bg-yellow-100 text-yellow-700" },
    in_progress: { label: "진행중", icon: <Loader2 size={10} className="animate-spin" />, className: "bg-blue-100 text-blue-700" },
    completed: { label: "완료", icon: <CheckCircle2 size={10} />, className: "bg-green-100 text-green-700" },
    rejected: { label: "반려", icon: <XCircle size={10} />, className: "bg-red-100 text-red-700" },
    active: { label: "활성", icon: <CheckCircle2 size={10} />, className: "bg-green-100 text-green-700" },
    closed: { label: "종료", icon: <XCircle size={10} />, className: "bg-slate-100 text-slate-600" },
  };
  const { label, icon, className } = map[status] ?? { label: status, icon: null, className: "bg-slate-100 text-slate-600" };
  return (
    <Badge variant="secondary" className={`text-xs flex items-center gap-1 ${className}`}>
      {icon}
      {label}
    </Badge>
  );
}

// ─── 탭 1: 개발 요청 관리 ─────────────────────────────────────────────────────
function DevRequestsTab() {
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "in_progress" | "completed" | "rejected">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium", module: "", estimatedHours: "",
  });

  const listQuery = trpc.devRequest.list.useQuery({
    status: statusFilter,
    priority: "all",
    limit: 50,
    offset: 0,
  });

  const createMutation = trpc.devRequest.create.useMutation({
    onSuccess: () => {
      toast.success("개발 요청이 등록되었습니다.");
      setCreateOpen(false);
      setForm({ title: "", description: "", priority: "medium", module: "", estimatedHours: "" });
      listQuery.refetch();
    },
    onError: (e) => toast.error(`등록 실패: ${e.message}`),
  });

  const sendMutation = trpc.devRequest.sendToManus.useMutation({
    onSuccess: (data) => {
      toast.success(`Manus 전송 완료! Task ID: ${data.manusTaskId?.slice(0, 12)}...`);
      listQuery.refetch();
    },
    onError: (e) => toast.error(`전송 실패: ${e.message}`),
  });

  const updateStatusMutation = trpc.devRequest.updateStatus.useMutation({
    onSuccess: () => { toast.success("상태가 변경되었습니다."); listQuery.refetch(); },
    onError: (e) => toast.error(`변경 실패: ${e.message}`),
  });

  return (
    <div className="space-y-4">
      {/* 필터 + 등록 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["all", "pending", "in_progress", "completed", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "all" ? "전체" : s === "pending" ? "대기중" : s === "in_progress" ? "진행중" : s === "completed" ? "완료" : "반려"}
            </button>
          ))}
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus size={14} className="mr-1" />
              신규 등록
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>개발 요청 등록</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>제목 *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="개발 요청 제목" />
              </div>
              <div>
                <Label>상세 설명 *</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="구체적인 요구사항을 작성해주세요" rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>우선순위</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">CRITICAL</SelectItem>
                      <SelectItem value="high">HIGH</SelectItem>
                      <SelectItem value="medium">MEDIUM</SelectItem>
                      <SelectItem value="low">LOW</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>대상 모듈</Label>
                  <Input value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} placeholder="예: Packages, Home" />
                </div>
              </div>
              <div>
                <Label>예상 소요 시간 (시간)</Label>
                <Input type="number" value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })} placeholder="예: 4" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
              <Button
                onClick={() => createMutation.mutate({
                  title: form.title,
                  description: form.description,
                  priority: form.priority as any,
                  module: form.module || undefined,
                  estimatedHours: form.estimatedHours ? parseInt(form.estimatedHours) : undefined,
                })}
                disabled={!form.title || !form.description || createMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {createMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                등록
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 테이블 */}
      <Card>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-indigo-600" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">ID</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead className="w-24">우선순위</TableHead>
                  <TableHead className="w-20">상태</TableHead>
                  <TableHead className="w-28">모듈</TableHead>
                  <TableHead className="w-16">예상시간</TableHead>
                  <TableHead className="w-32">Manus Task ID</TableHead>
                  <TableHead className="w-32">등록일</TableHead>
                  <TableHead className="w-28">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(listQuery.data?.rows ?? []).map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-xs text-slate-500">#{req.id}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm text-slate-800 max-w-xs truncate">{req.title}</div>
                      {req.source === "master_ai" && (
                        <span className="text-xs text-purple-600 flex items-center gap-0.5 mt-0.5">
                          <Bot size={10} />AI 자동 생성
                        </span>
                      )}
                    </TableCell>
                    <TableCell><PriorityBadge priority={req.priority} /></TableCell>
                    <TableCell><StatusBadge status={req.status} /></TableCell>
                    <TableCell className="text-xs text-slate-500">{req.module ?? "-"}</TableCell>
                    <TableCell className="text-xs text-slate-500">{req.estimatedHours ? `${req.estimatedHours}h` : "-"}</TableCell>
                    <TableCell>
                      {req.manusTaskId ? (
                        <span className="font-mono text-xs text-green-600">{req.manusTaskId.slice(0, 10)}...</span>
                      ) : (
                        <span className="text-xs text-slate-400">미전송</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(req.createdAt).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {req.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() => sendMutation.mutate({ id: req.id })}
                            disabled={sendMutation.isPending}
                          >
                            <Send size={10} className="mr-1" />
                            Manus
                          </Button>
                        )}
                        {req.status === "in_progress" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2 text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => updateStatusMutation.mutate({ id: req.id, status: "completed" })}
                          >
                            완료
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(listQuery.data?.rows ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-400 text-sm">
                      개발 요청이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-slate-400">총 {listQuery.data?.total ?? 0}건</p>
    </div>
  );
}

// ─── 탭 2: AI 비용 모니터링 ───────────────────────────────────────────────────
const CHART_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444"];

function CostMonitoringTab() {
  const [period, setPeriod] = useState<"today" | "week" | "month">("month");

  const costQuery = trpc.aiAssistant.getCostSummary.useQuery({ period });
  const logsQuery = trpc.aiAssistant.getLogs.useQuery({ assistant: "all", limit: 200, offset: 0 });

  // 일별 비용 데이터 (최근 30일)
  const dailyCostData = (() => {
    if (!logsQuery.data?.logs) return [];
    const map: Record<string, number> = {};
    logsQuery.data.logs.forEach((log) => {
      const day = new Date(log.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
      map[day] = (map[day] ?? 0) + Number(log.costUsd ?? 0);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, cost]) => ({ date, cost: Number(cost.toFixed(6)) }));
  })();

  // 어시스턴트별 비용
  const assistantCostData = (costQuery.data?.rows ?? []).map((r) => ({
    name: r.assistant === "master" ? "마스터" : r.assistant === "golftalk" ? "골프톡" : "매니저",
    cost: Number(Number(r.totalCost ?? 0).toFixed(6)),
    messages: Number(r.messageCount ?? 0),
  }));

  // 모델별 사용량
  const modelUsageData = (() => {
    if (!logsQuery.data?.logs) return [];
    const map: Record<string, number> = {};
    logsQuery.data.logs.forEach((log) => {
      if (!log.modelUsed) return;
      const label = log.modelUsed.includes("gemini-2.5-pro") ? "Gemini 2.5 Pro"
        : log.modelUsed.includes("haiku") ? "Claude Haiku"
        : log.modelUsed.includes("flash") ? "Gemini Flash"
        : log.modelUsed.slice(0, 20);
      map[label] = (map[label] ?? 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  })();

  const totalCost = costQuery.data?.totalCost ?? 0;
  const totalMessages = costQuery.data?.totalMessages ?? 0;
  const avgCostPerMsg = totalMessages > 0 ? totalCost / totalMessages : 0;

  return (
    <div className="space-y-6">
      {/* 기간 필터 */}
      <div className="flex gap-2">
        {(["today", "week", "month"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              period === p ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {p === "today" ? "오늘" : p === "week" ? "이번 주" : "이번 달"}
          </button>
        ))}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">총 비용</p>
            <p className="text-2xl font-bold text-slate-800">${totalCost.toFixed(4)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">총 대화 수</p>
            <p className="text-2xl font-bold text-slate-800">{totalMessages.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">건당 평균 비용</p>
            <p className="text-2xl font-bold text-slate-800">${avgCostPerMsg.toFixed(6)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">어시스턴트 수</p>
            <p className="text-2xl font-bold text-slate-800">{assistantCostData.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 일별 비용 라인 차트 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">일별 AI 사용 비용 (최근 30일)</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyCostData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyCostData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(6)}`, "비용"]} />
                  <Line type="monotone" dataKey="cost" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">데이터 없음</div>
            )}
          </CardContent>
        </Card>

        {/* 어시스턴트별 비용 바 차트 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">어시스턴트별 비용 비교</CardTitle>
          </CardHeader>
          <CardContent>
            {assistantCostData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={assistantCostData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(6)}`, "비용"]} />
                  <Bar dataKey="cost" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">데이터 없음</div>
            )}
          </CardContent>
        </Card>

        {/* 모델별 사용량 파이 차트 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">모델별 사용량</CardTitle>
          </CardHeader>
          <CardContent>
            {modelUsageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={modelUsageData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {modelUsageData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">데이터 없음</div>
            )}
          </CardContent>
        </Card>

        {/* 어시스턴트별 메시지 수 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">어시스턴트별 대화 건수</CardTitle>
          </CardHeader>
          <CardContent>
            {assistantCostData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={assistantCostData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`${v}건`, "대화 수"]} />
                  <Bar dataKey="messages" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">데이터 없음</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── 탭 3: 상담 세션 관리 ─────────────────────────────────────────────────────
function ChatSessionsTab() {
  const [channelFilter, setChannelFilter] = useState<"all" | "golftalk" | "manager">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed" | "pending">("all");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const sessionsQuery = trpc.chat.listSessions.useQuery({
    channel: channelFilter,
    status: statusFilter,
    limit: 50,
    offset: 0,
  });

  const messagesQuery = trpc.aiAssistant.getSessionMessages.useQuery(
    { sessionId: selectedSession! },
    { enabled: !!selectedSession }
  );

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {(["all", "golftalk", "manager"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChannelFilter(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                channelFilter === c ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {c === "all" ? "전체" : c === "golftalk" ? "골프톡" : "매니저"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["all", "active", "closed", "pending"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "all" ? "전체" : s === "active" ? "활성" : s === "closed" ? "종료" : "대기"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 세션 목록 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">세션 목록 ({sessionsQuery.data?.total ?? 0}건)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {sessionsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {(sessionsQuery.data?.sessions ?? []).map((session) => (
                  <div
                    key={session.id}
                    className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                      selectedSession === session.sessionId ? "bg-indigo-50 border-l-2 border-indigo-500" : ""
                    }`}
                    onClick={() => setSelectedSession(session.sessionId)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-slate-500">{session.sessionId.slice(0, 12)}...</span>
                      <StatusBadge status={session.status ?? "active"} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {session.channel === "golftalk" ? "골프톡" : "매니저"}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {new Date(session.createdAt).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    {session.summary && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{session.summary}</p>
                    )}
                  </div>
                ))}
                {(sessionsQuery.data?.sessions ?? []).length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">세션이 없습니다.</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 대화 내용 미리보기 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">대화 내용</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedSession ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                <div className="text-center">
                  <Eye size={24} className="mx-auto mb-2 opacity-50" />
                  세션을 선택하면 대화 내용이 표시됩니다.
                </div>
              </div>
            ) : messagesQuery.isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 size={20} className="animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(messagesQuery.data ?? []).map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2 rounded-lg text-xs ${
                      msg.role === "user" ? "bg-indigo-50 text-indigo-800 ml-4" : "bg-slate-50 text-slate-700 mr-4"
                    }`}
                  >
                    <span className="font-semibold">{msg.role === "user" ? "고객" : "AI"}: </span>
                    {msg.content.slice(0, 200)}{msg.content.length > 200 ? "..." : ""}
                  </div>
                ))}
                {(messagesQuery.data ?? []).length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">대화 내역이 없습니다.</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── 탭 5: 자동 오류 수정 파이프 ────────────────────────────────────────────────
function AutoFixPipeTab() {
  const logsQuery = trpc.aiDevEngine.getLogs.useQuery({ limit: 20 });
  const statsQuery = trpc.aiDevEngine.getDashboardStats.useQuery();

  const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    analyzing: "bg-yellow-100 text-yellow-700",
    fixed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    ignored: "bg-slate-100 text-slate-500",
  };

  return (
    <div className="space-y-6">
      {/* 파이프라인 설명 */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} className="text-orange-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-orange-800 text-sm">자동 오류 수정 파이프라인 활성화됨</p>
              <p className="text-orange-700 text-xs mt-1">
                서버 런타임 오류가 감지되면 AI가 자동으로 원인을 분석하고 수정 제안을 생성합니다.
                핵심 기능(결제/인증/예약) 수정 시에는 관리자 승인이 필요합니다.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Link href="/erp/ai-dev-engine">
                  <button className="flex items-center gap-1.5 text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 transition-colors">
                    <ExternalLink size={12} />
                    두골프-AI개발 엔진 전체 보기
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 통계 요약 */}
      {statsQuery.data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "총 오류 감지", value: (statsQuery.data as any).totalLogs ?? 0, color: "text-blue-600" },
            { label: "분석 완료", value: (statsQuery.data as any).analyzedLogs ?? 0, color: "text-green-600" },
            { label: "수정 요청", value: (statsQuery.data as any).totalFixRequests ?? 0, color: "text-purple-600" },
            { label: "승인 대기", value: (statsQuery.data as any).pendingApproval ?? 0, color: "text-orange-600" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 최근 오류 로그 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>최근 감지된 오류 (20건)</span>
            <Link href="/erp/ai-dev-engine">
              <button className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                전체 보기 <ExternalLink size={10} />
              </button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>소스</TableHead>
                <TableHead>오류 메시지</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>시간</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logsQuery.data?.logs ?? []).map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs font-mono text-slate-600">{log.source?.slice(0, 30) ?? "-"}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate">{log.errorMessage?.slice(0, 60) ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{log.errorType ?? "unknown"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`text-xs ${statusColors[log.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {(logsQuery.data?.logs ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-slate-400 text-sm">감지된 오류 없음</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 탭 4: 시스템 설정 ───────────────────────────────────────────────────────
function SystemSettingsTab() {
  const logsQuery = trpc.aiAssistant.getLogs.useQuery({ assistant: "all", limit: 20, offset: 0 });

  return (
    <div className="space-y-6">
      {/* 모델 라우팅 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">모델 라우팅 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { complexity: "high", model: "google/gemini-2.5-pro-preview", color: "bg-purple-100 text-purple-700", desc: "추론·분석·오류검수" },
              { complexity: "medium", model: "anthropic/claude-3-5-haiku", color: "bg-amber-100 text-amber-700", desc: "생성·요약·상담" },
              { complexity: "low", model: "google/gemini-2.0-flash-001", color: "bg-blue-100 text-blue-700", desc: "분류·태깅·단순응답" },
            ].map((item) => (
              <div key={item.complexity} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Badge className={`text-xs font-mono ${item.color}`}>{item.complexity.toUpperCase()}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-mono text-slate-700">{item.model}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 최근 AI 로그 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">최근 AI 로그 (20건)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>어시스턴트</TableHead>
                <TableHead>역할</TableHead>
                <TableHead>모델</TableHead>
                <TableHead>토큰 (in/out)</TableHead>
                <TableHead>비용</TableHead>
                <TableHead>시간</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logsQuery.data?.logs ?? []).map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {log.assistant === "master" ? "마스터" : log.assistant === "golftalk" ? "골프톡" : "매니저"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{log.role}</TableCell>
                  <TableCell className="text-xs font-mono text-slate-500">{log.modelUsed?.slice(0, 20) ?? "-"}</TableCell>
                  <TableCell className="text-xs font-mono">{log.tokensIn ?? 0}/{log.tokensOut ?? 0}</TableCell>
                  <TableCell className="text-xs font-mono">${Number(log.costUsd ?? 0).toFixed(6)}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {new Date(log.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                </TableRow>
              ))}
              {(logsQuery.data?.logs ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-slate-400 text-sm">로그 없음</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function AIEngine() {
  return (
    <ERPLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">AI 엔진 관리</h1>
            <p className="text-xs text-slate-500">개발 요청 · 비용 모니터링 · 상담 세션 · 시스템 설정</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dev-requests">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="dev-requests" className="text-xs">
              <Code2 size={12} className="mr-1" />
              개발 요청
            </TabsTrigger>
            <TabsTrigger value="cost" className="text-xs">
              <DollarSign size={12} className="mr-1" />
              비용 모니터링
            </TabsTrigger>
            <TabsTrigger value="sessions" className="text-xs">
              <MessageSquare size={12} className="mr-1" />
              상담 세션
            </TabsTrigger>
            <TabsTrigger value="auto-fix" className="text-xs">
              <ShieldAlert size={12} className="mr-1" />
              자동 수정 파이프
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">
              <Settings size={12} className="mr-1" />
              시스템 설정
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dev-requests" className="mt-6">
            <DevRequestsTab />
          </TabsContent>
          <TabsContent value="cost" className="mt-6">
            <CostMonitoringTab />
          </TabsContent>
          <TabsContent value="sessions" className="mt-6">
            <ChatSessionsTab />
          </TabsContent>
          <TabsContent value="auto-fix" className="mt-6">
            <AutoFixPipeTab />
          </TabsContent>
          <TabsContent value="settings" className="mt-6">
            <SystemSettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </ERPLayout>
  );
}
