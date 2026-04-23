/**
 * 두골프-AI개발 엔진 ERP 관리 페이지
 * ─────────────────────────────────────────────────────────────────────────────
 * 기능:
 * 1. 오류 감지 대시보드 (실시간 오류 로그 모니터링)
 * 2. AI 수정 요청 관리 (생성, 검토, 승인/거부)
 * 3. 다단계 재검토 파이프라인 실행
 * 4. ERP 기능 검색 (AI 기반)
 * 5. 핵심 기능 수정 시 사용자 1차 피드백 요구
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Bug, CheckCircle, Clock, Code, Search, Shield, Wrench, XCircle, Zap, RefreshCw, Eye, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";

// ─── 상태 배지 색상 매핑 ──────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  new: "bg-red-100 text-red-700",
  analyzing: "bg-yellow-100 text-yellow-700",
  fixed: "bg-green-100 text-green-700",
  ignored: "bg-gray-100 text-gray-500",
  pending: "bg-orange-100 text-orange-700",
  in_review: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  applied: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-white",
  low: "bg-gray-400 text-white",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "긴급", high: "높음", medium: "보통", low: "낮음",
};

// ─── 대시보드 통계 카드 ───────────────────────────────────────────────────────
function DashboardStats() {
  const { data, isLoading, refetch } = trpc.aiDevEngine.getDashboardStats.useQuery();

  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    {[...Array(4)].map((_, i) => (
      <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20 bg-gray-100 rounded" /></Card>
    ))}
  </div>;

  const stats = [
    { label: "신규 오류", value: data?.newErrors ?? 0, icon: Bug, color: "text-red-500", bg: "bg-red-50" },
    { label: "대기 수정", value: data?.pendingFixes ?? 0, icon: Clock, color: "text-orange-500", bg: "bg-orange-50" },
    { label: "승인 완료", value: data?.approvedFixes ?? 0, icon: CheckCircle, color: "text-green-500", bg: "bg-green-50" },
    { label: "전체 로그", value: data?.totalLogs ?? 0, icon: Zap, color: "text-blue-500", bg: "bg-blue-50" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map((s) => (
        <Card key={s.label} className={`${s.bg} border-0`}>
          <CardContent className="p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div>
              <p className="text-2xl font-bold text-gray-800">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="ghost" size="sm" onClick={() => refetch()} className="col-span-2 md:col-span-4 w-fit ml-auto">
        <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
      </Button>
    </div>
  );
}

// ─── 오류 로그 탭 ─────────────────────────────────────────────────────────────
function ErrorLogsTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data, isLoading, refetch } = trpc.aiDevEngine.getLogs.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter as any,
    limit: 20,
  });
  const updateStatus = trpc.aiDevEngine.updateLogStatus.useMutation({ onSuccess: () => refetch() });
  

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="상태 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="new">신규</SelectItem>
            <SelectItem value="analyzing">분석중</SelectItem>
            <SelectItem value="fixed">수정완료</SelectItem>
            <SelectItem value="ignored">무시</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-500">총 {data?.total ?? 0}건</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
        ))}</div>
      ) : data?.logs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-300" />
          <p>감지된 오류가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.logs.map((log) => (
            <Card key={log.id} className="border border-gray-200 hover:border-gray-300 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={STATUS_COLORS[log.status] ?? "bg-gray-100 text-gray-600"}>
                        {log.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{log.errorType}</Badge>
                      <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="font-medium text-sm text-gray-800 truncate">{log.source}</p>
                    <p className="text-xs text-gray-500 truncate">{log.errorMessage}</p>
                    {log.aiAnalysis && (
                      <p className="text-xs text-blue-600 mt-1 line-clamp-2">🤖 {log.aiAnalysis}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {log.status === "new" && (
                      <Button size="sm" variant="outline" className="text-xs h-7"
                        onClick={() => updateStatus.mutate({ logId: log.id, status: "ignored" })}>
                        무시
                      </Button>
                    )}
                    {log.status !== "fixed" && (
                      <Button size="sm" variant="outline" className="text-xs h-7 text-green-600"
                        onClick={() => {
                          updateStatus.mutate({ logId: log.id, status: "fixed" });
                          toast("수정 완료로 변경됨");
                        }}>
                        완료
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 수정 요청 상세 다이얼로그 ────────────────────────────────────────────────
function FixRequestDetailDialog({ requestId, onClose }: { requestId: number; onClose: () => void }) {
  const { data, isLoading, refetch } = trpc.aiDevEngine.getFixRequest.useQuery({ id: requestId });
  const generateFix = trpc.aiDevEngine.generateFix.useMutation({ onSuccess: () => refetch() });
  const runReview = trpc.aiDevEngine.runReview.useMutation({ onSuccess: () => refetch() });
  const approveRequest = trpc.aiDevEngine.approveFixRequest.useMutation({ onSuccess: () => { refetch(); onClose(); } });
  const [feedback, setFeedback] = useState("");
  

  if (isLoading || !data) return null;
  const { request, reviews } = data;

  const isCritical = request.isCritical;
  const canApprove = ["in_review", "pending"].includes(request.status);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCritical && <Shield className="w-5 h-5 text-red-500" />}
            {request.title}
          </DialogTitle>
        </DialogHeader>

        {/* 핵심 기능 경고 */}
        {isCritical && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">핵심 기능 수정 요청</p>
              <p className="text-xs text-red-600">결제, 인증, 예약 등 핵심 기능에 영향을 미칩니다. 반드시 검토 후 승인하세요.</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">상태:</span> <Badge className={STATUS_COLORS[request.status]}>{request.status}</Badge></div>
            <div><span className="text-gray-500">우선순위:</span> <Badge className={PRIORITY_COLORS[request.priority]}>{PRIORITY_LABELS[request.priority]}</Badge></div>
            <div><span className="text-gray-500">대상 파일:</span> <code className="text-xs bg-gray-100 px-1 rounded">{request.targetFile ?? "미지정"}</code></div>
            <div><span className="text-gray-500">출처:</span> {request.requestSource === "auto" ? "🤖 자동 감지" : "✍️ 수동 입력"}</div>
          </div>

          {/* 설명 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">문제 설명</p>
            <div className="bg-gray-50 rounded p-3 text-sm text-gray-600 whitespace-pre-wrap">{request.description}</div>
          </div>

          {/* AI 수정 코드 */}
          {request.aiFixCode ? (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Code className="w-4 h-4" /> AI 수정 제안
              </p>
              <div className="bg-gray-900 text-gray-100 rounded p-3 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                {request.aiFixCode}
              </div>
            </div>
          ) : (
            <Button onClick={() => generateFix.mutate({ fixRequestId: requestId })}
              disabled={generateFix.isPending} className="w-full" variant="outline">
              {generateFix.isPending ? "AI 수정 제안 생성 중..." : "🤖 AI 수정 제안 생성"}
            </Button>
          )}

          {/* 검토 결과 */}
          {reviews.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">검토 결과</p>
              <div className="space-y-2">
                {reviews.map((r) => (
                  <div key={r.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded text-xs">
                    {r.result === "pass" ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> :
                     r.result === "fail" ? <XCircle className="w-4 h-4 text-red-500 shrink-0" /> :
                     <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />}
                    <div>
                      <span className="font-medium capitalize">{r.reviewStage}</span>: {r.details}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 재검토 실행 */}
          {request.aiFixCode && reviews.length === 0 && (
            <Button onClick={() => runReview.mutate({ fixRequestId: requestId })}
              disabled={runReview.isPending} variant="outline" className="w-full">
              {runReview.isPending ? "다단계 재검토 실행 중..." : "🔍 다단계 재검토 실행 (syntax → logic → security → test → final)"}
            </Button>
          )}

          {/* 사용자 피드백 (핵심 기능 수정 시 필수) */}
          {canApprove && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                {isCritical ? "⚠️ 승인 전 피드백 필수 입력" : "피드백 (선택)"}
              </p>
              <Textarea
                placeholder={isCritical ? "핵심 기능 수정입니다. 검토 의견을 반드시 입력해주세요." : "승인/거부 사유를 입력하세요 (선택)"}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                className={isCritical ? "border-red-300 focus:border-red-500" : ""}
              />
            </div>
          )}
        </div>

        {canApprove && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              if (isCritical && !feedback.trim()) {
                toast.error("핵심 기능 수정은 피드백을 입력해야 합니다.");
                return;
              }
              approveRequest.mutate({ fixRequestId: requestId, approved: false, feedback });
            }} className="text-red-600 border-red-200">
              <ThumbsDown className="w-4 h-4 mr-1" /> 거부
            </Button>
            <Button onClick={() => {
              if (isCritical && !feedback.trim()) {
                toast.error("핵심 기능 수정은 피드백을 입력해야 합니다.");
                return;
              }
              approveRequest.mutate({ fixRequestId: requestId, approved: true, feedback });
            }} className="bg-green-600 hover:bg-green-700">
              <ThumbsUp className="w-4 h-4 mr-1" /> 승인
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── 수정 요청 탭 ─────────────────────────────────────────────────────────────
function FixRequestsTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", targetFile: "", priority: "medium" as const });
  

  const { data, isLoading, refetch } = trpc.aiDevEngine.getFixRequests.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter as any,
    priority: priorityFilter === "all" ? undefined : priorityFilter as any,
    limit: 20,
  });

  const createRequest = trpc.aiDevEngine.createFixRequest.useMutation({
    onSuccess: (result) => {
      if (result.isCritical) {
        toast.error("⚠️ 핵심 기능 수정 요청 생성됨", { description: "핵심 기능에 영향을 미치는 수정입니다. 신중히 검토하세요." });
      } else {
        toast.success("수정 요청 생성됨", { description: "AI 수정 제안을 생성할 수 있습니다." });
      }
      setShowCreate(false);
      setForm({ title: "", description: "", targetFile: "", priority: "medium" });
      refetch();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="pending">대기</SelectItem>
            <SelectItem value="in_review">검토중</SelectItem>
            <SelectItem value="approved">승인</SelectItem>
            <SelectItem value="rejected">거부</SelectItem>
            <SelectItem value="applied">적용</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="우선순위" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 우선순위</SelectItem>
            <SelectItem value="critical">긴급</SelectItem>
            <SelectItem value="high">높음</SelectItem>
            <SelectItem value="medium">보통</SelectItem>
            <SelectItem value="low">낮음</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-500">총 {data?.total ?? 0}건</span>
        <Button size="sm" onClick={() => setShowCreate(true)} className="ml-auto bg-dogolf-green hover:bg-dogolf-green-dark">
          + 수정 요청 생성
        </Button>
      </div>

      {/* 수정 요청 생성 폼 */}
      {showCreate && (
        <Card className="border-2 border-dogolf-green/30 bg-green-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">새 수정 요청</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="제목" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} />
            <Textarea placeholder="문제 설명 (상세히 작성할수록 AI 수정 제안이 정확해집니다)" value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={4} />
            <Input placeholder="대상 파일 경로 (예: server/stripe.ts)" value={form.targetFile}
              onChange={(e) => setForm(f => ({ ...f, targetFile: e.target.value }))} />
            <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">긴급</SelectItem>
                <SelectItem value="high">높음</SelectItem>
                <SelectItem value="medium">보통</SelectItem>
                <SelectItem value="low">낮음</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>취소</Button>
              <Button size="sm" onClick={() => createRequest.mutate({
                title: form.title, description: form.description,
                targetFile: form.targetFile || undefined, priority: form.priority,
              })} disabled={!form.title || !form.description || createRequest.isPending}>
                {createRequest.isPending ? "생성 중..." : "생성"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
        ))}</div>
      ) : data?.requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Wrench className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>수정 요청이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.requests.map((req) => (
            <Card key={req.id} className="border border-gray-200 hover:border-dogolf-green/50 transition-colors cursor-pointer"
              onClick={() => setSelectedId(req.id)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {req.isCritical && <Shield className="w-4 h-4 text-red-500 shrink-0" />}
                      <Badge className={PRIORITY_COLORS[req.priority]}>{PRIORITY_LABELS[req.priority]}</Badge>
                      <Badge className={STATUS_COLORS[req.status] ?? "bg-gray-100 text-gray-600"}>{req.status}</Badge>
                      <span className="text-xs text-gray-400">{req.requestSource === "auto" ? "🤖 자동" : "✍️ 수동"}</span>
                    </div>
                    <p className="font-medium text-sm text-gray-800 truncate">{req.title}</p>
                    {req.targetFile && <code className="text-xs text-gray-400">{req.targetFile}</code>}
                  </div>
                  <Button size="sm" variant="ghost" className="shrink-0">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedId && <FixRequestDetailDialog requestId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

// ─── ERP 기능 검색 탭 ─────────────────────────────────────────────────────────
function SearchTab() {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { data, isLoading } = trpc.aiDevEngine.searchFeature.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="ERP 기능 검색 (예: 결제, 예약, 카카오, AI...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSearchQuery(query)}
          className="flex-1"
        />
        <Button onClick={() => setSearchQuery(query)} disabled={!query || isLoading}>
          <Search className="w-4 h-4 mr-1" /> 검색
        </Button>
      </div>

      {isLoading && <div className="text-center py-8 text-gray-400">AI가 검색 중...</div>}

      {data && (
        <div className="space-y-4">
          {/* AI 요약 */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-blue-700 mb-1">🤖 AI 안내</p>
              <p className="text-sm text-blue-600">{data.aiSummary}</p>
            </CardContent>
          </Card>

          {/* 기능 목록 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.features.map((f) => (
              <Card key={f.name} className="border border-gray-200 hover:border-dogolf-green/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{f.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{f.description}</p>
                      <code className="text-xs text-gray-400 mt-1 block">{f.file}</code>
                    </div>
                    {f.route && (
                      <a href={f.route} className="text-xs text-dogolf-green hover:underline shrink-0">이동 →</a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!data && !isLoading && (
        <div className="text-center py-12 text-gray-400">
          <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>검색어를 입력하여 ERP 기능을 찾아보세요.</p>
          <p className="text-xs mt-1">예: 결제, 예약, 카카오 알림톡, Runway ML, n8n 자동화</p>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function AIDevEngine() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-dogolf-green to-dogolf-purple rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">두골프-AI개발 엔진</h1>
            <p className="text-sm text-gray-500">자동 오류 감지 → AI 수정 제안 → 다단계 재검토 → 사용자 승인</p>
          </div>
        </div>

        {/* 파이프라인 흐름 표시 */}
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-3 flex-wrap">
          <span className="flex items-center gap-1 bg-red-100 text-red-600 px-2 py-1 rounded">
            <Bug className="w-3 h-3" /> 오류 감지
          </span>
          <span>→</span>
          <span className="flex items-center gap-1 bg-yellow-100 text-yellow-600 px-2 py-1 rounded">
            <Zap className="w-3 h-3" /> AI 분석
          </span>
          <span>→</span>
          <span className="flex items-center gap-1 bg-blue-100 text-blue-600 px-2 py-1 rounded">
            <Code className="w-3 h-3" /> 수정 제안
          </span>
          <span>→</span>
          <span className="flex items-center gap-1 bg-purple-100 text-purple-600 px-2 py-1 rounded">
            <Shield className="w-3 h-3" /> 5단계 검토
          </span>
          <span>→</span>
          <span className="flex items-center gap-1 bg-orange-100 text-orange-600 px-2 py-1 rounded">
            <AlertTriangle className="w-3 h-3" /> 사용자 승인
          </span>
          <span>→</span>
          <span className="flex items-center gap-1 bg-green-100 text-green-600 px-2 py-1 rounded">
            <CheckCircle className="w-3 h-3" /> 적용
          </span>
        </div>
      </div>

      {/* 통계 대시보드 */}
      <DashboardStats />

      {/* 탭 */}
      <Tabs defaultValue="logs">
        <TabsList className="mb-4">
          <TabsTrigger value="logs" className="flex items-center gap-1">
            <Bug className="w-4 h-4" /> 오류 로그
          </TabsTrigger>
          <TabsTrigger value="fixes" className="flex items-center gap-1">
            <Wrench className="w-4 h-4" /> 수정 요청
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-1">
            <Search className="w-4 h-4" /> 기능 검색
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs"><ErrorLogsTab /></TabsContent>
        <TabsContent value="fixes"><FixRequestsTab /></TabsContent>
        <TabsContent value="search"><SearchTab /></TabsContent>
      </Tabs>
    </div>
  );
}
