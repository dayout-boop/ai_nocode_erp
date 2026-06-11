/**
 * 이메일(SMTP) 설정 관리 라우터
 * - master 역할 전용: SMTP 자격증명 등록/조회/테스트
 * - 비밀번호(구글 앱 비밀번호)는 erp_api_settings에 AES-256 암호화 저장
 * - user/from/host/port는 extraConfig(JSON, 평문)로 저장
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';
import { erpApiSettings, partnerEmailLogs } from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { encryptApiKey, maskApiKey, invalidateKeyCache } from '../erpApiKeyManager';
import { SMTP_SERVICE_KEY, resolveSmtpConfig, verifySmtp, sendMail } from '../mailer';

/** master 역할 전용 프로시저 (adminSession.role === 'master') */
const masterOnlyProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const adminSession = (ctx.req as any).adminSession;
  if (!adminSession) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: '마스터 ERP 로그인이 필요합니다' });
  }
  if (adminSession.role !== 'master') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '마스터 관리자만 이메일 설정을 관리할 수 있습니다' });
  }
  return next({ ctx: { ...ctx, adminSession } });
});

export const mailRouter = router({
  /** SMTP 설정 현황 조회 (마스킹) */
  getSmtpConfig: masterOnlyProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    const rows = await db
      .select()
      .from(erpApiSettings)
      .where(eq(erpApiSettings.serviceKey, SMTP_SERVICE_KEY));

    const row = rows[0];
    let extra: Record<string, string> = {};
    if (row?.extraConfig) {
      try { extra = JSON.parse(row.extraConfig); } catch { extra = {}; }
    }

    return {
      hasPassword: !!row?.apiKeyEncrypted,
      passwordMasked: row?.apiKeyMasked ?? null,
      user: extra.user ?? '',
      from: extra.from ?? '',
      host: extra.host ?? 'smtp.gmail.com',
      port: extra.port ?? '465',
      isActive: row?.isActive ?? false,
      updatedAt: row?.updatedAt ?? null,
    };
  }),

  /** SMTP 설정 저장 (비밀번호는 입력 시에만 갱신) */
  upsertSmtpConfig: masterOnlyProcedure
    .input(z.object({
      user: z.string().min(1, '발송 계정(이메일)을 입력하세요'),
      from: z.string().optional(),
      host: z.string().optional(),
      port: z.string().optional(),
      password: z.string().optional(), // 미입력 시 기존 비번 유지
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const extraConfig = JSON.stringify({
        user: input.user,
        from: input.from || input.user,
        host: input.host || 'smtp.gmail.com',
        port: input.port || '465',
      });

      const updateData: Record<string, any> = {
        serviceName: 'SMTP (구글 워크스페이스)',
        extraConfig,
        isActive: true,
        updatedBy: (ctx as any).adminSession.adminId,
      };

      if (input.password && input.password.trim()) {
        const pw = input.password.trim();
        updateData.apiKeyEncrypted = encryptApiKey(pw);
        updateData.apiKeyMasked = maskApiKey(pw);
      }

      const existing = await db
        .select({ id: erpApiSettings.id, hasPw: erpApiSettings.apiKeyEncrypted })
        .from(erpApiSettings)
        .where(eq(erpApiSettings.serviceKey, SMTP_SERVICE_KEY));

      if (existing.length > 0) {
        await db.update(erpApiSettings).set(updateData).where(eq(erpApiSettings.serviceKey, SMTP_SERVICE_KEY));
      } else {
        if (!updateData.apiKeyEncrypted) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '최초 등록 시 앱 비밀번호를 입력해야 합니다' });
        }
        await db.insert(erpApiSettings).values({
          serviceKey: SMTP_SERVICE_KEY,
          serviceName: 'SMTP (구글 워크스페이스)',
          ...updateData,
        });
      }

      invalidateKeyCache(SMTP_SERVICE_KEY);
      return { success: true, message: 'SMTP 설정이 저장되었습니다' };
    }),

  /** SMTP 연결 검증 (실제 메일 미발송) */
  testSmtpConnection: masterOnlyProcedure.mutation(async () => {
    const cfg = await resolveSmtpConfig();
    if (!cfg) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'SMTP 설정이 없습니다. 먼저 계정과 앱 비밀번호를 등록하세요.' });
    }
    const res = await verifySmtp();
    if (!res.success) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `SMTP 연결 실패: ${res.error}` });
    }
    return { success: true, user: cfg.user, host: cfg.host, port: cfg.port };
  }),

  /** 테스트 메일 발송 */
  sendTestMail: masterOnlyProcedure
    .input(z.object({ to: z.string().email('올바른 이메일 주소를 입력하세요') }))
    .mutation(async ({ input }) => {
      const cfg = await resolveSmtpConfig();
      if (!cfg) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'SMTP 설정이 없습니다.' });
      }
      const res = await sendMail({
        to: input.to,
        subject: '[두골프] SMTP 테스트 메일',
        html: '<div style="font-family:sans-serif;padding:20px;"><h2 style="color:#1a7a4c;">AI ERP SMTP 연동 테스트</h2><p>이 메일이 보이면 자립형 이메일 발송 엔진이 정상 작동하는 것입니다.</p></div>',
        text: 'AI ERP SMTP 연동 테스트 — 정상 작동합니다.',
      });
      if (!res.success) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `발송 실패: ${res.error}` });
      }
      return { success: true, messageId: res.messageId };
    }),

  /** 최근 이메일 발송 로그 (메타데이터) */
  listEmailLogs: masterOnlyProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const limit = input?.limit ?? 50;
      return db
        .select()
        .from(partnerEmailLogs)
        .orderBy(desc(partnerEmailLogs.createdAt))
        .limit(limit);
    }),
});
