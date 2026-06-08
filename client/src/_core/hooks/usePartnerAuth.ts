/**
 * 파트너 구글 OAuth 세션 전용 인증 훅
 * - /api/partner/auth/google/me 를 통해 partner_session 쿠키 기반 인증
 * - Manus OAuth와 독립적으로 동작
 */
import { useCallback, useEffect, useState } from "react";

export interface PartnerUser {
  id: number;
  tenantId: number | null;
  email: string;
  name: string;
  picture: string | null;
  loginType: string;
  role: string;
}

interface PartnerAuthState {
  user: PartnerUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export function usePartnerAuth() {
  const [state, setState] = useState<PartnerAuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
    error: null,
  });

  const fetchMe = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch("/api/partner/auth/google/me", {
        credentials: "include",
      });
      const data = (await res.json()) as { authenticated: boolean; partner?: PartnerUser };
      if (data.authenticated && data.partner) {
        setState({ user: data.partner, loading: false, isAuthenticated: true, error: null });
      } else {
        setState({ user: null, loading: false, isAuthenticated: false, error: null });
      }
    } catch (err) {
      setState({ user: null, loading: false, isAuthenticated: false, error: String(err) });
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/partner/auth/google/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setState({ user: null, loading: false, isAuthenticated: false, error: null });
    }
  }, []);

  return {
    ...state,
    refresh: fetchMe,
    logout,
  };
}
