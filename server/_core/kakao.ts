/**
 * 카카오 알림톡 연동 모듈
 * 카카오 비즈니스 API (solapi/coolsms 호환)를 통해 알림톡 발송
 * 
 * 실제 운영 시 KAKAO_API_KEY, KAKAO_SENDER_KEY 환경변수 설정 필요
 * 미설정 시 개발 모드로 콘솔 출력만 수행
 */

import { ENV } from "./env";

// ─── 알림톡 템플릿 코드 ──────────────────────────────────────────
export const KAKAO_TEMPLATES = {
  BOOKING_CONFIRMED: "DOGOLF_BOOKING_CONFIRMED",
  BOOKING_CANCELLED: "DOGOLF_BOOKING_CANCELLED",
  DEPARTURE_REMINDER: "DOGOLF_DEPARTURE_REMINDER",
} as const;

export type KakaoTemplateCode = typeof KAKAO_TEMPLATES[keyof typeof KAKAO_TEMPLATES];

// ─── 알림톡 메시지 타입 ──────────────────────────────────────────
export interface KakaoAlimtalkMessage {
  to: string;           // 수신자 전화번호 (010-XXXX-XXXX 또는 01XXXXXXXXX)
  templateCode: string; // 카카오 템플릿 코드
  variables: Record<string, string>; // 템플릿 변수
}

export interface KakaoSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── 템플릿 메시지 빌더 ──────────────────────────────────────────
export function buildBookingConfirmedMessage(params: {
  customerName: string;
  bookingNumber: string;
  packageTitle: string;
  departureDate: string;
  totalAmount: string;
  totalPeople: number;
}): { templateCode: string; variables: Record<string, string>; text: string } {
  const text = `[두골프] 예약 확정 안내

안녕하세요, ${params.customerName}님!
예약이 확정되었습니다.

■ 예약번호: ${params.bookingNumber}
■ 패키지: ${params.packageTitle}
■ 출발일: ${params.departureDate}
■ 인원: ${params.totalPeople}명
■ 결제금액: ${Number(params.totalAmount).toLocaleString()}원

문의: 1668-1739 (평일 09:00~17:30)
두골프 www.dogolf.co.kr`;

  return {
    templateCode: KAKAO_TEMPLATES.BOOKING_CONFIRMED,
    variables: {
      "#{고객명}": params.customerName,
      "#{예약번호}": params.bookingNumber,
      "#{패키지명}": params.packageTitle,
      "#{출발일}": params.departureDate,
      "#{인원}": `${params.totalPeople}명`,
      "#{결제금액}": `${Number(params.totalAmount).toLocaleString()}원`,
    },
    text,
  };
}

export function buildBookingCancelledMessage(params: {
  customerName: string;
  bookingNumber: string;
  packageTitle: string;
  cancelReason?: string;
}): { templateCode: string; variables: Record<string, string>; text: string } {
  const text = `[두골프] 예약 취소 안내

안녕하세요, ${params.customerName}님.
예약이 취소되었습니다.

■ 예약번호: ${params.bookingNumber}
■ 패키지: ${params.packageTitle}
${params.cancelReason ? `■ 취소사유: ${params.cancelReason}` : ""}

환불은 영업일 기준 3~5일 소요됩니다.
문의: 1668-1739`;

  return {
    templateCode: KAKAO_TEMPLATES.BOOKING_CANCELLED,
    variables: {
      "#{고객명}": params.customerName,
      "#{예약번호}": params.bookingNumber,
      "#{패키지명}": params.packageTitle,
      "#{취소사유}": params.cancelReason ?? "고객 요청",
    },
    text,
  };
}

