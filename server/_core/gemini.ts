/**
 * Gemini AI 어시스턴트 헬퍼
 * - 두골프 ERP 시스템 컨텍스트를 자동으로 주입
 * - 관리자 명령을 분석하고 실행 계획을 제안
 * - 503 오류 시 최대 2회 재시도 (지수 백오프)
 * - 2회 재시도 후에도 실패 시 gemini-1.5-flash로 자동 폴백
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { ENV } from "./env";

// ────────────────────────────────────────────────────────────────────────────
// 모델 설정
// ────────────────────────────────────────────────────────────────────────────
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-1.5-flash";
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000; // 1초, 지수 백오프: 1s → 2s

// ────────────────────────────────────────────────────────────────────────────
// 시스템 컨텍스트 - Gemini가 두골프 ERP를 이해하는 데 필요한 구조 정보
// 코드가 복잡해질수록 이 컨텍스트를 업데이트하여 Gemini가 최신 구조를 파악하게 함
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
// Gemini 클라이언트 초기화
// ────────────────────────────────────────────────────────────────────────────
function getGeminiClient() {
  if (!ENV.geminiApiKey) {
    throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  return new GoogleGenerativeAI(ENV.geminiApiKey);
}

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
}

// ────────────────────────────────────────────────────────────────────────────
// 503 / 과부하 오류 판별
// ────────────────────────────────────────────────────────────────────────────
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("service unavailable") ||
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("429") ||
    msg.includes("resource_exhausted")
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 지수 백오프 대기
// ────────────────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ────────────────────────────────────────────────────────────────────────────
// 단일 모델로 채팅 시도 (재시도 없음)
// ────────────────────────────────────────────────────────────────────────────
async function tryChatWithModel(
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
  });

  const history = options.messages.slice(0, -1).map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  const lastMessage = options.messages[options.messages.length - 1];
  if (!lastMessage) throw new Error("메시지가 없습니다.");

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(lastMessage.content);
  return result.response.text();
}

// ────────────────────────────────────────────────────────────────────────────
// 재시도 + 폴백 로직을 포함한 채팅 실행
// 1. PRIMARY_MODEL(gemini-2.5-flash)로 최대 MAX_RETRIES(2)회 재시도
// 2. 모두 실패 시 FALLBACK_MODEL(gemini-1.5-flash)로 1회 추가 시도
// ────────────────────────────────────────────────────────────────────────────
async function chatWithRetryAndFallback(
  options: GeminiChatOptions
): Promise<GeminiChatResult> {
  let lastError: unknown;

  // 1단계: 기본 모델로 최대 MAX_RETRIES회 시도
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[Gemini] ${PRIMARY_MODEL} 재시도 ${attempt}/${MAX_RETRIES} (${delay}ms 대기)`);
        await sleep(delay);
      }
      const text = await tryChatWithModel(PRIMARY_MODEL, options);
      return { text, modelUsed: PRIMARY_MODEL, wasFallback: false };
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err)) {
        // 재시도 불가 오류 (인증 실패 등)는 즉시 throw
        throw err;
      }
      console.warn(`[Gemini] ${PRIMARY_MODEL} 시도 ${attempt + 1} 실패:`, (err as Error).message);
    }
  }

  // 2단계: 폴백 모델(gemini-1.5-flash)로 1회 시도
  console.log(`[Gemini] 기본 모델 ${MAX_RETRIES + 1}회 실패 → ${FALLBACK_MODEL}으로 폴백`);
  try {
    const text = await tryChatWithModel(FALLBACK_MODEL, options);
    console.log(`[Gemini] 폴백 모델 ${FALLBACK_MODEL} 성공`);
    return { text, modelUsed: FALLBACK_MODEL, wasFallback: true };
  } catch (fallbackErr) {
    console.error(`[Gemini] 폴백 모델 ${FALLBACK_MODEL}도 실패:`, (fallbackErr as Error).message);
    // 폴백도 실패하면 원래 오류를 throw
    throw lastError;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 일반 채팅 (비스트리밍) - 재시도 + 폴백 포함
// ────────────────────────────────────────────────────────────────────────────
export async function geminiChat(options: GeminiChatOptions): Promise<GeminiChatResult> {
  return chatWithRetryAndFallback(options);
}

// ────────────────────────────────────────────────────────────────────────────
// 스트리밍 채팅 - 재시도 + 폴백 후 전체 텍스트를 청크로 yield
// (스트리밍은 재시도 중 부분 응답 처리가 복잡하므로 폴백 후 전체 응답을 청크로 분할)
// ────────────────────────────────────────────────────────────────────────────
export async function* geminiChatStream(options: GeminiChatOptions): AsyncGenerator<string> {
  // 먼저 재시도/폴백 로직으로 전체 응답을 받은 뒤 청크로 나눠 yield
  const result = await chatWithRetryAndFallback(options);

  // 폴백 사용 시 첫 청크에 알림 메시지 포함
  if (result.wasFallback) {
    yield `> ⚠️ *기본 모델(${PRIMARY_MODEL}) 과부하로 인해 대체 모델(${FALLBACK_MODEL})을 사용했습니다.*\n\n`;
  }

  // 응답을 200자씩 청크로 나눠 스트리밍 효과 제공
  const chunkSize = 200;
  for (let i = 0; i < result.text.length; i += chunkSize) {
    yield result.text.slice(i, i + chunkSize);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// API 키 유효성 검사
// ────────────────────────────────────────────────────────────────────────────
export async function validateGeminiApiKey(): Promise<boolean> {
  try {
    const result = await geminiChat({
      messages: [{ role: "user", content: "ping" }],
      systemContext: "You are a test assistant. Reply with 'pong' only.",
      temperature: 0,
    });
    return result.text.toLowerCase().includes("pong");
  } catch {
    return false;
  }
}
