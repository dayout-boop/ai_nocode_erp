/**
 * 파트너 랜딩 "무료로 시작하기 / 지금 시작하기" 공용 진입점
 *
 * 흐름: 구글 인증 → 서버 콜백(/api/partner/auth/google/callback)이 상태별 분기
 *  - 기가입 활성 파트너        → /erp (테넌트1과 동일한 풀 ERP 대시보드)
 *  - 온보딩 승인 + 등록증 보유  → 자동 활성화 후 /erp 진입
 *  - 등록증 미제출             → /partner/pending-verification
 *  - 진행중(pending)/신규      → /partner/onboarding-chat (두골프 매니저 + 가입 플로우)
 *
 * returnUrl은 신규 가입자 기준값(onboarding-chat)으로 두되,
 * 콜백 로직이 "이미 승인·활성 파트너"는 onboarding-chat 대신 /erp로 강제한다.
 * 따라서 신규/기가입 모두 올바른 목적지로 도착한다.
 *
 * 모든 가입/시작 CTA 버튼은 이 상수를 사용해 단일 진입점으로 통일한다.
 */
export const PARTNER_SIGNUP_ENTRY =
  "/api/partner/auth/google?returnUrl=" + encodeURIComponent("/partner/onboarding-chat");

/** 기존 파트너 로그인 페이지 (아이디/비밀번호) */
export const PARTNER_LOGIN_URL = "/partner/login";
