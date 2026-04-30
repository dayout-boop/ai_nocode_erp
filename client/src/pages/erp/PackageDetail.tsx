import { useState, useRef, useEffect } from "react";
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
import { Plus, Trash2, ArrowLeft, Upload, Star, ImageIcon, X, ChevronUp, ChevronDown, Search, Wand2, Loader2, Video, Zap, CheckCircle, XCircle, Clock } from "lucide-react";
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
  const [slotMode, setSlotMode] = useState<"single" | "batch">("single");
  const [slotForm, setSlotForm] = useState({
    departureDate: "",
    returnDate: "",
    totalSlots: 20,
    minPax: 3,
    status: "open" as "open" | "closed" | "sold_out",
    priceOverride: "",
    adultPrice: "",
    childPrice: "",
    infantPrice: "",
    notes: "",
  });
  const [batchForm, setBatchForm] = useState({
    startDate: "",
    endDate: "",
    weekdays: [] as number[],
    nights: 1,
    totalSlots: 20,
    minPax: 3,
    adultPrice: "",
    childPrice: "",
    infantPrice: "",
    notes: "",
  });
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [editSlotForm, setEditSlotForm] = useState<any>(null);

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
    onSuccess: () => { toast.success("출발일이 추가되었습니다."); utils.packages.get.invalidate({ id }); setSlotForm({ departureDate: "", returnDate: "", totalSlots: 20, minPax: 3, status: "open", priceOverride: "", adultPrice: "", childPrice: "", infantPrice: "", notes: "" }); },
    onError: (e) => toast.error(e.message),
  });

  const addSlotBatchMutation = trpc.packages.addSlotBatch.useMutation({
    onSuccess: (res) => { toast.success(`${res.count}개 출발일이 추가되었습니다.`); utils.packages.get.invalidate({ id }); setBatchForm({ startDate: "", endDate: "", weekdays: [], nights: 1, totalSlots: 20, minPax: 3, adultPrice: "", childPrice: "", infantPrice: "", notes: "" }); },
    onError: (e) => toast.error(e.message),
  });

  const updateSlotMutation = trpc.packages.updateSlot.useMutation({
    onSuccess: () => { toast.success("출발일이 수정되었습니다."); utils.packages.get.invalidate({ id }); setEditingSlotId(null); setEditSlotForm(null); },
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

  // AI 이미지 다중 생성 및 선택
  const [aiKeywords, setAiKeywords] = useState<string[]>([]);
  const [aiKeywordInput, setAiKeywordInput] = useState('');
  const [aiGenerateCount, setAiGenerateCount] = useState<number>(3);
  const [aiPreviewImages, setAiPreviewImages] = useState<{ url: string; key: string; storageUrl: string; prompt: string }[]>([]);
  const [aiSelectedKeys, setAiSelectedKeys] = useState<Set<string>>(new Set());

  const generateAIImagesMutation = trpc.packages.generateAIImages.useMutation({
    onSuccess: (result) => {
      setAiPreviewImages(result.images);
      // 기본적으로 전체 선택
      setAiSelectedKeys(new Set(result.images.map((img) => img.key)));
      toast.success(`${result.images.length}장의 AI 이미지가 생성되었습니다. 원하는 이미지를 선택하세요.`);
    },
    onError: (e) => toast.error(e.message),
  });

  const saveSelectedAIImagesMutation = trpc.packages.saveSelectedAIImages.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.saved}장의 이미지가 등록되었습니다.`);
      setAiPreviewImages([]);
      setAiSelectedKeys(new Set());
      refetchImages();
      utils.packages.get.invalidate({ id });
    },
    onError: (e) => toast.error('등록 실패: ' + e.message),
  });

  const handleAddAiKeyword = () => {
    const kw = aiKeywordInput.trim();
    if (!kw) return;
    if (aiKeywords.includes(kw)) { toast.error('이미 추가된 키워드입니다.'); return; }
    setAiKeywords((prev) => [...prev, kw]);
    setAiKeywordInput('');
  };

  const handleRemoveAiKeyword = (kw: string) => {
    setAiKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const toggleAiImageSelect = (key: string) => {
    setAiSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
            <TabsTrigger value="video">동영상 생성</TabsTrigger>
            <TabsTrigger value="automation">자동화</TabsTrigger>
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
                <p className="text-xs text-slate-400 mt-1">여러 장을 한 번에 생성하고 원하는 이미지만 선택하여 등록할 수 있습니다</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 상품 기본 정보 */}
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">기본 상품 정보 (자동 적용)</p>
                  <p className="text-sm text-slate-700 font-medium">{data.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {[data.country, data.region].filter(Boolean).join(' · ')}
                  </p>
                </div>

                {/* 키워드 입력 */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    핵심 키워드 <span className="text-slate-400 font-normal text-xs">(Enter 또는 + 버튼으로 추가)</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={aiKeywordInput}
                      onChange={(e) => setAiKeywordInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAiKeyword(); } }}
                      placeholder="예: sunrise, ocean view, luxury resort, morning fog"
                      className="h-9"
                      disabled={generateAIImagesMutation.isPending}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddAiKeyword}
                      disabled={!aiKeywordInput.trim() || generateAIImagesMutation.isPending}
                      className="h-9 shrink-0 border-purple-300 text-purple-600 hover:bg-purple-50"
                    >
                      <Plus size={14} />
                    </Button>
                  </div>

                  {/* 키워드 태그 목록 */}
                  {aiKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {aiKeywords.map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full font-medium"
                        >
                          {kw}
                          <button
                            type="button"
                            onClick={() => handleRemoveAiKeyword(kw)}
                            disabled={generateAIImagesMutation.isPending}
                            className="hover:text-purple-900 disabled:opacity-50 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAiKeywords([])}
                        disabled={generateAIImagesMutation.isPending}
                        className="text-xs text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        전체 삭제
                      </button>
                    </div>
                  )}
                  {aiKeywords.length === 0 && (
                    <p className="text-xs text-slate-400 mt-2">키워드가 없으면 상품명과 목적지 정보만으로 AI 이미지를 생성합니다</p>
                  )}
                </div>

                {/* 생성 장수 선택 + 생성 버튼 */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">생성 장수</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setAiGenerateCount(n)}
                          disabled={generateAIImagesMutation.isPending}
                          className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                            aiGenerateCount === n
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-purple-100 hover:text-purple-700'
                          } disabled:opacity-50`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-slate-400">장</span>
                  </div>
                  <Button
                    onClick={() => {
                      setAiPreviewImages([]);
                      setAiSelectedKeys(new Set());
                      generateAIImagesMutation.mutate({
                        packageId: id,
                        packageTitle: data.title,
                        country: data.country ?? undefined,
                        region: data.region ?? undefined,
                        keywords: aiKeywords.length > 0 ? aiKeywords : undefined,
                        count: aiGenerateCount,
                      });
                    }}
                    disabled={generateAIImagesMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {generateAIImagesMutation.isPending ? (
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

                {/* 로딩 상태 */}
                {generateAIImagesMutation.isPending && (
                  <div className="p-4 bg-purple-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Loader2 size={20} className="animate-spin text-purple-500" />
                      <div>
                        <p className="text-sm font-medium text-purple-700">AI 이미지 {aiGenerateCount}장 생성 중...</p>
                        <p className="text-xs text-purple-500 mt-0.5">병렬 생성 중입니다. 장수에 따라 10~60초 소요될 수 있습니다.</p>
                        {aiKeywords.length > 0 && (
                          <p className="text-xs text-purple-400 mt-1">적용 키워드: {aiKeywords.join(', ')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 생성 결과 미리보기 그리드 */}
                {aiPreviewImages.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">
                        생성 결과 ({aiPreviewImages.length}장) — 등록할 이미지를 선택하세요
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAiSelectedKeys(new Set(aiPreviewImages.map((img) => img.key)))}
                          className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                        >
                          전체 선택
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setAiSelectedKeys(new Set())}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          선택 해제
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {aiPreviewImages.map((img) => {
                        const isSelected = aiSelectedKeys.has(img.key);
                        return (
                          <div
                            key={img.key}
                            onClick={() => toggleAiImageSelect(img.key)}
                            className={`relative rounded-xl overflow-hidden cursor-pointer transition-all ${
                              isSelected
                                ? 'ring-2 ring-purple-500 ring-offset-2'
                                : 'ring-1 ring-slate-200 opacity-60 hover:opacity-80'
                            }`}
                          >
                            <img
                              src={img.url}
                              alt="AI 생성 이미지"
                              className="w-full aspect-[4/3] object-cover"
                            />
                            {/* 선택 체크 표시 */}
                            <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                              isSelected ? 'bg-purple-600' : 'bg-white/80 border border-slate-300'
                            }`}>
                              {isSelected && (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 등록 버튼 */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <p className="text-xs text-slate-500">
                        {aiSelectedKeys.size}장 선택됨
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { setAiPreviewImages([]); setAiSelectedKeys(new Set()); }}
                          className="text-slate-500"
                        >
                          초기화
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const selected = aiPreviewImages.filter((img) => aiSelectedKeys.has(img.key));
                            if (selected.length === 0) { toast.error('선택된 이미지가 없습니다.'); return; }
                            saveSelectedAIImagesMutation.mutate({
                              packageId: id,
                              packageTitle: data.title,
                              selectedImages: selected.map((img) => ({ storageUrl: img.storageUrl, key: img.key })),
                            });
                          }}
                          disabled={aiSelectedKeys.size === 0 || saveSelectedAIImagesMutation.isPending}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          {saveSelectedAIImagesMutation.isPending ? (
                            <><Loader2 size={12} className="animate-spin mr-1" />등록 중...</>
                          ) : (
                            `선택한 ${aiSelectedKeys.size}장 등록`
                          )}
                        </Button>
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
            {/* 등록 모드 전환 */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={slotMode === "single" ? "default" : "outline"}
                onClick={() => setSlotMode("single")}
                className={slotMode === "single" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}
              >
                개별 등록
              </Button>
              <Button
                size="sm"
                variant={slotMode === "batch" ? "default" : "outline"}
                onClick={() => setSlotMode("batch")}
                className={slotMode === "batch" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}
              >
                일괄 등록
              </Button>
            </div>

            {/* 개별 등록 폼 */}
            {slotMode === "single" && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">출발일 개별 등록</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                      <Label>최소 출발 인원</Label>
                      <Input type="number" value={slotForm.minPax} onChange={(e) => setSlotForm({ ...slotForm, minPax: Number(e.target.value) })} className="mt-1 h-9" min={1} />
                    </div>
                    <div>
                      <Label>성인 요금 (원)</Label>
                      <Input value={slotForm.adultPrice} onChange={(e) => setSlotForm({ ...slotForm, adultPrice: e.target.value })} placeholder="기본 요금 사용" className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label>아동 요금 (원)</Label>
                      <Input value={slotForm.childPrice} onChange={(e) => setSlotForm({ ...slotForm, childPrice: e.target.value })} placeholder="성인과 동일" className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label>유아 요금 (원)</Label>
                      <Input value={slotForm.infantPrice} onChange={(e) => setSlotForm({ ...slotForm, infantPrice: e.target.value })} placeholder="성인과 동일" className="mt-1 h-9" />
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
                    <div className="md:col-span-3">
                      <Label>메모 (선택)</Label>
                      <Input value={slotForm.notes} onChange={(e) => setSlotForm({ ...slotForm, notes: e.target.value })} placeholder="예: 주말 특가, 얼리버드" className="mt-1 h-9" />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={() => addSlotMutation.mutate({
                          packageId: id,
                          departureDate: new Date(slotForm.departureDate),
                          returnDate: slotForm.returnDate ? new Date(slotForm.returnDate) : undefined,
                          totalSlots: slotForm.totalSlots,
                          minPax: slotForm.minPax,
                          status: slotForm.status,
                          adultPrice: slotForm.adultPrice || undefined,
                          childPrice: slotForm.childPrice || undefined,
                          infantPrice: slotForm.infantPrice || undefined,
                          notes: slotForm.notes || undefined,
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
            )}

            {/* 일괄 등록 폼 */}
            {slotMode === "batch" && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">출발일 일괄 등록</CardTitle>
                  <p className="text-xs text-slate-400 mt-1">날짜 범위와 요일 패턴으로 여러 출발일을 한 번에 등록합니다</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label>시작일 *</Label>
                      <Input type="date" value={batchForm.startDate} onChange={(e) => setBatchForm({ ...batchForm, startDate: e.target.value })} className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label>종료일 *</Label>
                      <Input type="date" value={batchForm.endDate} onChange={(e) => setBatchForm({ ...batchForm, endDate: e.target.value })} className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label>박수</Label>
                      <Input type="number" value={batchForm.nights} onChange={(e) => setBatchForm({ ...batchForm, nights: Number(e.target.value) })} className="mt-1 h-9" min={1} />
                    </div>
                    <div>
                      <Label>총 정원</Label>
                      <Input type="number" value={batchForm.totalSlots} onChange={(e) => setBatchForm({ ...batchForm, totalSlots: Number(e.target.value) })} className="mt-1 h-9" min={1} />
                    </div>
                    <div className="md:col-span-4">
                      <Label>출발 요일 선택 (미선택 시 전체 날짜)</Label>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {["일","월","화","수","목","금","토"].map((day, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              const cur = batchForm.weekdays;
                              setBatchForm({ ...batchForm, weekdays: cur.includes(i) ? cur.filter(d => d !== i) : [...cur, i] });
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                              batchForm.weekdays.includes(i)
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400"
                            } ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : ""}`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>성인 요금 (원)</Label>
                      <Input value={batchForm.adultPrice} onChange={(e) => setBatchForm({ ...batchForm, adultPrice: e.target.value })} placeholder="기본 요금 사용" className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label>아동 요금 (원)</Label>
                      <Input value={batchForm.childPrice} onChange={(e) => setBatchForm({ ...batchForm, childPrice: e.target.value })} placeholder="성인과 동일" className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label>유아 요금 (원)</Label>
                      <Input value={batchForm.infantPrice} onChange={(e) => setBatchForm({ ...batchForm, infantPrice: e.target.value })} placeholder="성인과 동일" className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label>최소 출발 인원</Label>
                      <Input type="number" value={batchForm.minPax} onChange={(e) => setBatchForm({ ...batchForm, minPax: Number(e.target.value) })} className="mt-1 h-9" min={1} />
                    </div>
                    <div className="md:col-span-3">
                      <Label>메모 (선택)</Label>
                      <Input value={batchForm.notes} onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })} placeholder="예: 주말 특가" className="mt-1 h-9" />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={() => addSlotBatchMutation.mutate({
                          packageId: id,
                          startDate: new Date(batchForm.startDate),
                          endDate: new Date(batchForm.endDate),
                          weekdays: batchForm.weekdays.length > 0 ? batchForm.weekdays : undefined,
                          nights: batchForm.nights,
                          totalSlots: batchForm.totalSlots,
                          minPax: batchForm.minPax,
                          adultPrice: batchForm.adultPrice || undefined,
                          childPrice: batchForm.childPrice || undefined,
                          infantPrice: batchForm.infantPrice || undefined,
                          notes: batchForm.notes || undefined,
                        })}
                        disabled={!batchForm.startDate || !batchForm.endDate || addSlotBatchMutation.isPending}
                        className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white w-full"
                      >
                        <Plus size={14} className="mr-1" /> 일괄 추가
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 슬롯 목록 */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">등록된 출발일 ({data.slots?.length ?? 0}개)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!data.slots?.length ? (
                  <div className="py-10 text-center text-slate-400 text-sm">등록된 출발일이 없습니다</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="text-left px-4 py-3 text-slate-500 font-medium">출발일</th>
                          <th className="text-left px-3 py-3 text-slate-500 font-medium">귀국일</th>
                          <th className="text-center px-3 py-3 text-slate-500 font-medium">정원/예약</th>
                          <th className="text-center px-3 py-3 text-slate-500 font-medium">최소인원</th>
                          <th className="text-right px-3 py-3 text-slate-500 font-medium">성인요금</th>
                          <th className="text-right px-3 py-3 text-slate-500 font-medium">아동요금</th>
                          <th className="text-left px-3 py-3 text-slate-500 font-medium">상태</th>
                          <th className="text-right px-4 py-3 text-slate-500 font-medium">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.slots.map((slot: any) => {
                          const remaining = slot.totalSlots - slot.bookedSlots;
                          const isEditing = editingSlotId === slot.id;
                          return (
                            <tr key={slot.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                                {new Date(slot.departureDate).toLocaleDateString("ko-KR")}
                              </td>
                              <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                                {slot.returnDate ? new Date(slot.returnDate).toLocaleDateString("ko-KR") : "-"}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {isEditing ? (
                                  <Input type="number" value={editSlotForm.totalSlots} onChange={(e) => setEditSlotForm({ ...editSlotForm, totalSlots: Number(e.target.value) })} className="h-7 w-20 text-center mx-auto" min={1} />
                                ) : (
                                  <span>
                                    <span className="text-slate-800 font-medium">{slot.bookedSlots}</span>
                                    <span className="text-slate-400"> / {slot.totalSlots}</span>
                                    <span className={`ml-1 text-xs ${remaining <= 3 ? "text-red-500" : "text-green-600"}`}>(잔여 {remaining})</span>
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {isEditing ? (
                                  <Input type="number" value={editSlotForm.minPax} onChange={(e) => setEditSlotForm({ ...editSlotForm, minPax: Number(e.target.value) })} className="h-7 w-16 text-center mx-auto" min={1} />
                                ) : (
                                  <span className="text-slate-600">{slot.minPax ?? 3}명</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-right">
                                {isEditing ? (
                                  <Input value={editSlotForm.adultPrice} onChange={(e) => setEditSlotForm({ ...editSlotForm, adultPrice: e.target.value })} className="h-7 w-28 text-right" placeholder="기본요금" />
                                ) : (
                                  <span className="text-slate-700">
                                    {slot.adultPrice ? `${Number(slot.adultPrice).toLocaleString()}원` : <span className="text-slate-400 text-xs">기본요금</span>}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-right">
                                {isEditing ? (
                                  <Input value={editSlotForm.childPrice} onChange={(e) => setEditSlotForm({ ...editSlotForm, childPrice: e.target.value })} className="h-7 w-28 text-right" placeholder="성인동일" />
                                ) : (
                                  <span className="text-slate-700">
                                    {slot.childPrice ? `${Number(slot.childPrice).toLocaleString()}원` : <span className="text-slate-400 text-xs">성인동일</span>}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                {isEditing ? (
                                  <Select value={editSlotForm.status} onValueChange={(v) => setEditSlotForm({ ...editSlotForm, status: v })}>
                                    <SelectTrigger className="h-7 w-24"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="open">모집중</SelectItem>
                                      <SelectItem value="closed">마감</SelectItem>
                                      <SelectItem value="sold_out">매진</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge className={`text-xs ${slot.status === "open" ? "bg-green-50 text-green-700" : slot.status === "sold_out" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                                    {slot.status === "open" ? "모집중" : slot.status === "sold_out" ? "매진" : "마감"}
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {isEditing ? (
                                    <>
                                      <Button size="sm" className="h-7 px-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => updateSlotMutation.mutate({ id: slot.id, totalSlots: editSlotForm.totalSlots, minPax: editSlotForm.minPax, status: editSlotForm.status, adultPrice: editSlotForm.adultPrice || undefined, childPrice: editSlotForm.childPrice || undefined, infantPrice: editSlotForm.infantPrice || undefined })} disabled={updateSlotMutation.isPending}>저장</Button>
                                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500" onClick={() => { setEditingSlotId(null); setEditSlotForm(null); }}>취소</Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600" onClick={() => { setEditingSlotId(slot.id); setEditSlotForm({ totalSlots: slot.totalSlots, minPax: slot.minPax ?? 3, status: slot.status, adultPrice: slot.adultPrice ?? "", childPrice: slot.childPrice ?? "", infantPrice: slot.infantPrice ?? "" }); }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-600" onClick={() => deleteSlotMutation.mutate({ id: slot.id })}>
                                        <Trash2 size={13} />
                                      </Button>
                                    </>
                                  )}
                                </div>
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
          </TabsContent>

          {/* ─── 동영상 생성 탭 ─── */}
          <TabsContent value="video" className="space-y-4">
            <VideoGenerationTab packageId={id} packageData={data} />
          </TabsContent>

          {/* ─── 자동화 탭 ─── */}
          <TabsContent value="automation" className="space-y-4">
            <AutomationTab packageId={id} packageData={data} />
          </TabsContent>
        </Tabs>
      </div>
    </ERPLayout>
  );
}

// ─── 동영상 생성 탭 컴포넌트 ────────────────────────────────────
function VideoGenerationTab({ packageId, packageData }: { packageId: number; packageData: any }) {
  const utils = trpc.useUtils();
  const [imageUrl, setImageUrl] = useState("");
  const [durationSec, setDurationSec] = useState<5 | 10>(10);
  const [activeTask, setActiveTask] = useState<{ taskId: string; videoId: number } | null>(null);

  const { data: videos, isLoading: videosLoading } = trpc.video.listByPackage.useQuery({ packageId });

  const generateMutation = trpc.video.generate.useMutation({
    onSuccess: (result) => {
      toast.success("동영상 생성이 시작되었습니다. 완료까지 약 2~5분 소요됩니다.");
      setActiveTask({ taskId: result.taskId!, videoId: result.videoId });
      utils.video.listByPackage.invalidate({ packageId });
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: taskStatus } = trpc.video.checkStatus.useQuery(
    activeTask ? { taskId: activeTask.taskId, videoId: activeTask.videoId } : { taskId: "", videoId: 0 },
    {
      enabled: !!activeTask,
      refetchInterval: activeTask ? 5000 : false, // 5초마다 폴링
    }
  );

  // 완료 시 폴링 중단 - useEffect로 안전하게 처리
  useEffect(() => {
    if (taskStatus?.status === "succeeded" || taskStatus?.status === "failed") {
      setActiveTask(null);
      utils.video.listByPackage.invalidate({ packageId });
      if (taskStatus.status === "succeeded") {
        toast.success("동영상 생성이 완료되었습니다!");
      } else {
        toast.error("동영상 생성에 실패했습니다.");
      }
    }
  }, [taskStatus?.status]);

  // 첫 번째 이미지 URL 자동 설정
  const firstImageUrl = packageData?.images?.[0]?.imageUrl ?? packageData?.imageUrl ?? "";

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Video size={16} className="text-indigo-600" />
            Runway ML 동영상 생성
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-700">
            <p className="font-medium mb-1">AI 홍보 동영상 자동 생성</p>
            <p>패키지 이미지를 기반으로 10초 골프여행 홍보 동영상을 자동 생성합니다.</p>
            <p className="mt-1">RUNWAY_API_KEY 미설정 시 개발 모드로 동작합니다.</p>
          </div>
          <div>
            <Label>입력 이미지 URL</Label>
            <Input
              value={imageUrl || firstImageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/golf-image.jpg"
              className="mt-1 h-9"
            />
            {firstImageUrl && !imageUrl && (
              <p className="text-xs text-slate-400 mt-1">패키지 첫 번째 이미지 자동 선택됨</p>
            )}
          </div>
          <div>
            <Label>동영상 길이</Label>
            <div className="flex gap-2 mt-1">
              {([5, 10] as const).map((sec) => (
                <Button
                  key={sec}
                  variant={durationSec === sec ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDurationSec(sec)}
                  className={durationSec === sec ? "bg-indigo-600 text-white" : ""}
                >
                  {sec}초
                </Button>
              ))}
            </div>
          </div>
          <Button
            onClick={() => generateMutation.mutate({
              packageId,
              imageUrl: imageUrl || firstImageUrl,
              durationSec,
            })}
            disabled={generateMutation.isPending || !!activeTask || !(imageUrl || firstImageUrl)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white w-full"
          >
            {generateMutation.isPending || activeTask ? (
              <><Loader2 size={14} className="animate-spin mr-2" />생성 중...</>
            ) : (
              <><Video size={14} className="mr-2" />동영상 생성 시작</>
            )}
          </Button>

          {activeTask && taskStatus && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-amber-600" />
                <span className="text-amber-700 font-medium">생성 중... {taskStatus.progress ? `${Math.round(taskStatus.progress * 100)}%` : ""}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 생성된 동영상 목록 */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">생성된 동영상 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {videosLoading ? (
            <p className="text-sm text-slate-400">로딩 중...</p>
          ) : !videos?.length ? (
            <p className="text-sm text-slate-400">생성된 동영상이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {videos.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    {v.status === "ready" ? <CheckCircle size={14} className="text-green-500" /> :
                     v.status === "failed" ? <XCircle size={14} className="text-red-500" /> :
                     <Clock size={14} className="text-amber-500" />}
                    <span className="text-sm text-slate-700">{v.title || "동영상"}</span>
                    <Badge className="text-xs bg-slate-100 text-slate-600">{v.durationSec}초</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {v.videoUrl && (
                      <a href={v.videoUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:text-indigo-800 underline">재생</a>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(v.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 자동화 탭 컴포넌트 ─────────────────────────────────────────
function AutomationTab({ packageId, packageData }: { packageId: number; packageData: any }) {
  const utils = trpc.useUtils();
  const { data: logs, isLoading: logsLoading } = trpc.automation.getLogs.useQuery({ limit: 10, packageId });

  const triggerMutation = trpc.automation.triggerPackagePublish.useMutation({
    onSuccess: (result) => {
      toast.success(`SNS 배포 완료 (${result.durationMs}ms)`);
      utils.automation.getLogs.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            n8n 자동화 파이프라인
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
            <p className="font-medium mb-1">자동화 파이프라인 안내</p>
            <p>n8n 웹훅을 통해 패키지 정보를 SNS(인스타그램, 카카오채널 등)에 자동 배포합니다.</p>
            <p className="mt-1">N8N_WEBHOOK_URL 환경변수 설정 시 실제 배포됩니다.</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-slate-700 text-sm">SNS 자동 배포</p>
                  <p className="text-xs text-slate-400 mt-0.5">{packageData?.title} 패키지를 SNS에 배포합니다</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => triggerMutation.mutate({ packageId })}
                  disabled={triggerMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {triggerMutation.isPending ? (
                    <><Loader2 size={12} className="animate-spin mr-1" />실행 중...</>
                  ) : (
                    <><Zap size={12} className="mr-1" />배포 실행</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 자동화 실행 이력 */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">최근 실행 이력</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <p className="text-sm text-slate-400">로딩 중...</p>
          ) : !logs?.length ? (
            <p className="text-sm text-slate-400">실행 이력이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    {log.status === "success" ? <CheckCircle size={14} className="text-green-500" /> :
                     log.status === "failed" ? <XCircle size={14} className="text-red-500" /> :
                     <Clock size={14} className="text-amber-500" />}
                    <span className="text-slate-700">{log.pipelineName}</span>
                    {log.durationMs && <span className="text-xs text-slate-400">{log.durationMs}ms</span>}
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(log.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
