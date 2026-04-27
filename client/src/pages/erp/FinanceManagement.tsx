import { useState } from "react";
import ERPLayout from "@/components/ERPLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ArrowDownCircle, ArrowUpCircle, CreditCard, Wallet } from "lucide-react";
import { toast } from "sonner";

type TabType = "income" | "remittance" | "deposit" | "charge" | "prepaid";

function formatKRW(n: number | null | undefined) {
  if (!n) return "0";
  return n.toLocaleString("ko-KR");
}
function formatDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("ko-KR");
}

const MATCH_LABELS: Record<string, string> = { unmatched: "미매칭", matched: "매칭완료", partial: "부분매칭" };
const MATCH_COLORS: Record<string, string> = {
  unmatched: "bg-red-100 text-red-700",
  matched: "bg-green-100 text-green-700",
  partial: "bg-orange-100 text-orange-700",
};

export default function FinanceManagement() {
  const [activeTab, setActiveTab] = useState<TabType>("income");

  // 입금 상태
  const [incomeForm, setIncomeForm] = useState({
    transactionDate: "", bankName: "", amount: 0, depositorName: "", detail: "",
    reservationNo: "", notes: "",
  });
  const [showIncomeForm, setShowIncomeForm] = useState(false);

  // 송금 상태
  const [remitForm, setRemitForm] = useState({
    transactionDate: "", bankName: "", amount: 0, recipientName: "", detail: "",
    reservationNo: "", notes: "",
  });
  const [showRemitForm, setShowRemitForm] = useState(false);

  // 예치금 상태
  const [depositForm, setDepositForm] = useState({
    reservationNo: "", type: "unpaid" as "unpaid" | "expected" | "deduct_other" | "deduct_shinhan",
    amount: 0, memo: "",
  });
  const [showDepositForm, setShowDepositForm] = useState(false);

  // 충전 상태
  const [chargeForm, setChargeForm] = useState({
    cardCompany: "", golfCourseName: "", amount: 0, transactionDate: "",
    reservationNo: "", rawText: "", notes: "",
  });
  const [showChargeForm, setShowChargeForm] = useState(false);

  // 데파짓 상태
  const [prepaidForm, setPrepaidForm] = useState({
    golfCourseName: "", prepaidAmount: 0, usedAmount: 0, notes: "",
  });
  const [showPrepaidForm, setShowPrepaidForm] = useState(false);

  // 데이터 조회
  const { data: incomes, refetch: refetchIncome } = trpc.reservations.listIncome.useQuery({ page: 1, pageSize: 50 });
  const { data: remittances, refetch: refetchRemit } = trpc.reservations.listRemittance.useQuery({ page: 1, pageSize: 50 });
  const { data: deposits, refetch: refetchDeposit } = trpc.reservations.listDeposit.useQuery({ type: "all" });
  const { data: charges, refetch: refetchCharge } = trpc.reservations.listCharge.useQuery({ page: 1, pageSize: 50 });
  const { data: prepaids, refetch: refetchPrepaid } = trpc.reservations.listPrepaid.useQuery();

  const addIncomeMut = trpc.reservations.addIncome.useMutation({
    onSuccess: () => { toast.success("입금 내역이 등록되었습니다."); setShowIncomeForm(false); refetchIncome(); },
    onError: (e) => toast.error(e.message),
  });
  const addRemitMut = trpc.reservations.addRemittance.useMutation({
    onSuccess: () => { toast.success("송금 내역이 등록되었습니다."); setShowRemitForm(false); refetchRemit(); },
    onError: (e) => toast.error(e.message),
  });
  const addDepositMut = trpc.reservations.addDeposit.useMutation({
    onSuccess: () => { toast.success("예치금이 등록되었습니다."); setShowDepositForm(false); refetchDeposit(); },
    onError: (e) => toast.error(e.message),
  });
  const addChargeMut = trpc.reservations.addCharge.useMutation({
    onSuccess: () => { toast.success("충전 내역이 등록되었습니다."); setShowChargeForm(false); refetchCharge(); },
    onError: (e) => toast.error(e.message),
  });
  const addPrepaidMut = trpc.reservations.addPrepaid.useMutation({
    onSuccess: () => { toast.success("데파짓이 등록되었습니다."); setShowPrepaidForm(false); refetchPrepaid(); },
    onError: (e) => toast.error(e.message),
  });

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "income", label: "입금 내역", icon: <ArrowDownCircle className="w-4 h-4 text-green-500" />, count: incomes?.length },
    { id: "remittance", label: "송금 내역", icon: <ArrowUpCircle className="w-4 h-4 text-blue-500" />, count: remittances?.length },
    { id: "deposit", label: "예치금", icon: <Wallet className="w-4 h-4 text-orange-500" />, count: deposits?.length },
    { id: "charge", label: "충전-사용", icon: <CreditCard className="w-4 h-4 text-purple-500" />, count: charges?.length },
    { id: "prepaid", label: "데파짓", icon: <Wallet className="w-4 h-4 text-teal-500" />, count: prepaids?.length },
  ];

  return (
    <ERPLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">자금 관리</h1>
          <Button
            onClick={() => {
              if (activeTab === "income") setShowIncomeForm(true);
              else if (activeTab === "remittance") setShowRemitForm(true);
              else if (activeTab === "deposit") setShowDepositForm(true);
              else if (activeTab === "charge") setShowChargeForm(true);
              else if (activeTab === "prepaid") setShowPrepaidForm(true);
            }}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            <Plus className="w-4 h-4 mr-1" /> 등록
          </Button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-green-600 text-green-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* 입금 내역 탭 */}
        {activeTab === "income" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">
                총 입금: <span className="text-green-700 font-bold text-base">
                  {formatKRW(incomes?.reduce((s, r) => s + r.amount, 0))}원
                </span>
                <span className="ml-4 text-red-500">
                  미매칭: {incomes?.filter(r => r.matchStatus === "unmatched").length ?? 0}건
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["입금일", "은행", "금액", "입금자", "예약번호", "상세내역", "매칭상태"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(incomes ?? []).map(row => (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.transactionDate)}</td>
                      <td className="px-3 py-2">{row.bankName ?? "-"}</td>
                      <td className="px-3 py-2 text-right font-bold text-green-700">{formatKRW(row.amount)}원</td>
                      <td className="px-3 py-2">{row.depositorName ?? "-"}</td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{row.reservationNo ?? "-"}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-[200px] truncate">{row.detail ?? "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${MATCH_COLORS[row.matchStatus]}`}>
                          {MATCH_LABELS[row.matchStatus]}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!incomes?.length && (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">입금 내역이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* 송금 내역 탭 */}
        {activeTab === "remittance" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">
                총 송금: <span className="text-blue-700 font-bold text-base">
                  {formatKRW(remittances?.reduce((s, r) => s + r.amount, 0))}원
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["송금일", "은행", "금액", "수취인", "예약번호", "상세내역", "매칭상태"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(remittances ?? []).map(row => (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.transactionDate)}</td>
                      <td className="px-3 py-2">{row.bankName ?? "-"}</td>
                      <td className="px-3 py-2 text-right font-bold text-blue-700">{formatKRW(row.amount)}원</td>
                      <td className="px-3 py-2">{row.recipientName ?? "-"}</td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{row.reservationNo ?? "-"}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-[200px] truncate">{row.detail ?? "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${MATCH_COLORS[row.matchStatus]}`}>
                          {MATCH_LABELS[row.matchStatus]}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!remittances?.length && (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">송금 내역이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* 예치금 탭 */}
        {activeTab === "deposit" && (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["유형", "예약번호", "금액", "메모", "등록일"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(deposits ?? []).map(row => (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">
                          {{ unpaid: "미입금", expected: "입금예정", deduct_other: "타건차감", deduct_shinhan: "신한충전차감" }[row.type]}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{row.reservationNo ?? "-"}</td>
                      <td className="px-3 py-2 text-right font-bold">{formatKRW(row.amount)}원</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{row.memo ?? "-"}</td>
                      <td className="px-3 py-2 text-xs">{formatDate(row.createdAt)}</td>
                    </tr>
                  ))}
                  {!deposits?.length && (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">예치금 내역이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* 충전-사용 탭 */}
        {activeTab === "charge" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">
                총 충전: <span className="text-purple-700 font-bold text-base">
                  {formatKRW(charges?.reduce((s, r) => s + r.amount, 0))}원
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["결제일", "카드사", "골프장명", "금액", "예약번호", "매칭상태"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(charges ?? []).map(row => (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.transactionDate)}</td>
                      <td className="px-3 py-2">{row.cardCompany ?? "-"}</td>
                      <td className="px-3 py-2">{row.golfCourseName ?? "-"}</td>
                      <td className="px-3 py-2 text-right font-bold text-purple-700">{formatKRW(row.amount)}원</td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{row.reservationNo ?? "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${MATCH_COLORS[row.matchStatus]}`}>
                          {MATCH_LABELS[row.matchStatus]}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!charges?.length && (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">충전 내역이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* 데파짓 탭 */}
        {activeTab === "prepaid" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">
                총 잔액: <span className="text-teal-700 font-bold text-base">
                  {formatKRW(prepaids?.reduce((s, r) => s + (r.remainingAmount ?? 0), 0))}원
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["골프장명", "선입금", "사용금액", "잔액", "메모"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(prepaids ?? []).map(row => (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold">{row.golfCourseName}</td>
                      <td className="px-3 py-2 text-right">{formatKRW(row.prepaidAmount)}원</td>
                      <td className="px-3 py-2 text-right text-red-600">{formatKRW(row.usedAmount)}원</td>
                      <td className="px-3 py-2 text-right font-bold text-teal-700">{formatKRW(row.remainingAmount)}원</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{row.notes ?? "-"}</td>
                    </tr>
                  ))}
                  {!prepaids?.length && (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">데파짓 내역이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 입금 등록 모달 */}
      <Dialog open={showIncomeForm} onOpenChange={setShowIncomeForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>입금 내역 등록</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>입금일시 *</Label><Input type="datetime-local" value={incomeForm.transactionDate} onChange={e => setIncomeForm(f => ({ ...f, transactionDate: e.target.value }))} /></div>
            <div><Label>은행명</Label><Input value={incomeForm.bankName} onChange={e => setIncomeForm(f => ({ ...f, bankName: e.target.value }))} placeholder="신한, 국민 등" /></div>
            <div><Label>금액 *</Label><Input type="number" value={incomeForm.amount} onChange={e => setIncomeForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
            <div><Label>입금자명</Label><Input value={incomeForm.depositorName} onChange={e => setIncomeForm(f => ({ ...f, depositorName: e.target.value }))} /></div>
            <div><Label>예약번호</Label><Input value={incomeForm.reservationNo} onChange={e => setIncomeForm(f => ({ ...f, reservationNo: e.target.value }))} placeholder="OY-202504-XXXX" /></div>
            <div><Label>상세내역 (은행 문자 그대로 붙여넣기)</Label><Textarea value={incomeForm.detail} onChange={e => setIncomeForm(f => ({ ...f, detail: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIncomeForm(false)}>취소</Button>
            <Button onClick={() => {
              if (!incomeForm.transactionDate || !incomeForm.amount) { toast.error("입금일시와 금액은 필수입니다."); return; }
              addIncomeMut.mutate({ ...incomeForm, amount: Number(incomeForm.amount) });
            }} className="bg-green-700 hover:bg-green-800 text-white">등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 송금 등록 모달 */}
      <Dialog open={showRemitForm} onOpenChange={setShowRemitForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>송금 내역 등록</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>송금일시 *</Label><Input type="datetime-local" value={remitForm.transactionDate} onChange={e => setRemitForm(f => ({ ...f, transactionDate: e.target.value }))} /></div>
            <div><Label>은행명</Label><Input value={remitForm.bankName} onChange={e => setRemitForm(f => ({ ...f, bankName: e.target.value }))} /></div>
            <div><Label>금액 *</Label><Input type="number" value={remitForm.amount} onChange={e => setRemitForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
            <div><Label>수취인명</Label><Input value={remitForm.recipientName} onChange={e => setRemitForm(f => ({ ...f, recipientName: e.target.value }))} /></div>
            <div><Label>예약번호</Label><Input value={remitForm.reservationNo} onChange={e => setRemitForm(f => ({ ...f, reservationNo: e.target.value }))} /></div>
            <div><Label>상세내역</Label><Textarea value={remitForm.detail} onChange={e => setRemitForm(f => ({ ...f, detail: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemitForm(false)}>취소</Button>
            <Button onClick={() => {
              if (!remitForm.transactionDate || !remitForm.amount) { toast.error("송금일시와 금액은 필수입니다."); return; }
              addRemitMut.mutate({ ...remitForm, amount: Number(remitForm.amount) });
            }} className="bg-blue-700 hover:bg-blue-800 text-white">등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 예치금 등록 모달 */}
      <Dialog open={showDepositForm} onOpenChange={setShowDepositForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>예치금 등록</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>유형 *</Label>
              <Select value={depositForm.type} onValueChange={v => setDepositForm(f => ({ ...f, type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">미입금</SelectItem>
                  <SelectItem value="expected">입금예정</SelectItem>
                  <SelectItem value="deduct_other">송금타건차감</SelectItem>
                  <SelectItem value="deduct_shinhan">신한충전차감</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>예약번호</Label><Input value={depositForm.reservationNo} onChange={e => setDepositForm(f => ({ ...f, reservationNo: e.target.value }))} /></div>
            <div><Label>금액 *</Label><Input type="number" value={depositForm.amount} onChange={e => setDepositForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
            <div><Label>메모</Label><Textarea value={depositForm.memo} onChange={e => setDepositForm(f => ({ ...f, memo: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepositForm(false)}>취소</Button>
            <Button onClick={() => {
              if (!depositForm.amount) { toast.error("금액은 필수입니다."); return; }
              addDepositMut.mutate({ ...depositForm, amount: Number(depositForm.amount) });
            }} className="bg-orange-600 hover:bg-orange-700 text-white">등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 충전 등록 모달 */}
      <Dialog open={showChargeForm} onOpenChange={setShowChargeForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>충전 내역 등록</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>결제일 *</Label><Input type="datetime-local" value={chargeForm.transactionDate} onChange={e => setChargeForm(f => ({ ...f, transactionDate: e.target.value }))} /></div>
            <div><Label>카드사</Label><Input value={chargeForm.cardCompany} onChange={e => setChargeForm(f => ({ ...f, cardCompany: e.target.value }))} placeholder="신한, 현대 등" /></div>
            <div><Label>골프장명 (추측)</Label><Input value={chargeForm.golfCourseName} onChange={e => setChargeForm(f => ({ ...f, golfCourseName: e.target.value }))} /></div>
            <div><Label>금액 *</Label><Input type="number" value={chargeForm.amount} onChange={e => setChargeForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
            <div><Label>예약번호</Label><Input value={chargeForm.reservationNo} onChange={e => setChargeForm(f => ({ ...f, reservationNo: e.target.value }))} /></div>
            <div><Label>원본 카드 내역 (붙여넣기)</Label><Textarea value={chargeForm.rawText} onChange={e => setChargeForm(f => ({ ...f, rawText: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChargeForm(false)}>취소</Button>
            <Button onClick={() => {
              if (!chargeForm.transactionDate || !chargeForm.amount) { toast.error("결제일과 금액은 필수입니다."); return; }
              addChargeMut.mutate({ ...chargeForm, amount: Number(chargeForm.amount) });
            }} className="bg-purple-700 hover:bg-purple-800 text-white">등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 데파짓 등록 모달 */}
      <Dialog open={showPrepaidForm} onOpenChange={setShowPrepaidForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>데파짓 등록</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>골프장명 *</Label><Input value={prepaidForm.golfCourseName} onChange={e => setPrepaidForm(f => ({ ...f, golfCourseName: e.target.value }))} /></div>
            <div><Label>선입금 총액 *</Label><Input type="number" value={prepaidForm.prepaidAmount} onChange={e => setPrepaidForm(f => ({ ...f, prepaidAmount: Number(e.target.value) }))} /></div>
            <div><Label>사용 금액</Label><Input type="number" value={prepaidForm.usedAmount} onChange={e => setPrepaidForm(f => ({ ...f, usedAmount: Number(e.target.value) }))} /></div>
            <div><Label>메모</Label><Textarea value={prepaidForm.notes} onChange={e => setPrepaidForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPrepaidForm(false)}>취소</Button>
            <Button onClick={() => {
              if (!prepaidForm.golfCourseName || !prepaidForm.prepaidAmount) { toast.error("골프장명과 선입금 총액은 필수입니다."); return; }
              addPrepaidMut.mutate(prepaidForm);
            }} className="bg-teal-700 hover:bg-teal-800 text-white">등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ERPLayout>
  );
}
