import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext, PartnerOwnerCtx, PartnerStaffCtx } from "./context";

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

/**
 * 파트너 스태프 전용 미들웨어
 * - Authorization: Bearer <JWT> 헤더로 인증된 파트너 직원만 허용
 * - ctx.partnerStaff: 직원 정보 (staffId, partnerId, tenantId, role)
 * - ctx.tenantId: 해당 파트너사의 테넌트 ID (데이터 격리에 사용)
 */
const requirePartnerStaff = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.partnerStaff) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "파트너 직원 로그인이 필요합니다." });
  }

  return next({
    ctx: {
      ...ctx,
      partnerStaff: ctx.partnerStaff,
      tenantId: ctx.partnerStaff.tenantId,
    },
  });
});

export const partnerStaffProcedure = t.procedure.use(withTransactionId).use(requirePartnerStaff);

/**
 * 파트너 매니저 전용 미들웨어 (role === 'manager'만 허용)
 */
export const partnerManagerProcedure = t.procedure.use(withTransactionId).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.partnerStaff || ctx.partnerStaff.role !== 'manager') {
      throw new TRPCError({ code: "FORBIDDEN", message: "파트너 매니저 권한이 필요합니다." });
    }
    return next({
      ctx: {
        ...ctx,
        partnerStaff: ctx.partnerStaff,
        tenantId: ctx.partnerStaff.tenantId,
      },
    });
  }),
);

/**
 * 파트너 대표(Manus OAuth) 또는 파트너 직원(JWT) 모두 허용하는 미들웨어
 * - 파트너 대표: ctx.user 존재 + 온보딩 승인 확인 필요 (각 라우터에서 처리)
 * - 파트너 직원: ctx.partnerStaff 존재
 */
export const partnerAnyProcedure = t.procedure.use(withTransactionId).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user && !ctx.partnerStaff) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "파트너 로그인이 필요합니다." });
    }
    return next({ ctx });
  }),
);

/**
 * 파트너 대표 전용 미들웨어 (partner_session 쿠키)
 * - ctx.partnerOwner: 파트너 대표 정보 (partnerId, tenantId, email, name)
 * - ctx.tenantId: 해당 파트너사의 테넌트 ID (데이터 격리에 사용)
 */
export const partnerOwnerProcedure = t.procedure.use(withTransactionId).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.partnerOwner) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "파트너 대표 로그인이 필요합니다." });
    }
    return next({
      ctx: {
        ...ctx,
        partnerOwner: ctx.partnerOwner as PartnerOwnerCtx,
        tenantId: ctx.partnerOwner.tenantId,
      },
    });
  }),
);

/**
 * 파트너 공통 미들웨어 (대표 또는 스태프 모두 허용)
 * - partnerOwner(쿠키) 또는 partnerStaff(JWT) 중 하나 있으면 허용
 * - 마스터(admin) 세션도 허용 (tenantId = null로 전체 접근)
 * - ctx.tenantId 자동 주입
 */
export const partnerProcedure = t.procedure.use(withTransactionId).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    // 마스터 세션이면 테넌트 셀렉터(activeTenantId) 값을 반영.
    // - activeTenantId === undefined (헤더 없음) → null (전체보기 기본)
    // - activeTenantId === null ('전체보기')      → null (전체 접근)
    // - activeTenantId === number (특정 테넌트)   → 해당 테넌트만
    if (ctx.user?.role === 'admin') {
      const resolved =
        ctx.activeTenantId === undefined ? null : ctx.activeTenantId;
      return next({
        ctx: {
          ...ctx,
          tenantId: resolved as number | null,
        },
      });
    }
    // 파트너 대표 세션
    if (ctx.partnerOwner) {
      return next({
        ctx: {
          ...ctx,
          partnerOwner: ctx.partnerOwner as PartnerOwnerCtx,
          tenantId: ctx.partnerOwner.tenantId,
        },
      });
    }
    // 파트너 스태프 세션
    if (ctx.partnerStaff) {
      return next({
        ctx: {
          ...ctx,
          partnerStaff: ctx.partnerStaff as PartnerStaffCtx,
          tenantId: ctx.partnerStaff.tenantId,
        },
      });
    }
    throw new TRPCError({ code: "UNAUTHORIZED", message: "파트너 또는 관리자 로그인이 필요합니다." });
  }),
);
