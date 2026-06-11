import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Bot, ChevronDown, ChevronUp, MessageSquarePlus } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function MasterLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const { data: logsData, isLoading } = trpc.aiAssistant.getLogs.useQuery({
    assistant: "master",
    limit: 200,
  });

  const sessions = useMemo(() => {
    const logs = logsData?.logs ?? [];
    const grouped: Record<string, typeof logs> = {};
    for (const log of logs) {
      if (!grouped[log.sessionId]) grouped[log.sessionId] = [];
      grouped[log.sessionId].push(log);
    }
    return Object.entries(grouped)
      .map(([sessionId, messages]) => ({
        sessionId,
        messages: [...messages].reverse(), // 시간순 정렬
        lastAt: messages[0]?.createdAt,
        totalTokens: messages.reduce((acc, m) => acc + (m.tokensIn ?? 0) + (m.tokensOut ?? 0), 0),
        totalCost: messages.reduce((acc, m) => acc + parseFloat(m.costUsd ?? "0"), 0),
      }))
      .filter((s) => {
        if (!searchQuery) return true;
        return s.messages.some((m) =>
          m.content.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
  }, [logsData, searchQuery]);

  /**
   * 대화 이어가기 핸들러
   * - sessionId를 URL 파라미터로 전달하여 MasterAI 페이지에서 자동 로드
   */
  const handleContinueSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 세션 펼치기 이벤트 차단
    toast.info("마스터AI 채팅창으로 이동합니다...");
    navigate(`/master-ai?continueSession=${encodeURIComponent(sessionId)}`);
  };

  return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="text-purple-600" size={24} />
            마스터AI 로그
          </h1>
          <p className="text-gray-500 text-sm mt-1">마스터AI의 모든 대화 세션 이력</p>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="대화 내용 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot size={16} className="text-purple-600" />
              마스터AI 로그 ({sessions.length}개 세션)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-400">불러오는 중...</div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">대화 이력이 없습니다.</div>
            ) : (
              <div className="space-y-3">
                {sessions.map(({ sessionId, messages, lastAt, totalTokens, totalCost }) => {
                  const isExpanded = expandedSession === sessionId;
                  const firstUser = messages.find((m) => m.role === "user");
                  return (
                    <div key={sessionId} className="border rounded-lg overflow-hidden">
                      <button
                        className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedSession(isExpanded ? null : sessionId)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 shrink-0">
                              마스터
                            </Badge>
                            <span className="text-sm text-gray-800 truncate">
                              {firstUser?.content.slice(0, 60) ?? "세션 " + sessionId.slice(0, 8)}
                              {(firstUser?.content.length ?? 0) > 60 ? "..." : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-gray-400">
                              {lastAt ? new Date(lastAt).toLocaleString("ko-KR") : ""}
                            </span>
                            <span className="text-xs text-gray-400">{messages.length}개</span>
                            {totalCost > 0 && (
                              <span className="text-xs text-green-600">${totalCost.toFixed(4)}</span>
                            )}
                            {/* 대화 이어가기 아이콘 버튼 */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-purple-600 hover:bg-purple-50 hover:text-purple-700 shrink-0"
                              onClick={(e) => handleContinueSession(sessionId, e)}
                              title="이 대화 이어가기"
                            >
                              <MessageSquarePlus size={15} />
                            </Button>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="border-t bg-gray-50">
                          {/* 이어가기 버튼 (펼쳐진 상태) */}
                          <div className="px-4 pt-3 pb-1 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-purple-700 border-purple-300 hover:bg-purple-50 gap-1.5"
                              onClick={(e) => handleContinueSession(sessionId, e)}
                            >
                              <MessageSquarePlus size={13} />
                              이 대화 이어가기
                            </Button>
                          </div>
                          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                            {messages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`rounded p-3 text-sm ${
                                  msg.role === "user"
                                    ? "bg-white border ml-4"
                                    : msg.role === "assistant"
                                    ? "bg-purple-50 border border-purple-100 mr-4"
                                    : "bg-yellow-50 border border-yellow-100 text-xs"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-xs text-gray-500">
                                    {msg.role === "user" ? "관리자" : msg.role === "assistant" ? "마스터 🤖" : "시스템"}
                                  </span>
                                  <div className="flex items-center gap-2 text-xs text-gray-400">
                                    {msg.modelUsed && <span>{msg.modelUsed.split("/").pop()}</span>}
                                    {(msg.tokensIn ?? 0) > 0 && <span>{msg.tokensIn}↑ {msg.tokensOut}↓</span>}
                                  </div>
                                </div>
                                <p className="text-gray-800 whitespace-pre-wrap">{msg.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
