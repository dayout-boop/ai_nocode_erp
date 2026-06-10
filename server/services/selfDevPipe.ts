/**
 * 탈마누스 자체 개발 파이프 [STEP5 §3.2]
 * ------------------------------------------------------------------
 * 마누스 API에 의존하지 않고, 두골프 서버가 직접 개발 요청을 처리한다.
 *
 *   [1] 개발 요청 → 자체 LLM(OpenRouter/Gemini)으로 코드 변경조각(Changeset) 생성
 *   [2] runPipeline(orchestrator) 으로 dev-1 격리 커밋 + 4종 정합성 감사
 *   [3] 결과(요청 ID·커밋 SHA·감사 통과 여부)를 반환
 *
 * 마누스 경로(manusPipe.smartSendToManus)와 완전히 분리된 독립 실행기다.
 * 코드 생성 주체가 외부(마누스)가 아니라 두골프 서버 자신이라는 점이 핵심 차이.
 */
import { orchestratorChat } from "./openrouter";
import { runPipeline, type OrchestrationState } from "./orchestrator";
import { isGitEngineEnabled, type ChangesetFile } from "./gitEngine";
import type { AgentContext } from "./agentEngine";

export interface SelfDevInput {
  /** dev_requests 테이블에 이미 등록된 요청 ID (참조용) */
  devRequestId?: number;
  title: string;
  description: string;
  module?: string | null;
  aiCategory?: string | null;
  /** 호출 주체(마스터) ID — 감사·격리 추적 */
  requestedBy: number;
  /** dev-2-integration 자동 병합 여부 (기본 false — Heartbeat 일괄 처리) */
  autoIntegrate?: boolean;
  /** 멀티테넌트 (두골프=1) */
  tenantId?: number;
}

export interface SelfDevResult {
  success: boolean;
  /** 자체 엔진 ai_dev_requests 라이프사이클 레코드 ID */
  pipelineRequestId?: number;
  /** 생성된 변경 파일 경로 목록 */
  changedFiles: string[];
  /** 코드생성 LLM 모델 */
  model?: string;
  /** 코드생성 비용(USD) */
  codeGenCostUsd?: number;
  /** 최종 파이프라인 단계 */
  stage?: string;
  /** 정합성 결과 */
  integrityStatus?: string;
  message: string;
  /** 생성 요약(마스터 설명용) */
  summary?: string;
}

/** LLM이 생성한 changeset 응답 스키마 */
interface GeneratedChangeset {
  summary: string;
  files: Array<{
    filePath: string;
    action: "ADD" | "MODIFY" | "DELETE";
    content?: string;
  }>;
}

const CODEGEN_SYSTEM_PROMPT = `당신은 두골프 ERP의 자체 코드생성 엔진입니다(탈마누스 자립 모드).
스택: React 19 + Tailwind 4 + Express 4 + tRPC 11 + MySQL(Drizzle ORM).

[엄격한 출력 규칙]
- 개발 요청을 분석하여, 실제로 변경할 파일들의 "완전한 최종 내용"을 생성합니다.
- 부분 diff나 생략("...") 절대 금지. action이 ADD/MODIFY이면 파일 전체 내용을 content에 담습니다.
- 변경 파일은 꼭 필요한 것만 최소로 선정합니다.
- 보안: API 키 원문, 비밀값, 외부 결합 토큰을 코드에 하드코딩하지 않습니다.
- 확신이 서지 않거나 전체 코드베이스 맥락이 필요한 대규모 변경이면, files를 빈 배열로 두고 summary에 그 이유와 권장 분할 방안을 적습니다.

반드시 지정된 JSON 스키마로만 응답합니다.`;

/**
 * 탈마누스 자체 개발 실행: 코드생성 → 자체 Git 파이프라인.
 */
