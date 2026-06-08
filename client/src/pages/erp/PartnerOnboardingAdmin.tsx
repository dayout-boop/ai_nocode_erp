/**
 * ERP 관리자 - 파트너 온보딩 신청 관리 페이지
 * 신청 목록 조회, 상태 변경, 업종 불일치 플래그, 빠른 승인/거부
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
  Building2, Mail, Phone, FileText, Loader2, ExternalLink,
  AlertTriangle, ShieldCheck, ShieldX, Ban, RotateCcw
} from "lucide-react";

// ─── 상태 배지 ───────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "대기", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  reviewing: { label: "검토중", color: "bg-blue-100 text-blue-700 border-blue-200" },
  approved: { label: "승인", color: "bg-green-100 text-green-700 border-green-200" },
  rejected: { label: "거절", color: "bg-red-100 text-red-700 border-red-200" },
  active: { label: "활성", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const PLAN_LABELS: Record<string, string> = { starter: "스타터", standard: "스탠다드", premium: "프리미엄" };
const SAMPLE_LABELS: Record<string, string> = {
  golf_tour_domestic: "국내 골프투어",
  golf_tour_overseas: "해외 골프투어",
  golf_tour_mixed: "국내+해외 혼합",
};

type StatusFilter = "pending" | "reviewing" | "approved" | "rejected" | "active" | "all";

// 업종 불일치 플래그 감지
function hasIndustryFlag(adminNote?: string | null): boolean {
  return !!(adminNote && adminNote.includes("⚠️ 업종 불일치"));
}

export default function PartnerOnboardingAdmin() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"onboarding" | "partners">("onboarding");

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

  // 빠른 승인
  const handleQuickApprove = (id: number, note?: string) => {
    updateStatusMutation.mutate({
      id,
      status: "approved",
      adminNote: note ?? "관리자 수동 승인",
    });
  };

  // 빠른 거부
  const handleQuickReject = (id: number, reason: string) => {
    updateStatusMutation.mutate({
      id,
      status: "rejected",
      adminNote: reason,
    });
  };

  // 통계 계산
  const stats = {
    total: items?.length ?? 0,
    pending: items?.filter((i) => i.status === "pending").length ?? 0,
    reviewing: items?.filter((i) => i.status === "reviewing").length ?? 0,
    approved: items?.filter((i) => i.status === "approved" || i.status === "active").length ?? 0,
    flagged: items?.filter((i) => hasIndustryFlag(i.adminNote)).length ?? 0,
  };

  // 검토 필요 항목 (reviewing + 업종 불일치 플래그)
  const needsReview = items?.filter(
    (i) => i.status === "reviewing" || hasIndustryFlag(i.adminNote)
  ) ?? [];

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "전체 신청", value: stats.total, icon: <Users size={16} />, color: "text-gray-600", bg: "bg-gray-50", onClick: () => setStatusFilter("all") },
          { label: "대기 중", value: stats.pending, icon: <Clock size={16} />, color: "text-yellow-600", bg: "bg-yellow-50", onClick: () => setStatusFilter("pending") },
          { label: "검토 중", value: stats.reviewing, icon: <Eye size={16} />, color: "text-blue-600", bg: "bg-blue-50", onClick: () => setStatusFilter("reviewing") },
          { label: "승인 완료", value: stats.approved, icon: <CheckCircle2 size={16} />, color: "text-green-600", bg: "bg-green-50", onClick: () => setStatusFilter("approved") },
          { label: "⚠️ 업종 플래그", value: stats.flagged, icon: <AlertTriangle size={16} />, color: "text-orange-600", bg: "bg-orange-50", onClick: () => setStatusFilter("all") },
        ].map((stat) => (
          <Card
            key={stat.label}
            className={`shadow-sm cursor-pointer hover:shadow-md transition-shadow ${stat.bg}`}
            onClick={stat.onClick}
          >
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
                <div className={stat.color}>{stat.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 검토 필요 알림 배너 */}
      {needsReview.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-800">
              검토가 필요한 신청 {needsReview.length}건
            </p>
            <p className="text-xs text-orange-600 mt-0.5">
              업종 불일치 플래그 또는 수동 검토 요청 건입니다. 아래 목록에서 확인 후 승인/거부 처리해주세요.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-100 flex-shrink-0"
            onClick={() => setStatusFilter("reviewing")}
          >
            검토 목록 보기
          </Button>
        </div>
      )}

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
                  <TableHead>업종</TableHead>
                  <TableHead>플랜</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>신청일</TableHead>
                  <TableHead className="w-28">빠른 처리</TableHead>
                  <TableHead className="w-12">상세</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const sc = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
                  const flagged = hasIndustryFlag(item.adminNote);
                  return (
                    <TableRow
                      key={item.id}
                      className={`hover:bg-gray-50 ${flagged ? "bg-orange-50/50" : ""}`}
                    >
                      <TableCell className="text-xs text-muted-foreground">{item.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">{item.companyName}</span>
                          {flagged && (
                            <span title="업종 불일치 플래그">
                              <AlertTriangle size={13} className="text-orange-500" />
                            </span>
                          )}
                        </div>
                        {item.businessNumber && (
                          <div className="text-xs text-muted-foreground">{item.businessNumber}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{item.contactName}</div>
                        <div className="text-xs text-muted-foreground">{item.contactEmail}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground max-w-[100px] truncate">
                          {(item as any).businessType ?? "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium">
                          {PLAN_LABELS[item.subscriptionPlan ?? "starter"]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs border ${sc.color}`}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ko-KR") : "-"}
                      </TableCell>
                      <TableCell>
                        {(item.status === "reviewing" || item.status === "pending") && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
                              onClick={() => handleQuickApprove(item.id)}
                              disabled={updateStatusMutation.isPending}
                              title="승인"
                            >
                              <ShieldCheck size={12} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs border-red-300 text-red-600 hover:bg-red-50"
                              onClick={() => {
                                const reason = prompt("거부 사유를 입력하세요:");
                                if (reason) handleQuickReject(item.id, reason);
                              }}
                              disabled={updateStatusMutation.isPending}
                              title="거부"
                            >
                              <ShieldX size={12} />
                            </Button>
                          </div>
                        )}
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
              {/* 업종 불일치 플래그 경고 */}
              {hasIndustryFlag(detail.adminNote) && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-orange-800">업종 불일치 자동 플래그</p>
                    <p className="text-xs text-orange-600 mt-0.5">
                      사업자등록증의 업태/종목에서 여행/관광 관련 키워드가 확인되지 않았습니다.
                      업체 정보를 확인 후 승인 또는 거부 처리해주세요.
                    </p>
                    <p className="text-xs text-orange-500 mt-1 font-medium">
                      업태: {detail.businessType ?? "-"} / 종목: {detail.businessItem ?? "-"}
                    </p>
                  </div>
                </div>
              )}

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
                  <span className="text-xs">{detail.contactEmail}</span>
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
                  <Badge className={`text-xs border ${STATUS_CONFIG[detail.status]?.color ?? ""}`}>
                    {STATUS_CONFIG[detail.status]?.label ?? detail.status}
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
                    className="max-h-48 rounded-lg border object-contain cursor-pointer hover:opacity-90"
                    onClick={() => window.open(detail.businessLicenseUrl!, "_blank")}
                  />
                </div>
              )}

              {/* 관광사업자등록증 이미지 */}
              {(detail as any).tourismLicenseUrl && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <FileText size={12} /> 관광사업자등록증
                  </p>
                  <img
                    src={(detail as any).tourismLicenseUrl}
                    alt="관광사업자등록증"
                    className="max-h-48 rounded-lg border object-contain cursor-pointer hover:opacity-90"
                    onClick={() => window.open((detail as any).tourismLicenseUrl, "_blank")}
                  />
                  {(detail as any).tourismLicenseType && (
                    <p className="text-xs text-muted-foreground mt-1">
                      업종: {(detail as any).tourismLicenseType} | 등록번호: {(detail as any).tourismLicenseNo ?? "-"}
                    </p>
                  )}
                </div>
              )}

              {/* 관리자 메모 표시 */}
              {detail.adminNote && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground mb-1">관리자 메모</p>
                  <p className="text-sm bg-gray-50 rounded-lg p-2 text-gray-700">{detail.adminNote}</p>
                </div>
              )}

              {/* 상태 변경 */}
              <div className="border-t pt-3 space-y-3">
                <p className="text-sm font-semibold">상태 변경</p>

                {/* 빠른 처리 버튼 (reviewing/pending 상태에서만 표시) */}
                {(detail.status === "reviewing" || detail.status === "pending") && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setNewStatus("approved");
                        setAdminNote("관리자 수동 검토 후 승인");
                      }}
                    >
                      <ShieldCheck size={14} className="mr-1" /> 승인 처리
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setNewStatus("rejected");
                        setAdminNote("업종 불일치 - 여행/관광업 관련 사업자가 아닌 것으로 판단");
                      }}
                    >
                      <ShieldX size={14} className="mr-1" /> 거부 처리
                    </Button>
                  </div>
                )}

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
