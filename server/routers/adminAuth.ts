import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { authenticateAdmin, validateAdminSession, logoutAdminSession } from '../_core/adminAuth';
import { COOKIE_NAME } from '@shared/const';
import { getSessionCookieOptions } from '../_core/cookies';

export const adminAuthRouter = router({
  /**
   * 관리자 로그인
   */
  login: publicProcedure
    .input(
      z.object({
        username: z.string().min(1, '아이디를 입력하세요'),
        password: z.string().min(1, '비밀번호를 입력하세요'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await authenticateAdmin(input.username, input.password);

        // 세션 쿠키 설정
        ctx.res.setHeader(
          'Set-Cookie',
          `admin_session=${result.sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${24 * 60 * 60}${
            process.env.NODE_ENV === 'production' ? '; Secure' : ''
          }`
        );

        return {
          success: true,
          adminId: result.adminId,
          username: result.username,
          role: result.role,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: error instanceof Error ? error.message : '로그인 실패',
        });
      }
    }),

  /**
   * 관리자 로그아웃
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const sessionId = ctx.req.cookies?.admin_session;

    if (sessionId) {
      logoutAdminSession(sessionId);
    }

    // 쿠키 삭제
    ctx.res.setHeader(
      'Set-Cookie',
      'admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
    );

    return { success: true };
  }),

  /**
   * 현재 관리자 세션 확인
   */
  me: publicProcedure.query(async ({ ctx }) => {
    const sessionId = ctx.req.cookies?.admin_session;

    if (!sessionId) {
      return null;
    }

    const session = validateAdminSession(sessionId);

    if (!session) {
      return null;
    }

    return {
      adminId: session.adminId,
      username: session.username,
    };
  }),
});