export async function runSelfDevelopment(input: SelfDevInput): Promise<SelfDevResult> {
  // [0] Git 엔진 가용성 — 비활성이어도 코드생성/메타기록은 진행(runPipeline 내부에서 보류 처리)
  const gitReady = isGitEngineEnabled();

  // [1] 자체 LLM으로 Changeset 생성 (OpenRouter — high 복잡도: Gemini Pro)
  let generated: GeneratedChangeset;
  let model: string | undefined;
  let codeGenCostUsd: number | undefined;
  try {
    const userPrompt = `개발 요청을 분석하여 변경할 파일들의 완전한 내용을 생성하세요.

제목: ${input.title}
모듈: ${input.module ?? "ERP"}
유형: ${input.aiCategory ?? "FEATURE"}
설명:
${input.description}`;

    const res = await orchestratorChat({
      messages: [
        { role: "system", content: CODEGEN_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      complexity: "high",
      assistant: "master",
      sessionId: `selfdev-${input.devRequestId ?? Date.now()}`,
      userId: input.requestedBy,
      systemPrompt: CODEGEN_SYSTEM_PROMPT,
      maxTokens: 8192,
      temperature: 0.2,
    });
    model = res.model;
    codeGenCostUsd = res.costUsd;

    // JSON 추출 (코드블록/잡음 제거)
    const raw = res.text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        changedFiles: [],
        model,
        codeGenCostUsd,
        message: "코드생성 결과를 파싱하지 못했습니다 (JSON 없음).",
        summary: raw.slice(0, 500),
      };
    }
    generated = JSON.parse(jsonMatch[0]) as GeneratedChangeset;
  } catch (err: any) {
    return {
      success: false,
      changedFiles: [],
      message: `코드생성 실패: ${err?.message ?? "알 수 없는 오류"}`,
    };
  }

  // [1.5] 생성 결과 검증
  const files = (generated.files ?? []).filter((f) => f.filePath && f.action);
  if (files.length === 0) {
    return {
      success: false,
      changedFiles: [],
      model,
      codeGenCostUsd,
      message: "자체 엔진이 변경 파일을 생성하지 않았습니다 (대규모/모호 요청 가능성).",
      summary: generated.summary ?? "",
    };
  }

  // content 검증 (ADD/MODIFY는 필수)
  for (const f of files) {
    if (f.action !== "DELETE" && (!f.content || f.content.trim() === "")) {
      return {
        success: false,
        changedFiles: files.map((x) => x.filePath),
        model,
        codeGenCostUsd,
        message: `'${f.filePath}' 의 content 가 비어 있어 커밋을 중단했습니다.`,
        summary: generated.summary ?? "",
      };
    }
  }

  const changeset: ChangesetFile[] = files.map((f) => ({
    filePath: f.filePath,
    action: f.action,
    content: f.content,
  }));

  // [2] 자체 Git 파이프라인 (dev-1 격리 커밋 + 4종 감사)
  const context: AgentContext = {
    callerId: `master-${input.requestedBy}`,
    role: "MASTER",
  };

  let state: OrchestrationState;
  try {
    state = await runPipeline({
      agentId: `master_engine`,
      commitMessage: `[탈마누스] ${input.aiCategory ?? "개발"}: ${input.title}`.slice(0, 200),
      changeset,
      context,
      autoIntegrate: input.autoIntegrate ?? false,
      runAudit: true,
      tenantId: input.tenantId ?? 1,
      devSource: "engine",
    });
  } catch (err: any) {
    return {
      success: false,
      changedFiles: changeset.map((c) => c.filePath),
      model,
      codeGenCostUsd,
      message: `자체 Git 파이프라인 실패: ${err?.message ?? "알 수 없는 오류"}`,
      summary: generated.summary ?? "",
    };
  }

  const success = state.integrityStatus === "SUCCESS" || (!gitReady && state.integrityStatus === "PENDING");

  return {
    success,
    pipelineRequestId: state.requestId,
    changedFiles: changeset.map((c) => c.filePath),
    model,
    codeGenCostUsd,
    stage: state.currentStage,
    integrityStatus: state.integrityStatus,
    message: gitReady
      ? state.message
      : "코드생성 완료 — Git 엔진 비활성으로 커밋 보류 (ERP 설정 > v3 엔진에서 GitHub Token 등록 필요)",
    summary: generated.summary ?? "",
  };
}
