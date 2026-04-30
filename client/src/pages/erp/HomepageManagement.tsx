/**
 * CMS > 홈페이지 관리
 * 탭: 전역설정 / 네비게이션 / 히어로슬라이드 / 노출상품 / 푸터 / 사업자등록증OCR
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Globe, Navigation, Image, Package, AlignLeft, FileText,
  Plus, Trash2, GripVertical, Save, RefreshCw, Upload,
  CheckCircle, AlertTriangle, Eye, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── 탭 정의 ─────────────────────────────────────────────────
const TABS = [
  { id: "global", label: "전역 설정", icon: Globe },
  { id: "nav", label: "네비게이션", icon: Navigation },
  { id: "hero", label: "히어로 슬라이드", icon: Image },
  { id: "featured", label: "노출 상품", icon: Package },
  { id: "footer", label: "푸터 관리", icon: AlignLeft },
  { id: "ocr", label: "사업자등록증 OCR", icon: FileText },
];

// ─── 전역 설정 탭 ─────────────────────────────────────────────
function GlobalSettingsTab() {
  const { data: settings, refetch } = trpc.siteSettings.getSettings.useQuery();
  const updateMutation = trpc.siteSettings.updateSettings.useMutation({
    onSuccess: () => { toast.success("전역 설정이 저장되었습니다."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const merged = { ...(settings ?? {}), ...form };

  const handleChange = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));
  const handleSave = () => updateMutation.mutate(form);

  const fields = [
    { key: "site_title", label: "사이트 제목", type: "text" },
    { key: "site_description", label: "사이트 설명", type: "textarea" },
    { key: "site_keywords", label: "SEO 키워드 (쉼표 구분)", type: "text" },
    { key: "logo_url", label: "로고 이미지 URL", type: "text" },
    { key: "favicon_url", label: "파비콘 URL", type: "text" },
    { key: "og_image_url", label: "OG 대표 이미지 URL", type: "text" },
    { key: "ga_id", label: "Google Analytics ID (G-XXXXXXXX)", type: "text" },
    { key: "kakao_channel_url", label: "카카오채널 URL", type: "text" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">홈페이지 전역 설정</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("https://dayoutgolf.com", "_blank")}>
            <ExternalLink size={14} className="mr-1" /> 홈페이지 보기
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save size={14} className="mr-1" />
            {updateMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {fields.map((f) => (
          <div key={f.key}>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">{f.label}</Label>
            {f.type === "textarea" ? (
              <Textarea
                value={merged[f.key] ?? ""}
                onChange={(e) => handleChange(f.key, e.target.value)}
                rows={3}
                className="text-sm"
              />
            ) : (
              <Input
                value={merged[f.key] ?? ""}
                onChange={(e) => handleChange(f.key, e.target.value)}
                className="text-sm"
              />
            )}
          </div>
        ))}
      </div>

      {/* 미리보기 */}
      {(merged["site_title"] || merged["site_description"]) && (
        <Card className="bg-gray-50 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">검색 결과 미리보기</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-blue-600 text-base font-medium">{merged["site_title"] || "사이트 제목"}</p>
            <p className="text-green-700 text-xs">https://dayoutgolf.com</p>
            <p className="text-gray-600 text-sm mt-1">{merged["site_description"] || "사이트 설명"}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── 네비게이션 탭 ────────────────────────────────────────────
function NavigationTab() {
  const { data: navItems, refetch } = trpc.siteSettings.getNavItems.useQuery();
  const updateMutation = trpc.siteSettings.updateNavItems.useMutation({
    onSuccess: () => { toast.success("네비게이션이 저장되었습니다."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [items, setItems] = useState<Array<{
    id?: number; label: string; href: string; sortOrder: number;
    isVisible: boolean; openInNewTab: boolean; icon?: string | null;
  }>>([]);

  // navItems 로드 시 초기화
  const [initialized, setInitialized] = useState(false);
  if (navItems && !initialized) {
    setItems(navItems.map((n) => ({ ...n, openInNewTab: n.openInNewTab ?? false })));
    setInitialized(true);
  }

  const addItem = () => setItems((p) => [...p, { label: "", href: "", sortOrder: p.length, isVisible: true, openInNewTab: false }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: string, value: unknown) =>
    setItems((p) => p.map((item, idx) => idx === i ? { ...item, [key]: value } : item));
  const moveItem = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next.map((item, idx) => ({ ...item, sortOrder: idx })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">상단 네비게이션 메뉴</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addItem}><Plus size={14} className="mr-1" /> 항목 추가</Button>
          <Button size="sm" onClick={() => updateMutation.mutate(items)} disabled={updateMutation.isPending}>
            <Save size={14} className="mr-1" />
            {updateMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 p-3 bg-white border rounded-lg">
            <GripVertical size={16} className="text-gray-400 flex-shrink-0" />
            <div className="flex gap-2 flex-1 min-w-0">
              <Input
                placeholder="메뉴명"
                value={item.label}
                onChange={(e) => updateItem(i, "label", e.target.value)}
                className="text-sm w-32"
              />
              <Input
                placeholder="/packages/korea"
                value={item.href}
                onChange={(e) => updateItem(i, "href", e.target.value)}
                className="text-sm flex-1"
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1">
                <Switch
                  checked={item.isVisible}
                  onCheckedChange={(v) => updateItem(i, "isVisible", v)}
                  className="scale-75"
                />
                <span className="text-xs text-gray-500">노출</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30">
                  <ChevronUp size={12} />
                </button>
                <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30">
                  <ChevronDown size={12} />
                </button>
              </div>
              <button onClick={() => removeItem(i)} className="p-1 hover:bg-red-50 text-red-400 rounded">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
            네비게이션 항목이 없습니다. 항목 추가를 클릭하세요.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 히어로 슬라이드 탭 ───────────────────────────────────────
function HeroSlidesTab() {
  const { data: slides, refetch } = trpc.siteSettings.getHeroSlides.useQuery();
  const createMutation = trpc.siteSettings.createHeroSlide.useMutation({
    onSuccess: () => { toast.success("슬라이드가 추가되었습니다."); refetch(); setShowForm(false); setNewSlide(emptySlide()); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.siteSettings.updateHeroSlide.useMutation({
    onSuccess: () => { toast.success("슬라이드가 수정되었습니다."); refetch(); setEditId(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.siteSettings.deleteHeroSlide.useMutation({
    onSuccess: () => { toast.success("슬라이드가 삭제되었습니다."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const emptySlide = () => ({
    title: "", subtitle: "", description: "", imageUrl: "", mobileImageUrl: "",
    ctaText: "패키지 보기", ctaLink: "/packages", destination: "", sortOrder: 0, isActive: true,
  });

  const [showForm, setShowForm] = useState(false);
  const [newSlide, setNewSlide] = useState(emptySlide());
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, unknown>>({});

  const DESTINATIONS = [
    { id: "korea", name: "🇰🇷 대한민국" },
    { id: "thailand", name: "🇹🇭 태국" },
    { id: "vietnam", name: "🇻🇳 베트남" },
    { id: "philippines", name: "🇵🇭 필리핀" },
    { id: "china", name: "🇨🇳 중국" },
    { id: "japan", name: "🇯🇵 일본" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">히어로 슬라이드 관리</h3>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus size={14} className="mr-1" /> 슬라이드 추가</Button>
      </div>

      {/* 신규 추가 폼 */}
      {showForm && (
        <Card className="border-dogolf-green border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-dogolf-green">신규 슬라이드 추가</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">제목</Label>
                <Input value={newSlide.title} onChange={(e) => setNewSlide((p) => ({ ...p, title: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">부제목</Label>
                <Input value={newSlide.subtitle} onChange={(e) => setNewSlide((p) => ({ ...p, subtitle: e.target.value }))} className="text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">설명</Label>
              <Textarea value={newSlide.description} onChange={(e) => setNewSlide((p) => ({ ...p, description: e.target.value }))} rows={2} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">이미지 URL (데스크톱)</Label>
                <Input value={newSlide.imageUrl} onChange={(e) => setNewSlide((p) => ({ ...p, imageUrl: e.target.value }))} className="text-sm" placeholder="/manus-storage/..." />
              </div>
              <div>
                <Label className="text-xs">이미지 URL (모바일)</Label>
                <Input value={newSlide.mobileImageUrl} onChange={(e) => setNewSlide((p) => ({ ...p, mobileImageUrl: e.target.value }))} className="text-sm" placeholder="/manus-storage/..." />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">CTA 버튼 텍스트</Label>
                <Input value={newSlide.ctaText} onChange={(e) => setNewSlide((p) => ({ ...p, ctaText: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">CTA 링크</Label>
                <Input value={newSlide.ctaLink} onChange={(e) => setNewSlide((p) => ({ ...p, ctaLink: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">목적지</Label>
                <select
                  value={newSlide.destination}
                  onChange={(e) => setNewSlide((p) => ({ ...p, destination: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">선택</option>
                  {DESTINATIONS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={newSlide.isActive} onCheckedChange={(v) => setNewSlide((p) => ({ ...p, isActive: v }))} />
                <Label className="text-xs">활성화</Label>
              </div>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setNewSlide(emptySlide()); }}>취소</Button>
                <Button size="sm" onClick={() => createMutation.mutate(newSlide)} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "저장 중..." : "추가"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 슬라이드 목록 */}
      <div className="space-y-3">
        {(slides ?? []).map((slide) => (
          <Card key={slide.id} className={`${!slide.isActive ? "opacity-60" : ""}`}>
            <CardContent className="p-4">
              {editId === slide.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">제목</Label>
                      <Input
                        value={(editData.title as string) ?? slide.title ?? ""}
                        onChange={(e) => setEditData((p) => ({ ...p, title: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">부제목</Label>
                      <Input
                        value={(editData.subtitle as string) ?? slide.subtitle ?? ""}
                        onChange={(e) => setEditData((p) => ({ ...p, subtitle: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">이미지 URL</Label>
                    <Input
                      value={(editData.imageUrl as string) ?? slide.imageUrl ?? ""}
                      onChange={(e) => setEditData((p) => ({ ...p, imageUrl: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => { setEditId(null); setEditData({}); }}>취소</Button>
                    <Button size="sm" onClick={() => updateMutation.mutate({ id: slide.id, ...editData })} disabled={updateMutation.isPending}>
                      저장
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {slide.imageUrl && (
                    <img src={slide.imageUrl} alt={slide.title ?? ""} className="w-20 h-12 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{slide.title || "(제목 없음)"}</span>
                      <Badge variant={slide.isActive ? "default" : "secondary"} className="text-xs">
                        {slide.isActive ? "활성" : "비활성"}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{slide.subtitle}</p>
                    <p className="text-xs text-gray-400">{slide.destination}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => { setEditId(slide.id); setEditData({}); }}>수정</Button>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => updateMutation.mutate({ id: slide.id, isActive: !slide.isActive })}
                    >
                      {slide.isActive ? "비활성화" : "활성화"}
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate({ id: slide.id }); }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {(slides ?? []).length === 0 && !showForm && (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
            슬라이드가 없습니다. 슬라이드 추가를 클릭하세요.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 노출 상품 탭 ─────────────────────────────────────────────
function FeaturedPackagesTab() {
  const { data: featured, refetch } = trpc.siteSettings.getFeaturedPackages.useQuery();
  const { data: allPkgs } = trpc.packages.list.useQuery({ page: 1, limit: 100, status: "active" });
  const setMutation = trpc.siteSettings.setFeaturedPackages.useMutation({
    onSuccess: () => { toast.success("노출 상품이 저장되었습니다."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const SECTIONS = [
    { id: "recommended", label: "추천 상품" },
    { id: "popular", label: "인기 상품" },
    { id: "new", label: "신규 상품" },
    { id: "special", label: "특가 상품" },
  ];

  const [items, setItems] = useState<Array<{ packageId: number; section: string; sortOrder: number; isActive: boolean }>>([]);
  const [initialized, setInitialized] = useState(false);
  if (featured && !initialized) {
    setItems(featured.map((f) => ({ packageId: f.packageId, section: f.section ?? "recommended", sortOrder: f.sortOrder, isActive: f.isActive })));
    setInitialized(true);
  }

  const addItem = (packageId: number, section: string) => {
    if (items.some((i) => i.packageId === packageId && i.section === section)) {
      toast.error("이미 추가된 상품입니다.");
      return;
    }
    setItems((p) => [...p, { packageId, section, sortOrder: p.filter((i) => i.section === section).length, isActive: true }]);
  };

  const removeItem = (packageId: number, section: string) =>
    setItems((p) => p.filter((i) => !(i.packageId === packageId && i.section === section)));

  const [selectedSection, setSelectedSection] = useState("recommended");
  const [selectedPkg, setSelectedPkg] = useState<number | "">("");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">홈 노출 상품 구성</h3>
        <Button size="sm" onClick={() => setMutation.mutate(items)} disabled={setMutation.isPending}>
          <Save size={14} className="mr-1" />
          {setMutation.isPending ? "저장 중..." : "저장"}
        </Button>
      </div>

      {/* 상품 추가 */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs mb-1 block">섹션</Label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                {SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <Label className="text-xs mb-1 block">상품 선택</Label>
              <select
                value={selectedPkg}
                onChange={(e) => setSelectedPkg(Number(e.target.value))}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">상품 선택...</option>
                {(allPkgs?.items ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <Button size="sm" onClick={() => { if (selectedPkg) addItem(Number(selectedPkg), selectedSection); }}>
              <Plus size={14} className="mr-1" /> 추가
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 섹션별 목록 */}
      {SECTIONS.map((section) => {
        const sectionItems = items.filter((i) => i.section === section.id);
        return (
          <div key={section.id}>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              {section.label}
              <Badge variant="secondary" className="text-xs">{sectionItems.length}개</Badge>
            </h4>
            {sectionItems.length === 0 ? (
              <div className="text-xs text-gray-400 py-2 pl-2">상품이 없습니다.</div>
            ) : (
              <div className="space-y-1">
                {sectionItems.map((item) => {
                  const pkg = allPkgs?.items.find((p) => p.id === item.packageId);
                  return (
                    <div key={item.packageId} className="flex items-center gap-2 p-2 bg-white border rounded text-sm">
                      {pkg?.imageUrl && <img src={pkg.imageUrl} alt="" className="w-10 h-7 object-cover rounded" />}
                      <span className="flex-1 truncate">{pkg?.title ?? `상품 #${item.packageId}`}</span>
                      <Badge variant="outline" className="text-xs">{pkg?.country}</Badge>
                      <button onClick={() => removeItem(item.packageId, item.section)} className="p-1 hover:bg-red-50 text-red-400 rounded">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 푸터 관리 탭 ─────────────────────────────────────────────
function FooterTab() {
  const { data: footer, refetch } = trpc.siteSettings.getFooter.useQuery();
  const updateMutation = trpc.siteSettings.updateFooter.useMutation({
    onSuccess: () => { toast.success("푸터 정보가 저장되었습니다."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);
  if (footer && !initialized) {
    const f = footer as Record<string, unknown>;
    const init: Record<string, string> = {};
    for (const [k, v] of Object.entries(f)) {
      if (typeof v === "string") init[k] = v;
    }
    setForm(init);
    setInitialized(true);
  }

  const merged = { ...(footer as Record<string, unknown> ?? {}), ...form };
  const handleChange = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const fields = [
    { key: "companyName", label: "상호명" },
    { key: "ceoName", label: "대표자" },
    { key: "businessNumber", label: "사업자등록번호" },
    { key: "mailOrderNumber", label: "통신판매업신고번호" },
    { key: "tourismLicenseNumber", label: "관광사업등록번호" },
    { key: "address", label: "주소" },
    { key: "phone", label: "대표전화" },
    { key: "email", label: "이메일" },
    { key: "businessHours", label: "고객센터 운영시간" },
    { key: "bankAccounts", label: "계좌정보 (JSON 배열)" },
    { key: "kakaoUrl", label: "카카오채널 URL" },
    { key: "instagramUrl", label: "인스타그램 URL" },
    { key: "youtubeUrl", label: "유튜브 URL" },
    { key: "naverBlogUrl", label: "네이버 블로그 URL" },
    { key: "copyright", label: "저작권 표기" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">하단 푸터 업체 정보</h3>
        <Button size="sm" onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>
          <Save size={14} className="mr-1" />
          {updateMutation.isPending ? "저장 중..." : "저장 및 즉시 반영"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.key} className={f.key === "address" || f.key === "bankAccounts" || f.key === "businessHours" ? "md:col-span-2" : ""}>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">{f.label}</Label>
            {f.key === "bankAccounts" ? (
              <Textarea
                value={(merged[f.key] as string) ?? ""}
                onChange={(e) => handleChange(f.key, e.target.value)}
                rows={3}
                className="text-sm font-mono"
                placeholder='[{"bank":"국민은행","accountNumber":"000-0000-0000-00","accountHolder":"두골프"}]'
              />
            ) : (
              <Input
                value={(merged[f.key] as string) ?? ""}
                onChange={(e) => handleChange(f.key, e.target.value)}
                className="text-sm"
              />
            )}
          </div>
        ))}
      </div>

      {/* 푸터 미리보기 */}
      <Card className="bg-gray-900 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-400">푸터 미리보기</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1 text-gray-300">
          <p className="font-semibold text-white">{(merged.companyName as string) || "두골프"}</p>
          <p>대표 : {(merged.ceoName as string) || "-"} | 사업자등록번호 : {(merged.businessNumber as string) || "-"}</p>
          <p>통신판매업신고 : {(merged.mailOrderNumber as string) || "-"}</p>
          <p>관광사업등록 : {(merged.tourismLicenseNumber as string) || "-"}</p>
          <p>주소 : {(merged.address as string) || "-"}</p>
          <p>전화 : {(merged.phone as string) || "-"} | 이메일 : {(merged.email as string) || "-"}</p>
          <p>운영시간 : {(merged.businessHours as string) || "-"}</p>
          <p className="text-gray-500 mt-2">{(merged.copyright as string) || "© 2026 두골프"}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 사업자등록증 OCR 탭 ─────────────────────────────────────
function BusinessLicenseOCRTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [ocrResult, setOcrResult] = useState<Record<string, { value: string; confidence: number; lowConfidence: boolean }> | null>(null);
  const [editedResult, setEditedResult] = useState<Record<string, string>>({});

  const ocrMutation = trpc.siteSettings.ocrBusinessLicense.useMutation({
    onSuccess: (data) => {
      setOcrResult(data.data);
      const init: Record<string, string> = {};
      for (const [k, v] of Object.entries(data.data)) {
        init[k] = v.value;
      }
      setEditedResult(init);
      if (data.hasLowConfidence) {
        toast.warning("일부 항목의 인식 신뢰도가 낮습니다. 오렌지색 항목을 확인하세요.");
      } else {
        toast.success("사업자등록증 정보가 성공적으로 인식되었습니다.");
      }
    },
    onError: (e) => toast.error(`OCR 실패: ${e.message}`),
  });

  const updateFooterMutation = trpc.siteSettings.updateFooter.useMutation({
    onSuccess: () => toast.success("푸터에 사업자 정보가 반영되었습니다."),
    onError: (e) => toast.error(e.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setImagePreview(base64);
      // 파일을 base64로 변환하여 업로드 (실제로는 서버 업로드 필요)
      // 여기서는 임시로 base64 URL을 사용
      setImageUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const FIELD_LABELS: Record<string, string> = {
    companyName: "상호명",
    ceoName: "대표자",
    businessNumber: "사업자등록번호",
    address: "사업장 주소",
    businessType: "업태",
    businessCategory: "종목",
    openDate: "개업연월일",
  };

  const FOOTER_FIELD_MAP: Record<string, string> = {
    companyName: "companyName",
    ceoName: "ceoName",
    businessNumber: "businessNumber",
    address: "address",
  };

  const applyToFooter = () => {
    const footerData: Record<string, string> = {};
    for (const [ocrKey, footerKey] of Object.entries(FOOTER_FIELD_MAP)) {
      if (editedResult[ocrKey]) {
        footerData[footerKey] = editedResult[ocrKey];
      }
    }
    if (imageUrl && !imageUrl.startsWith("data:")) {
      footerData["businessLicenseImageUrl"] = imageUrl;
    }
    updateFooterMutation.mutate(footerData);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">사업자등록증 OCR 자동 입력</h3>
        <p className="text-sm text-gray-500 mt-1">
          사업자등록증 이미지를 업로드하면 AI가 자동으로 정보를 추출합니다. (Gemini Vision 사용, 크레딧 절감 경로)
        </p>
      </div>

      {/* 파일 업로드 */}
      <Card className="border-dashed border-2 border-gray-300 hover:border-dogolf-green transition-colors">
        <CardContent className="p-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          {imagePreview ? (
            <div className="space-y-3">
              <img
                src={imagePreview}
                alt="사업자등록증 미리보기"
                className="max-h-64 mx-auto rounded-lg border object-contain"
              />
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} className="mr-1" /> 다시 선택
                </Button>
                <Button
                  size="sm"
                  onClick={() => ocrMutation.mutate({ imageUrl })}
                  disabled={ocrMutation.isPending || !imageUrl}
                >
                  {ocrMutation.isPending ? (
                    <><RefreshCw size={14} className="mr-1 animate-spin" /> 분석 중...</>
                  ) : (
                    <><Eye size={14} className="mr-1" /> OCR 분석 시작</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="cursor-pointer py-8"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={32} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 font-medium">사업자등록증 이미지를 업로드하세요</p>
              <p className="text-gray-400 text-sm mt-1">JPG, PNG, PDF 지원 (최대 16MB)</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OCR 결과 */}
      {ocrResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-800">인식 결과</h4>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={applyToFooter} disabled={updateFooterMutation.isPending}>
                <CheckCircle size={14} className="mr-1 text-green-600" />
                푸터에 적용
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(ocrResult).map(([key, data]) => (
              <div
                key={key}
                className={`p-3 rounded-lg border ${data.lowConfidence ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-white"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-medium text-gray-700">{FIELD_LABELS[key] || key}</Label>
                  <div className="flex items-center gap-1">
                    {data.lowConfidence && <AlertTriangle size={12} className="text-orange-500" />}
                    <span className={`text-xs ${data.confidence >= 0.7 ? "text-green-600" : "text-orange-500"}`}>
                      {Math.round(data.confidence * 100)}%
                    </span>
                  </div>
                </div>
                <Input
                  value={editedResult[key] ?? data.value}
                  onChange={(e) => setEditedResult((p) => ({ ...p, [key]: e.target.value }))}
                  className={`text-sm ${data.lowConfidence ? "border-orange-300 focus:border-orange-400" : ""}`}
                />
                {data.lowConfidence && (
                  <p className="text-xs text-orange-500 mt-1">신뢰도가 낮습니다. 수동으로 확인해주세요.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 감사 로그 탭 ─────────────────────────────────────────────
function AuditLogTab() {
  const { data: logs } = trpc.siteSettings.getAuditLogs.useQuery({ limit: 30 });

  const TABLE_LABELS: Record<string, string> = {
    site_settings: "전역 설정",
    site_nav_items: "네비게이션",
    site_hero_slides: "히어로 슬라이드",
    site_footer: "푸터",
    site_featured_packages: "노출 상품",
  };

  const ACTION_COLORS: Record<string, string> = {
    create: "bg-green-100 text-green-700",
    update: "bg-blue-100 text-blue-700",
    delete: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">변경 이력 (감사 로그)</h3>
      <div className="space-y-2">
        {(logs ?? []).map((log) => (
          <div key={log.id} className="flex items-start gap-3 p-3 bg-white border rounded-lg text-sm">
            <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600"}`}>
              {log.action === "create" ? "생성" : log.action === "update" ? "수정" : "삭제"}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-medium">{TABLE_LABELS[log.tableName] ?? log.tableName}</span>
              {log.recordId && <span className="text-gray-400 text-xs ml-1">#{log.recordId}</span>}
              {log.changedBy && <span className="text-gray-500 text-xs ml-2">by {log.changedBy}</span>}
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {log.createdAt ? new Date(log.createdAt).toLocaleString("ko-KR") : "-"}
            </span>
          </div>
        ))}
        {(logs ?? []).length === 0 && (
          <div className="text-center py-8 text-gray-400">변경 이력이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function HomepageManagement() {
  const [activeTab, setActiveTab] = useState("global");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Globe size={24} className="text-dogolf-green" />
          <h1 className="text-2xl font-bold text-gray-900">홈페이지 관리</h1>
        </div>
        <p className="text-gray-500 text-sm">
          dayoutgolf.com 홈페이지의 전역 설정, 네비게이션, 히어로 슬라이드, 노출 상품, 푸터를 관리합니다.
          저장 시 홈페이지에 즉시 반영됩니다.
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 border-b overflow-x-auto">
        {[...TABS, { id: "audit", label: "변경 이력", icon: FileText }].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-dogolf-green text-dogolf-green"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 탭 컨텐츠 */}
      <div>
        {activeTab === "global" && <GlobalSettingsTab />}
        {activeTab === "nav" && <NavigationTab />}
        {activeTab === "hero" && <HeroSlidesTab />}
        {activeTab === "featured" && <FeaturedPackagesTab />}
        {activeTab === "footer" && <FooterTab />}
        {activeTab === "ocr" && <BusinessLicenseOCRTab />}
        {activeTab === "audit" && <AuditLogTab />}
      </div>
    </div>
  );
}
