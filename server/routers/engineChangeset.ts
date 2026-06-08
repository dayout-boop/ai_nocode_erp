/**
 * 마누스 ↔ Git 원천 분리 인터페이스 — Changeset 수신 API [STEP3 §1.1]
 * ------------------------------------------------------------------
 *   POST /api/v1/engine/git/changeset
 *   헤더: x-engine-api-key: <ENGINE_API_KEY>
 *
 * 외부 에이전트(마누스 포함)는 GitHub 레포에 직접 Push 권한이 없다.
 * 이들은 '소스코드 변경조각(Changeset Payload)' 텍스트만 이 입구 API로 토스하고,
 * 실제 GitHub 커밋 주체는 오직 서버 내장 Git 엔진(orchestrator → gitEngine)이다.
 *
 * 인증 미설정 시 무단 커밋 방지 위해 비활성(503).
 */
import express, { type Request, type Response } from "express";
import { z } from "zod";
import { ENV } from "../_core/env";
import { runPipeline } from "../services/orchestrator";
import type { AgentContext, AgentRole } from "../services/agentEngine";

const router = express.Router();

const changesetSchema = z.object({
  // 1단계 ai_dev_requests 연동 식별자(외부 참조용 — 서버는 새 라이프사이클 레코드를 생성)
  devRequestId: z.number().optional(),
  commitMessage: z.string().min(1).max(2000),
  files: z
    .array(
      z.object({
        filePath: z.string().min(1).max(500),
        action: z.enum(["ADD", "MODIFY", "DELETE"]),
        content: z.string().optional(),
        isBase64: z.boolean().optional(),
      }),
    )
    .min(1),
  // 호출 주체 식별(에이전트 격리) — 미지정 시 SYSTEM 으로 간주
  agentId: z.string().optional(),
  callerId: z.string().optional(),
  role: z.enum(["MASTER", "MANAGER", "GOLFTALK", "SYSTEM"]).optional(),
  partnerId: z.string().optional(),
  // dev-2-integration 자동 통합 여부(기본 false — Heartbeat 가 일괄 처리)
  autoIntegrate: z.boolean().optional(),
});

router.post("/engine/git/changeset", async (req: Request, res: Response) => {
  // 인증: 엔진 API 키 미설정 시 비활성
  if (!ENV.engineApiKey) {
    return res.status(503).json({ success: false, reason: "Changeset 엔진 비활성 (ENGINE_API_KEY 미설정)" });
  }
  const apiKey = req.headers["x-engine-api-key"];
  if (apiKey !== ENV.engineApiKey) {
    return res.status(401).json({ success: false, reason: "비인가 호출" });
  }

  const parsed = changesetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, reason: "잘못된 Changeset 형식", issues: parsed.error.issues });
  }
  const payload = parsed.data;

  // ADD/MODIFY 는 content 필수
  for (const f of payload.files) {
    if (f.action !== "DELETE" && (f.content === undefined || f.content === "")) {
      return res.status(400).json({ success: false, reason: `'${f.filePath}' 의 content 가 비어 있습니다 (${f.action})` });
    }
  }

  const role: AgentRole = payload.role ?? "SYSTEM";
  const context: AgentContext = {
    callerId: payload.callerId ?? payload.agentId ?? "external-agent",
    role,
    partnerId: payload.partnerId,
  };

  try {
    const result = await runPipeline({
      agentId: payload.agentId ?? "external_agent",
      commitMessage: payload.commitMessage,
      changeset: payload.files,
      context,
      autoIntegrate: payload.autoIntegrate ?? false,
      runAudit: true,
    });
    return res.status(202).json({ success: true, ...result });
  } catch (err: any) {
    // 경계 위반(partner_id 미잠금, 외부도구 토큰 누수 등)은 명시적 4xx 로 차단
    const msg = err?.message ?? "unknown";
    const isBoundary = /파트너|partner|금지 토큰|경계|역할/.test(msg);
    return res.status(isBoundary ? 403 : 500).json({ success: false, error: msg });
  }
});

export default router;
