// ============================================================
// AICreditManagement.tsx
// AI 크레딧 통합 관리 페이지
// - 마스터 모드: AI 비용 현황 + 전체 테넌트 크레딧 관리 + 충전 요청 승인
// - 테넌트(파트너) 모드: 내 크레딧 잔액 + 사용 이력 + 충전 요청
// ============================================================
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Coins,
  DollarSign,
  TrendingUp,
  Zap,
  BarChart3,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  RefreshCw,
  Plus,
  AlertTriangle,
  Bot,
  Sparkles,
  Briefcase,
  CreditCard,
  History,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── 어시스턴트 레이블 ────────────────────────────────────────
const ASSISTANT_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  master: { label: "마스터AI", color: "bg-purple-50 text-purple-700 border-purple-200", icon: <Bot size={12} /> },
  golftalk: { label: "AI상담톡", color: "bg-green-50 text-green-700 border-green-200", icon: <Sparkles size={12} /> },
  manager: { label: "AI파트너매니저", color: "bg-blue-50 text-blue-700 border-blue-200", icon: <Briefcase size={12} /> },
  gemini: { label: "파트너자동화AI", color: "bg-orange-50 text-orange-700 border-orange-200", icon: <Zap size={12} /> },
};

// ─── 플랜 레이블 ──────────────────────────────────────────────
const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  starter: { label: "스타터 (10크레딧/월)", color: "bg-gray-100 text-gray-700" },
  standard: { label: "스탠다드 (50크레딧/월)", color: "bg-blue-100 text-blue-700" },
  premium: { label: "프리미엄 (200크레딧/월)", color: "bg-purple-100 text-purple-700" },
};

