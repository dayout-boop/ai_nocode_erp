import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Zap, BarChart3 } from "lucide-react";

/**
 * getCostSummary 응답 형식:
 * {
 *   rows: Array<{ assistant: string; totalCost: number; totalTokensIn: number; totalTokensOut: number; messageCount: number }>;
 *   totalCost: number;
 *   totalMessages: number;
 *   period: "today" | "week" | "month";
 * }
 */

export default function MasterCosts() {
  const [period, setPeriod] = useState<"today" | "week" | "month">("month");

  const { data: costData, isLoading } = trpc.aiAssistant.getCostSummary.useQuery({ period });

  const periodLabel = { today: "오늘", week: "이번 주", month: "이번 달" }[period];

  // 어시스턴트 레이블/색상 매핑
  const assistantLabels: Record<string, string> = {
    master: "두골프 마스터",
    golftalk: "골프톡",
    manager: "두골프 매니저",
  };
  const assistantColors: Record<string, string> = {
    master: "bg-purple-50 text-purple-700 border-purple-200",
    golftalk: "bg-green-50 text-green-700 border-green-200",
    manager: "bg-blue-50 text-blue-700 border-blue-200",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="text-green-600" size={24} />
            AI 비용 현황
          </h1>
          <p className="text-gray-500 text-sm mt-1">두골프 마스터 AI 호출 비용 추적</p>
        </div>
        <div className="flex gap-2">
          {(["today", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {{ today: "오늘", week: "이번 주", month: "이번 달" }[p]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : costData ? (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{periodLabel} 총 비용</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${Number(costData.totalCost ?? 0).toFixed(4)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Zap size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">총 메시지 수</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {costData.totalMessages ?? 0}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp size={20} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">총 토큰</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {costData.rows
                      .reduce(
                        (acc, r) =>
                          acc + Number(r.totalTokensIn ?? 0) + Number(r.totalTokensOut ?? 0),
                        0
                      )
                      .toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <BarChart3 size={20} className="text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">평균 메시지 비용</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${costData.totalMessages > 0
                      ? (Number(costData.totalCost) / costData.totalMessages).toFixed(4)
                      : "0.0000"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 어시스턴트별 비용 */}
          {costData.rows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI 어시스턴트별 비용</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {costData.rows.map((row) => {
                    const assistant = row.assistant ?? "unknown";
                    const tokensTotal =
                      Number(row.totalTokensIn ?? 0) + Number(row.totalTokensOut ?? 0);
                    return (
                      <div
                        key={assistant}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${assistantColors[assistant] ?? ""}`}
                          >
                            {assistantLabels[assistant] ?? assistant}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {Number(row.messageCount ?? 0)}회 메시지
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">
                            {tokensTotal.toLocaleString()} 토큰
                          </span>
                          <span className="text-xs text-gray-400">
                            in: {Number(row.totalTokensIn ?? 0).toLocaleString()} / out:{" "}
                            {Number(row.totalTokensOut ?? 0).toLocaleString()}
                          </span>
                          <span className="font-semibold text-green-700">
                            ${Number(row.totalCost ?? 0).toFixed(4)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-gray-400">비용 데이터가 없습니다.</div>
      )}
    </div>
  );
}
