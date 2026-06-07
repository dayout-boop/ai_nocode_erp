/**
 * ============================================================
 * 두골프 멀티테넌트 SaaS — 구글 OAuth 보안 프록시 API
 * ============================================================
 *
 * ■ API URL 구조 (글로벌 SaaS 보안 표준)
 *
 *   [인증 계층 — 크레딧 검증 없음]
 *   POST /api/v1/auth/oauth/google/initiate
 *     → 신규 파트너 가입 시작 (테넌트 미확정)
 *     → 일회성 nonce 발급 + OAuth URL 반환 (원본 키 미노출)
 *
 *   POST /api/v1/tenants/:tenantId/auth/oauth/google/session-token
 *     → 기존 테넌트 파트너 로그인 시작
 *     → 일회성 nonce 발급 + OAuth URL 반환 (원본 키 미노출)
 *     → 크레딧 검증 없음 (로그인은 무료)
 *
 *   GET /api/v1/auth/oauth/google/callback
 *     → 구글 OAuth 콜백 — nonce 검증 후 partnerGoogleAuth 콜백으로 위임
 *
 *   [유료 기능 계층 — 크레딧 검증 인터셉터 적용, 별도 라우터에서 사용]
 *   export creditInterceptor  → 유료 API 라우터에서 미들웨어로 사용
 *   export validateTenantCredit → 서버 내부 크레딧 검증 유틸
 *
 * ■ 보안 원칙
 *   1. 원본 Google Client ID/Secret 외부 노출 금지
 *   2. 서버 내부 메모리 캐시 (10분 TTL) — 외부 응답 시 절대 미포함
 *   3. 일회성 nonce: 발급 후 5분 내 1회만 사용 가능, 재사용 즉시 거부
 *   4. 크레딧 검증은 가입/로그인과 완전 분리 — 유료 기능 호출 시에만 적용
 * ============================================================
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getGoogleOAuthCredentials } from '../_core/googleSecretManager';
import { getDb } from '../db';
import { tenants } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';

const router = express.Router();

// ============================================================
// 일회성 Nonce 스토어 (서버 메모리, 5분 TTL)
// ============================================================
interface NonceEntry {
  tenantId: number | null;   // null = 신규 가입 (테넌트 미확정)
  purpose: 'login' | 'signup';
  returnUrl: string;
  issuedAt: number;
  used: boolean;
}

const nonceStore = new Map<string, NonceEntry>();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5분

/** 만료된 nonce 자동 정리 (1분마다) */
setInterval(() => {
  const now = Date.now();
  nonceStore.forEach((entry, key) => {
    if (now - entry.issuedAt > NONCE_TTL_MS) {
      nonceStore.delete(key);
    }
  });
}, 60_000);

/** 일회성 nonce 생성 */
function issueNonce(entry: Omit<NonceEntry, 'issuedAt' | 'used'>): string {
  const nonce = crypto.randomBytes(32).toString('hex');
  nonceStore.set(nonce, { ...entry, issuedAt: Date.now(), used: false });
  return nonce;
}

/** nonce 검증 및 소비 (1회 사용 후 무효화) */
export function consumeNonce(nonce: string): NonceEntry | null {
  const entry = nonceStore.get(nonce);
  if (!entry) return null;
  if (entry.used) return null;
  if (Date.now() - entry.issuedAt > NONCE_TTL_MS) {
    nonceStore.delete(nonce);
    return null;
  }
  entry.used = true;
  nonceStore.set(nonce, entry);
  return entry;
}

