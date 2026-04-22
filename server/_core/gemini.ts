/**
 * Gemini AI 어시스턴트 헬퍼
 * - 두골프 ERP 시스템 컨텍스트를 자동으로 주입
 *
 * ## 인증 전략 (우선순위)
 * 1. Vertex AI (공식 리전 엔드포인트) - GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_CLOUD_PROJECT_ID 필요
 * 2. Google AI Studio (글로벌 엔드포인트) - GEMINI_API_KEY 필요 (Vertex AI 실패 시 폴백)
 *
 * ## 리전 우회 전략 (Vertex AI 사용 시)
 * - 공식 Vertex AI 리전: us-central1 → europe-west4 → asia-northeast1
 * - 각 리전 실패 시 다음 리전으로 자동 전환
 * - 모든 Vertex AI 리전 실패 시 → Google AI Studio 글로벌 엔드포인트로 폴백
 *
 * ## 서킷 브레이커
 * - 최근 5분 내 실패한 리전은 우선순위 후순위로 동적 조정
 * - 모든 리전이 서킷 브레이커 상태여도 순차 시도는 계속 진행
 *
 * ## API 호출 타임아웃: 30초
 */

import { VertexAI, HarmCategory as VertexHarmCategory, HarmBlockThreshold as VertexHarmBlockThreshold } from "@google-cloud/vertexai";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { ENV } from "./env";

// ────────────────────────────────────────────────────────────────────────────
// 모델 설정
// ────────────────────────────────────────────────────────────────────────────
const PRIMARY_MODEL = "gemini-2.5-flash-preview-04-17";   // Vertex AI 모델명
const PRIMARY_MODEL_STUDIO = "gemini-2.5-flash";           // Google AI Studio 모델명
const FALLBACK_MODEL = "gemini-1.5-flash-latest";                 // 폴백 모델 (양쪽 공통)
const API_TIMEOUT_MS = 30_000;
const RETRY_BASE_DELAY_MS = 500;

// ────────────────────────────────────────────────────────────────────────────
// 리전 엔드포인트 목록
// ────────────────────────────────────────────────────────────────────────────
export interface GeminiRegionEndpoint {
  name: string;
  label: string;
  /** Vertex AI location (예: "us-central1"). Google AI Studio는 "global" */
  location: string;
  priority: number;
  /** Vertex AI apiEndpoint (선택). 미지정 시 SDK 기본값 사용 */
  apiEndpoint?: string;
}

export const GEMINI_REGION_ENDPOINTS: GeminiRegionEndpoint[] = [
  {
    name: "us-central1",
    label: "미국 중부 (us-central1)",
    location: "us-central1",
    priority: 0,
  },
  {
    name: "europe-west4",
    label: "유럽 서부 (europe-west4)",
    location: "europe-west4",
    priority: 1,
  },
  {
    name: "asia-northeast1",
    label: "아시아 북동부 / 도쿄 (asia-northeast1)",
    location: "asia-northeast1",
    priority: 2,
  },
  {
    name: "us-east4",
    label: "미국 동부 (us-east4)",
    location: "us-east4",
    priority: 3,
  },
];

/** Google AI Studio 글로벌 엔드포인트 (Vertex AI 폴백) */
const STUDIO_REGION: GeminiRegionEndpoint = {
  name: "global",
  label: "글로벌 (Google AI Studio)",
  location: "global",
  priority: 99,
};

// ────────────────────────────────────────────────────────────────────────────
// 서킷 브레이커 상태 관리
// ────────────────────────────────────────────────────────────────────────────
const CIRCUIT_BREAKER_WINDOW_MS = 5 * 60 * 1000; // 5분
const CIRCUIT_BREAKER_THRESHOLD = 2; // 2회 실패 시 서킷 오픈

interface CircuitState {
  failures: number;
  lastFailureAt: number;
  isOpen: boolean;
}

const circuitBreaker = new Map<string, CircuitState>();

export function recordRegionFailure(regionName: string): void {
  const now = Date.now();
  const state = circuitBreaker.get(regionName) ?? { failures: 0, lastFailureAt: 0, isOpen: false };

  // 윈도우 밖의 오래된 실패는 초기화
  if (now - state.lastFailureAt > CIRCUIT_BREAKER_WINDOW_MS) {
    state.failures = 0;
    state.isOpen = false;
  }

  state.failures += 1;
  state.lastFailureAt = now;
  state.isOpen = state.failures >= CIRCUIT_BREAKER_THRESHOLD;
  circuitBreaker.set(regionName, state);

  if (state.isOpen) {
    console.warn(`[CircuitBreaker] ${regionName} 서킷 오픈 (${state.failures}회 실패)`);
  }
}

