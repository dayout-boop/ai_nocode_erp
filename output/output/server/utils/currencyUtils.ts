// currencyUtils.ts
// D0-UNIT2: 금액 포맷팅/파싱 유틸 함수

/**
 * 주어진 숫자 금액을 로케일에 맞는 통화 형식 문자열로 변환합니다.
 * @param amount - 포맷할 금액 (number)
 * @param locale - 로케일 (기본값: 'ko-KR')
 * @param currency - 통화 코드 (기본값: 'KRW')
 * @returns 포맷된 통화 문자열 (예: ₩10,000)
 * @throws amount가 유효한 숫자가 아니면 TypeError
 */
export function formatCurrency(
  amount: number,
  locale: string = 'ko-KR',
  currency: string = 'KRW'
): string {
  if (!Number.isFinite(amount) || isNaN(amount)) {
    throw new TypeError('amount는 유한한 숫자여야 합니다.');
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (e) {
    throw new Error(`통화 포맷 실패: ${(e as Error).message}`);
  }
}

/**
 * 통화 형식 문자열에서 숫자 금액을 추출하여 파싱합니다.
 * @param value - 통화 문자열 (예: '₩10,000' 또는 '$1,234.56')
 * @param locale - 로케일 (기본값: 'ko-KR')
 * @returns 파싱된 숫자 금액
 * @throws value가 유효한 문자열이 아니거나 파싱 불가능하면 TypeError
 */
export function parseCurrency(
  value: string,
  locale: string = 'ko-KR'
): number {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError('value는 비어 있지 않은 문자열이어야 합니다.');
  }

  const cleaned = value.replace(/[^\d.,\-]/g, '').trim();
  if (cleaned === '' || cleaned === '.' || cleaned === '-') {
    throw new TypeError('통화 문자열에서 숫자를 추출할 수 없습니다.');
  }

  const normalized = cleaned
    .replace(/\.(?=.*\.)/g, '')  // 첫 번째 점 이후 모든 점 제거 (천 단위 구분자로 해석)
    .replace(',', '.'); // 유럽식 콤마를 점으로 변환? 필요 시 조정

  const number = parseFloat(normalized);
  if (isNaN(number) || !isFinite(number)) {
    throw new TypeError('파싱 결과가 유효한 숫자가 아닙니다.');
  }

  return number;
}
