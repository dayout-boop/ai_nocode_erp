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
import { eq, desc } from "drizzle-orm";

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
  sessionId?: string
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
 */
export async function getBlockRules() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(knowledgeBlockRules)
    .where(eq(knowledgeBlockRules.isActive, true))
    .orderBy(desc(knowledgeBlockRules.createdAt));
}
