/**
 * DeployButton — '최신버전 배포' 버튼 (마스터 전용)
 * ------------------------------------------------------------------
 * 동작 (사양 안전가드 준수):
 *  - deployStatus 로 자체 배포 활성 여부를 조회.
 *  - 비활성(기본): 클릭 시 안내 다이얼로그만 표시(현재 모드/반영 방법 안내). 실제 실행 없음.
 *  - 활성(SELF_DEPLOY_ENABLED=true): 확인 후 triggerDeploy(full) 실행, 결과/이력 표시.
 *  - main 자동 병합/운영 반영은 절대 트리거하지 않음(백엔드 deployRunner 가 차단).
 *  - 최근 배포 이력(deploy_logs)을 함께 표시.
 *  - 단계별 진행 표시: pull → build → restart 순서 스피너 표시.
 *  - 중복 클릭 방지: 실행 중 버튼 비활성화 + locked 응답 처리.
 *  - 결과 로그 펼치기: 배포 완료 후 출력 로그 토글 표시.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Rocket, Loader2, CheckCircle2, XCircle, Info,
  GitBranch, Hammer, RefreshCw, ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";

// 배포 단계 진행 표시 컴포넌트
function DeployPhaseProgress({ phase, isPending }: { phase: string; isPending: boolean }) {
  const steps = [
    { key: "pull", label: "Git Pull", icon: GitBranch },
    { key: "build", label: "빌드", icon: Hammer },
    { key: "restart", label: "재시작", icon: RefreshCw },
  ];

  if (!isPending) return null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
        <Loader2 size={12} className="animate-spin" />
        배포 진행 중 (full 모드: pull → build → restart)
      </p>
      <div className="flex items-center gap-2">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.key} className="flex items-center gap-1">
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <Loader2 size={11} className="animate-spin" />
                <Icon size={11} />
                <span>{step.label}</span>
              </div>
              {i < steps.length - 1 && <span className="text-blue-300 text-xs">→</span>}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-blue-500 mt-1.5">
        각 단계는 환경변수 설정 여부에 따라 실행됩니다. 최대 10분 소요될 수 있습니다.
      </p>
    </div>
  );
}

// 배포 결과 로그 펼치기 컴포넌트
function DeployResultLog({ result }: { result: any }) {
  const [expanded, setExpanded] = useState(false);
  if (!result) return null;

  const isLocked = result.locked === true;
  const isSuccess = result.ok && result.enabled;
  const isDisabled = !result.enabled;

  return (
    <div className={`rounded-lg border p-3 text-sm ${
      isLocked ? "border-amber-300 bg-amber-50" :
      isSuccess ? "border-emerald-300 bg-emerald-50" :
      isDisabled ? "border-slate-200 bg-slate-50" :
      "border-red-300 bg-red-50"
    }`}>
      <div className="flex items-start gap-2">
        {isLocked ? (
          <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
        ) : isSuccess ? (
          <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 shrink-0" />
        ) : isDisabled ? (
          <Info size={15} className="text-slate-500 mt-0.5 shrink-0" />
        ) : (
          <XCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${
            isLocked ? "text-amber-700" :
            isSuccess ? "text-emerald-700" :
            isDisabled ? "text-slate-600" :
            "text-red-700"
          }`}>
            {isLocked ? "배포 중복 실행 차단됨" :
             isSuccess ? `배포 완료 (${result.durationMs}ms)` :
             isDisabled ? "자체 배포 비활성 상태" :
             `배포 실패 (${result.durationMs}ms)`}
          </p>
          {result.outputSummary && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mt-1"
            >
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              출력 로그 {expanded ? "접기" : "펼치기"}
            </button>
          )}
          {expanded && result.outputSummary && (
            <pre className="mt-2 text-[11px] font-mono bg-white/70 border rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap text-slate-700">
              {result.outputSummary}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DeployButton() {
  const [open, setOpen] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const { data: status, isLoading: statusLoading } =
    trpc.aiDevPipeline.deployStatus.useQuery(undefined, {
      enabled: open,
    });

  const { data: logsData, refetch: refetchLogs } =
    trpc.aiDevPipeline.listDeployLogs.useQuery(
      { limit: 5 },
      { enabled: open },
    );

  const triggerDeploy = trpc.aiDevPipeline.triggerDeploy.useMutation({
    onSuccess: (res) => {
      setLastResult(res);
      if (res.locked) {
        toast.warning("배포가 이미 진행 중입니다. 완료 후 다시 시도하세요.");
      } else if (res.enabled && res.ok) {
        toast.success(`배포 완료 (${res.durationMs}ms)`);
      } else if (res.enabled && !res.ok) {
        toast.error("배포 실행 중 일부 단계가 실패했습니다. 로그를 확인하세요.");
      } else {
        toast.info("자체 배포 비활성 상태입니다. 서버 이전 활성화 탭을 확인하세요.");
      }
      refetchLogs();
    },
    onError: (e) => {
      toast.error(e.message);
      setLastResult(null);
    },
  });

  const enabled = status?.enabled === true;
  const logs = logsData?.items ?? [];
  const isPending = triggerDeploy.isPending;

  function handleDeploy() {
    setLastResult(null);
    triggerDeploy.mutate({ phase: "full" });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 border-dogolf-green text-dogolf-green hover:bg-dogolf-green hover:text-white"
      >
        <Rocket size={16} /> 최신버전 배포
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) setOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket size={18} className="text-dogolf-green" />
              최신버전 배포
            </DialogTitle>
            <DialogDescription>
              검증된 최신 버전을 외부서버에 반영합니다. 운영(main) 자동 병합은
              수행하지 않으며, 이미 반영된 소스를 pull·빌드·재시작하는 단계만 실행합니다.
            </DialogDescription>
          </DialogHeader>

          {/* 현재 모드 안내 */}
          <div className="rounded-lg border p-3 text-sm">
            {statusLoading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 size={14} className="animate-spin" /> 배포 상태 확인 중…
              </div>
            ) : (
              <div className="flex items-start gap-2">
                {enabled ? (
                  <CheckCircle2 size={16} className="text-green-600 mt-0.5" />
                ) : (
                  <Info size={16} className="text-amber-600 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold mb-0.5">
                    {enabled ? "자체 배포 활성" : "자체 배포 비활성"}
                    <Badge
                      variant="outline"
                      className={`ml-2 ${enabled ? "border-green-500 text-green-700" : "border-amber-500 text-amber-700"}`}
                    >
                      {enabled ? "SELF_DEPLOY ON" : "SELF_DEPLOY OFF"}
                    </Badge>
                  </div>
                  <p className="text-gray-600">{status?.hint}</p>
                  {!enabled && (
                    <p className="text-xs text-slate-400 mt-1">
                      ERP 설정 → 서버 이전 활성화 탭에서 체크리스트 및 환경변수 가이드를 확인하세요.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 배포 진행 중 단계 표시 */}
          <DeployPhaseProgress phase="full" isPending={isPending} />

          {/* 마지막 배포 결과 */}
          {lastResult && !isPending && <DeployResultLog result={lastResult} />}

          {/* 최근 배포 이력 */}
          {logs.length > 0 && !isPending && (
            <div className="rounded-lg border p-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">최근 배포 이력</p>
              <ul className="space-y-1.5 max-h-40 overflow-auto">
                {logs.map((log: any) => (
                  <li key={log.id} className="flex items-center gap-2 text-xs">
                    {log.success ? (
                      <CheckCircle2 size={13} className="text-green-600 shrink-0" />
                    ) : (
                      <XCircle size={13} className="text-red-500 shrink-0" />
                    )}
                    <span className="font-mono text-gray-700">{log.phase}</span>
                    <span className="text-gray-400">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString("ko-KR") : ""}
                    </span>
                    <span className="text-gray-400">· {log.durationMs ?? 0}ms</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              닫기
            </Button>
            <Button
              onClick={handleDeploy}
              disabled={isPending || statusLoading}
              className="bg-dogolf-green hover:bg-dogolf-green-dark text-white flex items-center gap-1.5"
            >
              {isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> 배포 실행 중…
                </>
              ) : (
                <>
                  <Rocket size={15} /> {enabled ? "지금 배포 실행" : "배포 시도(안내)"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