// ─── 마스터 모드: AI 비용 현황 탭 ─────────────────────────────
function MasterCostTab() {
  const [period, setPeriod] = useState<"today" | "week" | "month">("month");
  const { data: costData, isLoading } = trpc.aiAssistant.getCostSummary.useQuery({ period });

  const periodLabel = { today: "오늘", week: "이번 주", month: "이번 달" }[period];

  return (
    <div className="space-y-6">
      {/* 기간 선택 */}
      <div className="flex gap-2">
        {(["today", "week", "month"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === p ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {{ today: "오늘", week: "이번 주", month: "이번 달" }[p]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : costData ? (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg"><DollarSign size={20} className="text-green-600" /></div>
                <div>
                  <p className="text-sm text-gray-500">{periodLabel} 총 비용</p>
                  <p className="text-2xl font-bold text-gray-900">${Number(costData.totalCost ?? 0).toFixed(4)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg"><Zap size={20} className="text-blue-600" /></div>
                <div>
                  <p className="text-sm text-gray-500">총 메시지 수</p>
                  <p className="text-2xl font-bold text-gray-900">{(costData.totalMessages ?? 0).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg"><TrendingUp size={20} className="text-purple-600" /></div>
                <div>
                  <p className="text-sm text-gray-500">총 토큰</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {((costData.rows ?? []).reduce((sum: number, r: any) => sum + (r.totalTokensIn ?? 0) + (r.totalTokensOut ?? 0), 0)).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg"><BarChart3 size={20} className="text-orange-600" /></div>
                <div>
                  <p className="text-sm text-gray-500">평균 메시지 비용</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${costData.totalMessages > 0 ? (Number(costData.totalCost) / costData.totalMessages).toFixed(4) : "0.0000"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI 어시스턴트별 비용 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">AI 채널별 비용 내역</CardTitle>
            </CardHeader>
            <CardContent>
              {(costData.rows ?? []).length === 0 ? (
                <div className="text-center py-8 text-gray-400">데이터가 없습니다.</div>
              ) : (
                <div className="space-y-3">
                  {(costData.rows ?? []).map((row: any) => {
                    const info = ASSISTANT_LABELS[row.assistant] ?? { label: row.assistant, color: "bg-gray-100 text-gray-700", icon: <Bot size={12} /> };
                    return (
                      <div key={row.assistant} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={`text-xs gap-1 ${info.color}`}>
                            {info.icon}
                            {info.label}
                          </Badge>
                          <span className="text-sm text-gray-600">{row.messageCount}회 메시지</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">${Number(row.totalCost ?? 0).toFixed(4)}</p>
                          <p className="text-xs text-gray-400">
                            in: {(row.totalTokensIn ?? 0).toLocaleString()} / out: {(row.totalTokensOut ?? 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-12 text-gray-400">데이터를 불러올 수 없습니다.</div>
      )}
    </div>
  );
}

// ─── 마스터 모드: 테넌트 크레딧 현황 탭 ─────────────────────────
function MasterTenantCreditTab() {
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeMemo, setChargeMemo] = useState("");

  const { data: tenants, isLoading, refetch } = trpc.tenantAi.getAllTenantsCredit.useQuery();

  const chargeMutation = trpc.tenantAi.chargeCredits.useMutation({
    onSuccess: () => {
      toast.success("크레딧이 충전되었습니다.");
      setChargeDialogOpen(false);
      setChargeAmount("");
      setChargeMemo("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const selectedTenant = tenants?.find((t) => t.id === selectedTenantId);

  const handleCharge = () => {
    if (!selectedTenantId || !chargeAmount) return;
    chargeMutation.mutate({
      tenantId: selectedTenantId,
      credits: parseInt(chargeAmount),
      memo: chargeMemo || undefined,
    });
  };

  if (isLoading) return <div className="text-center py-12 text-gray-400">불러오는 중...</div>;

  return (
    <div className="space-y-4">
      {/* 충전 다이얼로그 */}
      <Dialog open={chargeDialogOpen} onOpenChange={setChargeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>크레딧 직접 충전</DialogTitle>
            <DialogDescription>
              {selectedTenant?.companyName}에 크레딧을 직접 충전합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>충전 크레딧 수</Label>
              <Input
                type="number"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                placeholder="예: 50"
                className="mt-1"
              />
            </div>
            <div>
              <Label>메모 (선택)</Label>
              <Textarea
                value={chargeMemo}
                onChange={(e) => setChargeMemo(e.target.value)}
                placeholder="충전 사유를 입력하세요..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeDialogOpen(false)}>취소</Button>
            <Button onClick={handleCharge} disabled={chargeMutation.isPending || !chargeAmount}>
              {chargeMutation.isPending ? "처리 중..." : "충전"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 테넌트 목록 */}
      {(!tenants || tenants.length === 0) ? (
        <div className="text-center py-12 text-gray-400">등록된 파트너가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {tenants.map((tenant) => {
            const planInfo = PLAN_LABELS[tenant.subscriptionPlan ?? "starter"] ?? PLAN_LABELS.starter;
            const usagePercent = tenant.aiCreditsMonthlyLimit && tenant.aiCreditsMonthlyLimit > 0
              ? Math.round(((tenant.aiCreditsUsedThisMonth ?? 0) / tenant.aiCreditsMonthlyLimit) * 100)
              : 0;
            const isWarning = usagePercent >= 80;
            const isDanger = usagePercent >= 100;

            return (
              <Card key={tenant.id} className={`border ${isDanger ? "border-red-200" : isWarning ? "border-yellow-200" : "border-gray-200"}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 size={14} className="text-gray-400 shrink-0" />
                        <span className="font-semibold text-gray-800 truncate">{tenant.companyName}</span>
                        <Badge variant="outline" className={`text-xs ${planInfo.color}`}>
                          {planInfo.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>잔액: <strong className="text-gray-800">{tenant.aiCreditsBalance ?? 0}</strong> 크레딧</span>
                        <span>이번달: <strong className={isDanger ? "text-red-600" : isWarning ? "text-yellow-600" : "text-gray-800"}>{tenant.aiCreditsUsedThisMonth ?? 0}</strong> / {tenant.aiCreditsMonthlyLimit ?? 0}</span>
                        {isWarning && (
                          <span className={`flex items-center gap-1 ${isDanger ? "text-red-500" : "text-yellow-500"}`}>
                            <AlertTriangle size={12} />
                            {isDanger ? "한도 초과" : "한도 임박"}
                          </span>
                        )}
                      </div>
                      {/* 사용량 바 */}
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isDanger ? "bg-red-500" : isWarning ? "bg-yellow-400" : "bg-blue-500"}`}
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1"
                      onClick={() => {
                        setSelectedTenantId(tenant.id);
                        setChargeDialogOpen(true);
                      }}
                    >
                      <Plus size={13} />
                      충전
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 마스터 모드: 충전 요청 처리 탭 ─────────────────────────────
function MasterChargeRequestTab() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const { data: requests, isLoading, refetch } = trpc.tenantAi.getAllCreditRequests.useQuery({
    status: statusFilter,
    limit: 50,
    offset: 0,
  });

  const approveMutation = trpc.tenantAi.approveCreditRequest.useMutation({
    onSuccess: () => {
      toast.success("충전 요청이 승인되었습니다.");
      setApproveDialogOpen(false);
      setAdminNote("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.tenantAi.rejectCreditRequest.useMutation({
    onSuccess: () => {
      toast.success("충전 요청이 거부되었습니다.");
      setRejectDialogOpen(false);
      setAdminNote("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const pendingCount = useMemo(() => {
    if (statusFilter === "pending") return requests?.length ?? 0;
    return 0;
  }, [requests, statusFilter]);

  return (
    <div className="space-y-4">
      {/* 승인 다이얼로그 */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>충전 요청 승인</DialogTitle>
            <DialogDescription>입금 확인 후 크레딧을 지급합니다.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>관리자 메모 (선택)</Label>
            <Textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="승인 메모..."
              className="mt-1"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>취소</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => selectedRequestId && approveMutation.mutate({ requestId: selectedRequestId, adminNote: adminNote || undefined })}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? "처리 중..." : "승인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 거부 다이얼로그 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>충전 요청 거부</DialogTitle>
            <DialogDescription>거부 사유를 입력해주세요.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>거부 사유 *</Label>
            <Textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="거부 사유를 입력하세요..."
              className="mt-1"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>취소</Button>
            <Button
              variant="destructive"
              onClick={() => selectedRequestId && rejectMutation.mutate({ requestId: selectedRequestId, adminNote })}
              disabled={rejectMutation.isPending || !adminNote}
            >
              {rejectMutation.isPending ? "처리 중..." : "거부"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 필터 */}
      <div className="flex gap-2 flex-wrap">
        {([
          { value: "pending", label: "대기 중", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
          { value: "approved", label: "승인됨", color: "bg-green-50 text-green-700 border-green-200" },
          { value: "rejected", label: "거부됨", color: "bg-red-50 text-red-700 border-red-200" },
          { value: "all", label: "전체", color: "bg-gray-100 text-gray-700" },
        ] as const).map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              statusFilter === f.value ? f.color + " font-semibold" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.label}
            {f.value === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : !requests || requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {statusFilter === "pending" ? "대기 중인 충전 요청이 없습니다." : "요청 내역이 없습니다."}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card key={req.id} className="border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 size={14} className="text-gray-400" />
                      <span className="font-semibold text-gray-800">{req.companyName ?? `테넌트 #${req.tenantId}`}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          req.status === "pending" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                          req.status === "approved" ? "bg-green-50 text-green-700 border-green-200" :
                          "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        {req.status === "pending" ? <Clock size={10} className="mr-1" /> :
                         req.status === "approved" ? <CheckCircle2 size={10} className="mr-1" /> :
                         <XCircle size={10} className="mr-1" />}
                        {req.status === "pending" ? "대기 중" : req.status === "approved" ? "승인됨" : "거부됨"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                      <span><strong>{req.credits}</strong> 크레딧</span>
                      <span>{(req.amountKrw ?? 0).toLocaleString()}원</span>
                      <span>{req.requestType === "manual" ? "수동 입금" : "PG 결제"}</span>
                      {req.depositorName && <span>입금자: {req.depositorName}</span>}
                    </div>
                    {req.depositMemo && (
                      <p className="text-xs text-gray-400 mt-1">메모: {req.depositMemo}</p>
                    )}
                    {req.adminNote && (
                      <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded p-1.5">관리자 메모: {req.adminNote}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(req.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  {req.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 gap-1"
                        onClick={() => {
                          setSelectedRequestId(req.id);
                          setAdminNote("");
                          setApproveDialogOpen(true);
                        }}
                      >
                        <CheckCircle2 size={13} />
                        승인
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 border-red-200 hover:bg-red-50 gap-1"
                        onClick={() => {
                          setSelectedRequestId(req.id);
                          setAdminNote("");
                          setRejectDialogOpen(true);
                        }}
                      >
                        <XCircle size={13} />
                        거부
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 파트너(테넌트) 모드: 내 크레딧 현황 ─────────────────────────
function PartnerCreditView() {
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [depositorName, setDepositorName] = useState("");
  const [depositMemo, setDepositMemo] = useState("");

  const { data: creditInfo, isLoading, refetch } = trpc.tenantAi.getMyCredit.useQuery();
  const { data: requests, refetch: refetchRequests } = trpc.tenantAi.getMyCreditRequests.useQuery({ limit: 20, offset: 0 });

  const requestMutation = trpc.tenantAi.requestCreditCharge.useMutation({
    onSuccess: () => {
      toast.success("충전 요청이 접수되었습니다. 관리자 확인 후 크레딧이 지급됩니다.");
      setChargeDialogOpen(false);
      setSelectedPackage("");
      setDepositorName("");
      setDepositMemo("");
      refetch();
      refetchRequests();
    },
    onError: (err) => toast.error(err.message),
  });

  const packages = creditInfo?.creditPackages ?? [
    { credits: 50, priceKrw: 50_000, label: "50 크레딧 (5만원)" },
    { credits: 100, priceKrw: 100_000, label: "100 크레딧 (10만원)" },
    { credits: 200, priceKrw: 200_000, label: "200 크레딧 (20만원)" },
  ];

  const usagePercent = creditInfo?.usagePercent ?? 0;
  const isDanger = usagePercent >= 100;
  const isWarning = usagePercent >= 80;

  if (isLoading) return <div className="text-center py-12 text-gray-400">불러오는 중...</div>;

  return (
    <div className="space-y-6">
      {/* 충전 요청 다이얼로그 */}
      <Dialog open={chargeDialogOpen} onOpenChange={setChargeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI 크레딧 충전 요청</DialogTitle>
            <DialogDescription>
              충전 패키지를 선택하고 입금 정보를 입력해주세요. 관리자 확인 후 크레딧이 지급됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>충전 패키지 선택</Label>
              <Select value={selectedPackage} onValueChange={setSelectedPackage}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="패키지를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((pkg) => (
                    <SelectItem key={pkg.credits} value={pkg.credits.toString()}>
                      {pkg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>입금자명</Label>
              <Input
                value={depositorName}
                onChange={(e) => setDepositorName(e.target.value)}
                placeholder="입금자명을 입력하세요"
                className="mt-1"
              />
            </div>
            <div>
              <Label>메모 (선택)</Label>
              <Textarea
                value={depositMemo}
                onChange={(e) => setDepositMemo(e.target.value)}
                placeholder="추가 메모..."
                className="mt-1"
                rows={2}
              />
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
              <p className="font-semibold mb-1">입금 계좌 안내</p>
              <p>국민은행 000-0000-0000-00 (주)두골프</p>
              <p className="text-xs mt-1 text-blue-500">입금 후 요청을 제출하면 관리자가 확인 후 크레딧을 지급합니다.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeDialogOpen(false)}>취소</Button>
            <Button
              onClick={() => requestMutation.mutate({
                requestType: "manual",
                packageId: selectedPackage,
                depositorName: depositorName || undefined,
                depositMemo: depositMemo || undefined,
              })}
              disabled={requestMutation.isPending || !selectedPackage}
            >
              {requestMutation.isPending ? "처리 중..." : "충전 요청"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 크레딧 현황 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={`border-2 ${isDanger ? "border-red-300" : isWarning ? "border-yellow-300" : "border-blue-200"}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-500">잔여 크레딧</p>
              <Coins size={18} className={isDanger ? "text-red-500" : isWarning ? "text-yellow-500" : "text-blue-500"} />
            </div>
            <p className={`text-3xl font-bold ${isDanger ? "text-red-600" : isWarning ? "text-yellow-600" : "text-gray-900"}`}>
              {creditInfo?.aiCreditsBalance ?? 0}
            </p>
            <p className="text-xs text-gray-400 mt-1">크레딧</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-500">이번달 사용량</p>
              <TrendingUp size={18} className="text-green-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{creditInfo?.thisMonthUsed ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1">/ {creditInfo?.planLimit ?? 0} 크레딧 한도</p>
            {/* 사용량 바 */}
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isDanger ? "bg-red-500" : isWarning ? "bg-yellow-400" : "bg-green-500"}`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{usagePercent}% 사용</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-500">전월 사용량</p>
              <History size={18} className="text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{creditInfo?.lastMonthUsed ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1">
              전월 대비 {(creditInfo?.monthDiff ?? 0) >= 0 ? "+" : ""}{creditInfo?.monthDiff ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 충전 버튼 */}
      <div className="flex justify-end">
        <Button onClick={() => setChargeDialogOpen(true)} className="gap-2">
          <Plus size={16} />
          크레딧 충전 요청
        </Button>
      </div>

      {/* 충전 요청 이력 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard size={16} className="text-blue-500" />
            충전 요청 이력
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!requests || requests.length === 0 ? (
            <div className="text-center py-8 text-gray-400">충전 요청 이력이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">{req.credits} 크레딧</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          req.status === "pending" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                          req.status === "approved" ? "bg-green-50 text-green-700 border-green-200" :
                          "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        {req.status === "pending" ? "대기 중" : req.status === "approved" ? "승인됨" : "거부됨"}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(req.amountKrw ?? 0).toLocaleString()}원 · {new Date(req.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  {req.adminNote && (
                    <p className="text-xs text-gray-500 max-w-[200px] text-right">{req.adminNote}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────
export default function AICreditManagement() {
  const { user } = useAuth();
  const isMaster = user?.role === "admin";

  // 마스터 탭
  const [masterTab, setMasterTab] = useState<"costs" | "tenants" | "requests">("costs");

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
          <Coins size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">AI 크레딧 관리</h1>
          <p className="text-sm text-slate-500">
            {isMaster
              ? "AI 비용 현황 · 파트너 크레딧 관리 · 충전 요청 처리"
              : "AI 크레딧 잔액 · 사용 이력 · 충전 요청"}
          </p>
        </div>
      </div>

      {isMaster ? (
        <>
          {/* 마스터 탭 */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {[
              { id: "costs", label: "AI 비용 현황", icon: DollarSign },
              { id: "tenants", label: "파트너 크레딧", icon: Users },
              { id: "requests", label: "충전 요청 처리", icon: CreditCard },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setMasterTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    masterTab === tab.id
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {masterTab === "costs" && <MasterCostTab />}
          {masterTab === "tenants" && <MasterTenantCreditTab />}
          {masterTab === "requests" && <MasterChargeRequestTab />}
        </>
      ) : (
        <PartnerCreditView />
      )}
    </div>
  );
}
