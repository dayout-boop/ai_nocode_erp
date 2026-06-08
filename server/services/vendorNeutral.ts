/**
 * 탈마누스 자립전환(Vendor-Neutral Decoupling) 상태 진단 [STEP5 §2~3]
 * ------------------------------------------------------------------
 * 마누스 결제 중단/서버 이전 상황에서 두골프 서버가 자체 LLM 키로 무중단
 * 구동 가능한지 점검한다. 보안 원칙상 키 원문은 절대 반환하지 않으며,
 * 설정 여부(boolean) + 마스킹 미리보기만 노출한다.
 *
 *  - currentMode : 현재 LLM 호출이 어느 통로를 타는지
 *  - readiness   : Phase4(완전 자립) 도달 준비도 점수
 *  - roadmap     : Phase 1~4 로드맵 정의(사양 §2~3)
 */
import { ENV } from "../_core/env";

export type NeutralMode =
  | "MANUS_GATEWAY" // Phase 1~2: 마누스 게이트웨이 경유 (기본)
  | "NEUTRAL_ANTHROPIC" // Phase 4: 오너 Anthropic 키 직결
  | "NEUTRAL_GEMINI"; // 과도기: NEUTRAL 모드지만 provider 미지정 → Gemini 직결

export interface NeutralReadinessItem {
  key: string;
  label: string;
  ready: boolean;
  hint: string;
}

export interface NeutralStatus {
  currentMode: NeutralMode;
  neutralEnabled: boolean;
  targetProvider: string;
  readiness: NeutralReadinessItem[];
  readinessScore: number; // 0~100
  phase: 1 | 2 | 3 | 4;
  phaseLabel: string;
}

/** 키 마스킹: 원문 노출 금지, 설정 여부만 */
function isSet(v: string | undefined | null): boolean {
  return !!v && v.trim().length > 0;
}

/** 현재 LLM 호출 통로 판정 — agentEngine.neutralLLMCall 분기와 동일 규칙 */
export function resolveCurrentMode(): NeutralMode {
  if (ENV.aiVendNeutralMode === "true") {
    if (ENV.targetLlmProvider === "ANTHROPIC" && isSet(ENV.anthropicApiKey)) {
      return "NEUTRAL_ANTHROPIC";
    }
    return "NEUTRAL_GEMINI";
  }
  return "MANUS_GATEWAY";
}

/**
 * 자립전환 준비도 점검.
 * Phase4(완전 독립)에 필요한 자산이 모두 갖춰졌는지 평가.
 */
export function getNeutralStatus(): NeutralStatus {
  const currentMode = resolveCurrentMode();
  const neutralEnabled = ENV.aiVendNeutralMode === "true";

  const readiness: NeutralReadinessItem[] = [
    {
      key: "OWN_LLM_KEY",
      label: "오너 자체 LLM 키 보유",
      ready: isSet(ENV.anthropicApiKey) || isSet(ENV.geminiApiKey),
      hint: "ANTHROPIC_API_KEY 또는 GEMINI_API_KEY 중 하나 이상 설정",
    },
    {
      key: "GIT_ENGINE",
      label: "서버 내장 Git 엔진 자립 가동",
      ready: isSet(ENV.engineApiKey),
      hint: "ENGINE_API_KEY 설정 시 Changeset 입구가 마누스 없이 동작",
    },
    {
      key: "HEARTBEAT",
      label: "자립형 Heartbeat 크론 토큰",
      ready: isSet(ENV.heartbeatSecretKey),
      hint: "HEARTBEAT_SECRET_KEY 설정 시 crontab 한 줄로 영구 자립 점검",
    },
    {
      key: "NEUTRAL_SWITCH",
      label: "탈벤더 스위치 활성",
      ready: neutralEnabled,
      hint: "AI_VEND_NEUTRAL_MODE=true 시 마누스 게이트웨이 우회",
    },
  ];

  const readyCount = readiness.filter((r) => r.ready).length;
  const readinessScore = Math.round((readyCount / readiness.length) * 100);

  // Phase 판정: 사양 §2~3 로드맵에 매핑
  let phase: 1 | 2 | 3 | 4 = 1;
  let phaseLabel = "Phase 1 — 마누스 통개발(의존도 100%)";
  if (neutralEnabled && currentMode === "NEUTRAL_ANTHROPIC" && readinessScore === 100) {
    phase = 4;
    phaseLabel = "Phase 4 — 완전 독립 자립(마누스 의존 0%)";
  } else if (readiness.find((r) => r.key === "GIT_ENGINE")?.ready && readiness.find((r) => r.key === "HEARTBEAT")?.ready) {
    phase = 3;
    phaseLabel = "Phase 3 — 수동 승인·오딧 전담(의존도 10% 미만)";
  } else if (readiness.find((r) => r.key === "GIT_ENGINE")?.ready) {
    phase = 2;
    phaseLabel = "Phase 2 — 코드조각 생성 국한(과도기, API 50% 절감)";
  }

  return {
    currentMode,
    neutralEnabled,
    targetProvider: ENV.targetLlmProvider || "(미지정 → Gemini 폴백)",
    readiness,
    readinessScore,
    phase,
    phaseLabel,
  };
}

/** 로드맵 정의(사양 §2~3 표 그대로) — 마스터 화면 안내용 */
export const NEUTRAL_ROADMAP = [
  {
    phase: 1,
    title: "마누스 통개발 단계",
    period: "초기 1~2개월",
    manusRole: "인프라 가이드·모듈 뼈대 대량 작성(의존 100%)",
    selfRange: "파이프라인 물리 빌드 + DB 메타 스키마 정착(월 고정 인프라비)",
  },
  {
    phase: 2,
    title: "코드 조각 작성 국한 단계",
    period: "과도기 1개월",
    manusRole: "저장소·파이프라인 제어권 박탈, 소스블록 텍스트 생성만",
    selfRange: "서버 Git 엔진 형상관리 독점, 마누스 API 호출 50% 절감",
  },
  {
    phase: 3,
    title: "수동 승인·오딧 전담 단계",
    period: "자립 이행기",
    manusRole: "단순 로직 구현 지원(의존 10% 미만 수렴)",
    selfRange: "4종 자가점검 봇 + Heartbeat 트리거 독자 무결성 제어",
  },
  {
    phase: 4,
    title: "완전 독립 자립 단계",
    period: "최종 목표",
    manusRole: "전면 영구 차단(구독 취소 / 비용 0원)",
    selfRange: "로컬 셸 + 오너 고유 LLM 키(종량제 수만 원)로 무한 구동",
  },
] as const;
