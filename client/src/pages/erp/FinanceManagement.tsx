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
import { Plus, ArrowDownCircle, ArrowUpCircle, CreditCard, Wallet, Clipboard, CheckCircle, Trash2, Edit2, Link2, AlertCircle, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

/**
 * 은행 문자 자동 파싱 함수
 * 지원 형식:
 * - "[신한은행] 01/15 14:32 홍길동 1,234,567원 입금"
 * - "국민은행 입금 2024-01-15 홍길동 1234567"
 * - "OY-202504-XXXX 홍길동 1,234,567"
 */
function parseBankMessage(text: string): {
  bankName?: string;
  amount?: number;
  depositorName?: string;
  transactionDate?: string;
  reservationNo?: string;
} {
  const result: ReturnType<typeof parseBankMessage> = {};

  // 은행명 추출
  const bankMatch = text.match(/\[([\w가-힣]+은행|[\w가-힣]+뱅크)\]|^([\w가-힣]+은행|[\w가-힣]+뱅크)/m);
  if (bankMatch) result.bankName = bankMatch[1] || bankMatch[2];

  // 금액 추출 (숫자+원 패턴, 쉼표 포함)
  const amountMatch = text.match(/([0-9,]+)원/) || text.match(/([0-9,]+)\s*원/) || text.match(/\b([0-9]{4,})\b/);
  if (amountMatch) {
    const amountStr = amountMatch[1].replace(/,/g, "");
    const amount = parseInt(amountStr, 10);
    if (!isNaN(amount) && amount > 0) result.amount = amount;
  }

  // 날짜 추출
  const dateMatch = text.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/)
    || text.match(/(\d{2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (dateMatch) {
    if (dateMatch[0].includes("/") && dateMatch[1].length === 2) {
      // MM/DD HH:mm 형식 → 현재 연도 사용
      const year = new Date().getFullYear();
      const month = dateMatch[1].padStart(2, "0");
      const day = dateMatch[2].padStart(2, "0");
      const hour = dateMatch[3] ? dateMatch[3].padStart(2, "0") : "00";
      const min = dateMatch[4] ? dateMatch[4].padStart(2, "0") : "00";
      result.transactionDate = `${year}-${month}-${day}T${hour}:${min}`;
    } else {
      const year = dateMatch[1];
      const month = dateMatch[2].padStart(2, "0");
      const day = dateMatch[3].padStart(2, "0");
      result.transactionDate = `${year}-${month}-${day}T00:00`;
    }
  }

  // 예약번호 추출 (OY-YYYYMM-XXXX 패턴)
  const resNoMatch = text.match(/OY-\d{6}-[A-Z0-9]{4}/i);
  if (resNoMatch) result.reservationNo = resNoMatch[0].toUpperCase();

  // 입금자명 추출 (한글 2~5글자)
  const nameMatch = text.match(/([가-힣]{2,5})\s*\d+원/) || text.match(/입금\s+([가-힣]{2,5})/) || text.match(/([가-힣]{2,5})\s+[0-9,]+원/);
  if (nameMatch) result.depositorName = nameMatch[1];

  return result;
}

export default function FinanceManagement() {
  const [activeTab, setActiveTab] = useState<TabType>("income");

  // 입금 상태
  const [incomeForm, setIncomeForm] = useState({
    transactionDate: "", bankName: "", amount: 0, depositorName: "", detail: "",
    reservationNo: "", notes: "",
  });
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [incomeParseText, setIncomeParseText] = useState("");
  const [showIncomeParse, setShowIncomeParse] = useState(false);

  // 송금 상태
  const [remitForm, setRemitForm] = useState({
    transactionDate: "", bankName: "", amount: 0, recipientName: "", detail: "",
    reservationNo: "", notes: "",
  });
  const [showRemitForm, setShowRemitForm] = useState(false);
  const [remitParseText, setRemitParseText] = useState("");
  const [showRemitParse, setShowRemitParse] = useState(false);

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

  // 데파짃 상태
  const [prepaidForm, setPrepaidForm] = useState({
    golfCourseName: "", prepaidAmount: 0, usedAmount: 0, notes: "",
  });
  const [showPrepaidForm, setShowPrepaidForm] = useState(false);
  const [editPrepaid, setEditPrepaid] = useState<{ id: number; usedAmount: number; prepaidAmount: number; notes?: string } | null>(null);

  // 필터 상태
  const [depositTypeFilter, setDepositTypeFilter] = useState<"all" | "unpaid" | "expected" | "deduct_other" | "deduct_shinhan">("all");
  const [chargeMatchFilter, setChargeMatchFilter] = useState<"all" | "unmatched" | "matched">("all");
  const [matchChargeId, setMatchChargeId] = useState<number | null>(null);
  const [matchReservationNo, setMatchReservationNo] = useState("");

  // 데이터 조회
  const { data: incomes, refetch: refetchIncome } = trpc.reservations.listIncome.useQuery({ page: 1, pageSize: 50 });
  const { data: remittances, refetch: refetchRemit } = trpc.reservations.listRemittance.useQuery({ page: 1, pageSize: 50 });
  const { data: deposits, refetch: refetchDeposit } = trpc.reservations.listDeposit.useQuery({ type: "all" });
  const { data: charges, refetch: refetchCharge } = trpc.reservations.listCharge.useQuery({ page: 1, pageSize: 50 });
  const { data: prepaids, refetch: refetchPrepaid } = trpc.reservations.listPrepaid.useQuery();

  const addIncomeMut = trpc.reservations.addIncome.useMutation({
    onSuccess: () => { toast.success("입금 내역이 등록되었습니다."); setShowIncomeForm(false); setShowIncomeParse(false); refetchIncome(); },
    onError: (e) => toast.error(e.message),
  });
  const addRemitMut = trpc.reservations.addRemittance.useMutation({
    onSuccess: () => { toast.success("송금 내역이 등록되었습니다."); setShowRemitForm(false); setShowRemitParse(false); refetchRemit(); },
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
    onSuccess: () => { toast.success("데파짃이 등록되었습니다."); setShowPrepaidForm(false); refetchPrepaid(); },
    onError: (e) => toast.error(e.message),
  });
  const updatePrepaidMut = trpc.reservations.updatePrepaid.useMutation({
    onSuccess: () => { toast.success("업데이트되었습니다."); setEditPrepaid(null); refetchPrepaid(); },
    onError: (e) => toast.error(e.message),
  });
  const deletePrepaidMut = trpc.reservations.deletePrepaid.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다."); refetchPrepaid(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteDepositMut = trpc.reservations.deleteDeposit.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다."); refetchDeposit(); },
    onError: (e) => toast.error(e.message),
  });
  const matchChargeMut = trpc.reservations.matchCharge.useMutation({
    onSuccess: () => { toast.success("매칭되었습니다."); setMatchChargeId(null); setMatchReservationNo(""); refetchCharge(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteChargeMut = trpc.reservations.deleteCharge.useMutation({
    onSuccess: () => { toast.success("삭제되었습니다."); refetchCharge(); },
    onError: (e) => toast.error(e.message),
  });

  // 집계 계산
  const totalIncome = (incomes ?? []).reduce((s, r) => s + r.amount, 0);
  const totalRemit = (remittances ?? []).reduce((s, r) => s + r.amount, 0);
  const unmatchedIncome = (incomes ?? []).filter(r => r.matchStatus === "unmatched").length;
  const unmatchedRemit = (remittances ?? []).filter(r => r.matchStatus === "unmatched").length;
  const totalDepositUnpaid = (deposits ?? []).filter(r => r.type === "unpaid").reduce((s, r) => s + r.amount, 0);
  const totalDepositExpected = (deposits ?? []).filter(r => r.type === "expected").reduce((s, r) => s + r.amount, 0);
  const totalChargeAmount = (charges ?? []).reduce((s, r) => s + r.amount, 0);
  const unmatchedCharge = (charges ?? []).filter(r => r.matchStatus === "unmatched").length;
  const totalPrepaidBalance = (prepaids ?? []).reduce((s, r) => s + (r.remainingAmount ?? 0), 0);

  const filteredDeposits = depositTypeFilter === "all" ? (deposits ?? []) : (deposits ?? []).filter(r => r.type === depositTypeFilter);
  const filteredCharges = chargeMatchFilter === "all" ? (charges ?? []) : (charges ?? []).filter(r => r.matchStatus === chargeMatchFilter);

  const DEPOSIT_TYPE_LABELS: Record<string, string> = { unpaid: "미입금", expected: "입금예정", deduct_other: "타건차감", deduct_shinhan: "신한충전차감" };
  const DEPOSIT_TYPE_COLORS: Record<string, string> = { unpaid: "bg-red-100 text-red-700", expected: "bg-blue-100 text-blue-700", deduct_other: "bg-orange-100 text-orange-700", deduct_shinhan: "bg-purple-100 text-purple-700" };

  // 은행 문자 파싱 → 입금 폼 자동 채우기
  function handleIncomeParse() {
    if (!incomeParseText.trim()) { toast.error("파싱할 문자를 입력해주세요."); return; }
    const parsed = parseBankMessage(incomeParseText);
    setIncomeForm(f => ({
      ...f,
      bankName: parsed.bankName ?? f.bankName,
      amount: parsed.amount ?? f.amount,
      depositorName: parsed.depositorName ?? f.depositorName,
      transactionDate: parsed.transactionDate ?? f.transactionDate,
      reservationNo: parsed.reservationNo ?? f.reservationNo,
      detail: incomeParseText,
    }));
    setShowIncomeParse(false);
    setShowIncomeForm(true);
    toast.success("문자 파싱 완료! 내용을 확인 후 등록하세요.");
  }

  // 은행 문자 파싱 → 송금 폼 자동 채우기
  function handleRemitParse() {
    if (!remitParseText.trim()) { toast.error("파싱할 문자를 입력해주세요."); return; }
    const parsed = parseBankMessage(remitParseText);
    setRemitForm(f => ({
      ...f,
      bankName: parsed.bankName ?? f.bankName,
      amount: parsed.amount ?? f.amount,
      recipientName: parsed.depositorName ?? f.recipientName,
      transactionDate: parsed.transactionDate ?? f.transactionDate,
      reservationNo: parsed.reservationNo ?? f.reservationNo,
      detail: remitParseText,
    }));
    setShowRemitParse(false);
    setShowRemitForm(true);
    toast.success("문자 파싱 완료! 내용을 확인 후 등록하세요.");
  }

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
          <div className="flex gap-2">
            {/* 문자 파싱 버튼 (입금/송금 탭에서만 표시) */}
            {(activeTab === "income" || activeTab === "remittance") && (
              <Button
                variant="outline"
                onClick={() => {
                  if (activeTab === "income") { setIncomeParseText(""); setShowIncomeParse(true); }
                  else { setRemitParseText(""); setShowRemitParse(true); }
                }}
                className="border-green-600 text-green-700 hover:bg-green-50"
              >
                <Clipboard className="w-4 h-4 mr-1" /> 문자 붙여넣기
              </Button>
            )}
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
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-green-600" />
                <span className="text-xs text-green-700 font-medium">총 입금</span>
                {unmatchedIncome > 0 && <Badge variant="destructive" className="text-xs px-1 py-0 h-4">{unmatchedIncome}미매칭</Badge>}
              </div>
              <div className="text-base font-bold text-green-700">{totalIncome.toLocaleString()}원</div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown size={14} className="text-red-600" />
                <span className="text-xs text-red-700 font-medium">총 송금</span>
                {unmatchedRemit > 0 && <Badge variant="destructive" className="text-xs px-1 py-0 h-4">{unmatchedRemit}미매칭</Badge>}
              </div>
              <div className="text-base font-bold text-red-700">{totalRemit.toLocaleString()}원</div>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={14} className="text-orange-600" />
                <span className="text-xs text-orange-700 font-medium">미입금</span>
              </div>
              <div className="text-base font-bold text-orange-700">{totalDepositUnpaid.toLocaleString()}원</div>
              <div className="text-xs text-orange-400">예정: {totalDepositExpected.toLocaleString()}원</div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard size={14} className="text-purple-600" />
                <span className="text-xs text-purple-700 font-medium">충전카드</span>
                {unmatchedCharge > 0 && <Badge variant="destructive" className="text-xs px-1 py-0 h-4">{unmatchedCharge}미매칭</Badge>}
              </div>
              <div className="text-base font-bold text-purple-700">{totalChargeAmount.toLocaleString()}원</div>
            </CardContent>
          </Card>
          <Card className="border-teal-200 bg-teal-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <PiggyBank size={14} className="text-teal-600" />
                <span className="text-xs text-teal-700 font-medium">데파짓 잔액</span>
              </div>
              <div className="text-base font-bold text-teal-700">{totalPrepaidBalance.toLocaleString()}원</div>
            </CardContent>
          </Card>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 border-b overflow-x-auto">
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
          <div className="space-y-3">
            {/* 유형별 필터 */}
            <div className="flex flex-wrap gap-2">
              {(["all", "unpaid", "expected", "deduct_other", "deduct_shinhan"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setDepositTypeFilter(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    depositTypeFilter === t
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-orange-400"
                  }`}
                >
                  {t === "all" ? `전체 (${deposits?.length ?? 0})` :
                   t === "unpaid" ? `미입금 (${deposits?.filter(r => r.type === "unpaid").length ?? 0})` :
                   t === "expected" ? `입금예정 (${deposits?.filter(r => r.type === "expected").length ?? 0})` :
                   t === "deduct_other" ? `타건차감 (${deposits?.filter(r => r.type === "deduct_other").length ?? 0})` :
                   `신한충전차감 (${deposits?.filter(r => r.type === "deduct_shinhan").length ?? 0})`}
                </button>
              ))}
            </div>
            {/* 유형별 합계 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[{t:"unpaid",label:"미입금",color:"text-red-700"},{t:"expected",label:"입금예정",color:"text-blue-700"},{t:"deduct_other",label:"타건차감",color:"text-orange-700"},{t:"deduct_shinhan",label:"신한충전차감",color:"text-purple-700"}].map(({t,label,color}) => (
                <div key={t} className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className={`text-sm font-bold ${color}`}>{(deposits ?? []).filter(r => r.type === t).reduce((s,r) => s + r.amount, 0).toLocaleString()}원</div>
                </div>
              ))}
            </div>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["유형", "예약번호", "금액", "메모", "등록일", "삭제"].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeposits.map(row => (
                      <tr key={row.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${DEPOSIT_TYPE_COLORS[row.type] ?? "bg-gray-100 text-gray-700"}`}>
                            {DEPOSIT_TYPE_LABELS[row.type] ?? row.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-blue-600">{row.reservationNo ?? "-"}</td>
                        <td className="px-3 py-2 text-right font-bold">{formatKRW(row.amount)}원</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{row.memo ?? "-"}</td>
                        <td className="px-3 py-2 text-xs">{formatDate(row.createdAt)}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => { if (confirm("삭제하시겠습니까?")) deleteDepositMut.mutate({ id: row.id }); }} className="text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!filteredDeposits.length && (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400">예치금 내역이 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 충전-사용 탭 */}
        {activeTab === "charge" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(["all", "unmatched", "matched"] as const).map(f => (
                <button key={f} onClick={() => setChargeMatchFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    chargeMatchFilter === f ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-300 hover:border-purple-400"
                  }`}>
                  {f === "all" ? `전체 (${charges?.length ?? 0})` : f === "unmatched" ? `미매칭 (${charges?.filter(r => r.matchStatus === "unmatched").length ?? 0})` : `매칭완료 (${charges?.filter(r => r.matchStatus === "matched").length ?? 0})`}
                </button>
              ))}
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">
                  총 충전: <span className="text-purple-700 font-bold text-base">{formatKRW(totalChargeAmount)}원</span>
                  <span className="ml-4 text-red-500">미매칭: {unmatchedCharge}건</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["결제일", "카드사", "골프장명", "금액", "예약번호", "매칭상태", "관리"].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCharges.map(row => (
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
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            {row.matchStatus !== "matched" && (
                              <button onClick={() => { setMatchChargeId(row.id); setMatchReservationNo(row.reservationNo ?? ""); }}
                                className="text-blue-400 hover:text-blue-600" title="예약번호 매칭">
                                <Link2 size={14} />
                              </button>
                            )}
                            <button onClick={() => { if (confirm("삭제하시겠습니까?")) deleteChargeMut.mutate({ id: row.id }); }}
                              className="text-red-400 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredCharges.length && (
                      <tr><td colSpan={7} className="text-center py-8 text-gray-400">충전 내역이 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 데파짃 탭 */}
        {activeTab === "prepaid" && (
          <div className="space-y-3">
            {/* 골프장별 잔액 요약 카드 */}
            {(prepaids ?? []).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(prepaids ?? []).map(row => (
                  <div key={row.id} className={`rounded p-2 text-center border ${
                    (row.remainingAmount ?? 0) <= 0 ? "bg-red-50 border-red-200" :
                    (row.remainingAmount ?? 0) < (row.prepaidAmount ?? 0) * 0.2 ? "bg-orange-50 border-orange-200" :
                    "bg-teal-50 border-teal-200"
                  }`}>
                    <div className="text-xs text-gray-600 font-medium truncate">{row.golfCourseName}</div>
                    <div className={`text-sm font-bold ${
                      (row.remainingAmount ?? 0) <= 0 ? "text-red-700" :
                      (row.remainingAmount ?? 0) < (row.prepaidAmount ?? 0) * 0.2 ? "text-orange-700" :
                      "text-teal-700"
                    }`}>{formatKRW(row.remainingAmount)}원</div>
                    <div className="text-xs text-gray-400">선입금 {formatKRW(row.prepaidAmount)}원</div>
                  </div>
                ))}
              </div>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">
                  총 잔액: <span className="text-teal-700 font-bold text-base">{formatKRW(totalPrepaidBalance)}원</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["골프장명", "선입금", "사용금액", "잔액", "메모", "관리"].map(h => (
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
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => setEditPrepaid({ id: row.id, usedAmount: row.usedAmount ?? 0, prepaidAmount: row.prepaidAmount ?? 0, notes: row.notes ?? "" })}
                              className="text-blue-400 hover:text-blue-600">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => { if (confirm("삭제하시겠습니까?")) deletePrepaidMut.mutate({ id: row.id }); }}
                              className="text-red-400 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!prepaids?.length && (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400">데파짃 내역이 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ===== 은행 문자 파싱 모달 (입금) ===== */}
      <Dialog open={showIncomeParse} onOpenChange={setShowIncomeParse}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clipboard className="w-5 h-5 text-green-600" />
              은행 입금 문자 붙여넣기
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              은행 앱 또는 문자 알림을 그대로 붙여넣으면 자동으로 파싱됩니다.
            </p>
            <div className="bg-gray-50 rounded p-3 text-xs text-gray-500 space-y-1">
              <p className="font-semibold text-gray-700">지원 형식 예시:</p>
              <p>[신한은행] 01/15 14:32 홍길동 1,234,567원 입금</p>
              <p>국민은행 입금 2024-01-15 홍길동 1234567원</p>
              <p>OY-202504-XXXX 홍길동 1,234,567</p>
            </div>
            <div>
              <Label>은행 문자 내용 *</Label>
              <Textarea
                value={incomeParseText}
                onChange={e => setIncomeParseText(e.target.value)}
                placeholder="은행 문자를 여기에 붙여넣으세요..."
                rows={5}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIncomeParse(false)}>취소</Button>
            <Button onClick={handleIncomeParse} className="bg-green-700 hover:bg-green-800 text-white">
              <CheckCircle className="w-4 h-4 mr-1" /> 파싱 후 등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 은행 문자 파싱 모달 (송금) ===== */}
      <Dialog open={showRemitParse} onOpenChange={setShowRemitParse}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clipboard className="w-5 h-5 text-blue-600" />
              은행 송금 문자 붙여넣기
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              은행 앱 또는 문자 알림을 그대로 붙여넣으면 자동으로 파싱됩니다.
            </p>
            <div className="bg-gray-50 rounded p-3 text-xs text-gray-500 space-y-1">
              <p className="font-semibold text-gray-700">지원 형식 예시:</p>
              <p>[신한은행] 01/15 14:32 홍길동 1,234,567원 출금</p>
              <p>국민은행 송금 2024-01-15 홍길동 1234567원</p>
            </div>
            <div>
              <Label>은행 문자 내용 *</Label>
              <Textarea
                value={remitParseText}
                onChange={e => setRemitParseText(e.target.value)}
                placeholder="은행 문자를 여기에 붙여넣으세요..."
                rows={5}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemitParse(false)}>취소</Button>
            <Button onClick={handleRemitParse} className="bg-blue-700 hover:bg-blue-800 text-white">
              <CheckCircle className="w-4 h-4 mr-1" /> 파싱 후 등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 입금 등록 모달 */}
      <Dialog open={showIncomeForm} onOpenChange={setShowIncomeForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>입금 내역 등록</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>입금일시 *</Label><Input type="datetime-local" value={incomeForm.transactionDate} onChange={e => setIncomeForm(f => ({ ...f, transactionDate: e.target.value }))} /></div>
            <div><Label>은행명</Label><Input value={incomeForm.bankName} onChange={e => setIncomeForm(f => ({ ...f, bankName: e.target.value }))} placeholder="신한, 국민 등" /></div>
            <div><Label>금액 *</Label><Input type="number" value={incomeForm.amount} onChange={e => setIncomeForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
            <div><Label>입금자명</Label><Input value={incomeForm.depositorName} onChange={e => setIncomeForm(f => ({ ...f, depositorName: e.target.value }))} /></div>
            <div>
              <Label>예약번호 (자동 매칭)</Label>
              <Input
                value={incomeForm.reservationNo}
                onChange={e => setIncomeForm(f => ({ ...f, reservationNo: e.target.value }))}
                placeholder="OY-202504-XXXX"
                className={incomeForm.reservationNo ? "border-green-400 bg-green-50" : ""}
              />
              {incomeForm.reservationNo && (
                <p className="text-xs text-green-600 mt-1">✓ 예약번호 자동 감지됨 - 등록 시 해당 예약에 자동 매칭됩니다.</p>
              )}
            </div>
            <div><Label>상세내역 (은행 문자 원본)</Label><Textarea value={incomeForm.detail} onChange={e => setIncomeForm(f => ({ ...f, detail: e.target.value }))} rows={2} /></div>
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
            <div>
              <Label>예약번호 (자동 매칭)</Label>
              <Input
                value={remitForm.reservationNo}
                onChange={e => setRemitForm(f => ({ ...f, reservationNo: e.target.value }))}
                placeholder="OY-202504-XXXX"
                className={remitForm.reservationNo ? "border-blue-400 bg-blue-50" : ""}
              />
              {remitForm.reservationNo && (
                <p className="text-xs text-blue-600 mt-1">✓ 예약번호 자동 감지됨 - 등록 시 해당 예약에 자동 매칭됩니다.</p>
              )}
            </div>
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

      {/* 충전카드 매칭 모달 */}
      <Dialog open={matchChargeId !== null} onOpenChange={() => setMatchChargeId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Link2 size={16} className="text-blue-600" />예약번호 매칭</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">충전 내역에 연결할 예약번호를 입력하세요.</p>
            <div>
              <Label>예약번호 *</Label>
              <Input value={matchReservationNo} onChange={e => setMatchReservationNo(e.target.value)} placeholder="OY-202504-XXXX" className="font-mono" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchChargeId(null)}>취소</Button>
            <Button onClick={() => {
              if (!matchReservationNo.trim()) { toast.error("예약번호를 입력하세요."); return; }
              matchChargeMut.mutate({ id: matchChargeId!, reservationNo: matchReservationNo });
            }} className="bg-blue-700 hover:bg-blue-800 text-white">매칭 확정</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 데파짃 수정 모달 */}
      <Dialog open={editPrepaid !== null} onOpenChange={() => setEditPrepaid(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>데파짃 수정</DialogTitle></DialogHeader>
          {editPrepaid && (
            <div className="space-y-3">
              <div><Label>선입금 총액</Label><Input type="number" value={editPrepaid.prepaidAmount} onChange={e => setEditPrepaid(p => p ? {...p, prepaidAmount: Number(e.target.value)} : p)} /></div>
              <div><Label>사용 금액</Label><Input type="number" value={editPrepaid.usedAmount} onChange={e => setEditPrepaid(p => p ? {...p, usedAmount: Number(e.target.value)} : p)} /></div>
              <div><Label>메모</Label><Textarea value={editPrepaid.notes ?? ""} onChange={e => setEditPrepaid(p => p ? {...p, notes: e.target.value} : p)} rows={2} /></div>
              <div className="bg-teal-50 rounded p-2 text-sm">잔액: <strong className="text-teal-700">{(editPrepaid.prepaidAmount - editPrepaid.usedAmount).toLocaleString()}원</strong></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPrepaid(null)}>취소</Button>
            <Button onClick={() => {
              if (!editPrepaid) return;
              updatePrepaidMut.mutate({ id: editPrepaid.id, usedAmount: editPrepaid.usedAmount, prepaidAmount: editPrepaid.prepaidAmount, notes: editPrepaid.notes });
            }} className="bg-teal-700 hover:bg-teal-800 text-white">저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 데파짃 등록 모달 */}
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
