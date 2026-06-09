/**
 * DeployButton — '최신버전 배포' 버튼 (마스터 전용)
 * ------------------------------------------------------------------
 * 동작 (사양 안전가드 준수):
 *  - deployStatus 로 자체 배포 활성 여부를 조회.
 *  - 비활성(기본): 클릭 시 안내 다이얼로그만 표시(현재 모드/반영 방법 안내). 실제 실행 없음.
 *  - 활성(SELF_DEPLOY_ENABLED=true): 확인 후 triggerDeploy(full) 실행, 결과/이력 표시.
 *  - main 자동 병합/운영 반영은 절대 트리거하지 않음(백엔드 deployRunner 가 차단).
 *  - 최근 배포 이력(deploy_logs)을 함께 표시.
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
import { Rocket, Loader2, CheckCircle2, XCircle, Info } from "lucide-react";

export default function DeployButton() {
  const [open, setOpen] = useState(false);

  const { data: status, isLoading: statusLoading } =
    trpc.aiDevPipeline.deployStatus.useQuery(undefined, {
      enabled: open, // 다이얼로그 열릴 때만 조회
    });

  const { data: logsData, refetch: refetchLogs } =
    trpc.aiDevPipeline.listDeployLogs.useQuery(
      { limit: 5 },
      { enabled: open },
    );

  const triggerDeploy = trpc.aiDevPipeline.triggerDeploy.useMutation({
    onSuccess: (res) => {
      if (res.enabled && res.ok) {
        toast.success("자체 배포(빌드·재시작) 완료");
      } else if (res.enabled && !res.ok) {
        toast.error("배포 실행 중 일부 단계가 실패했습니다. 이력을 확인하세요.");
      } else {
        toast.info("자체 배포 비활성 상태입니다. 안내를 확인하세요.");
      }
      refetchLogs();
    },
    onError: (e) => toast.error(e.message),
  });

  const enabled = status?.enabled === true;
  const logs = logsData?.items ?? [];

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket size={18} className="text-dogolf-green" />
              최신버전 배포
            </DialogTitle>
            <DialogDescription>
              검증된 최신 버전을 외부서버에 반영합니다. 운영(main) 자동 병합은
              수행하지 않으며, 이미 반영된 소스를 빌드·재시작하는 단계만 실행합니다.
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
                </div>
              </div>
            )}
          </div>

          {/* 최근 배포 이력 */}
          {logs.length > 0 && (
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
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                    </span>
                    <span className="text-gray-400">· {log.durationMs ?? 0}ms</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              닫기
            </Button>
            <Button
              onClick={() => triggerDeploy.mutate({ phase: "full" })}
              disabled={triggerDeploy.isPending || statusLoading}
              className="bg-dogolf-green hover:bg-dogolf-green-dark text-white flex items-center gap-1.5"
            >
              {triggerDeploy.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> 실행 중…
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
