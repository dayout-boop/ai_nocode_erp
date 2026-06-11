/**
 * 두골프 ERP - 타 데스크 지식 차단 필터 서비스
 *
 * Manus 플랫폼이 related_knowledge로 타 데스크 지식을 주입할 때
 * ERP 서버 레벨에서 직접 감지하고 차단 이력을 기록한다.
 *
 * 이 시스템은 Manus 플랫폼과 완전히 독립적으로 동작하며,
 * 두골프 ERP DB에 차단 이력을 저장한다.
 */

import { getDb } from "../db";
import { knowledgeBlockLogs, knowledgeBlockRules } from "../../drizzle/schema";
import { eq, desc, or, isNull } from "drizzle-orm";

// ============================================================
// 기본 차단 규칙 (하드코딩 - DB 규칙과 병행 적용)
// ============================================================
export const DEFAULT_BLOCK_RULES = [
  {
    ruleName: "GitHub 연동 원칙",
    keywords: ["GitHub 연동", "실시간 반영 최우선", "GitHub와 실시간", "PR 생성 시 본문", "GEMINI_AUDIT_BLOCK"],
    description: "타 데스크(자율수행 에이전트 데스크)에서 생성된 GitHub 관련 원칙",
  },
  {
    ruleName: "IP 보호 원칙",
    keywords: ["IP 보호", "지식재산권", "라이센스 확인", "핵심 Master AI 라이센스", "정보 공유 거부"],
    description: "타 데스크에서 생성된 IP/라이센스 관련 원칙",
  },
  {
    ruleName: "L-5 인가 스텁 원칙",
    keywords: ["L-5 인가", "스텁 선 배치", "외부 LLM 호출 인가", "인가 통과 여부"],
    description: "타 데스크에서 생성된 LLM 인가 관련 원칙",
  },
  {
    ruleName: "파일 수정 3회 중단 원칙",
    keywords: ["파일 수정 및 오류", "3회 수정", "작업 중단 원칙", "중괄호 또는 컴파일 오류가 3회", "파일 수정 3회", "오류 발생 시 작업 중단"],
    description: "타 데스크에서 생성된 파일 수정 제한 원칙",
  },
  {
    ruleName: "이데스크 운영 원칙",
    keywords: ["이데스크 운영", "이데스크는 Manus 계정", "INTERNAL 관련 정보를 사용하지"],
    description: "타 데스크에서 생성된 데스크 운영 원칙",
  },
  {
    ruleName: "최고규율 적용 원칙",
    keywords: ["최고규율", "2026년 5월 14일 구글 드라이브", "최대 최고 권장 사항"],
    description: "타 데스크에서 생성된 최고규율 원칙",
  },
  {
    ruleName: "OpenManus 절차",
    keywords: ["OpenManus", "BaseAgent.step()", "검증 게이트웨이 stub", "requirements.txt를 사용하여 설치"],
    description: "타 데스크에서 생성된 OpenManus 관련 절차",
  },
  {
    ruleName: "내부 정보 보호 원칙",
    keywords: ["INTERNAL 정보", "퍼블릭 추상화", "실명, API 키, 매출 정보"],
    description: "타 데스크에서 생성된 내부 정보 보호 원칙",
  },
  {
    ruleName: "다중 환경 프로젝트 관리",
    keywords: ["다중 컴퓨터 환경", "마스터 AI - 개발엔진", "멀티하이브리드"],
    description: "타 데스크에서 생성된 다중 환경 관리 원칙",
  },
  {
    ruleName: "자율수행 에이전트 전략",
    keywords: ["초기 IP 확보 전략", "자율수행 에이전트를 통한 개발 프로세스 전환", "IP 확보를 최우선"],
    description: "타 데스크에서 생성된 자율수행 에이전트 전략",
  },
  {
    ruleName: "외부 리소스 연결 제한",
    keywords: ["외부 리소스 연결 제한", "dogolf 폴더만 접근", "Google Drive 폴더"],
    description: "타 데스크에서 생성된 외부 리소스 제한 원칙",
  },
  {
    ruleName: "연결 문제 원인 분석 원칙",
    keywords: ["연결 문제 발생 시 원인 분석", "재발 방지 원칙", "중간 명령이나 요청 때문인지"],
    description: "타 데스크에서 생성된 연결 문제 분석 원칙",
  },
];

// ============================================================
// 지식 차단 감지 함수
// ============================================================
export interface KnowledgeCheckResult {
  isBlocked: boolean;
  knowledgeName: string;
  matchedKeywords: string[];
  blockReason: string;
  sourceDeskHint: string;
}

