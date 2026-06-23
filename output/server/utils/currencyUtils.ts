import { getCurrencySymbol, isValidCurrencyCode } from './currencyCodes.js';

/**
 * 금액을 주어진 통화 형식으로 포맷팅합니다.
 * @param amount - 포맷할 숫자 금액
 * @param currency - ISO 4217 통화 코드 (예: 'KRW')
 * @param locale - 로케일 문자열 (기본값 'ko-KR')
 * @returns 포맷된 통화 문자열 (예: ₩10,000)
 */
export function formatCurrency(
  amount: number,
  currency: string,
  locale: string = 'ko-KR'
): string {
  if (!isValidCurrencyCode(currency)) {
    throw new Error(`Invalid currency code: ${currency}`);
  }
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount);
}

/**
 * 통화 포맷 문자열을 파싱하여 숫자 금액으로 변환합니다.
 * @param value - 포맷된 통화 문자열 (예: '₩10,000' 또는 '$1,234.56')
 * @returns 파싱된 숫자 금액
 */
export function parseCurrency(value: string): number {
  // 통화 심볼, 쉼표, 공백 제거 후 숫자와 점, 마이너스만 남김
  const cleaned = value.replace(/[^0-9\.\-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) {
    throw new Error(`Unable to parse currency value: "${value}"`);
  }
  return parsed;
}

/**
 * 환율 정보를 사용하여 금액을 다른 통화로 변환합니다.
 * @param amount - 변환할 금액
 * @param from - 출발 통화 코드
 * @param to - 도착 통화 코드
 * @param rates - 환율 객체 (기준 통화 대비 환율, 예: { USD: 1, KRW: 1300 })
 * @returns 변환된 금액
 * @throws 두 통화 코드가 rates에 없을 경우 에러
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  const fromRate = rates[from];
  const toRate = rates[to];
  if (fromRate === undefined || toRate === undefined) {
    throw new Error(
      `Exchange rate not found for from="${from}" or to="${to}".`
    );
  }
  // 기준 통화는 rates의 베이스 (보통 USD). amount * (toRate / fromRate)
  return (amount * toRate) / fromRate;
}

/**
 * 금액을 주어진 통화 심볼과 함께 포맷팅합니다. (formatCurrency의 alias)
 */
export { formatCurrency as formatCurrencyWithSymbol };

export { getCurrencySymbol, isValidCurrencyCode } from './currencyCodes.js';
