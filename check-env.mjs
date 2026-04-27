const vars = [
  'VITE_APP_ID','JWT_SECRET','DATABASE_URL','OAUTH_SERVER_URL','OWNER_OPEN_ID',
  'BUILT_IN_FORGE_API_URL','BUILT_IN_FORGE_API_KEY','PIXABAY_API_KEY','GEMINI_API_KEY',
  'GOOGLE_SERVICE_ACCOUNT_JSON','GOOGLE_CLOUD_PROJECT_ID',
  'SLACK_WEBHOOK_URL','OPENROUTER_API_KEY','OPENROUTER_BASE_URL',
  'MANUS_API_KEY','MANUS_DOGOLF_TASK_ID',
  'STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','VITE_STRIPE_PUBLISHABLE_KEY',
  'KAKAO_API_KEY','KAKAO_SENDER_KEY',
  'RUNWAY_API_KEY','N8N_WEBHOOK_URL'
];
vars.forEach(v => {
  const val = process.env[v];
  let status;
  if (!val) {
    status = 'MISSING';
  } else if (val.length < 5) {
    status = 'SHORT';
  } else {
    status = 'OK';
  }
  const preview = val ? val.substring(0, 25) + '...' : '(없음)';
  console.log(`[${status}] ${v}: ${preview}`);
});
