/**
 * 두골프 마스터 AI 스트리밍 엔드포인트
 * POST /api/master-stream
 * POST /api/master-stream-resume  (Human-in-the-Loop 승인 후 재개)
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
import { randomUUID } from "crypto";
import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { validateAdminSession } from "./_core/adminAuth";
import { getDb } from "./db";
import { aiLogs } from "../drizzle/schema";
import { orchestratorChatStream, orchestratorChat } from "./services/openrouter";
import { classifyIntent, fetchPackageContext, fetchReservationContext, compressHistory } from "./services/rag";
import { MASTER_SYSTEM_PROMPT } from "./services/prompts/master";
import { MASTER_TOOLS, executeTool, APPROVAL_REQUIRED_TOOLS, type ToolCallResult, type CallerContext } from "./services/masterTools";
import { publish } from "./services/realtimeEvents";
import { checkRequestForBlockedKeywords, logRejectedRequest, NO_CROSS_DESK_KNOWLEDGE_DIRECTIVE } from "./services/knowledgeFilter";
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
  // 개발 모드: manus(마누스 태스크 전송) | self(탈마누스 자립 Git 엔진)
  devMode: z.enum(["manus", "self"]).optional().default("manus"),
});

// ─── Tool Call 타입 ─────────────────────────────────────────────
interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

// ─── Human-in-the-Loop 승인 대기 임시 저장소 ─────────────────────
interface PendingApprovalEntry {
  approvalId: string;
  userId: number;
  sessionId: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_call_id?: string;
    tool_calls?: ToolCall[];
  }>;
  toolCalls: ToolCall[];
  pendingToolIndex: number;
  toolCallResults: ToolCallResult[];
  input: {
    message: string;
    sessionId: string;
    history: { role: "user" | "assistant"; content: string }[];
    fileContexts: { fileName: string; mimeType: string; extractedText: string; analysisResult?: string }[];
    devMode: "manus" | "self";
  };
  intent: ReturnType<typeof classifyIntent>;
  createdAt: number;
}

const pendingApprovals = new Map<string, PendingApprovalEntry>();

// 5분 후 만료 정리
setInterval(() => {
  const now = Date.now();
  const keys = Array.from(pendingApprovals.keys());
  for (const id of keys) {
    const entry = pendingApprovals.get(id);
    if (entry && now - entry.createdAt > 5 * 60 * 1000) pendingApprovals.delete(id);
  }
}, 60 * 1000);

// ─── 인증 헬퍼 ──────────────────────────────────────────────────
async function authenticateRequest(req: Request): Promise<number> {
  let userId = 0;
  const adminSessionId = (req as any).cookies?.admin_session;
  if (adminSessionId) {
    const adminSession = await validateAdminSession(adminSessionId);
    if (adminSession) userId = adminSession.adminId;
  }
  if (!userId) {
    try {
      const oauthUser = await sdk.authenticateRequest(req as any);
      if (oauthUser && oauthUser.role === "admin") userId = oauthUser.id;
    } catch { /* Manus OAuth 인증 실패 */ }
  }
  return userId;
}

// ─── 스트리밍 최종 응답 공통 함수 ────────────────────────────────
async function streamFinalResponse(opts: {
  res: Response;
  sendEvent: (event: string, data: unknown) => void;
  messages: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: ToolCall[] }>;
  intent: ReturnType<typeof classifyIntent>;
  input: { message: string; sessionId: string; history: { role: "user" | "assistant"; content: string }[]; fileContexts: { fileName: string; mimeType: string; extractedText: string; analysisResult?: string }[]; devMode: "manus" | "self" };
  userId: number;
  toolCallResults: ToolCallResult[];
  finalResponse: { content: string; model: string; tokensIn: number; tokensOut: number; costUsd: number; durationMs: number } | null;
}) {
  const { res, sendEvent, messages, intent, input, userId, toolCallResults, finalResponse } = opts;
  const db = await getDb();
  if (!db) {
    sendEvent("error", { message: "DB 연결 실패" });
    res.end();
    return;
  }

  let fullText = "";
  const startTime = Date.now();

  if (finalResponse && toolCallResults.length === 0) {
    // 도구 없이 바로 텍스트 응답 → 청크 단위로 전송
    for (const char of finalResponse.content.split("")) {
      fullText += char;
      sendEvent("chunk", { text: char });
    }
    let devRequestSuggestion = null;
    const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const p = JSON.parse(jsonMatch[1]);
        if (p.type === "dev_request") devRequestSuggestion = { ...p, originalRequest: input.message };
      } catch { /* 무시 */ }
    }
    await db.insert(aiLogs).values({
      sessionId: input.sessionId,
      userId,
      assistant: "master",
      role: "assistant",
      content: fullText,
      modelUsed: finalResponse.model,
      tokensIn: finalResponse.tokensIn,
      tokensOut: finalResponse.tokensOut,
      costUsd: String((finalResponse.costUsd || 0).toFixed(6)),
      grounded: false,
    });
    publish("ai_log_created", { sessionId: input.sessionId, assistant: "master", role: "assistant" });
    sendEvent("done", {
      model: finalResponse.model,
      tokensIn: finalResponse.tokensIn,
      tokensOut: finalResponse.tokensOut,
      costUsd: finalResponse.costUsd,
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
      userId,
      systemPrompt: "", // 이미 messages에 포함
    },
    (chunk) => {
      fullText += chunk;
      sendEvent("chunk", { text: chunk });
    },
    async (meta) => {
      let devRequestSuggestion = null;
      if (intent.needsDevRequest) {
        const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            const p = JSON.parse(jsonMatch[1]);
            if (p.type === "dev_request") devRequestSuggestion = { ...p, originalRequest: input.message };
          } catch { /* 무시 */ }
        }
      }
      await db.insert(aiLogs).values({
        sessionId: input.sessionId,
        userId,
        assistant: "master",
        role: "assistant",
        content: fullText,
        modelUsed: meta.model,
        tokensIn: meta.tokensIn,
        tokensOut: meta.tokensOut,
        costUsd: String(meta.costUsd.toFixed(6)),
        grounded: false,
      });
      publish("ai_log_created", { sessionId: input.sessionId, assistant: "master", role: "assistant" });
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
}

