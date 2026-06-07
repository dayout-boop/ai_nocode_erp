/**
 * 파트너 구글 OAuth 인증 라우터
 * - Google Secret Manager의 'partner_dayoutgolf' 시크릿에서 Client ID/Secret 읽기
 * - 시크릿 형식: "클라이언트ID값,클라이언트비밀번호값" (쉼표 구분, 값 하나)
 * - Manus 종속 없이 독립적으로 동작
 */
import express from 'express';
import { getGoogleOAuthCredentials } from '../_core/googleSecretManager';
import { getDb } from '../db';
import { partners, partnerOnboarding } from '../../drizzle/schema';
import { eq, or } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { ENV } from '../_core/env';

const PARTNER_SESSION_COOKIE = 'partner_session';
const PARTNER_JWT_TTL = '7d';

function getJwtSecret() {
  return new TextEncoder().encode(ENV.cookieSecret || 'dogolf-partner-secret-2024');
}

async function signPartnerJwt(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(PARTNER_JWT_TTL)
    .sign(await getJwtSecret());
}

async function verifyPartnerJwt(token: string): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(token, await getJwtSecret());
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

const router = express.Router();

/**
 * Google Secret Manager 'partner_dayoutgolf' 시크릿에서
 * clientId, clientSecret을 읽어 반환
 * 형식: "클라이언트ID값,클라이언트비밀번호값"
 */
async function getGoogleCredentials(): Promise<{ clientId: string; clientSecret: string }> {
  return getGoogleOAuthCredentials();
}

/**
 * GET /api/partner/auth/google
 * 구글 OAuth 로그인 시작 — 구글 인증 페이지로 리다이렉트
 */
