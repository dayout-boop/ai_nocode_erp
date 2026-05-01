/**
 * managedProjects.ts
 * 두골프 마스터 AI 오케스트라 - 관리 프로젝트 CRUD API
 * 1000개 이상의 Manus WebDev 프로젝트를 중앙에서 관리
 */
import { z } from "zod";
import { eq, sql, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { managedProjects, devRequests } from "../../drizzle/schema";

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

  // 프로젝트별 개발 요청 통계 (AI 엔진 성능 비교 대시보드용)
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // 전체 프로젝트 목록
    const projects = await db
      .select()
      .from(managedProjects)
      .orderBy(managedProjects.isDefault, managedProjects.name);

    // 프로젝트별 dev_requests 통계 집계
    const statsRows = await db
      .select({
        manusProjectId: devRequests.manusProjectId,
        totalRequests: sql<number>`COUNT(*)`,
        completedRequests: sql<number>`SUM(CASE WHEN ${devRequests.status} = 'done' THEN 1 ELSE 0 END)`,
        avgAccuracy: sql<number>`AVG(${devRequests.accuracyScore})`,
        bugCount: sql<number>`SUM(CASE WHEN ${devRequests.feedbackCategory} = 'bug' THEN 1 ELSE 0 END)`,
        suggestionCount: sql<number>`SUM(CASE WHEN ${devRequests.feedbackCategory} = 'suggestion' THEN 1 ELSE 0 END)`,
        otherCount: sql<number>`SUM(CASE WHEN ${devRequests.feedbackCategory} = 'other' THEN 1 ELSE 0 END)`,
        evaluatedCount: sql<number>`SUM(CASE WHEN ${devRequests.accuracyScore} IS NOT NULL THEN 1 ELSE 0 END)`,
      })
      .from(devRequests)
      .where(isNotNull(devRequests.manusProjectId))
      .groupBy(devRequests.manusProjectId);

    // 프로젝트 ID → 통계 맵
    const statsMap = new Map(statsRows.map((r) => [r.manusProjectId, r]));

    // 프로젝트에 통계 병합
    return projects.map((p) => {
      const stats = p.manusProjectId ? statsMap.get(p.manusProjectId) : undefined;
      return {
        ...p,
        stats: stats
          ? {
              totalRequests: Number(stats.totalRequests) || 0,
              completedRequests: Number(stats.completedRequests) || 0,
              avgAccuracy: stats.avgAccuracy ? Math.round(Number(stats.avgAccuracy)) : null,
              bugCount: Number(stats.bugCount) || 0,
              suggestionCount: Number(stats.suggestionCount) || 0,
              otherCount: Number(stats.otherCount) || 0,
              evaluatedCount: Number(stats.evaluatedCount) || 0,
            }
          : null,
      };
    });
  }),

  // 컨텍스트 복사 (다른 프로젝트의 컨텍스트를 현재 프로젝트로 복사)
  copyContext: protectedProcedure
    .input(z.object({
      fromId: z.number(),
      toId: z.number(),
      fields: z.array(z.enum(["devInstructions", "customContext", "keyFiles", "techStack"])),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [source] = await db.select().from(managedProjects).where(eq(managedProjects.id, input.fromId)).limit(1);
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "원본 프로젝트를 찾을 수 없습니다." });
      const patch: Record<string, string | null> = {};
      for (const field of input.fields) {
        patch[field] = (source as any)[field] ?? null;
      }
      await db.update(managedProjects).set(patch).where(eq(managedProjects.id, input.toId));
      return { success: true, copiedFields: input.fields };
    }),
});
