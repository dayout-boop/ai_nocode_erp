# 두골프 ERP 기능 변경 이력 (CHANGELOG)

> 이 파일은 `scripts/generate-features.mjs`에 의해 자동 생성됩니다.

## [2026-04-30] — 자동 생성

### 신규 추가 (2개)

- **엔진 대시보드** (AI 엔진 관리) — /erp/ai-engine/features 페이지 (FeatureCatalog)
- **API: featuresRouter** (ERP-기타) — tRPC featuresRouter 라우터

> 전체 기능 수: 135개
## [2026-04-30] — 자동 생성

### 신규 추가 (14개)

- **공개 견적서 페이지** (ERP-예약관리) — 토큰 기반 공개 견적서 조회, 변수 치환 렌더링({{일정표}}/{{N일차-골프}} 등), 인쇄 버튼
- **자동 치환 변수 시스템** (ERP-예약관리) — 정적 변수({{고객명}} 등 30+개) + 동적 변수({{N일차-골프}} 등) + {{일정표}} 자동 렌더링, validateVariables/extractVariables 유틸리티, VariablePickerButton 공용 컴포넌트
- **예약 일정 탭** (ERP-예약관리) — 예약 수정 모달 내 일정 탭 — 상품군 선택, 일자별 골프장/홀수/견적시간/확정시간/숙소/항공 입력, reservation_itineraries DB 연동
- **제휴사 비용 탭** (ERP-예약관리) — 예약 수정 모달 내 제휴사 비용 탭 — 제휴사별 입금가/판매가/수량 입력, 합계 집계, reservation_affiliate_costs DB 연동
- **중앙 AI 오케스트레이터** (AI 엔진 관리) — OpenRouter 기반 작업 복잡도 분류(SIMPLE/MODERATE/COMPLEX), 모델 라우팅, 프롬프트 캐싱, 비용 계산 및 DB 저장
- **Stripe 결제 연동** (외부연동-결제) — Stripe Checkout Session, 웹훅 처리, 결제 이력 조회, 예약 자동 확정
- **카카오 알림톡 연동** (외부연동-카카오) — Solapi API 기반 알림톡 발송, 예약 확정/취소 자동 발송, 발송 이력 DB 저장
- **Runway ML 동영상 자동생성** (외부연동-미디어) — Gen-3 Alpha Turbo 기반 상품 동영상 자동생성, 5초/10초 선택, 폴링, 프론트 플레이어
- **n8n 자동화 파이프라인** (외부연동-자동화) — n8n Webhook 트리거, 상품 SNS 자동배포, 실행 이력 DB 저장, 연동 가이드 문서
- **Gemini AI 어시스턴트** (AI 마스터) — Vertex AI SDK 기반, 서킷 브레이커, 리전 우회, 503 자동 재시도/폴백, 대화 로그 DB 저장, 리전별 통계 시각화
- **두골프-AI개발 엔진** (DevAI) — 자동 오류 감지(ErrorWatcher), AI 코드 수정 제안(AutoFixer), 다단계 재검토(ReviewEngine), Diff 시각화, 핵심 기능 수정 시 사용자 승인 안전장치
- **구글 스프레드시트 데이터 이식** (DB) — 7개 시트(내륙팩2/입금/송금/예치금/충전/데파짓) 약 10,000건 DB 이식 완료
- **견적서 실시간 미리보기** (ERP-예약관리) — 예약 선택 → 변수 치환 결과 실시간 렌더링, 포함항목/불포함항목/일정/유의사항 미리보기 패널
- **기능 카탈로그 자동 집계** (AI 엔진 관리) — 소스 스캔 기반 features.json 자동 생성, /erp/ai-engine/features 페이지, 카테고리별 필터/검색, 보고서 다운로드, CHANGELOG 자동 갱신

> 전체 기능 수: 133개
## [2026-04-30] — 자동 생성

### 신규 추가 (119개)

