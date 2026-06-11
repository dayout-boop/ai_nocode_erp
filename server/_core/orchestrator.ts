/**
 * AI ERP 중앙 AI 오케스트레이터
 *
 * 작업 복잡도에 따라 최적 모델을 자동 선택하고 OpenRouter를 통해 호출합니다.
 *
 * 라우팅 전략:
 *  SIMPLE   → GPT-4o mini (텍스트 요약, 해시태그, 데이터 분류)
 *  MODERATE → Gemini 1.5 Pro (요금표 분석, 일정 최적화, 리포트)
 *  COMPLEX  → Claude 3.5 Sonnet (상세페이지 설계, 복잡한 생성 작업)
 */

import { ENV } from "./env";
import { createHash } from "crypto";

// ────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────────────────────

export type TaskComplexity = "SIMPLE" | "MODERATE" | "COMPLEX";

export type TaskType =
  | "text_summary"       // 텍스트 요약
  | "hashtag_gen"        // SNS 해시태그 생성
  | "data_classify"      // 데이터 분류
  | "price_analysis"     // 요금표 분석
  | "schedule_optimize"  // 일정 최적화
  | "report_gen"         // 리포트 생성
  | "content_create"     // 상세페이지/콘텐츠 생성
  | "layout_design"      // 레이아웃 설계
  | "code_review"        // 코드 리뷰
  | "auto";              // 자동 감지

export interface OrchestratorMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OrchestratorOptions {
  taskType?: TaskType;
  /** 복잡도를 직접 지정 (taskType보다 우선) */
  complexity?: TaskComplexity;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  /** 프롬프트 캐싱 사용 여부 (기본: true) */
  useCache?: boolean;
  /** Llama 3.1 8B 무료 모델 사용 (비용 절감용, SIMPLE 등급에만 적용) */
  useFreeModel?: boolean;
}

export interface OrchestratorResult {
  text: string;
  model: string;
  complexity: TaskComplexity;
  taskType: TaskType;
  inputTokens: number;
  outputTokens: number;
  /** USD 단위 예상 비용 */
  costUsd: number;
  /** 캐시 히트 여부 */
  cacheHit: boolean;
  /** 캐시로 절약된 비용 (USD) */
  cacheSavedUsd: number;
  durationMs: number;
}

// ────────────────────────────────────────────────────────────────────────────
// 모델 카탈로그 (OpenRouter 모델 ID + 단가)
// ────────────────────────────────────────────────────────────────────────────

interface ModelConfig {
  id: string;
  name: string;
  complexity: TaskComplexity;
  /** 입력 토큰 단가 (USD per 1M tokens) */
  inputPricePerMillion: number;
  /** 출력 토큰 단가 (USD per 1M tokens) */
  outputPricePerMillion: number;
  /** 캐시 입력 토큰 단가 (USD per 1M tokens, 없으면 일반 단가 사용) */
  cachedInputPricePerMillion?: number;
  description: string;
}

/** SIMPLE 등급 폴백 모델 (무료) */
export const LLAMA_FREE_MODEL: ModelConfig = {
  id: "meta-llama/llama-3.1-8b-instruct:free",
  name: "Llama 3.1 8B (Free)",
  complexity: "SIMPLE",
  inputPricePerMillion: 0,
  outputPricePerMillion: 0,
  description: "무료 모델 - 간단한 요약/분류 작업에 활용",
};

export const MODEL_CATALOG: Record<TaskComplexity, ModelConfig> = {
  SIMPLE: {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o mini",
    complexity: "SIMPLE",
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    cachedInputPricePerMillion: 0.075,
    description: "텍스트 요약, 해시태그, 데이터 분류 등 저부하 작업",
  },
  MODERATE: {
    id: "google/gemini-pro-1.5",
    name: "Gemini 1.5 Pro",
    complexity: "MODERATE",
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.00,
    cachedInputPricePerMillion: 0.3125,
    description: "요금표 분석, 일정 최적화, 리포트 생성 등 중간 복잡도 작업",
  },
  COMPLEX: {
    id: "anthropic/claude-3.5-sonnet-20241022",
    name: "Claude 3.5 Sonnet (Oct 2024)",
    complexity: "COMPLEX",
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    cachedInputPricePerMillion: 0.30,
    description: "상세페이지 설계, 복잡한 콘텐츠 생성, 코드 리뷰 등 고부하 작업",
  },
};

// ────────────────────────────────────────────────────────────────────────────
// 작업 유형 → 복잡도 매핑
// ────────────────────────────────────────────────────────────────────────────

const TASK_COMPLEXITY_MAP: Record<TaskType, TaskComplexity> = {
  text_summary: "SIMPLE",
  hashtag_gen: "SIMPLE",
  data_classify: "SIMPLE",
  price_analysis: "MODERATE",
  schedule_optimize: "MODERATE",
  report_gen: "MODERATE",
  content_create: "COMPLEX",
  layout_design: "COMPLEX",
  code_review: "COMPLEX",
  auto: "MODERATE", // 자동 감지 기본값
};

