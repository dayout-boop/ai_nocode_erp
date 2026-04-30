/**
 * CMS > 자동 치환 변수 관리
 * 시스템 기본 변수 + 커스텀 변수 CRUD 관리
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Download, Info, Lock, Code2 } from "lucide-react";

type Variable = {
  id: number;
  category: string;
  label: string;
  variableKey: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number | null;
};

const SYSTEM_CATEGORIES = [
  "고객 정보",
  "예약 정보",
  "골프 정보",
  "숙박 정보",
  "금액 정보",
  "담당자 정보",
  "일정 정보",
];

function VariableKeyBadge({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-xs hover:bg-indigo-100 transition-colors"
      title="클릭하여 복사"
    >
      <Code2 size={10} />
      {copied ? "복사됨!" : value}
    </button>
  );
}

type FormData = {
  category: string;
  customCategory: string;
  label: string;
  variableKey: string;
  description: string;
  sortOrder: string;
};

const EMPTY_FORM: FormData = {
  category: "",
  customCategory: "",
  label: "",
  variableKey: "",
  description: "",
  sortOrder: "0",
};

export default function VariableManagement() {
  const utils = trpc.useUtils();
  const { data: variables = [], isLoading } = trpc.customVariables.list.useQuery();
  const seedMut = trpc.customVariables.seedDefaults.useMutation({
    onSuccess: (res) => {
      toast.success(`기본 변수 ${res.inserted}개가 등록되었습니다.`);
      utils.customVariables.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const createMut = trpc.customVariables.create.useMutation({
    onSuccess: () => {
      toast.success("변수가 등록되었습니다.");
      utils.customVariables.list.invalidate();
      setDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.customVariables.update.useMutation({
    onSuccess: () => {
      toast.success("변수가 수정되었습니다.");
      utils.customVariables.list.invalidate();
      setDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.customVariables.delete.useMutation({
    onSuccess: () => {
      toast.success("변수가 삭제되었습니다.");
      utils.customVariables.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleMut = trpc.customVariables.toggleActive.useMutation({
    onSuccess: () => utils.customVariables.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Variable | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [filterCategory, setFilterCategory] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState<Variable | null>(null);

  // 카테고리 목록 (DB에서 동적으로 수집)
  const allCategories = Array.from(new Set(variables.map((v) => v.category)));

  const filtered = filterCategory === "all"
    ? variables
    : variables.filter((v) => v.category === filterCategory);

  // 카테고리별 그룹화
  const grouped = filtered.reduce<Record<string, Variable[]>>((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {});

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(v: Variable) {
    setEditTarget(v);
    const isCustomCat = !SYSTEM_CATEGORIES.includes(v.category);
    setForm({
      category: isCustomCat ? "__custom__" : v.category,
      customCategory: isCustomCat ? v.category : "",
      label: v.label,
      variableKey: v.variableKey,
      description: v.description ?? "",
      sortOrder: String(v.sortOrder ?? 0),
    });
    setDialogOpen(true);
  }

  function handleFormChange(field: keyof FormData, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // 라벨 입력 시 변수키 자동 완성 (신규 등록 시만)
      if (field === "label" && !editTarget) {
        next.variableKey = `{{${value}}}`;
      }
      return next;
    });
  }

  function getEffectiveCategory() {
    return form.category === "__custom__" ? form.customCategory : form.category;
  }

  function handleSave() {
    const category = getEffectiveCategory();
    if (!category) return toast.error("카테고리를 선택하거나 입력해 주세요.");
    if (!form.label) return toast.error("라벨을 입력해 주세요.");
    if (!form.variableKey.match(/^\{\{.+\}\}$/)) return toast.error("변수 키값은 {{변수명}} 형식이어야 합니다.");

    if (editTarget) {
      updateMut.mutate({
        id: editTarget.id,
        category,
        label: form.label,
        variableKey: form.variableKey,
        description: form.description || undefined,
        sortOrder: Number(form.sortOrder) || 0,
      });
    } else {
      createMut.mutate({
        category,
        label: form.label,
        variableKey: form.variableKey,
        description: form.description || undefined,
        sortOrder: Number(form.sortOrder) || 0,
      });
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Code2 size={22} className="text-indigo-600" />
            자동 치환 변수 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            템플릿에서 사용할 <code className="bg-gray-100 px-1 rounded text-xs">{`{{변수명}}`}</code> 목록을 관리합니다.
            변수 키값을 클릭하면 클립보드에 복사됩니다.
          </p>
        </div>
        <div className="flex gap-2">
          {variables.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedMut.mutate()}
              disabled={seedMut.isPending}
              className="gap-1.5"
            >
              <Download size={14} />
              기본 변수 불러오기
            </Button>
          )}
          <Button size="sm" onClick={openCreate} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus size={14} />
            변수 추가
          </Button>
        </div>
      </div>

      {/* 안내 박스 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex gap-3">
        <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>사용 방법:</strong> 템플릿 내용 입력 시 변수 키값(예: <code className="bg-blue-100 px-1 rounded">{`{{고객명}}`}</code>)을 입력하면 실제 데이터로 자동 치환됩니다.</p>
          <p><strong>시스템 변수</strong>(<Lock size={10} className="inline" /> 표시)는 삭제할 수 없으며, 비활성화만 가능합니다.</p>
          <p><strong>티타임 변수:</strong> <code className="bg-blue-100 px-1 rounded">{`{{티타임}}`}</code>은 확정시간 우선, 없으면 견적시간을 사용합니다.</p>
        </div>
      </div>

      {/* 카테고리 필터 탭 */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setFilterCategory("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filterCategory === "all"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          전체 ({variables.length})
        </button>
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterCategory === cat
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat} ({variables.filter((v) => v.category === cat).length})
          </button>
        ))}
      </div>

      {/* 변수 테이블 (카테고리별 그룹) */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Code2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">등록된 변수가 없습니다.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5"
            onClick={() => seedMut.mutate()}
            disabled={seedMut.isPending}
          >
            <Download size={14} />
            기본 변수 불러오기
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, rows]) => (
            <div key={category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800 text-sm">{category}</h3>
                <Badge variant="secondary" className="text-xs">{rows.length}개</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs text-gray-500">
                    <TableHead className="w-24">라벨</TableHead>
                    <TableHead className="w-40">변수 키값</TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead className="w-16 text-center">상태</TableHead>
                    <TableHead className="w-16 text-center">유형</TableHead>
                    <TableHead className="w-24 text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((v) => (
                    <TableRow key={v.id} className={!v.isActive ? "opacity-40" : ""}>
                      <TableCell className="font-medium text-sm">{v.label}</TableCell>
                      <TableCell>
                        <VariableKeyBadge value={v.variableKey} />
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">{v.description ?? "-"}</TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => toggleMut.mutate({ id: v.id })}
                          className="text-gray-400 hover:text-indigo-600 transition-colors"
                          title={v.isActive ? "비활성화" : "활성화"}
                        >
                          {v.isActive
                            ? <ToggleRight size={20} className="text-indigo-600" />
                            : <ToggleLeft size={20} />
                          }
                        </button>
                      </TableCell>
                      <TableCell className="text-center">
                        {v.isSystem
                          ? <Badge variant="outline" className="text-xs gap-1"><Lock size={9} />시스템</Badge>
                          : <Badge variant="secondary" className="text-xs">커스텀</Badge>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(v)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors"
                            title="수정"
                          >
                            <Pencil size={13} />
                          </button>
                          {!v.isSystem && (
                            <button
                              onClick={() => setDeleteConfirm(v)}
                              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                              title="삭제"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}

      {/* 등록/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "변수 수정" : "새 변수 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* 카테고리 */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">카테고리</label>
              <Select
                value={form.category}
                onValueChange={(v) => handleFormChange("category", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {SYSTEM_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ 새 카테고리 직접 입력</SelectItem>
                </SelectContent>
              </Select>
              {form.category === "__custom__" && (
                <Input
                  className="mt-2"
                  placeholder="새 카테고리명 입력"
                  value={form.customCategory}
                  onChange={(e) => handleFormChange("customCategory", e.target.value)}
                />
              )}
            </div>

            {/* 라벨 */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">라벨 (표시 이름)</label>
              <Input
                placeholder="예: 고객명"
                value={form.label}
                onChange={(e) => handleFormChange("label", e.target.value)}
              />
            </div>

            {/* 변수 키값 */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                변수 키값
                <span className="text-xs text-gray-400 ml-1.5">{"{{변수명}} 형식"}</span>
              </label>
              <Input
                placeholder="{{변수명}}"
                value={form.variableKey}
                onChange={(e) => handleFormChange("variableKey", e.target.value)}
                className="font-mono"
                disabled={editTarget?.isSystem}
              />
              {editTarget?.isSystem && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <Lock size={10} /> 시스템 변수의 키값은 변경할 수 없습니다.
                </p>
              )}
            </div>

            {/* 설명 */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">설명</label>
              <Textarea
                placeholder="이 변수가 어떤 데이터를 치환하는지 설명"
                value={form.description}
                onChange={(e) => handleFormChange("description", e.target.value)}
                rows={2}
              />
            </div>

            {/* 정렬 순서 */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">정렬 순서</label>
              <Input
                type="number"
                placeholder="0"
                value={form.sortOrder}
                onChange={(e) => handleFormChange("sortOrder", e.target.value)}
                className="w-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {editTarget ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>변수 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            <strong>{deleteConfirm?.label}</strong> (<code className="bg-gray-100 px-1 rounded text-xs">{deleteConfirm?.variableKey}</code>) 변수를 삭제하시겠습니까?
            <br />
            <span className="text-red-500 text-xs mt-1 block">이 변수를 사용 중인 템플릿에서 치환이 되지 않을 수 있습니다.</span>
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>취소</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) {
                  deleteMut.mutate({ id: deleteConfirm.id });
                  setDeleteConfirm(null);
                }
              }}
              disabled={deleteMut.isPending}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
