// ============================================================
// DOGOLF GolfTalk Widget v3.0 — 골프톡 AI 채팅 플로팅 위젯
// 모바일: 전체화면 채팅 모드 (키보드 위 입력창 고정)
// PC: 대형 패널 (화면 우측 고정, travelersmap.co.kr 수준)
// ============================================================
import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, MessageCircle, Phone, ChevronDown } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  quickReplies?: string[];
  isFollowUp?: boolean;
}

const QUICK_QUESTIONS = [
  "추천 골프 패키지 알려줘",
  "태국 골프 여행 일정은?",
  "예약 방법이 궁금해요",
  "가성비 패키지 추천",
];

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "안녕하세요! ⛳ 골프톡입니다.\n두골프의 AI 골프 여행 전문 상담사예요. 패키지 추천, 예약 안내, 골프 정보 무엇이든 물어보세요!",
  timestamp: new Date(),
  quickReplies: QUICK_QUESTIONS,
};

function generateSessionId() {
  return `gt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// AI 응답에서 [빠른답변: ...] 또는 [후속질문: ...] 패턴을 파싱하는 함수
function parseQuickReplies(content: string): { cleanContent: string; quickReplies: string[]; isFollowUp: boolean } {
  const quickMatch = content.match(/\[빠른답변:\s*([^\]]+)\]/);
  const followMatch = content.match(/\[후속질문:\s*([^\]]+)\]/);
  const match = quickMatch || followMatch;
  const isFollowUp = Boolean(!quickMatch && followMatch);
  if (!match) return { cleanContent: content, quickReplies: [], isFollowUp: false };
  const quickReplies = match[1].split("|").map((s) => s.trim()).filter(Boolean);
  const cleanContent = content.replace(/\[(빠른답변|후속질문):\s*[^\]]+\]/, "").trim();
  return { cleanContent, quickReplies, isFollowUp };
}

export default function GolfTalkWidget({ packageId }: { packageId?: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatMutation = trpc.aiAssistant.golfTalkChat.useMutation();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // 약간의 딜레이 후 포커스 (애니메이션 완료 후)
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 헤더 등 외부에서 골프톡 위젯을 열 수 있도록 커스텀 이벤트 리스너 등록
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('openGolfTalk', handler);
    return () => window.removeEventListener('openGolfTalk', handler);
  }, []);

  // 모바일: 채팅 열릴 때 body 스크롤 잠금
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const sendMessage = useCallback(
    async (text: string) => {
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
          packageId,
        });
        const { cleanContent, quickReplies, isFollowUp } = parseQuickReplies(result.response);
        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: cleanContent,
          timestamp: new Date(),
          quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
          isFollowUp: isFollowUp,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errMsg: Message = {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. 📞 전화 상담: 1668-1739",
          timestamp: new Date(),
          quickReplies: ["카카오톡 연결", "전화 상담 연결"],
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsTyping(false);
      }
    },
    [chatMutation, isTyping, messages, packageId, sessionId]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // 빠른 답변 버튼 클릭 핸들러 (카카오톡/전화 특수 처리)
  const handleQuickReply = (reply: string) => {
    if (reply === "카카오톡 연결") {
      window.open("https://pf.kakao.com/_xnGxlxj", "_blank");
      return;
    }
    if (reply === "전화 상담 연결") {
      window.location.href = "tel:1668-1739";
      return;
    }
    sendMessage(reply);
  };

  // 마지막 assistant 메시지의 quickReplies 가져오기
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const currentQuickReplies = lastAssistantMsg?.quickReplies;
  const isCurrentFollowUp = lastAssistantMsg?.isFollowUp ?? false;

  return (
    <>
      {/* =============================================
          채팅창 오버레이 (모바일: 전체화면, PC: 대형 패널)
          ============================================= */}
      {isOpen && (
        <>
          {/* 모바일 전체화면 오버레이 배경 */}
          <div className="fixed inset-0 z-[9998] bg-black/40 md:hidden" onClick={() => setIsOpen(false)} />

          {/* 채팅창 본체 */}
          <div
            className={[
              // 공통
              "fixed z-[9999] bg-white flex flex-col overflow-hidden",
              // 모바일: 전체화면 (상단 safe area 포함)
              "inset-0 md:inset-auto",
              // PC: 우측 하단 고정 대형 패널
              "md:bottom-6 md:right-6",
              "md:w-[480px] md:h-[680px]",
              "md:rounded-2xl md:shadow-2xl md:border md:border-gray-100",
              // 애니메이션
              "animate-in slide-in-from-bottom-4 duration-300",
            ].join(" ")}
          >
            {/* ===== 헤더 ===== */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 py-3.5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">
                  ⛳
                </div>
                <div>
                  <p className="text-white font-bold text-base font-body">골프톡</p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                    <p className="text-green-100 text-xs font-body">AI 골프 여행 전문 상담사 · 24시간 운영</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* 카카오톡 연결 버튼 */}
                <a
                  href="https://pf.kakao.com/_xnGxlxj"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-body px-3 py-1.5 rounded-full transition-colors"
                  title="카카오톡 상담"
                >
                  <Phone size={13} />
                  <span className="hidden sm:inline">카카오톡</span>
                </a>
                {/* 닫기 버튼 (채팅창 내부 상단) */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-colors"
                  aria-label="채팅창 닫기"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* ===== 빠른 안내 배너 (PC 전용) ===== */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-green-50 border-b border-green-100 flex-shrink-0">
              <span className="text-xs text-green-700 font-body">💡 패키지 추천, 예약 안내, 요금 문의 등 무엇이든 물어보세요!</span>
            </div>

            {/* ===== 메시지 목록 ===== */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50"
              style={{
                // 모바일: 키보드 올라와도 스크롤 영역 유지 (dvh 단위 활용)
                overscrollBehavior: 'contain',
              }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-base mr-2.5 mt-0.5 flex-shrink-0 shadow-sm">
                      ⛳
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                      msg.role === "user"
                        ? "bg-green-600 text-white rounded-br-sm"
                        : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {/* 타이핑 인디케이터 */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-base mr-2.5 mt-0.5 flex-shrink-0 shadow-sm">
                    ⛳
                  </div>
                  <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
                    <div className="flex gap-1.5 items-center">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ===== 동적 빠른 답변 / 후속 질문 버튼 ===== */}
            {currentQuickReplies && !isTyping && (
              <div className="px-3 py-2.5 bg-white border-t border-gray-100 flex-shrink-0">
                {isCurrentFollowUp && (
                  <p className="text-[10px] text-gray-400 font-body mb-2 px-0.5">💡 다음으로 궁금하신 게 있으신가요?</p>
                )}
                <div className="flex gap-1.5 flex-wrap">
                  {currentQuickReplies.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleQuickReply(q)}
                      className={`text-xs rounded-full px-3 py-1.5 transition-colors font-body ${
                        isCurrentFollowUp
                          ? "bg-green-50 border border-green-300 text-green-800 hover:bg-green-100"
                          : "bg-white border border-green-200 text-green-700 hover:bg-green-50"
                      }`}
                    >
                      {isCurrentFollowUp ? "🔍 " : ""}{q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ===== 입력창 (하단 고정) ===== */}
            <div className="px-3 py-3 bg-white border-t border-gray-100 flex-shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // 자동 높이 조절
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지를 입력하세요..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent overflow-y-auto"
                  style={{ lineHeight: "1.5", maxHeight: "96px" }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isTyping}
                  className="w-11 h-11 bg-green-600 text-white rounded-xl flex items-center justify-center hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-sm"
                  aria-label="전송"
                >
                  {isTyping ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 font-body text-center mt-1.5">
                Enter 전송 · Shift+Enter 줄바꿈
              </p>
            </div>
          </div>
        </>
      )}

      {/* =============================================
          플로팅 버튼 (채팅 닫힌 상태에서만 표시)
          ============================================= */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-4 sm:right-6 z-[9998] flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all duration-300 font-body font-semibold text-sm bg-green-600 text-white hover:bg-green-700 hover:shadow-xl hover:scale-105"
          aria-label="골프톡 AI 상담"
        >
          <MessageCircle size={18} />
          <span>골프톡</span>
        </button>
      )}

      {/* 모바일 전체화면 시 하단 안전 영역 확보용 스타일 */}
      <style>{`
        @media (max-width: 767px) {
          .golftalk-open-mobile {
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
        }
      `}</style>
    </>
  );
}
