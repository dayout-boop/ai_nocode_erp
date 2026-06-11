/**
 * PartnerAIBlockPage.tsx
 * 파트너 ERP — AI 차단 키워드 관리 페이지
 *
 * 파트너(매니저)가 자기 업체 AI(골프톡·AI파트너매니저)에 적용할
 * 차단 키워드를 등록·수정·삭제하는 페이지.
 * 등록된 키워드가 포함된 LLM 요청은 자동으로 차단됩니다.
 */

import { useState, useMemo } from "react";
import {
  partnerTrpc,
  createPartnerTrpcClient,
  createPartnerQueryClient,
} from "@/lib/partnerTrpc";
import { QueryClientProvider } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  RefreshCw,
  Globe,
  Info,
} from "lucide-react";
import { toast } from "sonner";

// ─── 실제 콘텐츠 (partnerTrpc Provider 내부) ─────────────────
function AIBlockPageContent() {
  const [newRuleName, setNewRuleName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editRuleName, setEditRuleName] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // ─── 데이터 조회 ─────────────────────────────────────────
  const { data: rulesData, refetch: refetchRules } =
    partnerTrpc.knowledgeBlock.getRules.useQuery(undefined);

  const { data: logsData, refetch: refetchLogs, isLoading: logsLoading } =
    partnerTrpc.knowledgeBlock.getLogs.useQuery({ limit: 50 });

  // ─── Mutations ──────────────────────────────────────────
  const addRuleMutation = partnerTrpc.knowledgeBlock.addRule.useMutation({
    onSuccess: () => {
      toast.success("차단 규칙이 추가되었습니다");
      setNewRuleName("");
      setNewKeywords("");
      setNewDescription("");
      refetchRules();
    },
    onError: (err) => toast.error(`추가 실패: ${err.message}`),
  });

  const deleteRuleMutation = partnerTrpc.knowledgeBlock.deleteRule.useMutation({
    onSuccess: () => {
      toast.success("차단 규칙이 삭제되었습니다");
      refetchRules();
    },
    onError: (err) => toast.error(`삭제 실패: ${err.message}`),
  });

  const updateRuleMutation = partnerTrpc.knowledgeBlock.updateRule.useMutation({
    onSuccess: () => {
      toast.success("차단 규칙이 수정되었습니다");
      setEditingRuleId(null);
      refetchRules();
    },
    onError: (err) => toast.error(`수정 실패: ${err.message}`),
  });

  // ─── 핸들러 ─────────────────────────────────────────────
  const startEdit = (rule: {
    id: number;
    ruleName: string;
    keywords: string;
    description?: string | null;
  }) => {
    setEditingRuleId(rule.id);
    setEditRuleName(rule.ruleName);
    setEditKeywords(rule.keywords);
    setEditDescription(rule.description ?? "");
  };

  const saveEdit = () => {
    if (!editingRuleId || !editRuleName.trim() || !editKeywords.trim()) return;
    updateRuleMutation.mutate({
      id: editingRuleId,
      ruleName: editRuleName,
      keywords: editKeywords,
      description: editDescription,
    });
  };

  const handleAddRule = () => {
    if (!newRuleName.trim() || !newKeywords.trim()) return;
    addRuleMutation.mutate({
      ruleName: newRuleName,
      keywords: newKeywords,
      description: newDescription,
    });
  };

  // 내 업체 규칙만 (tenantId != null)
  const myRules = rulesData?.customRules?.filter((r) => r.tenantId !== null) ?? [];
  // 전역 규칙 (tenantId == null)
  const globalRules = rulesData?.customRules?.filter((r) => r.tenantId === null) ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="text-red-500" size={22} />
            AI 차단 키워드 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            우리 업체 AI에 적용할 차단 키워드를 등록합니다.
            등록된 키워드가 포함된 요청은 LLM에서 자동으로 차단됩니다.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { refetchRules(); refetchLogs(); }}
        >
          <RefreshCw size={14} className="mr-1" />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <ShieldAlert className="text-orange-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">우리 업체 규칙</p>
                <p className="text-2xl font-bold text-orange-600">{myRules.length}개</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Globe className="text-blue-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">공통 적용 규칙</p>
                <p className="text-2xl font-bold text-blue-600">{globalRules.length}개</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <ShieldCheck className="text-red-600" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">차단 이력</p>
                <p className="text-2xl font-bold text-red-600">
                  {logsData?.logs?.length ?? 0}건
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="my-rules">
        <TabsList>
          <TabsTrigger value="my-rules">우리 업체 규칙</TabsTrigger>
          <TabsTrigger value="global-rules">공통 적용 규칙</TabsTrigger>
          <TabsTrigger value="logs">차단 이력</TabsTrigger>
        </TabsList>

        {/* ── 우리 업체 규칙 탭 ── */}
        <TabsContent value="my-rules">
          <div className="space-y-4">
            {/* 새 규칙 추가 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">차단 키워드 추가</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">규칙 이름</Label>
                  <Input
                    placeholder="예: 경쟁사 언급 차단"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">차단 키워드 (쉼표로 구분)</Label>
                  <Input
                    placeholder="예: 경쟁사A, 경쟁사B, 특정단어"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <p className="text-xs text-gray-400">
                    입력된 키워드 중 하나라도 포함된 AI 요청은 자동 차단됩니다.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">설명 (선택)</Label>
                  <Input
                    placeholder="이 규칙을 추가하는 이유..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  onClick={handleAddRule}
                  disabled={
                    !newRuleName.trim() || !newKeywords.trim() || addRuleMutation.isPending
                  }
                  size="sm"
                  className="w-full"
                >
                  <Plus size={13} className="mr-1.5" />
                  {addRuleMutation.isPending ? "추가 중..." : "규칙 추가"}
                </Button>
              </CardContent>
            </Card>

            {/* 우리 업체 규칙 목록 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  등록된 규칙 ({myRules.length}개)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {myRules.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <ShieldCheck size={32} className="mx-auto mb-2 text-green-400" />
                    <p className="text-sm">등록된 차단 규칙이 없습니다.</p>
                    <p className="text-xs mt-1">위 폼에서 차단 키워드를 추가해 보세요.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="p-3 bg-orange-50 rounded-lg border border-orange-100"
                      >
                        {editingRuleId === rule.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editRuleName}
                              onChange={(e) => setEditRuleName(e.target.value)}
                              placeholder="규칙 이름"
                              className="text-sm h-8"
                            />
                            <Input
                              value={editKeywords}
                              onChange={(e) => setEditKeywords(e.target.value)}
                              placeholder="차단 키워드 (쉼표로 구분)"
                              className="text-sm h-8"
                            />
                            <Input
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="설명 (선택)"
                              className="text-sm h-8"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 h-7 text-xs"
                                onClick={saveEdit}
                                disabled={
                                  !editRuleName.trim() ||
                                  !editKeywords.trim() ||
                                  updateRuleMutation.isPending
                                }
                              >
                                <Check size={12} className="mr-1" />
                                저장
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-7 text-xs"
                                onClick={() => setEditingRuleId(null)}
                              >
                                <X size={12} className="mr-1" />
                                취소
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <ShieldAlert size={13} className="text-orange-500 shrink-0" />
                                <span className="font-medium text-sm">{rule.ruleName}</span>
                              </div>
                              {rule.description && (
                                <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
                              )}
                              <p className="text-xs text-orange-600 mt-0.5 truncate">
                                {rule.keywords}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                등록: {new Date(rule.createdAt).toLocaleDateString("ko-KR")}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-500 hover:text-blue-700 h-7 w-7 p-0"
                                onClick={() => startEdit(rule)}
                              >
                                <Pencil size={12} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                                onClick={() => deleteRuleMutation.mutate({ id: rule.id })}
                              >
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── 공통 적용 규칙 탭 ── */}
        <TabsContent value="global-rules">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Globe size={15} className="text-blue-500" />
                공통 적용 규칙 ({globalRules.length}개)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100 mb-3">
                <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  아래 규칙은 모든 업체에 공통으로 적용되는 차단 규칙입니다.
                  수정이 필요한 경우 두골프 운영팀에 문의해 주세요.
                </p>
              </div>
              {globalRules.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  공통 규칙이 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {globalRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-2">
                        <Globe size={13} className="text-blue-500 shrink-0" />
                        <span className="font-medium text-sm">{rule.ruleName}</span>
                        <Badge variant="secondary" className="text-xs">공통</Badge>
                      </div>
                      {rule.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-0.5 truncate">{rule.keywords}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 차단 이력 탭 ── */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">차단 이력 (최근 50건)</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <p className="text-sm text-gray-400">로딩 중...</p>
              ) : (logsData?.logs?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <ShieldCheck size={32} className="mx-auto mb-2 text-green-400" />
                  <p className="text-sm">차단 이력이 없습니다.</p>
                  <p className="text-xs mt-1">AI가 정상적으로 운영 중입니다.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logsData?.logs?.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-lg"
                    >
                      <ShieldAlert className="text-red-500 mt-0.5 shrink-0" size={14} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {log.knowledgeName}
                          </span>
                          <Badge
                            variant={log.blockType === "auto" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {log.blockType === "auto" ? "자동 차단" : "수동 등록"}
                          </Badge>
                        </div>
                        {log.blockReason && (
                          <p className="text-xs text-red-600 mt-0.5 truncate">{log.blockReason}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(log.createdAt).toLocaleString("ko-KR")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── 래퍼 (partnerTrpc Provider) ─────────────────────────────
export default function PartnerAIBlockPage() {
  const queryClient = useMemo(() => createPartnerQueryClient(), []);
  const trpcClient = useMemo(() => createPartnerTrpcClient(), []);

  return (
    <partnerTrpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AIBlockPageContent />
      </QueryClientProvider>
    </partnerTrpc.Provider>
  );
}
