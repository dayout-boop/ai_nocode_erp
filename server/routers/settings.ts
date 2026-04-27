/**
 * ERP 통합 설정 라우터
 * 외부 서비스 연동 상태 확인 및 테스트 기능
 */
import { router, adminProcedure } from "../_core/trpc";
import { ENV } from "../_core/env";

export const settingsRouter = router({
  /** 모든 서비스 연동 상태 확인 */
  getIntegrationStatus: adminProcedure.query(() => {
    return {
      gemini: !!ENV.geminiApiKey,
      openrouter: !!ENV.openrouterApiKey,
      stripe: !!ENV.stripeSecretKey,
      stripeWebhook: !!ENV.stripeWebhookSecret,
      kakao: !!(ENV.kakaoApiKey && ENV.kakaoSenderKey),
      slack: !!(ENV.slackWebhookUrl && ENV.slackWebhookUrl.startsWith("https://hooks.slack.com")),
      runway: !!ENV.runwayApiKey,
      n8n: !!ENV.n8nWebhookUrl,
      manus: !!ENV.manusApiKey,
      pixabay: !!ENV.pixabayApiKey,
    };
  }),

  /** Slack 연동 테스트 */
  testSlack: adminProcedure.mutation(async () => {
    if (!ENV.slackWebhookUrl || !ENV.slackWebhookUrl.startsWith("https://hooks.slack.com")) {
      throw new Error("SLACK_WEBHOOK_URL이 설정되지 않았거나 올바르지 않습니다. https://hooks.slack.com/... 형식이어야 합니다.");
    }
    const res = await fetch(ENV.slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "✅ 두골프 ERP - Slack 연동 테스트 성공!",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "✅ *두골프 ERP Slack 연동 테스트*\n연동이 정상적으로 작동합니다.",
            },
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Slack 응답 오류 [${res.status}]: ${body}`);
    }
    return { success: true };
  }),

  /** Manus API 연동 테스트 */
  testManus: adminProcedure.mutation(async () => {
    if (!ENV.manusApiKey) {
      throw new Error("MANUS_API_KEY가 설정되지 않았습니다.");
    }
    const res = await fetch("https://api.manus.ai/v2/task.create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-manus-api-key": ENV.manusApiKey,
      },
      body: JSON.stringify({
        message: {
          content: [{ type: "text", text: "두골프 ERP - Manus API 연동 테스트" }],
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Manus API 오류 [${res.status}]: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { ok: boolean; task_id?: string };
    if (!data.ok) {
      throw new Error("Manus API 응답 오류");
    }
    return { success: true, taskId: data.task_id };
  }),
});
