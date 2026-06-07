/**
 * 두골프 AI 오케스트레이션 서비스
 *
 * 모델 라우팅:
 *  high   → google/gemini-2.5-pro-preview (추론·분석·오류검수)
 *  medium → google/gemini-2.5-flash       (생성·요약·상담)
 *  low    → google/gemini-2.5-flash-lite  (분류·태깅·단순응답)
 *
 * Tool Calling 지원 (두골프 마스터 전용)
 */
import { ENV } from "../_core/env";

const OPENROUTER_BASE_URL = ENV.openrouterBaseUrl ?? "https://openrouter.ai/api/v1";
const MAX_RETRIES = 2;
const TIMEOUT_MS = 120_000; // 2분 (Gemini 2.5 Pro 긴 응답 대기)

// 복잡도별 모델 매핑
const MODEL_MAP: Record<"high" | "medium" | "low", { id: string; name: string; inputPrice: number; outputPrice: number }> = {
  high: {
    id: "google/gemini-2.5-pro-preview-05-06",
    name: "Gemini 2.5 Pro Preview",
    inputPrice: 1.25,
    outputPrice: 10.0,
  },
  medium: {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    inputPrice: 0.15,
    outputPrice: 0.6,
  },
  low: {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    inputPrice: 0.10,
    outputPrice: 0.40,
  },
};

// 폴백 모델 (medium으로 강등)
const FALLBACK_MODEL = MODEL_MAP.medium;

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatOptions {
  messages: ChatMessage[];
  complexity: "high" | "medium" | "low";
  assistant: "master" | "golftalk" | "manager";
  sessionId: string;
  userId?: number;
  /** 분양 테넌트 ID (두골프 자체 사용 시 undefined) */
  tenantId?: number;
  systemPrompt?: string;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  // Tool Calling 지원
  tools?: ToolDefinition[];
  tool_choice?: "auto" | "none" | "required";
}

export interface ChatResult {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  durationMs: number;
  // Tool Calling 결과
  tool_calls?: ToolCall[];
  finish_reason?: string;
}

/**
 * 모델 라우팅 함수 (정적 기본값)
 */
export function routeModel(complexity: "high" | "medium" | "low") {
  return MODEL_MAP[complexity];
}

/**
 * DB 기반 동적 모델 라우팅
 * DB에 설정된 모델이 있으면 해당 모델을, 없으면 기본값을 반환
 */
export async function routeModelFromDb(
  complexity: "high" | "medium" | "low"
): Promise<{ id: string; name: string; inputPrice: number; outputPrice: number }> {
  try {
    const { getModelRuleFromDb } = await import("../routers/modelRouting");
    const rule = await getModelRuleFromDb(complexity);
    return {
      id: rule.modelId,
      name: rule.modelName,
      inputPrice: rule.inputPrice,
      outputPrice: rule.outputPrice,
    };
  } catch {
    const m = MODEL_MAP[complexity];
    return { id: m.id, name: m.name, inputPrice: m.inputPrice, outputPrice: m.outputPrice };
  }
}

/**
 * 비용 계산
 */
function calculateCost(
  model: { inputPrice: number; outputPrice: number },
  tokensIn: number,
  tokensOut: number
): number {
  return (tokensIn * model.inputPrice + tokensOut * model.outputPrice) / 1_000_000;
}

/**
 * OpenRouter API 단일 호출 (재시도 포함)
 */