export function recordRegionSuccess(regionName: string): void {
  circuitBreaker.delete(regionName);
}

export function isCircuitOpen(regionName: string): boolean {
  const state = circuitBreaker.get(regionName);
  if (!state) return false;
  // 윈도우 만료 시 자동 리셋
  if (Date.now() - state.lastFailureAt > CIRCUIT_BREAKER_WINDOW_MS) {
    circuitBreaker.delete(regionName);
    return false;
  }
  return state.isOpen;
}

/** 서킷 브레이커 전체 상태 조회 (관리자 UI용) */
export function getCircuitBreakerStatus(): Record<string, { failures: number; isOpen: boolean; lastFailureAt: number }> {
  const result: Record<string, { failures: number; isOpen: boolean; lastFailureAt: number }> = {};
  const now = Date.now();
  for (const [name, state] of Array.from(circuitBreaker.entries())) {
    if (now - state.lastFailureAt <= CIRCUIT_BREAKER_WINDOW_MS) {
      result[name] = { failures: state.failures, isOpen: state.isOpen, lastFailureAt: state.lastFailureAt };
    }
  }
  return result;
}

/** 서킷 브레이커 초기화 (관리자용) */
export function resetCircuitBreaker(regionName?: string): void {
  if (regionName) {
    circuitBreaker.delete(regionName);
  } else {
    circuitBreaker.clear();
  }
}

/**
 * 서킷 브레이커 상태를 반영하여 리전 목록을 정렬
 * - 서킷이 열린 리전은 후순위로 이동
 * - 서킷이 닫힌 리전은 priority 순서 유지
 */
