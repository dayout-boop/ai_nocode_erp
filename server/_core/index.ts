import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
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
import { sdk } from "./sdk";

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
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerMasterStreamRoute(app);
  registerUploadRoutes(app);
  registerScheduledRoutes(app);
  registerPublicLandingRoutes(app);

  // ─── 실시간 이벤트 SSE 엔드포인트 ─────────────────────────────────────────
  // GET /api/realtime/events - 관리자 전용 SSE 스트림
  app.get("/api/realtime/events", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user || user.role !== "admin") {
        res.status(401).json({ error: "관리자 인증이 필요합니다" });
        return;
      }
      // 구독자 ID: userId + 타임스탬프로 고유 식별
      const subscriberId = `user-${user.id}-${Date.now()}`;
      subscribe(subscriberId, user.id, res);
    } catch {
      res.status(500).json({ error: "SSE 연결 실패" });
    }
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
