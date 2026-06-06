/**
 * 두골프 마스터 AI 채팅 페이지 (v4)
 * - SSE 스트리밍 실시간 응답
 * - Tool Calling 시각화 (DB 조회 과정 표시)
 * - 추론 → 분석 → 결과도출 → Manus 전송 파이프라인
 * - 사실 기반 응답 강제 (생성형 대화 차단)
 * - 개발 요청 자동 감지 → Manus 전송 UI
 * - 우측 슬라이드 패널 (개발현황/AI엔진/연동서비스)
 * - 파일/이미지 첨부 기능
 * - 입력창 아이콘 툴바
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Loader2, Bot, User, Zap, AlertCircle, CheckCircle2,
  ExternalLink, ChevronDown, RefreshCw, BarChart3, ClipboardList,
  DollarSign, Cpu, MessageSquare, Database, Search, Clock,
  TrendingUp, Package, AlertTriangle, Activity, Plus, GitBranch, Star,
  PanelRight, X, Paperclip, Image as ImageIcon, FileText, ChevronRight,
  GitCommit, Layers, Link2, CheckSquare, XCircle, Wifi, WifiOff,
  Bell, BellRing, Sparkles, History, ChevronLeft,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  previewUrl?: string;
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
  toolExecutions?: ToolExecution[];
  phase?: "thinking" | "querying" | "analyzing" | "done";
  attachments?: AttachedFile[];
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

  const { data: candidatesData, isLoading: candidatesLoading } = trpc.systemSettings.listTaskCandidates.useQuery(
    { activeOnly: true },
    { enabled: open }
  );

  const recommendMutation = trpc.systemSettings.analyzeAndRecommendTask.useMutation({
    onSuccess: (data) => {
      if (data.recommended) {
        setRecommendedTaskId(data.recommended.taskId);
        setRecommendReason(data.reason ?? "");
        setRecommendConfidence(data.confidence ?? 0);
        if (!selectedId) setSelectedId(data.recommended.taskId);
      }
      setIsAnalyzing(false);
    },
    onError: () => setIsAnalyzing(false),
  });

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

        {suggestion && (
          <div className="bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100">
            <p className="text-xs text-indigo-600 font-medium mb-0.5">전송할 개발 요청</p>
            <p className="text-sm font-semibold text-gray-800">{suggestion.title}</p>
            <p className="text-xs text-gray-500">{suggestion.module} · {suggestion.priority.toUpperCase()}</p>
          </div>
        )}

        {isAnalyzing && (
          <div className="flex items-center gap-2 text-indigo-600 text-sm py-2">
            <Loader2 size={14} className="animate-spin" />
            AI가 최적 태스크를 분석 중...
          </div>
        )}

        {!isAnalyzing && recommendedTaskId && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-xs font-medium text-amber-700 flex items-center gap-1 mb-0.5">
              <Star size={11} />
              AI 추천 ({Math.round(recommendConfidence * 100)}% 신뢰도)
            </p>
            <p className="text-xs text-amber-800">{recommendReason}</p>
          </div>
        )}

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

// ─── 도구 이름 한국어 매핑 ─────────────────────────────────────────────────────────────────
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
  get_bookings_summary: { label: "예약 현황 조회", icon: <ClipboardList size={11} /> },
  get_package_list: { label: "패키지 목록 조회", icon: <Package size={11} /> },
  get_settlement_summary: { label: "정산 현황 조회", icon: <BarChart3 size={11} /> },
  get_ai_cost_summary: { label: "AI 비용 요약", icon: <DollarSign size={11} /> },
  get_dev_requests: { label: "개발 요청 조회", icon: <Zap size={11} /> },
  get_error_logs: { label: "오류 로그 조회", icon: <AlertTriangle size={11} /> },
  get_customer_info: { label: "고객 정보 조회", icon: <User size={11} /> },
  get_inquiry_summary: { label: "문의 현황 조회", icon: <MessageSquare size={11} /> },
  get_ai_chat_logs: { label: "AI 대화 로그", icon: <Database size={11} /> },
  get_system_health: { label: "시스템 상태 조회", icon: <Activity size={11} /> },
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

const CATEGORY_COLORS: Record<string, string> = {
  BUG: "bg-red-100 text-red-700 border-red-200",
  FEATURE: "bg-blue-100 text-blue-700 border-blue-200",
  IMPROVEMENT: "bg-purple-100 text-purple-700 border-purple-200",
  REFACTOR: "bg-gray-100 text-gray-700 border-gray-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  BUG: "🐛 버그 수정",
  FEATURE: "✨ 신규 기능",
  IMPROVEMENT: "🔧 기능 개선",
  REFACTOR: "♻️ 리팩터링",
};

// ─── 개발 요청 카드 컴포넌트 ─────────────────────────────────────────────────
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

// ─── 우측 슬라이드 패널 ────────────────────────────────────────────────────────
function RightPanel({
  open,
  onClose,
  pipelineStatus,
}: {
  open: boolean;
  onClose: () => void;
  pipelineStatus: { connected: boolean; taskId?: string; recentCount?: number };
}) {
  // 개발 요청 목록 조회
  const { data: devRequestsData, isLoading: devLoading } = trpc.devRequest.list.useQuery(
    { limit: 10, offset: 0 },
    { enabled: open }
  );

  // AI 비용 요약
  const { data: costData } = trpc.aiAssistant.getCostSummary.useQuery(
    { period: "week" } as { period: "today" | "week" | "month" },
    { enabled: open }
  );

  const devItems = (devRequestsData as { rows?: unknown[] } | undefined)?.rows ?? [];

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  const STATUS_LABELS: Record<string, string> = {
    pending: "대기",
    in_progress: "진행중",
    completed: "완료",
    rejected: "반려",
  };

  // 연동 서비스 상태 (파이프라인 상태 기반)
  const services = [
    {
      name: "Manus API",
      status: pipelineStatus.connected,
      detail: pipelineStatus.connected ? (pipelineStatus.taskId ? `태스크: ${pipelineStatus.taskId.slice(0, 12)}...` : "API 키 연결됨") : "미연결",
      icon: <GitCommit size={13} />,
    },
    {
      name: "ERP DB",
      status: true,
      detail: "MySQL 연결됨",
      icon: <Database size={13} />,
    },
    {
      name: "OpenRouter AI",
      status: true,
      detail: "Gemini 2.5 Pro",
      icon: <Cpu size={13} />,
    },
    {
      name: "Slack 알림",
      status: false,
      detail: "Webhook 미설정",
      icon: <MessageSquare size={13} />,
    },
  ];

  return (
    <div
      className={`fixed top-0 right-0 h-full w-[85vw] sm:w-80 bg-white border-l shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ maxWidth: "320px" }}
    >
      {/* 패널 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-indigo-50 to-purple-50 shrink-0">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-indigo-600" />
          <span className="font-semibold text-sm text-gray-800">마스터 대시보드</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <X size={14} className="text-gray-500" />
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <Tabs defaultValue="dev" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-3 mt-3 shrink-0 grid grid-cols-4 h-8">
            <TabsTrigger value="dev" className="text-xs">개발</TabsTrigger>
            <TabsTrigger value="engine" className="text-xs">AI엔진</TabsTrigger>
            <TabsTrigger value="services" className="text-xs">연동</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">대화이력</TabsTrigger>
          </TabsList>

          {/* 개발현황 탭 */}
          <TabsContent value="dev" className="flex-1 overflow-y-auto px-3 pb-3 mt-2 space-y-3" style={{ minHeight: 0 }}>
            {/* 파이프라인 상태 */}
            <div className={`rounded-xl p-3 border ${pipelineStatus.connected ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
              <div className="flex items-center gap-2 mb-1">
                {pipelineStatus.connected ? (
                  <Wifi size={13} className="text-emerald-600" />
                ) : (
                  <WifiOff size={13} className="text-gray-400" />
                )}
                <span className={`text-xs font-semibold ${pipelineStatus.connected ? "text-emerald-700" : "text-gray-500"}`}>
                  {pipelineStatus.connected ? "두골프마스터 파이프라인 연결됨" : "파이프라인 미연결"}
                </span>
              </div>
              {pipelineStatus.recentCount !== undefined && (
                <p className="text-xs text-gray-500">최근 전송 요청: {pipelineStatus.recentCount}건</p>
              )}
              {pipelineStatus.taskId && (
                <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">태스크: {pipelineStatus.taskId}</p>
              )}
            </div>

            {/* 개발 요청 목록 */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                <Zap size={11} className="text-indigo-500" />
                최근 개발 요청
              </p>
              {devLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-xs py-2">
                  <Loader2 size={11} className="animate-spin" />
                  로딩 중...
                </div>
              ) : (devItems as Array<{ id: number; title: string; status: string; priority: string; module: string }>).length === 0 ? (
                <p className="text-xs text-gray-400 py-2">개발 요청이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {(devItems as Array<{ id: number; title: string; status: string; priority: string; module: string }>).map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <p className="text-xs font-medium text-gray-800 leading-tight line-clamp-2">{item.title}</p>
                        <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[item.status] ?? item.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-gray-400">{item.module} · {item.priority?.toUpperCase()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* AI 엔진 탭 */}
          <TabsContent value="engine" className="flex-1 overflow-y-auto px-3 pb-3 mt-2 space-y-3" style={{ minHeight: 0 }}>
            {/* 모델 현황 */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                <Cpu size={11} className="text-purple-500" />
                AI 모델 라우팅
              </p>
              <div className="space-y-1.5">
                {[
                  { label: "복잡 분석", model: "Gemini 2.5 Pro", color: "text-purple-600", badge: "HIGH" },
                  { label: "일반 질의", model: "Gemini 2.5 Flash", color: "text-blue-600", badge: "MED" },
                  { label: "단순 조회", model: "Gemini 2.0 Flash Lite", color: "text-green-600", badge: "LOW" },
                ].map((m) => (
                  <div key={m.badge} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    <div>
                      <p className="text-xs font-medium text-gray-700">{m.label}</p>
                      <p className={`text-[10px] ${m.color}`}>{m.model}</p>
                    </div>
                    <Badge className="text-[10px] bg-gray-100 text-gray-600 border border-gray-200 px-1.5">{m.badge}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* AI 비용 요약 */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                <DollarSign size={11} className="text-amber-500" />
                이번 주 AI 비용
              </p>
              {costData ? (
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                  <p className="text-lg font-bold text-amber-700">
                    ${(costData as { totalCost?: number }).totalCost?.toFixed(4) ?? "0.0000"}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    총 {(costData as { totalMessages?: number }).totalMessages ?? 0}건 대화
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
                  <p className="text-xs text-gray-400">비용 데이터 없음</p>
                </div>
              )}
            </div>

            {/* 오케스트레이터 구조 */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                <Layers size={11} className="text-indigo-500" />
                AI 오케스트레이터 구조
              </p>
              <div className="space-y-1">
                {[
                  { name: "두골프 마스터", role: "관리자 전용 · 전체 DB", active: true },
                  { name: "골프톡", role: "고객 상담 · 프로젝트별", active: false },
                  { name: "두골프 매니저", role: "파트너 관리 · 프로젝트별", active: false },
                ].map((ai) => (
                  <div key={ai.name} className={`flex items-center justify-between rounded-lg px-3 py-2 border text-xs ${
                    ai.active ? "bg-indigo-50 border-indigo-200" : "bg-gray-50 border-gray-100"
                  }`}>
                    <div>
                      <p className={`font-medium ${ai.active ? "text-indigo-700" : "text-gray-600"}`}>{ai.name}</p>
                      <p className="text-[10px] text-gray-400">{ai.role}</p>
                    </div>
                    {ai.active && (
                      <Badge className="text-[10px] bg-indigo-100 text-indigo-600 border-indigo-200 border px-1.5">현재</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* 연동 서비스 탭 */}
          <TabsContent value="services" className="flex-1 overflow-y-auto px-3 pb-3 mt-2 space-y-3" style={{ minHeight: 0 }}>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                <Link2 size={11} className="text-blue-500" />
                연동 서비스 상태
              </p>
              <div className="space-y-2">
                {services.map((svc) => (
                  <div key={svc.name} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
                    svc.status ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                  }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      svc.status ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                    }`}>
                      {svc.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800">{svc.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{svc.detail}</p>
                    </div>
                    {svc.status ? (
                      <CheckSquare size={14} className="text-green-500 shrink-0" />
                    ) : (
                      <XCircle size={14} className="text-gray-300 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 권장 추가 연동 */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                <TrendingUp size={11} className="text-orange-500" />
                비용 절감 권장 연동
              </p>
              <div className="space-y-1.5">
                {[
                  { name: "벡터 DB (RAG)", benefit: "토큰 소모 40% 절감", priority: "🟠 높음" },
                  { name: "n8n 자동화", benefit: "Manus 호출 빈도 감소", priority: "🟠 높음" },
                ].map((item) => (
                  <div key={item.name} className="bg-orange-50 rounded-lg px-3 py-2 border border-orange-100">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-semibold text-orange-800">{item.name}</p>
                      <span className="text-[10px]">{item.priority}</span>
                    </div>
                    <p className="text-[10px] text-orange-600">{item.benefit}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* 대화이력 탭 (300012) */}
          <ChatHistoryTab open={open} />

        </Tabs>
      </div>
    </div>
  );
}

// ─── 대화 이력 탭 컴포넌트 (300012) ────────────────────────────────────────────────────────────────────────────────
function ChatHistoryTab({ open }: { open: boolean }) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  // 세션 목록 조회
  const { data: sessionsData, isLoading: sessionsLoading } = trpc.chat.listMasterSessions.useQuery(
    { limit: LIMIT, offset: page * LIMIT },
    { enabled: open }
  );

  // 선택된 세션 메시지 조회
  const { data: msgData, isLoading: msgLoading } = trpc.chat.getMasterSessionMessages.useQuery(
    { sessionId: selectedSessionId! },
    { enabled: !!selectedSessionId }
  );

  const sessions = sessionsData?.sessions ?? [];
  const messages = msgData?.messages ?? [];
  const total = sessionsData?.total ?? 0;

  const formatTime = (d: Date | string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return '방금';
    if (mins < 60) return `${mins}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <TabsContent value="history" className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
      {selectedSessionId ? (
        // 대화 메시지 뷰
        <div className="flex flex-col flex-1 min-h-0">
          {/* 뒤로가기 헤더 */}
          <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0 bg-gray-50">
            <button
              onClick={() => setSelectedSessionId(null)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft size={14} className="text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 truncate">대화 이어가기</p>
              <p className="text-[10px] text-gray-400 font-mono truncate">{selectedSessionId.slice(0, 20)}...</p>
            </div>
          </div>
          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2" style={{ minHeight: 0 }}>
            {msgLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 size={16} className="animate-spin mr-2" />
                <span className="text-xs">로딩 중...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <History size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs">메시지가 없습니다.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg px-3 py-2 text-xs ${
                    msg.role === 'user'
                      ? 'bg-indigo-50 border border-indigo-100 ml-4'
                      : 'bg-gray-50 border border-gray-100 mr-4'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`font-semibold ${
                      msg.role === 'user' ? 'text-indigo-600' : 'text-gray-600'
                    }`}>
                      {msg.role === 'user' ? '나' : '두골프마스터'}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
                  </div>
                  <p className="text-gray-700 leading-relaxed line-clamp-6 whitespace-pre-wrap">{msg.content}</p>
                  {msg.costUsd && Number(msg.costUsd) > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">${Number(msg.costUsd).toFixed(6)}</p>
                  )}
                </div>
              ))
            )}
          </div>
          {/* 이어가기 버튼 */}
          <div className="px-3 py-2 border-t shrink-0">
            <p className="text-[10px] text-gray-400 text-center">이어가기: 아래 채팅창에서 세션 ID를 사용하세요</p>
            <p className="text-[10px] text-indigo-500 text-center font-mono mt-0.5 truncate">{selectedSessionId}</p>
          </div>
        </div>
      ) : (
        // 세션 목록 뷰
        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-3 pt-2 pb-1 shrink-0">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
              <History size={11} className="text-indigo-500" />
              마스터 AI 대화 이력
              {total > 0 && <span className="text-[10px] text-gray-400">({total}건)</span>}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2" style={{ minHeight: 0 }}>
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 size={16} className="animate-spin mr-2" />
                <span className="text-xs">로딩 중...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <History size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">대화 이력이 없습니다.</p>
                <p className="text-[10px] mt-1">두골프 마스터와 대화를 시작하세요.</p>
              </div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.sessionId}
                  onClick={() => setSelectedSessionId(session.sessionId)}
                  className="w-full text-left rounded-xl border border-gray-100 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 px-3 py-2.5 transition-all group"
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <p className="text-xs font-medium text-gray-800 leading-tight line-clamp-2 group-hover:text-indigo-700">
                      {session.title}
                    </p>
                    <ChevronRight size={12} className="text-gray-300 group-hover:text-indigo-400 shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">{formatTime(session.lastMessageAt)}</span>
                    <span className="text-[10px] text-gray-300">·</span>
                    <span className="text-[10px] text-gray-400">{session.messageCount}개 메시지</span>
                  </div>
                </button>
              ))
            )}
          </div>
          {/* 페이지네이션 */}
          {total > LIMIT && (
            <div className="flex items-center justify-between px-3 py-2 border-t shrink-0">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-xs text-gray-500 disabled:opacity-30 hover:text-indigo-600 transition-colors"
              >
                ← 이전
              </button>
              <span className="text-[10px] text-gray-400">{page + 1} / {Math.ceil(total / LIMIT)}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * LIMIT >= total}
                className="text-xs text-gray-500 disabled:opacity-30 hover:text-indigo-600 transition-colors"
              >
                다음 →
              </button>
            </div>
          )}
        </div>
      )}
    </TabsContent>
  );
}

// ─── 첨부 파일 미리보기 컴포넌트 ──────────────────────────────────────────────
function AttachmentPreview({ files, onRemove }: { files: AttachedFile[]; onRemove: (id: string) => void }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 px-4 pt-2">
      {files.map((file) => (
        <div key={file.id} className="relative group">
          {file.type.startsWith("image/") && file.previewUrl ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
              <img src={file.previewUrl} alt={file.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1">
              <FileText size={18} className="text-gray-400" />
              <span className="text-[9px] text-gray-400 truncate w-full text-center px-1">{file.name.slice(0, 8)}</span>
            </div>
          )}
          <button
            onClick={() => onRemove(file.id)}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={9} />
          </button>
          <p className="text-[9px] text-gray-400 text-center mt-0.5 truncate w-16">
            {(file.size / 1024).toFixed(0)}KB
          </p>
        </div>
      ))}
    </div>
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
  const [lastSentDevRequestId, setLastSentDevRequestId] = useState<number | null>(null);
  const [lastSentManusTaskId, setLastSentManusTaskId] = useState<string | null>(null);
  const [taskSelectOpen, setTaskSelectOpen] = useState(false);
  const [pendingDevRequest, setPendingDevRequest] = useState<{ msgId: string; suggestion: DevRequestSuggestion } | null>(null);
  // 우측 패널 상태
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  // 첨부 파일 상태
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ─── AI 능동적 알림 상태 ────────────────────────────────────────────────────
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [lastPollTime, setLastPollTime] = useState(() => new Date());
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // 30초마다 새 알림 폴링
  const { data: pollData, refetch: refetchNotifs } = trpc.aiNotifications.pollNew.useQuery(
    { since: lastPollTime },
    {
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      staleTime: 25_000,
    }
  );

  // 새 알림 수신 시 채팅창에 인라인 메시지 삽입
  useEffect(() => {
    if (!pollData?.hasNew || !pollData.notifications.length) return;
    const newNotifs = pollData.notifications;
    // 미읽음 카운트 업데이트
    setUnreadNotifCount(prev => prev + newNotifs.length);
    // 채팅창에 알림 메시지 삽입
    newNotifs.forEach((notif) => {
      const notifMsg: Message = {
        id: `notif-${notif.id}-${Date.now()}`,
        role: "assistant",
        content: `🔔 **${notif.title}**\n\n${notif.body}${
          notif.actionUrl && notif.actionLabel
            ? `\n\n👉 [${notif.actionLabel}](${notif.actionUrl})`
            : ""
        }`,
        timestamp: new Date(notif.createdAt),
        phase: "done",
      };
      setMessages(prev => [...prev, notifMsg]);
    });
    // 폴링 기준 시각 갱신
    setLastPollTime(new Date());
  }, [pollData]);

  // 알림 패널 열기 시 읽음 처리
  const markAllReadMutation = trpc.aiNotifications.markAllRead.useMutation({
    onSuccess: () => {
      setUnreadNotifCount(0);
      refetchNotifs();
    },
  });

  // 알림 목록 조회 (패널용)
  const { data: notifListData } = trpc.aiNotifications.list.useQuery(
    { limit: 20, onlyUnread: false },
    { enabled: showNotifPanel, staleTime: 10_000 }
  );

  // ─── 예약 작업 상태 ────────────────────────────────────────────────────
  const [showScheduledPanel, setShowScheduledPanel] = useState(false);
  const trpcUtils = trpc.useUtils();
  const { data: scheduledTasksData, refetch: refetchScheduledTasks } = trpc.scheduledTasks.list.useQuery(
    { status: 'all', limit: 30 },
    { enabled: showScheduledPanel, staleTime: 15_000 }
  );
  const cancelScheduledTaskMutation = trpc.scheduledTasks.cancel.useMutation({
    onSuccess: () => {
      toast.success('예약 작업이 취소되었습니다.');
      refetchScheduledTasks();
    },
    onError: (err) => toast.error(`취소 실패: ${err.message}`),
  });

  // ─── 실시간 이벤트 SSE 구독 (서버 → 클라이언트 즉시 반영) ─────────────────
  useEffect(() => {
    const es = new EventSource("/api/realtime-events");
    es.onopen = () => console.log("[MasterAI] SSE 연결됨");
    es.addEventListener("message", (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as { type: string; data: Record<string, unknown> };
        if (evt.type === "dev_request_created" || evt.type === "dev_request_updated" || evt.type === "dev_request_completed") {
          // 개발 요청 데이터 즉시 갱신
          trpcUtils.devRequest.list.invalidate().catch(() => {});
        }
        if (evt.type === "notification_created") {
          // 알림 즉시 갱신 (폴링 간격 단축 효과)
          setLastPollTime(new Date(Date.now() - 1000));
          trpcUtils.aiNotifications.list.invalidate().catch(() => {});
        }
        if (evt.type === "pipeline_done") {
          // 파이프라인 완료 시 개발 요청 + 예약 작업 갱신
          trpcUtils.devRequest.list.invalidate().catch(() => {});
          trpcUtils.scheduledTasks.list.invalidate().catch(() => {});
          const d = evt.data as { devRequestId?: number; success?: boolean };
          if (d.success) {
            toast.success(`개발 요청 #${d.devRequestId} Manus 전달 완료`);
          }
        }
        if (evt.type === "ai_log_created") {
          // AI 대화 로그 갱신
          trpcUtils.aiLogs.list.invalidate().catch(() => {});
        }
      } catch {
        // JSON 파싱 오류 무시
      }
    });
    es.onerror = () => {
      // 연결 오류 시 자동 재연결 (브라우저 기본 동작)
      console.warn("[MasterAI] SSE 연결 오류 - 재연결 시도 중");
    };
    return () => {
      es.close();
    };
  }, [trpcUtils]);
    // ─── 실시간 이벤트 SSE 구독 (서버 → 클라이언트 즉시 반영) ─────────────────
  useEffect(() => {
    const es = new EventSource("/api/realtime-events");
    es.onopen = () => console.log("[MasterAI] SSE 연결됨");
    es.addEventListener("message", (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as { type: string; data: Record<string, unknown> };
        if (evt.type === "dev_request_created" || evt.type === "dev_request_updated" || evt.type === "dev_request_completed") {
          // 개발 요청 데이터 즉시 갱신
          trpcUtils.devRequest.list.invalidate().catch(() => {});
        }
        if (evt.type === "notification_created") {
          // 알림 즉시 갱신 (폴링 간격 단축 효과)
          setLastPollTime(new Date(Date.now() - 1000));
          trpcUtils.aiNotifications.list.invalidate().catch(() => {});
        }
        if (evt.type === "pipeline_done") {
          // 파이프라인 완료 시 개발 요청 + 예약 작업 갱신
          trpcUtils.devRequest.list.invalidate().catch(() => {});
          trpcUtils.scheduledTasks.list.invalidate().catch(() => {});
          const d = evt.data as { devRequestId?: number; success?: boolean };
          if (d.success) {
            toast.success(`개발 요청 #${d.devRequestId} Manus 전달 완료`);
          }
        }
        if (evt.type === "ai_log_created") {
          // AI 대화 로그 갱신
          trpcUtils.aiLogs.list.invalidate().catch(() => {});
        }
      } catch {
        // JSON 파싱 오류 무시
      }
    });
    es.onerror = () => {
      // 연결 오류 시 자동 재연결 (브라우저 기본 동작)
      console.warn("[MasterAI] SSE 연결 오류 - 재연결 시도 중");
    };
    return () => {
      es.close();
    };
  }, [trpcUtils]);
    // ─── Human-in-the-Loop 승인 요청 상태 ──────────────────────────────────
  const [pendingApproval, setPendingApproval] = useState<{
    id: string;
    toolName: string;
    toolArgs: Record<string, unknown>;
    message: string;
  } | null>(null);

  // 파일 업로드 + 텍스트 추출 mutation
  const uploadFileMutation = trpc.fileAnalysis.uploadAndExtract.useMutation();
  const analyzeFileMutation = trpc.fileAnalysis.analyzeWithAI.useMutation();

  const autoSendMutation = trpc.devRequest.autoRegisterAndSend.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        const routeLabel = data.routingType === "send_message"
          ? `기존 스레드에 추가 (절약 모드)`
          : `신규 태스크 생성`;
        toast.success(`✅ Manus 전송 완료 (ID: ${data.devRequestId}) — ${routeLabel}`);
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

  const detectCompleteMutation = trpc.devRequest.detectAndCompleteFromResponse.useMutation({
    onSuccess: (data) => {
      if (data.detected && data.updatedCount > 0) {
        toast.success(`✅ 개발 요청 ${data.updatedCount}건이 자동으로 완료 처리되었습니다.`, { duration: 4000 });
      }
    },
  });

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 120);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const streamingAutoScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 200) scrollToBottom(false);
  }, [scrollToBottom]);

  // 파일 첨부 처리
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    Array.from(files).forEach((file) => {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: 파일 크기가 5MB를 초과합니다.`);
        return;
      }
      const id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setAttachedFiles((prev) => [
          ...prev,
          {
            id,
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl,
            previewUrl: file.type.startsWith("image/") ? dataUrl : undefined,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  // 메시지 전송 (SSE 스트리밍)
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    // 첨부 파일 스냅샷 (전송 전 복사)
    const filesToUpload = [...attachedFiles];

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
      attachments: filesToUpload.length > 0 ? filesToUpload : undefined,
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
    setAttachedFiles([]);
    setIsStreaming(true);

    const history = messages.slice(-20).map((m) => ({ role: m.role, content: m.content }));

    // ── 파일 업로드 + AI 분석 파이프라인 ──────────────────────────────────────
    let fileContextText = "";
    const fileContexts: Array<{ fileName: string; mimeType: string; extractedText: string; analysisResult?: string }> = [];
    if (filesToUpload.length > 0) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, phase: "querying" as const } : m
        )
      );
      for (const file of filesToUpload) {
        try {
          if (!file.dataUrl) continue;
          const base64Data = file.dataUrl.split(",")[1];
          if (!base64Data) continue;
          // 1) 업로드 + 텍스트 추출
          const uploadResult = await uploadFileMutation.mutateAsync({
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            base64Data,
            fileSize: file.size,
            sessionId,
          });
          if (uploadResult.extractStatus === "done" && uploadResult.id) {
            // 2) AI 분석 (질문과 함께)
            const analysisResult = await analyzeFileMutation.mutateAsync({
              fileId: uploadResult.id,
              question: text.trim() || "이 파일의 내용을 요약하고 분석해주세요.",
              history: history.slice(-6),
            });
            fileContextText += `\n\n---\n📎 **${file.name}** 분석 결과:\n${analysisResult.answer}`;
            // masterStream에 전달할 파일 컨텍스트 수집
            fileContexts.push({
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
              extractedText: (uploadResult as { extractedText?: string }).extractedText ?? "",
              analysisResult: analysisResult.answer,
            });
            // 분석 결과를 즉시 메시지에 표시
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + fileContextText, phase: "analyzing" as const }
                  : m
              )
            );
            // 파일 분석만으로 충분한 경우 스트리밍 종료
            if (!text.trim() || text.trim().length < 5) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, streaming: false, phase: "done" as const }
                    : m
                )
              );
              setIsStreaming(false);
              return;
            }
          } else if (uploadResult.extractStatus === "failed") {
            const errMsg = (uploadResult as { error?: string }).error ?? "알 수 없는 오류";
            fileContextText += `\n\n[파일 분석 실패: ${file.name} - ${errMsg}]`;
          }
        } catch (fileErr) {
          const errMsg = fileErr instanceof Error ? fileErr.message : String(fileErr);
          fileContextText += `\n\n[파일 처리 오류: ${file.name} - ${errMsg}]`;
        }
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, phase: "thinking" as const } : m
        )
      );
    }

    // ── SSE 스트리밍 (일반 텍스트 질문) ─────────────────────────────────────
    const messageWithFileContext = text.trim() + (fileContextText ? `\n\n[파일 분석 완료 - 추가 질문: ${text.trim()}]` : "");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/master-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: messageWithFileContext, sessionId, history, fileContexts }),
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
                if ((lastSentDevRequestId || lastSentManusTaskId) && data.fullText) {
                  detectCompleteMutation.mutate({
                    devRequestId: lastSentDevRequestId ?? undefined,
                    responseText: data.fullText,
                    manusTaskId: lastSentManusTaskId ?? undefined,
                  });
                }

              } else if (eventType === "approval_request") {
                // Human-in-the-Loop: 승인 요청 이벤트 수신
                setPendingApproval({
                  id: data.id || `approval-${Date.now()}`,
                  toolName: data.toolName || "",
                  toolArgs: data.toolArgs || {},
                  message: data.message || `'${data.toolName}' 도구 실행 승인이 필요합니다.`,
                });
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
  }, [isStreaming, messages, sessionId, streamingAutoScroll, attachedFiles, lastSentDevRequestId, lastSentManusTaskId, detectCompleteMutation, uploadFileMutation, analyzeFileMutation]);

  const handleSendDevRequest = useCallback(
    (msgId: string, suggestion: DevRequestSuggestion) => {
      setPendingDevRequest({ msgId, suggestion });
      setTaskSelectOpen(true);
    },
    []
  );

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex h-[calc(100vh)] relative">
      {/* 메인 채팅 영역 */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${rightPanelOpen ? "sm:mr-80" : ""}`}>
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
            <Badge variant="outline" className="text-xs text-indigo-600 border-indigo-200 bg-indigo-50 hidden sm:flex">
              Gemini 2.5 Pro
            </Badge>
            <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50 hidden md:flex items-center gap-1">
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
              {pipelineStatus.connected ? '연결됨' : '미연결'}
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
            {/* AI 알림 버튼 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowNotifPanel(!showNotifPanel);
                if (!showNotifPanel && unreadNotifCount > 0) {
                  markAllReadMutation.mutate();
                }
              }}
              className={`text-xs h-7 px-2 relative ${
                unreadNotifCount > 0
                  ? 'text-amber-600 border-amber-300 bg-amber-50 hover:bg-amber-100'
                  : ''
              }`}
              title="AI 알림"
            >
              {unreadNotifCount > 0 ? <BellRing size={13} className="animate-pulse" /> : <Bell size={13} />}
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </Button>
            {/* 예약 작업 버튼 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowScheduledPanel(!showScheduledPanel);
                if (!showScheduledPanel) refetchScheduledTasks();
              }}
              className={`text-xs h-7 px-2 relative ${
                showScheduledPanel ? 'text-indigo-600 border-indigo-300 bg-indigo-50' : ''
              }`}
              title="예약 작업 목록"
            >
              <Clock size={13} />
              {(scheduledTasksData?.tasks?.filter(t => t.status === 'pending').length ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {scheduledTasksData!.tasks.filter(t => t.status === 'pending').length}
                </span>
              )}
            </Button>
            {/* 우측 패널 토글 버튼 */}
            <Button
              variant={rightPanelOpen ? "default" : "outline"}
              size="sm"
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className={`text-xs h-7 px-2 ${rightPanelOpen ? "bg-indigo-600 text-white" : ""}`}
              title="마스터 대시보드 패널"
            >
              <PanelRight size={13} />
            </Button>
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

        {/* 메시지 영역 */}
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
              {/* 우측 패널 안내 */}
              <button
                onClick={() => setRightPanelOpen(true)}
                className="mt-4 flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                <PanelRight size={12} />
                마스터 대시보드 열기 (개발현황 · AI엔진 · 연동서비스)
                <ChevronRight size={12} />
              </button>
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

                {/* 첨부 파일 미리보기 (유저 메시지) */}
                {msg.role === "user" && msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2 justify-end">
                    {msg.attachments.map((att) => (
                      <div key={att.id} className="w-14 h-14 rounded-lg overflow-hidden border border-indigo-200 bg-indigo-50">
                        {att.type.startsWith("image/") && att.previewUrl ? (
                          <img src={att.previewUrl} alt={att.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                            <FileText size={16} className="text-indigo-400" />
                            <span className="text-[8px] text-indigo-400 truncate w-full text-center px-1">{att.name.slice(0, 6)}</span>
                          </div>
                        )}
                      </div>
                    ))}
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

        {/* 첨부 파일 미리보기 */}
        <AttachmentPreview files={attachedFiles} onRemove={removeFile} />

        {/* 입력 영역 */}
        <div className="px-4 py-3 border-t bg-white shrink-0">
          {/* 아이콘 툴바 */}
          <div className="flex items-center gap-1 mb-2">
            {/* 파일 첨부 */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.csv,.xlsx,.docx"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
              title="파일 첨부"
            >
              <Paperclip size={13} />
              <span className="hidden sm:inline">파일</span>
            </button>
            {/* 이미지 첨부 */}
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "image/*";
                  fileInputRef.current.click();
                  setTimeout(() => {
                    if (fileInputRef.current) fileInputRef.current.accept = "image/*,.pdf,.txt,.md,.csv,.xlsx,.docx";
                  }, 500);
                }
              }}
              disabled={isStreaming}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
              title="이미지 첨부"
            >
              <ImageIcon size={13} />
              <span className="hidden sm:inline">이미지</span>
            </button>

            <div className="w-px h-4 bg-gray-200 mx-1" />

            {/* 빠른 명령 드롭다운 */}
            <div className="relative group">
              <button
                disabled={isStreaming}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                title="빠른 명령"
              >
                <Zap size={13} />
                <span className="hidden sm:inline">빠른 명령</span>
                <ChevronDown size={10} />
              </button>
              <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                {QUICK_COMMANDS.map((cmd) => (
                  <button
                    key={cmd.label}
                    onClick={() => sendMessage(cmd.message)}
                    disabled={isStreaming}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                  >
                    {cmd.icon}
                    {cmd.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 대시보드 패널 열기 */}
            <button
              onClick={() => setRightPanelOpen(true)}
              disabled={rightPanelOpen}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 ml-auto"
              title="마스터 대시보드"
            >
              <PanelRight size={13} />
              <span className="hidden sm:inline">대시보드</span>
            </button>
          </div>

          {/* 텍스트 입력 */}
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachedFiles.length > 0
                ? `첨부 파일 ${attachedFiles.length}개 · 메시지를 입력하세요... (Enter 전송)`
                : "두골프 마스터에게 질문하세요... (Enter 전송, Shift+Enter 줄바꿈)"
              }
              className="flex-1 min-h-[44px] max-h-40 resize-none text-sm border-gray-200 focus:border-indigo-400 rounded-xl"
              disabled={isStreaming}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={(!input.trim() && attachedFiles.length === 0) || isStreaming}
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
      </div>

      {/* 우측 슬라이드 패널 */}
      <RightPanel
        open={rightPanelOpen}
        onClose={() => setRightPanelOpen(false)}
        pipelineStatus={pipelineStatus}
      />

      {/* 패널 오버레이 (모바일) */}
      {rightPanelOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setRightPanelOpen(false)}
        />
      )}

      {/* AI 알림 패널 */}
      {showNotifPanel && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-50 flex flex-col border-l">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-amber-50">
            <div className="flex items-center gap-2">
              <BellRing size={15} className="text-amber-600" />
              <h2 className="font-semibold text-sm text-gray-800">AI 알림</h2>
              {unreadNotifCount > 0 && (
                <Badge className="text-[10px] bg-red-500 text-white px-1.5 py-0">{unreadNotifCount}</Badge>
              )}
            </div>
            <button
              onClick={() => setShowNotifPanel(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!notifListData?.notifications.length ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                <Bell size={28} className="mb-2 opacity-30" />
                <p className="text-sm">알림이 없습니다</p>
                <p className="text-xs mt-1">개발 완료 시 자동으로 표시됩니다</p>
              </div>
            ) : (
              notifListData.notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`rounded-lg border p-3 text-xs transition-colors ${
                    !notif.isRead
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={11} className={!notif.isRead ? 'text-amber-500' : 'text-gray-400'} />
                      <span className="font-semibold text-gray-800 leading-tight">{notif.title}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {new Date(notif.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-line">{notif.body}</p>
                  {notif.actionUrl && notif.actionLabel && (
                    <a
                      href={notif.actionUrl}
                      className="inline-flex items-center gap-1 mt-2 text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      <ExternalLink size={10} />
                      {notif.actionLabel}
                    </a>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge
                      className={`text-[9px] px-1 py-0 ${
                        notif.type === 'dev_complete' ? 'bg-green-100 text-green-700' :
                        notif.type === 'deploy' ? 'bg-blue-100 text-blue-700' :
                        notif.type === 'feature' ? 'bg-purple-100 text-purple-700' :
                        notif.type === 'error' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {notif.type === 'dev_complete' ? '개발완료' :
                       notif.type === 'deploy' ? '배포' :
                       notif.type === 'feature' ? '신기능' :
                       notif.type === 'error' ? '오류' : '시스템'}
                    </Badge>
                    <Badge
                      className={`text-[9px] px-1 py-0 ${
                        notif.priority === 'critical' ? 'bg-red-100 text-red-700' :
                        notif.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        notif.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {notif.priority === 'critical' ? '최우선' :
                       notif.priority === 'high' ? '높음' :
                       notif.priority === 'medium' ? '중간' : '낙음'}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
          {(notifListData?.notifications.length ?? 0) > 0 && (
            <div className="px-3 py-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                {markAllReadMutation.isPending ? <Loader2 size={11} className="animate-spin mr-1" /> : <CheckSquare size={11} className="mr-1" />}
                모두 읽음 처리
              </Button>
            </div>
          )}
        </div>
      )}
      {showNotifPanel && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setShowNotifPanel(false)}
        />
      )}

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

      {/* 예약 작업 패널 */}
      {showScheduledPanel && (
        <div className="absolute top-14 right-2 z-50 w-80 bg-white rounded-xl shadow-xl border border-indigo-100 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 bg-indigo-50 border-b border-indigo-100">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-800">예약 작업</span>
              {(scheduledTasksData?.tasks?.filter(t => t.status === 'pending').length ?? 0) > 0 && (
                <Badge className="text-[10px] bg-indigo-500 text-white px-1.5 py-0">
                  대기 {scheduledTasksData!.tasks.filter(t => t.status === 'pending').length}
                </Badge>
              )}
            </div>
            <button onClick={() => setShowScheduledPanel(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!scheduledTasksData?.tasks?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Clock size={28} className="mb-2 opacity-30" />
                <p className="text-xs">예약된 작업이 없습니다</p>
                <p className="text-[10px] mt-1 text-gray-300">"무었을 언제 보고해줘" 라고 말해보세요</p>
              </div>
            ) : (
              scheduledTasksData.tasks.map((task) => {
                const scheduledDate = new Date(task.scheduledAt);
                const kstDate = new Date(scheduledDate.getTime() + 9 * 60 * 60 * 1000);
                const timeStr = kstDate.toLocaleString('ko-KR', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const statusColors: Record<string, string> = {
                  pending: 'bg-blue-100 text-blue-700',
                  running: 'bg-yellow-100 text-yellow-700',
                  completed: 'bg-green-100 text-green-700',
                  cancelled: 'bg-gray-100 text-gray-500',
                  failed: 'bg-red-100 text-red-700',
                };
                const statusLabels: Record<string, string> = {
                  pending: '대기',
                  running: '실행중',
                  completed: '완료',
                  cancelled: '취소',
                  failed: '실패',
                };
                return (
                  <div key={task.id} className="px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{task.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{timeStr} (KST)</p>
                        {task.result && (
                          <p className="text-[10px] text-green-600 mt-0.5 truncate">{task.result.slice(0, 60)}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge className={`text-[10px] px-1.5 py-0 ${statusColors[task.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {statusLabels[task.status] ?? task.status}
                        </Badge>
                        {task.status === 'pending' && (
                          <button
                            onClick={() => cancelScheduledTaskMutation.mutate({ id: task.id })}
                            className="text-[10px] text-red-400 hover:text-red-600"
                            disabled={cancelScheduledTaskMutation.isPending}
                          >
                            취소
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="px-3 py-2 border-t bg-gray-50">
            <p className="text-[10px] text-gray-400 text-center">"무었을 언제 보고해줘" 라고 말하면 AI가 자동 예약합니다</p>
          </div>
        </div>
      )}
      {/* Human-in-the-Loop 승인 다이얼로그 */}
      <Dialog open={!!pendingApproval} onOpenChange={(v) => !v && setPendingApproval(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle size={16} className="text-amber-600" />
              외부 연동 승인 요청
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              AI가 외부 서비스에 접근하려 합니다. 승인하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          {pendingApproval && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-700 font-medium mb-1">요청 내용</p>
                <p className="text-sm text-gray-800">{pendingApproval.message}</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500 font-medium mb-1">도구: <code className="bg-gray-200 px-1 rounded">{pendingApproval.toolName}</code></p>
                <pre className="text-xs text-gray-600 overflow-auto max-h-24">{JSON.stringify(pendingApproval.toolArgs, null, 2)}</pre>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPendingApproval(null);
                toast.info('승인이 거부되었습니다.');
              }}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <XCircle size={13} className="mr-1" />승인 거부
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setPendingApproval(null);
                toast.success('승인되었습니다. AI가 작업을 계속합니다.');
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <CheckCircle2 size={13} className="mr-1" />승인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showScheduledPanel && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setShowScheduledPanel(false)}
        />
      )}
    </div>
  );
}
