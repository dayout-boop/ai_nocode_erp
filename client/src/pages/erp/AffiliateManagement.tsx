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
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Eye, Edit2, Trash2, ChevronLeft, ChevronRight, MapPin, Globe,
} from "lucide-react";
import { toast } from "sonner";

type AffiliateType = "golf_domestic" | "golf_overseas" | "hotel" | "attraction" | "transport" | "other";
type AffiliateStatus = "active" | "inactive" | "pending";

const TYPE_LABELS: Record<AffiliateType, string> = {
  golf_domestic: "🇰🇷 국내 골프장",
  golf_overseas: "🌏 해외 골프장",
  hotel: "🏨 숙소",
  attraction: "🗺️ 관광지",
  transport: "🚌 교통",
  other: "기타",
};
const TYPE_COLORS: Record<AffiliateType, string> = {
  golf_domestic: "bg-green-100 text-green-800",
  golf_overseas: "bg-blue-100 text-blue-800",
  hotel: "bg-purple-100 text-purple-800",
  attraction: "bg-orange-100 text-orange-800",
  transport: "bg-gray-100 text-gray-800",
  other: "bg-gray-100 text-gray-600",
};

const defaultForm = {
  name: "", type: "golf_domestic" as AffiliateType,
  country: "한국", region: "", address: "",
  phone: "", email: "", website: "",
  contactName: "", contactPhone: "",
  holeCount: 18, courseCount: 1, greenFeeMin: 0, greenFeeMax: 0,
  prepaidBalance: 0, depositBalance: 0,
  notes: "", status: "active" as AffiliateStatus,
};

