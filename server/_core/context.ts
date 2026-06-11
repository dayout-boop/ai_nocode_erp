import { randomUUID } from "crypto";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { validateAdminSession } from "./adminAuth";
import { jwtVerify } from "jose";

async function getJwtSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret");
}

/**
 * tRPC 요청 컨텍스트
 * - transactionId: 분산 추적용 요청 고유 ID (X-Transaction-ID 헤더 또는 자동 생성)
 * - isMasterSession: 마스터 ERP 세션 여부
 * - partnerStaff: 파트너 스태프 JWT 인증 정보 (직원 로그인 시)
 * - tenantId: 파트너 테넌트 ID (파트너 대표 또는 직원 로그인 시)
 * - partnerOwner: 파트너 대표 세션 정보 (partner_session 쿠키 로그인 시)
 */
export type PartnerStaffCtx = {
  staffId: number;
  partnerId: number;
  onboardingId: number | null;
  name: string;
  role: "manager" | "staff";
  tenantId: number | null;
};

export type PartnerOwnerCtx = {
  partnerId: number;
  tenantId: number | null;
  email: string | null;
  name: string | null;
  loginType: string;
  role: "partner_owner";
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  isMasterSession?: boolean;
  partnerStaff?: PartnerStaffCtx | null;
  partnerOwner?: PartnerOwnerCtx | null;
  tenantId?: number | null;
  /**
   * 마스터 세션이 테넌트 셀렉터로 선택한 활성 테넌트.
   * - undefined: 헤더 미전달 (셀렉터 없음 → 전체보기 기본)
   * - null: '전체보기' (모든 테넌트)
   * - number: 특정 테넌트(예: 1=두골프)만 보기
   * 파트너/직원 세션에서는 이 값을 신뢰하지 않는다 (보안).
   */
  activeTenantId?: number | null;
  /** 요청 Host 헤더 (소문자, 포트 제거) */
  host?: string;
  /** partner.dayoutgolf.com 서브도메인 접속 여부 (파트너 전용 도메인) */
  isPartnerSubdomain?: boolean;
  transactionId: string;
};

