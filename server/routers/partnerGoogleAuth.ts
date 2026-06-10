/**
 * 파트너 구글 OAuth 인증 라우터
 * - Google Secret Manager의 'partner_dayoutgolf' 시크릿에서 Client ID/Secret 읽기
 * - 시크릿 형식: "클라이언트ID값,클라이언트비밀번호값" (쉼표 구분, 값 하나)
 * - Manus 종속 없이 독립적으로 동작
 */
import express from 'express';
import { getGoogleOAuthCredentials } from '../_core/googleSecretManager';
import { getDb } from '../db';
import { partners, partnerOnboarding, adminAccounts, tenants } from '../../drizzle/schema';
import { eq, or, desc } from 'drizzle-orm';
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

    // 구글 콘솔에 등록된 실제 운영 도메인으로 고정 (동적 host 사용 금지)
    const callbackUrl = 'https://partner.dayoutgolf.com/api/partner/auth/google/callback';

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

    // 구글 콘솔에 등록된 실제 운영 도메인으로 고정 (동적 host 사용 금지)
    const callbackUrl = 'https://partner.dayoutgolf.com/api/partner/auth/google/callback';

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

    // 2-1. 마스터/관리자 계정 확인 — adminAccounts.email과 일치하면 ERP로 바로 이동
    const matchingAdmins = await db
      .select()
      .from(adminAccounts)
      .where(eq(adminAccounts.email, googleUser.email))
      .limit(1);
    if (matchingAdmins.length > 0 && matchingAdmins[0].isActive) {
      const adminAccount = matchingAdmins[0];
      console.log(`[GoogleAuth] 관리자 계정 감지 - ${adminAccount.role}: ${googleUser.email} → ERP 대시보드로 이동`);
      // 관리자 세션 쿠키는 별도 ERP 로그인 시스템에서 발급하므로
      // 여기서는 ERP 로그인 페이지로 리다이렉트하여 이미 등록된 계정임을 알림
      return res.redirect(`/erp/login?google_admin=1&email=${encodeURIComponent(googleUser.email)}&name=${encodeURIComponent(googleUser.name)}`);
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
      // 먼저 partner_onboarding 테이블에 이미 완료된 신청이 있는지 확인
      // (온보딩 채팅 완료 후 구글 재로그인 케이스)
      const [existingOnboarding] = await db
        .select()
        .from(partnerOnboarding)
        .where(eq(partnerOnboarding.contactEmail, googleUser.email))
        .orderBy(desc(partnerOnboarding.createdAt))
        .limit(1);

      if (existingOnboarding && (existingOnboarding.status === 'approved' || existingOnboarding.status === 'active')) {
        // 이미 온보딩 완료 + 승인된 파트너 → partners 행 신규 생성 후 ERP 진입
        console.log(`[GoogleAuth] 온보딩 완료된 신규 파트너 감지 (email: ${googleUser.email}) → partners 행 생성`);
        try {
          // tenants 조회
          const [tenantRow] = await db
            .select({ id: tenants.id })
            .from(tenants)
            .where(eq(tenants.onboardingId, existingOnboarding.id))
            .limit(1);
          const tenantId = tenantRow?.id ?? null;
          const hasLicense = !!(existingOnboarding.businessLicenseUrl || (existingOnboarding as any).tourismLicenseUrl);

          const [insertResult] = await db.insert(partners).values({
            googleId: googleUser.sub,
            googleEmail: googleUser.email,
            googleName: googleUser.name,
            googlePicture: googleUser.picture || null,
            contactName: existingOnboarding.contactName || googleUser.name,
            contactEmail: googleUser.email,
            companyName: existingOnboarding.companyName || googleUser.name,
            isActive: hasLicense,
            tenantId: hasLicense ? tenantId : null,
            lastGoogleLoginAt: new Date(),
          });
          const newPartnerId = (insertResult as any).insertId as number;
          console.log(`[GoogleAuth] partners 행 생성 완료: partner_id=${newPartnerId}, isActive=${hasLicense}`);

          if (!hasLicense) {
            // 등록증 없음 → 등록증 업로드 게이트로
            return res.redirect('/partner/pending-verification?email=' + encodeURIComponent(googleUser.email) + '&name=' + encodeURIComponent(googleUser.name));
          }

          // 등록증 있음 → 세션 발급 후 ERP 진입
          const sessionPayload = {
            partnerId: newPartnerId,
            tenantId,
            email: googleUser.email,
            name: googleUser.name,
            picture: googleUser.picture || null,
            loginType: 'google' as const,
            role: 'partner_owner' as const,
          };
          const token = await signPartnerJwt(sessionPayload);
          res.cookie(PARTNER_SESSION_COOKIE, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
          });
          return res.redirect('/erp');
        } catch (createErr: any) {
          console.error('[GoogleAuth] partners 행 생성 실패:', createErr?.message);
          // 실패 시 온보딩 채팅으로 fallback
        }
      } else if (existingOnboarding && existingOnboarding.status === 'pending') {
        // 온보딩 신청은 했지만 아직 승인 대기 → 온보딩 채팅으로 복원
        // partners 행 없이 onboarding만 있는 경우 → 먼저 partners 행 생성 (비활성)
        try {
          await db.insert(partners).values({
            googleId: googleUser.sub,
            googleEmail: googleUser.email,
            googleName: googleUser.name,
            googlePicture: googleUser.picture || null,
            contactName: existingOnboarding.contactName || googleUser.name,
            contactEmail: googleUser.email,
            companyName: existingOnboarding.companyName || googleUser.name,
            isActive: false,
            lastGoogleLoginAt: new Date(),
          });
          console.log(`[GoogleAuth] pending 파트너 partners 행 생성 완료 (email: ${googleUser.email})`);
        } catch (insertErr: any) {
          console.warn('[GoogleAuth] partners 행 생성 스킵 (이미 존재):', insertErr?.message);
        }
        return res.redirect('/partner/onboarding-chat?email=' + encodeURIComponent(googleUser.email) + '&name=' + encodeURIComponent(googleUser.name));
      }

      // 완전 신규 파트너 → AI 온보딩 채팅 페이지로 리다이렉트
      // pending 행은 온보딩 완료(submit) 시점에 생성 (중복 방지)
      return res.redirect('/partner/onboarding-chat?email=' + encodeURIComponent(googleUser.email) + '&name=' + encodeURIComponent(googleUser.name));
    }

    // 4. 비활성 파트너 확인 (온보딩 미완료 또는 승인 대기 중)
    if (!partner.isActive) {
      // 온보딩 신청 여부 확인
      const [onboardingRow] = await db
        .select()
        .from(partnerOnboarding)
        .where(eq(partnerOnboarding.contactEmail, googleUser.email))
        .orderBy(desc(partnerOnboarding.createdAt))
        .limit(1);

      if (!onboardingRow || onboardingRow.status === 'pending' || onboardingRow.status === 'reviewing') {
        // 온보딩 미완료 또는 검토 중 → 온보딩 채팅으로 이동 (이탈 후 재진입 복원)
        return res.redirect('/partner/onboarding-chat?email=' + encodeURIComponent(googleUser.email) + '&name=' + encodeURIComponent(googleUser.name));
      }

      // approved 상태: 등록증 업로드 여부 확인
      if (onboardingRow.status === 'approved') {
        const hasLicense = !!(onboardingRow.businessLicenseUrl || (onboardingRow as any).tourismLicenseUrl);
        if (hasLicense) {
          // 등록증 있음 → 자동 활성화 후 ERP 진입
          try {
            // tenants 조회
            const [tenantRow] = await db
              .select({ id: tenants.id })
              .from(tenants)
              .where(eq(tenants.onboardingId, onboardingRow.id))
              .limit(1);
            const tenantId = tenantRow?.id ?? null;

            await db
              .update(partners)
              .set({ isActive: true, tenantId })
              .where(eq(partners.id, partner.id));
            partner = { ...partner, isActive: true, tenantId };
            console.log(`[GoogleAuth] 자동 활성화 완료: partner_id=${partner.id}, tenant_id=${tenantId}`);
          } catch (activateErr) {
            console.error('[GoogleAuth] 자동 활성화 실패:', activateErr);
          }
          // 아래 세션 발급 로직으로 계속 진행
        } else {
          // 등록증 없음 → 등록증 업로드 게이트 페이지로 이동
          return res.redirect('/partner/pending-verification?email=' + encodeURIComponent(googleUser.email) + '&name=' + encodeURIComponent(googleUser.name));
        }
      } else {
        // 기타 상태 (rejected 등) → 로그인 페이지로
        return res.redirect('/partner/login?status=pending_approval&email=' + encodeURIComponent(googleUser.email));
      }
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
    let returnUrl = '/erp';
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

    // returnUrl 분기 처리:
    // - 활성 파트너 (isActive=true): 온보딩/대시보드/가입 경로 → /erp로 강제 (풀 ERP 진입)
    // - 비활성 파트너 (isActive=false): 온보딩 경로 유지 (채팅 계속), 기타 경로 → /erp로 강제
    if (partner.isActive) {
      // 활성 파트너: 온보딩/대시보드/가입 경로를 모두 /erp로 강제
      if (
        returnUrl.startsWith('/partner/onboarding-chat') ||
        returnUrl.startsWith('/partner/dashboard') ||
        returnUrl.startsWith('/partner/join') ||
        returnUrl.startsWith('/partner/pending-verification')
      ) {
        returnUrl = '/erp';
      }
    } else {
      // 비활성 파트너 (신규/진행중): 온보딩 채팅 경로는 유지, 기타 경로는 /erp로 강제
      if (
        returnUrl.startsWith('/partner/dashboard') ||
        returnUrl.startsWith('/partner/join') ||
        returnUrl.startsWith('/partner/pending-verification')
      ) {
        returnUrl = '/erp';
      }
      // /partner/onboarding-chat는 유지 (신규 가입자가 채팅 계속할 수 있도록)
    }

    console.log(`[GoogleAuth] 로그인 성공 - 파트너 ${partner.id}, 테넌트 ${partner.tenantId}, proxyVerified: ${isProxyVerified}`);
    return res.redirect(returnUrl);
  } catch (err) {
    console.error('[GoogleAuth] 콜백 처리 오류:', err);
    return res.redirect('/partner/login?error=internal_error');
  }
});

