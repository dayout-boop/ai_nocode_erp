import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, Eye, Package, Calendar } from "lucide-react";
import ReservationItineraryTab from "./ReservationItineraryTab";
import { Link } from "wouter";

const COUNTRY_MAP: Record<string, string> = {
  korea: "🇰🇷 대한민국",
  thailand: "🇹🇭 태국",
  vietnam: "🇻🇳 베트남",
  philippines: "🇵🇭 필리핀",
  china: "🇨🇳 중국",
  japan: "🇯🇵 일본",
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "초안", color: "bg-slate-100 text-slate-600" },
  active: { label: "활성", color: "bg-green-100 text-green-700" },
  inactive: { label: "비활성", color: "bg-amber-100 text-amber-700" },
  sold_out: { label: "매진", color: "bg-red-100 text-red-700" },
};

function PackageFormDialog({
  open, onClose, editPackage,
}: {
  open: boolean;
  onClose: () => void;
  editPackage?: any;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    title: editPackage?.title || "",
    country: editPackage?.country || "korea",
    region: editPackage?.region || "",
    duration: editPackage?.duration || "",
    roundCount: editPackage?.roundCount || 2,
    description: editPackage?.description || "",
    imageUrl: editPackage?.imageUrl || "",
    status: editPackage?.status || "draft",
    isFeatured: editPackage?.isFeatured || false,
    isPopular: editPackage?.isPopular || false,
    isSpecialDeal: editPackage?.isSpecialDeal || false,
    isTrending: editPackage?.isTrending || false,
    courseType: editPackage?.courseType || "none",
    badgeType: editPackage?.badgeType || "none",
    departureCities: Array.isArray(editPackage?.departureCities)
      ? editPackage.departureCities.join(", ")
      : (editPackage?.departureCities || ""),
    includesAirfare: editPackage?.includesAirfare ?? true,
    includesGreenFee: editPackage?.includesGreenFee ?? true,
    includesHotel: editPackage?.includesHotel ?? true,
  });
  const [showItineraryTemplate, setShowItineraryTemplate] = useState(false);

  const createMutation = trpc.packages.create.useMutation({
    onSuccess: () => {
      toast.success("상품이 등록되었습니다.");
      utils.packages.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.packages.update.useMutation({
    onSuccess: () => {
      toast.success("상품이 수정되었습니다.");
      utils.packages.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.title.trim()) return toast.error("상품명을 입력해주세요.");
    // 백엔드 입력 규격에 맞게 payload 정규화
    const { courseType, departureCities, ...rest } = form;
    const payload: any = {
      ...rest,
      // departureCities: "인천, 부산" 문자열 → string[] (백엔드가 배열을 기대)
      departureCities: typeof departureCities === "string"
        ? departureCities.split(",").map((s) => s.trim()).filter(Boolean)
        : (Array.isArray(departureCities) ? departureCities : []),
    };
    // courseType은 enum이므로 빈 값('none'/"")이면 키 자체를 제거
    if (courseType && courseType !== "none") {
      payload.courseType = courseType;
    }
    if (editPackage) {
      updateMutation.mutate({ id: editPackage.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editPackage ? "상품 수정" : "상품 등록"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>상품명 *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="예: 태국 파타야 3박4일 골프 패키지"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>국가 *</Label>
              <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COUNTRY_MAP).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>지역</Label>
              <Input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="예: 파타야, 다낭"
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>여행 기간</Label>
              <Input
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                placeholder="예: 3박4일"
                className="mt-1"
              />
            </div>
            <div>
              <Label>라운딩 횟수</Label>
              <Input
                type="number"
                value={form.roundCount}
                onChange={(e) => setForm({ ...form, roundCount: Number(e.target.value) })}
                min={1}
                max={10}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label>상품 설명</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="상품에 대한 상세 설명을 입력하세요"
              rows={3}
              className="mt-1"
            />
          </div>
          <div>
            <Label>대표 이미지 URL</Label>
            <Input
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://..."
              className="mt-1"
            />
          </div>
          <div>
            <Label>상태</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">초안</SelectItem>
                <SelectItem value="active">활성</SelectItem>
                <SelectItem value="inactive">비활성</SelectItem>
                <SelectItem value="sold_out">매진</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>코스 유형</Label>
            <Select value={form.courseType || "none"} onValueChange={(v) => setForm({ ...form, courseType: v as any })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="코스 유형 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택 안함</SelectItem>
                <SelectItem value="resort">🏨 리조트</SelectItem>
                <SelectItem value="oceanfront">🌊 오션뷰</SelectItem>
                <SelectItem value="mountain">⛰️ 산악</SelectItem>
                <SelectItem value="tropical">🌴 열대</SelectItem>
                <SelectItem value="parkland">🌳 파크랜드</SelectItem>
                <SelectItem value="links">🏌️ 링크스</SelectItem>
                <SelectItem value="desert">🏜️ 사막</SelectItem>
                <SelectItem value="tournament">🏆 토너먼트</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* 배지 유형 */}
          <div>
            <Label>배지 유형</Label>
            <Select value={form.badgeType || "none"} onValueChange={(v) => setForm({ ...form, badgeType: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="배지 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">없음</SelectItem>
                <SelectItem value="best">🏆 BEST</SelectItem>
                <SelectItem value="new">🆕 NEW</SelectItem>
                <SelectItem value="hot">🔥 HOT</SelectItem>
                <SelectItem value="exclusive">⭐ 단독특가</SelectItem>
                <SelectItem value="limited">⏰ 한정특가</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* 출발지 */}
          <div>
            <Label>출발 도시 (쉼표로 구분)</Label>
            <Input
              value={form.departureCities}
              onChange={(e) => setForm({ ...form, departureCities: e.target.value })}
              placeholder="예: 인천, 부산, 대구"
              className="mt-1"
            />
          </div>
          {/* 포함 항목 */}
          <div>
            <Label className="mb-2 block">포함 항목</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.includesAirfare}
                  onCheckedChange={(v) => setForm({ ...form, includesAirfare: v })}
                />
                <Label className="text-xs">✈️ 항공</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.includesGreenFee}
                  onCheckedChange={(v) => setForm({ ...form, includesGreenFee: v })}
                />
                <Label className="text-xs">⛳ 그린피</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.includesHotel}
                  onCheckedChange={(v) => setForm({ ...form, includesHotel: v })}
                />
                <Label className="text-xs">🏨 숙박</Label>
              </div>
            </div>
          </div>
          {/* 기본 일정 템플릿 */}
          {editPackage?.id && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> 기본 일정 템플릿
                </Label>
                <button
                  type="button"
                  onClick={() => setShowItineraryTemplate(!showItineraryTemplate)}
                  className="text-xs text-green-700 hover:text-green-900 border border-green-300 px-2 py-0.5 rounded"
                >
                  {showItineraryTemplate ? "접기" : "일정 템플릿 설정"}
                </button>
              </div>
              {showItineraryTemplate && (
                <div className="border rounded-lg p-3 bg-gray-50">
                  <p className="text-xs text-gray-500 mb-2">
                    상품에 기본 일정을 설정하면 이 상품으로 예약 생성 시 자동으로 일정이 복사됩니다.
                  </p>
                  <ReservationItineraryTab
                    reservationId={-(editPackage.id)} 
                    packageId={editPackage.id}
                    isPackageTemplate
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isFeatured}
                onCheckedChange={(v) => setForm({ ...form, isFeatured: v })}
              />
              <Label>추천 상품</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isPopular}
                onCheckedChange={(v) => setForm({ ...form, isPopular: v })}
              />
              <Label>인기 상품</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isTrending}
                onCheckedChange={(v) => setForm({ ...form, isTrending: v })}
              />
              <Label>트렌딩</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isSpecialDeal}
                onCheckedChange={(v) => setForm({ ...form, isSpecialDeal: v })}
              />
              <Label>특가 상품</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {editPackage ? "수정" : "등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PackagesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editPackage, setEditPackage] = useState<any>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.packages.list.useQuery({
    page,
    limit: 15,
    status: statusFilter || undefined,
    country: countryFilter || undefined,
    search: search || undefined,
  });

  const deleteMutation = trpc.packages.delete.useMutation({
    onSuccess: () => {
      toast.success("상품이 삭제되었습니다.");
      utils.packages.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleDelete = (id: number, title: string) => {
    if (!confirm(`"${title}" 상품을 삭제하시겠습니까?`)) return;
    deleteMutation.mutate({ id });
  };

  return (
    <>
      <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">상품관리</h1>
              <p className="text-slate-500 text-sm mt-1">골프 패키지 상품을 관리합니다</p>
            </div>
            <Button
              onClick={() => { setEditPackage(null); setShowForm(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus size={16} className="mr-1" /> 상품 등록
            </Button>
          </div>
  
          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="상품명 검색..."
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
                    <SelectItem value="all">전체 상태</SelectItem>
                    <SelectItem value="active">활성</SelectItem>
                    <SelectItem value="draft">초안</SelectItem>
                    <SelectItem value="inactive">비활성</SelectItem>
                    <SelectItem value="sold_out">매진</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="w-36 h-9">
                    <SelectValue placeholder="국가" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 국가</SelectItem>
                    {Object.entries(COUNTRY_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
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
                  <Package size={40} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">등록된 상품이 없습니다</p>
                  <Button
                    onClick={() => setShowForm(true)}
                    className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                    size="sm"
                  >
                    첫 상품 등록하기
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-5 py-3 text-slate-500 font-medium">상품명</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">국가</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">기간</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">라운딩</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">상태</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">태그</th>
                        <th className="text-right px-5 py-3 text-slate-500 font-medium">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.items.map((pkg: any) => (
                        <tr key={pkg.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="font-medium text-slate-800">{pkg.title}</div>
                            {pkg.region && <div className="text-xs text-slate-400">{pkg.region}</div>}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {COUNTRY_MAP[pkg.country] || pkg.country}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{pkg.duration || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">{pkg.roundCount}회</td>
                          <td className="px-4 py-3">
                            <Badge className={`text-xs ${STATUS_MAP[pkg.status]?.color}`}>
                              {STATUS_MAP[pkg.status]?.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {pkg.isFeatured && (
                                <Badge className="text-xs bg-indigo-50 text-indigo-700">추천</Badge>
                              )}
                              {pkg.isPopular && (
                                <Badge className="text-xs bg-rose-50 text-rose-700">인기</Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Link href={`/packages/${pkg.id}`}>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600">
                                  <Eye size={14} />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-amber-600"
                                onClick={() => { setEditPackage(pkg); setShowForm(true); }}
                              >
                                <Edit size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                                onClick={() => handleDelete(pkg.id, pkg.title)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
  
          {/* Pagination */}
          {data && data.total > 15 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                총 {data.total}개 상품
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  이전
                </Button>
                <span className="text-sm text-slate-600 px-3 py-1.5">
                  {page} / {Math.ceil(data.total / 15)}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(data.total / 15)}>
                  다음
                </Button>
              </div>
            </div>
          )}
        </div>
  
        <PackageFormDialog
          key={showForm ? (editPackage?.id ?? "new") : "closed"}
          open={showForm}
          onClose={() => { setShowForm(false); setEditPackage(null); }}
          editPackage={editPackage}
        />
    </>);
}
