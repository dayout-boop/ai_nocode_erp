import { formatDate, formatDateTime, isValidDate } from './dateUtils';

describe('isValidDate', () => {
  test('유효한 Date 객체는 true를 반환한다', () => {
    expect(isValidDate(new Date())).toBe(true);
    expect(isValidDate(new Date('2024-01-01'))).toBe(true);
  });

  test('Invalid Date 객체는 false를 반환한다', () => {
    expect(isValidDate(new Date('invalid'))).toBe(false);
  });

  test('null과 undefined는 false를 반환한다', () => {
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });

  test('유효한 문자열은 true를 반환한다', () => {
    expect(isValidDate('2024-12-25')).toBe(true);
    expect(isValidDate('2024/12/25')).toBe(true);
  });

  test('유효하지 않은 문자열은 false를 반환한다', () => {
    expect(isValidDate('abcdef')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });

  test('유효한 숫자(timestamp)는 true를 반환한다', () => {
    expect(isValidDate(1704067200000)).toBe(true); // 2024-01-01
  });

  test('객체와 배열은 false를 반환한다', () => {
    expect(isValidDate({})).toBe(false);
    expect(isValidDate([])).toBe(false);
  });
});

describe('formatDate', () => {
  test('기본 포맷 YYYY-MM-DD로 변환한다', () => {
    const date = new Date(2024, 0, 1); // 2024-01-01
    expect(formatDate(date)).toBe('2024-01-01');
  });

  test('커스텀 포맷을 적용한다', () => {
    const date = new Date(2024, 11, 25, 10, 30, 45);
    expect(formatDate(date, 'YYYY/MM/DD')).toBe('2024/12/25');
    expect(formatDate(date, 'DD-MM-YYYY')).toBe('25-12-2024');
  });

  test('문자열 입력을 처리한다', () => {
    expect(formatDate('2024-06-15')).toBe('2024-06-15');
  });

  test('숫자(timestamp) 입력을 처리한다', () => {
    const timestamp = new Date(2024, 0, 1).getTime();
    expect(formatDate(timestamp)).toBe('2024-01-01');
  });

  test('유효하지 않은 입력에 대해 에러를 던진다', () => {
    expect(() => formatDate(null)).toThrow();
    expect(() => formatDate(undefined)).toThrow();
    expect(() => formatDate('invalid-date')).toThrow();
  });
});

describe('formatDateTime', () => {
  test('기본 포맷 YYYY-MM-DD HH:mm:ss로 변환한다', () => {
    const date = new Date(2024, 0, 1, 9, 5, 3);
    expect(formatDateTime(date)).toBe('2024-01-01 09:05:03');
  });

  test('커스텀 포맷을 적용한다', () => {
    const date = new Date(2024, 11, 25, 14, 30, 0);
    expect(formatDateTime(date, 'HH:mm DD/MM/YYYY')).toBe('14:30 25/12/2024');
  });

  test('문자열 입력을 처리한다', () => {
    expect(formatDateTime('2024-03-15T08:20:30')).toBe('2024-03-15 08:20:30');
  });

  test('유효하지 않은 입력에 대해 에러를 던진다', () => {
    expect(() => formatDateTime(null)).toThrow();
    expect(() => formatDateTime(undefined)).toThrow();
    expect(() => formatDateTime('')).toThrow();
  });
});