// ────────────────────────────────────────────────────────────────────────────
// 자동 복잡도 감지 (키워드 기반)
// ────────────────────────────────────────────────────────────────────────────

const SIMPLE_KEYWORDS = [
  "요약", "정리", "분류", "태그", "해시태그", "번역", "간단", "짧게",
  "summary", "classify", "tag", "translate", "brief",
];

const COMPLEX_KEYWORDS = [
  "설계", "디자인", "레이아웃", "코드", "개발", "구현", "생성", "작성",
  "상세페이지", "랜딩페이지", "리뷰", "검토",
  "design", "layout", "code", "implement", "create", "generate", "review",
];

export function detectComplexity(prompt: string): TaskComplexity {
  const lower = prompt.toLowerCase();

  const simpleScore = SIMPLE_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  const complexScore = COMPLEX_KEYWORDS.filter((kw) => lower.includes(kw)).length;

  if (complexScore > 0) return "COMPLEX";
  if (simpleScore > 0) return "SIMPLE";

  // 프롬프트 길이 기반 휴리스틱
  if (prompt.length < 100) return "SIMPLE";
  if (prompt.length > 500) return "COMPLEX";
  return "MODERATE";
}

// ────────────────────────────────────────────────────────────────────────────
// 프롬프트 캐시 (인메모리, 시스템 프롬프트 기반)
// ────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  response: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10분
const promptCache = new Map<string, CacheEntry>();

function getCacheKey(
  systemPrompt: string,
  userMessage: string,
  model: string
): string {
  return createHash("sha256")
    .update(`${model}::${systemPrompt}::${userMessage}`)
    .digest("hex");
}

function getFromCache(key: string): CacheEntry | null {
  const entry = promptCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    promptCache.delete(key);
    return null;
  }
  return entry;
}

function setCache(key: string, entry: CacheEntry): void {
  // 캐시 크기 제한 (최대 200개)
  if (promptCache.size >= 200) {
    const entries = Array.from(promptCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    if (entries[0]) promptCache.delete(entries[0][0]);
  }
  promptCache.set(key, entry);
}

export function getCacheStats(): { size: number; keys: string[] } {
  return { size: promptCache.size, keys: Array.from(promptCache.keys()) };
}

export function clearCache(): void {
  promptCache.clear();
}

// ────────────────────────────────────────────────────────────────────────────
// OpenRouter API 호출
// ────────────────────────────────────────────────────────────────────────────

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

/** COMPLEX 등급 폴백 모델 목록 (404 발생 시 순서대로 시도) */
const COMPLEX_FALLBACK_MODELS: string[] = [
  "anthropic/claude-3.5-sonnet-20241022",
  "anthropic/claude-3.7-sonnet",
  "google/gemini-pro-1.5",
];

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

async function callOpenRouter(
  modelId: string,
  messages: OrchestratorMessage[],
  options: { maxTokens?: number; temperature?: number }
): Promise<OpenRouterResponse> {
  const apiKey = ENV.openrouterApiKey;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY가 설정되지 않았습니다.");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://dayoutgolf.com",
          "X-Title": "DOGOLF ERP AI Orchestrator",
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          max_tokens: options.maxTokens ?? 2048,
          temperature: options.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        const isRetryable = res.status === 503 || res.status === 429 || res.status === 500;

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = (attempt + 1) * 1500;
          console.warn(
            `[Orchestrator] ${modelId} ${res.status} 에러 - ${delay}ms 후 재시도 (${attempt + 1}/${MAX_RETRIES})`
          );
          await new Promise((r) => setTimeout(r, delay));
          lastError = new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
          continue;
        }

        // 404: 모델 엔드포인트 없음 → 폴백 모델 목록에서 순서대로 재시도
        if (res.status === 404) {
          const fallbacks = COMPLEX_FALLBACK_MODELS.filter((m) => m !== modelId);
          for (const fallbackId of fallbacks) {
            console.warn(`[Orchestrator] ${modelId} 404 - 폴백 모델 ${fallbackId} 시도`);
            try {
              const fbRes = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "https://dayoutgolf.com",
                  "X-Title": "DOGOLF ERP AI Orchestrator",
                },
                body: JSON.stringify({
                  model: fallbackId,
                  messages,
                  max_tokens: options.maxTokens ?? 2048,
                  temperature: options.temperature ?? 0.7,
                }),
              });
              if (fbRes.ok) {
                console.info(`[Orchestrator] 폴백 성공: ${fallbackId}`);
                return (await fbRes.json()) as OpenRouterResponse;
              }
            } catch {
              // 폴백도 실패하면 다음 폴백 시도
            }
          }
        }

        throw new Error(`OpenRouter API 오류 [${res.status}]: ${errBody.slice(0, 300)}`);
      }

      return (await res.json()) as OpenRouterResponse;
    } catch (err: unknown) {
      clearTimeout(timer);

      const isAbort = err instanceof Error && err.name === "AbortError";
      const isRetryable = isAbort || (err instanceof Error && err.message.includes("503"));

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 1500;
        console.warn(
          `[Orchestrator] ${modelId} ${isAbort ? "타임아웃" : "네트워크 오류"} - ${delay}ms 후 재시도 (${attempt + 1}/${MAX_RETRIES})`
        );
        await new Promise((r) => setTimeout(r, delay));
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }

      throw err;
    }
  }

  throw lastError ?? new Error("OpenRouter 호출 실패");
}

