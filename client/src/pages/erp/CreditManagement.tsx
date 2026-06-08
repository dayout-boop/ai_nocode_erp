/**
 * CreditManagement.tsx
 * 관리자 ERP: 파트너별 크레딧 수동 부여/조절 전용 페이지
 *
 * 기능:
 * 1. 파트너 목록 + 현재 크레딧 잔액 일람표 (잔액 0 이하 경고 배지)
 * 2. 수동 크레딧 직접 조정 (증감 모두 지원, 사유 필수 입력)
 * 3. 입금 확인 후 충전 요청 승인/거부 (메모 입력 가능)
 * 4. 파트너별 크레딧 이력 상세 조회 (타입 필터)
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Coins, AlertTriangle, CheckCircle,
  XCircle, Clock, RefreshCw, History, Plus, Minus, Search,
  ChevronLeft, ChevronRight
} from "lucide-react";

// ─── 타입 정의 ──────────────────────────────────────────────────────────────
type TenantCreditRow = {
  id: number;
  companyName: string;
  subscriptionPlan: string;
  aiCreditsBalance: number;
  aiCreditsMonthlyLimit: number;
  aiCreditsUsedThisMonth: number;
  isActive: boolean;
};

type CreditRequest = {
  id: number;
  tenantId: number;
  companyName: string | null;
  requestType: string;
  packageId: string;
  credits: number;
  amountKrw: number;
  status: string;
  depositorName: string | null;
  depositMemo: string | null;
  adminNote: string | null;
  processedAt: Date | null;
  createdAt: Date;
};

type CreditHistoryRow = {
  id: number;
  tenantId: number;
  type: string;
  amount: number;
  balanceAfter: number;
  paidAmountKrw: number | null;
  memo: string | null;
  processedBy: number | null;
  createdAt: Date;
};

// ─── 유틸 ──────────────────────────────────────────────────────────────────
function planLabel(plan: string) {
  const map: Record<string, string> = {
    free: "무료",
    starter: "스타터",
    basic: "기본",
    pro: "프로",
    enterprise: "엔터프라이즈",
  };
  return map[plan] ?? plan;
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    charge: "충전",
    deduct: "차감",
    refund: "환불",
    monthly_reset: "월초기화",
  };
  return map[type] ?? type;
}

function typeBadgeVariant(type: string): "default" | "secondary" | "destructive" | "outline" {
  if (type === "charge" || type === "refund") return "default";
  if (type === "deduct") return "destructive";
  return "secondary";
}

// ─── 수동 조정 다이얼로그 ───────────────────────────────────────────────────
function AdjustCreditDialog({
  tenant,
  onClose,
  onSuccess,
}: {
  tenant: TenantCreditRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState<string>("");
  const [memo, setMemo] = useState("");
  const [mode, setMode] = useState<"add" | "sub">("add");

  const adjustMutation = trpc.tenantAi.adminAdjustCredit.useMutation({
    onSuccess: (data) => {
      toast.success(`크레딧 조정 완료 — ${data.companyName} 잔액: ${data.newBalance.toLocaleString()} 크레딧`);
      onSuccess();
      onClose();
    },
    onError: (err) => {
      toast.error(`조정 실패: ${err.message}`);
    },
  });

  const numAmount = parseInt(amount || "0", 10);
  const finalAmount = mode === "add" ? numAmount : -numAmount;
  const preview = tenant.aiCreditsBalance + finalAmount;

  const handleSubmit = () => {
    if (!amount || numAmount <= 0) {
      toast.error("1 이상의 숫자를 입력해주세요.");
      return;
    }
    if (!memo.trim()) {
      toast.error("조정 사유를 입력해주세요.");
      return;
    }
    adjustMutation.mutate({ tenantId: tenant.id, amount: finalAmount, memo });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            수동 크레딧 조정 — {tenant.companyName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 현재 잔액 */}
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between text-slate-500 mb-1">
              <span>현재 잔액</span>
              <span className="font-semibold text-slate-800">{tenant.aiCreditsBalance.toLocaleString()} 크레딧</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>이번 달 사용</span>
              <span>{tenant.aiCreditsUsedThisMonth.toLocaleString()} 크레딧</span>
            </div>
          </div>

          {/* 증감 모드 선택 */}
          <div className="flex gap-2">
            <Button
              variant={mode === "add" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setMode("add")}
            >
              <Plus className="w-4 h-4 mr-1" /> 충전 (증가)
            </Button>
            <Button
              variant={mode === "sub" ? "destructive" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setMode("sub")}
            >
              <Minus className="w-4 h-4 mr-1" /> 차감 (감소)
            </Button>
          </div>

          {/* 금액 입력 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              조정 크레딧 수
            </label>
            <Input
              type="number"
              min={1}
              max={9999}
              placeholder="예: 50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* 사유 입력 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              조정 사유 <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="예: 입금 확인 후 수동 지급, 테스트 크레딧 회수 등"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
            />
          </div>

          {/* 미리보기 */}
          {amount && numAmount > 0 && (
            <div className={`rounded-lg p-3 text-sm font-medium ${
              preview < 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
            }`}>
              조정 후 잔액: {preview.toLocaleString()} 크레딧
              {preview < 0 && " ⚠️ 잔액이 0 미만이 됩니다"}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={adjustMutation.isPending}
            variant={mode === "sub" ? "destructive" : "default"}
          >
            {adjustMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
            ) : mode === "add" ? (
              <Plus className="w-4 h-4 mr-1" />
            ) : (
              <Minus className="w-4 h-4 mr-1" />
            )}
            {mode === "add" ? "충전 적용" : "차감 적용"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 크레딧 이력 패널 ───────────────────────────────────────────────────────
function CreditHistoryPanel({ tenantId, companyName }: { tenantId: number; companyName: string }) {
  const [historyType, setHistoryType] = useState<"all" | "charge" | "deduct" | "refund" | "monthly_reset">("all");
  const [historyPage, setHistoryPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data: historyData, isLoading } = trpc.tenantAi.getAdminCreditHistory.useQuery({
    tenantId,
    type: historyType,
    limit: PAGE_SIZE,
    offset: historyPage * PAGE_SIZE,
  });

  const rows: CreditHistoryRow[] = historyData?.rows ?? [];
  const total = historyData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          {companyName} 크레딧 이력
        </h3>
        <Select
          value={historyType}
          onValueChange={(v) => {
            setHistoryType(v as typeof historyType);
            setHistoryPage(0);
          }}
        >
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="charge">충전</SelectItem>
            <SelectItem value="deduct">차감</SelectItem>
            <SelectItem value="refund">환불</SelectItem>
            <SelectItem value="monthly_reset">월초기화</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-slate-400 text-sm">불러오는 중...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">이력이 없습니다.</div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-600 font-medium">일시</th>
                  <th className="text-left px-3 py-2 text-slate-600 font-medium">유형</th>
                  <th className="text-right px-3 py-2 text-slate-600 font-medium">변동</th>
                  <th className="text-right px-3 py-2 text-slate-600 font-medium">잔액</th>
                  <th className="text-left px-3 py-2 text-slate-600 font-medium">메모</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString("ko-KR", {
                        month: "2-digit", day: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={typeBadgeVariant(row.type)} className="text-xs">
                        {typeLabel(row.type)}
                      </Badge>
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${
                      row.amount > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {row.amount > 0 ? "+" : ""}{row.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">
                      {row.balanceAfter.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-xs max-w-[200px] truncate">
                      {row.memo ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>총 {total.toLocaleString()}건</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  disabled={historyPage === 0}
                  onClick={() => setHistoryPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <span className="px-2">{historyPage + 1} / {totalPages}</span>
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  disabled={historyPage >= totalPages - 1}
                  onClick={() => setHistoryPage((p) => p + 1)}
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── 충전 요청 처리 다이얼로그 ─────────────────────────────────────────────
function ProcessRequestDialog({
  req,
  onClose,
  onSuccess,
}: {
  req: CreditRequest;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [note, setNote] = useState("");
  const [action, setAction] = useState<"approved" | "rejected">("approved");

  const approveMutation = trpc.tenantAi.approveCreditRequest.useMutation({
    onSuccess: () => {
      toast.success(`충전 요청 승인 완료 — ${req.credits} 크레딧이 지급되었습니다.`);
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(`승인 실패: ${err.message}`),
  });

  const rejectMutation = trpc.tenantAi.rejectCreditRequest.useMutation({
    onSuccess: () => {
      toast.success("충전 요청 거부 완료");
      onSuccess();
      onClose();
    },
    onError: (err) => toast.error(`거부 실패: ${err.message}`),
  });

  const handleSubmit = () => {
    if (action === "rejected" && !note.trim()) {
      toast.error("거부 시 사유를 입력해주세요.");
      return;
    }
    if (action === "approved") {
      approveMutation.mutate({ requestId: req.id, adminNote: note || undefined });
    } else {
      rejectMutation.mutate({ requestId: req.id, adminNote: note });
    }
  };

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>충전 요청 처리</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">업체명</span>
              <span className="font-semibold">{req.companyName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">충전 크레딧</span>
              <span className="font-semibold text-green-700">+{req.credits} 크레딧</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">결제 금액</span>
              <span className="font-semibold">{req.amountKrw.toLocaleString()}원</span>
            </div>
            {req.depositorName && (
              <div className="flex justify-between">
                <span className="text-slate-500">입금자명</span>
                <span>{req.depositorName}</span>
              </div>
            )}
            {req.depositMemo && (
              <div className="flex justify-between">
                <span className="text-slate-500">입금 메모</span>
                <span className="text-xs">{req.depositMemo}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">요청 일시</span>
              <span className="text-xs">{new Date(req.createdAt).toLocaleString("ko-KR")}</span>
            </div>
          </div>

          {/* 승인/거부 선택 */}
          <div className="flex gap-2">
            <Button
              variant={action === "approved" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setAction("approved")}
            >
              <CheckCircle className="w-4 h-4 mr-1" /> 승인
            </Button>
            <Button
              variant={action === "rejected" ? "destructive" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setAction("rejected")}
            >
              <XCircle className="w-4 h-4 mr-1" /> 거부
            </Button>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              관리자 메모 {action === "rejected" && <span className="text-red-500">*</span>}
            </label>
            <Textarea
              placeholder={action === "approved" ? "승인 메모 (선택)" : "거부 사유 (필수)"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            variant={action === "rejected" ? "destructive" : "default"}
          >
            {isPending && <RefreshCw className="w-4 h-4 mr-1 animate-spin" />}
            {action === "approved" ? "승인 처리" : "거부 처리"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 메인 페이지 ────────────────────────────────────────────────────────────
export default function CreditManagement() {
  const [search, setSearch] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<TenantCreditRow | null>(null);
  const [adjustDialog, setAdjustDialog] = useState<TenantCreditRow | null>(null);
  const [processDialog, setProcessDialog] = useState<CreditRequest | null>(null);
  const [requestFilter, setRequestFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  // 전체 테넌트 크레딧 현황
  const { data: allTenantsCredit, refetch: refetchAll } = trpc.tenantAi.getAllTenantsCredit.useQuery();

  // 충전 요청 목록
  const { data: creditRequests, refetch: refetchRequests } = trpc.tenantAi.getAllCreditRequests.useQuery({
    status: requestFilter,
    limit: 50,
    offset: 0,
  });

  const tenants: TenantCreditRow[] = allTenantsCredit ?? [];
  const requests: CreditRequest[] = creditRequests ?? [];

  // 검색 필터
  const filteredTenants = tenants.filter((t) =>
    t.companyName.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const lowBalanceCount = tenants.filter((t) => t.aiCreditsBalance <= 0).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-500" />
            크레딧 관리
          </h1>
          <p className="text-slate-500 text-sm mt-1">파트너별 AI 크레딧 수동 부여, 조절, 이력 조회</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchAll(); refetchRequests(); }}>
          <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
        </Button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-slate-500 mb-1">전체 파트너</div>
            <div className="text-2xl font-bold text-slate-800">{tenants.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-slate-500 mb-1">대기 충전 요청</div>
            <div className={`text-2xl font-bold ${pendingCount > 0 ? "text-amber-600" : "text-slate-800"}`}>
              {pendingCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-slate-500 mb-1">잔액 소진 파트너</div>
            <div className={`text-2xl font-bold ${lowBalanceCount > 0 ? "text-red-600" : "text-slate-800"}`}>
              {lowBalanceCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-slate-500 mb-1">총 크레딧 잔액</div>
            <div className="text-2xl font-bold text-slate-800">
              {tenants.reduce((s, t) => s + t.aiCreditsBalance, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">파트너 현황</TabsTrigger>
          <TabsTrigger value="requests">
            충전 요청
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs px-1.5 py-0 h-4">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          {selectedTenant && (
            <TabsTrigger value="history">
              {selectedTenant.companyName} 이력
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── 탭 1: 파트너 현황 ── */}
        <TabsContent value="overview" className="mt-4 space-y-3">
          {/* 검색 */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="업체명 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">업체명</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">플랜</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-medium">잔액</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-medium">이번달 사용</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-medium">월 한도</th>
                  <th className="text-center px-4 py-3 text-slate-600 font-medium">액션</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      파트너가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((tenant) => {
                    const isLow = tenant.aiCreditsBalance <= 0;
                    const isWarning = !isLow && tenant.aiCreditsBalance <= Math.ceil(tenant.aiCreditsMonthlyLimit * 0.1);
                    return (
                      <tr key={tenant.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{tenant.companyName}</span>
                            {isLow && (
                              <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4">
                                <AlertTriangle className="w-3 h-3 mr-0.5" /> 소진
                              </Badge>
                            )}
                            {isWarning && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 border-amber-400 text-amber-600">
                                잔액 부족
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs">{planLabel(tenant.subscriptionPlan)}</Badge>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${
                          isLow ? "text-red-600" : isWarning ? "text-amber-600" : "text-slate-800"
                        }`}>
                          {tenant.aiCreditsBalance.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">
                          {tenant.aiCreditsUsedThisMonth.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">
                          {tenant.aiCreditsMonthlyLimit.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => setAdjustDialog(tenant)}
                            >
                              <Coins className="w-3 h-3 mr-1" /> 조정
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setSelectedTenant(tenant)}
                            >
                              <History className="w-3 h-3 mr-1" /> 이력
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── 탭 2: 충전 요청 ── */}
        <TabsContent value="requests" className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            {(["pending", "approved", "rejected", "all"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={requestFilter === f ? "default" : "outline"}
                onClick={() => setRequestFilter(f)}
                className="h-8"
              >
                {f === "pending" && <Clock className="w-3 h-3 mr-1" />}
                {f === "approved" && <CheckCircle className="w-3 h-3 mr-1" />}
                {f === "rejected" && <XCircle className="w-3 h-3 mr-1" />}
                {f === "pending" ? "대기" : f === "approved" ? "승인" : f === "rejected" ? "거부" : "전체"}
              </Button>
            ))}
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">요청일</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">업체명</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-medium">크레딧</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-medium">금액</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">입금자명</th>
                  <th className="text-center px-4 py-3 text-slate-600 font-medium">상태</th>
                  <th className="text-center px-4 py-3 text-slate-600 font-medium">처리</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      {requestFilter === "pending" ? "대기 중인 요청이 없습니다." : "요청이 없습니다."}
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleString("ko-KR", {
                          month: "2-digit", day: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{req.companyName}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">
                        +{req.credits}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {req.amountKrw.toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-slate-600">{req.depositorName ?? "-"}</td>
                      <td className="px-4 py-3 text-center">
                        {req.status === "pending" && (
                          <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
                            <Clock className="w-3 h-3 mr-0.5" /> 대기
                          </Badge>
                        )}
                        {req.status === "approved" && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle className="w-3 h-3 mr-0.5" /> 승인
                          </Badge>
                        )}
                        {req.status === "rejected" && (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="w-3 h-3 mr-0.5" /> 거부
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {req.status === "pending" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setProcessDialog(req)}
                          >
                            처리
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {req.processedAt
                              ? new Date(req.processedAt).toLocaleDateString("ko-KR")
                              : "-"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── 탭 3: 이력 조회 ── */}
        {selectedTenant && (
          <TabsContent value="history" className="mt-4">
            <CreditHistoryPanel
              tenantId={selectedTenant.id}
              companyName={selectedTenant.companyName}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* 수동 조정 다이얼로그 */}
      {adjustDialog && (
        <AdjustCreditDialog
          tenant={adjustDialog}
          onClose={() => setAdjustDialog(null)}
          onSuccess={() => { refetchAll(); }}
        />
      )}

      {/* 충전 요청 처리 다이얼로그 */}
      {processDialog && (
        <ProcessRequestDialog
          req={processDialog}
          onClose={() => setProcessDialog(null)}
          onSuccess={() => { refetchRequests(); refetchAll(); }}
        />
      )}
    </div>
  );
}