export default function AffiliateManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | AffiliateType>("all");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [form, setForm] = useState({ ...defaultForm });

  const { data, refetch } = trpc.affiliates.list.useQuery({
    page, pageSize: 20, search, type: typeFilter,
  });
  const { data: detail } = trpc.affiliates.getById.useQuery(
    { id: showDetail! },
    { enabled: showDetail !== null }
  );

  const createMut = trpc.affiliates.create.useMutation({
    onSuccess: () => { toast.success("제휴사가 등록되었습니다."); setShowForm(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.affiliates.update.useMutation({
    onSuccess: () => { toast.success("제휴사가 수정되었습니다."); setShowForm(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.affiliates.delete.useMutation({
    onSuccess: () => { toast.success("제휴사가 삭제되었습니다."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const { data: typeCountsData } = trpc.affiliates.typeCounts.useQuery();

  function openCreate() {
    setForm({ ...defaultForm });
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(item: typeof items[0]) {
    setForm({
      name: item.name,
      type: item.type as AffiliateType,
      country: item.country ?? "한국",
      region: item.region ?? "",
      address: item.address ?? "",
      phone: item.phone ?? "",
      email: item.email ?? "",
      website: item.website ?? "",
      contactName: item.contactName ?? "",
      contactPhone: item.contactPhone ?? "",
      holeCount: item.holeCount ?? 18,
      courseCount: item.courseCount ?? 1,
      greenFeeMin: item.greenFeeMin ?? 0,
      greenFeeMax: item.greenFeeMax ?? 0,
      prepaidBalance: item.prepaidBalance ?? 0,
      depositBalance: item.depositBalance ?? 0,
      notes: item.notes ?? "",
      status: item.status as AffiliateStatus,
    });
    setEditId(item.id);
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.name) { toast.error("업체명은 필수입니다."); return; }
    if (editId) {
      updateMut.mutate({ id: editId, ...form });
    } else {
      createMut.mutate(form);
    }
  }

  const numField = (key: keyof typeof form) => ({
    value: form[key] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: Number(e.target.value) || 0 })),
  });

  // 타입별 통계 (서버에서 전체 집계)
  const typeCounts = typeCountsData ?? {};

  return (
    <ERPLayout>
      <div className="p-6 space-y-6">
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(Object.keys(TYPE_LABELS) as AffiliateType[]).map(type => (
            <Card key={type} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setTypeFilter(type); setPage(1); }}>
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-gray-500 mb-1">{TYPE_LABELS[type]}</p>
                <p className="text-2xl font-bold text-gray-800">{typeCounts[type] ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 검색 및 필터 */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-2 flex-1 min-w-[200px]">
            <Input
              placeholder="업체명, 지역, 담당자 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
            />
            <Button variant="outline" onClick={() => { setSearch(searchInput); setPage(1); }}>
              <Search className="w-4 h-4" />
            </Button>
          </div>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as any); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="유형 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 유형</SelectItem>
              {(Object.keys(TYPE_LABELS) as AffiliateType[]).map(t => (
                <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate} className="bg-green-700 hover:bg-green-800 text-white">
            <Plus className="w-4 h-4 mr-1" /> 신규 등록
          </Button>
        </div>

        {/* 목록 테이블 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">제휴사 목록 ({total.toLocaleString()}개)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["유형", "업체명", "국가/지역", "연락처", "담당자", "그린피", "선입금잔액", "상태", ""].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-gray-400">
                        등록된 제휴사가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[item.type as AffiliateType]}`}>
                            {TYPE_LABELS[item.type as AffiliateType]}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-semibold">{item.name}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {item.country} {item.region && `· ${item.region}`}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">{item.phone ?? "-"}</td>
                        <td className="px-3 py-2 text-xs">{item.contactName ?? "-"}</td>
                        <td className="px-3 py-2 text-xs text-right">
                          {item.greenFeeMin || item.greenFeeMax
                            ? `${(item.greenFeeMin ?? 0).toLocaleString()}~${(item.greenFeeMax ?? 0).toLocaleString()}`
                            : "-"}
                        </td>
                        <td className="px-3 py-2 text-xs text-right font-bold text-teal-700">
                          {item.prepaidBalance ? `${item.prepaidBalance.toLocaleString()}원` : "-"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${item.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {item.status === "active" ? "활성" : item.status === "inactive" ? "비활성" : "검토중"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => setShowDetail(item.id)} className="p-1 hover:bg-blue-50 rounded text-blue-500" title="상세보기">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => openEdit(item)} className="p-1 hover:bg-yellow-50 rounded text-yellow-600" title="수정">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMut.mutate({ id: item.id }); }}
                              className="p-1 hover:bg-red-50 rounded text-red-500" title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 등록/수정 모달 */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "제휴사 수정" : "제휴사 신규 등록"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>업체명 *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 파인리조트 골프클럽" />
            </div>
            <div>
              <Label>유형 *</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as AffiliateType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as AffiliateType[]).map(t => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>상태</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as AffiliateStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="inactive">비활성</SelectItem>
                  <SelectItem value="pending">검토중</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>국가</Label>
              <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
            </div>
            <div>
              <Label>지역/도시</Label>
              <Input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} placeholder="예: 경기도, 방콕" />
            </div>
            <div className="col-span-2">
              <Label>주소</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <Label>대표 전화</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>이메일</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>웹사이트</Label>
              <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
            </div>
            <div>
              <Label>담당자명</Label>
              <Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
            </div>
            <div>
              <Label>담당자 연락처</Label>
              <Input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
            </div>
            {(form.type === "golf_domestic" || form.type === "golf_overseas") && (
              <>
                <div>
                  <Label>홀 수</Label>
                  <Input type="number" min={9} {...numField("holeCount")} />
                </div>
                <div>
                  <Label>코스 수</Label>
                  <Input type="number" min={1} {...numField("courseCount")} />
                </div>
                <div>
                  <Label>그린피 최소 (원)</Label>
                  <Input type="number" min={0} {...numField("greenFeeMin")} />
                </div>
                <div>
                  <Label>그린피 최대 (원)</Label>
                  <Input type="number" min={0} {...numField("greenFeeMax")} />
                </div>
              </>
            )}
            <div>
              <Label>선입금 잔액 (원)</Label>
              <Input type="number" min={0} {...numField("prepaidBalance")} />
            </div>
            <div>
              <Label>데파짓 잔액 (원)</Label>
              <Input type="number" min={0} {...numField("depositBalance")} />
            </div>
            <div className="col-span-2">
              <Label>메모</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>취소</Button>
            <Button onClick={handleSubmit} className="bg-green-700 hover:bg-green-800 text-white">
              {editId ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상세 모달 */}
      <Dialog open={showDetail !== null} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>제휴사 상세 정보</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs ${TYPE_COLORS[detail.type as AffiliateType]}`}>
                  {TYPE_LABELS[detail.type as AffiliateType]}
                </span>
                <span className="font-bold text-lg">{detail.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">국가:</span> {detail.country}</div>
                <div><span className="text-gray-500">지역:</span> {detail.region ?? "-"}</div>
                <div><span className="text-gray-500">전화:</span> {detail.phone ?? "-"}</div>
                <div><span className="text-gray-500">이메일:</span> {detail.email ?? "-"}</div>
                <div><span className="text-gray-500">담당자:</span> {detail.contactName ?? "-"}</div>
                <div><span className="text-gray-500">담당자 연락처:</span> {detail.contactPhone ?? "-"}</div>
                {detail.website && (
                  <div className="col-span-2">
                    <span className="text-gray-500">웹사이트:</span>{" "}
                    <a href={detail.website} target="_blank" rel="noreferrer" className="text-blue-600 underline">{detail.website}</a>
                  </div>
                )}
                {(detail.type === "golf_domestic" || detail.type === "golf_overseas") && (
                  <>
                    <div><span className="text-gray-500">홀 수:</span> {detail.holeCount ?? 18}홀</div>
                    <div><span className="text-gray-500">코스 수:</span> {detail.courseCount ?? 1}코스</div>
                    <div><span className="text-gray-500">그린피:</span> {detail.greenFeeMin?.toLocaleString() ?? 0}~{detail.greenFeeMax?.toLocaleString() ?? 0}원</div>
                  </>
                )}
                <div><span className="text-gray-500">선입금 잔액:</span> <span className="font-bold text-teal-700">{(detail.prepaidBalance ?? 0).toLocaleString()}원</span></div>
                <div><span className="text-gray-500">데파짓 잔액:</span> <span className="font-bold text-blue-700">{(detail.depositBalance ?? 0).toLocaleString()}원</span></div>
              </div>
              {detail.notes && (
                <div>
                  <p className="text-gray-500 mb-1">메모</p>
                  <p className="bg-gray-50 rounded p-3 text-gray-700">{detail.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(null)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ERPLayout>
  );
}
