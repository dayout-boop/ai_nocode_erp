/**
 * 두골프 ERP OpenRouter 에이전트 코어
 * SKILL: https://openrouter.ai/skills/create-agent/SKILL.md
 *
 * 모듈형 AI 에이전트 - 독립 실행 가능하며 훅(hooks)으로 확장 가능
 */
import OpenAI from 'openai';
import { EventEmitter } from 'eventemitter3';
import { z } from 'zod';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AgentTool<TInput = any, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  execute: (input: TInput) => Promise<TOutput>;
}

export interface AgentEvents {
  'message:user': (message: Message) => void;
  'message:assistant': (message: Message) => void;
  'stream:start': () => void;
  'stream:delta': (delta: string, accumulated: string) => void;
  'stream:end': (fullText: string) => void;
  'tool:call': (name: string, args: unknown) => void;
  'tool:result': (name: string, result: unknown) => void;
  'error': (error: Error) => void;
  'thinking:start': () => void;
  'thinking:end': () => void;
}

export interface AgentConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  instructions?: string;
  tools?: AgentTool[];
  maxSteps?: number;
  temperature?: number;
}

// ─── OpenAI 호환 함수 스키마 변환 ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodToJsonSchema(schema: any): Record<string, unknown> {
  if (!schema || !schema._def) return { type: 'string' };

  const typeName: string = schema._def.typeName ?? schema._def.type ?? '';

  if (typeName === 'ZodObject' || typeName === 'object') {
    const shape = schema.shape ?? schema._def.shape?.() ?? {};
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      const vDef = (value as any)?._def;
      const vType = vDef?.typeName ?? vDef?.type ?? '';
      if (vType !== 'ZodOptional' && vType !== 'optional') {
        required.push(key);
      }
    }

    return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) };
  }

  if (typeName === 'ZodOptional' || typeName === 'optional') {
    return zodToJsonSchema(schema._def.innerType ?? schema.unwrap?.());
  }

  if (typeName === 'ZodString' || typeName === 'string') {
    const result: Record<string, unknown> = { type: 'string' };
    if (schema._def.description) result.description = schema._def.description;
    return result;
  }

  if (typeName === 'ZodNumber' || typeName === 'number') {
    return { type: 'number' };
  }

  if (typeName === 'ZodBoolean' || typeName === 'boolean') {
    return { type: 'boolean' };
  }

  if (typeName === 'ZodArray' || typeName === 'array') {
    return { type: 'array', items: zodToJsonSchema(schema._def.type ?? schema.element) };
  }

  if (typeName === 'ZodEnum' || typeName === 'enum') {
    return { type: 'string', enum: schema._def.values ?? schema.options };
  }

  return { type: 'string' };
}

// ─── Agent 클래스 ─────────────────────────────────────────────────────────────

export class Agent extends EventEmitter<AgentEvents> {
  private client: OpenAI;
  private messages: Message[] = [];
  private config: Required<Omit<AgentConfig, 'apiKey' | 'baseURL'>> & {
    apiKey: string;
    baseURL: string;
  };
  private toolMap = new Map<string, AgentTool>();

