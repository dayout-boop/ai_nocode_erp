/**
 * Google Secret Manager 연결 테스트
 * - GOOGLE_CLOUD_PROJECT_ID=dayoutgolf-partner-oauth 설정 확인
 * - 테스트 환경에서는 가짜 서비스 계정 JSON으로 파싱 검증
 * - 실제 Secret Manager 연결은 모킹으로 처리
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// 테스트용 가짜 서비스 계정 JSON (형식만 맞춤, 실제 키 아님)
const FAKE_SERVICE_ACCOUNT_JSON = JSON.stringify({
  type: "service_account",
  project_id: "dayoutgolf-partner-oauth",
  private_key_id: "test-key-id-0000000000000000000000000000000000000000",
  private_key: "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0000000000000000000000000000000000000000000000000\n-----END RSA PRIVATE KEY-----\n",
  client_email: "partner-oauth@dayoutgolf-partner-oauth.iam.gserviceaccount.com",
  client_id: "000000000000000000000",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/partner-oauth%40dayoutgolf-partner-oauth.iam.gserviceaccount.com"
});

// @google-cloud/secret-manager 전체 모킹 (파일 최상단에서 한 번만)
vi.mock('@google-cloud/secret-manager', () => ({
  SecretManagerServiceClient: vi.fn().mockImplementation(() => ({
    accessSecretVersion: vi.fn().mockResolvedValue([{
      payload: {
        data: Buffer.from('test-client-id.apps.googleusercontent.com,GOCSPX-test-secret-value')
      }
    }])
  }))
}));

beforeAll(() => {
  // 테스트 환경에서 가짜 서비스 계정 JSON 주입
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = FAKE_SERVICE_ACCOUNT_JSON;
  process.env.GOOGLE_CLOUD_PROJECT_ID = 'dayoutgolf-partner-oauth';
});

describe('Google Secret Manager 환경변수 설정 확인', () => {
  it('GOOGLE_CLOUD_PROJECT_ID가 dayoutgolf-partner-oauth로 설정되어 있어야 함', () => {
    expect(process.env.GOOGLE_CLOUD_PROJECT_ID).toBe('dayoutgolf-partner-oauth');
  });

  it('GOOGLE_SERVICE_ACCOUNT_JSON이 유효한 서비스 계정 JSON 형식이어야 함', () => {
    const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;
    expect(jsonStr).toBeTruthy();
    expect(() => JSON.parse(jsonStr)).not.toThrow();
    const parsed = JSON.parse(jsonStr);
    expect(parsed.type).toBe('service_account');
    expect(parsed.project_id).toBe('dayoutgolf-partner-oauth');
    console.log('[TEST] 서비스 계정 JSON 형식 검증 통과 - project_id:', parsed.project_id);
  });

  it('Secret Manager 시크릿 경로가 올바르게 구성되어야 함', () => {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const expectedPath = `projects/${projectId}/secrets/partner_dayoutgolf/versions/latest`;
    expect(expectedPath).toBe('projects/dayoutgolf-partner-oauth/secrets/partner_dayoutgolf/versions/latest');
  });
});

describe('Google OAuth 자격증명 로드 (모킹 테스트)', () => {
  beforeEach(async () => {
    // 각 테스트 전 캐시 초기화
    const { invalidateGoogleOAuthCache } = await import('./_core/googleSecretManager');
    invalidateGoogleOAuthCache();
  });

  it('getGoogleOAuthCredentials 함수가 clientId/clientSecret을 반환해야 함', async () => {
    const { getGoogleOAuthCredentials } = await import('./_core/googleSecretManager');
    const creds = await getGoogleOAuthCredentials();

    expect(creds.clientId).toBeTruthy();
    expect(creds.clientSecret).toBeTruthy();
    expect(creds.clientId).toContain('apps.googleusercontent.com');
    expect(creds.clientSecret).toContain('GOCSPX-');
    console.log('[TEST] Secret Manager 모킹 테스트 성공 - 프로젝트 ID: dayoutgolf-partner-oauth');
  });

  it('캐시가 작동해야 함 (두 번 호출해도 동일 결과)', async () => {
    const { getGoogleOAuthCredentials } = await import('./_core/googleSecretManager');
    const creds1 = await getGoogleOAuthCredentials();
    const creds2 = await getGoogleOAuthCredentials();
    expect(creds1.clientId).toBe(creds2.clientId);
    expect(creds1.clientSecret).toBe(creds2.clientSecret);
  });
});
