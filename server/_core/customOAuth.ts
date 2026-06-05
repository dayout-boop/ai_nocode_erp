/**
 * 커스텀 OAuth 엔드포인트
 * manus.im 선택 화면을 완전히 우회하고, 각 OAuth 제공자로 직접 이동
 * 초대코드를 자동으로 포함하여 가입 시 크레딧 자동 적용
 */

import { ENV as env } from './env';

interface OAuthProviderConfig {
  clientId: string;
  redirectUri: string;
  scope: string[];
  authEndpoint: string;
}

const oauthConfigs: Record<string, OAuthProviderConfig> = {
  google: {
    clientId: '362133815767-ohl3m6958nbtn2j092984r9nakj4f5eg.apps.googleusercontent.com',
    redirectUri: 'https://api.manus.im/api/oauth2_callback/google',
    scope: ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  },
  microsoft: {
    clientId: 'YOUR_MICROSOFT_CLIENT_ID', // Manus에서 제공
    redirectUri: 'https://api.manus.im/api/oauth2_callback/microsoft',
    scope: ['openid', 'profile', 'email'],
    authEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  },
  facebook: {
    clientId: 'YOUR_FACEBOOK_APP_ID', // Manus에서 제공
    redirectUri: 'https://api.manus.im/api/oauth2_callback/facebook',
    scope: ['public_profile', 'email'],
    authEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
  },
  apple: {
    clientId: 'YOUR_APPLE_CLIENT_ID', // Manus에서 제공
    redirectUri: 'https://api.manus.im/api/oauth2_callback/apple',
    scope: ['name', 'email'],
    authEndpoint: 'https://appleid.apple.com/auth/authorize',
  },
};

/**
 * OAuth 제공자별 로그인 URL 생성
 * @param provider OAuth 제공자 (google, microsoft, facebook, apple)
 * @param invitationCode 초대코드 (URL 파라미터로 전달)
 * @returns OAuth 로그인 URL
 */
export function generateOAuthUrl(provider: string, invitationCode: string): string {
  const config = oauthConfigs[provider];
  
  if (!config) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  const params = new URLSearchParams();
  params.set('client_id', config.clientId);
  params.set('redirect_uri', config.redirectUri);
  params.set('response_type', 'code');
  params.set('scope', config.scope.join(' '));
  
  // 초대코드를 state 파라미터에 포함 (OAuth 콜백 후 처리)
  params.set('state', Buffer.from(JSON.stringify({ 
    invitationCode,
    provider,
    timestamp: Date.now(),
  })).toString('base64'));

  // 제공자별 추가 파라미터
  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('include_granted_scopes', 'true');
  } else if (provider === 'microsoft') {
    params.set('prompt', 'select_account');
  } else if (provider === 'apple') {
    params.set('response_mode', 'form_post');
  }

  return `${config.authEndpoint}?${params.toString()}`;
}

/**
 * 대체 방법: manus.im의 Google OAuth URL을 직접 추출
 * (현재 구현은 위의 generateOAuthUrl 사용)
 */
export async function getManusGoogleOAuthUrl(invitationCode: string): Promise<string> {
  try {
    // manus.im 앱 인증 페이지에서 Google OAuth URL 추출
    // 이 방법은 manus.im의 state 값을 자동으로 생성하므로 더 안전함
    const appId = 'dkz3FsMPRyyRyzyL9KrQXe';
    const redirectUri = 'https://dogolf-tour-dkz3fsmp.manus.space/api/oauth/callback';
    
    // manus.im의 app-auth 페이지 URL
    const manusAuthUrl = `https://manus.im/app-auth?appId=${appId}&redirectUri=${encodeURIComponent(redirectUri)}&type=signIn&code=${invitationCode}`;
    
    return manusAuthUrl;
  } catch (error) {
    console.error('Failed to get Manus Google OAuth URL:', error);
    throw error;
  }
}

/**
 * 초대코드를 포함한 Manus app-auth URL 생성
 * 모든 OAuth 제공자(Google/Facebook/Apple/Microsoft)에서 자동으로 초대코드 크레딧 적용
 * 가입 후 우리 서비스로 자동 리다이렉트됨
 */
export function getManusLoginUrlWithInvitation(
  invitationCode: string,
  skipPopup: boolean = true,
  appId: string,
  oauthPortalUrl: string,
  redirectUri: string = 'https://dogolf-tour-dkz3fsmp.manus.space/api/oauth/callback'
): string {
  // state에 초대코드 + skipPopup 파라미터 포함
  const stateData = {
    redirectUri,
    invitationCode,
    skipPopup,
  };
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64');

  // ✅ Fix: 올바른 Manus 도메인 사용 (api.manus.im이 아니라 manus.im)
  const url = new URL('https://manus.im/app-auth');
  url.searchParams.set('appId', appId);
  url.searchParams.set('redirectUri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('type', 'signIn');
  url.searchParams.set('code', invitationCode);  // 초대코드 추가
  if (skipPopup) {
    url.searchParams.set('skip_credit_popup', 'true');  // 팝업 억제
  }

  console.log('[OAuth] Generated Manus auth URL:', url.toString());
  return url.toString();
}
