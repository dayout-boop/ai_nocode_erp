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
          content: `당신은 두골프 ERP 시스템의 개발 요청을 분석하는 AI입니다.
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
          content: `당신은 두골프 ERP 시스템의 개발 요청 생성 AI입니다.
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
      `다음 정보를 바탕으로 두골프 ERP 릴리즈 노트를 작성해주세요.

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
        systemPrompt: "당신은 두골프 ERP 시스템의 릴리즈 노트를 작성하는 기술 문서 전문가입니다.",
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
      `다음 기능에 대한 두골프 ERP 기술 문서 초안을 작성해주세요.

기능 제목: ${safeTitle}
기능 설명: ${safeDesc}

문서 구조:
1. ## 개요
2. ## 주요 기능
3. ## 사용 방법 (단계별 설명)
4. ## 기술적 고려사항
5. ## 관련 기능 및 의존성

두골프 ERP 시스템에 적합한 전문적인 한국어로 작성해주세요.`,
      {
        taskType: "content_create",
        systemPrompt: "당신은 두골프 ERP 시스템의 기술 문서를 작성하는 전문 기술 작가입니다.",
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
          content: `당신은 두골프 ERP 시스템의 AI 개발 파이프라인 최적화 전문가입니다.
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

사용 가능한 도구: ErrorWatcher, AutoFixer(Llama 무료/GPT-4o), ReviewEngine, n8n 자동화, 카카오 알림톡, Stripe 결제, Runway ML`,
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
