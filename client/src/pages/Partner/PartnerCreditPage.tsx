/**
 * PartnerCreditPage.tsx
 * 파트너 ERP — AI 크레딧 관리 페이지
 * - 현재 크레딧 잔액 및 이번달 사용량 표시
 * - 전월 대비 사용량 비교 (▲▼)
 * - 충전 패키지 선택 및 수동 입금 요청
 * - 충전 요청 이력 조회
 */

import { useState, useMemo } from "react";
import { partnerTrpc, createPartnerTrpcClient, createPartnerQueryClient } from "@/lib/partnerTrpc";
import { QueryClientProvider } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

// ─── 상태 뱃지 ────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "검토 중", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    approved: { label: "승인됨", className: "bg-green-100 text-green-700 border-green-200" },
    rejected: { label: "거부됨", className: "bg-red-100 text-red-700 border-red-200" },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <Badge variant="outline" className={`text-xs ${s.className}`}>
      {s.label}
    </Badge>
  );
}

// ─── 날짜 포맷 ────────────────────────────────────────────────
function fmtDate(d: Date | string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── 내부 컨텐츠 (partnerTrpc 컨텍스트 내부) ──────────────────
function CreditPageContent() {
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [depositorName, setDepositorName] = useState("");
  const [depositMemo, setDepositMemo] = useState("");

  // 크레딧 정보 조회
  const { data: credit, isLoading, refetch } = partnerTrpc.tenantAi.getMyCredit.useQuery();

  // 충전 요청 이력
  const { data: requests, refetch: refetchRequests } =
    partnerTrpc.tenantAi.getMyCreditRequests.useQuery({ limit: 20, offset: 0 });

  // 충전 요청 뮤테이션
  const requestMutation = partnerTrpc.tenantAi.requestCreditCharge.useMutation({
    onSuccess: () => {
      toast.success("충전 요청이 접수되었습니다. 입금 확인 후 크레딧이 지급됩니다.");
      setChargeDialogOpen(false);
      setSelectedPackageId(null);
      setDepositorName("");
      setDepositMemo("");
      refetch();
      refetchRequests();
    },
    onError: (err) => {
      toast.error(err.message ?? "충전 요청 중 오류가 발생했습니다.");
    },
  });

  const selectedPkg = credit?.creditPackages?.find(
    (p) => p.credits.toString() === selectedPackageId
  );

  const handleSubmitRequest = () => {
    if (!selectedPackageId) {
      toast.error("충전 패키지를 선택해주세요.");
      return;
    }
    if (!depositorName.trim()) {
      toast.error("입금자명을 입력해주세요.");
      return;
    }
    requestMutation.mutate({
      requestType: "manual",
      packageId: selectedPackageId,
      depositorName: depositorName.trim(),
      depositMemo: depositMemo.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <RefreshCw className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  const diff = credit?.monthDiff ?? 0;
  const usagePercent = credit?.usagePercent ?? 0;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">AI 크레딧 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">크레딧 잔액 확인 및 충전 요청</p>
        </div>
        <Button
          onClick={() => setChargeDialogOpen(true)}
          className="bg-green-600 hover:bg-green-700 text-white"
          size="sm"
        >
          <CreditCard size={14} className="mr-1.5" />
          크레딧 충전 요청
        </Button>
      </div>

      {/* ─── 크레딧 현황 카드 ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* 잔여 크레딧 */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-green-600" />
              <span className="text-xs font-medium text-green-700">잔여 크레딧</span>
            </div>
            <p className="text-3xl font-bold text-green-700">
              {(credit?.aiCreditsBalance ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-green-600 mt-1">크레딧</p>
          </CardContent>
        </Card>

        {/* 이번달 사용량 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} className="text-blue-600" />
              <span className="text-xs font-medium text-gray-600">이번달 사용</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {(credit?.thisMonthUsed ?? 0).toLocaleString()}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {diff > 0 ? (
                <>
                  <TrendingUp size={12} className="text-red-500" />
                  <span className="text-xs text-red-500">전월 대비 +{diff.toLocaleString()}</span>
                </>
              ) : diff < 0 ? (
                <>
                  <TrendingDown size={12} className="text-blue-500" />
                  <span className="text-xs text-blue-500">전월 대비 {diff.toLocaleString()}</span>
                </>
              ) : (
                <>
                  <Minus size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-400">전월과 동일</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 월 한도 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={16} className="text-orange-500" />
              <span className="text-xs font-medium text-gray-600">월 기본 한도</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {(credit?.planLimit ?? 0).toLocaleString()}
            </p>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    usagePercent >= 90
                      ? "bg-red-500"
                      : usagePercent >= 70
                      ? "bg-orange-500"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{usagePercent}% 사용</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── 충전 요청 이력 ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">충전 요청 이력</CardTitle>
        </CardHeader>
        <CardContent>
          {!requests || requests.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              충전 요청 이력이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        req.status === "approved"
                          ? "bg-green-100"
                          : req.status === "rejected"
                          ? "bg-red-100"
                          : "bg-yellow-100"
                      }`}
                    >
                      {req.status === "approved" ? (
                        <CheckCircle2 size={14} className="text-green-600" />
                      ) : req.status === "rejected" ? (
                        <XCircle size={14} className="text-red-600" />
                      ) : (
                        <Clock size={14} className="text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {req.credits} 크레딧 충전 요청
                      </p>
                      <p className="text-xs text-gray-500">
                        {(req.amountKrw ?? 0).toLocaleString()}원 · {fmtDate(req.createdAt)}
                      </p>
                      {req.adminNote && (
                        <p className="text-xs text-gray-400 mt-0.5">메모: {req.adminNote}</p>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 충전 요청 다이얼로그 ─── */}
      <Dialog open={chargeDialogOpen} onOpenChange={setChargeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>크레딧 충전 요청</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 패키지 선택 */}
            <div>
              <Label className="text-sm font-medium mb-2 block">충전 패키지 선택</Label>
              <div className="grid grid-cols-1 gap-2">
                {(credit?.creditPackages ?? []).map((pkg) => (
                  <button
                    key={pkg.credits}
                    onClick={() => setSelectedPackageId(pkg.credits.toString())}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      selectedPackageId === pkg.credits.toString()
                        ? "border-green-500 bg-green-50 ring-1 ring-green-500"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{pkg.label}</p>
                      <p className="text-xs text-gray-500">{pkg.credits} 크레딧</p>
                    </div>
                    <p className="font-bold text-green-700 text-sm">
                      {(pkg.priceKrw ?? 0).toLocaleString()}원
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* 입금 안내 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">입금 안내</p>
              <p className="text-xs text-blue-600">
                아래 계좌로 입금 후 요청하시면 확인 후 크레딧이 지급됩니다.
              </p>
              <p className="text-xs font-mono text-blue-800 mt-1.5">
                국민은행 000-0000-0000-00 · 두골프
              </p>
            </div>

            {/* 입금자명 */}
            <div>
              <Label htmlFor="depositorName" className="text-sm font-medium">
                입금자명 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="depositorName"
                value={depositorName}
                onChange={(e) => setDepositorName(e.target.value)}
                placeholder="실제 입금자명을 입력해주세요"
                className="mt-1"
              />
            </div>

            {/* 메모 */}
            <div>
              <Label htmlFor="depositMemo" className="text-sm font-medium">
                메모 (선택)
              </Label>
              <Textarea
                id="depositMemo"
                value={depositMemo}
                onChange={(e) => setDepositMemo(e.target.value)}
                placeholder="추가 메모사항이 있으면 입력해주세요"
                className="mt-1 resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleSubmitRequest}
              disabled={requestMutation.isPending || !selectedPackageId}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {requestMutation.isPending ? (
                <RefreshCw size={14} className="animate-spin mr-1.5" />
              ) : (
                <CreditCard size={14} className="mr-1.5" />
              )}
              충전 요청 접수
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 파트너 전용 tRPC Provider로 감싸서 export ─────────────────
export default function PartnerCreditPage() {
  const queryClient = useMemo(() => createPartnerQueryClient(), []);
  const trpcClient = useMemo(() => createPartnerTrpcClient(), []);

  return (
    <partnerTrpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <CreditPageContent />
      </QueryClientProvider>
    </partnerTrpc.Provider>
  );
}
