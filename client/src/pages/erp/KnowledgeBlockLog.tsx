/**
 * AI ERP - AI 차단 키워드 관리 페이지
 *
 * 마스터: 전역 차단 규칙 + 모든 업체 규칙 통합 관리
 * 파트너: 자기 업체 차단 규칙 관리 (전역 규칙 열람 포함)
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  Pencil,
  Check,
  X,
  Building2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

export default function KnowledgeBlockLog() {
  const { user } = useAuth();
  const isMaster = user?.role === "admin";

  // 마스터 전용: 업체 선택 필터
  const [selectedTenantId, setSelectedTenantId] = useState<number | null | "all">("all");

  // 규칙 추가 폼
  const [newRuleName, setNewRuleName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newDescription, setNewDescription] = useState("");
  // 마스터 전용: 규칙 추가 시 대상 업체 선택 (null=전역)
  const [addTargetTenantId, setAddTargetTenantId] = useState<number | null>(null);

  // 수정 상태
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editRuleName, setEditRuleName] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // 지식 검사 (마스터 전용)
  const [checkName, setCheckName] = useState("");
  const [checkContent, setCheckContent] = useState("");

  // ─── 데이터 조회 ───────────────────────────────────────────
  const { data: logsData, refetch: refetchLogs, isLoading: logsLoading } =
    trpc.knowledgeBlock.getLogs.useQuery({ limit: 100 });

  const { data: statsData, refetch: refetchStats } =
    trpc.knowledgeBlock.getStats.useQuery(undefined, { enabled: isMaster });

  // 규칙 목록: 마스터는 selectedTenantId 기준, 파트너는 자기 업체
  const filterTenantId =
    isMaster
      ? selectedTenantId === "all"
        ? undefined
        : selectedTenantId
      : undefined;

  const { data: rulesData, refetch: refetchRules } =
    trpc.knowledgeBlock.getRules.useQuery(
      isMaster ? { filterTenantId } : undefined
    );

  // 마스터 전용: 업체 목록 + 규칙 수 요약
  const { data: tenantSummary, refetch: refetchTenantSummary } =
    trpc.knowledgeBlock.listTenantRuleSummary.useQuery(undefined, {
      enabled: isMaster,
    });

  // ─── Mutations ────────────────────────────────────────────
  const checkMutation = trpc.knowledgeBlock.checkKnowledge.useMutation({
    onSuccess: (result) => {
      if (result.isBlocked) {
        toast.error(
          `차단 감지: "${result.knowledgeName}" — 감지 키워드: ${result.matchedKeywords.join(", ")}`
        );
      } else {
        toast.success(`허용: "${result.knowledgeName}" — 차단 키워드 없음`);
      }
      refetchLogs();
      refetchStats();
    },
  });

  const addRuleMutation = trpc.knowledgeBlock.addRule.useMutation({
    onSuccess: () => {
      toast.success("차단 규칙 추가 완료");
      setNewRuleName("");
      setNewKeywords("");
      setNewDescription("");
      refetchRules();
      refetchTenantSummary?.();
    },
    onError: (err) => toast.error(`추가 실패: ${err.message}`),
  });

  const deleteRuleMutation = trpc.knowledgeBlock.deleteRule.useMutation({
    onSuccess: () => {
      toast.success("차단 규칙 삭제 완료");
      refetchRules();
      refetchTenantSummary?.();
    },
    onError: (err) => toast.error(`삭제 실패: ${err.message}`),
  });

  const updateRuleMutation = trpc.knowledgeBlock.updateRule.useMutation({
    onSuccess: () => {
      toast.success("차단 규칙 수정 완료");
      setEditingRuleId(null);
      refetchRules();
    },
    onError: (err) => toast.error(`수정 실패: ${err.message}`),
  });

  // ─── 핸들러 ───────────────────────────────────────────────
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

  const cancelEdit = () => setEditingRuleId(null);

  const saveEdit = () => {
    if (!editingRuleId || !editRuleName.trim() || !editKeywords.trim()) return;
    updateRuleMutation.mutate({
      id: editingRuleId,
      ruleName: editRuleName,
      keywords: editKeywords,
      description: editDescription,
    });
  };

  const handleCheck = () => {
    if (!checkName.trim()) return;
    checkMutation.mutate({ knowledgeName: checkName, knowledgeContent: checkContent });
  };

  const handleAddRule = () => {
    if (!newRuleName.trim() || !newKeywords.trim()) return;
    addRuleMutation.mutate({
      ruleName: newRuleName,
      keywords: newKeywords,
      description: newDescription,
      targetTenantId: isMaster ? addTargetTenantId : undefined,
    });
  };

  const handleRefreshAll = () => {
    refetchLogs();
    refetchStats?.();
    refetchRules();
    refetchTenantSummary?.();
  };

  // ─── 업체명 헬퍼 ─────────────────────────────────────────
  const getTenantName = (tenantId: number | null) => {
    if (tenantId === null) return "전역 (모든 업체 공통)";
    return (
      tenantSummary?.tenantList?.find((t) => t.id === tenantId)?.companyName ??
      `업체 #${tenantId}`
    );
  };

  // ─── 렌더링 ───────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="text-red-500" size={24} />
            AI 차단 키워드 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isMaster
              ? "전역 차단 규칙과 업체별 차단 규칙을 통합 관리합니다. 등록된 키워드는 LLM 요청 시 실시간으로 차단됩니다."
              : "우리 업체 AI(골프톡·AI파트너매니저)에 적용할 차단 키워드를 등록합니다. 등록된 키워드가 포함된 요청은 LLM에서 자동으로 차단됩니다."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefreshAll}>
          <RefreshCw size={14} className="mr-1" />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <ShieldAlert className="text-red-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">총 차단 건수</p>
                <p className="text-2xl font-bold text-red-600">
                  {logsData?.logs?.length ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Globe className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">전역 차단 규칙</p>
                <p className="text-2xl font-bold text-blue-600">
                  {isMaster
                    ? (tenantSummary?.globalRuleCount ?? 0)
                    : (rulesData?.customRules?.filter((r) => r.tenantId === null).length ?? 0)}
                  개
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <ShieldCheck className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">
                  {isMaster ? "업체별 규칙 합계" : "우리 업체 규칙"}
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {isMaster
                    ? (tenantSummary?.tenantList?.reduce((s, t) => s + t.ruleCount, 0) ?? 0)
                    : (rulesData?.customRules?.filter((r) => r.tenantId !== null).length ?? 0)}
                  개
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">차단 규칙 관리</TabsTrigger>
          {isMaster && <TabsTrigger value="tenants">업체별 현황</TabsTrigger>}
          <TabsTrigger value="logs">차단 이력</TabsTrigger>
          {isMaster && <TabsTrigger value="check">키워드 검사</TabsTrigger>}
          {isMaster && <TabsTrigger value="stats">통계</TabsTrigger>}
        </TabsList>

        {/* ── 차단 규칙 관리 탭 ── */}
        <TabsContent value="rules">
          <div className="space-y-4">
            {/* 마스터: 업체 필터 */}
            {isMaster && (
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <Label className="shrink-0">규칙 범위 필터</Label>
                    <Select
                      value={selectedTenantId === "all" ? "all" : selectedTenantId === null ? "global" : String(selectedTenantId)}
                      onValueChange={(v) => {
                        if (v === "all") setSelectedTenantId("all");
                        else if (v === "global") setSelectedTenantId(null);
                        else setSelectedTenantId(Number(v));
                      }}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="전체 보기" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">전체 보기</SelectItem>
                        <SelectItem value="global">전역 규칙만</SelectItem>
                        {tenantSummary?.tenantList?.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.companyName} ({t.ruleCount}개)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-gray-400">
                      {rulesData?.customRules?.length ?? 0}개 규칙 표시 중
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 새 규칙 추가 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">차단 키워드 규칙 추가</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isMaster && (
                  <div className="space-y-1">
                    <Label>적용 대상</Label>
                    <Select
                      value={addTargetTenantId === null ? "global" : String(addTargetTenantId)}
                      onValueChange={(v) =>
                        setAddTargetTenantId(v === "global" ? null : Number(v))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="전역 (모든 업체 공통)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">전역 (모든 업체 공통)</SelectItem>
                        {tenantSummary?.tenantList?.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label>규칙 이름</Label>
                  <Input
                    placeholder="예: 경쟁사 언급 차단"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>차단 키워드 (쉼표로 구분)</Label>
                  <Input
                    placeholder="예: 경쟁사A, 경쟁사B, 특정단어"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                  />
                  <p className="text-xs text-gray-400">
                    입력된 키워드 중 하나라도 포함된 LLM 요청은 자동으로 차단됩니다.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>설명 (선택)</Label>
                  <Input
                    placeholder="이 규칙을 추가하는 이유..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleAddRule}
                  disabled={!newRuleName.trim() || !newKeywords.trim() || addRuleMutation.isPending}
                  className="w-full"
                >
                  <Plus size={14} className="mr-2" />
                  {addRuleMutation.isPending ? "추가 중..." : "규칙 추가"}
                </Button>
              </CardContent>
            </Card>

            {/* 기본 내장 규칙 (마스터만 표시) */}
            {isMaster && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    기본 내장 규칙 ({rulesData?.defaultRules?.length ?? 0}개)
                    <span className="text-xs font-normal text-gray-400 ml-2">— 시스템 내장, 수정 불가</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {rulesData?.defaultRules?.map((rule, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <Shield size={14} className="text-blue-500 shrink-0" />
                          <span className="font-medium text-sm">{rule.ruleName}</span>
                          <Badge variant="secondary" className="text-xs">내장</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{rule.description}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {rule.keywords.slice(0, 3).map((kw, j) => (
                            <span key={j} className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                              {kw}
                            </span>
                          ))}
                          {rule.keywords.length > 3 && (
                            <span className="text-xs text-gray-400">+{rule.keywords.length - 3}개</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 등록된 차단 규칙 목록 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  등록된 차단 규칙 ({rulesData?.customRules?.length ?? 0}개)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(rulesData?.customRules?.length ?? 0) === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <ShieldCheck size={36} className="mx-auto mb-2 text-green-400" />
                    <p className="text-sm">등록된 차단 규칙이 없습니다.</p>
                    <p className="text-xs mt-1">위 폼에서 차단 키워드를 추가해 보세요.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rulesData?.customRules?.map((rule) => (
                      <div
                        key={rule.id}
                        className="p-3 bg-orange-50 rounded-lg border border-orange-100"
                      >
                        {editingRuleId === rule.id ? (
                          /* 수정 모드 */
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
                                onClick={cancelEdit}
                              >
                                <X size={12} className="mr-1" />
                                취소
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* 보기 모드 */
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <ShieldAlert size={14} className="text-orange-500 shrink-0" />
                                <span className="font-medium text-sm">{rule.ruleName}</span>
                                {isMaster && (
                                  <Badge
                                    variant={rule.tenantId === null ? "secondary" : "outline"}
                                    className="text-xs"
                                  >
                                    {rule.tenantId === null ? (
                                      <><Globe size={10} className="mr-1" />전역</>
                                    ) : (
                                      <><Building2 size={10} className="mr-1" />{getTenantName(rule.tenantId)}</>
                                    )}
                                  </Badge>
                                )}
                              </div>
                              {rule.description && (
                                <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
                              )}
                              <p className="text-xs text-orange-600 mt-0.5 truncate">
                                {rule.keywords}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                등록: {new Date(rule.createdAt).toLocaleDateString("ko-KR")}
                                {rule.createdBy && ` · ${rule.createdBy}`}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-500 hover:text-blue-700 h-7 w-7 p-0"
                                onClick={() => startEdit(rule)}
                                title="수정"
                              >
                                <Pencil size={13} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                                onClick={() => deleteRuleMutation.mutate({ id: rule.id })}
                                title="삭제"
                              >
                                <Trash2 size={13} />
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

        {/* ── 업체별 현황 탭 (마스터 전용) ── */}
        {isMaster && (
          <TabsContent value="tenants">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">업체별 차단 규칙 현황</CardTitle>
              </CardHeader>
              <CardContent>
                {!tenantSummary?.tenantList?.length ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    등록된 업체가 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {/* 전역 규칙 행 */}
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="flex items-center gap-2">
                        <Globe size={16} className="text-blue-500" />
                        <div>
                          <p className="font-medium text-sm">전역 규칙</p>
                          <p className="text-xs text-gray-500">모든 업체에 공통 적용</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {tenantSummary.globalRuleCount}개
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setSelectedTenantId(null);
                            document.querySelector('[data-value="rules"]')?.dispatchEvent(
                              new MouseEvent("click", { bubbles: true })
                            );
                          }}
                        >
                          보기
                        </Button>
                      </div>
                    </div>
                    {/* 업체별 행 */}
                    {tenantSummary.tenantList.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className="text-gray-500" />
                          <div>
                            <p className="font-medium text-sm">{t.companyName}</p>
                            <p className="text-xs text-gray-400">{t.slug}</p>
                          </div>
                          {!t.isActive && (
                            <Badge variant="secondary" className="text-xs">비활성</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={t.ruleCount > 0 ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {t.ruleCount}개
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setSelectedTenantId(t.id)}
                          >
                            규칙 보기
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── 차단 이력 탭 ── */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">차단 이력 (최근 100건)</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <p className="text-sm text-gray-400">로딩 중...</p>
              ) : (logsData?.logs?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <ShieldCheck size={40} className="mx-auto mb-2 text-green-400" />
                  <p>차단 이력이 없습니다.</p>
                  <p className="text-xs mt-1">AI가 정상적으로 운영 중입니다.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logsData?.logs?.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-lg"
                    >
                      <ShieldAlert className="text-red-500 mt-0.5 shrink-0" size={16} />
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
                          {isMaster && log.tenantId != null && (
                            <Badge variant="outline" className="text-xs">
                              <Building2 size={10} className="mr-1" />
                              {getTenantName(log.tenantId)}
                            </Badge>
                          )}
                        </div>
                        {log.sourceDeskHint && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            출처: {log.sourceDeskHint}
                          </p>
                        )}
                        {log.blockReason && (
                          <p className="text-xs text-red-600 mt-0.5 truncate">
                            {log.blockReason}
                          </p>
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

        {/* ── 키워드 검사 탭 (마스터 전용) ── */}
        {isMaster && (
          <TabsContent value="check">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">차단 키워드 직접 검사</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-500">
                  텍스트를 입력하면 현재 등록된 차단 규칙에 걸리는지 즉시 확인합니다.
                </p>
                <div className="space-y-2">
                  <Label>검사할 텍스트 (제목/이름)</Label>
                  <Input
                    placeholder="예: 특정 키워드가 포함된 요청 제목"
                    value={checkName}
                    onChange={(e) => setCheckName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>내용 (선택)</Label>
                  <Textarea
                    placeholder="내용을 입력하면 더 정확하게 검사합니다..."
                    value={checkContent}
                    onChange={(e) => setCheckContent(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button
                  onClick={handleCheck}
                  disabled={!checkName.trim() || checkMutation.isPending}
                  className="w-full"
                >
                  <Search size={14} className="mr-2" />
                  {checkMutation.isPending ? "검사 중..." : "차단 여부 검사"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── 통계 탭 (마스터 전용) ── */}
        {isMaster && (
          <TabsContent value="stats">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">차단 출처별 통계</CardTitle>
              </CardHeader>
              <CardContent>
                {!statsData?.bySource?.length ? (
                  <p className="text-sm text-gray-400 text-center py-4">차단 이력이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {statsData.bySource.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <span className="text-sm text-gray-700">{item.name}</span>
                        <Badge variant="destructive">{item.count}회</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