// ─── Tool Calling 루프 공통 함수 ─────────────────────────────────
async function runToolCallingLoop(opts: {
  res: Response;
  sendEvent: (event: string, data: unknown) => void;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_call_id?: string;
    tool_calls?: ToolCall[];
  }>;
  intent: ReturnType<typeof classifyIntent>;
  input: { message: string; sessionId: string; history: { role: "user" | "assistant"; content: string }[]; fileContexts: { fileName: string; mimeType: string; extractedText: string; analysisResult?: string }[]; devMode: "manus" | "self" };
  user: { id: number; role: "admin"; transactionId: string };
  toolCallResults: ToolCallResult[];
  startToolRound?: number;
  startToolIndex?: number; // resume 시 시작할 도구 인덱스
}): Promise<void> {
  const { res, sendEvent, intent, input, user } = opts;
  const messages = opts.messages;
  const toolCallResults = opts.toolCallResults;
  const MAX_TOOL_ROUNDS = 5;
  let toolRound = opts.startToolRound ?? 0;
  let finalResponse: { content: string; model: string; tokensIn: number; tokensOut: number; costUsd: number; durationMs: number } | null = null;

  while (toolRound < MAX_TOOL_ROUNDS) {
    toolRound++;

    const toolResponse = await orchestratorChat({
      messages: messages as any,
      complexity: intent.complexity === "high" ? "high" : intent.complexity === "low" ? "low" : "medium",
      assistant: "master",
      sessionId: input.sessionId,
      userId: user.id,
      systemPrompt: "",
      tools: MASTER_TOOLS as any,
      tool_choice: "auto",
    });

    const toolCalls: ToolCall[] = (toolResponse.tool_calls || []) as ToolCall[];
    if (toolCalls.length === 0) {
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

    messages.push({ role: "assistant", content: toolResponse.text || "", tool_calls: toolCalls });

    for (const tc of toolCalls) {
      sendEvent("tool_start", { name: tc.function.name, id: tc.id });

      let toolArgs: Record<string, unknown> = {};
      try {
        toolArgs = JSON.parse(tc.function.arguments || "{}");
      } catch { /* 무시 */ }

      // 승인 필요 도구 감지 (Human-in-the-Loop) — 승인 전 스트림 중단
      if (APPROVAL_REQUIRED_TOOLS.includes(tc.function.name)) {
        const approvalId = randomUUID();
        pendingApprovals.set(approvalId, {
          approvalId,
          userId: user.id,
          sessionId: input.sessionId,
          messages: [...messages],
          toolCalls,
          pendingToolIndex: toolCalls.indexOf(tc),
          toolCallResults: [...toolCallResults],
          input,
          intent,
          createdAt: Date.now(),
        });
        sendEvent("approval_request", {
          id: approvalId,
          toolName: tc.function.name,
          toolArgs,
          message: `외부 연동 도구 '${tc.function.name}'을 실행하려 합니다. 인수: ${JSON.stringify(toolArgs)}`,
        });
        sendEvent("done", {
          model: "pending_approval",
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
          durationMs: 0,
          devRequestSuggestion: null,
          toolsUsed: [],
          pendingApprovalId: approvalId,
        });
        res.end();
        return; // 스트림 중단 — 승인 후 /api/master-stream-resume으로 재개
      }

      const callerCtx: CallerContext = {
        userId: user.id,
        role: user.role,
        transactionId: user.transactionId,
      };
      const result = await executeTool(tc.function.name, toolArgs, callerCtx);
      toolCallResults.push(result);

      sendEvent("tool_done", {
        name: tc.function.name,
        id: tc.id,
        success: result.success,
        queryTime: result.queryTime,
        error: result.error,
      });

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result.success ? JSON.stringify(result.data) : `오류: ${result.error}`,
      });
    }
  }

  await streamFinalResponse({
    res,
    sendEvent,
    messages,
    intent,
    input,
    userId: user.id,
    toolCallResults,
    finalResponse,
  });
}

