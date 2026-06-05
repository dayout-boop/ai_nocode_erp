/**
 * ERP API 키 관리 라우터
 * - master 역할만 접근 가능
 * - API 키 조회/저장/삭제
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';
import { erpApiSettings } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { encryptApiKey, maskApiKey, invalidateKeyCache } from '../erpApiKeyManager';

/**
 * master 역할 전용 프로시저
 * admin_session 쿠키가 있고 role이 'master'인 경우만 접근 가능
 */
const masterOnlyProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const adminSession = (ctx.req as any).adminSession;

  if (!adminSession) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '마스터 ERP 로그인이 필요합니다',
    });
  }

  // master 역할 확인
  if (adminSession.role !== 'master') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '마스터 관리자만 API 키를 관리할 수 있습니다',
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
 * 모든 ERP 로그인 계정이 접근 가능한 프로시저 (조회 전용)
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

export const erpApiKeysRouter = router({
  /**
   * API 키 목록 조회 (마스킹된 값만 반환)
   * master 역할만 접근 가능
   */
  list: masterOnlyProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    const settings = await db.select().from(erpApiSettings);

    return settings.map(s => ({
      id: s.id,
      serviceKey: s.serviceKey,
      serviceName: s.serviceName,
      apiKeyMasked: s.apiKeyMasked,
      hasKey: !!s.apiKeyEncrypted,
      extraConfig: s.extraConfig,
      isActive: s.isActive,
      updatedAt: s.updatedAt,
    }));
  }),

  /**
   * API 키 저장/업데이트
   * master 역할만 접근 가능
   */
  upsert: masterOnlyProcedure
    .input(z.object({
      serviceKey: z.string(),
      serviceName: z.string().optional(),
      apiKey: z.string().optional(), // 새 키 값 (없으면 기존 유지)
      extraConfig: z.record(z.string(), z.unknown()).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const updateData: Record<string, any> = {
        updatedBy: (ctx as any).adminSession.adminId,
      };

      if (input.serviceName) updateData.serviceName = input.serviceName;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.extraConfig) updateData.extraConfig = JSON.stringify(input.extraConfig);

      if (input.apiKey) {
        updateData.apiKeyEncrypted = encryptApiKey(input.apiKey);
        updateData.apiKeyMasked = maskApiKey(input.apiKey);
      }

      // upsert
      const existing = await db
        .select({ id: erpApiSettings.id })
        .from(erpApiSettings)
        .where(eq(erpApiSettings.serviceKey, input.serviceKey));

      if (existing.length > 0) {
        await db
          .update(erpApiSettings)
          .set(updateData)
          .where(eq(erpApiSettings.serviceKey, input.serviceKey));
      } else {
        await db.insert(erpApiSettings).values({
          serviceKey: input.serviceKey,
          serviceName: input.serviceName || input.serviceKey,
          ...updateData,
        });
      }

      // 캐시 무효화
      invalidateKeyCache(input.serviceKey);

      return { success: true, message: 'API 키가 저장되었습니다' };
    }),

  /**
   * API 키 삭제 (DB에서만 삭제, 환경변수 폴백으로 전환)
   * master 역할만 접근 가능
   */
  deleteKey: masterOnlyProcedure
    .input(z.object({ serviceKey: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await db
        .update(erpApiSettings)
        .set({ apiKeyEncrypted: null, apiKeyMasked: null })
        .where(eq(erpApiSettings.serviceKey, input.serviceKey));

      invalidateKeyCache(input.serviceKey);

      return { success: true, message: 'API 키가 삭제되었습니다 (환경변수로 폴백)' };
    }),

  /**
   * 연동 상태 확인 (master 로그인 계정 전용)
   * 실제 키 존재 여부만 반환
   */
  getStatus: erpLoginProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    const settings = await db.select().from(erpApiSettings);

    const statusMap: Record<string, { hasDbKey: boolean; isActive: boolean }> = {};
    for (const s of settings) {
      statusMap[s.serviceKey] = {
        hasDbKey: !!s.apiKeyEncrypted,
        isActive: s.isActive,
      };
    }

    return statusMap;
  }),
});
