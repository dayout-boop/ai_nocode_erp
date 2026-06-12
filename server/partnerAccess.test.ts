import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext, PartnerOwnerCtx } from "./_core/context";

/**
 * 회귀 테스트: 파트너 세션이 ERP 핵심 프로시저에 접근할 때
 * UNAUTHORIZED(401)로 막혀 마스터 로그인으로 강제 이탈하지 않아야 한다.
 *
 * 배경(P0 버그): reservations.summary / crm.getPartners / affiliates.list 등이
 * protectedProcedure(ctx.user 필요)로 묶여 있어, ctx.user가 없는 파트너 대표 세션에서
 * 401을 던졌고 전역 핸들러가 /erp/login으로 리다이렉트했다.
 * → partnerProcedure로 전환하여 파트너 대표/스태프 세션도 접근 가능해야 한다.
 */

const TENANT_ID = 1003;

function createPartnerOwnerContext(): TrpcContext {
  const partnerOwner: PartnerOwnerCtx = {
    partnerId: 60001,
    tenantId: TENANT_ID,
    email: "tourcm@example.com",
    name: "tourcm 파트너",
    loginType: "email",
    role: "partner_owner",
  };

  return {
    req: { protocol: "https", headers: {}, cookies: {} } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: null, // 파트너 대표 세션은 ctx.user가 없음 (핵심)
    isMasterSession: false,
    partnerStaff: null,
    partnerOwner,
    tenantId: TENANT_ID,
    transactionId: "test-tx-partner",
  };
}

function createAnonymousContext(): TrpcContext {
  return {
    req: { protocol: "https", headers: {}, cookies: {} } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: null,
    isMasterSession: false,
    partnerStaff: null,
    partnerOwner: null,
    tenantId: null,
    transactionId: "test-tx-anon",
  };
}

describe("partner ERP access (P0 regression: no forced logout)", () => {
  it("reservations.summary는 파트너 대표 세션에서 401 없이 응답한다", async () => {
    const caller = appRouter.createCaller(createPartnerOwnerContext());
    // 호출이 UNAUTHORIZED로 throw되지 않아야 한다 (DB 결과 형태는 환경에 따라 다를 수 있음)
    const result = await caller.reservations.summary();
    expect(result).toBeDefined();
  });

  it("crm.getPartners는 파트너 대표 세션에서 401 없이 응답한다", async () => {
    const caller = appRouter.createCaller(createPartnerOwnerContext());
    const result = await caller.crm.getPartners({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("affiliates.list는 파트너 대표 세션에서 401 없이 응답한다", async () => {
    const caller = appRouter.createCaller(createPartnerOwnerContext());
    const result = await caller.affiliates.list({ page: 1, pageSize: 20 });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
  });

  it("crm.getSchedules는 파트너 모드에서 타 테넌트 일정을 노출하지 않고 빈 배열을 반환한다", async () => {
    const caller = appRouter.createCaller(createPartnerOwnerContext());
    const result = await caller.crm.getSchedules();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("인증 없는 세션은 여전히 UNAUTHORIZED로 차단된다", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());
    await expect(caller.reservations.summary()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
