// dateUtils.ts – 날짜 포맷팅/유효성 검증 유틸 함수
// 설계 D-LIVE-TEST / D0-UNIT5

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

export function isValidDate(dateStr: string): boolean {
  // YYYY-MM-DD 또는 YYYY-MM-DD HH:mm 형식 허용
  const trimmed = dateStr.trim();
  // 날짜 부분만 추출 (공백 이후는 무시)
  const datePart = trimmed.split(' ')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return false;

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return false;

  // new Date()가 입력과 동일한 년/월/일을 가지는지 확인
  const [y, m, day] = datePart.split('-').map(Number);
  return (
    d.getFullYear() === y &&
    d.getMonth() + 1 === m &&
    d.getDate() === day
  );
}
