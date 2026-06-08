/**
 * 벤더 중립 Heartbeat 정기 트리거 엔드포인트 [STEP4 §3]
 * ------------------------------------------------------------------
 *   POST /api/scheduled/run-due
 *   헤더: x-due-heartbeat-token: <HEARTBEAT_SECRET_KEY>
 *
 * 외부 유료 스케줄러가 끊겨도 리눅스 표준 crontab 한 줄로 영구 자립 구동:
 *   * * * * * curl -X POST https://.../api/scheduled/run-due -H "x-due-heartbeat-token: $TOKEN"
 *
 * 무단 호출은 시크릿 토큰으로 차단. 토큰 미설정 시 안전을 위해 비활성(503).
 */
import type { Request, Response } from "express";
import { ENV } from "../_core/env";
import { runDueAudits } from "../services/orchestrator";

export function registerScheduledRunDueRoute(app: {
  post: (path: string, handler: (req: Request, res: Response) => void | Promise<void> | Promise<Response>) => void;
}): void {
  app.post("/api/scheduled/run-due", async (req: Request, res: Response) => {
    const token = req.headers["x-due-heartbeat-token"];

    // 토큰 미설정 환경: 무단 자동스캔 방지 위해 비활성
    if (!ENV.heartbeatSecretKey) {
      return res.status(503).json({ success: false, reason: "Heartbeat 비활성 (HEARTBEAT_SECRET_KEY 미설정)" });
    }
    if (token !== ENV.heartbeatSecretKey) {
      return res.status(401).json({ success: false, reason: "비인가 호출" });
    }

    try {
      const result = await runDueAudits();
      return res.status(200).json({ success: true, processedCount: result.processedCount });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message ?? "unknown" });
    }
  });
}
