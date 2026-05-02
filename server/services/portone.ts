/**
 * 포트원(PortOne) V2 결제 서비스
 *
 * 포트원 V2 REST API를 직접 호출하는 서버사이드 헬퍼
 * - 결제 사전 등록 (pre-register)
 * - 결제 검증 (verify)
 * - 결제 취소 (cancel)
 */
import { ENV } from "../_core/env";

const PORTONE_API_BASE = "https://api.portone.io";

/** 포트원 V2 API 공통 헤더 */
function getHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `PortOne ${ENV.portoneApiSecret}`,
  };
}

/** 결제 정보 조회 */
export async function getPayment(paymentId: string) {
  const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`포트원 결제 조회 실패: ${res.status} ${err}`);
  }

  return res.json() as Promise<PortOnePayment>;
}

/** 결제 취소 */
export async function cancelPayment(paymentId: string, reason: string, amount?: number) {
  const body: Record<string, unknown> = { reason };
  if (amount !== undefined) {
    body.amount = amount;
  }

  const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`포트원 결제 취소 실패: ${res.status} ${err}`);
  }

  return res.json();
}

/** 결제 검증 - 금액 일치 여부 확인 */
export async function verifyPayment(paymentId: string, expectedAmount: number): Promise<{
  success: boolean;
  payment: PortOnePayment | null;
  error?: string;
}> {
  try {
    const payment = await getPayment(paymentId);

    // 결제 상태 확인
    if (payment.status !== "PAID") {
      return {
        success: false,
        payment,
        error: `결제 상태가 유효하지 않습니다: ${payment.status}`,
      };
    }

    // 금액 일치 확인
    if (payment.amount.total !== expectedAmount) {
      return {
        success: false,
        payment,
        error: `결제 금액 불일치: 예상 ${expectedAmount}원, 실제 ${payment.amount.total}원`,
      };
    }

    return { success: true, payment };
  } catch (err) {
    return {
      success: false,
      payment: null,
      error: err instanceof Error ? err.message : "결제 검증 중 오류 발생",
    };
  }
}

// ─── 포트원 V2 타입 정의 ─────────────────────────────────────────

export interface PortOnePayment {
  id: string;
  transactionId: string;
  merchantId: string;
  storeId: string;
  paymentId: string;
  status: "VIRTUAL_ACCOUNT_ISSUED" | "PAID" | "FAILED" | "CANCELLED" | "PARTIAL_CANCELLED";
  orderName: string;
  amount: {
    total: number;
    taxFree: number;
    vat: number;
    supply: number;
    discount: number;
    paid: number;
    cancelled: number;
    cancelledTaxFree: number;
  };
  currency: string;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
  };
  method?: {
    type: string;
    card?: {
      number?: string;
      installmentMonths?: number;
      isInterestFree?: boolean;
      approvalNumber?: string;
    };
  };
  paidAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  requestedAt: string;
  updatedAt: string;
  statusChangedAt: string;
  customData?: string;
  channel?: {
    id: string;
    type: string;
    name: string;
    pgProvider: string;
    pgMerchantId: string;
  };
  receiptUrl?: string;
}
