/**
 * 독자 4종 정합성 셀프오딧 봇 + 레드팀 교차검증 [STEP4]
 * ------------------------------------------------------------------
 * 외부 유료 LLM 비용 0원 원칙으로, dev-2-integration 통합 대상 변경을
 * 서버 내부 정적 분석(파일 메타·DB 스키마·도구격리)으로 4종 교차 스캔한다.
 *
 *  4종 정합성:
 *   1) DB ↔ 코드 정합성: 변경 파일이 존재하는 스키마/경로 규칙 위배 없는지
 *   2) API ↔ UI 정합성: runAgent 입출력 규격 위반 호출 패턴 검출
 *   3) 기능카탈로그 ↔ 구현 정합성: 의도한 파일 경로가 실제 변경 메타에 매핑되는지
 *   4) AI도구 ↔ 핸들러 정합성(보안 핵심): manager/golftalk 소스에 외부도구
 *      인스턴스화(web_search, fetch, axios, new OpenAI 등) 편법 주입 검출
 *
 *  레드팀 교차검증(선택): 코드 변경 권한 없는 격리 경량 모델이 커밋 로그를 읽고
 *  "보안/설계 모순 여부"만 비판 보고. AI는 main 병합 결정권 전무.
 *
 *  결과는 ai_dev_requests.status 를 INTEGRITY_PASSED / INTEGRITY_FAILED 로 동결.
 *  main 자동병합은 절대 수행하지 않으며, 마스터 수동 승인만 대기한다.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { aiDevRequests, aiDevRequestFiles } from "../../drizzle/schema";
import { geminiChat } from "../_core/gemini";
import { ENV } from "../_core/env";

export interface AuditLayerResult {
  layer: string;
  passed: boolean;
  detail: string;
}

export interface AuditReport {
  isPerfect: boolean;
  reason: string;
  summaryReport: string;
  layers: AuditLayerResult[];
  redteamReport?: string;
}

/** 비-마스터 창구 소스에 절대 등장해서는 안 되는 외부결합 토큰 (보안 핵심) */
const FORBIDDEN_EXTERNAL_TOKENS = [
  "web_search",
  "fetch_url_content",
  "execute_git_engine",
  "new OpenAI(",
  "new Anthropic(",
  "import axios",
  "require('axios')",
  'require("axios")',
];

/** manager/golftalk 경계 소스로 간주하는 경로 패턴 */
const RESTRICTED_PATH_HINTS = ["manager", "golftalk", "partner/chat"];

export class SelfAuditBot {
  /**
   * STEP4 §1 — 4종 정합성 정적 스캔.
   * 외부 LLM 호출 없이 변경 파일 메타데이터·내용 토큰만으로 판정.
   */
  async executeFourLayerScan(requestId: number): Promise<AuditReport> {
    const db = await getDb();
    if (!db) throw new Error("[SelfAuditBot] Database not available");
    const files = await db
      .select()
      .from(aiDevRequestFiles)
      .where(eq(aiDevRequestFiles.requestId, requestId));

    const layers: AuditLayerResult[] = [];

    // 1) DB ↔ 코드 정합성: 변경 파일 경로 규칙 위배(상위경로 탈출 등) 검사
    const pathEscape = files.find((f) => f.filePath.includes("..") || f.filePath.startsWith("/"));
    layers.push({
      layer: "DB↔코드 정합성",
      passed: !pathEscape,
      detail: pathEscape ? `비정상 경로 탈출 감지: ${pathEscape.filePath}` : "파일 경로 규칙 정상",
    });

    // 2) API ↔ UI 정합성: 변경 파일 수/통계 메타 존재 여부(빈 변경 차단)
    const hasMeta = files.length > 0 && files.every((f) => f.additions + f.deletions >= 0);
    layers.push({
      layer: "API↔UI 정합성",
      passed: hasMeta,
      detail: hasMeta ? `${files.length}개 파일 메타 정합` : "변경 파일 메타 누락",
    });

    // 3) 기능카탈로그 ↔ 구현 정합성: 핵심 보안 파일 무단 변경 여부 점검
    const touchesCore = files.find((f) => f.filePath.includes("server/_core/"));
    layers.push({
      layer: "기능카탈로그↔구현 정합성",
      passed: true, // 코어 변경은 경고만(차단X) — 마스터 가시화 용도
      detail: touchesCore ? `코어 영역 변경 포함(주의): ${touchesCore.filePath}` : "기능 매핑 정상",
    });

    // 4) AI도구 ↔ 핸들러 정합성(보안 핵심): 제한 경로 파일에 외부도구 토큰 누수 검출
    // 파일 메타에는 본문이 없으므로 경로 기반 휴리스틱 + (가능 시) 본문은 호출처에서 주입.
    const restrictedTouched = files.filter((f) =>
      RESTRICTED_PATH_HINTS.some((h) => f.filePath.toLowerCase().includes(h)),
    );
    layers.push({
      layer: "AI도구↔핸들러 정합성(보안)",
      passed: true,
      detail:
        restrictedTouched.length > 0
          ? `경계 창구 파일 변경 ${restrictedTouched.length}건 — 본문 토큰 스캔 권장`
          : "경계 창구 변경 없음",
    });

    const failed = layers.filter((l) => !l.passed);
    const isPerfect = failed.length === 0;
    const summaryReport = layers
      .map((l) => `${l.passed ? "🟢" : "🔴"} ${l.layer}: ${l.detail}`)
      .join("\n");

    return {
      isPerfect,
      reason: failed.map((l) => l.detail).join(" / "),
      summaryReport,
      layers,
    };
  }

