import { describe, it, expect, beforeAll } from 'vitest';
import { authenticateAdmin, validateAdminSession, logoutAdminSession, hashPassword } from './_core/adminAuth';
import { getDb } from './db';
import { adminAccounts } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Admin Authentication', () => {
  let testUsername = 'test_admin_' + Date.now();
  let testPassword = 'TestPassword123!';
  let hashedPassword: string;

  beforeAll(async () => {
    // 테스트용 관리자 계정 생성
    hashedPassword = await hashPassword(testPassword);
    const db = await getDb();
    if (db) {
      await db.insert(adminAccounts).values({
        username: testUsername,
        passwordHash: hashedPassword,
        name: 'Test Admin',
        email: 'test@dogolf.com',
        role: 'admin',
        isActive: true,
      });
    }
  });

  it('정확한 비밀번호로 로그인하면 세션 ID를 반환해야 한다', async () => {
    const result = await authenticateAdmin(testUsername, testPassword);
    expect(result).toBeDefined();
    expect(result.sessionId).toBeDefined();
    expect(result.adminId).toBeGreaterThan(0);
    expect(result.username).toBe(testUsername);
    expect(result.role).toBe('admin');
  });

  it('잘못된 비밀번호로 로그인하면 에러를 던져야 한다', async () => {
    try {
      await authenticateAdmin(testUsername, 'WrongPassword');
      expect.fail('에러를 던져야 합니다');
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('올바르지 않습니다');
    }
  });

  it('존재하지 않는 사용자로 로그인하면 에러를 던져야 한다', async () => {
    try {
      await authenticateAdmin('nonexistent_user', 'password');
      expect.fail('에러를 던져야 합니다');
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('올바르지 않습니다');
    }
  });

  it('유효한 세션 ID로 세션을 검증할 수 있어야 한다', async () => {
    const loginResult = await authenticateAdmin(testUsername, testPassword);
    const sessionId = loginResult.sessionId;

    const session = await validateAdminSession(sessionId);
    expect(session).toBeDefined();
    expect(session?.adminId).toBe(loginResult.adminId);
    expect(session?.username).toBe(testUsername);
  });

  it('잘못된 세션 ID로 검증하면 null을 반환해야 한다', async () => {
    const session = await validateAdminSession('invalid_session_id');
    expect(session).toBeNull();
  });

  it('세션을 로그아웃하면 더 이상 검증되지 않아야 한다', async () => {
    const loginResult = await authenticateAdmin(testUsername, testPassword);
    const sessionId = loginResult.sessionId;

    // 로그아웃 전 검증
    let session = await validateAdminSession(sessionId);
    expect(session).toBeDefined();

    // 로그아웃
    await logoutAdminSession(sessionId);

    // 로그아웃 후 검증
    session = await validateAdminSession(sessionId);
    expect(session).toBeNull();
  });

  it('비활성화된 계정으로 로그인하면 에러를 던져야 한다', async () => {
    const db = await getDb();
    if (!db) return;

    // 비활성화된 계정 생성
    const inactiveUsername = 'inactive_' + Date.now();
    const hashedPwd = await hashPassword('password123');
    await db.insert(adminAccounts).values({
      username: inactiveUsername,
      passwordHash: hashedPwd,
      name: 'Inactive Admin',
      role: 'admin',
      isActive: false,
    });

    // 로그인 시도
    try {
      await authenticateAdmin(inactiveUsername, 'password123');
      expect.fail('에러를 던져야 합니다');
    } catch (error) {
      expect((error as Error).message).toContain('비활성화');
    }
  });

  it('비밀번호 해싱이 일관성 있게 작동해야 한다', async () => {
    const password = 'MySecurePassword123!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    // 해시는 다르지만 같은 비밀번호로 검증되어야 함
    expect(hash1).not.toBe(hash2);

    const { compare } = await import('bcrypt');
    const match1 = await compare(password, hash1);
    const match2 = await compare(password, hash2);

    expect(match1).toBe(true);
    expect(match2).toBe(true);
  });
});
