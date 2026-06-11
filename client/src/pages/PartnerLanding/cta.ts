/**
 * 파트너 랜딩 "무료로 시작하기 / 지금 시작하기" 공용 진입점
 *
 * 개선된 UX 흐름 (2026-06-10):
 *  1. 사용자가 "무료로 시작하기" 클릭
 *  2. → /partner/onboarding-chat (AI파트너매니저 소개 페이지)
 *  3. → 사용자가 "시작하기" 클릭
 *  4. → 구글 로그인 (returnUrl=/partner/onboarding-chat)
 *  5. → 콜백이 상태별 분기
 *     - 기가입 활성 파트너        → /erp (테넌트1과 동일한 풀 ERP 대시보드)
 *     - 온보딩 승인 + 등록증 보유  → 자동 활성화 후 /erp 진입
 *     - 등록증 미제출             → /partner/pending-verification
 *     - 진행중(pending)/신규      → /partner/onboarding-chat (채팅 계속)
 *
 * 모든 가입/시작 CTA 버튼은 이 상수를 사용해 단일 진입점으로 통일한다.
 */
export const PARTNER_SIGNUP_ENTRY = "/partner/onboarding-chat";

/** 기존 파트너 로그인 페이지 (아이디/비밀번호) */
export const PARTNER_LOGIN_URL = "/partner/login";
