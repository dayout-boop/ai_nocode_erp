// ============================================================
// DOGOLF Partner Chat — 두골프 매니저 AI 채팅 페이지
// 개선: 비로그인 시 구글 간편가입 화면, 온보딩 상태별 UI 분기
// ============================================================
import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Send,
  Loader2,
  ChevronLeft,
  Bot,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  Building2,
  FileText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  "상품 등록 방법 알려줘",
  "정산 기준 알려줘",
  "예약 취소 처리 방법",
  "수수료 정책이 궁금해",
  "ERP 사용법 안내",
];

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "안녕하세요! 🤖 두골프 매니저입니다.\n\n파트너 운영에 필요한 모든 것을 도와드립니다.\n상품 등록 방법, 정산 기준, 예약 처리, ERP 사용법 등 무엇이든 물어보세요!",
  timestamp: new Date(),
};

function generateSessionId() {
  return `mgr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── 비로그인 화면 ────────────────────────────────────────────────────────────
function NotLoggedInView() {
  const loginUrl = getLoginUrl();
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-green-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* 로고 & 타이틀 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Bot size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 font-display-ko mb-2">두골프 매니저</h1>
          <p className="text-gray-500 text-sm font-body">AI 파트너 지원 · 가입부터 운영까지</p>
        </div>

        {/* 기능 소개 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="font-bold text-gray-900 text-base font-body mb-4">파트너가 되시면</h2>
          <div className="space-y-3">
            {[
              { icon: <Sparkles size={16} className="text-indigo-500" />, text: "AI가 ERP + 홈페이지 자동 생성" },
              { icon: <Building2 size={16} className="text-green-500" />, text: "사업자등록증 하나로 5분 내 오픈" },
              { icon: <Bot size={16} className="text-purple-500" />, text: "24시간 AI 고객 상담 자동화" },
              { icon: <FileText size={16} className="text-orange-500" />, text: "상품 등록·예약·정산 통합 관리" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <span className="text-sm text-gray-700 font-body">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 구글 간편가입 버튼 */}
        <a href={loginUrl} className="block">
          <button className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-indigo-400 text-gray-700 font-semibold font-body py-3.5 px-6 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            구글 계정으로 간편 가입 / 로그인
          </button>
        </a>

        <p className="text-center text-xs text-gray-400 font-body mt-4">
          신용카드 불필요 · 무료로 시작 · 언제든 취소 가능
        </p>

        <div className="text-center mt-6">
          <Link href="/">
            <span className="text-xs text-gray-400 hover:text-gray-600 font-body cursor-pointer">
              ← 홈으로 돌아가기
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── 온보딩 신청 대기 화면 ─────────────────────────────────────────────────────
function OnboardingPendingView({ status, companyName, adminNote }: {
  status: string;
  companyName: string;
  adminNote?: string | null;
}) {
  const statusConfig = {
    pending: {
      icon: <Clock size={24} className="text-yellow-500" />,
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      title: "신청 검토 중",
      desc: "관리자가 신청 내용을 검토하고 있습니다. 보통 1~2 영업일 내에 처리됩니다.",
      color: "text-yellow-700",
    },
    reviewing: {
      icon: <Clock size={24} className="text-blue-500" />,
      bg: "bg-blue-50",
      border: "border-blue-200",
      title: "최종 검토 중",
      desc: "신청 내용을 최종 검토하고 있습니다. 곧 결과를 안내해 드리겠습니다.",
      color: "text-blue-700",
    },
    rejected: {
      icon: <XCircle size={24} className="text-red-500" />,
      bg: "bg-red-50",
      border: "border-red-200",
      title: "신청 반려",
      desc: "신청이 반려되었습니다. 아래 사유를 확인하고 다시 신청해 주세요.",
      color: "text-red-700",
    },
  };

  const cfg = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.pending;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-6 mb-4`}>
          <div className="flex items-center gap-3 mb-3">
            {cfg.icon}
            <h2 className={`font-bold text-lg font-body ${cfg.color}`}>{cfg.title}</h2>
          </div>
          <p className="text-gray-600 text-sm font-body mb-2">
            <span className="font-semibold">{companyName}</span> 님의 파트너 신청
          </p>
          <p className="text-gray-500 text-sm font-body">{cfg.desc}</p>
          {adminNote && (
            <div className="mt-3 bg-white rounded-xl p-3 border border-gray-200">
              <p className="text-xs text-gray-500 font-body mb-1">관리자 메모</p>
              <p className="text-sm text-gray-700 font-body">{adminNote}</p>
            </div>
          )}
        </div>

        {status === "rejected" && (
          <Link href="/partner/join">
            <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold font-body py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
              다시 신청하기
              <ArrowRight size={16} />
            </button>
          </Link>
        )}

        <div className="text-center mt-4">
          <p className="text-xs text-gray-400 font-body">
            문의: <a href="tel:1668-1739" className="text-indigo-500 hover:underline">1668-1739</a> (평일 09:00~17:30)
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── 온보딩 미신청 화면 ───────────────────────────────────────────────────────
function OnboardingStartView({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-green-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 font-display-ko mb-2">
            {userName} 님, 환영합니다!
          </h1>
          <p className="text-gray-500 text-sm font-body">
            {userEmail} · 로그인 완료
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="font-bold text-gray-900 text-base font-body mb-2">파트너 가입 신청</h2>
          <p className="text-gray-500 text-sm font-body mb-4">
            사업자등록증을 업로드하면 AI가 자동으로 정보를 인식하고 ERP + 홈페이지를 생성합니다.
          </p>
          <div className="space-y-2">
            {[
              "STEP 1 · 기본 정보 입력",
              "STEP 2 · 사업자등록증 업로드 (AI OCR 자동 인식)",
              "STEP 3 · 구독 플랜 선택",
              "STEP 4 · ERP + 홈페이지 자동 생성",
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-indigo-600">{i + 1}</span>
                </div>
                <span className="text-sm text-gray-600 font-body">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => navigate("/partner/join")}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold font-body py-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-base"
        >
          <Upload size={18} />
          파트너 가입 신청하기
        </button>

        <p className="text-center text-xs text-gray-400 font-body mt-4">
          약 5분 소요 · 신용카드 불필요 · 무료로 시작
        </p>
      </div>
    </div>
  );
}

// ─── 메인 채팅 컴포넌트 ───────────────────────────────────────────────────────
export default function PartnerChat() {
  const { user, loading, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatMutation = trpc.aiAssistant.managerChat.useMutation();

  // 온보딩 상태 조회 (로그인된 경우에만)
  const { data: onboardingStatus, isLoading: onboardingLoading } =
    trpc.partnerOnboarding.getMyStatus.useQuery(undefined, {
      enabled: isAuthenticated,
      retry: false,
    });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (isAuthenticated && onboardingStatus?.status === "approved" || onboardingStatus?.status === "active") {
      inputRef.current?.focus();
    }
  }, [isAuthenticated, onboardingStatus]);

  // 로딩 중
  if (loading || (isAuthenticated && onboardingLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-green-600" size={32} />
      </div>
    );
  }

  // 비로그인 → 구글 간편가입 화면
  if (!isAuthenticated) {
    return <NotLoggedInView />;
  }

  // 온보딩 미신청 → 가입 안내 화면
  if (!onboardingStatus?.hasApplication) {
    return (
      <OnboardingStartView
        userName={user?.name ?? "파트너"}
        userEmail={user?.email ?? ""}
      />
    );
  }

  // 온보딩 신청 중 (pending/reviewing/rejected)
  const activeStatus = onboardingStatus.status;
  if (activeStatus === "pending" || activeStatus === "reviewing" || activeStatus === "rejected") {
    return (
      <OnboardingPendingView
        status={activeStatus}
        companyName={onboardingStatus.data?.companyName ?? ""}
        adminNote={onboardingStatus.data?.adminNote}
      />
    );
  }

  // 승인 완료 → 채팅 UI
  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    try {
      const history = messages
        .filter((m) => m.id !== "welcome")
        .slice(-8)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      const result = await chatMutation.mutateAsync({
        sessionId,
        message: text.trim(),
        history,
      });
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errMsg: Message = {
        id: `e-${Date.now()}`,
        role: "assistant",
        content: "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.\n\n📞 파트너 지원: 1668-1739 (평일 09:00~17:30)",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/partner">
            <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Bot size={18} className="text-indigo-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm font-body">두골프 매니저</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <p className="text-xs text-gray-500 font-body">AI 파트너 지원</p>
              </div>
            </div>
          </div>
          <div className="ml-auto">
            <span className="text-xs text-gray-400 font-body">{user?.name ?? "파트너"} 님</span>
          </div>
        </div>
      </header>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {/* 빠른 질문 (처음에만) */}
          {messages.length === 1 && (
            <div className="bg-indigo-50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-indigo-700 font-body mb-2">💡 자주 묻는 질문</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-xs bg-white border border-indigo-200 text-indigo-700 rounded-full px-3 py-1.5 hover:bg-indigo-50 transition-colors font-body"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                  <Bot size={16} className="text-indigo-600" />
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
                }`}
              >
                {msg.content}
                <p className={`text-xs mt-1.5 ${msg.role === "user" ? "text-indigo-200" : "text-gray-400"}`}>
                  {msg.timestamp.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          {/* 타이핑 인디케이터 */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                <Bot size={16} className="text-indigo-600" />
              </div>
              <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 입력창 */}
      <div className="bg-white border-t border-gray-200 sticky bottom-0">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="파트너 운영 관련 질문을 입력하세요..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm font-body focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent max-h-32 overflow-y-auto"
              style={{ lineHeight: "1.4" }}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isTyping}
              className="w-11 h-11 bg-indigo-600 hover:bg-indigo-700 rounded-xl p-0 flex-shrink-0"
            >
              {isTyping ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </Button>
          </div>
          <p className="text-xs text-gray-400 font-body text-center mt-1.5">
            Enter 전송 · Shift+Enter 줄바꿈
          </p>
        </div>
      </div>
    </div>
  );
}
