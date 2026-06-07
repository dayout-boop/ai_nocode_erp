/**
 * Google Secret Manager 연결 테스트
 * 실행: node test-gsm.mjs
 */
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// .env 로드
config();

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

console.log('=== Google Secret Manager 연결 테스트 ===');
console.log('GOOGLE_CLOUD_PROJECT_ID:', projectId ? `설정됨 (${projectId})` : '❌ 미설정');
console.log('GOOGLE_SERVICE_ACCOUNT_JSON:', serviceAccountJson ? `설정됨 (${serviceAccountJson.length}자)` : '❌ 미설정');

if (!projectId) {
  console.error('\n❌ GOOGLE_CLOUD_PROJECT_ID가 설정되지 않았습니다.');
  process.exit(1);
}

let client;
if (serviceAccountJson) {
  try {
    const credentials = JSON.parse(serviceAccountJson);
    client = new SecretManagerServiceClient({ credentials });
    console.log('\n✅ 서비스 계정 JSON으로 인증 클라이언트 생성 완료');
  } catch (e) {
    console.error('\n❌ 서비스 계정 JSON 파싱 실패:', e.message);
    process.exit(1);
  }
} else {
  client = new SecretManagerServiceClient();
  console.log('\n⚠️  서비스 계정 JSON 없음 — Application Default Credentials 사용');
}

const secretName = `projects/${projectId}/secrets/partner_dayoutgolf/versions/latest`;
console.log('\n조회할 시크릿:', secretName);

try {
  const [version] = await client.accessSecretVersion({ name: secretName });
  const payload = version.payload?.data?.toString() ?? '';

  if (!payload) {
    console.error('❌ 시크릿 값이 비어있습니다.');
    process.exit(1);
  }

  const commaIdx = payload.indexOf(',');
  if (commaIdx === -1) {
    console.error('❌ 형식 오류: "클라이언트ID,클라이언트Secret" 형식이어야 합니다.');
    console.log('현재 값 길이:', payload.length, '자');
    process.exit(1);
  }

  const clientId = payload.substring(0, commaIdx).trim();
  const clientSecret = payload.substring(commaIdx + 1).trim();

  console.log('\n✅ 시크릿 읽기 성공!');
  console.log('  clientId 길이:', clientId.length, '자 | 앞 20자:', clientId.substring(0, 20) + '...');
  console.log('  clientSecret 길이:', clientSecret.length, '자');
  console.log('\n구글 OAuth 연동 준비 완료!');

} catch (err) {
  console.error('\n❌ 시크릿 조회 실패:', err.message);
  if (err.code === 5) {
    console.error('  → 시크릿을 찾을 수 없습니다. 이름을 확인해주세요: partner_dayoutgolf');
  } else if (err.code === 7) {
    console.error('  → 권한 없음. 서비스 계정에 Secret Manager Secret Accessor 권한이 필요합니다.');
  } else if (err.code === 16) {
    console.error('  → 인증 실패. GOOGLE_SERVICE_ACCOUNT_JSON을 확인해주세요.');
  }
  process.exit(1);
}