  constructor(config: AgentConfig) {
    super();

    const baseURL = config.baseURL ?? 'https://openrouter.ai/api/v1';
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL,
      defaultHeaders: {
        'HTTP-Referer': 'https://dogolf-tour-dkz3fsmp.manus.space',
        'X-Title': 'Dogolf ERP Agent',
      },
    });

    this.config = {
      apiKey: config.apiKey,
      baseURL,
      model: config.model ?? 'openrouter/auto',
      instructions: config.instructions ?? '당신은 두골프 ERP 전문 AI 어시스턴트입니다.',
      tools: config.tools ?? [],
      maxSteps: config.maxSteps ?? 5,
      temperature: config.temperature ?? 0.7,
    };

    // 도구 맵 초기화
    for (const t of this.config.tools) {
      this.toolMap.set(t.name, t);
    }
  }

  // ─── 공개 메서드 ─────────────────────────────────────────────────────────────

  getMessages(): Message[] {
    return [...this.messages];
  }

  clearHistory(): void {
    this.messages = [];
  }

  setInstructions(instructions: string): void {
    this.config.instructions = instructions;
  }

  addTool(newTool: AgentTool): void {
    this.config.tools.push(newTool);
    this.toolMap.set(newTool.name, newTool);
  }

  // 스트리밍 응답
  async send(content: string): Promise<string> {
    const userMessage: Message = { role: 'user', content };
    this.messages.push(userMessage);
    this.emit('message:user', userMessage);
    this.emit('thinking:start');

    try {
      const fullText = await this._runAgentLoop(content);
      return fullText;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', error);
      throw error;
    } finally {
      this.emit('thinking:end');
    }
  }

  // 비스트리밍 응답 (프로그래밍 방식)
  async sendSync(content: string): Promise<string> {
    return this.send(content);
  }

  // ─── 내부 에이전트 루프 ───────────────────────────────────────────────────────

  private async _runAgentLoop(_initialContent: string): Promise<string> {
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.config.instructions },
      ...this.messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    const tools: OpenAI.Chat.ChatCompletionTool[] = this.config.tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: zodToJsonSchema(t.inputSchema),
      },
    }));

    let steps = 0;
    let fullText = '';

    while (steps < this.config.maxSteps) {
      steps++;

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: openaiMessages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        temperature: this.config.temperature,
        stream: true,
      });

      this.emit('stream:start');
      let accumulated = '';
      const toolCallsMap = new Map<number, { id: string; name: string; args: string }>();
      let finishReason = '';

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta;
        const reason = chunk.choices[0]?.finish_reason;
        if (reason) finishReason = reason;

        // 텍스트 델타
        if (delta?.content) {
          accumulated += delta.content;
          this.emit('stream:delta', delta.content, accumulated);
        }

        // 도구 호출 델타 누적
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallsMap.has(idx)) {
              toolCallsMap.set(idx, { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' });
            }
            const entry = toolCallsMap.get(idx)!;
            if (tc.id) entry.id = tc.id;
            if (tc.function?.name) entry.name = tc.function.name;
            if (tc.function?.arguments) entry.args += tc.function.arguments;
          }
        }
      }

      if (accumulated) {
        fullText = accumulated;
        this.emit('stream:end', fullText);
      }

      // 도구 호출 처리
      if (finishReason === 'tool_calls' && toolCallsMap.size > 0) {
        const toolCallsList = Array.from(toolCallsMap.values());

        // assistant 메시지에 tool_calls 추가
        openaiMessages.push({
          role: 'assistant',
          content: accumulated || null,
          tool_calls: toolCallsList.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.args },
          })),
        });

        // 각 도구 실행
        for (const tc of toolCallsList) {
          this.emit('tool:call', tc.name, tc.args);

          let toolResult: unknown;
          try {
            const tool = this.toolMap.get(tc.name);
            if (!tool) {
              toolResult = { error: `도구 '${tc.name}'을(를) 찾을 수 없습니다.` };
            } else {
              const parsedArgs = JSON.parse(tc.args || '{}');
              const validatedArgs = tool.inputSchema.parse(parsedArgs);
              toolResult = await tool.execute(validatedArgs);
            }
          } catch (e) {
            toolResult = { error: String(e) };
          }

          this.emit('tool:result', tc.name, toolResult);

          openaiMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(toolResult),
          });
        }

        // 루프 계속
        continue;
      }

      // 일반 응답 완료
      break;
    }

    const assistantMessage: Message = { role: 'assistant', content: fullText };
    this.messages.push(assistantMessage);
    this.emit('message:assistant', assistantMessage);

    return fullText;
  }
}

// 팩토리 함수
export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
}