export function buildDepartureReminderMessage(params: {
  customerName: string;
  bookingNumber: string;
  packageTitle: string;
  departureDate: string;
  meetingPoint?: string;
  meetingTime?: string;
}): { templateCode: string; variables: Record<string, string>; text: string } {
  const text = `[두골프] 내일 출발 안내

안녕하세요, ${params.customerName}님!
내일 출발하시는 골프여행 안내드립니다.

■ 예약번호: ${params.bookingNumber}
■ 패키지: ${params.packageTitle}
■ 출발일: ${params.departureDate}
${params.meetingPoint ? `■ 집결장소: ${params.meetingPoint}` : ""}
${params.meetingTime ? `■ 집결시간: ${params.meetingTime}` : ""}

즐거운 골프여행 되세요!
문의: 1668-1739`;

  return {
    templateCode: KAKAO_TEMPLATES.DEPARTURE_REMINDER,
    variables: {
      "#{고객명}": params.customerName,
      "#{예약번호}": params.bookingNumber,
      "#{패키지명}": params.packageTitle,
      "#{출발일}": params.departureDate,
      "#{집결장소}": params.meetingPoint ?? "미정",
      "#{집결시간}": params.meetingTime ?? "미정",
    },
    text,
  };
}

// ─── 알림톡 발송 함수 ────────────────────────────────────────────
export async function sendAlimtalk(message: KakaoAlimtalkMessage): Promise<KakaoSendResult> {
  const apiKey = ENV.kakaoApiKey;
  const senderKey = ENV.kakaoSenderKey;

  // 개발 모드: API 키 미설정 시 콘솔 출력
  if (!apiKey || !senderKey) {
    console.log("[Kakao Alimtalk] DEV MODE - 실제 발송 없음");
    console.log(`  수신자: ${message.to}`);
    console.log(`  템플릿: ${message.templateCode}`);
    console.log(`  변수:`, message.variables);
    return { success: true, messageId: `dev_${Date.now()}` };
  }

  try {
    // Solapi (구 CoolSMS) API 호환 형식
    // 실제 운영 시 solapi SDK 또는 직접 API 호출 사용
    const payload = {
      messages: [
        {
          to: message.to.replace(/-/g, ""), // 하이픈 제거
          from: senderKey,
          type: "ATA", // 알림톡
          kakaoOptions: {
            pfId: senderKey,
            templateId: message.templateCode,
            variables: message.variables,
          },
        },
      ],
    };

    // Solapi API 엔드포인트
    const response = await fetch("https://api.solapi.com/messages/v4/send-many", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Solapi API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as { groupId?: string; errorCount?: number };
    console.log(`[Kakao Alimtalk] 발송 성공: ${message.to} (${message.templateCode})`);

    return {
      success: true,
      messageId: result.groupId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Kakao Alimtalk] 발송 실패: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

// ─── 예약 확정 알림 발송 ─────────────────────────────────────────
export async function sendBookingConfirmedNotification(params: {
  phone: string;
  customerName: string;
  bookingNumber: string;
  packageTitle: string;
  departureDate: string;
  totalAmount: string;
  totalPeople: number;
}): Promise<KakaoSendResult> {
  const { templateCode, variables } = buildBookingConfirmedMessage(params);
  return sendAlimtalk({ to: params.phone, templateCode, variables });
}

// ─── 예약 취소 알림 발송 ─────────────────────────────────────────
export async function sendBookingCancelledNotification(params: {
  phone: string;
  customerName: string;
  bookingNumber: string;
  packageTitle: string;
  cancelReason?: string;
}): Promise<KakaoSendResult> {
  const { templateCode, variables } = buildBookingCancelledMessage(params);
  return sendAlimtalk({ to: params.phone, templateCode, variables });
}

// ─── 출발 D-1 알림 발송 ─────────────────────────────────────────
export async function sendDepartureReminderNotification(params: {
  phone: string;
  customerName: string;
  bookingNumber: string;
  packageTitle: string;
  departureDate: string;
  meetingPoint?: string;
  meetingTime?: string;
}): Promise<KakaoSendResult> {
  const { templateCode, variables } = buildDepartureReminderMessage(params);
  return sendAlimtalk({ to: params.phone, templateCode, variables });
}
