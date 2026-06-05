/**
 * 두골프 ERP - 타 데스크 지식 차단 관리 페이지
 *
 * AI가 타 데스크 지식을 감지하고 차단한 이력을 조회하고,
 * 수동 차단 규칙을 추가/관리하는 ERP 전용 페이지.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, ShieldAlert, ShieldCheck, Plus, Trash2, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function KnowledgeBlockLog() {
  const [checkName, setCheckName] = useState("");
  const [checkContent, setCheckContent] = useState("");
  const [newRuleName, setNewRuleName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const { data: logsData, refetch: refetchLogs, isLoading: logsLoading } =
    trpc.knowledgeBlock.getLogs.useQuery({ limit: 100 });

  const { data: statsData, refetch: refetchStats } =
    trpc.knowledgeBlock.getStats.useQuery();

  const { data: rulesData, refetch: refetchRules } =
    trpc.knowledgeBlock.getRules.useQuery();

  const checkMutation = trpc.knowledgeBlock.checkKnowledge.useMutation({
    onSuccess: (result) => {
      if (result.isBlocked) {
        toast.error(`차단 감지: "${result.knowledgeName}" — 타 데스크 지식으로 차단됨. 감지 키워드: ${result.matchedKeywords.join(", ")}`);
      } else {
        toast.success(`허용 지식: "${result.knowledgeName}" — 두골프 ERP 관련 지식으로 허용됨`);
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
    },
  });

  const deleteRuleMutation = trpc.knowledgeBlock.deleteRule.useMutation({
    onSuccess: () => {
      toast.success("차단 규칙 삭제 완료");
      refetchRules();
    },
  });

  const handleCheck = () => {
    if (!checkName.trim()) return;
    checkMutation.mutate({
      knowledgeName: checkName,
      knowledgeContent: checkContent,
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

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="text-red-500" size={24} />
            타 데스크 지식 차단 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            두골프 ERP 데스크에서 타 데스크 지식이 주입될 때 자동 감지하고 차단합니다.
            Manus 플랫폼과 독립적으로 ERP 서버 레벨에서 직접 관리합니다.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { refetchLogs(); refetchStats(); refetchRules(); }}
        >
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
                  {statsData?.total ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Shield className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">기본 차단 규칙</p>
                <p className="text-2xl font-bold text-blue-600">
                  {rulesData?.defaultRules?.length ?? 0}개
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
                <p className="text-sm text-gray-500">사용자 정의 규칙</p>
                <p className="text-2xl font-bold text-green-600">
                  {rulesData?.customRules?.length ?? 0}개
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">차단 이력</TabsTrigger>
          <TabsTrigger value="check">지식 검사</TabsTrigger>
          <TabsTrigger value="rules">차단 규칙 관리</TabsTrigger>
          <TabsTrigger value="stats">차단 통계</TabsTrigger>
        </TabsList>

        {/* 차단 이력 탭 */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">차단 이력 (최근 100건)</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <p className="text-sm text-gray-400">로딩 중...</p>
              ) : logsData?.logs?.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <ShieldCheck size={40} className="mx-auto mb-2 text-green-400" />
                  <p>차단된 지식이 없습니다.</p>
                  <p className="text-xs mt-1">두골프 ERP 데스크가 안전하게 운영 중입니다.</p>
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

        {/* 지식 검사 탭 */}
        <TabsContent value="check">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">지식 차단 여부 직접 검사</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                지식 이름이나 내용을 입력하면 두골프 ERP 데스크에서 차단 대상인지 즉시 확인합니다.
              </p>
              <div className="space-y-2">
                <Label>지식 이름</Label>
                <Input
                  placeholder="예: GitHub 연동 및 실시간 반영 최우선 처리 원칙"
                  value={checkName}
                  onChange={(e) => setCheckName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>지식 내용 (선택)</Label>
                <Textarea
                  placeholder="지식 내용을 입력하면 더 정확하게 검사합니다..."
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

        {/* 차단 규칙 관리 탭 */}
        <TabsContent value="rules">
          <div className="space-y-4">
            {/* 새 규칙 추가 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">사용자 정의 차단 규칙 추가</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>규칙 이름</Label>
                  <Input
                    placeholder="예: 새로운 타 데스크 원칙"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>차단 키워드 (쉼표로 구분)</Label>
                  <Input
                    placeholder="예: 키워드1, 키워드2, 키워드3"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                  />
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
                  규칙 추가
                </Button>
              </CardContent>
            </Card>

            {/* 기본 규칙 목록 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  기본 차단 규칙 ({rulesData?.defaultRules?.length ?? 0}개)
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

            {/* 사용자 정의 규칙 */}
            {(rulesData?.customRules?.length ?? 0) > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    사용자 정의 규칙 ({rulesData?.customRules?.length ?? 0}개)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {rulesData?.customRules?.map((rule) => (
                      <div key={rule.id} className="p-3 bg-orange-50 rounded-lg border border-orange-100 flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <ShieldAlert size={14} className="text-orange-500 shrink-0" />
                            <span className="font-medium text-sm">{rule.ruleName}</span>
                          </div>
                          {rule.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
                          )}
                          <p className="text-xs text-orange-600 mt-0.5 truncate">{rule.keywords}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 shrink-0"
                          onClick={() => deleteRuleMutation.mutate({ id: rule.id })}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* 통계 탭 */}
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
                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700">{item.name}</span>
                      <Badge variant="destructive">{item.count}회</Badge>
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
