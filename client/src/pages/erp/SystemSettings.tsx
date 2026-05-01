// ============================================================
// ERP 시스템 설정 페이지
// MANUS_DOGOLF_TASK_ID 등 핵심 운영 설정을 관리자가 UI에서 직접 변경
// ============================================================

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings,
  ExternalLink,
  RefreshCw,
  Save,
  AlertTriangle,
  CheckCircle2,
  Database,
  Cpu,
  Trash2,
  Plus,
  Edit2,
} from "lucide-react";

export default function SystemSettings() {
  const utils = trpc.useUtils();
  // ─── 데이터 조회 ───────────────────────────────────────────────────────────
  const { data: settingsData, isLoading } = trpc.systemSettings.list.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const { data: activeManusTask, refetch: refetchManusTask } =
    trpc.systemSettings.getActiveManusTaskId.useQuery();

  // ─── 뮤테이션 ─────────────────────────────────────────────────────────────
  const updateManusTaskId = trpc.systemSettings.updateManusTaskId.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ Manus 태스크 ID 업데이트 완료: ${data.taskId}`);
      utils.systemSettings.list.invalidate();
      utils.systemSettings.getActiveManusTaskId.invalidate();
      setManusTaskIdInput("");
      setEditManusTaskId(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const upsertSetting = trpc.systemSettings.upsert.useMutation({
    onSuccess: () => {
      toast.success("설정 저장 완료");
      utils.systemSettings.list.invalidate();
      setUpsertDialog(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteSetting = trpc.systemSettings.delete.useMutation({
    onSuccess: () => {
      toast.success("설정 삭제 완료");
      utils.systemSettings.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // ─── 로컬 상태 ────────────────────────────────────────────────────────────
  const [manusTaskIdInput, setManusTaskIdInput] = useState("");
  const [editManusTaskId, setEditManusTaskId] = useState(false);
  const [upsertDialog, setUpsertDialog] = useState(false);
  const [upsertForm, setUpsertForm] = useState({ key: "", value: "", description: "" });
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);

  const settings = settingsData?.settings ?? [];
  const envValues = settingsData?.envValues ?? {};
  const descriptions = settingsData?.descriptions ?? {};

  // ─── 렌더링 ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  const activeTaskId = activeManusTask?.activeValue;
  const activeTaskSource = activeManusTask?.source;

  return (
    <div className="space-y-6 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings size={24} className="text-dogolf-green" />
            시스템 설정
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            ERP 핵심 운영 설정을 관리합니다. 변경 사항은 즉시 적용됩니다.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            utils.systemSettings.list.invalidate();
            refetchManusTask();
          }}
        >
          <RefreshCw size={14} className="mr-1" />
          새로고침
        </Button>
      </div>

      {/* ─── Manus 태스크 ID 설정 카드 (핵심) ─────────────────────────────── */}
      <Card className="border-2 border-dogolf-green/30 bg-green-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-dogolf-green">
            <Cpu size={20} />
            Manus 개발 대화창 연결 설정
          </CardTitle>
          <CardDescription>
            개발 요청이 전송될 Manus 대화창 태스크 ID를 설정합니다.
            설정 시 모든 개발 요청이 새 태스크를 생성하지 않고 이 대화창으로 직접 전송됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 현재 활성 태스크 ID 표시 */}
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">현재 활성 태스크 ID</span>
              <div className="flex items-center gap-2">
                {activeTaskSource === "db" && (
                  <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
                    <Database size={10} className="mr-1" />
                    DB 설정
                  </Badge>
                )}
                {activeTaskSource === "env" && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                    환경변수
                  </Badge>
                )}
                {activeTaskSource === "none" && (
                  <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
                    <AlertTriangle size={10} className="mr-1" />
                    미설정
                  </Badge>
                )}
              </div>
            </div>

            {activeTaskId ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono text-gray-800">
                  {activeTaskId}
                </code>
                <a
                  href={`https://manus.im/app/${activeTaskId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink size={14} className="mr-1" />
                    열기
                  </Button>
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setManusTaskIdInput(activeTaskId);
                    setEditManusTaskId(true);
                  }}
                >
                  <Edit2 size={14} className="mr-1" />
                  변경
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertTriangle size={14} />
                <span>태스크 ID가 설정되지 않았습니다. 개발 요청이 새 태스크로 생성됩니다.</span>
              </div>
            )}

            {activeManusTask?.updatedBy && (
              <p className="text-xs text-gray-400">
                마지막 변경: {activeManusTask.updatedBy}
                {activeManusTask.updatedAt &&
                  ` · ${new Date(activeManusTask.updatedAt).toLocaleString("ko-KR")}`}
              </p>
            )}
          </div>

          {/* 환경변수 vs DB 비교 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-orange-50 border border-orange-200 rounded p-3">
              <p className="font-semibold text-orange-700 mb-1">환경변수 값</p>
              <code className="text-orange-600 text-xs break-all">
                {envValues.MANUS_DOGOLF_TASK_ID || "(없음)"}
              </code>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="font-semibold text-blue-700 mb-1">DB 설정 값 (우선 적용)</p>
              <code className="text-blue-600 text-xs break-all">
                {settings.find((s) => s.settingKey === "MANUS_DOGOLF_TASK_ID")?.settingValue || "(없음)"}
              </code>
            </div>
          </div>

          {/* 태스크 ID 입력 폼 */}
          {(editManusTaskId || !activeTaskId) && (
            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-semibold">
                새 Manus 태스크 ID 입력
              </Label>
              <p className="text-xs text-gray-500">
                Manus 대화창 URL에서 태스크 ID를 복사하세요.
                예: <code className="bg-gray-100 px-1 rounded">https://manus.im/app/hNUzrtQfkbnQkVX9BUZeeM</code>
                → <code className="bg-gray-100 px-1 rounded">hNUzrtQfkbnQkVX9BUZeeM</code>
              </p>
              <div className="flex gap-2">
                <Input
                  value={manusTaskIdInput}
                  onChange={(e) => setManusTaskIdInput(e.target.value)}
                  placeholder="예: hNUzrtQfkbnQkVX9BUZeeM"
                  className="font-mono text-sm"
                />
                <Button
                  onClick={() => {
                    if (!manusTaskIdInput.trim()) return;
                    updateManusTaskId.mutate({ taskId: manusTaskIdInput.trim() });
                  }}
                  disabled={updateManusTaskId.isPending || !manusTaskIdInput.trim()}
                  className="bg-dogolf-green hover:bg-dogolf-green-dark text-white"
                >
                  {updateManusTaskId.isPending ? (
                    <RefreshCw size={14} className="animate-spin mr-1" />
                  ) : (
                    <Save size={14} className="mr-1" />
                  )}
                  저장
                </Button>
                {editManusTaskId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditManusTaskId(false);
                      setManusTaskIdInput("");
                    }}
                  >
                    취소
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 전체 시스템 설정 목록 ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database size={18} />
                DB 저장 설정 목록
              </CardTitle>
              <CardDescription>
                DB에 저장된 설정 값들입니다. 환경변수보다 우선 적용됩니다.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setUpsertForm({ key: "", value: "", description: "" });
                setUpsertDialog(true);
              }}
            >
              <Plus size={14} className="mr-1" />
              설정 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {settings.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Database size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">저장된 설정이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {settings.map((setting) => (
                <div
                  key={setting.settingKey}
                  className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono font-semibold text-gray-800">
                        {setting.settingKey}
                      </code>
                      <CheckCircle2 size={12} className="text-green-500" />
                    </div>
                    <code className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded break-all">
                      {setting.settingValue || "(빈 값)"}
                    </code>
                    {descriptions[setting.settingKey] && (
                      <p className="text-xs text-gray-500 mt-1">
                        {descriptions[setting.settingKey]}
                      </p>
                    )}
                    {setting.updatedBy && (
                      <p className="text-xs text-gray-400 mt-1">
                        변경: {setting.updatedBy}
                        {setting.updatedAt &&
                          ` · ${new Date(setting.updatedAt).toLocaleString("ko-KR")}`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-3 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUpsertForm({
                          key: setting.settingKey,
                          value: setting.settingValue ?? "",
                          description: setting.description ?? "",
                        });
                        setUpsertDialog(true);
                      }}
                    >
                      <Edit2 size={12} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => setDeleteConfirmKey(setting.settingKey)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 설정 추가/수정 다이얼로그 ─────────────────────────────────────── */}
      <Dialog open={upsertDialog} onOpenChange={setUpsertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {upsertForm.key ? "설정 수정" : "설정 추가"}
            </DialogTitle>
            <DialogDescription>
              DB에 저장된 설정은 환경변수보다 우선 적용됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>설정 키</Label>
              <Input
                value={upsertForm.key}
                onChange={(e) => setUpsertForm((f) => ({ ...f, key: e.target.value }))}
                placeholder="예: MANUS_DOGOLF_TASK_ID"
                className="font-mono"
                disabled={!!settings.find((s) => s.settingKey === upsertForm.key)}
              />
            </div>
            <div className="space-y-1">
              <Label>설정 값</Label>
              <Input
                value={upsertForm.value}
                onChange={(e) => setUpsertForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="설정 값 입력"
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label>설명 (선택)</Label>
              <Input
                value={upsertForm.description}
                onChange={(e) =>
                  setUpsertForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="이 설정의 용도를 설명하세요"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpsertDialog(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                if (!upsertForm.key.trim() || !upsertForm.value.trim()) return;
                upsertSetting.mutate({
                  key: upsertForm.key.trim(),
                  value: upsertForm.value.trim(),
                  description: upsertForm.description,
                });
              }}
              disabled={upsertSetting.isPending}
            >
              {upsertSetting.isPending ? (
                <RefreshCw size={14} className="animate-spin mr-1" />
              ) : (
                <Save size={14} className="mr-1" />
              )}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 삭제 확인 다이얼로그 ──────────────────────────────────────────── */}
      <Dialog
        open={!!deleteConfirmKey}
        onOpenChange={() => setDeleteConfirmKey(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">설정 삭제 확인</DialogTitle>
            <DialogDescription>
              <code className="bg-gray-100 px-2 py-1 rounded font-mono">
                {deleteConfirmKey}
              </code>{" "}
              설정을 삭제하시겠습니까?
              <br />
              삭제 후에는 환경변수 값이 사용됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmKey(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirmKey) {
                  deleteSetting.mutate({ key: deleteConfirmKey });
                  setDeleteConfirmKey(null);
                }
              }}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
