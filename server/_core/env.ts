export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  pixabayApiKey: process.env.PIXABAY_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // Vertex AI (서비스 계정 인증)
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "",
  googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID ?? "",
  // Slack Webhook (두골프 개발AI 연동)
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL ?? "",
  // OpenRouter (중앙 AI 오케스트레이터)
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openrouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  // Manus API (자동 개발 파이프)
  manusApiKey: process.env.MANUS_API_KEY ?? "",
  manusDogolfTaskId: process.env.MANUS_DOGOLF_TASK_ID ?? "",
  manusProjectId: process.env.MANUS_PROJECT_ID ?? "", // 두골프 전용 Manus 프로젝트 ID (스마트 라우팅에 사용)
  // Stripe 결제
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  // 카카오 알림톡
  kakaoApiKey: process.env.KAKAO_API_KEY ?? "",
  kakaoSenderKey: process.env.KAKAO_SENDER_KEY ?? "",
  // Runway ML 동영상 생성
  runwayApiKey: process.env.RUNWAY_API_KEY ?? "",
  // n8n 자동화
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL ?? "",
  // 포트원 V2 결제
  portoneApiSecret: process.env.PORTONE_API_SECRET ?? "",
  portoneStoreId: process.env.VITE_PORTONE_STORE_ID ?? "",
  portoneChannelKey: process.env.VITE_PORTONE_CHANNEL_KEY ?? "",
  // LLM 설정 (v2 버전용)
  llmApiUrl: process.env.LLM_API_URL ?? "",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "",
};
