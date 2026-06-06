import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Code2,
  LayoutDashboard,
  ListTodo,
  Package,
  History,
  Plus,
  Send,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Slack,
  Zap,
  GitBranch,
  Tag,
  RefreshCw,
  ShieldAlert,
  Rocket,
  BarChart2,
  Star,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  AlertTriangle,
  Info,
  FolderOpen,
  Layers,
  ExternalLink,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ─── 상수// ─── 상수 ───────────────────────────────────────────
const TABS = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { id: "requests", label: "개발 요청", icon: ListTodo },
  { id: "features", label: "기능 목록", icon: Package },
  { id: "versions", label: "버전 이력", icon: History },
  { id: "accuracy", label: "정확도 분석", icon: BarChart2 },
];

type TabId = "dashboard" | "requests" | "features" | "versions" | "accuracy";
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "대기", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  in_progress: { label: "진행중", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Zap },
  approved: { label: "승인", color: "bg-violet-50 text-violet-700 border-violet-200", icon: CheckCircle2 },
  completed: { label: "완료", color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  rejected: { label: "반려", color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: "높음", color: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "보통", color: "bg-amber-100 text-amber-700 border-amber-200" },
  low: { label: "낮음", color: "bg-green-100 text-green-700 border-green-200" },
};

const CHANGE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  feature: { label: "기능 추가", color: "bg-indigo-100 text-indigo-700" },
  bugfix: { label: "버그 수정", color: "bg-red-100 text-red-700" },
  refactor: { label: "리팩터링", color: "bg-purple-100 text-purple-700" },
  hotfix: { label: "핫픽스", color: "bg-orange-100 text-orange-700" },
};

const CATEGORY_LABELS: Record<string, string> = {
  ai: "AI",
  booking: "예약",
  package: "패키지",
  crm: "CRM",
  cms: "CMS",
  finance: "재무",
  system: "시스템",
  manager_talk: "두골프 매니저톡",
  ui_ux: "UI/UX",
  erp: "ERP",
};


