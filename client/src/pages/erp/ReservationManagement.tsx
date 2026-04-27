import { useState, useMemo } from "react";
import ERPLayout from "@/components/ERPLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Search, Eye, Edit2, Trash2, ChevronLeft, ChevronRight,
  TrendingUp, AlertCircle, DollarSign, Calendar,
} from "lucide-react";
import { toast } from "sonner";

type StatusType = "pending" | "confirmed" | "cancelled" | "completed";
type PaymentStatusType = "unpaid" | "partial" | "paid";

const STATUS_LABELS: Record<StatusType, string> = {
  pending: "대기", confirmed: "확정", cancelled: "취소", completed: "완료",
};
const STATUS_COLORS: Record<StatusType, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
};
const PAYMENT_LABELS: Record<PaymentStatusType, string> = {
  unpaid: "미입금", partial: "부분입금", paid: "완납",
};
const PAYMENT_COLORS: Record<PaymentStatusType, string> = {
  unpaid: "bg-red-100 text-red-700",
  partial: "bg-orange-100 text-orange-700",
  paid: "bg-green-100 text-green-700",
};

function formatKRW(n: number | null | undefined) {
  if (!n) return "0";
  return n.toLocaleString("ko-KR");
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("ko-KR");
}

const defaultForm = {
  productName: "", golfCourseName: "", departureDate: "",
  nights: 0, teams: 1, headcount: 1,
  customerName: "", customerPhone: "", customerEmail: "",
  assignedTo: "", agentName: "",
  salePricePerPerson: 0, salePriceTotal: 0,
  depositPrice: 0, extraFee: 0, profit: 0,
  status: "pending" as StatusType, notes: "",
  affiliateId: undefined as number | undefined,
};

