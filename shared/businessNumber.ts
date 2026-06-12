/**
 * 사업자등록번호 정규화 및 검증 유틸 (서버/클라이언트 공용)
 *
 * 테넌트 식별의 유일 기준은 "정규화된 사업자등록번호(숫자 10자리)"입니다.
 * - 입력값에서 하이픈/공백/기타 문자를 제거하고 숫자만 추출합니다.
 * - 표시용 원본(businessNumber)과 식별용 정규화값(businessNumberNormalized)을 분리해 저장합니다.
 */

/**
 * 사업자등록번호를 정규화합니다.
 * 하이픈/공백 등 비숫자 문자를 모두 제거하고 숫자만 반환합니다.
 * @returns 숫자만 남긴 문자열. 입력이 없으면 빈 문자열.
 */
export function normalizeBizNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw).replace(/[^0-9]/g, "");
}

/**
 * 정규화된 사업자등록번호가 유효한 형식(숫자 10자리)인지 검증합니다.
 */
export function isValidBizNumber(raw: string | null | undefined): boolean {
  return normalizeBizNumber(raw).length === 10;
}

/**
 * 정규화된 사업자등록번호를 표시용 형식(XXX-XX-XXXXX)으로 포맷합니다.
 * 10자리가 아니면 정규화된 원본을 그대로 반환합니다.
 */
export function formatBizNumber(raw: string | null | undefined): string {
  const n = normalizeBizNumber(raw);
  if (n.length !== 10) return n;
  return `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}`;
}
