/**
 * 신규 파트너 온보딩 페이지 (공개)
 * Step 1: 기본 정보 입력
 * Step 2: 사업자등록증 업로드 + OCR 자동 추출
 * Step 3: 샘플 DB 카테고리 + 구독 플랜 선택 + 포트원 V2 결제
 * Step 4: 완료 화면
 */
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2, ChevronRight, ChevronLeft, Upload, Loader2,
  Building2, FileText, LayoutGrid, CreditCard, Sparkles, Phone, Mail, User
} from "lucide-react";
import * as PortOne from "@portone/browser-sdk/v2";

// ─── 타입 정의 ───────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;

interface FormData {
  companyName: string;
  businessNumber: string;
  ceoName: string;
  businessType: string;
  businessItem: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessLicenseKey: string;
  businessLicenseUrl: string;
  ocrResult: string;
  sampleCategory: "golf_tour_domestic" | "golf_tour_overseas" | "golf_tour_mixed";
  subscriptionPlan: "starter" | "standard" | "premium";
  billingCycle: "monthly" | "yearly";
}

// ─── 구독 플랜 정의 ──────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "starter" as const,
    name: "스타터",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: ["상품 관리 (최대 10개)", "기본 예약 관리", "이메일 지원"],
    badge: "무료",
    color: "border-gray-200",
    headerColor: "bg-gray-50",
    badgeColor: "bg-gray-500",
  },
  {
    id: "standard" as const,
    name: "스탠다드",
    monthlyPrice: 99000,
    yearlyPrice: 990000,
    features: ["상품 관리 (최대 50개)", "예약 + 정산 관리", "AI 마케팅 도구", "카카오 알림톡", "전화 지원"],
    badge: "인기",
    color: "border-green-500",
    headerColor: "bg-green-50",
    badgeColor: "bg-green-600",
  },
  {
    id: "premium" as const,
    name: "프리미엄",
    monthlyPrice: 299000,
    yearlyPrice: 2990000,
    features: ["상품 관리 (무제한)", "전체 기능 포함", "전담 AI 어시스턴트", "맞춤 홈페이지", "API 연동", "전담 매니저"],
    badge: "최고",
    color: "border-purple-500",
    headerColor: "bg-purple-50",
    badgeColor: "bg-purple-600",
  },
];

// ─── 샘플 카테고리 정의 ──────────────────────────────────────────────────────
const SAMPLE_CATEGORIES = [
  {
    id: "golf_tour_domestic" as const,
    name: "국내 골프투어",
    desc: "제주, 강원, 경남 등 국내 골프장 중심의 패키지 샘플 데이터",
    icon: "🇰🇷",
    features: ["국내 골프장 20개 샘플", "1박2일~3박4일 패키지", "국내 숙소 연계"],
  },
  {
    id: "golf_tour_overseas" as const,
    name: "해외 골프투어",
    desc: "태국, 베트남, 필리핀 등 해외 골프투어 중심의 패키지 샘플 데이터",
    icon: "✈️",
    features: ["해외 골프장 30개 샘플", "3박4일~5박6일 패키지", "항공+숙소 연계"],
  },
  {
    id: "golf_tour_mixed" as const,
    name: "국내+해외 혼합",
    desc: "국내외 골프투어를 모두 운영하는 종합 여행사용 샘플 데이터",
    icon: "⛳",
    features: ["국내+해외 골프장 50개 샘플", "다양한 패키지 유형", "전체 기능 활용"],
    recommended: true,
  },
];