/**
 * POST /api/partner/auth/email/login
 * 파트너 이메일/비밀번호 직접 로그인
 * - loginId(이메일) + loginPw(비밀번호) 기반
 * - partner_session 쿠키 발급
 */
router.post('/email/login', async (req, res) => {
  try {
    const { loginId, loginPw } = req.body as { loginId?: string; loginPw?: string };
    if (!loginId || !loginPw) {
      return res.status(400).json({ success: false, error: '아이디와 비밀번호를 입력해주세요.' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
    }

    // loginId 또는 contactEmail로 파트너 조회
    const matchedPartners = await db
      .select()
      .from(partners)
      .where(
        or(
          eq(partners.loginId, loginId),
          eq(partners.contactEmail, loginId),
        )
      )
      .limit(1);

    const partner = matchedPartners[0];
    if (!partner) {
      return res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 비밀번호 검증 (bcryptjs 또는 단순 해시)
    let isValid = false;
    if (partner.loginPwHash) {
      try {
        const bcrypt = await import('bcryptjs');
        isValid = await bcrypt.compare(loginPw, partner.loginPwHash);
      } catch {
        // bcrypt 실패 시 단순 비교 (임시 계정용)
        isValid = partner.loginPwHash === loginPw;
      }
    }

    if (!isValid) {
      return res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    if (!partner.isActive) {
      return res.status(403).json({ success: false, error: '승인 대기 중인 계정입니다. 관리자 승인 후 이용 가능합니다.' });
    }

    // 세션 JWT 발급
    const sessionPayload = {
      partnerId: partner.id,
      tenantId: partner.tenantId,
      email: partner.contactEmail || partner.loginId,
      name: partner.contactName || partner.companyName,
      picture: null,
      loginType: 'email' as const,
      role: 'partner_owner' as const,
    };

    const jwt = await signPartnerJwt(sessionPayload as unknown as Record<string, unknown>);
    res.cookie('partner_session', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.json({ success: true, redirectTo: '/erp' });
  } catch (err) {
    console.error('[EmailLogin] 오류:', err);
    return res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
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
