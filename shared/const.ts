export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// ============================================================
// 멀티테넌트: 두골프 = 마스터 = tenantId 고정 1 (영구 예약)
// 신규 파트너는 2부터 순차 발급, 1번은 항상 두골프 전용.
// 상수번호 방식: 어느 환경이든 두골프는 항상 tenant#1로 일관.
// ============================================================
export const DOGOLF_TENANT_ID = 1;

// 마스터 테넌트 셀렉터가 전달하는 헤더명 (마스터 세션 전용, 파트너는 무시)
export const ACTIVE_TENANT_HEADER = "x-active-tenant";
// 셀렉터 '전체보기' 값 (tenantId = null 로 매핑)
export const ACTIVE_TENANT_ALL = "all";
