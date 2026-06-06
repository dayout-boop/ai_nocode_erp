/**
 * 마누스채봇 페이지 [ID: 700001]
 *
 * Manus 에이전트가 웹훅으로 보내는 메시지를 실시간 채팅창 형태로 표시합니다.
 * - SSE(Server-Sent Events)로 실시간 수신
 * - 과거 수신 로그 DB에서 로드
 * - 관리자가 테스트 메시지 발송 가능
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bot, RefreshCw, Wifi, WifiOff, Send, Info,
  CheckCircle2, Clock, AlertCircle, Zap,
} from "lucide-react";
import { toast } from "sonner";

// ─── 타입 ──────────────────────────────────────────────────────────────────────

interface WebhookMessage {
  id: number;
  taskId: string | null;
  eventType: string;
  content: string | null;
  role: string | null;
  devRequestId: number | null;
  receivedAt: Date;
}

interface SSEWebhookEvent {
  taskId: string | null;
  eventType: string;
  content: string | null;
  role: string | null;
  devRequestId: number | null;
  receivedAt: string;
}

// ─── 메시지 버블 컴포넌트 ─────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: WebhookMessage }) {
  const isAssistant = msg.role === "assistant";
  const isSystem = msg.role === "system";
  const time = new Date(msg.receivedAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const eventBadgeColor =
    msg.eventType === "task_stopped"
      ? "bg-green-500/20 text-green-400 border-green-500/30"
      : msg.eventType === "message_added"
      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
      : msg.eventType === "task_created"
      ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
      : "bg-slate-500/20 text-slate-400 border-slate-500/30";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="flex items-center gap-2 bg-slate-700/50 rounded-full px-3 py-1 text-xs text-slate-400">
          <Info size={12} />
          <span>{msg.content || msg.eventType}</span>
          <span className="text-slate-500">{time}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}>
      {isAssistant && (
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-1">
          <Bot size={16} className="text-white" />
        </div>
      )}
      <div className={`max-w-[75%] ${isAssistant ? "" : "order-first"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isAssistant
              ? "bg-slate-700 text-slate-100 rounded-tl-sm"
              : "bg-indigo-600 text-white rounded-tr-sm"
          }`}
        >
          {msg.content ? (
            <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
          ) : (
            <span className="text-slate-400 italic">내용 없음</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 px-1">
          <span className="text-xs text-slate-500">{time}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${eventBadgeColor}`}>
            {msg.eventType}
          </span>
          {msg.taskId && (
            <span className="text-xs text-slate-600 font-mono truncate max-w-[120px]">
              {msg.taskId.slice(0, 12)}...
            </span>
          )}
          {msg.devRequestId && (
            <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded">
              DEV #{msg.devRequestId}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function ManusChat() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<WebhookMessage[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const nextIdRef = useRef(-1); // 임시 ID (SSE로 받은 메시지용)

  // ─── 과거 로그 로드 ───────────────────────────────────────────────────────
  const logsQuery = trpc.manusWebhook.getLogs.useQuery(
    { limit: 100 },
    { refetchOnWindowFocus: false }
  );

  const statsQuery = trpc.manusWebhook.getStats.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  // 로그 로드 완료 시 메시지 초기화
  useEffect(() => {
    if (logsQuery.data?.logs) {
      // 최신 → 오래된 순으로 정렬 후 역순(오래된 → 최신)으로 표시
      const sorted = [...logsQuery.data.logs].reverse();
      setMessages(sorted as WebhookMessage[]);
    }
  }, [logsQuery.data]);

  // ─── SSE 실시간 연결 ──────────────────────────────────────────────────────
  const connectSSE = useCallback(() => {
    const es = new EventSource("/api/realtime/events", { withCredentials: true });

    es.onopen = () => {
      setSseConnected(true);
      console.log("[ManusChat] SSE 연결됨");
    };

    es.addEventListener("manus_webhook_received", (e) => {
      try {
        const outer = JSON.parse(e.data) as { data: SSEWebhookEvent };
        const payload = outer.data;
        const newMsg: WebhookMessage = {
          id: nextIdRef.current--,
          taskId: payload.taskId,
          eventType: payload.eventType,
          content: payload.content,
          role: payload.role,
          devRequestId: payload.devRequestId,
          receivedAt: new Date(payload.receivedAt),
        };
        setMessages((prev) => [...prev, newMsg]);
      } catch (err) {
        console.error("[ManusChat] SSE 파싱 오류:", err);
      }
    });

    es.onerror = () => {
      setSseConnected(false);
      es.close();
      // 5초 후 재연결
      setTimeout(connectSSE, 5000);
    };

    return es;
  }, []);

  useEffect(() => {
    const es = connectSSE();
    return () => {
      es.close();
      setSseConnected(false);
    };
  }, [connectSSE]);

  // ─── 스크롤 자동 이동 ─────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── 테스트 메시지 발송 ───────────────────────────────────────────────────
  const sendTestMutation = trpc.manusWebhook.sendTest.useMutation({
    onSuccess: () => {
      setTestMessage("");
      toast.success("테스트 메시지 발송됨 - 잠시 후 채팅창에 표시됩니다.");
    },
    onError: (err) => {
      toast.error(`발송 실패: ${err.message}`);
    },
  });

  const handleSendTest = () => {
    if (!testMessage.trim()) return;
    sendTestMutation.mutate({ message: testMessage.trim() });
  };

  // ─── 웹훅 URL ─────────────────────────────────────────────────────────────
  const webhookUrl = `${window.location.origin}/api/manus/webhook`;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      {/* ─── 헤더 ─── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">마누스채봇</h1>
            <p className="text-xs text-slate-400">Manus 에이전트 실시간 메시지 수신</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* SSE 연결 상태 */}
          <div className="flex items-center gap-1.5">
            {sseConnected ? (
              <>
                <Wifi size={14} className="text-green-400" />
                <span className="text-xs text-green-400">실시간 연결됨</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-red-400" />
                <span className="text-xs text-red-400">연결 중...</span>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logsQuery.refetch()}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw size={14} className="mr-1" />
            새로고침
          </Button>
        </div>
      </div>

      {/* ─── 통계 카드 ─── */}
      <div className="grid grid-cols-3 gap-3 px-6 py-3 border-b border-slate-700/40">
        <div className="bg-slate-800 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-400" />
          <div>
            <div className="text-xs text-slate-400">총 수신</div>
            <div className="text-sm font-bold text-white">{statsQuery.data?.total ?? 0}</div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg px-3 py-2 flex items-center gap-2">
          <Clock size={16} className="text-blue-400" />
          <div>
            <div className="text-xs text-slate-400">24시간</div>
            <div className="text-sm font-bold text-white">{statsQuery.data?.last24h ?? 0}</div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg px-3 py-2 flex items-center gap-2">
          <Zap size={16} className="text-yellow-400" />
          <div>
            <div className="text-xs text-slate-400">이벤트 종류</div>
            <div className="text-sm font-bold text-white">
              {Object.keys(statsQuery.data?.byEventType ?? {}).length}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 웹훅 URL 안내 ─── */}
      <div className="px-6 py-2 bg-slate-800/30 border-b border-slate-700/30">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <AlertCircle size={12} className="text-yellow-400 shrink-0" />
          <span>웹훅 URL:</span>
          <code className="bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-mono text-xs">
            {webhookUrl}
          </code>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-2 text-xs text-slate-400 hover:text-white"
            onClick={() => {
              navigator.clipboard.writeText(webhookUrl);
              toast.success("웹훅 URL이 클립보드에 복사되었습니다.");
            }}
          >
            복사
          </Button>
        </div>
      </div>

      {/* ─── 채팅 메시지 영역 ─── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {logsQuery.isLoading ? (
          <div className="flex items-center justify-center h-32 text-slate-400">
            <RefreshCw size={20} className="animate-spin mr-2" />
            <span>메시지 로드 중...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <Bot size={48} className="mb-3 opacity-30" />
            <p className="text-sm">아직 수신된 메시지가 없습니다.</p>
            <p className="text-xs mt-1">
              Manus API에서 위 웹훅 URL로 이벤트를 전송하면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={`${msg.id}-${msg.receivedAt}`} msg={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── 테스트 입력창 ─── */}
      <div className="px-6 py-4 border-t border-slate-700/60 bg-slate-800/30">
        <div className="flex gap-2">
          <Input
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendTest()}
            placeholder="테스트 메시지 입력 (Manus 에이전트 응답 시뮬레이션)"
            className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-indigo-500"
          />
          <Button
            onClick={handleSendTest}
            disabled={!testMessage.trim() || sendTestMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
          >
            {sendTestMutation.isPending ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-1.5">
          테스트 메시지는 실제 Manus 에이전트 응답이 아닌 수동 입력입니다.
        </p>
      </div>
    </div>
  );
}
