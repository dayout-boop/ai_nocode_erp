/**
 * systemSettingsRouter
 * ERP 시스템 설정 관리 (관리자 전용)
 * - MANUS_DOGOLF_TASK_ID 등 핵심 운영 설정을 DB에서 관리
 * - 환경변수 오버라이드: DB 값이 있으면 환경변수보다 우선 사용
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { systemSettings } from "../../drizzle/schema";

function requireAdmin(role: string) {
  if (role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
}

// 시스템 설정 키 목록 (관리 가능한 설정들)
export const SYSTEM_SETTING_KEYS = {
  MANUS_DOGOLF_TASK_ID: "MANUS_DOGOLF_TASK_ID",
  MANUS_PROJECT_ID: "MANUS_PROJECT_ID",
  SLACK_WEBHOOK_URL: "SLACK_WEBHOOK_URL",
  DEV_REQUEST_AUTO_SEND: "DEV_REQUEST_AUTO_SEND",
} as const;

const SETTING_DESCRIPTIONS: Record<string, string> = {
  MANUS_DOGOLF_TASK_ID:
    "현재 두골프 ERP 개발 대화창 태스크 ID. 설정 시 모든 개발 요청이 새 태스크를 생성하지 않고 이 대화창으로 직접 전송됩니다.",
  MANUS_PROJECT_ID:
    "Manus 프로젝트 ID. 신규 태스크 생성 시 이 프로젝트 내에 생성됩니다.",
  SLACK_WEBHOOK_URL:
    "Slack 알림 Webhook URL. 개발 요청 전송 시 Slack 채널에 알림을 발송합니다.",
  DEV_REQUEST_AUTO_SEND:
    "개발 요청 등록 시 Manus 자동 전송 여부 (true/false).",
};

export const systemSettingsRouter = router({
  // ─── 전체 설정 목록 조회 (관리자) ─────────────────────────────────────────
  list: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const rows = await db.select().from(systemSettings).orderBy(systemSettings.settingKey);

    // 환경변수 현재 값도 함께 반환 (DB 값 vs 환경변수 비교용)
    const envValues: Record<string, string> = {
      MANUS_DOGOLF_TASK_ID: process.env.MANUS_DOGOLF_TASK_ID ?? "",
      MANUS_PROJECT_ID: process.env.MANUS_PROJECT_ID ?? "",
      SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL ? "(설정됨)" : "",
      DEV_REQUEST_AUTO_SEND: "",
    };

    return {
      settings: rows,
      envValues,
      descriptions: SETTING_DESCRIPTIONS,
    };
  }),

  // ─── 특정 설정 값 조회 (서버 내부용 - public) ─────────────────────────────
  getValue: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { value: null };

      const [row] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, input.key))
        .limit(1);

      return { value: row?.settingValue ?? null };
    }),

  // ─── 설정 값 저장/업데이트 (관리자) ──────────────────────────────────────
  upsert: protectedProcedure
    .input(
      z.object({
        key: z.string().min(1).max(100),
        value: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, input.key))
        .limit(1);

      if (existing) {
        await db
          .update(systemSettings)
          .set({
            settingValue: input.value,
            description: input.description ?? existing.description,
            updatedBy: ctx.user.name ?? ctx.user.openId,
          })
          .where(eq(systemSettings.settingKey, input.key));
      } else {
        await db.insert(systemSettings).values({
          settingKey: input.key,
          settingValue: input.value,
          description:
            input.description ?? SETTING_DESCRIPTIONS[input.key] ?? "",
          updatedBy: ctx.user.name ?? ctx.user.openId,
        });
      }

      return { success: true, key: input.key };
    }),

  // ─── 설정 삭제 (관리자) ───────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .delete(systemSettings)
        .where(eq(systemSettings.settingKey, input.key));

      return { success: true };
    }),

  // ─── MANUS_DOGOLF_TASK_ID 전용 업데이트 ──────────────────────────────────
  updateManusTaskId: protectedProcedure
    .input(
      z.object({
        taskId: z.string().min(1, "태스크 ID를 입력하세요"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const key = SYSTEM_SETTING_KEYS.MANUS_DOGOLF_TASK_ID;
      const [existing] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, key))
        .limit(1);

      if (existing) {
        await db
          .update(systemSettings)
          .set({
            settingValue: input.taskId,
            updatedBy: ctx.user.name ?? ctx.user.openId,
          })
          .where(eq(systemSettings.settingKey, key));
      } else {
        await db.insert(systemSettings).values({
          settingKey: key,
          settingValue: input.taskId,
          description: SETTING_DESCRIPTIONS[key],
          updatedBy: ctx.user.name ?? ctx.user.openId,
        });
      }

      // 런타임 환경변수도 즉시 업데이트 (서버 재시작 없이 적용)
      process.env.MANUS_DOGOLF_TASK_ID = input.taskId;

      return {
        success: true,
        taskId: input.taskId,
        taskUrl: `https://manus.im/app/${input.taskId}`,
      };
    }),

  // ─── 현재 활성 Manus 태스크 ID 조회 (DB 우선, 환경변수 폴백) ─────────────
  getActiveManusTaskId: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, SYSTEM_SETTING_KEYS.MANUS_DOGOLF_TASK_ID))
      .limit(1);

    const dbValue = row?.settingValue ?? null;
    const envValue = process.env.MANUS_DOGOLF_TASK_ID ?? null;

    return {
      dbValue,
      envValue,
      activeValue: dbValue ?? envValue,
      source: dbValue ? "db" : envValue ? "env" : "none",
      taskUrl: (dbValue ?? envValue)
        ? `https://manus.im/app/${dbValue ?? envValue}`
        : null,
      updatedBy: row?.updatedBy ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  }),
});
