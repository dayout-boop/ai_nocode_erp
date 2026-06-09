/**
 * 일반회원 자립 인증 라우터 (Manus 비의존)
 * - 이메일/비밀번호 회원가입·로그인
 * - 구글 OAuth 로그인 (파트너 구글 인증 패턴 재사용)
 * - member_session JWT 쿠키 발급
 *
 * 기존 Manus OAuth(/api/oauth/callback)는 그대로 유지하며 폴백으로 동작.
 * 본 라우터는 Manus 종속 없이 독립적으로 일반회원 인증을 처리한다.
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { eq, or } from 'drizzle-orm';
import { getDb } from '../db';
import { users } from '../../drizzle/schema';
import { ENV } from '../_core/env';
import { getSessionCookieOptions } from '../_core/cookies';
import { getGoogleOAuthCredentials } from '../_core/googleSecretManager';

export const MEMBER_SESSION_COOKIE = 'member_session';
const MEMBER_JWT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30일
const BCRYPT_ROUNDS = 10;

function getJwtSecret() {
  return new TextEncoder().encode(ENV.cookieSecret || 'dogolf-member-secret-2024');
}

export async function signMemberJwt(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret());
}

export async function verifyMemberJwt(token: string): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 일반회원용 고유 openId 생성 (자립 인증 사용자 식별) */
function makeLocalOpenId(email: string): string {
  return `local_${Buffer.from(email.toLowerCase()).toString('hex').slice(0, 48)}`;
}
function makeGoogleOpenId(sub: string): string {
  return `google_${sub}`.slice(0, 64);
}

const router = express.Router();

/**
 * POST /api/member/auth/register
 * 이메일/비밀번호 회원가입
 */
router.post('/register', async (req, res) => {
  const { email, password, name, phone } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    phone?: string;
  };

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호는 필수입니다.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
  }

  const db = await getDb();
  if (!db) return res.status(503).json({ error: '데이터베이스 연결 오류' });

  const normalizedEmail = email.trim().toLowerCase();

  // 이메일 중복 확인
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const openId = makeLocalOpenId(normalizedEmail);

  await db.insert(users).values({
    openId,
    name: name ?? null,
    email: normalizedEmail,
    phone: phone ?? null,
    passwordHash,
    authProvider: 'local',
    loginMethod: 'local',
    role: 'user',
    lastSignedIn: new Date(),
  });

  const token = await signMemberJwt({ openId, email: normalizedEmail });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(MEMBER_SESSION_COOKIE, token, { ...cookieOptions, maxAge: MEMBER_JWT_TTL_MS });

  return res.json({ success: true, user: { openId, email: normalizedEmail, name: name ?? null } });
});

/**
 * POST /api/member/auth/login
 * 이메일/비밀번호 로그인
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  }

  const db = await getDb();
  if (!db) return res.status(503).json({ error: '데이터베이스 연결 오류' });

  const normalizedEmail = email.trim().toLowerCase();
  const found = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  const member = found[0];
  if (!member || !member.passwordHash) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  const valid = await bcrypt.compare(password, member.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, member.id));

  const token = await signMemberJwt({ openId: member.openId, email: member.email });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(MEMBER_SESSION_COOKIE, token, { ...cookieOptions, maxAge: MEMBER_JWT_TTL_MS });

  return res.json({
    success: true,
    user: { openId: member.openId, email: member.email, name: member.name },
  });
});

/**
 * POST /api/member/auth/logout
 */
router.post('/logout', async (req, res) => {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(MEMBER_SESSION_COOKIE, { ...cookieOptions });
  return res.json({ success: true });
});

/**
 * GET /api/member/auth/google
 * 일반회원 구글 OAuth 시작
 */
router.get('/google', async (req, res) => {
  try {
    const { clientId } = await getGoogleOAuthCredentials();
    if (!clientId) {
      return res.status(503).json({ error: '구글 로그인이 설정되지 않았습니다.' });
    }

    const returnUrl = (req.query.returnUrl as string) || '/';
    const state = Buffer.from(JSON.stringify({ returnUrl, kind: 'member', ts: Date.now() })).toString('base64url');

    const callbackUrl = `${req.protocol}://${req.get('host')}/api/member/auth/google/callback`;
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
    console.error('[MemberAuth] 구글 로그인 시작 오류:', err);
    return res.status(500).json({ error: '구글 로그인 시작 중 오류가 발생했습니다.' });
  }
});

/**
 * GET /api/member/auth/google/callback
 * 일반회원 구글 OAuth 콜백
 */
router.get('/google/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query as Record<string, string>;

  if (oauthError) return res.redirect('/?login_error=cancelled');
  if (!code) return res.redirect('/?login_error=no_code');

  let returnUrl = '/';
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString());
    if (parsed.returnUrl) returnUrl = parsed.returnUrl;
  } catch {
    /* state 파싱 실패 무시 */
  }

  try {
    const { clientId, clientSecret } = await getGoogleOAuthCredentials();
    if (!clientId || !clientSecret) return res.redirect('/?login_error=not_configured');

    const callbackUrl = `${req.protocol}://${req.get('host')}/api/member/auth/google/callback`;

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
    if (!tokenRes.ok) return res.redirect('/?login_error=token_exchange_failed');

    const tokenData = (await tokenRes.json()) as { access_token: string; error?: string };
    if (tokenData.error) return res.redirect('/?login_error=token_error');

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userInfoRes.ok) return res.redirect('/?login_error=userinfo_failed');

    const googleUser = (await userInfoRes.json()) as {
      sub: string;
      email: string;
      name: string;
      email_verified?: boolean;
    };
    if (!googleUser.sub || !googleUser.email) return res.redirect('/?login_error=invalid_userinfo');

    const db = await getDb();
    if (!db) return res.redirect('/?login_error=db_error');

    const normalizedEmail = googleUser.email.trim().toLowerCase();

    // 기존 회원 조회 (googleId 또는 email)
    const existing = await db
      .select()
      .from(users)
      .where(or(eq(users.googleId, googleUser.sub), eq(users.email, normalizedEmail)))
      .limit(1);

    let member = existing[0];
    let openId: string;

    if (member) {
      openId = member.openId;
      await db
        .update(users)
        .set({ googleId: googleUser.sub, lastSignedIn: new Date() })
        .where(eq(users.id, member.id));
    } else {
      openId = makeGoogleOpenId(googleUser.sub);
      await db.insert(users).values({
        openId,
        name: googleUser.name ?? null,
        email: normalizedEmail,
        googleId: googleUser.sub,
        authProvider: 'google',
        loginMethod: 'google',
        role: 'user',
        lastSignedIn: new Date(),
      });
    }

    const token = await signMemberJwt({ openId, email: normalizedEmail });
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(MEMBER_SESSION_COOKIE, token, { ...cookieOptions, maxAge: MEMBER_JWT_TTL_MS });

    return res.redirect(302, returnUrl);
  } catch (err) {
    console.error('[MemberAuth] 구글 콜백 오류:', err);
    return res.redirect('/?login_error=server_error');
  }
});

export default router;
