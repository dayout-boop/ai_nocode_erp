// D-LIVE-FULL — 두골프 ERP 유틸 라이브러리
// dateUtils: 날짜 포맷팅/유효성 검증 유틸 함수

/**
 * 날짜를 지정된 포맷 문자열로 변환합니다.
 * 기본 포맷: 'YYYY-MM-DD'
 * 지원 포맷토큰: YYYY, MM, DD, HH, mm, ss
 * @param date - Date 객체 또는 변환 가능한 값 (null/undefined 시 오류 발생)
 * @param format - 날짜 포맷 문자열 (기본값: 'YYYY-MM-DD')
 * @returns 포맷된 날짜 문자열
 * @throws 입력이 유효한 Date가 아닐 경우 Error
 */
export function formatDate(date: Date | string | number | null | undefined, format: string = 'YYYY-MM-DD'): string {
  const d = toDate(date);
  if (!isValidDate(d)) {
    throw new Error('Invalid date input for formatDate');
  }
  return formatDateInternal(d, format);
}

/**
 * 날짜와 시간을 지정된 포맷 문자열로 변환합니다.
 * 기본 포맷: 'YYYY-MM-DD HH:mm:ss'
 * @param date - Date 객체 또는 변환 가능한 값
 * @param format - 날짜 포맷 문자열 (기본값: 'YYYY-MM-DD HH:mm:ss')
 * @returns 포맷된 날짜시간 문자열
 * @throws 입력이 유효한 Date가 아닐 경우 Error
 */
export function formatDateTime(date: Date | string | number | null | undefined, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  const d = toDate(date);
  if (!isValidDate(d)) {
    throw new Error('Invalid date input for formatDateTime');
  }
  return formatDateInternal(d, format);
}

/**
 * 주어진 값이 유효한 날짜인지 확인합니다.
 * 문자열이나 숫자는 Date 객체로 변환하여 검증합니다.
 * @param date - 검증할 값
 * @returns 유효한 날짜면 true, 아니면 false
 */
export function isValidDate(date: any): boolean {
  if (date === null || date === undefined) return false;
  if (date instanceof Date) {
    return !isNaN(date.getTime());
  }
  if (typeof date === 'string' || typeof date === 'number') {
    const d = new Date(date);
    return !isNaN(d.getTime());
  }
  return false;
}

/**
 * 입력값을 Date 객체로 변환합니다.
 * @param input - Date, 문자열, 숫자, null, undefined
 * @returns Date 객체 (변환 불가 시 Invalid Date 반환)
 */
function toDate(input: Date | string | number | null | undefined): Date {
  if (input instanceof Date) return new Date(input.getTime()); // copy
  if (typeof input === 'string' || typeof input === 'number') {
    const d = new Date(input);
    return d;
  }
  return new Date(NaN); // invalid
}

/**
 * 내부 포맷팅 함수 (실제 변환 로직)
 * @param d - 유효한 Date 객체
 * @param format - 포맷 문자열
 * @returns 포맷된 문자열
 */
function formatDateInternal(d: Date, format: string): string {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();

  const pad = (num: number): string => String(num).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', pad(month))
    .replace('DD', pad(day))
    .replace('HH', pad(hours))
    .replace('mm', pad(minutes))
    .replace('ss', pad(seconds));
}
