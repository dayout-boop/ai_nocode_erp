/**
 * 두골프-AI개발 엔진 통합 AI 서비스
 *
 * 보안 설계 원칙:
 *  - @google/generative-ai 직접 호출 금지 → API 키 서버 측 격리
 *  - 모든 AI 호출은 invokeLLM(Manus 내장 API) 또는 orchestrate(OpenRouter)를 통해서만 수행
 *  - 입력값은 z.string().max() 스키마로 검증 후 전달
 *
 * 모델 라우팅 전략 (비용 최적화):
 *  - 분류/분석 (SIMPLE)   → Llama 3.1 8B Free (무료)
 *  - 문서 생성 (MODERATE) → Gemini 1.5 Pro via orchestrate
 *  - 릴리즈 노트 (COMPLEX) → Claude 3.5 Sonnet via orchestrate (404 시 자동 폴백)
 */
import { invokeLLM } from "./llm";
import { orchestrate } from "./orchestrator";

// ────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────────────────────
export type DevRequestCategory = "BUG" | "FEATURE" | "IMPROVEMENT" | "REFACTOR";
export type DevRequestPriority = "low" | "medium" | "high" | "critical";

export interface AIRequestAnalysis {
  category: DevRequestCategory;
  priority: DevRequestPriority;
  estimatedHours: number;
  suggestedTeam: string;
  analysis: string;
}

export interface AIDocumentationResult {
  content: string;
  model?: string;
  durationMs?: number;
}

export interface NaturalLanguageRequest {
  title: string;
  description: string;
  category: DevRequestCategory;
  priority: DevRequestPriority;
}

// ────────────────────────────────────────────────────────────────────────────
// 입력 검증 헬퍼
// ────────────────────────────────────────────────────────────────────────────
function sanitizeInput(input: string, maxLength = 2000): string {
  // XSS/프롬프트 인젝션 방지: 특수 문자 이스케이프 및 길이 제한
  return input
    .replace(/[<>]/g, "")
    .replace(/\$/g, "\\$")
    .slice(0, maxLength)
    .trim();
}

