/**
 * 두골프 마스터 AI 스트리밍 엔드포인트
 * POST /api/master-stream
 * 인증: JWT 세션 쿠키 (관리자 전용)
 * 응답: text/event-stream (SSE)
 *
 * 파이프라인:
 * 1. 인증 확인 (관리자 전용)
 * 2. 의도 분류 + RAG 컨텍스트 수집
 * 3. Tool Calling 루프 (DB 직접 조회 최대 5회)
 * 4. 스트리밍 최종 응답
 * 5. 개발 요청 자동 감지
 */
import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { aiLogs } from "../drizzle/schema";
import { orchestratorChatStream, orchestratorChat } from "./services/openrouter";
import { classifyIntent, fetchPackageContext, fetchReservationContext, compressHistory } from "./services/rag";
import { MASTER_SYSTEM_PROMPT } from "./services/prompts/master";
import { MASTER_TOOLS, executeTool, APPROVAL_REQUIRED_TOOLS, type ToolCallResult } from "./services/masterTools";
import { z } from "zod";

const inputSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().min(1).max(100),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional()
    .default([]),
  // 파일 분석 컨텍스트 (파일 첨부 시 주입)
  fileContexts: z
    .array(
      z.object({
        fileName: z.string(),
        mimeType: z.string(),
        extractedText: z.string(),
        analysisResult: z.string().optional(),
      })
    )
    .optional()
    .default([]),
});

