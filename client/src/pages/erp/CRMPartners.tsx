/**
 * CRM > 파트너(거래처) 관리 페이지
 * - 상단: 월간 캘린더 + 일정 리스트
 * - 중단: 거래처 검색 + 신규 등록 버튼
 * - 하단: 거래처 목록 테이블
 * - 모달: 거래처 상세/등록, 일정 등록
 */
import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Building2, Phone, Mail, User, Plus, Search, Eye, CalendarPlus,
  ChevronLeft, ChevronRight, Calendar, Clock, Pencil, Trash2,
  Lock, CreditCard, FileText, X, RefreshCw, CheckCircle2
} from "lucide-react";

// ── 타입 ──────────────────────────────────────────────────────
type Partner = {
  id: number;
  companyName: string;
  businessNumber?: string | null;
  tourismLicenseNo?: string | null;
  onlineSalesNo?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  loginId?: string | null;
  memo?: string | null;
  isActive: boolean;
  createdAt: Date;
};

type Schedule = {
  id: number;
  partnerId: number;
  title: string;
  memo?: string | null;
  startDate: Date;
  endDate: Date;
  assignedTo?: string | null;
  color?: string | null;
};

// ── 월간 캘린더 컴포넌트 ──────────────────────────────────────
function MonthCalendar({
  year,
  month,
  schedules,
  onDayClick,
}: {
  year: number;
  month: number;
  schedules: Schedule[];
  onDayClick: (date: Date) => void;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=일요일
  const today = new Date();

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // 날짜별 일정 맵
  const scheduleMap = useMemo(() => {
    const map: Record<number, Schedule[]> = {};
    schedules.forEach((s) => {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === year && d.getMonth() + 1 === month) {
          const day = d.getDate();
          if (!map[day]) map[day] = [];
          map[day].push(s);
        }
      }
    });
    return map;
  }, [schedules, year, month]);

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {weekDays.map((d, i) => (
          <div
            key={d}
            className={`text-center text-xs font-semibold py-2 ${
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-600"
            }`}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const isToday =
            day !== null &&
            today.getFullYear() === year &&
            today.getMonth() + 1 === month &&
            today.getDate() === day;
          const daySchedules = day ? scheduleMap[day] || [] : [];
          const colIdx = idx % 7;

          return (
            <div
              key={idx}
              onClick={() => day && onDayClick(new Date(year, month - 1, day))}
              className={`min-h-[72px] p-1 border-b border-r border-gray-100 cursor-pointer hover:bg-green-50 transition-colors ${
                !day ? "bg-gray-50/50" : ""
              }`}
            >
              {day && (
                <>
                  <div
                    className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                      isToday
                        ? "bg-dogolf-green text-white"
                        : colIdx === 0
                        ? "text-red-500"
                        : colIdx === 6
                        ? "text-blue-500"
                        : "text-gray-700"
                    }`}
                  >
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {daySchedules.slice(0, 2).map((s) => (
                      <div
                        key={s.id}
                        className="text-[10px] px-1 py-0.5 rounded truncate text-white"
                        style={{ backgroundColor: s.color || "#16a34a" }}
                        title={s.title}
                      >
                        {s.title}
                      </div>
                    ))}
                    {daySchedules.length > 2 && (
                      <div className="text-[10px] text-gray-400 px-1">
                        +{daySchedules.length - 2}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 파트너 폼 모달 ────────────────────────────────────────────
function PartnerFormModal({
  open,
  onClose,
  partner,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  partner?: Partner | null;
  onSaved: () => void;
}) {
  const isEdit = !!partner;
  const [createdInfo, setCreatedInfo] = useState<{ loginId: string; loginPw: string; companyName: string } | null>(null);

  const [form, setForm] = useState({
    companyName: partner?.companyName || "",
    businessNumber: partner?.businessNumber || "",
    tourismLicenseNo: partner?.tourismLicenseNo || "",
    onlineSalesNo: partner?.onlineSalesNo || "",
    bankName: partner?.bankName || "",
    accountNumber: partner?.accountNumber || "",
    accountHolder: partner?.accountHolder || "",
    contactName: partner?.contactName || "",
    contactPhone: partner?.contactPhone || "",
    contactEmail: partner?.contactEmail || "",
    loginId: partner?.loginId || "",
    loginPw: "",
    memo: partner?.memo || "",
    isActive: partner?.isActive ?? true,
  });

  const createMut = trpc.crm.createPartner.useMutation({
    onSuccess: () => {
      toast.success("파트너 등록 완료");
      onSaved();
      // 로그인 정보가 있으면 안내 다이얼로그 표시
      if (form.loginId && form.loginPw) {
        setCreatedInfo({ loginId: form.loginId, loginPw: form.loginPw, companyName: form.companyName });
      } else {
        onClose();
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.crm.updatePartner.useMutation({
    onSuccess: () => {
      toast.success("파트너 수정 완료");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.companyName.trim()) {
      toast.error("업체명을 입력해주세요");
      return;
    }
    if (isEdit && partner) {
      updateMut.mutate({ id: partner.id, data: form });
    } else {
      createMut.mutate(form);
    }
  };

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 size={18} className="text-dogolf-green" />
            {isEdit ? "파트너 수정" : "파트너 신규 등록"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="basic" className="text-xs">사업자 정보</TabsTrigger>
            <TabsTrigger value="tourism" className="text-xs">관광사업자</TabsTrigger>
            <TabsTrigger value="account" className="text-xs">계좌/결제</TabsTrigger>
            <TabsTrigger value="contact" className="text-xs">담당자/접속</TabsTrigger>
          </TabsList>

          {/* 사업자 정보 */}
          <TabsContent value="basic" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs text-gray-500">업체명 *</Label>
              <Input value={form.companyName} onChange={f("companyName")} placeholder="(주)두골프투어" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">사업자등록번호</Label>
              <Input value={form.businessNumber} onChange={f("businessNumber")} placeholder="000-00-00000" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">메모</Label>
              <Textarea value={form.memo} onChange={f("memo")} placeholder="내부 메모" rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="w-4 h-4"
              />
              <Label htmlFor="isActive" className="text-sm cursor-pointer">활성 파트너</Label>
            </div>
          </TabsContent>

          {/* 관광사업자 정보 */}
          <TabsContent value="tourism" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs text-gray-500">관광사업자 등록번호</Label>
              <Input value={form.tourismLicenseNo} onChange={f("tourismLicenseNo")} placeholder="제2024-000호" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">통신판매업 신고번호</Label>
              <Input value={form.onlineSalesNo} onChange={f("onlineSalesNo")} placeholder="제2024-서울-00000호" />
            </div>
          </TabsContent>

          {/* 계좌/결제 */}
          <TabsContent value="account" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs text-gray-500">은행명</Label>
              <Input value={form.bankName} onChange={f("bankName")} placeholder="국민은행" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">계좌번호</Label>
              <Input value={form.accountNumber} onChange={f("accountNumber")} placeholder="000-000-000000" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">예금주</Label>
              <Input value={form.accountHolder} onChange={f("accountHolder")} placeholder="홍길동" />
            </div>
          </TabsContent>

          {/* 담당자/접속 */}
          <TabsContent value="contact" className="space-y-3 pt-3">
            <div>
              <Label className="text-xs text-gray-500">담당자명</Label>
              <Input value={form.contactName} onChange={f("contactName")} placeholder="홍길동" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">담당자 전화</Label>
              <Input value={form.contactPhone} onChange={f("contactPhone")} placeholder="010-0000-0000" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">담당자 이메일</Label>
              <Input value={form.contactEmail} onChange={f("contactEmail")} placeholder="partner@example.com" type="email" />
            </div>
            <div className="border-t pt-3">
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Lock size={12} /> 파트너 포털 접속 정보</p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-gray-500">로그인 ID</Label>
                  <Input value={form.loginId} onChange={f("loginId")} placeholder="partner_id" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">비밀번호 {isEdit && "(변경 시에만 입력)"}</Label>
                  <Input value={form.loginPw} onChange={f("loginPw")} type="password" placeholder="••••••••" />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={createMut.isPending || updateMut.isPending}
            className="bg-dogolf-green hover:bg-dogolf-green-dark text-white"
          >
            {isEdit ? "수정 저장" : "등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* 파트너 생성 완료 후 접속 정보 안내 다이얼로그 */}
    {createdInfo && (
      <Dialog open={!!createdInfo} onOpenChange={() => { setCreatedInfo(null); onClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 size={18} className="text-green-600" />
              파트너 등록 완료
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              <strong>{createdInfo.companyName}</strong> 파트너 계정이 생성되었습니다.
              아래 접속 정보를 파트너에게 안내해주세요.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">파트너 로그인 URL</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-white border border-gray-200 rounded px-2 py-1 flex-1 truncate">
                    https://partner.dayoutgolf.com/partner/login
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText('https://partner.dayoutgolf.com/partner/login');
                      toast.success('링크 복사 완료');
                    }}
                  >
                    복사
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">로그인 ID</p>
                  <div className="flex items-center gap-1.5">
                    <code className="text-sm font-mono bg-white border border-gray-200 rounded px-2 py-1 flex-1">
                      {createdInfo.loginId}
                    </code>
                    <Button size="sm" variant="outline" className="px-2 text-xs" onClick={() => { navigator.clipboard.writeText(createdInfo!.loginId); toast.success('ID 복사'); }}>
                      복사
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">비밀번호</p>
                  <div className="flex items-center gap-1.5">
                    <code className="text-sm font-mono bg-white border border-gray-200 rounded px-2 py-1 flex-1">
                      {createdInfo.loginPw}
                    </code>
                    <Button size="sm" variant="outline" className="px-2 text-xs" onClick={() => { navigator.clipboard.writeText(createdInfo!.loginPw); toast.success('PW 복사'); }}>
                      복사
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              파트너가 로그인 후 사업자등록증을 업로드하면 자동 승인되어 ERP를 바로 이용할 수 있습니다.
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                const info = `파트너 로그인 정보\n\n로그인 URL: https://partner.dayoutgolf.com/partner/login\n로그인 ID: ${createdInfo.loginId}\n비밀번호: ${createdInfo.loginPw}\n\n로그인 후 사업자등록증을 업로드하면 자동 승인됩니다.`;
                navigator.clipboard.writeText(info);
                toast.success('접속 정보 전체 복사 완료');
              }}
              className="bg-dogolf-green hover:bg-dogolf-green-dark text-white"
            >
              접속 정보 전체 복사
            </Button>
            <Button variant="outline" onClick={() => { setCreatedInfo(null); onClose(); }}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

// ── 일정 등록 모달 ────────────────────────────────────────────
function ScheduleFormModal({
  open,
  onClose,
  partnerId,
  partnerName,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  partnerId?: number;
  partnerName?: string;
  defaultDate?: Date;
  onSaved: () => void;
}) {
  const utils = trpc.useUtils();

  const fmt = (d: Date) => d.toISOString().slice(0, 16);
  const now = defaultDate || new Date();
  const endDefault = new Date(now);
  endDefault.setHours(endDefault.getHours() + 2);

  const [form, setForm] = useState({
    title: "",
    memo: "",
    startDate: fmt(now),
    endDate: fmt(endDefault),
    assignedTo: "",
    color: "#16a34a",
    partnerId: partnerId || 0,
  });

  // 파트너 목록 (파트너 선택 드롭다운용) - 항상 최신 데이터 조회
  const { data: partnerList, refetch: refetchPartnerList } = trpc.crm.getPartners.useQuery(undefined, { enabled: !partnerId });

  // 모달이 열릴 때마다 파트너 목록 갱신 (신규 등록 후 즉시 반영)
  useEffect(() => {
    if (open && !partnerId) {
      refetchPartnerList();
    }
  }, [open, partnerId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // 반복 일정 상태
  const [recurrence, setRecurrence] = useState({
    type: 'none' as 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly',
    interval: 1,
    endDate: '',
  });

  const createMut = trpc.crm.createSchedule.useMutation({
    onSuccess: () => {
      toast.success("일정 등록 완료");
      utils.crm.getSchedules.invalidate();
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.title.trim()) {
      toast.error("제목을 입력해주세요");
      return;
    }
    const pid = partnerId || form.partnerId;
    if (!pid) {
      toast.error("파트너를 선택해주세요");
      return;
    }
    createMut.mutate({
      ...form,
      partnerId: pid,
      startDate: new Date(form.startDate),
      endDate: new Date(form.endDate),
      recurrenceType: recurrence.type,
      recurrenceInterval: recurrence.interval,
      recurrenceEndDate: recurrence.endDate ? new Date(recurrence.endDate) : undefined,
    });
  };

  const COLORS = ["#16a34a", "#2563eb", "#dc2626", "#d97706", "#7c3aed", "#0891b2"];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus size={18} className="text-dogolf-green" />
            일정 등록 {partnerName && <span className="text-sm font-normal text-gray-500">— {partnerName}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!partnerId && (
            <div>
              <Label className="text-xs text-gray-500">파트너 선택 *</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={form.partnerId}
                onChange={(e) => setForm((p) => ({ ...p, partnerId: Number(e.target.value) }))}
              >
                <option value={0}>-- 파트너 선택 --</option>
                {partnerList?.map((p) => (
                  <option key={p.id} value={p.id}>{p.companyName}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label className="text-xs text-gray-500">제목 *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="미팅, 계약, 정산 등"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-500">시작일시</Label>
              <Input
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">종료일시</Label>
              <Input
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500">담당자</Label>
            <Input
              value={form.assignedTo}
              onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value }))}
              placeholder="담당자 이름"
            />
          </div>

          <div>
            <Label className="text-xs text-gray-500">메모</Label>
            <Textarea
              value={form.memo}
              onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
              placeholder="일정 관련 메모"
              rows={2}
            />
          </div>

          <div>
            <Label className="text-xs text-gray-500">색상</Label>
            <div className="flex gap-2 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((p) => ({ ...p, color: c }))}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    form.color === c ? "border-gray-800 scale-125" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* 반복 일정 */}
          <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
            <Label className="text-xs text-gray-500 flex items-center gap-1">
              <RefreshCw size={12} /> 반복 설정
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-400">반복 유형</Label>
                <select
                  className="w-full border rounded-md px-2 py-1.5 text-sm bg-white"
                  value={recurrence.type}
                  onChange={(e) => setRecurrence((r) => ({ ...r, type: e.target.value as typeof recurrence.type }))}
                >
                  <option value="none">반복 없음</option>
                  <option value="daily">매일</option>
                  <option value="weekly">매주</option>
                  <option value="monthly">매월</option>
                  <option value="yearly">매년</option>
                </select>
              </div>
              {recurrence.type !== 'none' && (
                <div>
                  <Label className="text-xs text-gray-400">반복 간격</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={recurrence.interval}
                      onChange={(e) => setRecurrence((r) => ({ ...r, interval: Math.max(1, Number(e.target.value)) }))}
                      className="text-sm"
                    />
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {recurrence.type === 'daily' ? '일' : recurrence.type === 'weekly' ? '주' : recurrence.type === 'monthly' ? '개월' : '년'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {recurrence.type !== 'none' && (
              <div>
                <Label className="text-xs text-gray-400">반복 종료일 (선택)</Label>
                <Input
                  type="date"
                  value={recurrence.endDate}
                  onChange={(e) => setRecurrence((r) => ({ ...r, endDate: e.target.value }))}
                  className="text-sm"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={createMut.isPending}
            className="bg-dogolf-green hover:bg-dogolf-green-dark text-white"
          >
            등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 파트너 상세 모달 ──────────────────────────────────────────
function PartnerDetailModal({
  open,
  onClose,
  partner,
  onEdit,
  onSchedule,
}: {
  open: boolean;
  onClose: () => void;
  partner: Partner | null;
  onEdit: () => void;
  onSchedule: () => void;
}) {
  if (!partner) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 size={18} className="text-dogolf-green" />
            {partner.companyName}
            <Badge variant={partner.isActive ? "default" : "secondary"} className={partner.isActive ? "bg-dogolf-green" : ""}>
              {partner.isActive ? "활성" : "비활성"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* 사업자 정보 */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <FileText size={12} /> 사업자 정보
            </p>
            {partner.businessNumber && (
              <div className="flex justify-between">
                <span className="text-gray-500">사업자등록번호</span>
                <span className="font-medium">{partner.businessNumber}</span>
              </div>
            )}
            {partner.tourismLicenseNo && (
              <div className="flex justify-between">
                <span className="text-gray-500">관광사업자 등록번호</span>
                <span className="font-medium">{partner.tourismLicenseNo}</span>
              </div>
            )}
            {partner.onlineSalesNo && (
              <div className="flex justify-between">
                <span className="text-gray-500">통신판매업 신고번호</span>
                <span className="font-medium">{partner.onlineSalesNo}</span>
              </div>
            )}
          </div>

          {/* 계좌 정보 */}
          {(partner.bankName || partner.accountNumber) && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <CreditCard size={12} /> 계좌 정보
              </p>
              {partner.bankName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">은행</span>
                  <span className="font-medium">{partner.bankName}</span>
                </div>
              )}
              {partner.accountNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">계좌번호</span>
                  <span className="font-medium font-mono">{partner.accountNumber}</span>
                </div>
              )}
              {partner.accountHolder && (
                <div className="flex justify-between">
                  <span className="text-gray-500">예금주</span>
                  <span className="font-medium">{partner.accountHolder}</span>
                </div>
              )}
            </div>
          )}

          {/* 담당자 정보 */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <User size={12} /> 담당자 정보
            </p>
            {partner.contactName && (
              <div className="flex justify-between">
                <span className="text-gray-500">담당자</span>
                <span className="font-medium">{partner.contactName}</span>
              </div>
            )}
            {partner.contactPhone && (
              <div className="flex justify-between">
                <span className="text-gray-500">전화</span>
                <a href={`tel:${partner.contactPhone}`} className="font-medium text-dogolf-green hover:underline">
                  {partner.contactPhone}
                </a>
              </div>
            )}
            {partner.contactEmail && (
              <div className="flex justify-between">
                <span className="text-gray-500">이메일</span>
                <a href={`mailto:${partner.contactEmail}`} className="font-medium text-dogolf-green hover:underline text-xs">
                  {partner.contactEmail}
                </a>
              </div>
            )}
            {partner.loginId && (
              <div className="flex justify-between">
                <span className="text-gray-500 flex items-center gap-1"><Lock size={11} /> 포털 ID</span>
                <span className="font-mono text-xs bg-gray-200 px-2 py-0.5 rounded">{partner.loginId}</span>
              </div>
            )}
          </div>

          {/* 메모 */}
          {partner.memo && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-yellow-700 mb-1">메모</p>
              <p className="text-gray-700 text-sm whitespace-pre-wrap">{partner.memo}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onSchedule} className="flex items-center gap-1">
            <CalendarPlus size={14} /> 일정 등록
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit} className="flex items-center gap-1">
            <Pencil size={14} /> 수정
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function CRMPartners() {
  const utils = trpc.useUtils();

  // 캘린더 상태
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth() + 1);

  // 검색
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // 모달 상태
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [scheduleDefaultDate, setScheduleDefaultDate] = useState<Date | undefined>();
  const [schedulePartnerId, setSchedulePartnerId] = useState<number | undefined>();

  // 데이터 조회
  const { data: partners = [], refetch: refetchPartners } = trpc.crm.getPartners.useQuery(
    { search: search || undefined },
    { keepPreviousData: true } as any
  );

  const { data: schedules = [], refetch: refetchSchedules } = trpc.crm.getSchedules.useQuery(
    { year: calYear, month: calMonth }
  );

  // 삭제
  const deleteMut = trpc.crm.deletePartner.useMutation({
    onSuccess: () => {
      toast.success("파트너 삭제 완료");
      refetchPartners();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteScheduleMut = trpc.crm.deleteSchedule.useMutation({
    onSuccess: () => {
      toast.success("일정 삭제 완료");
      refetchSchedules();
    },
    onError: (e) => toast.error(e.message),
  });

  // 캘린더 이동
  const prevMonth = () => {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  };

  // 날짜 클릭 → 일정 등록 모달
  const handleDayClick = (date: Date) => {
    setScheduleDefaultDate(date);
    setSchedulePartnerId(undefined);
    setShowScheduleForm(true);
  };

  // 파트너별 일정 등록
  const handlePartnerSchedule = (partner: Partner) => {
    setSchedulePartnerId(partner.id);
    setSelectedPartner(partner);
    setShowDetail(false);
    setShowScheduleForm(true);
  };

  // 검색
  const handleSearch = () => setSearch(searchInput);

  // 이번 달 일정 (날짜순)
  const upcomingSchedules = useMemo(() => {
    return [...schedules].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
  }, [schedules]);

  const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

  return (
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={22} className="text-dogolf-green" />
            파트너(거래처) 관리
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">파트너 정보 및 일정을 관리합니다</p>
        </div>
        <Button
          onClick={() => { setSelectedPartner(null); setShowPartnerForm(true); }}
          className="bg-dogolf-green hover:bg-dogolf-green-dark text-white flex items-center gap-1.5"
        >
          <Plus size={16} /> 신규 등록
        </Button>
      </div>

      {/* ── 상단: 캘린더 + 일정 리스트 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 캘린더 */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Calendar size={15} className="text-dogolf-green" />
              {calYear}년 {MONTH_NAMES[calMonth - 1]} 파트너 일정
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-xs text-gray-500 w-16 text-center">
                {calYear}.{String(calMonth).padStart(2, "0")}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
                <ChevronRight size={14} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 ml-1"
                onClick={() => { setScheduleDefaultDate(new Date()); setSchedulePartnerId(undefined); setShowScheduleForm(true); }}
              >
                <Plus size={12} className="mr-1" /> 일정 추가
              </Button>
            </div>
          </div>
          <MonthCalendar
            year={calYear}
            month={calMonth}
            schedules={schedules as Schedule[]}
            onDayClick={handleDayClick}
          />
        </div>

        {/* 일정 리스트 */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Clock size={15} className="text-dogolf-green" />
            이번 달 일정 ({upcomingSchedules.length}건)
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {upcomingSchedules.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                등록된 일정이 없습니다
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                {upcomingSchedules.map((s) => {
                  const start = new Date(s.startDate);
                  const end = new Date(s.endDate);
                  const partner = partners.find((p) => p.id === s.partnerId);
                  return (
                    <div key={s.id} className="p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-2">
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                          style={{ backgroundColor: s.color || "#16a34a" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                          {partner && (
                            <p className="text-xs text-dogolf-green">{partner.companyName}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {start.getMonth() + 1}/{start.getDate()} {start.getHours().toString().padStart(2, "0")}:{start.getMinutes().toString().padStart(2, "0")}
                            {" ~ "}
                            {end.getMonth() + 1}/{end.getDate()} {end.getHours().toString().padStart(2, "0")}:{end.getMinutes().toString().padStart(2, "0")}
                          </p>
                          {s.assignedTo && (
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <User size={10} /> {s.assignedTo}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-300 hover:text-red-500"
                          onClick={() => deleteScheduleMut.mutate({ id: s.id })}
                        >
                          <X size={12} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 중단: 검색 ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="업체명, 담당자, 전화번호 검색"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button variant="outline" onClick={handleSearch} className="flex items-center gap-1.5">
          <Search size={14} /> 검색
        </Button>
        {search && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setSearchInput(""); }}>
            <X size={14} className="mr-1" /> 초기화
          </Button>
        )}
        <span className="text-sm text-gray-500 ml-auto">총 {partners.length}개 파트너</span>
      </div>

      {/* ── 하단: 거래처 목록 테이블 ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">업체명</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">담당자</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">연락처</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">이메일</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">상태</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                    <p>등록된 파트너가 없습니다</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => { setSelectedPartner(null); setShowPartnerForm(true); }}
                    >
                      <Plus size={14} className="mr-1" /> 첫 파트너 등록
                    </Button>
                  </td>
                </tr>
              ) : (
                partners.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-dogolf-green/10 flex items-center justify-center flex-shrink-0">
                          <Building2 size={14} className="text-dogolf-green" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{p.companyName}</p>
                          {p.businessNumber && (
                            <p className="text-xs text-gray-400">{p.businessNumber}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-gray-600">
                        <User size={13} className="text-gray-400" />
                        {p.contactName || <span className="text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {p.contactPhone ? (
                        <a href={`tel:${p.contactPhone}`} className="flex items-center gap-1 text-gray-600 hover:text-dogolf-green">
                          <Phone size={13} className="text-gray-400" />
                          {p.contactPhone}
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {p.contactEmail ? (
                        <a href={`mailto:${p.contactEmail}`} className="flex items-center gap-1 text-gray-600 hover:text-dogolf-green text-xs">
                          <Mail size={13} className="text-gray-400" />
                          {p.contactEmail}
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={p.isActive ? "default" : "secondary"}
                        className={`text-xs ${p.isActive ? "bg-dogolf-green/10 text-dogolf-green border-dogolf-green/20" : "bg-gray-100 text-gray-400"}`}
                      >
                        {p.isActive ? "활성" : "비활성"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-dogolf-green"
                          title="상세보기"
                          onClick={() => { setSelectedPartner(p as Partner); setShowDetail(true); }}
                        >
                          <Eye size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-blue-500"
                          title="일정 등록"
                          onClick={() => handlePartnerSchedule(p as Partner)}
                        >
                          <CalendarPlus size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-amber-500"
                          title="수정"
                          onClick={() => { setSelectedPartner(p as Partner); setShowPartnerForm(true); }}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-red-500"
                          title="삭제"
                          onClick={() => {
                            if (confirm(`"${p.companyName}" 파트너를 삭제하시겠습니까?`)) {
                              deleteMut.mutate({ id: p.id });
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 모달들 ── */}
      <PartnerFormModal
        open={showPartnerForm}
        onClose={() => setShowPartnerForm(false)}
        partner={selectedPartner}
        onSaved={refetchPartners}
      />

      <PartnerDetailModal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        partner={selectedPartner}
        onEdit={() => { setShowDetail(false); setShowPartnerForm(true); }}
        onSchedule={() => handlePartnerSchedule(selectedPartner!)}
      />

      <ScheduleFormModal
        open={showScheduleForm}
        onClose={() => setShowScheduleForm(false)}
        partnerId={schedulePartnerId}
        partnerName={partners.find((p) => p.id === schedulePartnerId)?.companyName}
        defaultDate={scheduleDefaultDate}
        onSaved={refetchSchedules}
      />
      </div>
  );
}
