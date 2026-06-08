/**
 * 단일 runAgent 엔진 [STEP2 / STEP5 §3.1]
 * ------------------------------------------------------------------
 * 4창구(master/manager/golftalk/assistant)를 단일 진입점으로 통합하되,
 * 물리적 외부 경계선(도구 격리)과 partner_id 강제 잠금을 코드 레벨에서 강제한다.
 *
 *  - master_engine : 외부 결합 도구(web_search, fetch_url, read_core_db, execute_git_engine) 인가
 *  - manager_engine: 외부 도구 배열 자체를 빈 값으로 동결 (실시간 웹/외부 API 차단)
 *  - golftalk_engine: 외부 도구 동결 (트래픽 폭주 시 외부 API 비용 0%)
 *  - assistant_engine: 내부 처리 전용 (정적 파일·서비스 DB 읽기만)
 *
 * 탈마누스(벤더 중립): AI_VEND_NEUTRAL_MODE='true' 이면 마누스 게이트웨이를 건너뛰고
 * 오너 보유 LLM 키(Anthropic 또는 Gemini 직결)로 0.1초 우회 전환.
 */
import { geminiChat, DOGOLF_SYSTEM_CONTEXT } from "../_core/gemini";
import { ENV } from "../_core/env";

export type AgentId = "master_engine" | "manager_engine" | "golftalk_engine" | "assistant_engine";
export type AgentRole = "MASTER" | "MANAGER" | "GOLFTALK" | "SYSTEM";

export interface AgentContext {
  /** 호출자 고유 식별자 (마스터ID / 파트너ID / 고객ID) */
  callerId: string;
  /** manager 및 golftalk 호출 시 강제 구속되는 파트너 ID */
  partnerId?: string;
  role: AgentRole;
}

export interface AgentResponse {
  success: boolean;
  responseTexts: string;
  tokensUsed: number;
  error?: string;
  /** 디버깅용: 실제 주입된 도구 이름 목록 (격리 검증) */
  toolsInjected: string[];
}

/** 에이전트별 권한 계층 매핑 */
const AGENT_ROLE: Record<AgentId, AgentRole> = {
  master_engine: "MASTER",
  manager_engine: "MANAGER",
  golftalk_engine: "GOLFTALK",
  assistant_engine: "SYSTEM",
};

/**
 * STEP2 §2.2 — 도구 인스턴스화 차단 팩토리 (하드코딩 게이트).
 * 오직 MASTER 계층에만 외부 결합 도구 주입. 그 외는 빈 배열로 동결.
 */
export class AgentEngineFactory {
  static resolveTools(role: AgentRole): string[] {
    if (role === "MASTER") {
      return ["web_search", "fetch_url_content", "read_core_db", "execute_git_engine"];
    }
    if (role === "SYSTEM") {
      // 내부 크론·정적 파일시스템 연동만
      return ["read_service_db", "file_cache_reader"];
    }
    // manager, golftalk: 외부 호출 원천 방어 — 도구 배열 동결
    return role === "MANAGER"
      ? ["read_service_db", "write_service_db"]
      : ["read_service_db", "generate_text_reply"];
  }

  /** 외부(유료) 결합 도구가 포함되었는지 검사 — 비-MASTER 누수 차단 */
  static hasExternalTool(tools: string[]): boolean {
    const external = ["web_search", "fetch_url_content", "execute_git_engine"];
    return tools.some((t) => external.includes(t));
  }
}

/**
 * partner_id 강제 세션 잠금 — manager/golftalk 는 partnerId 없으면 즉시 차단.
 * 실제 Drizzle 쿼리 프록시는 호출처에서 context.partnerId 를 where 절에 강제 바인딩한다.
 */
export function enforcePartnerLock(context: AgentContext): void {
  if (context.role !== "MASTER" && context.role !== "SYSTEM" && !context.partnerId) {
    throw new Error("보안 위반: 파트너 컨텍스트 식별자가 존재하지 않습니다.");
  }
}

