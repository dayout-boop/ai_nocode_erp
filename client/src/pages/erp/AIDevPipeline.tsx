/**
 * AI 개발 파이프라인 대시보드 [STEP1 §5.2 / STEP3 / STEP4]
 * ------------------------------------------------------------------
 * 마스터 전용 'AI 변경 이력 및 정합성 검증 대시보드'.
 *  - 좌측: ai_dev_requests 목록(DB 고속) + 상태 필터
 *  - 우측: 선택 요청 상세(변경 파일 메타 + 커밋 + 4종 정합성 + 레드팀)
 *  - '소스 보기' 클릭 시에만 Git API 로 Diff 온디맨드 로드 (색상 patch 렌더)
 *  - 4종 정합성 오딧 / 레드팀 교차검증 마스터 수동 재실행
 *  - main 반영은 오직 마스터 수동 승인/반려 버튼 (AI 결정권 박탈)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  ShieldAlert,
  Bug,
  Unplug,
  ServerCog,
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

/** GitHub unified patch 문자열을 색상 라인으로 렌더링 */
function PatchView({ patch }: { patch: string }) {
  const lines = patch.split("\n");
  return (
    <pre className="text-[11px] rounded p-2 overflow-x-auto mt-1 max-h-72 bg-gray-950 leading-relaxed">
      {lines.map((ln, i) => {
        let cls = "text-gray-300";
        if (ln.startsWith("+") && !ln.startsWith("+++")) cls = "text-green-400 bg-green-500/10 block";
        else if (ln.startsWith("-") && !ln.startsWith("---")) cls = "text-red-400 bg-red-500/10 block";
        else if (ln.startsWith("@@")) cls = "text-cyan-400 block";
        else if (ln.startsWith("diff") || ln.startsWith("index") || ln.startsWith("+++") || ln.startsWith("---"))
          cls = "text-gray-500 block";
        return (
          <span key={i} className={`${cls} font-mono whitespace-pre-wrap`}>
            {ln || " "}
          </span>
        );
      })}
    </pre>
  );
}

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
  const neutral = trpc.aiDevPipeline.neutralStatus.useQuery();

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
  const runAudit = trpc.aiDevPipeline.runAudit.useMutation({
    onSuccess: (r) => {
      toast[r.isPerfect ? "success" : "error"](
        r.isPerfect ? "4종 정합성 통과 (마스터 승인 대기)" : `정합성 실패 — ${r.reason}`,
      );
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const runRedteam = trpc.aiDevPipeline.runRedteam.useMutation({
    onSuccess: () => { toast.success("레드팀 교차검증 완료"); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const statusList = ["INIT", "CODE_GENERATED", "INTEGRITY_PASSED", "INTEGRITY_FAILED", "INTEGRATED", "MASTER_APPROVED", "MASTER_REJECTED"];

  // auditSummary 를 4종 라인 / 레드팀 섹션으로 분리 표출
  const auditSummary = detail.data?.request.auditSummary ?? "";
  const redteamSplit = auditSummary.split("—— 레드팀 교차검증 ——");
  const auditLines = (redteamSplit[0] ?? "").trim().split("\n").filter(Boolean);
  const redteamText = redteamSplit[1]?.trim();

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

      {/* STEP5 — 탈마누스 자립전환 상태 패널 */}
      {neutral.data && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <Unplug size={18} /> 탈마누스 자립전환 상태
              </span>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    neutral.data.status.currentMode === "MANUS_GATEWAY"
                      ? "border-blue-300 text-blue-700"
                      : "border-green-400 text-green-700"
                  }
                >
                  <ServerCog size={12} className="mr-1" />
                  {neutral.data.status.currentMode === "MANUS_GATEWAY"
                    ? "마누스 게이트웨이"
                    : neutral.data.status.currentMode === "NEUTRAL_ANTHROPIC"
                      ? "자립(Anthropic 직결)"
                      : "자립(Gemini 직결)"}
                </Badge>
                <Badge className="bg-slate-800 text-white">{neutral.data.status.phaseLabel}</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>자립 준비도 (Phase 4 도달 기준)</span>
                <span>{neutral.data.status.readinessScore}%</span>
              </div>
              <Progress
                value={neutral.data.status.readinessScore}
                className={`h-2 ${neutral.data.status.readinessScore === 100 ? "[&>div]:bg-green-500" : neutral.data.status.readinessScore >= 50 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-slate-400"}`}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {neutral.data.status.readiness.map((r) => (
                <div
                  key={r.key}
                  className={`rounded-lg border p-2.5 text-xs ${r.ready ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}
                  title={r.hint}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    {r.ready ? (
                      <CheckCircle2 size={13} className="text-green-600" />
                    ) : (
                      <XCircle size={13} className="text-gray-400" />
                    )}
                    {r.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{r.hint}</div>
                </div>
              ))}
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                의존도 감소 로드맵 (Phase 1 → 4)
              </summary>
              <div className="mt-2 space-y-1.5">
                {neutral.data.roadmap.map((p) => (
                  <div
                    key={p.phase}
                    className={`rounded border p-2 ${p.phase === neutral.data!.status.phase ? "border-slate-800 bg-slate-50" : "border-gray-100"}`}
                  >
                    <div className="font-medium">
                      Phase {p.phase} — {p.title}{" "}
                      <span className="text-muted-foreground font-normal">({p.period})</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">마누스: {p.manusRole}</div>
                    <div className="text-[10px] text-muted-foreground">자립: {p.selfRange}</div>
                  </div>
                ))}
              </div>
            </details>
          </CardContent>
        </Card>
      )}

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
                    <span className="whitespace-pre-wrap">{detail.data.request.errorMessage}</span>
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

                {/* 4종 정합성 셀프오딧 패널 */}
                <div className="rounded-lg border p-3 bg-slate-50">
                  <div className="text-sm font-medium mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1"><ShieldCheck size={14} /> 4종 정합성 셀프오딧</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={runAudit.isPending}
                      onClick={() => runAudit.mutate({ requestId: detail.data!.request.id })}
                    >
                      {runAudit.isPending ? <Loader2 className="animate-spin mr-1" size={12} /> : <RefreshCw size={12} className="mr-1" />}
                      오딧 재실행
                    </Button>
                  </div>
                  {auditLines.length > 0 ? (
                    <div className="space-y-1">
                      {auditLines.map((ln, i) => (
                        <div key={i} className="text-xs font-mono whitespace-pre-wrap">{ln}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">아직 오딧 기록이 없습니다. '오딧 재실행'을 눌러 4종 정합성 스캔(외부 비용 0원)을 수행하세요.</div>
                  )}
                </div>

                {/* 레드팀 교차검증 패널 */}
                <div className="rounded-lg border p-3 bg-amber-50/60">
                  <div className="text-sm font-medium mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1"><Bug size={14} /> 레드팀 교차검증</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={runRedteam.isPending}
                      onClick={() => runRedteam.mutate({ requestId: detail.data!.request.id })}
                    >
                      {runRedteam.isPending ? <Loader2 className="animate-spin mr-1" size={12} /> : <ShieldAlert size={12} className="mr-1" />}
                      레드팀 실행
                    </Button>
                  </div>
                  {redteamText ? (
                    <div className={`text-xs whitespace-pre-wrap ${redteamText.includes("🔴") ? "text-red-700 font-medium" : "text-muted-foreground"}`}>
                      {redteamText}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">레드팀 비판 보고 없음. 필요 시 '레드팀 실행'으로 격리 모델 교차검증을 수행하세요(키 미설정 시 비활성).</div>
                  )}
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
                                {df.patch && <PatchView patch={df.patch} />}
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
