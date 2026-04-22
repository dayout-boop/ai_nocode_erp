import { useState, useCallback } from "react";
import ERPLayout from "@/components/ERPLayout";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Info, Zap, Code2, Database, Globe } from "lucide-react";

// Gemini 메시지 타입 (서버 API와 동일)
type GeminiRole = "user" | "model";
interface GeminiMessage {
  role: GeminiRole;
  content: string;
}

// AIChatBox의 "assistant" ↔ Gemini의 "model" 변환
function toDisplayMessages(geminiMessages: GeminiMessage[]): Message[] {
  return geminiMessages.map((m) => ({
    role: m.role === "model" ? "assistant" : "user",
    content: m.content,
  }));
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

export default function GeminiAssistant() {
  const [geminiMessages, setGeminiMessages] = useState<GeminiMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const askMutation = trpc.gemini.ask.useMutation({
    onError: (err) => {
      toast.error(err.message || "잠시 후 다시 시도해 주세요.");
      setIsLoading(false);
    },
  });

  const createLogMutation = trpc.aiLogs.create.useMutation();

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: GeminiMessage = { role: "user", content };
      const updatedMessages = [...geminiMessages, userMessage];
      setGeminiMessages(updatedMessages);
      setIsLoading(true);

      try {
        const result = await askMutation.mutateAsync({
          messages: updatedMessages,
        });

        // 폴백 모델 사용 시 응답 앞에 안내 메시지 추가
        const responseContent = result.wasFallback
          ? `> ⚠️ *기본 모델(gemini-2.5-flash) 과부하로 대체 모델(${result.modelUsed})을 사용했습니다.*\n\n${result.response}`
          : result.response;

        if (result.wasFallback) {
          toast.warning(`서버 과부하로 ${result.modelUsed} 모델로 전환하여 응답했습니다.`);
        }

        const modelMessage: GeminiMessage = {
          role: "model",
          content: responseContent,
        };
        setGeminiMessages([...updatedMessages, modelMessage]);

        // 대화 내용을 DB에 자동 저장 (오류가 나도 대화는 계속)
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
    [geminiMessages, isLoading, askMutation, createLogMutation]
  );

  const displayMessages = toDisplayMessages(geminiMessages);

  return (
    <ERPLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
            <Sparkles size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-800">Gemini AI 어시스턴트</h1>
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">
                gemini-2.5-flash
              </Badge>
            </div>
            <p className="text-slate-500 text-sm">
              두골프 ERP 시스템 전체를 이해하는 AI 어시스턴트입니다. 개발 요청, 운영 질문, 기능 제안 등 무엇이든 물어보세요.
            </p>
          </div>
        </div>

        {/* 기능 카드 */}
        {geminiMessages.length === 0 && (
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
              </CardTitle>
              {geminiMessages.length > 0 && (
                <button
                  onClick={() => setGeminiMessages([])}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  대화 초기화
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <AIChatBox
              messages={displayMessages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              placeholder="두골프 ERP에 대해 무엇이든 물어보세요... (Shift+Enter로 줄바꿈)"
              height={520}
              emptyStateMessage="아직 대화가 없습니다. 아래 제안된 질문을 클릭하거나 직접 입력해 보세요."
              suggestedPrompts={SUGGESTED_PROMPTS}
              className="border-0 rounded-none shadow-none"
            />
          </CardContent>
        </Card>

        {/* 안내 */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-start gap-3">
            <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 space-y-1">
              <p className="font-semibold">Gemini 어시스턴트 사용 안내</p>
              <p>이 어시스턴트는 두골프 ERP의 전체 시스템 구조(DB 스키마, API 목록, 기능 설명)를 컨텍스트로 가지고 있습니다.</p>
              <p>개발 요청 시 Gemini가 제안하는 코드나 방법을 확인한 후, 실제 구현은 Manus에게 요청하세요.</p>
              <p>대화 내용은 자동으로 DB에 저장되며, ERP &gt; AI 로그 메뉴에서 이전 대화를 다시 확인할 수 있습니다.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </ERPLayout>
  );
}
