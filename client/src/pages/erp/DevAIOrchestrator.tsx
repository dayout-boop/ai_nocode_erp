/**
 * 두골프 중앙 AI 오케스트레이터 페이지
 * - 작업 유형 선택 → 자동 모델 라우팅 → 결과 표시
 * - 비용 대시보드 (일별 추이, 모델별 분포, 캐시 히트율)
 * - 모델 가격 정보 테이블
 */

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Bot,
  Send,
  Zap,
  DollarSign,
  TrendingUp,
  Database,
  Cpu,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

// ────────────────────────────────────────────────────────────────────────────
// 상수
// ────────────────────────────────────────────────────────────────────────────

const TASK_TYPE_OPTIONS = [
  { value: "auto", label: "🤖 자동 감지", complexity: "자동", color: "bg-slate-100 text-slate-700" },
  { value: "text_summary", label: "📝 텍스트 요약", complexity: "SIMPLE", color: "bg-green-100 text-green-700" },
  { value: "hashtag_gen", label: "#️⃣ 해시태그 생성", complexity: "SIMPLE", color: "bg-green-100 text-green-700" },
  { value: "data_classify", label: "🗂️ 데이터 분류", complexity: "SIMPLE", color: "bg-green-100 text-green-700" },
  { value: "price_analysis", label: "💰 요금표 분석", complexity: "MODERATE", color: "bg-amber-100 text-amber-700" },
  { value: "schedule_optimize", label: "📅 일정 최적화", complexity: "MODERATE", color: "bg-amber-100 text-amber-700" },
  { value: "report_gen", label: "📊 리포트 생성", complexity: "MODERATE", color: "bg-amber-100 text-amber-700" },
  { value: "content_create", label: "✍️ 콘텐츠 생성", complexity: "COMPLEX", color: "bg-violet-100 text-violet-700" },
  { value: "layout_design", label: "🎨 레이아웃 설계", complexity: "COMPLEX", color: "bg-violet-100 text-violet-700" },
  { value: "code_review", label: "🔍 코드 리뷰", complexity: "COMPLEX", color: "bg-violet-100 text-violet-700" },
] as const;

const COMPLEXITY_CONFIG = {
  SIMPLE: { label: "SIMPLE", color: "bg-green-100 text-green-700 border-green-200", model: "GPT-4o mini", icon: "⚡" },
  MODERATE: { label: "MODERATE", color: "bg-amber-100 text-amber-700 border-amber-200", model: "Gemini 1.5 Pro", icon: "🔥" },
  COMPLEX: { label: "COMPLEX", color: "bg-violet-100 text-violet-700 border-violet-200", model: "Claude 3.5 Sonnet", icon: "🚀" },
};

const PIE_COLORS = ["#22c55e", "#f59e0b", "#8b5cf6"];

// ────────────────────────────────────────────────────────────────────────────
// 채팅 메시지 타입
// ────────────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  model?: string;
  complexity?: string;
  taskType?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheHit?: boolean;
  durationMs?: number;
  timestamp: Date;
}

// ────────────────────────────────────────────────────────────────────────────
// 채팅 탭
// ────────────────────────────────────────────────────────────────────────────

function OrchestratorChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [taskType, setTaskType] = useState("auto");
  const [useCache, setUseCache] = useState(true);
  const [useFreeModel, setUseFreeModel] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const askMutation = trpc.orchestrator.ask.useMutation();

  // 복잡도 미리보기
  const detectQuery = trpc.orchestrator.detectComplexity.useQuery(
    { prompt: input },
    { enabled: input.length > 10 && taskType === "auto" }
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const prompt = input.trim();
    setInput("");

    try {
      const result = await askMutation.mutateAsync({
        message: prompt,
        taskType: taskType as any,
        useCache,
        useFreeModel,
      });

      if (!result.success || !result.text) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "_err",
            role: "error",
            content: result.errorMessage ?? "알 수 없는 오류가 발생했습니다.",
            timestamp: new Date(),
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_ai",
          role: "assistant",
          content: result.text!,
          model: result.model ?? undefined,
          complexity: result.complexity ?? undefined,
          taskType: result.taskType,
          costUsd: result.costUsd,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cacheHit: result.cacheHit,
          durationMs: result.durationMs,
          timestamp: new Date(),
        },
      ]);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_err",
          role: "error",
          content: err instanceof Error ? err.message : "오류가 발생했습니다.",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const selectedTask = TASK_TYPE_OPTIONS.find((t) => t.value === taskType);

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
      {/* 헤더 옵션 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Select value={taskType} onValueChange={setTaskType}>
          <SelectTrigger className="w-52 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="flex items-center gap-2">
                  {opt.label}
                  <Badge className={`text-[10px] px-1 py-0 ${opt.color}`}>
                    {opt.complexity}
                  </Badge>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 자동 감지 미리보기 */}
        {taskType === "auto" && detectQuery.data && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">감지된 복잡도:</span>
            <Badge className={`text-[10px] px-1.5 py-0 ${COMPLEXITY_CONFIG[detectQuery.data.complexity as keyof typeof COMPLEXITY_CONFIG]?.color}`}>
              {detectQuery.data.complexity} → {COMPLEXITY_CONFIG[detectQuery.data.complexity as keyof typeof COMPLEXITY_CONFIG]?.model}
            </Badge>
          </div>
        )}

        <button
          onClick={() => setUseCache(!useCache)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
            useCache
              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
              : "bg-slate-50 border-slate-200 text-slate-500"
          }`}
        >
          <Database size={12} />
          캐시 {useCache ? "ON" : "OFF"}
        </button>

        <button
          onClick={() => setUseFreeModel(!useFreeModel)}
          title="Llama 3.1 8B 무료 모델 사용 (SIMPLE 등급 작업에만 적용)"
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
            useFreeModel
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-slate-50 border-slate-200 text-slate-500"
          }`}
        >
          <span className="text-xs">🦙</span>
          무료모델 {useFreeModel ? "ON" : "OFF"}
        </button>

        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-slate-400 ml-auto"
            onClick={() => setMessages([])}
          >
            대화 초기화
          </Button>
        )}
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
              <Sparkles size={28} className="text-violet-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-600 mb-1">중앙 AI 오케스트레이터</p>
              <p className="text-sm">작업 유형을 선택하고 질문을 입력하면<br />최적의 AI 모델이 자동으로 선택됩니다.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
              {Object.entries(COMPLEXITY_CONFIG).map(([key, cfg]) => (
                <div key={key} className={`text-center p-2 rounded-lg border text-xs ${cfg.color}`}>
                  <div className="text-base mb-0.5">{cfg.icon}</div>
                  <div className="font-semibold">{key}</div>
                  <div className="opacity-75 text-[10px]">{cfg.model}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "user" ? (
              <div className="max-w-[75%] bg-violet-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
                {msg.content}
              </div>
            ) : msg.role === "error" ? (
              <div className="max-w-[80%] bg-red-50 border border-red-200 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-2 text-red-600 text-sm font-medium mb-1">
                  <AlertTriangle size={14} />
                  오류 발생
                </div>
                <p className="text-sm text-red-700">{msg.content}</p>
              </div>
            ) : (
              <div className="max-w-[80%] space-y-2">
                {/* 모델 배지 */}
                <div className="flex items-center gap-2 flex-wrap">
                  {msg.complexity && (
                    <Badge className={`text-[10px] px-1.5 py-0 ${COMPLEXITY_CONFIG[msg.complexity as keyof typeof COMPLEXITY_CONFIG]?.color}`}>
                      {COMPLEXITY_CONFIG[msg.complexity as keyof typeof COMPLEXITY_CONFIG]?.icon} {msg.complexity}
                    </Badge>
                  )}
                  {msg.model && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-600 border-slate-200 font-mono">
                      {msg.model.split("/")[1] ?? msg.model}
                    </Badge>
                  )}
                  {msg.cacheHit && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-600 border-indigo-200">
                      💾 캐시 히트
                    </Badge>
                  )}
                  {msg.costUsd !== undefined && (
                    <span className="text-[10px] text-slate-400">
                      ${msg.costUsd.toFixed(6)} · {msg.inputTokens}+{msg.outputTokens} tokens · {msg.durationMs}ms
                    </span>
                  )}
                </div>

                {/* 메시지 내용 */}
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>

                {/* 복사 버튼 */}
                <button
                  onClick={() => handleCopy(msg.id, msg.content)}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {copiedId === msg.id ? (
                    <><CheckCircle2 size={10} className="text-green-500" /> 복사됨</>
                  ) : (
                    <><Copy size={10} /> 복사</>
                  )}
                </button>
              </div>
            )}
          </div>
        ))}

        {askMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Cpu size={14} className="animate-spin" />
                AI 처리 중...
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      <div className="mt-4 flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={`${selectedTask?.label ?? "질문"} 입력... (Enter로 전송, Shift+Enter 줄바꿈)`}
          className="resize-none text-sm min-h-[60px] max-h-[120px]"
          rows={2}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || askMutation.isPending}
          className="shrink-0 bg-violet-600 hover:bg-violet-700 text-white h-auto px-4"
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 비용 대시보드 탭
// ────────────────────────────────────────────────────────────────────────────

