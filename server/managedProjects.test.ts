/**
 * managedProjects.test.ts
 * 관리 프로젝트 CRUD API 단위 테스트
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@dogolf.com",
    name: "Admin User",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: {} as any,
    res: {} as any,
  };
  return { ctx };
}

describe("managedProjects router", () => {
  it("managedProjects 라우터가 appRouter에 등록되어 있어야 한다", () => {
    // appRouter에 managedProjects 키가 있는지 확인
    const routerDef = appRouter._def;
    expect(routerDef).toBeDefined();
    expect(routerDef.procedures).toBeDefined();
    
    // managedProjects.list 프로시저가 존재하는지 확인
    const procedures = Object.keys(routerDef.procedures);
    const managedProjectsProcedures = procedures.filter(p => p.startsWith("managedProjects."));
    expect(managedProjectsProcedures.length).toBeGreaterThan(0);
  });

  it("managedProjects.list 프로시저가 존재해야 한다", () => {
    const routerDef = appRouter._def;
    const procedures = Object.keys(routerDef.procedures);
    expect(procedures).toContain("managedProjects.list");
  });

  it("managedProjects.create 프로시저가 존재해야 한다", () => {
    const routerDef = appRouter._def;
    const procedures = Object.keys(routerDef.procedures);
    expect(procedures).toContain("managedProjects.create");
  });

  it("managedProjects.update 프로시저가 존재해야 한다", () => {
    const routerDef = appRouter._def;
    const procedures = Object.keys(routerDef.procedures);
    expect(procedures).toContain("managedProjects.update");
  });

  it("managedProjects.setDefault 프로시저가 존재해야 한다", () => {
    const routerDef = appRouter._def;
    const procedures = Object.keys(routerDef.procedures);
    expect(procedures).toContain("managedProjects.setDefault");
  });

  it("managedProjects.delete 프로시저가 존재해야 한다", () => {
    const routerDef = appRouter._def;
    const procedures = Object.keys(routerDef.procedures);
    expect(procedures).toContain("managedProjects.delete");
  });

  it("managedProjects.getById 프로시저가 존재해야 한다", () => {
    const routerDef = appRouter._def;
    const procedures = Object.keys(routerDef.procedures);
    expect(procedures).toContain("managedProjects.getById");
  });
});
