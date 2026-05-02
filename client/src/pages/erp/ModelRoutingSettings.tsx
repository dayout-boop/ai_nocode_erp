/**
 * AI 모델 라우팅 설정 페이지
 * - 복잡도별(high/medium/low) 모델 설정 관리
 * - 라우팅 로그 조회 및 비용 통계
 * - OpenRouter 사용 가능 모델 목록 조회
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Cpu, RefreshCw, Edit2, RotateCcw, BarChart2, List, Zap,
  TrendingUp, DollarSign, Clock, AlertCircle, CheckCircle2
} from "lucide-react";
import { trpc as trpcClient } from "@/lib/trpc";

// 복잡도 레이블 및 색상
const COMPLEXITY_CONFIG = {
  high: { label: "High (고복잡도)", color: "bg-red-100 text-red-700 border-red-200", badge: "destructive" as const, desc: "추론·분석·오류검수" },
  medium: { label: "Medium (중간)", color: "bg-yellow-100 text-yellow-700 border-yellow-200", badge: "secondary" as const, desc: "생성·요약·상담" },
  low: { label: "Low (단순)", color: "bg-green-100 text-green-700 border-green-200", badge: "outline" as const, desc: "분류·태깅·단순응답" },
};

type Complexity = "high" | "medium" | "low";

interface EditFormState {
  complexity: Complexity;
  modelId: string;
  modelName: string;
  inputPricePerMillion: string;
  outputPricePerMillion: string;
  description: string;
  isActive: boolean;
}

export default function ModelRoutingSettings() {
  const utils = trpc.useUtils();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({
    complexity: "medium",
    modelId: "",
    modelName: "",
    inputPricePerMillion: "0",
    outputPricePerMillion: "0",
    description: "",
    isActive: true,
  });
  const [logDays, setLogDays] = useState(30);

  // 데이터 조회
  const { data: rules, isLoading: rulesLoading, refetch: refetchRules } = trpc.modelRouting.list.useQuery();
  const { data: statsData, isLoading: statsLoading } = trpc.modelRouting.getStats.useQuery({ days: logDays });
  const { data: logsData, isLoading: logsLoading } = trpc.modelRouting.getLogs.useQuery({ limit: 100 });
  const { data: modelsData, isLoading: modelsLoading } = trpc.modelRouting.getAvailableModels.useQuery();

  // 뮤테이션
  const upsertMutation = trpc.modelRouting.upsert.useMutation({
    onSuccess: () => {
      toast.success("모델 라우팅 설정이 저장되었습니다.");
      setEditOpen(false);
      utils.modelRouting.list.invalidate();
    },
    onError: (err) => toast.error(`저장 실패: ${err.message}`),
  });

  const resetMutation = trpc.modelRouting.reset.useMutation({
    onSuccess: () => {
      toast.success("기본값으로 초기화되었습니다.");
      utils.modelRouting.list.invalidate();
    },
    onError: (err) => toast.error(`초기화 실패: ${err.message}`),
  });

  const handleEdit = (rule: { complexity: string; modelId: string; modelName: string; inputPricePerMillion: string | null; outputPricePerMillion: string | null; description: string | null; isActive: boolean }) => {
    setEditForm({
      complexity: rule.complexity as Complexity,
      modelId: rule.modelId,
      modelName: rule.modelName,
      inputPricePerMillion: rule.inputPricePerMillion ?? "0",
      outputPricePerMillion: rule.outputPricePerMillion ?? "0",
      description: rule.description ?? "",
      isActive: rule.isActive,
    });
    setEditOpen(true);
  };

  const handleSave = () => {
    if (!editForm.modelId.trim()) {
      toast.error("모델 ID를 입력해주세요.");
      return;
    }
    upsertMutation.mutate({
      complexity: editForm.complexity,
      modelId: editForm.modelId.trim(),
      modelName: editForm.modelName.trim() || editForm.modelId,
      inputPricePerMillion: parseFloat(editForm.inputPricePerMillion) || 0,
      outputPricePerMillion: parseFloat(editForm.outputPricePerMillion) || 0,
      description: editForm.description,
      isActive: editForm.isActive,
    });
  };

  const handleReset = () => {
    if (confirm("모든 모델 라우팅 설정을 기본값으로 초기화하시겠습니까?")) {
      resetMutation.mutate();
    }
  };

  const formatCost = (val: number | string | null | undefined) => {
    const n = parseFloat(String(val ?? 0));
    return `$${n.toFixed(6)}`;
  };

  const formatDate = (d: Date | string | null | undefined) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("ko-KR");
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="text-blue-600" size={24} />
            AI 모델 라우팅 설정
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            작업 복잡도별 OpenRouter 모델을 설정하고 비용을 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchRules()}>
            <RefreshCw size={14} className="mr-1" /> 새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset} disabled={resetMutation.isPending}>
            <RotateCcw size={14} className="mr-1" /> 기본값 초기화
          </Button>
        </div>
      </div>

      <Tabs defaultValue="rules">
        <TabsList className="mb-4">
          <TabsTrigger value="rules"><Zap size={14} className="mr-1" /> 라우팅 규칙</TabsTrigger>
          <TabsTrigger value="stats"><BarChart2 size={14} className="mr-1" /> 비용 통계</TabsTrigger>
          <TabsTrigger value="logs"><List size={14} className="mr-1" /> 호출 로그</TabsTrigger>
          <TabsTrigger value="models"><Cpu size={14} className="mr-1" /> 사용 가능 모델</TabsTrigger>
        </TabsList>

        {/* ── 라우팅 규칙 탭 ── */}
        <TabsContent value="rules">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rulesLoading ? (
              <div className="col-span-3 text-center py-12 text-muted-foreground">로딩 중...</div>
            ) : rules && rules.length > 0 ? (
              rules.map((rule) => {
                const cfg = COMPLEXITY_CONFIG[rule.complexity as Complexity] ?? COMPLEXITY_CONFIG.medium;
                return (
                  <Card key={rule.id} className="border-2 hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Badge className={cfg.color}>{cfg.label}</Badge>
                        <Badge variant={rule.isActive ? "default" : "secondary"}>
                          {rule.isActive ? "활성" : "비활성"}
                        </Badge>
                      </div>
                      <CardTitle className="text-base mt-2 font-semibold">{rule.modelName}</CardTitle>
                      <CardDescription className="text-xs font-mono text-muted-foreground truncate">
                        {rule.modelId}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm text-muted-foreground">{cfg.desc}</div>
                      {rule.description && (
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                          {rule.description}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-blue-50 rounded p-2">
                          <div className="text-muted-foreground">입력 단가</div>
                          <div className="font-semibold text-blue-700">
                            ${parseFloat(rule.inputPricePerMillion ?? "0").toFixed(4)}/1M
                          </div>
                        </div>
                        <div className="bg-purple-50 rounded p-2">
                          <div className="text-muted-foreground">출력 단가</div>
                          <div className="font-semibold text-purple-700">
                            ${parseFloat(rule.outputPricePerMillion ?? "0").toFixed(4)}/1M
                          </div>
                        </div>
                      </div>
                      {rule.updatedBy && (
                        <div className="text-xs text-muted-foreground">
                          최종 수정: {rule.updatedBy} · {formatDate(rule.updatedAt)}
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleEdit(rule)}
                      >
                        <Edit2 size={12} className="mr-1" /> 모델 변경
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                설정된 라우팅 규칙이 없습니다. 기본값 초기화를 실행해주세요.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── 비용 통계 탭 ── */}
        <TabsContent value="stats">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Label>집계 기간</Label>
              <div className="flex gap-2">
                {[7, 30, 90].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant={logDays === d ? "default" : "outline"}
                    onClick={() => setLogDays(d)}
                  >
                    {d}일
                  </Button>
                ))}
              </div>
            </div>

            {statsLoading ? (
              <div className="text-center py-12 text-muted-foreground">통계 로딩 중...</div>
            ) : statsData ? (
              <>
                {/* 요약 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <DollarSign size={14} /> 총 비용
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        ${Number(statsData.summary.totalCostUsd).toFixed(4)}
                      </div>
                      <div className="text-xs text-muted-foreground">최근 {logDays}일</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <TrendingUp size={14} /> 총 호출 수
                      </div>
                      <div className="text-2xl font-bold">
                        {Number(statsData.summary.totalCalls).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">최근 {logDays}일</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <DollarSign size={14} /> 평균 호출 비용
                      </div>
                      <div className="text-2xl font-bold text-blue-600">
                        ${statsData.summary.totalCalls > 0
                          ? (Number(statsData.summary.totalCostUsd) / Number(statsData.summary.totalCalls)).toFixed(6)
                          : "0.000000"}
                      </div>
                      <div className="text-xs text-muted-foreground">호출당 평균</div>
                    </CardContent>
                  </Card>
                </div>

                {/* 복잡도별 통계 테이블 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">복잡도별 사용 통계</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>복잡도</TableHead>
                          <TableHead>모델</TableHead>
                          <TableHead className="text-right">호출 수</TableHead>
                          <TableHead className="text-right">입력 토큰</TableHead>
                          <TableHead className="text-right">출력 토큰</TableHead>
                          <TableHead className="text-right">총 비용</TableHead>
                          <TableHead className="text-right">평균 응답(ms)</TableHead>
                          <TableHead className="text-right">오류 수</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statsData.stats.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                              해당 기간에 호출 이력이 없습니다.
                            </TableCell>
                          </TableRow>
                        ) : (
                          statsData.stats.map((s, i) => {
                            const cfg = COMPLEXITY_CONFIG[s.complexity as Complexity] ?? COMPLEXITY_CONFIG.medium;
                            return (
                              <TableRow key={i}>
                                <TableCell>
                                  <Badge className={cfg.color}>{cfg.label}</Badge>
                                </TableCell>
                                <TableCell className="text-xs font-mono">{s.modelName ?? s.modelId}</TableCell>
                                <TableCell className="text-right">{Number(s.callCount).toLocaleString()}</TableCell>
                                <TableCell className="text-right">{Number(s.totalTokensIn).toLocaleString()}</TableCell>
                                <TableCell className="text-right">{Number(s.totalTokensOut).toLocaleString()}</TableCell>
                                <TableCell className="text-right text-green-600 font-semibold">
                                  ${Number(s.totalCostUsd).toFixed(4)}
                                </TableCell>
                                <TableCell className="text-right">{Math.round(Number(s.avgDurationMs))}ms</TableCell>
                                <TableCell className="text-right">
                                  {Number(s.errorCount) > 0 ? (
                                    <span className="text-red-500">{Number(s.errorCount)}</span>
                                  ) : (
                                    <span className="text-green-500">0</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </TabsContent>

        {/* ── 호출 로그 탭 ── */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">최근 AI 라우팅 호출 로그</CardTitle>
              <CardDescription>최근 100건의 AI 모델 호출 이력입니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>시각</TableHead>
                        <TableHead>복잡도</TableHead>
                        <TableHead>모델</TableHead>
                        <TableHead>어시스턴트</TableHead>
                        <TableHead className="text-right">입력</TableHead>
                        <TableHead className="text-right">출력</TableHead>
                        <TableHead className="text-right">비용</TableHead>
                        <TableHead className="text-right">응답(ms)</TableHead>
                        <TableHead>상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!logsData || logsData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            호출 이력이 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : (
                        logsData.map((log) => {
                          const cfg = COMPLEXITY_CONFIG[log.complexity as Complexity] ?? COMPLEXITY_CONFIG.medium;
                          return (
                            <TableRow key={log.id}>
                              <TableCell className="text-xs">{formatDate(log.createdAt)}</TableCell>
                              <TableCell>
                                <Badge className={`text-xs ${cfg.color}`}>{log.complexity}</Badge>
                              </TableCell>
                              <TableCell className="text-xs font-mono max-w-[160px] truncate">
                                {log.modelName ?? log.modelId}
                              </TableCell>
                              <TableCell className="text-xs">{log.assistantType ?? "-"}</TableCell>
                              <TableCell className="text-right text-xs">{(log.tokensIn ?? 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs">{(log.tokensOut ?? 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right text-xs text-green-600">
                                {formatCost(log.costUsd)}
                              </TableCell>
                              <TableCell className="text-right text-xs">{log.durationMs ?? 0}ms</TableCell>
                              <TableCell>
                                {log.isSuccess ? (
                                  <CheckCircle2 size={14} className="text-green-500" />
                                ) : (
                                  <AlertCircle size={14} className="text-red-500" />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 사용 가능 모델 탭 ── */}
        <TabsContent value="models">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">OpenRouter 사용 가능 모델</CardTitle>
              <CardDescription>
                Gemini, Claude, GPT-4, Llama 계열 모델 목록입니다. 모델 ID를 복사하여 라우팅 규칙에 적용하세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {modelsLoading ? (
                <div className="text-center py-8 text-muted-foreground">모델 목록 로딩 중...</div>
              ) : modelsData?.error ? (
                <div className="text-center py-8 text-red-500">{modelsData.error}</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>모델 ID</TableHead>
                        <TableHead>모델명</TableHead>
                        <TableHead className="text-right">입력 단가 ($/1M)</TableHead>
                        <TableHead className="text-right">출력 단가 ($/1M)</TableHead>
                        <TableHead className="text-right">컨텍스트</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modelsData?.models.map((m) => (
                        <TableRow
                          key={m.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            navigator.clipboard.writeText(m.id);
                            toast.success(`모델 ID 복사됨: ${m.id}`);
                          }}
                        >
                          <TableCell className="text-xs font-mono">{m.id}</TableCell>
                          <TableCell className="text-sm">{m.name}</TableCell>
                          <TableCell className="text-right text-xs">
                            ${m.inputPricePerMillion.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            ${m.outputPricePerMillion.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {(m.contextLength / 1000).toFixed(0)}K
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 모델 편집 다이얼로그 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 size={16} />
              {COMPLEXITY_CONFIG[editForm.complexity]?.label} 모델 변경
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>모델 ID <span className="text-red-500">*</span></Label>
              <Input
                value={editForm.modelId}
                onChange={(e) => setEditForm((f) => ({ ...f, modelId: e.target.value }))}
                placeholder="예: google/gemini-2.5-flash"
              />
              <p className="text-xs text-muted-foreground">
                OpenRouter 모델 ID를 입력하세요. 사용 가능 모델 탭에서 복사할 수 있습니다.
              </p>
            </div>
            <div className="space-y-1">
              <Label>모델 표시명</Label>
              <Input
                value={editForm.modelName}
                onChange={(e) => setEditForm((f) => ({ ...f, modelName: e.target.value }))}
                placeholder="예: Gemini 2.5 Flash"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>입력 단가 ($/1M tokens)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={editForm.inputPricePerMillion}
                  onChange={(e) => setEditForm((f) => ({ ...f, inputPricePerMillion: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>출력 단가 ($/1M tokens)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={editForm.outputPricePerMillion}
                  onChange={(e) => setEditForm((f) => ({ ...f, outputPricePerMillion: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>설명</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="이 모델의 사용 목적을 입력하세요."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={editForm.isActive}
                onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="isActive">활성화</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
