import { useState } from "react";
import ERPLayout from "@/components/ERPLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Calendar, Eye } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "대기", color: "bg-amber-100 text-amber-700" },
  confirmed: { label: "확정", color: "bg-green-100 text-green-700" },
  cancelled: { label: "취소", color: "bg-red-100 text-red-700" },
  completed: { label: "완료", color: "bg-slate-100 text-slate-700" },
};

const PAYMENT_MAP: Record<string, { label: string; color: string }> = {
  unpaid: { label: "미결제", color: "bg-red-50 text-red-600" },
  partial: { label: "부분결제", color: "bg-amber-50 text-amber-600" },
  paid: { label: "완납", color: "bg-green-50 text-green-700" },
  refunded: { label: "환불", color: "bg-slate-50 text-slate-600" },
};

function BookingDetailDialog({ bookingId, onClose }: { bookingId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.bookings.get.useQuery({ id: bookingId });
  const [newStatus, setNewStatus] = useState("");
  const [adminMemo, setAdminMemo] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const updateMutation = trpc.bookings.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("예약 상태가 변경되었습니다.");
      utils.bookings.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return null;
  if (!data) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>예약 상세 - {data.bookingNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-lg p-4">
            <div>
              <p className="text-xs text-slate-500">예약자</p>
              <p className="font-medium text-slate-800">{data.leaderName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">연락처</p>
              <p className="font-medium text-slate-800">{data.leaderPhone}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">이메일</p>
              <p className="font-medium text-slate-800">{data.leaderEmail || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">인원</p>
              <p className="font-medium text-slate-800">성인 {data.adultCount}명 / 아동 {data.childCount}명</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">패키지</p>
              <p className="font-medium text-slate-800">{(data as any).package?.title || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">출발일</p>
              <p className="font-medium text-slate-800">
                {data.departureDate ? new Date(data.departureDate).toLocaleDateString("ko-KR") : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">라운딩</p>
              <p className="font-medium text-slate-800">{data.roundCount}회 / 카트:{data.cartIncluded ? "포함" : "미포함"} / 캐디:{data.caddieIncluded ? "포함" : "미포함"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">결제 금액</p>
              <p className="font-medium text-slate-800">{Number(data.totalAmount).toLocaleString()}원</p>
            </div>
          </div>

          {/* 고객 메모 */}
          {data.customerMemo && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-medium mb-1">고객 요청사항</p>
              <p className="text-sm text-slate-700">{data.customerMemo}</p>
            </div>
          )}

          {/* 상태 변경 */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="font-medium text-slate-700 text-sm">상태 변경</p>
            <div className="flex gap-2 flex-wrap">
              {["pending", "confirmed", "cancelled", "completed"].map((s) => (
                <Button
                  key={s}
                  variant={newStatus === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNewStatus(s)}
                  className={newStatus === s ? "bg-indigo-600 text-white" : ""}
                >
                  {STATUS_MAP[s].label}
                </Button>
              ))}
            </div>
            {newStatus === "cancelled" && (
              <div>
                <Label>취소 사유</Label>
                <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="취소 사유를 입력하세요" className="mt-1" />
              </div>
            )}
            <div>
              <Label>관리자 메모</Label>
              <Textarea
                value={adminMemo}
                onChange={(e) => setAdminMemo(e.target.value)}
                placeholder="내부 메모 (고객에게 표시되지 않음)"
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
          <Button
            onClick={() => updateMutation.mutate({
              id: bookingId,
              status: newStatus as any || data.status,
              adminMemo: adminMemo || undefined,
              cancelReason: cancelReason || undefined,
            })}
            disabled={updateMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BookingsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading } = trpc.bookings.list.useQuery({
    page,
    limit: 15,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  return (
    <ERPLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">예약관리</h1>
          <p className="text-slate-500 text-sm mt-1">예약 현황을 실시간으로 관리합니다</p>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="예약자명 검색..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="pending">대기</SelectItem>
                  <SelectItem value="confirmed">확정</SelectItem>
                  <SelectItem value="cancelled">취소</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-20 text-center text-slate-400">로딩 중...</div>
            ) : !data?.items?.length ? (
              <div className="py-20 text-center">
                <Calendar size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400">예약 내역이 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">예약번호</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">예약자</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">연락처</th>
                      <th className="text-center px-4 py-3 text-slate-500 font-medium">인원</th>
                      <th className="text-right px-4 py-3 text-slate-500 font-medium">금액</th>
                      <th className="text-center px-4 py-3 text-slate-500 font-medium">예약상태</th>
                      <th className="text-center px-4 py-3 text-slate-500 font-medium">결제상태</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">예약일</th>
                      <th className="text-right px-5 py-3 text-slate-500 font-medium">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.items.map((booking: any) => (
                      <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-mono text-xs text-slate-600">{booking.bookingNumber}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{booking.leaderName}</td>
                        <td className="px-4 py-3 text-slate-600">{booking.leaderPhone}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{booking.totalPeople}명</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {Number(booking.totalAmount).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`text-xs ${STATUS_MAP[booking.status]?.color}`}>
                            {STATUS_MAP[booking.status]?.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`text-xs ${PAYMENT_MAP[booking.paymentStatus || "unpaid"]?.color}`}>
                            {PAYMENT_MAP[booking.paymentStatus || "unpaid"]?.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(booking.createdAt).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600"
                            onClick={() => setSelectedId(booking.id)}
                          >
                            <Eye size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {data && data.total > 15 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">총 {data.total}건</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>이전</Button>
              <span className="text-sm text-slate-600 px-3 py-1.5">{page} / {Math.ceil(data.total / 15)}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(data.total / 15)}>다음</Button>
            </div>
          </div>
        )}
      </div>

      {selectedId && (
        <BookingDetailDialog bookingId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </ERPLayout>
  );
}
