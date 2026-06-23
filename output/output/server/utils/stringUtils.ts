// stringUtils - 문자열 처리 유틸 함수
// D0-UNIT3: truncate, sanitize 구현

/**
 * 문자열을 주어진 최대 길이로 자르고 생략 부호를 추가합니다.
 * @param str - 입력 문자열
 * @param maxLength - 최대 길이 (생략 부호 포함)
 * @param ellipsis - 생략 부호 (기본값 '...')
 * @returns 잘린 문자열 (원본이 maxLength 이하면 그대로 반환)
 */
export function truncate(str: string, maxLength: number, ellipsis: string = '...'): string {
  if (!str || maxLength <= 0) return '';
  if (str.length <= maxLength) return str;

  const ellipsisLen = ellipsis.length;
  const availLength = maxLength - ellipsisLen;

  if (availLength <= 0) {
    // maxLength가 ellipsis보다 작거나 같으면 ellipsis만 반환 (길이 제한)
    return ellipsis.slice(0, maxLength);
  }

  return str.slice(0, availLength) + ellipsis;
}

/**
 * 입력 문자열을 살균(sanitize)하여 HTML 특수 문자를 이스케이프 처리합니다.
 * @param str - 입력 문자열
 * @returns 이스케이프된 문자열 (null/undefined는 빈 문자열 반환)
 */
export function sanitize(str: string | null | undefined): string {
  if (str == null) return '';

  const entityMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return String(str).replace(/[&<>"'/]/g, (char) => entityMap[char] || char);
}