/** Host 헤더가 파트너 전용 서브도메인인지 판별 */
export function detectPartnerSubdomain(rawHost: string | undefined): { host: string; isPartnerSubdomain: boolean } {
  const host = (rawHost || "").toLowerCase().split(":")[0].trim();
  // 파트너 전용 도메인: partner.dayoutgolf.com
  const isPartnerSubdomain = host === "partner.dayoutgolf.com";
  return { host, isPartnerSubdomain };
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let isMasterSession = false;

  // transactionId: 클라이언트가 X-Transaction-ID 헤더를 보내면 재사용, 없으면 신규 생성
  const transactionId =
    (opts.req.headers["x-transaction-id"] as string | undefined) || randomUUID();

  // 1. 먼저 Manus OAuth 인증 시도 (기존 유지)
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  // 1-B. Manus 인증 실패 시 일반회원 자립 세션(member_session) 검증 — Manus 비의존
  if (!user) {
    try {
      const memberToken = opts.req.cookies?.member_session;
      if (memberToken) {
        const { payload } = await jwtVerify(memberToken, await getJwtSecret());
        const openId = payload?.openId as string | undefined;
        if (openId) {
          const { getUserByOpenId } = await import("../db");
          const dbUser = await getUserByOpenId(openId);
          if (dbUser) {
            user = dbUser as User;
          }
        }
      }
    } catch {
      // member_session 검증 실패 시 무시하고 다음 폴백으로
    }
  }

  // 2. Manus 인증 실패 시 마스터 세션 쿠키 확인
  if (!user) {
    try {
      const adminSessionId = opts.req.cookies?.admin_session;
      if (adminSessionId) {
        const session = await validateAdminSession(adminSessionId);
        if (session) {
          // 마스터 세션이 유효하면 admin 역할의 가상 User 객체 주입
          // protectedProcedure가 마스터 세션도 허용하도록
          user = {
            id: session.adminId,
            openId: `master_${session.adminId}`,
            name: session.username,
            email: null,
            phone: null,
            loginMethod: 'master',
            role: 'admin',
            memo: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
          } as User;
          isMasterSession = true;
        }
      }
    } catch {
      // 마스터 세션 확인 실패 시 무시
    }
  }

  // 3. 파트너 스태프 JWT 검증 (Authorization: Bearer <token> 헤더)
  let partnerStaff: PartnerStaffCtx | null = null;
  let partnerOwner: PartnerOwnerCtx | null = null;
  let tenantId: number | null = null;

  const authHeader = opts.req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const secret = await getJwtSecret();
      const { payload } = await jwtVerify(token, secret);
      if (payload.type === "partner_staff" && payload.staffId) {
        // 테넌트 ID 조회 (onboardingId로 tenants 테이블 조회)
        let resolvedTenantId: number | null = null;
        try {
          const { getDb } = await import("../db.js");
          const { tenants } = await import("../../drizzle/schema.js");
          const { eq } = await import("drizzle-orm");
          const db = await getDb();
          if (db && payload.onboardingId) {
            const [tenant] = await db
              .select({ id: tenants.id })
              .from(tenants)
              .where(eq(tenants.onboardingId, payload.onboardingId as number))
              .limit(1);
            resolvedTenantId = tenant?.id ?? null;
          }
        } catch {
          // 테넌트 조회 실패 시 null 유지
        }
        partnerStaff = {
          staffId: payload.staffId as number,
          partnerId: payload.partnerId as number,
          onboardingId: payload.onboardingId as number | null,
          name: payload.name as string,
          role: payload.role as "manager" | "staff",
          tenantId: resolvedTenantId,
        };
        tenantId = resolvedTenantId;
      }
    } catch {
      // JWT 검증 실패 시 무시 (partnerStaff = null 유지)
    }
  }

  // 4. 파트너 세션 쿠키 검증 (partner_session 쿠키)
  // - staffId 있음 → 직원(partnerStaff) 세션
  // - staffId 없음 → 오너(partnerOwner) 세션
  if (!partnerStaff) {
    const partnerSessionToken = opts.req.cookies?.partner_session;
    if (partnerSessionToken) {
      try {
        const secret = await getJwtSecret();
        const { payload } = await jwtVerify(partnerSessionToken, secret);
        if (payload.partnerId) {
          const cookieStaffId = payload.staffId as number | null | undefined;
          if (cookieStaffId) {
            // 직원 쿠키 세션 → partnerStaff로 처리
            partnerStaff = {
              staffId: cookieStaffId,
              partnerId: payload.partnerId as number,
              onboardingId: null,
              name: (payload.name as string) || "",
              role: payload.role === "partner_manager" ? "manager" : "staff",
              tenantId: (payload.tenantId as number | null) ?? null,
            };
            tenantId = partnerStaff.tenantId;
          } else {
            // 오너 쿠키 세션 → partnerOwner로 처리
            partnerOwner = {
              partnerId: payload.partnerId as number,
              tenantId: (payload.tenantId as number | null) ?? null,
              email: (payload.email as string | null) ?? null,
              name: (payload.name as string | null) ?? null,
              loginType: (payload.loginType as string) || "unknown",
              role: "partner_owner",
            };
            tenantId = partnerOwner.tenantId;
          }
        }
      } catch {
        // partner_session 쿠키 검증 실패 시 무시
      }
    }
  }

  // 5. 마스터 세션 전용: 테넌트 셀렉터 헤더(x-active-tenant) 파싱
  //    - 'all' → null (전체보기)
  //    - 숫자 → 해당 테넌트만 보기
  //    - 헤더 없음 → undefined (셀렉터 미전달)
  //    파트너/직원 세션은 이 헤더를 절대 신뢰하지 않는다(보안). partnerProcedure에서 무시.
  let activeTenantId: number | null | undefined = undefined;
  if (isMasterSession) {
    const rawHeader = opts.req.headers["x-active-tenant"];
    const headerVal = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (typeof headerVal === "string" && headerVal.length > 0) {
      if (headerVal === "all") {
        activeTenantId = null;
      } else {
        const parsed = Number(headerVal);
        activeTenantId = Number.isFinite(parsed) ? parsed : undefined;
      }
    }
  }

  // 6. Host 헤더 기반 파트너 서브도메인 감지
  //    - partner.dayoutgolf.com 접속 시 tenantId 컨텍스트를 고정/격리하기 위한 플래그
  //    - 실제 값은 partnerProcedure에서 활용해 마스터 전체보기 누출을 차단
  const { host, isPartnerSubdomain } = detectPartnerSubdomain(
    (Array.isArray(opts.req.headers["host"]) ? opts.req.headers["host"][0] : opts.req.headers["host"]) as string | undefined
  );

  return {
    req: opts.req,
    res: opts.res,
    user,
    isMasterSession,
    partnerStaff,
    partnerOwner,
    tenantId,
    activeTenantId,
    host,
    isPartnerSubdomain,
    transactionId,
  };
}
