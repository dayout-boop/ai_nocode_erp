import { randomUUID } from "crypto";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { validateAdminSession } from "./adminAuth";
import { jwtVerify } from "jose";

/**
 * tRPC 요청 컨텍스트
 * - transactionId: 분산 추적용 요청 고유 ID (X-Transaction-ID 헤더 또는 자동 생성)
 * - isMasterSession: 마스터 ERP 세션 여부
 * - partnerStaff: 파트너 스태프 JWT 인증 정보 (직원 로그인 시)
 * - tenantId: 파트너 테넌트 ID (파트너 대표 또는 직원 로그인 시)
 */
export type PartnerStaffCtx = {
  staffId: number;
  partnerId: number;
  onboardingId: number | null;
  name: string;
  role: "manager" | "staff";
  tenantId: number | null;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  isMasterSession?: boolean;
  partnerStaff?: PartnerStaffCtx | null;
  tenantId?: number | null;
  transactionId: string;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let isMasterSession = false;

  // transactionId: 클라이언트가 X-Transaction-ID 헤더를 보내면 재사용, 없으면 신규 생성
  const transactionId =
    (opts.req.headers["x-transaction-id"] as string | undefined) || randomUUID();

  // 1. 먼저 Manus OAuth 인증 시도
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
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
  let tenantId: number | null = null;

  const authHeader = opts.req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret");
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

  return {
    req: opts.req,
    res: opts.res,
    user,
    isMasterSession,
    partnerStaff,
    tenantId,
    transactionId,
  };
}
