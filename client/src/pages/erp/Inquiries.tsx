import { useState } from "react";
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
import { Search, MessageSquare, DollarSign, Tag, FileText, ArrowDownUp } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "신규", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "처리중", color: "bg-purple-100 text-purple-700" },
  replied: { label: "답변완료", color: "bg-green-100 text-green-700" },
  closed: { label: "종료", color: "bg-slate-100 text-slate-600" },
};

// 입금가/판매가 계산 헬퍼
function calcEstimatePrice(
  basePrice: number,
  type: "deposit" | "sale",
  priceType: "cost" | "affiliate" | "sale",
  isPinMegi: boolean
): number {
  if (isPinMegi) {
    // 핀메기 클릭: 원가-20000, 제휴가-15000, 판매가 동일
    if (priceType === "cost") return basePrice - 20000;
    if (priceType === "affiliate") return basePrice - 15000;
    return basePrice;
  } else {
    // 입금가 클릭: 원가 동일, 제휴가+5000, 판매가+20000
    if (priceType === "cost") return basePrice;
    if (priceType === "affiliate") return basePrice + 5000;
    return basePrice + 20000;
  }
}

function InquiryDetailDialog({ inquiry, onClose }: { inquiry: any; onClose: () => void }) {
  const utils = trpc.useUtils();
  const data = inquiry;
  const [replyContent, setReplyContent] = useState(inquiry?.adminReply || "");
  const [newStatus, setNewStatus] = useState("");
  const [depositPriceType, setDepositPriceType] = useState<"cost" | "affiliate" | "sale">("cost");
  const [salePriceType, setSalePriceType] = useState<"cost" | "affiliate" | "sale">("sale");
  const [isPinMegi, setIsPinMegi] = useState(false);
  const [depositClicked, setDepositClicked] = useState(false);
  const [pinMegiClicked, setPinMegiClicked] = useState(false);

  const replyMutation = trpc.inquiries.reply.useMutation({
    onSuccess: () => {
      toast.success("답변이 등록되었습니다.");
      utils.inquiries.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = trpc.inquiries.updateStatus.useMutation({
    onSuccess: () => {
      utils.inquiries.list.invalidate();
    },
  });

  if (!data) return null;

  // 견적 자동 생성 (답변 입력된 경우 활성화)
  const canGenerateEstimate = replyContent.trim().length > 0;

  function handleDepositIcon() {
    setDepositClicked(true);
    setPinMegiClicked(false);
    setIsPinMegi(false);
    toast.info("입금가 기준 선택됨: 원가=동일, 제휴가=+5천원, 판매가=+2만원");
  }

  function handlePinMegiIcon() {
    setPinMegiClicked(true);
    setDepositClicked(false);
    setIsPinMegi(true);
    toast.info("핀메기 기준 선택됨: 원가=-2만원, 제휴가=-1.5만원, 판매가=동일");
  }

  function handleGenerateEstimate() {
    if (!canGenerateEstimate) {
      toast.error("답변 내용을 먼저 입력해주세요.");
      return;
    }
    toast.success("견적이 자동 생성되었습니다.");
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>문의 상세</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 문의 정보 */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-lg p-4">
            <div>
              <p className="text-xs text-slate-500">문의자</p>
              <p className="font-medium text-slate-800">{data.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">연락처</p>
              <p className="font-medium text-slate-800">{data.phone}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">이메일</p>
              <p className="font-medium text-slate-800">{data.email || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">희망 패키지</p>
              <p className="font-medium text-slate-800">{data.packageName || data.package_name || "미선택"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">희망 인원</p>
              <p className="font-medium text-slate-800">{data.peopleCount ? `${data.peopleCount}명` : "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">희망 출발일</p>
              <p className="font-medium text-slate-800">
                {data.desiredDate ? new Date(data.desiredDate).toLocaleDateString("ko-KR") : "-"}
              </p>
            </div>
          </div>

          {/* 문의 내용 */}
          <div className="bg-white border rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-2">문의 내용</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{data.message}</p>
          </div>

          {/* 기존 답변 */}
          {data.adminReply && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
              <p className="text-xs text-indigo-600 font-medium mb-2">기존 답변 내용</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{data.adminReply}</p>
              {data.repliedAt && (
                <p className="text-xs text-slate-400 mt-2">
                  {new Date(data.repliedAt).toLocaleDateString("ko-KR")} 답변
                </p>
              )}
            </div>
          )}

          {/* 답변 작성 */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="font-medium text-slate-700 text-sm">답변 작성</p>
            <div>
              <Label>상태 변경</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {["new", "in_progress", "replied", "closed"].map((s) => (
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
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>답변 내용</Label>
                {/* 입금가 / 판매가 / 핀메기 아이콘 */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDepositIcon}
                    title="입금가 기준 (원가=동일/제휴가=+5천/판매가=+2만)"
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-all ${
                      depositClicked
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-green-700 border-green-300 hover:bg-green-50"
                    }`}
                  >
                    <DollarSign className="w-3 h-3" />
                    입금가
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.info("판매가 기준: 입금가+2만원")}
                    title="판매가 기준"
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs border bg-white text-blue-700 border-blue-300 hover:bg-blue-50 transition-all"
                  >
                    <Tag className="w-3 h-3" />
                    판매가
                  </button>
                  <button
                    type="button"
                    onClick={handlePinMegiIcon}
                    title="핀메기 기준 (원가=-2만/제휴가=-1.5만/판매가=동일)"
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-all ${
                      pinMegiClicked
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-white text-orange-700 border-orange-300 hover:bg-orange-50"
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    핀메기
                  </button>
                </div>
              </div>
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="고객에게 전달할 답변을 입력하세요..."
                rows={4}
                className="mt-1"
              />
            </div>

            {/* 견적생성(자동) - 답변 입력된 경우 활성화 */}
            {canGenerateEstimate && (
              <Button
                type="button"
                onClick={handleGenerateEstimate}
                variant="outline"
                size="sm"
                className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50 gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                견적생성(자동)
              </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
          <Button
            onClick={() => {
              if (replyContent) {
                replyMutation.mutate({
                  id: inquiry.id,
                  adminReply: replyContent,
                  status: newStatus as any || "replied",
                });
              } else if (newStatus) {
                updateStatusMutation.mutate({ id: inquiry.id, status: newStatus as any });
                onClose();
              }
            }}
            disabled={replyMutation.isPending || updateStatusMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InquiriesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);

  const { data, isLoading } = trpc.inquiries.list.useQuery({
    page,
    limit: 15,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  return (
    <>
      <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">문의관리 (수기)</h1>
            <p className="text-slate-500 text-sm mt-1">고객 예약 문의를 관리합니다 · 생성일 최신순 정렬</p>
          </div>
  
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3">
                {/* 검색: 이름 또는 연락처 일부번호 */}
                <div className="relative flex-1 min-w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="문의자명 또는 연락처 일부번호 검색..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { setSearch(searchInput); setPage(1); }
                    }}
                    className="pl-8 h-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => { setSearch(searchInput); setPage(1); }}
                >
                  <Search size={14} />
                </Button>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue placeholder="상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="new">신규</SelectItem>
                    <SelectItem value="in_progress">처리중</SelectItem>
                    <SelectItem value="replied">답변완료</SelectItem>
                    <SelectItem value="closed">종료</SelectItem>
                  </SelectContent>
                </Select>
                {/* 정렬 기준 표시 (생성일 내림차순 고정) */}
                <div className="flex items-center gap-1 text-xs text-slate-500 border rounded px-2 h-9 bg-slate-50">
                  <ArrowDownUp size={12} />
                  생성일 최신순
                </div>
              </div>
            </CardContent>
          </Card>
  
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-20 text-center text-slate-400">로딩 중...</div>
              ) : !data?.items?.length ? (
                <div className="py-20 text-center">
                  <MessageSquare size={40} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">문의 내역이 없습니다</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-5 py-3 text-slate-500 font-medium">문의자</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">연락처</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">유형</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">희망 패키지</th>
                        <th className="text-center px-4 py-3 text-slate-500 font-medium">인원</th>
                        <th className="text-center px-4 py-3 text-slate-500 font-medium">상태</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">문의일</th>
                        <th className="text-right px-5 py-3 text-slate-500 font-medium">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.items.map((inquiry: any) => {
                        // 유형: 제휴사인 경우 제휴사명 표시, 일반 고객은 "고객"
                        const isAffiliate = inquiry.affiliateId || inquiry.affiliateName || inquiry.partnerCompanyName;
                        const typeLabel = isAffiliate
                          ? (inquiry.affiliateName || inquiry.partnerCompanyName || "제휴사")
                          : "고객";
                        const typeColor = isAffiliate
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700";
  
                        return (
                          <tr
                            key={inquiry.id}
                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${inquiry.status === "new" ? "bg-blue-50/30" : ""}`}
                            onClick={() => setSelectedInquiry(inquiry)}
                          >
                            <td className="px-5 py-3 font-medium text-slate-800">{inquiry.name}</td>
                            <td className="px-4 py-3 text-slate-600 font-mono text-xs">{inquiry.phone}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeColor}`}>
                                {typeLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-40 truncate">{inquiry.packageName || "-"}</td>
                            <td className="px-4 py-3 text-center text-slate-600">{inquiry.peopleCount ? `${inquiry.peopleCount}명` : "-"}</td>
                            <td className="px-4 py-3 text-center">
                              <Badge className={`text-xs ${STATUS_MAP[inquiry.status]?.color}`}>
                                {STATUS_MAP[inquiry.status]?.label}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs">
                              {new Date(inquiry.createdAt).toLocaleDateString("ko-KR")}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-800">
                                답변
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
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
  
        {selectedInquiry && (
          <InquiryDetailDialog inquiry={selectedInquiry} onClose={() => setSelectedInquiry(null)} />
        )}
    </>);
}
