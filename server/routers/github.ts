/**
 * GitHub 연동 tRPC 라우터
 * AI 엔진 Phase 2: 코드 히스토리 보관 + 중복 개발 방지
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getRepoInfo,
  listCommits,
  getCommitDetail,
  searchCode,
  listBranches,
  testConnection,
} from "../_core/github";
import { getDb } from "../db";
import { githubCommits } from "../../drizzle/schema";
import { eq, desc, and, isNotNull } from "drizzle-orm";

export const githubRouter = router({
  /**
   * GitHub 연결 상태 테스트
   */
  testConnection: protectedProcedure.query(async () => {
    const result = await testConnection();
    return result;
  }),

  /**
   * 저장소 기본 정보 조회
   */
  getRepoInfo: protectedProcedure.query(async () => {
    try {
      return await getRepoInfo();
    } catch (e) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: e instanceof Error ? e.message : "GitHub API 오류",
      });
    }
  }),

  /**
   * 브랜치 목록 조회
   */
  listBranches: protectedProcedure.query(async () => {
    try {
      return await listBranches();
    } catch (e) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: e instanceof Error ? e.message : "GitHub API 오류",
      });
    }
  }),

  /**
   * 커밋 목록 조회
   */
  listCommits: protectedProcedure
    .input(
      z.object({
        branch: z.string().optional(),
        path: z.string().optional(),
        since: z.string().optional(),
        until: z.string().optional(),
        perPage: z.number().min(1).max(100).default(30),
        page: z.number().min(1).default(1),
      })
    )
    .query(async ({ input }) => {
      try {
        return await listCommits(input);
      } catch (e) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: e instanceof Error ? e.message : "GitHub API 오류",
        });
      }
    }),

  /**
   * 특정 커밋 상세 조회
   */
  getCommitDetail: protectedProcedure
    .input(z.object({ sha: z.string() }))
    .query(async ({ input }) => {
      try {
        return await getCommitDetail(input.sha);
      } catch (e) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: e instanceof Error ? e.message : "GitHub API 오류",
        });
      }
    }),

  /**
   * 코드 검색 (중복 개발 방지)
   */
  searchCode: protectedProcedure
    .input(
      z.object({
        query: z.string().min(2).max(200),
        language: z.string().optional(),
        perPage: z.number().min(1).max(30).default(10),
      })
    )
    .query(async ({ input }) => {
      try {
        return await searchCode(input.query, {
          language: input.language,
          perPage: input.perPage,
        });
      } catch (e) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: e instanceof Error ? e.message : "GitHub 검색 오류",
        });
      }
    }),

  /**
   * 커밋과 개발 요청 연결 (수동)
   */
  linkCommit: protectedProcedure
    .input(
      z.object({
        devRequestId: z.number().int().positive(),
        commitSha: z.string().length(40),
      })
    )
    .mutation(async ({ input }) => {
      // GitHub에서 커밋 정보 가져오기
      let commitData;
      try {
        commitData = await getCommitDetail(input.commitSha);
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `커밋을 찾을 수 없습니다: ${input.commitSha}`,
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      // 이미 연결된 커밋인지 확인
      const existing = await db
        .select()
        .from(githubCommits)
        .where(
          and(
            eq(githubCommits.commitSha, input.commitSha),
            eq(githubCommits.devRequestId, input.devRequestId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 연결된 커밋입니다.",
        });
      }

      // DB에 저장
      const [inserted] = await db.insert(githubCommits).values({
        devRequestId: input.devRequestId,
        commitSha: input.commitSha,
        commitMessage: commitData.message,
        authorName: commitData.author.name,
        authorEmail: commitData.author.email,
        committedAt: new Date(commitData.author.date),
        filesChanged: commitData.filesChanged ?? 0,
        additions: commitData.additions ?? 0,
        deletions: commitData.deletions ?? 0,
        commitUrl: commitData.htmlUrl,
        filesData: commitData.files as any,
        linkType: "manual",
      });

      return { success: true, id: (inserted as any).insertId };
    }),

  /**
   * 개발 요청에 연결된 커밋 목록 조회
   */
  getLinkedCommits: protectedProcedure
    .input(z.object({ devRequestId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(githubCommits)
        .where(eq(githubCommits.devRequestId, input.devRequestId))
        .orderBy(desc(githubCommits.createdAt));
    }),

  /**
   * 전체 연결된 커밋 목록 (히스토리 뷰어)
   */
  listLinkedCommits: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(20),
        devRequestId: z.number().int().positive().optional(),
      })
    )
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.pageSize;
      const where = input.devRequestId
        ? and(isNotNull(githubCommits.devRequestId), eq(githubCommits.devRequestId, input.devRequestId))
        : undefined;

      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(githubCommits)
        .where(where)
        .orderBy(desc(githubCommits.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      return rows;
    }),

  /**
   * 커밋 연결 해제
   */
  unlinkCommit: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });
      await db.delete(githubCommits).where(eq(githubCommits.id, input.id));
      return { success: true };
    }),
});
