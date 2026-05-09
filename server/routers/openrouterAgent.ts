/**
 * 두골프 ERP OpenRouter 에이전트 tRPC 라우터
 * SKILL: https://openrouter.ai/skills/create-agent/SKILL.md
 *
 * 엔드포인트:
 *  - agent.chat      : 스트리밍 없이 응답 (protectedProcedure)
 *  - agent.clearHistory : 대화 이력 초기화
 *  - agent.getModels : 사용 가능한 OpenRouter 모델 목록 조회
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../_core/trpc.js';
import { ENV } from '../_core/env.js';
import { createAgent } from '../agent/agent.js';
import { dogolfTools } from '../agent/tools.js';
import { applyMessageSplit } from '../_core/messageSplitter.js';

// ─── 세션별 에이전트 관리 ─────────────────────────────────────────────────────
// 사용자 ID별로 에이전트 인스턴스를 메모리에 유지
const agentSessions = new Map<string, ReturnType<typeof createAgent>>();

function getOrCreateAgent(userId: string): ReturnType<typeof createAgent> {
  if (!agentSessions.has(userId)) {
    const apiKey = ENV.openrouterApiKey;
    if (!apiKey) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'OPENROUTER_API_KEY가 설정되지 않았습니다.',
      });
    }

    const agent = createAgent({
      apiKey,
      model: 'openrouter/auto',
      instructions: `당신은 두골프 ERP 전문 AI 어시스턴트입니다.
두골프는 국내외 골프투어 전문 여행사로, 태국/베트남/필리핀/한국/중국/일본 등 다양한 골프 패키지를 제공합니다.
ERP 시스템에서 예약관리, 재무관리, 상품관리, AI 기능 등을 담당합니다.
항상 한국어로 응답하며, 정확하고 친절하게 안내합니다.
사용자가 ERP 기능에 대해 질문하면 구체적인 경로와 사용법을 안내해 주세요.`,
      tools: dogolfTools,
      maxSteps: 5,
      temperature: 0.7,
    });

    agentSessions.set(userId, agent);
  }

  return agentSessions.get(userId)!;
}

// ─── 라우터 정의 ──────────────────────────────────────────────────────────────

export const openrouterAgentRouter = router({
  /**
   * 에이전트에게 메시지를 보내고 응답을 받습니다.
   */
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(4000),
        model: z.string().optional(), // 모델 오버라이드 (선택)
        clearHistory: z.boolean().optional(), // 전송 전 이력 초기화
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = String(ctx.user.id);
      const agent = getOrCreateAgent(userId);

      // 모델 오버라이드
      if (input.model) {
        agent.setInstructions(agent['config']?.instructions ?? '');
        // 새 에이전트 생성 (모델 변경)
        const apiKey = ENV.openrouterApiKey;
        if (!apiKey) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const newAgent = createAgent({
          apiKey,
          model: input.model,
          instructions: `당신은 두골프 ERP 전문 AI 어시스턴트입니다.
두골프는 국내외 골프투어 전문 여행사로, 태국/베트남/필리핀/한국/중국/일본 등 다양한 골프 패키지를 제공합니다.
항상 한국어로 응답하며, 정확하고 친절하게 안내합니다.`,
          tools: dogolfTools,
          maxSteps: 5,
        });
        agentSessions.set(userId, newAgent);
      }

      // 이력 초기화 요청
      if (input.clearHistory) {
        agentSessions.get(userId)?.clearHistory();
      }

      const currentAgent = agentSessions.get(userId)!;

      try {
        const response = await currentAgent.sendSync(input.message);
        
        // 메시지 길이 제한 자동 분할 처리
        const { response: splitResponse, attachments } = applyMessageSplit(
          { response },
          'response'
        );
        
        return {
          success: true,
          response: splitResponse.response,
          messageCount: currentAgent.getMessages().length,
          _isSplit: splitResponse._isSplit,
          _attachmentCount: splitResponse._attachmentCount,
          attachments,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `에이전트 오류: ${message}`,
        });
      }
    }),

  /**
   * 현재 사용자의 대화 이력을 반환합니다.
   */
  getHistory: protectedProcedure.query(({ ctx }) => {
    const userId = String(ctx.user.id);
    const agent = agentSessions.get(userId);
    if (!agent) return { messages: [] };
    return { messages: agent.getMessages() };
  }),

  /**
   * 현재 사용자의 대화 이력을 초기화합니다.
   */
  clearHistory: protectedProcedure.mutation(({ ctx }) => {
    const userId = String(ctx.user.id);
    const agent = agentSessions.get(userId);
    if (agent) {
      agent.clearHistory();
    }
    return { success: true };
  }),

  /**
   * OpenRouter에서 사용 가능한 모델 목록을 조회합니다.
   * (공개 API - 인증 불필요)
   */
  getModels: publicProcedure
    .input(
      z.object({
        author: z.string().optional(),
        minContext: z.number().optional(),
        maxPromptPrice: z.number().optional(),
        limit: z.number().optional().default(20),
      }).optional()
    )
    .query(async ({ input }) => {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/models');
        if (!res.ok) throw new Error(`OpenRouter API 오류: ${res.status}`);

        const data = (await res.json()) as {
          data: Array<{
            id: string;
            name: string;
            description?: string;
            context_length: number;
            pricing: { prompt: string; completion: string };
          }>;
        };

        let models = data.data;

        // 필터 적용
        if (input?.author) {
          models = models.filter((m) => m.id.startsWith(input.author! + '/'));
        }
        if (input?.minContext) {
          models = models.filter((m) => m.context_length >= input.minContext!);
        }
        if (input?.maxPromptPrice) {
          models = models.filter((m) => {
            const price = parseFloat(m.pricing.prompt);
            return price <= input.maxPromptPrice!;
          });
        }

        return {
          models: models.slice(0, input?.limit ?? 20),
          total: models.length,
        };
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `모델 목록 조회 실패: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  /**
   * 에이전트 상태 확인 (헬스체크)
   */
  status: publicProcedure.query(() => {
    const hasApiKey = !!ENV.openrouterApiKey;
    return {
      ready: hasApiKey,
      activeSessions: agentSessions.size,
      tools: dogolfTools.map((t) => ({ name: t.name, description: t.description })),
    };
  }),
});
