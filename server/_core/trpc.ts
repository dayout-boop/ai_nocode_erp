import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

/**
 * transactionId 응답 헤더 주입 미들웨어
 * 모든 프로시저에서 X-Transaction-ID 헤더를 응답에 포함하여 분산 추적 지원
 * 테스트 환경에서는 res.setHeader가 없을 수 있으므로 typeof 검사
 */
const withTransactionId = t.middleware(opts => {
  const { ctx, next } = opts;
  if (
    ctx.res &&
    !ctx.res.headersSent &&
    typeof ctx.res.setHeader === "function"
  ) {
    ctx.res.setHeader("X-Transaction-ID", ctx.transactionId);
  }
  return next({ ctx });
});

export const publicProcedure = t.procedure.use(withTransactionId);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * 예약 민감 작업용 RBAC 미들웨어
 * - admin: 모든 예약에 대해 작업 가능
 * - user: 본인이 등록한 예약(managerName 일치)만 수정/삭제 가능
 * 실제 소유권 검증은 각 프로시저에서 ctx.user.role을 사용해 처리
 */
export const reservationWriteProcedure = t.procedure.use(requireUser);
