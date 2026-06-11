/**
 * 신규 파트너 온보딩 페이지 (공개)
 * Step 1: 담당자 연락처 입력 (수기 입력 최소화)
 * Step 2: 사업자등록증 + 관광사업자등록증 OCR 업로드 (수기 입력 없음)
 * Step 3: 플랜 선택 + 결제
 * Step 4: 완료 (두 등록증 모두 업로드 시 자동 승인)
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2, ChevronRight, ChevronLeft, Upload, Loader2,
  FileText, LayoutGrid, CreditCard, Sparkles, User, ShieldCheck, AlertCircle
} from "lucide-react";
import * as PortOne from "@portone/browser-sdk/v2";

// ─── 타입 정의 ───────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;

interface LicenseState {
  key: string;
  url: string;
  previewUrl: string | null;
  ocrResult: string; // JSON 문자열
  ocrRawText: string;
  uploading: boolean;
  ocrLoading: boolean;
}

interface FormData {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
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
    { n: 1, label: "담당자 정보" },
    { n: 2, label: "등록증 업로드" },
    { n: 3, label: "플랜 선택" },
    { n: 4, label: "완료" },
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
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

// ─── 등록증 업로드 카드 컴포넌트 ──────────────────────────────────────────────
function LicenseUploadCard({
  title,
  description,
  icon,
  state,
  onFileChange,
  ocrFields,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  state: LicenseState;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  ocrFields: { label: string; key: string }[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoading = state.uploading || state.ocrLoading;
  const isDone = !!state.url && !isLoading;

  let parsedOcr: Record<string, string> = {};
  try { if (state.ocrResult) parsedOcr = JSON.parse(state.ocrResult); } catch {}

  return (
    <Card className={`shadow-md transition-all ${isDone ? "border-green-400 bg-green-50/30" : "border-gray-200"}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
          {isDone && <CheckCircle2 size={16} className="text-green-600 ml-auto" />}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 업로드 영역 */}
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            isDone
              ? "border-green-400 bg-green-50"
              : "border-gray-200 hover:border-green-400 hover:bg-green-50/30"
          }`}
          onClick={() => !isLoading && fileInputRef.current?.click()}
        >
          {state.previewUrl ? (
            <div className="space-y-2">
              <img src={state.previewUrl} alt={title} className="max-h-36 mx-auto rounded-lg object-contain" />
              <p className={`text-sm font-medium ${isDone ? "text-green-600" : "text-blue-600"}`}>
                {state.uploading ? "업로드 중..." : state.ocrLoading ? "AI 분석 중..." : "업로드 완료 ✓"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                {isLoading ? <Loader2 size={18} className="animate-spin text-green-600" /> : <Upload size={18} className="text-green-600" />}
              </div>
              <p className="font-medium text-gray-700 text-sm">클릭하여 파일 선택</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, PDF 지원 (최대 10MB)</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={onFileChange}
          />
        </div>

        {/* OCR 결과 표시 */}
        {state.ocrResult && Object.keys(parsedOcr).length > 0 && (
          <div className="bg-green-50 rounded-xl p-3 space-y-1.5 border border-green-200">
            <p className="text-xs font-semibold text-green-800 flex items-center gap-1">
              <Sparkles size={12} /> AI 자동 추출 결과
            </p>
            {ocrFields
              .filter((f) => parsedOcr[f.key])
              .map((f) => (
                <div key={f.key} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-medium text-gray-800">{parsedOcr[f.key]}</span>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────
export default function PartnerOnboarding() {
  const [step, setStep] = useState<Step>(1);
  const [onboardingId, setOnboardingId] = useState<number | null>(null);
  const [autoApproved, setAutoApproved] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [form, setForm] = useState<FormData>({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    sampleCategory: "golf_tour_mixed",
    subscriptionPlan: "standard",
    billingCycle: "monthly",
  });

  // 사업자등록증 상태
  const [bizLicense, setBizLicense] = useState<LicenseState>({
    key: "", url: "", previewUrl: null, ocrResult: "", ocrRawText: "", uploading: false, ocrLoading: false,
  });

  // 관광사업자등록증 상태
  const [tourLicense, setTourLicense] = useState<LicenseState>({
    key: "", url: "", previewUrl: null, ocrResult: "", ocrRawText: "", uploading: false, ocrLoading: false,
  });

  const setField = (key: keyof FormData, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // ─── OCR 뮤테이션 ─────────────────────────────────────────────────────────
  const bizOcrMutation = trpc.partnerOnboarding.ocrBusinessLicense.useMutation({
    onSuccess: (data) => {
      if (data.success && data.data) {
        const d = data.data as Record<string, string>;
        setBizLicense((prev) => ({
          ...prev,
          ocrResult: JSON.stringify(d),
          ocrLoading: false,
        }));
        toast.success("사업자등록증 정보가 자동으로 추출되었습니다.");
      } else {
        setBizLicense((prev) => ({ ...prev, ocrLoading: false }));
        toast.warning("사업자등록증 OCR 추출에 실패했습니다. 파일을 다시 확인해주세요.");
      }
    },
    onError: () => {
      setBizLicense((prev) => ({ ...prev, ocrLoading: false }));
      toast.error("사업자등록증 OCR 처리 중 오류가 발생했습니다.");
    },
  });

  const tourOcrMutation = trpc.partnerOnboarding.ocrTourismLicense.useMutation({
    onSuccess: (data) => {
      if (data.success && data.data) {
        const d = data.data as Record<string, string>;
        setTourLicense((prev) => ({
          ...prev,
          ocrResult: JSON.stringify(d),
          ocrLoading: false,
        }));
        toast.success("관광사업자등록증 정보가 자동으로 추출되었습니다.");
      } else {
        setTourLicense((prev) => ({ ...prev, ocrLoading: false }));
        toast.warning("관광사업자등록증 OCR 추출에 실패했습니다. 파일을 다시 확인해주세요.");
      }
    },
    onError: () => {
      setTourLicense((prev) => ({ ...prev, ocrLoading: false }));
      toast.error("관광사업자등록증 OCR 처리 중 오류가 발생했습니다.");
    },
  });

  // ─── 파일 업로드 핸들러 ───────────────────────────────────────────────────
  const handleLicenseUpload = async (
    file: File,
    type: "biz" | "tour",
  ) => {
    const setter = type === "biz" ? setBizLicense : setTourLicense;
    const prefix = type === "biz" ? "partner-onboarding/business-license" : "partner-onboarding/tourism-license";

    // 미리보기
    const reader = new FileReader();
    reader.onload = (ev) => setter((prev) => ({ ...prev, previewUrl: ev.target?.result as string }));
    reader.readAsDataURL(file);

    setter((prev) => ({ ...prev, uploading: true }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("prefix", prefix);
      const res = await fetch("/api/upload/storage", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`업로드 실패: ${res.status}`);
      const { key, url } = await res.json() as { key: string; url: string };
      setter((prev) => ({ ...prev, key, url, uploading: false, ocrLoading: true }));
      toast.success("파일이 업로드되었습니다. AI 분석 중...");

      // OCR 자동 실행
      if (type === "biz") {
        bizOcrMutation.mutate({ imageUrl: url });
      } else {
        tourOcrMutation.mutate({ imageUrl: url });
      }
    } catch (err) {
      setter((prev) => ({ ...prev, uploading: false }));
      toast.error("파일 업로드에 실패했습니다.");
      console.error(err);
    }
  };

  // ─── 최종 제출 뮤테이션 ───────────────────────────────────────────────────
  const submitMutation = trpc.partnerOnboarding.submitWithBothOcr.useMutation({
    onSuccess: async (data) => {
      setOnboardingId(data.id);
      setAutoApproved(data.autoApproved);

      if (data.autoApproved) {
        // 두 등록증 모두 업로드 → 자동 승인 → 플랜 선택 없이 완료
        setStep(4);
        toast.success("두 등록증 확인 완료! 자동으로 승인되었습니다.");
        return;
      }

      // 한 개만 업로드 → 플랜 선택 단계로
      const selectedPlan = PLANS.find((p) => p.id === form.subscriptionPlan)!;
      if (form.subscriptionPlan === "starter") {
        setStep(4);
        return;
      }
      await handlePortonePayment(data.id);
    },
    onError: (err) => {
      toast.error(`신청 실패: ${err.message}`);
    },
  });

  // ─── 결제 뮤테이션 ────────────────────────────────────────────────────────
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

  const prepareMutation = trpc.subscriptions.preparePayment.useMutation({});

  const handlePortonePayment = async (id: number) => {
    setPaymentLoading(true);
    try {
      const prepared = await prepareMutation.mutateAsync({
        plan: form.subscriptionPlan,
        billingCycle: form.billingCycle,
        companyName: form.contactName,
        contactEmail: form.contactEmail,
        contactName: form.contactName,
        onboardingId: id,
      });
      if (prepared.isFree) { setStep(4); return; }
      if (!prepared.paymentId || !prepared.amount) throw new Error("결제 정보 생성에 실패했습니다.");

      const response = await PortOne.requestPayment({
        storeId: prepared.storeId,
        channelKey: prepared.channelKey,
        paymentId: prepared.paymentId,
        orderName: prepared.orderName,
        totalAmount: prepared.amount,
        currency: "CURRENCY_KRW" as const,
        payMethod: "CARD" as const,
        customer: { email: prepared.customerEmail, fullName: prepared.customerName },
        customData: prepared.customData ? JSON.parse(prepared.customData) : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      if (!response || response.code !== undefined) {
        toast.error(response?.message ?? "결제가 취소되었습니다.");
        setPaymentLoading(false);
        return;
      }
      await verifyMutation.mutateAsync({
        paymentId: prepared.paymentId,
        plan: form.subscriptionPlan,
        billingCycle: form.billingCycle,
        companyName: form.contactName,
        contactEmail: form.contactEmail,
        contactName: form.contactName,
        onboardingId: id,
      });
    } catch (err) {
      console.error("결제 오류:", err);
      toast.error("결제 처리 중 오류가 발생했습니다.");
      setPaymentLoading(false);
    }
  };

  // ─── 유효성 검사 ──────────────────────────────────────────────────────────
  const step1Valid = form.contactName.trim() && form.contactEmail.trim();
  const hasBizLicense = !!bizLicense.url;
  const hasTourLicense = !!tourLicense.url;
  const hasBothLicenses = hasBizLicense && hasTourLicense;
  const isAnyLoading = bizLicense.uploading || bizLicense.ocrLoading || tourLicense.uploading || tourLicense.ocrLoading;

  const handleStep2Next = () => {
    if (!hasBizLicense && !hasTourLicense) {
      toast.error("최소 하나의 등록증을 업로드해주세요.");
      return;
    }
    if (hasBothLicenses) {
      // 두 등록증 모두 업로드 → 바로 제출 (자동 승인)
      submitMutation.mutate({
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone || undefined,
        businessLicenseKey: bizLicense.key || undefined,
        businessLicenseUrl: bizLicense.url || undefined,
        ocrRawText: bizLicense.ocrRawText || undefined,
        ocrResult: bizLicense.ocrResult || undefined,
        tourismLicenseKey: tourLicense.key || undefined,
        tourismLicenseUrl: tourLicense.url || undefined,
        tourismOcrRawText: tourLicense.ocrRawText || undefined,
        tourismOcrResult: tourLicense.ocrResult || undefined,
        sampleCategory: form.sampleCategory,
        subscriptionPlan: "starter",
        billingCycle: "monthly",
      });
    } else {
      // 한 개만 업로드 → 플랜 선택 단계로
      setStep(3);
    }
  };

  const selectedPlan = PLANS.find((p) => p.id === form.subscriptionPlan)!;
  const planPrice = form.billingCycle === "yearly" ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;
  const isProcessing = submitMutation.isPending || paymentLoading || verifyMutation.isPending || prepareMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* 헤더 */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">⛳</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">AI ERP 파트너 신청</h1>
            <p className="text-xs text-muted-foreground">골프투어 여행사 전용 ERP 시스템</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <StepIndicator current={step} />

        {/* ── Step 1: 담당자 연락처 ── */}
        {step === 1 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User size={20} className="text-green-600" />
                담당자 연락처 입력
              </CardTitle>
              <CardDescription>
                업체 정보는 다음 단계에서 등록증 OCR로 자동 추출됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">간편 가입 안내</p>
                  <p className="text-xs text-blue-700">
                    사업자등록증과 관광사업자등록증을 업로드하면 AI가 자동으로 정보를 추출하고 즉시 승인 처리합니다.
                    수기 입력 없이 빠르게 가입하세요.
                  </p>
                </div>
              </div>

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

        {/* ── Step 2: 두 등록증 업로드 ── */}
        {step === 2 && (
          <div className="space-y-5">
            {/* 안내 배너 */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3">
              <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-800">
                <p className="font-semibold mb-1">두 등록증 모두 업로드 시 즉시 자동 승인!</p>
                <p className="text-xs text-emerald-700">
                  사업자등록증 + 관광사업자등록증을 모두 업로드하면 별도 심사 없이 즉시 ERP 이용이 가능합니다.
                  한 가지만 업로드하면 플랜 선택 후 담당자 검토가 진행됩니다.
                </p>
              </div>
            </div>

            {/* 진행 상황 표시 */}
            <div className="flex gap-3">
              <div className={`flex-1 p-3 rounded-xl border-2 text-center text-sm transition-all ${hasBizLicense ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 text-gray-400"}`}>
                {hasBizLicense ? <CheckCircle2 size={16} className="inline mr-1" /> : <AlertCircle size={16} className="inline mr-1" />}
                사업자등록증 {hasBizLicense ? "완료" : "미업로드"}
              </div>
              <div className={`flex-1 p-3 rounded-xl border-2 text-center text-sm transition-all ${hasTourLicense ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 text-gray-400"}`}>
                {hasTourLicense ? <CheckCircle2 size={16} className="inline mr-1" /> : <AlertCircle size={16} className="inline mr-1" />}
                관광사업자등록증 {hasTourLicense ? "완료" : "미업로드"}
              </div>
            </div>

            {/* 사업자등록증 업로드 */}
            <LicenseUploadCard
              title="사업자등록증"
              description="JPG, PNG, PDF 지원 · AI가 업체명, 사업자번호, 대표자명 등을 자동 추출합니다."
              icon={<FileText size={18} className="text-green-600" />}
              state={bizLicense}
              onFileChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLicenseUpload(file, "biz");
              }}
              ocrFields={[
                { label: "업체명", key: "companyName" },
                { label: "사업자번호", key: "businessNumber" },
                { label: "대표자", key: "ceoName" },
                { label: "업태", key: "businessType" },
                { label: "종목", key: "businessItem" },
                { label: "주소", key: "address" },
              ]}
            />

            {/* 관광사업자등록증 업로드 */}
            <LicenseUploadCard
              title="관광사업자등록증"
              description="JPG, PNG, PDF 지원 · AI가 등록번호, 사업 종류, 개업일 등을 자동 추출합니다."
              icon={<FileText size={18} className="text-blue-600" />}
              state={tourLicense}
              onFileChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLicenseUpload(file, "tour");
              }}
              ocrFields={[
                { label: "등록번호", key: "licenseNo" },
                { label: "사업 종류", key: "licenseType" },
                { label: "개업일", key: "openDate" },
                { label: "업체명", key: "companyName" },
                { label: "대표자", key: "ceoName" },
              ]}
            />

            {/* 두 등록증 완료 시 자동 승인 안내 */}
            {hasBothLicenses && (
              <div className="bg-green-50 border-2 border-green-400 rounded-xl p-4 flex gap-3 animate-pulse-once">
                <CheckCircle2 size={20} className="text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-800 text-sm">두 등록증 업로드 완료!</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    아래 버튼을 클릭하면 즉시 자동 승인 처리됩니다.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft size={16} className="mr-1" /> 이전
              </Button>
              <Button
                onClick={handleStep2Next}
                disabled={isAnyLoading || isProcessing || (!hasBizLicense && !hasTourLicense)}
                className={hasBothLicenses ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}
              >
                {isAnyLoading ? (
                  <><Loader2 size={14} className="animate-spin mr-1" /> 처리 중...</>
                ) : isProcessing ? (
                  <><Loader2 size={14} className="animate-spin mr-1" /> 신청 중...</>
                ) : hasBothLicenses ? (
                  <><ShieldCheck size={16} className="mr-1" /> 즉시 자동 승인 신청</>
                ) : (
                  <>다음 단계 (플랜 선택) <ChevronRight size={16} className="ml-1" /></>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: 플랜 선택 + 결제 (한 개 등록증만 업로드 시) ── */}
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
                <div className="flex items-center gap-3 p-1 bg-gray-100 rounded-lg w-fit">
                  <button
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${form.billingCycle === "monthly" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
                    onClick={() => setField("billingCycle", "monthly")}
                  >
                    월간
                  </button>
                  <button
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${form.billingCycle === "yearly" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
                    onClick={() => setField("billingCycle", "yearly")}
                  >
                    연간 <span className="text-green-600 text-xs ml-1">17% 할인</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PLANS.map((plan) => {
                    const price = form.billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
                    return (
                      <div
                        key={plan.id}
                        className={`rounded-xl border-2 cursor-pointer transition-all overflow-hidden ${
                          form.subscriptionPlan === plan.id ? plan.color + " shadow-md" : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setField("subscriptionPlan", plan.id)}
                      >
                        <div className={`p-3 ${form.subscriptionPlan === plan.id ? plan.headerColor : "bg-gray-50"}`}>
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm">{plan.name}</h4>
                            <Badge className={`text-xs text-white ${plan.badgeColor}`}>{plan.badge}</Badge>
                          </div>
                          <div className="mt-1">
                            {price === 0 ? (
                              <span className="text-lg font-bold">무료</span>
                            ) : (
                              <span className="text-lg font-bold">
                                {price.toLocaleString()}원
                                <span className="text-xs font-normal text-muted-foreground">
                                  /{form.billingCycle === "yearly" ? "년" : "월"}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="p-3">
                          <ul className="space-y-1">
                            {plan.features.map((f) => (
                              <li key={f} className="text-xs text-gray-600 flex items-center gap-1">
                                <CheckCircle2 size={10} className="text-green-500 shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ChevronLeft size={16} className="mr-1" /> 이전
                  </Button>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">선택 플랜</p>
                      <p className="font-bold text-gray-900">
                        {selectedPlan.name} · {planPrice === 0 ? "무료" : `${planPrice.toLocaleString()}원`}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        submitMutation.mutate({
                          contactName: form.contactName,
                          contactEmail: form.contactEmail,
                          contactPhone: form.contactPhone || undefined,
                          businessLicenseKey: bizLicense.key || undefined,
                          businessLicenseUrl: bizLicense.url || undefined,
                          ocrRawText: bizLicense.ocrRawText || undefined,
                          ocrResult: bizLicense.ocrResult || undefined,
                          tourismLicenseKey: tourLicense.key || undefined,
                          tourismLicenseUrl: tourLicense.url || undefined,
                          tourismOcrRawText: tourLicense.ocrRawText || undefined,
                          tourismOcrResult: tourLicense.ocrResult || undefined,
                          sampleCategory: form.sampleCategory,
                          subscriptionPlan: form.subscriptionPlan,
                          billingCycle: form.billingCycle,
                        });
                      }}
                      disabled={isProcessing}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isProcessing ? (
                        <><Loader2 size={14} className="animate-spin mr-1" /> 처리 중...</>
                      ) : planPrice === 0 ? (
                        "신청 완료"
                      ) : (
                        <>결제하기 <CreditCard size={14} className="ml-1" /></>
                      )}
                    </Button>
                  </div>
                </div>
                {planPrice > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
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
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${autoApproved ? "bg-green-100" : "bg-blue-100"}`}>
                {autoApproved
                  ? <ShieldCheck size={40} className="text-green-600" />
                  : <CheckCircle2 size={40} className="text-blue-600" />
                }
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {autoApproved ? "자동 승인 완료!" : "신청이 완료되었습니다!"}
                </h2>
                <p className="text-muted-foreground">
                  {autoApproved
                    ? "두 등록증 OCR 인식이 완료되어 즉시 ERP 이용이 가능합니다."
                    : `${form.contactName}님의 AI ERP 파트너 신청을 접수했습니다.`
                  }
                </p>
              </div>

              {autoApproved && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left max-w-sm mx-auto">
                  <p className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-1.5">
                    <Sparkles size={14} /> OCR 자동 승인 완료
                  </p>
                  <div className="space-y-1.5">
                    {bizLicense.ocrResult && (() => {
                      try {
                        const d = JSON.parse(bizLicense.ocrResult) as Record<string, string>;
                        return (
                          <>
                            {d.companyName && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">업체명</span>
                                <span className="font-medium">{d.companyName}</span>
                              </div>
                            )}
                            {d.businessNumber && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">사업자번호</span>
                                <span className="font-medium">{d.businessNumber}</span>
                              </div>
                            )}
                          </>
                        );
                      } catch { return null; }
                    })()}
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">담당자 이메일</span>
                      <span className="font-medium">{form.contactEmail}</span>
                    </div>
                  </div>
                </div>
              )}

              {!autoApproved && (
                <div className="bg-gray-50 rounded-xl p-5 text-left space-y-2 max-w-sm mx-auto">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">담당자 이메일</span>
                    <span className="font-medium">{form.contactEmail}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">선택 플랜</span>
                    <span className="font-medium">{selectedPlan.name}</span>
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                {autoApproved
                  ? "로그인 후 파트너 대시보드에서 ERP를 바로 이용하실 수 있습니다."
                  : "영업일 기준 1~2일 내 담당자가 이메일로 연락드립니다."
                }
              </p>

              <div className="flex gap-3 justify-center">
                {autoApproved && (
                  <Button
                    onClick={() => window.location.href = "/partner"}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    파트너 대시보드 바로가기
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => window.location.href = "/"}
                >
                  홈으로 돌아가기
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
