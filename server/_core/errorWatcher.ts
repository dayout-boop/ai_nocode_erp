/**
 * 두골프-AI개발 엔진: ErrorWatcher
 * ─────────────────────────────────────────────────────────────────────────────
 * 런타임 오류를 감지하고 AI 분석을 통해 자동 수정 요청을 생성합니다.
 * Express 전역 에러 핸들러 및 tRPC 에러 핸들러에서 호출됩니다.
 */

import { getDb } from "../db";
import { aiEngineLogs, aiFixRequests } from "../../drizzle/schema";
import { orchestrate } from "./orchestrator";
import { eq } from "drizzle-orm";

// ─── 핵심 기능 파일 목록 (수정 시 사용자 승인 필요) ──────────────────────────
export const CRITICAL_FILES = [
  "server/stripe.ts",
  "server/_core/oauth.ts",
  "server/_core/context.ts",
  "server/routers.ts",
  "drizzle/schema.ts",
  "client/src/pages/erp/Bookings.tsx",
  "client/src/pages/erp/Payments.tsx",
];

// 핵심 기능 키워드 (오류 메시지/소스에 포함 시 isCritical=true)
const CRITICAL_KEYWORDS = [
  "payment", "stripe", "결제", "auth", "oauth", "login", "session", "jwt",
  "booking", "예약", "database", "schema", "migration",
];

export function isCriticalError(source: string, errorMessage: string): boolean {
  const combined = `${source} ${errorMessage}`.toLowerCase();
  return CRITICAL_KEYWORDS.some((kw) => combined.includes(kw));
}

// ─── 오류 유형 분류 ───────────────────────────────────────────────────────────
type ErrorType = "runtime" | "api" | "validation" | "unknown";

export function classifyError(error: Error | unknown): ErrorType {
  if (!(error instanceof Error)) return "unknown";
  const msg = error.message.toLowerCase();
  if (msg.includes("api") || msg.includes("fetch") || msg.includes("http") || msg.includes("openrouter")) return "api";
  if (msg.includes("validation") || msg.includes("zod") || msg.includes("invalid")) return "validation";
  if (error.stack) return "runtime";
  return "unknown";
}

// ─── 오류 보고 및 AI 분석 요청 ────────────────────────────────────────────────
export interface ErrorReport {
  source: string;
  error: Error | unknown;
  path?: string;
  context?: string;
}

export async function reportError(report: ErrorReport): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const error = report.error instanceof Error ? report.error : new Error(String(report.error));
  const errorType = classifyError(error);
  const critical = isCriticalError(report.source, error.message);

  try {
    // 1. 오류 로그 저장
    const [inserted] = await db.insert(aiEngineLogs).values({
      source: report.source,
      errorType,
      errorMessage: error.message.slice(0, 2000),
      stackTrace: error.stack?.slice(0, 3000),
      path: report.path,
      status: "analyzing",
    });

    const logId = (inserted as any).insertId as number;

    // 2. 비동기로 AI 분석 실행 (응답 대기 없이 백그라운드 처리)
    analyzeAndCreateFixRequest(logId, report, error, errorType, critical).catch((e) => {
      console.error("[ErrorWatcher] AI 분석 실패:", e);
    });

    return logId;
  } catch (e) {
    console.error("[ErrorWatcher] 오류 로그 저장 실패:", e);
    return null;
  }
}

async function analyzeAndCreateFixRequest(
  logId: number,
  report: ErrorReport,
  error: Error,
  errorType: ErrorType,
  isCritical: boolean
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    // AI 분석 프롬프트
    const analysisPrompt = `
두골프(DOGOLF) ERP 시스템에서 다음 오류가 발생했습니다. 분석하고 수정 방법을 제안해주세요.

**오류 발생 위치:** ${report.source}
**오류 유형:** ${errorType}
**오류 메시지:** ${error.message}
**경로:** ${report.path ?? "알 수 없음"}
**스택 트레이스:**
\`\`\`
${error.stack?.slice(0, 1000) ?? "없음"}
\`\`\`
${report.context ? `**추가 컨텍스트:** ${report.context}` : ""}

다음 형식으로 JSON 응답을 제공해주세요:
{
  "title": "오류 요약 제목 (50자 이내)",
  "analysis": "오류 원인 분석 (200자 이내)",
  "fixSuggestion": "수정 방법 제안 (300자 이내)",
  "targetFile": "수정이 필요한 파일 경로 (없으면 null)",
  "targetFunction": "수정이 필요한 함수/컴포넌트명 (없으면 null)",
  "priority": "critical|high|medium|low"
}`;

    const aiResult = await orchestrate(analysisPrompt, {
      taskType: "code_review",
      systemPrompt: "당신은 AI ERP 시스템의 시니어 개발자입니다. 오류를 분석하고 간결하고 실용적인 수정 방법을 제안합니다. 반드시 JSON 형식으로만 응답하세요.",
      maxTokens: 1024,
      temperature: 0.3,
    });

    let parsed: {
      title: string;
      analysis: string;
      fixSuggestion: string;
      targetFile: string | null;
      targetFunction: string | null;
      priority: "critical" | "high" | "medium" | "low";
    };

    try {
      // JSON 파싱 (마크다운 코드블록 제거)
      const jsonText = aiResult.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonText);
    } catch {
      parsed = {
        title: `[자동감지] ${report.source} 오류`,
        analysis: aiResult.text.slice(0, 200),
        fixSuggestion: "AI 분석 결과를 확인하세요.",
        targetFile: null,
        targetFunction: null,
        priority: "medium",
      };
    }

    // 3. 수정 요청 생성
    const [fixInserted] = await db.insert(aiFixRequests).values({
      title: parsed.title,
      description: `**원인 분석:**\n${parsed.analysis}\n\n**수정 제안:**\n${parsed.fixSuggestion}`,
      targetFile: parsed.targetFile ?? undefined,
      targetFunction: parsed.targetFunction ?? undefined,
      priority: parsed.priority,
      isCritical,
      status: "pending",
      aiFixExplanation: parsed.fixSuggestion,
      errorLogId: logId,
      requestSource: "auto",
    });

    const fixRequestId = (fixInserted as any).insertId as number;

    // 4. 오류 로그 업데이트 (분석 완료)
    await db.update(aiEngineLogs).set({
      status: "analyzing",
      aiAnalysis: parsed.analysis,
      fixRequestId,
    }).where(eq(aiEngineLogs.id, logId));

    console.info(`[ErrorWatcher] 수정 요청 생성 완료 (fixRequestId=${fixRequestId}, critical=${isCritical})`);
  } catch (e) {
    console.error("[ErrorWatcher] AI 분석 중 오류:", e);
    // 분석 실패해도 로그는 유지
    await db.update(aiEngineLogs).set({ status: "new" }).where(eq(aiEngineLogs.id, logId)).catch(() => {});
  }
}
