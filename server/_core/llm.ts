import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

// ============================================================
// 듀얼 폴백 구조 (서버 이전 대응)
//  1순위: 마누스 forge (BUILT_IN_FORGE) — 기존 방식 그대로
//  폴백 : OpenRouter (ERP DB 키 우선 → 환경변수) — 마누스 없이 자립
// 호출부(9개 라우터)의 invokeLLM 시그니처/반환 타입은 변경 없음
// ============================================================

const FORGE_DEFAULT_URL = "https://forge.manus.im/v1/chat/completions";
const OPENROUTER_DEFAULT_URL = "https://openrouter.ai/api/v1";

// forge 사용 가능 여부 (키 존재)
const isForgeAvailable = (): boolean => !!ENV.forgeApiKey;

const resolveForgeUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : FORGE_DEFAULT_URL;

// OpenRouter 키 조회: ERP DB(erpApiKeyManager) 우선 → 환경변수 폴백
async function resolveOpenRouterKey(): Promise<string> {
  try {
    const { getApiKey } = await import("../erpApiKeyManager");
    const dbKey = await getApiKey("openrouter");
    if (dbKey && dbKey.trim().length > 0) return dbKey.trim();
  } catch {
    // erpApiKeyManager 로드 실패 시 환경변수로 폴백
  }
  return (ENV.openrouterApiKey ?? "").trim();
}

const resolveOpenRouterUrl = () => {
  const base = (ENV.openrouterBaseUrl ?? OPENROUTER_DEFAULT_URL).replace(/\/$/, "");
  return `${base}/chat/completions`;
};

// forge용 모델 → OpenRouter 모델 매핑
const OPENROUTER_MODEL_FALLBACK = "google/gemini-2.5-flash";
const mapModelForOpenRouter = (forgeModel: string): string => {
  // 이미 provider/model 형식이면 그대로 사용
  if (forgeModel.includes("/")) return forgeModel;
  if (forgeModel.startsWith("gemini")) return `google/${forgeModel}`;
  return OPENROUTER_MODEL_FALLBACK;
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

// 공통 payload 구성 (forge / OpenRouter 공용)
function buildPayload(params: InvokeParams, model: string): Record<string, unknown> {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    model,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  return payload;
}

// 1순위: 마누스 forge 호출
async function invokeViaForge(params: InvokeParams): Promise<InvokeResult> {
  const payload = buildPayload(params, "gemini-2.5-flash");
  payload.max_tokens = 32768;
  payload.thinking = { budget_tokens: 128 };

  const response = await fetch(resolveForgeUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `forge LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}

// 폴백: OpenRouter 호출 (마누스 없이 자립)
async function invokeViaOpenRouter(params: InvokeParams): Promise<InvokeResult> {
  const apiKey = await resolveOpenRouterKey();
  if (!apiKey) {
    throw new Error("OpenRouter API 키가 없습니다 (ERP 설정 또는 OPENROUTER_API_KEY 필요)");
  }

  const payload = buildPayload(params, mapModelForOpenRouter("gemini-2.5-flash"));
  payload.max_tokens = params.maxTokens ?? params.max_tokens ?? 32768;

  const response = await fetch(resolveOpenRouterUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://dayoutgolf.com",
      "X-Title": "DOGOLF ERP",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}

/**
 * LLM 제공자 선호도 조회 (ERP DB 우선 → 기본 auto)
 *  - "auto"      : forge 우선 → OpenRouter 폴백 (기본, 기존 동작)
 *  - "openrouter": OpenRouter 우선 → forge 폴백 (서버 이전·자립 모드)
 *  - "forge"     : forge만 사용 (폴백 없음)
 */
async function resolveLlmPreference(): Promise<"auto" | "openrouter" | "forge"> {
  try {
    const { getApiKey } = await import("../erpApiKeyManager");
    const pref = (await getApiKey("llm_provider_preference")).trim().toLowerCase();
    if (pref === "openrouter" || pref === "forge" || pref === "auto") return pref;
  } catch {
    // 기본값으로 폴백
  }
  return "auto";
}

/**
 * invokeLLM — ERP 설정 기반 듀얼 폴백
 * 제공자 선호도(auto/openrouter/forge)를 ERP DB에서 읽어 1순위를 결정.
 * 호출부(9개 라우터)는 이 함수만 쓰므로 기존 코드 변경 불필요
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const preference = await resolveLlmPreference();

  // forge 전용 모드
  if (preference === "forge") {
    return await invokeViaForge(params);
  }

  // OpenRouter 우선 모드 (서버 이전·자립) → 실패 시 forge 폴백(가능한 경우)
  if (preference === "openrouter") {
    try {
      return await invokeViaOpenRouter(params);
    } catch (orErr) {
      if (isForgeAvailable()) {
        console.warn(
          `[invokeLLM] OpenRouter 실패, forge로 폴백: ${
            orErr instanceof Error ? orErr.message : String(orErr)
          }`
        );
        return await invokeViaForge(params);
      }
      throw orErr;
    }
  }

  // auto (기본): forge 우선 → OpenRouter 폴백
  if (isForgeAvailable()) {
    try {
      return await invokeViaForge(params);
    } catch (forgeErr) {
      console.warn(
        `[invokeLLM] forge 실패, OpenRouter로 폴백: ${
          forgeErr instanceof Error ? forgeErr.message : String(forgeErr)
        }`
      );
      return await invokeViaOpenRouter(params);
    }
  }

  // forge 키 없음 → 마누스 외부 서버로 간주, OpenRouter 자립 호출
  return await invokeViaOpenRouter(params);
}
