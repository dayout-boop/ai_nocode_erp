import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import ERPLayout from "@/components/ERPLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, Edit2, Trash2, ChevronLeft, ChevronRight,
  TrendingUp, AlertCircle, DollarSign, Calendar, Clock, CheckCircle,
  XCircle, Award, User, Users, Briefcase, MessageSquare, Zap, MessageCircle,
  PlusCircle, Loader2, Copy, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

type StatusType = "pending" | "confirmed" | "cancelled" | "completed";
type PaymentStatusType = "unpaid" | "partial" | "paid";
type UserType = "customer" | "partner" | "manager";

const STATUS_LABELS: Record<StatusType, string> = {
  pending: "대기", confirmed: "확정", cancelled: "취소", completed: "완료",
};
const STATUS_COLORS: Record<StatusType, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  confirmed: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
  completed: "bg-blue-100 text-blue-800 border-blue-300",
};
const STATUS_ICONS: Record<StatusType, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  confirmed: <CheckCircle className="w-3.5 h-3.5" />,
  cancelled: <XCircle className="w-3.5 h-3.5" />,
  completed: <Award className="w-3.5 h-3.5" />,
};
const PAYMENT_LABELS: Record<PaymentStatusType, string> = {
  unpaid: "미입금", partial: "부분입금", paid: "완납",
};
const PAYMENT_COLORS: Record<PaymentStatusType, string> = {
  unpaid: "bg-red-100 text-red-700",
  partial: "bg-orange-100 text-orange-700",
  paid: "bg-green-100 text-green-700",
};
const USER_TYPE_LABELS: Record<UserType, string> = {
  customer: "고객", partner: "제휴사", manager: "담당자",
};
const USER_TYPE_ICONS: Record<UserType, React.ReactNode> = {
  customer: <User className="w-3.5 h-3.5" />,
  partner: <Users className="w-3.5 h-3.5" />,
  manager: <Briefcase className="w-3.5 h-3.5" />,
};

function formatKRW(n: number | null | undefined) {
  if (!n) return "0";
  return n.toLocaleString("ko-KR");
}
function formatDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("ko-KR");
}

// ─── 신규 예약 간소화 폼 (1차 필수 5개 필드) ───────────────────────────
interface QuickCreateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  currentUser: { name?: string | null; email?: string | null } | null;
}

