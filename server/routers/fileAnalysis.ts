/**
 * 파일 직접 분석 tRPC 라우터
 * - uploadAndExtract: 파일 업로드 → S3 저장 → 텍스트 추출 → DB 저장
 * - analyzeWithAI: 파일 컨텍스트 + 사용자 질문 → LLM 응답
 * - listBySession: 세션별 업로드 파일 목록
 * - getById: 파일 분석 결과 상세 조회
 * - deleteFile: 파일 삭제
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { fileAnalysis } from "../../drizzle/schema";
import { storagePut } from "../storage";
import { extractTextFromBuffer, buildFileContext } from "../services/fileExtractor";
import { invokeLLM } from "../_core/llm";

// 관리자 전용 프로시저
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자만 접근 가능합니다." });
  }
  return next({ ctx });
});

// 허용 MIME 타입
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const fileAnalysisRouter = router({
  /**
   * 파일 업로드 → S3 저장 → 텍스트 추출 → DB 저장
   * 입력: base64 인코딩된 파일 데이터
   */
  uploadAndExtract: adminProcedure
    .input(
      z.object({
        fileName: z.string().min(1).max(500),
        mimeType: z.string().min(1).max(100),
        base64Data: z.string().min(1), // base64 인코딩 파일 데이터
        fileSize: z.number().int().positive(),
        sessionId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 파일 크기 검증
      if (input.fileSize > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `파일 크기가 너무 큽니다. 최대 ${MAX_FILE_SIZE / 1024 / 1024}MB까지 허용됩니다.`,
        });
      }

      // MIME 타입 검증
      if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `지원하지 않는 파일 형식입니다. 허용: PDF, DOCX, 이미지(JPG/PNG/WEBP), TXT, CSV`,
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB 연결 실패" });

      // base64 → Buffer 변환
      const buffer = Buffer.from(input.base64Data, "base64");

      // S3 업로드
      const fileKey = `file-analysis/${ctx.user.id}/${Date.now()}-${input.fileName}`;
      const { url: fileUrl } = await storagePut(fileKey, buffer, input.mimeType);

      // DB에 초기 레코드 저장 (processing 상태)
      const [inserted] = await db
        .insert(fileAnalysis)
        .values({
          userId: ctx.user.id,
          fileName: input.fileName,
          fileKey,
          fileUrl,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          extractStatus: "processing",
          sessionId: input.sessionId,
        })
        .$returningId();

      const recordId = inserted.id;

      // 텍스트 추출 (비동기 처리)
      try {
        const extractResult = await extractTextFromBuffer(
          buffer,
          input.mimeType,
          input.fileName,
          fileUrl
        );

        if (extractResult.error) {
          await db
            .update(fileAnalysis)
            .set({
              extractStatus: "failed",
              extractError: extractResult.error,
            })
            .where(eq(fileAnalysis.id, recordId));

          return {
            id: recordId,
            fileUrl,
            extractStatus: "failed" as const,
            error: extractResult.error,
          };
        }

        // LLM으로 요약 생성 (짧은 요약)
        let summary: string | undefined;
        if (extractResult.text.length > 100) {
          try {
            const summaryResp = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content:
                    "당신은 문서 요약 전문가입니다. 주어진 텍스트를 3~5문장으로 핵심만 요약해 주세요. 한국어로 답변하세요.",
                },
                {
                  role: "user",
                  content: `다음 문서를 요약해 주세요:\n\n${extractResult.text.slice(0, 5000)}`,
                },
              ],
            });
            const rawContent = summaryResp?.choices?.[0]?.message?.content;
            summary = typeof rawContent === "string" ? rawContent : undefined;
          } catch {
            // 요약 실패해도 계속 진행
          }
        }

        // DB 업데이트 (완료)
        await db
          .update(fileAnalysis)
          .set({
            extractedText: extractResult.text,
            extractStatus: "done",
            summary: summary ?? null,
            analyzed: true,
          })
          .where(eq(fileAnalysis.id, recordId));

        return {
          id: recordId,
          fileUrl,
          extractStatus: "done" as const,
          extractedTextLength: extractResult.text.length,
          pageCount: extractResult.pageCount,
          method: extractResult.method,
          summary,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db
          .update(fileAnalysis)
          .set({ extractStatus: "failed", extractError: message })
          .where(eq(fileAnalysis.id, recordId));

        return {
          id: recordId,
          fileUrl,
          extractStatus: "failed" as const,
          error: message,
        };
      }
    }),

  /**
   * 파일 컨텍스트 + 사용자 질문 → LLM 응답 (RAG)
   */
  analyzeWithAI: adminProcedure
    .input(
      z.object({
        fileId: z.number().int().positive(),
        question: z.string().min(1).max(2000),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })
          )
          .optional()
          .default([]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [record] = await db
        .select()
        .from(fileAnalysis)
        .where(eq(fileAnalysis.id, input.fileId))
        .limit(1);

      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "파일을 찾을 수 없습니다." });
      }

      if (record.extractStatus !== "done" || !record.extractedText) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "파일 텍스트 추출이 완료되지 않았습니다.",
        });
      }

      // 파일 컨텍스트 빌드
      const fileContext = buildFileContext(
        record.fileName,
        record.extractedText,
        record.summary ?? undefined
      );

      // LLM 호출
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        {
          role: "system",
          content: `당신은 두골프 ERP의 AI 파일 분석 어시스턴트입니다. 첨부된 파일 내용을 분석하여 사용자의 질문에 정확하고 상세하게 답변해 주세요.\n\n${fileContext}`,
        },
        ...input.history.map((h) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user" as const, content: input.question },
      ];

      const response = await invokeLLM({ messages });
      const answer = response?.choices?.[0]?.message?.content ?? "응답을 생성할 수 없습니다.";

      return {
        answer: typeof answer === "string" ? answer : JSON.stringify(answer),
        fileName: record.fileName,
        fileId: record.id,
        summary: record.summary,
      };
    }),

  /**
   * 세션별 업로드 파일 목록
   */
  listBySession: adminProcedure
    .input(
      z.object({
        sessionId: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { files: [] };

      const conditions = [eq(fileAnalysis.userId, ctx.user.id)];
      if (input.sessionId) {
        conditions.push(eq(fileAnalysis.sessionId, input.sessionId));
      }

      const files = await db
        .select({
          id: fileAnalysis.id,
          fileName: fileAnalysis.fileName,
          fileUrl: fileAnalysis.fileUrl,
          mimeType: fileAnalysis.mimeType,
          fileSize: fileAnalysis.fileSize,
          extractStatus: fileAnalysis.extractStatus,
          summary: fileAnalysis.summary,
          analyzed: fileAnalysis.analyzed,
          createdAt: fileAnalysis.createdAt,
        })
        .from(fileAnalysis)
        .where(and(...conditions))
        .orderBy(desc(fileAnalysis.createdAt))
        .limit(input.limit);

      return { files };
    }),

  /**
   * 파일 분석 결과 상세 조회
   */
  getById: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [record] = await db
        .select()
        .from(fileAnalysis)
        .where(and(eq(fileAnalysis.id, input.id), eq(fileAnalysis.userId, ctx.user.id)))
        .limit(1);

      if (!record) throw new TRPCError({ code: "NOT_FOUND" });
      return record;
    }),

  /**
   * 파일 삭제 (DB 레코드만 삭제, S3 키는 참조 제거로 사실상 삭제)
   */
  deleteFile: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .delete(fileAnalysis)
        .where(and(eq(fileAnalysis.id, input.id), eq(fileAnalysis.userId, ctx.user.id)));

      return { success: true };
    }),
});
