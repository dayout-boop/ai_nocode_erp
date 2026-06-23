// D0-UNIT3: isValidDate 테스트
import { describe, it, expect } from 'vitest';
import { isValidDate } from './dateUtils';

describe('isValidDate', () => {
  it('유효한 날짜(YYYY-MM-DD)를 true로 반환해야 함', () => {
    expect(isValidDate('2025-01-01')).toBe(true);
    expect(isValidDate('2024-02-29')).toBe(true); // 윤년
    expect(isValidDate('2023-12-31')).toBe(true);
    expect(isValidDate('2000-02-29')).toBe(true); // 2000년은 윤년
  });

  it('유효하지 않은 날짜는 false를 반환해야 함', () => {
    expect(isValidDate('')).toBe(false);
    expect(isValidDate('2025-13-01')).toBe(false); // 월 범위 초과
    expect(isValidDate('2025-00-01')).toBe(false); // 월 0
    expect(isValidDate('2025-01-00')).toBe(false); // 일 0
    expect(isValidDate('2025-01-32')).toBe(false); // 일 초과
    expect(isValidDate('2023-02-29')).toBe(false); // 평년 2월 29일
    expect(isValidDate('2025-04-31')).toBe(false); // 4월은 30일까지
    expect(isValidDate('abcd-12-01')).toBe(false); // 숫자가 아님
    expect(isValidDate('2025/01/01')).toBe(false); // 구분자 오류
  });

  it('경계값 테스트: 윤년, 월말 등', () => {
    expect(isValidDate('1900-02-28')).toBe(true);  // 1900년은 평년, 2월28일 유효
    expect(isValidDate('1900-02-29')).toBe(false); // 1900년은 평년
    expect(isValidDate('2099-02-28')).toBe(true);
    expect(isValidDate('2099-02-29')).toBe(false); // 2099년은 평년
    expect(isValidDate('2000-02-29')).toBe(true);  // 2000년은 윤년
  });
});