- **Home** (고객 홈페이지) — / 페이지 (Home)
- **Packages** (ERP-상품관리) — /packages 페이지 (Packages)
- **PackageDetail** (ERP-상품관리) — /packages/detail/:id 페이지 (PackageDetail)
- **Packages** (ERP-상품관리) — /packages/:destination 페이지 (Packages)
- **Gallery** (고객 홈페이지) — /gallery 페이지 (Gallery)
- **Notice** (ERP-CMS) — /notice 페이지 (Notice)
- **Inquiry** (ERP-예약관리) — /inquiry 페이지 (Inquiry)
- **ERPDashboard** (ERP-기타) — /erp 페이지 (ERPDashboard)
- **ERPDashboard** (ERP-기타) — /erp/dashboard 페이지 (ERPDashboard)
- **상품 목록** (ERP-상품관리) — /erp/packages 페이지 (ERPPackages)
- **상품 목록** (ERP-상품관리) — /erp/packages/:id 페이지 (ERPPackageDetail)
- **예약 목록** (ERP-예약관리) — /erp/bookings 페이지 (ERPBookings)
- **예약 문의** (ERP-예약관리) — /erp/inquiries 페이지 (ERPInquiries)
- **정산 목록** (ERP-자금/정산) — /erp/settlements 페이지 (ERPSettlements)
- **고객 검색** (ERP-CRM) — /erp/crm 페이지 (ERPCRMCustomers)
- **고객 검색** (ERP-CRM) — /erp/crm/partners 페이지 (ERPCRMPartners)
- **고객 검색** (ERP-CRM) — /erp/crm/affiliates 페이지 (AffiliateManagement)
- **수기 예약관리** (ERP-예약관리) — /erp/reservations 페이지 (ReservationManagement)
- **수기 예약관리** (ERP-예약관리) — /erp/reservations/templates 페이지 (InquiryTemplates)
- **자금 현황** (ERP-자금/정산) — /erp/finance 페이지 (FinanceManagement)
- **공지사항** (ERP-CMS) — /erp/cms/notices 페이지 (ERPCMSNotices)
- **배너 관리** (ERP-CMS) — /erp/cms/banners 페이지 (ERPCMSBanners)
- **자동 치환 변수** (ERP-CMS) — /erp/cms/variables 페이지 (ERPCMSVariables)
- **GeminiAssistant** (AI 마스터) — /erp/gemini 페이지 (GeminiAssistant)
- **AILogs** (AI 마스터) — /erp/ai-logs 페이지 (AILogs)
- **DevAI** (DevAI) — /erp/dev-ai 페이지 (DevAI)
- **DevAIOrchestrator** (AI 엔진 관리) — /erp/orchestrator 페이지 (DevAIOrchestrator)
- **오류 로그** (DevAI) — /erp/ai-dev-engine 페이지 (AIDevEngine)
- **두골프 마스터 🤖** (AI 챗봇) — /erp/master-ai 페이지 (MasterAI)
- **두골프 마스터 🤖** (AI 챗봇) — /erp/master-ai/logs 페이지 (MasterLogs)
- **두골프 마스터 🤖** (AI 챗봇) — /erp/master-ai/costs 페이지 (MasterCosts)
- **엔진 대시보드** (AI 엔진 관리) — /erp/ai-engine 페이지 (AIEngine)
- **골프톡 관리** (AI 챗봇) — /erp/golftalk-admin 페이지 (GolfTalkAdmin)
- **두골프 매니저 관리** (AI 챗봇) — /erp/manager-admin 페이지 (ManagerAdmin)
- **ERPSettings** (ERP-기타) — /erp/settings 페이지 (ERPSettings)
- **OpenRouter 에이전트 ⚡** (AI 엔진 관리) — /erp/openrouter-agent 페이지 (OpenRouterAgent)
- **수기 예약관리** (ERP-예약관리) — /erp/reservations/estimate-templates 페이지 (CustomerEstimateTemplates)
- **EstimateView** (ERP-예약관리) — /estimate/:token 페이지 (EstimateView)
- **DevDashboard** (ERP-기타) — /erp/dev-dashboard 페이지 (DevDashboard)
- **PartnerDashboard** (ERP-CRM) — /partner 페이지 (PartnerDashboard)
- **PartnerChat** (AI 챗봇) — /partner/chat 페이지 (PartnerChat)
- **NotFound** (ERP-기타) — /404 페이지 (NotFound)
- **API: dashboardRouter** (ERP-기타) — tRPC dashboardRouter 라우터
- **API: packagesRouter** (ERP-상품관리) — tRPC packagesRouter 라우터
- **API: bookingsRouter** (ERP-예약관리) — tRPC bookingsRouter 라우터
- **API: settlementsRouter** (ERP-자금/정산) — tRPC settlementsRouter 라우터
- **API: inquiriesRouter** (ERP-기타) — tRPC inquiriesRouter 라우터
- **API: cmsRouter** (ERP-CMS) — tRPC cmsRouter 라우터
- **API: crmRouter** (ERP-CRM) — tRPC crmRouter 라우터
- **API: geminiRouter** (AI 마스터) — tRPC geminiRouter 라우터
- **API: aiLogsRouter** (ERP-기타) — tRPC aiLogsRouter 라우터
- **API: promptVersionsRouter** (ERP-기타) — tRPC promptVersionsRouter 라우터
- **API: modelRoutingRouter** (ERP-기타) — tRPC modelRoutingRouter 라우터
- **API: devAIRouter** (ERP-기타) — tRPC devAIRouter 라우터
- **API: orchestratorRouter** (AI 엔진 관리) — tRPC orchestratorRouter 라우터
- **API: paymentRouter** (외부연동-결제) — tRPC paymentRouter 라우터
- **API: videoRouter** (외부연동-미디어) — tRPC videoRouter 라우터
- **API: automationRouter** (외부연동-자동화) — tRPC automationRouter 라우터
- **API: aiDevEngineRouter** (ERP-기타) — tRPC aiDevEngineRouter 라우터
- **API: appRouter** (ERP-기타) — tRPC appRouter 라우터
- **API: affiliatesRouter** (ERP-CRM) — tRPC affiliatesRouter 라우터
- **API: aiRouter** (ERP-기타) — tRPC aiRouter 라우터
- **API: chatRouter** (AI 챗봇) — tRPC chatRouter 라우터
- **API: devRequestRouter** (DevAI) — tRPC devRequestRouter 라우터
- **API: customerEstimateTemplatesRouter** (ERP-예약관리) — tRPC customerEstimateTemplatesRouter 라우터
- **API: estimatesRouter** (ERP-예약관리) — tRPC estimatesRouter 라우터
- **API: openrouterAgentRouter** (AI 엔진 관리) — tRPC openrouterAgentRouter 라우터
- **API: reservationAffiliateCostsRouter** (ERP-예약관리) — tRPC reservationAffiliateCostsRouter 라우터
- **API: reservationInquiriesRouter** (ERP-예약관리) — tRPC reservationInquiriesRouter 라우터
- **API: inquiryTemplatesRouter** (ERP-예약관리) — tRPC inquiryTemplatesRouter 라우터
- **API: reservationItinerariesRouter** (ERP-예약관리) — tRPC reservationItinerariesRouter 라우터
- **API: customVariablesRouter** (ERP-CMS) — tRPC customVariablesRouter 라우터
- **API: reservationsRouter** (ERP-예약관리) — tRPC reservationsRouter 라우터
- **API: settingsRouter** (ERP-기타) — tRPC settingsRouter 라우터
- **DB: users** (DB) — users 테이블 (Drizzle ORM)
- **DB: packages** (DB) — packages 테이블 (Drizzle ORM)
- **DB: package_prices** (DB) — package_prices 테이블 (Drizzle ORM)
- **DB: package_options** (DB) — package_options 테이블 (Drizzle ORM)
- **DB: package_slots** (DB) — package_slots 테이블 (Drizzle ORM)
- **DB: bookings** (DB) — bookings 테이블 (Drizzle ORM)
- **DB: travelers** (DB) — travelers 테이블 (Drizzle ORM)
- **DB: settlements** (DB) — settlements 테이블 (Drizzle ORM)
- **DB: inquiries** (DB) — inquiries 테이블 (Drizzle ORM)
- **DB: notices** (DB) — notices 테이블 (Drizzle ORM)
- **DB: banners** (DB) — banners 테이블 (Drizzle ORM)
- **DB: customer_memos** (DB) — customer_memos 테이블 (Drizzle ORM)
- **DB: package_images** (DB) — package_images 테이블 (Drizzle ORM)
- **DB: ai_interaction_logs** (DB) — ai_interaction_logs 테이블 (Drizzle ORM)
- **DB: prompt_versions** (DB) — prompt_versions 테이블 (Drizzle ORM)
- **DB: model_routing_rules** (DB) — model_routing_rules 테이블 (Drizzle ORM)
- **DB: dev_requests** (DB) — dev_requests 테이블 (Drizzle ORM)
- **DB: dev_features** (DB) — dev_features 테이블 (Drizzle ORM)
- **DB: dev_versions** (DB) — dev_versions 테이블 (Drizzle ORM)
- **DB: ai_cost_logs** (DB) — ai_cost_logs 테이블 (Drizzle ORM)
- **DB: payments** (DB) — payments 테이블 (Drizzle ORM)
- **DB: kakao_notifications** (DB) — kakao_notifications 테이블 (Drizzle ORM)
- **DB: automation_logs** (DB) — automation_logs 테이블 (Drizzle ORM)
- **DB: package_videos** (DB) — package_videos 테이블 (Drizzle ORM)
- **DB: ai_engine_logs** (DB) — ai_engine_logs 테이블 (Drizzle ORM)
- **DB: ai_fix_requests** (DB) — ai_fix_requests 테이블 (Drizzle ORM)
- **DB: ai_review_results** (DB) — ai_review_results 테이블 (Drizzle ORM)
- **DB: ai_logs** (DB) — ai_logs 테이블 (Drizzle ORM)
- **DB: chat_sessions** (DB) — chat_sessions 테이블 (Drizzle ORM)
- **DB: partners** (DB) — partners 테이블 (Drizzle ORM)
- **DB: partner_schedules** (DB) — partner_schedules 테이블 (Drizzle ORM)
- **DB: affiliates** (DB) — affiliates 테이블 (Drizzle ORM)
- **DB: reservations** (DB) — reservations 테이블 (Drizzle ORM)
- **DB: income_records** (DB) — income_records 테이블 (Drizzle ORM)
- **DB: remittance_records** (DB) — remittance_records 테이블 (Drizzle ORM)
- **DB: deposit_records** (DB) — deposit_records 테이블 (Drizzle ORM)
- **DB: charge_records** (DB) — charge_records 테이블 (Drizzle ORM)
- **DB: prepaid_records** (DB) — prepaid_records 테이블 (Drizzle ORM)
- **DB: reservation_inquiries** (DB) — reservation_inquiries 테이블 (Drizzle ORM)
- **DB: inquiry_templates** (DB) — inquiry_templates 테이블 (Drizzle ORM)
- **DB: customer_estimate_templates** (DB) — customer_estimate_templates 테이블 (Drizzle ORM)
- **DB: estimates** (DB) — estimates 테이블 (Drizzle ORM)
- **DB: reservation_itineraries** (DB) — reservation_itineraries 테이블 (Drizzle ORM)
- **DB: reservation_affiliate_costs** (DB) — reservation_affiliate_costs 테이블 (Drizzle ORM)
- **DB: custom_variables** (DB) — custom_variables 테이블 (Drizzle ORM)

> 전체 기능 수: 119개
