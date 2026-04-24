// ============================================================
// DOGOLF GolfTalk Widget v2.0 — 골프톡 AI 채팅 플로팅 위젯
// 업데이트: 동적 빠른 답변 버튼, 카카오톡 연결, 개선된 UX
// ============================================================
import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, ChevronDown, Loader2, MessageCircle, Phone } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  quickReplies?: string[];
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

// AI 응답에서 [빠른답변: ...] 패턴을 파싱하는 함수
function parseQuickReplies(content: string): { cleanContent: string; quickReplies: string[] } {
  const match = content.match(/\[빠른답변:\s*([^\]]+)\]/);
  if (!match) return { cleanContent: content, quickReplies: [] };
  const quickReplies = match[1].split("|").map((s) => s.trim()).filter(Boolean);
  const cleanContent = content.replace(/\[빠른답변:\s*[^\]]+\]/, "").trim();
  return { cleanContent, quickReplies };
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
      inputRef.current.focus();
    }
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

        const { cleanContent, quickReplies } = parseQuickReplies(result.response);
        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: cleanContent,
          timestamp: new Date(),
          quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
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

  return (
    <>
      {/* 채팅창 */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-4 sm:right-6 z-[9999] w-[calc(100vw-2rem)] sm:w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
          style={{ maxHeight: "calc(100vh - 120px)" }}
        >
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-lg">
                ⛳
              </div>
              <div>
                <p className="text-white font-bold text-sm font-body">골프톡</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                  <p className="text-green-100 text-xs font-body">AI 골프 여행 전문 상담사</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* 카카오톡 연결 버튼 */}
              <a
                href="https://pf.kakao.com/_xnGxlxj"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-white transition-colors p-1"
                aria-label="카카오톡 상담"
                title="카카오톡 상담"
              >
                <Phone size={16} />
              </a>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/70 hover:text-white transition-colors p-1"
                aria-label="채팅창 닫기"
              >
                <ChevronDown size={20} />
              </button>
            </div>
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center text-sm mr-2 mt-0.5 flex-shrink-0">
                    ⛳
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-green-600 text-white rounded-br-sm"
                      : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* 타이핑 인디케이터 */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center text-sm mr-2 mt-0.5 flex-shrink-0">
                  ⛳
                </div>
                <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 동적 빠른 답변 버튼 */}
          {currentQuickReplies && !isTyping && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex gap-1.5 flex-wrap flex-shrink-0">
              {currentQuickReplies.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuickReply(q)}
                  className="text-xs bg-white border border-green-200 text-green-700 rounded-full px-2.5 py-1 hover:bg-green-50 transition-colors font-body"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* 입력창 */}
          <div className="px-3 py-3 bg-white border-t border-gray-100 flex-shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent max-h-24 overflow-y-auto"
                style={{ lineHeight: "1.4" }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
                className="w-10 h-10 bg-green-600 text-white rounded-xl flex items-center justify-center hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                aria-label="전송"
              >
                {isTyping ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 font-body text-center mt-1.5">
              Enter 전송 · Shift+Enter 줄바꿈
            </p>
          </div>
        </div>
      )}

      {/* 플로팅 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-4 sm:right-6 z-[9998] flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all duration-300 font-body font-semibold text-sm ${
          isOpen
            ? "bg-gray-700 text-white"
            : "bg-green-600 text-white hover:bg-green-700 hover:shadow-xl hover:scale-105"
        }`}
        aria-label="골프톡 AI 상담"
      >
        {isOpen ? (
          <>
            <X size={18} />
            <span>닫기</span>
          </>
        ) : (
          <>
            <MessageCircle size={18} />
            <span>골프톡</span>
          </>
        )}
      </button>
    </>
  );
}