function CostDashboard() {
  const [days, setDays] = useState(30);
  const { data: stats, isLoading, refetch } = trpc.orchestrator.getCostStats.useQuery({ days });
  const { data: pricing } = trpc.orchestrator.getModelPricing.useQuery();
  const clearCacheMutation = trpc.orchestrator.clearCache.useMutation({
    onSuccess: () => {
      toast.success("인메모리 캐시가 초기화되었습니다.");
      refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const summary = stats?.summary;
  const totalCost = Number(summary?.totalCost ?? 0);
  const totalSaved = Number(summary?.totalCacheSaved ?? 0);
  const totalReqs = Number(summary?.totalRequests ?? 0);
  const cacheHitRate = totalReqs > 0 ? ((Number(summary?.cacheHits ?? 0) / totalReqs) * 100).toFixed(1) : "0.0";
  const successRate = totalReqs > 0 ? ((Number(summary?.successCount ?? 0) / totalReqs) * 100).toFixed(1) : "0.0";

  // 복잡도별 파이차트 데이터
  const pieData = (stats?.byComplexity ?? []).map((item, idx) => ({
    name: item.complexity ?? "unknown",
    value: Number(item.requests),
    color: PIE_COLORS[idx % PIE_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* 기간 선택 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {[7, 14, 30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                days === d
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-violet-300"
              }`}
            >
              {d}일
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
            <RefreshCw size={12} />
            새로고침
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50"
            onClick={() => clearCacheMutation.mutate()}
            disabled={clearCacheMutation.isPending}
          >
            <Database size={12} />
            캐시 초기화
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={16} className="text-violet-500" />
              <span className="text-xs text-slate-500">총 비용 ({days}일)</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">${totalCost.toFixed(4)}</div>
            <div className="text-xs text-green-600 mt-1">절약: ${totalSaved.toFixed(4)}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-amber-500" />
              <span className="text-xs text-slate-500">총 요청</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{totalReqs.toLocaleString()}</div>
            <div className="text-xs text-slate-400 mt-1">성공률 {successRate}%</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database size={16} className="text-indigo-500" />
              <span className="text-xs text-slate-500">캐시 히트율</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{cacheHitRate}%</div>
            <div className="text-xs text-slate-400 mt-1">
              인메모리: {stats?.inMemoryCacheStats?.size ?? 0}개
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-green-500" />
              <span className="text-xs text-slate-500">평균 응답시간</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {summary?.avgDuration ? `${Math.round(Number(summary.avgDuration))}ms` : "-"}
            </div>
            <div className="text-xs text-slate-400 mt-1">타임아웃: 30초</div>
          </CardContent>
        </Card>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 일별 비용 추이 */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <TrendingUp size={14} />
              일별 비용 추이
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(stats?.byDay ?? []).length === 0 ? (
              <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
                데이터 없음
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={stats?.byDay ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    formatter={(v: number) => [`$${Number(v).toFixed(6)}`, "비용"]}
                    labelFormatter={(l) => `날짜: ${l}`}
                  />
                  <Line type="monotone" dataKey="totalCost" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 복잡도별 분포 */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Layers size={14} />
              복잡도별 분포
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
                데이터 없음
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}회`, "요청"]} />
                  <Legend iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 모델별 비용 바차트 */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Bot size={14} />
            모델별 비용 및 요청 수
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(stats?.byModel ?? []).length === 0 ? (
            <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
              아직 요청 데이터가 없습니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats?.byModel ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="modelName" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v: number, name: string) =>
                    name === "totalCost" ? [`$${Number(v).toFixed(6)}`, "비용"] : [v, "요청 수"]
                  }
                />
                <Bar yAxisId="left" dataKey="totalCost" fill="#8b5cf6" name="totalCost" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="requests" fill="#e2e8f0" name="requests" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 모델 가격 테이블 */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <DollarSign size={14} />
            모델 단가 정보 (OpenRouter 기준)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">복잡도</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">모델</th>
                  <th className="text-right py-2 px-3 text-xs text-slate-500 font-medium">입력 (1M)</th>
                  <th className="text-right py-2 px-3 text-xs text-slate-500 font-medium">출력 (1M)</th>
                  <th className="text-right py-2 px-3 text-xs text-slate-500 font-medium">캐시 입력 (1M)</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">용도</th>
                </tr>
              </thead>
              <tbody>
                {(pricing ?? []).map((m) => {
                  const cfg = COMPLEXITY_CONFIG[m.complexity as keyof typeof COMPLEXITY_CONFIG];
                  return (
                    <tr key={m.id ?? m.name} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <Badge className={`text-[10px] px-1.5 py-0 ${cfg?.color}`}>
                          {cfg?.icon} {m.complexity}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">{m.name}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">${m.inputPricePerMillion}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">${m.outputPricePerMillion}</td>
                      <td className="py-2.5 px-3 text-right text-green-600">
                        ${m.cachedInputPricePerMillion ?? "-"}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-500">{m.description}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 최근 로그 탭
// ────────────────────────────────────────────────────────────────────────────

function RecentLogs() {
  const { data: logs, isLoading } = trpc.orchestrator.getRecentLogs.useQuery({ limit: 50 });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!logs?.length) {
    return (
      <Card className="border-dashed border-slate-200">
        <CardContent className="py-16 flex flex-col items-center gap-3 text-slate-400">
          <Database size={32} className="opacity-40" />
          <p className="text-sm font-medium">아직 오케스트레이터 호출 기록이 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const cfg = COMPLEXITY_CONFIG[log.complexity as keyof typeof COMPLEXITY_CONFIG];
        return (
          <Card key={log.id} className="border-slate-200">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${log.isSuccess ? "bg-green-500" : "bg-red-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {cfg && (
                        <Badge className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>
                          {cfg.icon} {log.complexity}
                        </Badge>
                      )}
                      <Badge className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-600 border-slate-200 font-mono">
                        {log.model?.split("/")[1] ?? log.model}
                      </Badge>
                      {log.cacheHit && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-600 border-indigo-200">
                          💾 캐시
                        </Badge>
                      )}
                      <span className="text-[10px] text-slate-400">
                        ${Number(log.costUsd ?? 0).toFixed(6)} · {log.durationMs}ms
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 truncate">{log.promptPreview}</p>
                    {!log.isSuccess && log.errorMessage && (
                      <p className="text-xs text-red-500 mt-0.5">{log.errorMessage}</p>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {new Date(log.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ────────────────────────────────────────────────────────────────────────────

export default function DevAIOrchestrator() {
  return (
    <ERPLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Sparkles size={22} className="text-violet-500" />
              중앙 AI 오케스트레이터
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              OpenRouter 기반 · 작업 복잡도에 따라 최적 모델 자동 선택 · 비용 추적
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">⚡ SIMPLE → GPT-4o mini</Badge>
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">🔥 MODERATE → Gemini 1.5 Pro</Badge>
            <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">🚀 COMPLEX → Claude 3.5 Sonnet</Badge>
          </div>
        </div>

        <Tabs defaultValue="chat">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="chat" className="text-sm gap-1.5">
              <Bot size={14} />
              AI 채팅
            </TabsTrigger>
            <TabsTrigger value="cost" className="text-sm gap-1.5">
              <DollarSign size={14} />
              비용 대시보드
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-sm gap-1.5">
              <Database size={14} />
              최근 로그
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-4">
            <OrchestratorChat />
          </TabsContent>

          <TabsContent value="cost" className="mt-4">
            <CostDashboard />
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <RecentLogs />
          </TabsContent>
        </Tabs>
      </div>
    </ERPLayout>
  );
}
