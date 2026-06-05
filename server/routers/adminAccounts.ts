import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { adminAccounts } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

/**
 * 비밀번호 해싱
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 비밀번호 검증
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const adminAccountsRouter = router({
  /**
   * 신규 관리자 계정 생성 (마스터 관리자만 가능)
   */
  create: adminProcedure
    .input(
      z.object({
        username: z.string().min(3).max(100),
        password: z.string().min(8).max(100),
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.enum(["admin", "master"]).default("admin"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 마스터 관리자만 계정 생성 가능
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "마스터 관리자만 계정을 생성할 수 있습니다.",
        });
      }

      // 중복 username 체크
      const existing = await db
        .select()
        .from(adminAccounts)
        .where(eq(adminAccounts.username, input.username))
        .limit(1)
        .then(rows => rows[0]);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "이미 존재하는 username입니다.",
        });
      }

      // 비밀번호 해싱
      const passwordHash = await hashPassword(input.password);

      // 계정 생성
      const result = await db.insert(adminAccounts).values({
        username: input.username,
        passwordHash,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        createdBy: ctx.user.id,
        isActive: true,
      });

      return {
        id: result[0],
        username: input.username,
        name: input.name,
        email: input.email,
        role: input.role,
        isActive: true,
        createdAt: new Date(),
      };
    }),

  /**
   * 관리자 계정 목록 조회
   */
  list: adminProcedure
    .input(
      z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const accounts = await db
        .select()
        .from(adminAccounts)
        .orderBy(desc(adminAccounts.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return accounts.map((acc) => ({
        id: acc.id,
        username: acc.username,
        name: acc.name,
        email: acc.email,
        phone: acc.phone,
        role: acc.role,
        isActive: acc.isActive,
        lastLoginAt: acc.lastLoginAt,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt,
      }));
    }),

  /**
   * 관리자 계정 상세 조회
   */
  getById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const account = await db
        .select()
        .from(adminAccounts)
        .where(eq(adminAccounts.id, input.id))
        .limit(1)
        .then(rows => rows[0]);

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "계정을 찾을 수 없습니다.",
        });
      }

      return {
        id: account.id,
        username: account.username,
        name: account.name,
        email: account.email,
        phone: account.phone,
        role: account.role,
        isActive: account.isActive,
        lastLoginAt: account.lastLoginAt,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      };
    }),

  /**
   * 관리자 계정 정보 수정
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.enum(["admin", "master"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 마스터 관리자만 수정 가능
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "마스터 관리자만 계정을 수정할 수 있습니다.",
        });
      }

      const account = await db
        .select()
        .from(adminAccounts)
        .where(eq(adminAccounts.id, input.id))
        .limit(1)
        .then(rows => rows[0]);

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "계정을 찾을 수 없습니다.",
        });
      }

      await db
        .update(adminAccounts)
        .set({
          name: input.name ?? account.name,
          email: input.email ?? account.email,
          phone: input.phone ?? account.phone,
          role: input.role ?? account.role,
          isActive: input.isActive ?? account.isActive,
          updatedAt: new Date(),
        })
        .where(eq(adminAccounts.id, input.id));

      return {
        id: account.id,
        username: account.username,
        name: input.name ?? account.name,
        email: input.email ?? account.email,
        phone: input.phone ?? account.phone,
        role: input.role ?? account.role,
        isActive: input.isActive ?? account.isActive,
      };
    }),

  /**
   * 비밀번호 변경
   */
  changePassword: adminProcedure
    .input(
      z.object({
        id: z.number(),
        newPassword: z.string().min(8).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 마스터 관리자만 변경 가능
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "마스터 관리자만 비밀번호를 변경할 수 있습니다.",
        });
      }

      const account = await db
        .select()
        .from(adminAccounts)
        .where(eq(adminAccounts.id, input.id))
        .limit(1)
        .then(rows => rows[0]);

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "계정을 찾을 수 없습니다.",
        });
      }

      const passwordHash = await hashPassword(input.newPassword);

      await db
        .update(adminAccounts)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(adminAccounts.id, input.id));

      return { success: true };
    }),

  /**
   * 관리자 계정 삭제
   */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 마스터 관리자만 삭제 가능
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "마스터 관리자만 계정을 삭제할 수 있습니다.",
        });
      }

      const account = await db
        .select()
        .from(adminAccounts)
        .where(eq(adminAccounts.id, input.id))
        .limit(1)
        .then(rows => rows[0]);

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "계정을 찾을 수 없습니다.",
        });
      }

      await db.delete(adminAccounts).where(eq(adminAccounts.id, input.id));

      return { success: true };
    }),

  /**
   * username/password 로그인 검증 (내부용)
   */
  verifyCredentials: protectedProcedure
    .input(
      z.object({
        username: z.string(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const account = await db
        .select()
        .from(adminAccounts)
        .where(eq(adminAccounts.username, input.username))
        .limit(1)
        .then(rows => rows[0]);

      if (!account) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "username 또는 password가 올바르지 않습니다.",
        });
      }

      const isValid = await verifyPassword(input.password, account.passwordHash);

      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "username 또는 password가 올바르지 않습니다.",
        });
      }

      if (!account.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "비활성화된 계정입니다.",
        });
      }

      // 마지막 로그인 시간 업데이트
      await db
        .update(adminAccounts)
        .set({ lastLoginAt: new Date() })
        .where(eq(adminAccounts.id, account.id));

      return {
        id: account.id,
        username: account.username,
        name: account.name,
        role: account.role,
      };
    }),
});
