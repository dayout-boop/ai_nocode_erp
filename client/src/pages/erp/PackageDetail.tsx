import { useState, useRef } from "react";
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
import { Plus, Trash2, ArrowLeft, Upload, Star, ImageIcon, X, ChevronUp, ChevronDown, Search, Wand2, Loader2 } from "lucide-react";
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

  // Image management
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: images, refetch: refetchImages } = trpc.packages.listImages.useQuery(
    { packageId: id },
    { enabled: !!id }
  );

  const uploadImageMutation = trpc.packages.uploadImage.useMutation({
    onSuccess: () => {
      setUploadingCount((c) => c - 1);
      refetchImages();
      utils.packages.get.invalidate({ id });
    },
    onError: (e) => { setUploadingCount((c) => c - 1); toast.error("업로드 실패: " + e.message); },
  });

  const deleteImageMutation = trpc.packages.deleteImage.useMutation({
    onSuccess: () => { toast.success("이미지가 삭제되었습니다."); refetchImages(); utils.packages.get.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });

  const setCoverMutation = trpc.packages.setCover.useMutation({
    onSuccess: () => { toast.success("대표 이미지가 변경되었습니다."); refetchImages(); utils.packages.get.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });

  const reorderMutation = trpc.packages.reorderImages.useMutation({
    onSuccess: () => { refetchImages(); },
    onError: (e) => toast.error("순서 변경 실패: " + e.message),
  });

  // Pixabay 검색
  const [pixabayQuery, setPixabayQuery] = useState('');
  const [pixabayInputValue, setPixabayInputValue] = useState('');
  const [pixabayPage, setPixabayPage] = useState(1);
  const [pixabayEnabled, setPixabayEnabled] = useState(false);
  const { data: pixabayResults, isLoading: pixabayLoading } = trpc.packages.searchPixabay.useQuery(
    { query: pixabayQuery, page: pixabayPage, perPage: 12 },
    { enabled: pixabayEnabled && !!pixabayQuery }
  );
  const importPixabayMutation = trpc.packages.importPixabayImage.useMutation({
    onSuccess: () => { toast.success('이미지가 추가되었습니다.'); refetchImages(); },
    onError: (e) => toast.error(e.message),
  });

  // AI 이미지 생성
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const generateAIMutation = trpc.packages.generateAIImage.useMutation({
    onSuccess: () => { setIsGeneratingAI(false); toast.success('AI 이미지가 생성되었습니다.'); refetchImages(); },
    onError: (e) => { setIsGeneratingAI(false); toast.error(e.message); },
  });

  const handlePixabaySearch = () => {
    if (!pixabayInputValue.trim()) return;
    setPixabayQuery(pixabayInputValue.trim());
    setPixabayPage(1);
    setPixabayEnabled(true);
  };

  const moveImage = (idx: number, direction: "up" | "down") => {
    if (!images) return;
    const arr = [...images];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= arr.length) return;
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
    reorderMutation.mutate({ packageId: id, orderedIds: arr.map((img: any) => img.id) });
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) { toast.error(`${file.name}: 이미지 파일만 업로드 가능합니다.`); return; }
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name}: 10MB 이하 파일만 업로드 가능합니다.`); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target?.result as string;
        setUploadingCount((c) => c + 1);
        uploadImageMutation.mutate({
          packageId: id,
          fileName: file.name,
          mimeType: file.type,
          base64Data,
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

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

        <Tabs defaultValue="images">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="images">이미지 관리</TabsTrigger>
            <TabsTrigger value="prices">인원별 요금</TabsTrigger>
            <TabsTrigger value="options">옵션 관리</TabsTrigger>
            <TabsTrigger value="slots">출발일/재고</TabsTrigger>
          </TabsList>

          {/* IMAGES TAB */}
          <TabsContent value="images" className="space-y-4">
            {/* 업로드 영역 */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">상품 이미지 업로드</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                    isDragging ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <Upload size={32} className="mx-auto mb-3 text-slate-400" />
                  <p className="text-slate-600 font-medium mb-1">이미지를 드래그하거나 클릭하여 업로드</p>
                  <p className="text-slate-400 text-sm">JPG, PNG, WEBP · 파일당 최대 10MB · 다중 선택 가능</p>
                  {uploadingCount > 0 && (
                    <p className="mt-3 text-indigo-600 text-sm font-medium">업로드 중... ({uploadingCount}개 남음)</p>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
              </CardContent>
            </Card>

            {/* Pixabay 이미지 검색 */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Search size={16} className="text-blue-500" />
                  <CardTitle className="text-base">Pixabay 무료 이미지 검색 (CC0)</CardTitle>
                </div>
                <p className="text-xs text-slate-400 mt-1">저작권 무료(CC0) 이미지를 검색하여 바로 등록할 수 있습니다</p>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input
                    value={pixabayInputValue}
                    onChange={(e) => setPixabayInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePixabaySearch()}
                    placeholder="예: golf course, thailand golf, green fairway"
                    className="h-9"
                  />
                  <Button
                    onClick={handlePixabaySearch}
                    disabled={!pixabayInputValue.trim() || pixabayLoading}
                    className="h-9 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                  >
                    {pixabayLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    <span className="ml-1">검색</span>
                  </Button>
                </div>

                {pixabayResults && (
                  <>
                    <p className="text-xs text-slate-400 mb-3">전체 {pixabayResults.total.toLocaleString()}개 중 {pixabayResults.images.length}개 표시</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {pixabayResults.images.map((img: any) => (
                        <div key={img.id} className="relative group rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                          <div className="aspect-[4/3] bg-slate-100">
                            <img
                              src={img.previewUrl}
                              alt={img.tags}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => importPixabayMutation.mutate({ packageId: id, imageUrl: img.largeImageUrl, altText: img.tags })}
                              disabled={importPixabayMutation.isPending}
                              className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                            >
                              {importPixabayMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                              등록
                            </button>
                          </div>
                          <div className="px-2 py-1 bg-white">
                            <p className="text-xs text-slate-400 truncate">{img.tags}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 페이지네이션 */}
                    {pixabayResults.total > 12 && (
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPixabayPage((p) => Math.max(1, p - 1))}
                          disabled={pixabayPage === 1 || pixabayLoading}
                          className="h-8"
                        >
                          이전
                        </Button>
                        <span className="text-sm text-slate-500">{pixabayPage} 페이지</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPixabayPage((p) => p + 1)}
                          disabled={pixabayPage * 12 >= pixabayResults.total || pixabayLoading}
                          className="h-8"
                        >
                          다음
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {!pixabayResults && !pixabayLoading && (
                  <div className="py-6 text-center">
                    <Search size={32} className="mx-auto mb-2 text-slate-200" />
                    <p className="text-slate-400 text-sm">검색어를 입력하고 검색 버튼을 누르세요</p>
                    <p className="text-slate-300 text-xs mt-1">예: golf course, thailand golf, green fairway</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI 이미지 자동생성 */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Wand2 size={16} className="text-purple-500" />
                  <CardTitle className="text-base">AI 이미지 자동 생성</CardTitle>
                </div>
                <p className="text-xs text-slate-400 mt-1">상품명 기반으로 AI가 골프 여행 이미지를 자동 생성합니다 (5~20초 소요)</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">{data.title}</span>
                      {data.country && <span className="text-slate-400"> · {data.country}</span>}
                      {data.region && <span className="text-slate-400"> · {data.region}</span>}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">위 상품 정보를 기반으로 AI 이미지를 생성합니다</p>
                  </div>
                  <Button
                    onClick={() => {
                      setIsGeneratingAI(true);
                      generateAIMutation.mutate({
                        packageId: id,
                        packageTitle: data.title,
                        country: data.country ?? undefined,
                        region: data.region ?? undefined,
                      });
                    }}
                    disabled={isGeneratingAI || generateAIMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                  >
                    {(isGeneratingAI || generateAIMutation.isPending) ? (
                      <>
                        <Loader2 size={14} className="animate-spin mr-2" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <Wand2 size={14} className="mr-2" />
                        AI 이미지 생성
                      </>
                    )}
                  </Button>
                </div>
                {(isGeneratingAI || generateAIMutation.isPending) && (
                  <div className="mt-4 p-4 bg-purple-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Loader2 size={20} className="animate-spin text-purple-500" />
                      <div>
                        <p className="text-sm font-medium text-purple-700">AI 이미지 생성 중...</p>
                        <p className="text-xs text-purple-500 mt-0.5">상품명과 목적지 정보를 분석하여 골프 여행 이미지를 생성하고 있습니다. 5~20초 소요됩니다.</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 이미지 목록 */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">등록된 이미지 ({images?.length ?? 0}장)</CardTitle>
                  <p className="text-xs text-slate-400">★ 단추 = 대표 이미지 설정</p>
                </div>
              </CardHeader>
              <CardContent>
                {!images?.length ? (
                  <div className="py-12 text-center">
                    <ImageIcon size={40} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-400 text-sm">등록된 이미지가 없습니다</p>
                    <p className="text-slate-300 text-xs mt-1">위의 업로드 영역에서 이미지를 추가하세요</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((img: any, idx: number) => (
                      <div key={img.id} className="relative group rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                        <div className="aspect-[4/3] bg-slate-100">
                          <img
                            src={img.imageUrl}
                            alt={img.altText ?? "상품 이미지"}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {/* 커버 배지 */}
                        {img.isCover && (
                          <div className="absolute top-2 left-2 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star size={10} fill="white" /> 대표
                          </div>
                        )}
                        {/* 순서 이동 버튼 (항상 표시) */}
                        <div className="absolute top-2 right-2 flex flex-col gap-0.5">
                          <button
                            onClick={() => moveImage(idx, "up")}
                            disabled={idx === 0}
                            className="w-6 h-6 bg-black/50 hover:bg-black/70 disabled:opacity-30 text-white rounded flex items-center justify-center transition-colors"
                            title="위로 이동"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            onClick={() => moveImage(idx, "down")}
                            disabled={idx === images.length - 1}
                            className="w-6 h-6 bg-black/50 hover:bg-black/70 disabled:opacity-30 text-white rounded flex items-center justify-center transition-colors"
                            title="아래로 이동"
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>
                        {/* 호버 액션 */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          {!img.isCover && (
                            <button
                              onClick={() => setCoverMutation.mutate({ imageId: img.id, packageId: id })}
                              className="bg-amber-400 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                              title="대표 이미지로 설정"
                            >
                              <Star size={12} /> 대표설정
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm("이 이미지를 삭제하시겠습니까?")) {
                                deleteImageMutation.mutate({ imageId: img.id });
                              }
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                            title="삭제"
                          >
                            <X size={12} /> 삭제
                          </button>
                        </div>
                        {/* 순서 번호 표시 */}
                        <div className="px-2 py-1.5 bg-white flex items-center justify-between">
                          <p className="text-xs text-slate-400 truncate">{img.altText || `이미지 ${idx + 1}`}</p>
                          <span className="text-xs text-slate-300 shrink-0 ml-1">#{idx + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

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
