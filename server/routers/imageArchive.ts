/**
 * 이미지 아카이브 관리 라우터 [ID: 600001]
 * - list: 아카이브 로그 목록 조회 (기간/출처 필터)
 * - logImage: 이미지 아카이브 로그 등록
 * - deleteFiles: 선택한 파일 Google Drive에서 삭제 + DB 삭제 처리
 * - getStats: 통계 (총 파일 수, 삭제된 파일 수, 출처별 분포)
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { imageArchiveLogs } from "../../drizzle/schema";
import { eq, and, gte, lte, desc, count, inArray } from "drizzle-orm";
import { deleteDriveFile } from "../services/googleDrive";

export const imageArchiveRouter = router({
  /**
   * 아카이브 로그 목록 조회
   */
  list: protectedProcedure
    .input(
      z.object({
        source: z.string().optional(),
        isDeleted: z.boolean().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, page: input.page, limit: input.limit };

      const { source, isDeleted, startDate, endDate, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [];
      if (source && source !== "all") {
        conditions.push(eq(imageArchiveLogs.source, source));
      }
      if (isDeleted !== undefined) {
        conditions.push(eq(imageArchiveLogs.isDeleted, isDeleted));
      }
      if (startDate) {
        conditions.push(gte(imageArchiveLogs.processedAt, new Date(startDate)));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(imageArchiveLogs.processedAt, end));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, totalRows] = await Promise.all([
        db
          .select()
          .from(imageArchiveLogs)
          .where(where)
          .orderBy(desc(imageArchiveLogs.processedAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ cnt: count() })
          .from(imageArchiveLogs)
          .where(where),
      ]);

      return {
        items,
        total: totalRows[0]?.cnt ?? 0,
        page,
        limit,
      };
    }),

  /**
   * 이미지 아카이브 로그 등록
   */
  logImage: publicProcedure
    .input(
      z.object({
        driveFileId: z.string(),
        fileName: z.string(),
        driveUrl: z.string(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
        source: z.string().default("kakaowork"),
        sourceDetail: z.string().optional(),
        processedAt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB 연결 실패");

      const [inserted] = await db
        .insert(imageArchiveLogs)
        .values({
          driveFileId: input.driveFileId,
          fileName: input.fileName,
          driveUrl: input.driveUrl,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          source: input.source,
          sourceDetail: input.sourceDetail,
          processedAt: input.processedAt ? new Date(input.processedAt) : new Date(),
          isDeleted: false,
        });
      return { success: true, id: (inserted as any).insertId };
    }),

  /**
   * 선택한 파일들 Google Drive에서 삭제 + DB 삭제 처리
   */
  deleteFiles: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.number()).min(1, "삭제할 파일을 선택하세요"),
        deletedBy: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB 연결 실패");

      const { ids, deletedBy } = input;
      const adminName = deletedBy || ctx.user?.name || "admin";

      // 대상 파일 조회
      const files = await db
        .select()
        .from(imageArchiveLogs)
        .where(
          and(
            inArray(imageArchiveLogs.id, ids),
            eq(imageArchiveLogs.isDeleted, false)
          )
        );

      if (files.length === 0) {
        return { success: false, message: "삭제할 파일이 없습니다.", deleted: 0, failed: 0 };
      }

      let deleted = 0;
      let failed = 0;
      const failedFiles: string[] = [];

      for (const file of files) {
        const driveDeleted = await deleteDriveFile(file.driveFileId);

        if (driveDeleted) {
          await db
            .update(imageArchiveLogs)
            .set({
              isDeleted: true,
              deletedAt: new Date(),
              deletedBy: adminName,
            })
            .where(eq(imageArchiveLogs.id, file.id));
          deleted++;
        } else {
          // Drive 삭제 실패 시에도 DB는 삭제 처리
          await db
            .update(imageArchiveLogs)
            .set({
              isDeleted: true,
              deletedAt: new Date(),
              deletedBy: `${adminName} (drive_fail)`,
            })
            .where(eq(imageArchiveLogs.id, file.id));
          failed++;
          failedFiles.push(file.fileName);
        }
      }

      return {
        success: true,
        deleted,
        failed,
        failedFiles,
        message: `${deleted}개 삭제 완료${failed > 0 ? `, ${failed}개 Drive 삭제 실패 (DB만 처리)` : ""}`,
      };
    }),

  /**
   * 통계 조회
   */
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, deleted: 0, active: 0, bySource: [] };

    const [totalRow, deletedRow, sourceRows] = await Promise.all([
      db.select({ cnt: count() }).from(imageArchiveLogs),
      db
        .select({ cnt: count() })
        .from(imageArchiveLogs)
        .where(eq(imageArchiveLogs.isDeleted, true)),
      db
        .select({
          source: imageArchiveLogs.source,
          cnt: count(),
        })
        .from(imageArchiveLogs)
        .groupBy(imageArchiveLogs.source),
    ]);

    return {
      total: totalRow[0]?.cnt ?? 0,
      deleted: deletedRow[0]?.cnt ?? 0,
      active: (totalRow[0]?.cnt ?? 0) - (deletedRow[0]?.cnt ?? 0),
      bySource: sourceRows,
    };
  }),
});
