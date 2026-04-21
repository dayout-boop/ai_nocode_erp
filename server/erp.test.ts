import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@dogolf.com",
    name: "두골프 관리자",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createUserContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "일반 회원",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("ERP - adminProcedure access control", () => {
  it("일반 회원은 대시보드 통계에 접근할 수 없다", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.dashboard.stats()).rejects.toThrow("관리자만 접근 가능합니다.");
  });

  it("일반 회원은 패키지 목록에 접근할 수 없다", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.packages.list({})).rejects.toThrow("관리자만 접근 가능합니다.");
  });

  it("일반 회원은 예약 목록에 접근할 수 없다", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.bookings.list({})).rejects.toThrow("관리자만 접근 가능합니다.");
  });

  it("일반 회원은 정산 목록에 접근할 수 없다", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.settlements.list({})).rejects.toThrow("관리자만 접근 가능합니다.");
  });

  it("일반 회원은 문의 목록에 접근할 수 없다", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.inquiries.list({})).rejects.toThrow("관리자만 접근 가능합니다.");
  });
});

describe("ERP - auth.me", () => {
  it("관리자 사용자 정보를 반환한다", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result?.role).toBe("admin");
    expect(result?.email).toBe("admin@dogolf.com");
  });

  it("일반 회원 사용자 정보를 반환한다", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result?.role).toBe("user");
  });
});
