/**
 * 파트너 마이페이지
 * - 내 업체 정보 조회 및 수정 (OCR 결과 수정 가능)
 * - 하위 담당자 목록 조회 / 등록 / 수정 / 비활성화
 * ※ Manus OAuth 독립 — partner_session 쿠키 기반 자체 인증
 */
import { useState, useMemo } from "react";
import { usePartnerAuth } from "@/_core/hooks/usePartnerAuth";
import { partnerTrpc, createPartnerTrpcClient, createPartnerQueryClient } from "@/lib/partnerTrpc";
import { QueryClientProvider } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Building2, User, Users, Plus, Pencil, Loader2, ChevronLeft,
  ShieldCheck, Mail, Hash, Eye, EyeOff, Trash2, Settings2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Link } from "wouter";

// ─── 타입 ────────────────────────────────────────────────────────────────────
interface StaffForm {
  name: string;
  loginId: string;
  loginPw: string;
  email: string;
  phone: string;
  role: "manager" | "staff";
  memo: string;
}

const defaultStaffForm: StaffForm = {
  name: "", loginId: "", loginPw: "", email: "", phone: "", role: "staff", memo: "",
};

// ─── 업체 정보 수정 폼 ────────────────────────────────────────────────────────
// ─── 담당자 기능 권한 관리 다이얼로그 ─────────────────────────────────────────────
function StaffPermissionsDialog({
  staffId,
  staffName,
  open,
  onClose,
}: {
  staffId: number;
  staffName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [localPerms, setLocalPerms] = useState<Record<string, boolean>>({});
  const [initialized, setInitialized] = useState(false);

  const { data: featuresData } = partnerTrpc.partnerStaffPermissions.listFeatureKeys.useQuery(
    undefined,
    { enabled: open }
  );
  const { data: permsData, isLoading: permsLoading } = partnerTrpc.partnerStaffPermissions.listForStaff.useQuery(
    { staffId },
    { enabled: open && staffId > 0 }
  );

  if (open && permsData && !initialized) {
    const map: Record<string, boolean> = {};
    permsData.permissions.forEach((p) => { map[p.feature] = p.enabled; });
    setLocalPerms(map);
    setInitialized(true);
  }
  if (!open && initialized) {
    setInitialized(false);
  }

  const bulkSetMutation = partnerTrpc.partnerStaffPermissions.bulkSet.useMutation({
    onSuccess: () => {
      toast.success(`${staffName} 담당자 권한이 저장되었습니다.`);
      onClose();
    },
    onError: (e) => toast.error(`권한 저장 실패: ${e.message}`),
  });

  const handleSave = () => {
    const permissions = Object.entries(localPerms).map(([feature, enabled]) => ({ feature, enabled }));
    bulkSetMutation.mutate({ staffId, permissions });
  };

  const categories = featuresData?.features
    ? Array.from(new Set(featuresData.features.map((f) => f.category)))
    : [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 size={18} className="text-indigo-600" />
            {staffName} 기능 권한 관리
          </DialogTitle>
        </DialogHeader>
        {permsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-indigo-600" size={24} />
          </div>
        ) : (
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {categories.map((category) => (
              <div key={category}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {category}
                </p>
                <div className="space-y-2">
                  {(featuresData?.features ?? []).filter((f) => f.category === category).map((f) => (
                    <div key={f.key} className="flex items-center justify-between p-2.5 rounded-lg border bg-white">
                      <span className="text-sm flex items-center gap-1.5">
                        {f.label}
                        {(f as any).isNew && (
                          <span className="text-[9px] px-1 py-0 rounded bg-rose-500 text-white">NEW</span>
                        )}
                      </span>
                      <Switch
                        checked={localPerms[f.key] ?? true}
                        onCheckedChange={(v) => setLocalPerms((prev) => ({ ...prev, [f.key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={handleSave}
            disabled={bulkSetMutation.isPending || permsLoading}
          >
            {bulkSetMutation.isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
            권한 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompanyInfoCard() {
  const utils = partnerTrpc.useUtils();
  const { data: status, isLoading } = partnerTrpc.partnerOnboarding.getMyStatus.useQuery();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const updateMutation = partnerTrpc.partnerOnboarding.updateMyInfo.useMutation({
    onSuccess: () => {
      toast.success("업체 정보가 수정되었습니다.");
      setEditing(false);
      utils.partnerOnboarding.getMyStatus.invalidate();
    },
    onError: (err) => toast.error(`수정 실패: ${err.message}`),
  });

  const startEdit = () => {
    if (!status?.data) return;
    const a = status.data;
    setForm({
      companyName: a.companyName ?? "",
      businessNumber: a.businessNumber ?? "",
      ceoName: a.ceoName ?? "",
      businessType: a.businessType ?? "",
      businessItem: a.businessItem ?? "",
      address: a.address ?? "",
      contactName: a.contactName ?? "",
      contactPhone: a.contactPhone ?? "",
      tourismLicenseNo: a.tourismLicenseNo ?? "",
      tourismLicenseType: a.tourismLicenseType ?? "",
      tourismOpenDate: a.tourismOpenDate ?? "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      companyName: form.companyName || undefined,
      businessNumber: form.businessNumber || undefined,
      ceoName: form.ceoName || undefined,
      businessType: form.businessType || undefined,
      businessItem: form.businessItem || undefined,
      address: form.address || undefined,
      contactName: form.contactName || undefined,
      contactPhone: form.contactPhone || undefined,
      tourismLicenseNo: form.tourismLicenseNo || undefined,
      tourismLicenseType: form.tourismLicenseType || undefined,
      tourismOpenDate: form.tourismOpenDate || undefined,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-green-600" size={28} />
        </CardContent>
      </Card>
    );
  }

  const a = status?.data;
  const partnerStatus = status?.status;
  if (!a) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>파트너 신청 내역이 없습니다.</p>
          <Link href="/partner/join">
            <Button className="mt-3 bg-green-600 hover:bg-green-700" size="sm">파트너 신청하기</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 size={18} className="text-green-600" />
            업체 정보
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            OCR로 자동 추출된 정보를 확인하고 수정할 수 있습니다.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={
              partnerStatus === "approved" || partnerStatus === "active"
                ? "bg-green-600 text-white"
                : partnerStatus === "pending"
                ? "bg-yellow-500 text-white"
                : "bg-red-500 text-white"
            }
          >
            {partnerStatus === "approved" || partnerStatus === "active"
              ? "승인 완료"
              : partnerStatus === "pending"
              ? "검토 중"
              : partnerStatus === "rejected"
              ? "반려"
              : partnerStatus}
          </Badge>
          {(partnerStatus === "approved" || partnerStatus === "active") && !editing && (
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Pencil size={13} className="mr-1" /> 수정
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {[
              { label: "업체명", value: a.companyName },
              { label: "사업자번호", value: a.businessNumber },
              { label: "대표자", value: a.ceoName },
              { label: "업태", value: a.businessType },
              { label: "종목", value: a.businessItem },
              { label: "주소", value: a.address },
              { label: "담당자명", value: a.contactName },
              { label: "담당자 전화", value: a.contactPhone },
              { label: "관광사업자 등록번호", value: a.tourismLicenseNo },
              { label: "관광사업 종류", value: a.tourismLicenseType },
              { label: "개업일", value: a.tourismOpenDate },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-sm font-medium text-gray-800">
                  {value || <span className="text-gray-300 italic">미입력</span>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
              <ShieldCheck size={14} className="shrink-0 mt-0.5" />
              OCR로 자동 추출된 정보를 직접 수정할 수 있습니다. 수정 후 저장하면 즉시 반영됩니다.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: "companyName", label: "업체명" },
                { key: "businessNumber", label: "사업자번호" },
                { key: "ceoName", label: "대표자" },
                { key: "businessType", label: "업태" },
                { key: "businessItem", label: "종목" },
                { key: "address", label: "주소" },
                { key: "contactName", label: "담당자명" },
                { key: "contactPhone", label: "담당자 전화" },
                { key: "tourismLicenseNo", label: "관광사업자 등록번호" },
                { key: "tourismLicenseType", label: "관광사업 종류" },
                { key: "tourismOpenDate", label: "개업일" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    value={form[key] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>취소</Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
                저장
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 하위 담당자 관리 ─────────────────────────────────────────────────────────
function StaffManagementCard() {
  const utils = partnerTrpc.useUtils();
  const { data: staffList, isLoading } = partnerTrpc.partnerStaff.list.useQuery();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [permStaff, setPermStaff] = useState<{ id: number; name: string } | null>(null);
  const [editingStaff, setEditingStaff] = useState<{
    id: number; name: string; email?: string; phone?: string; role: string; memo?: string;
  } | null>(null);
  const [staffForm, setStaffForm] = useState<StaffForm>(defaultStaffForm);
  const [showPw, setShowPw] = useState(false);

  const createMutation = partnerTrpc.partnerStaff.create.useMutation({
    onSuccess: () => {
      toast.success("담당자가 등록되었습니다.");
      setShowCreateDialog(false);
      setStaffForm(defaultStaffForm);
      utils.partnerStaff.list.invalidate();
    },
    onError: (err) => toast.error(`등록 실패: ${err.message}`),
  });

  const updateMutation = partnerTrpc.partnerStaff.update.useMutation({
    onSuccess: () => {
      toast.success("담당자 정보가 수정되었습니다.");
      setEditingStaff(null);
      utils.partnerStaff.list.invalidate();
    },
    onError: (err) => toast.error(`수정 실패: ${err.message}`),
  });

  const deactivateMutation = partnerTrpc.partnerStaff.deactivate.useMutation({
    onSuccess: () => {
      toast.success("담당자가 비활성화되었습니다.");
      utils.partnerStaff.list.invalidate();
    },
    onError: (err) => toast.error(`비활성화 실패: ${err.message}`),
  });

  const handleCreate = () => {
    if (!staffForm.name || !staffForm.loginId || !staffForm.loginPw) {
      toast.error("이름, 로그인 ID, 비밀번호는 필수입니다.");
      return;
    }
    createMutation.mutate({
      name: staffForm.name,
      loginId: staffForm.loginId,
      loginPw: staffForm.loginPw,
      email: staffForm.email || undefined,
      phone: staffForm.phone || undefined,
      role: staffForm.role,
      memo: staffForm.memo || undefined,
    });
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users size={18} className="text-blue-600" />
            하위 담당자 관리
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            담당자 계정을 등록하면 별도 로그인으로 ERP를 사용할 수 있습니다.
          </CardDescription>
        </div>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => { setStaffForm(defaultStaffForm); setShowCreateDialog(true); }}
        >
          <Plus size={14} className="mr-1" /> 담당자 추가
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-blue-600" size={24} />
          </div>
        ) : !staffList || staffList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">등록된 담당자가 없습니다.</p>
            <p className="text-xs mt-1">담당자를 추가하면 별도 계정으로 ERP를 사용할 수 있습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {staffList.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between p-3 rounded-xl border ${s.isActive ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-60"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${s.role === "manager" ? "bg-blue-600" : "bg-gray-500"}`}>
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{s.name}</span>
                      <Badge variant="outline" className="text-xs py-0">
                        {s.role === "manager" ? "매니저" : "스태프"}
                      </Badge>
                      {!s.isActive && <Badge variant="outline" className="text-xs py-0 text-gray-400">비활성</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Hash size={10} /> {s.loginId}
                      </span>
                      {s.email && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail size={10} /> {s.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-indigo-500 hover:text-indigo-700"
                    title="기능 권한 관리"
                    onClick={() => setPermStaff({ id: s.id, name: s.name })}
                  >
                    <Settings2 size={13} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => setEditingStaff({
                      id: s.id,
                      name: s.name,
                      email: s.email ?? undefined,
                      phone: s.phone ?? undefined,
                      role: s.role,
                      memo: s.memo ?? undefined,
                    })}
                  >
                    <Pencil size={13} />
                  </Button>
                  {s.isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-red-500 hover:text-red-600"
                      onClick={() => {
                        if (confirm(`${s.name} 담당자를 비활성화하시겠습니까?`)) {
                          deactivateMutation.mutate({ staffId: s.id });
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* 담당자 추가 다이얼로그 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={18} className="text-blue-600" /> 담당자 추가
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">이름 <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="홍길동"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">역할</Label>
                <select
                  value={staffForm.role}
                  onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value as "manager" | "staff" }))}
                  className="w-full h-8 text-sm border border-input rounded-md px-2 bg-background"
                >
                  <option value="staff">스태프</option>
                  <option value="manager">매니저</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">로그인 ID <span className="text-red-500">*</span></Label>
              <Input
                placeholder="4자 이상 영문/숫자"
                value={staffForm.loginId}
                onChange={(e) => setStaffForm((f) => ({ ...f, loginId: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">비밀번호 <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="8자 이상"
                  value={staffForm.loginPw}
                  onChange={(e) => setStaffForm((f) => ({ ...f, loginPw: e.target.value }))}
                  className="h-8 text-sm pr-8"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">이메일</Label>
                <Input
                  type="email"
                  placeholder="staff@company.com"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">전화번호</Label>
                <Input
                  placeholder="010-0000-0000"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">메모</Label>
              <Input
                placeholder="담당 업무 등"
                value={staffForm.memo}
                onChange={(e) => setStaffForm((f) => ({ ...f, memo: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(false)}>취소</Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 담당자 수정 다이얼로그 */}
      <Dialog open={!!editingStaff} onOpenChange={(v) => !v && setEditingStaff(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil size={18} className="text-blue-600" /> 담당자 수정
            </DialogTitle>
          </DialogHeader>
          {editingStaff && (
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs">이름</Label>
                <Input
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff((s) => s ? { ...s, name: e.target.value } : s)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">역할</Label>
                <select
                  value={editingStaff.role}
                  onChange={(e) => setEditingStaff((s) => s ? { ...s, role: e.target.value } : s)}
                  className="w-full h-8 text-sm border border-input rounded-md px-2 bg-background"
                >
                  <option value="staff">스태프</option>
                  <option value="manager">매니저</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">이메일</Label>
                  <Input
                    type="email"
                    value={editingStaff.email ?? ""}
                    onChange={(e) => setEditingStaff((s) => s ? { ...s, email: e.target.value } : s)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">전화번호</Label>
                  <Input
                    value={editingStaff.phone ?? ""}
                    onChange={(e) => setEditingStaff((s) => s ? { ...s, phone: e.target.value } : s)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">메모</Label>
                <Input
                  value={editingStaff.memo ?? ""}
                  onChange={(e) => setEditingStaff((s) => s ? { ...s, memo: e.target.value } : s)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingStaff(null)}>취소</Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                if (!editingStaff) return;
                updateMutation.mutate({
                  staffId: editingStaff.id,
                  name: editingStaff.name || undefined,
                  email: editingStaff.email || undefined,
                  phone: editingStaff.phone || undefined,
                  role: editingStaff.role as "manager" | "staff" | undefined,
                  memo: editingStaff.memo || undefined,
                });
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 담당자 기능 권한 다이얼로그 */}
      {permStaff && (
        <StaffPermissionsDialog
          staffId={permStaff.id}
          staffName={permStaff.name}
          open={!!permStaff}
          onClose={() => setPermStaff(null)}
        />
      )}
    </Card>
  );
}

// ─── 메인 컴포넌트 내부 (partnerTrpc Provider 안에서 실행) ─────────────────────────
function PartnerMyPageContent() {
  const { user, loading, isAuthenticated } = usePartnerAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-green-600" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (typeof window !== "undefined") {
      window.location.replace("/partner/login");
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/partner">
            <Button variant="ghost" size="sm" className="gap-1">
              <ChevronLeft size={16} /> 파트너 대시보드
            </Button>
          </Link>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.charAt(0) ?? "P"}
            </div>
            <div>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <User size={20} className="text-green-600" />
            파트너 마이페이지
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            업체 정보를 확인하고 하위 담당자를 관리합니다.
          </p>
        </div>

        <CompanyInfoCard />
        <StaffManagementCard />

        {/* 하위 담당자 로그인 안내 */}
        <Card className="shadow-sm border-blue-200 bg-blue-50/50">
          <CardContent className="py-4 flex items-start gap-3">
            <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">하위 담당자 로그인 방법</p>
              <p className="text-xs text-blue-700 mt-1">
                하위 담당자는 <strong>/partner/staff-login</strong> 페이지에서 로그인 ID와 비밀번호로 로그인할 수 있습니다.
                비밀번호를 분실한 경우 로그인 페이지에서 이메일로 재설정 링크를 받을 수 있습니다.
              </p>
              <Link href="/partner/staff-login">
                <Button size="sm" variant="outline" className="mt-2 border-blue-300 text-blue-700 hover:bg-blue-100">
                  담당자 로그인 페이지 바로가기
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── 래퍼 (partnerTrpc Provider) ─────────────────────────────────────────────
export default function PartnerMyPage() {
  const queryClient = useMemo(() => createPartnerQueryClient(), []);
  const trpcClient = useMemo(() => createPartnerTrpcClient(), []);

  return (
    <partnerTrpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <PartnerMyPageContent />
      </QueryClientProvider>
    </partnerTrpc.Provider>
  );
}
