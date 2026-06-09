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
  // 파트너 구글 OAuth (환경변수 폴백 — Secret Manager 조회 실패 시 사용)
  partnerGoogleClientId: process.env.PARTNER_GOOGLE_CLIENT_ID ?? "",
  partnerGoogleClientSecret: process.env.PARTNER_GOOGLE_CLIENT_SECRET ?? "",
  // ── 서버 내장 Git 엔진 (GitHub REST API 직접 호출. 마누스는 GitHub에 직접 연결하지 않음) ──
  githubToken: process.env.GITHUB_TOKEN ?? "",
  githubRepoOwner: process.env.GITHUB_REPO_OWNER ?? "",
  githubRepoName: process.env.GITHUB_REPO_NAME ?? "",
  // ── Heartbeat 자립형 트리거 시크릿 (무단 호출 차단) ──
  heartbeatSecretKey: process.env.HEARTBEAT_SECRET_KEY ?? "",
  // ── Changeset 수신 엔진 API 키 (외부 에이전트 변경조각 토스 인증) ──
  engineApiKey: process.env.ENGINE_API_KEY ?? "",
  // ── 탈마누스(벤더 중립) 스위치 ──
  aiVendNeutralMode: process.env.AI_VEND_NEUTRAL_MODE ?? "",
  targetLlmProvider: process.env.TARGET_LLM_PROVIDER ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // ── 자체 배포 실행기 (외부서버 빌드·재시작) ──
  // SELF_DEPLOY_ENABLED=true 일 때만 실제 쉘 실행 허용(기본 비활성 — 안전가드)
  selfDeployEnabled: process.env.SELF_DEPLOY_ENABLED ?? "",
  // 빌드 명령 (기본 pnpm build) · 재시작 명령 (기본 비움 — 프로세스 매니저 의존)
  deployBuildCmd: process.env.DEPLOY_BUILD_CMD ?? "pnpm build",
  deployRestartCmd: process.env.DEPLOY_RESTART_CMD ?? "",
  // git pull 명령 (기본 비움 — 외부서버 이전 시 설정)
  // 예: "git pull origin main" 또는 "git -C /srv/dogolf pull origin main"
  deployGitPullCmd: process.env.DEPLOY_GIT_PULL_CMD ?? "",
  // git pull 실행 디렉토리 (기본 비움 — 비어있으면 process.cwd() 사용)
  deployGitPullDir: process.env.DEPLOY_GIT_PULL_DIR ?? "",
};
