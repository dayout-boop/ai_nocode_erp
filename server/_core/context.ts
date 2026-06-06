import { randomUUID } from "crypto";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { validateAdminSession } from "./adminAuth";

/**
 * tRPC 요청 컨텍스트
 * - transactionId: 분산 추적용 요청 고유 ID (X-Transaction-ID 헤더 또는 자동 생성)
 * - isMasterSession: 마스터 ERP 세션 여부
 */
export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  isMasterSession?: boolean;
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
    } catch {
      // 마스터 세션 확인 실패 시 무시
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    isMasterSession,
    transactionId,
  };
}
