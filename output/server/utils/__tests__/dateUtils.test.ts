// dateUtils.test.ts – 단위 테스트 (정상/비정상, 경계값)
import { formatDate, formatDateTime, isValidDate } from '../dateUtils';

describe('formatDate', () => {
  it('기본 포맷: YYYY-MM-DD', () => {
    const d = new Date(2025, 0, 15); // 2025-01-15
    expect(formatDate(d)).toBe('2025-01-15');
  });
  it('월/일 한 자리 -> 두 자리', () => {
    const d = new Date(2025, 2, 5); // 2025-03-05
    expect(formatDate(d)).toBe('2025-03-05');
  });
  it('윤년 2월 29일', () => {
    const d = new Date(2024, 1, 29); // 2024-02-29
    expect(formatDate(d)).toBe('2024-02-29');
  });
  it('월말 12월 31일', () => {
    const d = new Date(2025, 11, 31); // 2025-12-31
    expect(formatDate(d)).toBe('2025-12-31');
  });
});

describe('formatDateTime', () => {
  it('기본 포맷: YYYY-MM-DD HH:mm', () => {
    const d = new Date(2025, 0, 15, 9, 5); // 2025-01-15 09:05
    expect(formatDateTime(d)).toBe('2025-01-15 09:05');
  });
  it('시/분 한 자리 -> 두 자리', () => {
    const d = new Date(2025, 6, 4, 3, 7); // 2025-07-04 03:07
    expect(formatDateTime(d)).toBe('2025-07-04 03:07');
  });
  it('자정', () => {
    const d = new Date(2025, 0, 1, 0, 0);
    expect(formatDateTime(d)).toBe('2025-01-01 00:00');
  });
});

describe('isValidDate', () => {
  it('유효 날짜 YYYY-MM-DD', () => {
    expect(isValidDate('2025-01-15')).toBe(true);
  });
  it('유효 날짜 YYYY-MM-DD HH:mm', () => {
    expect(isValidDate('2025-01-15 09:05')).toBe(true);
  });
  it('윤년 2월 29일', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
  });
  it('비윤년 2월 29일 -> false', () => {
    expect(isValidDate('2025-02-29')).toBe(false);
  });
  it('존재하지 않는 날 (4월 31일)', () => {
    expect(isValidDate('2025-04-31')).toBe(false);
  });
  it('형식 오류: 일-월-년', () => {
    expect(isValidDate('15-01-2025')).toBe(false);
  });
  it('빈 문자열', () => {
    expect(isValidDate('')).toBe(false);
  });
  it('공백 포함 유효 날짜', () => {
    expect(isValidDate('  2025-01-15  ')).toBe(true);
  });
  it('월말 12월 31일', () => {
    expect(isValidDate('2025-12-31')).toBe(true);
  });
  it('0월은 존재하지 않음', () => {
    expect(isValidDate('2025-00-01')).toBe(false);
  });
});
