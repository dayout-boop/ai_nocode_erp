/**
 * 파트너 통합 인증 훅
 * - /api/partner/auth/google/me 를 통해 partner_session 쿠키 기반 인증
 * - 오너(partner_owner) / 매니저(partner_manager) / 직원(partner_staff) 통합 처리
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
  /** 'partner_owner' | 'partner_manager' | 'partner_staff' */
  role: string;
  /** 직원인 경우 partnerStaff.id, 오너인 경우 null */
  staffId: number | null;
}

/** 오너 여부 확인 헬퍼 */
export function isPartnerOwner(user: PartnerUser | null): boolean {
  return user?.role === 'partner_owner';
}

/** 매니저 이상 여부 확인 헬퍼 (오너 포함) */
export function isPartnerManager(user: PartnerUser | null): boolean {
  return user?.role === 'partner_owner' || user?.role === 'partner_manager';
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