/**
 * 지식 이름과 내용을 검사하여 차단 여부를 판단한다.
 */
export function checkKnowledge(
  knowledgeName: string,
  knowledgeContent: string = ""
): KnowledgeCheckResult {
  const combined = `${knowledgeName} ${knowledgeContent}`;
  const matchedKeywords: string[] = [];
  let blockReason = "";
  let sourceDeskHint = "타 데스크 (추정)";

  for (const rule of DEFAULT_BLOCK_RULES) {
    for (const keyword of rule.keywords) {
      if (combined.includes(keyword)) {
        matchedKeywords.push(keyword);
        blockReason = rule.description;
        sourceDeskHint = rule.ruleName;
      }
    }
  }

  const isBlocked = matchedKeywords.length > 0;

  return {
    isBlocked,
    knowledgeName,
    matchedKeywords,
    blockReason: isBlocked ? blockReason : "",
    sourceDeskHint: isBlocked ? sourceDeskHint : "",
  };
}

/**
 * 차단된 지식을 DB에 기록한다.
 */
export async function logBlockedKnowledge(
  result: KnowledgeCheckResult,
  sessionId?: string,
  tenantId?: number | null
): Promise<void> {
  if (!result.isBlocked) return;

  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(knowledgeBlockLogs).values({
      knowledgeName: result.knowledgeName.substring(0, 300),
      blockReason: `감지된 키워드: ${result.matchedKeywords.join(", ")} | ${result.blockReason}`,
      blockType: "auto",
      sourceDeskHint: result.sourceDeskHint.substring(0, 200),
      sessionId: sessionId?.substring(0, 100),
      tenantId: tenantId ?? null,
      isBlocked: true,
    });
  } catch (err) {
    // 로그 저장 실패는 무시 (차단 자체에는 영향 없음)
    console.error("[KnowledgeFilter] 차단 로그 저장 실패:", err);
  }
}

/**
 * 여러 지식을 일괄 검사하고 차단 목록을 반환한다.
 * 두골프 ERP 개발과 관련 없는 지식을 필터링한다.
 */
export async function filterKnowledgeList(
  knowledgeList: Array<{ name: string; content?: string }>,
  sessionId?: string
): Promise<{
  allowed: Array<{ name: string; content?: string }>;
  blocked: KnowledgeCheckResult[];
}> {
  const allowed: Array<{ name: string; content?: string }> = [];
  const blocked: KnowledgeCheckResult[] = [];

  for (const knowledge of knowledgeList) {
    const result = checkKnowledge(knowledge.name, knowledge.content);
    if (result.isBlocked) {
      blocked.push(result);
      await logBlockedKnowledge(result, sessionId);
    } else {
      allowed.push(knowledge);
    }
  }

  return { allowed, blocked };
}

/**
 * DB에서 차단 로그를 조회한다.
 */
export async function getBlockLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(knowledgeBlockLogs)
    .orderBy(desc(knowledgeBlockLogs.createdAt))
    .limit(limit);
}

/**
 * DB에서 차단 규칙을 조회한다.
 *
 * @param tenantId 업체 ID (null 또는 undefined = 전역 규칙만, 숫자 = 전역+해당 업체 규칙)
 */
export async function getBlockRules(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];

  if (tenantId != null) {
    // 전역(null) + 해당 업체 규칙 모두 반환
    return db
      .select()
      .from(knowledgeBlockRules)
      .where(
        eq(knowledgeBlockRules.isActive, true)
      )
      .orderBy(desc(knowledgeBlockRules.createdAt))
      .then((rows) =>
        rows.filter(
          (r) => r.tenantId === null || r.tenantId === tenantId
        )
      );
  }

  // tenantId 미지정: 전역 규칙만 반환
  return db
    .select()
    .from(knowledgeBlockRules)
    .where(
      eq(knowledgeBlockRules.isActive, true)
    )
    .orderBy(desc(knowledgeBlockRules.createdAt))
    .then((rows) => rows.filter((r) => r.tenantId === null));
}

