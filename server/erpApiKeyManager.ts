/**
 * ERP API 키 관리자
 * - DB에 저장된 키가 있으면 우선 사용
 * - DB에 없으면 환경변수(ENV) 폴백
 * - master 역할 계정만 키 수정 가능
 * - 키는 AES-256으로 암호화하여 DB 저장
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { ENV } from './_core/env';
import { getDb } from './db';
import { erpApiSettings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

// 암호화 키: JWT_SECRET 기반으로 32바이트 생성
function getEncryptionKey(): Buffer {
  const secret = ENV.cookieSecret || 'dogolf-erp-default-key-2024';
  // SHA-256으로 32바이트 키 생성 (정적 import 사용 — dynamic require 금지)
  return createHash('sha256').update(secret).digest();
}

/** API 키 암호화 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/** API 키 복호화 */
export function decryptApiKey(encrypted: string): string {
  try {
    const key = getEncryptionKey();
    const [ivHex, encryptedHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

/** API 키 마스킹 (앞 4자 + ... + 뒤 4자) */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

/** 캐시 (서버 재시작 시 초기화) */
const keyCache: Map<string, { value: string; expiresAt: number }> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

/** DB에서 API 키 조회 (캐시 포함) */
async function getKeyFromDb(serviceKey: string): Promise<string | null> {
  // 캐시 확인
  const cached = keyCache.get(serviceKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const db = await getDb();
    if (!db) return null;

    const rows = await db
      .select()
      .from(erpApiSettings)
      .where(eq(erpApiSettings.serviceKey, serviceKey));

    if (rows.length === 0 || !rows[0].apiKeyEncrypted || !rows[0].isActive) {
      return null;
    }

    const decrypted = decryptApiKey(rows[0].apiKeyEncrypted);
    if (!decrypted) return null;

    // 캐시 저장
    keyCache.set(serviceKey, { value: decrypted, expiresAt: Date.now() + CACHE_TTL_MS });
    return decrypted;
  } catch {
    return null;
  }
}

/** 캐시 무효화 */
export function invalidateKeyCache(serviceKey?: string) {
  if (serviceKey) {
    keyCache.delete(serviceKey);
  } else {
    keyCache.clear();
  }
}

/**
 * API 키 조회 (DB 우선, 환경변수 폴백)
 * 모든 서비스에서 이 함수를 통해 키를 가져와야 함
 */
export async function getApiKey(serviceKey: string): Promise<string> {
  // 1. DB에서 먼저 조회
  const dbKey = await getKeyFromDb(serviceKey);
  if (dbKey) return dbKey;

  // 2. 환경변수 폴백
  const envMap: Record<string, string> = {
    openrouter: ENV.openrouterApiKey,
    gemini: ENV.geminiApiKey,
    kakao: ENV.kakaoApiKey,
    slack: ENV.slackWebhookUrl,
    runway: ENV.runwayApiKey,
    n8n: ENV.n8nWebhookUrl,
    manus: ENV.manusApiKey,
    pixabay: ENV.pixabayApiKey,
    serper: process.env.SERPER_API_KEY ?? '',
    // ♥ LLM 제공자 선호도 (auto/openrouter/forge) — 기본 auto
    llm_provider_preference: process.env.LLM_PROVIDER_PREFERENCE ?? '',
    // ♥ Google OAuth Client ID/Secret은 Google Cloud Secret Manager에서 읽음
    //   (googleSecretManager.ts → getGoogleOAuthCredentials 함수 사용)
    // ♥ v3 엔진 키 (DB 우선, ENV 폴백)
    github_token: ENV.githubToken ?? '',
    heartbeat_secret_key: ENV.heartbeatSecretKey ?? '',
    engine_api_key: ENV.engineApiKey ?? '',
    anthropic_api_key: ENV.anthropicApiKey ?? '',
  };

  return envMap[serviceKey] || '';
}

/** 추가 설정값 조회 (JSON) */
export async function getApiConfig(serviceKey: string): Promise<Record<string, string>> {
  try {
    const db = await getDb();
    if (!db) return {};

    const rows = await db
      .select()
      .from(erpApiSettings)
      .where(eq(erpApiSettings.serviceKey, serviceKey));

    if (rows.length === 0 || !rows[0].extraConfig) return {};

    return JSON.parse(rows[0].extraConfig);
  } catch {
    return {};
  }
}