// ─── Tool Call 타입 ─────────────────────────────────────────────
interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

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

      // 4. 의도 분류 및 RAG 컨텍스트 수집
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

      // 5-1. 파일 컨텍스트 추가
      if (input.fileContexts && input.fileContexts.length > 0) {
        const fileCtxParts = input.fileContexts.map((fc) => {
          const lines = [`📎 파일명: ${fc.fileName} (${fc.mimeType})`];
          if (fc.extractedText) {
            const truncated = fc.extractedText.length > 3000
              ? fc.extractedText.slice(0, 3000) + "\n...(내용 일부 생략)"
              : fc.extractedText;
            lines.push(`추출된 내용:\n${truncated}`);
          }
          if (fc.analysisResult) {
            lines.push(`AI 분석 결과:\n${fc.analysisResult}`);
          }
          return lines.join("\n");
        });
        contextParts.push(`[첨부 파일 분석]\n${fileCtxParts.join("\n\n---\n")}`);
      }

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

      // ─── Tool Calling 루프 ────────────────────────────────────────
      // AI가 도구를 호출할 경우 최대 5회 반복
      const MAX_TOOL_ROUNDS = 5;
      const toolCallResults: ToolCallResult[] = [];

      // 메시지 배열 (Tool Calling 루프용)
      const messages: Array<{
        role: "system" | "user" | "assistant" | "tool";
        content: string;
        tool_call_id?: string;
        tool_calls?: ToolCall[];
      }> = [
        { role: "system", content: systemWithContext },
        ...compressedHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: input.message },
      ];

      let toolRound = 0;
      let finalResponse: { content: string; model: string; tokensIn: number; tokensOut: number; costUsd: number; durationMs: number } | null = null;

      while (toolRound < MAX_TOOL_ROUNDS) {
        toolRound++;

        // Tool Calling 비스트리밍 호출 (도구 결과 수집 단계)
        const toolResponse = await orchestratorChat({
          messages: messages as any,
          complexity: intent.complexity === "high" ? "high" : intent.complexity === "low" ? "low" : "medium",
          assistant: "master",
          sessionId: input.sessionId,
          userId: user.id,
          systemPrompt: "", // 이미 messages에 포함
          tools: MASTER_TOOLS as any,
          tool_choice: "auto",
        });

        // ChatResult 타입에서 tool_calls와 text 직접 접근
        const toolCalls: ToolCall[] = (toolResponse.tool_calls || []) as ToolCall[];
        if (toolCalls.length === 0) {
          // 최종 텍스트 응답이 있으면 저장
          finalResponse = {
            content: toolResponse.text || "",
            model: toolResponse.model || "unknown",
            tokensIn: toolResponse.tokensIn || 0,
            tokensOut: toolResponse.tokensOut || 0,
            costUsd: toolResponse.costUsd || 0,
            durationMs: toolResponse.durationMs || 0,
          };
          break;
        }
        // 도구 호출 실행
        messages.push({ role: "assistant", content: toolResponse.text || "", tool_calls: toolCalls });;

        for (const tc of toolCalls) {
          sendEvent("tool_start", { name: tc.function.name, id: tc.id });

          let toolArgs: Record<string, unknown> = {};
          try {
            toolArgs = JSON.parse(tc.function.arguments || "{}");
          } catch { /* 무시 */ }

          // 승인 필요 도구 감지 (Human-in-the-Loop)
          if (APPROVAL_REQUIRED_TOOLS.includes(tc.function.name)) {
            sendEvent("approval_request", {
              id: tc.id,
              toolName: tc.function.name,
              toolArgs,
              message: `외부 연동 도구 '${tc.function.name}'을 실행하려 합니다. 인수: ${JSON.stringify(toolArgs)}`,
            });
          }
          const result = await executeTool(tc.function.name, toolArgs);
          toolCallResults.push(result);

          sendEvent("tool_done", {
            name: tc.function.name,
            id: tc.id,
            success: result.success,
            queryTime: result.queryTime,
            error: result.error,
          });

          // 도구 결과를 메시지에 추가
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result.success
              ? JSON.stringify(result.data)
              : `오류: ${result.error}`,
          });
        }
      }

      // ─── 스트리밍 최종 응답 ────────────────────────────────────────
      // finalResponse가 있으면 (도구 없이 바로 응답) 스트리밍으로 전송
      // 도구 호출 후에는 다시 스트리밍으로 최종 요약 응답 생성
      let fullText = "";
      const startTime = Date.now();

      if (finalResponse && toolCallResults.length === 0) {
        // 도구 없이 바로 텍스트 응답 → 청크 단위로 전송
        const words = finalResponse.content.split("");
        for (const char of words) {
          fullText += char;
          sendEvent("chunk", { text: char });
        }
        // 개발 요청 감지
        let devRequestSuggestion = null;
        const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            const p = JSON.parse(jsonMatch[1]);
            if (p.type === "dev_request") devRequestSuggestion = p;
          } catch { /* 무시 */ }
        }

        await db.insert(aiLogs).values({
          sessionId: input.sessionId,
          userId: user!.id,
          assistant: "master",
          role: "assistant",
          content: fullText,
          modelUsed: finalResponse.model,
          tokensIn: finalResponse.tokensIn,
          tokensOut: finalResponse.tokensOut,
          costUsd: String((finalResponse.costUsd || 0).toFixed(6)),
          grounded: false,
        });

        sendEvent("done", {
          model: finalResponse.model,
          tokensIn: finalResponse.tokensIn,
          tokensOut: finalResponse.tokensOut,
          costUsd: finalResponse.costUsd || 0,
          durationMs: Date.now() - startTime,
          devRequestSuggestion,
          toolsUsed: [],
        });
        res.end();
        return;
      }

      // 도구 결과를 바탕으로 스트리밍 최종 응답 생성
      await orchestratorChatStream(
        {
          messages: messages as any,
          complexity: intent.complexity === "high" ? "high" : intent.complexity === "low" ? "low" : "medium",
          assistant: "master",
          sessionId: input.sessionId,
          userId: user.id,
          systemPrompt: "", // 이미 messages에 포함
        },
        (chunk) => {
          fullText += chunk;
          sendEvent("chunk", { text: chunk });
        },
        async (meta) => {
          // 개발 요청 감지
          let devRequestSuggestion = null;
          if (intent.needsDevRequest) {
            const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
              try {
                const p = JSON.parse(jsonMatch[1]);
                if (p.type === "dev_request") devRequestSuggestion = p;
              } catch { /* 무시 */ }
            }
          }

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
            toolsUsed: toolCallResults.map((r) => ({
              name: r.tool,
              success: r.success,
              queryTime: r.queryTime,
            })),
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
