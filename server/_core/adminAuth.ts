import { compare, hash } from 'bcrypt';
import { getDb } from '../db';
import { adminAccounts, adminSessions } from '../../drizzle/schema';
import { eq, lt } from 'drizzle-orm';

const ADMIN_SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * 세션 저장소 전략
 * - 1순위: DB(admin_sessions) — 서버 재시작·다중 서버 환경에서도 세션 존속(이전 대응)
 * - 폴백: 인메모리 Map — DB 미연결 시에도 ERP가 죽지 않도록 안전 동작
 *
 * 어느 서버로 옮겨가도 DB만 따라가면 로그인 세션이 유지됩니다.
 */
type SessionRecord = {
  adminId: number;
  username: string;
  role: string;
  loginTime: number;
  lastActivity: number;
};

// DB 미연결 시 폴백용 인메모리 저장소
const memorySessions = new Map<string, SessionRecord>();

/**
 * 관리자 로그인 처리
 */
export async function authenticateAdmin(username: string, password: string) {
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
  const role = admin.role || 'admin';

  // DB에 세션 저장 (실패 시 인메모리 폴백)
  try {
    await db.insert(adminSessions).values({
      sessionId,
      adminId: admin.id,
      username: admin.username,
      role,
      loginTime: now,
      lastActivity: now,
      expiresAt: now + ADMIN_SESSION_TTL,
    });
  } catch (err) {
    console.error('[adminAuth] DB 세션 저장 실패, 인메모리 폴백:', err);
    memorySessions.set(sessionId, {
      adminId: admin.id,
      username: admin.username,
      role,
      loginTime: now,
      lastActivity: now,
    });
  }

  // 마지막 로그인 시간 업데이트
  await db
    .update(adminAccounts)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminAccounts.id, admin.id));

  return {
    sessionId,
    adminId: admin.id,
    username: admin.username,
    role,
  };
}

/**
 * 세션 검증 - role 포함하여 반환 (비동기: DB 우선 → 인메모리 폴백)
 */
export async function validateAdminSession(sessionId: string) {
  const now = Date.now();

  // 1순위: DB 조회
  const db = await getDb();
  if (db) {
    try {
      const [row] = await db
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.sessionId, sessionId));

      if (row) {
        // 만료 확인
        if (now - row.loginTime > ADMIN_SESSION_TTL) {
          await db.delete(adminSessions).where(eq(adminSessions.sessionId, sessionId));
          return null;
        }

        // 마지막 활동 시간 갱신 (best-effort, 실패해도 검증은 통과)
        db.update(adminSessions)
          .set({ lastActivity: now })
          .where(eq(adminSessions.sessionId, sessionId))
          .catch(() => {});

        return {
          adminId: row.adminId,
          username: row.username,
          role: row.role,
        };
      }
    } catch (err) {
      console.error('[adminAuth] DB 세션 조회 실패, 인메모리 폴백:', err);
    }
  }

  // 폴백: 인메모리 조회
  const session = memorySessions.get(sessionId);
  if (!session) {
    return null;
  }

  if (now - session.loginTime > ADMIN_SESSION_TTL) {
    memorySessions.delete(sessionId);
    return null;
  }

  session.lastActivity = now;
  return {
    adminId: session.adminId,
    username: session.username,
    role: session.role,
  };
}

/**
 * 세션 로그아웃 (DB + 인메모리 모두 제거)
 */
export async function logoutAdminSession(sessionId: string) {
  memorySessions.delete(sessionId);

  const db = await getDb();
  if (db) {
    try {
      await db.delete(adminSessions).where(eq(adminSessions.sessionId, sessionId));
    } catch (err) {
      console.error('[adminAuth] DB 세션 삭제 실패:', err);
    }
  }
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
export async function validatePassword(password: string, hashStr: string) {
  return compare(password, hashStr);
}

/**
 * 세션 ID 생성
 */
function generateSessionId(): string {
  return `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 만료된 세션 정리 (DB + 인메모리)
 */
export async function cleanupExpiredSessions() {
  const now = Date.now();
  let removed = 0;

  // 인메모리 정리
  memorySessions.forEach((session, sessionId) => {
    if (now - session.loginTime > ADMIN_SESSION_TTL) {
      memorySessions.delete(sessionId);
      removed++;
    }
  });

  // DB 정리
  const db = await getDb();
  if (db) {
    try {
      await db.delete(adminSessions).where(lt(adminSessions.expiresAt, now));
    } catch (err) {
      console.error('[adminAuth] DB 만료 세션 정리 실패:', err);
    }
  }

  return removed;
}

// 주기적으로 만료된 세션 정리 (1시간마다)
setInterval(() => {
  cleanupExpiredSessions().catch(() => {});
}, 60 * 60 * 1000);
