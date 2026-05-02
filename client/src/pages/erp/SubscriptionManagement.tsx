/**
 * ERP 구독 관리 페이지
 * - 파트너 구독 현황 조회
 * - 플랜 변경 / 취소
 * - 결제 이력 조회
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Users,
  TrendingUp,
  Calendar,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  starter: "스타터",
  standard: "스탠다드",
  premium: "프리미엄",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  active: { label: "활성", variant: "default", icon: <CheckCircle2 className="w-3 h-3" /> },
  trial: { label: "체험중", variant: "secondary", icon: <Clock className="w-3 h-3" /> },
  expired: { label: "만료", variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: "취소됨", variant: "outline", icon: <XCircle className="w-3 h-3" /> },
  pending: { label: "대기중", variant: "outline", icon: <AlertCircle className="w-3 h-3" /> },
};

export default function SubscriptionManagement() {
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // 구독 목록 조회
  const { data: subscriptions, isLoading, refetch } = trpc.subscriptions.list.useQuery();

  // 구독 취소 뮤테이션
  const cancelMutation = trpc.subscriptions.cancel.useMutation({
    onSuccess: () => {
      toast.success("구독이 취소되었습니다.");
      setCancelDialogOpen(false);
      setSelectedSub(null);
      refetch();
    },
    onError: (err) => {
      toast.error(`취소 실패: ${err.message}`);
    },
  });

  // 결제 검증 뮤테이션
  const verifyMutation = trpc.subscriptions.verify.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("결제 검증 완료 - 결제가 정상 확인되었습니다.");
      } else {
        toast.error(`결제 검증 실패: ${data.error}`);
      }
      refetch();
    },
    onError: (err) => {
      toast.error(`검증 오류: ${err.message}`);
    },
  });

  // 통계 계산
  const stats = {
    total: subscriptions?.length ?? 0,
    active: subscriptions?.filter((s) => s.status === "active").length ?? 0,
    trial: subscriptions?.filter((s) => s.status === "trial").length ?? 0,
    mrr: subscriptions?.reduce((sum, s) => {
      if (s.status !== "active") return sum;
      const prices: Record<string, number> = { starter: 0, standard: 99000, premium: 299000 };
      return sum + (prices[s.planId] ?? 0);
    }, 0) ?? 0,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">구독 관리</h1>
          <p className="text-gray-500 text-sm mt-1">파트너 구독 현황 및 결제 이력을 관리합니다</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">전체 구독</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">활성 구독</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">체험 중</p>
                <p className="text-2xl font-bold text-gray-900">{stats.trial}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">월 예상 매출</p>
                <p className="text-xl font-bold text-gray-900">
                  ₩{stats.mrr.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 구독 목록 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            구독 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : !subscriptions || subscriptions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>등록된 구독이 없습니다</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>파트너 ID</TableHead>
                  <TableHead>플랜</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>결제 주기</TableHead>
                  <TableHead>시작일</TableHead>
                  <TableHead>만료일</TableHead>
                  <TableHead>포트원 결제 ID</TableHead>
                  <TableHead className="text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => {
                  const statusCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.pending;
                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="font-mono text-xs">{sub.partnerId}</TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {PLAN_LABELS[sub.planId] ?? sub.planId}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusCfg.variant} className="flex items-center gap-1 w-fit">
                          {statusCfg.icon}
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sub.billingCycle === "yearly" ? "연간" : "월간"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {sub.startedAt
                          ? new Date(sub.startedAt).toLocaleDateString("ko-KR")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {sub.expiresAt
                          ? new Date(sub.expiresAt).toLocaleDateString("ko-KR")
                          : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-400 max-w-[120px] truncate">
                        {sub.portonePaymentId ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {sub.portonePaymentId && sub.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                verifyMutation.mutate({
                                  paymentId: sub.portonePaymentId!,
                                  subscriptionId: sub.id,
                                })
                              }
                              disabled={verifyMutation.isPending}
                            >
                              검증
                            </Button>
                          )}
                          {sub.status === "active" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedSub(sub.id);
                                setCancelDialogOpen(true);
                              }}
                            >
                              취소
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 취소 확인 다이얼로그 */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>구독 취소 확인</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">구독을 취소하시겠습니까?</p>
                <p className="text-xs text-red-600 mt-1">
                  취소 후에는 현재 결제 주기 종료 시 서비스가 중단됩니다.
                  포트원을 통한 결제 취소도 함께 처리됩니다.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              닫기
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedSub) {
                  cancelMutation.mutate({ subscriptionId: selectedSub });
                }
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "취소 중..." : "구독 취소"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