function QuickCreateForm({ onSuccess, onCancel, currentUser }: QuickCreateFormProps) {
  const [affiliateSearch, setAffiliateSearch] = useState("");
  const [showAffDropdown, setShowAffDropdown] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const [form, setForm] = useState({
    golfCourseName: "",
    affiliateId: undefined as number | undefined,
    departureDate: "",
    teams: 1,
    headcount: 1,
    partnerId: undefined as number | undefined,
    partnerCompanyName: "",
    partnerContactName: "",
    userType: "customer" as UserType,
    customerName: "",
    customerPhone: "",
    managerName: currentUser?.name ?? currentUser?.email ?? "",
  });

  const { data: affiliateData } = trpc.affiliates.list.useQuery(
    { page: 1, pageSize: 20, search: affiliateSearch, type: "all", status: "active" },
    { enabled: affiliateSearch.length >= 1 }
  );
  const { data: partnerData } = trpc.crm.getPartners.useQuery(
    { search: partnerSearch },
    { enabled: partnerSearch.length >= 1 }
  );

  const createMut = trpc.reservations.create.useMutation({
    onSuccess: (data) => {
      toast.success(`예약 등록 완료: ${data.reservationNo}`);
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit() {
    if (!form.golfCourseName || !form.departureDate) {
      toast.error("골프장명과 출발일은 필수입니다.");
      return;
    }
    const customerName = form.userType === "customer"
      ? (form.customerName || "미정")
      : form.userType === "partner"
        ? (form.partnerContactName || form.partnerCompanyName || "미정")
        : (form.managerName || "담당자");

    createMut.mutate({
      productName: form.golfCourseName,
      golfCourseName: form.golfCourseName,
      affiliateId: form.affiliateId,
      departureDate: form.departureDate,
      teams: form.teams,
      headcount: form.headcount,
      customerName,
      userType: form.userType,
      partnerId: form.partnerId,
      partnerCompanyName: form.partnerCompanyName,
      partnerContactName: form.partnerContactName,
      managerName: form.managerName,
    });
  }

  return (
    <div className="space-y-4">
      {/* 유저 구분 선택 */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">예약 유형</Label>
        <div className="flex gap-2">
          {(["customer", "partner", "manager"] as UserType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setForm(f => ({ ...f, userType: type }))}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                form.userType === type
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
              }`}
            >
              {USER_TYPE_ICONS[type]}
              {USER_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* 골프장명 (제휴사 검색) */}
      <div className="relative">
        <Label className="text-sm">골프장명 <span className="text-red-500">*</span></Label>
        <Input
          value={affiliateSearch}
          onChange={e => {
            setAffiliateSearch(e.target.value);
            setForm(f => ({ ...f, golfCourseName: e.target.value, affiliateId: undefined }));
            setShowAffDropdown(true);
          }}
          onFocus={() => affiliateSearch.length >= 1 && setShowAffDropdown(true)}
          onBlur={() => setTimeout(() => setShowAffDropdown(false), 200)}
          placeholder="골프장명 검색..."
          className="mt-1"
        />
        {showAffDropdown && affiliateData && affiliateData.items.length > 0 && (
          <div className="absolute z-50 w-full bg-white border rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
            {affiliateData.items.map(aff => (
              <button key={aff.id} type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-green-50 text-sm border-b last:border-0"
                onMouseDown={() => {
                  setAffiliateSearch(aff.name);
                  setForm(f => ({ ...f, golfCourseName: aff.name, affiliateId: aff.id }));
                  setShowAffDropdown(false);
                }}>
                <span className="font-medium">{aff.name}</span>
                <span className="text-xs text-gray-400 ml-2">{aff.country ?? ""} {aff.region ?? ""}</span>
              </button>
            ))}
          </div>
        )}
        {form.affiliateId && <p className="text-xs text-green-600 mt-1">✓ 제휴사 연결됨</p>}
      </div>

      {/* 출발일 */}
      <div>
        <Label className="text-sm">출발일 <span className="text-red-500">*</span></Label>
        <Input type="date" value={form.departureDate}
          onChange={e => setForm(f => ({ ...f, departureDate: e.target.value }))}
          className="mt-1" />
      </div>

      {/* 팀수 / 인원 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm">팀수</Label>
          <Input type="number" min={1} value={form.teams}
            onChange={e => setForm(f => ({ ...f, teams: Number(e.target.value) || 1 }))}
            className="mt-1" />
        </div>
        <div>
          <Label className="text-sm">인원</Label>
          <Input type="number" min={1} value={form.headcount}
            onChange={e => setForm(f => ({ ...f, headcount: Number(e.target.value) || 1 }))}
            className="mt-1" />
        </div>
      </div>

      {/* 유저 구분별 추가 정보 */}
      {form.userType === "customer" && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 rounded-lg">
          <div>
            <Label className="text-sm">고객명</Label>
            <Input value={form.customerName}
              onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
              placeholder="홍길동" className="mt-1" />
          </div>
          <div>
            <Label className="text-sm">연락처</Label>
            <Input value={form.customerPhone}
              onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
              placeholder="010-0000-0000" className="mt-1" />
          </div>
        </div>
      )}

      {form.userType === "partner" && (
        <div className="relative p-3 bg-purple-50 rounded-lg">
          <Label className="text-sm font-semibold">파트너 검색</Label>
          <Input
            value={partnerSearch}
            onChange={e => {
              setPartnerSearch(e.target.value);
              setShowPartnerDropdown(true);
            }}
            onFocus={() => partnerSearch.length >= 1 && setShowPartnerDropdown(true)}
            onBlur={() => setTimeout(() => setShowPartnerDropdown(false), 200)}
            placeholder="파트너사 검색..."
            className="mt-1"
          />
          {showPartnerDropdown && partnerData && partnerData.length > 0 && (
            <div className="absolute z-50 w-full bg-white border rounded-lg shadow-xl mt-1 max-h-40 overflow-y-auto left-0">
              {partnerData.map((p: any) => (
                <button key={p.id} type="button"
                  className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm border-b last:border-0"
                  onMouseDown={() => {
                    setPartnerSearch(p.companyName || p.name || "");
                    setForm(f => ({
                      ...f,
                      partnerId: p.id,
                      partnerCompanyName: p.companyName || p.name || "",
                      partnerContactName: p.contactName || "",
                    }));
                    setShowPartnerDropdown(false);
                  }}>
                  <span className="font-medium">{p.companyName || p.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{p.contactName}</span>
                </button>
              ))}
            </div>
          )}
          {form.partnerId && (
            <p className="text-xs text-purple-600 mt-1">✓ {form.partnerCompanyName} - {form.partnerContactName}</p>
          )}
        </div>
      )}

      {form.userType === "manager" && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <Label className="text-sm font-semibold">담당자 정보 (자동 기입)</Label>
          <Input value={form.managerName} readOnly
            className="mt-1 bg-gray-100 text-gray-600" />
          <p className="text-xs text-gray-400 mt-1">로그인된 담당자 정보가 자동으로 기입됩니다.</p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">취소</Button>
        <Button onClick={handleSubmit} disabled={createMut.isPending}
          className="flex-1 bg-green-700 hover:bg-green-800 text-white">
          {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          예약 등록
        </Button>
      </div>
    </div>
  );
}

// ─── 문의/자동/답변 탭 컴포넌트 ─────────────────────────────────────────
interface InquiryTabsProps {
  reservationId: number;
  reservationNo: string;
}

function InquiryTabs({ reservationId, reservationNo }: InquiryTabsProps) {
  const { data: inquiries, refetch } = trpc.reservationInquiries.listByReservation.useQuery({ reservationId });
  const { data: templates } = trpc.inquiryTemplates.list.useQuery({ category: "all" });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [autoDebounce, setAutoDebounce] = useState<Record<number, ReturnType<typeof setTimeout>>>({});
  const [replyDebounce, setReplyDebounce] = useState<Record<number, ReturnType<typeof setTimeout>>>({});
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Record<number, number>>({});

  const createMut = trpc.reservationInquiries.create.useMutation({
    onSuccess: () => refetch(),
  });
  const updateInquiryMut = trpc.reservationInquiries.updateInquiry.useMutation();
  const updateReplyMut = trpc.reservationInquiries.updateReply.useMutation();
  const generateAutoMut = trpc.reservationInquiries.generateAuto.useMutation({
    onSuccess: () => { refetch(); setGeneratingId(null); },
    onError: () => setGeneratingId(null),
  });
  const deleteMut = trpc.reservationInquiries.delete.useMutation({
    onSuccess: () => refetch(),
  });

  function handleInquiryChange(id: number, text: string) {
    clearTimeout(autoDebounce[id]);
    const t = setTimeout(() => {
      updateInquiryMut.mutate({ id, inquiryText: text });
    }, 800);
    setAutoDebounce(prev => ({ ...prev, [id]: t }));
  }

  function handleReplyChange(id: number, text: string) {
    clearTimeout(replyDebounce[id]);
    const t = setTimeout(() => {
      updateReplyMut.mutate({ id, replyText: text, inquiryStatus: "replied" });
    }, 800);
    setReplyDebounce(prev => ({ ...prev, [id]: t }));
  }

  function handleGenerateAuto(inq: any) {
    if (!inq.inquiryText) {
      toast.error("문의 내용을 먼저 입력해주세요.");
      return;
    }
    setGeneratingId(inq.id);
    generateAutoMut.mutate({
      id: inq.id,
      reservationId,
      inquiryText: inq.inquiryText,
      templateId: selectedTemplate[inq.id],
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">문의 관리</h3>
        <Button size="sm" variant="outline"
          onClick={() => createMut.mutate({ reservationId, reservationNo })}
          disabled={createMut.isPending}
          className="text-xs h-7 gap-1">
          <PlusCircle className="w-3.5 h-3.5" /> 문의 추가
        </Button>
      </div>

      {!inquiries || inquiries.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed rounded-lg">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
          문의 내용이 없습니다. 문의 추가 버튼을 클릭하세요.
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq, idx) => (
            <div key={inq.id} className="border rounded-lg overflow-hidden">
              {/* 헤더 */}
              <div
                className="flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer"
                onClick={() => setExpandedId(expandedId === inq.id ? null : inq.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500">#{idx + 1}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    inq.inquiryStatus === "confirmed" ? "bg-green-100 text-green-700" :
                    inq.inquiryStatus === "replied" ? "bg-blue-100 text-blue-700" :
                    inq.inquiryStatus === "sent" ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {inq.inquiryStatus === "confirmed" ? "확정" :
                     inq.inquiryStatus === "replied" ? "답변완료" :
                     inq.inquiryStatus === "sent" ? "발송됨" : "작성중"}
                  </span>
                  {inq.inquiryText && (
                    <span className="text-xs text-gray-500 truncate max-w-[200px]">
                      {inq.inquiryText.slice(0, 40)}...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteMut.mutate({ id: inq.id }); }}
                    className="p-1 hover:bg-red-50 rounded text-red-400 text-xs"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  {expandedId === inq.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {/* 내용 (펼침) */}
              {expandedId === inq.id && (
                <div className="p-3">
                  <Tabs defaultValue="inquiry">
                    <TabsList className="h-8 text-xs mb-3">
                      <TabsTrigger value="inquiry" className="text-xs gap-1 h-7">
                        <MessageSquare className="w-3 h-3" /> 문의
                      </TabsTrigger>
                      <TabsTrigger value="auto" className="text-xs gap-1 h-7">
                        <Zap className="w-3 h-3" /> 자동
                      </TabsTrigger>
                      <TabsTrigger value="reply" className="text-xs gap-1 h-7">
                        <MessageCircle className="w-3 h-3" /> 답변
                      </TabsTrigger>
                    </TabsList>

                    {/* 문의 탭 */}
                    <TabsContent value="inquiry">
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-500">거래처/고객 문의 내용 (자동저장)</Label>
                        <Textarea
                          defaultValue={inq.inquiryText ?? ""}
                          onChange={e => handleInquiryChange(inq.id, e.target.value)}
                          placeholder="거래처나 고객의 문의 내용을 붙여넣거나 입력하세요..."
                          rows={5}
                          className="text-sm resize-none"
                        />
                        <p className="text-xs text-gray-400">입력 후 0.8초 뒤 자동저장됩니다.</p>
                      </div>
                    </TabsContent>

                    {/* 자동 탭 */}
                    <TabsContent value="auto">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-gray-500 flex-1">문의 자동화 템플릿</Label>
                          <Select
                            value={selectedTemplate[inq.id]?.toString() ?? ""}
                            onValueChange={v => setSelectedTemplate(prev => ({ ...prev, [inq.id]: Number(v) }))}
                          >
                            <SelectTrigger className="h-7 text-xs w-48">
                              <SelectValue placeholder="템플릿 선택 (선택사항)" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates?.map(t => (
                                <SelectItem key={t.id} value={t.id.toString()} className="text-xs">
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleGenerateAuto(inq)}
                          disabled={generatingId === inq.id}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs h-8"
                        >
                          {generatingId === inq.id
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> AI 변환 중...</>
                            : <><Zap className="w-3.5 h-3.5 mr-1" /> 골프장 문의 형식으로 자동 변환</>
                          }
                        </Button>
                        {inq.autoText && (
                          <div className="relative">
                            <Textarea
                              value={inq.autoText}
                              readOnly
                              rows={6}
                              className="text-sm resize-none bg-amber-50 border-amber-200"
                            />
                            <button
                              onClick={() => { navigator.clipboard.writeText(inq.autoText ?? ""); toast.success("복사됨"); }}
                              className="absolute top-2 right-2 p-1 bg-white rounded border hover:bg-gray-50"
                            >
                              <Copy className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                          </div>
                        )}
                        {!inq.autoText && (
                          <p className="text-xs text-gray-400 text-center py-3">
                            문의 탭에서 내용 입력 후 자동 변환 버튼을 클릭하세요.
                          </p>
                        )}
                      </div>
                    </TabsContent>

                    {/* 답변 탭 */}
                    <TabsContent value="reply">
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-500">골프장 답변 내용 (자동저장)</Label>
                        <Textarea
                          defaultValue={inq.replyText ?? ""}
                          onChange={e => handleReplyChange(inq.id, e.target.value)}
                          placeholder="골프장에서 받은 답변 내용을 붙여넣으세요..."
                          rows={5}
                          className="text-sm resize-none"
                        />
                        <p className="text-xs text-gray-400">답변 입력 시 상태가 '답변완료'로 자동 변경됩니다.</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 거래처별 송금 분리 표시 컴포넌트 (내륙팩 구조) ─────────────────────────────────
interface RemittanceByTypeProps {
  reservationId: number;
  reservationNo: string;
}

function RemittanceByType({ reservationId, reservationNo }: RemittanceByTypeProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRemittance, setNewRemittance] = useState({
    transactionDate: new Date().toISOString().split("T")[0],
    bankName: "",
    amount: 0,
    recipientName: "",
    recipientType: "golf_course" as "golf_course" | "accommodation" | "transport" | "other",
    detail: "",
  });

  const utils = trpc.useUtils();
  const { data: remittances, isLoading } = trpc.reservations.listRemittance.useQuery(
    { search: reservationNo, page: 1, pageSize: 50 },
    { enabled: !!reservationNo }
  );

  const addMut = trpc.reservations.addRemittance.useMutation({
    onSuccess: () => {
      toast.success("송금 내역이 등록되었습니다.");
      utils.reservations.listRemittance.invalidate();
      setShowAddForm(false);
      setNewRemittance({ transactionDate: new Date().toISOString().split("T")[0], bankName: "", amount: 0, recipientName: "", recipientType: "golf_course", detail: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const RECIPIENT_TYPE_LABELS: Record<string, string> = {
    golf_course: "골프장",
    accommodation: "숙소",
    transport: "교통",
    other: "기타",
  };
  const RECIPIENT_TYPE_COLORS: Record<string, string> = {
    golf_course: "bg-green-100 text-green-700",
    accommodation: "bg-blue-100 text-blue-700",
    transport: "bg-orange-100 text-orange-700",
    other: "bg-gray-100 text-gray-600",
  };

  // 거래처 유형별 합계
  const remittanceList = Array.isArray(remittances) ? remittances : [];

  const byType = remittanceList.reduce((acc: Record<string, number>, r) => {
    const t = (r.recipientType as string) ?? "other";
    acc[t] = (acc[t] ?? 0) + (r.amount ?? 0);
    return acc;
  }, {} as Record<string, number>);

  const totalRemitted = Object.values(byType).reduce((s, v) => s + (v as number), 0);

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700">거래처별 송금 내역</h4>
        <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)}
          className="h-7 text-xs gap-1">
          <Plus className="w-3 h-3" /> 송금 추가
        </Button>
      </div>

      {/* 유형별 합계 카드 */}
      {totalRemitted > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          {Object.entries(byType).map(([type, amount]) => (
            <div key={type} className="text-center p-2 rounded-lg bg-gray-50">
              <p className={`text-xs font-medium px-1.5 py-0.5 rounded-full inline-block mb-1 ${RECIPIENT_TYPE_COLORS[type]}`}>
                {RECIPIENT_TYPE_LABELS[type] ?? type}
              </p>
              <p className="text-sm font-bold text-gray-800">{formatKRW(amount as number)}</p>
            </div>
          ))}
          <div className="text-center p-2 rounded-lg bg-green-50">
            <p className="text-xs font-medium text-green-700 mb-1">합계</p>
            <p className="text-sm font-bold text-green-800">{formatKRW(totalRemitted)}</p>
          </div>
        </div>
      )}

      {/* 송금 내역 리스트 */}
      {isLoading ? (
        <div className="text-center py-3"><Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" /></div>
      ) : remittanceList.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">등록된 송금 내역이 없습니다</p>
      ) : (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {remittanceList.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${RECIPIENT_TYPE_COLORS[r.recipientType ?? "other"]}`}>
                  {RECIPIENT_TYPE_LABELS[r.recipientType ?? "other"]}
                </span>
                <span className="text-gray-600">{r.recipientName ?? "-"}</span>
                <span className="text-gray-400">{r.bankName ?? ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">{formatKRW(r.amount)}원</span>
                <span className="text-gray-400">{formatDate(r.transactionDate)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 송금 추가 폼 */}
      {showAddForm && (
        <div className="mt-3 p-3 border rounded-lg bg-gray-50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">송금일</Label>
              <Input type="date" value={newRemittance.transactionDate}
                onChange={e => setNewRemittance(f => ({ ...f, transactionDate: e.target.value }))}
                className="mt-0.5 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">송금액</Label>
              <Input type="number" value={newRemittance.amount}
                onChange={e => setNewRemittance(f => ({ ...f, amount: Number(e.target.value) || 0 }))}
                className="mt-0.5 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">거래처명</Label>
              <Input value={newRemittance.recipientName}
                onChange={e => setNewRemittance(f => ({ ...f, recipientName: e.target.value }))}
                placeholder="골프장명..."
                className="mt-0.5 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">거래처 유형</Label>
              <Select value={newRemittance.recipientType}
                onValueChange={v => setNewRemittance(f => ({ ...f, recipientType: v as any }))}>
                <SelectTrigger className="mt-0.5 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="golf_course">골프장</SelectItem>
                  <SelectItem value="accommodation">숙소</SelectItem>
                  <SelectItem value="transport">교통</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">은행명</Label>
              <Input value={newRemittance.bankName}
                onChange={e => setNewRemittance(f => ({ ...f, bankName: e.target.value }))}
                placeholder="신한..."
                className="mt-0.5 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">상세</Label>
              <Input value={newRemittance.detail}
                onChange={e => setNewRemittance(f => ({ ...f, detail: e.target.value }))}
                placeholder="상세 내역..."
                className="mt-0.5 h-8 text-xs" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}
              className="h-7 text-xs">취소</Button>
            <Button size="sm" onClick={() => addMut.mutate({
              ...newRemittance,
              reservationNo,
              matchedReservationId: reservationId,
            })} disabled={addMut.isPending}
              className="h-7 text-xs bg-green-700 hover:bg-green-800 text-white">
              {addMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              등록
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 예약 수정 다이얼로그 ────────────────────────────────────────────────
interface EditDialogProps {
  item: any;
  onClose: () => void;
  onSuccess: () => void;
}

function EditDialog({ item, onClose, onSuccess }: EditDialogProps) {
  const [, navigate] = useLocation();
  const [affiliateSearch, setAffiliateSearch] = useState(item.golfCourseName ?? "");
  const [showAffDropdown, setShowAffDropdown] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState(item.partnerCompanyName ?? "");
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const [form, setForm] = useState({
    productName: item.productName ?? "",
    golfCourseName: item.golfCourseName ?? "",
    affiliateId: item.affiliateId as number | undefined,
    departureDate: item.departureDate ? new Date(item.departureDate).toISOString().split("T")[0] : "",
    nights: item.nights ?? 0,
    teams: item.teams ?? 1,
    headcount: item.headcount ?? 1,
    customerName: item.customerName ?? "",
    customerPhone: item.customerPhone ?? "",
    customerEmail: item.customerEmail ?? "",
    assignedTo: item.assignedTo ?? "",
    agentName: item.agentName ?? "",
    salePricePerPerson: item.salePricePerPerson ?? 0,
    salePriceTotal: item.salePriceTotal ?? 0,
    depositPrice: item.depositPrice ?? 0,
    extraFee: item.extraFee ?? 0,
    profit: item.profit ?? 0,
    status: (item.status ?? "pending") as StatusType,
    notes: item.notes ?? "",
    userType: (item.userType ?? "customer") as UserType,
    partnerId: item.partnerId as number | undefined,
    partnerCompanyName: item.partnerCompanyName ?? "",
    partnerContactName: item.partnerContactName ?? "",
    partnerContactPhone: item.partnerContactPhone ?? "",
    managerName: item.managerName ?? "",
    managerPhone: item.managerPhone ?? "",
  });

  const { data: affiliateData } = trpc.affiliates.list.useQuery(
    { page: 1, pageSize: 20, search: affiliateSearch, type: "all", status: "active" },
    { enabled: affiliateSearch.length >= 1 }
  );
  const { data: partnerData } = trpc.crm.getPartners.useQuery(
    { search: partnerSearch },
    { enabled: partnerSearch.length >= 1 }
  );

  const updateMut = trpc.reservations.update.useMutation({
    onSuccess: () => { toast.success("예약이 수정되었습니다."); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  // 상태 변경 (확정 시 예약목록으로 이동)
  function handleStatusChange(newStatus: StatusType) {
    setForm(f => ({ ...f, status: newStatus }));
    updateMut.mutate({ id: item.id, status: newStatus }, {
      onSuccess: () => {
        if (newStatus === "confirmed") {
          toast.success("예약이 확정되었습니다. 예약목록으로 이동합니다.");
          setTimeout(() => { onClose(); navigate("/erp/bookings"); }, 1000);
        }
      }
    });
  }

  function handleSave() {
    updateMut.mutate({ id: item.id, ...form });
  }

  const numField = (key: keyof typeof form) => ({
    value: form[key] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: Number(e.target.value) || 0 })),
  });

  return (
    <div className="space-y-0">
      {/* 상단 액션 바 (상태 아이콘 + 저장/취소) */}
      <div className="flex items-center justify-between pb-3 border-b mb-4">
        <div className="flex items-center gap-1">
          {(["pending", "confirmed", "cancelled", "completed"] as StatusType[]).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              title={STATUS_LABELS[s]}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                form.status === s
                  ? STATUS_COLORS[s] + " border-current shadow-sm"
                  : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"
              }`}
            >
              {STATUS_ICONS[s]}
              <span className="hidden sm:inline">{STATUS_LABELS[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
          <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}
            className="bg-green-700 hover:bg-green-800 text-white">
            {updateMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
            수정 저장
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="mb-4">
          <TabsTrigger value="basic">기본 정보</TabsTrigger>
          <TabsTrigger value="contact">고객/파트너</TabsTrigger>
          <TabsTrigger value="price">금액</TabsTrigger>
          <TabsTrigger value="inquiry">문의 관리</TabsTrigger>
        </TabsList>

        {/* 기본 정보 탭 */}
        <TabsContent value="basic" className="space-y-3">
          <div>
            <Label className="text-xs">상품명</Label>
            <Input value={form.productName}
              onChange={e => setForm(f => ({ ...f, productName: e.target.value }))}
              className="mt-1" />
          </div>
          <div className="relative">
            <Label className="text-xs">골프장명 (제휴사 검색)</Label>
            <Input
              value={affiliateSearch}
              onChange={e => {
                setAffiliateSearch(e.target.value);
                setForm(f => ({ ...f, golfCourseName: e.target.value, affiliateId: undefined }));
                setShowAffDropdown(true);
              }}
              onFocus={() => affiliateSearch.length >= 1 && setShowAffDropdown(true)}
              onBlur={() => setTimeout(() => setShowAffDropdown(false), 200)}
              placeholder="골프장명 검색..."
              className="mt-1"
            />
            {showAffDropdown && affiliateData && affiliateData.items.length > 0 && (
              <div className="absolute z-50 w-full bg-white border rounded-lg shadow-xl mt-1 max-h-40 overflow-y-auto">
                {affiliateData.items.map(aff => (
                  <button key={aff.id} type="button"
                    className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm border-b last:border-0"
                    onMouseDown={() => {
                      setAffiliateSearch(aff.name);
                      setForm(f => ({ ...f, golfCourseName: aff.name, affiliateId: aff.id }));
                      setShowAffDropdown(false);
                    }}>
                    <span className="font-medium">{aff.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{aff.country ?? ""}</span>
                  </button>
                ))}
              </div>
            )}
            {form.affiliateId && <p className="text-xs text-green-600 mt-1">✓ 제휴사 연결됨</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">출발일</Label>
              <Input type="date" value={form.departureDate}
                onChange={e => setForm(f => ({ ...f, departureDate: e.target.value }))}
                className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">박수</Label>
              <Input type="number" min={0} {...numField("nights")} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">팀수</Label>
              <Input type="number" min={1} {...numField("teams")} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">인원</Label>
              <Input type="number" min={1} {...numField("headcount")} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">메모</Label>
            <Textarea value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} className="mt-1 text-sm" />
          </div>
        </TabsContent>

        {/* 고객/파트너 탭 */}
        <TabsContent value="contact" className="space-y-3">
          {/* 유저 구분 */}
          <div>
            <Label className="text-xs font-semibold">예약 유형</Label>
            <div className="flex gap-2 mt-1">
              {(["customer", "partner", "manager"] as UserType[]).map((type) => (
                <button key={type} type="button"
                  onClick={() => setForm(f => ({ ...f, userType: type }))}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
                    form.userType === type
                      ? "bg-green-700 text-white border-green-700"
                      : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
                  }`}>
                  {USER_TYPE_ICONS[type]} {USER_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {form.userType === "customer" && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 rounded-lg">
              <div>
                <Label className="text-xs">고객명</Label>
                <Input value={form.customerName}
                  onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                  className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">연락처</Label>
                <Input value={form.customerPhone}
                  onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                  className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">이메일</Label>
                <Input value={form.customerEmail}
                  onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
                  className="mt-1" />
              </div>
            </div>
          )}

          {form.userType === "partner" && (
            <div className="p-3 bg-purple-50 rounded-lg space-y-2">
              <div className="relative">
                <Label className="text-xs">파트너 검색</Label>
                <Input
                  value={partnerSearch}
                  onChange={e => { setPartnerSearch(e.target.value); setShowPartnerDropdown(true); }}
                  onFocus={() => partnerSearch.length >= 1 && setShowPartnerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPartnerDropdown(false), 200)}
                  placeholder="파트너사 검색..."
                  className="mt-1"
                />
          {showPartnerDropdown && partnerData && partnerData.length > 0 && (
            <div className="absolute z-50 w-full bg-white border rounded-lg shadow-xl mt-1 max-h-40 overflow-y-auto left-0">
              {partnerData.map((p: any) => (
                      <button key={p.id} type="button"
                        className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm border-b last:border-0"
                        onMouseDown={() => {
                          setPartnerSearch(p.companyName || p.name || "");
                          setForm(f => ({
                            ...f, partnerId: p.id,
                            partnerCompanyName: p.companyName || p.name || "",
                            partnerContactName: p.contactName || "",
                            partnerContactPhone: p.phone || "",
                          }));
                          setShowPartnerDropdown(false);
                        }}>
                        <span className="font-medium">{p.companyName || p.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{p.contactName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">업체명</Label>
                  <Input value={form.partnerCompanyName}
                    onChange={e => setForm(f => ({ ...f, partnerCompanyName: e.target.value }))}
                    className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">담당자명</Label>
                  <Input value={form.partnerContactName}
                    onChange={e => setForm(f => ({ ...f, partnerContactName: e.target.value }))}
                    className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">연락처</Label>
                  <Input value={form.partnerContactPhone}
                    onChange={e => setForm(f => ({ ...f, partnerContactPhone: e.target.value }))}
                    className="mt-1" />
                </div>
              </div>
            </div>
          )}

          {form.userType === "manager" && (
            <div className="p-3 bg-gray-50 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">담당자명</Label>
                  <Input value={form.managerName}
                    onChange={e => setForm(f => ({ ...f, managerName: e.target.value }))}
                    className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">담당자 연락처</Label>
                  <Input value={form.managerPhone}
                    onChange={e => setForm(f => ({ ...f, managerPhone: e.target.value }))}
                    className="mt-1" />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <Label className="text-xs">담당자 (내부)</Label>
              <Input value={form.assignedTo}
                onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">대리점명</Label>
              <Input value={form.agentName}
                onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))}
                className="mt-1" />
            </div>
          </div>
        </TabsContent>

        {/* 금액 탭 */}
        <TabsContent value="price" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">1인 판매가</Label>
              <Input type="number" min={0} {...numField("salePricePerPerson")} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">판매 합계</Label>
              <Input type="number" min={0} {...numField("salePriceTotal")} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">입금가 (공급가)</Label>
              <Input type="number" min={0} {...numField("depositPrice")} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">추가요금</Label>
              <Input type="number" min={0} {...numField("extraFee")} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">수익</Label>
              <Input type="number" min={0} {...numField("profit")} className="mt-1" />
            </div>
          </div>
          {/* 거래처별 송금 분리 표시 */}
          <RemittanceByType reservationId={item.id} reservationNo={item.reservationNo} />
        </TabsContent>

        {/* 문의 관리 탭 */}
        <TabsContent value="inquiry">
          <InquiryTabs reservationId={item.id} reservationNo={item.reservationNo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────
export default function ReservationManagement() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusType>("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentStatusType>("all");
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  const { data, refetch } = trpc.reservations.list.useQuery({
    page, pageSize: 20, search, status: statusFilter, paymentStatus: paymentFilter,
  });
  const { data: summary } = trpc.reservations.summary.useQuery();

  const deleteMut = trpc.reservations.delete.useMutation({
    onSuccess: () => { toast.success("예약이 삭제되었습니다."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  // 대시보드 상태별 카드 (요청사항: 대기=신규접수, 확정=미수금, 완료=미매칭입금)
  const dashboardCards = [
    {
      label: "대기 (신규접수)",
      value: summary?.statusCounts?.pending ?? 0,
      unit: "건",
      icon: <Clock className="w-5 h-5 text-yellow-500" />,
      color: "text-yellow-600",
      filter: "pending" as StatusType,
    },
    {
      label: "확정 (미수금)",
      value: summary?.unpaidAmount ?? 0,
      unit: "원",
      icon: <DollarSign className="w-5 h-5 text-green-500" />,
      color: "text-green-600",
      filter: "confirmed" as StatusType,
    },
    {
      label: "완료 (미매칭입금)",
      value: summary?.unmatchedIncome ?? 0,
      unit: "건",
      icon: <AlertCircle className="w-5 h-5 text-red-500" />,
      color: "text-red-600",
      filter: "completed" as StatusType,
    },
    {
      label: "이번달 매출",
      value: summary?.monthSales ?? 0,
      unit: "원",
      icon: <TrendingUp className="w-5 h-5 text-blue-500" />,
      color: "text-blue-600",
      filter: null,
    },
  ];

  return (
    <ERPLayout>
      <div className="p-4 md:p-6 space-y-5">
        {/* 대시보드 상태별 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {dashboardCards.map((card) => (
            <Card
              key={card.label}
              className={`cursor-pointer hover:shadow-md transition-shadow ${card.filter ? "hover:border-green-400" : ""}`}
              onClick={() => card.filter && setStatusFilter(card.filter)}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-2">
                  {card.icon}
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 truncate">{card.label}</p>
                    <p className={`text-lg font-bold ${card.color}`}>
                      {card.unit === "원" ? formatKRW(card.value as number) : (card.value as number).toLocaleString()}
                      <span className="text-xs font-normal ml-0.5">{card.unit}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 검색 및 필터 */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-2 flex-1 min-w-[200px]">
            <Input
              placeholder="예약번호, 고객명, 상품명 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
              className="h-9"
            />
            <Button variant="outline" size="sm" onClick={() => { setSearch(searchInput); setPage(1); }}>
              <Search className="w-4 h-4" />
            </Button>
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1); }}>
            <SelectTrigger className="w-28 h-9">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="pending">대기</SelectItem>
              <SelectItem value="confirmed">확정</SelectItem>
              <SelectItem value="cancelled">취소</SelectItem>
              <SelectItem value="completed">완료</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v as any); setPage(1); }}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="입금상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 입금</SelectItem>
              <SelectItem value="unpaid">미입금</SelectItem>
              <SelectItem value="partial">부분입금</SelectItem>
              <SelectItem value="paid">완납</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowQuickCreate(true)}
            className="bg-green-700 hover:bg-green-800 text-white h-9">
            <Plus className="w-4 h-4 mr-1" /> 신규 예약
          </Button>
        </div>

        {/* 예약 목록 테이블 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              예약 목록 <span className="text-gray-400 font-normal">({total.toLocaleString()}건)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["예약번호", "골프장", "출발일", "팀/인원", "고객", "유형", "입금상태", "상태", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-gray-400">
                        예약 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-xs text-blue-600 font-bold">{item.reservationNo}</span>
                        </td>
                        <td className="px-3 py-2.5 max-w-[140px] truncate text-xs" title={item.golfCourseName ?? ""}>
                          {item.golfCourseName ?? item.productName}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs">{formatDate(item.departureDate)}</td>
                        <td className="px-3 py-2.5 text-xs text-center whitespace-nowrap">
                          {item.teams}팀/{item.headcount}명
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">{item.customerName}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                            (item as any).userType === "partner" ? "bg-purple-100 text-purple-700" :
                            (item as any).userType === "manager" ? "bg-gray-100 text-gray-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {USER_TYPE_ICONS[(item as any).userType as UserType ?? "customer"]}
                            {USER_TYPE_LABELS[(item as any).userType as UserType ?? "customer"]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_COLORS[item.paymentStatus as PaymentStatusType]}`}>
                            {PAYMENT_LABELS[item.paymentStatus as PaymentStatusType]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {/* 상태 아이콘 버튼 */}
                          <div className="flex gap-0.5">
                            {(["pending", "confirmed", "cancelled", "completed"] as StatusType[]).map((s) => (
                              <button
                                key={s}
                                title={STATUS_LABELS[s]}
                                onClick={() => {
                                  if (item.status !== s) {
                                    // 빠른 상태 변경
                                    setEditItem({ ...item, status: s });
                                  }
                                }}
                                className={`p-1 rounded transition-all ${
                                  item.status === s
                                    ? STATUS_COLORS[s] + " border"
                                    : "text-gray-300 hover:text-gray-500"
                                }`}
                              >
                                {STATUS_ICONS[s]}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            <button onClick={() => setEditItem(item)}
                              className="p-1 hover:bg-yellow-50 rounded text-yellow-600" title="수정">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMut.mutate({ id: item.id }); }}
                              className="p-1 hover:bg-red-50 rounded text-red-500" title="삭제">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 신규 예약 간소화 모달 */}
      <Dialog open={showQuickCreate} onOpenChange={setShowQuickCreate}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-700" /> 신규 예약 등록
            </DialogTitle>
          </DialogHeader>
          <QuickCreateForm
            onSuccess={() => { setShowQuickCreate(false); refetch(); }}
            onCancel={() => setShowQuickCreate(false)}
            currentUser={user}
          />
        </DialogContent>
      </Dialog>

      {/* 예약 수정 모달 */}
      <Dialog open={editItem !== null} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Edit2 className="w-4 h-4" />
              예약 수정
              <span className="font-mono text-blue-600 text-xs">{editItem?.reservationNo}</span>
            </DialogTitle>
          </DialogHeader>
          {editItem && (
            <EditDialog
              item={editItem}
              onClose={() => setEditItem(null)}
              onSuccess={() => { setEditItem(null); refetch(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </ERPLayout>
  );
}
