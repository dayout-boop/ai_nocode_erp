/**
 * deployRunner — 자체 배포 실행기 (외부서버 빌드·재시작) [STEP5 §3 자립 배포]
 * ------------------------------------------------------------------
 * 목적: 마누스(Publish 버튼) 없이도, 외부서버 환경에서 ERP 소스 내부 코드로
 *       "빌드(pnpm build) → 서버 재시작"을 트리거하고 그 결과를 deploy_logs 에 남긴다.
 *
 * 안전가드 (사양 불변 규약 준수):
 *  1) SELF_DEPLOY_ENABLED=true 인 경우에만 실제 쉘 명령을 실행한다.
 *     (기본 비활성 → 호출해도 "준비 안 됨"만 반환, 의도치 않은 자동배포 차단)
 *  2) main 자동 병합/운영 반영은 이 모듈이 절대 수행하지 않는다.
 *     이 모듈은 "이미 반영된 소스를 외부서버에서 빌드/재기동"하는 역할만 한다.
 *  3) 실행 명령은 환경변수로만 주입되며, 외부 입력 문자열을 셸에 직접 끼워넣지 않는다(인젝션 차단).
 *  4) 모든 실행(성공/실패)은 deploy_logs 에 기록된다.
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getDb } from "../db";
import { deployLogs } from "../../drizzle/schema";
import { ENV } from "../_core/env";

const execAsync = promisify(exec);

export type DeployPhase = "build" | "restart" | "full";

export interface DeployRunInput {
  phase: DeployPhase;
  tenantId?: number;
  requestId?: number;
  commitSha?: string;
  performedBy?: number | null;
  performedByName?: string | null;
}

export interface DeployRunResult {
  ok: boolean;
  enabled: boolean;
  phase: DeployPhase;
  outputSummary: string;
  durationMs: number;
  logId?: number;
}

/** 자체 배포 기능 활성 여부(안전가드 1) */
export function isSelfDeployEnabled(): boolean {
  return ENV.selfDeployEnabled === "true";
}

/** deploy_logs 적재 (graceful) */
async function writeDeployLog(
  input: DeployRunInput,
  success: boolean,
  outputSummary: string,
  durationMs: number,
): Promise<number | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  try {
    const inserted = await db.insert(deployLogs).values({
      tenantId: input.tenantId ?? 1,
      requestId: input.requestId ?? null,
      phase: input.phase,
      commitSha: input.commitSha ?? null,
      success,
      outputSummary: outputSummary.slice(0, 4000),
      durationMs,
      performedBy: input.performedBy ?? null,
      performedByName: input.performedByName ?? null,
    });
    return Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  } catch (err: any) {
    console.warn(`[deployRunner] deploy_logs 기록 실패(무시): ${err?.message ?? err}`);
    return undefined;
  }
}

/** 단일 셸 명령 실행 (타임아웃 10분, 출력 캡처) */
async function runCmd(cmd: string): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: process.cwd(),
      timeout: 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    });
    return { ok: true, output: `$ ${cmd}\n${stdout}\n${stderr}`.trim() };
  } catch (err: any) {
    const out = `$ ${cmd}\n[FAILED] ${err?.message ?? err}\n${err?.stdout ?? ""}\n${err?.stderr ?? ""}`;
    return { ok: false, output: out.trim() };
  }
}

/**
 * 배포 실행 진입점.
 * - 비활성 시: 실제 실행 없이 enabled=false 로 안내(그래도 deploy_logs 에 시도 기록).
 * - 활성 시: phase 에 따라 build / restart / full 실행.
 */
export async function runDeploy(input: DeployRunInput): Promise<DeployRunResult> {
  const startedAt = Date.now();

  // 안전가드 1: 비활성 시 실제 명령 실행 금지
  if (!isSelfDeployEnabled()) {
    const msg =
      "자체 배포 비활성(SELF_DEPLOY_ENABLED!=true). 외부서버 자립 모드에서만 실제 빌드/재시작이 실행됩니다. " +
      "현재는 마누스 Publish 버튼 또는 외부서버 수동 빌드로 반영하세요.";
    const durationMs = Date.now() - startedAt;
    const logId = await writeDeployLog(input, false, msg, durationMs);
    return { ok: false, enabled: false, phase: input.phase, outputSummary: msg, durationMs, logId };
  }

  const parts: string[] = [];
  let allOk = true;

  if (input.phase === "build" || input.phase === "full") {
    const r = await runCmd(ENV.deployBuildCmd || "pnpm build");
    parts.push(r.output);
    allOk = allOk && r.ok;
  }

  if ((input.phase === "restart" || input.phase === "full") && allOk) {
    if (ENV.deployRestartCmd && ENV.deployRestartCmd.trim().length > 0) {
      const r = await runCmd(ENV.deployRestartCmd);
      parts.push(r.output);
      allOk = allOk && r.ok;
    } else {
      parts.push(
        "[restart] DEPLOY_RESTART_CMD 미설정 — 재시작 명령 생략. " +
          "프로세스 매니저(pm2/systemd 등)에 재시작 명령을 환경변수로 등록하세요.",
      );
    }
  }

  const outputSummary = parts.join("\n\n---\n\n");
  const durationMs = Date.now() - startedAt;
  const logId = await writeDeployLog(input, allOk, outputSummary, durationMs);

  return { ok: allOk, enabled: true, phase: input.phase, outputSummary, durationMs, logId };
}
