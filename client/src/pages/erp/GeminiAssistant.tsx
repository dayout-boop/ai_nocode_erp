import { useState, useCallback, useRef } from "react";
import ERPLayout from "@/components/ERPLayout";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Info, Zap, Code2, Database, Globe, AlertTriangle, RefreshCw } from "lucide-react";

// Gemini 메시지 타입 (서버 API와 동일)
type GeminiRole = "user" | "model";
interface GeminiMessage {
  role: GeminiRole;
  content: string;
}

// 에러 상태를 대화 흐름에 포함시키기 위한 확장 메시지 타입
interface DisplayMessage extends Message {
  isError?: boolean;
}

const SUGGESTED_PROMPTS = [
  "현재 등록된 상품 목록과 각 상품의 이미지 현황을 알려줘",
  "신규 골프 패키지를 등록할 때 필요한 정보가 뭐야?",
  "예약 관리에서 상태를 변경하는 방법을 알려줘",
  "홈페이지와 ERP가 어떻게 연동되어 있는지 설명해줘",
  "Pixabay 이미지 검색 기능은 어떻게 사용해?",
  "AI 이미지 생성 기능의 현재 상태를 알려줘",
];

const CAPABILITY_CARDS = [
  {
    icon: <Database size={16} />,
    title: "시스템 이해",
    desc: "두골프 ERP의 DB 구조, API, 기능을 이미 파악하고 있습니다.",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    icon: <Code2 size={16} />,
    title: "개발 지원",
    desc: "새 기능 추가, 버그 수정, 코드 구조 개선을 제안합니다.",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    icon: <Globe size={16} />,
    title: "운영 도움",
    desc: "상품 등록, 예약 처리, 정산 등 운영 업무를 안내합니다.",
    color: "bg-green-50 text-green-700 border-green-200",
  },
  {
    icon: <Zap size={16} />,
    title: "자동화 제안",
    desc: "반복 작업을 자동화하는 방법을 제안하고 구현을 도웁니다.",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

// 에러 말풍선 컴포넌트 - 대화 흐름 하단에 자연스럽게 표시
function ErrorBubble({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
        <AlertTriangle size={14} className="text-red-500" />
      </div>
      <div className="flex-1">
        <div className="bg-red-50 border border-red-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-lg">
          <p className="text-sm text-red-700 leading-relaxed">{message}</p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-2 h-7 text-xs border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 gap-1.5"
            >
              <RefreshCw size={11} />
              다시 시도
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GeminiAssistant() {
  // geminiMessages: 서버로 보낼 실제 대화 기록 (에러 메시지 제외)
  const [geminiMessages, setGeminiMessages] = useState<GeminiMessage[]>([]);
  // displayMessages: 화면에 표시할 메시지 (에러 말풍선 포함)
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // 마지막 응답에서 실제 사용된 모델/리전 정보
  const [lastModelUsed, setLastModelUsed] = useState<string | null>(null);
  const [lastWasFallback, setLastWasFallback] = useState(false);
  const [lastRegionUsed, setLastRegionUsed] = useState<string | null>(null);
  // 에러 발생 시 재시도를 위한 마지막 사용자 메시지 보관 (ref로 최신값 보장)
  const lastUserContentRef = useRef<string | null>(null);
  // 에러 발생 직전의 geminiMessages 스냅샷 (재시도 시 사용)
  const preErrorGeminiMessagesRef = useRef<GeminiMessage[]>([]);

  const askMutation = trpc.gemini.ask.useMutation({
    onError: (err) => {
      // tRPC 레벨 에러 (네트워크 오류 등) - 에러 말풍선으로 표시
      const errorMsg = err.message || "AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
      // 에러 말풍선을 displayMessages에 추가 (geminiMessages는 에러 전 상태 유지)
      setDisplayMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorMsg, isError: true },
      ]);
      setGeminiMessages(preErrorGeminiMessagesRef.current);
      setIsLoading(false);
    },
  });

  const createLogMutation = trpc.aiLogs.create.useMutation();

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // 에러 전 상태 스냅샷 저장 (재시도용)
      preErrorGeminiMessagesRef.current = geminiMessages;
      lastUserContentRef.current = content;

      const userMessage: GeminiMessage = { role: "user", content };
      const updatedGeminiMessages = [...geminiMessages, userMessage];

      // 화면에 사용자 메시지 즉시 표시 (에러 말풍선 제거 후 새 메시지 추가)
      const cleanDisplayMessages = displayMessages.filter((m) => !m.isError);
      setGeminiMessages(updatedGeminiMessages);
      setDisplayMessages([
        ...cleanDisplayMessages,
        { role: "user", content },
      ]);
      setIsLoading(true);

      try {
        const result = await askMutation.mutateAsync({
          messages: updatedGeminiMessages,
        });

        // 실제 사용 모델/리전 정보 업데이트
        setLastModelUsed(result.modelUsed);
        setLastWasFallback(result.wasFallback);
        setLastRegionUsed(result.regionUsed ?? null);

        // 서버에서 errorMessage를 반환한 경우 → 에러 말풍선으로 표시
        if (result.errorMessage) {
          // geminiMessages에서 방금 추가한 사용자 메시지를 제거 (재시도 시 깨끗하게)
          setGeminiMessages(preErrorGeminiMessagesRef.current);
          setDisplayMessages([
            ...cleanDisplayMessages,
            { role: "user", content },
            { role: "assistant", content: result.errorMessage, isError: true },
          ]);
          return;
        }

        // 폴백 모델 사용 시 toast 알림
        if (result.wasFallback) {
          toast.warning(`서버 과부하로 ${result.modelUsed} 모델로 전환하여 응답했습니다.`);
        }

        // 정상 응답 - 폴백 사용 시 응답 앞에 안내 메시지 추가
        const responseContent = result.wasFallback
          ? `> ⚠️ *기본 모델(gemini-2.5-flash) 과부하로 대체 모델(${result.modelUsed})을 사용했습니다.*\n\n${result.response}`
          : result.response;

        const modelMessage: GeminiMessage = { role: "model", content: responseContent };
        const finalGeminiMessages = [...updatedGeminiMessages, modelMessage];
        setGeminiMessages(finalGeminiMessages);
        setDisplayMessages([
          ...cleanDisplayMessages,
          { role: "user", content },
          { role: "assistant", content: responseContent },
        ]);

        // 대화 내용을 DB에 자동 저장
        createLogMutation.mutate({
          query: content,
          response: result.response,
        });
      } catch {
        // onError에서 처리
      } finally {
        setIsLoading(false);
      }
    },
    [geminiMessages, displayMessages, isLoading, askMutation, createLogMutation]
  );

  // "다시 시도" 버튼 핸들러 - 에러 말풍선 제거 후 마지막 사용자 메시지 재전송
  const handleRetry = useCallback(() => {
    const content = lastUserContentRef.current;
    if (!content) return;
    // 에러 말풍선 제거 후 재전송
    setDisplayMessages((prev) => prev.filter((m) => !m.isError));
    setGeminiMessages(preErrorGeminiMessagesRef.current);
    // 약간의 딜레이 후 재전송 (상태 업데이트 완료 후)
    setTimeout(() => sendMessage(content), 50);
  }, [sendMessage]);

  const handleReset = useCallback(() => {
    setGeminiMessages([]);
    setDisplayMessages([]);
    setLastModelUsed(null);
    setLastWasFallback(false);
    setLastRegionUsed(null);
    lastUserContentRef.current = null;
    preErrorGeminiMessagesRef.current = [];
  }, []);

  // 현재 표시할 모델/리전 배지 정보
  const displayModel = lastModelUsed ?? "gemini-2.5-flash";
  const isFallback = lastWasFallback;
  // 리전 레이블 (global이면 표시 생략, 우회 리전이면 표시)
  const regionLabel = lastRegionUsed && lastRegionUsed !== "global" && lastRegionUsed !== "none"
    ? lastRegionUsed
    : null;

  // 에러 말풍선이 마지막에 있는지 확인
  const lastMsg = displayMessages[displayMessages.length - 1];
  const hasErrorAtEnd = lastMsg?.isError === true;
  // AIChatBox에 넘길 메시지 (에러 말풍선 제외)
  const chatMessages: Message[] = displayMessages
    .filter((m) => !m.isError)
    .map(({ role, content }) => ({ role, content }));

  return (
    <ERPLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
            <Sparkles size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">Gemini AI 어시스턴트</h1>
              {isFallback ? (
                <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs flex items-center gap-1">
                  <AlertTriangle size={10} />
                  {displayModel} (폴백)
                </Badge>
              ) : (
                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">
                  {displayModel}
                </Badge>
              )}
              {regionLabel && (
                <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-xs">
                  {regionLabel}
                </Badge>
              )}
              {isLoading && (
                <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-xs animate-pulse">
                  응답 중...
                </Badge>
              )}
            </div>
            <p className="text-slate-500 text-sm">
              두골프 ERP 시스템 전체를 이해하는 AI 어시스턴트입니다. 개발 요청, 운영 질문, 기능 제안 등 무엇이든 물어보세요.
            </p>
          </div>
        </div>

        {/* 기능 카드 */}
        {displayMessages.length === 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CAPABILITY_CARDS.map((card) => (
              <Card key={card.title} className={`border ${card.color}`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    {card.icon}
                    <span className="text-xs font-semibold">{card.title}</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-80">{card.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 채팅 영역 */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-500" />
                대화
                {displayMessages.length > 0 && (
                  <span className={`text-xs font-normal px-2 py-0.5 rounded-full border ${
                    isFallback
                      ? "bg-amber-50 text-amber-600 border-amber-200"
                      : "bg-indigo-50 text-indigo-500 border-indigo-100"
                  }`}>
                    {isFallback && <AlertTriangle size={9} className="inline mr-0.5" />}
                    {displayModel}
                  </span>
                )}
              </CardTitle>
              {displayMessages.length > 0 && (
                <button
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  대화 초기화
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <AIChatBox
              messages={chatMessages}
              onSendMessage={sendMessage}
              isLoading={isLoading}
              placeholder="두골프 ERP에 대해 무엇이든 물어보세요... (Shift+Enter로 줄바꿈)"
              height={hasErrorAtEnd ? 460 : 520}
              emptyStateMessage="아직 대화가 없습니다. 아래 제안된 질문을 클릭하거나 직접 입력해 보세요."
              suggestedPrompts={SUGGESTED_PROMPTS}
              className="border-0 rounded-none shadow-none"
            />
            {/* 에러 말풍선 - AIChatBox 바로 아래 대화 흐름에 이어서 표시 */}
            {hasErrorAtEnd && lastMsg && (
              <div className="border-t border-slate-100">
                <ErrorBubble
                  message={lastMsg.content}
                  onRetry={lastUserContentRef.current ? handleRetry : undefined}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 안내 */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-start gap-3">
            <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 space-y-1">
              <p className="font-semibold">Gemini 어시스턴트 사용 안내</p>
              <p>이 어시스턴트는 두골프 ERP의 전체 시스템 구조(DB 스키마, API 목록, 기능 설명)를 컨텍스트로 가지고 있습니다.</p>
              <p>기본 모델: <strong>gemini-2.5-flash</strong>. 구글 서버 과부하 시 자동으로 <strong>gemini-1.5-flash</strong>로 전환됩니다. 두 모델 모두 응답 불가 시 에러 메시지와 함께 다시 시도 버튼이 표시됩니다.</p>
              <p>개발 요청 시 Gemini가 제안하는 코드나 방법을 확인한 후, 실제 구현은 Manus에게 요청하세요.</p>
              <p>대화 내용은 자동으로 DB에 저장되며, ERP &gt; AI 로그 메뉴에서 이전 대화를 다시 확인할 수 있습니다.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </ERPLayout>
  );
}
