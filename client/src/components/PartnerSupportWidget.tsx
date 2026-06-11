// ============================================================
// PartnerSupportWidget — partner.dayoutgolf.com 우측 하단 고객센터 위젯
// 클릭 시 미니 채팅 팝업 또는 /partner/support 페이지로 이동
// ============================================================
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { partnerTrpc } from "@/lib/partnerTrpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  ExternalLink,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function PartnerSupportWidget() {
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "안녕하세요! 고객센터AI입니다. 😊\n무엇이든 질문해 주세요. 자세한 상담은 고객센터 페이지를 이용해 주세요.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `widget-${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);

  const managerChatMut = partnerTrpc.aiAssistant.managerChat.useMutation();

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const history = messages.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      const result = await managerChatMut.mutateAsync({ message: text, sessionId, history });
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: result.response ?? "응답을 받지 못했습니다.",
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      toast.error("AI 응답 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* 팝업 채팅 */}
      {isOpen && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
          style={{ height: "420px" }}>
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} />
              <span className="font-semibold text-sm">고객센터AI</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate("/partner/support")}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title="전체 화면으로 보기"
              >
                <ExternalLink size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs mr-1.5 mt-0.5 shrink-0">
                    AI
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs mr-1.5 mt-0.5 shrink-0">
                  AI
                </div>
                <div className="bg-white border border-gray-200 rounded-xl rounded-bl-sm px-3 py-2 shadow-sm">
                  <Loader2 size={12} className="animate-spin text-indigo-500" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 빠른 링크 */}
          <div className="px-3 py-2 border-t border-gray-100 bg-white">
            <button
              onClick={() => navigate("/partner/support")}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 py-1 transition-colors"
            >
              <HelpCircle size={12} />
              FAQ · 개발요청 전체 보기
              <ExternalLink size={10} />
            </button>
          </div>

          {/* 입력 영역 */}
          <div className="p-2.5 border-t border-gray-200 bg-white">
            <div className="flex gap-1.5">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="질문을 입력하세요..."
                className="flex-1 text-xs h-8"
                disabled={loading}
              />
              <Button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-2.5"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 위젯 버튼 */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? "bg-gray-700 hover:bg-gray-800 rotate-0"
            : "bg-gradient-to-br from-indigo-600 to-purple-600 hover:scale-110"
        }`}
        aria-label="고객센터 열기"
      >
        {isOpen ? (
          <X size={22} className="text-white" />
        ) : (
          <MessageCircle size={22} className="text-white" />
        )}
      </button>

      {/* 미개봉 알림 뱃지 */}
      {!isOpen && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">?</span>
        </div>
      )}
    </div>
  );
}
