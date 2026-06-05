import { compare, hash } from 'bcrypt';
import { getDb } from '../db';
import { adminAccounts } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

const ADMIN_SESSION_COOKIE = 'admin_session_id';
const ADMIN_SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

// In-memory session store (프로덕션에서는 Redis 사용 권장)
const adminSessions = new Map<
  string,
  {
    adminId: number;
    username: string;
    loginTime: number;
    lastActivity: number;
  }
>();

/**
 * 관리자 로그인 처리
 */
export async function authenticateAdmin(username: string, password: string) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error('데이터베이스 연결 불가');
    }

    // DB에서 관리자 계정 조회
    const [admin] = await db
      .select()
      .from(adminAccounts)
      .where(eq(adminAccounts.username, username));
    
    if (!admin) {
      throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    if (!admin.isActive) {
      throw new Error('비활성화된 계정입니다.');
    }

    // 비밀번호 검증
    const isPasswordValid = await compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    // 세션 생성
    const sessionId = generateSessionId();
    const now = Date.now();

    adminSessions.set(sessionId, {
      adminId: admin.id,
      username: admin.username,
      loginTime: now,
      lastActivity: now,
    });

    // 마지막 로그인 시간 업데이트
    if (db) {
      await db
        .update(adminAccounts)
        .set({ lastLoginAt: new Date() })
        .where(eq(adminAccounts.id, admin.id));
    }

    return {
      sessionId,
      adminId: admin.id,
      username: admin.username,
      role: admin.role,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * 세션 검증
 */
export function validateAdminSession(sessionId: string) {
  const session = adminSessions.get(sessionId);

  if (!session) {
    return null;
  }

  const now = Date.now();
  const sessionAge = now - session.loginTime;

  // 세션 만료 확인
  if (sessionAge > ADMIN_SESSION_TTL) {
    adminSessions.delete(sessionId);
    return null;
  }

  // 마지막 활동 시간 업데이트
  session.lastActivity = now;

  return {
    adminId: session.adminId,
    username: session.username,
  };
}

/**
 * 세션 로그아웃
 */
export function logoutAdminSession(sessionId: string) {
  adminSessions.delete(sessionId);
}

/**
 * 비밀번호 해싱
 */
export async function hashPassword(password: string) {
  return hash(password, 10);
}

/**
 * 비밀번호 검증
 */
export async function validatePassword(password: string, hash: string) {
  return compare(password, hash);
}

/**
 * 세션 ID 생성
 */
function generateSessionId(): string {
  return `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 모든 세션 정리 (만료된 세션 제거)
 */
export function cleanupExpiredSessions() {
  const now = Date.now();
  const expiredSessions: string[] = [];

  adminSessions.forEach((session, sessionId) => {
    if (now - session.loginTime > ADMIN_SESSION_TTL) {
      expiredSessions.push(sessionId);
    }
  });

  expiredSessions.forEach((sessionId) => adminSessions.delete(sessionId));

  return expiredSessions.length;
}

// 주기적으로 만료된 세션 정리 (1시간마다)
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
