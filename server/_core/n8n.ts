/**
 * n8n 자동화 파이프라인 Webhook 헬퍼
 * n8n 워크플로우를 HTTP Webhook으로 트리거합니다.
 */
import { ENV } from "./env";

export interface N8nWebhookPayload {
  event: string;
  [key: string]: unknown;
}

export interface N8nTriggerResult {
  success: boolean;
  durationMs: number;
  responseStatus: number;
  error?: string;
}

/**
 * n8n Webhook 트리거
 * N8N_WEBHOOK_URL 미설정 시 개발 모드로 동작 (성공 반환)
 */
export async function triggerN8nWebhook(
  payload: N8nWebhookPayload
): Promise<N8nTriggerResult> {
  const startTime = Date.now();
  const webhookUrl = ENV.n8nWebhookUrl;

  // 개발 모드: URL 미설정 시 콘솔 출력 후 성공 반환
  if (!webhookUrl) {
    console.log("[n8n] DEV MODE - Webhook URL 미설정");
    console.log(`  이벤트: ${payload.event}`);
    console.log("  페이로드:", JSON.stringify(payload, null, 2));
    return {
      success: true,
      durationMs: Date.now() - startTime,
      responseStatus: 200,
    };
  }

  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(30_000), // 30초 타임아웃
    });

    const durationMs = Date.now() - startTime;

    if (!resp.ok) {
      const errorText = await resp.text();
      return {
        success: false,
        durationMs,
        responseStatus: resp.status,
        error: `HTTP ${resp.status}: ${errorText}`,
      };
    }

    return {
      success: true,
      durationMs,
      responseStatus: resp.status,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[n8n] Webhook 트리거 실패:", errorMessage);
    return {
      success: false,
      durationMs,
      responseStatus: 0,
      error: errorMessage,
    };
  }
}

/**
 * 상품 SNS 배포 파이프라인 트리거
 */
export async function triggerPackagePublishPipeline(pkg: {
  id: number;
  title: string;
  country: string;
  region?: string | null;
  imageUrl?: string | null;
}): Promise<N8nTriggerResult> {
  return triggerN8nWebhook({
    event: "package_published",
    packageId: pkg.id,
    title: pkg.title,
    country: pkg.country,
    region: pkg.region ?? null,
    imageUrl: pkg.imageUrl ?? null,
  });
}

/**
 * 예약 확정 파이프라인 트리거 (알림톡 + 정산 자동생성)
 */
export async function triggerBookingConfirmedPipeline(booking: {
  id: number;
  bookingNumber: string;
  customerName: string;
  customerPhone: string;
  packageTitle: string;
  departureDate: string;
  totalAmount: number;
  totalPeople: number;
}): Promise<N8nTriggerResult> {
  return triggerN8nWebhook({
    event: "booking_confirmed",
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    packageTitle: booking.packageTitle,
    departureDate: booking.departureDate,
    totalAmount: booking.totalAmount,
    totalPeople: booking.totalPeople,
  });
}
