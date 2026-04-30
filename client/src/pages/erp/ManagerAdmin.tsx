import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Briefcase, Users, TrendingUp, Bot } from "lucide-react";

export default function ManagerAdmin() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: logsData, isLoading } = trpc.aiAssistant.getLogs.useQuery({
    assistant: "manager",
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
        messages,
        lastAt: messages[0]?.createdAt,
      }))
      .filter((s) => {
        if (!searchQuery) return true;
        return s.messages.some((m) =>
          m.content.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
  }, [logsData, searchQuery]);

  const totalSessions = sessions.length;
  const todaySessions = useMemo(() => {
    const today = new Date().toDateString();
    const seen = new Set<string>();
    for (const log of logsData?.logs ?? []) {
      if (new Date(log.createdAt).toDateString() === today) seen.add(log.sessionId);
    }
    return seen.size;
  }, [logsData]);

  return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="text-blue-600" size={24} />
            두골프 매니저 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">입점사 파트너 전용 AI 상담 이력 및 통계</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">총 상담 세션</p>
                <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Bot size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">총 메시지 수</p>
                <p className="text-2xl font-bold text-gray-900">{logsData?.logs?.length ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">오늘 상담 세션</p>
                <p className="text-2xl font-bold text-gray-900">{todaySessions}</p>
              </div>
            </CardContent>
          </Card>
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
              <Bot size={16} className="text-blue-600" />
              두골프 매니저 대화 이력 ({sessions.length}개 세션)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-400">불러오는 중...</div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">대화 이력이 없습니다.</div>
            ) : (
              <div className="space-y-4">
                {sessions.map(({ sessionId, messages, lastAt }) => {
                  const userMsgs = messages.filter((m) => m.role === "user");
                  const assistantMsgs = messages.filter((m) => m.role === "assistant");
                  const firstUser = userMsgs[userMsgs.length - 1];
                  const lastAssistant = assistantMsgs[0];
                  return (
                    <div key={sessionId} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            매니저
                          </Badge>
                          <span className="text-xs text-gray-400 font-mono">{sessionId.slice(0, 12)}...</span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {lastAt ? new Date(lastAt).toLocaleString("ko-KR") : ""}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {firstUser && (
                          <div className="bg-gray-100 rounded p-2 text-sm">
                            <span className="font-medium text-gray-600">파트너: </span>
                            <span className="text-gray-800">{firstUser.content}</span>
                          </div>
                        )}
                        {lastAssistant && (
                          <div className="bg-blue-50 rounded p-2 text-sm">
                            <span className="font-medium text-blue-700">매니저: </span>
                            <span className="text-gray-700 line-clamp-2">{lastAssistant.content}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                        <span>메시지 {messages.length}개</span>
                        <span>질문 {userMsgs.length}개</span>
                        <span>응답 {assistantMsgs.length}개</span>
                      </div>
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
