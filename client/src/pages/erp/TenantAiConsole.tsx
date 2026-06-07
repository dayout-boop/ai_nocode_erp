/**
 * TenantAiConsole.tsx
 * 마스터/관리자용 분양 업체 AI 크레딧 통합 관리 콘솔
 *
 * 기능:
 * - 전체 업체 AI 크레딧 현황 (잔액, 이번달 사용량, 한도)
 * - 업체별 크레딧 충전 (관리자)
 * - 크레딧 이력 조회
 * - 외부 API 연결 현황
 * - 개발 요청 승인 플로우
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Zap, CreditCard, Activity, Link2, CheckCircle2, XCircle,
  Clock, AlertTriangle, RefreshCw, Plus, ChevronRight
} from "lucide-react";

// 충전 패키지
const CREDIT_PACKAGES = [
  { credits: 50, priceKrw: 50_000, label: "50 크레딧" },
  { credits: 100, priceKrw: 100_000, label: "100 크레딧" },
  { credits: 200, priceKrw: 200_000, label: "200 크레딧" },
];

const FEASIBILITY_LABELS: Record<string, { label: string; color: string }> = {
  possible: { label: "개발 가능", color: "bg-green-100 text-green-700" },
  conditional: { label: "조건부 가능", color: "bg-yellow-100 text-yellow-700" },
  impossible: { label: "개발 불가", color: "bg-red-100 text-red-700" },
  global: { label: "전체 공통 개선", color: "bg-blue-100 text-blue-700" },
};

const APPROVAL_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "검토 대기", color: "bg-gray-100 text-gray-700" },
  approved: { label: "승인", color: "bg-green-100 text-green-700" },
  rejected: { label: "거부", color: "bg-red-100 text-red-700" },
  in_progress: { label: "개발 중", color: "bg-blue-100 text-blue-700" },
  completed: { label: "완료", color: "bg-purple-100 text-purple-700" },
};

export default function TenantAiConsole() {
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [chargeDialog, setChargeDialog] = useState(false);
  const [chargeCredits, setChargeCredits] = useState(50);
  const [chargeMemo, setChargeMemo] = useState("");
  const [approvalDialog, setApprovalDialog] = useState<{
    id: number; title: string; currentStatus: string
  } | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string>("approved");
  const [approvalMemo, setApprovalMemo] = useState("");

  // 충전 요청 관련 상태
  const [creditRequestDialog, setCreditRequestDialog] = useState<{
    id: number; tenantId: number; companyName: string; credits: number; amountKrw: number; depositorName: string; depositMemo?: string;
  } | null>(null);
  const [creditRequestNote, setCreditRequestNote] = useState("");
  const [creditRequestAction, setCreditRequestAction] = useState<"approved" | "rejected">("approved");

  // 전체 업체 크레딧 현황
  const { data: allTenantsCredit, refetch: refetchAll } = trpc.tenantAi.getAllTenantsCredit.useQuery();

  // 선택된 업체 상세 정보
  const { data: creditInfo, refetch: refetchDetail } = trpc.tenantAi.getCreditInfo.useQuery(
    { tenantId: selectedTenantId! },
    { enabled: !!selectedTenantId }
  );

  // 크레딧 이력
  const { data: creditHistory } = trpc.tenantAi.getCreditHistory.useQuery(
    { tenantId: selectedTenantId!, limit: 20 },
    { enabled: !!selectedTenantId }
  );

  // 외부 API 연결 목록
  const { data: apiConnections } = trpc.tenantAi.listApiConnections.useQuery(
    { tenantId: selectedTenantId! },
    { enabled: !!selectedTenantId }
  );

  // 개발 요청 목록 (전체)
  const { data: devRequests, refetch: refetchDevRequests } = trpc.tenantAi.listApiDevRequests.useQuery({
    tenantId: selectedTenantId ?? undefined,
    approvalStatus: undefined,
    limit: 50,
  });

  // 크레딧 충전 뮤테이션
  const chargeMutation = trpc.tenantAi.chargeCredits.useMutation({
    onSuccess: (data) => {
      toast.success(`충전 완료! 잔액: ${data.newBalance} 크레딧`);
      setChargeDialog(false);
      refetchAll();
      refetchDetail();
    },
    onError: (err) => toast.error(`충전 실패: ${err.message}`),
  });

  // 개발 요청 승인/거부 뮤테이션
  const approveMutation = trpc.tenantAi.approveApiDevRequest.useMutation({
    onSuccess: () => {
      toast.success("처리 완료");
      setApprovalDialog(null);
      refetchDevRequests();
    },
    onError: (err) => toast.error(`처리 실패: ${err.message}`),
  });

  const handleCharge = () => {
    if (!selectedTenantId) return;
    const pkg = CREDIT_PACKAGES.find((p) => p.credits === chargeCredits);
    chargeMutation.mutate({
      tenantId: selectedTenantId,
      credits: chargeCredits,
      paidAmountKrw: pkg?.priceKrw,
      memo: chargeMemo || undefined,
    });
  };

  const handleApprove = () => {
    if (!approvalDialog) return;
    approveMutation.mutate({
      id: approvalDialog.id,
      approvalStatus: approvalStatus as "approved" | "rejected" | "in_progress" | "completed",
      approvalMemo: approvalMemo || undefined,
    });
  };

  // 충전 요청 목록 (관리자 - 전체)
  const { data: creditRequests, refetch: refetchCreditRequests } = trpc.tenantAi.getAllCreditRequests.useQuery({
    status: "all",
    limit: 50,
    offset: 0,
  });

  // 충전 요청 승인 뮤테이션
  const approveCreditRequestMutation = trpc.tenantAi.approveCreditRequest.useMutation({
    onSuccess: () => {
      toast.success("크레딧 충전 승인 완료! 크레딧이 지급되었습니다.");
      setCreditRequestDialog(null);
      setCreditRequestNote("");
      refetchCreditRequests();
      refetchAll();
    },
    onError: (err: { message: string }) => toast.error(`처리 실패: ${err.message}`),
  });

  // 충전 요청 거부 뮤테이션
  const rejectCreditRequestMutation = trpc.tenantAi.rejectCreditRequest.useMutation({
    onSuccess: () => {
      toast.success("충전 요청이 거부되었습니다.");
      setCreditRequestDialog(null);
      setCreditRequestNote("");
      refetchCreditRequests();
    },
    onError: (err: { message: string }) => toast.error(`처리 실패: ${err.message}`),
  });

  const handleProcessCreditRequest = () => {
    if (!creditRequestDialog) return;
    if (creditRequestAction === "approved") {
      approveCreditRequestMutation.mutate({
        requestId: creditRequestDialog.id,
        adminNote: creditRequestNote || undefined,
      });
    } else {
      rejectCreditRequestMutation.mutate({
        requestId: creditRequestDialog.id,
        adminNote: creditRequestNote || "입금 미확인으로 거부",
      });
    }
  };

  // 대기 중인 개발 요청 수
  const pendingCount = devRequests?.filter((r: { approvalStatus: string }) => r.approvalStatus === "pending").length ?? 0;
  const pendingCreditCount = creditRequests?.filter((r: { status: string }) => r.status === "pending").length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">분양 업체 AI 콘솔</h1>
          <p className="text-sm text-gray-500 mt-1">업체별 AI 크레딧 관리 · 외부 API 연결 · 개발 요청 승인</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchAll(); refetchDevRequests(); }}>
          <RefreshCw className="w-4 h-4 mr-2" /> 새로고침
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">전체 현황</TabsTrigger>
          <TabsTrigger value="detail" disabled={!selectedTenantId}>
            업체 상세 {selectedTenantId ? `(#${selectedTenantId})` : ""}
          </TabsTrigger>
          <TabsTrigger value="devRequests">
            개발 요청
            {pendingCount > 0 && (
              <Badge className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="creditRequests">
            충전 요청
            {pendingCreditCount > 0 && (
              <Badge className="ml-2 bg-orange-500 text-white text-xs px-1.5 py-0.5">{pendingCreditCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── 전체 현황 탭 ─── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {!allTenantsCredit ? (
            <div className="text-center py-12 text-gray-400">로딩 중...</div>
          ) : allTenantsCredit.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>등록된 분양 업체가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {allTenantsCredit.map((tenant) => {
                const usagePercent = tenant.aiCreditsMonthlyLimit > 0
                  ? Math.round((tenant.aiCreditsUsedThisMonth / tenant.aiCreditsMonthlyLimit) * 100)
                  : 0;
                const isLow = tenant.aiCreditsBalance <= Math.ceil(tenant.aiCreditsMonthlyLimit * 0.1);

                return (
                  <Card
                    key={tenant.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow border ${
                      selectedTenantId === tenant.id ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
                    }`}
                    onClick={() => setSelectedTenantId(tenant.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold text-gray-800">
                          {tenant.companyName}
                        </CardTitle>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">{tenant.subscriptionPlan}</Badge>
                          {isLow && (
                            <Badge className="bg-red-100 text-red-600 text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />잔액 부족
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">잔액</span>
                        <span className={`font-bold text-lg ${isLow ? "text-red-600" : "text-gray-900"}`}>
                          {tenant.aiCreditsBalance} 크레딧
                        </span>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>이번달 사용량</span>
                          <span>{tenant.aiCreditsUsedThisMonth} / {tenant.aiCreditsMonthlyLimit}</span>
                        </div>
                        <Progress
                          value={Math.min(usagePercent, 100)}
                          className={`h-2 ${usagePercent >= 90 ? "[&>div]:bg-red-500" : usagePercent >= 70 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500"}`}
                        />
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-xs text-gray-400">사용률 {usagePercent}%</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTenantId(tenant.id);
                            setChargeDialog(true);
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" /> 충전
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── 업체 상세 탭 ─── */}
        <TabsContent value="detail" className="space-y-4 mt-4">
          {selectedTenantId && creditInfo && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xs text-gray-500">크레딧 잔액</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{creditInfo.aiCreditsBalance}</div>
                    <div className="text-xs text-gray-400">크레딧</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xs text-gray-500">이번달 사용</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{creditInfo.aiCreditsUsedThisMonth}</div>
                    <div className="text-xs text-gray-400">/ {creditInfo.aiCreditsMonthlyLimit} 한도</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xs text-gray-500">사용률</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{creditInfo.usagePercent}%</div>
                    <Progress value={Math.min(creditInfo.usagePercent, 100)} className="h-1.5 mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xs text-gray-500">플랜</div>
                    <div className="text-lg font-bold text-gray-900 mt-1 capitalize">{creditInfo.subscriptionPlan}</div>
                    <Button
                      size="sm"
                      className="mt-2 h-7 text-xs w-full"
                      onClick={() => setChargeDialog(true)}
                    >
                      <Plus className="w-3 h-3 mr-1" /> 크레딧 충전
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* 크레딧 이력 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">크레딧 이력</CardTitle>
                </CardHeader>
                <CardContent>
                  {!creditHistory || creditHistory.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">이력이 없습니다.</div>
                  ) : (
                    <div className="space-y-2">
                      {creditHistory.map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              item.type === "charge" ? "bg-green-100 text-green-700" :
                              item.type === "deduct" ? "bg-red-100 text-red-700" :
                              item.type === "refund" ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {item.type === "charge" ? "+" : item.type === "deduct" ? "-" : item.type === "refund" ? "↩" : "↺"}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-800">{item.memo ?? item.type}</div>
                              <div className="text-xs text-gray-400">
                                {new Date(item.createdAt).toLocaleString("ko-KR")}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-bold ${item.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {item.amount >= 0 ? "+" : ""}{item.amount} 크레딧
                            </div>
                            <div className="text-xs text-gray-400">잔액 {item.balanceAfter}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 외부 API 연결 현황 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Link2 className="w-4 h-4" /> 외부 API 연결 현황
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!apiConnections || apiConnections.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">연결된 외부 API가 없습니다.</div>
                  ) : (
                    <div className="space-y-3">
                      {apiConnections.map((conn) => (
                        <div key={conn.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-gray-800">{conn.serviceLabel ?? conn.serviceName}</span>
                              <Badge className={`text-xs ${
                                conn.status === "active" ? "bg-green-100 text-green-700" :
                                conn.status === "error" ? "bg-red-100 text-red-700" :
                                conn.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                                "bg-gray-100 text-gray-700"
                              }`}>
                                {conn.status}
                              </Badge>
                            </div>
                            {conn.aiAnalysisMemo && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{conn.aiAnalysisMemo}</p>
                            )}
                            {conn.apiKeyMasked && (
                              <div className="text-xs text-gray-400 mt-1 font-mono">키: {conn.apiKeyMasked}</div>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                            {new Date(conn.createdAt).toLocaleDateString("ko-KR")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── 개발 요청 탭 ─── */}
        <TabsContent value="devRequests" className="space-y-4 mt-4">
          {!devRequests || devRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>개발 요청이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devRequests.map((req) => {
                const feasibility = FEASIBILITY_LABELS[req.feasibility ?? "possible"];
                const approval = APPROVAL_LABELS[req.approvalStatus];

                return (
                  <Card key={req.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="font-semibold text-gray-900 text-sm">{req.title}</span>
                            <Badge className={`text-xs ${feasibility.color}`}>{feasibility.label}</Badge>
                            <Badge className={`text-xs ${approval.color}`}>{approval.label}</Badge>
                            {req.isGlobalImprovement && (
                              <Badge className="text-xs bg-blue-100 text-blue-700">전체 공통</Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2">{req.requestContent}</p>
                          {req.aiAnalysis && (
                            <p className="text-xs text-blue-600 mt-1 line-clamp-1">AI 분석: {req.aiAnalysis}</p>
                          )}
                          {req.approvalMemo && (
                            <p className="text-xs text-gray-400 mt-1">메모: {req.approvalMemo}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                            <span>업체 #{req.tenantId}</span>
                            <span>{new Date(req.createdAt).toLocaleDateString("ko-KR")}</span>
                            {req.notifiedTenant && (
                              <span className="text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> 업체 안내 완료
                              </span>
                            )}
                          </div>
                        </div>
                        {req.approvalStatus === "pending" && (
                          <Button
                            size="sm"
                            className="shrink-0 h-8 text-xs"
                            onClick={() => {
                              setApprovalDialog({ id: req.id, title: req.title, currentStatus: req.approvalStatus });
                              setApprovalStatus("approved");
                              setApprovalMemo("");
                            }}
                          >
                            검토 <ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                        {req.approvalStatus === "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 h-8 text-xs"
                            onClick={() => {
                              setApprovalDialog({ id: req.id, title: req.title, currentStatus: req.approvalStatus });
                              setApprovalStatus("in_progress");
                              setApprovalMemo("");
                            }}
                          >
                            진행 처리
                          </Button>
                        )}
                        {req.approvalStatus === "in_progress" && (
                          <Button
                            size="sm"
                            className="shrink-0 h-8 text-xs bg-purple-600 hover:bg-purple-700"
                            onClick={() => {
                              setApprovalDialog({ id: req.id, title: req.title, currentStatus: req.approvalStatus });
                              setApprovalStatus("completed");
                              setApprovalMemo("");
                            }}
                          >
                            완료 처리
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        {/* ─── 충전 요청 탭 ─── */}
        <TabsContent value="creditRequests" className="space-y-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">파트너사에서 요청한 크레딧 충전 요청 목록입니다. 입금 확인 후 승인하면 자동으로 크레딧이 지급됩니다.</p>
            <Button variant="outline" size="sm" onClick={() => refetchCreditRequests()}>
              <RefreshCw className="w-3 h-3 mr-1" /> 새로고침
            </Button>
          </div>
          {!creditRequests || creditRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>충전 요청이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {creditRequests.map((req: { id: number; tenantId: number; companyName: string | null; credits: number; amountKrw: number | null; depositorName: string | null; depositMemo: string | null; adminNote: string | null; status: string; requestType: string; processedAt: Date | null; createdAt: Date; }) => (
                <Card key={req.id} className={`hover:shadow-sm transition-shadow ${
                  req.status === "pending" ? "border-orange-200 bg-orange-50/30" : ""
                }`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-gray-900 text-sm">{req.companyName}</span>
                          <Badge className={`text-xs ${
                            req.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                            req.status === "approved" ? "bg-green-100 text-green-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {req.status === "pending" ? "검토 중" : req.status === "approved" ? "승인됨" : "거부됨"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{req.requestType === "manual" ? "수동입금" : "PG결제"}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-bold text-green-700">{req.credits} 크레딧</span>
                          <span className="text-gray-600">{(req.amountKrw ?? 0).toLocaleString()}원</span>
                          {req.depositorName && (
                            <span className="text-gray-500">입금자: <span className="font-medium">{req.depositorName}</span></span>
                          )}
                        </div>
                        {req.depositMemo && (
                          <p className="text-xs text-gray-400 mt-1">메모: {req.depositMemo}</p>
                        )}
                        {req.adminNote && (
                          <p className="text-xs text-blue-600 mt-1">관리자 메모: {req.adminNote}</p>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(req.createdAt).toLocaleString("ko-KR")}
                          {req.processedAt && ` · 처리: ${new Date(req.processedAt).toLocaleString("ko-KR")}`}
                        </div>
                      </div>
                      {req.status === "pending" && (
                        <Button
                          size="sm"
                          className="shrink-0 h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                          onClick={() => {
                            setCreditRequestDialog({
                              id: req.id,
                              tenantId: req.tenantId,
                              companyName: req.companyName ?? "",
                              credits: req.credits,
                              amountKrw: req.amountKrw ?? 0,
                              depositorName: req.depositorName ?? "",
                              depositMemo: req.depositMemo ?? undefined,
                            });
                            setCreditRequestAction("approved");
                            setCreditRequestNote("");
                          }}
                        >
                          입금 확인 <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── 충전 요청 처리 다이얼로그 ─── */}
      <Dialog open={!!creditRequestDialog} onOpenChange={(open) => !open && setCreditRequestDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-500" /> 충전 요청 처리
            </DialogTitle>
          </DialogHeader>
          {creditRequestDialog && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm font-semibold text-gray-800">{creditRequestDialog.companyName}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-lg font-bold text-green-700">{creditRequestDialog.credits} 크레딧</span>
                  <span className="text-sm text-gray-600">{creditRequestDialog.amountKrw.toLocaleString()}원</span>
                </div>
                {creditRequestDialog.depositorName && (
                  <p className="text-xs text-gray-500 mt-1">입금자: {creditRequestDialog.depositorName}</p>
                )}
                {creditRequestDialog.depositMemo && (
                  <p className="text-xs text-gray-400 mt-0.5">메모: {creditRequestDialog.depositMemo}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">처리 결과</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCreditRequestAction("approved")}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      creditRequestAction === "approved"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    ✅ 입금 확인 · 승인
                  </button>
                  <button
                    onClick={() => setCreditRequestAction("rejected")}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      creditRequestAction === "rejected"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    ❌ 입금 미확인 · 거부
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">관리자 메모 (선택)</label>
                <Textarea
                  placeholder="파트너사에게 전달할 메모 (예: 입금 확인됨, 거부 사유 등)"
                  value={creditRequestNote}
                  onChange={(e) => setCreditRequestNote(e.target.value)}
                  className="resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditRequestDialog(null)}>취소</Button>
            <Button
              onClick={handleProcessCreditRequest}
              disabled={approveCreditRequestMutation.isPending || rejectCreditRequestMutation.isPending}
              className={creditRequestAction === "approved" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
            >
              {(approveCreditRequestMutation.isPending || rejectCreditRequestMutation.isPending) ? "처리 중..." : creditRequestAction === "approved" ? "승인 · 크레딧 지급" : "거부"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 크레딧 충전 다이얼로그 ─── */}
      <Dialog open={chargeDialog} onOpenChange={setChargeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> AI 크레딧 충전
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">충전 패키지 선택</label>
              <div className="grid grid-cols-3 gap-2">
                {CREDIT_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.credits}
                    onClick={() => setChargeCredits(pkg.credits)}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      chargeCredits === pkg.credits
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-bold text-lg">{pkg.credits}</div>
                    <div className="text-xs text-gray-500">크레딧</div>
                    <div className="text-xs font-medium mt-1">{(pkg.priceKrw / 10000).toFixed(0)}만원</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">메모 (선택)</label>
              <Input
                placeholder="충전 사유 입력..."
                value={chargeMemo}
                onChange={(e) => setChargeMemo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeDialog(false)}>취소</Button>
            <Button onClick={handleCharge} disabled={chargeMutation.isPending}>
              {chargeMutation.isPending ? "처리 중..." : `${chargeCredits} 크레딧 충전`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 개발 요청 승인 다이얼로그 ─── */}
      <Dialog open={!!approvalDialog} onOpenChange={(open) => !open && setApprovalDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>개발 요청 처리</DialogTitle>
          </DialogHeader>
          {approvalDialog && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-800">{approvalDialog.title}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">처리 상태</label>
                <Select value={approvalStatus} onValueChange={setApprovalStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">승인</SelectItem>
                    <SelectItem value="rejected">거부</SelectItem>
                    <SelectItem value="in_progress">개발 중</SelectItem>
                    <SelectItem value="completed">개발 완료</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">처리 메모</label>
                <Textarea
                  placeholder="승인/거부 사유, 개발 일정 등..."
                  value={approvalMemo}
                  onChange={(e) => setApprovalMemo(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialog(null)}>취소</Button>
            <Button onClick={handleApprove} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? "처리 중..." : "처리 완료"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