// ============================================================
// 내부 OAuth URL 빌더 (원본 키 외부 노출 없이 서버 내부에서만 사용)
// ============================================================
async function buildGoogleOAuthUrl(params: {
  nonce: string;
  callbackBaseUrl: string;
}): Promise<string> {
  // 원본 키는 서버 메모리 캐시에서만 사용 — 절대 외부 응답에 포함하지 않음
  const { clientId } = await getGoogleOAuthCredentials();

  const state = Buffer.from(JSON.stringify({
    nonce: params.nonce,
    ts: Date.now(),
  })).toString('base64url');

  const callbackUrl = `${params.callbackBaseUrl}/api/v1/auth/oauth/google/callback`;

  const urlParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${urlParams.toString()}`;
}

// ============================================================
// API 1: POST /api/v1/auth/oauth/google/initiate
// 신규 파트너 가입 시작 — 크레딧 검증 없음 (가입 전이므로 당연히 없음)
// ============================================================
router.post('/auth/oauth/google/initiate', async (req, res) => {
  try {
    const returnUrl = (req.body?.returnUrl as string) || '/partner/dashboard';

    const nonce = issueNonce({ tenantId: null, purpose: 'signup', returnUrl });
    const callbackBaseUrl = `${req.protocol}://${req.get('host')}`;
    const oauthUrl = await buildGoogleOAuthUrl({ nonce, callbackBaseUrl });

    return res.json({
      success: true,
      oauthUrl,
      meta: { nonceTtlSeconds: 300, purpose: 'signup' },
    });
  } catch (err: any) {
    console.error('[AuthProxy] 가입 시작 오류:', err?.message);
    return res.status(503).json({
      success: false,
      error: 'oauth_init_failed',
      message: 'Google OAuth 초기화에 실패했습니다. 잠시 후 다시 시도해주세요.',
    });
  }
});

// ============================================================
// API 2: POST /api/v1/tenants/:tenantId/auth/oauth/google/session-token
// 기존 테넌트 파트너 로그인 — 크레딧 검증 없음 (로그인은 무료)
// 응답: 일회성 OAuth URL (원본 키 절대 미포함)
// ============================================================
router.post('/tenants/:tenantId/auth/oauth/google/session-token', async (req, res) => {
  const tenantId = parseInt(req.params.tenantId, 10);
  if (isNaN(tenantId) || tenantId <= 0) {
    return res.status(400).json({ success: false, error: 'invalid_tenant_id' });
  }

  try {
    const returnUrl = (req.body?.returnUrl as string) || '/partner/dashboard';

    // 일회성 nonce 발급 (로그인용, 테넌트 ID 포함)
    const nonce = issueNonce({ tenantId, purpose: 'login', returnUrl });
    const callbackBaseUrl = `${req.protocol}://${req.get('host')}`;
    const oauthUrl = await buildGoogleOAuthUrl({ nonce, callbackBaseUrl });

    // 응답: OAuth URL + 마스킹된 세션 토큰 힌트 (원본 키 절대 미포함)
    return res.json({
      success: true,
      oauthUrl,
      sessionToken: `gst_${nonce.substring(0, 16)}`, // 마스킹: 앞 16자만 — 원본 nonce 아님
      meta: {
        tenantId,
        nonceTtlSeconds: 300,
        purpose: 'login',
        // 크레딧 잔액은 로그인 후 대시보드에서 별도 조회
      },
    });
  } catch (err: any) {
    console.error('[AuthProxy] 세션 토큰 발급 오류:', err?.message);
    return res.status(503).json({
      success: false,
      error: 'session_token_failed',
      message: '세션 토큰 발급에 실패했습니다. 잠시 후 다시 시도해주세요.',
    });
  }
});

// ============================================================
// API 3: GET /api/v1/auth/oauth/google/callback
// 구글 OAuth 콜백 — nonce 검증 후 partnerGoogleAuth 콜백으로 위임
// ============================================================
router.get('/auth/oauth/google/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query as Record<string, string>;

  if (oauthError) {
    return res.redirect('/partner/login?error=cancelled');
  }
  if (!code || !state) {
    return res.redirect('/partner/login?error=invalid_callback');
  }

  // state에서 nonce 추출
  let nonce: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    nonce = decoded.nonce;
    if (!nonce) throw new Error('nonce missing');
  } catch {
    return res.redirect('/partner/login?error=invalid_state');
  }

  // nonce 검증 및 소비 (1회 사용 후 무효화)
  const nonceEntry = consumeNonce(nonce);
  if (!nonceEntry) {
    console.warn('[AuthProxy] nonce 검증 실패 (만료 또는 재사용 시도)');
    return res.redirect('/partner/login?error=nonce_expired');
  }

  // nonce 검증 완료 → partnerGoogleAuth 콜백으로 위임
  const params = new URLSearchParams({
    code,
    state,
    __nonce: nonce,
    __tenant_id: nonceEntry.tenantId?.toString() ?? '',
    __return_url: nonceEntry.returnUrl,
  });
  return res.redirect(`/api/partner/auth/google/callback?${params.toString()}`);
});

