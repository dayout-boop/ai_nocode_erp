/**
 * 업체·직원 관리 페이지
 * - 모든 파트너 직원/오너: 업체 정보 및 직원 목록 열람 가능 (뷰어)
 * - 오너 또는 수정권한 지정된 담당자: 업체 정보 수정, 직원 추가/수정/삭제, 수정권한 지정
 * - 수정권한 중복 지정 가능 (여러 명 동시 지정)
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { usePartnerAuth } from "@/_core/hooks/usePartnerAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Building2, Users, ShieldCheck, ShieldOff, Plus, Pencil, Trash2,
  Eye, EyeOff, Crown, UserCheck, UserX, Key,
} from "lucide-react";
import { toast } from "sonner";

// ─── 타입 ─────────────────────────────────────────────────────────────────────
interface StaffItem {
  id: number;
  name: string;
  loginId: string;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: number | boolean;
}

interface PermItem {
  id: number;
  staffId: number;
  canEdit: number | boolean;
  staffName: string | null;
  staffLoginId: string | null;
  staffRole: string | null;
}

// ─── 직원 추가/수정 다이얼로그 ────────────────────────────────────────────────
function StaffDialog({
  open, onClose, staff, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  staff: StaffItem | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(staff?.name ?? "");
  const [loginId, setLoginId] = useState(staff?.loginId ?? "");
  const [loginPw, setLoginPw] = useState("");
  const [email, setEmail] = useState(staff?.email ?? "");
  const [phone, setPhone] = useState(staff?.phone ?? "");
  const [role, setRole] = useState<"manager" | "staff">(
    (staff?.role as "manager" | "staff") ?? "staff"
  );
  const [showPw, setShowPw] = useState(false);

  const addMut = trpc.companyManage.addStaff.useMutation({
    onSuccess: () => { toast("직원이 추가되었습니다."); onSaved(); onClose(); },
    onError: (e) => toast.error("오류: " + e.message),
  });
  const editMut = trpc.companyManage.updateStaff.useMutation({
    onSuccess: () => { toast("직원 정보가 수정되었습니다."); onSaved(); onClose(); },
    onError: (e) => toast.error("오류: " + e.message),
  });

  const handleSubmit = () => {
    if (!name.trim() || !loginId.trim()) {
      toast.error("이름과 아이디는 필수입니다.");
      return;
    }
    if (!staff && !loginPw.trim()) {
      toast.error("신규 직원은 비밀번호가 필수입니다.");
      return;
    }
    if (staff) {
      editMut.mutate({ staffId: staff.id, name, email: email || undefined, phone: phone || undefined, role, newLoginPw: loginPw || undefined });
    } else {
      addMut.mutate({ name, loginId, loginPw, email: email || undefined, phone: phone || undefined, role });
    }
  };

  const isPending = addMut.isPending || editMut.isPending;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{staff ? "직원 정보 수정" : "직원 추가"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">이름 *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">아이디 *</Label>
              <Input value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="login_id" disabled={!!staff} className="mt-1" />
              {staff && <p className="text-[10px] text-gray-400 mt-0.5">아이디는 변경 불가</p>}
            </div>
          </div>
          <div>
            <Label className="text-xs">{staff ? "새 비밀번호 (변경 시만 입력)" : "비밀번호 *"}</Label>
            <div className="relative mt-1">
              <Input
                type={showPw ? "text" : "password"}
                value={loginPw}
                onChange={e => setLoginPw(e.target.value)}
                placeholder={staff ? "변경하지 않으면 비워두세요" : "비밀번호 입력"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">이메일</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">전화번호</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">역할</Label>
            <Select value={role} onValueChange={v => setRole(v as "manager" | "staff")}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">매니저</SelectItem>
                <SelectItem value="staff">직원</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>취소</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "저장 중..." : staff ? "수정" : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 수정권한 지정 다이얼로그 ─────────────────────────────────────────────────
function PermissionDialog({
  open, onClose, staffList, permList, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  staffList: StaffItem[];
  permList: PermItem[];
  onSaved: () => void;
}) {
  const setPermMut = trpc.companyManage.setEditPermission.useMutation({
    onSuccess: () => { toast("권한이 저장되었습니다."); onSaved(); },
    onError: (e) => toast.error("오류: " + e.message),
  });
  const revokePermMut = trpc.companyManage.revokeEditPermission.useMutation({
    onSuccess: () => { toast("권한이 해제되었습니다."); onSaved(); },
    onError: (e) => toast.error("오류: " + e.message),
  });

  const hasEditPerm = (staffId: number) =>
    permList.some(p => p.staffId === staffId && (p.canEdit === true || p.canEdit === 1));

  const togglePerm = (staffId: number) => {
    if (hasEditPerm(staffId)) {
      revokePermMut.mutate({ staffId });
    } else {
      setPermMut.mutate({ staffId, canEdit: true });
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            수정권한 지정
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-xs text-gray-500 mb-4">
            수정권한이 있는 담당자는 업체 정보 수정, 직원 추가/수정/삭제, 권한 변경이 가능합니다.
            중복 지정이 가능하며, 나머지 직원은 열람(뷰어)만 가능합니다.
          </p>
          {staffList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">등록된 직원이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {staffList.map(s => {
                const hasPerm = hasEditPerm(s.id);
                return (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${
                      hasPerm ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {hasPerm
                        ? <ShieldCheck size={14} className="text-emerald-600" />
                        : <ShieldOff size={14} className="text-gray-400" />
                      }
                      <div>
                        <p className="text-sm font-medium text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.loginId} · {s.role === "manager" ? "매니저" : "직원"}</p>
                      </div>
                    </div>
                    <Switch
                      checked={hasPerm}
                      onCheckedChange={() => togglePerm(s.id)}
                      disabled={setPermMut.isPending || revokePermMut.isPending}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function CompanyManagePage() {
  const { user: partnerUser } = usePartnerAuth();
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // 업체 정보
  const companyQuery = trpc.companyManage.getCompanyInfo.useQuery();
  // 직원 목록
  const staffQuery = trpc.companyManage.listStaff.useQuery();
  // 수정권한 목록
  const permQuery = trpc.companyManage.listEditPermissions.useQuery();

  // canEdit: 서버에서 checkEditPermission 결과를 별도로 조회
  const canEditQuery = trpc.companyManage.checkCanEdit.useQuery();
  const canEdit = canEditQuery.data?.canEdit ?? false;

  // 업체 정보 수정 상태
  const [editMode, setEditMode] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");

  const updateCompanyMut = trpc.companyManage.updateCompanyInfo.useMutation({
    onSuccess: () => {
      toast("업체 정보가 수정되었습니다.");
      companyQuery.refetch();
      setEditMode(false);
    },
    onError: (e) => toast.error("오류: " + e.message),
  });

  const deleteStaffMut = trpc.companyManage.deleteStaff.useMutation({
    onSuccess: () => {
      toast("직원이 삭제되었습니다.");
      staffQuery.refetch();
      setDeleteConfirmId(null);
    },
    onError: (e) => toast.error("오류: " + e.message),
  });

  const startEdit = () => {
    const c = companyQuery.data;
    if (!c) return;
    setCompanyName(c.companyName ?? "");
    setContactName(c.contactName ?? "");
    setContactPhone(c.contactPhone ?? "");
    setBusinessNumber(c.businessNumber ?? "");
    setEditMode(true);
  };

  const saveCompany = () => {
    updateCompanyMut.mutate({ companyName, contactName, contactPhone, businessNumber });
  };

  const staffList: StaffItem[] = (staffQuery.data ?? []) as StaffItem[];
  const permList: PermItem[] = (permQuery.data ?? []) as PermItem[];
  const company = companyQuery.data;

  // 현재 로그인한 사람이 오너인지
  const isOwner = !!(partnerUser as any)?.isOwner;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={20} className="text-emerald-600" />
            업체·직원 관리
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            업체 정보와 직원 계정을 관리합니다.
            {canEdit
              ? <span className="ml-2 text-emerald-600 font-medium">✓ 수정 권한 있음</span>
              : <span className="ml-2 text-gray-400">(열람 전용)</span>
            }
          </p>
        </div>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPermDialogOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Key size={14} />
            수정권한 지정
          </Button>
        )}
      </div>

      {/* 업체 정보 카드 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 size={16} className="text-emerald-600" />
              업체 정보
            </CardTitle>
            {canEdit && !editMode && (
              <Button variant="outline" size="sm" onClick={startEdit} className="flex items-center gap-1">
                <Pencil size={13} />
                수정
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {companyQuery.isLoading ? (
            <div className="text-sm text-gray-400">불러오는 중...</div>
          ) : editMode ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">업체명</Label>
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)} className="mt-1" />
                </div>
          <div>
              <Label className="text-xs">담당자명</Label>
              <Input value={contactName} onChange={e => setContactName(e.target.value)} className="mt-1" />
            </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
          <div>
              <Label className="text-xs">연락처</Label>
              <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">사업자번호</Label>
              <Input value={businessNumber} onChange={e => setBusinessNumber(e.target.value)} className="mt-1" />
            </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={saveCompany} disabled={updateCompanyMut.isPending}>
                  {updateCompanyMut.isPending ? "저장 중..." : "저장"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>취소</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">업체명</p>
                <p className="font-medium text-gray-900">{company?.companyName ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">대표자</p>
                <p className="font-medium text-gray-900">{company?.contactName ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">연락처</p>
                <p className="font-medium text-gray-900">{company?.contactPhone ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">사업자번호</p>
                <p className="font-medium text-gray-900">{company?.businessNumber ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">이메일</p>
                <p className="font-medium text-gray-900">{company?.contactEmail ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">가입일</p>
                <p className="font-medium text-gray-900">
                  {company?.createdAt ? new Date(company.createdAt).toLocaleDateString() : "-"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 직원 목록 카드 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users size={16} className="text-emerald-600" />
              직원 목록
              <Badge variant="secondary" className="text-xs">{staffList.length}명</Badge>
            </CardTitle>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => { setEditingStaff(null); setStaffDialogOpen(true); }}
                className="flex items-center gap-1"
              >
                <Plus size={13} />
                직원 추가
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {staffQuery.isLoading ? (
            <div className="text-sm text-gray-400">불러오는 중...</div>
          ) : staffList.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">등록된 직원이 없습니다.</p>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => { setEditingStaff(null); setStaffDialogOpen(true); }}
                >
                  첫 직원 추가하기
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {staffList.map(s => {
                const hasPerm = permList.some(p => p.staffId === s.id && (p.canEdit === true || p.canEdit === 1));
                const isActive = s.isActive === true || s.isActive === 1;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
                      }`}>
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900">{s.name}</p>
                          {s.role === "manager" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-600">
                              매니저
                            </Badge>
                          )}
                          {hasPerm && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-600">
                              <ShieldCheck size={9} className="mr-0.5" />
                              수정권한
                            </Badge>
                          )}
                          {!isActive && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-500">
                              비활성
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{s.loginId} {s.email ? `· ${s.email}` : ""}</p>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingStaff(s); setStaffDialogOpen(true); }}
                          className="h-7 w-7 p-0"
                        >
                          <Pencil size={13} className="text-gray-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(s.id)}
                          className="h-7 w-7 p-0"
                        >
                          <Trash2 size={13} className="text-red-400" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 수정권한 현황 카드 */}
      {permList.filter(p => p.canEdit === true || p.canEdit === 1).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              현재 수정권한 담당자
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {permList
                .filter(p => p.canEdit === true || p.canEdit === 1)
                .map(p => (
                  <div key={p.id} className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                    <UserCheck size={12} className="text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-800">{p.staffName ?? p.staffLoginId}</span>
                    <span className="text-[10px] text-emerald-500">({p.staffRole === "manager" ? "매니저" : "직원"})</span>
                  </div>
                ))
              }
            </div>
            <p className="text-xs text-gray-400 mt-3">
              * 오너(업체 대표)는 항상 수정 권한을 가집니다.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 직원 추가/수정 다이얼로그 */}
      <StaffDialog
        open={staffDialogOpen}
        onClose={() => { setStaffDialogOpen(false); setEditingStaff(null); }}
        staff={editingStaff}
        onSaved={() => staffQuery.refetch()}
      />

      {/* 수정권한 지정 다이얼로그 */}
      <PermissionDialog
        open={permDialogOpen}
        onClose={() => setPermDialogOpen(false)}
        staffList={staffList}
        permList={permList}
        onSaved={() => permQuery.refetch()}
      />

      {/* 직원 삭제 확인 다이얼로그 */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={v => !v && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 size={16} />
              직원 삭제 확인
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            이 직원을 삭제하면 해당 계정으로 더 이상 로그인할 수 없습니다. 계속하시겠습니까?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>취소</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId !== null && deleteStaffMut.mutate({ staffId: deleteConfirmId })}
              disabled={deleteStaffMut.isPending}
            >
              {deleteStaffMut.isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
