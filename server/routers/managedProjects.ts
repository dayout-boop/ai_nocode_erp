/**
 * managedProjects.ts
 * 두골프 마스터 AI 오케스트라 - 관리 프로젝트 CRUD API
 * 1000개 이상의 Manus WebDev 프로젝트를 중앙에서 관리
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { managedProjects } from "../../drizzle/schema";

const projectInput = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "소문자, 숫자, 하이픈만 허용"),
  description: z.string().optional(),
  manusProjectId: z.string().optional(),
  manusWebdevPath: z.string().optional(),
  manusDeployUrl: z.string().optional(),
  techStack: z.string().optional(),
  keyFiles: z.string().optional(),
  devInstructions: z.string().optional(),
  customContext: z.string().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export const managedProjectsRouter = router({
  // 전체 목록 조회
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select().from(managedProjects).orderBy(managedProjects.isDefault, managedProjects.name);
  }),

  // 단건 조회
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(managedProjects).where(eq(managedProjects.id, input.id)).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      return rows[0];
    }),

  // 생성
  create: protectedProcedure
    .input(projectInput)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // isDefault=true 설정 시 기존 기본 프로젝트 해제
      if (input.isDefault) {
        await db.update(managedProjects).set({ isDefault: false });
      }
      const [result] = await db.insert(managedProjects).values(input);
      return { id: (result as any).insertId };
    }),

  // 수정
  update: protectedProcedure
    .input(z.object({ id: z.number(), data: projectInput.partial() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // isDefault=true 설정 시 기존 기본 프로젝트 해제
      if (input.data.isDefault) {
        await db.update(managedProjects).set({ isDefault: false });
      }
      await db.update(managedProjects).set(input.data).where(eq(managedProjects.id, input.id));
      return { success: true };
    }),

  // 기본 프로젝트 설정
  setDefault: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(managedProjects).set({ isDefault: false });
      await db.update(managedProjects).set({ isDefault: true }).where(eq(managedProjects.id, input.id));
      return { success: true };
    }),

  // 삭제
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(managedProjects).where(eq(managedProjects.id, input.id));
      return { success: true };
    }),
});
