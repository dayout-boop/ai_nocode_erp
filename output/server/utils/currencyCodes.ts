export const CURRENCY_SYMBOLS: Record<string, string> = {
  KRW: '₩',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  CNY: '¥',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  HKD: 'HK$',
  SGD: 'S$',
  THB: '฿',
  VND: '₫',
  TWD: 'NT$',
  MXN: 'Mex$',
  INR: '₹',
};

export const VALID_CURRENCY_CODES = Object.keys(CURRENCY_SYMBOLS);

/**
 * 통화 코드가 유효한지 검증합니다.
 * @param code - ISO 4217 3자리 통화 코드 (예: 'USD')
 * @returns 유효 여부
 */
export function isValidCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code) && VALID_CURRENCY_CODES.includes(code.toUpperCase());
}

/**
 * 통화 코드에 해당하는 심볼을 반환합니다.
 * @param currency - 통화 코드
 * @returns 통화 심볼 (예: '$')
 */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency;
}
