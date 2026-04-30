import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Search, Calendar, CreditCard, CheckCircle, XCircle, Clock,
  ExternalLink, User, Users, FileText, Settings2, ChevronRight,
  Phone, Mail, MapPin, Hash, Plane,
} from "lucide-react";

// ─── 상수 매핑 ─────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:   { label: "대기",  color: "bg-amber-100 text-amber-700" },
  confirmed: { label: "확정",  color: "bg-green-100 text-green-700" },
  cancelled: { label: "취소",  color: "bg-red-100 text-red-700" },
  completed: { label: "완료",  color: "bg-slate-100 text-slate-700" },
};

const PAYMENT_MAP: Record<string, { label: string; color: string }> = {
  unpaid:   { label: "미결제",   color: "bg-red-50 text-red-600" },
  partial:  { label: "부분결제", color: "bg-amber-50 text-amber-600" },
  paid:     { label: "완납",     color: "bg-green-50 text-green-700" },
  refunded: { label: "환불",     color: "bg-slate-50 text-slate-600" },
};

const PAYMENT_STATUS_ICON: Record<string, React.ReactNode> = {
  pending:   <Clock size={14} className="text-amber-500" />,
  succeeded: <CheckCircle size={14} className="text-green-500" />,
  failed:    <XCircle size={14} className="text-red-500" />,
  refunded:  <XCircle size={14} className="text-slate-400" />,
  cancelled: <XCircle size={14} className="text-slate-400" />,
};

