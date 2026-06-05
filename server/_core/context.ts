import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { validateAdminSession } from "./adminAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  isMasterSession?: boolean; // 마스터 세션 여부 표시
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let isMasterSession = false;

  // 1. 먼저 Manus OAuth 인증 시도
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // 2. Manus 인증 실패 시 마스터 세션 쿠키 확인
  if (!user) {
    try {
      const adminSessionId = opts.req.cookies?.admin_session;
      if (adminSessionId) {
        const session = validateAdminSession(adminSessionId);
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
    } catch (error) {
      // 마스터 세션 확인 실패 시 무시
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    isMasterSession,
  };
}
