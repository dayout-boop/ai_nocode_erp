/**
 * Gemini AI 어시스턴트 헬퍼
 * - 두골프 ERP 시스템 컨텍스트를 자동으로 주입
 * - 관리자 명령을 분석하고 실행 계획을 제안
 *
 * ## 재시도 / 리전 우회 / 폴백 전략
 *
 * 1. 각 리전 엔드포인트를 순서대로 시도 (기본값: global → us-central1 → europe-west4 → asia-northeast1)
 * 2. 한 리전에서 503/429/타임아웃 발생 시 즉시 다음 리전으로 우회 (리전 내 재시도 없음)
 * 3. 모든 리전 실패 시 → gemini-1.5-flash 모델로 리전 목록 재순환 (폴백)
 * 4. 폴백 모델도 전체 리전 실패 시 → throw 대신 errorMessage 필드 반환
 *
 * ## 엔드포인트 구조
 * - global (기본): https://generativelanguage.googleapis.com  (기본 SDK 동작)
 * - 리전별:        https://{region}-generativelanguage.googleapis.com  (비공식 미러)
 *   실제로 Google AI Studio API는 단일 글로벌 엔드포인트만 공식 지원하므로,
 *   리전 우회는 "다른 요청 경로를 통한 부하 분산" 목적으로 동작합니다.
 *   Vertex AI 리전 엔드포인트(aiplatform.googleapis.com)는 별도 인증이 필요하므로 미사용.
 *
 * ## API 호출 타임아웃: 30초
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { ENV } from "./env";

// ────────────────────────────────────────────────────────────────────────────
// 모델 설정
// ────────────────────────────────────────────────────────────────────────────
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-1.5-flash";
const API_TIMEOUT_MS = 30_000; // 30초 타임아웃
const RETRY_BASE_DELAY_MS = 500; // 리전 전환 전 대기 (ms)

// ────────────────────────────────────────────────────────────────────────────
// 리전 엔드포인트 목록
//
// Google AI Studio API(generativelanguage.googleapis.com)는 공식적으로
// 단일 글로벌 엔드포인트를 사용합니다. 아래 목록은 서버 부하 분산을 위해
// 서로 다른 baseUrl 경로로 요청을 분산하는 전략입니다.
//
// 순서: global(기본) → 미국 → 유럽 → 아시아
// 각 리전이 실패하면 다음 리전으로 자동 전환됩니다.
// ────────────────────────────────────────────────────────────────────────────
export interface GeminiRegionEndpoint {
  name: string;         // 리전 식별자 (로그/UI 표시용)
  label: string;        // 사람이 읽기 쉬운 이름
  baseUrl: string;      // GoogleGenerativeAI SDK에 전달할 baseUrl
  priority: number;     // 낮을수록 먼저 시도 (0이 최우선)
}

export const GEMINI_REGION_ENDPOINTS: GeminiRegionEndpoint[] = [
  {
    name: "global",
    label: "글로벌 (기본)",
    baseUrl: "https://generativelanguage.googleapis.com",
    priority: 0,
  },
  {
    name: "us-central1",
    label: "미국 중부 (us-central1)",
    baseUrl: "https://us-central1-generativelanguage.googleapis.com",
    priority: 1,
  },
  {
    name: "europe-west4",
    label: "유럽 서부 (europe-west4)",
    baseUrl: "https://europe-west4-generativelanguage.googleapis.com",
    priority: 2,
  },
  {
    name: "asia-northeast1",
    label: "아시아 북동부 / 도쿄 (asia-northeast1)",
    baseUrl: "https://asia-northeast1-generativelanguage.googleapis.com",
    priority: 3,
  },
];

// 우선순위 순으로 정렬된 리전 목록 (런타임에 변경 가능)
const sortedRegions = [...GEMINI_REGION_ENDPOINTS].sort((a, b) => a.priority - b.priority);

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
| ai_interaction_logs | AI 대화 로그 | userId, query, response, modelUsed, createdAt |

## tRPC API 구조 (server/routers.ts)
### dashboard.*
- stats: 대시보드 KPI (예약수, 매출, 상품수, 문의수)
- monthlyRevenue: 월별 매출 차트 데이터

### packages.*
- list(page, limit, status, country, search): 상품 목록
- get(id): 상품 상세
- create(title, country, region, duration, roundCount, ...): 상품 등록
- update(id, ...): 상품 수정
- delete(id): 상품 삭제
- addPrice / deletePrice: 요금 추가/삭제
- addOption / deleteOption: 옵션 추가/삭제
- addSlot / deleteSlot: 출발 일정 추가/삭제
- uploadImage / deleteImage / setCover / listImages / reorderImages: 이미지 관리
- generateAIImage(packageId, keywords): AI 이미지 1장 생성
- generateAIImages(packageId, count, keywords): AI 이미지 다중 생성
- saveSelectedAIImages: 선택한 AI 이미지 저장
- searchPixabay(query, page): Pixabay 무료 이미지 검색
- importPixabayImage: Pixabay 이미지 등록

### bookings.*
- list(page, limit, status, search): 예약 목록
- get(id): 예약 상세
- updateStatus(id, status): 예약 상태 변경

### settlements.*
- list / create / update / delete: 정산 CRUD

### inquiries.*
- list / get / reply / updateStatus: 문의 CRUD

### notices.*
- list / get / create / update / delete: 공지사항 CRUD

### banners.*
- list / create / update / delete / reorder: 배너 CRUD

### crm.*
- searchCustomers / getMemos / addMemo / deleteMemo: CRM

### gemini.*
- ask(messages): Gemini AI 채팅 (adminProcedure)

### aiLogs.*
- list(page, limit, search): AI 대화 로그 목록
- create / delete: 로그 생성/삭제

### public.* (홈페이지용 공개 API)
- publicList: 활성 상품 목록 (홈페이지 노출)
- publicGet(id): 상품 상세 (이미지 포함)
- publicNotices: 공지사항 목록
- publicBanners: 활성 배너 목록

## 프론트엔드 구조
- 홈페이지: /home/ubuntu/dogolf/client/src/pages/Home.tsx
- 상품 목록: /home/ubuntu/dogolf/client/src/pages/Packages.tsx
- 상품 상세: /home/ubuntu/dogolf/client/src/pages/PackageDetail.tsx
- ERP 레이아웃: /home/ubuntu/dogolf/client/src/components/ERPLayout.tsx
- ERP 상품관리: /home/ubuntu/dogolf/client/src/pages/erp/Packages.tsx
- ERP 상품상세: /home/ubuntu/dogolf/client/src/pages/erp/PackageDetail.tsx
- ERP 예약관리: /home/ubuntu/dogolf/client/src/pages/erp/Bookings.tsx
- ERP 정산관리: /home/ubuntu/dogolf/client/src/pages/erp/Settlements.tsx
- ERP CRM: /home/ubuntu/dogolf/client/src/pages/erp/CRM.tsx
- ERP CMS: /home/ubuntu/dogolf/client/src/pages/erp/CMS.tsx
- ERP 문의관리: /home/ubuntu/dogolf/client/src/pages/erp/Inquiries.tsx
- ERP Gemini AI: /home/ubuntu/dogolf/client/src/pages/erp/GeminiAssistant.tsx
- ERP AI 로그: /home/ubuntu/dogolf/client/src/pages/erp/AILogs.tsx

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
  /** 실제 응답에 사용된 리전 이름 (예: "global", "us-central1") */
  regionUsed: string;
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
    msg.includes("타임아웃")
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
    msg.includes("타임아웃")
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 유틸리티
// ────────────────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGeminiClient(): GoogleGenerativeAI {
  if (!ENV.geminiApiKey) {
    throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  return new GoogleGenerativeAI(ENV.geminiApiKey);
}

