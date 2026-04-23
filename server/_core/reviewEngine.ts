/**
 * 두골프-AI개발 엔진: ReviewEngine
 * ─────────────────────────────────────────────────────────────────────────────
 * AI가 생성한 수정 코드를 다단계로 재검토합니다.
 * 단계: syntax → logic → security → test → final
 */

import { getDb } from "../db";
import { aiFixRequests, aiReviewResults } from "../../drizzle/schema";
import { orchestrate } from "./orchestrator";
import { eq } from "drizzle-orm";
import { CRITICAL_FILES } from "./errorWatcher";

type ReviewStage = "syntax" | "logic" | "security" | "test" | "final";
type ReviewResult = "pass" | "fail" | "warning";

interface ReviewIssue {
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
}

interface StageReviewResult {
  stage: ReviewStage;
  result: ReviewResult;
  details: string;
  issues: ReviewIssue[];
  durationMs: number;
}

// ─── 단계별 검토 프롬프트 ─────────────────────────────────────────────────────
const STAGE_PROMPTS: Record<ReviewStage, (code: string, context: string) => string> = {
  syntax: (code, context) => `
두골프 ERP 코드의 **문법 검토**를 수행하세요.

**수정 컨텍스트:** ${context}
**수정 코드:**
\`\`\`
${code.slice(0, 2000)}
\`\`\`

다음을 확인하고 JSON으로 응답하세요:
- TypeScript 타입 오류
- 구문 오류 (괄호, 세미콜론 등)
- import/export 누락
- 변수명 오타

응답 형식:
{"result": "pass|fail|warning", "details": "검토 요약", "issues": [{"severity": "error|warning|info", "message": "이슈 설명"}]}`,

  logic: (code, context) => `
두골프 ERP 코드의 **로직 검토**를 수행하세요.

**수정 컨텍스트:** ${context}
**수정 코드:**
\`\`\`
${code.slice(0, 2000)}
\`\`\`

다음을 확인하고 JSON으로 응답하세요:
- 비즈니스 로직 정확성
- 엣지 케이스 처리
- 비동기 처리 (async/await)
- 에러 핸들링

응답 형식:
{"result": "pass|fail|warning", "details": "검토 요약", "issues": [{"severity": "error|warning|info", "message": "이슈 설명"}]}`,

  security: (code, context) => `
두골프 ERP 코드의 **보안 검토**를 수행하세요.

**수정 컨텍스트:** ${context}
**수정 코드:**
\`\`\`
${code.slice(0, 2000)}
\`\`\`

다음을 확인하고 JSON으로 응답하세요:
- SQL 인젝션 위험
- XSS 취약점
- 인증/인가 누락
- 민감 정보 노출 (API 키, 비밀번호)
- 입력 검증 누락

응답 형식:
{"result": "pass|fail|warning", "details": "검토 요약", "issues": [{"severity": "error|warning|info", "message": "이슈 설명"}]}`,

  test: (code, context) => `
두골프 ERP 코드의 **테스트 가능성 검토**를 수행하세요.

**수정 컨텍스트:** ${context}
**수정 코드:**
\`\`\`
${code.slice(0, 2000)}
\`\`\`

다음을 확인하고 JSON으로 응답하세요:
- 단위 테스트 작성 가능 여부
- 의존성 주입 가능 여부
- 테스트 케이스 제안

응답 형식:
{"result": "pass|fail|warning", "details": "검토 요약", "issues": [{"severity": "error|warning|info", "message": "이슈 설명"}]}`,

  final: (code, context) => `
두골프 ERP 코드의 **최종 종합 검토**를 수행하세요.

**수정 컨텍스트:** ${context}
**수정 코드:**
\`\`\`
${code.slice(0, 2000)}
\`\`\`

모든 관점(문법, 로직, 보안, 테스트)을 종합하여 최종 판단을 내려주세요.
이 코드를 프로덕션에 배포해도 안전한지 평가하세요.

응답 형식:
{"result": "pass|fail|warning", "details": "최종 검토 요약 (배포 가능 여부 포함)", "issues": [{"severity": "error|warning|info", "message": "이슈 설명"}]}`,
};

// ─── 단일 단계 검토 실행 ──────────────────────────────────────────────────────
async function runStageReview(
  stage: ReviewStage,
  fixCode: string,
  context: string
): Promise<StageReviewResult> {
  const startTime = Date.now();
  const prompt = STAGE_PROMPTS[stage](fixCode, context);

  try {
    const aiResult = await orchestrate(prompt, {
      taskType: "code_review",
      systemPrompt: "당신은 두골프 ERP 시스템의 코드 리뷰 전문가입니다. 반드시 JSON 형식으로만 응답하세요.",
      maxTokens: 1024,
      temperature: 0.1,
    });

    const jsonText = aiResult.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonText) as {
      result: ReviewResult;
      details: string;
      issues: ReviewIssue[];
    };

    return {
      stage,
      result: parsed.result,
      details: parsed.details,
      issues: parsed.issues ?? [],
      durationMs: Date.now() - startTime,
    };
  } catch (e) {
    return {
      stage,
      result: "warning",
      details: `검토 중 오류 발생: ${e instanceof Error ? e.message : String(e)}`,
      issues: [{ severity: "warning", message: "AI 검토 실패 - 수동 검토 권장" }],
      durationMs: Date.now() - startTime,
    };
  }
}