function getSortedRegionsWithCircuitBreaker(regions: GeminiRegionEndpoint[]): GeminiRegionEndpoint[] {
  return [...regions].sort((a, b) => {
    const aOpen = isCircuitOpen(a.name);
    const bOpen = isCircuitOpen(b.name);
    if (aOpen && !bOpen) return 1;
    if (!aOpen && bOpen) return -1;
    return a.priority - b.priority;
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 시스템 컨텍스트
// ────────────────────────────────────────────────────────────────────────────
export const DOGOLF_SYSTEM_CONTEXT = `
당신은 두골프(DOGOLF) 골프여행사 ERP 시스템의 AI 어시스턴트입니다.
관리자의 명령을 분석하고, 실행 가능한 구체적인 계획을 제안합니다.

## 시스템 개요
두골프는 국내외 골프 투어 전문 여행사입니다.
- 홈페이지: 상품 목록/상세, 예약 문의, 공지사항, 갤러리
- ERP 백오피스: 상품관리, 예약관리, 정산관리, CRM, CMS, 문의관리

## 데이터베이스 스키마 (MySQL/Drizzle ORM)
| 테이블 | 설명 | 주요 필드 |
|--------|------|-----------|
| users | 관리자/사용자 계정 | id, openId, name, email, role(admin/user) |
| packages | 골프 패키지 상품 | id, title, country, region, duration, roundCount, status(draft/active/inactive/sold_out), isFeatured, isPopular, imageUrl, sortOrder |
| package_prices | 상품별 인원/시즌 요금 | packageId, season(peak/normal/off), minPeople, maxPeople, pricePerPerson |
| package_options | 상품 옵션 (카트/캐디/숙박 등) | packageId, optionType, name, price, isRequired |
| package_slots | 출발 가능 일정 | packageId, departureDate, returnDate, maxPeople, bookedCount, status |
| bookings | 예약 | packageId, userId, status(pending/confirmed/cancelled/completed), totalAmount, travelerCount |
| travelers | 예약 동반자 | bookingId, name, phone, birthDate |
| settlements | 정산 | bookingId, supplierName, supplierAmount, commissionRate, status |
| inquiries | 1:1 문의 | packageId, name, phone, email, message, status(new/replied/closed) |
| notices | 공지사항 | title, content, category, isPinned, isPublished |
| banners | 홈페이지 배너 | title, imageUrl, linkUrl, position, isActive, sortOrder |
| customer_memos | CRM 고객 메모 | userId, content, category |
| package_images | 상품 이미지 | packageId, imageUrl, isCover, sortOrder |
| ai_interaction_logs | AI 대화 로그 | userId, query, response, modelUsed, regionUsed, isSuccess, errorType, createdAt |
| dev_requests | 개발 요청 | title, description, status, slackMessageTs, result, priority |
| dev_features | 기능 목록 | name, description, currentVersion, status |
| dev_versions | 기능별 버전 이력 | featureId, version, description, checkpointId, createdAt |

## tRPC API 구조 (server/routers.ts)
### dashboard.*
- stats: 대시보드 KPI (예약수, 매출, 상품수, 문의수)
- monthlyRevenue: 월별 매출 차트 데이터

### packages.*
- list / get / create / update / delete: 상품 CRUD
- addPrice / deletePrice / addOption / deleteOption / addSlot / deleteSlot
- uploadImage / deleteImage / setCover / listImages / reorderImages
- generateAIImage / generateAIImages / saveSelectedAIImages
- searchPixabay / importPixabayImage

### bookings.* / settlements.* / inquiries.* / notices.* / banners.* / crm.*

### gemini.*
- ask(messages): Gemini AI 채팅 (adminProcedure)
- getSystemContext: 시스템 컨텍스트 조회

### aiLogs.*
- list / create / delete / regionStats / circuitBreakerStatus / resetCircuitBreaker

### devAI.*
- listRequests / createRequest / updateRequest / deleteRequest
- listFeatures / createFeature / updateFeature
- listVersions / createVersion
- sendToSlack

## 응답 형식 가이드라인
1. 관리자 명령을 분석하여 **실행 계획**을 먼저 제시하세요.
2. 코드 변경이 필요한 경우 **어떤 파일의 어떤 부분**을 수정해야 하는지 명확히 설명하세요.
3. 데이터 조회/수정이 필요한 경우 **어떤 API를 호출**해야 하는지 안내하세요.
4. 항상 한국어로 응답하세요.
5. 복잡한 작업은 단계별로 나누어 설명하세요.
`;

// ────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────────────────────
export interface GeminiMessage {
  role: "user" | "model";
  content: string;
}

export interface GeminiChatOptions {
  messages: GeminiMessage[];
  systemContext?: string;
  temperature?: number;
}

export interface GeminiChatResult {
  text: string;
  modelUsed: string;
  wasFallback: boolean;
  /** 실제 응답에 사용된 리전 이름 (예: "us-central1", "global") */
  regionUsed: string;
  /** 사용된 백엔드 ("vertex" | "studio") */
  backend: "vertex" | "studio";
  /** 모든 리전/폴백이 실패했을 때 사용자에게 보여줄 메시지. 정상 응답 시 undefined. */
  errorMessage?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 오류 분류 헬퍼
// ────────────────────────────────────────────────────────────────────────────

/** 503/429/타임아웃처럼 다른 리전으로 우회 재시도할 수 있는 오류 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("service unavailable") ||
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("타임아웃") ||
    msg.includes("timeout")
  );
}

/** 구글 서버 과부하 계열 오류 (사용자 메시지 문구 결정에 사용) */
export function isOverloadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("service unavailable") ||
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("타임아웃") ||
    msg.includes("timeout")
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 유틸리티
// ────────────────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Vertex AI 사용 가능 여부 확인 */
function isVertexAIAvailable(): boolean {
  return !!(ENV.googleServiceAccountJson && ENV.googleCloudProjectId);
}

/** 서비스 계정 JSON 파싱 */
function parseServiceAccountCredentials(): Record<string, unknown> | null {
  if (!ENV.googleServiceAccountJson) return null;
  try {
    return JSON.parse(ENV.googleServiceAccountJson);
  } catch {
    console.error("[Vertex AI] 서비스 계정 JSON 파싱 실패");
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Vertex AI 채팅 시도
// ────────────────────────────────────────────────────────────────────────────
async function tryChatWithVertexAI(
  region: GeminiRegionEndpoint,
  modelName: string,
  options: GeminiChatOptions
): Promise<string> {
  const credentials = parseServiceAccountCredentials();
  if (!credentials) throw new Error("서비스 계정 JSON을 파싱할 수 없습니다.");

  const vertexAI = new VertexAI({
    project: ENV.googleCloudProjectId,
    location: region.location,
    googleAuthOptions: {
      credentials: credentials as any,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    },
  });

  const model = vertexAI.getGenerativeModel({
    model: modelName,
    systemInstruction: {
      role: "system",
      parts: [{ text: options.systemContext ?? DOGOLF_SYSTEM_CONTEXT }],
    },
    safetySettings: [
      { category: VertexHarmCategory.HARM_CATEGORY_HARASSMENT, threshold: VertexHarmBlockThreshold.BLOCK_NONE },
      { category: VertexHarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: VertexHarmBlockThreshold.BLOCK_NONE },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: 4096,
    },
  });

  const history = options.messages.slice(0, -1).map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  const lastMessage = options.messages[options.messages.length - 1];
  if (!lastMessage) throw new Error("메시지가 없습니다.");

  const chat = model.startChat({ history });

  const sendPromise = chat.sendMessage(lastMessage.content);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`API 호출 타임아웃 (30초 초과) [${region.name}]`)),
      API_TIMEOUT_MS
    )
  );

  const result = await Promise.race([sendPromise, timeoutPromise]);
  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Vertex AI 응답이 비어있습니다.");
  return text;
}

// ────────────────────────────────────────────────────────────────────────────
// Google AI Studio 채팅 시도 (폴백)
// ────────────────────────────────────────────────────────────────────────────
async function tryChatWithStudio(
  modelName: string,
  options: GeminiChatOptions
): Promise<string> {
  if (!ENV.geminiApiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const genAI = new GoogleGenerativeAI(ENV.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: options.systemContext ?? DOGOLF_SYSTEM_CONTEXT,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: 4096,
    },
  });

  const history = options.messages.slice(0, -1).map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  const lastMessage = options.messages[options.messages.length - 1];
  if (!lastMessage) throw new Error("메시지가 없습니다.");

  const chat = model.startChat({ history });

  const sendPromise = chat.sendMessage(lastMessage.content);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`API 호출 타임아웃 (30초 초과) [global]`)),
      API_TIMEOUT_MS
    )
  );

  const result = await Promise.race([sendPromise, timeoutPromise]);
  return result.response.text();
}

