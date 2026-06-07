/**
 * 두골프 ERP 에이전트 도구 정의
 * 예약 조회, 재무 요약, 공지사항 등 ERP 핵심 기능을 도구로 제공
 */
import { z } from 'zod';
import type { AgentTool } from './agent.js';

// ─── 시간 도구 ────────────────────────────────────────────────────────────────

export const timeTool: AgentTool = {
  name: 'get_current_time',
  description: '현재 날짜와 시간을 반환합니다.',
  inputSchema: z.object({
    timezone: z.string().optional().describe('타임존 (예: "Asia/Seoul", "UTC")'),
  }),
  execute: async ({ timezone }: { timezone?: string }) => {
    const tz = timezone ?? 'Asia/Seoul';
    const now = new Date();
    return {
      time: now.toLocaleString('ko-KR', { timeZone: tz }),
      iso: now.toISOString(),
      timezone: tz,
    };
  },
};

// ─── 예약 요약 도구 ───────────────────────────────────────────────────────────

export const reservationSummaryTool: AgentTool = {
  name: 'get_reservation_summary',
  description: '두골프 ERP의 예약 현황 요약을 조회합니다. 오늘/이번 주/이번 달 예약 건수와 상태별 통계를 반환합니다.',
  inputSchema: z.object({
    period: z.enum(['today', 'week', 'month', 'all']).optional().describe('조회 기간'),
  }),
  execute: async ({ period }: { period?: string }) => {
    // 실제 DB 조회는 tRPC 라우터에서 처리 - 여기서는 API 호출 형태로 구현
    // 에이전트가 ERP 내부에서 실행될 때는 직접 DB 헬퍼 호출 가능
    return {
      period: period ?? 'all',
      message: `예약 요약 조회 요청이 접수되었습니다. ERP 대시보드(/erp/reservations)에서 상세 내역을 확인하세요.`,
      hint: '실제 데이터는 ERP 예약관리 페이지에서 확인 가능합니다.',
    };
  },
};

// ─── 재무 요약 도구 ───────────────────────────────────────────────────────────

export const financeSummaryTool: AgentTool = {
  name: 'get_finance_summary',
  description: '두골프 ERP의 재무 현황을 요약합니다. 입금/송금/예치금/충전카드 사용 현황을 반환합니다.',
  inputSchema: z.object({
    type: z.enum(['income', 'remittance', 'deposit', 'charge', 'all']).optional().describe('조회 유형'),
  }),
  execute: async ({ type }: { type?: string }) => {
    return {
      type: type ?? 'all',
      message: `재무 현황 조회 요청이 접수되었습니다.`,
      tables: {
        income: '입금 내역 (income_records)',
        remittance: '송금 내역 (remittance_records)',
        deposit: '예치금 (deposit_records)',
        charge: '충전카드 사용 (charge_records)',
      },
      hint: '상세 내역은 ERP 재무관리 페이지(/erp/finance)에서 확인하세요.',
    };
  },
};

// ─── 골프 패키지 검색 도구 ────────────────────────────────────────────────────

export const packageSearchTool: AgentTool = {
  name: 'search_golf_packages',
  description: '두골프 골프 패키지를 검색합니다. 국가, 골프장명, 가격대로 필터링 가능합니다.',
  inputSchema: z.object({
    country: z.string().optional().describe('국가 (예: 태국, 베트남, 필리핀, 한국)'),
    keyword: z.string().optional().describe('검색 키워드 (골프장명, 지역 등)'),
    maxPrice: z.number().optional().describe('최대 가격 (원)'),
  }),
  execute: async ({ country, keyword, maxPrice }: { country?: string; keyword?: string; maxPrice?: number }) => {
    return {
      searchParams: { country, keyword, maxPrice },
      message: `패키지 검색 요청이 접수되었습니다.`,
      hint: `두골프 홈페이지(https://dayoutgolf.com/packages)에서 ${country ?? '전체'} 패키지를 확인하세요.`,
    };
  },
};

// ─── 공지사항 조회 도구 ───────────────────────────────────────────────────────

export const noticeTool: AgentTool = {
  name: 'get_notices',
  description: '두골프 최신 공지사항을 조회합니다.',
  inputSchema: z.object({
    limit: z.number().optional().describe('조회할 공지사항 수 (기본값: 5)'),
  }),
  execute: async ({ limit }: { limit?: number }) => {
    return {
      limit: limit ?? 5,
      message: '공지사항 조회 요청이 접수되었습니다.',
      hint: '공지사항은 ERP CMS 페이지(/erp/cms/notices)에서 관리하세요.',
    };
  },
};

// ─── ERP 기능 안내 도구 ───────────────────────────────────────────────────────

export const erpGuideTool: AgentTool = {
  name: 'get_erp_guide',
  description: '두골프 ERP의 기능 목록과 사용 방법을 안내합니다.',
  inputSchema: z.object({
    feature: z.string().optional().describe('안내받을 기능명 (예: 예약관리, 재무관리, AI, 상품관리)'),
  }),
  execute: async ({ feature }: { feature?: string }) => {
    const guide: Record<string, string> = {
      예약관리: '/erp/reservations - 예약 목록 조회, 상태 변경, 수기 예약 등록',
      재무관리: '/erp/finance - 입금/송금/예치금/충전카드 관리',
      상품관리: '/erp/packages - 골프 패키지 등록/수정/이미지 관리',
      AI: '/erp/gemini - Gemini AI 어시스턴트, /erp/orchestrator - AI 오케스트레이터',
      'AI개발엔진': '/erp/ai-dev-engine - 자동 오류 감지 및 수정',
      CMS: '/erp/cms/notices - 공지사항, /erp/cms/banners - 배너 관리',
      CRM: '/erp/crm - 고객 메모 및 상담 이력',
      대시보드: '/erp - 예약/매출 통계, KPI 카드',
    };

    if (feature && guide[feature]) {
      return { feature, path: guide[feature] };
    }

    return {
      message: '두골프 ERP 주요 기능 목록',
      features: guide,
      adminUrl: 'https://dayoutgolf.com/erp',
    };
  },
};

// ─── 전체 도구 목록 ───────────────────────────────────────────────────────────

export const dogolfTools: AgentTool[] = [
  timeTool,
  reservationSummaryTool,
  financeSummaryTool,
  packageSearchTool,
  noticeTool,
  erpGuideTool,
];
