import { useState } from "react";
import ERPLayout from "@/components/ERPLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Edit2, Trash2, Zap, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "golf_booking", label: "골프장 문의" },
  { value: "accommodation", label: "숙소 문의" },
  { value: "transport", label: "교통 문의" },
  { value: "general", label: "일반 문의" },
  { value: "estimate", label: "견적생성" },
];

interface TemplateFormProps {
  initial?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function TemplateForm({ initial, onSave, onCancel, isSaving }: TemplateFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    category: initial?.category ?? "golf_booking",
    description: initial?.description ?? "",
    content: initial?.content ?? "",
    variables: initial?.variables ?? "",
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm">템플릿명 <span className="text-red-500">*</span></Label>
          <Input value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="예: 골프장 예약 가능 여부 문의"
            className="mt-1" />
        </div>
        <div>
          <Label className="text-sm">카테고리</Label>
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
              <SelectItem value="all" className="hidden">전체</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-sm">설명</Label>
        <Input value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="이 템플릿의 용도를 간략히 설명해주세요"
          className="mt-1" />
      </div>

      <div>
        <Label className="text-sm">
          템플릿 내용 <span className="text-red-500">*</span>
          <span className="text-xs text-gray-400 ml-2">
            변수는 {"{{변수명}}"} 형식으로 입력 (예: {"{{골프장명}}"}, {"{{출발일}}"}, {"{{인원}}"})
          </span>
        </Label>
        <Textarea
          value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          placeholder={`안녕하세요.\n{{골프장명}} 담당자님,\n\n{{출발일}} 기준으로 {{인원}}명 예약 가능 여부 문의드립니다.\n\n감사합니다.`}
          rows={10}
          className="mt-1 text-sm font-mono"
        />
      </div>

      <div>
        <Label className="text-sm">
          변수 목록
          <span className="text-xs text-gray-400 ml-2">쉼표로 구분 (예: 골프장명, 출발일, 인원)</span>
        </Label>
        <Input value={form.variables}
          onChange={e => setForm(f => ({ ...f, variables: e.target.value }))}
          placeholder="골프장명, 출발일, 인원, 팀수"
          className="mt-1" />
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">취소</Button>
        <Button
          onClick={() => {
            if (!form.name || !form.content) {
              toast.error("템플릿명과 내용은 필수입니다.");
              return;
            }
            onSave(form);
          }}
          disabled={isSaving}
          className="flex-1 bg-green-700 hover:bg-green-800 text-white"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          {initial ? "수정 저장" : "템플릿 등록"}
        </Button>
      </div>
    </div>
  );
}

export default function InquiryTemplates() {
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"golf_booking" | "accommodation" | "transport" | "general" | "estimate" | "all">("all");
  const [previewItem, setPreviewItem] = useState<any | null>(null);

  const { data: templates, refetch } = trpc.inquiryTemplates.list.useQuery({ category: categoryFilter });

  const createMut = trpc.inquiryTemplates.create.useMutation({
    onSuccess: () => { toast.success("템플릿이 등록되었습니다."); setShowCreate(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.inquiryTemplates.update.useMutation({
    onSuccess: () => { toast.success("템플릿이 수정되었습니다."); setEditItem(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.inquiryTemplates.delete.useMutation({
    onSuccess: () => { toast.success("템플릿이 삭제되었습니다."); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <ERPLayout>
      <div className="p-4 md:p-6 space-y-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">문의 자동화 템플릿</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              골프장/숙소 문의 시 사용할 자동화 템플릿을 관리합니다.
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}
            className="bg-green-700 hover:bg-green-800 text-white">
            <Plus className="w-4 h-4 mr-1" /> 템플릿 추가
          </Button>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              categoryFilter === "all"
                ? "bg-green-700 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            전체
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategoryFilter(c.value as any)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                categoryFilter === c.value
                  ? "bg-green-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* 템플릿 목록 */}
        {!templates || templates.length === 0 ? (
          <div className="text-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
            <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">등록된 템플릿이 없습니다.</p>
            <p className="text-sm mt-1">템플릿 추가 버튼을 클릭하여 첫 번째 템플릿을 만들어보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <Card key={tpl.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold truncate">{tpl.name}</CardTitle>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium ${
                        tpl.category === "golf_booking" ? "bg-green-100 text-green-700" :
                        tpl.category === "accommodation" ? "bg-blue-100 text-blue-700" :
                        tpl.category === "transport" ? "bg-orange-100 text-orange-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {CATEGORIES.find(c => c.value === tpl.category)?.label ?? tpl.category}
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setPreviewItem(tpl)}
                        className="p-1.5 hover:bg-amber-50 rounded text-amber-500" title="미리보기"
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditItem(tpl)}
                        className="p-1.5 hover:bg-yellow-50 rounded text-yellow-600" title="수정"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMut.mutate({ id: tpl.id }); }}
                        className="p-1.5 hover:bg-red-50 rounded text-red-500" title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600 font-mono whitespace-pre-wrap line-clamp-4 max-h-24 overflow-hidden">
                    {tpl.content}
                  </div>
                  {tpl.variables && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tpl.variables.split(",").map((v: string) => (
                        <span key={v.trim()} className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                          {"{{"}{v.trim()}{"}}"}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 신규 등록 모달 */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-700" /> 템플릿 추가
            </DialogTitle>
          </DialogHeader>
          <TemplateForm
            onSave={(data) => createMut.mutate({ name: data.name, category: data.category, content: data.content, variables: data.variables })}
            onCancel={() => setShowCreate(false)}
            isSaving={createMut.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* 수정 모달 */}
      <Dialog open={editItem !== null} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4" /> 템플릿 수정
            </DialogTitle>
          </DialogHeader>
          {editItem && (
            <TemplateForm
              initial={editItem}
              onSave={(data) => updateMut.mutate({ id: editItem.id, name: data.name, category: data.category, content: data.content, variables: data.variables })}
              onCancel={() => setEditItem(null)}
              isSaving={updateMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 미리보기 모달 */}
      <Dialog open={previewItem !== null} onOpenChange={() => setPreviewItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> 템플릿 미리보기
            </DialogTitle>
          </DialogHeader>
          {previewItem && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{previewItem.name}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {CATEGORIES.find(c => c.value === previewItem.category)?.label}
                </span>
              </div>
              <div className="relative bg-amber-50 border border-amber-200 rounded-lg p-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {previewItem.content}
                </pre>
                <button
                  onClick={() => { navigator.clipboard.writeText(previewItem.content); toast.success("복사됨"); }}
                  className="absolute top-2 right-2 p-1.5 bg-white rounded border hover:bg-gray-50"
                >
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
              {previewItem.variables && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">사용 변수:</p>
                  <div className="flex flex-wrap gap-1">
                    {previewItem.variables.split(",").map((v: string) => (
                      <span key={v.trim()} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                        {"{{"}{v.trim()}{"}}"}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ERPLayout>
  );
}