function parseJsonSafely<T>(text: string, fallback: T): T {
  try {
    // AI 응답에서 JSON 블록만 추출
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ||
                      text.match(/\{[\s\S]*\}/) ||
                      text.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text;
    return JSON.parse(jsonStr.trim()) as T;
  } catch {
    return fallback;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 1. 개발 요청 자동 분석 (분류 + 우선순위 + 예상 공수 + 담당 팀)
// ────────────────────────────────────────────────────────────────────────────
export async function analyzeDevRequest(description: string): Promise<AIRequestAnalysis> {
  const safe = sanitizeInput(description, 1000);

  const fallback: AIRequestAnalysis = {
    category: "FEATURE",
    priority: "medium",
    estimatedHours: 8,
    suggestedTeam: "개발팀",
    analysis: "AI 분석 중 오류가 발생했습니다. 수동으로 분류해주세요.",
  };

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `당신은 AI ERP 시스템의 개발 요청을 분석하는 AI입니다.
반드시 다음 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
{
  "category": "BUG" | "FEATURE" | "IMPROVEMENT" | "REFACTOR",
  "priority": "low" | "medium" | "high" | "critical",
  "estimatedHours": <숫자, 1~200 사이>,
  "suggestedTeam": "프론트엔드" | "백엔드" | "디자인" | "인프라" | "풀스택" | "AI/ML",
  "analysis": "<200자 이내 한국어 분석 요약>"
}`,
        },
        {
          role: "user",
          content: `다음 개발 요청을 분석해주세요:\n\n"${safe}"`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "dev_request_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              category: { type: "string", enum: ["BUG", "FEATURE", "IMPROVEMENT", "REFACTOR"] },
              priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
              estimatedHours: { type: "integer" },
              suggestedTeam: { type: "string" },
              analysis: { type: "string" },
            },
            required: ["category", "priority", "estimatedHours", "suggestedTeam", "analysis"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content ?? "";
    const text = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const parsed = parseJsonSafely<AIRequestAnalysis>(text, fallback);

    // 유효성 검증
    const validCategories: DevRequestCategory[] = ["BUG", "FEATURE", "IMPROVEMENT", "REFACTOR"];
    const validPriorities: DevRequestPriority[] = ["low", "medium", "high", "critical"];
    if (!validCategories.includes(parsed.category)) parsed.category = "FEATURE";
    if (!validPriorities.includes(parsed.priority)) parsed.priority = "medium";
    if (typeof parsed.estimatedHours !== "number" || parsed.estimatedHours < 0) parsed.estimatedHours = 8;

    return parsed;
  } catch (error) {
    console.error("[geminiAIService] analyzeDevRequest error:", error);
    return fallback;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2. 자연어 명령 → 개발 요청 자동 변환
// ────────────────────────────────────────────────────────────────────────────
export async function processNaturalLanguageRequest(userInput: string): Promise<NaturalLanguageRequest> {
  const safe = sanitizeInput(userInput, 500);

  const fallback: NaturalLanguageRequest = {
    title: safe.slice(0, 100),
    description: safe,
    category: "FEATURE",
    priority: "medium",
  };

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `당신은 AI ERP 시스템의 개발 요청 생성 AI입니다.
사용자의 자연어 요청을 분석하여 반드시 다음 JSON 형식으로만 응답하세요:
{
  "title": "<간결하고 명확한 제목, 최대 100자>",
  "description": "<상세한 요청 설명, 최대 500자>",
  "category": "BUG" | "FEATURE" | "IMPROVEMENT" | "REFACTOR",
  "priority": "low" | "medium" | "high" | "critical"
}`,
        },
        {
          role: "user",
          content: `다음 자연어 요청을 개발 요청 형식으로 변환해주세요:\n\n"${safe}"`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "natural_language_request",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              category: { type: "string", enum: ["BUG", "FEATURE", "IMPROVEMENT", "REFACTOR"] },
              priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
            },
            required: ["title", "description", "category", "priority"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content ?? "";
    const text = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const parsed = parseJsonSafely<NaturalLanguageRequest>(text, fallback);

    // 길이 제한 강제 적용
    parsed.title = (parsed.title ?? "").slice(0, 100);
    parsed.description = (parsed.description ?? "").slice(0, 500);

    return parsed;
  } catch (error) {
    console.error("[geminiAIService] processNaturalLanguageRequest error:", error);
    return fallback;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 3. 릴리즈 노트 자동 생성
// ────────────────────────────────────────────────────────────────────────────
export async function generateReleaseNotes(
  versionNumber: string,
  versionDescription: string,
  completedRequests: Array<{ title: string; description: string; category: string }>
): Promise<AIDocumentationResult> {
  const safeVersion = sanitizeInput(versionNumber, 20);
  const safeDesc = sanitizeInput(versionDescription, 500);
  const requestsText = completedRequests
    .slice(0, 50) // 최대 50개로 제한
    .map(r => `- [${r.category}] ${sanitizeInput(r.title, 100)}: ${sanitizeInput(r.description, 200)}`)
    .join("\n");

  try {
    const startMs = Date.now();
    const result = await orchestrate(
      `다음 정보를 바탕으로 AI ERP 릴리즈 노트를 작성해주세요.

버전: ${safeVersion}
버전 설명: ${safeDesc}

포함된 개발 요청:
${requestsText}

릴리즈 노트 형식:
1. ## 버전 개요 (간략한 소개)
2. ## 주요 기능 및 개선사항 (카테고리별 그룹화)
3. ## 버그 수정
4. ## 기타 변경사항

전문적이고 명확한 한국어로 작성해주세요.`,
      {
        taskType: "report_gen",
        systemPrompt: "당신은 AI ERP 시스템의 릴리즈 노트를 작성하는 기술 문서 전문가입니다.",
      }
    );
    return {
      content: result.text,
      model: result.model,
      durationMs: Date.now() - startMs,
    };
  } catch (error) {
    console.error("[geminiAIService] generateReleaseNotes error:", error);
    return {
      content: `# 릴리즈 노트: ${safeVersion}\n\n${safeDesc}\n\n## 포함된 변경사항\n\n${requestsText}\n\n*(AI 생성 중 오류가 발생했습니다. 수동으로 작성해주세요.)*`,
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4. 기능 기술 문서 초안 자동 생성
// ────────────────────────────────────────────────────────────────────────────
export async function generateFeatureDocumentation(
  featureTitle: string,
  featureDescription: string
): Promise<AIDocumentationResult> {
  const safeTitle = sanitizeInput(featureTitle, 100);
  const safeDesc = sanitizeInput(featureDescription, 1000);

  try {
    const startMs = Date.now();
    const result = await orchestrate(
      `다음 기능에 대한 AI ERP 기술 문서 초안을 작성해주세요.

기능 제목: ${safeTitle}
기능 설명: ${safeDesc}

문서 구조:
1. ## 개요
2. ## 주요 기능
3. ## 사용 방법 (단계별 설명)
4. ## 기술적 고려사항
5. ## 관련 기능 및 의존성

AI ERP 시스템에 적합한 전문적인 한국어로 작성해주세요.`,
      {
        taskType: "content_create",
        systemPrompt: "당신은 AI ERP 시스템의 기술 문서를 작성하는 전문 기술 작가입니다.",
      }
    );
    return {
      content: result.text,
      model: result.model,
      durationMs: Date.now() - startMs,
    };
  } catch (error) {
    console.error("[geminiAIService] generateFeatureDocumentation error:", error);
    return {
      content: `# ${safeTitle}\n\n## 개요\n\n${safeDesc}\n\n*(AI 생성 중 오류가 발생했습니다. 수동으로 작성해주세요.)*`,
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. 추천 파이프라인 생성 (오류 → 수정 → 검토 최적 경로 제안)
// ────────────────────────────────────────────────────────────────────────────
export interface PipelineRecommendation {
  steps: Array<{
    order: number;
    action: string;
    tool: string;
    estimatedMinutes: number;
    priority: "required" | "recommended" | "optional";
  }>;
  summary: string;
  estimatedTotalMinutes: number;
  costOptimizationTip: string;
}

export async function generatePipelineRecommendation(
  errorDescription: string,
  affectedModules: string[]
): Promise<PipelineRecommendation> {
  const safe = sanitizeInput(errorDescription, 500);
  const modules = affectedModules.slice(0, 10).map(m => sanitizeInput(m, 50)).join(", ");

  const fallback: PipelineRecommendation = {
    steps: [
      { order: 1, action: "오류 로그 분석", tool: "ErrorWatcher", estimatedMinutes: 2, priority: "required" },
      { order: 2, action: "AI 수정 코드 생성", tool: "AutoFixer", estimatedMinutes: 5, priority: "required" },
      { order: 3, action: "다단계 코드 검토", tool: "ReviewEngine", estimatedMinutes: 3, priority: "required" },
      { order: 4, action: "관리자 승인", tool: "AIDevEngine UI", estimatedMinutes: 2, priority: "required" },
    ],
    summary: "표준 4단계 자동 수정 파이프라인",
    estimatedTotalMinutes: 12,
    costOptimizationTip: "SIMPLE 등급 작업에 Llama 3.1 8B 무료 모델 사용으로 비용 절감 가능",
  };

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `당신은 AI ERP 시스템의 AI 개발 파이프라인 최적화 전문가입니다.
반드시 다음 JSON 형식으로만 응답하세요:
{
  "steps": [{"order": 1, "action": "...", "tool": "...", "estimatedMinutes": 5, "priority": "required"}],
  "summary": "...",
  "estimatedTotalMinutes": 15,
  "costOptimizationTip": "..."
}`,
        },
        {
          role: "user",
          content: `다음 오류에 대한 최적 수정 파이프라인을 제안해주세요:
오류: ${safe}
영향 모듈: ${modules}

사용 가능한 도구: ErrorWatcher, AutoFixer(Llama 무료/GPT-4o), ReviewEngine, 카카오 알림톡, Stripe 결제, Runway ML`,
        },
      ],
    });

    const rawContent = response.choices?.[0]?.message?.content ?? "";
    const text = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    return parseJsonSafely<PipelineRecommendation>(text, fallback);
  } catch {
    return fallback;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 인메모리 캐시 (TTL 기반)
// ────────────────────────────────────────────────────────────────────────────
interface CacheEntry {
  value: string;
  expiresAt: number;
}
const _cache = new Map<string, CacheEntry>();

function cacheGet(key: string): string | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry.value;
}

function cacheSet(key: string, value: string, ttlSeconds: number): void {
  if (ttlSeconds <= 0) return;
  _cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function makeCacheKey(taskType: string, input: string): string {
  // 단순 해시: taskType + 입력 앞 200자
  const raw = `${taskType}:${input.slice(0, 200)}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `${taskType}_${Math.abs(hash)}`;
}

// ────────────────────────────────────────────────────────────────────────────
// 데이터 익명화 헬퍼 (ai_interaction_logs 저장 전 적용)
// ────────────────────────────────────────────────────────────────────────────
export function anonymizeText(text: string): string {
  return text
    // 이메일 마스킹
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "[EMAIL]")
    // 한국 전화번호 마스킹
    .replace(/(\d{2,3})-?(\d{3,4})-?(\d{4})/g, (_, a, b, c) => `${a}-****-${c}`)
    // 여권번호 마스킹 (영문+숫자 9자리)
    .replace(/[A-Z]{1,2}\d{7,9}/g, "[PASSPORT]")
    // 주민등록번호 마스킹
    .replace(/\d{6}-?\d{7}/g, "[RRN]");
}

// ────────────────────────────────────────────────────────────────────────────
// 모델 라우팅 규칙 (DB 조회 전 기본값, 실제 운영 시 DB에서 오버라이드)
// ────────────────────────────────────────────────────────────────────────────
export type TaskType =
  | "chat"
  | "packageDesc"
  | "marketingCopy"
  | "inquiryReply"
  | "devAnalysis"
  | "releaseNote"
  | "featureDoc"
  | "pipelineRec";

const DEFAULT_MODEL_ROUTING: Record<TaskType, {
  primaryModel: string;
  fallbackModel: string;
  maxTokens: number;
  temperature: number;
  cacheTtlSeconds: number;
}> = {
  // 저부하 태스크 → 저가형 모델
  chat:          { primaryModel: "gemini-2.5-flash", fallbackModel: "gemini-1.5-flash", maxTokens: 4096, temperature: 0.7, cacheTtlSeconds: 0 },
  devAnalysis:   { primaryModel: "gemini-2.5-flash", fallbackModel: "gemini-1.5-flash", maxTokens: 1024, temperature: 0.3, cacheTtlSeconds: 300 },
  pipelineRec:   { primaryModel: "gemini-2.5-flash", fallbackModel: "gemini-1.5-flash", maxTokens: 1024, temperature: 0.4, cacheTtlSeconds: 600 },
  // 중간 부하 태스크 → 균형 모델
  packageDesc:   { primaryModel: "gemini-2.5-flash", fallbackModel: "gemini-1.5-pro",   maxTokens: 2048, temperature: 0.7, cacheTtlSeconds: 600 },
  marketingCopy: { primaryModel: "gemini-2.5-flash", fallbackModel: "gemini-1.5-pro",   maxTokens: 1024, temperature: 0.9, cacheTtlSeconds: 300 },
  inquiryReply:  { primaryModel: "gemini-2.5-flash", fallbackModel: "gemini-1.5-pro",   maxTokens: 1024, temperature: 0.5, cacheTtlSeconds: 0 },
  // 고부하 태스크 → 고성능 모델
  releaseNote:   { primaryModel: "gemini-1.5-pro",   fallbackModel: "gemini-2.5-flash", maxTokens: 4096, temperature: 0.4, cacheTtlSeconds: 0 },
  featureDoc:    { primaryModel: "gemini-1.5-pro",   fallbackModel: "gemini-2.5-flash", maxTokens: 4096, temperature: 0.5, cacheTtlSeconds: 0 },
};

export function getModelConfig(taskType: TaskType) {
  return DEFAULT_MODEL_ROUTING[taskType] ?? DEFAULT_MODEL_ROUTING.chat;
}

// ────────────────────────────────────────────────────────────────────────────
// 6. 상품 설명 초안 자동 생성
// ────────────────────────────────────────────────────────────────────────────
export interface PackageDescriptionResult {
  description: string;
  highlights: string[];
  includes: string[];
  excludes: string[];
  cacheHit: boolean;
  durationMs: number;
}

export async function generatePackageDescription(params: {
  title: string;
  country: string;
  duration?: string;
  roundCount?: number;
  region?: string;
  extraInfo?: string;
}): Promise<PackageDescriptionResult> {
  const safeTitle = sanitizeInput(params.title, 100);
  const safeCountry = sanitizeInput(params.country, 50);
  const safeDuration = sanitizeInput(params.duration ?? "", 50);
  const safeRegion = sanitizeInput(params.region ?? "", 100);
  const safeExtra = sanitizeInput(params.extraInfo ?? "", 500);

  const inputKey = `${safeTitle}|${safeCountry}|${safeDuration}|${safeRegion}|${params.roundCount ?? 2}`;
  const cfg = getModelConfig("packageDesc");
  const cacheKey = makeCacheKey("packageDesc", inputKey);

  const fallback: PackageDescriptionResult = {
    description: `${safeCountry} ${safeTitle} 골프 패키지입니다.`,
    highlights: ["전문 가이드 동행", "최고급 골프장 라운딩", "편안한 숙박 제공"],
    includes: ["항공료", "숙박비", "라운딩 그린피"],
    excludes: ["개인 경비", "캐디피", "카트비"],
    cacheHit: false,
    durationMs: 0,
  };

  // 캐시 확인
  const cached = cacheGet(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as PackageDescriptionResult;
      return { ...parsed, cacheHit: true, durationMs: 0 };
    } catch { /* 캐시 파싱 실패 시 무시 */ }
  }

  const startMs = Date.now();
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `당신은 두골프 여행사의 골프 패키지 상품 설명 전문 카피라이터입니다.
고객이 패키지를 선택하고 싶게 만드는 매력적이고 전문적인 한국어 문구를 작성합니다.
반드시 다음 JSON 형식으로만 응답하세요:
{
  "description": "<상품 상세 설명, 150~300자>",
  "highlights": ["<하이라이트 1>", "<하이라이트 2>", "<하이라이트 3>", "<하이라이트 4>"],
  "includes": ["<포함 항목 1>", "<포함 항목 2>", ...],
  "excludes": ["<불포함 항목 1>", "<불포함 항목 2>", ...]
}`,
        },
        {
          role: "user",
          content: `다음 골프 패키지 상품 설명을 작성해주세요:
- 상품명: ${safeTitle}
- 국가/지역: ${safeCountry}${safeRegion ? ` (${safeRegion})` : ""}
- 기간: ${safeDuration || "미정"}
- 라운딩 횟수: ${params.roundCount ?? 2}회
${safeExtra ? `- 추가 정보: ${safeExtra}` : ""}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "package_description",
          strict: true,
          schema: {
            type: "object",
            properties: {
              description: { type: "string" },
              highlights: { type: "array", items: { type: "string" } },
              includes: { type: "array", items: { type: "string" } },
              excludes: { type: "array", items: { type: "string" } },
            },
            required: ["description", "highlights", "includes", "excludes"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content ?? "";
    const text = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const parsed = parseJsonSafely<Omit<PackageDescriptionResult, "cacheHit" | "durationMs">>(text, fallback);

    const result: PackageDescriptionResult = {
      ...parsed,
      cacheHit: false,
      durationMs: Date.now() - startMs,
    };

    cacheSet(cacheKey, JSON.stringify(result), cfg.cacheTtlSeconds);
    return result;
  } catch (error) {
    console.error("[geminiAIService] generatePackageDescription error:", error);
    return { ...fallback, durationMs: Date.now() - startMs };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 7. 마케팅 문구 생성 (SNS / 광고 카피)
// ────────────────────────────────────────────────────────────────────────────
export interface MarketingCopyResult {
  sns: string;
  adCopy: string;
  hashtags: string[];
  cacheHit: boolean;
  durationMs: number;
}

export async function generateMarketingCopy(params: {
  title: string;
  country: string;
  highlights: string[];
  targetAudience?: string;
}): Promise<MarketingCopyResult> {
  const safeTitle = sanitizeInput(params.title, 100);
  const safeCountry = sanitizeInput(params.country, 50);
  const safeHighlights = params.highlights.slice(0, 5).map(h => sanitizeInput(h, 100));
  const safeAudience = sanitizeInput(params.targetAudience ?? "골프 애호가", 100);

  const inputKey = `${safeTitle}|${safeCountry}|${safeHighlights.join(",")}`;
  const cfg = getModelConfig("marketingCopy");
  const cacheKey = makeCacheKey("marketingCopy", inputKey);

  const fallback: MarketingCopyResult = {
    sns: `⛳ ${safeTitle} | ${safeCountry} 골프 여행의 새로운 기준! 지금 두골프와 함께 떠나세요 🌏`,
    adCopy: `${safeCountry}에서 펼쳐지는 특별한 골프 여행, ${safeTitle}. 두골프가 모든 것을 준비했습니다.`,
    hashtags: ["#두골프", `#${safeCountry}골프`, "#골프여행", "#해외골프", "#골프패키지"],
    cacheHit: false,
    durationMs: 0,
  };

  const cached = cacheGet(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as MarketingCopyResult;
      return { ...parsed, cacheHit: true, durationMs: 0 };
    } catch { /* 무시 */ }
  }

  const startMs = Date.now();
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `당신은 두골프 여행사의 SNS 마케팅 전문가입니다.
골프 패키지의 매력을 극대화하는 SNS 문구와 광고 카피를 작성합니다.
반드시 다음 JSON 형식으로만 응답하세요:
{
  "sns": "<인스타그램/카카오스토리용 SNS 게시물 문구, 이모지 포함, 150자 이내>",
  "adCopy": "<광고 배너용 짧고 임팩트 있는 카피, 50자 이내>",
  "hashtags": ["#해시태그1", "#해시태그2", "#해시태그3", "#해시태그4", "#해시태그5"]
}`,
        },
        {
          role: "user",
          content: `다음 골프 패키지의 마케팅 문구를 작성해주세요:
- 상품명: ${safeTitle}
- 국가: ${safeCountry}
- 주요 특징: ${safeHighlights.join(", ")}
- 타겟 고객: ${safeAudience}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "marketing_copy",
          strict: true,
          schema: {
            type: "object",
            properties: {
              sns: { type: "string" },
              adCopy: { type: "string" },
              hashtags: { type: "array", items: { type: "string" } },
            },
            required: ["sns", "adCopy", "hashtags"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content ?? "";
    const text = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const parsed = parseJsonSafely<Omit<MarketingCopyResult, "cacheHit" | "durationMs">>(text, fallback);

    const result: MarketingCopyResult = { ...parsed, cacheHit: false, durationMs: Date.now() - startMs };
    cacheSet(cacheKey, JSON.stringify(result), cfg.cacheTtlSeconds);
    return result;
  } catch (error) {
    console.error("[geminiAIService] generateMarketingCopy error:", error);
    return { ...fallback, durationMs: Date.now() - startMs };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 8. 1:1 문의 답변 초안 생성
// ────────────────────────────────────────────────────────────────────────────
export interface InquiryReplyResult {
  reply: string;
  tone: "formal" | "friendly" | "apologetic";
  keyPoints: string[];
  durationMs: number;
}

export async function generateInquiryReply(params: {
  inquiryName: string;
  inquiryMessage: string;
  packageName?: string;
  travelDate?: string;
  peopleCount?: number;
}): Promise<InquiryReplyResult> {
  // 익명화 처리 (개인정보 보호)
  const safeName = sanitizeInput(params.inquiryName, 50);
  const safeMessage = anonymizeText(sanitizeInput(params.inquiryMessage, 1000));
  const safePackage = sanitizeInput(params.packageName ?? "", 200);
  const safeDate = sanitizeInput(params.travelDate ?? "", 50);

  const fallback: InquiryReplyResult = {
    reply: `안녕하세요 ${safeName}님, 두골프입니다.\n\n문의해 주셔서 감사합니다. 담당자가 확인 후 빠른 시일 내에 연락드리겠습니다.\n\n감사합니다.`,
    tone: "formal",
    keyPoints: ["문의 접수 확인", "빠른 답변 약속"],
    durationMs: 0,
  };

  const startMs = Date.now();
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `당신은 두골프 여행사의 고객 상담 전문가입니다.
고객의 문의에 대해 친절하고 전문적인 답변 초안을 작성합니다.
개인정보(이메일, 전화번호)는 [EMAIL], [PHONE]으로 표시된 경우 그대로 유지하세요.
반드시 다음 JSON 형식으로만 응답하세요:
{
  "reply": "<답변 본문, 존댓말 사용, 200~400자>",
  "tone": "formal" | "friendly" | "apologetic",
  "keyPoints": ["<핵심 포인트 1>", "<핵심 포인트 2>"]
}`,
        },
        {
          role: "user",
          content: `다음 고객 문의에 대한 답변 초안을 작성해주세요:
- 고객명: ${safeName}님
- 문의 내용: ${safeMessage}
${safePackage ? `- 관심 상품: ${safePackage}` : ""}
${safeDate ? `- 희망 여행 날짜: ${safeDate}` : ""}
${params.peopleCount ? `- 인원: ${params.peopleCount}명` : ""}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "inquiry_reply",
          strict: true,
          schema: {
            type: "object",
            properties: {
              reply: { type: "string" },
              tone: { type: "string", enum: ["formal", "friendly", "apologetic"] },
              keyPoints: { type: "array", items: { type: "string" } },
            },
            required: ["reply", "tone", "keyPoints"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content ?? "";
    const text = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    const parsed = parseJsonSafely<Omit<InquiryReplyResult, "durationMs">>(text, fallback);
    return { ...parsed, durationMs: Date.now() - startMs };
  } catch (error) {
    console.error("[geminiAIService] generateInquiryReply error:", error);
    return { ...fallback, durationMs: Date.now() - startMs };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 9. Function Calling: ERP 데이터 조회 후 AI 요약
//    AI가 tRPC API 스키마를 이해하고 데이터를 직접 조회하여 요약 제공
// ────────────────────────────────────────────────────────────────────────────
export interface FunctionCallResult {
  answer: string;
  functionCalled: string;
  dataUsed: unknown;
  durationMs: number;
}

/**
 * ERP 데이터를 직접 주입받아 AI가 분석/요약하는 Function Calling 패턴
 * (실제 tRPC 호출은 라우터에서 수행 후 데이터를 전달)
 */
export async function analyzeErpDataWithAI(params: {
  question: string;
  functionName: string;
  data: unknown;
}): Promise<FunctionCallResult> {
  const safeQuestion = sanitizeInput(params.question, 500);
  const dataStr = JSON.stringify(params.data).slice(0, 3000);

  const startMs = Date.now();
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `당신은 AI ERP 시스템의 데이터 분석 AI입니다.
제공된 ERP 데이터를 분석하여 관리자의 질문에 명확하고 간결하게 답변합니다.
숫자는 한국어 단위(개, 건, 원 등)로 표현하고, 핵심 인사이트를 강조하세요.`,
        },
        {
          role: "user",
          content: `질문: ${safeQuestion}

[${params.functionName} 조회 결과]
${dataStr}

위 데이터를 분석하여 질문에 답변해주세요.`,
        },
      ],
    });

    const rawContent = response.choices?.[0]?.message?.content ?? "";
    const answer = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

    return {
      answer,
      functionCalled: params.functionName,
      dataUsed: params.data,
      durationMs: Date.now() - startMs,
    };
  } catch (error) {
    console.error("[geminiAIService] analyzeErpDataWithAI error:", error);
    return {
      answer: "데이터 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      functionCalled: params.functionName,
      dataUsed: params.data,
      durationMs: Date.now() - startMs,
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 10. 이상 감지: 최근 N분 에러율 계산
// ────────────────────────────────────────────────────────────────────────────
export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  errorRate: number;
  totalRequests: number;
  failedRequests: number;
  avgResponseMs: number;
  alertMessage: string;
}

export function detectAnomaly(
  logs: Array<{ isSuccess: boolean; responseTimeMs: number | null }>,
  errorRateThreshold = 0.3,
  avgResponseThreshold = 5000
): AnomalyDetectionResult {
  const total = logs.length;
  if (total === 0) {
    return { isAnomaly: false, errorRate: 0, totalRequests: 0, failedRequests: 0, avgResponseMs: 0, alertMessage: "" };
  }

  const failed = logs.filter(l => !l.isSuccess).length;
  const errorRate = failed / total;
  const avgResponseMs = Math.round(
    logs.reduce((sum, l) => sum + (l.responseTimeMs ?? 0), 0) / total
  );

  const isAnomaly = errorRate >= errorRateThreshold || avgResponseMs >= avgResponseThreshold;
  let alertMessage = "";

  if (isAnomaly) {
    const parts: string[] = [];
    if (errorRate >= errorRateThreshold) {
      parts.push(`에러율 ${Math.round(errorRate * 100)}% (임계치: ${Math.round(errorRateThreshold * 100)}%)`);
    }
    if (avgResponseMs >= avgResponseThreshold) {
      parts.push(`평균 응답시간 ${avgResponseMs}ms (임계치: ${avgResponseThreshold}ms)`);
    }
    alertMessage = `[두골프-AI] 이상 감지: ${parts.join(", ")} | 최근 ${total}건 기준`;
  }

  return { isAnomaly, errorRate, totalRequests: total, failedRequests: failed, avgResponseMs, alertMessage };
}
