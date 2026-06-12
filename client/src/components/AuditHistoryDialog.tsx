/**
 * AuditHistoryDialog
 * 예약/자금 각 건의 변경 이력(감사 로그)을 최신순으로 보여주는 재사용 다이얼로그.
 * - entityType + entityId로 trpc.reservations.auditByEntity 조회
 * - 정책: 두골프 ERP는 삭제 대신 상태(void) 전환 + 모든 변경을 불변 기록한다.
 */
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, History, ArrowRight } from "lucide-react";

export type AuditEntityType =
  | "reservation" | "income" | "remittance" | "deposit" | "charge" | "prepaid";

const ACTION_LABELS: Record<string, string> = {
  create: "등록",
  update: "수정",
  status_change: "상태 변경",
  manager_change: "담당자 변경",
  amount_change: "금액 변경",
  match_change: "매칭 변경",
  void: "삭제(상태전환)",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700 border-green-200",
  update: "bg-blue-100 text-blue-700 border-blue-200",
  status_change: "bg-amber-100 text-amber-700 border-amber-200",
  manager_change: "bg-purple-100 text-purple-700 border-purple-200",
  amount_change: "bg-orange-100 text-orange-700 border-orange-200",
  match_change: "bg-cyan-100 text-cyan-700 border-cyan-200",
  void: "bg-red-100 text-red-700 border-red-200",
};

const ACTOR_LABELS: Record<string, string> = {
  master: "마스터",
  partner_owner: "파트너 대표",
  partner_staff: "파트너 직원",
  system: "시스템",
};

function formatVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(없음)";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  if (typeof v === "number") return v.toLocaleString("ko-KR");
  const s = String(v);
  // ISO 날짜 추정 시 로컬 표기
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("ko-KR");
  }
  return s;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: AuditEntityType;
  entityId: number | null;
  entityNo?: string | null;
  title?: string;
}

export default function AuditHistoryDialog({
  open, onOpenChange, entityType, entityId, entityNo, title,
}: Props) {
  const { data, isLoading } = trpc.reservations.auditByEntity.useQuery(
    { entityType, entityId: entityId ?? 0 },
    { enabled: open && entityId != null }
  );

  const logs = data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" />
            변경 이력
            {entityNo && <span className="font-mono text-sm text-blue-600">{entityNo}</span>}
          </DialogTitle>
          <DialogDescription>
            {title ?? "이 건의 모든 변경 기록을 최신순으로 표시합니다. (등록/수정/상태·담당자·금액·매칭 변경/삭제)"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> 불러오는 중...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">
            아직 기록된 변경 이력이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log: any) => (
              <div key={log.id} className="border rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-700"}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </Badge>
                    {log.summary && <span className="text-sm text-gray-700">{log.summary}</span>}
                  </div>
                  <span className="text-xs text-gray-400">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString("ko-KR") : ""}
                  </span>
                </div>

                <div className="mt-1.5 text-xs text-gray-500">
                  <span className="font-medium text-gray-600">
                    {ACTOR_LABELS[log.actorType] ?? log.actorType}
                  </span>
                  {log.actorName ? ` · ${log.actorName}` : ""}
                </div>

                {Array.isArray(log.fieldChanges) && log.fieldChanges.length > 0 && (
                  <div className="mt-2 space-y-1 border-t pt-2">
                    {log.fieldChanges.map((fc: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 min-w-[90px] shrink-0">{fc.label ?? fc.field}</span>
                        <span className="text-red-500 line-through">{formatVal(fc.before)}</span>
                        <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
                        <span className="text-green-700 font-medium">{formatVal(fc.after)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
