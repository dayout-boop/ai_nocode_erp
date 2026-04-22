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
};