/** 에이전트별 시스템 프롬프트 (경계선 명시) */
function buildSystemContext(agentId: AgentId, context: AgentContext): string {
  const base = DOGOLF_SYSTEM_CONTEXT;
  switch (agentId) {
    case "master_engine":
      return `${base}\n\n[역할] 당신은 두골프 마스터(대표) 전용 엔진입니다. 전체 자원 접근이 허용됩니다.`;
    case "manager_engine":
      return `${base}\n\n[역할] 당신은 입점사(파트너 #${context.partnerId}) 전용 매니저 엔진입니다. 외부 웹검색/외부 API는 사용할 수 없으며, 본인 파트너 데이터만 다룹니다.`;
    case "golftalk_engine":
      return `${base}\n\n[역할] 당신은 고객용 골프톡 상담 엔진입니다. 외부 도구 없이 서비스 DB 정보와 텍스트 답변만 제공합니다. 파트너 #${context.partnerId} 범위로 한정됩니다.`;
    case "assistant_engine":
      return `${base}\n\n[역할] 당신은 내부 시스템 처리 엔진입니다. 정적 파일·서비스 DB 읽기만 수행합니다.`;
  }
}

/**
 * STEP5 §3.1 — 탈벤더 LLM 호출 래퍼.
 * NEUTRAL 모드면 오너 키 직결(Anthropic/Gemini), 아니면 기존 마누스/Gemini 게이트웨이.
 * (Anthropic SDK 미설치 환경에서도 빌드가 깨지지 않도록 동적 호출 방식 사용)
 */
async function neutralLLMCall(prompt: string, systemContext: string, temperature: number): Promise<{ text: string; tokens: number }> {
  if (ENV.aiVendNeutralMode === "true" && ENV.targetLlmProvider === "ANTHROPIC" && ENV.anthropicApiKey) {
    // 마누스 게이트웨이 우회 — Anthropic Messages API 직결 (네이티브 fetch, SDK 의존 0)
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ENV.anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        system: systemContext,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`[NeutralLLM/Anthropic] ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as any;
    const text = (data.content ?? []).map((b: any) => b.text ?? "").join("");
    const tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
    return { text, tokens };
  }
  // 기본 경로: 기존 Gemini 헬퍼(마누스/Vertex/Studio 폴백 내장)
  const result = await geminiChat({
    messages: [{ role: "user", content: prompt }],
    systemContext,
    temperature,
  });
  if (result.errorMessage) throw new Error(result.errorMessage);
  // Gemini 헬퍼는 토큰 카운트를 직접 반환하지 않으므로 근사치(문자수/4) 사용
  return { text: result.text, tokens: Math.ceil((prompt.length + result.text.length) / 4) };
}

/**
 * 단일 핵심 라우터 — STEP2 §1 시그니처.
 */
export async function runAgent(
  agentId: AgentId,
  prompt: string,
  context: AgentContext,
): Promise<AgentResponse> {
  const role = AGENT_ROLE[agentId];

  // 1) 컨텍스트 역할 정합성 검사
  if (context.role !== role) {
    return {
      success: false, responseTexts: "", tokensUsed: 0, toolsInjected: [],
      error: `역할 불일치: agentId=${agentId}(${role}) ≠ context.role=${context.role}`,
    };
  }

  // 2) partner_id 강제 잠금
  try {
    enforcePartnerLock(context);
  } catch (err: any) {
    return { success: false, responseTexts: "", tokensUsed: 0, toolsInjected: [], error: err.message };
  }

  // 3) 도구 격리 — 비-MASTER 에 외부 도구가 새어들어가면 즉시 차단
  const tools = AgentEngineFactory.resolveTools(role);
  if (role !== "MASTER" && AgentEngineFactory.hasExternalTool(tools)) {
    return {
      success: false, responseTexts: "", tokensUsed: 0, toolsInjected: tools,
      error: "보안 위반: 비-마스터 엔진에 외부 결합 도구 주입이 감지되었습니다.",
    };
  }

  // 4) LLM 호출 (탈벤더 스위치 경유)
  try {
    const systemContext = buildSystemContext(agentId, context);
    const { text, tokens } = await neutralLLMCall(prompt, systemContext, 0.2);
    return { success: true, responseTexts: text, tokensUsed: tokens, toolsInjected: tools };
  } catch (err: any) {
    return { success: false, responseTexts: "", tokensUsed: 0, toolsInjected: tools, error: err.message };
  }
}
