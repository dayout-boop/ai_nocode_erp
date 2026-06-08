/**
 * 파트너 AI 온보딩 채팅 페이지 (전면 재구현 2026-06-08)
 * - 구글 로그인 후 신규 파트너 전용
 * - PC: 좌측 수기 입력 패널 + 우측 두골프 매니저 AI 채팅
 * - 모바일: AI 채팅 메인 + 하단 수기 입력 토글 패널
 * - AI 대화로 수집한 정보가 수기 입력 필드에 실시간 자동 채움
 * - Step 완료 감지 → 좌측 패널 자동 전환
 * - 링크 버블 렌더링 (파트너 로그인 URL 등)
 * - 가입 완료 후 채팅 메시지 + 자동 이동
 * - 스킵 시 AI 가이드 안내
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
  ExternalLink,
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
  /** 채팅 버블 내 클릭 가능 링크 목록 */
  links?: { label: string; href: string }[];
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
                  OCR 인식이 부정확한 경우 직접 수정하세요.
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

// ─── 텍스트 내 URL을 클릭 가능한 링크로 변환 ─────────────────────────────────
function renderMessageContent(content: string) {
  // URL 패턴 감지
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      // URL 재설정 (split 후 lastIndex 초기화 필요)
      urlRegex.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-blue-600 hover:text-blue-800 break-all inline-flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
          <ExternalLink size={10} className="shrink-0" />
        </a>
      );
    }
    // **bold** 처리
    const boldParts = part.split(/\*\*(.*?)\*\*/g);
    return boldParts.map((bp, j) =>
      j % 2 === 1 ? (
        <strong key={`${i}-${j}`} className="font-semibold">
          {bp}
        </strong>
      ) : (
        <span key={`${i}-${j}`}>{bp}</span>
      )
    );
  });
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
      <div className="flex flex-col gap-1 max-w-[85%]">
        <div
          className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
            isUser
              ? "bg-green-600 text-white rounded-tr-sm"
              : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
          }`}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{msg.content}</span>
          ) : (
            <span className="whitespace-pre-wrap">
              {renderMessageContent(msg.content)}
            </span>
          )}
        </div>
        {/* 링크 버블 (별도 카드) */}
        {msg.links && msg.links.length > 0 && (
          <div className="flex flex-col gap-1">
            {msg.links.map((link, i) => (
              <a
                key={i}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-green-50 border border-green-300 rounded-xl px-3 py-2 text-xs text-green-800 font-semibold hover:bg-green-100 transition-colors"
              >
                <ExternalLink size={12} className="shrink-0 text-green-600" />
                {link.label}
              </a>
            ))}
          </div>
        )}
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

  // 채팅창 파일 업로드 ref (Step 2 전용)
  const chatBizFileRef = useRef<HTMLInputElement>(null);
  const chatTourFileRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isTyping, scrollToBottom]);

  // ─── 이탈 후 재진입 복원 ─────────────────────────────────────────────────
  const statusQuery = trpc.partnerOnboarding.getStatusByEmail.useQuery(
    { email: googleEmail },
    { enabled: !!googleEmail, retry: false }
  );

  useEffect(() => {
    if (!statusQuery.data) return;
    const d = statusQuery.data;
    if (!d.hasApplication || !d.data) return;

    // 이미 승인/활성 파트너면 대시보드로
    if (d.status === "approved" || d.status === "active") {
      navigate("/partner/dashboard");
      return;
    }

    // pending/reviewing 상태면 기존 데이터 복원
    if (d.status === "pending" || d.status === "reviewing") {
      const saved = d.data;
      setOnboardingId(saved.id);
      setForm((prev) => ({
        ...prev,
        contactName: saved.contactName || prev.contactName,
        contactEmail: saved.contactEmail || prev.contactEmail,
        contactPhone: (saved.contactPhone as string) || prev.contactPhone,
        companyName: (saved.companyName as string) || prev.companyName,
        subscriptionPlan:
          (saved.subscriptionPlan as "starter" | "standard" | "premium") ||
          prev.subscriptionPlan,
        sampleCategory:
          (saved.sampleCategory as
            | "golf_tour_domestic"
            | "golf_tour_overseas"
            | "golf_tour_mixed") || prev.sampleCategory,
      }));

      if (saved.businessLicenseUrl) {
        setBizLicense((prev) => ({
          ...prev,
          url: saved.businessLicenseUrl as string,
          ocrResult: (saved.ocrResult as string) || "",
          ocrRawText: (saved.ocrResult as string) || "",
        }));
      }
      if (saved.tourismLicenseUrl) {
        setTourLicense((prev) => ({
          ...prev,
          url: saved.tourismLicenseUrl as string,
          ocrResult: (saved.tourismOcrResult as string) || "",
          ocrRawText: (saved.tourismOcrResult as string) || "",
        }));
      }

      if (saved.businessLicenseUrl || saved.tourismLicenseUrl) {
        setStep(2);
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: "restore-msg",
          role: "assistant" as const,
          content: `이전에 진행하시던 가입 절차가 있습니다. 이어서 진행해 드릴게요! 😊\n\n현재 저장된 정보:\n• 담당자: ${saved.contactName || "미입력"}\n• 이메일: ${saved.contactEmail}\n• 업체명: ${(saved.companyName as string) || "미입력"}\n${saved.businessLicenseUrl ? "• 사업자등록증: 업로드 완료 ✅" : ""}\n${saved.tourismLicenseUrl ? "• 관광사업자등록증: 업로드 완료 ✅" : ""}\n\n계속 진행하시겠어요?`,
          timestamp: new Date(),
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusQuery.data]);

  // ─── tRPC mutations ────────────────────────────────────────────────────────
  const onboardingChatMutation = trpc.aiAssistant.onboardingChat.useMutation();
  const ocrBizMutation = trpc.partnerOnboarding.ocrBusinessLicense.useMutation();
  const ocrTourMutation = trpc.partnerOnboarding.ocrTourismLicense.useMutation();

  const submitWithBothOcrMutation = trpc.partnerOnboarding.submitWithBothOcr.useMutation({
    onSuccess: (data) => {
      setOnboardingId(data.id);
      setStep(4);
      if (data.autoApproved) {
        // 가입 완료 채팅 메시지 (자동 승인)
        setChatMessages((prev) => [
          ...prev,
          {
            id: `complete-auto-${Date.now()}`,
            role: "assistant" as const,
            content:
              "🎉 축하드립니다! 두 등록증이 모두 확인되어 **즉시 자동 승인**되었습니다!\n\n파트너 대시보드에서 바로 서비스를 이용하실 수 있어요. 아래 버튼을 클릭해 이동하세요!",
            timestamp: new Date(),
            links: [{ label: "파트너 대시보드로 이동", href: "/partner/dashboard" }],
          },
        ]);
        toast.success("자동 승인 완료! ERP를 바로 이용하실 수 있습니다.");
        setTimeout(() => navigate("/partner/dashboard"), 3000);
      } else {
        // 가입 완료 채팅 메시지 (검토 대기)
        const loginUrl = `${window.location.origin}/partner/login`;
        setChatMessages((prev) => [
          ...prev,
          {
            id: `complete-review-${Date.now()}`,
            role: "assistant" as const,
            content:
              "✅ 가입 신청이 완료되었습니다!\n\n관리자 검토 후 **1~2 영업일 내**에 승인 이메일이 발송됩니다. 승인 완료 후 아래 링크로 로그인하세요!",
            timestamp: new Date(),
            links: [{ label: "파트너 로그인 페이지", href: loginUrl }],
          },
        ]);
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
        const loginUrl = `${window.location.origin}/partner/login`;
        setChatMessages((prev) => [
          ...prev,
          {
            id: `complete-starter-${Date.now()}`,
            role: "assistant" as const,
            content:
              "✅ 스타터 플랜으로 가입 신청이 완료되었습니다!\n\n관리자 검토 후 **1~2 영업일 내**에 승인됩니다. 승인 완료 후 아래 링크로 로그인하세요!",
            timestamp: new Date(),
            links: [{ label: "파트너 로그인 페이지", href: loginUrl }],
          },
        ]);
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
      const loginUrl = `${window.location.origin}/partner/login`;
      setChatMessages((prev) => [
        ...prev,
        {
          id: `complete-paid-${Date.now()}`,
          role: "assistant" as const,
          content:
            "🎉 결제가 완료되었습니다! 파트너 가입이 확정되었어요.\n\n아래 링크로 파트너 로그인 후 서비스를 이용하세요!",
          timestamp: new Date(),
          links: [{ label: "파트너 로그인 페이지", href: loginUrl }],
        },
      ]);
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

      // ─── 단계 전환 로직 (강화) ────────────────────────────────────────────
      // 1) AI가 명시적으로 stepComplete + nextStep 반환한 경우
      if (result.stepComplete && result.nextStep && (result.nextStep as number) > step) {
        const targetStep = result.nextStep as Step;
        setTimeout(() => {
          setStep(targetStep);
          // 단계 전환 안내 메시지 (AI 응답 이후에 추가)
          const stepLabels: Record<number, string> = {
            2: "Step 2: 등록증 업로드",
            3: "Step 3: 플랜 선택",
            4: "Step 4: 완료",
          };
          if (stepLabels[targetStep]) {
            setChatMessages((prev) => [
              ...prev,
              {
                id: `step-advance-${Date.now()}`,
                role: "assistant" as const,
                content: `좌측 패널이 **${stepLabels[targetStep]}** 단계로 이동했습니다. 계속 진행해 주세요! 👉`,
                timestamp: new Date(),
              },
            ]);
          }
        }, 800);
      }

      // 2) 사용자가 "스킵" 또는 "건너뛰기" 등을 입력한 경우 → 가이드 안내
      const skipKeywords = ["스킵", "건너뛰", "나중에", "패스", "skip", "pass", "다음으로"];
      const isSkipRequest = skipKeywords.some((kw) =>
        text.toLowerCase().includes(kw)
      );
      if (isSkipRequest && step === 2) {
        // Step 2 스킵 시 안내
        setTimeout(() => {
          setChatMessages((prev) => [
            ...prev,
            {
              id: `skip-guide-${Date.now()}`,
              role: "assistant" as const,
              content:
                "📋 등록증 업로드를 나중에 하실 수 있습니다!\n\n단, **두 등록증 모두 업로드 시 즉시 자동 승인**되며, 미업로드 시 담당자 검토(1~2 영업일)가 필요합니다.\n\n좌측 패널의 **'다음 단계'** 버튼을 눌러 플랜 선택으로 넘어가세요.",
              timestamp: new Date(),
            },
          ]);
        }, 1200);
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

      // OCR 처리 (이미지 파일만)
      if (file.type.startsWith("image/")) {
        try {
          let ocrStr = "";
          let ocrParsed: Record<string, string> | null = null;
          if (type === "biz") {
            const ocrResult = await ocrBizMutation.mutateAsync({ imageUrl: data.url });
            ocrStr = ocrResult.data ? JSON.stringify(ocrResult.data) : "";
            ocrParsed = ocrResult.data as Record<string, string> | null;
            setter((prev) => ({ ...prev, ocrLoading: false, ocrResult: ocrStr, ocrRawText: ocrStr }));
          } else {
            const ocrResult = await ocrTourMutation.mutateAsync({ imageUrl: data.url });
            ocrStr = ocrResult.data ? JSON.stringify(ocrResult.data) : "";
            ocrParsed = ocrResult.data as Record<string, string> | null;
            setter((prev) => ({ ...prev, ocrLoading: false, ocrResult: ocrStr, ocrRawText: ocrStr }));
          }
          toast.success(
            `${type === "biz" ? "사업자등록증" : "관광사업자등록증"} OCR 분석 완료`
          );
          // 채팅창에 OCR 결과 표시
          if (ocrParsed) {
            const typeName = type === "biz" ? "사업자등록증" : "관광사업자등록증";
            const fields =
              type === "biz"
                ? [
                    { label: "업체명", key: "companyName" },
                    { label: "사업자번호", key: "businessNumber" },
                    { label: "대표자", key: "ceoName" },
                    { label: "업태", key: "businessType" },
                    { label: "종목", key: "businessItem" },
                    { label: "주소", key: "address" },
                    { label: "개업일", key: "openDate" },
                  ]
                : [
                    { label: "등록번호", key: "licenseNo" },
                    { label: "사업 종류", key: "licenseType" },
                    { label: "업체명", key: "companyName" },
                    { label: "대표자", key: "ceoName" },
                    { label: "주소", key: "address" },
                    { label: "등록일", key: "openDate" },
                  ];
            const summary = fields
              .filter((f) => ocrParsed![f.key])
              .map((f) => `• ${f.label}: ${ocrParsed![f.key]}`)
              .join("\n");
            const confirmMsg: ChatMessage = {
              id: `ocr-${Date.now()}`,
              role: "assistant",
              content: `${typeName} OCR 분석이 완료되었습니다! 📋\n\n**추출된 정보:**\n${summary || "인식된 정보 없음"}\n\n정보가 맞나요? 다르면 좌측 패널에서 "수정" 버튼으로 직접 수정할 수 있습니다.`,
              timestamp: new Date(),
            };
            setChatMessages((prev) => [...prev, confirmMsg]);

            // 두 등록증 모두 업로드 완료 시 안내
            const otherUploaded = type === "biz" ? !!tourLicense.url : !!bizLicense.url;
            if (otherUploaded) {
              setTimeout(() => {
                setChatMessages((prev) => [
                  ...prev,
                  {
                    id: `both-done-${Date.now()}`,
                    role: "assistant" as const,
                    content:
                      "🎉 두 등록증이 모두 업로드되었습니다!\n\n좌측 패널의 **'즉시 자동 승인'** 버튼을 클릭하면 바로 파트너 계정이 활성화됩니다!",
                    timestamp: new Date(),
                  },
                ]);
              }, 800);
            }
          }
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
      // 스킵 시도 시 AI 가이드
      setChatMessages((prev) => [
        ...prev,
        {
          id: `upload-required-${Date.now()}`,
          role: "assistant" as const,
          content:
            "📎 등록증을 최소 하나 이상 업로드해야 다음 단계로 진행할 수 있습니다.\n\n채팅창 하단의 **사업자등록증** 또는 **관광사업자등록증** 버튼을 눌러 파일을 업로드해 주세요!",
          timestamp: new Date(),
        },
      ]);
      return;
    }
    if (hasBiz && hasTour) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `step2-auto-${Date.now()}`,
          role: "assistant" as const,
          content: "두 등록증이 모두 업로드되었습니다! 🎉 자동 승인을 진행하겠습니다...",
          timestamp: new Date(),
        },
      ]);
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
      setChatMessages((prev) => [
        ...prev,
        {
          id: `step2-done-${Date.now()}`,
          role: "assistant" as const,
          content: `등록증 업로드 완료! 📎 이제 **Step 3: 플랜 선택** 단계입니다.\n원하시는 구독 플랜을 선택해 주세요. 스타터 플랜은 무료로 시작할 수 있어요!`,
          timestamp: new Date(),
        },
      ]);
      setStep(3);
    }
  };

  // ─── Step 3 결제 처리 ─────────────────────────────────────────────────────
  const handlePayment = async () => {
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
      if (form.subscriptionPlan !== "starter") {
        toast.info("신청 정보가 저장되었습니다. 잠시 후 결제 버튼을 다시 눌러주세요.");
      }
      return;
    }

    if (form.subscriptionPlan === "starter") {
      // 스타터: 바로 submit 후 Step 4
      submitMutation.mutate({
        companyName: form.companyName || form.contactName,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone || undefined,
        sampleCategory: form.sampleCategory,
        subscriptionPlan: "starter",
        billingCycle: form.billingCycle,
      });
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
                {googleEmail && (
                  <span className="ml-1.5 text-[10px] text-green-600 font-normal bg-green-50 px-1.5 py-0.5 rounded-full">
                    구글 인증됨
                  </span>
                )}
              </Label>
              <Input
                type="email"
                placeholder="hong@company.com"
                value={form.contactEmail}
                readOnly={!!googleEmail}
                onChange={(e) => !googleEmail && updateForm({ contactEmail: e.target.value })}
                className={`text-sm ${
                  googleEmail ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""
                }`}
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
            onClick={() => {
              setStep(2);
              setChatMessages((prev) => [
                ...prev,
                {
                  id: `step1-done-${Date.now()}`,
                  role: "assistant" as const,
                  content: `담당자 정보가 저장되었습니다! 😊\n• 이름: ${form.contactName}\n• 이메일: ${form.contactEmail}${form.contactPhone ? `\n• 전화: ${form.contactPhone}` : ""}${form.companyName ? `\n• 업체명: ${form.companyName}` : ""}\n\n이제 **Step 2: 등록증 업로드** 단계입니다.\n채팅창 하단의 📎 버튼으로 사업자등록증과 관광사업자등록증을 업로드해 주세요!`,
                  timestamp: new Date(),
                },
              ]);
            }}
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
          {/* 스킵 안내 링크 */}
          <button
            type="button"
            className="w-full text-[11px] text-gray-400 hover:text-gray-600 text-center underline"
            onClick={() => {
              setChatMessages((prev) => [
                ...prev,
                {
                  id: `skip-step2-${Date.now()}`,
                  role: "assistant" as const,
                  content:
                    "📋 등록증 업로드를 나중에 하실 수 있습니다!\n\n단, **두 등록증 모두 업로드 시 즉시 자동 승인**되며, 미업로드 시 담당자 검토(1~2 영업일)가 필요합니다.\n\n최소 하나의 등록증을 업로드하면 플랜 선택 단계로 넘어갈 수 있어요.",
                  timestamp: new Date(),
                },
              ]);
            }}
          >
            등록증 업로드 없이 진행하려면?
          </button>
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
                : "관리자 검토 후 1~2 영업일 내에 승인됩니다. 승인 이메일을 수령하시면 로그인하실 수 있습니다."}
            </p>
          </div>
          {submitWithBothOcrMutation.data?.autoApproved ? (
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => (window.location.href = "/partner/dashboard")}
            >
              파트너 대시보드로 이동
            </Button>
          ) : (
            <div className="space-y-2 w-full">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => (window.location.href = "/partner/login")}
              >
                파트너 로그인 페이지로
              </Button>
              <p className="text-xs text-gray-400">
                승인 완료 후 로그인하시면 대시보드를 이용할 수 있습니다
              </p>
            </div>
          )}
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
          {/* 현재 단계 표시 */}
          <Badge
            variant="outline"
            className="text-[10px] border-green-400 text-green-700"
          >
            Step {step}/4
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
        {/* Step 2에서 파일 업로드 단축 버튼 (채팅창 하단) */}
        {step === 2 && (
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              className={`flex-1 flex items-center gap-1.5 justify-center text-xs px-3 py-2 rounded-lg border transition-all font-medium ${
                bizLicense.url
                  ? "border-green-400 bg-green-50 text-green-700"
                  : "border-gray-300 bg-gray-50 text-gray-700 hover:border-green-400 hover:bg-green-50 hover:text-green-700"
              }`}
              onClick={() => chatBizFileRef.current?.click()}
              disabled={bizLicense.uploading || bizLicense.ocrLoading}
            >
              {bizLicense.uploading || bizLicense.ocrLoading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : bizLicense.url ? (
                <CheckCircle2 size={13} className="text-green-600" />
              ) : (
                <Upload size={13} />
              )}
              📄 사업자등록증
            </button>
            <button
              type="button"
              className={`flex-1 flex items-center gap-1.5 justify-center text-xs px-3 py-2 rounded-lg border transition-all font-medium ${
                tourLicense.url
                  ? "border-blue-400 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-gray-50 text-gray-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
              }`}
              onClick={() => chatTourFileRef.current?.click()}
              disabled={tourLicense.uploading || tourLicense.ocrLoading}
            >
              {tourLicense.uploading || tourLicense.ocrLoading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : tourLicense.url ? (
                <CheckCircle2 size={13} className="text-blue-600" />
              ) : (
                <Upload size={13} />
              )}
              🏌️ 관광사업자등록증
            </button>
            {/* 파일 입력 숨김 */}
            <input
              ref={chatBizFileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLicenseUpload(f, "biz");
              }}
            />
            <input
              ref={chatTourFileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLicenseUpload(f, "tour");
              }}
            />
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={chatInputRef}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 max-h-24 min-h-[40px]"
            placeholder={
              step === 2
                ? "등록증 업로드 후 '다음 단계' 버튼을 눌러주세요..."
                : "메시지를 입력하세요..."
            }
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