// ============================================================
// ■ 크레딧 검증 유틸 — 유료 기능 API에서 사용
//   (가입/로그인 API와 완전 분리)
// ============================================================

/**
 * 테넌트 크레딧 잔액 및 구독 상태 검증
 * 사용처: 유료 외부 API 호출 전 인터셉터에서 호출
 */
export async function validateTenantCredit(tenantId: number): Promise<{
  valid: boolean;
  reason?: string;
  balance?: number;
}> {
  try {
    const db = await getDb();
    if (!db) return { valid: false, reason: 'db_unavailable' };

    const [tenant] = await db
      .select({
        id: tenants.id,
        isActive: tenants.isActive,
        subscriptionStatus: tenants.subscriptionStatus,
        aiCreditsBalance: tenants.aiCreditsBalance,
        subscriptionExpiresAt: tenants.subscriptionExpiresAt,
      })
      .from(tenants)
      .where(and(eq(tenants.id, tenantId), eq(tenants.isActive, true)))
      .limit(1);

    if (!tenant) return { valid: false, reason: 'tenant_not_found' };
    if (!tenant.isActive) return { valid: false, reason: 'tenant_inactive' };

    const validStatuses = ['trial', 'active'];
    if (!validStatuses.includes(tenant.subscriptionStatus)) {
      return { valid: false, reason: `subscription_${tenant.subscriptionStatus}` };
    }
    if (tenant.subscriptionExpiresAt && tenant.subscriptionExpiresAt < new Date()) {
      return { valid: false, reason: 'subscription_expired' };
    }
    if (tenant.aiCreditsBalance <= 0) {
      return { valid: false, reason: 'insufficient_credits', balance: 0 };
    }

    return { valid: true, balance: tenant.aiCreditsBalance };
  } catch (err) {
    console.error('[CreditValidator] 크레딧 검증 오류:', err);
    return { valid: false, reason: 'validation_error' };
  }
}

/**
 * Express 미들웨어: 유료 기능 API 라우터에 적용
 *
 * 사용 예시:
 *   import { creditInterceptor } from './authProxy';
 *   router.post('/tenants/:tenantId/ai/chat', creditInterceptor, handler);
 *
 * req.params.tenantId 또는 req.body.tenantId 에서 테넌트 ID를 읽음
 */
export async function creditInterceptor(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const tenantId = parseInt(
    (req.params.tenantId || req.body?.tenantId || '') as string,
    10
  );

  if (isNaN(tenantId) || tenantId <= 0) {
    res.status(400).json({ success: false, error: 'invalid_tenant_id' });
    return;
  }

  const result = await validateTenantCredit(tenantId);
  if (!result.valid) {
    res.status(403).json({
      success: false,
      error: 'credit_validation_failed',
      reason: result.reason,
      message: getCreditErrorMessage(result.reason),
    });
    return;
  }

  // 크레딧 잔액을 req에 주입 (핸들러에서 차감 처리 시 사용)
  (req as any).tenantCreditBalance = result.balance;
  next();
}

function getCreditErrorMessage(reason?: string): string {
  switch (reason) {
    case 'tenant_not_found':        return '등록되지 않은 파트너 계정입니다.';
    case 'tenant_inactive':         return '비활성화된 파트너 계정입니다. 관리자에게 문의해주세요.';
    case 'subscription_suspended':  return '구독이 일시 중단되었습니다. 결제 정보를 확인해주세요.';
    case 'subscription_cancelled':  return '구독이 취소된 계정입니다.';
    case 'subscription_expired':    return '구독 기간이 만료되었습니다. 갱신해주세요.';
    case 'insufficient_credits':    return 'AI 크레딧이 부족합니다. 크레딧을 충전해주세요.';
    default: return '접근 권한을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.';
  }
}

export default router;
