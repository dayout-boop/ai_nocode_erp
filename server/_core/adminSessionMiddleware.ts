import { Request, Response, NextFunction } from 'express';
import { validateAdminSession } from './adminAuth';

/**
 * 마스터 ERP 세션 검증 미들웨어
 * 쿠키에서 admin_session을 추출하여 유효성 검증
 */
export function adminSessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const sessionId = req.cookies?.admin_session;

  if (!sessionId) {
    // 세션이 없으면 로그인 페이지로 리다이렉트
    return res.status(401).json({ error: '로그인이 필요합니다' });
  }

  const session = validateAdminSession(sessionId);

  if (!session) {
    // 세션이 만료되었거나 유효하지 않음
    res.clearCookie('admin_session');
    return res.status(401).json({ error: '세션이 만료되었습니다' });
  }

  // 요청 객체에 관리자 정보 추가
  (req as any).adminSession = session;

  next();
}

/**
 * 마스터 ERP 세션 정보를 요청 객체에 추가하는 타입 확장
 */
declare global {
  namespace Express {
    interface Request {
      adminSession?: {
        adminId: number;
        username: string;
      };
    }
  }
}
