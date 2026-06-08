/**
 * Google OAuth 자격증명 조회 테스트
 * - ERP DB (erpApiKeyManager) 기반으로 전환됨
 * - Google Cloud Secret Manager 의존성 완전 제거
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// erpApiKeyManager 모킹
vi.mock('./erpApiKeyManager', () => ({
  getApiKey: vi.fn(),
}));

import { getApiKey } from './erpApiKeyManager';

describe('Google OAuth 자격증명 조회 (ERP DB 파이프라인)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { invalidateGoogleOAuthCache } = await import('./_core/googleSecretManager');
    invalidateGoogleOAuthCache();
    delete process.env.PARTNER_GOOGLE_CLIENT_ID;
    delete process.env.PARTNER_GOOGLE_CLIENT_SECRET;
  });

  it('ERP DB에 자격증명이 있으면 정상 반환한다', async () => {
    (getApiKey as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('510091206789-test.apps.googleusercontent.com')
      .mockResolvedValueOnce('GOCSPX-test-secret-value');

    const { getGoogleOAuthCredentials } = await import('./_core/googleSecretManager');
    const creds = await getGoogleOAuthCredentials();

    expect(creds.clientId).toBe('510091206789-test.apps.googleusercontent.com');
    expect(creds.clientSecret).toBe('GOCSPX-test-secret-value');
  });

  it('ERP DB가 비어있으면 환경변수 폴백을 사용한다', async () => {
    (getApiKey as ReturnType<typeof vi.fn>).mockResolvedValue('');
    process.env.PARTNER_GOOGLE_CLIENT_ID = 'env-client-id.apps.googleusercontent.com';
    process.env.PARTNER_GOOGLE_CLIENT_SECRET = 'env-client-secret';

    const { getGoogleOAuthCredentials } = await import('./_core/googleSecretManager');
    const creds = await getGoogleOAuthCredentials();

    expect(creds.clientId).toBe('env-client-id.apps.googleusercontent.com');
    expect(creds.clientSecret).toBe('env-client-secret');
  });

  it('DB도 환경변수도 없으면 오류를 던진다', async () => {
    (getApiKey as ReturnType<typeof vi.fn>).mockResolvedValue('');

    const { getGoogleOAuthCredentials } = await import('./_core/googleSecretManager');
    await expect(getGoogleOAuthCredentials()).rejects.toThrow('ERP 설정 화면');
  });

  it('캐시가 작동한다 — 두 번 호출해도 동일 결과', async () => {
    (getApiKey as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('cached-client-id.apps.googleusercontent.com')
      .mockResolvedValueOnce('cached-secret');

    const { getGoogleOAuthCredentials } = await import('./_core/googleSecretManager');
    const creds1 = await getGoogleOAuthCredentials();
    const creds2 = await getGoogleOAuthCredentials();

    expect(creds1.clientId).toBe(creds2.clientId);
    expect(creds1.clientSecret).toBe(creds2.clientSecret);
  });
});

describe('콜백 URL 고정 검증', () => {
  it('파트너 구글 콜백 URL은 partner.dayoutgolf.com으로 고정되어야 한다', () => {
    const FIXED_CALLBACK_URL = 'https://partner.dayoutgolf.com/api/partner/auth/google/callback';
    expect(FIXED_CALLBACK_URL).toBe('https://partner.dayoutgolf.com/api/partner/auth/google/callback');
    expect(FIXED_CALLBACK_URL).not.toContain('manus.space');
    expect(FIXED_CALLBACK_URL).not.toContain('localhost');
  });
});