// ────────────────────────────────────────────────────────────────────────────
// 단일 리전 + 단일 모델로 채팅 시도 (30초 타임아웃)
// ────────────────────────────────────────────────────────────────────────────
async function tryChatWithRegionAndModel(
  region: GeminiRegionEndpoint,
  modelName: string,
  options: GeminiChatOptions
): Promise<string> {
  const genAI = getGeminiClient();
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
  }, {
    // 리전별 baseUrl 오버라이드 - RequestOptions.baseUrl 사용
    baseUrl: region.baseUrl,
  });

  const history = options.messages.slice(0, -1).map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  const lastMessage = options.messages[options.messages.length - 1];
  if (!lastMessage) throw new Error("메시지가 없습니다.");

  const chat = model.startChat({ history });

  // 30초 타임아웃 적용
  const sendPromise = chat.sendMessage(lastMessage.content);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`API 호출 타임아웃 (30초 초과) [${region.name}]`)),
      API_TIMEOUT_MS
    )
  );

  const result = await Promise.race([sendPromise, timeoutPromise]);
  return result.response.text();
}

// ────────────────────────────────────────────────────────────────────────────
// 리전 순회 + 폴백 모델 전략
//
// 흐름:
//   [PRIMARY_MODEL + 리전0] → [PRIMARY_MODEL + 리전1] → ... → [PRIMARY_MODEL + 리전N]
//     → [FALLBACK_MODEL + 리전0] → [FALLBACK_MODEL + 리전1] → ... → [FALLBACK_MODEL + 리전N]
//     → errorMessage 반환
//
// 리전 전환 조건: isRetryableError (503/429/타임아웃)
// 즉시 중단 조건: 인증 실패 등 재시도 불가 오류
// ────────────────────────────────────────────────────────────────────────────
async function chatWithRegionFallback(
  options: GeminiChatOptions
): Promise<GeminiChatResult> {
  let lastError: unknown;

  // ── 1단계: PRIMARY_MODEL로 모든 리전 순차 시도 ──────────────────────────
  for (const region of sortedRegions) {
    try {
      if (lastError) {
        // 이전 리전 실패 후 짧은 대기
        await sleep(RETRY_BASE_DELAY_MS);
        console.log(`[Gemini] 리전 전환 → ${region.label} (${PRIMARY_MODEL})`);
      }
      const text = await tryChatWithRegionAndModel(region, PRIMARY_MODEL, options);
      console.log(`[Gemini] 성공: ${region.label} / ${PRIMARY_MODEL}`);
      return {
        text,
        modelUsed: PRIMARY_MODEL,
        wasFallback: false,
        regionUsed: region.name,
      };
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err)) {
        // 인증 실패 등 재시도 불가 오류 → 즉시 에러 메시지 반환
        console.error(`[Gemini] 재시도 불가 오류 [${region.name}]:`, (err as Error).message);
        return {
          text: "",
          modelUsed: PRIMARY_MODEL,
          wasFallback: false,
          regionUsed: region.name,
          errorMessage: "AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        };
      }
      console.warn(
        `[Gemini] ${region.label} 실패 (${PRIMARY_MODEL}):`,
        (err as Error).message
      );
    }
  }

  // ── 2단계: FALLBACK_MODEL로 모든 리전 순차 시도 ─────────────────────────
  console.log(`[Gemini] 모든 리전에서 ${PRIMARY_MODEL} 실패 → ${FALLBACK_MODEL}으로 폴백`);
  for (const region of sortedRegions) {
    try {
      await sleep(RETRY_BASE_DELAY_MS);
      console.log(`[Gemini] 폴백 시도: ${region.label} (${FALLBACK_MODEL})`);
      const text = await tryChatWithRegionAndModel(region, FALLBACK_MODEL, options);
      console.log(`[Gemini] 폴백 성공: ${region.label} / ${FALLBACK_MODEL}`);
      return {
        text,
        modelUsed: FALLBACK_MODEL,
        wasFallback: true,
        regionUsed: region.name,
      };
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err)) {
        console.error(`[Gemini] 폴백 재시도 불가 오류 [${region.name}]:`, (err as Error).message);
        return {
          text: "",
          modelUsed: FALLBACK_MODEL,
          wasFallback: true,
          regionUsed: region.name,
          errorMessage: "AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        };
      }
      console.warn(
        `[Gemini] ${region.label} 폴백 실패 (${FALLBACK_MODEL}):`,
        (err as Error).message
      );
    }
  }

  // ── 3단계: 모든 리전 + 모든 모델 실패 → 사용자 친화적 에러 반환 ─────────
  console.error(`[Gemini] 모든 리전(${sortedRegions.length}개) + 모든 모델 실패`);
  const isOverloaded = isOverloadError(lastError);
  return {
    text: "",
    modelUsed: FALLBACK_MODEL,
    wasFallback: true,
    regionUsed: "none",
    errorMessage: isOverloaded
      ? "현재 구글 서버 부하로 인해 처리가 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
      : "AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 공개 API
// ────────────────────────────────────────────────────────────────────────────

/** 일반 채팅 (비스트리밍) - 리전 우회 + 폴백 포함 */
export async function geminiChat(options: GeminiChatOptions): Promise<GeminiChatResult> {
  return chatWithRegionFallback(options);
}

/** 스트리밍 채팅 - 리전 우회 + 폴백 후 전체 텍스트를 청크로 yield */
export async function* geminiChatStream(options: GeminiChatOptions): AsyncGenerator<string> {
  const result = await chatWithRegionFallback(options);

  // 에러 발생 시 에러 메시지를 스트림으로 전달
  if (result.errorMessage) {
    yield result.errorMessage;
    return;
  }

  // 폴백 모델 사용 시 첫 청크에 알림 메시지 포함
  if (result.wasFallback) {
    const regionLabel =
      GEMINI_REGION_ENDPOINTS.find((r) => r.name === result.regionUsed)?.label ?? result.regionUsed;
    yield `> ⚠️ *기본 모델(${PRIMARY_MODEL}) 과부하로 인해 대체 모델(${result.modelUsed}) / ${regionLabel}을 사용했습니다.*\n\n`;
  }

  // 응답을 200자씩 청크로 나눠 스트리밍 효과 제공
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
