/**
 * 두골프 마스터 AI 채팅 페이지
 * - 관리자 전용 AI 어시스턴트
 * - OpenRouter → Gemini 2.5 Pro (high) / Claude 3.5 Haiku (medium) / Gemini 2.0 Flash (low)
 * - 빠른 명령어 버튼, 마크다운 렌더링, 비용 표시
 */
import { useState, useRef, useEffect } from "react";
import ERPLayout from "@/components/ERPLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Streamdown } from "streamdown";
import {
  Bot, Send, Loader2, Zap, BarChart3, ClipboardList, RefreshCw,
  DollarSign, MessageSquare, Cpu, ChevronRight,
} from "lucide-react";
import { nanoid } from "nanoid";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  timestamp: Date;
}

const QUICK_COMMANDS = [
  { label: "오늘 예약 현황", icon: <ClipboardList size={13} />, message: "오늘 예약 현황을 알려주세요." },
  { label: "이번 달 정산", icon: <BarChart3 size={13} />, message: "이번 달 정산 현황을 요약해주세요." },
  { label: "미처리 개발 요청", icon: <Zap size={13} />, message: "현재 pending 상태인 개발 요청 목록을 알려주세요." },
  { label: "AI 비용 현황", icon: <DollarSign size={13} />, message: "이번 달 AI 사용 비용 현황을 알려주세요." },
];

function ModelBadge({ model }: { model?: string }) {
  if (!model) return null;
  const isGeminiPro = model.includes("gemini-2.5-pro");
  const isHaiku = model.includes("haiku");
  const isFlash = model.includes("flash");
  const color = isGeminiPro
    ? "bg-purple-100 text-purple-700"
    : isHaiku
    ? "bg-amber-100 text-amber-700"
    : "bg-blue-100 text-blue-700";
  const label = isGeminiPro ? "Gemini 2.5 Pro" : isHaiku ? "Claude Haiku" : isFlash ? "Gemini Flash" : model;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-mono ${color}`}>
      <Cpu size={10} />
      {label}
    </span>
  );
}

function CostDisplay({ costUsd, tokensIn, tokensOut }: { costUsd?: number; tokensIn?: number; tokensOut?: number }) {
  if (!costUsd && costUsd !== 0) return null;
  return (
    <span className="text-xs text-slate-400 font-mono">
      ${costUsd.toFixed(6)} · {tokensIn ?? 0}↑ {tokensOut ?? 0}↓
    </span>
  );
}

export default function MasterAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId] = useState(() => nanoid(20));
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = trpc.aiAssistant.masterChat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(),
          role: "assistant",
          content: data.response,
          model: data.model,
          tokensIn: data.tokensIn,
          tokensOut: data.tokensOut,
          costUsd: data.costUsd,
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
    },
    onError: (err) => {
      toast.error(`AI 응답 실패: ${err.message}`);
      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(),
          role: "assistant",
          content: "⚠️ 응답 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: nanoid(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // 히스토리 구성 (최근 10턴)
    const history = messages.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    chatMutation.mutate({
      message: text.trim(),
      sessionId,
      history,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <ERPLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">두골프 마스터 🤖</h1>
              <p className="text-xs text-slate-500">ERP 전용 AI 어시스턴트 · OpenRouter 멀티모델</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block mr-1" />
              온라인
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMessages([])}
              className="text-xs"
            >
              <RefreshCw size={12} className="mr-1" />
              대화 초기화
            </Button>
          </div>
        </div>

        {/* Quick Commands */}
        <div className="flex flex-wrap gap-2">
          {QUICK_COMMANDS.map((cmd) => (
            <button
              key={cmd.label}
              onClick={() => sendMessage(cmd.message)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors disabled:opacity-50"
            >
              {cmd.icon}
              {cmd.label}
            </button>
          ))}
        </div>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mb-4">
                  <Bot size={28} className="text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">두골프 마스터입니다</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  ERP 데이터 조회, 정산 분석, 개발 요청 등 무엇이든 물어보세요.
                  위의 빠른 명령어를 클릭하거나 직접 입력하세요.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-2 w-full max-w-sm">
                  {QUICK_COMMANDS.map((cmd) => (
                    <button
                      key={cmd.label}
                      onClick={() => sendMessage(cmd.message)}
                      className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
                    >
                      {cmd.icon}
                      <span>{cmd.label}</span>
                      <ChevronRight size={12} className="ml-auto" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === "user"
                          ? "bg-indigo-600"
                          : "bg-gradient-to-br from-purple-500 to-indigo-600"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <span className="text-white text-xs font-bold">나</span>
                      ) : (
                        <Bot size={14} className="text-white" />
                      )}
                    </div>

                    {/* Bubble */}
                    <div className={`max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white rounded-tr-sm"
                            : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <Streamdown>{msg.content}</Streamdown>
                        ) : (
                          <span className="whitespace-pre-wrap">{msg.content}</span>
                        )}
                      </div>
                      {/* Meta */}
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-2 px-1">
                          <ModelBadge model={msg.model} />
                          <CostDisplay costUsd={msg.costUsd} tokensIn={msg.tokensIn} tokensOut={msg.tokensOut} />
                        </div>
                      )}
                      <span className="text-xs text-slate-400 px-1">
                        {msg.timestamp.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                      <Bot size={14} className="text-white" />
                    </div>
                    <div className="px-4 py-3 bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-slate-200 p-4">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
                className="flex-1 min-h-[44px] max-h-32 resize-none text-sm"
                rows={1}
                disabled={isLoading}
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-[44px] px-4"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <MessageSquare size={10} />
              세션 ID: {sessionId.slice(0, 8)}... · 최근 10턴 컨텍스트 유지
            </p>
          </div>
        </Card>
      </div>
    </ERPLayout>
  );
}