// ─── 결제 이력 패널 ─────────────────────────────────────────
function PaymentHistoryPanel({ bookingId }: { bookingId: number }) {
  const { data: history, isLoading } = trpc.payment.getHistory.useQuery({ bookingId });
  if (isLoading) return <p className="text-xs text-slate-400 py-2">로딩 중...</p>;
  if (!history?.length) return <p className="text-xs text-slate-400 py-2">결제 이력이 없습니다.</p>;
  return (
    <div className="space-y-2">
      {history.map((p: any) => (
        <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            {PAYMENT_STATUS_ICON[p.status] ?? <Clock size={14} />}
            <span className="font-mono text-xs text-slate-500">{p.stripePaymentIntentId?.slice(-12)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-800">{Number(p.amount).toLocaleString()}원</span>
            <Badge className="text-xs bg-slate-100 text-slate-600">{p.status}</Badge>
            {p.receiptUrl && (
              <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-700">
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 결제 요청 다이얼로그 ───────────────────────────────────
function PaymentRequestDialog({ bookingId, totalAmount, onClose }: {
  bookingId: number;
  totalAmount: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [amount, setAmount] = useState(totalAmount);
  const [step, setStep] = useState<"input" | "result">("input");
  const [clientSecret, setClientSecret] = useState("");
  const [paymentIntentId, setPaymentIntentId] = useState("");

  const createIntentMutation = trpc.payment.createIntent.useMutation({
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setStep("result");
      utils.payment.getHistory.invalidate({ bookingId });
      toast.success("결제 인텐트가 생성되었습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard size={18} className="text-indigo-600" />
            결제 요청
          </DialogTitle>
        </DialogHeader>
        {step === "input" ? (
          <div className="space-y-4">
            <div>
              <Label>결제 금액 (원)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1 font-mono"
                min={1000}
                step={1000}
              />
              <p className="text-xs text-slate-400 mt-1">
                예약 총액: {totalAmount.toLocaleString()}원 (KRW, 소수점 없음)
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
              <p className="font-medium mb-1">테스트 결제 안내</p>
              <p>테스트 카드: <span className="font-mono">4242 4242 4242 4242</span></p>
              <p>만료일: 미래 날짜, CVC: 임의 3자리</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>취소</Button>
              <Button
                onClick={() => createIntentMutation.mutate({ bookingId, amountKrw: amount })}
                disabled={createIntentMutation.isPending || amount < 1000}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {createIntentMutation.isPending ? "처리 중..." : "결제 인텐트 생성"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-green-600" />
                <p className="font-medium text-green-800 text-sm">결제 인텐트 생성 완료</p>
              </div>
              <p className="text-xs text-slate-600 mb-1">
                Payment Intent ID: <span className="font-mono text-slate-800">{paymentIntentId}</span>
              </p>
              <p className="text-xs text-slate-500">
                Stripe 웹훅을 통해 결제 완료 시 예약이 자동 확정됩니다.
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-600 mb-1">Client Secret (개발용)</p>
              <p className="font-mono text-xs text-slate-500 break-all">{clientSecret.slice(0, 40)}...</p>
            </div>
            <DialogFooter>
              <Button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700 text-white">확인</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── 예약 상세 모달 ─────────────────────────────────────────
type DetailTab = "info" | "travelers" | "payment" | "manage";

function BookingDetailDialog({ bookingId, bookingSource, onClose }: { bookingId: number; bookingSource?: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.bookings.get.useQuery({ id: bookingId, source: (bookingSource as any) });
  const [activeTab, setActiveTab] = useState<DetailTab>("info");
  const [newStatus, setNewStatus] = useState("");
  const [adminMemo, setAdminMemo] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const updateMutation = trpc.bookings.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("예약 상태가 변경되었습니다.");
      utils.bookings.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const tabs: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
    { id: "info",      label: "기본 정보",  icon: <FileText size={14} /> },
    { id: "travelers", label: "여행자",     icon: <Users size={14} /> },
    { id: "payment",   label: "결제",       icon: <CreditCard size={14} /> },
    { id: "manage",    label: "상태 관리",  icon: <Settings2 size={14} /> },
  ];

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="py-16 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm">예약 정보를 불러오는 중...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  if (!data) return null;

  const isReservation = (data as any)._source === "reservation";
  const productName = isReservation
    ? ((data as any)._golfCourseName || (data as any)._productName || "-")
    : ((data as any).package?.title || "-");

  // selectedOptions 파싱
  let parsedOptions: any[] = [];
  try {
    if (data.selectedOptions) {
      const raw = typeof data.selectedOptions === "string"
        ? JSON.parse(data.selectedOptions)
        : data.selectedOptions;
      parsedOptions = Array.isArray(raw) ? raw : [];
    }
  } catch { /* ignore */ }

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* 헤더 */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {isReservation && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">수기</span>
                  )}
                  <h2 className="text-lg font-bold text-slate-800 font-mono">{data.bookingNumber}</h2>
                </div>
                <p className="text-sm text-slate-500 flex items-center gap-1.5">
                  <MapPin size={12} />
                  {productName}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={`text-xs ${STATUS_MAP[data.status]?.color}`}>
                  {STATUS_MAP[data.status]?.label}
                </Badge>
                <Badge className={`text-xs ${PAYMENT_MAP[data.paymentStatus || "unpaid"]?.color}`}>
                  {PAYMENT_MAP[data.paymentStatus || "unpaid"]?.label}
                </Badge>
              </div>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex border-b border-slate-100 bg-slate-50/50 px-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === "travelers" && (data as any).travelers?.length > 0 && (
                  <span className="ml-1 bg-indigo-100 text-indigo-600 text-xs rounded-full px-1.5 py-0.5 leading-none">
                    {(data as any).travelers.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 탭 컨텐츠 */}
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ── 기본 정보 탭 ── */}
            {activeTab === "info" && (
              <div className="space-y-4">
                {/* 예약자 정보 */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">예약자 정보</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow icon={<User size={13} />} label="예약자" value={data.leaderName} />
                    <InfoRow icon={<Phone size={13} />} label="연락처" value={data.leaderPhone} />
                    <InfoRow icon={<Mail size={13} />} label="이메일" value={data.leaderEmail || "-"} />
                    <InfoRow icon={<Users size={13} />} label="인원" value={`성인 ${data.adultCount}명 / 아동 ${data.childCount}명`} />
                  </div>
                </div>

                {/* 여행 정보 */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">여행 정보</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow icon={<Plane size={13} />} label="출발일"
                      value={data.departureDate ? new Date(data.departureDate).toLocaleDateString("ko-KR") : "-"} />
                    <InfoRow icon={<Plane size={13} className="rotate-180" />} label="귀국일"
                      value={(data as any).returnDate ? new Date((data as any).returnDate).toLocaleDateString("ko-KR") : "-"} />
                    <InfoRow icon={<Hash size={13} />} label="라운딩"
                      value={`${data.roundCount}회 / 카트:${data.cartIncluded ? "포함" : "미포함"} / 캐디:${data.caddieIncluded ? "포함" : "미포함"}`} />
                    <InfoRow icon={<Calendar size={13} />} label="예약일"
                      value={new Date(data.createdAt).toLocaleDateString("ko-KR")} />
                  </div>
                </div>

                {/* 금액 정보 */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">금액 정보</h3>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">기본 요금</span>
                      <span className="font-medium">{Number(data.basePrice || 0).toLocaleString()}원</span>
                    </div>
                    {Number(data.optionPrice || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">옵션 요금</span>
                        <span className="font-medium">+{Number(data.optionPrice).toLocaleString()}원</span>
                      </div>
                    )}
                    {Number(data.discountAmount || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">할인</span>
                        <span className="font-medium text-red-500">-{Number(data.discountAmount).toLocaleString()}원</span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-2 flex justify-between">
                      <span className="font-semibold text-slate-700">총 결제금액</span>
                      <span className="font-bold text-indigo-700 text-base">{Number(data.totalAmount).toLocaleString()}원</span>
                    </div>
                    {Number(data.paidAmount || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">결제 완료</span>
                        <span className="font-medium text-green-600">{Number(data.paidAmount).toLocaleString()}원</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 선택 옵션 */}
                {parsedOptions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">선택 옵션</h3>
                    <div className="space-y-2">
                      {parsedOptions.map((opt: any, i: number) => (
                        <div key={i} className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2 text-sm">
                          <span className="text-slate-700">{opt.name || opt.optionName || `옵션 ${i + 1}`}</span>
                          <div className="flex items-center gap-2">
                            {opt.quantity && <span className="text-slate-500 text-xs">×{opt.quantity}</span>}
                            {opt.price && <span className="font-medium text-indigo-700">{Number(opt.price).toLocaleString()}원</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 고객 요청사항 */}
                {data.customerMemo && (
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-blue-600 mb-2">고객 요청사항</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{data.customerMemo}</p>
                  </div>
                )}

                {/* 관리자 메모 */}
                {data.adminMemo && (
                  <div className="bg-amber-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-amber-600 mb-2">관리자 메모</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{data.adminMemo}</p>
                  </div>
                )}

                {/* 취소 사유 */}
                {data.cancelReason && (
                  <div className="bg-red-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-red-600 mb-2">취소 사유</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{data.cancelReason}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── 여행자 탭 ── */}
            {activeTab === "travelers" && (
              <div>
                {!(data as any).travelers?.length ? (
                  <div className="py-12 text-center">
                    <Users size={36} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">등록된 여행자 정보가 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(data as any).travelers.map((t: any, i: number) => (
                      <div key={t.id} className={`rounded-xl border p-4 ${t.isLeader ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 bg-white"}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${t.isLeader ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                            {i + 1}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800">{t.name}</span>
                            {t.isLeader && <Badge className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 border-0">대표</Badge>}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {t.nameEn && (
                            <div>
                              <span className="text-slate-400">영문명</span>
                              <p className="font-medium text-slate-700 font-mono mt-0.5">{t.nameEn}</p>
                            </div>
                          )}
                          {t.gender && (
                            <div>
                              <span className="text-slate-400">성별</span>
                              <p className="font-medium text-slate-700 mt-0.5">{t.gender === "male" ? "남성" : "여성"}</p>
                            </div>
                          )}
                          {t.birthDate && (
                            <div>
                              <span className="text-slate-400">생년월일</span>
                              <p className="font-medium text-slate-700 mt-0.5">{t.birthDate}</p>
                            </div>
                          )}
                          {t.phone && (
                            <div>
                              <span className="text-slate-400">연락처</span>
                              <p className="font-medium text-slate-700 mt-0.5">{t.phone}</p>
                            </div>
                          )}
                          {t.passportNumber && (
                            <div>
                              <span className="text-slate-400">여권번호</span>
                              <p className="font-medium text-slate-700 font-mono mt-0.5">{t.passportNumber}</p>
                            </div>
                          )}
                          {t.passportExpiry && (
                            <div>
                              <span className="text-slate-400">여권 만료일</span>
                              <p className="font-medium text-slate-700 mt-0.5">{t.passportExpiry}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 결제 탭 ── */}
            {activeTab === "payment" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">결제 현황</p>
                    <p className="text-xs text-slate-400 mt-0.5">총 {Number(data.totalAmount).toLocaleString()}원 중 {Number(data.paidAmount || 0).toLocaleString()}원 결제</p>
                  </div>
                  {data.paymentStatus !== "paid" && (
                    <Button
                      size="sm"
                      onClick={() => setShowPaymentDialog(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs"
                    >
                      <CreditCard size={13} className="mr-1.5" />
                      결제 요청
                    </Button>
                  )}
                </div>
                <PaymentHistoryPanel bookingId={bookingId} />
              </div>
            )}

            {/* ── 상태 관리 탭 ── */}
            {activeTab === "manage" && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">예약 상태 변경</p>
                  <div className="flex gap-2 flex-wrap">
                    {["pending", "confirmed", "cancelled", "completed"].map((s) => (
                      <Button
                        key={s}
                        variant={newStatus === s ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNewStatus(s)}
                        className={newStatus === s ? "bg-indigo-600 text-white" : ""}
                      >
                        {STATUS_MAP[s].label}
                      </Button>
                    ))}
                  </div>
                  {newStatus && (
                    <p className="text-xs text-indigo-600 mt-2 flex items-center gap-1">
                      <ChevronRight size={12} />
                      현재 상태 <strong>{STATUS_MAP[data.status]?.label}</strong> → <strong>{STATUS_MAP[newStatus]?.label}</strong> 으로 변경 예정
                    </p>
                  )}
                </div>

                {newStatus === "cancelled" && (
                  <div>
                    <Label>취소 사유</Label>
                    <Input
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="취소 사유를 입력하세요"
                      className="mt-1"
                    />
                  </div>
                )}

                <div>
                  <Label>관리자 메모</Label>
                  <Textarea
                    value={adminMemo}
                    onChange={(e) => setAdminMemo(e.target.value)}
                    placeholder={data.adminMemo ? `기존 메모: ${data.adminMemo}` : "내부 메모 (고객에게 표시되지 않음)"}
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 하단 버튼 */}
          <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-white">
            <p className="text-xs text-slate-400">
              최종 수정: {new Date(data.updatedAt).toLocaleString("ko-KR")}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>닫기</Button>
              {activeTab === "manage" && (
                <Button
                  onClick={() => updateMutation.mutate({
                    id: bookingId,
                    status: (newStatus as any) || data.status,
                    adminMemo: adminMemo || undefined,
                    cancelReason: cancelReason || undefined,
                  })}
                  disabled={updateMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {updateMutation.isPending ? "저장 중..." : "저장"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showPaymentDialog && (
        <PaymentRequestDialog
          bookingId={bookingId}
          totalAmount={Number(data.totalAmount)}
          onClose={() => setShowPaymentDialog(false)}
        />
      )}
    </>
  );
}

// ─── 정보 행 컴포넌트 ────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-sm font-medium text-slate-800 truncate">{value}</p>
    </div>
  );
}

// ─── 메인 예약 목록 페이지 ───────────────────────────────────
export default function BookingsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<{ id: number; source: string } | null>(null);

  const { data, isLoading } = trpc.bookings.list.useQuery({
    page,
    limit: 15,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  return (
    <>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">예약관리</h1>
          <p className="text-slate-500 text-sm mt-1">예약 현황을 실시간으로 관리합니다</p>
        </div>

        {/* 필터 */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="예약자명 검색..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="pending">대기</SelectItem>
                  <SelectItem value="confirmed">확정</SelectItem>
                  <SelectItem value="cancelled">취소</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 테이블 */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-20 text-center text-slate-400">로딩 중...</div>
            ) : !data?.items?.length ? (
              <div className="py-20 text-center">
                <Calendar size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400">예약 내역이 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">예약번호</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium hidden md:table-cell">골프장/상품</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">예약자</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium hidden sm:table-cell">연락처</th>
                      <th className="text-center px-4 py-3 text-slate-500 font-medium hidden sm:table-cell">인원</th>
                      <th className="text-right px-4 py-3 text-slate-500 font-medium">금액</th>
                      <th className="text-center px-4 py-3 text-slate-500 font-medium">예약상태</th>
                      <th className="text-center px-4 py-3 text-slate-500 font-medium hidden sm:table-cell">결제상태</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium hidden lg:table-cell">예약일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.items.map((booking: any) => (
                      <tr
                        key={booking.id}
                        className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                        onClick={() => setSelectedBooking({ id: booking.id, source: (booking as any)._source || 'booking' })}
                      >
                        <td className="px-5 py-3 font-mono text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            {(booking as any)._source === "reservation" && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">수기</span>
                            )}
                            <span>{booking.bookingNumber}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs hidden md:table-cell max-w-[130px]">
                          <span className="truncate block">
                            {(booking as any)._source === "reservation"
                              ? ((booking as any)._golfCourseName || (booking as any)._productName || "-")
                              : ((booking as any).package?.title || "-")}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 group-hover:text-indigo-700 transition-colors">
                          {booking.leaderName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{booking.leaderPhone}</td>
                        <td className="px-4 py-3 text-center text-slate-600 hidden sm:table-cell">{booking.totalPeople}명</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {Number(booking.totalAmount).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`text-xs ${STATUS_MAP[booking.status]?.color}`}>
                            {STATUS_MAP[booking.status]?.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center hidden sm:table-cell">
                          <Badge className={`text-xs ${PAYMENT_MAP[booking.paymentStatus || "unpaid"]?.color}`}>
                            {PAYMENT_MAP[booking.paymentStatus || "unpaid"]?.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                          {new Date(booking.createdAt).toLocaleDateString("ko-KR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 페이지네이션 */}
        {data && data.total > 15 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">총 {data.total}건</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>이전</Button>
              <span className="text-sm text-slate-600 px-3 py-1.5">{page} / {Math.ceil(data.total / 15)}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(data.total / 15)}>다음</Button>
            </div>
          </div>
        )}
      </div>

      {selectedBooking !== null && (
        <BookingDetailDialog bookingId={selectedBooking.id} bookingSource={selectedBooking.source} onClose={() => setSelectedBooking(null)} />
      )}
    </>
  );
}
