/**
 * ManagedProjects.tsx
 * 두골프 마스터 AI 오케스트라 - 관리 프로젝트 목록 및 CRUD UI
 * 1000개 이상의 Manus WebDev 프로젝트를 중앙에서 관리
 */
import { useState } from "react";
import {
  Plus, Pencil, Trash2, Star, StarOff, ExternalLink,
  FolderOpen, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp,
  Code2, Globe, BookOpen, Settings2,
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
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function ManagedProjects() {
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProjectFormData>(emptyForm);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // ─── API ───────────────────────────────────────────────────────────────────
  const { data: projects, isLoading } = trpc.managedProjects.list.useQuery();

  const createMutation = trpc.managedProjects.create.useMutation({
    onSuccess: () => {
      toast.success("프로젝트가 생성되었습니다.");
      utils.managedProjects.list.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.managedProjects.update.useMutation({
    onSuccess: () => {
      toast.success("프로젝트가 수정되었습니다.");
      utils.managedProjects.list.invalidate();
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
      setDeleteConfirmId(null);
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

  const isMutating = createMutation.isPending || updateMutation.isPending;

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

      {/* 통계 카드 */}
      {projects && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-gray-900">{projects.length}</div>
              <div className="text-xs text-gray-500 mt-1">전체 프로젝트</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-green-600">
                {projects.filter((p: any) => p.isActive).length}
              </div>
              <div className="text-xs text-gray-500 mt-1">활성 프로젝트</div>
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
              <div className="text-xs text-gray-500 mt-1">배포된 프로젝트</div>
            </CardContent>
          </Card>
        </div>
      )}

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

      {/* 생성/수정 다이얼로그 */}
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
                  className="font-mono"
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
                    placeholder={"예:\n- server/routers.ts: tRPC 라우터\n- drizzle/schema.ts: DB 스키마\n- client/src/App.tsx: 라우트"}
                    value={form.keyFiles}
                    onChange={(e) => setForm({ ...form, keyFiles: e.target.value })}
                    rows={4}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 개발 절차 */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-dogolf-green" />
                AI 컨텍스트
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="devInstructions" className="text-sm font-medium">개발 절차 / 주의사항</Label>
                  <Textarea
                    id="devInstructions"
                    placeholder={"예:\n1. schema.ts 수정 후 pnpm db:push\n2. server/routers.ts에 프로시저 추가\n3. 클라이언트 UI 구현\n4. TypeScript 오류 확인 후 체크포인트 저장"}
                    value={form.devInstructions}
                    onChange={(e) => setForm({ ...form, devInstructions: e.target.value })}
                    rows={5}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customContext" className="text-sm font-medium">커스텀 컨텍스트 (AI 프롬프트에 주입)</Label>
                  <Textarea
                    id="customContext"
                    placeholder="AI가 개발 요청을 처리할 때 참고할 추가 컨텍스트 (비즈니스 규칙, 코딩 컨벤션 등)"
                    value={form.customContext}
                    onChange={(e) => setForm({ ...form, customContext: e.target.value })}
                    rows={4}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 상태 토글 */}
            <div className="border-t pt-4 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <Label htmlFor="isActive" className="text-sm cursor-pointer">
                  활성화
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isDefault"
                  checked={form.isDefault}
                  onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
                />
                <Label htmlFor="isDefault" className="text-sm cursor-pointer">
                  기본 프로젝트 (개발 요청 전송 시 사용)
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDialogOpen(false); setEditingId(null); setForm(emptyForm); }}
              disabled={isMutating}
            >
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isMutating}
              className="bg-dogolf-green hover:bg-dogolf-green-dark text-white gap-2"
            >
              {isMutating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 저장 중...</>
              ) : editingId !== null ? (
                <><CheckCircle2 className="w-4 h-4" /> 수정 저장</>
              ) : (
                <><Plus className="w-4 h-4" /> 프로젝트 추가</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              프로젝트 삭제
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            이 프로젝트를 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId !== null && deleteMutation.mutate({ id: deleteConfirmId })}
              disabled={deleteMutation.isPending}
              className="gap-2"
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 삭제 중...</>
              ) : (
                <><Trash2 className="w-4 h-4" /> 삭제</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
