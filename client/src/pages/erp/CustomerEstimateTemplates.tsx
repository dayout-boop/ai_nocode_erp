import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronUp,
  User, Calendar, MapPin, Users, DollarSign, Phone, Briefcase,
  Clock, Hotel, Info, FileText, Hash, AlertTriangle
} from "lucide-react";
import ERPLayout from "@/components/ERPLayout";
import VariablePickerButton, { VARIABLE_CATEGORIES, validateVariables, extractVariables } from "@/components/VariablePickerButton";

// ─── 변수 삽입 가능한 Textarea 컴포넌트 ────────────────────────────
function VariableTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variable: string) => {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const newValue = value.slice(0, start) + variable + value.slice(end);
      onChange(newValue);
      // 커서 위치 복원
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + variable.length, start + variable.length);
      });
    } else {
      onChange(value + variable);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Label className="text-sm font-medium">{label}</Label>
        <VariablePickerButton onInsert={insertVariable} size="sm" placement="bottom-left" />
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="text-sm resize-none font-mono"
      />
    </div>
  );
}

// ─── 템플릿 폼 컴포넌트 ────────────────────────────────────────────
interface TemplateFormData {
  name: string;
  includeItems: string;
  excludeItems: string;
  notes: string;
  schedule: string;
}

const EMPTY_FORM: TemplateFormData = {
  name: "",
  includeItems: "",
  excludeItems: "",
  notes: "",
  schedule: "",
};