// ─── 관리 프로젝트 요약 위젯 ────────────────────────────────────────────────────
function ManagedProjectsSummaryWidget() {
  const { data: stats, isLoading } = trpc.managedProjects.getStats.useQuery();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
    );
  }

  if (!stats || stats.length === 0) return null;

  const activeProjects = stats.filter((p: any) => p.isActive).length;
  const totalRequests = stats.reduce((s: number, p: any) => s + (p.stats?.totalRequests ?? 0), 0);
  const thisWeekRequests = 0; // 주간 통계는 대시보드 stats에서 가져옴
  const accuracyList = stats.filter((p: any) => p.stats?.avgAccuracy !== null).map((p: any) => p.stats?.avgAccuracy as number);
  const avgAccuracy = accuracyList.length > 0
    ? Math.round(accuracyList.reduce((a: number, b: number) => a + b, 0) / accuracyList.length)
    : null;
  const defaultProject = stats.find((p: any) => p.isDefault);

  return (
    <Card className="border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">AI 오케스트라 관리 현황</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100"
            onClick={() => setLocation("/erp/managed-projects")}
          >
            <FolderOpen size={12} className="mr-1" />
            전체 보기
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-blue-700">{stats.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">전체 프로젝트</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-600">{activeProjects}</p>
            <p className="text-xs text-slate-500 mt-0.5">활성 프로젝트</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-violet-600">{totalRequests.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-0.5">누적 요청건수</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-amber-600">{avgAccuracy !== null ? `${avgAccuracy}점` : "-"}</p>
            <p className="text-xs text-slate-500 mt-0.5">평균 정확도</p>
          </div>
        </div>
        {defaultProject && (
          <div className="mt-3 flex items-center gap-2 text-xs text-blue-600">
            <Star size={11} className="fill-blue-400 text-blue-400" />
            <span>기본 프로젝트: <strong>{defaultProject.name}</strong></span>
            {defaultProject.manusDeployUrl && (
              <a href={defaultProject.manusDeployUrl} target="_blank" rel="noopener noreferrer"
                className="ml-auto text-blue-500 hover:text-blue-700 underline"
              >
                사이트 열기
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 컴포넌트 ────────────────────────────────────────────────
export default function DevAI() {
  const [location, setLocation] = useLocation();
  // URL 쿼리 파라미터에서 탭 읽기
  const urlParams = (() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const p = new URLSearchParams(search);
    return {
      tab: p.get("tab"),
      projectId: p.get("projectId"),
      projectName: p.get("projectName"),
    };
  })();
  const urlTab = (() => {
    const t = urlParams.tab;
    if (t === "requests" || t === "features" || t === "versions" || t === "accuracy") return t;
    return "dashboard";
  })() as TabId;
  const [activeTab, setActiveTabState] = useState<TabId>(urlTab);
  const [accuracyPeriod, setAccuracyPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [accuracyEvalOpen, setAccuracyEvalOpen] = useState(false);
  const [evalTarget, setEvalTarget] = useState<{ id: number; title: string } | null>(null);
  const [evalScore, setEvalScore] = useState(5);
  const [evalFeedback, setEvalFeedback] = useState("");
  const [evalEngine, setEvalEngine] = useState("");
  const [savedFeedbackCategory, setSavedFeedbackCategory] = useState<string | null>(null);
  const setActiveTab = (tab: TabId) => {
    setActiveTabState(tab);
    const newUrl = tab === "dashboard" ? "/erp/dev-ai" : `/erp/dev-ai?tab=${tab}`;
    window.history.replaceState(null, "", newUrl);
  };
  const [expandedReqId, setExpandedReqId] = useState<number | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // 다이얼로그 상태
  const [createReqOpen, setCreateReqOpen] = useState(false);
  const [editReqOpen, setEditReqOpen] = useState(false);
  const [createFeatureOpen, setCreateFeatureOpen] = useState(false);
  const [createVersionOpen, setCreateVersionOpen] = useState(false);
  const [slackWebhookInput, setSlackWebhookInput] = useState("");

  // URL 파라미터로 새 요청 다이얼로그 자동 오픈 (ManagedProjects에서 네비게이션 시)
  const _autoOpened = useRef(false);
  if (!_autoOpened.current && urlParams.projectName && urlTab === "requests") {
    _autoOpened.current = true;
    setTimeout(() => setCreateReqOpen(true), 100);
  }

  // 폼 상태
  const [reqForm, setReqForm] = useState({
    title: "",
    description: urlParams.projectName ? `[${urlParams.projectName}] ` : "",
    priority: "medium",
    featureId: "",
  });
  const [editReqForm, setEditReqForm] = useState<any>(null);
  const [featureForm, setFeatureForm] = useState({ name: "", description: "", category: "system", currentVersion: "1.0.0" });
  const [versionForm, setVersionForm] = useState({ featureId: "", version: "", description: "", changeType: "feature", checkpointId: "", isRollbackable: true });

  const utils = trpc.useUtils();

  // 쿼리
  const { data: dashStats, isLoading: dashLoading, refetch: refetchDash } = trpc.devAI.dashboardStats.useQuery(
    undefined, { enabled: activeTab === "dashboard" }
  );
  // 대시보드용 서킷 브레이커 + 최근 배포 쿼리
  const { data: circuitData, refetch: refetchCircuit } = trpc.aiLogs.circuitBreakerStatus.useQuery(
    undefined, { enabled: activeTab === "dashboard" }
  );
  const { data: recentVersions, refetch: refetchVersions } = trpc.devAI.listVersions.useQuery(
    {}, { enabled: activeTab === "dashboard" }
  );
  const { data: reqData, isLoading: reqLoading } = trpc.devAI.listRequests.useQuery(
    {
      page: 1, limit: 50,
      status: statusFilter !== "all" ? statusFilter : undefined,
      priority: priorityFilter !== "all" ? priorityFilter : undefined,
    },
    { enabled: activeTab === "requests" }
  );
  const { data: features, isLoading: featuresLoading } = trpc.devAI.listFeatures.useQuery(
    undefined, { enabled: activeTab === "features" || activeTab === "versions" }
  );
  const { data: versions, isLoading: versionsLoading } = trpc.devAI.listVersions.useQuery(
    { featureId: selectedFeatureId ?? undefined },
    { enabled: activeTab === "versions" }
  );

  // 정확도 분석 쿼리
  const { data: accuracyStats, isLoading: accuracyStatsLoading, refetch: refetchAccuracy } = trpc.devAI.accuracyStats.useQuery(
    { period: accuracyPeriod },
    { enabled: activeTab === "accuracy" }
  );
  const { data: engineComparison, isLoading: engineCompLoading } = trpc.devAI.engineAccuracyComparison.useQuery(
    { period: accuracyPeriod },
    { enabled: activeTab === "accuracy" }
  );
  const { data: suggestions, isLoading: suggestionsLoading } = trpc.devAI.getImprovementSuggestions.useQuery(
    { period: accuracyPeriod },
    { enabled: activeTab === "accuracy" }
  );
  const updateAccuracyMutation = trpc.devAI.updateAccuracy.useMutation({
    onSuccess: (data) => {
      const catLabel = data.feedbackCategory === "bug" ? "버그" : data.feedbackCategory === "suggestion" ? "개선제안" : "기타";
      toast.success(`정확도 평가 저장 완료${data.feedbackCategory ? ` · 분류: ${catLabel}` : ""}`);
      setSavedFeedbackCategory(data.feedbackCategory ?? null);
      setAccuracyEvalOpen(false);
      setEvalTarget(null);
      setEvalScore(5);
      setEvalFeedback("");
      setEvalEngine("");
      refetchAccuracy();
      utils.devAI.listRequests.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createReqMutation = trpc.devAI.createRequest.useMutation({
    onSuccess: async (createdReq) => {
      // Slack 자동 전송 (Webhook URL이 입력된 경우)
      if (slackWebhookInput.trim()) {
        try {
          await sendSlackMutation.mutateAsync({
            requestId: createdReq.id,
            webhookUrl: slackWebhookInput.trim(),
          });
        } catch {
          // Slack 전송 실패는 요청 등록 성공에 영향 없음
          toast.warning("요청은 등록되었으나 Slack 전송에 실패했습니다.");
        }
      }
      toast.success("개발 요청이 등록되었습니다.");
      setCreateReqOpen(false);
      setReqForm({ title: "", description: "", priority: "medium", featureId: "" });
      setSlackWebhookInput("");
      utils.devAI.listRequests.invalidate();
      utils.devAI.dashboardStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateReqMutation = trpc.devAI.updateRequest.useMutation({
    onSuccess: (data, variables) => {
      if (variables.status === "approved") {
        toast.success("승인되었습니다. 자율수행데스크에 자동 전송 중...", { duration: 4000 });
      } else {
        toast.success("요청이 업데이트되었습니다.");
      }
      setEditReqOpen(false);
      utils.devAI.listRequests.invalidate();
      utils.devAI.dashboardStats.invalidate();
      // 완료 상태로 변경 시 정확도 평가 다이얼로그 자동 트리거
      if (variables.status === "completed") {
        // 편집 다이얼로그에서 저장한 경우 editReqForm에서 정보 가져오기
        const reqId = variables.id;
        const reqTitle = editReqForm?.id === reqId ? (editReqForm?.title ?? "") : "";
        const alreadyScored = editReqForm?.id === reqId ? (editReqForm?.accuracyScore != null) : false;
        if (!alreadyScored) {
          setTimeout(() => {
            setEvalTarget({ id: reqId, title: reqTitle });
            setEvalScore(5);
            setAccuracyEvalOpen(true);
          }, 400);
        }
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteReqMutation = trpc.devAI.deleteRequest.useMutation({
    onSuccess: () => {
      toast.success("요청이 삭제되었습니다.");
      utils.devAI.listRequests.invalidate();
      utils.devAI.dashboardStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateFeedbackCategoryMutation = trpc.devAI.updateFeedbackCategory.useMutation({
    onSuccess: () => {
      toast.success("피드백 카테고리가 수정되었습니다.");
      utils.devAI.listRequests.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const fetchManusResultMutation = trpc.devAI.fetchManusResult.useMutation({
    onSuccess: (data) => {
      if (data.success && data.result) {
        toast.success(data.message ?? "결과물이 자동으로 수집되었습니다.");
        setEditReqForm((f: any) => f ? {
          ...f,
          result: data.result,
          resultCheckpointId: (data as any).checkpointId ?? f.resultCheckpointId,
        } : f);
        utils.devAI.listRequests.invalidate();
        if ((data as any).checkpointId) {
          toast.info(`체크포인트 ID ${((data as any).checkpointId as string).slice(0, 8)}이 연결되었습니다.`, { duration: 4000 });
        }
      } else {
        toast.info(data.message ?? "Manus에서 아직 응답이 없습니다.");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const sendSlackMutation = trpc.devAI.sendToSlack.useMutation({
    onSuccess: () => toast.success("Slack으로 전송되었습니다."),
    onError: (e) => toast.error(e.message),
  });

  const createFeatureMutation = trpc.devAI.createFeature.useMutation({
    onSuccess: () => {
      toast.success("기능이 등록되었습니다.");
      setCreateFeatureOpen(false);
      setFeatureForm({ name: "", description: "", category: "system", currentVersion: "1.0.0" });
      utils.devAI.listFeatures.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createVersionMutation = trpc.devAI.createVersion.useMutation({
    onSuccess: () => {
      toast.success("버전이 등록되었습니다.");
      setCreateVersionOpen(false);
      setVersionForm({ featureId: "", version: "", description: "", changeType: "feature", checkpointId: "", isRollbackable: true });
      utils.devAI.listVersions.invalidate();
      utils.devAI.listFeatures.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                <Code2 size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">두골프 개발AI</h1>
                <p className="text-sm text-slate-500">개발 요청 관리 · 기능 이력 · 롤백 관리 · Slack 연동</p>
              </div>
            </div>
          </div>
  
          {/* 탭 */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-white text-violet-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
  
          {/* ===== 대시보드 탭 ===== */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => { refetchDash(); refetchCircuit(); refetchVersions(); }} className="gap-2">
                  <RefreshCw size={14} />
                  새로고침
                </Button>
              </div>

              {/* 관리 프로젝트 요약 위젯 */}
              <ManagedProjectsSummaryWidget />
              {dashLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {/* 요청 통계 카드 */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { label: "전체 요청", value: dashStats?.totalRequests ?? 0, color: "from-violet-500 to-indigo-600", icon: ListTodo },
                      { label: "대기중", value: dashStats?.pendingRequests ?? 0, color: "from-amber-400 to-orange-500", icon: Clock },
                      { label: "진행중", value: dashStats?.inProgressRequests ?? 0, color: "from-blue-500 to-cyan-500", icon: Zap },
                      { label: "완료", value: dashStats?.completedRequests ?? 0, color: "from-green-500 to-emerald-600", icon: CheckCircle2 },
                      { label: "활성 기능", value: dashStats?.activeFeatures ?? 0, color: "from-purple-500 to-pink-500", icon: Package },
                      { label: "총 버전", value: dashStats?.totalVersions ?? 0, color: "from-slate-500 to-slate-700", icon: GitBranch },
                    ].map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <Card key={stat.label} className="border-slate-200 overflow-hidden">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
                                <p className="text-2xl font-bold text-slate-800">{stat.value.toLocaleString()}</p>
                              </div>
                              <div className={`w-10 h-10 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                                <Icon size={18} className="text-white" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
  
                  {/* 빠른 액션 */}
                  <Card className="border-slate-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-slate-700">빠른 액션</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          className="bg-violet-600 hover:bg-violet-700 gap-2"
                          onClick={() => { setActiveTab("requests"); setCreateReqOpen(true); }}
                        >
                          <Plus size={15} />
                          개발 요청 등록
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => { setActiveTab("features"); setCreateFeatureOpen(true); }}
                        >
                          <Package size={15} />
                          기능 등록
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => { setActiveTab("versions"); setCreateVersionOpen(true); }}
                        >
                          <Tag size={15} />
                          버전 기록
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
  
                  {/* 서킷 브레이커 상태 위젯 */}
                  {circuitData && (
                    <Card className="border-slate-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <ShieldAlert size={15} className="text-violet-600" />
                          Gemini API 서킷 브레이커 상태
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {(circuitData.regions ?? []).map((region: any) => {
                            const cb = circuitData.status?.[region.name];
                            const isOpen = cb?.isOpen ?? false;
                            return (
                              <div key={region.name} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                                isOpen ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"
                              }`}>
                                <span className={`w-2 h-2 rounded-full ${isOpen ? "bg-red-500" : "bg-green-500"}`} />
                                <span>{region.label}</span>
                                {isOpen && cb?.failures != null && (
                                  <span className="text-red-400">({cb.failures}회 실패)</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {Object.values(circuitData.status ?? {}).every((s: any) => !s.isOpen) && (
                          <p className="text-xs text-green-600 mt-2">모든 리전 정상 운영 중</p>
                        )}
                      </CardContent>
                    </Card>
                  )}
  
                  {/* 최근 배포 이력 위젯 */}
                  {(recentVersions ?? []).length > 0 && (
                    <Card className="border-slate-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Rocket size={15} className="text-violet-600" />
                          최근 배포 이력
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {(recentVersions ?? []).slice(0, 5).map((ver: any) => (
                            <div key={ver.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                              <div className="flex items-center gap-2">
                                <Badge className={`text-[10px] px-1.5 py-0 ${CHANGE_TYPE_CONFIG[ver.changeType ?? "feature"]?.color ?? "bg-slate-100 text-slate-600"}`}>
                                  {CHANGE_TYPE_CONFIG[ver.changeType ?? "feature"]?.label ?? ver.changeType}
                                </Badge>
                                <span className="text-xs text-slate-700 font-medium line-clamp-1">{ver.description}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-mono text-violet-600">v{ver.version}</span>
                                {ver.checkpointId && (
                                  <Badge className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-600 border-indigo-200 font-mono cursor-pointer"
                                    onClick={() => {
                                      navigator.clipboard.writeText(ver.checkpointId);
                                      toast.success(`체크포인트 ID ${ver.checkpointId} 복사됨`);
                                    }}
                                  >
                                    #{ver.checkpointId.slice(0, 8)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-xs text-violet-600 hover:text-violet-700 gap-1 w-full justify-center"
                          onClick={() => setActiveTab("versions")}
                        >
                          <History size={12} />
                          전체 이력 보기
                        </Button>
                      </CardContent>
                    </Card>
                  )}
  
                  {/* Slack 설정 안내 */}
                  <Card className="border-slate-200 bg-slate-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Slack size={15} className="text-purple-600" />
                        Slack 연동 안내
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        개발 요청을 Slack으로 자동 전송하려면 Slack Incoming Webhook URL을 환경변수
                        <code className="mx-1 px-1.5 py-0.5 bg-slate-200 rounded text-[11px] font-mono">SLACK_WEBHOOK_URL</code>
                        에 설정하거나, 요청 전송 시 직접 입력할 수 있습니다.
                      </p>
                      <div className="flex gap-2">
                        <a
                          href="https://api.slack.com/messaging/webhooks"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-violet-600 hover:underline"
                        >
                          Slack Webhook 설정 가이드 →
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}
  
          {/* ===== 개발 요청 탭 ===== */}
          {activeTab === "requests" && (
            <div className="space-y-4">
              {/* 필터 + 등록 버튼 */}
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32 h-9 text-sm">
                    <SelectValue placeholder="상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 상태</SelectItem>
                    <SelectItem value="pending">대기</SelectItem>
                    <SelectItem value="approved">승인</SelectItem>
                    <SelectItem value="in_progress">진행중</SelectItem>
                    <SelectItem value="completed">완료</SelectItem>
                    <SelectItem value="rejected">반려</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-32 h-9 text-sm">
                    <SelectValue placeholder="우선순위" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 우선순위</SelectItem>
                    <SelectItem value="high">높음</SelectItem>
                    <SelectItem value="medium">보통</SelectItem>
                    <SelectItem value="low">낮음</SelectItem>
                  </SelectContent>
                </Select>
                <div className="ml-auto">
                  <Button
                    className="bg-violet-600 hover:bg-violet-700 gap-2"
                    onClick={() => setCreateReqOpen(true)}
                  >
                    <Plus size={15} />
                    요청 등록
                  </Button>
                </div>
              </div>
  
              {/* 요청 목록 */}
              {reqLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (reqData?.items ?? []).length === 0 ? (
                <Card className="border-dashed border-slate-200">
                  <CardContent className="py-16 flex flex-col items-center gap-3 text-slate-400">
                    <ListTodo size={32} className="opacity-40" />
                    <p className="text-sm font-medium">등록된 개발 요청이 없습니다.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateReqOpen(true)}
                      className="gap-2"
                    >
                      <Plus size={14} />
                      첫 요청 등록하기
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {reqData!.items.map((req) => {
                    const isExpanded = expandedReqId === req.id;
                    const statusCfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
                    const priorityCfg = PRIORITY_CONFIG[req.priority] ?? PRIORITY_CONFIG.medium;
                    const StatusIcon = statusCfg.icon;
                    return (
                      <Card key={req.id} className="border-slate-200 hover:border-violet-200 transition-colors">
                        <CardHeader className="pb-2 pt-4 px-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <span className="text-xs text-slate-400">#{req.id}</span>
                                <Badge className={`text-[10px] px-1.5 py-0 border ${statusCfg.color}`}>
                                  <StatusIcon size={9} className="mr-0.5" />
                                  {statusCfg.label}
                                </Badge>
                                <Badge className={`text-[10px] px-1.5 py-0 border ${priorityCfg.color}`}>
                                  {priorityCfg.label}
                                </Badge>
                                {req.feedbackCategory && (
                                  <div className="relative group">
                                    <Badge
                                      className={`text-[10px] px-1.5 py-0 border cursor-pointer hover:opacity-80 transition-opacity ${
                                        req.feedbackCategory === "bug" ? "bg-red-50 text-red-600 border-red-200" :
                                        req.feedbackCategory === "suggestion" ? "bg-blue-50 text-blue-600 border-blue-200" :
                                        "bg-slate-50 text-slate-500 border-slate-200"
                                      }`}
                                      title="클릭하여 카테고리 변경"
                                    >
                                      {req.feedbackCategory === "bug" ? "버그" : req.feedbackCategory === "suggestion" ? "개선제안" : "기타"} ✎
                                    </Badge>
                                    <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:flex flex-col bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[90px]">
                                      {(["bug", "suggestion", "other"] as const).map((cat) => (
                                        <button
                                          key={cat}
                                          className={`text-xs px-3 py-1.5 text-left hover:bg-slate-50 transition-colors ${
                                            req.feedbackCategory === cat ? "font-semibold" : ""
                                          }`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateFeedbackCategoryMutation.mutate({ requestId: req.id, feedbackCategory: cat });
                                          }}
                                        >
                                          {cat === "bug" ? "버그" : cat === "suggestion" ? "개선제안" : "기타"}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-slate-800 line-clamp-1">{req.title}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-slate-400">
                                  {req.createdByName ?? "알 수 없음"} · {new Date(req.createdAt).toLocaleDateString("ko-KR")}
                                </span>
                                {req.slackMessageTs && (
                                  <span className="text-[10px] text-purple-500 flex items-center gap-0.5">
                                    <Slack size={9} />
                                    Slack 전송됨
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-violet-600"
                                title="Slack 전송"
                                onClick={() => {
                                  if (slackWebhookInput) {
                                    sendSlackMutation.mutate({ requestId: req.id, webhookUrl: slackWebhookInput });
                                  } else {
                                    sendSlackMutation.mutate({ requestId: req.id });
                                  }
                                }}
                              >
                                <Send size={13} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                                title="편집"
                                onClick={() => {
                                  setEditReqForm({ ...req });
                                  setEditReqOpen(true);
                                }}
                              >
                                <Edit3 size={13} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600"
                                onClick={() => setExpandedReqId(isExpanded ? null : req.id)}
                              >
                                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500">
                                    <Trash2 size={13} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>요청 삭제</AlertDialogTitle>
                                    <AlertDialogDescription>이 개발 요청을 삭제하시겠습니까?</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-red-500 hover:bg-red-600"
                                      onClick={() => deleteReqMutation.mutate({ id: req.id })}
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
                            <div className="border-t border-slate-100 pt-3 space-y-3">
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1">요청 내용</p>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{req.description}</p>
                              </div>
                              {req.result && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 mb-1">결과물</p>
                                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-green-50 rounded-lg p-3">
                                    {req.result}
                                  </p>
                                </div>
                              )}

                              {/* 체크포인트 ID 표시 + 버전 생성 바로가기 */}
                              {(req as any).resultCheckpointId && (
                                <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <GitBranch size={12} className="text-indigo-500" />
                                    <span className="text-xs text-indigo-600 font-medium">체크포인트:</span>
                                    <code className="text-xs text-indigo-700 font-mono">{((req as any).resultCheckpointId as string).slice(0, 8)}</code>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs gap-1 border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                                    onClick={() => {
                                      setVersionForm({
                                        featureId: req.featureId ? String(req.featureId) : "",
                                        version: "",
                                        description: `${req.title ?? ""} 개발 완료`,
                                        changeType: "feature",
                                        checkpointId: (req as any).resultCheckpointId ?? "",
                                        isRollbackable: true,
                                      });
                                      setCreateVersionOpen(true);
                                    }}
                                  >
                                    <History size={11} />
                                    버전 생성
                                  </Button>
                                </div>
                              )}
                              {/* 상태 변경 빠른 버튼 */}
                              <div className="flex gap-2 flex-wrap">
                                {["pending", "approved", "in_progress", "completed", "rejected"].map((s) => (
                                  <Button
                                    key={s}
                                    variant="outline"
                                    size="sm"
                                    className={`text-xs h-7 ${req.status === s ? "border-violet-400 text-violet-700 bg-violet-50" : ""}`}
                                    onClick={() => {
                                      updateReqMutation.mutate({ id: req.id, status: s as any });
                                      // 완료 상태로 변경 시 정확도 평가 다이얼로그 자동 트리거
                                      if (s === "completed" && req.accuracyScore == null) {
                                        setTimeout(() => {
                                          setEvalTarget({ id: req.id, title: req.title ?? "" });
                                          setEvalScore(5);
                                          setAccuracyEvalOpen(true);
                                        }, 400);
                                      }
                                    }}
                                    disabled={req.status === s}
                                  >
                                    {STATUS_CONFIG[s]?.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
  
          {/* ===== 기능 목록 탭 ===== */}
          {activeTab === "features" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button className="bg-violet-600 hover:bg-violet-700 gap-2" onClick={() => setCreateFeatureOpen(true)}>
                  <Plus size={15} />
                  기능 등록
                </Button>
              </div>
              {featuresLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (features ?? []).length === 0 ? (
                <Card className="border-dashed border-slate-200">
                  <CardContent className="py-16 flex flex-col items-center gap-3 text-slate-400">
                    <Package size={32} className="opacity-40" />
                    <p className="text-sm font-medium">등록된 기능이 없습니다.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {features!.map((feat) => (
                    <Card key={feat.id} className="border-slate-200 hover:border-violet-200 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-600 border-slate-200">
                                {CATEGORY_LABELS[feat.category ?? "system"] ?? feat.category}
                              </Badge>
                              <Badge className={`text-[10px] px-1.5 py-0 ${
                                feat.status === "active" ? "bg-green-100 text-green-700" :
                                feat.status === "deprecated" ? "bg-red-100 text-red-700" :
                                "bg-amber-100 text-amber-700"
                              }`}>
                                {feat.status === "active" ? "활성" : feat.status === "deprecated" ? "지원종료" : "실험적"}
                              </Badge>
                            </div>
                            <p className="text-sm font-semibold text-slate-800">{feat.name}</p>
                            {feat.description && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{feat.description}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-1 text-xs text-violet-600 font-semibold">
                              <Tag size={11} />
                              v{feat.currentVersion}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-slate-400 hover:text-violet-600 mt-1 gap-1"
                              onClick={() => {
                                setSelectedFeatureId(feat.id);
                                setActiveTab("versions");
                              }}
                            >
                              <History size={11} />
                              이력 보기
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
  
          {/* ===== 버전 이력 탭 ===== */}
          {activeTab === "versions" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Select
                  value={selectedFeatureId ? String(selectedFeatureId) : "all"}
                  onValueChange={(v) => setSelectedFeatureId(v === "all" ? null : Number(v))}
                >
                  <SelectTrigger className="w-48 h-9 text-sm">
                    <SelectValue placeholder="기능 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 기능</SelectItem>
                    {(features ?? []).map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="ml-auto">
                  <Button className="bg-violet-600 hover:bg-violet-700 gap-2" onClick={() => setCreateVersionOpen(true)}>
                    <Plus size={15} />
                    버전 기록
                  </Button>
                </div>
              </div>
  
              {versionsLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (versions ?? []).length === 0 ? (
                <Card className="border-dashed border-slate-200">
                  <CardContent className="py-16 flex flex-col items-center gap-3 text-slate-400">
                    <History size={32} className="opacity-40" />
                    <p className="text-sm font-medium">버전 이력이 없습니다.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {versions!.map((ver, idx) => {
                    const changeCfg = CHANGE_TYPE_CONFIG[ver.changeType ?? "feature"] ?? CHANGE_TYPE_CONFIG.feature;
                    const featureName = features?.find(f => f.id === ver.featureId)?.name ?? `기능 #${ver.featureId}`;
                    return (
                      <Card key={ver.id} className="border-slate-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              {/* 타임라인 점 */}
                              <div className="flex flex-col items-center mt-1">
                                <div className={`w-3 h-3 rounded-full ${idx === 0 ? "bg-violet-500" : "bg-slate-300"}`} />
                                {idx < (versions?.length ?? 0) - 1 && (
                                  <div className="w-px h-full bg-slate-200 mt-1" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="text-sm font-bold text-violet-700">v{ver.version}</span>
                                  <Badge className={`text-[10px] px-1.5 py-0 ${changeCfg.color}`}>
                                    {changeCfg.label}
                                  </Badge>
                                  <span className="text-xs text-slate-500">{featureName}</span>
                                </div>
                                <p className="text-sm text-slate-700">{ver.description}</p>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-xs text-slate-400">
                                    {ver.createdByName ?? "알 수 없음"} · {new Date(ver.createdAt).toLocaleDateString("ko-KR")}
                                  </span>
                                  {ver.checkpointId && (
                                    <Badge
                                      className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-600 border-indigo-200 font-mono cursor-pointer hover:bg-indigo-100 transition-colors"
                                      onClick={() => {
                                        navigator.clipboard.writeText(ver.checkpointId!);
                                        toast.success(`체크포인트 ID ${ver.checkpointId} 복사됨`);
                                      }}
                                      title="클릭하여 복사"
                                    >
                                      #{ver.checkpointId.slice(0, 8)}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            {ver.isRollbackable && ver.checkpointId && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 gap-1.5 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                                onClick={() => {
                                  toast.info(
                                    `롤백하려면 Management UI > Version History에서 체크포인트 ID "${ver.checkpointId?.slice(0, 8)}"를 선택하세요.`,
                                    { duration: 5000 }
                                  );
                                }}
                              >
                                <RotateCcw size={12} />
                                롤백 안내
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== 정확도 분석 탭 ===== */}
          {activeTab === "accuracy" && (
            <div className="space-y-6">
              {/* 헤더 */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">개발 AI 응답 정확도 분석</h2>
                  <p className="text-sm text-slate-500">엔진별 성능 비교 및 개선 제안</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* 기간 필터 */}
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    {(["7d", "30d", "90d", "all"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setAccuracyPeriod(p)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                          accuracyPeriod === p ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {p === "7d" ? "7일" : p === "30d" ? "30일" : p === "90d" ? "90일" : "전체"}
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchAccuracy()} className="gap-2">
                    <RefreshCw size={14} />
                    새로고침
                  </Button>
                </div>
              </div>

              {/* 통계 카드 */}
              {accuracyStatsLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
                </div>
              ) : accuracyStats && accuracyStats.totalEvaluated > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                          <Star size={16} className="text-violet-600" />
                        </div>
                        <span className="text-xs text-slate-500">평균 정확도</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-800">{accuracyStats.avgScore}<span className="text-sm text-slate-400">/5</span></div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <BarChart2 size={16} className="text-blue-600" />
                        </div>
                        <span className="text-xs text-slate-500">평가 완료</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-800">{accuracyStats.totalEvaluated}<span className="text-sm text-slate-400">건</span></div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                          <TrendingUp size={16} className="text-green-600" />
                        </div>
                        <span className="text-xs text-slate-500">고정확도 (4점+)</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-800">{accuracyStats.highAccuracyRate}<span className="text-sm text-slate-400">%</span></div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                          <TrendingDown size={16} className="text-red-600" />
                        </div>
                        <span className="text-xs text-slate-500">저정확도 (2점-)</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-800">{accuracyStats.lowAccuracyCount}<span className="text-sm text-slate-400">건</span></div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-8 text-center">
                    <BarChart2 size={40} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500 font-medium">정확도 평가 데이터가 없습니다</p>
                    <p className="text-slate-400 text-sm mt-1">개발 요청 목록에서 완료된 요청에 정확도를 평가해 주세요</p>
                    <Button
                      size="sm"
                      className="mt-4 bg-violet-600 hover:bg-violet-700"
                      onClick={() => {
                        setActiveTab("requests");
                        toast.info("개발 요청 목록에서 완료된 요청의 정확도를 평가해 주세요");
                      }}
                    >
                      개발 요청으로 이동
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* 피드백 카테고리 통계 */}
              {accuracyStats && accuracyStats.totalEvaluated > 0 && accuracyStats.categoryBreakdown && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-700">피드백 카테고리 분류</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-red-50 rounded-xl border border-red-100">
                        <div className="text-2xl font-bold text-red-600">{accuracyStats.categoryBreakdown.bug}</div>
                        <div className="text-xs text-red-500 mt-1 font-medium">버그 리포트</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="text-2xl font-bold text-blue-600">{accuracyStats.categoryBreakdown.suggestion}</div>
                        <div className="text-xs text-blue-500 mt-1 font-medium">개선 제안</div>
                      </div>
                      <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-2xl font-bold text-slate-600">{accuracyStats.categoryBreakdown.other}</div>
                        <div className="text-xs text-slate-500 mt-1 font-medium">기타</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 차트 영역 - 점수 분포 + 일별 트렌드 */}
              {accuracyStats && accuracyStats.totalEvaluated > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 점수 분포 차트 */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-slate-700">정확도 점수 분포</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={accuracyStats.scoreDistribution} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="score" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}점`} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(v) => [`${v}건`, "평가 수"]} />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {accuracyStats.scoreDistribution.map((entry, idx) => (
                              <Cell key={idx} fill={entry.score >= 4 ? "#22c55e" : entry.score === 3 ? "#f59e0b" : "#ef4444"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* 일별 정확도 트렌드 */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-slate-700">일별 정확도 트렌드</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {accuracyStats.dailyTrend.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={accuracyStats.dailyTrend} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v?.slice(5)} />
                            <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v) => [`${v}점`, "평균 정확도"]} />
                            <Line type="monotone" dataKey="avgScore" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">데이터 부족</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* 엔진별 정확도 비교 */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700">엔진별 정확도 비교</CardTitle>
                </CardHeader>
                <CardContent>
                  {engineCompLoading ? (
                    <div className="h-48 bg-slate-100 rounded-lg animate-pulse" />
                  ) : engineComparison && engineComparison.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={engineComparison} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="engine" tick={{ fontSize: 11 }} width={80} />
                        <Tooltip
                          formatter={(v, name) => [
                            name === "avgScore" ? `${v}점` : `${v}%`,
                            name === "avgScore" ? "평균 정확도" : "고정확도율",
                          ]}
                        />
                        <Bar dataKey="avgScore" fill="#7c3aed" radius={[0, 4, 4, 0]} name="avgScore" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-slate-400 text-sm">엔진별 평가 데이터 없음</div>
                  )}
                </CardContent>
              </Card>

              {/* 개선 제안 */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Lightbulb size={15} className="text-amber-500" />
                    AI 개선 제안
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {suggestionsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}
                    </div>
                  ) : suggestions?.suggestions && suggestions.suggestions.length > 0 ? (
                    <div className="space-y-3">
                      {suggestions.suggestions.map((s, i) => (
                        <div
                          key={i}
                          className={`flex gap-3 p-4 rounded-xl border ${
                            s.priority === "high"
                              ? "bg-red-50 border-red-200"
                              : s.priority === "medium"
                              ? "bg-amber-50 border-amber-200"
                              : "bg-blue-50 border-blue-200"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            s.priority === "high" ? "bg-red-100" : s.priority === "medium" ? "bg-amber-100" : "bg-blue-100"
                          }`}>
                            {s.priority === "high" ? (
                              <AlertTriangle size={15} className="text-red-600" />
                            ) : s.priority === "medium" ? (
                              <Info size={15} className="text-amber-600" />
                            ) : (
                              <Lightbulb size={15} className="text-blue-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-slate-800">{s.title}</span>
                              <Badge className={`text-[10px] px-1.5 py-0 ${
                                s.priority === "high" ? "bg-red-100 text-red-700" : s.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                              }`}>
                                {s.priority === "high" ? "높음" : s.priority === "medium" ? "보통" : "낙음"}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-600">{s.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" />
                      <p className="text-sm font-medium text-slate-600">현재 개선이 필요한 사항이 없습니다</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 저정확도 요청 목록 */}
              {suggestions?.lowAccuracyRequests && suggestions.lowAccuracyRequests.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <AlertTriangle size={15} className="text-red-500" />
                      저정확도 요청 목록 (재검토 필요)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {suggestions.lowAccuracyRequests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{req.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500">정확도: {req.accuracyScore}점</span>
                              {req.engineType && <span className="text-xs text-slate-400">• {req.engineType}</span>}
                              {req.userFeedback && <span className="text-xs text-slate-400 truncate">• {req.userFeedback}</span>}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 ml-2 text-xs"
                            onClick={() => {
                              setEvalTarget({ id: req.id, title: req.title ?? "" });
                              setEvalScore(req.accuracyScore ?? 3);
                              setEvalFeedback(req.userFeedback ?? "");
                              setEvalEngine(req.engineType ?? "");
                              setAccuracyEvalOpen(true);
                            }}
                          >
                            재평가
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 정확도 평가 다이얼로그 */}
              <Dialog open={accuracyEvalOpen} onOpenChange={setAccuracyEvalOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>AI 응답 정확도 평가</DialogTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      개발 요청이 완료되었습니다. AI 응답의 정확도를 평가해 주세요. 이 데이터는 AI 엔진 개선에 활용됩니다.
                    </p>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    {evalTarget && (
                      <div className="p-3 bg-violet-50 border border-violet-100 rounded-lg">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-violet-500" />
                          <p className="text-xs font-semibold text-violet-600">완료된 요청</p>
                        </div>
                        <p className="text-sm font-medium text-slate-800">{evalTarget.title}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-2 block">정확도 점수 (1~5)</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            onClick={() => setEvalScore(s)}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                              evalScore === s
                                ? s >= 4 ? "bg-green-500 border-green-500 text-white" : s === 3 ? "bg-amber-500 border-amber-500 text-white" : "bg-red-500 border-red-500 text-white"
                                : "border-slate-200 text-slate-500 hover:border-slate-300"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 text-center">
                        {evalScore >= 4 ? "고정확도 — 우수" : evalScore === 3 ? "보통 — 개선 가능" : "저정확도 — 재검토 필요"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">엔진 유형 (선택사항)</label>
                      <Input
                        value={evalEngine}
                        onChange={(e) => setEvalEngine(e.target.value)}
                        placeholder="예: gemini-1.5-pro, claude-3.5-sonnet, gpt-4o"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">피드백 (선택사항)</label>
                      <Textarea
                        value={evalFeedback}
                        onChange={(e) => setEvalFeedback(e.target.value)}
                        placeholder="어떤 점이 부정확했는지, 개선사항 등을 입력하세요"
                        rows={3}
                      />
                      <p className="text-[10px] text-slate-400 mt-1">피드백 입력 시 AI가 자동으로 버그/개선제안/기타로 분류합니다</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAccuracyEvalOpen(false)}>취소</Button>
                    <Button
                      className="bg-violet-600 hover:bg-violet-700"
                      disabled={!evalTarget || updateAccuracyMutation.isPending}
                      onClick={() => {
                        if (!evalTarget) return;
                        updateAccuracyMutation.mutate({
                          requestId: evalTarget.id,
                          accuracyScore: evalScore,
                          userFeedback: evalFeedback || undefined,
                          engineType: evalEngine || undefined,
                        });
                      }}
                    >
                      {updateAccuracyMutation.isPending ? "저장 중..." : "평가 저장"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
  


        {/* ===== 개발 요청 등록 다이얼로그 ===== */}
        <Dialog open={createReqOpen} onOpenChange={setCreateReqOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>개발 요청 등록</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">제목 *</label>
                <Input
                  value={reqForm.title}
                  onChange={(e) => setReqForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="예: Gemini AI 응답 캐싱 기능 추가"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">요청 내용 *</label>
                <Textarea
                  value={reqForm.description}
                  onChange={(e) => setReqForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="구체적인 요청 내용을 작성해 주세요."
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">우선순위</label>
                  <Select value={reqForm.priority} onValueChange={(v) => setReqForm((f) => ({ ...f, priority: v }))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">높음</SelectItem>
                      <SelectItem value="medium">보통</SelectItem>
                      <SelectItem value="low">낮음</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">관련 기능</label>
                  <Select value={reqForm.featureId} onValueChange={(v) => setReqForm((f) => ({ ...f, featureId: v }))}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="선택 (선택사항)" />
                    </SelectTrigger>
                    <SelectContent>
                      {(features ?? []).map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Slack Webhook URL (선택사항)</label>
                <Input
                  value={slackWebhookInput}
                  onChange={(e) => setSlackWebhookInput(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">입력 시 등록 후 Slack으로 자동 전송됩니다.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateReqOpen(false)}>취소</Button>
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                disabled={!reqForm.title || !reqForm.description || createReqMutation.isPending}
                onClick={() => {
                  createReqMutation.mutate({
                    title: reqForm.title,
                    description: reqForm.description,
                    priority: reqForm.priority as any,
                    featureId: reqForm.featureId ? Number(reqForm.featureId) : undefined,
                  });
                }}
              >
                {createReqMutation.isPending ? "등록 중..." : "등록"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
  
        {/* ===== 요청 편집 다이얼로그 ===== */}
        <Dialog open={editReqOpen} onOpenChange={setEditReqOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>요청 편집</DialogTitle>
            </DialogHeader>
            {editReqForm && (
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">제목</label>
                  <Input
                    value={editReqForm.title}
                    onChange={(e) => setEditReqForm((f: any) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">내용</label>
                  <Textarea
                    value={editReqForm.description}
                    onChange={(e) => setEditReqForm((f: any) => ({ ...f, description: e.target.value }))}
                    rows={4}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-600">결과물</label>
                    {editReqForm.manusTaskId && (
                      <button
                        type="button"
                        onClick={() => fetchManusResultMutation.mutate({ id: editReqForm.id })}
                        disabled={fetchManusResultMutation.isPending}
                        className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium disabled:opacity-50 transition-colors"
                      >
                        {fetchManusResultMutation.isPending ? (
                          <>⏳ 수집 중...</>
                        ) : (
                          <>✨ Manus에서 자동 가져오기</>
                        )}
                      </button>
                    )}
                  </div>
                  <Textarea
                    value={editReqForm.result ?? ""}
                    onChange={(e) => setEditReqForm((f: any) => ({ ...f, result: e.target.value }))}
                    placeholder={editReqForm.manusTaskId ? "Manus에서 자동 가져오거나 직접 입력하세요." : "완료된 결과물을 기록합니다."}
                    rows={3}
                  />
                  {!editReqForm.manusTaskId && (
                    <p className="text-xs text-slate-400 mt-1">팔 Manus에 전송하면 결과물을 자동으로 가져올 수 있습니다.</p>
                  )}
                  {editReqForm.resultCheckpointId && (
                    <div className="flex items-center gap-2 mt-1.5 p-2 bg-indigo-50 rounded-lg border border-indigo-200">
                      <GitBranch size={12} className="text-indigo-500 shrink-0" />
                      <span className="text-xs text-indigo-700 font-medium">체크포인트 연결:</span>
                      <code className="text-xs text-indigo-600 font-mono">{editReqForm.resultCheckpointId.slice(0, 8)}</code>
                      <button
                        type="button"
                        className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 underline"
                        onClick={() => {
                          navigator.clipboard.writeText(editReqForm.resultCheckpointId);
                          toast.success("체크포인트 ID 복사됨");
                        }}
                      >
                        복사
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">상태</label>
                    <Select value={editReqForm.status} onValueChange={(v) => setEditReqForm((f: any) => ({ ...f, status: v }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">대기</SelectItem>
                        <SelectItem value="approved">승인</SelectItem>
                        <SelectItem value="in_progress">진행중</SelectItem>
                        <SelectItem value="completed">완료</SelectItem>
                        <SelectItem value="rejected">반려</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">우선순위</label>
                    <Select value={editReqForm.priority} onValueChange={(v) => setEditReqForm((f: any) => ({ ...f, priority: v }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">높음</SelectItem>
                        <SelectItem value="medium">보통</SelectItem>
                        <SelectItem value="low">낮음</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditReqOpen(false)}>취소</Button>
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                disabled={updateReqMutation.isPending}
                onClick={() => {
                  updateReqMutation.mutate({
                    id: editReqForm.id,
                    title: editReqForm.title,
                    description: editReqForm.description,
                    status: editReqForm.status,
                    priority: editReqForm.priority,
                    result: editReqForm.result || undefined,
                  });
                }}
              >
                {updateReqMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
  
        {/* ===== 기능 등록 다이얼로그 ===== */}
        <Dialog open={createFeatureOpen} onOpenChange={setCreateFeatureOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>기능 등록</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">기능명 *</label>
                <Input
                  value={featureForm.name}
                  onChange={(e) => setFeatureForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="예: Gemini AI 어시스턴트"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">설명</label>
                <Textarea
                  value={featureForm.description}
                  onChange={(e) => setFeatureForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">카테고리</label>
                  <Select value={featureForm.category} onValueChange={(v) => setFeatureForm((f) => ({ ...f, category: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">초기 버전</label>
                  <Input
                    value={featureForm.currentVersion}
                    onChange={(e) => setFeatureForm((f) => ({ ...f, currentVersion: e.target.value }))}
                    placeholder="1.0.0"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateFeatureOpen(false)}>취소</Button>
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                disabled={!featureForm.name || createFeatureMutation.isPending}
                onClick={() => createFeatureMutation.mutate(featureForm)}
              >
                {createFeatureMutation.isPending ? "등록 중..." : "등록"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
  
        {/* ===== 버전 기록 다이얼로그 ===== */}
        <Dialog open={createVersionOpen} onOpenChange={setCreateVersionOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>버전 기록</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">기능 *</label>
                <Select value={versionForm.featureId} onValueChange={(v) => setVersionForm((f) => ({ ...f, featureId: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="기능 선택" /></SelectTrigger>
                  <SelectContent>
                    {(features ?? []).map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">버전 *</label>
                  <Input
                    value={versionForm.version}
                    onChange={(e) => setVersionForm((f) => ({ ...f, version: e.target.value }))}
                    placeholder="예: 1.2.0"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">변경 유형</label>
                  <Select value={versionForm.changeType} onValueChange={(v) => setVersionForm((f) => ({ ...f, changeType: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feature">기능 추가</SelectItem>
                      <SelectItem value="bugfix">버그 수정</SelectItem>
                      <SelectItem value="refactor">리팩터링</SelectItem>
                      <SelectItem value="hotfix">핫픽스</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">변경 내용 *</label>
                <Textarea
                  value={versionForm.description}
                  onChange={(e) => setVersionForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="이 버전에서 변경된 내용을 기록합니다."
                  rows={3}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">체크포인트 ID (롤백 가능)</label>
                <Input
                  value={versionForm.checkpointId}
                  onChange={(e) => setVersionForm((f) => ({ ...f, checkpointId: e.target.value }))}
                  placeholder="예: 92182260 (Management UI에서 확인)"
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  체크포인트 ID 입력 시 해당 버전으로 롤백 안내가 제공됩니다.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateVersionOpen(false)}>취소</Button>
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                disabled={!versionForm.featureId || !versionForm.version || !versionForm.description || createVersionMutation.isPending}
                onClick={() => {
                  createVersionMutation.mutate({
                    featureId: Number(versionForm.featureId),
                    version: versionForm.version,
                    description: versionForm.description,
                    changeType: versionForm.changeType as any,
                    checkpointId: versionForm.checkpointId || undefined,
                    isRollbackable: !!versionForm.checkpointId,
                  });
                }}
              >
                {createVersionMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </>);
}
