/**
 * 두골프 마스터 AI 스트리밍 엔드포인트
 * POST /api/master-stream
 * 인증: JWT 세션 쿠키 (관리자 전용)
 * 응답: text/event-stream (SSE)
 */
import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { aiLogs } from "../drizzle/schema";
import { orchestratorChatStream } from "./services/openrouter";
import { classifyIntent, fetchPackageContext, fetchReservationContext, compressHistory } from "./services/rag";
import { MASTER_SYSTEM_PROMPT } from "./services/prompts/master";
import { z } from "zod";

const inputSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().min(1).max(100),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional()
    .default([]),
});

export function registerMasterStreamRoute(app: Express) {
  app.post("/api/master-stream", async (req: Request, res: Response) => {
    // 1. 인증 확인
    let user: Awaited<ReturnType<typeof sdk.authenticateRequest>> | null = null;
    try {
      user = await sdk.authenticateRequest(req as any);
    } catch {
      res.status(401).json({ error: "인증이 필요합니다." });
      return;
    }
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "관리자 권한이 필요합니다." });
      return;
    }

    // 2. 입력 검증
    const parsed = inputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "잘못된 입력입니다.", details: parsed.error.issues });
      return;
    }
    const input = parsed.data;

    // 3. SSE 헤더 설정
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const db = await getDb();
      if (!db) {
        sendEvent("error", { message: "DB 연결 실패" });
        res.end();
        return;
      }

      // 4. 의도 분류 및 컨텍스트 수집
      const intent = classifyIntent(input.message);
      const contextParts: string[] = [];
      if (intent.needsPackages) {
        const pkgCtx = await fetchPackageContext(input.message);
        if (pkgCtx) contextParts.push(`[관련 상품 정보]\n${pkgCtx}`);
      }
      if (intent.needsReservations) {
        const resCtx = await fetchReservationContext(input.message);
        if (resCtx) contextParts.push(`[예약/정산 현황]\n${resCtx}`);
      }

      // 5. 히스토리 압축
      const compressedHistory = await compressHistory(input.sessionId, input.history);

      // 6. 시스템 프롬프트 조합
      const systemWithContext =
        contextParts.length > 0
          ? `${MASTER_SYSTEM_PROMPT}\n\n[현재 컨텍스트]\n${contextParts.join("\n\n")}`
          : MASTER_SYSTEM_PROMPT;

      // 7. 사용자 메시지 로그 저장
      await db.insert(aiLogs).values({
        sessionId: input.sessionId,
        userId: user.id,
        assistant: "master",
        role: "user",
        content: input.message,
        modelUsed: "",
        tokensIn: 0,
        tokensOut: 0,
        costUsd: "0",
        grounded: false,
      });

      // 8. 스트리밍 AI 호출
      let fullText = "";
      const startTime = Date.now();

      await orchestratorChatStream(
        {
          messages: [
            ...compressedHistory,
            { role: "user", content: input.message },
          ],
          complexity: intent.complexity === "high" ? "high" : intent.complexity === "low" ? "low" : "medium",
          assistant: "master",
          sessionId: input.sessionId,
          userId: user.id,
          systemPrompt: systemWithContext,
        },
        (chunk) => {
          fullText += chunk;
          sendEvent("chunk", { text: chunk });
        },
        async (meta) => {
          // 9. 개발 요청 감지
          let devRequestSuggestion = null;
          if (intent.needsDevRequest) {
            const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (parsed.type === "dev_request") devRequestSuggestion = parsed;
              } catch { /* 무시 */ }
            }
          }

          // 10. 어시스턴트 응답 로그 저장
          await db.insert(aiLogs).values({
            sessionId: input.sessionId,
            userId: user!.id,
            assistant: "master",
            role: "assistant",
            content: fullText,
            modelUsed: meta.model,
            tokensIn: meta.tokensIn,
            tokensOut: meta.tokensOut,
            costUsd: String(meta.costUsd.toFixed(6)),
            grounded: false,
          });

          sendEvent("done", {
            model: meta.model,
            tokensIn: meta.tokensIn,
            tokensOut: meta.tokensOut,
            costUsd: meta.costUsd,
            durationMs: meta.durationMs,
            devRequestSuggestion,
          });
          res.end();
        },
        (err) => {
          console.error("[master-stream] 오류:", err);
          sendEvent("error", { message: err.message });
          res.end();
        }
      );
    } catch (err) {
      console.error("[master-stream] 예외:", err);
      sendEvent("error", { message: "서버 오류가 발생했습니다." });
      res.end();
    }
  });
}