function TemplateForm({
  initial,
  onSave,
  onCancel,
  isLoading,
}: {
  initial: TemplateFormData;
  onSave: (data: TemplateFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<TemplateFormData>(initial);
  const [invalidVars, setInvalidVars] = useState<string[]>([]);
  const [confirmSave, setConfirmSave] = useState(false);

  // 실시간 변수 파싱: 모든 텍스트 필드에서 {{변수명}} 추출
  const allTexts = [form.includeItems, form.excludeItems, form.schedule, form.notes];
  const { valid: usedValidVars, invalid: usedInvalidVars } = extractVariables(allTexts);

  const set = (key: keyof TemplateFormData) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    // 필드 수정 시 저장 경고 초기화
    setInvalidVars([]);
    setConfirmSave(false);
  };

  function handleSaveClick() {
    const bad = validateVariables([
      form.includeItems,
      form.excludeItems,
      form.schedule,
      form.notes,
    ]);
    if (bad.length > 0 && !confirmSave) {
      setInvalidVars(bad);
      setConfirmSave(true);
      return;
    }
    setInvalidVars([]);
    setConfirmSave(false);
    onSave(form);
  }

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-medium">템플릿명 *</Label>
        <Input
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
          placeholder="예: 국내 1박2일 골프 패키지 견적"
          className="mt-1"
        />
      </div>

      <Separator />

      <VariableTextarea
        label="포함 사항"
        value={form.includeItems}
        onChange={set("includeItems")}
        placeholder={"* 그린피 {{팀수}}팀 18홀\n* 숙소 ({{인원}}인실 * 1박)\n* 조식 1회"}
        rows={5}
      />

      <VariableTextarea
        label="불포함 사항"
        value={form.excludeItems}
        onChange={set("excludeItems")}
        placeholder={"* 카트비&캐디피 - 1팀/18홀\n* 개인경비(식음료, 그늘집 이용료 등)"}
        rows={4}
      />

      <VariableTextarea
        label="세부 일정"
        value={form.schedule}
        onChange={set("schedule")}
        placeholder={"1일차 {{출발일}}\n- {{골프장}} 라운딩 ({{티타임}})\n- {{숙소}} 체크인\n\n2일차\n- 조식 후 귀가"}
        rows={6}
      />

      <VariableTextarea
        label="기타 안내사항"
        value={form.notes}
        onChange={set("notes")}
        placeholder={"* 티업시간 40분전 도착해주세요.\n* {{인원}}인({{팀수}}팀) 기준 견적으로, 인원 변경 시 견적이 변동될 수 있습니다.\n* 캐디피&카트비는 현장 지불 조건입니다."}
        rows={5}
      />

      {/* 실시간 변수 목록 (자동 파싱) */}
      {(usedValidVars.length > 0 || usedInvalidVars.length > 0) && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-gray-600 font-medium text-xs">
            <Hash size={12} />
            현재 템플릿에 사용된 변수
          </div>
          <div className="flex flex-wrap gap-1.5">
            {usedValidVars.map((v) => (
              <span key={v} className="font-mono text-xs bg-green-50 border border-green-300 text-green-800 px-2 py-0.5 rounded">
                {v}
              </span>
            ))}
            {usedInvalidVars.map((v) => (
              <span key={v} className="font-mono text-xs bg-orange-50 border border-orange-300 text-orange-800 px-2 py-0.5 rounded">
                {v} ⚠
              </span>
            ))}
          </div>
          {usedInvalidVars.length > 0 && (
            <p className="text-xs text-orange-600">주황색 변수는 자동 치환 목록에 없는 변수입니다.</p>
          )}
        </div>
      )}

      {/* 잘못된 변수 경고 (저장 시) */}
      {invalidVars.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
            <AlertTriangle size={15} />
            알 수 없는 변수가 포함되어 있습니다
          </div>
          <div className="flex flex-wrap gap-1.5">
            {invalidVars.map((v) => (
              <span key={v} className="font-mono text-xs bg-amber-100 border border-amber-300 text-amber-800 px-2 py-0.5 rounded">
                {v}
              </span>
            ))}
          </div>
          <p className="text-xs text-amber-600">
            위 변수는 자동 치환되지 않습니다. 그래도 저장하려면 아래 <strong>강제 저장</strong> 버튼을 클릭하세요.
          </p>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          <X size={14} className="mr-1" /> 취소
        </Button>
        {confirmSave && (
          <Button
            variant="outline"
            onClick={() => { setInvalidVars([]); setConfirmSave(false); onSave(form); }}
            disabled={isLoading}
            className="border-amber-400 text-amber-700 hover:bg-amber-50"
          >
            <AlertTriangle size={14} className="mr-1" /> 강제 저장
          </Button>
        )}
        <Button
          onClick={handleSaveClick}
          disabled={isLoading || !form.name.trim()}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Save size={14} className="mr-1" />
          {isLoading ? "저장 중..." : "저장"}
        </Button>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────────
export default function CustomerEstimateTemplates() {
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: templates, refetch } = trpc.customerEstimateTemplates.list.useQuery();

  const createMut = trpc.customerEstimateTemplates.create.useMutation({
    onSuccess: () => {
      toast.success("템플릿이 생성되었습니다.");
      setShowCreate(false);
      refetch();
    },
    onError: () => toast.error("생성 실패"),
  });

  const updateMut = trpc.customerEstimateTemplates.update.useMutation({
    onSuccess: () => {
      toast.success("템플릿이 수정되었습니다.");
      setEditId(null);
      refetch();
    },
    onError: () => toast.error("수정 실패"),
  });

  const deleteMut = trpc.customerEstimateTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success("템플릿이 삭제되었습니다.");
      refetch();
    },
    onError: () => toast.error("삭제 실패"),
  });

  const handleCreate = (data: TemplateFormData) => {
    createMut.mutate(data);
  };

  const handleUpdate = (id: number, data: TemplateFormData) => {
    updateMut.mutate({ id, ...data });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`"${name}" 템플릿을 삭제하시겠습니까?`)) return;
    deleteMut.mutate({ id });
  };

  return (
    <ERPLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">고객 견적서 템플릿</h1>
            <p className="text-sm text-gray-500 mt-1">
              고객에게 발송할 견적서 양식을 관리합니다. <code className="bg-gray-100 px-1 rounded text-xs">{"{{변수}}"}</code> 형식으로 예약 데이터가 자동 치환됩니다.
            </p>
          </div>
          <Button
            onClick={() => { setShowCreate(true); setEditId(null); }}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus size={14} className="mr-1" /> 새 템플릿
          </Button>
        </div>

        {/* 변수 안내 */}
        <Card className="mb-6 border-blue-100 bg-blue-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 mb-1">사용 가능한 자동 치환 변수</p>
                <div className="flex flex-wrap gap-1">
                  {VARIABLE_CATEGORIES.flatMap((cat) => cat.items).map((item) => (
                    <code key={item.value} className="text-xs bg-white border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded" title={item.description}>
                      {item.value}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 새 템플릿 생성 폼 */}
        {showCreate && (
          <Card className="mb-6 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-green-700">
                <Plus size={16} className="inline mr-1" />새 템플릿 작성
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TemplateForm
                initial={EMPTY_FORM}
                onSave={handleCreate}
                onCancel={() => setShowCreate(false)}
                isLoading={createMut.isPending}
              />
            </CardContent>
          </Card>
        )}

        {/* 템플릿 목록 */}
        {!templates || templates.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">등록된 템플릿이 없습니다.</p>
            <p className="text-xs mt-1">상단 "새 템플릿" 버튼을 클릭해 첫 번째 템플릿을 만들어보세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((tmpl) => (
              <Card key={tmpl.id} className="border-gray-200">
                <CardContent className="pt-4">
                  {editId === tmpl.id ? (
                    // 수정 폼
                    <TemplateForm
                      initial={{
                        name: tmpl.name,
                        includeItems: tmpl.includeItems ?? "",
                        excludeItems: tmpl.excludeItems ?? "",
                        notes: tmpl.notes ?? "",
                        schedule: tmpl.schedule ?? "",
                      }}
                      onSave={(data) => handleUpdate(tmpl.id, data)}
                      onCancel={() => setEditId(null)}
                      isLoading={updateMut.isPending}
                    />
                  ) : (
                    // 보기 모드
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{tmpl.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            사용 {tmpl.useCount ?? 0}회
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedId(expandedId === tmpl.id ? null : tmpl.id)}
                            className="h-7 px-2 text-xs text-gray-500"
                          >
                            {expandedId === tmpl.id
                              ? <><ChevronUp size={12} className="mr-1" />접기</>
                              : <><ChevronDown size={12} className="mr-1" />미리보기</>
                            }
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditId(tmpl.id); setShowCreate(false); }}
                            className="h-7 px-2 text-blue-600 hover:text-blue-700"
                          >
                            <Pencil size={12} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(tmpl.id, tmpl.name)}
                            className="h-7 px-2 text-red-500 hover:text-red-600"
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>

                      {/* 미리보기 */}
                      {expandedId === tmpl.id && (
                        <div className="mt-4 space-y-3 text-sm border-t pt-3">
                          {tmpl.includeItems && (
                            <div>
                              <p className="font-medium text-green-700 mb-1">✅ 포함 사항</p>
                              <pre className="whitespace-pre-wrap text-xs text-gray-600 bg-green-50 p-2 rounded">{tmpl.includeItems}</pre>
                            </div>
                          )}
                          {tmpl.excludeItems && (
                            <div>
                              <p className="font-medium text-red-600 mb-1">❌ 불포함 사항</p>
                              <pre className="whitespace-pre-wrap text-xs text-gray-600 bg-red-50 p-2 rounded">{tmpl.excludeItems}</pre>
                            </div>
                          )}
                          {tmpl.schedule && (
                            <div>
                              <p className="font-medium text-blue-700 mb-1">📅 세부 일정</p>
                              <pre className="whitespace-pre-wrap text-xs text-gray-600 bg-blue-50 p-2 rounded">{tmpl.schedule}</pre>
                            </div>
                          )}
                          {tmpl.notes && (
                            <div>
                              <p className="font-medium text-gray-700 mb-1">📋 기타 안내사항</p>
                              <pre className="whitespace-pre-wrap text-xs text-gray-600 bg-gray-50 p-2 rounded">{tmpl.notes}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ERPLayout>
  );
}
