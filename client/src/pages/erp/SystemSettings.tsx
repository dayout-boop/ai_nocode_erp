/**
 * ERP 시스템 설정 페이지
 * - Manus 태스크 후보 관리 (추가/수정/삭제)
 * - MANUS_DOGOLF_TASK_ID 기본 설정
 * - 태스크 라우팅 현황 확인
 */
import { useState } from "react";
import { Plus, Trash2, Edit2, CheckCircle2, Star, GitBranch, Settings, Loader2, X, Save, KeyRound, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────
type TaskType = "erp" | "homepage" | "new_project" | "other";

interface TaskCandidate {
  id: number;
  taskId: string;
  taskName: string;
  projectName?: string | null;
  description?: string | null;
  taskType: TaskType;
  isDefault: boolean;
  isActive: boolean;
  useCount?: number | null;
  lastUsedAt?: Date | null;
  createdAt?: Date | null;
}

const TASK_TYPE_LABELS: Record<TaskType, { label: string; color: string }> = {
  erp: { label: "ERP", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  homepage: { label: "홈페이지", color: "bg-green-100 text-green-700 border-green-200" },
  new_project: { label: "신규 프로젝트", color: "bg-purple-100 text-purple-700 border-purple-200" },
  other: { label: "기타", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

const emptyForm = {
  taskId: "",
  taskName: "",
  projectName: "",
  description: "",
  taskType: "erp" as TaskType,
  isDefault: false,
};

// ─── 태스크 추가/수정 다이얼로그 ─────────────────────────────────────────────
function TaskCandidateDialog({
  open,
  onClose,
  editTarget,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  editTarget: TaskCandidate | null;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState(() =>
    editTarget
      ? {
          taskId: editTarget.taskId,
          taskName: editTarget.taskName,
          projectName: editTarget.projectName ?? "",
          description: editTarget.description ?? "",
          taskType: editTarget.taskType,
          isDefault: editTarget.isDefault,
        }
      : { ...emptyForm }
  );

  const utils = trpc.useUtils();

  const addMutation = trpc.systemSettings.addTaskCandidate.useMutation({
    onSuccess: () => {
      toast.success("태스크 후보가 추가되었습니다.");
      utils.systemSettings.listTaskCandidates.invalidate();
      onSuccess();
      onClose();
    },
    onError: (e) => toast.error(`추가 실패: ${e.message}`),
  });

  const updateMutation = trpc.systemSettings.updateTaskCandidate.useMutation({
    onSuccess: () => {
      toast.success("태스크 후보가 수정되었습니다.");
      utils.systemSettings.listTaskCandidates.invalidate();
      onSuccess();
      onClose();
    },
    onError: (e) => toast.error(`수정 실패: ${e.message}`),
  });

  const handleSubmit = () => {
    if (!form.taskId.trim() || !form.taskName.trim()) {
      toast.error("태스크 ID와 이름은 필수입니다.");
      return;
    }
    if (editTarget) {
      updateMutation.mutate({
        id: editTarget.id,
        taskName: form.taskName,
        projectName: form.projectName || undefined,
        description: form.description || undefined,
        taskType: form.taskType,
        isDefault: form.isDefault,
      });
    } else {
      addMutation.mutate({
        taskId: form.taskId,
        taskName: form.taskName,
        projectName: form.projectName || undefined,
        description: form.description || undefined,
        taskType: form.taskType,
        isDefault: form.isDefault,
      });
    }
  };

  const isPending = addMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-800">
            <GitBranch size={16} className="text-indigo-600" />
            {editTarget ? "태스크 후보 수정" : "태스크 후보 추가"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Manus 태스크 ID <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.taskId}
              onChange={(e) => setForm((f) => ({ ...f, taskId: e.target.value }))}
              placeholder="예: hNUzrtQfkbnQkVX9BUZeeM"
              disabled={!!editTarget}
              className="font-mono text-sm"
            />
            {!editTarget && (
              <p className="text-[10px] text-gray-400 mt-0.5">Manus 대화창 URL에서 확인 가능합니다.</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              태스크 이름 <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.taskName}
              onChange={(e) => setForm((f) => ({ ...f, taskName: e.target.value }))}
              placeholder="예: 두골프 ERP 개발 (메인)"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">프로젝트명</label>
            <Input
              value={form.projectName}
              onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
              placeholder="예: dogolf-tour-dkz3fsmp.manus.space"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">태스크 유형</label>
            <Select
              value={form.taskType}
              onValueChange={(v) => setForm((f) => ({ ...f, taskType: v as TaskType }))}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="erp">ERP (백오피스 관리 시스템)</SelectItem>
                <SelectItem value="homepage">홈페이지 (프론트엔드)</SelectItem>
                <SelectItem value="new_project">신규 프로젝트</SelectItem>
                <SelectItem value="other">기타</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">설명</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="이 태스크에서 처리하는 작업 범위를 간략히 설명하세요."
              className="text-sm resize-none"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              className="w-4 h-4 accent-indigo-600"
            />
            <label htmlFor="isDefault" className="text-sm text-gray-700 cursor-pointer">
              기본 태스크로 설정
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            <X size={13} className="mr-1" />취소
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isPending ? (
              <><Loader2 size={13} className="animate-spin mr-1" />저장 중...</>
            ) : (
              <><Save size={13} className="mr-1" />{editTarget ? "수정" : "추가"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
// ─── 자동 완료 키워드 튜닝 섹션 ─────────────────────────────────────────────
function CompletionKeywordsSection() {
  const { data, isLoading, refetch } = trpc.systemSettings.getCompletionKeywords.useQuery();
  const updateMutation = trpc.systemSettings.updateCompletionKeywords.useMutation({
    onSuccess: () => {
      toast.success("키워드가 저장되었습니다");
      refetch();
      setEditMode(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const resetMutation = trpc.systemSettings.resetCompletionKeywords.useMutation({
    onSuccess: (res) => {
      toast.success("기본값으로 초기화되었습니다");
      setKeywords(res.keywords);
      refetch();
      setEditMode(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const [editMode, setEditMode] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");

  const currentKeywords = data?.keywords ?? [];

  const handleEdit = () => {
    setKeywords([...currentKeywords]);
    setEditMode(true);
  };

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    if (keywords.includes(trimmed)) {
      toast.warning("이미 등록된 키워드입니다");
      return;
    }
    setKeywords([...keywords, trimmed]);
    setNewKeyword("");
  };

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  const handleSave = () => {
    if (keywords.length === 0) {
      toast.warning("키워드를 최소 1개 이상 등록해야 합니다");
      return;
    }
    updateMutation.mutate({ keywords });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <KeyRound size={15} className="text-amber-600" />
            자동 완료 감지 키워드
            {data?.isCustom && (
              <span className="text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                커스텀
              </span>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {!editMode ? (
              <>
                <Button size="sm" variant="outline" onClick={handleEdit} className="h-7 text-xs gap-1">
                  <Edit2 size={11} /> 편집
                </Button>
                {data?.isCustom && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resetMutation.mutate()}
                    disabled={resetMutation.isPending}
                    className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <RotateCcw size={11} /> 초기화
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {updateMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                  저장
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditMode(false)}
                  className="h-7 text-xs gap-1"
                >
                  <X size={11} /> 취소
                </Button>
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Manus AI 응답에 아래 키워드가 포함되면 해당 개발 요청이 자동으로 <strong>완료</strong> 처리됩니다.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 size={14} className="animate-spin" />
            키워드 로딩 중...
          </div>
        ) : editMode ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                placeholder="새 키워드 입력 후 Enter"
                className="h-8 text-xs"
              />
              <Button size="sm" onClick={handleAddKeyword} className="h-8 text-xs shrink-0">
                <Plus size={12} /> 추가
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1 rounded-full"
                >
                  {kw}
                  <button
                    onClick={() => handleRemoveKeyword(kw)}
                    className="text-amber-400 hover:text-red-500 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">총 {keywords.length}개 키워드</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {currentKeywords.map((kw: string) => (
              <span
                key={kw}
                className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full"
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SystemSettings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TaskCandidate | null>(null);
  const [manusTaskIdInput, setManusTaskIdInput] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(false);

  const utils = trpc.useUtils();

  const { data: candidates = [], isLoading } = trpc.systemSettings.listTaskCandidates.useQuery(
    { activeOnly: false }
  );

  const { data: manusTaskIdData, refetch: refetchTaskId } = trpc.systemSettings.getManusTaskId.useQuery();

  const setManusTaskIdMutation = trpc.systemSettings.setManusTaskId.useMutation({
    onSuccess: () => {
      toast.success("MANUS_DOGOLF_TASK_ID가 저장되었습니다.");
      refetchTaskId();
      setEditingTaskId(false);
    },
    onError: (e) => toast.error(`저장 실패: ${e.message}`),
  });

  const deleteMutation = trpc.systemSettings.deleteTaskCandidate.useMutation({
    onSuccess: () => {
      toast.success("태스크 후보가 비활성화되었습니다.");
      utils.systemSettings.listTaskCandidates.invalidate();
    },
    onError: (e) => toast.error(`삭제 실패: ${e.message}`),
  });

  const setActiveMutation = trpc.systemSettings.updateTaskCandidate.useMutation({
    onSuccess: () => {
      toast.success("변경되었습니다.");
      utils.systemSettings.listTaskCandidates.invalidate();
    },
    onError: (e) => toast.error(`변경 실패: ${e.message}`),
  });

  const handleOpenAdd = () => {
    setEditTarget(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (c: TaskCandidate) => {
    setEditTarget(c);
    setDialogOpen(true);
  };

  const activeCount = (candidates as TaskCandidate[]).filter((c) => c.isActive).length;
  const defaultTask = (candidates as TaskCandidate[]).find((c) => c.isDefault && c.isActive);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Settings size={20} className="text-indigo-600" />
            시스템 설정
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manus 태스크 라우팅 및 개발 요청 파이프라인을 관리합니다.
          </p>
        </div>
        <Button
          onClick={handleOpenAdd}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          size="sm"
        >
          <Plus size={14} className="mr-1" />
          태스크 추가
        </Button>
      </div>

      {/* MANUS_DOGOLF_TASK_ID 설정 */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-amber-800 flex items-center gap-2">
            <Star size={14} className="text-amber-600" />
            MANUS_DOGOLF_TASK_ID (기본 라우팅 대상)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <p className="text-xs text-amber-700">
            이 태스크 ID로 개발 요청이 기본 라우팅됩니다. DB 값이 환경변수보다 우선 적용됩니다.
          </p>
          {manusTaskIdData && (
            <div className="flex items-center gap-2">
              <Badge
                className={`text-xs border ${
                  manusTaskIdData.source === "db"
                    ? "bg-green-100 text-green-700 border-green-200"
                    : "bg-gray-100 text-gray-600 border-gray-200"
                }`}
              >
                {manusTaskIdData.source === "db" ? "DB 설정" : "환경변수"}
              </Badge>
              <span className="font-mono text-sm text-gray-800">
                {manusTaskIdData.taskId ?? "미설정"}
              </span>
            </div>
          )}
          {editingTaskId ? (
            <div className="flex gap-2">
              <Input
                value={manusTaskIdInput}
                onChange={(e) => setManusTaskIdInput(e.target.value)}
                placeholder="Manus 태스크 ID 입력"
                className="font-mono text-sm flex-1"
              />
              <Button
                size="sm"
                onClick={() => setManusTaskIdMutation.mutate({ taskId: manusTaskIdInput })}
                disabled={!manusTaskIdInput.trim() || setManusTaskIdMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {setManusTaskIdMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingTaskId(false)}>
                <X size={13} />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setManusTaskIdInput(manusTaskIdData?.taskId ?? "");
                setEditingTaskId(true);
              }}
              className="text-amber-700 border-amber-300 hover:bg-amber-100"
            >
              <Edit2 size={12} className="mr-1" />
              변경
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border-indigo-100">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-gray-500">활성 태스크</p>
            <p className="text-2xl font-bold text-indigo-700">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="border-green-100">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-gray-500">기본 태스크</p>
            <p className="text-sm font-semibold text-green-700 truncate mt-1">
              {defaultTask?.taskName ?? "미설정"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-purple-100">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-gray-500">전체 태스크</p>
            <p className="text-2xl font-bold text-purple-700">{(candidates as TaskCandidate[]).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* 태스크 후보 목록 */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <GitBranch size={14} className="text-indigo-600" />
            Manus 태스크 후보 목록
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 size={16} className="animate-spin mr-2" />
              로딩 중...
            </div>
          ) : (candidates as TaskCandidate[]).length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <GitBranch size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">등록된 태스크 후보가 없습니다.</p>
              <p className="text-xs mt-1">위의 "태스크 추가" 버튼으로 추가하세요.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(candidates as TaskCandidate[]).map((c) => {
                const typeInfo = TASK_TYPE_LABELS[c.taskType] ?? TASK_TYPE_LABELS.other;
                return (
                  <div
                    key={c.id}
                    className={`rounded-lg border px-4 py-3 ${
                      !c.isActive ? "opacity-50 bg-gray-50" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="font-semibold text-sm text-gray-800">{c.taskName}</span>
                          {c.isDefault && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 border px-1.5 py-0">
                              <Star size={8} className="mr-0.5" />기본
                            </Badge>
                          )}
                          {!c.isActive && (
                            <Badge className="text-[10px] bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0">
                              비활성
                            </Badge>
                          )}
                          <Badge className={`text-[10px] border px-1.5 py-0 ${typeInfo.color}`}>
                            {typeInfo.label}
                          </Badge>
                        </div>
                        {c.projectName && (
                          <p className="text-xs text-gray-500">{c.projectName}</p>
                        )}
                        {c.description && (
                          <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>
                        )}
                        <p className="text-[10px] text-gray-400 font-mono mt-1">{c.taskId}</p>
                        {c.useCount != null && c.useCount > 0 && (
                          <p className="text-[10px] text-indigo-400 mt-0.5">{c.useCount}회 사용</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!c.isDefault && c.isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveMutation.mutate({ id: c.id, isDefault: true })}
                            className="h-7 px-2 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                            title="기본 태스크로 설정"
                          >
                            <Star size={11} />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(c)}
                          className="h-7 px-2 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        >
                          <Edit2 size={11} />
                        </Button>
                        {c.isActive ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteMutation.mutate({ id: c.id })}
                            className="h-7 px-2 text-xs text-red-500 border-red-200 hover:bg-red-50"
                            title="비활성화"
                          >
                            <Trash2 size={11} />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveMutation.mutate({ id: c.id, isActive: true })}
                            className="h-7 px-2 text-xs text-green-600 border-green-200 hover:bg-green-50"
                            title="활성화"
                          >
                            <CheckCircle2 size={11} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 자동 완료 키워드 튜닝 */}
      <CompletionKeywordsSection />
      {/* 라우팅 가이드 */}
      <Card className="border-blue-100 bg-blue-50">
        <CardContent className="px-4 py-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
            <GitBranch size={13} />
            3단계 라우팅 프로세스
          </h3>
          <ol className="space-y-1.5 text-xs text-blue-700">
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-500 shrink-0">0.</span>
              <span><strong>UI 선택 우선</strong> — 두골프 마스터 채팅에서 사용자가 직접 태스크를 선택하면 해당 태스크로 즉시 전송</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-500 shrink-0">1.</span>
              <span><strong>동일 모듈 활성 태스크</strong> — 같은 모듈에서 진행 중인 태스크가 있으면 기존 스레드에 추가 (크레딧 절약)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-500 shrink-0">2.</span>
              <span><strong>신규 태스크 생성</strong> — 적합한 태스크가 없으면 새 Manus 태스크를 생성하여 전송</span>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* 태스크 추가/수정 다이얼로그 */}
      <TaskCandidateDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditTarget(null);
        }}
        editTarget={editTarget}
        onSuccess={() => {
          utils.systemSettings.listTaskCandidates.invalidate();
        }}
      />
    </div>
  );
}
