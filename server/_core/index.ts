import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { getManusLoginUrlWithInvitation } from "./customOAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerStripeWebhook } from "../stripe";
import { registerMasterStreamRoute } from "../masterStream";
import { registerUploadRoutes } from "../uploadRoutes";
import { registerScheduledRoutes, registerPublicLandingRoutes } from "../scheduledRoutes";
import { reportError } from "./errorWatcher.js";
import { subscribe, startHeartbeat } from "../services/realtimeEvents";
import { startManusSync } from "../services/manusSync";
import { registerManusWebhookRoute } from "../routers/manusWebhook";
import { registerScheduledRunDueRoute } from "../routers/scheduledRunDue";
import engineChangesetRouter from "../routers/engineChangeset";
import partnerGoogleAuthRouter from "../routers/partnerGoogleAuth";
import memberAuthRouter from "../routers/memberAuth";
import authProxyRouter from "../routers/authProxy";
import { sdk } from "./sdk";
import { validateAdminSession } from "./adminAuth";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Stripe 웹훅은 raw body가 필요하므로 express.json() 보다 먼저 등록
  registerStripeWebhook(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Cookie parser - admin_session 쿠키 파싱
  app.use(cookieParser());
  // Manus 웹훅 수신 엔드포인트 등록 (/api/manus/webhook) - JSON 파싱 후 등록
  registerManusWebhookRoute(app);
  // Heartbeat 정기 트리거(자립형 크론) — /api/scheduled/run-due
  registerScheduledRunDueRoute(app);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  
  // 커스텀 OAuth 엔드포인트 - manus.im 선택 화면 우회
  app.get('/api/oauth/custom-login/:provider', (req, res) => {
    const { provider } = req.params;
    const { code: invitationCode } = req.query;
    
    if (!invitationCode || typeof invitationCode !== 'string') {
      return res.status(400).json({ error: '초대코드가 필요합니다' });
    }
    
    if (!['google', 'microsoft', 'facebook', 'apple'].includes(provider)) {
      return res.status(400).json({ error: '지원하지 않는 OAuth 제공자입니다' });
    }
    
    try {
      const appId = process.env.VITE_APP_ID || '';
      const oauthPortalUrl = process.env.OAUTH_SERVER_URL || '';
      
      if (!appId || !oauthPortalUrl) {
        return res.status(500).json({ error: 'OAuth 설정이 누락되었습니다' });
      }
      
      const oauthUrl = getManusLoginUrlWithInvitation(
        invitationCode,
        true,
        appId,
        oauthPortalUrl
      );
      res.json({ url: oauthUrl });
    } catch (error) {
      console.error('Custom OAuth URL generation error:', error);
      res.status(500).json({ error: 'OAuth URL 생성 실패' });
    }
  });
  
  registerMasterStreamRoute(app);
  registerUploadRoutes(app);
  registerScheduledRoutes(app);
  registerPublicLandingRoutes(app);

  // 파트너 구글 OAuth 인증 (Manus 종속 없는 독립 인증)
  app.use('/api/partner/auth', partnerGoogleAuthRouter);
  // 일반회원 자립 인증 (이메일/비밀번호 + 구글, Manus 비의존)
  app.use('/api/member/auth', memberAuthRouter);

  // 멀티테넌트 SaaS 보안 프록시 API (크레딧 검증 인터셉터 포함)
  // POST /api/v1/auth/oauth/google/initiate          → 신규 가입 시작
  // POST /api/v1/tenants/:id/auth/oauth/google/session-token → 로그인 시작
  // GET  /api/v1/auth/oauth/google/callback          → OAuth 콜백 처리
  app.use('/api/v1', authProxyRouter);

  // 마누스↔Git 원천 분리 Changeset 수신 입구 (POST /api/v1/engine/git/changeset)
  app.use('/api/v1', engineChangesetRouter);

  // partner.dayoutgolf.com 접속 시 URL 유지 - 클라이언트 라우터가 처리하므로 서버는 통과
  // (App.tsx에서 hostname 감지 후 PartnerLandingPage 렌더링)

  // ─── 실시간 이벤트 SSE 엔드포인트 ─────────────────────────────────────────
  // GET /api/realtime/events - 관리자 전용 SSE 스트림
  app.get("/api/realtime/events", async (req, res) => {
    try {
      let userId: number | null = null;

      // 1. Manus OAuth 세션 인증 시도
      try {
        const user = await sdk.authenticateRequest(req);
        if (user && user.role === "admin") {
          userId = user.id;
        }
      } catch {
        // Manus 세션 없음 - 다음 수단 시도
      }

      // 2. admin_session_id 쿠키 인증 (ERP 마스터 로그인)
      if (!userId) {
        const adminSessionId = req.cookies?.admin_session_id ?? req.cookies?.admin_session;
        if (adminSessionId) {
          const session = await validateAdminSession(adminSessionId);
          if (session) {
            userId = session.adminId;
          }
        }
      }

      if (!userId) {
        res.status(401).json({ error: "관리자 인증이 필요합니다" });
        return;
      }

      // 구독자 ID: userId + 타임스탬프로 고유 식별
      const subscriberId = `user-${userId}-${Date.now()}`;
      subscribe(subscriberId, userId, res);
    } catch {
      res.status(500).json({ error: "SSE 연결 실패" });
    }
  });

  // admin_session 쿠키 검증 미들웨어 - masterProcedure에서 ctx.req.adminSession 사용
  app.use('/api/trpc', async (req, res, next) => {
    const adminSessionId = req.cookies?.admin_session;
    if (adminSessionId) {
      try {
        const session = await validateAdminSession(adminSessionId);
        if (session) {
          (req as any).adminSession = session;
        }
      } catch {
        // 세션 검증 실패 시 통과 (비로그인 상태로 진행)
      }
    }
    next();
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // 하트비트 시작 (25초 간격)
    startHeartbeat(25_000);
    startManusSync(); // 300009: Manus Task 상태 폴링 기반 양방향 동기화
  });
}

startServer().catch(console.error);

// ─── 전역 미처리 예외 → 두골프-AI개발 엔진 자동 보고 ─────────────────────────
process.on("uncaughtException", (err: Error) => {
  console.error("[uncaughtException]", err);
  reportError({
    source: "process.uncaughtException",
    error: err,
    context: err.stack,
  }).catch(() => {});
});

process.on("unhandledRejection", (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error("[unhandledRejection]", err);
  reportError({
    source: "process.unhandledRejection",
    error: err,
    context: err.stack,
  }).catch(() => {});
});