// ============================================================
// 요청(입력) 단계 키워드 거절 검사
// ------------------------------------------------------------
// 마스터 채팅 / 상품생성 / 업체 LLM 등 사용자·업체 요청 입력에
// 타 데스크 지식 키워드가 포함되면, 해당 요청을 처리하지 않고
// "규정상 답변할 수 없는 키워드 포함" 거절 응답을 반환한다.
// (지식 차단 이력은 동일하게 DB에 기록된다.)
// ============================================================
export interface RequestRejectionResult {
  rejected: boolean;
  matchedKeywords: string[];
  ruleNames: string[];
  /** 사용자에게 보여줄 거절 메시지 (rejected=false이면 빈 문자열) */
  rejectionMessage: string;
}

/**
 * 사용자/업체 요청 텍스트를 검사하여, 타 데스크 지식 차단 키워드가
 * 포함되어 있으면 거절 결과를 반환한다.
 *
 * DEFAULT_BLOCK_RULES(하드코딩) + DB에 등록된 사용자 정의 규칙을 모두 적용한다.
 *
 * @param requestText 검사할 요청 원문
 */
export async function checkRequestForBlockedKeywords(
  requestText: string,
  tenantId?: number | null
): Promise<RequestRejectionResult> {
  const text = requestText || "";
  const matchedKeywords: string[] = [];
  const ruleNames = new Set<string>();

  // 1) 기본 하드코딩 규칙 검사
  for (const rule of DEFAULT_BLOCK_RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) {
        matchedKeywords.push(keyword);
        ruleNames.add(rule.ruleName);
      }
    }
  }

  // 2) DB 사용자 정의 규칙 검사 (전역 + 해당 업체 규칙)
  try {
    const dbRules = await getBlockRules(tenantId);
    for (const rule of dbRules) {
      const keywords = rule.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      for (const keyword of keywords) {
        if (keyword && text.includes(keyword)) {
          matchedKeywords.push(keyword);
          ruleNames.add(rule.ruleName);
        }
      }
    }
  } catch {
    // DB 조회 실패 시 기본 규칙만으로 진행
  }

  const rejected = matchedKeywords.length > 0;
  // 중복 키워드 제거
  const uniqueKeywords = Array.from(new Set(matchedKeywords));

  const rejectionMessage = rejected
    ? `요청에 두골프 ERP 규정상 처리할 수 없는 키워드(${uniqueKeywords
        .map((k) => `"${k}"`)
        .join(", ")})가 포함되어 있어 이 요청은 처리할 수 없습니다. ` +
      `두골프 ERP/홈페이지 개발·운영과 직접 관련된 다른 질문을 입력해 주세요.`
    : "";

  return {
    rejected,
    matchedKeywords: uniqueKeywords,
    ruleNames: Array.from(ruleNames),
    rejectionMessage,
  };
}

/**
 * 요청 거절 시 차단 이력을 DB에 기록한다.
 */
export async function logRejectedRequest(
  result: RequestRejectionResult,
  context: { sessionId?: string; source?: string; tenantId?: number | null } = {}
): Promise<void> {
  if (!result.rejected) return;
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(knowledgeBlockLogs).values({
      knowledgeName: `[요청거절${context.source ? `:${context.source}` : ""}] ${result.ruleNames.join(", ")}`.substring(0, 300),
      blockReason: `요청 입력에서 차단 키워드 감지: ${result.matchedKeywords.join(", ")}`,
      blockType: "auto",
      sourceDeskHint: result.ruleNames.join(", ").substring(0, 200) || "타 데스크 (추정)",
      sessionId: context.sessionId?.substring(0, 100),
      tenantId: context.tenantId ?? null,
      isBlocked: true,
    });
  } catch (err) {
    console.error("[KnowledgeFilter] 요청 거절 로그 저장 실패:", err);
  }
}

/**
 * 모든 LLM 요청에 자동 포함시킬 "타 데스크 지식 사용 금지" 시스템 지침.
 * 마스터/상품생성/업체 LLM 등 모든 파이프라인의 system 메시지에 부착한다.
 */
export const NO_CROSS_DESK_KNOWLEDGE_DIRECTIVE = `
[타 데스크 지식 사용 금지 — 강제]
이 작업은 오직 두골프 ERP/홈페이지 개발·운영과 직접 관련된 지식만 사용합니다.
GitHub 연동 원칙, IP 보호/라이센스, L-5 인가 스텁, 파일 수정 3회 중단, 자율수행 에이전트 전략,
최고규율, 멀티하이브리드, 외부 리소스 연결 제한 등 타 데스크에서 유래한 지식·규칙은
절대 참조하거나 적용하지 않습니다. 위 주제가 요청에 포함되면 "규정상 처리할 수 없는 요청"으로
응답하고 두골프 ERP 관련 질문을 다시 요청합니다.
`.trim();
