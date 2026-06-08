/**
 * 파트너 AI 온보딩 채팅 페이지
 * - 구글 로그인 후 신규 파트너 전용
 * - PC: 좌측 수기 입력 패널 + 우측 두골프 매니저 AI 채팅
 * - 모바일: AI 채팅 메인 + 하단 수기 입력 토글 패널
 * - AI 대화로 수집한 정보가 수기 입력 필드에 실시간 자동 채움
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  Bot,
  ChevronRight,
  ChevronLeft,
  Upload,
  CheckCircle2,
  FileText,
  Sparkles,
  User,
  ShieldCheck,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Pencil,
  X,
  Save,
} from "lucide-react";
import * as PortOne from "@portone/browser-sdk/v2";

// ─── 타입 ────────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;

interface OnboardingFormData {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string;
  sampleCategory: "golf_tour_domestic" | "golf_tour_overseas" | "golf_tour_mixed";
  subscriptionPlan: "starter" | "standard" | "premium";
  billingCycle: "monthly" | "yearly";
}

interface LicenseState {
  key: string;
  url: string;
  previewUrl: string | null;
  ocrResult: string;
  ocrRawText: string;
  uploading: boolean;
  ocrLoading: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// ─── 플랜 정의 ───────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "starter" as const,
    name: "스타터",
    monthlyPrice: 0,
    features: ["상품 관리 (최대 10개)", "기본 예약 관리", "이메일 지원"],
    badge: "무료",
    borderClass: "border-gray-200",
  },
  {
    id: "standard" as const,
    name: "스탠다드",
    monthlyPrice: 99000,
    features: ["상품 관리 (최대 50개)", "예약 + 정산 관리", "AI 마케팅 도구", "카카오 알림톡", "전화 지원"],
    badge: "인기",
    borderClass: "border-green-500",
  },
  {
    id: "premium" as const,
    name: "프리미엄",
    monthlyPrice: 299000,
    features: ["상품 관리 (무제한)", "전체 기능 포함", "전담 AI 어시스턴트", "맞춤 홈페이지", "API 연동"],
    badge: "최고",
    borderClass: "border-purple-500",
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
    <div className="flex items-center justify-center gap-0 mb-4">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                s.n < current
                  ? "bg-green-600 text-white"
                  : s.n === current
                  ? "bg-green-600 text-white ring-4 ring-green-100"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {s.n < current ? <CheckCircle2 size={14} /> : s.n}
            </div>
            <span
              className={`text-[10px] font-medium hidden sm:block ${
                s.n === current ? "text-green-700" : "text-gray-400"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-8 sm:w-10 h-0.5 mx-1 ${
                s.n < current ? "bg-green-500" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── 등록증 업로드 카드 ───────────────────────────────────────────────────────
function LicenseUploadCard({
  title,
  description,
  icon,
  state,
  onFileChange,
  ocrFields,
  onOcrEdit,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  state: LicenseState;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  ocrFields: { label: string; key: string }[];
  onOcrEdit: (updated: Record<string, string>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const ocrData = state.ocrResult
    ? (() => {
        try {
          return JSON.parse(state.ocrResult) as Record<string, string>;
        } catch {
          return null;
        }
      })()
    : null;

  const startEdit = () => {
    const initial: Record<string, string> = {};
    ocrFields.forEach((f) => {
      initial[f.key] = ocrData?.[f.key] ?? "";
    });
    setEditForm(initial);
    setIsEditing(true);
  };

  const saveEdit = () => {
    // 기존 ocrData에 편집된 값 병합
    const merged = { ...(ocrData ?? {}), ...editForm };
    onOcrEdit(merged);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  return (
    <div
      className={`border-2 rounded-xl p-4 transition-all ${
        state.url ? "border-green-400 bg-green-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <div>
          <p className="font-semibold text-sm text-gray-800">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        {state.url && <CheckCircle2 size={18} className="text-green-600 ml-auto shrink-0" />}
      </div>
      {!state.url ? (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-all"
          onClick={() => fileInputRef.current?.click()}
        >
          {state.uploading || state.ocrLoading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-green-600" />
              <p className="text-xs text-gray-500">
                {state.uploading ? "업로드 중..." : "OCR 분석 중..."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={24} className="text-gray-400" />
              <p className="text-xs text-gray-500">클릭하여 파일 선택</p>
              <p className="text-[10px] text-gray-400">JPG, PNG, PDF · 최대 10MB</p>
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
      ) : (
        <div className="space-y-2">
          {state.previewUrl && (
            <img
              src={state.previewUrl}
              alt="미리보기"
              className="w-full max-h-32 object-contain rounded-lg border"
            />
          )}

          {/* OCR 결과 표시 / 편집 영역 */}
          {ocrData && !isEditing && (
            <div className="bg-white border border-gray-200 rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">OCR 추출 결과</span>
                <button
                  type="button"
                  onClick={startEdit}
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  <Pencil size={11} /> 수정
                </button>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {ocrFields.map((f) => (
                  <div key={f.key} className="flex items-baseline gap-1 text-xs">
                    <span className="text-gray-400 shrink-0 w-16">{f.label}</span>
                    <span className="font-medium text-gray-800 break-all">
                      {ocrData[f.key] || <span className="text-gray-300 italic">미인식</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OCR 편집 폼 */}
          {isEditing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck size={13} className="text-blue-600 shrink-0" />
                <p className="text-[11px] text-blue-700">
                  OCR 인식이 부정확한 경우 직접 수정하세요. 수정 후 저장하면 반영됩니다.
                </p>
              </div>
              <div className="space-y-2">
                {ocrFields.map((f) => (
                  <div key={f.key} className="space-y-0.5">
                    <Label className="text-[11px] text-gray-600">{f.label}</Label>
                    <Input
                      value={editForm[f.key] ?? ""}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      className="h-7 text-xs"
                      placeholder={`${f.label} 입력`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onClick={cancelEdit}
                >
                  <X size={11} className="mr-1" /> 취소
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                  onClick={saveEdit}
                >
                  <Save size={11} className="mr-1" /> 저장
                </Button>
              </div>
            </div>
          )}

          {/* OCR 결과 없을 때 안내 */}
          {!ocrData && !state.ocrLoading && (
            <p className="text-[11px] text-gray-400 text-center py-1">
              PDF 파일은 OCR 분석이 지원되지 않습니다.
            </p>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            다시 업로드
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={onFileChange}
          />
        </div>
      )}
    </div>
  );
}

// ─── 채팅 메시지 버블 ─────────────────────────────────────────────────────────
function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center shrink-0 mt-1">
          <Bot size={14} className="text-white" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-green-600 text-white rounded-tr-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function PartnerOnboardingChat() {
  const [, navigate] = useLocation();
  const search = useSearch();

  // URL 쿼리 파라미터에서 구글 로그인 정보 추출
  const urlParams = new URLSearchParams(search);
  const googleEmail = urlParams.get("email") || "";
  const googleName = urlParams.get("name") || "";

  // 폼 상태 (구글 정보 자동 채움)
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<OnboardingFormData>({
    contactName: googleName,
    contactEmail: googleEmail,
    contactPhone: "",
    companyName: "",
    sampleCategory: "golf_tour_mixed",
    subscriptionPlan: "starter",
    billingCycle: "monthly",
  });

  // 등록증 상태
  const emptyLicense: LicenseState = {
    key: "",
    url: "",
    previewUrl: null,
    ocrResult: "",
    ocrRawText: "",
    uploading: false,
    ocrLoading: false,
  };
  const [bizLicense, setBizLicense] = useState<LicenseState>(emptyLicense);
  const [tourLicense, setTourLicense] = useState<LicenseState>(emptyLicense);

  // 채팅 상태
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "안녕하세요! 🤖 두골프 파트너 매니저입니다.\n\n두골프 파트너로 가입하신 것을 환영합니다! 간단한 정보를 입력해 주시면 바로 시작하실 수 있어요.\n\n먼저 담당자 성함을 알려주세요! 😊",
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(
    () => `onboard-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );

  // 모바일 패널 토글
  const [mobileFormOpen, setMobileFormOpen] = useState(false);

  // 결제 상태
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [onboardingId, setOnboardingId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isTyping, scrollToBottom]);

  // ─── tRPC mutations ────────────────────────────────────────────────────────
  const onboardingChatMutation = trpc.aiAssistant.onboardingChat.useMutation();
  const ocrBizMutation = trpc.partnerOnboarding.ocrBusinessLicense.useMutation();
  const ocrTourMutation = trpc.partnerOnboarding.ocrTourismLicense.useMutation();

  const submitWithBothOcrMutation = trpc.partnerOnboarding.submitWithBothOcr.useMutation({
    onSuccess: (data) => {
      setOnboardingId(data.id);
      if (data.autoApproved) {
        setStep(4);
        toast.success("자동 승인 완료! ERP를 바로 이용하실 수 있습니다.");
        setTimeout(() => navigate("/partner/dashboard"), 2500);
      } else {
        setStep(4);
        toast.success("가입 신청이 완료되었습니다. 검토 후 승인됩니다.");
      }
    },
    onError: (err) => {
      toast.error(err.message || "제출 중 오류가 발생했습니다.");
    },
  });

  const submitMutation = trpc.partnerOnboarding.submit.useMutation({
    onSuccess: (data) => {
      setOnboardingId(data.id);
      if (form.subscriptionPlan === "starter") {
        setStep(4);
        toast.success("가입 신청이 완료되었습니다.");
      }
    },
    onError: (err) => {
      toast.error(err.message || "제출 중 오류가 발생했습니다.");
    },
  });

  const prepareMutation = trpc.subscriptions.preparePayment.useMutation();

  const verifyMutation = trpc.subscriptions.verifyAndActivate.useMutation({
    onSuccess: () => {
      setStep(4);
      setPaymentLoading(false);
      toast.success("결제가 완료되었습니다!");
    },
    onError: (err) => {
      toast.error(err.message);
      setPaymentLoading(false);
    },
  });

  // ─── 폼 업데이트 헬퍼 ─────────────────────────────────────────────────────
  const updateForm = (fields: Partial<OnboardingFormData>) => {
    setForm((prev) => ({ ...prev, ...fields }));
  };

  // ─── AI 채팅 전송 ─────────────────────────────────────────────────────────
  const sendChatMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsTyping(true);

    try {
      const history = chatMessages
        .filter((m) => m.id !== "welcome")
        .slice(-8)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const result = await onboardingChatMutation.mutateAsync({
        sessionId,
        message: text.trim(),
        history,
        currentStep: step,
        collectedData: {
          contactName: form.contactName || undefined,
          contactEmail: form.contactEmail || undefined,
          contactPhone: form.contactPhone || undefined,
          companyName: form.companyName || undefined,
          subscriptionPlan: form.subscriptionPlan,
          billingCycle: form.billingCycle,
          sampleCategory: form.sampleCategory,
        },
      });

      // AI가 추출한 필드 자동 채움
      if (result.extractedFields && Object.keys(result.extractedFields).length > 0) {
        const fields = result.extractedFields as Partial<OnboardingFormData>;
        updateForm(fields);
        // 모바일에서 자동 채움 시 폼 패널 열기
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
          setMobileFormOpen(true);
        }
      }

      // 다음 단계 이동
      if (result.stepComplete && result.nextStep && (result.nextStep as number) > step) {
        setTimeout(() => {
          setStep(result.nextStep as Step);
        }, 800);
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage(chatInput);
    }
  };

  // ─── 등록증 업로드 처리 ───────────────────────────────────────────────────
  const handleLicenseUpload = async (file: File, type: "biz" | "tour") => {
    const setter = type === "biz" ? setBizLicense : setTourLicense;
    setter((prev) => ({ ...prev, uploading: true }));
    try {
      // 1. 파일 업로드 (공통 업로드 엔드포인트)
      const formData = new FormData();
      formData.append("file", file);
      formData.append("prefix", "partner-onboarding");
      const res = await fetch("/api/upload/storage", { method: "POST", body: formData });
      if (!res.ok) throw new Error("업로드 실패");
      const data = (await res.json()) as { key: string; url: string };
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      setter((prev) => ({
        ...prev,
        uploading: false,
        key: data.key,
        url: data.url,
        previewUrl,
        ocrLoading: file.type.startsWith("image/"),
      }));

      // 2. OCR 처리 (이미지 파일만)
      if (file.type.startsWith("image/")) {
        try {
          if (type === "biz") {
            const ocrResult = await ocrBizMutation.mutateAsync({ imageUrl: data.url });
            const ocrStr = ocrResult.data ? JSON.stringify(ocrResult.data) : "";
            setter((prev) => ({ ...prev, ocrLoading: false, ocrResult: ocrStr, ocrRawText: ocrStr }));
          } else {
            const ocrResult = await ocrTourMutation.mutateAsync({ imageUrl: data.url });
            const ocrStr = ocrResult.data ? JSON.stringify(ocrResult.data) : "";
            setter((prev) => ({ ...prev, ocrLoading: false, ocrResult: ocrStr, ocrRawText: ocrStr }));
          }
          toast.success(
            `${type === "biz" ? "사업자등록증" : "관광사업자등록증"} OCR 분석 완료`
          );
        } catch {
          setter((prev) => ({ ...prev, ocrLoading: false }));
        }
      }
    } catch {
      setter((prev) => ({ ...prev, uploading: false }));
      toast.error("파일 업로드에 실패했습니다.");
    }
  };

  // ─── Step 2 다음 처리 ─────────────────────────────────────────────────────
  const handleStep2Next = () => {
    const hasBiz = !!bizLicense.url;
    const hasTour = !!tourLicense.url;
    if (!hasBiz && !hasTour) {
      toast.error("최소 하나의 등록증을 업로드해주세요.");
      return;
    }
    if (hasBiz && hasTour) {
      // 두 등록증 모두 있으면 자동 승인 시도
      submitWithBothOcrMutation.mutate({
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
      setStep(3);
    }
  };

  // ─── Step 3 결제 처리 ─────────────────────────────────────────────────────
  const handlePayment = async () => {
    // onboardingId가 없으면 먼저 submit
    if (!onboardingId) {
      submitMutation.mutate({
        companyName: form.companyName || form.contactName,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone || undefined,
        sampleCategory: form.sampleCategory,
        subscriptionPlan: form.subscriptionPlan,
        billingCycle: form.billingCycle,
      });
      // submit onSuccess에서 starter면 step 4로 이동
      if (form.subscriptionPlan !== "starter") {
        // submit 완료 후 결제 진행 필요 - onboardingId 설정 후 재시도 안내
        toast.info("신청 정보가 저장되었습니다. 잠시 후 결제 버튼을 다시 눌러주세요.");
      }
      return;
    }

    if (form.subscriptionPlan === "starter") {
      setStep(4);
      return;
    }

    setPaymentLoading(true);
    try {
      const prepared = await prepareMutation.mutateAsync({
        plan: form.subscriptionPlan,
        billingCycle: form.billingCycle,
        companyName: form.companyName || form.contactName,
        contactEmail: form.contactEmail,
        contactName: form.contactName,
        onboardingId,
      });

      if (prepared.isFree) {
        setStep(4);
        setPaymentLoading(false);
        return;
      }

      if (!prepared.paymentId || !prepared.amount) {
        throw new Error("결제 정보 생성에 실패했습니다.");
      }

      // PortOne 결제 요청
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (PortOne as any).requestPayment({
        storeId: prepared.storeId,
        channelKey: prepared.channelKey,
        paymentId: prepared.paymentId,
        orderName: prepared.orderName,
        totalAmount: prepared.amount,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: {
          email: prepared.customerEmail,
          fullName: prepared.customerName,
        },
        customData: prepared.customData ? JSON.parse(prepared.customData) : undefined,
      });

      if (!response || response.code !== undefined) {
        toast.error(response?.message ?? "결제가 취소되었습니다.");
        setPaymentLoading(false);
        return;
      }

      await verifyMutation.mutateAsync({
        paymentId: prepared.paymentId,
        plan: form.subscriptionPlan,
        billingCycle: form.billingCycle,
        companyName: form.companyName || form.contactName,
        contactEmail: form.contactEmail,
        contactName: form.contactName,
        onboardingId,
      });
    } catch (err) {
      console.error("결제 오류:", err);
      toast.error("결제 처리 중 오류가 발생했습니다.");
      setPaymentLoading(false);
    }
  };

  // ─── 파생 상태 ────────────────────────────────────────────────────────────
  const step1Valid = form.contactName.trim() && form.contactEmail.trim();
  const hasBizLicense = !!bizLicense.url;
  const hasTourLicense = !!tourLicense.url;
  const hasBothLicenses = hasBizLicense && hasTourLicense;
  const isAnyLoading =
    bizLicense.uploading ||
    bizLicense.ocrLoading ||
    tourLicense.uploading ||
    tourLicense.ocrLoading;
  const isProcessing =
    submitMutation.isPending ||
    submitWithBothOcrMutation.isPending ||
    paymentLoading ||
    verifyMutation.isPending ||
    prepareMutation.isPending;

  // ─── 수기 입력 패널 렌더 ──────────────────────────────────────────────────
  const renderFormPanel = () => (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* 패널 헤더 */}
      <div className="bg-white border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm text-gray-900">두골프 파트너 가입</p>
            <p className="text-[10px] text-gray-500">정보를 입력하거나 AI와 대화하세요</p>
          </div>
        </div>
        <StepIndicator current={step} />
      </div>

      {/* Step 1: 담당자 정보 */}
      {step === 1 && (
        <div className="p-4 space-y-4 flex-1">
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                담당자명 <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="홍길동"
                value={form.contactName}
                onChange={(e) => updateForm({ contactName: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                이메일 <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                placeholder="hong@company.com"
                value={form.contactEmail}
                onChange={(e) => updateForm({ contactEmail: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1 block">전화번호</Label>
              <Input
                placeholder="010-1234-5678"
                value={form.contactPhone}
                onChange={(e) => updateForm({ contactPhone: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1 block">업체명</Label>
              <Input
                placeholder="투어컴퍼니"
                value={form.companyName}
                onChange={(e) => updateForm({ companyName: e.target.value })}
                className="text-sm"
              />
            </div>
          </div>
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-sm"
            disabled={!step1Valid}
            onClick={() => setStep(2)}
          >
            다음 단계 <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      )}

      {/* Step 2: 등록증 업로드 */}
      {step === 2 && (
        <div className="p-4 space-y-4 flex-1">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex gap-2">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-800">
              <span className="font-semibold">두 등록증 모두 업로드 시 즉시 자동 승인!</span>
              <br />
              한 가지만 업로드하면 플랜 선택 후 담당자 검토가 진행됩니다.
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <div
              className={`flex-1 p-2 rounded-lg border text-center ${
                hasBizLicense
                  ? "border-green-400 bg-green-50 text-green-700"
                  : "border-gray-200 text-gray-400"
              }`}
            >
              {hasBizLicense ? (
                <CheckCircle2 size={12} className="inline mr-1" />
              ) : (
                <AlertCircle size={12} className="inline mr-1" />
              )}
              사업자등록증 {hasBizLicense ? "완료" : "미업로드"}
            </div>
            <div
              className={`flex-1 p-2 rounded-lg border text-center ${
                hasTourLicense
                  ? "border-green-400 bg-green-50 text-green-700"
                  : "border-gray-200 text-gray-400"
              }`}
            >
              {hasTourLicense ? (
                <CheckCircle2 size={12} className="inline mr-1" />
              ) : (
                <AlertCircle size={12} className="inline mr-1" />
              )}
              관광사업자등록증 {hasTourLicense ? "완료" : "미업로드"}
            </div>
          </div>
          <LicenseUploadCard
            title="사업자등록증"
            description="JPG, PNG, PDF · AI 자동 추출"
            icon={<FileText size={16} className="text-green-600" />}
            state={bizLicense}
            onFileChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleLicenseUpload(f, "biz");
            }}
            ocrFields={[
              { label: "업체명", key: "companyName" },
              { label: "사업자번호", key: "businessNumber" },
              { label: "대표자", key: "ceoName" },
              { label: "업태", key: "businessType" },
              { label: "종목", key: "businessItem" },
              { label: "주소", key: "address" },
              { label: "개업일", key: "openDate" },
            ]}
            onOcrEdit={(updated) => {
              setBizLicense((prev) => ({
                ...prev,
                ocrResult: JSON.stringify(updated),
                ocrRawText: JSON.stringify(updated),
              }));
              toast.success("사업자등록증 정보가 수정되었습니다.");
            }}
          />
          <LicenseUploadCard
            title="관광사업자등록증"
            description="JPG, PNG, PDF · AI 자동 추출"
            icon={<FileText size={16} className="text-blue-600" />}
            state={tourLicense}
            onFileChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleLicenseUpload(f, "tour");
            }}
            ocrFields={[
              { label: "등록번호", key: "licenseNo" },
              { label: "사업 종류", key: "licenseType" },
              { label: "업체명", key: "companyName" },
              { label: "대표자", key: "ceoName" },
              { label: "주소", key: "address" },
              { label: "등록일", key: "openDate" },
            ]}
            onOcrEdit={(updated) => {
              setTourLicense((prev) => ({
                ...prev,
                ocrResult: JSON.stringify(updated),
                ocrRawText: JSON.stringify(updated),
              }));
              toast.success("관광사업자등록증 정보가 수정되었습니다.");
            }}
          />
          {hasBothLicenses && (
            <div className="bg-green-50 border-2 border-green-400 rounded-xl p-3 flex gap-2">
              <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              <p className="text-xs text-green-800 font-semibold">
                두 등록증 업로드 완료! 아래 버튼으로 즉시 자동 승인됩니다.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep(1)} className="flex-1">
              <ChevronLeft size={14} className="mr-1" /> 이전
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={(!hasBizLicense && !hasTourLicense) || isAnyLoading || isProcessing}
              onClick={handleStep2Next}
            >
              {isProcessing ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {hasBothLicenses ? "즉시 자동 승인" : "다음 단계"}
              <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: 플랜 선택 */}
      {step === 3 && (
        <div className="p-4 space-y-3 flex-1">
          <p className="text-xs text-gray-500 text-center">
            구독 플랜을 선택해주세요. 언제든지 변경 가능합니다.
          </p>
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`border-2 rounded-xl p-3 cursor-pointer transition-all ${
                form.subscriptionPlan === plan.id
                  ? plan.borderClass + " shadow-md"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => updateForm({ subscriptionPlan: plan.id })}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{plan.name}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {plan.badge}
                  </Badge>
                </div>
                <span className="font-bold text-sm text-green-700">
                  {plan.monthlyPrice === 0
                    ? "무료"
                    : `${plan.monthlyPrice.toLocaleString()}원/월`}
                </span>
              </div>
              <ul className="space-y-0.5">
                {plan.features.slice(0, 3).map((f) => (
                  <li key={f} className="text-[11px] text-gray-600 flex items-center gap-1">
                    <CheckCircle2 size={10} className="text-green-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep(2)} className="flex-1">
              <ChevronLeft size={14} className="mr-1" /> 이전
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={isProcessing}
              onClick={handlePayment}
            >
              {isProcessing ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {form.subscriptionPlan === "starter" ? "무료로 시작" : "결제하기"}
              <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: 완료 */}
      {step === 4 && (
        <div className="p-4 flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900 mb-1">가입 신청 완료!</h3>
            <p className="text-sm text-gray-600">
              {submitWithBothOcrMutation.data?.autoApproved
                ? "즉시 자동 승인되었습니다. 파트너 대시보드로 이동합니다."
                : "관리자 검토 후 1~2 영업일 내에 승인됩니다."}
            </p>
          </div>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => navigate("/partner/dashboard")}
          >
            파트너 대시보드로 이동
          </Button>
        </div>
      )}
    </div>
  );

  // ─── 채팅 패널 렌더 ───────────────────────────────────────────────────────
  const renderChatPanel = () => (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 채팅 헤더 */}
      <div className="bg-white border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm text-gray-900">두골프 매니저</p>
            <p className="text-[10px] text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" /> 온라인
            </p>
          </div>
          <Badge variant="secondary" className="ml-auto text-[10px]">
            AI 온보딩
          </Badge>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatMessages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} />
        ))}
        {isTyping && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span
                  className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 빠른 질문 (초기 상태) */}
      {step === 1 && chatMessages.length <= 2 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0">
          {["담당자 정보 입력할게요", "가입 절차 설명해줘", "플랜 추천해줘"].map((q) => (
            <button
              key={q}
              className="shrink-0 text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors"
              onClick={() => sendChatMessage(q)}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* 입력창 */}
      <div className="bg-white border-t px-3 py-2 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={chatInputRef}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 max-h-24 min-h-[40px]"
            placeholder="메시지를 입력하세요..."
            rows={1}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleChatKeyDown}
          />
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 rounded-xl h-10 w-10 p-0 shrink-0"
            disabled={!chatInput.trim() || isTyping}
            onClick={() => sendChatMessage(chatInput)}
          >
            {isTyping ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  // ─── 메인 렌더 ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">
      {/* 상단 헤더 */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">두골프 파트너 가입</span>
          </div>
          <span className="hidden sm:block text-xs text-gray-500">
            AI 매니저와 대화하며 간편하게 가입하세요
          </span>
        </div>
      </header>

      {/* PC 레이아웃: 좌측 폼 패널 + 우측 AI 채팅 */}
      <div className="hidden lg:flex max-w-7xl mx-auto h-[calc(100vh-57px)]">
        {/* 좌측: 수기 입력 패널 */}
        <div className="w-[420px] shrink-0 bg-white border-r overflow-hidden flex flex-col">
          {renderFormPanel()}
        </div>
        {/* 우측: AI 채팅 */}
        <div className="flex-1 overflow-hidden flex flex-col">{renderChatPanel()}</div>
      </div>

      {/* 모바일 레이아웃: 채팅 메인 + 하단 수기 입력 토글 */}
      <div className="lg:hidden flex flex-col h-[calc(100vh-57px)]">
        {/* 채팅 영역 (메인) */}
        <div
          className={`overflow-hidden flex flex-col transition-all duration-300 ${
            mobileFormOpen ? "h-[40vh]" : "flex-1"
          }`}
        >
          {renderChatPanel()}
        </div>

        {/* 하단 수기 입력 토글 버튼 */}
        <button
          className="bg-white border-t border-gray-200 px-4 py-2.5 flex items-center justify-between w-full shrink-0 hover:bg-gray-50 transition-colors"
          onClick={() => setMobileFormOpen((v) => !v)}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <User size={16} className="text-green-600" />
            <span>가입 정보 입력</span>
            {step > 1 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Step {step}/4
              </Badge>
            )}
            {form.contactName && (
              <span className="text-xs text-green-600 font-normal">{form.contactName}</span>
            )}
          </div>
          {mobileFormOpen ? (
            <ChevronDown size={18} className="text-gray-500" />
          ) : (
            <ChevronUp size={18} className="text-gray-500" />
          )}
        </button>

        {/* 수기 입력 패널 (슬라이드 업) */}
        {mobileFormOpen && (
          <div className="h-[55vh] bg-white border-t overflow-hidden flex flex-col">
            {renderFormPanel()}
          </div>
        )}
      </div>
    </div>
  );
}
