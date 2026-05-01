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
  // 전체 목록 조회 (검색·필터·페이지네이션 지원)
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      isActive: z.enum(["all", "active", "inactive"]).default("all"),
      techStack: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { page = 1, pageSize = 20, search, isActive = "all", techStack } = input ?? {};

      // 조건 빌드
      const conditions: any[] = [];
      if (search?.trim()) {
        const { or, like } = await import("drizzle-orm");
        conditions.push(or(
          like(managedProjects.name, `%${search.trim()}%`),
          like(managedProjects.slug, `%${search.trim()}%`),
          like(managedProjects.description, `%${search.trim()}%`),
          like(managedProjects.techStack, `%${search.trim()}%`),
        ));
      }
      if (isActive === "active") conditions.push(eq(managedProjects.isActive, true));
      if (isActive === "inactive") conditions.push(eq(managedProjects.isActive, false));
      if (techStack?.trim()) {
        const { like } = await import("drizzle-orm");
        conditions.push(like(managedProjects.techStack, `%${techStack.trim()}%`));
      }

      const { and } = await import("drizzle-orm");
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (page - 1) * pageSize;

      const [items, countRows] = await Promise.all([
        db.select().from(managedProjects)
          .where(whereClause)
          .orderBy(managedProjects.isDefault, managedProjects.name)
          .limit(pageSize)
          .offset(offset),
        db.select({ count: sql<number>`COUNT(*)` }).from(managedProjects).where(whereClause),
      ]);

      return {
        items,
        total: Number(countRows[0]?.count ?? 0),
        page,
        pageSize,
        totalPages: Math.ceil(Number(countRows[0]?.count ?? 0) / pageSize),
      };
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

  // Manus 프로젝트 목록 동기화 (Manus API → managed_projects 자동 등록)
  syncFromManus: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const manusApiKey = process.env.MANUS_API_KEY ?? "";
    if (!manusApiKey) throw new TRPCError({ code: "BAD_REQUEST", message: "MANUS_API_KEY가 설정되지 않았습니다." });

    // Manus API에서 프로젝트 목록 조회
    let manusProjects: any[] = [];
    try {
      const resp = await fetch("https://api.manus.ai/v2/projects", {
        headers: { Authorization: `Bearer ${manusApiKey}`, "Content-Type": "application/json" },
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Manus API 오류: ${resp.status} ${errText}` });
      }
      const data = await resp.json();
      // Manus API 응답 구조: { projects: [...] } 또는 배열 직접 반환
      manusProjects = Array.isArray(data) ? data : (data.projects ?? data.data ?? []);
    } catch (e: any) {
      if (e instanceof TRPCError) throw e;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Manus API 연결 실패: ${e.message}` });
    }

    if (!Array.isArray(manusProjects) || manusProjects.length === 0) {
      return { synced: 0, skipped: 0, total: 0, message: "Manus에서 가져온 프로젝트가 없습니다." };
    }

    // 기존 managed_projects에서 manusProjectId 목록 조회
    const existing = await db.select({ manusProjectId: managedProjects.manusProjectId }).from(managedProjects);
    const existingIds = new Set(existing.map((r) => r.manusProjectId).filter(Boolean));

    let synced = 0;
    let skipped = 0;

    for (const proj of manusProjects) {
      // Manus 프로젝트 ID 추출 (id 또는 project_id 필드)
      const manusId: string = proj.id ?? proj.project_id ?? "";
      const projName: string = proj.name ?? proj.title ?? manusId;
      const deployUrl: string = proj.url ?? proj.deploy_url ?? proj.preview_url ?? "";

      if (!manusId) { skipped++; continue; }
      if (existingIds.has(manusId)) { skipped++; continue; }

      // slug 생성: 이름을 소문자 + 하이픈으로 변환
      const rawSlug = projName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 80);
      const slug = rawSlug || `manus-${manusId.slice(0, 8)}`;

      // 중복 slug 방지: 이미 존재하면 suffix 추가
      const slugExists = await db.select({ id: managedProjects.id }).from(managedProjects)
        .where(eq(managedProjects.slug, slug)).limit(1);
      const finalSlug = slugExists.length > 0 ? `${slug}-${manusId.slice(0, 6)}` : slug;

      await db.insert(managedProjects).values({
        name: projName,
        slug: finalSlug,
        description: proj.description ?? `Manus에서 자동 동기화된 프로젝트 (${manusId})`,
        manusProjectId: manusId,
        manusDeployUrl: deployUrl,
        techStack: proj.tech_stack ?? proj.template ?? "",
        isActive: true,
        isDefault: false,
      });
      synced++;
    }

    return {
      synced,
      skipped,
      total: manusProjects.length,
      message: `${synced}개 신규 프로젝트를 동기화했습니다. (${skipped}개 이미 등록됨)`,
    };
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