// ─── 전체 다단계 검토 실행 ────────────────────────────────────────────────────
export async function runFullReview(fixRequestId: number): Promise<{
  success: boolean;
  overallResult: ReviewResult;
  stages: StageReviewResult[];
  canApply: boolean;
  requiresUserApproval: boolean;
  summary: string;
}> {
  const db = await getDb();
  if (!db) return {
    success: false,
    overallResult: "fail",
    stages: [],
    canApply: false,
    requiresUserApproval: true,
    summary: "DB 연결 실패",
  };

  const [request] = await db.select().from(aiFixRequests).where(eq(aiFixRequests.id, fixRequestId));
  if (!request || !request.aiFixCode) {
    return {
      success: false,
      overallResult: "fail",
      stages: [],
      canApply: false,
      requiresUserApproval: true,
      summary: "수정 코드가 없습니다.",
    };
  }

  const isCriticalFile = request.targetFile
    ? CRITICAL_FILES.some((cf) => request.targetFile!.includes(cf))
    : false;

  const context = `${request.title} - ${request.description.slice(0, 200)}`;
  const stages: StageReviewResult[] = [];

  // 단계별 검토 실행 (순서대로)
  const stageOrder: ReviewStage[] = ["syntax", "logic", "security", "test", "final"];

  for (const stage of stageOrder) {
    const result = await runStageReview(stage, request.aiFixCode, context);
    stages.push(result);

    // DB에 검토 결과 저장
    await db.insert(aiReviewResults).values({
      fixRequestId,
      reviewStage: stage,
      result: result.result,
      details: result.details,
      issues: result.issues,
      reviewModel: "orchestrator",
      durationMs: result.durationMs,
    }).catch(() => {});

    // 보안 검토에서 fail이면 critical 수정 요청 자동 생성 후 즉시 중단
    if (stage === "security" && result.result === "fail") {
      console.warn(`[ReviewEngine] 보안 검토 실패 - fixRequestId=${fixRequestId}`);
      // 보안 취약점 발견 시 critical 우선순위 수정 요청 자동 생성
      try {
        const securityIssues = result.issues
          .filter((i) => i.severity === "error" || i.severity === "warning")
          .map((i) => i.message)
          .join("; ");
        await db.insert(aiFixRequests).values({
          title: `[보안취약점] ${request.title} 보안 재검토 필요`,
          description: `보안 검토 단계에서 취약점이 발견되었습니다.

원본 수정 요청 ID: ${fixRequestId}
발견된 이슈:
${securityIssues || result.details}`,
          targetFile: request.targetFile ?? undefined,
          targetFunction: request.targetFunction ?? undefined,
          priority: "critical",
          isCritical: true,
          requestSource: "auto",
          aiCategory: "SECURITY",
          aiSuggestedPriority: "critical",
          errorLogId: request.errorLogId ?? undefined,
        });
        console.warn(`[ReviewEngine] 보안 취약점 critical 수정 요청 자동 생성 완료 - fixRequestId=${fixRequestId}`);
      } catch (insertErr) {
        console.error(`[ReviewEngine] critical 수정 요청 생성 실패:`, insertErr);
      }
      break;
    }
  }

  // 전체 결과 판단
  const hasError = stages.some((s) => s.result === "fail");
  const hasWarning = stages.some((s) => s.result === "warning");
  const overallResult: ReviewResult = hasError ? "fail" : hasWarning ? "warning" : "pass";

  // 적용 가능 여부
  const canApply = !hasError;
  // 사용자 승인 필요 여부: 핵심 기능이거나 경고 이상이면 승인 필요
  const requiresUserApproval = request.isCritical || isCriticalFile || hasWarning || hasError;

  // 수정 요청 상태 업데이트
  const newStatus = hasError ? "failed" : requiresUserApproval ? "pending" : "approved";
  await db.update(aiFixRequests).set({ status: newStatus }).where(eq(aiFixRequests.id, fixRequestId));

  const summary = hasError
    ? `검토 실패: ${stages.filter((s) => s.result === "fail").map((s) => s.stage).join(", ")} 단계에서 오류 발견`
    : hasWarning
    ? `경고 있음: ${stages.filter((s) => s.result === "warning").map((s) => s.stage).join(", ")} 단계에서 경고 발견. 사용자 검토 후 적용 권장`
    : "모든 검토 통과. 적용 가능합니다.";

  return {
    success: true,
    overallResult,
    stages,
    canApply,
    requiresUserApproval,
    summary,
  };
}

// ─── 검토 결과 조회 ───────────────────────────────────────────────────────────
export async function getReviewResults(fixRequestId: number): Promise<typeof aiReviewResults.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiReviewResults).where(eq(aiReviewResults.fixRequestId, fixRequestId));
}
