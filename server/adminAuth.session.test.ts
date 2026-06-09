import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * 관리자 세션 DB화 검증
 * - validateAdminSession: DB 우선 조회 → 만료 처리 → 인메모리 폴백
 * - logoutAdminSession: DB + 인메모리 삭제
 * - DB 미연결 시에도 graceful 동작 (ERP가 죽지 않음)
 */

// getDb 모킹 핸들 (테스트별 교체)
let dbMock: any = null;

vi.mock('../server/db', () => ({
  getDb: async () => dbMock,
}));

// drizzle 연산자/스키마는 실제 사용 안 하므로 가벼운 스텁
vi.mock('../drizzle/schema', () => ({
  adminAccounts: {},
  adminSessions: { sessionId: 'sessionId', expiresAt: 'expiresAt' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (...a: any[]) => ({ op: 'eq', a }),
  lt: (...a: any[]) => ({ op: 'lt', a }),
}));

describe('adminAuth 세션 DB화', () => {
  beforeEach(() => {
    vi.resetModules();
    dbMock = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('DB에 유효 세션이 있으면 검증 통과하고 lastActivity를 갱신한다', async () => {
    const now = Date.now();
    const row = {
      sessionId: 'admin_x',
      adminId: 7,
      username: 'master',
      role: 'master',
      loginTime: now - 1000, // 만료 안 됨
      lastActivity: now - 1000,
      expiresAt: now + 1_000_000,
    };

    const updateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    dbMock = {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([row]),
        }),
      }),
      update: () => ({ set: updateSet }),
      delete: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
    };

    const { validateAdminSession } = await import('../server/_core/adminAuth');
    const result = await validateAdminSession('admin_x');

    expect(result).toEqual({ adminId: 7, username: 'master', role: 'master' });
    // lastActivity 갱신 시도 (best-effort)
    expect(updateSet).toHaveBeenCalled();
  });

  it('DB 세션이 TTL을 초과하면 삭제 후 null 반환', async () => {
    const now = Date.now();
    const oldLogin = now - 25 * 60 * 60 * 1000; // 25시간 전 (TTL 24h 초과)
    const row = {
      sessionId: 'admin_old',
      adminId: 7,
      username: 'master',
      role: 'master',
      loginTime: oldLogin,
      lastActivity: oldLogin,
      expiresAt: oldLogin + 24 * 60 * 60 * 1000,
    };

    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    dbMock = {
      select: () => ({
        from: () => ({ where: () => Promise.resolve([row]) }),
      }),
      delete: () => ({ where: deleteWhere }),
    };

    const { validateAdminSession } = await import('../server/_core/adminAuth');
    const result = await validateAdminSession('admin_old');

    expect(result).toBeNull();
    expect(deleteWhere).toHaveBeenCalled();
  });

  it('DB 미연결 + 인메모리 없음이면 null 반환 (ERP 안 죽음)', async () => {
    dbMock = null; // DB 없음
    const { validateAdminSession } = await import('../server/_core/adminAuth');
    const result = await validateAdminSession('nonexistent');
    expect(result).toBeNull();
  });

  it('DB 조회 중 예외가 나도 throw하지 않고 인메모리 폴백(없으면 null)', async () => {
    dbMock = {
      select: () => ({
        from: () => ({
          where: () => Promise.reject(new Error('DB down')),
        }),
      }),
    };
    const { validateAdminSession } = await import('../server/_core/adminAuth');
    const result = await validateAdminSession('whatever');
    expect(result).toBeNull();
  });

  it('logoutAdminSession은 DB 삭제를 호출한다', async () => {
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    dbMock = {
      delete: () => ({ where: deleteWhere }),
    };
    const { logoutAdminSession } = await import('../server/_core/adminAuth');
    await logoutAdminSession('admin_x');
    expect(deleteWhere).toHaveBeenCalled();
  });
});
