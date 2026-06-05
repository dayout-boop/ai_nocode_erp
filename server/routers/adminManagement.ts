import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';
import { adminAccounts } from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { hashPassword, validatePassword } from '../_core/adminAuth';

/**
 * 모든 ERP 로그인 계정이 접근 가능한 프로시저
 */
const erpLoginProcedure = publicProcedure.use(async ({ ctx, next }) => {
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

/**
 * master 역할 전용 프로시저
 * admin 계정(role: 'master')만 접근 가능
 */
const masterOnlyProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const adminSession = (ctx.req as any).adminSession;

  if (!adminSession) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '마스터 ERP 로그인이 필요합니다',
    });
  }

  if (adminSession.role !== 'master') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '마스터 관리자만 이 작업을 수행할 수 있습니다',
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
   * 관리자 목록 조회 - 모든 ERP 로그인 계정 접근 가능
   */
  list: erpLoginProcedure.query(async () => {
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
   * 신규 관리자 계정 생성 - master 역할만 가능
   */
  create: masterOnlyProcedure
    .input(
      z.object({
        username: z.string().min(3, '아이디는 3자 이상이어야 합니다'),
        password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
        name: z.string().min(1, '이름을 입력하세요'),
        email: z.string().email('유효한 이메일을 입력하세요').optional().or(z.literal('')),
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
      await db.insert(adminAccounts).values({
        username: input.username,
        passwordHash,
        name: input.name,
        email: input.email || undefined,
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
   * - master 역할: 모든 계정 수정 가능
   * - 일반 admin: 자기 자신만 수정 가능 (role 변경 불가)
   */
  update: erpLoginProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        role: z.enum(['admin', 'master']).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const session = (ctx as any).adminSession;
      const isMaster = session.role === 'master';
      const isSelf = input.id === session.adminId;

      // 권한 확인: master가 아니면 자기 자신만 수정 가능
      if (!isMaster && !isSelf) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '다른 계정을 수정할 권한이 없습니다',
        });
      }

      // 일반 admin은 role 변경 불가
      if (!isMaster && input.role !== undefined) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '역할은 마스터 관리자만 변경할 수 있습니다',
        });
      }

      // 일반 admin은 isActive 변경 불가
      if (!isMaster && input.isActive !== undefined) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '계정 활성화 상태는 마스터 관리자만 변경할 수 있습니다',
        });
      }

      // master 계정(admin)의 role은 변경 불가 (최소 1명의 master 보장)
      if (isMaster && input.role !== undefined) {
        const targetAccount = await db
          .select()
          .from(adminAccounts)
          .where(eq(adminAccounts.id, input.id));

        if (targetAccount[0]?.username === 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'admin 계정의 역할은 변경할 수 없습니다',
          });
        }
      }

      const updateData: Record<string, any> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email || null;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (isMaster && input.role !== undefined) updateData.role = input.role;
      if (isMaster && input.isActive !== undefined) updateData.isActive = input.isActive;

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
   * 비밀번호 변경
   * - master 역할: 모든 계정 비밀번호 변경 가능 (currentPassword 불필요)
   * - 일반 admin: 자기 자신의 비밀번호만 변경 가능 (currentPassword 필요)
   */
  changePassword: erpLoginProcedure
    .input(
      z.object({
        id: z.number(),
        currentPassword: z.string().optional(), // 일반 admin 자기 변경 시 필요
        newPassword: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const session = (ctx as any).adminSession;
      const isMaster = session.role === 'master';
      const isSelf = input.id === session.adminId;

      // 권한 확인
      if (!isMaster && !isSelf) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '다른 계정의 비밀번호를 변경할 권한이 없습니다',
        });
      }

      // 일반 admin이 자기 비밀번호 변경 시 현재 비밀번호 확인
      if (!isMaster && isSelf) {
        if (!input.currentPassword) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '현재 비밀번호를 입력하세요',
          });
        }

        const account = await db
          .select()
          .from(adminAccounts)
          .where(eq(adminAccounts.id, input.id));

        if (!account[0]) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '계정을 찾을 수 없습니다' });
        }

        const isValid = await validatePassword(input.currentPassword, account[0].passwordHash);
        if (!isValid) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: '현재 비밀번호가 올바르지 않습니다',
          });
        }
      }

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
   * 관리자 계정 삭제 - master 역할만 가능
   */
  delete: masterOnlyProcedure
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

      // admin 계정(username: 'admin')은 삭제 불가
      const targetAccount = await db
        .select()
        .from(adminAccounts)
        .where(eq(adminAccounts.id, input.id));

      if (targetAccount[0]?.username === 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'admin 계정은 삭제할 수 없습니다',
        });
      }

      await db.delete(adminAccounts).where(eq(adminAccounts.id, input.id));

      return {
        success: true,
        message: '관리자 계정이 삭제되었습니다',
      };
    }),

  /**
   * 관리자 계정 활성화/비활성화 - master 역할만 가능
   */
  toggleActive: masterOnlyProcedure
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

  /**
   * 내 계정 정보 조회
   */
  getMyInfo: erpLoginProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    const session = (ctx as any).adminSession;
    const account = await db
      .select({
        id: adminAccounts.id,
        username: adminAccounts.username,
        name: adminAccounts.name,
        email: adminAccounts.email,
        phone: adminAccounts.phone,
        role: adminAccounts.role,
        isActive: adminAccounts.isActive,
        lastLoginAt: adminAccounts.lastLoginAt,
      })
      .from(adminAccounts)
      .where(eq(adminAccounts.id, session.adminId));

    if (!account[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '계정을 찾을 수 없습니다' });
    }

    return account[0];
  }),
});