export function registerMasterStreamRoute(app: Express) {
  // ─── POST /api/master-stream ────────────────────────────────────
  app.post("/api/master-stream", async (req: Request, res: Response) => {
    // 1. 인증 확인
    const userId = await authenticateRequest(req);
    if (!userId) {
      res.status(401).json({ error: "인증이 필요합니다." });
      return;
    }

    const transactionId =
      (req.headers["x-transaction-id"] as string | undefined) || randomUUID();
    const user = { id: userId, role: "admin" as const, transactionId };

    // 2. 입력 검증
    const parsed = inputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "잘못된 입력입니다.", details: parsed.error.issues });
      return;
    }
    const input = parsed.data;

    // 2-1. 타 데스크 지식 차단 키워드 거절 검사
    const rejection = await checkRequestForBlockedKeywords(input.message);
    if (rejection.rejected) {
      await logRejectedRequest(rejection, { sessionId: input.sessionId, source: "master-stream" });
      try {
        const dbForLog = await getDb();
        if (dbForLog) {
          await dbForLog.insert(aiLogs).values([
            { sessionId: input.sessionId, userId, assistant: "master", role: "user", content: input.message, modelUsed: "", tokensIn: 0, tokensOut: 0, costUsd: "0", grounded: false },
            { sessionId: input.sessionId, userId, assistant: "master", role: "assistant", content: rejection.rejectionMessage, modelUsed: "knowledge-filter", tokensIn: 0, tokensOut: 0, costUsd: "0", grounded: false },
          ]);
        }
      } catch { /* 로그 실패 무시 */ }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.setHeader("X-Transaction-ID", transactionId);
      res.flushHeaders();
      res.write(`event: chunk\ndata: ${JSON.stringify({ text: rejection.rejectionMessage })}\n\n`);
      res.write(`event: done\ndata: ${JSON.stringify({ model: "knowledge-filter", tokensIn: 0, tokensOut: 0, costUsd: 0, durationMs: 0, devRequestSuggestion: null, toolsUsed: [], rejected: true, matchedKeywords: rejection.matchedKeywords })}\n\n`);
      res.end();
      return;
    }

    // 3. SSE 헤더 설정
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("X-Transaction-ID", transactionId);
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
      const devModeGuide =
        input.devMode === "self"
          ? `\n\n[개발 모드: 탈마누스 자립 개발]\n현재 마스터는 "탈마누스 자립 개발" 모드를 선택했습니다. 개발 요청이 감지되면 Manus 태스크 전송이 아닌, 서버 내장 Git 엔진(Changeset → dev-1 → dev-2-integration → main)을 통한 자립 개발 파이프라인을 기준으로 안내하세요. "Manus"라는 표현 대신 "자립 개발 엔진"으로 안내합니다.`
          : `\n\n[개발 모드: 마누스 개발]\n현재 마스터는 "마누스 개발" 모드를 선택했습니다. 개발 요청이 감지되면 기존처럼 Manus 태스크로 전송하는 흐름으로 안내하세요.`;

      const systemWithMode = MASTER_SYSTEM_PROMPT + devModeGuide + "\n\n" + NO_CROSS_DESK_KNOWLEDGE_DIRECTIVE;
      const systemWithContext =
        contextParts.length > 0
          ? `${systemWithMode}\n\n[현재 컨텍스트]\n${contextParts.join("\n\n")}`
          : systemWithMode;

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

      // 8. 메시지 배열 구성
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

      // 9. Tool Calling 루프 실행
      await runToolCallingLoop({
        res,
        sendEvent,
        messages,
        intent,
        input,
        user,
        toolCallResults: [],
      });
    } catch (err) {
      console.error("[master-stream] 예외:", err);
      const sendEventSafe = (event: string, data: unknown) => {
        try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* 무시 */ }
      };
      sendEventSafe("error", { message: "서버 오류가 발생했습니다." });
      res.end();
    }
  });

  // ─── POST /api/master-stream-resume ────────────────────────────
  // Human-in-the-Loop: 승인 후 중단된 스트림 재개
  app.post("/api/master-stream-resume", async (req: Request, res: Response) => {
    // 1. 인증 확인
    const userId = await authenticateRequest(req);
    if (!userId) {
      res.status(401).json({ error: "인증이 필요합니다." });
      return;
    }

    const { approvalId } = req.body as { approvalId?: string };
    if (!approvalId) {
      res.status(400).json({ error: "approvalId가 필요합니다." });
      return;
    }

    const entry = pendingApprovals.get(approvalId);
    if (!entry) {
      res.status(404).json({ error: "승인 요청을 찾을 수 없거나 만료되었습니다." });
      return;
    }

    // 소유자 확인
    if (entry.userId !== userId) {
      res.status(403).json({ error: "권한이 없습니다." });
      return;
    }

    // 사용 후 즉시 삭제 (1회용)
    pendingApprovals.delete(approvalId);

    const transactionId =
      (req.headers["x-transaction-id"] as string | undefined) || randomUUID();
    const user = { id: userId, role: "admin" as const, transactionId };

    // SSE 헤더 설정
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("X-Transaction-ID", transactionId);
    res.flushHeaders();

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // 승인된 도구 실행
      const { messages, toolCalls, pendingToolIndex, toolCallResults, input, intent } = entry;
      const tc = toolCalls[pendingToolIndex];

      sendEvent("tool_start", { name: tc.function.name, id: tc.id });

      let toolArgs: Record<string, unknown> = {};
      try {
        toolArgs = JSON.parse(tc.function.arguments || "{}");
      } catch { /* 무시 */ }

      const callerCtx: CallerContext = {
        userId: user.id,
        role: user.role,
        transactionId: user.transactionId,
      };
      const result = await executeTool(tc.function.name, toolArgs, callerCtx);
      toolCallResults.push(result);

      sendEvent("tool_done", {
        name: tc.function.name,
        id: tc.id,
        success: result.success,
        queryTime: result.queryTime,
        error: result.error,
      });

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result.success ? JSON.stringify(result.data) : `오류: ${result.error}`,
      });

      // 나머지 도구들 처리 (pendingToolIndex 이후)
      for (let i = pendingToolIndex + 1; i < toolCalls.length; i++) {
        const nextTc = toolCalls[i];
        sendEvent("tool_start", { name: nextTc.function.name, id: nextTc.id });

        let nextArgs: Record<string, unknown> = {};
        try { nextArgs = JSON.parse(nextTc.function.arguments || "{}"); } catch { /* 무시 */ }

        // 나머지 도구 중에도 승인 필요한 것이 있으면 다시 중단
        if (APPROVAL_REQUIRED_TOOLS.includes(nextTc.function.name)) {
          const newApprovalId = randomUUID();
          pendingApprovals.set(newApprovalId, {
            approvalId: newApprovalId,
            userId: user.id,
            sessionId: input.sessionId,
            messages: [...messages],
            toolCalls,
            pendingToolIndex: i,
            toolCallResults: [...toolCallResults],
            input,
            intent,
            createdAt: Date.now(),
          });
          sendEvent("approval_request", {
            id: newApprovalId,
            toolName: nextTc.function.name,
            toolArgs: nextArgs,
            message: `외부 연동 도구 '${nextTc.function.name}'을 실행하려 합니다. 인수: ${JSON.stringify(nextArgs)}`,
          });
          sendEvent("done", {
            model: "pending_approval",
            tokensIn: 0,
            tokensOut: 0,
            costUsd: 0,
            durationMs: 0,
            devRequestSuggestion: null,
            toolsUsed: [],
            pendingApprovalId: newApprovalId,
          });
          res.end();
          return;
        }

        const nextResult = await executeTool(nextTc.function.name, nextArgs, callerCtx);
        toolCallResults.push(nextResult);

        sendEvent("tool_done", {
          name: nextTc.function.name,
          id: nextTc.id,
          success: nextResult.success,
          queryTime: nextResult.queryTime,
          error: nextResult.error,
        });

        messages.push({
          role: "tool",
          tool_call_id: nextTc.id,
          content: nextResult.success ? JSON.stringify(nextResult.data) : `오류: ${nextResult.error}`,
        });
      }

      // 남은 Tool Calling 루프 계속 실행
      await runToolCallingLoop({
        res,
        sendEvent,
        messages,
        intent,
        input,
        user,
        toolCallResults,
        startToolRound: 1, // 이미 1라운드 진행됨
      });
    } catch (err) {
      console.error("[master-stream-resume] 예외:", err);
      try { res.write(`event: error\ndata: ${JSON.stringify({ message: "서버 오류가 발생했습니다." })}\n\n`); } catch { /* 무시 */ }
      res.end();
    }
  });
}