export default function ReservationManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusType>("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentStatusType>("all");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [form, setForm] = useState({ ...defaultForm });

  // 제휴사 검색 드롭다운 상태
  const [affiliateSearch, setAffiliateSearch] = useState("");
  const [showAffiliateDropdown, setShowAffiliateDropdown] = useState(false);

  const { data, refetch } = trpc.reservations.list.useQuery({
    page, pageSize: 20, search, status: statusFilter, paymentStatus: paymentFilter,
  });
  const { data: summary } = trpc.reservations.summary.useQuery();
  const { data: detail } = trpc.reservations.getById.useQuery(
    { id: showDetail! },
    { enabled: showDetail !== null }
  );

  // 제휴사 검색 쿼리 (1글자 이상 입력 시 활성화)
  const { data: affiliateData } = trpc.affiliates.list.useQuery(
    { page: 1, pageSize: 20, search: affiliateSearch, type: "all", status: "active" },
    { enabled: affiliateSearch.length >= 1 }
  );

  const createMut = trpc.reservations.create.useMutation({
    onSuccess: () => { toast.success("예약이 등록되었습니다."); setShowForm(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.reservations.update.useMutation({
    onSuccess: () => { toast.success("예약이 수정되었습니다."); setShowForm(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.reservations.delete.useMutation({
    onSuccess: () => { toast.success("예약이 삭제되었습니다."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  function openCreate() {
    setForm({ ...defaultForm });
    setEditId(null);
    setAffiliateSearch("");
    setShowForm(true);
  }

  function openEdit(item: typeof items[0]) {
    setAffiliateSearch(item.golfCourseName ?? "");
    setForm({
      productName: item.productName,
      golfCourseName: item.golfCourseName ?? "",
      departureDate: item.departureDate ? new Date(item.departureDate).toISOString().split("T")[0] : "",
      nights: item.nights ?? 0,
      teams: item.teams ?? 1,
      headcount: item.headcount ?? 1,
      customerName: item.customerName,
      customerPhone: item.customerPhone ?? "",
      customerEmail: item.customerEmail ?? "",
      assignedTo: item.assignedTo ?? "",
      agentName: item.agentName ?? "",
      salePricePerPerson: item.salePricePerPerson ?? 0,
      salePriceTotal: item.salePriceTotal ?? 0,
      depositPrice: item.depositPrice ?? 0,
      extraFee: item.extraFee ?? 0,
      profit: item.profit ?? 0,
      status: (item.status as StatusType) ?? "pending",
      notes: item.notes ?? "",
      affiliateId: (item as any).affiliateId ?? undefined,
    });
    setEditId(item.id);
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.productName || !form.customerName || !form.departureDate) {
      toast.error("상품명, 고객명, 출발일은 필수입니다.");
      return;
    }
    const submitData = { ...form };
    if (editId) {
      updateMut.mutate({ id: editId, ...submitData });
    } else {
      createMut.mutate(submitData);
    }
  }

  const numField = (key: keyof typeof form) => ({
    value: form[key] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: Number(e.target.value) || 0 })),
  });

  return (
    <ERPLayout>
      <div className="p-6 space-y-6">
        {/* 요약 통계 */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-xs text-gray-500">전체 예약</p>
                    <p className="text-xl font-bold">{summary.totalReservations.toLocaleString()}건</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-xs text-gray-500">이번달 매출</p>
                    <p className="text-xl font-bold">{formatKRW(summary.monthSales)}원</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="text-xs text-gray-500">미수금</p>
                    <p className="text-xl font-bold text-orange-600">{formatKRW(summary.unpaidAmount)}원</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="text-xs text-gray-500">미매칭 입금</p>
                    <p className="text-xl font-bold text-red-600">{summary.unmatchedIncome}건</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 검색 및 필터 */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-2 flex-1 min-w-[200px]">
            <Input
              placeholder="예약번호, 고객명, 상품명 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
            />
            <Button variant="outline" onClick={() => { setSearch(searchInput); setPage(1); }}>
              <Search className="w-4 h-4" />
            </Button>
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1); }}>
            <SelectTrigger className="w-32">
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
            <SelectTrigger className="w-36">
              <SelectValue placeholder="입금상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 입금</SelectItem>
              <SelectItem value="unpaid">미입금</SelectItem>
              <SelectItem value="partial">부분입금</SelectItem>
              <SelectItem value="paid">완납</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate} className="bg-green-700 hover:bg-green-800 text-white">
            <Plus className="w-4 h-4 mr-1" /> 신규 예약
          </Button>
        </div>

        {/* 예약 목록 테이블 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">예약 목록 ({total.toLocaleString()}건)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["예약번호", "상품명", "출발일", "인원", "고객명", "연락처", "판매가", "입금가", "입금상태", "상태", "담당자", ""].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center py-12 text-gray-400">
                        예약 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 font-mono text-xs text-blue-600 whitespace-nowrap">{item.reservationNo}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate" title={item.productName}>{item.productName}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(item.departureDate)}</td>
                        <td className="px-3 py-2 text-center">{item.headcount}명</td>
                        <td className="px-3 py-2 whitespace-nowrap">{item.customerName}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">{item.customerPhone ?? "-"}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">{formatKRW(item.salePriceTotal)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">{formatKRW(item.paidAmount)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_COLORS[item.paymentStatus as PaymentStatusType]}`}>
                            {PAYMENT_LABELS[item.paymentStatus as PaymentStatusType]}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status as StatusType]}`}>
                            {STATUS_LABELS[item.status as StatusType]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">{item.assignedTo ?? "-"}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => setShowDetail(item.id)} className="p-1 hover:bg-blue-50 rounded text-blue-500" title="상세보기">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => openEdit(item)} className="p-1 hover:bg-yellow-50 rounded text-yellow-600" title="수정">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMut.mutate({ id: item.id }); }}
                              className="p-1 hover:bg-red-50 rounded text-red-500" title="삭제"
                            >
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

            {/* 페이지네이션 */}
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

      {/* 예약 등록/수정 모달 */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "예약 수정" : "신규 예약 등록"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>상품명 *</Label>
              <Input value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} placeholder="예: 태국 파타야 3박5일" />
            </div>
            {/* 골프장명 - 제휴사 검색 드롭다운 */}
            <div className="relative">
              <Label>골프장명 (제휴사 검색)</Label>
              <Input
                value={affiliateSearch}
                onChange={e => {
                  setAffiliateSearch(e.target.value);
                  setForm(f => ({ ...f, golfCourseName: e.target.value, affiliateId: undefined }));
                  setShowAffiliateDropdown(true);
                }}
                onFocus={() => { if (affiliateSearch.length >= 1) setShowAffiliateDropdown(true); }}
                onBlur={() => setTimeout(() => setShowAffiliateDropdown(false), 200)}
                placeholder="골프장명 검색 (1글자 이상)..."
              />
              {showAffiliateDropdown && affiliateData && affiliateData.items.length > 0 && (
                <div className="absolute z-50 w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {affiliateData.items.map(aff => (
                    <button
                      key={aff.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm border-b last:border-0"
                      onMouseDown={() => {
                        setAffiliateSearch(aff.name);
                        setForm(f => ({ ...f, golfCourseName: aff.name, affiliateId: aff.id }));
                        setShowAffiliateDropdown(false);
                      }}
                    >
                      <span className="font-medium">{aff.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{aff.country ?? ""} {aff.region ?? ""}</span>
                    </button>
                  ))}
                </div>
              )}
              {form.affiliateId && (
                <p className="text-xs text-green-600 mt-1">✓ 제휴사 연결됨 (ID: {form.affiliateId})</p>
              )}
            </div>
            <div>
              <Label>출발일 *</Label>
              <Input type="date" value={form.departureDate} onChange={e => setForm(f => ({ ...f, departureDate: e.target.value }))} />
            </div>
            <div>
              <Label>박수</Label>
              <Input type="number" min={0} {...numField("nights")} />
            </div>
            <div>
              <Label>팀수</Label>
              <Input type="number" min={1} {...numField("teams")} />
            </div>
            <div>
              <Label>인원</Label>
              <Input type="number" min={1} {...numField("headcount")} />
            </div>
            <div>
              <Label>고객명 *</Label>
              <Input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
            </div>
            <div>
              <Label>연락처</Label>
              <Input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} />
            </div>
            <div>
              <Label>이메일</Label>
              <Input value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} />
            </div>
            <div>
              <Label>담당자</Label>
              <Input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} />
            </div>
            <div>
              <Label>대리점명</Label>
              <Input value={form.agentName} onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))} />
            </div>
            <div>
              <Label>1인 판매가</Label>
              <Input type="number" min={0} {...numField("salePricePerPerson")} />
            </div>
            <div>
              <Label>판매 합계</Label>
              <Input type="number" min={0} {...numField("salePriceTotal")} />
            </div>
            <div>
              <Label>입금가 (공급가)</Label>
              <Input type="number" min={0} {...numField("depositPrice")} />
            </div>
            <div>
              <Label>추가요금</Label>
              <Input type="number" min={0} {...numField("extraFee")} />
            </div>
            <div>
              <Label>수익</Label>
              <Input type="number" min={0} {...numField("profit")} />
            </div>
            <div>
              <Label>상태</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as StatusType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">대기</SelectItem>
                  <SelectItem value="confirmed">확정</SelectItem>
                  <SelectItem value="cancelled">취소</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>메모</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>취소</Button>
            <Button onClick={handleSubmit} className="bg-green-700 hover:bg-green-800 text-white">
              {editId ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 예약 상세 모달 */}
      <Dialog open={showDetail !== null} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>예약 상세 정보</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">예약번호:</span> <span className="font-mono font-bold text-blue-600">{detail.reservation.reservationNo}</span></div>
                <div><span className="text-gray-500">상태:</span> <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[detail.reservation.status as StatusType]}`}>{STATUS_LABELS[detail.reservation.status as StatusType]}</span></div>
                <div className="col-span-2"><span className="text-gray-500">상품명:</span> <span className="font-semibold">{detail.reservation.productName}</span></div>
                <div><span className="text-gray-500">출발일:</span> {formatDate(detail.reservation.departureDate)}</div>
                <div><span className="text-gray-500">인원:</span> {detail.reservation.headcount}명 / {detail.reservation.teams}팀</div>
                <div><span className="text-gray-500">고객명:</span> {detail.reservation.customerName}</div>
                <div><span className="text-gray-500">연락처:</span> {detail.reservation.customerPhone ?? "-"}</div>
                <div><span className="text-gray-500">판매가:</span> {formatKRW(detail.reservation.salePriceTotal)}원</div>
                <div><span className="text-gray-500">입금액:</span> <span className="font-bold text-green-600">{formatKRW(detail.reservation.paidAmount)}원</span></div>
                <div><span className="text-gray-500">송금액:</span> {formatKRW(detail.reservation.remittedAmount)}원</div>
                <div><span className="text-gray-500">입금상태:</span> <span className={`px-2 py-0.5 rounded-full text-xs ${PAYMENT_COLORS[detail.reservation.paymentStatus as PaymentStatusType]}`}>{PAYMENT_LABELS[detail.reservation.paymentStatus as PaymentStatusType]}</span></div>
              </div>

              {detail.incomes.length > 0 && (
                <div>
                  <p className="font-semibold text-sm mb-2">입금 내역 ({detail.incomes.length}건)</p>
                  <div className="space-y-1">
                    {detail.incomes.map(inc => (
                      <div key={inc.id} className="flex justify-between text-xs bg-green-50 rounded px-3 py-1.5">
                        <span>{formatDate(inc.transactionDate)} {inc.depositorName}</span>
                        <span className="font-bold text-green-700">{formatKRW(inc.amount)}원</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.remittances.length > 0 && (
                <div>
                  <p className="font-semibold text-sm mb-2">송금 내역 ({detail.remittances.length}건)</p>
                  <div className="space-y-1">
                    {detail.remittances.map(rem => (
                      <div key={rem.id} className="flex justify-between text-xs bg-blue-50 rounded px-3 py-1.5">
                        <span>{formatDate(rem.transactionDate)} {rem.recipientName}</span>
                        <span className="font-bold text-blue-700">{formatKRW(rem.amount)}원</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.reservation.notes && (
                <div>
                  <p className="font-semibold text-sm mb-1">메모</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded p-3">{detail.reservation.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(null)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ERPLayout>
  );
}
