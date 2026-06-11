/**
 * AI ERP - OpenRouter 에이전트 페이지
 * OpenRouter SDK 기반 모듈형 AI 에이전트 인터페이스
 * 요청/응답 양방향 4,000자 자동 분할 기능 포함
 */
import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Trash2, Bot, User, Zap, Settings2, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: string[];
  isSplit?: boolean;
  splitIndex?: number;
  splitTotal?: number;
}

// 인기 모델 목록 (하드코딩 - 빠른 로딩)
const POPULAR_MODELS = [
  { id: 'openrouter/auto', name: '자동 선택 (Auto)' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (저비용)' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (무료)' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat' },
];

export default function OpenRouterAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('openrouter/auto');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 에이전트 상태 조회
  const { data: status } = trpc.openrouterAgent.status.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // 메시지 분할 함수 (4,000자 초과 시)
  const splitMessage = (text: string): string[] => {
    const MAX_LENGTH = 3800;
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > MAX_LENGTH) {
      // 마지막 공백 위치에서 분할
      let splitPos = MAX_LENGTH;
      const lastSpace = remaining.lastIndexOf(' ', MAX_LENGTH);
      if (lastSpace > MAX_LENGTH - 200) {
        splitPos = lastSpace;
      }

      chunks.push(remaining.substring(0, splitPos).trim());
      remaining = remaining.substring(splitPos).trim();
    }

    if (remaining.length > 0) {
      chunks.push(remaining);
    }

    return chunks;
  };

  // 채팅 뮤테이션
  const chatMutation = trpc.openrouterAgent.chat.useMutation({
    onSuccess: (data: any) => {
      let content = data.response;
      const attachments: string[] = [];

      // 메시지 분할 시 첨부 파일 정보 추가
      if (data._isSplit && data._attachmentCount > 0) {
        content += '\n\n📎 **' + data._attachmentCount + '개 파일 첨부됨:**\n';
        if (data.attachments && Array.isArray(data.attachments)) {
          (data.attachments as string[]).forEach((file: string) => {
            const filename = file.split('/').pop() || 'attachment';
            content += '- [' + filename + '](' + file + ')\n';
            attachments.push(file);
          });
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content,
          timestamp: new Date(),
          attachments: attachments.length > 0 ? attachments : undefined,
          isSplit: data._isSplit || false,
        },
      ]);
    },
    onError: (err) => {
      toast.error(`에이전트 오류: ${err.message}`);
    },
  });

  // 이력 초기화 뮤테이션
  const clearMutation = trpc.openrouterAgent.clearHistory.useMutation({
    onSuccess: () => {
      setMessages([]);
      toast.success('대화 이력이 초기화되었습니다.');
    },
  });

  // 스크롤 자동 이동
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatMutation.isPending]);

  // 입력 필드 문자 수 표시
  const charCount = input.length;
  const isLongMessage = charCount > 4000;
  const charPercentage = Math.min((charCount / 4000) * 100, 100);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || chatMutation.isPending) return;

    setInput('');

    // 4,000자 초과 시 분할
    if (text.length > 4000) {
      const chunks = splitMessage(text);
      toast.info(`📤 긴 메시지가 ${chunks.length}개 부분으로 분할되어 전송됩니다.`);

      // 각 청크를 순차적으로 전송
      chunks.forEach((chunk, index) => {
        const displayText = `[${index + 1}/${chunks.length}] ${chunk}`;

        setMessages((prev) => [
          ...prev,
          {
            role: 'user',
            content: displayText,
            timestamp: new Date(),
            isSplit: true,
            splitIndex: index + 1,
            splitTotal: chunks.length,
          },
        ]);

        // 약간의 딜레이를 두고 전송 (API 레이트 리밋 방지)
        setTimeout(() => {
          chatMutation.mutate({
            message: chunk,
            model: selectedModel !== 'openrouter/auto' ? selectedModel : undefined,
          });
        }, index * 500);
      });
    } else {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: text, timestamp: new Date() },
      ]);

      chatMutation.mutate({
        message: text,
        model: selectedModel !== 'openrouter/auto' ? selectedModel : undefined,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">OpenRouter 에이전트</h1>
            <p className="text-sm text-muted-foreground">300+ 모델 통합 AI 어시스턴트</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 상태 배지 */}
          {status && (
            <Badge variant={status.ready ? 'default' : 'destructive'} className="text-xs">
              {status.ready ? `준비됨 · 세션 ${status.activeSessions}개` : 'API 키 미설정'}
            </Badge>
          )}

          {/* 모델 선택 */}
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <Settings2 className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POPULAR_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 이력 초기화 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending || messages.length === 0}
            className="h-8 text-xs"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            초기화
          </Button>
        </div>
      </div>

      {/* 도구 목록 */}
      {status?.tools && status.tools.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {status.tools.map((tool) => (
            <Badge key={tool.name} variant="secondary" className="text-xs font-mono">
              🔧 {tool.name}
            </Badge>
          ))}
        </div>
      )}

      {/* 채팅 영역 */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full flex flex-col">
          <ScrollArea className="flex-1 p-4" ref={scrollRef as React.RefObject<HTMLDivElement>}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-violet-500" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">AI ERP 에이전트</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    예약 현황, 재무 요약, ERP 기능 안내 등을 물어보세요.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {[
                    '현재 예약 현황 알려줘',
                    'ERP 기능 목록 보여줘',
                    '태국 골프 패키지 찾아줘',
                    '재무 관리 어떻게 해?',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors border border-border"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i}>
                    <div
                      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {/* 아바타 */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>

                      {/* 메시지 버블 */}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-muted text-foreground rounded-tl-sm'
                        }`}
                      >
                        {msg.isSplit && msg.splitIndex && (
                          <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-current/20">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-semibold">
                              분할 메시지 {msg.splitIndex}/{msg.splitTotal}
                            </span>
                          </div>
                        )}
                        {msg.role === 'assistant' ? (
                          <Streamdown>{msg.content}</Streamdown>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                        <p
                          className={`text-[10px] mt-1 ${
                            msg.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'
                          }`}
                        >
                          {msg.timestamp.toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    {/* 첨부 파일 표시 */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 ml-11 space-y-1">
                        {msg.attachments.map((file, idx) => (
                          <a
                            key={idx}
                            href={file}
                            download
                            className="flex items-center gap-2 text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 p-2 rounded bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-950/30 transition-colors"
                          >
                            <FileText className="w-3 h-3" />
                            <span className="truncate">{file.split('/').pop()}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* 로딩 인디케이터 */}
                {chatMutation.isPending && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1 items-center">
                        <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
                        <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
                        <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* 입력 영역 */}
          <div className="border-t p-3 flex flex-col gap-2">
            {/* 문자 수 표시 바 */}
            {charCount > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className={isLongMessage ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-muted-foreground'}>
                  {charCount.toLocaleString()} / 4,000자
                </span>
                {isLongMessage && (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    자동으로 분할되어 전송됩니다
                  </span>
                )}
              </div>
            )}
            {charCount > 0 && (
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    isLongMessage ? 'bg-amber-500' : 'bg-violet-500'
                  }`}
                  style={{ width: `${charPercentage}%` }}
                />
              </div>
            )}

            {/* 입력 필드 */}
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
                disabled={chatMutation.isPending}
                className="flex-1 text-sm"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || chatMutation.isPending}
                size="sm"
                className="bg-violet-600 hover:bg-violet-700 text-white px-4"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 정보 카드 */}
      <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border-violet-200 dark:border-violet-800">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm text-violet-700 dark:text-violet-300">
            OpenRouter 에이전트 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <p className="text-xs text-muted-foreground">
            OpenRouter SDK 기반 모듈형 에이전트로, 300+ 모델에 통합 접근합니다.
            도구 호출(Tool Use)을 통해 ERP 데이터를 실시간으로 조회하고 안내합니다.
            모델은 상단 드롭다운에서 변경할 수 있으며, <code className="bg-muted px-1 rounded">openrouter/auto</code>를 선택하면 최적 모델이 자동 선택됩니다.
            <br />
            <strong>양방향 자동 분할:</strong> 요청과 응답 모두 4,000자 이상이면 자동으로 분할되어 전송/표시됩니다.
            긴 응답은 파일로 첨부되며 다운로드 가능합니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