// ────────────────────────────────────────────────────────────────────────────
// 비용 계산
// ────────────────────────────────────────────────────────────────────────────

export function calculateCost(
  model: ModelConfig,
  inputTokens: number,
  outputTokens: number,
  cacheHit: boolean
): { costUsd: number; cacheSavedUsd: number } {
  const inputRate = cacheHit
    ? (model.cachedInputPricePerMillion ?? model.inputPricePerMillion)
    : model.inputPricePerMillion;

  const costUsd =
    (inputTokens / 1_000_000) * inputRate +
    (outputTokens / 1_000_000) * model.outputPricePerMillion;

  const savedRate = model.inputPricePerMillion - inputRate;
  const cacheSavedUsd = cacheHit ? (inputTokens / 1_000_000) * savedRate : 0;

  return { costUsd, cacheSavedUsd };
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 오케스트레이터 함수
// ────────────────────────────────────────────────────────────────────────────

export async function orchestrate(
  userMessage: string,
  options: OrchestratorOptions = {}
): Promise<OrchestratorResult> {
  const startTime = Date.now();

  // 1. 복잡도 결정
  let complexity: TaskComplexity;
  if (options.complexity) {
    complexity = options.complexity;
  } else if (options.taskType && options.taskType !== "auto") {
    complexity = TASK_COMPLEXITY_MAP[options.taskType];
  } else {
    complexity = detectComplexity(userMessage);
  }

  const taskType: TaskType = options.taskType ?? "auto";
  // useFreeModel=true이고 SIMPLE 등급일 때 Llama 3.1 8B 무료 모델 사용
  const modelConfig = (options.useFreeModel && complexity === "SIMPLE")
    ? LLAMA_FREE_MODEL
    : MODEL_CATALOG[complexity];

  // 2. 시스템 프롬프트
  const systemPrompt =
    options.systemPrompt ??
    `당신은 두골프(DOGOLF) 골프투어 여행사의 전문 AI 어시스턴트입니다.
골프 패키지, 예약 관리, 고객 서비스, 마케팅 콘텐츠 등 골프 여행 관련 모든 업무를 지원합니다.
항상 전문적이고 친절한 한국어로 답변하세요.`;

  // 3. 캐시 확인
  const useCache = options.useCache !== false;
  const cacheKey = getCacheKey(systemPrompt, userMessage, modelConfig.id);
  const cached = useCache ? getFromCache(cacheKey) : null;

  if (cached) {
    const { costUsd, cacheSavedUsd } = calculateCost(
      modelConfig,
      cached.inputTokens,
      cached.outputTokens,
      true
    );
    return {
      text: cached.response,
      model: cached.model,
      complexity,
      taskType,
      inputTokens: cached.inputTokens,
      outputTokens: cached.outputTokens,
      costUsd,
      cacheHit: true,
      cacheSavedUsd,
      durationMs: Date.now() - startTime,
    };
  }

  // 4. OpenRouter 호출
  const messages: OrchestratorMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  const response = await callOpenRouter(modelConfig.id, messages, {
    maxTokens: options.maxTokens,
    temperature: options.temperature,
  });

  const text = response.choices[0]?.message?.content ?? "";
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;

  // 5. 캐시 저장
  if (useCache) {
    setCache(cacheKey, {
      response: text,
      model: response.model ?? modelConfig.id,
      inputTokens,
      outputTokens,
      timestamp: Date.now(),
    });
  }

  // 6. 비용 계산
  const { costUsd, cacheSavedUsd } = calculateCost(
    modelConfig,
    inputTokens,
    outputTokens,
    false
  );

  return {
    text,
    model: response.model ?? modelConfig.id,
    complexity,
    taskType,
    inputTokens,
    outputTokens,
    costUsd,
    cacheHit: false,
    cacheSavedUsd,
    durationMs: Date.now() - startTime,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 모델 가격 정보 조회
// ────────────────────────────────────────────────────────────────────────────

export function getModelPricing(): ModelConfig[] {
  return [...Object.values(MODEL_CATALOG), LLAMA_FREE_MODEL];
}
