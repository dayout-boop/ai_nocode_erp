/**
 * ERP 관리자 - 파트너 온보딩 신청 관리 페이지
 * 신청 목록 조회, 상태 변경, 상세 정보 확인
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Users, Clock, CheckCircle2, XCircle, Eye, RefreshCw,
  Building2, Mail, Phone, FileText, Loader2, ExternalLink
} from "lucide-react";

// ─── 상태 배지 ───────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending: { label: "대기", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  reviewing: { label: "검토중", color: "bg-blue-100 text-blue-700 border-blue-200" },
  approved: { label: "승인", color: "bg-green-100 text-green-700 border-green-200" },
  rejected: { label: "거절", color: "bg-red-100 text-red-700 border-red-200" },
  active: { label: "활성", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const PLAN_LABELS = { starter: "스타터", standard: "스탠다드", premium: "프리미엄" };
const SAMPLE_LABELS = {
  golf_tour_domestic: "국내 골프투어",
  golf_tour_overseas: "해외 골프투어",
  golf_tour_mixed: "국내+해외 혼합",
};

type StatusFilter = "pending" | "reviewing" | "approved" | "rejected" | "active" | "all";

export default function PartnerOnboardingAdmin() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");

  const { data: items, isLoading, refetch } = trpc.partnerOnboarding.list.useQuery({
    status: statusFilter,
    limit: 100,
    offset: 0,
  });

  const { data: detail, isLoading: detailLoading } = trpc.partnerOnboarding.get.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId }
  );

  const updateStatusMutation = trpc.partnerOnboarding.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("상태가 변경되었습니다.");
      setSelectedId(null);
      refetch();
    },
    onError: (err) => toast.error(`변경 실패: ${err.message}`),
  });

  const handleUpdateStatus = () => {
    if (!selectedId || !newStatus) return;
    updateStatusMutation.mutate({
      id: selectedId,
      status: newStatus as "pending" | "reviewing" | "approved" | "rejected" | "active",
      adminNote: adminNote || undefined,
    });
  };

  // 통계 계산
  const stats = {
    total: items?.length ?? 0,
    pending: items?.filter((i) => i.status === "pending").length ?? 0,
    reviewing: items?.filter((i) => i.status === "reviewing").length ?? 0,
    approved: items?.filter((i) => i.status === "approved" || i.status === "active").length ?? 0,
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">파트너 온보딩 관리</h1>
          <p className="text-muted-foreground text-sm mt-1">신규 파트너 가입 신청을 검토하고 승인합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} className="mr-1" /> 새로고침
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => window.open("/partner/join", "_blank")}
          >
            <ExternalLink size={14} className="mr-1" /> 신청 페이지
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "전체 신청", value: stats.total, icon: <Users size={18} />, color: "text-gray-600" },
          { label: "대기 중", value: stats.pending, icon: <Clock size={18} />, color: "text-yellow-600" },
          { label: "검토 중", value: stats.reviewing, icon: <Eye size={18} />, color: "text-blue-600" },
          { label: "승인 완료", value: stats.approved, icon: <CheckCircle2 size={18} />, color: "text-green-600" },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
                <div className={stat.color}>{stat.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 필터 + 테이블 */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">신청 목록</CardTitle>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="pending">대기</SelectItem>
                <SelectItem value="reviewing">검토중</SelectItem>
                <SelectItem value="approved">승인</SelectItem>
                <SelectItem value="rejected">거절</SelectItem>
                <SelectItem value="active">활성</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : !items || items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">신청 내역이 없습니다.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>업체명</TableHead>
                  <TableHead>담당자</TableHead>
                  <TableHead>플랜</TableHead>
                  <TableHead>샘플</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>신청일</TableHead>
                  <TableHead className="w-16">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const sc = STATUS_CONFIG[item.status];
                  return (
                    <TableRow key={item.id} className="hover:bg-gray-50">
                      <TableCell className="text-xs text-muted-foreground">{item.id}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{item.companyName}</div>
                        {item.businessNumber && (
                          <div className="text-xs text-muted-foreground">{item.businessNumber}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{item.contactName}</div>
                        <div className="text-xs text-muted-foreground">{item.contactEmail}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium">
                          {PLAN_LABELS[item.subscriptionPlan ?? "starter"]}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          {item.billingCycle === "yearly" ? "/년" : "/월"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">
                          {SAMPLE_LABELS[item.sampleCategory ?? "golf_tour_mixed"]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs border ${sc.color}`}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ko-KR") : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setSelectedId(item.id);
                            setNewStatus(item.status);
                            setAdminNote(item.adminNote ?? "");
                          }}
                        >
                          <Eye size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 상세 다이얼로그 */}
      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 size={18} className="text-green-600" />
              파트너 신청 상세
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">업체명</p>
                  <p className="font-semibold">{detail.companyName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">사업자등록번호</p>
                  <p className="font-medium">{detail.businessNumber ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">대표자</p>
                  <p className="font-medium">{detail.ceoName ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">업태/종목</p>
                  <p className="font-medium">{detail.businessType ?? "-"} / {detail.businessItem ?? "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">주소</p>
                  <p className="font-medium">{detail.address ?? "-"}</p>
                </div>
              </div>

              {/* 담당자 */}
              <div className="border-t pt-3 grid grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <Users size={12} className="text-muted-foreground" />
                  <span className="font-medium">{detail.contactName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Mail size={12} className="text-muted-foreground" />
                  <span>{detail.contactEmail}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Phone size={12} className="text-muted-foreground" />
                  <span>{detail.contactPhone ?? "-"}</span>
                </div>
              </div>

              {/* 선택 정보 */}
              <div className="border-t pt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">구독 플랜</p>
                  <p className="font-semibold text-green-700">
                    {PLAN_LABELS[detail.subscriptionPlan ?? "starter"]}
                    <span className="text-xs text-muted-foreground ml-1">
                      {detail.billingCycle === "yearly" ? "(연간)" : "(월간)"}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">샘플 데이터</p>
                  <p className="font-medium">{SAMPLE_LABELS[detail.sampleCategory ?? "golf_tour_mixed"]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">현재 상태</p>
                  <Badge className={`text-xs border ${STATUS_CONFIG[detail.status].color}`}>
                    {STATUS_CONFIG[detail.status].label}
                  </Badge>
                </div>
              </div>

              {/* 사업자등록증 이미지 */}
              {detail.businessLicenseUrl && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <FileText size={12} /> 사업자등록증
                  </p>
                  <img
                    src={detail.businessLicenseUrl}
                    alt="사업자등록증"
                    className="max-h-48 rounded-lg border object-contain"
                  />
                </div>
              )}

              {/* 상태 변경 */}
              <div className="border-t pt-3 space-y-3">
                <p className="text-sm font-semibold">상태 변경</p>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="상태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">대기</SelectItem>
                      <SelectItem value="reviewing">검토중</SelectItem>
                      <SelectItem value="approved">승인</SelectItem>
                      <SelectItem value="rejected">거절</SelectItem>
                      <SelectItem value="active">활성</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder="관리자 메모 (선택 사항)"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedId(null)}>
              닫기
            </Button>
            <Button
              onClick={handleUpdateStatus}
              disabled={updateStatusMutation.isPending || !newStatus}
              className="bg-green-600 hover:bg-green-700"
            >
              {updateStatusMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin mr-1" /> 저장 중...</>
              ) : (
                <>
                  <CheckCircle2 size={14} className="mr-1" /> 상태 저장
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