async function callOpenRouterRaw(
  modelId: string,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  options: {
    maxTokens?: number;
    temperature?: number;
    tools?: ToolDefinition[];
    tool_choice?: "auto" | "none" | "required";
  }
): Promise<{ text: string; tokensIn: number; tokensOut: number; model: string; tool_calls?: ToolCall[]; finish_reason?: string }> {
  const apiKey = ENV.openrouterApiKey;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY가 설정되지 않았습니다.");

  // 메시지 배열 구성 (Tool Calling 메시지 포함)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fullMessages: Array<any> = [];

  if (systemPrompt) {
    fullMessages.push({
      role: "system",
      content: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" }, // Prompt Caching
        },
      ],
    });
  }

  for (const msg of messages) {
    if (msg.role === "tool") {
      // Tool 결과 메시지
      fullMessages.push({
        role: "tool",
        tool_call_id: msg.tool_call_id,
        content: msg.content,
      });
    } else if (msg.tool_calls && msg.tool_calls.length > 0) {
      // Tool 호출을 포함한 어시스턴트 메시지
      fullMessages.push({
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.tool_calls,
      });
    } else {
      fullMessages.push({ role: msg.role, content: msg.content });
    }
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const bodyObj: Record<string, unknown> = {
        model: modelId,
        messages: fullMessages,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.7,
      };
      if (options.tools && options.tools.length > 0) {
        bodyObj.tools = options.tools;
        bodyObj.tool_choice = options.tool_choice ?? "auto";
      }

      const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://dayoutgolf.com",
          "X-Title": "DOGOLF Master AI",
        },
        body: JSON.stringify(bodyObj),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        const isRetryable = res.status === 503 || res.status === 429 || res.status === 500;
        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = (attempt + 1) * 1500;
          console.warn(`[OpenRouter] ${modelId} ${res.status} 에러 - ${delay}ms 후 재시도 (${attempt + 1}/${MAX_RETRIES})`);
          await new Promise((r) => setTimeout(r, delay));
          lastError = new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
          continue;
        }
        throw new Error(`OpenRouter API 오류 [${res.status}]: ${errBody.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        choices: Array<{
          message: {
            content: string | null;
            tool_calls?: ToolCall[];
          };
          finish_reason?: string;
        }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
        model?: string;
      };

      return {
        text: data.choices[0]?.message?.content ?? "",
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0,
        model: data.model ?? modelId,
        tool_calls: data.choices[0]?.message?.tool_calls,
        finish_reason: data.choices[0]?.finish_reason,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const isRetryable = isAbort || (err instanceof Error && err.message.includes("503"));
      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 1500;
        console.warn(`[OpenRouter] ${modelId} ${isAbort ? "타임아웃" : "네트워크 오류"} - ${delay}ms 후 재시도`);
        await new Promise((r) => setTimeout(r, delay));
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error("OpenRouter 호출 실패");
}

/**
 * AI 어시스턴트 채팅 (비스트리밍, Tool Calling 지원)
 */
export async function orchestratorChat(options: ChatOptions): Promise<ChatResult> {
  const startTime = Date.now();
  const modelConfig = MODEL_MAP[options.complexity];

  try {
    const raw = await callOpenRouterRaw(modelConfig.id, options.messages, options.systemPrompt, {
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      tools: options.tools,
      tool_choice: options.tool_choice,
    });

    const costUsd = calculateCost(modelConfig, raw.tokensIn, raw.tokensOut);

    return {
      text: raw.text,
      model: raw.model,
      tokensIn: raw.tokensIn,
      tokensOut: raw.tokensOut,
      costUsd,
      durationMs: Date.now() - startTime,
      tool_calls: raw.tool_calls,
      finish_reason: raw.finish_reason,
    };
  } catch (err) {
    // 503 등 재시도 후에도 실패 시 medium 모델로 폴백
    console.warn(`[OpenRouter] ${modelConfig.id} 실패, ${FALLBACK_MODEL.id}로 폴백`);
    try {
      const raw = await callOpenRouterRaw(FALLBACK_MODEL.id, options.messages, options.systemPrompt, {
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        tools: options.tools,
        tool_choice: options.tool_choice,
      });
      const costUsd = calculateCost(FALLBACK_MODEL, raw.tokensIn, raw.tokensOut);
      return {
        text: raw.text,
        model: raw.model,
        tokensIn: raw.tokensIn,
        tokensOut: raw.tokensOut,
        costUsd,
        durationMs: Date.now() - startTime,
        tool_calls: raw.tool_calls,
        finish_reason: raw.finish_reason,
      };
    } catch (fallbackErr) {
      throw fallbackErr;
    }
  }
}

/**
 * 연결 테스트 (시스템 설정 탭용)
 */
export async function testConnection(): Promise<{ ok: boolean; model: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const result = await callOpenRouterRaw(
      MODEL_MAP.low.id,
      [{ role: "user", content: "ping" }],
      undefined,
      { maxTokens: 10 }
    );
    return { ok: true, model: result.model, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, model: "", latencyMs: Date.now() - start };
  }
}

/**
 * 스트리밍 AI 채팅 (SSE 엔드포인트용)
 * onChunk: 텍스트 청크 실시간 콜백
 * onDone: 완료 시 메타데이터 콜백
 * onError: 오류 콜백
 */
export async function orchestratorChatStream(
  options: ChatOptions,
  onChunk: (chunk: string) => void,
  onDone: (result: { model: string; tokensIn: number; tokensOut: number; costUsd: number; durationMs: number }) => void,
  onError: (err: Error) => void
): Promise<void> {
  const startTime = Date.now();
  const modelConfig = MODEL_MAP[options.complexity];
  const apiKey = ENV.openrouterApiKey;
  if (!apiKey) {
    onError(new Error("OPENROUTER_API_KEY가 설정되지 않았습니다."));
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fullMessages: Array<any> = [];
  if (options.systemPrompt) {
    fullMessages.push({
      role: "system",
      content: [{ type: "text", text: options.systemPrompt, cache_control: { type: "ephemeral" } }],
    });
  }
  for (const msg of options.messages) {
    if (msg.role === "tool") {
      fullMessages.push({ role: "tool", tool_call_id: msg.tool_call_id, content: msg.content });
    } else if (msg.tool_calls && msg.tool_calls.length > 0) {
      fullMessages.push({ role: "assistant", content: msg.content || null, tool_calls: msg.tool_calls });
    } else {
      fullMessages.push({ role: msg.role, content: msg.content });
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
          "HTTP-Referer": "https://dayoutgolf.com",
        "X-Title": "DOGOLF Master AI",
      },
      body: JSON.stringify({
        model: modelConfig.id,
        messages: fullMessages,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
        stream: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok || !res.body) {
      const errBody = await res.text().catch(() => "");
      onError(new Error(`OpenRouter API 오류 [${res.status}]: ${errBody.slice(0, 300)}`));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let tokensIn = 0;
    let tokensOut = 0;
    let modelUsed = modelConfig.id;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
            usage?: { prompt_tokens: number; completion_tokens: number };
            model?: string;
          };
          if (parsed.model) modelUsed = parsed.model;
          if (parsed.usage) {
            tokensIn = parsed.usage.prompt_tokens;
            tokensOut = parsed.usage.completion_tokens;
          }
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch {
          // JSON 파싱 실패 무시
        }
      }
    }

    const costUsd = calculateCost(modelConfig, tokensIn, tokensOut);
    onDone({ model: modelUsed, tokensIn, tokensOut, costUsd, durationMs: Date.now() - startTime });
  } catch (err) {
    clearTimeout(timer);
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export { MODEL_MAP };
