// ============================================================
// DOGOLF CMS 배너 관리 — 3가지 이미지 업로드 방식
// 1. 직접 업로드 (로컬 파일 → S3)
// 2. AI 이미지 생성 (프롬프트 → AI → S3)
// 3. 자동 3개 생성 (국가 선택 → AI 일괄 생성)
// ============================================================
import { useState, useRef } from "react";
import ERPLayout from "@/components/ERPLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Edit, Trash2, Image, Upload, Sparkles, Wand2, Loader2,
  GripVertical, ExternalLink, Eye, EyeOff,
} from "lucide-react";

const COUNTRIES = [
  { id: 'korea',       label: '🇰🇷 대한민국' },
  { id: 'thailand',    label: '🇹🇭 태국' },
  { id: 'vietnam',     label: '🇻🇳 베트남' },
  { id: 'philippines', label: '🇵🇭 필리핀' },
  { id: 'china',       label: '🇨🇳 중국' },
  { id: 'japan',       label: '🇯🇵 일본' },
];

// ─── 배너 폼 다이얼로그 ───────────────────────────────────────────────────────
function BannerFormDialog({
  open, onClose, editBanner,
}: {
  open: boolean;
  onClose: () => void;
  editBanner?: any;
}) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: editBanner?.title || "",
    subtitle: editBanner?.subtitle || "",
    imageUrl: editBanner?.imageUrl || "",
    linkUrl: editBanner?.linkUrl || "",
    sortOrder: editBanner?.sortOrder ?? 0,
    isActive: editBanner?.isActive ?? true,
  });
  const [uploadTab, setUploadTab] = useState<"url" | "upload" | "ai">("url");
  const [aiCountry, setAiCountry] = useState("thailand");
  const [aiRegion, setAiRegion] = useState("");
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [previewUrl, setPreviewUrl] = useState(editBanner?.imageUrl || "");
  const [isUploading, setIsUploading] = useState(false);

  const createMutation = trpc.cms.createBanner.useMutation({
    onSuccess: () => {
      toast.success("배너가 등록되었습니다.");
      utils.cms.listBanners.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.cms.updateBannerFull.useMutation({
    onSuccess: () => {
      toast.success("배너가 수정되었습니다.");
      utils.cms.listBanners.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const uploadImageMutation = trpc.cms.uploadBannerImage.useMutation({
    onSuccess: (data) => {
      setForm((f) => ({ ...f, imageUrl: data.url }));
      setPreviewUrl(data.url);
      setIsUploading(false);
      toast.success("이미지가 업로드되었습니다.");
    },
    onError: (e) => {
      setIsUploading(false);
      toast.error(e.message);
    },
  });
  const generateImageMutation = trpc.cms.generateBannerImage.useMutation({
    onSuccess: (data) => {
      setForm((f) => ({ ...f, imageUrl: data.url }));
      setPreviewUrl(data.url);
      toast.success("AI 이미지가 생성되었습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("파일 크기는 10MB 이하여야 합니다.");
      return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadImageMutation.mutate({
        fileName: file.name,
        mimeType: file.type,
        base64Data: base64,
        bannerId: editBanner?.id,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateAI = () => {
    generateImageMutation.mutate({
      country: aiCountry,
      region: aiRegion || undefined,
      customPrompt: aiCustomPrompt || undefined,
      bannerId: editBanner?.id,
    });
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return toast.error("배너 제목을 입력해주세요.");
    if (!form.imageUrl.trim()) return toast.error("이미지를 설정해주세요.");
    if (editBanner) {
      updateMutation.mutate({
        id: editBanner.id,
        title: form.title,
        subtitle: form.subtitle || undefined,
        imageUrl: form.imageUrl,
        linkUrl: form.linkUrl || undefined,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
      });
    } else {
      createMutation.mutate({
        title: form.title,
        subtitle: form.subtitle || undefined,
        imageUrl: form.imageUrl,
        linkUrl: form.linkUrl || undefined,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isGenerating = generateImageMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editBanner ? "배너 수정" : "배너 등록"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>배너 제목 *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="예: 태국 특가 프로모션"
                className="mt-1"
              />
            </div>
            <div className="col-span-2">
              <Label>부제목</Label>
              <Input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                placeholder="예: 최대 30% 할인 특가 패키지"
                className="mt-1"
              />
            </div>
            <div>
              <Label>링크 URL</Label>
              <Input
                value={form.linkUrl}
                onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                placeholder="/packages/thailand"
                className="mt-1"
              />
            </div>
            <div>
              <Label>정렬 순서</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                className="mt-1"
                min={0}
              />
            </div>
          </div>

          {/* 이미지 설정 */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">이미지 설정 *</Label>
            <Tabs value={uploadTab} onValueChange={(v) => setUploadTab(v as any)}>
              <TabsList className="grid grid-cols-3 mb-3">
                <TabsTrigger value="url" className="text-xs">
                  <ExternalLink size={12} className="mr-1" /> URL 입력
                </TabsTrigger>
                <TabsTrigger value="upload" className="text-xs">
                  <Upload size={12} className="mr-1" /> 직접 업로드
                </TabsTrigger>
                <TabsTrigger value="ai" className="text-xs">
                  <Sparkles size={12} className="mr-1" /> AI 생성
                </TabsTrigger>
              </TabsList>

              {/* URL 입력 탭 */}
              <TabsContent value="url">
                <Input
                  value={form.imageUrl}
                  onChange={(e) => {
                    setForm({ ...form, imageUrl: e.target.value });
                    setPreviewUrl(e.target.value);
                  }}
                  placeholder="https://... 또는 /manus-storage/..."
                />
              </TabsContent>

              {/* 직접 업로드 탭 */}
              <TabsContent value="upload">
                <div
                  className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading || uploadImageMutation.isPending ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={28} className="animate-spin text-indigo-500" />
                      <p className="text-sm text-slate-500">업로드 중...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload size={28} className="text-slate-400" />
                      <p className="text-sm font-medium text-slate-600">클릭하여 이미지 선택</p>
                      <p className="text-xs text-slate-400">JPG, PNG, WebP · 최대 10MB · 자동 최적화</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </TabsContent>

              {/* AI 생성 탭 */}
              <TabsContent value="ai">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">국가</Label>
                      <select
                        value={aiCountry}
                        onChange={(e) => setAiCountry(e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-white"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">지역 (선택)</Label>
                      <Input
                        value={aiRegion}
                        onChange={(e) => setAiRegion(e.target.value)}
                        placeholder="예: 파타야, 하노이"
                        className="mt-1 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">커스텀 프롬프트 (선택 - 비워두면 자동 생성)</Label>
                    <Textarea
                      value={aiCustomPrompt}
                      onChange={(e) => setAiCustomPrompt(e.target.value)}
                      placeholder="예: Tropical golf resort in Pattaya Thailand at sunset..."
                      className="mt-1 text-sm resize-none"
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={handleGenerateAI}
                    disabled={isGenerating}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90"
                  >
                    {isGenerating ? (
                      <><Loader2 size={14} className="animate-spin mr-2" /> AI 이미지 생성 중 (10~20초)...</>
                    ) : (
                      <><Wand2 size={14} className="mr-2" /> AI 이미지 생성</>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* 미리보기 */}
          {(previewUrl || form.imageUrl) && (
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">이미지 미리보기</Label>
              <div className="rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                <img
                  src={previewUrl || form.imageUrl}
                  alt="배너 미리보기"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            </div>
          )}

          {/* 활성화 */}
          <div className="flex items-center gap-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm({ ...form, isActive: v })}
            />
            <Label>활성화 (홈페이지에 노출)</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
            {editBanner ? "수정 저장" : "배너 등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 자동 일괄 생성 다이얼로그 ───────────────────────────────────────────────
function BatchGenerateDialog({
  open, onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['thailand', 'vietnam', 'japan']);

  const batchMutation = trpc.cms.generateBannerBatch.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count}개 배너가 자동 생성되었습니다.`);
      utils.cms.listBanners.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleCountry = (id: string) => {
    setSelectedCountries((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🤖 AI 배너 자동 생성</DialogTitle>
        </DialogHeader>
        <div className="py-3 space-y-4">
          <p className="text-sm text-slate-500">
            선택한 국가별로 AI가 골프 배너 이미지를 자동 생성합니다.<br />
            각 이미지 생성에 10~20초가 소요됩니다.
          </p>
          <div>
            <Label className="text-sm font-semibold mb-2 block">국가 선택 (최대 6개)</Label>
            <div className="grid grid-cols-2 gap-2">
              {COUNTRIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleCountry(c.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                    selectedCountries.includes(c.id)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          {batchMutation.isPending && (
            <div className="flex items-center gap-2 bg-indigo-50 rounded-lg p-3">
              <Loader2 size={16} className="animate-spin text-indigo-600" />
              <p className="text-sm text-indigo-700">
                AI 이미지 생성 중... ({selectedCountries.length}개 · 최대 {selectedCountries.length * 20}초 소요)
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            onClick={() => batchMutation.mutate({ countries: selectedCountries })}
            disabled={selectedCountries.length === 0 || batchMutation.isPending}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90"
          >
            {batchMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin mr-1" /> 생성 중...</>
            ) : (
              <><Sparkles size={14} className="mr-1" /> {selectedCountries.length}개 자동 생성</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function CMSBannersPage() {
  const [showForm, setShowForm] = useState(false);
  const [editBanner, setEditBanner] = useState<any>(null);
  const [showBatch, setShowBatch] = useState(false);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.cms.listBanners.useQuery();

  const toggleActiveMutation = trpc.cms.updateBannerFull.useMutation({
    onSuccess: () => utils.cms.listBanners.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.cms.deleteBanner.useMutation({
    onSuccess: () => {
      toast.success("배너가 삭제되었습니다.");
      utils.cms.listBanners.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <ERPLayout>
      <div className="space-y-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">배너 관리</h1>
            <p className="text-slate-500 text-sm mt-1">홈페이지 메인 슬라이드 배너를 관리합니다</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowBatch(true)}
              className="border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <Sparkles size={15} className="mr-1" /> AI 자동 생성
            </Button>
            <Button
              onClick={() => { setEditBanner(null); setShowForm(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus size={16} className="mr-1" /> 배너 등록
            </Button>
          </div>
        </div>

        {/* 안내 카드 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Upload size={16} />, title: "직접 업로드", desc: "로컬 이미지 파일을 S3에 업로드 (자동 최적화)", color: "bg-blue-50 text-blue-700 border-blue-100" },
            { icon: <Wand2 size={16} />, title: "AI 이미지 생성", desc: "국가/지역 선택 후 AI가 골프 배너 이미지 생성", color: "bg-purple-50 text-purple-700 border-purple-100" },
            { icon: <Sparkles size={16} />, title: "자동 일괄 생성", desc: "국가별 배너를 AI가 한 번에 자동 생성", color: "bg-amber-50 text-amber-700 border-amber-100" },
          ].map((item) => (
            <div key={item.title} className={`rounded-xl border p-3 ${item.color}`}>
              <div className="flex items-center gap-2 mb-1">
                {item.icon}
                <span className="text-sm font-semibold">{item.title}</span>
              </div>
              <p className="text-xs opacity-80">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* 배너 목록 */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-20 text-center text-slate-400">
                <Loader2 size={28} className="animate-spin mx-auto mb-3" />
                <p>배너 목록 로딩 중...</p>
              </div>
            ) : !data?.length ? (
              <div className="py-20 text-center">
                <Image size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 mb-2">등록된 배너가 없습니다</p>
                <p className="text-xs text-slate-400 mb-4">AI 자동 생성으로 빠르게 배너를 만들어 보세요</p>
                <div className="flex items-center justify-center gap-2">
                  <Button onClick={() => setShowBatch(true)} variant="outline" size="sm" className="border-purple-200 text-purple-700">
                    <Sparkles size={13} className="mr-1" /> AI 자동 생성
                  </Button>
                  <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
                    <Plus size={13} className="mr-1" /> 직접 등록
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.map((banner: any) => (
                  <div key={banner.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                    {/* 드래그 핸들 */}
                    <GripVertical size={16} className="text-slate-300 shrink-0 cursor-grab" />

                    {/* 이미지 썸네일 */}
                    <div className="w-28 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                      {banner.imageUrl ? (
                        <img
                          src={banner.imageUrl}
                          alt={banner.title}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Image size={20} />
                        </div>
                      )}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{banner.title}</p>
                      {banner.subtitle && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{banner.subtitle}</p>
                      )}
                      {banner.linkUrl && (
                        <p className="text-xs text-indigo-400 truncate mt-0.5">{banner.linkUrl}</p>
                      )}
                    </div>

                    {/* 메타 */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400">순서 {banner.sortOrder}</span>
                      <Badge className={`text-xs ${banner.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {banner.isActive ? "활성" : "비활성"}
                      </Badge>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 w-7 p-0 ${banner.isActive ? "text-green-500 hover:text-slate-400" : "text-slate-300 hover:text-green-500"}`}
                        title={banner.isActive ? "비활성화" : "활성화"}
                        onClick={() => toggleActiveMutation.mutate({ id: banner.id, isActive: !banner.isActive })}
                      >
                        {banner.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-amber-600"
                        onClick={() => { setEditBanner(banner); setShowForm(true); }}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                        onClick={() => {
                          if (confirm(`"${banner.title}" 배너를 삭제하시겠습니까?`)) {
                            deleteMutation.mutate({ id: banner.id });
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 다이얼로그 */}
      <BannerFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditBanner(null); }}
        editBanner={editBanner}
      />
      <BatchGenerateDialog
        open={showBatch}
        onClose={() => setShowBatch(false)}
      />
    </ERPLayout>
  );
}
