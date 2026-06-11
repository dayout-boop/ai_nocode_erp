// ============================================================
// AIUnifiedLogs — AI 통합 로그 페이지 (v2)
// 카테고리 구조:
//   [마스터 전용] 마스터AI 로그 / AI 비용·크레딧 / 파트너자동화AI
//   [파트너 공개] AI파트너매니저 / AI상담톡
// ============================================================
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
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
  Briefcase,
  Sparkles,
  Zap,
  Search,
  Users,
  Bot,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Trash2,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Globe,
  AlertTriangle,
  RefreshCw,
  BrainCircuit,
  DollarSign,
  Shield,
  Lock,
  Coins,
  History,
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
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── 채널 카테고리 정의 ────────────────────────────────────
type ChannelCategory = "master" | "partner";

interface Channel {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  category: ChannelCategory;
  assistant?: "manager" | "golftalk" | null;
  type: "session" | "ailog" | "masterlog" | "cost";
  description: string;
}

const CHANNELS: Channel[] = [
  // ── 마스터 전용 ──────────────────────────────────────────
  {
    id: "master",
    label: "마스터AI 로그",
    icon: BrainCircuit,
    color: "text-indigo-600",
    bg: "bg-indigo-100",
    category: "master",
    type: "masterlog",
    description: "마스터AI 대화 이력 및 개발 요청 로그",
  },
  {
    id: "gemini",
    label: "파트너자동화AI",
    icon: Zap,
    color: "text-purple-600",
    bg: "bg-purple-100",
    category: "master",
    assistant: null,
    type: "ailog",
    description: "Gemini 기반 파트너 자동화 AI 로그",
  },
  // ── 파트너 공개 ──────────────────────────────────────────
  {
    id: "manager",
    label: "AI파트너매니저",
    icon: Briefcase,
    color: "text-blue-600",
    bg: "bg-blue-100",
    category: "partner",
    assistant: "manager",
    type: "session",
    description: "파트너사 직원용 AI 매니저 대화 이력",
  },
  {
    id: "golftalk",
    label: "AI상담톡",
    icon: Sparkles,
    color: "text-green-600",
    bg: "bg-green-100",
    category: "partner",
    assistant: "golftalk",
    type: "session",
    description: "고객 대상 AI 상담톡 대화 이력",
  },
];

const LIMIT = 15;

const REGION_COLORS: Record<string, string> = {
  "us-central1": "#6366f1",
  "europe-west4": "#10b981",
  "asia-northeast1": "#f59e0b",
  "global": "#64748b",
  "none": "#ef4444",
};

