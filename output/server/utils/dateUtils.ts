// D0-UNIT1 — dateUtils
// 날짜 포맷팅 및 유효성 검증 유틸

type DateInput = string | number | Date;

/**
 * 주어진 날짜를 지정된 형식(포맷)의 문자열로 변환합니다.
 * 지원 토큰: YYYY(년), MM(월), DD(일), HH(시), mm(분), ss(초)
 *
 * @param date - 변환할 날짜 (Date, 문자열, 타임스탬프)
 * @param format - 출력 형식 (예: 'YYYY-MM-DD', 'YYYY/MM/DD HH:mm:ss')
 * @returns 포맷된 날짜 문자열, 유효하지 않은 입력 시 빈 문자열 반환
 *
 * @example
 * formatDate('2025-01-15', 'YYYY/MM/DD') // '2025/01/15'
 * formatDate(new Date(2025, 0, 15), 'YYYY-MM-DD') // '2025-01-15'
 */
export function formatDate(date: DateInput, format: string): string {
  const d = toDate(date);
  if (!d || isNaN(d.getTime())) return '';

  const map: Record<string, string> = {
    'YYYY': String(d.getFullYear()),
    'MM': padZero(d.getMonth() + 1),
    'DD': padZero(d.getDate()),
    'HH': padZero(d.getHours()),
    'mm': padZero(d.getMinutes()),
    'ss': padZero(d.getSeconds()),
  };

  let result = format;
  for (const [token, value] of Object.entries(map)) {
    result = result.replace(token, value);
  }
  return result;
}

/**
 * 주어진 문자열이 유효한 날짜인지 검사합니다.
 * ISO 8601, 'YYYY-MM-DD', 'YYYY/MM/DD' 형식 등을 지원합니다.
 *
 * @param dateString - 검사할 날짜 문자열
 * @returns 유효하면 true, 아니면 false
 *
 * @example
 * isValidDate('2025-01-15') // true
 * isValidDate('2025/13/01') // false (13월)
 * isValidDate('abcd') // false
 */
export function isValidDate(dateString: string): boolean {
  if (typeof dateString !== 'string' || dateString.trim() === '') return false;
  const d = new Date(dateString);
  return !isNaN(d.getTime());
}

/**
 * 날짜 문자열을 Date 객체로 변환합니다. 여러 포맷을 시도합니다.
 *
 * @param dateString - 파싱할 날짜 문자열
 * @returns Date 객체, 실패 시 null
 *
 * @example
 * parseDate('2025-01-15') // Date 객체
 * parseDate('invalid') // null
 */
export function parseDate(dateString: string): Date | null {
  if (typeof dateString !== 'string') return null;
  const trimmed = dateString.trim();
  if (trimmed === '') return null;

  // 1. 표준 Date 생성자 시도
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d;

  // 2. YYYY-MM-DD 또는 YYYY/MM/DD 형식 명시적 파싱
  const regex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
  const match = trimmed.match(regex);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const parsed = new Date(year, month, day);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

/**
 * 오늘 날짜를 'YYYY-MM-DD' 형식의 문자열로 반환합니다.
 *
 * @returns 오늘 날짜 문자열
 */
export function getToday(): string {
  return formatDate(new Date(), 'YYYY-MM-DD');
}

/**
 * 두 날짜 사이의 일수 차이를 계산합니다.
 * 음수일 경우 date1이 date2보다 이전이면 음수 반환.
 *
 * @param date1 - 시작 날짜
 * @param date2 - 종료 날짜
 * @returns 일수 차이 (정수)
 *
 * @example
 * diffDays('2025-01-01', '2025-01-10') // 9
 */
export function diffDays(date1: DateInput, date2: DateInput): number {
  const d1 = toDate(date1);
  const d2 = toDate(date2);
  if (!d1 || !d2) return NaN;

  const msPerDay = 24 * 60 * 60 * 1000;
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.floor((utc2 - utc1) / msPerDay);
}

/**
 * 주어진 날짜에 일수를 더한 새로운 Date 객체를 반환합니다.
 *
 * @param date - 기준 날짜
 * @param days - 더할 일수 (음수 가능)
 * @returns 새로운 Date 객체, 입력이 유효하지 않으면 null
 *
 * @example
 * addDays('2025-01-15', 5) // 2025-01-20의 Date 객체
 */
export function addDays(date: DateInput, days: number): Date | null {
  const d = toDate(date);
  if (!d) return null;
  const result = new Date(d.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

// ======== 내부 헬퍼 ========

/**
 * 숫자를 2자리 문자열로 패딩합니다.
 */
function padZero(num: number): string {
  return String(num).padStart(2, '0');
}

/**
 * 다양한 입력을 Date 객체로 변환합니다.
 */
function toDate(input: DateInput): Date | null {
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : new Date(input.getTime());
  }
  if (typeof input === 'string') {
    return parseDate(input);
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