// ────────────────────────────────────────────────────────────────────────────
// 메인 채팅 함수 (Vertex AI → Studio 폴백, 서킷 브레이커 적용)
//
// 흐름:
//   [Vertex AI] us-central1 → europe-west4 → asia-northeast1 → us-east4
//     (서킷 브레이커 열린 리전은 후순위)
//   → [Google AI Studio] PRIMARY_MODEL_STUDIO
//   → [Google AI Studio] FALLBACK_MODEL
//   → errorMessage 반환
// ────────────────────────────────────────────────────────────────────────────
async function chatWithRegionFallback(options: GeminiChatOptions): Promise<GeminiChatResult> {
  let lastError: unknown;

  // ── 1단계: Vertex AI (서비스 계정 인증) ──────────────────────────────────
  if (isVertexAIAvailable()) {
    const sortedVertexRegions = getSortedRegionsWithCircuitBreaker(GEMINI_REGION_ENDPOINTS);

    for (const region of sortedVertexRegions) {
      const circuitWasOpen = isCircuitOpen(region.name);
      try {
        if (lastError) await sleep(RETRY_BASE_DELAY_MS);
        console.log(`[Gemini/Vertex] 시도: ${region.label} / ${PRIMARY_MODEL}${circuitWasOpen ? " (서킷 열림 - 후순위)" : ""}`);
        const text = await tryChatWithVertexAI(region, PRIMARY_MODEL, options);
        recordRegionSuccess(region.name);
        console.log(`[Gemini/Vertex] 성공: ${region.label} / ${PRIMARY_MODEL}`);
        return { text, modelUsed: PRIMARY_MODEL, wasFallback: false, regionUsed: region.name, backend: "vertex" };
      } catch (err) {
        lastError = err;
        if (!isRetryableError(err)) {
          console.error(`[Gemini/Vertex] 재시도 불가 오류 [${region.name}]:`, (err as Error).message);
          // 인증 오류 등은 Vertex AI 전체를 건너뜀
          break;
        }
        recordRegionFailure(region.name);
        console.warn(`[Gemini/Vertex] ${region.label} 실패:`, (err as Error).message);
      }
    }

    // Vertex AI 폴백 모델 시도
    const sortedForFallback = getSortedRegionsWithCircuitBreaker(GEMINI_REGION_ENDPOINTS);
    for (const region of sortedForFallback) {
      try {
        await sleep(RETRY_BASE_DELAY_MS);
        console.log(`[Gemini/Vertex] 폴백 시도: ${region.label} / ${FALLBACK_MODEL}`);
        const text = await tryChatWithVertexAI(region, FALLBACK_MODEL, options);
        recordRegionSuccess(region.name);
        console.log(`[Gemini/Vertex] 폴백 성공: ${region.label} / ${FALLBACK_MODEL}`);
        return { text, modelUsed: FALLBACK_MODEL, wasFallback: true, regionUsed: region.name, backend: "vertex" };
      } catch (err) {
        lastError = err;
        if (!isRetryableError(err)) break;
        recordRegionFailure(region.name);
        console.warn(`[Gemini/Vertex] ${region.label} 폴백 실패:`, (err as Error).message);
      }
    }
  }

  // ── 2단계: Google AI Studio (글로벌 엔드포인트) ──────────────────────────
  console.log(`[Gemini/Studio] Google AI Studio 시도 (${PRIMARY_MODEL_STUDIO})`);
  try {
    const text = await tryChatWithStudio(PRIMARY_MODEL_STUDIO, options);
    recordRegionSuccess(STUDIO_REGION.name);
    console.log(`[Gemini/Studio] 성공: ${PRIMARY_MODEL_STUDIO}`);
    return { text, modelUsed: PRIMARY_MODEL_STUDIO, wasFallback: false, regionUsed: STUDIO_REGION.name, backend: "studio" };
  } catch (err) {
    lastError = err;
    if (isRetryableError(err)) {
      recordRegionFailure(STUDIO_REGION.name);
    }
    console.warn(`[Gemini/Studio] 실패 (${PRIMARY_MODEL_STUDIO}):`, (err as Error).message);
  }

  // Studio 폴백 모델
  console.log(`[Gemini/Studio] 폴백 시도 (${FALLBACK_MODEL})`);
  try {
    await sleep(RETRY_BASE_DELAY_MS);
    const text = await tryChatWithStudio(FALLBACK_MODEL, options);
    recordRegionSuccess(STUDIO_REGION.name);
    console.log(`[Gemini/Studio] 폴백 성공: ${FALLBACK_MODEL}`);
    return { text, modelUsed: FALLBACK_MODEL, wasFallback: true, regionUsed: STUDIO_REGION.name, backend: "studio" };
  } catch (err) {
    lastError = err;
    if (isRetryableError(err)) {
      recordRegionFailure(STUDIO_REGION.name);
    }
    console.warn(`[Gemini/Studio] 폴백 실패 (${FALLBACK_MODEL}):`, (err as Error).message);
  }

  // ── 3단계: 모든 시도 실패 ────────────────────────────────────────────────
  console.error(`[Gemini] 모든 리전 + 모든 모델 실패`);
  const isOverloaded = isOverloadError(lastError);
  return {
    text: "",
    modelUsed: FALLBACK_MODEL,
    wasFallback: true,
    regionUsed: "none",
    backend: "studio",
    errorMessage: isOverloaded
      ? "현재 구글 서버 부하로 인해 처리가 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
      : "AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 공개 API
// ────────────────────────────────────────────────────────────────────────────

/** 일반 채팅 (비스트리밍) */
export async function geminiChat(options: GeminiChatOptions): Promise<GeminiChatResult> {
  return chatWithRegionFallback(options);
}

/** 스트리밍 채팅 - 폴백 후 전체 텍스트를 청크로 yield */
export async function* geminiChatStream(options: GeminiChatOptions): AsyncGenerator<string> {
  const result = await chatWithRegionFallback(options);

  if (result.errorMessage) {
    yield result.errorMessage;
    return;
  }

  if (result.wasFallback) {
    const regionLabel =
      GEMINI_REGION_ENDPOINTS.find((r) => r.name === result.regionUsed)?.label ??
      (result.regionUsed === "global" ? "글로벌 (Google AI Studio)" : result.regionUsed);
    yield `> ⚠️ *기본 모델 과부하로 인해 대체 모델(${result.modelUsed}) / ${regionLabel}을 사용했습니다.*\n\n`;
  }

  const chunkSize = 200;
  for (let i = 0; i < result.text.length; i += chunkSize) {
    yield result.text.slice(i, i + chunkSize);
  }
}

/** API 키 유효성 검사 */
export async function validateGeminiApiKey(): Promise<boolean> {
  try {
    const result = await geminiChat({
      messages: [{ role: "user", content: "ping" }],
      systemContext: "You are a test assistant. Reply with 'pong' only.",
      temperature: 0,
    });
    if (result.errorMessage) return false;
    return result.text.toLowerCase().includes("pong");
  } catch {
    return false;
  }
}