// ─── 마스터AI 로그 패널 ────────────────────────────────────
function MasterAILogPanel() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = trpc.chat.listMasterSessions.useQuery(
    { limit: LIMIT, offset: (page - 1) * LIMIT },
    { staleTime: 10_000 }
  );

  const sessions = data?.sessions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <History size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">총 세션 수</p>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bot size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">이번 페이지</p>
              <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">페이지</p>
              <p className="text-2xl font-bold text-gray-900">{page}/{totalPages || 1}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 검색 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="세션 ID 또는 대화 내용으로 검색..."
            className="pl-9 bg-white border-slate-200"
          />
        </div>
        <Button type="submit" size="sm" variant="outline">검색</Button>
        {search && (
          <Button type="button" size="sm" variant="ghost" onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}>
            초기화
          </Button>
        )}
      </form>

      {/* 세션 목록 */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">마스터AI 대화 이력이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session: any) => {
            const isExpanded = expandedId === session.sessionId;
            return (
              <Card key={session.sessionId} className="border border-indigo-100 hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div
                    className="cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : session.sessionId)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono text-indigo-600 border-indigo-200">
                          {session.sessionId?.slice(0, 16)}...
                        </Badge>
                        {session.messageCount && (
                          <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700">
                            {session.messageCount}개 메시지
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock size={12} />
                        {session.lastAt ? new Date(session.lastAt).toLocaleString("ko-KR") : "-"}
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                    {session.firstUserMessage && (
                      <p className="text-sm text-gray-700 line-clamp-2">
                        <span className="font-medium text-gray-500">마스터:</span>{" "}
                        {session.firstUserMessage}
                      </p>
                    )}
                    {session.lastAssistantMessage && !isExpanded && (
                      <p className="text-sm text-gray-500 line-clamp-1 mt-1">
                        <span className="font-medium">AI:</span>{" "}
                        {session.lastAssistantMessage}
                      </p>
                    )}
                  </div>
                  {isExpanded && session.messages && (
                    <div className="mt-4 border-t border-gray-100 pt-4 space-y-3 max-h-96 overflow-y-auto">
                      {session.messages.map((msg: any, idx: number) => (
                        <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                            msg.role === "user" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <p className={`text-xs mt-1 ${msg.role === "user" ? "text-indigo-200" : "text-gray-400"}`}>
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("ko-KR") : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── 세션 기반 로그 패널 (manager / golftalk) ────────────────
function SessionLogPanel({ assistant, category }: { assistant: "manager" | "golftalk"; category: ChannelCategory }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const { data: logsData, isLoading } = trpc.aiAssistant.getLogs.useQuery({
    assistant,
    limit: 200,
  });

  const sessions = useMemo(() => {
    const logs = logsData?.logs ?? [];
    const grouped: Record<string, typeof logs> = {};
    for (const log of logs) {
      if (!grouped[log.sessionId]) grouped[log.sessionId] = [];
      grouped[log.sessionId].push(log);
    }
    return Object.entries(grouped)
      .map(([sessionId, messages]) => ({
        sessionId,
        messages,
        firstMessage: messages.find((m) => m.role === "user"),
        lastAssistant: [...messages].reverse().find((m) => m.role === "assistant"),
        lastAt: messages[0]?.createdAt,
        userCount: messages.filter((m) => m.role === "user").length,
        assistantCount: messages.filter((m) => m.role === "assistant").length,
        modelUsed: messages[messages.length - 1]?.modelUsed,
      }))
      .filter((s) => {
        if (!searchQuery) return true;
        return s.messages.some((m) =>
          m.content.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
  }, [logsData, searchQuery]);

  const totalSessions = useMemo(() => {
    const allLogs = logsData?.logs ?? [];
    return new Set(allLogs.map((l) => l.sessionId)).size;
  }, [logsData]);

  const todaySessions = useMemo(() => {
    const today = new Date().toDateString();
    const seen = new Set<string>();
    for (const log of logsData?.logs ?? []) {
      if (new Date(log.createdAt).toDateString() === today) seen.add(log.sessionId);
    }
    return seen.size;
  }, [logsData]);

  const channelLabel = assistant === "golftalk" ? "AI상담톡" : "AI파트너매니저";
  const userLabel = assistant === "golftalk" ? "고객" : "파트너";

  return (
    <div className="space-y-4">
      {/* 파트너 공개 채널 안내 */}
      {category === "partner" && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700">
          <Users size={14} />
          <span>이 채널의 로그는 해당 파트너사 테넌트에서도 조회 가능합니다.</span>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">총 상담 세션</p>
              <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Bot size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">총 메시지 수</p>
              <p className="text-2xl font-bold text-gray-900">{logsData?.logs?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">오늘 상담 세션</p>
              <p className="text-2xl font-bold text-gray-900">{todaySessions}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="대화 내용으로 검색..."
          className="pl-9 bg-white border-slate-200"
        />
      </div>

      {/* 세션 목록 */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">대화 이력이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 font-medium">
            {channelLabel} 대화 이력 ({sessions.length}개 세션)
          </p>
          {sessions.map((session) => {
            const isExpanded = expandedSession === session.sessionId;
            return (
              <Card key={session.sessionId} className="border border-gray-200 hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div
                    className="cursor-pointer"
                    onClick={() => setExpandedSession(isExpanded ? null : session.sessionId)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono text-gray-500">
                          {session.sessionId.slice(0, 12)}...
                        </Badge>
                        {session.modelUsed && (
                          <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                            {session.modelUsed}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock size={12} />
                        {new Date(session.lastAt).toLocaleString("ko-KR")}
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                    {session.firstMessage && (
                      <p className="text-sm text-gray-700 line-clamp-2 mb-1">
                        <span className="font-medium text-gray-500">{userLabel}:</span>{" "}
                        {session.firstMessage.content}
                      </p>
                    )}
                    {session.lastAssistant && !isExpanded && (
                      <p className="text-sm text-gray-500 line-clamp-1">
                        <span className="font-medium">AI:</span>{" "}
                        {session.lastAssistant.content}
                      </p>
                    )}
                    <div className="flex gap-3 mt-2 text-xs text-gray-400">
                      <span>메시지 {session.messages.length}개</span>
                      <span>질문 {session.userCount}개</span>
                      <span>응답 {session.assistantCount}개</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 border-t border-gray-100 pt-4 space-y-3 max-h-96 overflow-y-auto">
                      {session.messages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                              msg.role === "user"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <p className={`text-xs mt-1 ${msg.role === "user" ? "text-blue-200" : "text-gray-400"}`}>
                              {new Date(msg.createdAt).toLocaleTimeString("ko-KR")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 파트너자동화AI 로그 패널 ─────────────────────────────────
function AutomationLogPanel() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"logs" | "stats">("logs");

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.aiLogs.list.useQuery(
    { page, limit: LIMIT, search: search || undefined },
    { enabled: activeSubTab === "logs" }
  );

  const { data: regionData, isLoading: regionLoading, refetch: refetchRegion } = trpc.aiLogs.regionStats.useQuery(
    undefined,
    { enabled: activeSubTab === "stats" }
  );

  const { data: dailyData } = trpc.aiLogs.dailyStats.useQuery(
    undefined,
    { enabled: activeSubTab === "stats" }
  );

  const { data: modelData } = trpc.aiLogs.modelStats.useQuery(
    undefined,
    { enabled: activeSubTab === "stats" }
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

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      {/* 서브탭 */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { id: "logs", label: "대화 로그", icon: Bot },
          { id: "stats", label: "리전 통계", icon: BarChart2 },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as "logs" | "stats")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSubTab === tab.id
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

      {/* 대화 로그 탭 */}
      {activeSubTab === "logs" && (
        <>
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
            <Button type="submit" size="sm" variant="outline">검색</Button>
            {search && (
              <Button type="button" size="sm" variant="ghost" onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}>
                초기화
              </Button>
            )}
          </form>

          {isLoading ? (
            <div className="text-center py-12 text-slate-400">로딩 중...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">로그가 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const isExpanded = expandedId === log.id;
                const isFailed = log.isSuccess === false;
                return (
                  <Card key={log.id} className={`border ${isFailed ? "border-red-200 bg-red-50/30" : "border-slate-200"}`}>
                    <CardContent className="p-4">
                      <div
                        className="cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={isFailed ? "destructive" : "secondary"} className="text-xs">
                              {isFailed ? "실패" : "성공"}
                            </Badge>
                            {log.regionUsed && (
                              <Badge variant="outline" className="text-xs" style={{ color: REGION_COLORS[log.regionUsed] || "#64748b", borderColor: REGION_COLORS[log.regionUsed] || "#64748b" }}>
                                {log.regionUsed}
                              </Badge>
                            )}
                            {log.modelName && (
                              <Badge variant="outline" className="text-xs text-slate-500">
                                {log.modelName}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Clock size={12} />
                            {new Date(log.createdAt).toLocaleString("ko-KR")}
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          <span className="font-medium text-gray-500">질문:</span> {log.query}
                        </p>
                        {!isExpanded && log.response && (
                          <p className="text-sm text-gray-500 line-clamp-1 mt-1">
                            <span className="font-medium">응답:</span> {log.response}
                          </p>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs font-medium text-gray-500 mb-1">질문</p>
                              <p className="text-sm text-gray-800 whitespace-pre-wrap">{log.query}</p>
                            </div>
                          {log.response && (
                            <div className="bg-blue-50 rounded-lg p-3">
                              <p className="text-xs font-medium text-blue-600 mb-1">응답</p>
                              <p className="text-sm text-gray-800 whitespace-pre-wrap">{log.response}</p>
                            </div>
                          )}
                          {log.isSuccess === false && (
                            <div className="bg-red-50 rounded-lg p-3">
                              <p className="text-xs font-medium text-red-600 mb-1 flex items-center gap-1">
                                <AlertTriangle size={11} /> 실패 로그
                              </p>
                              <p className="text-sm text-red-700">AI 응답 실패</p>
                            </div>
                          )}
                          <div className="flex justify-end">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1">
                                  <Trash2 size={13} /> 삭제
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>로그 삭제</AlertDialogTitle>
                                  <AlertDialogDescription>이 로그를 삭제하시겠습니까? 복구할 수 없습니다.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate({ id: log.id })}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    삭제
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-sm text-slate-500">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </>
      )}

      {/* 리전 통계 탭 */}
      {activeSubTab === "stats" && (
        <div className="space-y-6">
          {regionLoading ? (
            <div className="text-center py-12 text-slate-400">통계 로딩 중...</div>
          ) : (
            <>
              {regionData && regionData.stats && regionData.stats.length > 0 && (
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                        <Globe size={16} className="text-indigo-500" />
                        리전별 요청 분포
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resetCircuitMutation.mutate({ regionName: undefined })}
                        disabled={resetCircuitMutation.isPending}
                        className="gap-1 text-xs"
                      >
                        <RefreshCw size={12} />
                        서킷 브레이커 초기화
                      </Button>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={regionData.stats.map(s => ({ region: s.regionUsed, count: s.total, success: s.success, failure: s.failure }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="region" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="요청 수">
                          {regionData.stats.map((entry, index: number) => (
                            <Cell key={index} fill={REGION_COLORS[entry.regionUsed] || "#64748b"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {dailyData && dailyData.length > 0 && (
                <Card>
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                      <TrendingUp size={16} className="text-green-500" />
                      일별 요청 추이
                    </h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="요청 수" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {modelData && modelData.length > 0 && (
                <Card>
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-slate-700 mb-4">모델별 사용 분포</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={modelData} dataKey="count" nameKey="model" cx="50%" cy="50%" outerRadius={70} label={({ model, percent }: any) => `${model} ${(percent * 100).toFixed(0)}%`}>
                            {modelData.map((_: any, index: number) => (
                              <Cell key={index} fill={Object.values(REGION_COLORS)[index % 5]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {modelData.map((m: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: Object.values(REGION_COLORS)[idx % 5] }} />
                              <span className="text-slate-600 truncate max-w-[160px]">{m.model}</span>
                            </div>
                            <span className="font-semibold text-slate-800">{m.count}건</span>
                          </div>
                        ))}
                      </div>
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

// ─── 메인 페이지 ──────────────────────────────────────────
export default function AIUnifiedLogs() {
  const { user } = useAuth();
  const isMaster = user?.role === "admin";

  // 마스터 전용 채널은 admin만 볼 수 있음
  const visibleChannels = CHANNELS.filter(ch =>
    ch.category === "partner" || (ch.category === "master" && isMaster)
  );

  const [activeChannel, setActiveChannel] = useState<string>(() =>
    isMaster ? "master" : "manager"
  );

  const channel = visibleChannels.find((c) => c.id === activeChannel) ?? visibleChannels[0];

  // 카테고리별 분리
  const masterChannels = visibleChannels.filter(c => c.category === "master");
  const partnerChannels = visibleChannels.filter(c => c.category === "partner");

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
          <Bot size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">AI 통합 로그</h1>
          <p className="text-sm text-slate-500">
            {isMaster
              ? "마스터AI · 파트너자동화AI · AI파트너매니저 · AI상담톡 전체 통합 관리"
              : "AI파트너매니저 · AI상담톡 대화 이력 조회"}
          </p>
        </div>
      </div>

      {/* 채널 탭 — 카테고리별 구분 */}
      <div className="space-y-1">
        {/* 마스터 전용 섹션 */}
        {isMaster && masterChannels.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-1 mb-1">
              <Shield size={12} className="text-amber-500" />
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">마스터 전용</span>
            </div>
            <div className="flex gap-1 flex-wrap border-b border-slate-200 pb-0">
              {masterChannels.map((ch) => {
                const Icon = ch.icon;
                const isActive = activeChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                      isActive
                        ? "border-amber-500 text-amber-700"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <Icon size={15} className={isActive ? ch.color : ""} />
                    {ch.label}
                    <Lock size={11} className="text-amber-400 opacity-60" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 파트너 공개 섹션 */}
        {partnerChannels.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-2 px-1 mb-1">
              <Users size={12} className="text-blue-500" />
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">파트너 공개</span>
            </div>
            <div className="flex gap-1 flex-wrap border-b border-slate-200 pb-0">
              {partnerChannels.map((ch) => {
                const Icon = ch.icon;
                const isActive = activeChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                      isActive
                        ? "border-indigo-600 text-indigo-700"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <Icon size={15} className={isActive ? ch.color : ""} />
                    {ch.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 채널 설명 */}
      {channel && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${
          channel.category === "master"
            ? "bg-amber-50 border border-amber-200 text-amber-700"
            : "bg-blue-50 border border-blue-200 text-blue-700"
        }`}>
          {channel.category === "master" ? <Shield size={14} /> : <Users size={14} />}
          <span>{channel.description}</span>
          {channel.category === "master" && (
            <Badge className="ml-auto text-xs bg-amber-100 text-amber-700 border-amber-300">마스터 전용</Badge>
          )}
          {channel.category === "partner" && (
            <Badge className="ml-auto text-xs bg-blue-100 text-blue-700 border-blue-300">파트너 공개</Badge>
          )}
        </div>
      )}

      {/* 채널별 콘텐츠 */}
      {activeChannel === "master" && <MasterAILogPanel />}
      {activeChannel === "gemini" && <AutomationLogPanel />}
      {activeChannel === "manager" && <SessionLogPanel assistant="manager" category="partner" />}
      {activeChannel === "golftalk" && <SessionLogPanel assistant="golftalk" category="partner" />}
    </div>
  );
}
