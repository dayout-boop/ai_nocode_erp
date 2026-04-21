import { useState } from "react";
import { useRoute } from "wouter";
import ERPLayout from "@/components/ERPLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const SEASON_MAP: Record<string, string> = {
  peak: "성수기",
  normal: "평수기",
  off: "비수기",
};

const OPTION_TYPE_MAP: Record<string, string> = {
  cart: "카트",
  caddie: "캐디",
  accommodation: "숙박",
  vehicle: "차량",
  meal: "식사",
  insurance: "보험",
  other: "기타",
};

export default function PackageDetail() {
  const [, params] = useRoute("/erp/packages/:id");
  const id = Number(params?.id);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.packages.get.useQuery({ id }, { enabled: !!id });

  // Price form
  const [priceForm, setPriceForm] = useState({
    season: "normal" as "peak" | "normal" | "off",
    minPeople: 1,
    maxPeople: 99,
    pricePerPerson: "",
    singleSupplement: "",
  });

  // Option form
  const [optionForm, setOptionForm] = useState({
    optionType: "cart" as any,
    name: "",
    description: "",
    price: "0",
    isIncluded: false,
    isRequired: false,
  });

  // Slot form
  const [slotForm, setSlotForm] = useState({
    departureDate: "",
    returnDate: "",
    totalSlots: 20,
    status: "open" as "open" | "closed" | "sold_out",
    priceOverride: "",
  });

  const addPriceMutation = trpc.packages.addPrice.useMutation({
    onSuccess: () => { toast.success("요금이 추가되었습니다."); utils.packages.get.invalidate({ id }); setPriceForm({ season: "normal", minPeople: 1, maxPeople: 99, pricePerPerson: "", singleSupplement: "" }); },
    onError: (e) => toast.error(e.message),
  });

  const deletePriceMutation = trpc.packages.deletePrice.useMutation({
    onSuccess: () => { toast.success("요금이 삭제되었습니다."); utils.packages.get.invalidate({ id }); },
  });

  const addOptionMutation = trpc.packages.addOption.useMutation({
    onSuccess: () => { toast.success("옵션이 추가되었습니다."); utils.packages.get.invalidate({ id }); setOptionForm({ optionType: "cart", name: "", description: "", price: "0", isIncluded: false, isRequired: false }); },
    onError: (e) => toast.error(e.message),
  });

  const deleteOptionMutation = trpc.packages.deleteOption.useMutation({
    onSuccess: () => { toast.success("옵션이 삭제되었습니다."); utils.packages.get.invalidate({ id }); },
  });

  const addSlotMutation = trpc.packages.addSlot.useMutation({
    onSuccess: () => { toast.success("출발일이 추가되었습니다."); utils.packages.get.invalidate({ id }); setSlotForm({ departureDate: "", returnDate: "", totalSlots: 20, status: "open", priceOverride: "" }); },
    onError: (e) => toast.error(e.message),
  });

  const deleteSlotMutation = trpc.packages.deleteSlot.useMutation({
    onSuccess: () => { toast.success("출발일이 삭제되었습니다."); utils.packages.get.invalidate({ id }); },
  });

  if (isLoading) return <ERPLayout><div className="py-20 text-center text-slate-400">로딩 중...</div></ERPLayout>;
  if (!data) return <ERPLayout><div className="py-20 text-center text-slate-400">상품을 찾을 수 없습니다.</div></ERPLayout>;

  return (
    <ERPLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/erp/packages">
            <Button variant="ghost" size="sm" className="text-slate-500">
              <ArrowLeft size={16} className="mr-1" /> 목록
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{data.title}</h1>
            <p className="text-slate-500 text-sm">{data.country} · {data.duration} · 라운딩 {data.roundCount}회</p>
          </div>
        </div>

        <Tabs defaultValue="prices">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="prices">인원별 요금</TabsTrigger>
            <TabsTrigger value="options">옵션 관리</TabsTrigger>
            <TabsTrigger value="slots">출발일/재고</TabsTrigger>
          </TabsList>

          {/* PRICES TAB */}
          <TabsContent value="prices" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">요금 추가</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <Label>시즌</Label>
                    <Select value={priceForm.season} onValueChange={(v) => setPriceForm({ ...priceForm, season: v as any })}>
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="peak">성수기</SelectItem>
                        <SelectItem value="normal">평수기</SelectItem>
                        <SelectItem value="off">비수기</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>최소 인원</Label>
                    <Input type="number" value={priceForm.minPeople} onChange={(e) => setPriceForm({ ...priceForm, minPeople: Number(e.target.value) })} className="mt-1 h-9" min={1} />
                  </div>
                  <div>
                    <Label>최대 인원</Label>
                    <Input type="number" value={priceForm.maxPeople} onChange={(e) => setPriceForm({ ...priceForm, maxPeople: Number(e.target.value) })} className="mt-1 h-9" min={1} />
                  </div>
                  <div>
                    <Label>1인 요금 (원)</Label>
                    <Input value={priceForm.pricePerPerson} onChange={(e) => setPriceForm({ ...priceForm, pricePerPerson: e.target.value })} placeholder="1,500,000" className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label>싱글룸 추가요금 (원)</Label>
                    <Input value={priceForm.singleSupplement} onChange={(e) => setPriceForm({ ...priceForm, singleSupplement: e.target.value })} placeholder="200,000" className="mt-1 h-9" />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => addPriceMutation.mutate({ packageId: id, ...priceForm })}
                      disabled={!priceForm.pricePerPerson || addPriceMutation.isPending}
                      className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white w-full"
                    >
                      <Plus size={14} className="mr-1" /> 추가
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                {!data.prices?.length ? (
                  <div className="py-10 text-center text-slate-400 text-sm">등록된 요금이 없습니다</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-5 py-3 text-slate-500 font-medium">시즌</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">인원</th>
                        <th className="text-right px-4 py-3 text-slate-500 font-medium">1인 요금</th>
                        <th className="text-right px-4 py-3 text-slate-500 font-medium">싱글룸 추가</th>
                        <th className="text-right px-5 py-3 text-slate-500 font-medium">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.prices.map((price: any) => (
                        <tr key={price.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3">
                            <Badge className="text-xs bg-blue-50 text-blue-700">{SEASON_MAP[price.season]}</Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{price.minPeople}~{price.maxPeople}명</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {Number(price.pricePerPerson).toLocaleString()}원
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {Number(price.singleSupplement || 0).toLocaleString()}원
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-600" onClick={() => deletePriceMutation.mutate({ id: price.id })}>
                              <Trash2 size={13} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* OPTIONS TAB */}
          <TabsContent value="options" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">옵션 추가 (카트/캐디피 등)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <Label>옵션 유형</Label>
                    <Select value={optionForm.optionType} onValueChange={(v) => setOptionForm({ ...optionForm, optionType: v })}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(OPTION_TYPE_MAP).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>옵션명</Label>
                    <Input value={optionForm.name} onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })} placeholder="예: 카트피 포함" className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label>가격 (원)</Label>
                    <Input value={optionForm.price} onChange={(e) => setOptionForm({ ...optionForm, price: e.target.value })} placeholder="0" className="mt-1 h-9" />
                  </div>
                  <div className="flex items-center gap-4 col-span-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={optionForm.isIncluded} onCheckedChange={(v) => setOptionForm({ ...optionForm, isIncluded: v })} />
                      <Label>기본 포함</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={optionForm.isRequired} onCheckedChange={(v) => setOptionForm({ ...optionForm, isRequired: v })} />
                      <Label>필수 선택</Label>
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={() => addOptionMutation.mutate({ packageId: id, ...optionForm })} disabled={!optionForm.name || addOptionMutation.isPending} className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white w-full">
                      <Plus size={14} className="mr-1" /> 추가
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                {!data.options?.length ? (
                  <div className="py-10 text-center text-slate-400 text-sm">등록된 옵션이 없습니다</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-5 py-3 text-slate-500 font-medium">유형</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">옵션명</th>
                        <th className="text-right px-4 py-3 text-slate-500 font-medium">가격</th>
                        <th className="text-center px-4 py-3 text-slate-500 font-medium">포함/필수</th>
                        <th className="text-right px-5 py-3 text-slate-500 font-medium">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.options.map((opt: any) => (
                        <tr key={opt.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3">
                            <Badge className="text-xs bg-slate-100 text-slate-600">{OPTION_TYPE_MAP[opt.optionType]}</Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-800 font-medium">{opt.name}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{Number(opt.price || 0).toLocaleString()}원</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-1 justify-center">
                              {opt.isIncluded && <Badge className="text-xs bg-green-50 text-green-700">포함</Badge>}
                              {opt.isRequired && <Badge className="text-xs bg-red-50 text-red-700">필수</Badge>}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-600" onClick={() => deleteOptionMutation.mutate({ id: opt.id })}>
                              <Trash2 size={13} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SLOTS TAB */}
          <TabsContent value="slots" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">출발일 추가</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <Label>출발일 *</Label>
                    <Input type="date" value={slotForm.departureDate} onChange={(e) => setSlotForm({ ...slotForm, departureDate: e.target.value })} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label>귀국일</Label>
                    <Input type="date" value={slotForm.returnDate} onChange={(e) => setSlotForm({ ...slotForm, returnDate: e.target.value })} className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label>총 정원</Label>
                    <Input type="number" value={slotForm.totalSlots} onChange={(e) => setSlotForm({ ...slotForm, totalSlots: Number(e.target.value) })} className="mt-1 h-9" min={1} />
                  </div>
                  <div>
                    <Label>상태</Label>
                    <Select value={slotForm.status} onValueChange={(v) => setSlotForm({ ...slotForm, status: v as any })}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">모집중</SelectItem>
                        <SelectItem value="closed">마감</SelectItem>
                        <SelectItem value="sold_out">매진</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>특별 요금 (원, 선택)</Label>
                    <Input value={slotForm.priceOverride} onChange={(e) => setSlotForm({ ...slotForm, priceOverride: e.target.value })} placeholder="기본 요금 사용" className="mt-1 h-9" />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => addSlotMutation.mutate({
                        packageId: id,
                        departureDate: new Date(slotForm.departureDate),
                        returnDate: slotForm.returnDate ? new Date(slotForm.returnDate) : undefined,
                        totalSlots: slotForm.totalSlots,
                        status: slotForm.status,
                        priceOverride: slotForm.priceOverride || undefined,
                      })}
                      disabled={!slotForm.departureDate || addSlotMutation.isPending}
                      className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white w-full"
                    >
                      <Plus size={14} className="mr-1" /> 추가
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                {!data.slots?.length ? (
                  <div className="py-10 text-center text-slate-400 text-sm">등록된 출발일이 없습니다</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-5 py-3 text-slate-500 font-medium">출발일</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">귀국일</th>
                        <th className="text-center px-4 py-3 text-slate-500 font-medium">정원/예약</th>
                        <th className="text-left px-4 py-3 text-slate-500 font-medium">상태</th>
                        <th className="text-right px-5 py-3 text-slate-500 font-medium">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.slots.map((slot: any) => {
                        const remaining = slot.totalSlots - slot.bookedSlots;
                        return (
                          <tr key={slot.id} className="hover:bg-slate-50">
                            <td className="px-5 py-3 font-medium text-slate-800">
                              {new Date(slot.departureDate).toLocaleDateString("ko-KR")}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {slot.returnDate ? new Date(slot.returnDate).toLocaleDateString("ko-KR") : "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-slate-800 font-medium">{slot.bookedSlots}</span>
                              <span className="text-slate-400"> / {slot.totalSlots}</span>
                              <span className={`ml-2 text-xs ${remaining <= 3 ? "text-red-500" : "text-green-600"}`}>
                                (잔여 {remaining})
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={`text-xs ${slot.status === "open" ? "bg-green-50 text-green-700" : slot.status === "sold_out" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                                {slot.status === "open" ? "모집중" : slot.status === "sold_out" ? "매진" : "마감"}
                              </Badge>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-600" onClick={() => deleteSlotMutation.mutate({ id: slot.id })}>
                                <Trash2 size={13} />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ERPLayout>
  );
}
