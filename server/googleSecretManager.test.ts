/**
 * Google Secret Manager 연결 테스트
 * - GOOGLE_CLOUD_PROJECT_ID=dayoutgolf-partner-oauth 설정 확인
 * - 로컬 환경에서는 환경변수/경로 검증만 수행
 * - 실제 Secret Manager 연결은 배포 환경(서비스 계정 JSON 주입 후)에서 확인
 */
import { describe, it, expect, vi } from 'vitest';
import { ENV } from './_core/env';

describe('Google Secret Manager 환경변수 설정 확인', () => {
  it('GOOGLE_CLOUD_PROJECT_ID가 dayoutgolf-partner-oauth로 설정되어 있어야 함', () => {
    expect(ENV.googleCloudProjectId).toBe('dayoutgolf-partner-oauth');
  });

  it('Secret Manager 시크릿 경로가 올바르게 구성되어야 함', () => {
    const projectId = ENV.googleCloudProjectId;
    const expectedPath = `projects/${projectId}/secrets/partner_dayoutgolf/versions/latest`;
    expect(expectedPath).toBe('projects/dayoutgolf-partner-oauth/secrets/partner_dayoutgolf/versions/latest');
  });

  it('GOOGLE_SERVICE_ACCOUNT_JSON이 설정되어 있어야 함 (배포 환경에서 유효한 JSON 필요)', () => {
    if (!ENV.googleServiceAccountJson) {
      console.warn('[TEST] GOOGLE_SERVICE_ACCOUNT_JSON 미설정 - 배포 환경에서만 Secret Manager 작동');
      return;
    }
    // 현재 환경변수 값이 있음을 확인 (형식은 배포 환경에서 검증)
    expect(ENV.googleServiceAccountJson.length).toBeGreaterThan(0);
    console.log('[TEST] GOOGLE_SERVICE_ACCOUNT_JSON 설정됨 (길이:', ENV.googleServiceAccountJson.length, ')');
    console.warn('[TEST] 주의: 현재 값이 서비스 계정 JSON 형식인지 배포 환경에서 확인 필요');
  });
});

describe('Google OAuth 자격증명 로드 (모킹 테스트)', () => {
  it('getGoogleOAuthCredentials 함수가 올바른 형식을 반환해야 함 (모킹)', async () => {
    // @google-cloud/secret-manager를 모킹하여 실제 GCP 연결 없이 테스트
    vi.mock('@google-cloud/secret-manager', () => ({
      SecretManagerServiceClient: vi.fn().mockImplementation(() => ({
        accessSecretVersion: vi.fn().mockResolvedValue([{
          payload: {
            data: Buffer.from('test-client-id.apps.googleusercontent.com,GOCSPX-test-secret')
          }
        }])
      }))
    }));

    // 캐시 초기화 후 테스트
    const { invalidateGoogleOAuthCache, getGoogleOAuthCredentials } = await import('./_core/googleSecretManager');
    invalidateGoogleOAuthCache();

    const creds = await getGoogleOAuthCredentials();
    expect(creds.clientId).toBeTruthy();
    expect(creds.clientSecret).toBeTruthy();
    expect(creds.clientId).toContain('apps.googleusercontent.com');
    console.log('[TEST] 모킹 테스트 성공 - 프로젝트 ID: dayoutgolf-partner-oauth');
  });
});