// ─── 단계 인디케이터 ─────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: "기본 정보" },
    { n: 2, label: "사업자등록증" },
    { n: 3, label: "플랜 선택" },
    { n: 4, label: "완료" },
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className={`flex flex-col items-center gap-1`}>
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                current > s.n
                  ? "bg-green-500 text-white"
                  : current === s.n
                  ? "bg-green-600 text-white ring-4 ring-green-100"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {current > s.n ? <CheckCircle2 size={16} /> : s.n}
            </div>
            <span className={`text-xs whitespace-nowrap ${current === s.n ? "text-green-700 font-semibold" : "text-gray-400"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-12 h-0.5 mx-1 mb-5 ${current > s.n ? "bg-green-500" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────
export default function PartnerOnboarding() {
  const [step, setStep] = useState<Step>(1);
  const [onboardingId, setOnboardingId] = useState<number | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    companyName: "",
    businessNumber: "",
    ceoName: "",
    businessType: "",
    businessItem: "",
    address: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    businessLicenseKey: "",
    businessLicenseUrl: "",
    ocrResult: "",
    sampleCategory: "golf_tour_mixed",
    subscriptionPlan: "standard",
    billingCycle: "monthly",
  });
  const [ocrLoading, setOcrLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setField = (key: keyof FormData, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // OCR 뮤테이션
  const ocrMutation = trpc.partnerOnboarding.ocrBusinessLicense.useMutation({
    onSuccess: (data) => {
      if (data.success && data.data) {
        const d = data.data;
        setForm((f) => ({
          ...f,
          companyName: d.companyName ?? f.companyName,
          businessNumber: d.businessNumber ?? f.businessNumber,
          ceoName: d.ceoName ?? f.ceoName,
          businessType: d.businessType ?? f.businessType,
          businessItem: d.businessItem ?? f.businessItem,
          address: d.address ?? f.address,
          ocrResult: JSON.stringify(d),
        }));
        toast.success("사업자등록증 정보가 자동으로 입력되었습니다.");
      } else {
        toast.error("OCR 추출에 실패했습니다. 수동으로 입력해주세요.");
      }
      setOcrLoading(false);
    },
    onError: () => {
      toast.error("OCR 처리 중 오류가 발생했습니다.");
      setOcrLoading(false);
    },
  });

  // 신청 뮤테이션 (Step 3 → 결제 전 DB 저장)
  const applyMutation = trpc.partnerOnboarding.submit.useMutation({
    onSuccess: async (data) => {
      const id = data.id;
      setOnboardingId(id);

      const selectedPlan = PLANS.find((p) => p.id === form.subscriptionPlan)!;

      // 스타터(무료) 플랜은 결제 없이 바로 완료
      if (form.subscriptionPlan === "starter") {
        setStep(4);
        return;
      }

      // 유료 플랜 - 포트원 결제 진행
      await handlePortonePayment(id);
    },
    onError: (err) => {
      toast.error(`신청 실패: ${err.message}`);
    },
  });

  // 결제 검증 뮤테이션
  const verifyMutation = trpc.subscriptions.verifyAndActivate.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setStep(4);
        toast.success(data.message);
      }
    },
    onError: (err) => {
      toast.error(`결제 검증 실패: ${err.message}`);
      setPaymentLoading(false);
    },
  });

  // 결제 준비 뮤테이션
  const prepareMutation = trpc.subscriptions.preparePayment.useMutation({});

  // 포트원 V2 결제 실행
  const handlePortonePayment = async (id: number) => {
    setPaymentLoading(true);
    try {
      // 서버에서 결제 정보 준비
      const prepared = await prepareMutation.mutateAsync({
        plan: form.subscriptionPlan,
        billingCycle: form.billingCycle,
        companyName: form.companyName,
        contactEmail: form.contactEmail,
        contactName: form.contactName,
        onboardingId: id,
      });

      if (prepared.isFree) {
        setStep(4);
        return;
      }

      if (!prepared.paymentId || !prepared.amount) {
        throw new Error("결제 정보 생성에 실패했습니다.");
      }

      // 포트원 V2 결제창 호출
      const portoneRequest = {
        storeId: prepared.storeId,
        channelKey: prepared.channelKey,
        paymentId: prepared.paymentId,
        orderName: prepared.orderName,
        totalAmount: prepared.amount,
        currency: "CURRENCY_KRW" as const,
        payMethod: "CARD" as const,
        customer: {
          email: prepared.customerEmail,
          fullName: prepared.customerName,
        },
        customData: prepared.customData ? JSON.parse(prepared.customData) : undefined,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await PortOne.requestPayment(portoneRequest as any);

      if (!response || response.code !== undefined) {
        // 결제 실패 또는 취소
        const msg = response?.message ?? "결제가 취소되었습니다.";
        toast.error(msg);
        setPaymentLoading(false);
        return;
      }

      // 결제 완료 → 서버 검증
      await verifyMutation.mutateAsync({
        paymentId: prepared.paymentId,
        plan: form.subscriptionPlan,
        billingCycle: form.billingCycle,
        companyName: form.companyName,
        contactEmail: form.contactEmail,
        contactName: form.contactName,
        onboardingId: id,
      });
    } catch (err) {
      console.error("결제 오류:", err);
      toast.error("결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
      setPaymentLoading(false);
    }
  };

  // 파일 업로드 처리
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 미리보기
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewUrl(ev.target?.result as string);
    reader.readAsDataURL(file);

    // S3 업로드 (FormData 방식)
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("prefix", "partner-onboarding/business-license");

      const res = await fetch("/api/upload/storage", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) throw new Error(`업로드 실패: ${res.status}`);
      const { key, url } = await res.json() as { key: string; url: string };

      setField("businessLicenseKey", key);
      setField("businessLicenseUrl", url);
      toast.success("파일이 업로드되었습니다.");

      // OCR 자동 실행
      setOcrLoading(true);
      ocrMutation.mutate({ imageUrl: url });
    } catch (err) {
      toast.error("파일 업로드에 실패했습니다.");
      console.error(err);
    } finally {
      setUploadLoading(false);
    }
  };

  // Step 1 유효성 검사
  const step1Valid = form.companyName.trim() && form.contactName.trim() && form.contactEmail.trim();

  // 최종 신청 (DB 저장 → 결제)
  const handleSubmit = () => {
    applyMutation.mutate({
      companyName: form.companyName,
      businessNumber: form.businessNumber || undefined,
      ceoName: form.ceoName || undefined,
      businessType: form.businessType || undefined,
      businessItem: form.businessItem || undefined,
      address: form.address || undefined,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone || undefined,
      businessLicenseKey: form.businessLicenseKey || undefined,
      businessLicenseUrl: form.businessLicenseUrl || undefined,
      ocrResult: form.ocrResult || undefined,
      sampleCategory: form.sampleCategory,
      subscriptionPlan: form.subscriptionPlan,
      billingCycle: form.billingCycle,
    });
  };

  const selectedPlan = PLANS.find((p) => p.id === form.subscriptionPlan)!;
  const planPrice = form.billingCycle === "yearly" ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;
  const isProcessing = applyMutation.isPending || paymentLoading || verifyMutation.isPending || prepareMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* 헤더 */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">⛳</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">두골프 ERP 파트너 신청</h1>
            <p className="text-xs text-muted-foreground">골프투어 여행사 전용 ERP 시스템</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <StepIndicator current={step} />

        {/* ── Step 1: 기본 정보 ── */}
        {step === 1 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 size={20} className="text-green-600" />
                기본 정보 입력
              </CardTitle>
              <CardDescription>업체 정보와 담당자 연락처를 입력해주세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>업체명 <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="(주)두골프투어"
                    value={form.companyName}
                    onChange={(e) => setField("companyName", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>사업자등록번호</Label>
                  <Input
                    placeholder="000-00-00000"
                    value={form.businessNumber}
                    onChange={(e) => setField("businessNumber", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>대표자명</Label>
                  <Input
                    placeholder="홍길동"
                    value={form.ceoName}
                    onChange={(e) => setField("ceoName", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>업태</Label>
                  <Input
                    placeholder="서비스업"
                    value={form.businessType}
                    onChange={(e) => setField("businessType", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>종목</Label>
                  <Input
                    placeholder="여행업"
                    value={form.businessItem}
                    onChange={(e) => setField("businessItem", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>사업장 주소</Label>
                <Input
                  placeholder="서울특별시 강남구..."
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </div>
              <div className="border-t pt-4 mt-2">
                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  <User size={14} /> 담당자 정보
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>담당자명 <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="김담당"
                      value={form.contactName}
                      onChange={(e) => setField("contactName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>이메일 <span className="text-red-500">*</span></Label>
                    <Input
                      type="email"
                      placeholder="contact@company.com"
                      value={form.contactEmail}
                      onChange={(e) => setField("contactEmail", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>전화번호</Label>
                    <Input
                      placeholder="010-0000-0000"
                      value={form.contactPhone}
                      onChange={(e) => setField("contactPhone", e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!step1Valid}
                  className="bg-green-600 hover:bg-green-700"
                >
                  다음 단계 <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: 사업자등록증 ── */}
        {step === 2 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText size={20} className="text-green-600" />
                사업자등록증 업로드
              </CardTitle>
              <CardDescription>AI가 자동으로 정보를 추출합니다. (선택사항)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 업로드 영역 */}
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {previewUrl ? (
                  <div className="space-y-3">
                    <img src={previewUrl} alt="사업자등록증 미리보기" className="max-h-48 mx-auto rounded-lg object-contain" />
                    <p className="text-sm text-green-600 font-medium">
                      {uploadLoading ? "업로드 중..." : ocrLoading ? "AI 분석 중..." : "업로드 완료"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <Upload size={22} className="text-green-600" />
                    </div>
                    <p className="font-medium text-gray-700">클릭하여 파일 선택</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG, PDF 지원 (최대 10MB)</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* OCR 결과 표시 */}
              {form.ocrResult && (() => {
                try {
                  const d = JSON.parse(form.ocrResult);
                  return (
                    <div className="bg-green-50 rounded-xl p-4 space-y-2 border border-green-200">
                      <p className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
                        <Sparkles size={14} /> AI 자동 추출 결과
                      </p>
                      {[
                        { label: "업체명", value: d.companyName },
                        { label: "사업자번호", value: d.businessNumber },
                        { label: "대표자", value: d.ceoName },
                        { label: "업태", value: d.businessType },
                        { label: "종목", value: d.businessItem },
                      ].filter((r) => r.value).map((r) => (
                        <div key={r.label} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{r.label}</span>
                          <span className="font-medium">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                } catch { return null; }
              })()}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft size={16} className="mr-1" /> 이전
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={uploadLoading || ocrLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {uploadLoading || ocrLoading ? (
                    <><Loader2 size={14} className="animate-spin mr-1" /> 처리 중...</>
                  ) : (
                    <>다음 단계 <ChevronRight size={16} className="ml-1" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: 플랜 선택 + 결제 ── */}
        {step === 3 && (
          <div className="space-y-6">
            {/* 샘플 카테고리 선택 */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid size={20} className="text-green-600" />
                  샘플 데이터 선택
                </CardTitle>
                <CardDescription>초기 세팅에 사용할 샘플 데이터 유형을 선택해주세요.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SAMPLE_CATEGORIES.map((cat) => (
                    <div
                      key={cat.id}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        form.sampleCategory === cat.id
                          ? "border-green-500 bg-green-50 shadow-sm"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setField("sampleCategory", cat.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{cat.icon}</span>
                        {"recommended" in cat && cat.recommended && (
                          <Badge className="bg-green-600 text-xs">추천</Badge>
                        )}
                      </div>
                      <h4 className="font-semibold text-sm mb-1">{cat.name}</h4>
                      <p className="text-xs text-muted-foreground mb-2">{cat.desc}</p>
                      <ul className="space-y-0.5">
                        {cat.features.map((f) => (
                          <li key={f} className="text-xs text-gray-600 flex items-center gap-1">
                            <CheckCircle2 size={10} className="text-green-500 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 구독 플랜 선택 */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard size={20} className="text-green-600" />
                  구독 플랜 선택
                </CardTitle>
                <CardDescription>사업 규모에 맞는 플랜을 선택해주세요.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 결제 주기 토글 */}
                <div className="flex items-center justify-center gap-2 bg-gray-100 rounded-full p-1 w-fit mx-auto">
                  <button
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      form.billingCycle === "monthly" ? "bg-white shadow text-gray-900" : "text-gray-500"
                    }`}
                    onClick={() => setField("billingCycle", "monthly")}
                  >
                    월간 결제
                  </button>
                  <button
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      form.billingCycle === "yearly" ? "bg-white shadow text-gray-900" : "text-gray-500"
                    }`}
                    onClick={() => setField("billingCycle", "yearly")}
                  >
                    연간 결제 <span className="text-xs text-green-400 ml-1">2개월 무료</span>
                  </button>
                </div>

                {/* 플랜 카드 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      className={`rounded-xl border-2 cursor-pointer transition-all overflow-hidden ${
                        form.subscriptionPlan === plan.id ? plan.color : "border-gray-200"
                      } ${form.subscriptionPlan === plan.id ? "shadow-md" : "hover:shadow-sm"}`}
                      onClick={() => setField("subscriptionPlan", plan.id)}
                    >
                      <div className={`p-4 ${plan.headerColor}`}>
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-bold">{plan.name}</h3>
                          {plan.badge && (
                            <Badge className={plan.badgeColor}>
                              {plan.badge}
                            </Badge>
                          )}
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          {plan.monthlyPrice === 0 ? (
                            <span className="text-gray-600">무료</span>
                          ) : (
                            <>₩{(form.billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice).toLocaleString()}</>
                          )}
                        </div>
                        {plan.monthlyPrice > 0 && (
                          <p className="text-xs text-muted-foreground">
                            /{form.billingCycle === "yearly" ? "년" : "월"}
                          </p>
                        )}
                      </div>
                      <div className="p-4">
                        <ul className="space-y-1.5">
                          {plan.features.map((f) => (
                            <li key={f} className="text-xs text-gray-600 flex items-center gap-1.5">
                              <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 신청 요약 + 결제 버튼 */}
            <Card className="shadow-md border-green-200 bg-green-50/50">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">신청 요약</p>
                    <p className="text-sm text-muted-foreground">
                      {form.companyName} · {selectedPlan.name} · {form.billingCycle === "yearly" ? "연간" : "월간"} 결제
                    </p>
                    <p className="text-lg font-bold text-green-700 mt-1">
                      {planPrice === 0 ? "무료" : `₩${planPrice.toLocaleString()}/${form.billingCycle === "yearly" ? "년" : "월"}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(2)} disabled={isProcessing}>
                      <ChevronLeft size={16} className="mr-1" /> 이전
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={isProcessing}
                      className="bg-green-600 hover:bg-green-700 min-w-[140px]"
                    >
                      {isProcessing ? (
                        <><Loader2 size={14} className="animate-spin mr-1" />
                          {applyMutation.isPending ? "신청 중..." : paymentLoading ? "결제 처리 중..." : "검증 중..."}
                        </>
                      ) : (
                        planPrice === 0 ? "무료로 시작하기" : "결제 후 신청 완료"
                      )}
                    </Button>
                  </div>
                </div>
                {planPrice > 0 && (
                  <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                    <CreditCard size={11} />
                    포트원(PortOne) 안전결제 · 카드/계좌이체 지원
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Step 4: 완료 ── */}
        {step === 4 && (
          <Card className="shadow-md text-center">
            <CardContent className="pt-10 pb-10 space-y-5">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">신청이 완료되었습니다!</h2>
                <p className="text-muted-foreground">
                  <strong>{form.companyName}</strong>의 두골프 ERP 파트너 신청을 접수했습니다.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-5 text-left space-y-2 max-w-sm mx-auto">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">담당자 이메일</span>
                  <span className="font-medium">{form.contactEmail}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">선택 플랜</span>
                  <span className="font-medium">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">샘플 데이터</span>
                  <span className="font-medium">
                    {SAMPLE_CATEGORIES.find((c) => c.id === form.sampleCategory)?.name}
                  </span>
                </div>
                {form.subscriptionPlan !== "starter" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">결제 방식</span>
                    <span className="font-medium text-green-700">포트원 결제 완료</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {form.subscriptionPlan === "starter"
                  ? "영업일 기준 1~2일 내 담당자가 이메일로 연락드립니다."
                  : "결제가 확인되어 ERP 시스템이 활성화됩니다. 담당자가 연락드립니다."}
              </p>
              <Button
                variant="outline"
                onClick={() => window.location.href = "/"}
                className="mt-2"
              >
                홈으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
