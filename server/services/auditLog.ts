import { format } from "date-fns";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { auditLogs } from "../../drizzle/schema";

/**
 * 감사 로그 / 식별번호 / 변경이력 공통 유틸
 *
 * 정책 근거: 두골프 ERP는 한번 등록한 예약/자금 건을 물리/논리 삭제할 수 없다.
 * "삭제"는 상태(void) 전환만 허용하며, 생성/수정/상태변경/담당자변경/금액변경/매칭변경/삭제 등
 * 모든 변경을 audit_logs에 불변 기록하여 담당자의 허위 조작을 추적·차단한다.
 */

export type AuditEntityType =
  | "reservation"
  | "income"
  | "remittance"
  | "deposit"
  | "charge"
  | "prepaid";

export type AuditAction =
  | "create"
  | "update"
  | "status_change"
  | "manager_change"
  | "amount_change"
  | "match_change"
  | "void";

export type AuditActorType = "master" | "partner_owner" | "partner_staff" | "system";

export interface FieldChange {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

/** tRPC ctx에서 행위자 정보를 추출 (마스터/파트너 대표/파트너 직원) */
export function resolveActor(ctx: any): {
  actorType: AuditActorType;
  actorId: number | null;
  actorName: string | null;
} {
  if (ctx?.partnerStaff) {
    return {
      actorType: "partner_staff",
      actorId: ctx.partnerStaff.staffId ?? ctx.partnerStaff.id ?? null,
      actorName: ctx.partnerStaff.name ?? null,
    };
  }
  if (ctx?.partnerOwner) {
    return {
      actorType: "partner_owner",
      actorId: ctx.partnerOwner.partnerId ?? null,
      actorName: ctx.partnerOwner.name ?? ctx.partnerOwner.email ?? null,
    };
  }
  if (ctx?.user) {
    return {
      actorType: "master",
      actorId: ctx.user.id ?? null,
      actorName: ctx.user.name ?? ctx.user.email ?? null,
    };
  }
  return { actorType: "system", actorId: null, actorName: null };
}

/** 행위자 표시 이름 (담당자 자동 기입용) */
export function resolveActorName(ctx: any): string | undefined {
  return resolveActor(ctx).actorName ?? undefined;
}

/**
 * 자금 식별번호 자동 생성 (PREFIX-YYYYMM-XXXX)
 * - income: IN, remittance: OUT, deposit: DP, charge: CG, prepaid: PP
 */
const RECORD_NO_PREFIX: Record<AuditEntityType, string> = {
  reservation: "OY",
  income: "IN",
  remittance: "OUT",
  deposit: "DP",
  charge: "CG",
  prepaid: "PP",
};

export function generateRecordNo(entityType: AuditEntityType, when: Date = new Date()): string {
  const prefix = RECORD_NO_PREFIX[entityType] ?? "RC";
  const ym = format(when, "yyyyMM");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${ym}-${rand}`;
}

/**
 * 감사 로그 1건 기록 (실패해도 본 작업을 막지 않도록 try/catch로 감쌈)
 */
export async function writeAuditLog(params: {
  ctx: any;
  entityType: AuditEntityType;
  entityId: number;
  entityNo?: string | null;
  action: AuditAction;
  summary?: string;
  fieldChanges?: FieldChange[];
  tenantId?: number | null;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const actor = resolveActor(params.ctx);
    await db.insert(auditLogs).values({
      entityType: params.entityType,
      entityId: params.entityId,
      entityNo: params.entityNo ?? null,
      action: params.action,
      actorType: actor.actorType,
      actorId: actor.actorId,
      actorName: actor.actorName,
      summary: params.summary ?? null,
      fieldChanges:
        params.fieldChanges && params.fieldChanges.length > 0 ? (params.fieldChanges as any) : null,
      tenantId: params.tenantId ?? params.ctx?.tenantId ?? null,
    });
  } catch (e) {
    console.error("[auditLog] 기록 실패:", e);
  }
}

/**
 * 변경 전/후 객체를 비교해 변경된 필드 목록(FieldChange[])을 생성.
 * - labels: 필드명 → 한글 라벨 매핑
 * - 값이 동일하면 제외, undefined(미입력)는 비교에서 제외
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const key of Object.keys(labels)) {
    if (!(key in after)) continue;
    const afterVal = after[key];
    if (afterVal === undefined) continue; // 미입력 필드는 변경으로 보지 않음
    const beforeVal = before[key];
    const norm = (v: unknown) =>
      v instanceof Date ? v.getTime() : v === null ? null : v;
    if (norm(beforeVal) === norm(afterVal)) continue;
    changes.push({ field: key, label: labels[key], before: beforeVal ?? null, after: afterVal ?? null });
  }
  return changes;
}

/** 특정 엔티티의 감사 로그 조회 (최신순) */
export async function listEntityAuditLogs(entityType: AuditEntityType, entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(auditLogs)
    .where(sql`${auditLogs.entityType} = ${entityType} AND ${auditLogs.entityId} = ${entityId}`)
    .orderBy(sql`${auditLogs.createdAt} DESC, ${auditLogs.id} DESC`);
}
