/**
 * ManagedProjects.tsx
 * 두골프 마스터 AI 오케스트라 - 관리 프로젝트 목록 및 CRUD UI
 * 1000개 이상의 Manus WebDev 프로젝트를 중앙에서 관리
 * v2: AI 엔진 성능 비교 대시보드 + 프로젝트 간 컨텍스트 공유
 */
import { useState, useMemo } from "react";
import {
  Plus, Pencil, Trash2, Star, StarOff, ExternalLink,
  FolderOpen, CheckCircle2, Loader2, ChevronDown, ChevronUp,
  Code2, Globe, BookOpen, Settings2, BarChart3, Copy, ArrowRight,
  TrendingUp, Bug, Lightbulb, HelpCircle, Target, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── 타입 ────────────────────────────────────────────────────────────────────
interface ProjectFormData {
  name: string;
  slug: string;
  description: string;
  manusProjectId: string;
  manusWebdevPath: string;
  manusDeployUrl: string;
  techStack: string;
  keyFiles: string;
  devInstructions: string;
  customContext: string;
  isActive: boolean;
  isDefault: boolean;
}

const emptyForm: ProjectFormData = {
  name: "",
  slug: "",
  description: "",
  manusProjectId: "",
  manusWebdevPath: "",
  manusDeployUrl: "",
  techStack: "",
  keyFiles: "",
  devInstructions: "",
  customContext: "",
  isActive: true,
  isDefault: false,
};

// ─── 성능 게이지 컴포넌트 ─────────────────────────────────────────────────────
function AccuracyGauge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-gray-400">미평가</span>;
  const color = value >= 80 ? "bg-green-500" : value >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-bold ${value >= 80 ? "text-green-600" : value >= 60 ? "text-yellow-600" : "text-red-600"}`}>
        {value}%
      </span>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function ManagedProjects() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"list" | "dashboard">("list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProjectFormData>(emptyForm);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // 컨텍스트 공유 다이얼로그
  const [copyCtxOpen, setCopyCtxOpen] = useState(false);
  const [copyCtxFromId, setCopyCtxFromId] = useState<number | null>(null);
  const [copyCtxToId, setCopyCtxToId] = useState<number | null>(null);
  const [copyCtxFields, setCopyCtxFields] = useState<string[]>(["devInstructions", "customContext"]);

  // 검색·필터·페이지네이션 상태
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // ─── API ─────────────────────────────────────────────────────────────────────────────────
  const { data: projectsData, isLoading } = trpc.managedProjects.list.useQuery({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    isActive: isActiveFilter,
  });
  const projects = projectsData?.items ?? [];
  const totalPages = projectsData?.totalPages ?? 1;
  const totalCount = projectsData?.total ?? 0;
  const { data: statsData, isLoading: statsLoading } = trpc.managedProjects.getStats.useQuery();

  const createMutation = trpc.managedProjects.create.useMutation({
    onSuccess: () => {
      toast.success("프로젝트가 생성되었습니다.");
      utils.managedProjects.list.invalidate();
      utils.managedProjects.getStats.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.managedProjects.update.useMutation({
    onSuccess: () => {
      toast.success("프로젝트가 수정되었습니다.");
      utils.managedProjects.list.invalidate();
      utils.managedProjects.getStats.invalidate();
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const setDefaultMutation = trpc.managedProjects.setDefault.useMutation({
    onSuccess: () => {
      toast.success("기본 프로젝트로 설정되었습니다.");
      utils.managedProjects.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.managedProjects.delete.useMutation({
    onSuccess: () => {
      toast.success("프로젝트가 삭제되었습니다.");
      utils.managedProjects.list.invalidate();
      utils.managedProjects.getStats.invalidate();
      setDeleteConfirmId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const copyContextMutation = trpc.managedProjects.copyContext.useMutation({
    onSuccess: (data) => {
      toast.success(`컨텍스트 복사 완료 (${data.copiedFields.join(", ")})`);
      utils.managedProjects.list.invalidate();
      utils.managedProjects.getStats.invalidate();
      setCopyCtxOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── 핸들러 ────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (project: any) => {
    setEditingId(project.id);
    setForm({
      name: project.name ?? "",
      slug: project.slug ?? "",
      description: project.description ?? "",
      manusProjectId: project.manusProjectId ?? "",
      manusWebdevPath: project.manusWebdevPath ?? "",
      manusDeployUrl: project.manusDeployUrl ?? "",
      techStack: project.techStack ?? "",
      keyFiles: project.keyFiles ?? "",
      devInstructions: project.devInstructions ?? "",
      customContext: project.customContext ?? "",
      isActive: project.isActive ?? true,
      isDefault: project.isDefault ?? false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("프로젝트 이름을 입력하세요.");
    if (!form.slug.trim()) return toast.error("슬러그를 입력하세요.");
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const openCopyCtx = (fromId: number) => {
    setCopyCtxFromId(fromId);
    setCopyCtxToId(null);
    setCopyCtxFields(["devInstructions", "customContext"]);
    setCopyCtxOpen(true);
  };

  const handleCopyContext = () => {
    if (!copyCtxFromId || !copyCtxToId) return toast.error("원본과 대상 프로젝트를 선택하세요.");
    if (copyCtxFromId === copyCtxToId) return toast.error("원본과 대상이 같을 수 없습니다.");
    if (copyCtxFields.length === 0) return toast.error("복사할 필드를 하나 이상 선택하세요.");
    copyContextMutation.mutate({
      fromId: copyCtxFromId,
      toId: copyCtxToId,
      fields: copyCtxFields as any,
    });
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  // ─── 대시보드 통계 계산 ────────────────────────────────────────────────────
  const dashboardStats = useMemo(() => {
    if (!statsData) return null;
    const withStats = statsData.filter((p: any) => p.stats);
    const totalRequests = withStats.reduce((s: number, p: any) => s + (p.stats?.totalRequests ?? 0), 0);
    const totalCompleted = withStats.reduce((s: number, p: any) => s + (p.stats?.completedRequests ?? 0), 0);
    const accuracyList = withStats.filter((p: any) => p.stats?.avgAccuracy !== null).map((p: any) => p.stats!.avgAccuracy as number);
    const avgAccuracy = accuracyList.length > 0 ? Math.round(accuracyList.reduce((a: number, b: number) => a + b, 0) / accuracyList.length) : null;
    const topProject = withStats.length > 0
      ? withStats.reduce((best: any, p: any) => {
          const ba = best.stats?.avgAccuracy ?? 0;
          const pa = p.stats?.avgAccuracy ?? 0;
          return pa > ba ? p : best;
        }, withStats[0])
      : null;
    return { totalRequests, totalCompleted, avgAccuracy, topProject, projectCount: statsData.length };
  }, [statsData]);

  // ─── 렌더 ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderOpen className="w-7 h-7 text-dogolf-green" />
            관리 프로젝트
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manus AI 오케스트라가 관리하는 WebDev 프로젝트 목록. 기본 프로젝트가 개발 요청 전송 시 사용됩니다.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-dogolf-green hover:bg-dogolf-green-dark text-white gap-2">
          <Plus className="w-4 h-4" />
          프로젝트 추가
        </Button>
      </div>

      {/* 탭 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="list" className="gap-1.5">
            <FolderOpen className="w-4 h-4" />
            프로젝트 목록
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5">
            <BarChart3 className="w-4 h-4" />
            AI 성능 대시보드
          </TabsTrigger>
        </TabsList>

        {/* ── 목록 탭 ── */}
        <TabsContent value="list" className="mt-4 space-y-4">
          {/* 통계 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="pt-4 pb-4">
                <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
                <div className="text-xs text-gray-500 mt-1">전체 프로젝트</div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="pt-4 pb-4">
                <div className="text-2xl font-bold text-green-600">
                  {projects.filter((p: any) => p.isActive).length}
                </div>
                <div className="text-xs text-gray-500 mt-1">활성 (현재 페이지)</div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="pt-4 pb-4">
                <div className="text-2xl font-bold text-amber-500">
                  {projects.filter((p: any) => p.isDefault).length}
                </div>
                <div className="text-xs text-gray-500 mt-1">기본 프로젝트</div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="pt-4 pb-4">
                <div className="text-2xl font-bold text-blue-600">
                  {projects.filter((p: any) => p.manusDeployUrl).length}
                </div>
                <div className="text-xs text-gray-500 mt-1">배포된 (현재 페이지)</div>
              </CardContent>
            </Card>
          </div>

          {/* 검색·필터 바 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] flex items-center gap-2">
              <Input
                placeholder="프로젝트 이름, 슬러그, 기술스택 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSearch(searchInput);
                    setPage(1);
                  }
                }}
                className="h-9"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setSearch(searchInput); setPage(1); }}
                className="shrink-0 h-9"
              >
                검색
              </Button>
              {(search || searchInput) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
                  className="shrink-0 h-9 text-gray-500"
                >
                  초기화
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">상태:</span>
              {(["all", "active", "inactive"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => { setIsActiveFilter(v); setPage(1); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    isActiveFilter === v
                      ? "bg-dogolf-green text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {v === "all" ? "전체" : v === "active" ? "활성" : "비활성"}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 ml-auto">
              {totalCount}개 중 {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–{Math.min(page * PAGE_SIZE, totalCount)}개 표시
            </div>
          </div>

          {/* 목록 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-dogolf-green" />
            </div>
          ) : !projects || projects.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-200">
              <CardContent className="py-16 text-center">
                <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">등록된 프로젝트가 없습니다</p>
                <p className="text-gray-400 text-sm mt-1">프로젝트 추가 버튼을 눌러 첫 번째 프로젝트를 등록하세요.</p>
                <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
                  <Plus className="w-4 h-4" />
                  프로젝트 추가
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {projects.map((project: any) => (
                <Card
                  key={project.id}
                  className={`border shadow-sm transition-all ${
                    project.isDefault ? "border-amber-300 bg-amber-50/30" : "border-gray-200 bg-white"
                  }`}
                >
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* 왼쪽: 프로젝트 정보 */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-0.5">
                          {project.isDefault ? (
                            <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                          ) : (
                            <StarOff className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base font-semibold text-gray-900">
                              {project.name}
                            </CardTitle>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                project.isActive
                                  ? "border-green-300 text-green-700 bg-green-50"
                                  : "border-gray-300 text-gray-500"
                              }`}
                            >
                              {project.isActive ? "활성" : "비활성"}
                            </Badge>
                            {project.isDefault && (
                              <Badge className="text-xs bg-amber-500 text-white border-0">
                                기본
                              </Badge>
                            )}
                            <span className="text-xs text-gray-400 font-mono">{project.slug}</span>
                          </div>
                          {project.description && (
                            <p className="text-sm text-gray-500 mt-1 truncate">{project.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {project.manusDeployUrl && (
                              <a
                                href={project.manusDeployUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                              >
                                <Globe className="w-3 h-3" />
                                배포 URL
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {project.techStack && (
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <Code2 className="w-3 h-3" />
                                {project.techStack.length > 50
                                  ? project.techStack.slice(0, 50) + "..."
                                  : project.techStack}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 오른쪽: 액션 버튼 */}
                      <div className="flex items-center gap-1 shrink-0">
                        {!project.isDefault && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1"
                            onClick={() => setDefaultMutation.mutate({ id: project.id })}
                            disabled={setDefaultMutation.isPending}
                          >
                            <Star className="w-3.5 h-3.5" />
                            기본 설정
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          title="새 개발 요청"
                          className="text-xs text-dogolf-green hover:text-dogolf-green-dark hover:bg-green-50 gap-1 font-medium"
                          onClick={() => {
                            const params = new URLSearchParams();
                            params.set("tab", "requests");
                            if (project.manusProjectId) params.set("projectId", project.manusProjectId);
                            params.set("projectName", project.name);
                            setLocation(`/erp/dev-ai?${params.toString()}`);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          요청
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="컨텍스트 복사"
                          className="text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                          onClick={() => openCopyCtx(project.id)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                          onClick={() => setExpandedId(expandedId === project.id ? null : project.id)}
                        >
                          {expandedId === project.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => openEdit(project)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteConfirmId(project.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {/* 확장 상세 정보 */}
                  {expandedId === project.id && (
                    <CardContent className="pt-0 pb-4">
                      <div className="border-t border-gray-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {project.manusProjectId && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                              <Settings2 className="w-3 h-3" />
                              Manus 프로젝트 ID
                            </div>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 block">
                              {project.manusProjectId}
                            </code>
                          </div>
                        )}
                        {project.manusWebdevPath && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                              <FolderOpen className="w-3 h-3" />
                              WebDev 경로
                            </div>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700 block">
                              {project.manusWebdevPath}
                            </code>
                          </div>
                        )}
                        {project.keyFiles && (
                          <div className="md:col-span-2">
                            <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                              <Code2 className="w-3 h-3" />
                              핵심 파일
                            </div>
                            <pre className="text-xs bg-gray-50 border border-gray-200 px-3 py-2 rounded font-mono text-gray-700 whitespace-pre-wrap overflow-auto max-h-32">
                              {project.keyFiles}
                            </pre>
                          </div>
                        )}
                        {project.devInstructions && (
                          <div className="md:col-span-2">
                            <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              개발 절차
                            </div>
                            <pre className="text-xs bg-gray-50 border border-gray-200 px-3 py-2 rounded font-mono text-gray-700 whitespace-pre-wrap overflow-auto max-h-40">
                              {project.devInstructions}
                            </pre>
                          </div>
                        )}
                        {project.customContext && (
                          <div className="md:col-span-2">
                            <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              커스텀 컨텍스트
                            </div>
                            <pre className="text-xs bg-gray-50 border border-gray-200 px-3 py-2 rounded font-mono text-gray-700 whitespace-pre-wrap overflow-auto max-h-40">
                              {project.customContext}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 px-3"
              >
                ← 이전
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
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
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                        pageNum === page
                          ? "bg-dogolf-green text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 px-3"
              >
                다음 →
              </Button>
              <span className="text-xs text-gray-400 ml-2">{page} / {totalPages} 페이지</span>
            </div>
          )}
        </TabsContent>

        {/* ── AI 성능 대시보드 탭 ── */}
        <TabsContent value="dashboard" className="mt-4 space-y-6">
          {statsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-dogolf-green" />
            </div>
          ) : (
            <>
              {/* 전체 요약 */}
              {dashboardStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-dogolf-green/10 to-white">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-dogolf-green" />
                        <span className="text-xs text-gray-500">전체 개발 요청</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{dashboardStats.totalRequests}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-gray-500">완료 요청</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">{dashboardStats.totalCompleted}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-white">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-purple-500" />
                        <span className="text-xs text-gray-500">평균 정확도</span>
                      </div>
                      <div className="text-2xl font-bold text-purple-600">
                        {dashboardStats.avgAccuracy !== null ? `${dashboardStats.avgAccuracy}%` : "—"}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-white">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-amber-500" />
                        <span className="text-xs text-gray-500">최고 성능 프로젝트</span>
                      </div>
                      <div className="text-sm font-bold text-amber-600 truncate">
                        {dashboardStats.topProject?.name ?? "—"}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* 프로젝트별 성능 비교 테이블 */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-dogolf-green" />
                    프로젝트별 AI 엔진 성능 비교
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!statsData || statsData.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      등록된 프로젝트가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(statsData as any[]).map((project) => (
                        <div
                          key={project.id}
                          className={`rounded-xl border p-4 transition-all ${
                            project.isDefault ? "border-amber-200 bg-amber-50/30" : "border-gray-100 bg-gray-50/50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {project.isDefault && <Star className="w-4 h-4 text-amber-500 fill-amber-400" />}
                              <span className="font-semibold text-sm text-gray-900">{project.name}</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${
                                  project.isActive ? "border-green-300 text-green-600" : "border-gray-300 text-gray-400"
                                }`}
                              >
                                {project.isActive ? "활성" : "비활성"}
                              </Badge>
                            </div>
                            {project.stats ? (
                              <span className="text-xs text-gray-400">
                                {project.stats.totalRequests}건 · 완료 {project.stats.completedRequests}건
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">데이터 없음</span>
                            )}
                          </div>

                          {project.stats ? (
                            <div className="space-y-2">
                              {/* 정확도 게이지 */}
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 w-16 shrink-0">AI 정확도</span>
                                <div className="flex-1">
                                  <AccuracyGauge value={project.stats.avgAccuracy} />
                                </div>
                                <span className="text-xs text-gray-400 shrink-0">
                                  {project.stats.evaluatedCount}건 평가됨
                                </span>
                              </div>

                              {/* 카테고리 분포 */}
                              {(project.stats.bugCount + project.stats.suggestionCount + project.stats.otherCount) > 0 && (
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-gray-500 w-16 shrink-0">피드백</span>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {project.stats.bugCount > 0 && (
                                      <span className="flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5">
                                        <Bug className="w-3 h-3" />
                                        버그 {project.stats.bugCount}
                                      </span>
                                    )}
                                    {project.stats.suggestionCount > 0 && (
                                      <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5">
                                        <Lightbulb className="w-3 h-3" />
                                        개선제안 {project.stats.suggestionCount}
                                      </span>
                                    )}
                                    {project.stats.otherCount > 0 && (
                                      <span className="flex items-center gap-1 text-xs bg-slate-50 text-slate-500 border border-slate-200 rounded-full px-2 py-0.5">
                                        <HelpCircle className="w-3 h-3" />
                                        기타 {project.stats.otherCount}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400 italic">
                              {project.manusProjectId
                                ? "이 프로젝트로 연결된 개발 요청이 없습니다."
                                : "Manus 프로젝트 ID가 설정되지 않았습니다."}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── 생성/수정 다이얼로그 ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-dogolf-green" />
              {editingId !== null ? "프로젝트 수정" : "새 프로젝트 추가"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">
                  프로젝트 이름 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="예: 두골프 ERP"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug" className="text-sm font-medium">
                  슬러그 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="slug"
                  placeholder="예: dogolf-erp"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-medium">설명</Label>
              <Textarea
                id="description"
                placeholder="프로젝트에 대한 간단한 설명"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Manus 연동 정보 */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <Settings2 className="w-4 h-4 text-dogolf-green" />
                Manus 연동 정보
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="manusProjectId" className="text-sm font-medium">Manus 프로젝트 ID</Label>
                  <Input
                    id="manusProjectId"
                    placeholder="예: GVziMvdQmQTJAbrZbBGmnr"
                    value={form.manusProjectId}
                    onChange={(e) => setForm({ ...form, manusProjectId: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manusWebdevPath" className="text-sm font-medium">WebDev 경로</Label>
                  <Input
                    id="manusWebdevPath"
                    placeholder="예: /home/ubuntu/dogolf"
                    value={form.manusWebdevPath}
                    onChange={(e) => setForm({ ...form, manusWebdevPath: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="manusDeployUrl" className="text-sm font-medium">배포 URL</Label>
                <Input
                  id="manusDeployUrl"
                  placeholder="예: https://dogolf-tour-dkz3fsmp.manus.space"
                  value={form.manusDeployUrl}
                  onChange={(e) => setForm({ ...form, manusDeployUrl: e.target.value })}
                />
              </div>
            </div>

            {/* 기술 스택 */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-dogolf-green" />
                기술 스택 및 파일 정보
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="techStack" className="text-sm font-medium">기술 스택</Label>
                  <Input
                    id="techStack"
                    placeholder="예: React 19 + Tailwind 4 + Express 4 + tRPC 11 + MySQL"
                    value={form.techStack}
                    onChange={(e) => setForm({ ...form, techStack: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="keyFiles" className="text-sm font-medium">핵심 파일 목록</Label>
                  <Textarea
                    id="keyFiles"
                    placeholder="예: server/routers.ts, client/src/App.tsx, drizzle/schema.ts"
                    value={form.keyFiles}
                    onChange={(e) => setForm({ ...form, keyFiles: e.target.value })}
                    rows={3}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* AI 컨텍스트 */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-dogolf-green" />
                AI 개발 컨텍스트
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="devInstructions" className="text-sm font-medium">개발 절차 / 규칙</Label>
                  <Textarea
                    id="devInstructions"
                    placeholder="AI가 이 프로젝트를 개발할 때 따라야 할 절차나 규칙을 입력하세요."
                    value={form.devInstructions}
                    onChange={(e) => setForm({ ...form, devInstructions: e.target.value })}
                    rows={4}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customContext" className="text-sm font-medium">커스텀 컨텍스트</Label>
                  <Textarea
                    id="customContext"
                    placeholder="프로젝트 특화 배경 정보, 비즈니스 규칙, 주의사항 등을 입력하세요."
                    value={form.customContext}
                    onChange={(e) => setForm({ ...form, customContext: e.target.value })}
                    rows={4}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 상태 설정 */}
            <div className="border-t pt-4 flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <Label htmlFor="isActive" className="text-sm font-medium cursor-pointer">활성화</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="isDefault"
                  checked={form.isDefault}
                  onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
                />
                <Label htmlFor="isDefault" className="text-sm font-medium cursor-pointer">기본 프로젝트로 설정</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null); setForm(emptyForm); }}>
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isMutating}
              className="bg-dogolf-green hover:bg-dogolf-green-dark text-white"
            >
              {isMutating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingId !== null ? "수정 저장" : "프로젝트 추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 삭제 확인 다이얼로그 ── */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              프로젝트 삭제
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            이 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>취소</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId !== null && deleteMutation.mutate({ id: deleteConfirmId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 컨텍스트 복사 다이얼로그 ── */}
      <Dialog open={copyCtxOpen} onOpenChange={(open) => { if (!open) setCopyCtxOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-purple-600" />
              프로젝트 컨텍스트 공유
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              한 프로젝트의 AI 개발 컨텍스트(개발 절차, 커스텀 컨텍스트 등)를 다른 프로젝트로 복사합니다.
            </p>

            {/* 원본 프로젝트 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">원본 프로젝트 (복사 출처)</Label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-dogolf-green/30"
                value={copyCtxFromId ?? ""}
                onChange={(e) => setCopyCtxFromId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">선택하세요</option>
                {projects?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* 화살표 */}
            <div className="flex justify-center">
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>

            {/* 대상 프로젝트 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">대상 프로젝트 (복사 대상)</Label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-dogolf-green/30"
                value={copyCtxToId ?? ""}
                onChange={(e) => setCopyCtxToId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">선택하세요</option>
                {projects?.filter((p: any) => p.id !== copyCtxFromId).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* 복사할 필드 선택 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">복사할 필드</Label>
              {[
                { key: "devInstructions", label: "개발 절차 / 규칙" },
                { key: "customContext", label: "커스텀 컨텍스트" },
                { key: "keyFiles", label: "핵심 파일 목록" },
                { key: "techStack", label: "기술 스택" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyCtxFields.includes(key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCopyCtxFields([...copyCtxFields, key]);
                      } else {
                        setCopyCtxFields(copyCtxFields.filter((f) => f !== key));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyCtxOpen(false)}>취소</Button>
            <Button
              onClick={handleCopyContext}
              disabled={copyContextMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {copyContextMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              컨텍스트 복사
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