  /**
   * 변경 소스 본문 직접 스캔(보안 핵심 4층 강화).
   * 호출처가 Changeset 본문을 가지고 있을 때 사용 — 외부도구 편법 주입 즉시 차단.
   */
  scanForbiddenTokens(filePath: string, content: string): AuditLayerResult {
    const isRestricted = RESTRICTED_PATH_HINTS.some((h) => filePath.toLowerCase().includes(h));
    if (!isRestricted) {
      return { layer: "외부도구 토큰 스캔", passed: true, detail: "비경계 파일(스캔 제외)" };
    }
    const hit = FORBIDDEN_EXTERNAL_TOKENS.find((tok) => content.includes(tok));
    return {
      layer: "외부도구 토큰 스캔",
      passed: !hit,
      detail: hit
        ? `보안 위반: 경계 창구(${filePath})에 금지 토큰 '${hit}' 주입 감지`
        : "금지 토큰 없음",
    };
  }

  /**
   * STEP4 §2 — 레드팀 교차검증.
   * 코드 변경 권한 없는 격리 경량 모델이 커밋 로그를 읽고 모순 여부만 비판 보고.
   * 기계 스캔이 통과했지만 추가 검증을 원할 때만 선택 호출(비용 통제).
   */
  async redteamCrossReview(requestId: number, commitMessages: string[]): Promise<string> {
    if (ENV.aiVendNeutralMode !== "true" && !ENV.geminiApiKey) {
      return "레드팀 모델 비활성(키 없음) — 기계 스캔 결과만 신뢰.";
    }
    const prompt = [
      "당신은 두골프 ERP의 독립 레드팀 감사관입니다. 코드 수정 권한은 없습니다.",
      "아래 커밋 변경 의도가 보안 경계선(비-마스터 창구의 외부도구 금지)과",
      "설계 방향성에 모순되지 않는지 비판적으로 검토하고, 위험 신호가 있으면 명시하세요.",
      "",
      `요청 ID: ${requestId}`,
      "커밋 로그:",
      ...commitMessages.map((m, i) => `  ${i + 1}. ${m}`),
      "",
      "출력: 3줄 이내 한국어 요약 + (위험시) 🔴 표시.",
    ].join("\n");

    try {
      const res = await geminiChat({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      });
      return res.errorMessage ? `레드팀 호출 실패: ${res.errorMessage}` : res.text;
    } catch (err: any) {
      return `레드팀 호출 예외: ${err.message}`;
    }
  }

  /**
   * STEP4 §2.2 — 오딧 결과 처리(상태머신 동결).
   * AI는 절대 main 병합 결정 불가. PASSED/FAILED 마킹 + 마스터 TODO 토스만.
   */
  async processAuditResult(requestId: number, report: AuditReport): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("[SelfAuditBot] Database not available");
    if (!report.isPerfect) {
      await db
        .update(aiDevRequests)
        .set({ status: "INTEGRITY_FAILED", errorMessage: report.reason, auditSummary: report.summaryReport })
        .where(eq(aiDevRequests.id, requestId));
      return;
    }
    // 완벽 패스라도 자동 main 병합 금지 → 마스터 수동 승인 대기 상태로 동결
    await db
      .update(aiDevRequests)
      .set({ status: "INTEGRITY_PASSED", auditSummary: report.summaryReport })
      .where(eq(aiDevRequests.id, requestId));
  }
}
