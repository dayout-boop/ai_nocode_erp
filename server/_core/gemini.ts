/**
 * Gemini AI 어시스턴트 헬퍼
 * - 두골프 ERP 시스템 컨텍스트를 자동으로 주입
 * - 관리자 명령을 분석하고 실행 계획을 제안
 * - 스트리밍 응답 지원
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { ENV } from "./env";

// ENV를 통해 중앙화된 환경변수 접근 (process.env 직접 접근 방지)

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

// ────────────────────────────────────────────────────────────────────────────
// 일반 채팅 (비스트리밍)
// ────────────────────────────────────────────────────────────────────────────
export async function geminiChat(options: GeminiChatOptions): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
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

  // 대화 히스토리 변환 (마지막 메시지 제외)
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
// 스트리밍 채팅 (Server-Sent Events용)
// ────────────────────────────────────────────────────────────────────────────
export async function* geminiChatStream(options: GeminiChatOptions): AsyncGenerator<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
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
  const result = await chat.sendMessageStream(lastMessage.content);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// API 키 유효성 검사
// ────────────────────────────────────────────────────────────────────────────
export async function validateGeminiApiKey(): Promise<boolean> {
  try {
    const response = await geminiChat({
      messages: [{ role: "user", content: "ping" }],
      systemContext: "You are a test assistant. Reply with 'pong' only.",
      temperature: 0,
    });
    return response.toLowerCase().includes("pong");
  } catch {
    return false;
  }
}
