/**
 * Google Secret Manager 헬퍼
 * - Secret 이름: partner_dayoutgolf
 * - 저장 형식: "클라이언트ID값,클라이언트비밀번호값" (쉼표 구분)
 * - 서버에서 읽어서 쉼표로 분리 → clientId, clientSecret 반환
 * - GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_CLOUD_PROJECT_ID 환경변수 사용
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { ENV } from './env';

let client: SecretManagerServiceClient | null = null;

function getClient(): SecretManagerServiceClient {
  if (client) return client;

  if (ENV.googleServiceAccountJson) {
    try {
      const credentials = JSON.parse(ENV.googleServiceAccountJson);
      client = new SecretManagerServiceClient({ credentials });
    } catch {
      client = new SecretManagerServiceClient();
    }
  } else {
    client = new SecretManagerServiceClient();
  }

  return client;
}

/** 캐시 (서버 재시작 시 초기화, 10분 TTL) */
let cachedClientId: string | null = null;
let cachedClientSecret: string | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10분

/**
 * Google Secret Manager에서 partner_dayoutgolf 시크릿을 읽어
 * clientId와 clientSecret을 분리하여 반환
 */
export async function getGoogleOAuthCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
}> {
  // 캐시 유효하면 바로 반환
  if (cachedClientId && cachedClientSecret && cacheExpiresAt > Date.now()) {
    return { clientId: cachedClientId, clientSecret: cachedClientSecret };
  }

  const projectId = ENV.googleCloudProjectId;
  if (!projectId) {
    throw new Error('[GoogleSecretManager] GOOGLE_CLOUD_PROJECT_ID 환경변수가 설정되지 않았습니다.');
  }

  try {
    const smClient = getClient();
    const secretName = `projects/${projectId}/secrets/partner_dayoutgolf/versions/latest`;

    const [version] = await smClient.accessSecretVersion({ name: secretName });
    const payload = version.payload?.data?.toString() ?? '';

    if (!payload) {
      throw new Error('[GoogleSecretManager] partner_dayoutgolf 시크릿 값이 비어있습니다.');
    }

    // 쉼표로 분리: "클라이언트ID값,클라이언트비밀번호값"
    const commaIdx = payload.indexOf(',');
    if (commaIdx === -1) {
      throw new Error('[GoogleSecretManager] 시크릿 형식 오류: "클라이언트ID,클라이언트Secret" 형식이어야 합니다.');
    }

    const clientId = payload.substring(0, commaIdx).trim();
    const clientSecret = payload.substring(commaIdx + 1).trim();

    if (!clientId || !clientSecret) {
      throw new Error('[GoogleSecretManager] 클라이언트 ID 또는 Secret이 비어있습니다.');
    }

    // 캐시 저장
    cachedClientId = clientId;
    cachedClientSecret = clientSecret;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    console.log('[GoogleSecretManager] partner_dayoutgolf 시크릿 로드 완료');
    return { clientId, clientSecret };

  } catch (err: any) {
    console.error('[GoogleSecretManager] 시크릿 조회 실패:', err?.message);
    throw err;
  }
}

/** 캐시 초기화 (키 갱신 시 호출) */
export function invalidateGoogleOAuthCache() {
  cachedClientId = null;
  cachedClientSecret = null;
  cacheExpiresAt = 0;
}
