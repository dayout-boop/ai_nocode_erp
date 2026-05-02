/**
 * 두골프 마스터 AI 채팅 페이지 (v3)
 * - SSE 스트리밍 실시간 응답
 * - Tool Calling 시각화 (DB 조회 과정 표시)
 * - 추론 → 분석 → 결과도출 → Manus 전송 파이프라인
 * - 사실 기반 응답 강제 (생성형 대화 차단)
 * - 개발 요청 자동 감지 → Manus 전송 UI
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Loader2, Bot, User, Zap, AlertCircle, CheckCircle2,
  ExternalLink, ChevronDown, RefreshCw, BarChart3, ClipboardList,
  DollarSign, Cpu, MessageSquare, Database, Search, Clock,
  TrendingUp, Package, AlertTriangle, Activity, Plus, GitBranch, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────
interface DevRequestSuggestion {
  type: "dev_request";
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  module: string;
  estimatedHours: number;
}

interface ToolExecution {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  queryTime?: number;
  error?: string;
  startedAt: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  durationMs?: number;
  devRequestSuggestion?: DevRequestSuggestion | null;
  error?: string;
  timestamp: Date;
  // Tool Calling 시각화
  toolExecutions?: ToolExecution[];
  phase?: "thinking" | "querying" | "analyzing" | "done";
}

// ─── 태스크 후보 타입 ─────────────────────────────────────────────────────────
interface TaskCandidate {
  id: number;
  taskId: string;
  taskName: string;
  projectName?: string | null;
  description?: string | null;
  taskType: "erp" | "homepage" | "new_project" | "other";
  isDefault: boolean;
  isActive: boolean;
  useCount?: number | null;
  lastUsedAt?: Date | null;
}

// ─── 태스크 유형 레이블 ────────────────────────────────────────────────────────
const TASK_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  erp: { label: "ERP", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  homepage: { label: "홈페이지", color: "bg-green-100 text-green-700 border-green-200" },
  new_project: { label: "신규 프로젝트", color: "bg-purple-100 text-purple-700 border-purple-200" },
  other: { label: "기타", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

// ─── 태스크 선택 다이얼로그 컴포넌트 ──────────────────────────────────────────
function TaskSelectDialog({
  open,
  onClose,
  onConfirm,
  suggestion,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedTaskId: string | null, forceNew: boolean) => void;
  suggestion: DevRequestSuggestion | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendedTaskId, setRecommendedTaskId] = useState<string | null>(null);
  const [recommendReason, setRecommendReason] = useState<string>("");
  const [recommendConfidence, setRecommendConfidence] = useState<number>(0);

  // 태스크 후보 목록 조회
  const { data: candidatesData, isLoading: candidatesLoading } = trpc.systemSettings.listTaskCandidates.useQuery(
    { activeOnly: true },
    { enabled: open }
  );

  // AI 태스크 추천
  const recommendMutation = trpc.systemSettings.analyzeAndRecommendTask.useMutation({
    onSuccess: (data) => {
      if (data.recommended) {
        setRecommendedTaskId(data.recommended.taskId);
        setRecommendReason(data.reason ?? "");
        setRecommendConfidence(data.confidence ?? 0);
        // 추천 태스크 자동 선택
        if (!selectedId) setSelectedId(data.recommended.taskId);
      }
      setIsAnalyzing(false);
    },
    onError: () => setIsAnalyzing(false),
  });

  // 다이얼로그 열릴 때 AI 분석 자동 실행
  useEffect(() => {
    if (open && suggestion && !isAnalyzing) {
      setSelectedId(null);
      setRecommendedTaskId(null);
      setRecommendReason("");
      setIsAnalyzing(true);
      recommendMutation.mutate({
        title: suggestion.title,
        description: suggestion.description,
        module: suggestion.module,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, suggestion?.title]);

  const candidates = (candidatesData ?? []) as TaskCandidate[];

  const handleConfirm = (forceNew = false) => {
    if (forceNew) {
      onConfirm(null, true);
    } else {
      onConfirm(selectedId, false);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-800">
            <GitBranch size={16} className="text-indigo-600" />
            Manus 태스크 선택
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            개발 요청을 전송할 Manus 태스크를 선택하세요. AI가 가장 적합한 태스크를 추천합니다.
          </DialogDescription>
        </DialogHeader>

        {/* 개발 요청 요약 */}
        {suggestion && (
          <div className="bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100">
            <p className="text-xs text-indigo-600 font-medium mb-0.5">전송할 개발 요청</p>
            <p className="text-sm font-semibold text-gray-800">{suggestion.title}</p>
            <p className="text-xs text-gray-500">{suggestion.module} · {suggestion.priority.toUpperCase()}</p>
          </div>
        )}

        {/* AI 분석 중 */}
        {isAnalyzing && (
          <div className="flex items-center gap-2 text-indigo-600 text-sm py-2">
            <Loader2 size={14} className="animate-spin" />
            AI가 최적 태스크를 분석 중...
          </div>
        )}

        {/* AI 추천 결과 */}
        {!isAnalyzing && recommendedTaskId && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-xs font-medium text-amber-700 flex items-center gap-1 mb-0.5">
              <Star size={11} />
              AI 추천 ({Math.round(recommendConfidence * 100)}% 신뢰도)
            </p>
            <p className="text-xs text-amber-800">{recommendReason}</p>
          </div>
        )}

        {/* 태스크 후보 목록 */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {candidatesLoading ? (
            <div className="text-center py-4 text-gray-400 text-sm"><Loader2 size={14} className="animate-spin inline mr-1" />로딩 중...</div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">
              등록된 태스크 후보가 없습니다.<br />
              <span className="text-xs">ERP &gt; 연동 설정 &gt; 시스템 설정에서 추가하세요.</span>
            </div>
          ) : (
            candidates.map((c) => {
              const typeInfo = TASK_TYPE_LABELS[c.taskType] ?? TASK_TYPE_LABELS.other;
              const isSelected = selectedId === c.taskId;
              const isRecommended = recommendedTaskId === c.taskId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.taskId)}
                  className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                    isSelected
                      ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300"
                      : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-gray-800 truncate">{c.taskName}</span>
                        {isRecommended && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 border px-1 py-0">
                            <Star size={8} className="mr-0.5" />AI 추천
                          </Badge>
                        )}
                        {c.isDefault && (
                          <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 border px-1 py-0">기본</Badge>
                        )}
                      </div>
                      {c.projectName && (
                        <p className="text-xs text-gray-500 mt-0.5">{c.projectName}</p>
                      )}
                      {c.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{c.description}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{c.taskId}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className={`text-[10px] border ${typeInfo.color} px-1.5 py-0`}>{typeInfo.label}</Badge>
                      {c.useCount != null && c.useCount > 0 && (
                        <span className="text-[10px] text-gray-400">{c.useCount}회 사용</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleConfirm(true)}
            className="text-purple-600 border-purple-200 hover:bg-purple-50 flex items-center gap-1"
          >
            <Plus size={13} />
            신규 태스크 생성
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button
              size="sm"
              onClick={() => handleConfirm(false)}
              disabled={!selectedId && candidates.length > 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Zap size={13} className="mr-1" />
              {selectedId ? "선택한 태스크로 전송" : "스마트 라우팅으로 전송"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 도구 이름 한국어 매핑 ─────────────────────────────────────────────────────
const TOOL_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  get_today_reservations: { label: "오늘 예약 조회", icon: <ClipboardList size={11} /> },
  get_monthly_settlement: { label: "월별 정산 조회", icon: <BarChart3 size={11} /> },
  get_pending_dev_requests: { label: "개발 요청 조회", icon: <Zap size={11} /> },
  get_ai_cost_today: { label: "AI 비용 조회", icon: <DollarSign size={11} /> },
  get_ai_cost_monthly: { label: "월별 AI 비용 조회", icon: <TrendingUp size={11} /> },
  get_system_error_logs: { label: "오류 로그 조회", icon: <AlertTriangle size={11} /> },
  get_package_summary: { label: "상품 현황 조회", icon: <Package size={11} /> },
  get_customer_stats: { label: "고객 통계 조회", icon: <Activity size={11} /> },
  search_packages: { label: "상품 검색", icon: <Search size={11} /> },
  get_inquiry_stats: { label: "문의 통계 조회", icon: <MessageSquare size={11} /> },
};

// ─── 빠른 명령 버튼 ────────────────────────────────────────────────────────────
const QUICK_COMMANDS = [
  { label: "오늘 예약 현황", icon: <ClipboardList size={13} />, message: "오늘 날짜 기준 신규 예약 현황을 알려주세요." },
  { label: "이번 달 정산", icon: <BarChart3 size={13} />, message: "이번 달 정산 현황과 미정산 건수를 요약해주세요." },
  { label: "미처리 개발 요청", icon: <Zap size={13} />, message: "현재 pending 상태인 개발 요청 목록을 알려주세요." },
  { label: "AI 비용 현황", icon: <DollarSign size={13} />, message: "오늘과 이번 달 AI 사용 비용 현황을 알려주세요." },
  { label: "시스템 오류 로그", icon: <AlertTriangle size={13} />, message: "최근 시스템 오류 로그를 확인해주세요." },
  { label: "상품 현황", icon: <Package size={13} />, message: "현재 등록된 골프 패키지 상품 현황을 요약해주세요." },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

// ─── Tool 실행 시각화 컴포넌트 ─────────────────────────────────────────────────
function ToolExecutionPanel({ tools }: { tools: ToolExecution[] }) {
  if (tools.length === 0) return null;
  return (
    <div className="mt-2 mb-1 space-y-1">
      {tools.map((tool) => {
        const meta = TOOL_LABELS[tool.name] ?? { label: tool.name, icon: <Database size={11} /> };
        return (
          <div
            key={tool.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
              tool.status === "running"
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : tool.status === "done"
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {tool.status === "running" ? (
              <Loader2 size={11} className="animate-spin shrink-0" />
            ) : tool.status === "done" ? (
              <CheckCircle2 size={11} className="shrink-0" />
            ) : (
              <AlertCircle size={11} className="shrink-0" />
            )}
            <span className="shrink-0">{meta.icon}</span>
            <span className="font-medium">{meta.label}</span>
            {tool.queryTime !== undefined && (
              <span className="ml-auto font-mono opacity-70 flex items-center gap-0.5">
                <Clock size={9} />
                {tool.queryTime}ms
              </span>
            )}
            {tool.error && (
              <span className="ml-auto text-red-600 truncate max-w-[120px]">{tool.error}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 추론 단계 표시 컴포넌트 ─────────────────────────────────────────────────
function PhaseIndicator({ phase }: { phase?: string }) {
  if (!phase || phase === "done") return null;
  const phases: Record<string, { label: string; color: string }> = {
    thinking: { label: "추론 중...", color: "text-purple-600" },
    querying: { label: "DB 조회 중...", color: "text-blue-600" },
    analyzing: { label: "분석 중...", color: "text-indigo-600" },
  };
  const p = phases[phase];
  if (!p) return null;
  return (
    <span className={`text-xs font-medium ${p.color} flex items-center gap-1`}>
      <Loader2 size={10} className="animate-spin" />
      {p.label}
    </span>
  );
}

// AI 카테고리 색상
const CATEGORY_COLORS: Record<string, string> = {
  BUG: "bg-red-100 text-red-700 border-red-200",
  FEATURE: "bg-blue-100 text-blue-700 border-blue-200",
  IMPROVEMENT: "bg-purple-100 text-purple-700 border-purple-200",
  REFACTOR: "bg-gray-100 text-gray-700 border-gray-200",
};

// AI 카테고리 한국어
const CATEGORY_LABELS: Record<string, string> = {
  BUG: "🐛 버그 수정",
  FEATURE: "✨ 신규 기능",
  IMPROVEMENT: "🔧 기능 개선",
  REFACTOR: "♻️ 리팩터링",
};

// ─── 개발 요청 카드 컴포넌트 (스마트 라우팅 + AI 분류 표시) ─────────────────────
function DevRequestCard({
  suggestion,
  onSend,
  isSending,
  sent,
  routingType,
  routingReason,
  manusTaskUrl,
}: {
  suggestion: DevRequestSuggestion;
  onSend: () => void;
  isSending: boolean;
  sent: boolean;
  routingType?: "create_task" | "send_message" | null;
  routingReason?: string | null;
  manusTaskUrl?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const aiCategory = (suggestion as DevRequestSuggestion & { aiCategory?: string }).aiCategory;
  const aiAnalysis = (suggestion as DevRequestSuggestion & { aiAnalysis?: string }).aiAnalysis;

  return (
    <Card className="mt-3 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 w-full max-w-lg shadow-sm">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold text-indigo-800 flex items-center gap-2">
            <Zap size={14} className="text-indigo-600" />
            개발 요청 감지됨
          </CardTitle>
          <div className="flex items-center gap-1.5 flex-wrap">
            {aiCategory && (
              <Badge className={`text-xs border ${CATEGORY_COLORS[aiCategory] ?? "bg-gray-100 text-gray-600"}`}>
                {CATEGORY_LABELS[aiCategory] ?? aiCategory}
              </Badge>
            )}
            <Badge className={`text-xs border ${PRIORITY_COLORS[suggestion.priority] ?? "bg-gray-100 text-gray-600"}`}>
              {suggestion.priority.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {/* 라우팅 방식 표시 */}
        {routingType && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${
            routingType === "send_message"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-blue-50 border-blue-200 text-blue-700"
          }`}>
            {routingType === "send_message" ? (
              <MessageSquare size={12} className="mt-0.5 shrink-0" />
            ) : (
              <ExternalLink size={12} className="mt-0.5 shrink-0" />
            )}
            <div>
              <span className="font-semibold">
                {routingType === "send_message" ? "기존 스레드 추가 (크레딧 절약)" : "신규 Manus 태스크 생성"}
              </span>
              {routingReason && <p className="opacity-80 mt-0.5">{routingReason}</p>}
            </div>
          </div>
        )}

        {/* AI 분석 요약 */}
        {aiAnalysis && (
          <div className="bg-white/70 rounded-lg px-3 py-2 text-xs text-gray-600 border border-indigo-100">
            <p className="font-medium text-indigo-600 mb-0.5">AI 분석</p>
            <p>{aiAnalysis}</p>
          </div>
        )}

        <div>
          <p className="text-xs text-indigo-600 font-medium">제목</p>
          <p className="text-sm text-gray-800 font-medium">{suggestion.title}</p>
        </div>
        <div className="flex gap-4">
          <div>
            <p className="text-xs text-indigo-600 font-medium">모듈</p>
            <p className="text-sm text-gray-700">{suggestion.module}</p>
          </div>
          <div>
            <p className="text-xs text-indigo-600 font-medium">예상 시간</p>
            <p className="text-sm text-gray-700">{suggestion.estimatedHours}시간</p>
          </div>
        </div>

        {/* 상세 설명 토글 */}
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 mb-1"
          >
            <ChevronDown size={11} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "설명 접기" : "상세 설명 보기"}
          </button>
          {expanded && (
            <p className="text-sm text-gray-700 bg-white/70 rounded-lg px-3 py-2 border border-indigo-100">
              {suggestion.description}
            </p>
          )}
        </div>

        {sent ? (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50 rounded-lg px-3 py-2">
              <CheckCircle2 size={14} />
              Manus에 전송 완료
            </div>
            {manusTaskUrl && (
              <a
                href={manusTaskUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-2 border border-indigo-200 transition-colors w-full"
              >
                <ExternalLink size={11} />
                Manus 태스크 바로가기
              </a>
            )}
          </div>
        ) : (
          <Button
            size="sm"
            onClick={onSend}
            disabled={isSending}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-1"
          >
            {isSending ? (
              <><Loader2 size={13} className="animate-spin mr-1" /> AI 분류 + 전송 중...</>
            ) : (
              <><Zap size={13} className="mr-1" /> 스마트 전송 (자동 분류 + 라우팅)</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function MasterAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId] = useState(() => `master-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const [sentRequestResults, setSentRequestResults] = useState<Map<string, { routingType: string; routingReason: string; manusTaskUrl?: string }>>(new Map());
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  // 완료 감지: 마지막으로 Manus에 전송된 devRequest ID 추적
  const [lastSentDevRequestId, setLastSentDevRequestId] = useState<number | null>(null);
  const [lastSentManusTaskId, setLastSentManusTaskId] = useState<string | null>(null);
  // 태스크 선택 다이얼로그 상태
  const [taskSelectOpen, setTaskSelectOpen] = useState(false);
  const [pendingDevRequest, setPendingDevRequest] = useState<{ msgId: string; suggestion: DevRequestSuggestion } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 파이프라인 상태 조회
  const [pipelineStatus, setPipelineStatus] = useState<{
    connected: boolean;
    taskId?: string;
    recentCount?: number;
  }>({ connected: false });

  useEffect(() => {
    fetch('/api/scheduled/pipeline-status', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setPipelineStatus({
            connected: data.stats.manusConnected,
            taskId: data.stats.currentTaskId,
            recentCount: data.stats.total,
          });
        }
      })
      .catch(() => {});
  }, []);

  const autoSendMutation = trpc.devRequest.autoRegisterAndSend.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        const routeLabel = data.routingType === "send_message"
          ? `기존 스레드에 추가 (절약 모드)`
          : `신규 태스크 생성`;
        toast.success(`✅ Manus 전송 완료 (ID: ${data.devRequestId}) — ${routeLabel}`);
        // 마지막 전송 devRequest ID 추적 (완료 감지용)
        if (data.devRequestId) setLastSentDevRequestId(data.devRequestId);
        if (data.manusTaskId) setLastSentManusTaskId(data.manusTaskId);
      } else {
        toast.warning(`📋 개발 요청 등록 완료 (ID: ${data.devRequestId}) — Manus 연결 설정 필요`);
      }
    },
    onError: (err) => {
      toast.error(`❌ 전송 실패: ${err.message}`);
    },
  });

  // 완료 키워드 감지 mutation (AI 응답에서 자동 호출)
  const detectCompleteMutation = trpc.devRequest.detectAndCompleteFromResponse.useMutation({
    onSuccess: (data) => {
      if (data.detected && data.updatedCount > 0) {
        toast.success(`✅ 개발 요청 ${data.updatedCount}건이 자동으로 완료 처리되었습니다.`, { duration: 4000 });
      }
    },
  });

  // 스크롤 하단 이동
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // 스크롤 위치 감지
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 120);
  }, []);

  // 새 메시지 추가 시 자동 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // 스트리밍 중 자동 스크롤
  const streamingAutoScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 200) scrollToBottom(false);
  }, [scrollToBottom]);

  // 메시지 전송 (SSE 스트리밍)
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
      phase: "thinking",
      toolExecutions: [],
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsStreaming(true);

    // 히스토리 구성 (최근 20턴)
    const history = messages.slice(-20).map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/master-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text.trim(), sessionId, history }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false, phase: "done", error: err.error ?? "응답 실패", content: `❌ ${err.error ?? "서버 오류"}` }
              : m
          )
        );
        setIsStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (eventType === "tool_start") {
                // Tool 실행 시작 → phase를 querying으로 변경
                const newTool: ToolExecution = {
                  id: data.id,
                  name: data.name,
                  status: "running",
                  startedAt: Date.now(),
                };
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, phase: "querying", toolExecutions: [...(m.toolExecutions ?? []), newTool] }
                      : m
                  )
                );
                streamingAutoScroll();

              } else if (eventType === "tool_done") {
                // Tool 실행 완료
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    const updatedTools = (m.toolExecutions ?? []).map((t) =>
                      t.id === data.id
                        ? { ...t, status: data.success ? "done" : "error" as "done" | "error", queryTime: data.queryTime, error: data.error }
                        : t
                    );
                    return { ...m, phase: "analyzing", toolExecutions: updatedTools };
                  })
                );

              } else if (eventType === "chunk" && data.text !== undefined) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, phase: "done", content: m.content + data.text } : m
                  )
                );
                streamingAutoScroll();

              } else if (eventType === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          streaming: false,
                          phase: "done",
                          model: data.model,
                          tokensIn: data.tokensIn,
                          tokensOut: data.tokensOut,
                          costUsd: data.costUsd,
                          durationMs: data.durationMs,
                          devRequestSuggestion: data.devRequestSuggestion ?? null,
                        }
                      : m
                  )
                );
                // 완료 키워드 자동 감지: 이 대화에서 Manus에 전송한 요청이 있으면 자동 완료 체크
                if ((lastSentDevRequestId || lastSentManusTaskId) && data.fullText) {
                  detectCompleteMutation.mutate({
                    devRequestId: lastSentDevRequestId ?? undefined,
                    responseText: data.fullText,
                    manusTaskId: lastSentManusTaskId ?? undefined,
                  });
                }

              } else if (eventType === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, streaming: false, phase: "done", error: data.message, content: m.content || `❌ ${data.message}` }
                      : m
                  )
                );
              }
            } catch { /* JSON 파싱 실패 무시 */ }
            eventType = "";
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false, phase: "done", error: "연결 오류", content: m.content || "❌ 연결이 끊어졌습니다. 다시 시도해주세요." }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      textareaRef.current?.focus();
    }
  }, [isStreaming, messages, sessionId, streamingAutoScroll]);

  // 개발 요청 전송 (태스크 선택 다이얼로그 열기)
  const handleSendDevRequest = useCallback(
    (msgId: string, suggestion: DevRequestSuggestion) => {
      // 태스크 선택 다이얼로그를 먼저 열고 사용자가 선택 후 전송
      setPendingDevRequest({ msgId, suggestion });
      setTaskSelectOpen(true);
    },
    []
  );

  // 태스크 선택 후 실제 전송 실행
  const handleTaskConfirm = useCallback(
    async (selectedTaskId: string | null, forceNew: boolean) => {
      if (!pendingDevRequest) return;
      const { msgId, suggestion } = pendingDevRequest;
      setSendingRequests((prev) => new Set(prev).add(msgId));
      try {
        const result = await autoSendMutation.mutateAsync({
          title: suggestion.title,
          description: suggestion.description,
          priority: suggestion.priority,
          module: suggestion.module,
          estimatedHours: suggestion.estimatedHours,
          selectedTaskId: selectedTaskId ?? undefined,
          forceNewTask: forceNew,
        });
        setSentRequests((prev) => new Set(prev).add(msgId));
        if (result.routingType) {
          setSentRequestResults((prev) => {
            const next = new Map(prev);
            next.set(msgId, {
              routingType: result.routingType as string,
              routingReason: result.routingReason ?? "",
              manusTaskUrl: result.manusTaskUrl ?? "",
            });
            return next;
          });
        }
      } finally {
        setSendingRequests((prev) => {
          const next = new Set(prev);
          next.delete(msgId);
          return next;
        });
        setPendingDevRequest(null);
      }
    },
    [pendingDevRequest, autoSendMutation]
  );

  // 키보드 단축키 (Enter 전송, Shift+Enter 줄바꿈)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh)] max-w-4xl mx-auto relative">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-tight">두골프 마스터 🤖</h1>
            <p className="text-xs text-gray-500">추론 · DB조회 · 분석 · 결과도출 · Manus 개발 요청</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs text-indigo-600 border-indigo-200 bg-indigo-50">
            Gemini 2.5 Pro
          </Badge>
          <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50 hidden sm:flex items-center gap-1">
            <Database size={9} />
            DB 직접 접근
          </Badge>
          <Badge
            variant="outline"
            className={`text-xs hidden sm:flex items-center gap-1 ${
              pipelineStatus.connected
                ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
                : 'text-gray-400 border-gray-200 bg-gray-50'
            }`}
            title={pipelineStatus.taskId ? `태스크 ID: ${pipelineStatus.taskId}` : '파이프라인 미연결'}
          >
            <Activity size={9} />
            {pipelineStatus.connected ? '파이프라인 연결됨' : '파이프라인 미연결'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMessages([])}
            className="text-xs h-7 px-2"
            disabled={isStreaming}
          >
            <RefreshCw size={11} className="mr-1" />
            초기화
          </Button>
          {isStreaming && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => abortRef.current?.abort()}
              className="text-xs h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              중단
            </Button>
          )}
        </div>
      </div>

      {/* 빠른 명령 버튼 (메시지 없을 때만) */}
      {messages.length === 0 && (
        <div className="px-4 py-4 border-b bg-gray-50 shrink-0">
          <p className="text-xs text-gray-500 mb-2 font-medium">빠른 명령</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd.label}
                onClick={() => sendMessage(cmd.message)}
                disabled={isStreaming}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-50"
              >
                {cmd.icon}
                {cmd.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 메시지 영역 — 네이티브 div 스크롤 */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#d1d5db transparent" }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-16">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
              <Bot size={28} className="text-indigo-500" />
            </div>
            <p className="text-lg font-semibold text-gray-600 mb-1">두골프 마스터에게 물어보세요</p>
            <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
              ERP 데이터 직접 조회 · 정산 분석 · 개발 요청 자동화<br />
              <span className="text-xs text-indigo-400 font-medium">추론 → DB조회 → 분석 → 결과도출 → Manus 전송</span>
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2 text-xs text-gray-400 max-w-xs">
              {[
                { icon: <Database size={11} />, text: "DB 직접 접근 (10개 도구)" },
                { icon: <Zap size={11} />, text: "개발 요청 자동 감지" },
                { icon: <AlertCircle size={11} />, text: "사실 기반 응답만 허용" },
                { icon: <Activity size={11} />, text: "AI 비용 실시간 추적" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1.5">
                  <span className="text-indigo-400">{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {/* 아바타 */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                msg.role === "user"
                  ? "bg-indigo-600"
                  : "bg-gradient-to-br from-purple-500 to-indigo-600"
              }`}
            >
              {msg.role === "user" ? (
                <User size={14} className="text-white" />
              ) : (
                <Bot size={14} className="text-white" />
              )}
            </div>

            {/* 메시지 버블 */}
            <div className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} max-w-[82%] min-w-0`}>
              {/* 추론 단계 표시 */}
              {msg.role === "assistant" && msg.streaming && (
                <div className="mb-1">
                  <PhaseIndicator phase={msg.phase} />
                </div>
              )}

              {/* Tool 실행 패널 */}
              {msg.role === "assistant" && msg.toolExecutions && msg.toolExecutions.length > 0 && (
                <div className="w-full mb-1">
                  <ToolExecutionPanel tools={msg.toolExecutions} />
                </div>
              )}

              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed w-full ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-sm"
                    : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <>
                    {msg.content ? (
                      <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    ) : msg.streaming ? (
                      <span className="text-gray-400 italic text-xs">
                        {msg.phase === "thinking" && "추론 중..."}
                        {msg.phase === "querying" && "DB 조회 중..."}
                        {msg.phase === "analyzing" && "분석 중..."}
                        {!msg.phase && "응답 생성 중..."}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">응답 없음</span>
                    )}
                    {msg.streaming && msg.content && (
                      <span className="inline-flex items-center gap-0.5 ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    )}
                    {msg.error && (
                      <div className="flex items-center gap-1.5 mt-2 text-red-500 text-xs">
                        <AlertCircle size={12} />
                        {msg.error}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>

              {/* 메타 정보 */}
              {msg.role === "assistant" && !msg.streaming && msg.model && (
                <div className="flex items-center gap-2 mt-1 px-1 flex-wrap">
                  <span className="text-[10px] text-gray-400 font-mono flex items-center gap-0.5">
                    <Cpu size={9} />
                    {msg.model.split("/").pop()}
                  </span>
                  {msg.tokensOut && (
                    <span className="text-[10px] text-gray-400 font-mono">
                      {msg.tokensIn?.toLocaleString()}↑ {msg.tokensOut?.toLocaleString()}↓
                    </span>
                  )}
                  {msg.costUsd !== undefined && (
                    <span className="text-[10px] text-gray-400 font-mono">${msg.costUsd.toFixed(4)}</span>
                  )}
                  {msg.durationMs && (
                    <span className="text-[10px] text-gray-400 font-mono">{(msg.durationMs / 1000).toFixed(1)}s</span>
                  )}
                  {msg.toolExecutions && msg.toolExecutions.length > 0 && (
                    <span className="text-[10px] text-blue-400 font-mono flex items-center gap-0.5">
                      <Database size={9} />
                      {msg.toolExecutions.length}개 도구 사용
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">
                    {msg.timestamp.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}

              {/* 개발 요청 카드 */}
              {msg.role === "assistant" && !msg.streaming && msg.devRequestSuggestion && (
                <DevRequestCard
                  suggestion={msg.devRequestSuggestion}
                  onSend={() => handleSendDevRequest(msg.id, msg.devRequestSuggestion!)}
                  isSending={sendingRequests.has(msg.id)}
                  sent={sentRequests.has(msg.id)}
                  routingType={sentRequestResults.get(msg.id)?.routingType as "create_task" | "send_message" | null}
                  routingReason={sentRequestResults.get(msg.id)?.routingReason}
                  manusTaskUrl={sentRequestResults.get(msg.id)?.manusTaskUrl}
                />
              )}
            </div>
          </div>
        ))}

        {/* 스크롤 앵커 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 하단 스크롤 버튼 */}
      {showScrollBtn && (
        <div className="absolute bottom-24 right-6 z-10">
          <Button
            size="sm"
            variant="outline"
            onClick={() => scrollToBottom()}
            className="rounded-full shadow-md h-8 w-8 p-0 bg-white"
          >
            <ChevronDown size={16} />
          </Button>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="px-4 py-3 border-t bg-white shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="두골프 마스터에게 질문하세요... (Enter 전송, Shift+Enter 줄바꿈)"
            className="flex-1 min-h-[44px] max-h-40 resize-none text-sm border-gray-200 focus:border-indigo-400 rounded-xl"
            disabled={isStreaming}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-[44px] px-4 rounded-xl shrink-0"
          >
            {isStreaming ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1 justify-center">
          <Database size={9} />
          사실 기반 응답 전용 · ERP DB 직접 접근 · 최근 20턴 컨텍스트 · 세션: {sessionId.slice(0, 12)}...
        </p>
      </div>

      {/* 태스크 선택 다이얼로그 */}
      <TaskSelectDialog
        open={taskSelectOpen}
        onClose={() => {
          setTaskSelectOpen(false);
          setPendingDevRequest(null);
        }}
        onConfirm={handleTaskConfirm}
        suggestion={pendingDevRequest?.suggestion ?? null}
      />
    </div>
  );
}
