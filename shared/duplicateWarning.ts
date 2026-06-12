/**
 * 예약 중복 경고 메시지 처리 유틸 (서버↔클라이언트 공유)
 *
 * 서버는 동일 조건(고객명·출발일·골프장) 예약이 이미 있으면
 * TRPCError(code: CONFLICT, message: "DUPLICATE_RESERVATION:번호1,번호2") 를 반환한다.
 * 클라이언트는 이 메시지를 파싱해 중복 경고 다이얼로그에 기존 예약번호를 표시한다.
 */

export const DUPLICATE_RESERVATION_PREFIX = "DUPLICATE_RESERVATION:";

/** 중복 경고 메시지 생성 (서버에서 throw 시 사용) */
export function buildDuplicateMessage(reservationNos: string[]): string {
  return `${DUPLICATE_RESERVATION_PREFIX}${reservationNos.filter(Boolean).join(",")}`;
}

/** 에러 메시지가 중복 경고인지 판별 */
export function isDuplicateMessage(message: string | undefined | null): boolean {
  return typeof message === "string" && message.startsWith(DUPLICATE_RESERVATION_PREFIX);
}

/**
 * 중복 경고 메시지에서 기존 예약번호 배열을 추출.
 * 중복 경고가 아니면 null 반환.
 */
export function parseDuplicateMessage(message: string | undefined | null): string[] | null {
  if (!isDuplicateMessage(message)) return null;
  return (message as string)
    .slice(DUPLICATE_RESERVATION_PREFIX.length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
