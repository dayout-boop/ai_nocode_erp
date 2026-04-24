/**
 * 두골프 마스터 AI 채팅 페이지
 * - SSE 스트리밍으로 실시간 응답 표시 (응답 멈춤 문제 해결)
 * - 네이티브 div 스크롤 (ScrollArea ref 버그 우회)
 * - 개발 요청 자동 감지 → Manus 전송 UI
 * - 추론 → 분석 → 결과도출 → Manus 전송 파이프라인
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Loader2, Bot, User, Zap, AlertCircle, CheckCircle2,
  ExternalLink, ChevronDown, RefreshCw, BarChart3, ClipboardList,
  DollarSign, Cpu, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────
interface DevRequestSuggestion {
  type: "dev_request";
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  module: string;
  estimatedHours: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  durationMs?: number;
  devRequestSuggestion?: DevRequestSuggestion | null;
  error?: string;
  timestamp: Date;
}

// ─── 빠른 명령 버튼 ────────────────────────────────────────────────────────────
const QUICK_COMMANDS = [
  { label: "오늘 예약 현황", icon: <ClipboardList size={13} />, message: "오늘 날짜 기준 신규 예약 현황을 알려주세요." },
  { label: "이번 달 정산", icon: <BarChart3 size={13} />, message: "이번 달 정산 현황과 미정산 건수를 요약해주세요." },
  { label: "미처리 개발 요청", icon: <Zap size={13} />, message: "현재 pending 상태인 개발 요청 목록을 알려주세요." },
  { label: "AI 비용 현황", icon: <DollarSign size={13} />, message: "오늘과 이번 달 AI 사용 비용 현황을 알려주세요." },
  { label: "시스템 상태", icon: <Cpu size={13} />, message: "현재 ERP 시스템 상태와 오류 로그를 확인해주세요." },
  { label: "상품 현황", icon: <MessageSquare size={13} />, message: "현재 등록된 골프 패키지 상품 현황을 요약해주세요." },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

// ─── 개발 요청 카드 컴포넌트 ─────────────────────────────────────────────────
function DevRequestCard({
  suggestion,
  onSend,
  isSending,
  sent,
}: {
  suggestion: DevRequestSuggestion;
  onSend: () => void;
  isSending: boolean;
  sent: boolean;
}) {
  return (
    <Card className="mt-3 border-indigo-200 bg-indigo-50 w-full max-w-md">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-indigo-800 flex items-center gap-2">
            <Zap size={14} className="text-indigo-600" />
            개발 요청 감지됨
          </CardTitle>
          <Badge className={`text-xs border ${PRIORITY_COLORS[suggestion.priority] ?? "bg-gray-100 text-gray-600"}`}>
            {suggestion.priority.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        <div>
          <p className="text-xs text-indigo-600 font-medium">제목</p>
          <p className="text-sm text-gray-800">{suggestion.title}</p>
        </div>
        <div>
          <p className="text-xs text-indigo-600 font-medium">모듈 · 예상 시간</p>
          <p className="text-sm text-gray-700">{suggestion.module} · {suggestion.estimatedHours}시간</p>
        </div>
        <div>
          <p className="text-xs text-indigo-600 font-medium">상세 설명</p>
          <p className="text-sm text-gray-700 line-clamp-3">{suggestion.description}</p>
        </div>
        {sent ? (
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium pt-1">
            <CheckCircle2 size={14} />
            Manus에 전송 완료
          </div>
        ) : (
          <Button
            size="sm"
            onClick={onSend}
            disabled={isSending}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-1"
          >
            {isSending ? (
              <><Loader2 size={13} className="animate-spin mr-1" /> 전송 중...</>
            ) : (
              <><ExternalLink size={13} className="mr-1" /> Manus에 개발 요청 전송</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function MasterAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId] = useState(() => `master-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendDevRequestMutation = trpc.devRequest.create.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ 개발 요청 전송 완료 (ID: ${data.id})`);
    },
    onError: (err) => {
      toast.error(`❌ 전송 실패: ${err.message}`);
    },
  });

  // 스크롤 하단 이동
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // 스크롤 위치 감지
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 120);
  }, []);

  // 새 메시지 추가 시 자동 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // 스트리밍 중 자동 스크롤
  const streamingAutoScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 200) scrollToBottom(false);
  }, [scrollToBottom]);

  // 메시지 전송 (SSE 스트리밍)
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsStreaming(true);

    // 히스토리 구성 (최근 20턴)
    const history = messages.slice(-20).map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/master-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text.trim(), sessionId, history }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false, error: err.error ?? "응답 실패", content: `❌ ${err.error ?? "서버 오류"}` }
              : m
          )
        );
        setIsStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === "chunk" && data.text !== undefined) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + data.text } : m
                  )
                );
                streamingAutoScroll();
              } else if (eventType === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          streaming: false,
                          model: data.model,
                          tokensIn: data.tokensIn,
                          tokensOut: data.tokensOut,
                          costUsd: data.costUsd,
                          durationMs: data.durationMs,
                          devRequestSuggestion: data.devRequestSuggestion ?? null,
                        }
                      : m
                  )
                );
              } else if (eventType === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, streaming: false, error: data.message, content: m.content || `❌ ${data.message}` }
                      : m
                  )
                );
              }
            } catch { /* JSON 파싱 실패 무시 */ }
            eventType = "";
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false, error: "연결 오류", content: m.content || "❌ 연결이 끊어졌습니다. 다시 시도해주세요." }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming, messages, sessionId, streamingAutoScroll]);

  // 개발 요청 Manus 전송
  const handleSendDevRequest = useCallback(
    async (msgId: string, suggestion: DevRequestSuggestion) => {
      setSendingRequests((prev) => new Set(prev).add(msgId));
      try {
        await sendDevRequestMutation.mutateAsync({
          title: suggestion.title,
          description: suggestion.description,
          priority: suggestion.priority,
          module: suggestion.module,
          estimatedHours: suggestion.estimatedHours,
          source: "master_ai",
        });
        setSentRequests((prev) => new Set(prev).add(msgId));
      } finally {
        setSendingRequests((prev) => {
          const next = new Set(prev);
          next.delete(msgId);
          return next;
        });
      }
    },
    [sendDevRequestMutation]
  );

  // 키보드 단축키 (Enter 전송, Shift+Enter 줄바꿈)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto relative">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-tight">두골프 마스터 🤖</h1>
            <p className="text-xs text-gray-500">추론 · 분석 · 결과도출 · Manus 개발 요청</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs text-indigo-600 border-indigo-200 bg-indigo-50">
            Gemini 2.5 Pro
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMessages([])}
            className="text-xs h-7 px-2"
            disabled={isStreaming}
          >
            <RefreshCw size={11} className="mr-1" />
            초기화
          </Button>
          {isStreaming && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => abortRef.current?.abort()}
              className="text-xs h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              중단
            </Button>
          )}
        </div>
      </div>

      {/* 빠른 명령 버튼 (메시지 없을 때만) */}
      {messages.length === 0 && (
        <div className="px-4 py-4 border-b bg-gray-50 shrink-0">
          <p className="text-xs text-gray-500 mb-2 font-medium">빠른 명령</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd.label}
                onClick={() => sendMessage(cmd.message)}
                disabled={isStreaming}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-50"
              >
                {cmd.icon}
                {cmd.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 메시지 영역 — 네이티브 div 스크롤 (ScrollArea 버그 우회) */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#d1d5db transparent" }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-16">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
              <Bot size={28} className="text-indigo-500" />
            </div>
            <p className="text-lg font-semibold text-gray-600 mb-1">두골프 마스터에게 물어보세요</p>
            <p className="text-sm text-gray-400 max-w-sm">
              ERP 데이터 조회, 정산 분석, 개발 요청 자동화까지<br />
              추론 → 분석 → 결과도출 → Manus 전송 파이프라인
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {/* 아바타 */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                msg.role === "user"
                  ? "bg-indigo-600"
                  : "bg-gradient-to-br from-purple-500 to-indigo-600"
              }`}
            >
              {msg.role === "user" ? (
                <User size={14} className="text-white" />
              ) : (
                <Bot size={14} className="text-white" />
              )}
            </div>

            {/* 메시지 버블 */}
            <div className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} max-w-[80%]`}>
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-sm"
                    : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <>
                    {msg.content ? (
                      <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    ) : msg.streaming ? (
                      <span className="text-gray-400 italic text-xs">응답 생성 중...</span>
                    ) : (
                      <span className="text-gray-400 italic">응답 없음</span>
                    )}
                    {msg.streaming && (
                      <span className="inline-flex items-center gap-0.5 ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    )}
                    {msg.error && (
                      <div className="flex items-center gap-1.5 mt-2 text-red-500 text-xs">
                        <AlertCircle size={12} />
                        {msg.error}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>

              {/* 메타 정보 */}
              {msg.role === "assistant" && !msg.streaming && msg.model && (
                <div className="flex items-center gap-2 mt-1 px-1 flex-wrap">
                  <span className="text-[10px] text-gray-400 font-mono flex items-center gap-0.5">
                    <Cpu size={9} />
                    {msg.model.split("/").pop()}
                  </span>
                  {msg.tokensOut && (
                    <span className="text-[10px] text-gray-400 font-mono">
                      {msg.tokensIn?.toLocaleString()}↑ {msg.tokensOut?.toLocaleString()}↓
                    </span>
                  )}
                  {msg.costUsd !== undefined && (
                    <span className="text-[10px] text-gray-400 font-mono">${msg.costUsd.toFixed(4)}</span>
                  )}
                  {msg.durationMs && (
                    <span className="text-[10px] text-gray-400 font-mono">{(msg.durationMs / 1000).toFixed(1)}s</span>
                  )}
                  <span className="text-[10px] text-gray-400">
                    {msg.timestamp.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}

              {/* 개발 요청 카드 */}
              {msg.role === "assistant" && !msg.streaming && msg.devRequestSuggestion && (
                <DevRequestCard
                  suggestion={msg.devRequestSuggestion}
                  onSend={() => handleSendDevRequest(msg.id, msg.devRequestSuggestion!)}
                  isSending={sendingRequests.has(msg.id)}
                  sent={sentRequests.has(msg.id)}
                />
              )}
            </div>
          </div>
        ))}

        {/* 스크롤 앵커 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 하단 스크롤 버튼 */}
      {showScrollBtn && (
        <div className="absolute bottom-24 right-6 z-10">
          <Button
            size="sm"
            variant="outline"
            onClick={() => scrollToBottom()}
            className="rounded-full shadow-md h-8 w-8 p-0 bg-white"
          >
            <ChevronDown size={16} />
          </Button>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="px-4 py-3 border-t bg-white shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="두골프 마스터에게 질문하세요... (Enter 전송, Shift+Enter 줄바꿈)"
            className="flex-1 min-h-[44px] max-h-40 resize-none text-sm border-gray-200 focus:border-indigo-400 rounded-xl"
            disabled={isStreaming}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-[44px] px-4 rounded-xl shrink-0"
          >
            {isStreaming ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1 justify-center">
          <MessageSquare size={9} />
          세션: {sessionId.slice(0, 12)}... · 최근 20턴 컨텍스트 유지 · ERP DB 직접 접근
        </p>
      </div>
    </div>
  );
}
