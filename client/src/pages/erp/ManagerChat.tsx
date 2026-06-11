/**
 * AI파트너매니저 LLM 채팅 페이지
 * - trpc.ai.managerChat mutation 사용
 * - 입점사 파트너 전용 AI 어시스턴트 "AI파트너매니저"와 대화
 * - 대화 이력 유지, 세션 초기화, 빠른 질문 버튼 제공
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Send,
  Loader2,
  Bot,
  User,
  RefreshCw,
  Briefcase,
  ChevronRight,
  DollarSign,
  ClipboardList,
  HelpCircle,
  TrendingUp,
  Sparkles,
} from "lucide-react";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  costUsd?: number;
  durationMs?: number;
  isError?: boolean;
}

// ─── 빠른 질문 목록 ────────────────────────────────────────────────────────────
const QUICK_QUESTIONS = [
  { icon: <DollarSign size={14} />, label: "정산 내역 조회", text: "이번 달 정산 내역을 알려주세요." },
  { icon: <ClipboardList size={14} />, label: "예약 현황", text: "현재 예약 현황을 알려주세요." },
  { icon: <TrendingUp size={14} />, label: "수수료율 확인", text: "파트너 수수료율은 어떻게 되나요?" },
  { icon: <HelpCircle size={14} />, label: "상품 등록 방법", text: "상품을 등록하는 방법을 알려주세요." },
];

// ─── 메시지 버블 컴포넌트 ─────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} items-start`}>
      {/* 아바타 */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-blue-600" : "bg-emerald-600"
        }`}
      >
        {isUser ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot size={16} className="text-white" />
        )}
      </div>

      {/* 말풍선 */}
      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm"
              : msg.isError
              ? "bg-red-50 text-red-700 border border-red-200 rounded-tl-sm"
              : "bg-white text-gray-800 border border-gray-200 shadow-sm rounded-tl-sm"
          }`}
        >
          {msg.content}
        </div>

        {/* 메타 정보 (AI 응답에만 표시) */}
        {!isUser && msg.model && (
          <div className="flex items-center gap-2 px-1">
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-gray-400 border-gray-200">
              {msg.model}
            </Badge>
            {msg.costUsd !== undefined && msg.costUsd > 0 && (
              <span className="text-[10px] text-gray-400">
                ${msg.costUsd.toFixed(5)}
              </span>
            )}
            {msg.durationMs !== undefined && (
              <span className="text-[10px] text-gray-400">{(msg.durationMs / 1000).toFixed(1)}s</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function ManagerChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId] = useState(
    () => `manager-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── tRPC mutation ────────────────────────────────────────────────────────
  const chatMutation = trpc.aiAssistant.managerChat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.response,
          model: data.model,
          costUsd: data.costUsd,
          durationMs: data.durationMs,
        },
      ]);
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `❌ 오류가 발생했습니다: ${err.message}`,
          isError: true,
        },
      ]);
    },
  });

  // ─── 자동 스크롤 ─────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  // ─── 메시지 전송 ─────────────────────────────────────────────────────────
  const handleSend = useCallback(
    (text?: string) => {
      const messageText = (text ?? input).trim();
      if (!messageText || chatMutation.isPending) return;

      // 사용자 메시지 추가
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: messageText,
        },
      ]);
      setInput("");

      // 대화 이력 구성 (최근 10개)
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      chatMutation.mutate({
        message: messageText,
        sessionId,
        history,
      });
    },
    [input, messages, sessionId, chatMutation]
  );

  // ─── 키보드 단축키 ────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── 대화 초기화 ─────────────────────────────────────────────────────────
  const handleReset = () => {
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  };

  // ─── 렌더링 ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 헤더 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm">
              <Briefcase size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                AI파트너매니저
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] h-4">
                  AI
                </Badge>
              </h1>
              <p className="text-xs text-gray-500">입점사 파트너 전용 AI 어시스턴트 · 정산/예약/운영 안내</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1.5 text-gray-500 hover:text-gray-700"
          >
            <RefreshCw size={14} />
            대화 초기화
          </Button>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
        {/* 환영 메시지 */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <Sparkles size={28} className="text-emerald-600" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-2">AI파트너매니저에게 물어보세요</h2>
              <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
                정산 내역, 예약 현황, 수수료율, 상품 등록 방법 등<br />
                파트너 운영에 필요한 모든 것을 안내해 드립니다.
              </p>
            </div>

            {/* 빠른 질문 */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {QUICK_QUESTIONS.map((q) => (
                <Card
                  key={q.label}
                  className="cursor-pointer hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                  onClick={() => handleSend(q.text)}
                >
                  <CardContent className="p-3 flex items-center gap-2">
                    <span className="text-emerald-600">{q.icon}</span>
                    <span className="text-xs font-medium text-gray-700">{q.label}</span>
                    <ChevronRight size={12} className="ml-auto text-gray-400" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 대화 메시지 */}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {/* AI 응답 대기 중 */}
        {chatMutation.isPending && (
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 size={14} className="animate-spin text-emerald-600" />
                <span>AI파트너매니저가 답변을 준비 중입니다...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-4">
        {/* 빠른 질문 버튼 (대화 중에도 표시) */}
        {messages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q.label}
                onClick={() => handleSend(q.text)}
                disabled={chatMutation.isPending}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {q.icon}
                {q.label}
              </button>
            ))}
          </div>
        )}

        {/* 입력창 */}
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="AI파트너매니저에게 질문하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
            className="flex-1 min-h-[44px] max-h-[120px] resize-none text-sm border-gray-200 focus:border-emerald-400 focus:ring-emerald-400"
            disabled={chatMutation.isPending}
            rows={1}
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || chatMutation.isPending}
            className="h-[44px] w-[44px] p-0 bg-emerald-600 hover:bg-emerald-700 flex-shrink-0"
          >
            {chatMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          AI파트너매니저는 파트너 운영 지원 목적으로만 사용됩니다.
        </p>
      </div>
    </div>
  );
}
