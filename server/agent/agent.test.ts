/**
 * OpenRouter 에이전트 단위 테스트
 * server/agent/agent.ts 핵심 기능 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAgent } from './agent.js';
import type { AgentTool } from './agent.js';

// OpenAI SDK 모킹
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  };
});

describe('createAgent', () => {
  it('에이전트 인스턴스를 생성한다', () => {
    const agent = createAgent({
      apiKey: 'test-key',
      model: 'openrouter/auto',
      instructions: '테스트 에이전트',
    });

    expect(agent).toBeDefined();
    expect(typeof agent.send).toBe('function');
    expect(typeof agent.sendSync).toBe('function');
    expect(typeof agent.getMessages).toBe('function');
    expect(typeof agent.clearHistory).toBe('function');
    expect(typeof agent.setInstructions).toBe('function');
  });

  it('초기 메시지 이력이 비어 있다', () => {
    const agent = createAgent({
      apiKey: 'test-key',
      model: 'openrouter/auto',
      instructions: '테스트',
    });

    expect(agent.getMessages()).toHaveLength(0);
  });

  it('clearHistory 호출 후 메시지 이력이 초기화된다', () => {
    const agent = createAgent({
      apiKey: 'test-key',
      model: 'openrouter/auto',
      instructions: '테스트',
    });

    // 직접 메시지 추가 불가이므로 clearHistory 호출 자체가 오류 없이 동작하는지 확인
    expect(() => agent.clearHistory()).not.toThrow();
    expect(agent.getMessages()).toHaveLength(0);
  });

  it('setInstructions 호출 시 오류가 없다', () => {
    const agent = createAgent({
      apiKey: 'test-key',
      model: 'openrouter/auto',
      instructions: '원래 지시사항',
    });

    expect(() => agent.setInstructions('새 지시사항')).not.toThrow();
  });
});

describe('AgentTool 도구 정의', () => {
  it('올바른 도구 구조를 가진다', () => {
    const { z } = require('zod');
    const tool: AgentTool = {
      name: 'test_tool',
      description: '테스트 도구',
      inputSchema: z.object({
        input: z.string().describe('입력값'),
      }),
      execute: async (args: Record<string, unknown>) => {
        return `결과: ${args.input}`;
      },
    };

    expect(tool.name).toBe('test_tool');
    expect(tool.description).toBe('테스트 도구');
    expect(tool.inputSchema).toBeDefined();
    expect(typeof tool.execute).toBe('function');
  });

  it('도구 execute 함수가 결과를 반환한다', async () => {
    const { z } = require('zod');
    const tool: AgentTool = {
      name: 'echo_tool',
      description: '에코 도구',
      inputSchema: z.object({
        message: z.string().describe('메시지'),
      }),
      execute: async (args: Record<string, unknown>) => {
        return String(args.message);
      },
    };

    const result = await tool.execute({ message: '안녕하세요' });
    expect(result).toBe('안녕하세요');
  });
});

describe('dogolfTools', () => {
  it('AI ERP 도구들이 올바르게 정의되어 있다', async () => {
    const { dogolfTools } = await import('./tools.js');

    expect(Array.isArray(dogolfTools)).toBe(true);
    expect(dogolfTools.length).toBeGreaterThan(0);

    // 각 도구가 필수 필드를 가지는지 확인
    for (const tool of dogolfTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined(); // Zod 스키마
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('get_current_time 도구가 현재 시간을 반환한다', async () => {
    const { dogolfTools } = await import('./tools.js');
    const timeTool = dogolfTools.find((t) => t.name === 'get_current_time');

    expect(timeTool).toBeDefined();
    const result = await timeTool!.execute({});
    // execute는 객체 또는 문자열을 반환할 수 있음
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;

    expect(parsed.time).toBeTruthy();
    expect(parsed.iso).toBeTruthy();
    expect(parsed.timezone).toBe('Asia/Seoul');
  });

  it('get_erp_guide 도구가 기능 안내를 반환한다', async () => {
    const { dogolfTools } = await import('./tools.js');
    const guideTool = dogolfTools.find((t) => t.name === 'get_erp_guide');

    expect(guideTool).toBeDefined();

    // 예약관리 안내 조회
    const result = await guideTool!.execute({ feature: '예약관리' });
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;

    expect(parsed.feature).toBe('예약관리');
    expect(parsed.path).toBeTruthy();
  });

  it('get_erp_guide 도구가 알 수 없는 기능에 대해 기본 안내를 반환한다', async () => {
    const { dogolfTools } = await import('./tools.js');
    const guideTool = dogolfTools.find((t) => t.name === 'get_erp_guide');

    const result = await guideTool!.execute({ feature: '존재하지않는기능' });
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;

    // 알 수 없는 기능은 전체 목록을 반환
    expect(parsed.features || parsed.path).toBeTruthy();
  });

  it('get_erp_guide 도구가 전체 기능 목록을 반환한다', async () => {
    const { dogolfTools } = await import('./tools.js');
    const guideTool = dogolfTools.find((t) => t.name === 'get_erp_guide');

    expect(guideTool).toBeDefined();
    // feature 없이 호출 시 전체 목록 반환
    const result = await guideTool!.execute({});
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;

    expect(parsed.features || parsed.message).toBeTruthy();
  });
});
