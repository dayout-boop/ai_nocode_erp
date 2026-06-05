import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';
import { adminAccounts } from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { hashPassword } from '../_core/adminAuth';

/**
 * 마스터 ERP 전용 프로시저
 * 마스터 세션이 있어야만 접근 가능
 */
const masterProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const adminSession = (ctx.req as any).adminSession;

  if (!adminSession) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '마스터 ERP 로그인이 필요합니다',
    });
  }

  return next({
    ctx: {
      ...ctx,
      adminSession,
    },
  });
});

export const adminManagementRouter = router({
  /**
   * 관리자 목록 조회
   */
  list: masterProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    const admins = await db
      .select({
        id: adminAccounts.id,
        username: adminAccounts.username,
        name: adminAccounts.name,
        email: adminAccounts.email,
        phone: adminAccounts.phone,
        role: adminAccounts.role,
        isActive: adminAccounts.isActive,
        createdAt: adminAccounts.createdAt,
        lastLoginAt: adminAccounts.lastLoginAt,
      })
      .from(adminAccounts)
      .orderBy(desc(adminAccounts.createdAt));

    return admins;
  }),

  /**
   * 신규 관리자 계정 생성
   */
  create: masterProcedure
    .input(
      z.object({
        username: z.string().min(3, '아이디는 3자 이상이어야 합니다'),
        password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
        name: z.string().min(1, '이름을 입력하세요'),
        email: z.string().email('유효한 이메일을 입력하세요').optional(),
        phone: z.string().optional(),
        role: z.enum(['admin', 'master']).default('admin'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // 중복 확인
      const existing = await db
        .select()
        .from(adminAccounts)
        .where(eq(adminAccounts.username, input.username));

      if (existing.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '이미 존재하는 아이디입니다',
        });
      }

      // 비밀번호 해싱
      const passwordHash = await hashPassword(input.password);

      // 관리자 계정 생성
      const result = await db.insert(adminAccounts).values({
        username: input.username,
        passwordHash,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        isActive: true,
        createdBy: (ctx as any).adminSession.adminId,
      });

      return {
        success: true,
        message: '관리자 계정이 생성되었습니다',
      };
    }),

  /**
   * 관리자 정보 수정
   */
  update: masterProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.enum(['admin', 'master']).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const updateData: Record<string, any> = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.role !== undefined) updateData.role = input.role;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      await db
        .update(adminAccounts)
        .set(updateData)
        .where(eq(adminAccounts.id, input.id));

      return {
        success: true,
        message: '관리자 정보가 수정되었습니다',
      };
    }),

  /**
   * 관리자 비밀번호 변경
   */
  changePassword: masterProcedure
    .input(
      z.object({
        id: z.number(),
        newPassword: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const passwordHash = await hashPassword(input.newPassword);

      await db
        .update(adminAccounts)
        .set({ passwordHash })
        .where(eq(adminAccounts.id, input.id));

      return {
        success: true,
        message: '비밀번호가 변경되었습니다',
      };
    }),

  /**
   * 관리자 계정 삭제
   */
  delete: masterProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // 자기 자신은 삭제 불가
      if (input.id === (ctx as any).adminSession.adminId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '자신의 계정은 삭제할 수 없습니다',
        });
      }

      await db.delete(adminAccounts).where(eq(adminAccounts.id, input.id));

      return {
        success: true,
        message: '관리자 계정이 삭제되었습니다',
      };
    }),

  /**
   * 관리자 계정 활성화/비활성화
   */
  toggleActive: masterProcedure
    .input(
      z.object({
        id: z.number(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // 자신의 계정은 비활성화 불가
      if (input.id === (ctx as any).adminSession.adminId && !input.isActive) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '자신의 계정은 비활성화할 수 없습니다',
        });
      }

      await db
        .update(adminAccounts)
        .set({ isActive: input.isActive })
        .where(eq(adminAccounts.id, input.id));

      return {
        success: true,
        message: input.isActive ? '계정이 활성화되었습니다' : '계정이 비활성화되었습니다',
      };
    }),
});
