/**
 * AI 개발 파이프라인 대시보드 [STEP1 §5.2 / STEP3]
 * ------------------------------------------------------------------
 * 마스터 전용 'AI 변경 이력 및 정합성 검증 대시보드'.
 *  - 좌측: ai_dev_requests 목록(DB 고속) + 상태 필터
 *  - 우측: 선택 요청 상세(변경 파일 메타 + 커밋 목록)
 *  - '소스 보기' 클릭 시에만 Git API 로 Diff 온디맨드 로드
 *  - main 반영은 오직 마스터 수동 승인/반려 버튼
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  GitMerge,
  RefreshCw,
  FileCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  INIT: { label: "접수", cls: "bg-gray-100 text-gray-700" },
  CODE_GENERATED: { label: "코드 생성됨", cls: "bg-blue-100 text-blue-700" },
  INTEGRITY_PASSED: { label: "정합성 통과", cls: "bg-teal-100 text-teal-700" },
  INTEGRITY_FAILED: { label: "정합성 실패", cls: "bg-red-100 text-red-700" },
  INTEGRATED: { label: "통합 완료", cls: "bg-indigo-100 text-indigo-700" },
  MASTER_APPROVED: { label: "마스터 승인", cls: "bg-green-100 text-green-700" },
  MASTER_REJECTED: { label: "마스터 반려", cls: "bg-orange-100 text-orange-700" },
};

export default function AIDevPipeline() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [openDiffSha, setOpenDiffSha] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const stats = trpc.aiDevPipeline.getStats.useQuery();
  const list = trpc.aiDevPipeline.listRequests.useQuery({
    status: statusFilter as any,
    limit: 50,
    offset: 0,
  });
  const detail = trpc.aiDevPipeline.getRequestDetail.useQuery(
    { requestId: selectedId ?? 0 },
    { enabled: selectedId !== null },
  );
  const diff = trpc.aiDevPipeline.getCommitDiff.useQuery(
    { commitSha: openDiffSha ?? "" },
    { enabled: !!openDiffSha },
  );

  const refresh = () => {
    utils.aiDevPipeline.listRequests.invalidate();
    utils.aiDevPipeline.getStats.invalidate();
    if (selectedId !== null) utils.aiDevPipeline.getRequestDetail.invalidate();
  };

  const integrate = trpc.aiDevPipeline.integrateRequest.useMutation({
    onSuccess: (r) => {
      if (r.conflict) toast.error(`병합 충돌 — ${r.message}`);
      else toast.success(`통합 완료 (${r.message})`);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const approve = trpc.aiDevPipeline.masterApprove.useMutation({
    onSuccess: () => { toast.success("마스터 승인 완료 (main 병합은 GitHub에서 수동 진행)"); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const reject = trpc.aiDevPipeline.masterReject.useMutation({
    onSuccess: () => { toast.success("반려 처리됨"); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const statusList = ["INIT", "CODE_GENERATED", "INTEGRITY_PASSED", "INTEGRITY_FAILED", "INTEGRATED", "MASTER_APPROVED", "MASTER_REJECTED"];

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <GitBranch size={20} /> AI 변경 이력 · 정합성 검증
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            서버 내장 Git 엔진 기반 dev-1 → dev-2-integration → main 파이프라인. main 반영은 마스터 수동 승인 전용입니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.data && (
            <Badge variant="outline" className={stats.data.gitEngineEnabled ? "border-green-400 text-green-700" : "border-red-300 text-red-600"}>
              <ShieldCheck size={12} className="mr-1" />
              Git 엔진 {stats.data.gitEngineEnabled ? "활성" : "비활성"}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={refresh}>
            <RefreshCw size={14} className="mr-1" /> 새로고침
          </Button>
        </div>
      </div>

      {/* 상태 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {statusList.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? undefined : s)}
            className={`rounded-lg border p-3 text-left transition ${statusFilter === s ? "ring-2 ring-primary" : "hover:bg-accent"}`}
          >
            <div className="text-xs text-muted-foreground">{STATUS_META[s]?.label ?? s}</div>
            <div className="text-2xl font-bold">{stats.data?.byStatus?.[s] ?? 0}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 좌측 목록 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              변경 요청 목록
              {statusFilter && (
                <Button size="sm" variant="ghost" onClick={() => setStatusFilter(undefined)}>필터 해제</Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {list.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={14} /> 불러오는 중...</div>}
            {list.data?.items.length === 0 && <div className="text-sm text-muted-foreground py-8 text-center">요청이 없습니다.</div>}
            {list.data?.items.map((r) => (
              <button
                key={r.id}
                onClick={() => { setSelectedId(r.id); setOpenDiffSha(null); }}
                className={`w-full text-left rounded-lg border p-3 transition ${selectedId === r.id ? "ring-2 ring-primary" : "hover:bg-accent"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-muted-foreground">#{r.id}</span>
                  <Badge className={STATUS_META[r.status]?.cls}>{STATUS_META[r.status]?.label ?? r.status}</Badge>
                </div>
                <div className="text-sm mt-1 line-clamp-2">{r.commitMessage ?? "(메시지 없음)"}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{r.agentId}</span>
                  <span>·</span>
                  <span>{r.sourceBranch} → {r.targetBranch}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* 우측 상세 */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">요청 상세</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedId === null && <div className="text-sm text-muted-foreground py-12 text-center">좌측에서 요청을 선택하세요.</div>}
            {selectedId !== null && detail.isLoading && <div className="flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={14} /> 로딩...</div>}
            {detail.data && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-semibold">#{detail.data.request.id} · {detail.data.request.agentId}</div>
                    <div className="text-sm text-muted-foreground">{detail.data.request.commitMessage ?? "(메시지 없음)"}</div>
                  </div>
                  <Badge className={STATUS_META[detail.data.request.status]?.cls}>
                    {STATUS_META[detail.data.request.status]?.label ?? detail.data.request.status}
                  </Badge>
                </div>

                {detail.data.request.errorMessage && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>{detail.data.request.errorMessage}</span>
                  </div>
                )}

                {/* 변경 파일 메타 */}
                <div>
                  <div className="text-sm font-medium mb-2 flex items-center gap-1"><FileCode size={14} /> 변경 파일 ({detail.data.files.length})</div>
                  <div className="space-y-1">
                    {detail.data.files.map((f) => (
                      <div key={f.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                        <span className="font-mono truncate">{f.filePath}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px]">{f.changeType}</Badge>
                          <span className="text-green-600">+{f.additions}</span>
                          <span className="text-red-600">-{f.deletions}</span>
                        </span>
                      </div>
                    ))}
                    {detail.data.files.length === 0 && <div className="text-xs text-muted-foreground">파일 메타 없음</div>}
                  </div>
                </div>

                {/* 커밋 목록 + Diff 온디맨드 */}
                <div>
                  <div className="text-sm font-medium mb-2 flex items-center gap-1"><GitMerge size={14} /> 커밋 ({detail.data.commits.length})</div>
                  <div className="space-y-2">
                    {detail.data.commits.map((c) => (
                      <div key={c.commitSha} className="border rounded p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs">{c.commitSha.slice(0, 10)} · {c.branch}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setOpenDiffSha(openDiffSha === c.commitSha ? null : c.commitSha)}
                          >
                            {openDiffSha === c.commitSha ? "닫기" : "소스 보기"}
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{c.commitMessage}</div>
                        {openDiffSha === c.commitSha && (
                          <div className="mt-2">
                            {diff.isLoading && <div className="text-xs flex items-center gap-1"><Loader2 className="animate-spin" size={12} /> Diff 로딩...</div>}
                            {diff.error && <div className="text-xs text-red-600">{diff.error.message}</div>}
                            {diff.data && diff.data.files.map((df) => (
                              <div key={df.filename} className="mt-2">
                                <div className="text-xs font-mono font-semibold">{df.filename} <span className="text-green-600">+{df.additions}</span> <span className="text-red-600">-{df.deletions}</span></div>
                                {df.patch && (
                                  <pre className="text-[11px] bg-gray-900 text-gray-100 rounded p-2 overflow-x-auto mt-1 max-h-64">{df.patch}</pre>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {detail.data.commits.length === 0 && <div className="text-xs text-muted-foreground">커밋 없음</div>}
                  </div>
                </div>

                {/* 마스터 액션 */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={integrate.isPending || !["CODE_GENERATED", "INTEGRITY_PASSED"].includes(detail.data.request.status)}
                    onClick={() => integrate.mutate({ requestId: detail.data!.request.id })}
                  >
                    <GitMerge size={14} className="mr-1" /> dev-2 통합
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={approve.isPending || !["INTEGRATED", "INTEGRITY_PASSED"].includes(detail.data.request.status)}
                    onClick={() => approve.mutate({ requestId: detail.data!.request.id })}
                  >
                    <CheckCircle2 size={14} className="mr-1" /> 마스터 승인
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={reject.isPending}
                    onClick={() => {
                      const reason = window.prompt("반려 사유를 입력하세요");
                      if (reason) reject.mutate({ requestId: detail.data!.request.id, reason });
                    }}
                  >
                    <XCircle size={14} className="mr-1" /> 반려
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
