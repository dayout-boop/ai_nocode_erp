/**
 * Google OAuth 자격증명 조회 헬퍼
 *
 * 조회 우선순위:
 *  1. ERP DB (erp_api_settings 테이블, AES-256 암호화 저장)
 *     - serviceKey: 'partner_google_client_id'   → clientId
 *     - serviceKey: 'partner_google_client_secret' → clientSecret
 *  2. 환경변수 폴백 (PARTNER_GOOGLE_CLIENT_ID / PARTNER_GOOGLE_CLIENT_SECRET)
 *
 * Google Cloud Secret Manager 의존성 완전 제거.
 * ERP 설정 화면(/erp/settings)에서 관리자가 직접 등록·갱신한다.
 */

import { getApiKey } from '../erpApiKeyManager';

/** 캐시 (10분 TTL) */
let cachedClientId: string | null = null;
let cachedClientSecret: string | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * ERP DB에서 파트너 구글 OAuth 자격증명 조회
 * DB에 없으면 환경변수 폴백
 */
export async function getGoogleOAuthCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
}> {
  // 캐시 유효하면 즉시 반환
  if (cachedClientId && cachedClientSecret && cacheExpiresAt > Date.now()) {
    return { clientId: cachedClientId, clientSecret: cachedClientSecret };
  }

  // 1. ERP DB 조회 (AES-256 복호화 포함)
  const [clientId, clientSecret] = await Promise.all([
    getApiKey('partner_google_client_id'),
    getApiKey('partner_google_client_secret'),
  ]);

  if (clientId && clientSecret) {
    cachedClientId = clientId;
    cachedClientSecret = clientSecret;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    console.log('[GoogleOAuth] ERP DB에서 자격증명 로드 완료');
    return { clientId, clientSecret };
  }

  // 2. 환경변수 폴백
  const envId = process.env.PARTNER_GOOGLE_CLIENT_ID ?? '';
  const envSecret = process.env.PARTNER_GOOGLE_CLIENT_SECRET ?? '';
  if (envId && envSecret) {
    console.warn('[GoogleOAuth] ERP DB 미등록 — 환경변수 폴백 사용');
    cachedClientId = envId;
    cachedClientSecret = envSecret;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return { clientId: envId, clientSecret: envSecret };
  }

  throw new Error(
    '[GoogleOAuth] 파트너 구글 OAuth 자격증명이 설정되지 않았습니다. ' +
    'ERP 설정 화면(/erp/settings)에서 partner_google_client_id / partner_google_client_secret을 등록해주세요.'
  );
}

/** 캐시 초기화 (ERP 설정에서 키 갱신 시 호출) */
export function invalidateGoogleOAuthCache() {
  cachedClientId = null;
  cachedClientSecret = null;
  cacheExpiresAt = 0;
}
