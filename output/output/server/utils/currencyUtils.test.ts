// currencyUtils.test.ts
// D0-UNIT2 테스트

import { formatCurrency, parseCurrency } from './currencyUtils';

describe('formatCurrency', () => {
  it('한국 원화 형식으로 포맷', () => {
    expect(formatCurrency(10000)).toBe('₩10,000');
  });

  it('미국 달러 형식으로 포맷', () => {
    expect(formatCurrency(1234.56, 'en-US', 'USD')).toBe('$1,234.56');
  });

  it('소수점 금액 포맷 (0원)', () => {
    expect(formatCurrency(0)).toBe('₩0');
  });

  it('음수 금액 포맷', () => {
    expect(formatCurrency(-5000)).toBe('-₩5,000');
  });

  it('소수점 포함 금액 (최대 2자리)', () => {
    expect(formatCurrency(99.9)).toBe('₩99.9');
  });

  it('NaN 전달 시 에러 발생', () => {
    expect(() => formatCurrency(NaN)).toThrow(TypeError);
  });

  it('Infinity 전달 시 에러 발생', () => {
    expect(() => formatCurrency(Infinity)).toThrow(TypeError);
  });

  it('유효하지 않은 로케일 전달 시 에러 발생', () => {
    expect(() => formatCurrency(1000, 'invalid_locale')).toThrow(Error);
  });
});

describe('parseCurrency', () => {
  it('한국 원화 문자열 파싱', () => {
    expect(parseCurrency('₩10,000')).toBe(10000);
  });

  it('미국 달러 문자열 파싱', () => {
    expect(parseCurrency('$1,234.56', 'en-US')).toBe(1234.56);
  });

  it('공백 및 기호 제거', () => {
    expect(parseCurrency(' ₩ 5,000 ')).toBe(5000);
  });

  it('음수 금액 파싱', () => {
    expect(parseCurrency('-₩3,000')).toBe(-3000);
  });

  it('소수점 없는 금액', () => {
    expect(parseCurrency('₩0')).toBe(0);
  });

  it('빈 문자열 전달 시 에러', () => {
    expect(() => parseCurrency('')).toThrow(TypeError);
  });

  it('숫자만 포함되지 않은 문자열 전달 시 에러', () => {
    expect(() => parseCurrency('abc')).toThrow(TypeError);
  });

  it('null 전달 시 에러', () => {
    expect(() => parseCurrency(null as any)).toThrow(TypeError);
  });

  it('undefined 전달 시 에러', () => {
    expect(() => parseCurrency(undefined as any)).toThrow(TypeError);
  });

  it('유럽식 콤마 파싱 (프랑스)', () => {
    // 프랑스 로케일에서는 1 234,56 형식 가능
    expect(parseCurrency('1 234,56€', 'fr-FR')).toBe(1234.56);
  });
});