router.get('/google', async (req, res) => {
  try {
    const { clientId } = await getGoogleCredentials();
    if (!clientId) {
      return res.status(503).json({
        error: 'Google OAuth가 설정되지 않았습니다. Google Secret Manager의 partner_dayoutgolf 시크릿을 확인해주세요.',
      });
    }

    // state에 returnUrl 포함 (CSRF 방지 + 로그인 후 복귀 경로)
    const returnUrl = (req.query.returnUrl as string) || '/partner/dashboard';
    const state = Buffer.from(JSON.stringify({ returnUrl, ts: Date.now() })).toString('base64url');

    const callbackUrl = `${req.protocol}://${req.get('host')}/api/partner/auth/google/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account',
    });

    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (err) {
    console.error('[GoogleAuth] 로그인 시작 오류:', err);
    return res.status(500).json({ error: '구글 로그인 시작 중 오류가 발생했습니다.' });
  }
});

/**
 * GET /api/partner/auth/google/callback
 * 구글 OAuth 콜백 처리
 * - authProxy(/api/v1/auth/oauth/google/callback)에서 nonce 검증 완료 후 위임
 * - __nonce, __tenant_id, __return_url 파라미터로 검증 완료 여부 확인
 * 1. code → access_token 교환
 * 2. 사용자 정보 조회
 * 3. DB에서 파트너 조회 또는 신규 생성
 * 4. 파트너 세션 쿠키 발급
 */
router.get('/google/callback', async (req, res) => {
  const {
    code,
    state,
    error: oauthError,
    __nonce,
    __tenant_id,
    __return_url,
  } = req.query as Record<string, string>;

  // authProxy를 통해 nonce 검증이 완료된 요청인지 확인
  // __nonce 파라미터가 있으면 authProxy 경유 (이미 검증 완료)
  // 없으면 직접 접근 — 구 방식 호환 (레거시)
  const isProxyVerified = Boolean(__nonce);
  const tenantIdFromProxy = __tenant_id ? parseInt(__tenant_id, 10) : null;
  const returnUrlFromProxy = __return_url || null;

  // 구글 인증 거부
  if (oauthError) {
    console.warn('[GoogleAuth] 사용자가 인증을 거부했습니다:', oauthError);
    return res.redirect('/partner/login?error=cancelled');
  }

  if (!code) {
    return res.redirect('/partner/login?error=no_code');
  }

  try {
    const { clientId, clientSecret } = await getGoogleCredentials();

    if (!clientId || !clientSecret) {
      return res.redirect('/partner/login?error=not_configured');
    }

    const callbackUrl = `${req.protocol}://${req.get('host')}/api/partner/auth/google/callback`;

    // 1. code → token 교환
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[GoogleAuth] 토큰 교환 실패:', errText);
      return res.redirect('/partner/login?error=token_exchange_failed');
    }

    const tokenData = await tokenRes.json() as {
      access_token: string;
      id_token?: string;
      error?: string;
    };

    if (tokenData.error) {
      console.error('[GoogleAuth] 토큰 오류:', tokenData.error);
      return res.redirect('/partner/login?error=token_error');
    }

    // 2. 구글 사용자 정보 조회 (에이전트는 결과만 받음, 키값 직접 취급 안 함)
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) {
      return res.redirect('/partner/login?error=userinfo_failed');
    }

    const googleUser = await userInfoRes.json() as {
      sub: string;       // 구글 고유 ID
      email: string;
      name: string;
      picture?: string;
      email_verified?: boolean;
    };

    if (!googleUser.sub || !googleUser.email) {
      return res.redirect('/partner/login?error=invalid_userinfo');
    }

    if (!googleUser.email_verified) {
      return res.redirect('/partner/login?error=email_not_verified');
    }

    const db = await getDb();
    if (!db) {
      return res.redirect('/partner/login?error=db_error');
    }

    // 3. DB에서 파트너 조회 (googleId 또는 이메일로)
    const existingPartners = await db
      .select()
      .from(partners)
      .where(
        or(
          eq(partners.googleId, googleUser.sub),
          eq(partners.contactEmail, googleUser.email)
        )
      )
      .limit(1);

    let partner = existingPartners[0];

    if (partner) {
      // 기존 파트너 — 구글 정보 업데이트 + 로그인 시각 갱신
      await db
        .update(partners)
        .set({
          googleId: googleUser.sub,
          googleEmail: googleUser.email,
          googleName: googleUser.name,
          googlePicture: googleUser.picture || null,
          lastGoogleLoginAt: new Date(),
        })
        .where(eq(partners.id, partner.id));
    } else {
      // 신규 파트너 — 구글 계정으로 최초 가입
      // 1) partnerOnboarding에 pending 상태로 등록
      const [onboardingResult] = await db
        .insert(partnerOnboarding)
        .values({
          status: 'pending',
          companyName: googleUser.name + ' (구글 가입)',
          contactName: googleUser.name,
          contactEmail: googleUser.email,
          subscriptionPlan: 'starter',
          billingCycle: 'monthly',
        });
      const newOnboardingId = (onboardingResult as any).insertId;

      // 2) partners 테이블에 기본 레코드 생성 (비활성 상태, onboardingId 연결)
      await db
        .insert(partners)
        .values({
          companyName: googleUser.name,
          contactName: googleUser.name,
          contactEmail: googleUser.email,
          googleId: googleUser.sub,
          googleEmail: googleUser.email,
          googleName: googleUser.name,
          googlePicture: googleUser.picture || null,
          lastGoogleLoginAt: new Date(),
          isActive: false, // 관리자 승인 후 활성화
        });

      // 3) 관리자에게 신규 가입 알림 발송
      try {
        const { notifyOwner } = await import('../_core/notification');
        await notifyOwner({
          title: '신규 파트너 가입 신청',
          content: `구글 계정으로 신규 파트너가 가입 신청했습니다.\n이름: ${googleUser.name}\n이메일: ${googleUser.email}\n\nERP 관리자 페이지에서 승인해주세요.`,
        });
      } catch (notifyErr) {
        console.warn('[GoogleAuth] 관리자 알림 발송 실패 (비필수):', notifyErr);
      }

      // 신규 가입 → 승인 대기 페이지로 리다이렉트
      return res.redirect('/partner/login?status=pending_approval&email=' + encodeURIComponent(googleUser.email));
    }

    // 4. 비활성 파트너 확인
    if (!partner.isActive) {
      return res.redirect('/partner/login?status=pending_approval&email=' + encodeURIComponent(googleUser.email));
    }

    // 5. 파트너 세션 JWT 발급
    const sessionPayload = {
      partnerId: partner.id,
      tenantId: partner.tenantId,
      email: partner.googleEmail || partner.contactEmail,
      name: partner.googleName || partner.contactName,
      picture: partner.googlePicture,
      loginType: 'google' as const,
      role: 'partner_owner' as const,
    };

    const jwt = await signPartnerJwt(sessionPayload as unknown as Record<string, unknown>);

    // 쿠키 설정 (파트너 전용 세션)
    res.cookie('partner_session', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      path: '/',
    });

    // returnUrl 결정: authProxy 위임값 우선, 없으면 state에서 복원
    let returnUrl = '/partner/dashboard';
    if (returnUrlFromProxy && returnUrlFromProxy.startsWith('/')) {
      returnUrl = returnUrlFromProxy;
    } else {
      try {
        if (state) {
          const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
          if (decoded.returnUrl && decoded.returnUrl.startsWith('/')) {
            returnUrl = decoded.returnUrl;
          }
        }
      } catch {}
    }

    console.log(`[GoogleAuth] 로그인 성공 - 파트너 ${partner.id}, 테넌트 ${partner.tenantId}, proxyVerified: ${isProxyVerified}`);
    return res.redirect(returnUrl);
  } catch (err) {
    console.error('[GoogleAuth] 콜백 처리 오류:', err);
    return res.redirect('/partner/login?error=internal_error');
  }
});

/**
 * POST /api/partner/auth/google/logout
 * 파트너 구글 로그아웃
 */
router.post('/google/logout', (req, res) => {
  res.clearCookie('partner_session', { path: '/' });
  return res.json({ success: true });
});

/**
 * GET /api/partner/auth/google/me
 * 현재 파트너 세션 정보 조회
 */
router.get('/google/me', async (req, res) => {
  try {
    const token = req.cookies?.partner_session;
    if (!token) {
      return res.json({ authenticated: false });
    }

    const payload = await verifyPartnerJwt(token);
    if (!payload) {
      return res.json({ authenticated: false });
    }

    return res.json({
      authenticated: true,
      partner: {
        id: payload.partnerId,
        tenantId: payload.tenantId,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        loginType: payload.loginType,
        role: payload.role,
      },
    });
  } catch {
    return res.json({ authenticated: false });
  }
});

export default router;
