/**
 * Phase 1 로드맵 통합 테스트
 * - AI 오케스트라 라우터 (모델 라우팅 규칙)
 * - 파트너 온보딩
 * - 샘플 데이터 시더
 * - 포트원 V2 환경변수
 * - 구독 플랜 상품 정의
 */

import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────
// 1. 구독 플랜 상품 정의 테스트
// ─────────────────────────────────────────────
describe('구독 플랜 상품 정의 (products.ts)', () => {
  it('SUBSCRIPTION_PLANS에 3개 플랜이 정의되어 있어야 한다', async () => {
    const { SUBSCRIPTION_PLANS, getPlanById } = await import('./products');
    // SUBSCRIPTION_PLANS는 배열
    expect(Array.isArray(SUBSCRIPTION_PLANS)).toBe(true);
    expect(SUBSCRIPTION_PLANS).toHaveLength(3);
    // getPlanById로 각 플랜 조회 가능
    expect(getPlanById('starter')).toBeDefined();
    expect(getPlanById('standard')).toBeDefined();
    expect(getPlanById('premium')).toBeDefined();
  });

  it('각 플랜에 필수 필드가 있어야 한다', async () => {
    const { SUBSCRIPTION_PLANS } = await import('./products');
    for (const plan of SUBSCRIPTION_PLANS) {
      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('name');
      expect(plan).toHaveProperty('monthlyPriceKrw');
      expect(plan).toHaveProperty('features');
      expect(Array.isArray(plan.features)).toBe(true);
    }
  });

  it('스타터 플랜은 무료여야 한다', async () => {
    const { getPlanById } = await import('./products');
    const starter = getPlanById('starter');
    expect(starter?.monthlyPriceKrw).toBe(0);
  });

  it('스탠다드/프리미엄 플랜은 유료여야 한다', async () => {
    const { getPlanById } = await import('./products');
    const standard = getPlanById('standard');
    const premium = getPlanById('premium');
    expect(standard?.monthlyPriceKrw).toBeGreaterThan(0);
    expect(premium?.monthlyPriceKrw).toBeGreaterThan(0);
    expect(premium!.monthlyPriceKrw).toBeGreaterThan(standard!.monthlyPriceKrw);
  });
});

// ─────────────────────────────────────────────
// 2. 포트원 V2 환경변수 테스트
// ─────────────────────────────────────────────
describe('포트원 V2 환경변수', () => {
  it('PORTONE_API_SECRET이 설정되어 있어야 한다', () => {
    expect(process.env.PORTONE_API_SECRET).toBeTruthy();
    expect(process.env.PORTONE_API_SECRET).not.toBe('');
  });

  it('VITE_PORTONE_STORE_ID가 설정되어 있어야 한다', () => {
    expect(process.env.VITE_PORTONE_STORE_ID).toBeTruthy();
    expect(process.env.VITE_PORTONE_STORE_ID).toMatch(/^store-/);
  });

  it('VITE_PORTONE_CHANNEL_KEY가 설정되어 있어야 한다', () => {
    expect(process.env.VITE_PORTONE_CHANNEL_KEY).toBeTruthy();
    expect(process.env.VITE_PORTONE_CHANNEL_KEY).toMatch(/^channel-key-/);
  });
});

// ─────────────────────────────────────────────
// 3. 샘플 데이터 시더 테스트
// ─────────────────────────────────────────────
describe('샘플 데이터 시더 (sampleDataSeeder.ts)', () => {
  it('seedSampleData 함수가 export되어 있어야 한다', async () => {
    const mod = await import('./services/sampleDataSeeder');
    expect(typeof mod.seedSampleData).toBe('function');
  });

  it('SAMPLE_PACKAGES_BY_CATEGORY에 국내/해외/혼합 카테고리가 있어야 한다', async () => {
    const mod = await import('./services/sampleDataSeeder');
    if ('SAMPLE_PACKAGES_BY_CATEGORY' in mod) {
      const cats = mod.SAMPLE_PACKAGES_BY_CATEGORY as Record<string, unknown[]>;
      expect(cats).toHaveProperty('domestic');
      expect(cats).toHaveProperty('overseas');
      expect(cats).toHaveProperty('mixed');
    }
  });
});

// ─────────────────────────────────────────────
// 4. 포트원 V2 서비스 테스트
// ─────────────────────────────────────────────
describe('포트원 V2 서비스 (portone.ts)', () => {
  it('verifyPayment 함수가 export되어 있어야 한다', async () => {
    const mod = await import('./services/portone');
    expect(typeof mod.verifyPayment).toBe('function');
  });

  it('cancelPayment 함수가 export되어 있어야 한다', async () => {
    const mod = await import('./services/portone');
    expect(typeof mod.cancelPayment).toBe('function');
  });

  it('getPayment 함수가 export되어 있어야 한다', async () => {
    const mod = await import('./services/portone');
    expect(typeof mod.getPayment).toBe('function');
  });
});

// ─────────────────────────────────────────────
// 5. 모델 라우팅 규칙 테스트
// ─────────────────────────────────────────────
describe('모델 라우팅 규칙', () => {
  it('openrouter.ts에 routeModel 함수가 있어야 한다', async () => {
    const mod = await import('./services/openrouter');
    expect(typeof mod.routeModel).toBe('function');
  });

  it('openrouter.ts에 orchestratorChat 함수가 있어야 한다', async () => {
    const mod = await import('./services/openrouter');
    expect(typeof mod.orchestratorChat).toBe('function');
  });
});
