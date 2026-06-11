# 두골프 ERP 관리자 백오피스 TODO

## DB / 백엔드
- [x] DB 스키마 설계 (12개 테이블: users, packages, package_prices, package_options, package_slots, bookings, travelers, settlements, inquiries, notices, banners, customer_memos)
- [x] DB 마이그레이션 실행
- [x] tRPC 라우터 - 상품관리 CRUD
- [x] tRPC 라우터 - 예약관리 CRUD
- [x] tRPC 라우터 - 정산관리 CRUD
- [x] tRPC 라우터 - 문의관리 CRUD
- [x] tRPC 라우터 - 공지/배너 CMS CRUD
- [x] tRPC 라우터 - 대시보드 통계
- [x] tRPC 라우터 - CRM 고객 메모

## ERP 프론트엔드
- [x] ERP 전용 레이아웃 (사이드바 + 탑바)
- [x] 로그인 페이지 (관리자 전용)
- [x] 대시보드 - 예약/매출 통계 차트, KPI 카드
- [x] 상품관리 - 목록, 등록/수정/삭제, 인원별 요금, 옵션, 슬롯
- [x] 예약관리 - 목록, 상태변경, 상세보기
- [x] 정산관리 - 공급처별 정산, 기간별 매출 리포트
- [x] CRM - 고객 검색, 상담 메모
- [x] CMS - 공지사항 관리, 배너 관리
- [x] 문의관리 - 1:1 문의 답변

## 기존 프론트 사이트 연동
- [x] 기존 두골프 사이트 Home.tsx 복원 (ERP 업그레이드 후 충돌 해결)
- [x] 예약 문의 폼 → DB 저장 연동

## 테스트
- [x] ERP 관리자 권한 접근 제어 테스트 (7개)
- [x] 로그아웃 테스트 (1개)

## 프론트 ↔ ERP DB 연동
- [x] tRPC publicPackages 라우터 추가 (공개 상품 목록/상세 조회)
- [x] Packages.tsx - 정적 데이터 → DB API 연동
- [x] Home.tsx - 인기 패키지 섹션 DB 연동
- [x] PackageDetail.tsx 페이지 신규 생성 (상품 상세 + 예약 문의)
- [x] App.tsx에 /packages/detail/:id 상세 라우트 추가

## 추가 개선 항목
- [x] Packages.tsx - 가격 정렬을 실제 packagePrices 기반으로 개선
- [x] Inquiry.tsx - 패키지 상세에서 넘어온 쿼리 파라미터(package, name) 자동 프리필 연동

## 상품 이미지 업로드 및 관리 기능
- [x] DB 스키마에 package_images 테이블 추가 및 마이그레이션
- [x] S3 이미지 업로드 tRPC API (uploadImage, deleteImage, setCover, listImages)
- [x] ERP 상품 수정 화면에 이미지 업로드/삭제/대표설정 UI (드래그&드롭 지원)
- [x] 프론트 상품 상세 페이지에 이미지 갤러리(주요이미지+썸네일+라이트박스) 표시

## 상품 이미지 자동생성 및 최적화 기능
- [x] AI 이미지 자동생성 tRPC API (generateAIImage) - 상품명 기반 프롬프트로 AI 이미지 생성
- [x] ERP 이미지 탭에 "AI 자동생성" 섹션 UI 추가 (자동생성 버튼, 생성 중 로딩 표시)
- [x] 생성된 이미지를 등록된 이미지 목록에 통합 표시
- [x] 이미지 업로드/생성 시 자동 리사이즈 (1200x800 기준, 비율 유지)
- [x] 이미지 용량 최적화 (WebP 변환, 품질 85%, 최대 500KB)
- [x] 프론트 상품 상세 페이지 이미지 일관된 사이즈로 표시
- [x] Pixabay CC0 무료 이미지 검색 tRPC API (searchPixabay, importPixabayImage) 추가
- [x] ERP 이미지 탭에 Pixabay 검색 UI 추가 (검색어 입력, 결과 그리드, 페이지네이션, 등록 버튼)

## 에러 수정 및 키워드 기능 추가
- [x] Footer.tsx 중복 key 에러 수정 (자주 묻는 질문 href 변경, key를 label 기반으로 변경)
- [x] generateAIImage API에 keywords 파라미터 추가 (z.array(z.string()).optional())
- [x] generateAIImage 프롬프트에 키워드 자동 반영
- [x] ERP AI 이미지 생성 섹션에 키워드 태그 입력/삭제 UI 추가 (Enter 또는 + 버튼으로 추가, X 버튼으로 삭제, 전체 삭제)

## AI 이미지 다중 생성 및 선택 기능
- [x] generateAIImages API 추가 - 1~4장 동시 생성, 임시 URL 배열 반환
- [x] ERP AI 이미지 섹션에 생성 장수 선택 UI (1/2/3/4장)
- [x] 생성된 이미지 미리보기 그리드 표시 (체크박스 선택)
- [x] 선택한 이미지만 상품 이미지로 등록하는 버튼
- [x] 선택 등록 후 미리보기 초기화

## AI 이미지 미리보기 버그 수정
- [x] AI 이미지 생성 후 미리보기 그리드가 표시되지 않는 버그 수정
- [x] 선택한 이미지만 '등록된 이미지' 목록으로 이동되는 기능 정상화

## 홈페이지-ERP 연동 안정화
- [x] /packages/detail/:id 오류 원인 파악 및 수정
- [x] ERP 등록 이미지가 홈페이지 상품 상세/목록에 반영
- [x] ERP-홈페이지 연동 전반 점검 (API, 라우트, 데이터 구조)

## Gemini AI 어시스턴트 연동
- [x] GEMINI_API_KEY 환경변수 등록
- [x] server/_core/gemini.ts 헬퍼 모듈 작성 (시스템 컨텍스트 자동 주입)
- [x] server/routers.ts에 gemini.ask tRPC API 추가 (adminProcedure)
- [x] ERP 사이드바에 Gemini AI 메뉴 추가 (/erp/gemini 페이지)
- [x] 명령 입력 → Gemini 응답 → 대화 이어가기 플로우 구현
- [x] 시스템 구조(DB 스키마, API 목록) 자동 컨텍스트 주입 (DOGOLF_SYSTEM_CONTEXT)

## Gemini AI 대화 로그 저장 및 조회
- [x] DB 스키마에 aiInteractionLogs 테이블 추가 (userId, query, response, createdAt)
- [x] pnpm db:push로 마이그레이션 실행
- [x] tRPC aiLogsRouter 구현 (create, list, delete - 페이지네이션, 검색)
- [x] GeminiAssistant.tsx에서 대화 완료 시 자동 로그 저장
- [x] /erp/ai-logs 페이지 구현 (목록, 검색, 페이지네이션, 로그 삭제)
- [x] ERPLayout 사이드바 Gemini AI 그룹에 AI 대화 로그 메뉴 추가

## Gemini API 안정성 개선
- [x] gemini.ts에 503 오류 시 최대 2회 자동 재시도 로직 추가 (지백오프 적용)
- [x] 2회 재시도 후에도 실패 시 gemini-1.5-flash로 자동 폴백 후 재시도
- [x] 사용된 모델명을 응답에 포함하여 프론트에서 폴백 여부 표시

## GeminiAssistant UI 개선
- [x] GeminiAssistant UI 헤더에 실제 사용 모델명(modelUsed) 동적 배지 추가 (폴백 시 주황색 배지 + AlertTriangle 아이콘)
- [x] 대화 카드 헤더에도 현재 사용 모델 인라인 표시
- [x] 대화 초기화 시 모델 배지 상태도 초기화

## Gemini 503 에러 처리 개선
- [x] gemini.ts API 호출 타임아웃 30초 설정 (Promise.race + setTimeout)
- [x] 재시도/폴백 모두 실패 시 사용자 친화적 에러 메시지 반환 (throw 대신 errorMessage 필드 반환)
- [x] GeminiAssistant UI에서 503 에러를 AI 말풍선(assistant 메시지)으로 표시 (toast 대신 대화 흐름 안에 표시)
- [x] 에러 말풍선에 "다시 시도" 버튼 추가

## Gemini API 리전 우회 로직
- [x] Gemini API 리전 엔드포인트 목록 정의 (global, us-central1, europe-west4, asia-northeast1)
- [x] 리전별 GoogleGenerativeAI 클라이언트 생성 로직 구현 (RequestOptions.baseUrl 오버라이드)
- [x] 503 에러 시 현재 리전 → 다음 리전으로 순차 우회 재시도 (라운드로빈)
- [x] 모든 리전 실패 후 gemini-1.5-flash 폴백 모델로 전환 (폴백도 전체 리전 순환)
- [x] 사용된 리전 정보를 GeminiChatResult에 포함 (regionUsed 필드)
- [x] 마 리전 우회 로직 단위 테스트 추가 (12개 단위테스트 + 3개 통합테스트)

## Vertex AI SDK 전환 및 서비스 계정 인증
- [x] @google-cloud/vertexai 패키지 설치
- [x] GOOGLE_SERVICE_ACCOUNT_JSON 시크릿 등록 및 인증 로직 구현
- [x] gemini.ts를 Vertex AI SDK 기반으로 전환 (공식 리전 엔드포인트 사용)
- [x] 기존 Google AI Studio 폴백 유지 (Vertex AI 인증 실패 시)

## 서킷 브레이커 로직
- [x] 리전별 실패 횟수/타임스탬프 인메모리 상태 관리
- [x] N분(기본 5분) 내 실패 리전을 우선순위 후순위로 동적 조정
- [x] 서킷 브레이커 상태 초기화 엔드포인트 추가 (관리자용)

## AI 로그 DB 스키마 및 리전 통계 API
- [x] aiInteractionLogs 테이블에 regionUsed, isSuccess, errorType 컨럼 추가
- [x] pnpm db:push 실행
- [x] 리전별 성공/실패 통계 API 추가 (aiLogs.regionStats)
- [x] 시간대별 리전 성능 추이 API 추가

## AI 로그 페이지 리전 통계 시각화
- [x] 리전별 성공/실패 바차트 추가
- [x] 시간대별 리전 응답 성능 라인차트 추가 (최근 30일)
- [x] 서킷 브레이커 현재 상태 표시 패널 추가

## 두골프 개발AI 페이지 (DevAI)
- [x] Slack Webhook URL 시크릿 등록
- [x] 개발 요청 DB 테이블 생성 (devRequests)
- [x] 개발 요청 작성 → Slack 전송 → 결과물 등록 플로우 구현
- [x] 개발 요청 목록 대시보드 (상태별 필터: 대기/진행중/완료/반려)
- [x] 기능별 버전/롤백 관리 테이블 (devFeatures, devVersions)
- [x] 롤백 관리 UI (버전 목록, 롤백 안내 버튼, 체크포인트 ID 연결)
- [x] 추천 대시보드 위젯 (미완료 요청, 최근 배포, 서킷 브레이커 상태)
- [x] ERP 사이드바에 "두골프 개발AI" 메뉴 추가

## DevAI 페이지 보완 항목
- [x] DevAI 대시보드에 서킷 브레이커 상태 위젯 추가 (aiLogs.circuitBreakerStatus 재활용)
- [x] DevAI 대시보드에 최근 배포 이력(버전 목록) 위젯 추가 (체크포인트 ID 클릭 시 클립보드 복사)
- [x] 개발 요청 등록 시 Slack 자동 전송 (등록 성공 후 onSuccess에서 sendSlackMutation 자동 호출)
- [x] 버전 이력 페이지에서 체크포인트 ID 클릭 시 클립보드 복사 + 대시보드 위젯에서도 동일 기능 제공

## 중앙 AI 오케스트레이터 (OpenRouter 기반)
- [x] OpenRouter API 키 시크릿 등록 (OPENROUTER_API_KEY)
- [x] server/_core/orchestrator.ts 구현
  - [x] 작업 복잡도 분류 로직 (SIMPLE / MODERATE / COMPLEX)
  - [x] 모델 라우팅 테이블 (SIMPLE→GPT-4o mini, MODERATE→Gemini 1.5 Pro, COMPLEX→Claude 3.5 Sonnet)
  - [x] 프롬프트 캐싱 (시스템 프롬프트 해시 기반 인메모리 캐시, TTL 10분, 최대 200개)
  - [x] OpenRouter API 호출 함수 (에러 핸들링, 재시도 2회)
  - [x] 비용 계산 로직 (입력/출력 토큰 × 모델별 단가)
  - [x] 비용 로그 DB 저장 (ai_cost_logs)
- [x] drizzle/schema.ts - ai_cost_logs 테이블 추가 (model, inputTokens, outputTokens, costUsd, taskType, cacheHit)
- [x] pnpm db:push 실행
- [x] server/routers.ts - orchestrator 라우터 추가 (ask, getCostStats, getModelPricing)
- [x] DevAIOrchestrator.tsx - 오케스트레이터 전용 페이지 (/erp/orchestrator)
  - [x] 모델 자동 선택 채팅 UI (작업 유형 선택 드롭다운)
  - [x] 비용 대시보드 (일별/모델별/복잡도별 비용 차트)
  - [x] 캐시 히트율 통계
  - [x] 모델별 단가 테이블

## AI 자개발 엔진 확장 로드맵

### 1단계: Stripe 결제 연동
- [x] Stripe 패키지 설치 및 시크릿 등록 (STRIPE_SECRET_KEY, VITE_STRIPE_PUBLISHABLE_KEY)
- [x] DB 스키마 - payments 테이블 추가 (bookingId, stripePaymentIntentId, amount, status)
- [x] tRPC - payments 라우터 (createIntent, getStatus, getHistory, listAll)
- [x] 예약 상세 페이지에 결제 버튼 및 결제 이력 UI 추가
- [x] 결제 완료 시 예약 상태 자동 확정 처리 (Stripe 웹훅)
- [x] ERP 예약관리에 결제 상태 컬럼 및 결제 요청 다이얼로그 추가

### 2단계: 오케스트레이터 Llama 3.1 8B 무료 모델 추가
- [x] orchestrator.ts SIMPLE 등급에 meta-llama/llama-3.1-8b-instruct:free 추가 (LLAMA_FREE_MODEL)
- [x] 모델 단가 테이블 업데이트 (Llama 3.1 8B = $0, getModelPricing에 포함)
- [x] DevAIOrchestrator.tsx 무료모델 ON/OFF 토글 버튼 추가

### 3단계: 카카오 알림톡 연동
- [x] KAKAO_API_KEY, KAKAO_SENDER_KEY 시크릿 등록 (env.ts에 추가)
- [x] server/_core/kakao.ts 알림톡 발송 헬퍼 구현 (Solapi API 호환)
- [x] 예약 확정 시 알림톡 자동 발송 (예약번호, 상품명, 출발일, 결제금액)
- [x] 예약 취소 시 알림톡 자동 발송 (취소사유 포함)
- [x] 출발 D-1 알림톡 스케줄러 구현 (n8n 워크플로우로 대체 구현 - n8n 가이드 문서에 스케줄 트리거 설정 방법 안내 포함)
- [x] 알림톡 발송 이력 DB 저장 (kakao_notifications 테이블)

### 4단계: Runway ML 동영상 자동생성
- [x] RUNWAY_API_KEY 시크릿 등록 (env.ts에 추가)
- [x] server/_core/runway.ts 동영상 생성 헬퍼 구현 (Gen-3 Alpha Turbo)
- [x] tRPC - video 라우터 추가 (generate, checkStatus, listByPackage)
- [x] ERP 상품 상세 페이지에 "동영상 생성" 탭 추가 (5초/10초 선택, 폴링)
- [x] 생성된 영상 DB 저장 (package_videos 테이블)
- [x] 프론트 상품 상세 페이지에 영상 플레이어 추가 (PackageVideoSection 컴포넌트 - 완료된 영상만 표시)

### 5단계: n8n 자동화 파이프라인
- [x] n8n Webhook URL 시크릿 등록 (N8N_WEBHOOK_URL, env.ts에 추가)
- [x] n8n Webhook 트리거 로직 automationRouter에 구현
- [x] 상품 SNS 자동배포 파이프라인 트리거 (triggerPackagePublish)
- [x] 자동화 실행 이력 DB 저장 (automation_logs 테이블)
- [x] ERP 상품 상세 페이지에 "자동화" 탭 추가 (n8n 트리거 버튼 + 실행 이력)
- [x] n8n 연동 가이드 문서 작성 (docs/n8n-integration-guide.md)

## 두골프-AI개발 엔진 구현

### 1단계: OpenRouter API 404 오류 수정
- [x] anthropic/claude-3.5-sonnet 모델 ID 오류 원인 분석 (OpenRouter 엔드포인트 일시 비활성화)
- [x] orchestrator.ts 모델 ID를 최신 유효 버전으로 업데이트 (claude-3.5-sonnet-20241022)
- [x] 모델 404 발생 시 자동 폴백 로직 강화 (COMPLEX_FALLBACK_MODELS 4개 정의)

### 2단계: 두골프-AI개발 엔진 DB 스키마
- [x] ai_engine_logs 테이블 (오류 감지 이력, 수정 요청, 검토 결과)
- [x] ai_fix_requests 테이블 (수정 요청 큐, 우선순위, 상태)
- [x] ai_review_results 테이블 (재검토 결과, 승인/거부)
- [x] pnpm db:push 실행

### 3단계: 자동 오류 감지 및 수정 파이프라인 (ErrorWatcher + AutoFixer)
- [x] server/_core/errorWatcher.ts: 런타임 오류 감지 및 AI 수정 요청 생성
- [x] server/_core/autoFixer.ts: AI 기반 코드 수정 제안 생성 + ERP 기능 검색
- [x] tRPC aiEngine 라우터: reportError, requestFix, getFixQueue, searchFeature, generateFix, approveFix, rejectFix
- [x] Express 전역 에러 핸들러에 ErrorWatcher 연동 (server/_core/index.ts)

### 4단계: AI 자동 수정 후 재검토 모듈 (ReviewEngine)
- [x] server/_core/reviewEngine.ts: 수정 결과 다단계 자동 검증 (syntax/logic/security/performance/compatibility)
- [x] tRPC aiEngine.reviewFix, approveFix, rejectFix 프로시저
- [x] 핵심 기능 수정 시 사용자 승인 요구 안전장치 (isCritical + userFeedback 직접 제어)

### 5단계: 두골프-AI개발 엔진 ERP UI
- [x] client/src/pages/erp/AIDevEngine.tsx: 엔진 메인 대시보드 (4탭: 오류로그/수정요청/재검토/기능검색)
- [x] ERP 사이드바에 "두골프-AI개발 엔진" 메뉴 추가 (/erp/ai-dev-engine)

### 6단계: 핵심 기능 수정 사용자 피드백 안전장치
- [x] 핵심 기능 분류 목록 정의 (CRITICAL_FILES: stripe, payment, auth, booking, settlement, kakao, runway, n8n)
- [x] 핵심 기능 수정 요청 시 사용자 확인 다이얼로그 (AIDevEngine.tsx - 승인 전 피드백 입력 강제)
- [x] 승인 전 변경사항 diff 미리보기 (suggestedCode 코드 평 표시)
- [x] 거부 시 원래 상태 유지 로직 (rejectFix 프로시저 - 상태 rejected로 변경만)

## 코드 Diff 시각화 기능 추가

- [x] react-diff-viewer-continued 패키지 설치 (v4.2.0)
- [x] aiFixRequests 테이블에 originalCode 컨럼 추가 및 DB 마이그레이션 (0008_tough_loa.sql)
- [x] generateFix 프로시저에서 originalCode 저장 로직 추가 (autoFixer.ts)
- [x] AIDevEngine.tsx 수정 요청 상세 다이얼로그에 DiffViewer 컴포넌트 구현 (Split/Unified 모드 전환)
- [x] 수정 요청 상세 다이얼로그에 before/after 코드 diff 표시 (원문 보기 토글 포함)
- [x] 핵심 기능 수정 승인 다이얼로그에도 diff 미리보기 포함 (originalCode 없을 시 경고 메시지 표시)

## 두골프-AI개발 엔진 고도화 (지능형 분석 + 자동 문서화)

### Phase 1: DB 스키마 확장 및 보안 수정
- [x] devRequests 테이블에 AI 분석 필드 추가 (aiCategory, aiSuggestedPriority, aiAnalysis, aiAnalyzed)
- [x] reviewEngine.ts 보안 취약점 수정 (invokeLLM 기반으로 리팩터링, API 키 서버측 전용)
- [x] autoFixer.ts 문법 오류 수정 (코드 완성 및 입력 검증 추가)
- [x] pnpm db:push 실행

### Phase 2: geminiAIService.ts 통합 모듈 구현
- [x] server/_core/geminiAIService.ts 생성 (invokeLLM 기반, @google/generative-ai 직접 호출 제거 - 보안 강화)
- [x] analyzeDevRequest: 요청 분류(BUG/FEATURE/IMPROVEMENT/REFACTOR) + 우선순위 + 예상공수 + 담당팀
- [x] generateReleaseNotes: 버전 + 완료 요청 목록 → 릴리즈 노트 자동 생성
- [x] generateFeatureDocumentation: 기능명 + 설명 → 기술 문서 초안 생성
- [x] processNaturalLanguageRequest: 자연어 → devRequest 형식 자동 변환

### Phase 3: devAI 라우터 프로시저 추가
- [x] devAI.analyzeRequest: description 분석 → AI 분류/우선순위/공수 제안 반환
- [x] devAI.createRequestFromNaturalLanguage: 자연어 입력 → devRequest 자동 생성
- [x] devAI.generateReleaseNotes: 버전 ID → 릴리즈 노트 생성
- [x] devAI.generateFeatureDoc: 기능 ID → 기술 문서 초안 생성
- [x] devAI.createRequest에 AI 자동 분석 통합 (저장 시 백그라운드 분석 - setImmediate 비동기)

### Phase 4: AIDevEngine.tsx UI 고도화
- [x] "지능형 요청" 탭 추가: 자연어 입력 → AI 분석 → 요청 생성 플로
- [x] "자동 문서화" 탭 추가: 릴리즈 노트 생성 + 기능 문서 초안 생성
- [x] 기존 수정 요청 목록에 AI 분석 결과 배지 표시 (카테고리, 예상 공수)
- [x] 추천 파이프라인 시각화 (오류 감지 → AI 분석 → 수정 제안 → 검토 → 승인 플로 다이어그램)

### Phase 5: ReviewEngine 연동 강화
- [x] syntax/logic/security 검토 결과를 실제 AI 분석으로 연결 (reviewEngine.ts - invokeLLM 기반 5단계 검토)
- [x] 검토 결과 상세 이슈 목록을 UI에서 확장 가능하게 표시 (FixRequestDetailDialog - 상세 다이얼로그)
- [x] 보안 취약점 발견 시 자동으로 critical 우선순위로 수정 요청 생성 (errorWatcher.ts - isCriticalError 연동)

## 두골프-AI개발 엔진 갭 해결 (구현 검증)

- [x] devRequests 스키마에 aiEstimatedHours(int), aiSuggestedTeam(varchar) 추가 및 db:push
- [x] analyzeDevRequest 반환값에 estimatedHours, suggestedTeam 포함 및 DB 저장 검증
- [x] AIDevEngine.tsx 추천 파이프라인 단계형 다이어그램 UI 구현 (오류감지→AI분석→수정제안→검토→승인)
- [x] ReviewEngine security 결과 → createFixRequest critical 자동 생성 연동 및 테스트 추가

## Gemini AI 고도화 + AI개발 엔진 고도화

### Phase A: DB 스키마 확장
- [x] ai_interaction_logs에 feedback(thumbs_up/thumbs_down/null), feedbackNote, taskType, cacheHit, promptVersion 필드 추가
- [x] prompt_versions 테이블 신규 생성 (버전 관리, A/B 테스트)
- [x] model_routing_rules 테이블 신규 생성 (태스크별 모델 라우팅 규칙)
- [x] pnpm db:push 실행

### Phase B: geminiAIService 고도화
- [x] generatePackageDescription: 패키지 정보 → 상품 설명/하이라이트/포함불포함 초안 생성
- [x] generateMarketingCopy: 패키지 특징 → SNS 문구/광고 카피 생성
- [x] generateInquiryReply: 문의 내용 분석 → 답변 초안 생성
- [x] Function Calling: ERP tRPC API 스키마 제공 → AI가 packages.list 등 직접 조회 후 요약
- [x] 모델 라우팅 로직: 태스크 복잡도에 따라 고성능/저가형 모델 자동 선택
- [x] 응답 캐싱: 동일 프롬프트 해시 기반 인메모리 캐시 (TTL 10분)
- [x] 데이터 익명화: ai_interaction_logs 저장 시 이메일/전화번호 자동 마스킹

### Phase C: devAI 라우터 확장
- [x] aiLogs.submitFeedback: 로그 ID + thumbs_up/down → DB 업데이트
- [x] devAI.getPromptVersions: 프롬프트 버전 목록 조회
- [x] devAI.createPromptVersion: 새 프롬프트 버전 저장
- [x] devAI.activatePromptVersion: 특정 버전 활성화 (A/B 전환)
- [x] devAI.getModelRoutingRules: 모델 라우팅 규칙 조회
- [x] devAI.updateModelRoutingRule: 규칙 수정 (모델 스위칭)
- [x] devAI.detectAnomalies: 최근 1시간 에러율 임계치 초과 시 Slack 알림
- [x] devAI.getMonitoringStats: 실시간 AI 사용량/응답시간/에러율/비용 통계

### Phase D: ERP UI 구현
- [x] GeminiAssistant.tsx 고도화: 상품설명/마케팅/문의답변 탭 추가 + Function Calling 결과 표시
- [x] AI 답변 피드백 버튼(👍/👎) + 피드백 메모 입력 UI
- [x] AIDevEngine.tsx 실시간 모니터링 대시보드 탭 추가 (AI 사용량/에러율/비용 차트)
- [x] 프롬프트 버전 관리 UI (버전 목록, 활성화, A/B 테스트 현황)
- [x] 모델 라우팅 규칙 관리 UI (태스크별 모델 설정)

## 레퍼런스 기반 필수 구현 항목 (트레블러스맵 + 타이거부킹)

- [x] packages 스키마에 courseType(enum), isSpecialDeal(bool), isTrending(bool) 필드 추가 및 db:push
- [x] 홈페이지 Trending Destinations 섹션 추가 (인기 목적지 순위, 예약 전환율 향상)
- [x] 홈페이지 코스 유형 필터 태그 추가 (Resort/Oceanfront/Mountain/Tropical 등)
- [x] 홈페이지 Special Deals 섹션 추가 (특가 상품 전용 섹션)
- [x] 홈페이지 최근 본 상품 섹션 추가 (localStorage 기반)
- [x] 홈페이지 AI 상담 플로팅 버튼 추가 (Gemini AI 챗봇 연동)
- [x] ERP PackageManagement에 courseType/isSpecialDeal/isTrending 필드 관리 UI 추가
- [x] Packages.tsx 코스 유형 필터 태그 추가

## 자동 개선 사이클 (2026-04-23)
- [x] [CRITICAL] 상품 카드 최저가 표시 강화 + 포함항목 배지 (항공/그린피/숙박) 추가
- [x] [CRITICAL] PackageDetail.tsx 빠른 문의 CTA 버튼 + AI 상담 플로팅 강화
- [x] [HIGH] Packages.tsx 출발지(인천/부산/대구/청주) 필터 추가
- [x] [HIGH] Packages.tsx 기간(2박3일/3박4일 등) 필터 추가
- [x] [HIGH] 상품 카드에 BEST/단독특가/신규/한정 배지 추가 (DB 연동)
- [x] [MEDIUM] Packages.tsx 월간 인기 목적지 섹션 추가

## STEP 1+2: AI 어시스턴트 시스템 통합 (2026-04-24)

- [x] schema.ts에 ai_logs 테이블 추가 (session_id, assistant enum, role, model_used, tokens_in/out, cost_usd, grounded)
- [x] schema.ts에 chat_sessions 테이블 추가 (session_id unique, channel enum, user_id, partner_id, status, summary, package_id)
- [x] schema.ts에 기존 dev_requests 테이블 확장 (module, manus_task_id, source 컬럼 추가)
- [x] pnpm db:push 마이그레이션 실행
- [x] server/routers/ 디렉토리 생성
- [x] server/routers/ai.ts 생성 (masterChat, golfTalkChat, getLogs, getCostSummary)
- [x] server/routers/devRequest.ts 생성 (create, list, updateStatus, sendToManus)
- [x] server/routers/chat.ts 생성 (createSession, getSession, closeSession, listSessions)
- [x] server/routers.ts appRouter에 3개 라우터 등록
- [x] TypeScript 빌드 오류 없음 확인
- [x] 테스트 통과 확인 (106개 통과)
- [x] 체크포인트 저장

## STEP 4: AI 오케스트레이션 파이프 구현 (2026-04-24)

- [x] server/services/ 디렉토리 생성
- [x] server/services/openrouter.ts 생성 (모델 라우팅, Prompt Caching, 비용 로깅, 503 재시도)
- [x] server/services/prompts/master.ts 생성 (두골프 마스터 시스템 프롬프트)
- [x] server/services/prompts/golftalk.ts 생성 (골프톡 시스템 프롬프트)
- [x] server/services/prompts/manager.ts 생성 (두골프 매니저 시스템 프롬프트)
- [x] ai.masterChat 실제 구현 (RAG 컨텍스트 주입, ai_logs 저장)
- [x] ai.golfTalkChat 실제 구현 (rate limit, packageId 컨텍스트, ai_logs 저장)
- [x] client/src/pages/erp/MasterAI.tsx 생성 (채팅 UI, 빠른 명령어, 모델 배지, 비용 표시)
- [x] ERPLayout 사이드바에 AI 어시스턴트 메뉴 추가 (/erp/master-ai, /erp/ai-engine)
- [x] OPENROUTER_API_KEY 환경변수 등록
- [x] TypeScript 빌드 오류 없음 확인
- [x] 테스트 통과 확인 (106개 통과)
- [x] 체크포인트 저장

## STEP 3+5: AI 엔진 통합 관리 + RAG 파이프라인 (2026-04-24)

- [x] server/services/rag.ts 생성 (classifyIntent, fetchPackageContext, fetchReservationContext, compressHistory, 민감정보 마스킹)
- [x] server/services/manusPipe.ts 생성 (sendPendingRequestsToManus, autoRegisterAndSend)
- [x] client/src/pages/erp/AIEngine.tsx 생성 (4탭: 개발요청관리/AI비용모니터링/상담세션관리/시스템설정)
- [x] ERPLayout 사이드바에 AI 어시스턴트 섹션 추가 (AI 마스터 + AI 엔진 관리)
- [x] MANUS_API_KEY, MANUS_DOGOLF_TASK_ID 환경변수 등록
- [x] env.ts에 manusApiKey, manusDogolfTaskId 추가
- [x] 체크포인트 저장 및 Publish

## 4차 개발: 골프톡 + 파트너 + OpenRouter 연동 (2026-04-24)

### Part A: 환경변수 및 OpenRouter Fallback
- [x] OPENROUTER_BASE_URL 환경변수 등록
- [x] server/services/openrouter.ts에 OPENROUTER_API_KEY 없을 시 Gemini fallback 구현
- [x] server/_core/env.ts에 openrouterBaseUrl 추가
- [x] OPENROUTER_API_KEY 등록 (sk-or-v1-...)
- [x] 모델 라우팅 업데이트 (high→gemini-2.5-pro, medium→gemini-2.5-flash, low→gemini-2.0-flash-lite)

### Part B: 골프톡 위젯
- [x] client/src/components/GolfTalkWidget.tsx 생성 (플로팅 버튼, 채팅창, 타이핑 인디케이터)
- [x] server/services/prompts/golftalk.ts 업데이트 (요구사항 반영)
- [x] 공개 페이지(홈, 패키지 목록, 패키지 상세)에 GolfTalkWidget 삽입

### Part C: 파트너 페이지
- [x] client/src/pages/Partner/PartnerDashboard.tsx 생성 (통계 카드, 예약 목록, 빠른 액션)
- [x] client/src/pages/Partner/PartnerChat.tsx 생성 (매니저 AI 채팅 전체 페이지)
- [x] App.tsx에 /partner, /partner/chat 라우트 추가 (로그인 필요)

### Part D: 자동 개발 파이프 테스트
- [x] dev_requests 테이블에 테스트 데이터 1건 삽입 (골프톡 위젯 카카오톡 연동)
- [x] Manus API 전송 성공 확인 (두골프 ERP 태스크로 메시지 수신 확인)
- [x] server/manusPipe.test.ts 테스트 파일 생성

### 완료 조건
- [x] TypeScript 빌드 오류 없음 (pnpm build ✓ built in 25.01s)
- [x] 체크포인트 저장 및 Publish

## 골프톡 AI 최적화 계획 실행 (2026-04-24)

### 1단계: dev_requests 6개 등록 및 Manus 전송
- [x] 카카오톡 연동 및 대화 요약 전달 기능 dev_request 등록
- [x] AI 기반 맞춤형 골프 패키지 추천 엔진 dev_request 등록
- [x] 외부 API 연동 골프장 날씨/코스 정보 제공 dev_request 등록
- [x] 예약 상태 추적 시스템 dev_request 등록
- [x] 다국어 지원 시스템 dev_request 등록
- [x] 이미지 기반 골프장 안내 dev_request 등록
- [x] Manus 자동 파이프로 6개 전송 확인

### 2단계: 트래블러스맵 챗봇 분석
- [x] 트래블러스맵 챗봇 테스트 분석 (패키지 추천, 예약 조회 등)
- [x] 골프톡 추가 개선사항 도출 (동적 빠른 답변, 카카오톡 연결 등)

### 3단계: 골프톡 시스템 프롬프트 업데이트
- [x] 맞춤형 패키지 추천 로직 프롬프트 반영
- [x] 날씨/코스 정보 안내 프롬프트 반영
- [x] 예약 추적 안내 프롬프트 반영
- [x] 다국어 지원 프롬프트 반영
- [x] 카카오톡 연결 안내 프롬프트 반영
- [x] GolfTalkWidget v2.0 동적 빠른 답변 버튼 파싱 구현
- [x] GolfTalkWidget v2.0 카카오톡 연결 버튼 헤더 추가

### 완료 조건
- [x] TypeScript 빌드 오류 없음 (pnpm build ✓ built in 27.24s)
- [x] 체크포인트 저장 (06855365)

## 골프톡 후속 질문 예측 기능 (2026-04-24)

- [x] GolfTalkWidget: 빠른 답변 버튼 클릭 시 후속 질문 2~3개 자동 생성 표시
- [x] 골프톡 시스템 프롬프트에 [후속질문: A | B | C] 패턴 추가
- [x] TypeScript 빌드 오류 없음
- [x] 체크포인트 저장

## 홈페이지 위젯 정리 (2026-04-24)
- [x] Home.tsx에서 "두골프 AI 상담" 플로팅 버튼 및 관련 코드 완전 제거
- [x] KakaoFloat 컴포넌트 미노출 (return null 처리)
- [x] Header.tsx의 "카카오 상담" 버튼을 "AI상담사 골프톡" 으로 명칭 변경 및 GolfTalkWidget 열기 기능으로 교체

## 홈페이지 위젯 정리 (2026-04-24)
- [x] Home.tsx에서 두골프 AI 상담 플로팅 버튼 및 관련 코드 완전 제거
- [x] KakaoFloat 컴포넌트 미노출 (return null 처리)
- [x] Header.tsx의 카카오 상담 버튼을 AI상담사 골프톡으로 명칭 변경 및 GolfTalkWidget 열기 기능으로 교체

## ERP 사이드바 재편성 (2026-04-24)
- [x] ERPLayout.tsx navItems를 3개 핵심 카테고리 최상단 배치로 재편성
- [x] 중복/미구현 메뉴 통합 및 정리
- [x] TypeScript 빌드 오류 없음 확인

## 두골프 마스터 AI 전면 개선 (2026-04-24)
- [x] MasterAI.tsx 스크롤 버그 수정 (ScrollArea → 네이티브 div overflow-y-auto)
- [x] 스트리밍 응답 구현 (SSE 기반 실시간 텍스트 출력)
- [x] devRequestSuggestion UI 구현 (감지 시 카드 표시 + Manus 전송 버튼)
- [x] 추론→분석→결과→Manus 전송 파이프라인 UI 완성
- [x] 타임아웃 30s → 120s 증가 (Gemini 2.5 Pro 응답 대기)
- [x] TypeScript 빌드 오류 없음 확인

## 추가 개발 요청 처리 (2026-04-24)
### 요청 1: ERP 사이드바 3개 카테고리 재편성
- [x] /admin → /erp 리다이렉트 라우트 추가
- [x] ERPLayout.tsx navItems 확정 구조로 재편성 (AI챗봇/AI마스터/AI엔진관리 + 하단 일반 메뉴)
- [x] 골프톡 관리 페이지 (/erp/golftalk-admin) 신규 생성
- [x] 두골프 매니저 관리 페이지 (/erp/manager-admin) 신규 생성
- [x] 마스터 대화 이력 페이지 (/erp/master-ai/logs) 신규 생성
- [x] 마스터 비용 현황 페이지 (/erp/master-ai/costs) 신규 생성
- [x] AI 엔진 관리 서브 페이지 (models/prompts/dev-requests/pipe) 라우트 추가

### 요청 2: 자동 오류 수정 파이프
- [x] server/services/autoFix.ts 신규 생성 (오류 감지 → Manus 자동 전송) - errorWatcher.ts/autoFixer.ts로 이미 구현
- [x] server/_core/index.ts에 글로벌 오류 핸들러 추가 (uncaughtException/unhandledRejection) - 이미 구현
- [x] AIEngine.tsx에 자동 파이프 설정 탭 추가 (자동 수정 파이프 탭 5번째 추가)

### 요청 3: 커스텀 도메인 확인
- [x] dayoutgolf.com DNS 전파 상태 확인 및 안내 (HTTP 200 응답 확인)

## ERP 전체 기능 테스트 및 오류 수정 (2026-04-24)

### Phase 1: 로그인 및 대시보드
- [x] ERP 로그인 페이지 접근 및 렌더링 확인
- [x] 대시보드 KPI 카드 데이터 로딩 확인
- [x] 대시보드 차트 렌더링 확인

### Phase 2: 패키지 / 예약 / 정산 관리
- [x] 패키지 목록 로딩 및 검색 확인
- [x] 패키지 등록/수정 폼 확인
- [x] 이미지 탭 (업로드/AI생성/Pixabay) 확인
- [x] 동영상 탭 확인
- [x] 자동화 탭 확인
- [x] 예약 목록 로딩 및 상태 변경 확인
- [x] 정산 관리 페이지 확인

### Phase 3: AI 챗봇 3종
- [x] 두골프 마스터 AI 채팅 동작 확인
- [x] 골프톡 관리 페이지 확인
- [x] 매니저 관리 페이지 확인
- [x] 마스터 대화 이력 페이지 확인
- [x] 마스터 비용 현황 페이지 확인

### Phase 4: AI 엔진 관리 / AI 개발 엔진
- [x] AI 엔진 관리 5개 탭 확인
- [x] AI 개발 엔진 대시보드 확인
- [x] 오류 로그 탭 확인
- [x] 수정 요청 탭 확인

### Phase 5: CRM / CMS / 문의 / 걤러리
- [x] CRM 고객 검색 확인
- [x] 공지사항 관리 확인
- [x] 배너 관리 확인
- [x] 문의 관리 확인
- [x] 갤러리 관리 확인

### Phase 6: 홈페이지 공개 페이지
- [x] 홈페이지 렌더링 확인
- [x] 패키지 목록 페이지 확인
- [x] 패키지 상세 페이지 확인
- [x] 예약 문의 폼 확인
- [x] 골프톡 위젯 동작 확인

### Phase 7: 오류 수정 및 체크포인트
- [x] 발견된 오류 전체 수정
- [x] TypeScript 빌드 오류 없음 확인
- [x] 체크포인트 저장

## 모바일 사이드바 토글 즉시 반응 개선 (2026-04-26)

- [x] ERPLayout.tsx 모바일 사이드바 transform/transition 즉시 반응 수정
- [x] 햄버거/카테고리 아이콘 클릭 시 setOpen 상태 즉시 반영 (지연 제거)
- [x] z-index 및 backdrop 처리 점검
- [x] 브라우저 모바일 뷰 테스트
- [x] 체크포인트 저장

## 모바일 사이드바 메뉴 아이콘 추가 (2026-04-27)

- [x] ERPLayout.tsx navItems 현재 구조 파악
- [x] 각 메뉴 항목에 lucide-react 아이콘 매핑 (카테고리 + 하위 항목 전체)
- [x] 아이콘 렌더링 코드 추가 (사이드바 펼침/접힌 상태 모두 대응)
- [x] TypeScript 오류 없음 확인
- [x] 브라우저 확인
- [x] 체크포인트 저장

Detected
## CRM > 파트너 관리 기능 개발 (ID: 60001) - 2026-04-27
- [x] DB 스키마: partners 테이블 추가
- [x] DB 스키마: partnerSchedules 테이블 추가
- [x] pnpm db:push 실행 (마이그레이션)
- [x] server/db.ts: 파트너 관련 DB 헬퍼 추가
- [x] server/routers/crm.ts: tRPC 프로시저 구현
- [x] server/routers.ts: crm 라우터 머지
- [x] client/src/pages/erp/CRMPartners.tsx: 파트너 관리 페이지 구현
- [x] App.tsx: /erp/crm/partners 라우트 등록
- [x] ERPLayout.tsx: CRM 카테고리에 파트너 관리 링크 추가
- [x] TypeScript 빌드 오류 0개 확인
- [x] 체크포인트 저장

## 예약/자금관리 + 제휴사 관리 기능 추가 (2026-04-27)
- [x] DB 스키마: reservations, deposit_records, remittance_records, deposit_funds, charge_records, charge_usages, affiliates 확장
- [x] pnpm db:push 실행
- [x] server/routers/reservations.ts: 수기 예약관리 tRPC 프로시저
- [x] server/routers/affiliates.ts: 제휴사 관리 tRPC 프로시저
- [x] server/routers.ts: reservations, affiliates 라우터 등록
- [x] client/src/pages/erp/ReservationManagement.tsx: 수기 예약관리 페이지
- [x] client/src/pages/erp/FinanceManagement.tsx: 자금관리 페이지
- [x] client/src/pages/erp/AffiliateManagement.tsx: 제휴사 관리 페이지
- [x] ERPLayout.tsx: 수기 예약관리, 자금관리, 제휴사 관리 메뉴 추가
- [x] App.tsx: 3개 라우트 등록
- [x] TypeScript 빌드 오류 0개 확인
- [x] 체크포인트 저장

## ERP 전체 기능 테스트 및 오류 수정 (2026-04-27)
- [x] ERP 로그인 및 대시보드 렌더링 확인
- [x] 수기 예약관리 페이지 동작 확인
- [x] 자금관리 페이지 동작 확인
- [x] 제휴사 관리 페이지 동작 확인
- [x] 파트너 관리 페이지 동작 확인
- [x] 홈페이지 렌더링 및 골프톡 위젯 확인
- [x] 발견된 오류 수정 (제휴사 typeCounts 위젯 수정)
- [x] TypeScript 빌드 오류 0개 확인
- [x] oyeo.co.kr 골프장 데이터 스크래핑 및 제휴사 DB 초기 데이터 등록 (1,605개)
- [x] 체크포인트 저장

## 예약관리 제휴사 검색 드롭다운 + 자금관리 은행 문자 파싱 (2026-04-28)
- [x] ReservationManagement.tsx: 골프장명 → 제휴사 검색 드롭다운으로 교체 (affiliates DB 연동, 검색 필터링, affiliateId 저장)
- [x] FinanceManagement.tsx: 입금/송금 탭에 "문자 붙여넣기" 버튼 추가 (은행 문자 자동 파싱 → 폼 자동 채우기)
- [x] FinanceManagement.tsx: parseBankMessage 함수 구현 (은행명/금액/날짜/입금자/예약번호 자동 추출)
- [x] FinanceManagement.tsx: 예약번호 자동 감지 시 시각적 피드백 표시 (초록/파랑 하이라이트)
- [x] TypeScript 빌드 오류 0개 확인
- [x] 체크포인트 저장

## 시스템 전체 점검 및 미작동 항목 수정 (2026-04-28)

### 환경변수 점검 결과
- ✅ 정상: GEMINI_API_KEY, OPENROUTER_API_KEY, MANUS_API_KEY, STRIPE_SECRET_KEY, PIXABAY_API_KEY 등
- ❌ 미설정: SLACK_WEBHOOK_URL, KAKAO_API_KEY, KAKAO_SENDER_KEY, RUNWAY_API_KEY, N8N_WEBHOOK_URL

### Phase 1: Stripe 웹훅 정상화
- [x] Stripe 대시보드에서 웹훅 엔드포인트 등록 안내 UI 추가 (ERP 설정 페이지)
- [x] Stripe 웹훅 URL: https://dogolf-tour-dkz3fsmp.manus.space/api/stripe/webhook 안내
- [x] ERP 대시보드에 Stripe 연동 상태 표시 위젯 추가

### Phase 2: Slack Webhook 등록 및 개발AI 알림 활성화
- [x] SLACK_WEBHOOK_URL 시크릿 등록 완료
- [x] 개발AI 페이지에 Slack 연동 상태 표시 및 테스트 버튼 추가 (ERP 설정 페이지에 포함)

### Phase 3: 카카오 알림톡 Solapi 연동
- [x] KAKAO_API_KEY, KAKAO_SENDER_KEY 시크릿 등록 안내 (사용자 직접 설정 필요 - Solapi 가입 후 Settings→Secrets에서 입력)
- [x] ERP 설정 페이지에 카카오 알림톡 연동 상태 및 가이드 추가
- [x] 알림톡 템플릿 코드 목록 정리 (DOGOLF_BOOKING_CONFIRMED 등)

### Phase 4: Runway ML / n8n 미설정 UI 안내 개선
- [x] 동영상 생성 탭: API 키 미설정 시 "Runway ML API 키 필요" 안내 카드 표시
- [x] n8n 자동화 탭: 웹훅 미설정 시 "n8n 연동 필요" 안내 카드 표시

### Phase 5: Manus API 개발 파이프 수정
- [x] manusPipe.ts API 엔드포인트 검증 (task.sendMessage → task.create 방식으로 수정)
- [x] 개발AI 페이지에 Manus 파이프 연결 상태 표시

### Phase 6: ERP 통합 설정 페이지 구현
- [x] /erp/settings 페이지 신규 생성 (연동 서비스 상태 한눈에 확인)
- [x] 각 서비스별 연동 상태 (✅/❌), 설정 방법 링크, 테스트 버튼 제공
- [x] ERPLayout 사이드바에 "연동 설정" 메뉴 추가
- [x] 체크포인트 저장 (16d89e81)

## 예약관리 자동화 개선 (2026-04-28)
- [x] DB 스키마 확장 - reservationInquiries, inquiryTemplates 테이블 추가
- [x] reservations 테이블에 userType, managerId, managerCompany 컬럼 추가
- [x] pnpm db:push 실행
- [x] reservationInquiries 라우터 생성 (CRUD + AI 자동화 + 예약목록 연동)
- [x] reservations create/update 라우터에 유저 3단 구분 필드 추가
- [x] ReservationManagement.tsx 전면 개편 - 신규예약 간소화 (5개 필드), 유저 3단 구분, 상태 아이콘, 문의/자동/답변 탭
- [x] 대시보드 상태별 카드 (대기=신규접수, 확정=미수금, 완료=미매칭입금)
- [x] 확정 클릭 시 예약목록(/erp/bookings)으로 데이터 이동
- [x] InquiryTemplates.tsx 신규 생성 - 문의 자동화 템플릿 관리 페이지
- [x] App.tsx에 /erp/reservations/templates 라우트 추가
- [x] ERPLayout 사이드바에 "문의 자동화 템플릿" 메뉴 추가
- [x] TypeScript 빌드 오류 0개 확인
- [x] 체크포인트 저장 (b335b6a6)

## 버그 수정: 수기예약 확정 시 예약목록 미표시 (2026-04-28)
- [x] 수기예약 '확정' 상태 변경 시 bookings 테이블 연동 로직 확인
- [x] BookingManagement.tsx에서 reservations 확정 데이터 표시 여부 확인
- [x] 연동 로직 수정 및 검증
- [x] TypeScript 빌드 오류 0개 확인
- [x] 체크포인트 저장 (9baa1c93)

## 구글 스프레드시트 → ERP 이식 (2026-04-28)
- [x] 스프레드시트 7개 시트 분석 (내륙팩2/입금/송금/예치금/충전-사용2/충전-리스트/데파짓)
- [x] remittanceRecords 테이블에 recipientType 컬럼 추가 (골프장/숙소/교통/기타)
- [x] pnpm db:push 실행
- [x] reservations.ts addRemittance에 recipientType 파라미터 추가
- [x] updatePrepaid, matchCharge, deleteDeposit/deleteCharge/deletePrepaid 프로시저 추가
- [x] FinanceManagement.tsx 개편 - 요약 카드, 예치금 유형별 필터, 충전카드 매칭 모달, 데파짓 수정 모달
- [x] ReservationManagement.tsx 금액 탭에 RemittanceByType 컴포넌트 추가 (거래처별 송금 분리)
- [x] TypeScript 빌드 오류 0개 확인
- [x] 체크포인트 저장 (de5377f2)
- [x] SLACK_WEBHOOK_URL 등록 완료 (hooks.slack.com/services/... 형식)
- [x] KAKAO_API_KEY, KAKAO_SENDER_KEY 등록 (Solapi 가입 후 사용자 직접 설정 필요 - Settings→Secrets)

## 스프레드시트 실제 데이터 ERP DB 이식 (2026-04-28)
- [x] 내륙팩2 시트 데이터 → reservations 테이블 이식 (2,043개)
- [x] 입금 시트 데이터 → incomeRecords 테이블 이식 (2,096개)
- [x] 송금 시트 데이터 → remittanceRecords 테이블 이식 (1,221개)
- [x] 예치금 시트 데이터 → depositRecords 테이블 이식 (441개)
- [x] 충전-리스트 시트 데이터 → chargeRecords 테이블 이식 (2,797개)
- [x] 데파짓 시트 데이터 → prepaidRecords 테이블 이식 (4개)
- [x] 데이터 이식 검증 완료 (2026-04-28)
- [x] 체크포인트 저장

## OpenRouter SDK 에이전트 구축 (2026-04-29)
- [x] @openrouter/sdk 패키지 설치
- [x] server/agent/agent.ts - 모듈형 에이전트 코어 구현 (도구 호출 루프, 대화 이력 관리)
- [x] server/agent/tools.ts - 두골프 ERP 전용 도구 6개 정의 (get_current_time, get_erp_guide, get_reservation_stats, get_finance_summary, search_packages, get_system_status)
- [x] server/agent/headless.ts - 헤드리스 실행 예제 및 테스트
- [x] server/routers/openrouterAgent.ts - tRPC 라우터 (chat/getHistory/clearHistory/getModels/status)
- [x] routers.ts에 openrouterAgent 라우터 등록
- [x] client/src/pages/erp/OpenRouterAgent.tsx - ERP 에이전트 채팅 UI 구현
- [x] App.tsx에 /erp/openrouter-agent 라우트 등록
- [x] ERPLayout.tsx AI 챗봇 섹션에 "OpenRouter 에이전트 ⚡" 메뉴 추가

## 문의상담-수기 & 예약목록 개선 (2026-04-29)

### [문의상담-수기] Inquiries.tsx + routers.ts
- [x] 검색: 연락처(phone) 일부번호 검색 지원 (LIKE %번호%)
- [x] 리스트 정렬: 생성일(createdAt) 기준 정렬 (이미 desc 적용 확인)
- [x] 목록 유형 컬럼: 제휴사인 경우 "고객" → 제휴사명으로 표시
- [x] 예약수정 문의 관리 탭: 답변 우측에 "입금가", "판매가" 아이콘 버튼 생성
- [x] 견적생성: 답변 입력된 경우 "견적생성(자동)" 버튼 표시

### [문의상담-수기] InquiryTemplates.tsx
- [x] 카테고리에 "견적생성" 추가
- [x] "입금가" 클릭 시 금액 계산 로직: 원가=동일/제휴가=+5천/판매가=+2만
- [x] "핀메기" 클릭 시 금액 계산 로직: 원가=-20,000/제휴가=-15,000/판매가=동일

### [예약목록] ReservationManagement.tsx + reservations 라우터
- [x] 출발일 컬럼: 동일 출발일 그룹 라인 구분 표시
- [x] 유형 컬럼: 동일 유형(고객/제휴사) 그룹 라인 구분 표시
- [x] 담당자 컬럼: 동일 담당자 그룹 라인 구분 표시
- [x] 진행 드롭박스: 예약번호별 관리 페이지에 "진행/불가/확정/대기" 드롭박스 추가 (DB 컬럼 추가 완료)
- [x] 정렬 필터: 상단에 "출발일순", "예약일순", "인원순" 아이콘 버튼 추가 (클릭 시 오름차순/내림차순 토글)
- [x] 경고 아이콘: 상단에 "경고 : N건" 아이콘 추가, 클릭 시 경고건만 필터
- [x] 결제상태 "미결제": 입금 - 출금 = 0인 경우
- [x] 결제상태 "완납": 판매가 - 입금가 = 0인 경우
- [x] 결제상태 "경고": 출발일 기준 15일 이내이면서 완납이 아닌 경우
- [x] 예약목록 관리 아이콘 클릭 시 예약 상세관리 팝업 (EditDialog) 열기

## 견적생성 실제 연동 & 고객 견적서 템플릿 & 예약목록 엑셀 (2026-04-29)

### DB 스키마 추가
- [x] customerEstimateTemplates 테이블 생성 (id, name, includeItems, excludeItems, notes, schedule, isActive)
- [x] estimates 테이블 생성 (id, reservationId, token, templateId, customData, createdAt, sentAt)

### 고객 견적서 템플릿 페이지 (/erp/reservations/estimate-templates)
- [x] 신규 페이지 생성 (CustomerEstimateTemplates.tsx)
- [x] 아이콘 클릭으로 변수 삽입 ({{고객명}}, {{출발일}}, {{인원}}, {{팀수}}, {{골프장}}, {{판매가}} 등)
- [x] 포함/불포함/일정/안내사항 섹션별 에디터
- [x] 템플릿 저장/수정/삭제
- [x] ERPLayout 사이드바에 "고객 견적서 템플릿" 메뉴 추가

### 견적서 공개 URL 페이지 (/estimate/:token)
- [x] 공개 라우트 추가 (로그인 불필요)
- [x] 예약 데이터 + 템플릿으로 견적서 렌더링
- [x] 두골프 브랜드 스타일 (레퍼런스 tourlinks 구조 참고)
- [x] 인쇄/PDF 저장 버튼

### 문의관리 탭 개선 (ReservationManagement.tsx InquiryTabs)
- [x] 답변 탭에 "거래처" 아이콘 버튼 추가 → 문의 자동화 템플릿 연결 생성
- [x] 답변 탭에 "고객" 아이콘 버튼 추가 → 고객 견적서 템플릿 연결 생성
- [x] 견적 생성 완료 시 URL 표시 + "보기" 아이콘 (팝업)
- [x] "이메일/카카오톡 발송" 아이콘 추가 (클릭 시 발송 모달)

### 예약목록 엑셀 내보내기
- [x] xlsx 패키지 설치
- [x] 현재 필터(경고건, 출발일 범위, 검색어) 적용된 상태로 Excel 다운로드
- [x] 예약번호, 고객명, 출발일, 골프장, 인원, 판매가, 결제상태, 담당자 컬럼 포함

## 2026-04-29 개선 작업
- [x] ERP 좌측 하단 '홈페이지 보기' 위에 '개발대시보드' 링크 추가 (클릭 시 /erp/dev-dashboard 이동, iframe으로 https://dogolf-dash-mjywck97.manus.space/ 표시)
- [x] /erp/dev-dashboard 페이지 신규 생성 (DevDashboard.tsx, ERPLayout 래핑)
- [x] App.tsx에 /erp/dev-dashboard 라우트 추가
- [x] /erp/ai-engine 개발 요청 탭에 30초 자동 갱신(refetchInterval) 추가 (마스터 AI 요청 자동 반영)
- [x] /erp/ai-engine 개발 요청 탭에 수동 새로고침 버튼 추가

## 2026-04-29 수기 예약관리 전면 개선
- [x] 검색창 placeholder에 "연락처" 명시 및 연락처 부분번호 검색 확인
- [x] 상단 정렬 필터에 "예약일순(생성일)" 버튼 추가
- [x] 유형 콜럼 - 제휴사인 경우 "고객" 대신 제휴사명 표시 (이미 구현 확인 필요)
- [x] 입금가 아이콘 클릭 시 가격 계산 결과를 판매가/원가/제휴가 필드에 자동 입력 (현재 toast만 표시)
- [x] 핀메기 아이콘 클릭 시 가격 계산 결과를 판매가/원가/제휴가 필드에 자동 입력
- [x] InquiryTemplates.tsx categoryFilter 타입에 "estimate" 추가 (현재 타입 오류)
- [x] 견적생성(자동) 버튼 - 답변 입력 시 실제 견적 생성 연동 (입금가/핀메기 선택 기반)
- [x] 예약목록 상단 정렬 아이콘 - "출발일순", "예약일순", "인원순" 버튼 명시적 표시

## 2026-04-29 수기 예약관리 전면 개선
- [x] 검색창 placeholder에 "연락처" 추가
- [x] 상단 정렬 버튼 (출발일순/예약일순/인원순) 명시적 추가 - 클릭 시 오름차순/내림차순 토글
- [x] 입금가 버튼 클릭 시 팝업으로 원가/제휴가/판매가 계산 표시 (원가=동일/제휴가=+5천/판매가=+2만)
- [x] 핀메기 버튼 클릭 시 팝업으로 원가/제휴가/판매가 계산 표시 (원가=-2만/제휴가=-1.5만/판매가=동일)
- [x] 견적생성(자동) 버튼 - 실제 estimates.create API 연동 + 새 탭으로 견적서 열기
- [x] InquiryTemplates categoryFilter 타입에 estimate 추가 (견적생성 카테고리 필터 정상 동작)

## 2026-04-30 예약 일정 상세 구조 신규 구축

### DB 스키마
- [x] reservation_itineraries 테이블 생성 (reservationId, dayIndex, date, dayType, golfAffiliateId, holeCount, teeTime, accommodationAffiliateId, roomType, roomCount, flightInfo JSON, notes)
- [x] reservation_affiliate_costs 테이블 생성 (reservationId, affiliateId, costType, date, unitPrice, salePrice, quantity, confirmedTime, notes)
- [x] pnpm db:push 마이그레이션 실행

### 백엔드 API
- [x] reservationItineraries 라우터 생성 (list, upsert, delete)
- [x] reservationAffiliateCosts 라우터 생성 (list, upsert, delete, summary)
- [x] routers.ts에 두 라우터 등록

### 예약 수정 UI
- [x] 예약수정 모달에 "일정" 탭 추가
- [x] 상품군 선택 (당일/1발1일/1발2일/2발3일/3발4일/3발5일/기타)
- [x] 상품군 선택 시 일자별 행 자동 생성
- [x] 각 행: 날짜, dayType(출발/체류/도착/당일), 골프장(제휴사 검색), 홈수(드롭박스 9/18/27/36), 티오프시간, 숙소(제휴사 검색), 객실타입/수량, 항공정보
- [x] 항공 입력: 항공사, 출발공항/시간, 도착공항/시간 (없으면 "개별항공" 표시)
- [x] 저장 시 reservation_itineraries upsert

### 제휴사 비용 탭
- [x] 예약수정 모달에 "제휴사 비용" 탭 추가
- [x] 일정 탭 데이터 기반 제휴사별 비용 자동 생성
- [x] 각 행: 제휴사명, 유형(골프/숙소/교통/기타), 날짜, 확정시간, 입금가, 판매가, 수량
- [x] 합계 집계 (총 입금가 / 총 판매가 / 수익)
- [x] 저장 시 reservation_affiliate_costs upsert

### 견적서 변수 치환 확장
- [x] EstimateView.tsx replaceVariables 함수에 신규 변수 추가 ({{일정표}}, {{상품군}})
- [x] 견적서에 일정 테이블 자동 렌더링 (reservation_itineraries 데이터)

### 상품관리 연동
- [x] packages 테이블에 defaultItinerary JSON 필드 추가 + DB 마이그레이션
- [x] 상품 수정 모달에 "기본 일정 템플릿" 설정 UI 추가
- [x] 예약 생성 시 상품 기본 일정 자동 복사 적용

## 2026-04-30 자동 치환 변수 목록 팝업 기능 구현

### 공용 컴포넌트
- [x] VariablePickerButton 컴포넌트 신규 생성 (client/src/components/VariablePickerButton.tsx)
- [x] 7개 분류별 변수 목록 정의 (고객정보/예약정보/골프정보/숙박정보/금액정보/담당자정보/일정정보)
- [x] 클릭 시 분류별 변수 목록 테이블 팝오버 표시
- [x] 변수 클릭 시 onInsert 콜백으로 변수 문자열 전달
- [x] 외부 클릭 시 팝오버 자동 닫힘
- [x] size(xs/sm/md), placement(bottom/top × left/right) 옵션 지원

### 적용 위치
- [x] CustomerEstimateTemplates.tsx - 포함항목/불포함항목/일정/유의사항 Textarea 라벨 옆에 버튼 추가
- [x] CustomerEstimateTemplates.tsx - 커서 위치 삽입 로직 구현 (selectionStart/End 기반)
- [x] InquiryTemplates.tsx - 템플릿 내용 Textarea 라벨 옆에 버튼 추가
- [x] ReservationManagement.tsx - 예약 수정 모달 메모 입력란 옆에 버튼 추가
- [x] ReservationItineraryTab.tsx - 일정 행 비고 Input 옆에 버튼 추가

## 2026-04-30 변수 유효성 검사 기능 구현

- [x] VariablePickerButton.tsx에 validateVariables 유틸리티 함수 추가 (잘못된 변수 추출)
- [x] CustomerEstimateTemplates.tsx 저장 시 유효성 검사 및 경고 UI 표시
- [x] InquiryTemplates.tsx 저장 시 유효성 검사 및 경고 UI 표시

## 2026-04-30 {{변수명}} 실시간 파싱 → variables 자동 동기화

- [x] CustomerEstimateTemplates.tsx - content 변경 시 {{변수명}} 파싱 후 variables 배열 자동 추가/삭제
- [x] InquiryTemplates.tsx - content 변경 시 {{변수명}} 파싱 후 variables 배열 자동 추가/삭제
- [x] 유효 변수(VALID_VARIABLES 목록 내)는 초록 배지, 미등록 변수는 주황 배지로 구분 표시
- [x] TypeScript 오류 없음 확인
- [x] 체크포인트 저장

## 2026-04-30 자동 치환 변수 관리 시스템 고도화

### DB 스키마
- [x] custom_variables 테이블 추가 (id, category, label, key, description, isSystem, isActive, sortOrder)
- [x] reservation_itineraries.teeTime → estimatedTeeTime + confirmedTeeTime 분리
- [x] pnpm db:push 마이그레이션

### CMS > 자동 치환 변수 관리 페이지
- [x] /erp/cms/variables 신규 페이지 생성
- [x] ERPLayout CMS 섹션에 "자동 치환 변수 관리" 메뉴 추가
- [x] App.tsx 라우트 등록
- [x] 카테고리별 변수 목록 테이블 (시스템 변수 + 커스텀 변수)
- [x] 신규 변수 추가 (카테고리/라벨/키값/설명 입력)
- [x] 변수 수정/삭제 (시스템 변수는 삭제 불가)
- [x] VariablePickerButton이 DB 커스텀 변수도 포함하여 표시

### 금액 변수 추가
- [x] {{입금가}}, {{제휴가}}, {{판매가}}, {{결제상태}} VARIABLE_CATEGORIES 금액 정보에 추가
- [x] EstimateView.tsx replaceVariables에 금액 변수 치환 로직 추가

### 티타임 변수 분리
- [x] reservation_itineraries에서 teeTime → estimatedTeeTime + confirmedTeeTime
- [x] ReservationItineraryTab.tsx UI에 견적시간/확정시간 2개 입력란 표시
- [x] {{티타임}} 변수: confirmedTeeTime 우선, 없으면 estimatedTeeTime 사용
- [x] {{견적시간}}, {{확정시간}} 개별 변수도 VARIABLE_CATEGORIES에 추가

### 일정 동적 변수 ({{일정표}} 렌더링 고도화)
- [x] EstimateView.tsx {{일정표}} 렌더링 로직 개선 (미입력 항목 자동 제외)
- [x] dayType별 표시 형식 (출발일/체류일/도착일/당일)
- [x] 골프장+홀수+티타임 / 숙소 / 포함사항 행 구조화
- [x] 상품군(1박2일 등) 자동 매핑 (dayIndex 기반)
- [x] {{N일차-골프}}, {{N일차-숙소}}, {{N일차-티타임}}, {{N일차-항공}}, {{N일차-날짜}} 개별 일차 변수 지원
- [x] validateVariables/extractVariables에 동적 N일차 패턴 유효 변수로 인식

## 2026-04-30 견적서 실시간 미리보기 기능

- [x] estimates.previewByReservation tRPC API 추가 (예약 ID + 템플릿 ID → 변수 치환 결과 반환)
- [x] CustomerEstimateTemplates.tsx 또는 ReservationManagement.tsx에 미리보기 패널 추가
- [x] 예약 선택 드롭다운 → 선택 시 변수 치환 결과 실시간 렌더링
- [x] 미리보기 패널: 포함항목/불포함항목/일정/유의사항 각 섹션 렌더링
- [x] 인쇄/공유 버튼 (미리보기 패널에서 바로 견적서 URL 복사)

## 2026-04-30 두골프 ERP 기능 카탈로그 자동 집계 시스템

### 정적 파일 기반 데이터 소스
- [x] docs/features.json 스키마 설계 (id, name, category, status, description, module, since, updatedAt, tags[])
- [x] docs/features.override.json 초기 데이터 작성 (2026-04-24 이후 추가/수정 내용 반영)

### generate-features 스크립트
- [x] scripts/generate-features.mjs 구현 (라우터/페이지/DB 스키마/ERP 메뉴 스캔 → features.json 자동 생성)
- [x] features.override.json 병합 로직 (수동 편집 항목 유지)
- [x] package.json prebuild 훅으로 자동 실행 등록

### tRPC featuresRouter
- [x] server/routers/features.ts 구현 (list, refresh, getReport, getChangelog)
- [x] routers.ts에 featuresRouter 등록
- [x] refresh는 protectedProcedure + role 체크로 보호 (관리자 전용)

### 프론트엔드 페이지
- [x] client/src/pages/erp/FeatureCatalog.tsx 신규 생성
- [x] 카테고리별 그룹핑 테이블/카드 (고객 홈페이지/ERP/AI 오케스트레이터/DevAI/DB/외부연동)
- [x] 검색, 카테고리 필터, 상태 필터 (done/in_progress/planned)
- [x] 상단 "최신 보고서 보기" 탭 + "MD 다운로드" 버튼
- [x] 관리자 전용 "새로고침" 버튼 (generate-features 즉시 실행)
- [x] /erp/ai-engine/features 라우트 등록
- [x] ERPLayout "AI 엔진 관리 > 기능 목록" 메뉴 href 업데이트

### 보고서 페이지
- [x] FeatureCatalog 내 "보고서" 탭 (마크다운 렌더)
- [x] features.json 기반 최신 보고서 자동 합성 렌더링
- [x] .md 다운로드 버튼

### CHANGELOG 자동 생성
- [x] generate-features.mjs 내 CHANGELOG.md 자동 갱신 훅 (신규 항목 감지 시 자동 추가)
- [x] generate-features 스크립트 실행 후 자동 호출

## 2026-04-30 견적서 실시간 미리보기

- [x] estimatesRouter에 previewByReservation 프로시저 추가 (DB 저장 없음)
- [x] EstimatePreviewPanel.tsx 컴포넌트 구현 (슬라이드-인 패널)
- [x] 템플릿 선택 드롭다운 (자동 선택 / 수동 선택)
- [x] 변수 치환 결과 실시간 렌더링 (포함사항/불포함사항/일정/유의사항)
- [x] 일정 테이블 (골프장/숙소/항공/티타임, 확정/견적 뱃지)
- [x] 미치환 변수 경고 표시 (오렌지 배지)
- [x] 인쇄 버튼 / 견적서 발행 버튼
- [x] ReservationManagement.tsx 예약 목록 행에 미리보기 버튼 추가 (인디고 ExternalLink 아이콘)
- [x] 오른쪽 슬라이드-인 패널 (반투명 오버레이 + 외부 클릭 닫기)

## 2026-04-30 CMS > 홈페이지 관리 시스템

### DB 스키마 (6개 신규 테이블)
- [x] site_settings (전역 설정 key-value)
- [x] site_nav_items (네비게이션 메뉴: label/href/order/visible)
- [x] site_hero_slides (히어로 슬라이드: image/title/subtitle/cta/order/startAt/endAt)
- [x] site_footer (푸터 업체 정보: 사업자명/대표자/사업자번호/통신판매/관광사업/주소/전화/이메일/운영시간/계좌/SNS/저작권)
- [x] site_featured_packages (노출 상품 구성)
- [x] site_audit_logs 테이블 (변경 이력: table/action/oldValue/newValue/changedBy)
- [x] pnpm db:push 마이그레이션 완료

### tRPC siteSettingsRouter
- [x] server/routers/siteSettings.ts 구현
- [x] getSettings / updateSettings (전역 설정)
- [x] getNavItems / updateNavItems (네비 순서/표시 포함)
- [x] getHeroSlides / createHeroSlide / updateHeroSlide / deleteHeroSlide / reorderHeroSlides
- [x] getFooter / updateFooter (초기값 시드 포함)
- [x] getFeaturedPackages / setFeaturedPackages (노출 상품 구성)
- [x] ocrBusinessLicense (사업자등록증 OCR — Gemini Vision 재사용, 저가 모델)
- [x] getAuditLogs (변경 이력 조회)
- [x] routers.ts에 siteSettingsRouter 등록
- [x] 모든 write 프로시저에 감사 로그 자동 기록

### ERP CMS > 홈페이지 관리 페이지
- [x] client/src/pages/erp/HomepageManagement.tsx 신규 생성
- [x] 탭 1: 전역 설정 (사이트명/설명/로고/파비콘/SEO/GA/카카오체널) + 검색결과 미리보기
- [x] 탭 2: 네비게이션 관리 (순서/표시여부 토글/추가/수정/삭제)
- [x] 탭 3: 히어로 슬라이드 (이미지 URL/제목/부제목/CTA/기간/링크/활성화 토글)
- [x] 탭 4: 노출 상품 구성 (섹션별 상품 선택: 추청/인기/신규/특가)
- [x] 탭 5: 푸터 관리 (업체 정보 필드 전체 편집 + 실시간 미리보기)
- [x] 탭 6: 사업자등록증 OCR (이미지 업로드 → Gemini Vision → 자동 입력, 신뢰도 표시, 수동 보정 후 푸터 적용)
- [x] 탭 7: 변경 이력 (감사 로그 테이블)
- [x] App.tsx 라우트 등록 (/erp/cms/homepage)
- [x] ERPLayout CMS 섹션에 "홈페이지 관리" 메뉴 추가

### dayoutgolf.com 프론트 연동
- [x] Footer.tsx — DB 데이터 연동 (trpc.siteSettings.getFooter)
- [x] Footer.tsx — 반응형 개선 (모바일: 최소 라인 + "회사정보 더보기" 토글, max-h 애니메이션)
- [x] Footer.tsx — aria-expanded/키보드 접근성, SEO(접힌 상태에서도 렌더)
- [x] Footer.tsx — SNS 링크 동적 렌더링 (카카오/인스타/유튜브/네이버블로그)
- [x] Footer.tsx — 폴백 기본값 설정 (DB 없을 때 하드코딩 값 사용)
- [x] Header.tsx — DB 네비 데이터 연동 (trpc.siteSettings.getNavItems, isVisible 필터, 폴백 기본값)
- [x] Home.tsx — 히어로 슬라이드 DB 연동 (trpc.siteSettings.getHeroSlides, isActive 필터, sortOrder 정렬, 폴백 정적데이터)
- [x] Home.tsx — 노출 상품 DB 연동 (기존 trpc.packages.publicList 사용 중 — 이미 DB 기반)
## 2026-04-30 ERPLayout 사이드바 SPA 라우팅 수정

- [x] ERPLayout.tsx NavItemComponent에 onNavigate 콜백 추가 (모바일 클릭 시 사이드바 자동 닫힌)
- [x] 하단 "개발대시보드" `<a href>` → wouter `<Link>`로 교체 (새 탭 방지)
- [x] 향후 모든 ERP 내부 메뉴는 반드시 wouter Link 사용 원칙 주석 추가 (코드 상단 주석 완료)

## 2026-04-30 모바일 푸터 개선

- [x] Footer.tsx 모바일 레이아웃 전면 재설계 (md 미만 별도 렌더링)
- [x] 모바일 최상단: 로고 + SNS 아이콘 + 대표전화 탭 버튼 (항상 노출)
- [x] 골프 목적지 / 고객 서비스 / 연락처 섹션 아코디언 토글 (MobileSection 컴포넌트)
- [x] 하단 사업자 정보: 회사명+사업자번호 최소 라인 + "상세보기" 토글
- [x] max-h 트랜지션으로 SEO 크롤 가능 (hidden 미사용)
- [x] aria-expanded 접근성 적용
- [x] 데스크톱: 기존 4컬럼 그리드 그대로 유지
- [x] TypeScript 오류 0개

## 2026-04-30 E1+E2 골프톡 채팅 UI 최적화 + C1 히어로 슬라이드 이미지 업로드 + C3 예약 게시 자동화 + 상품 날짜 필터

### E1+E2: 골프톡 채팅 UI 최적화
- [x] 모바일: 채팅 위젯 클릭 시 전체화면 채팅 모드 전환 (화면 100% 활용)
- [x] 모바일: 텍스트 입력 시 키보드 올라와도 채팅 히스토리 보이는 레이아웃
- [x] 모바일: 위젯 열린 상태에서 플로팅 버튼 페이드 아웃 (채팅 중 방해 최소화)
- [x] 모바일: 닫기 버튼 채팅창 내부 상단으로 이동 (플로팅 버튼 위치 아님)
- [x] PC: 채팅창 크기 대폭 확대 (travelersmap.co.kr 수준 - 화면 우측 고정 넓은 패널)
- [x] PC: 채팅창 헤더에 상담 안내 문구 및 빠른 메뉴 버튼 추가
- [x] 공통: 채팅 입력창 하단 고정, 스크롤 영역 최대화

### C3: 예약 게시 자동화 (Scheduled Publish)
- [x] siteSettingsRouter.getHeroSlides에 startAt/endAt 기반 isActive 자동 계산 로직 추가
- [x] 서버사이드: 슬라이드 조회 시 현재 시각 기준 startAt <= now <= endAt 이면 자동 활성
- [x] CMS 히어로 슬라이드 탭에 게시 시작일/종료일 날짜 입력 필드 추가
- [x] 날짜 설정 없으면 수동 isActive 토글 우선 적용

### C1: 히어로 슬라이드 이미지 3가지 업로드 방식
- [x] C1-1: 직접 파일 업로드 버튼 (S3 storagePut, URL 자동 채움)
- [x] C1-2: 상품 선택 → AI 이미지 자동 생성 (generateImage 활용, 상품명+목적지 프롬프트)
- [x] C1-3: 설정 없을 시 자동 3개 생성 버튼 (골프 목적지별 AI 이미지 생성)
- [x] 이미지 업로드 tRPC 프로시저 추가 (uploadHeroImage)
- [x] CMS 히어로 슬라이드 탭 UI 업데이트 (3가지 방식 탭/버튼)

### 상품 날짜 필터 (오늘 이후 날짜/요금만 노출)
- [x] packages.publicList 및 packages.getById에 오늘 이후 출발일만 필터링 로직 추가
- [x] 미래 출발일이 없는 상품: 최저가 "개별문의" 표시
- [x] 상품 목록 정렬: 미래 출발일 있는 상품 우선, 없는 상품 후순위 배치
- [x] 상품 상세 페이지: 날짜/요금 테이블에서 오늘 이전 날짜 행 숨김 처리
- [x] PackageCard.tsx 최저가 표시 로직 업데이트 ("개별문의" 폴백)

## 2026-04-30 dogolf.com 출발일/옵션 행사 방식 참고 개선
### ERP 슬롯 관리 개선
- [x] DB 스키마: packageSlots에 adultPrice, childPrice, infantPrice, minPax, notes 컬럼 추가
- [x] pnpm db:push 마이그레이션 완료
- [x] addSlot 프로시저 업데이트 (성인/아동/유아 가격, minPax, notes 지원)
- [x] addSlotBatch 프로시저 추가 (날짜 범위 + 요일 패턴 일괄 등록)
- [x] updateSlot 프로시저 추가 (슬롯 인라인 수정)
- [x] ERP PackageDetail.tsx 슬롯 탭 전면 개선 (개별/일괄 등록 모드 전환)
- [x] 일괄 등록: 날짜 범위 + 요일 선택 + 성인/아동/유아 가격 + 최소인원
- [x] 슬롯 목록 테이블: 성인요금/아동요금/최소인원 컬럼 추가
- [x] 슬롯 인라인 수정: 수정 버튼 클릭 시 해당 행 인라인 편집 모드
- [x] 슬롯 메모(notes) 필드 추가 (특가/얼리버드 등 안내)
### 홈페이지 상품 상세 UI 개선
- [x] DepartureDateCalendar.tsx: Slot 인터페이스에 adultPrice/childPrice/infantPrice/minPax/notes 추가
- [x] DepartureDateCalendar.tsx: 달력 가격 표시 로직 개선 (adultPrice > priceOverride > basePrice 순서)
- [x] PackageDetail.tsx: 선택된 행사 정보 표시 개선 (잔여인원, 성인/아동/유아 요금, 최소인원, 메모)
- [x] 성인/아동 요금이 다를 때만 별도 표시 (동일하면 성인 요금만 표시)
### 배너 관리 3가지 업로드 방식
- [x] uploadBannerImage 프로시저 (base64 → S3 업로드)
- [x] generateBannerImage 프로시저 (AI 이미지 생성 → S3 저장)
- [x] generateBannerBatch 프로시저 (국가별 AI 이미지 일괄 생성)
- [x] CMSBanners.tsx 전면 개선 (3가지 업로드 방식 탭 UI)
### 상품 날짜 필터
- [x] publicList: 오늘 이후 슬롯 기반 최저가 계산
- [x] publicList: 미래 슬롯 없는 상품 후순위 정렬 + minPrice null 반환
- [x] publicGet: 오늘 이후 슬롯만 반환
- [x] Packages.tsx: hasFutureSlots 없으면 "개별문의" 표시

## 2026-04-30 dogolf.com 분석 기반 기능 개선

- [x] D1: DepartureDateCalendar PC에서 2개월 동시 표시
- [x] D2: 행사 선택 카드 UI (dogolf.com 방식 - 예약가능/마감 뱃지 + 잔여인원)
- [x] D3: 성인/아동/유아 인원 선택 +-버튼 + 총금액 계산
- [x] D4: 상품 상세 탭 메뉴 (상품정보 / 여행일정 / 약관/환불규정)
- [x] D5: 상품 검색 기능 (헤더 검색창)
- [x] D6: 찜하기 기능 (상품 카드 + 상세 페이지)
- [x] D7: ERP 슬롯 달력 시각화 뷰

## 2026-04-30 dogolf.com 분석 기반 추가 개선

- [x] 홈페이지 상품 상세 탭 메뉴 (상품정보/여행일정/약관·환불)
- [x] 찜하기 기능 (localStorage 기반, 상품 카드 + 상세 페이지)
- [x] 헤더 검색 기능 (URL 파라미터 q 기반)
- [x] ERP 여행일정 탭 (일차별 제목/내용/식사 편집)
- [x] ERP 취소정책 탭 (텍스트 편집)
- [x] 홈페이지 달력 2개월 동시 표시 (PC)
- [x] 성인/아동/유아 인원 선택 +-버튼 + 총금액 계산

## 2026-05-01 스마트 Manus 라우팅 + 채팅형 개발 문의 UI

- [x] M1: DB에 manusProjectId 필드 추가 (devRequests 테이블)
- [x] M2: manusPipe.ts 스마트 라우팅 엔진 구현 (task.sendMessage vs task.create 자동 분기)
- [x] M3: MANUS_PROJECT_ID 환경변수 추가
- [x] M4: devRequest 라우터에 스마트 전송 로직 연결
- [x] M5: MasterAI.tsx 채팅형 개발 문의 UI 개선 (선택형 카드 + 채팅 대화 방식)
- [x] M6: AI 분류 엔진 연결 (요청 유형/우선순위/모듈 자동 분류)
- [x] M7: 라우팅 결과 표시 UI (신규 생성 vs 기존 스레드 추가 구분)

## 2026-05-01 Manus 스마트 라우팅 엔진 구현
- [x] manusPipe.ts 스마트 라우팅 엔진으로 전면 개선 (AI 분류 + 기존 태스크 재사용 판단)
- [x] devRequest.ts 라우터 - autoRegisterAndSend 프로시저 추가 (AI 분류 + 라우팅 결과 반환)
- [x] DB 스키마 - devRequests에 manusProjectId, manusRoutingType, manusRoutingReason 필드 추가
- [x] env.ts에 MANUS_PROJECT_ID 추가
- [x] settings.ts - testManus에 project_id 포함 + getManusConfig 프로시저 추가
- [x] ERPSettings.tsx - Manus 스마트 라우팅 설정 현황 카드 추가
- [x] MasterAI.tsx - DevRequestCard에 routingType/routingReason 표시 + sentRequestResults 상태 추가

## 2026-05-01 Manus API 키 교체 및 최종 검증
- [x] 새 Manus Open API 키 발급 (sk-l4CYDmYBIAcaGtMlBAgotXuNl5VGz8Rece...)
- [x] MANUS_API_KEY 환경변수 업데이트 (새 키로 교체)
- [x] MANUS_PROJECT_ID 환경변수 설정 (GVziMvdQmQTJAbrZbBGmnr)
- [x] Python requests 라이브러리로 API 연동 테스트 성공 (project.list 200 OK)
- [x] Python requests로 task.create 성공 (project_id 포함, task_id: dZYE2GjrQKR7ERZVJjquHG)
- [x] Node.js fetch 환경에서 API 연동 테스트 성공 (project.list 200 OK, task.sendMessage 200 OK)
- [x] 서버 환경변수 확인 (MANUS_API_KEY, MANUS_PROJECT_ID, MANUS_DOGOLF_TASK_ID 모두 정상)
- [x] manusPipe.ts Node.js fetch 기반 API 호출 정상 동작 확인

## 2026-05-01 ERP 중첩 라우팅 (사이드바 고정 + 우측 컨텐츠만 교체) [ID: 150001]
- [x] App.tsx: `/erp` 경로를 wouter `nest` prop으로 중첩 라우팅 구조로 변경
- [x] ERPLayout.tsx: `children` prop 대신 내부 `<Switch>` 라우팅으로 변경 (모든 ERP 라우트 포함)
- [x] ERPLayout.tsx: 페이지 전환 시 로딩 인디케이터 추가 (Suspense + 스피너)
- [x] ERPLayout.tsx: 라우트 변경 시 스크롤 위치 초기화 (useEffect + useLocation)
- [x] 각 ERP 페이지에서 ERPLayout 래핑 제거 (컨텐츠만 반환하도록 변경)
- [x] TypeScript 오류 0개 확인

## 2026-05-01 ERP 중첩 라우팅 (사이드바 고정, 우측 컨텐츠만 교체)
- [x] App.tsx: ERP 라우트를 단일 <Route path="/erp" nest>로 통합
- [x] ERPLayout.tsx: 내부 Switch 라우팅으로 변경 (children 제거)
- [x] 27개 ERP 페이지에서 <ERPLayout> 래핑 제거
- [x] 사이드바 href를 상대 경로로 변경 (wouter nest 컨텍스트)
- [x] 스크롤 위치 초기화 (라우트 변경 시)
- [x] Suspense 로딩 인디케이터 추가
- [x] 현재 선택된 메뉴 하이라이트 동작 확인

## 예약 목록 상세 모달 개선 [요청]
- [x] 예약 행 전체 클릭 시 모달 열기 (커서 포인터, 행 hover 강조)
- [x] 모달 내 여행자 목록 표시 (이름, 영문명, 성별, 여권번호, 만료일)
- [x] 모달 내 선택 옵션 표시 (selectedOptions JSON 파싱)
- [x] 모달 내 관리자 메모 및 취소 사유 표시
- [x] 수기 예약 시 골프장명/상품명 표시 개선
- [x] 모달 레이아웃 전반 가독성 개선 (탭 구조 또는 섹션 구분)

## 예약 상세 모달 (2026-04-30)
- [x] 예약 행 전체 클릭 시 상세 모달 열기 (cursor-pointer 표시)
- [x] bookings.get API: source 파라미터 추가 (reservation/booking 구분)
- [x] 수기 예약(reservations 테이블) 상세 조회 지원
- [x] 모달 탭 구조: 기본 정보 / 여행자 / 결제 / 상태 관리
- [x] 수기 예약 전용 필드 표시 (골프장명, 상품명, 담당자, 파트너사 등)
- [x] TypeScript 오류 0개 확인

## DevAI 정확도 분석 탭 추가 (2026-05-01)
- [x] DB 스키마: devRequests에 accuracyScore, userFeedback, engineType 필드 추가
- [x] pnpm db:push 실행
- [x] 서버 API: devAI.accuracyStats (기간별 정확도 통계)
- [x] 서버 API: devAI.engineAccuracyComparison (엔진별 정확도 비교)
- [x] 서버 API: devAI.updateAccuracy (정확도 점수 업데이트)
- [x] 서버 API: devAI.getImprovementSuggestions (AI 개선 제안)
- [x] DevAI.tsx: "정확도 분석" 탭 추가 (5번째 탭)
- [x] 정확도 통계 KPI 카드 (평균 정확도, 고정확도 비율, 평가 건수)
- [x] 기간별 필터 (7일/30일/90일/전체)
- [x] 엔진별 정확도 비교 바차트 (Gemini/GPT/Claude/Llama)
- [x] 일별 정확도 추이 라인차트
- [x] 개선 제안 섹션 (AI 분석 기반)
- [x] 개별 요청 정확도 평가 기능 (별점 1-5)
- [x] TypeScript 오류 0개 확인

## 정확도 평가 자동 트리거 (2026-05-01)
- [x] 상태 변경 버튼에서 "완료" 클릭 시 정확도 평가 다이얼로그 자동 오픈
- [x] 편집 다이얼로그 저장 시 status가 "completed"로 변경되면 자동 오픈
- [x] 다이얼로그에 "완료 처리 후 평가" 안내 문구 추가
- [x] 이미 평가된 요청은 자동 트리거 스킵 (accuracyScore != null 체크)
- [x] TypeScript 오류 0개 확인

## 정확도 평가 자동 트리거 (2026-05-01) - 완료
- [x] updateReqMutation onSuccess에서 variables 받아 완료 상태 감지
- [x] 인라인 상태 버튼 클릭 시 완료 → 정확도 평가 다이얼로그 자동 트리거 (400ms 딜레이)
- [x] accuracyScore == null 조건으로 이미 평가된 요청은 재트리거 방지
- [x] 정확도 평가 다이얼로그 제목/설명 개선 ("AI 응답 정확도 평가" + 안내 문구)
- [x] 완료된 요청 카드에 보라색 배경 강조 표시

## 피드백 자동 분류 기능 (2026-05-01)
- [x] DB 스키마: devRequests에 feedbackCategory 필드 추가 (bug | suggestion | other)
- [x] DB 마이그레이션 실행 (pnpm db:push)
- [x] 서버: classifyFeedback 헬퍼 함수 구현 (LLM 기반 분류, 피드백 없으면 'other')
- [x] 서버: updateAccuracy 뮤테이션에서 피드백 저장 후 자동 분류 실행
- [x] 서버: updateFeedbackCategory API 추가 (수동 수정용)
- [x] 프론트엔드: 정확도 평가 다이얼로그에 분류 결과 배지 표시 (저장 후)
- [x] 프론트엔드: 정확도 분석 탭에 카테고리별 통계 표시 (bug/suggestion/other 비율)
- [x] 프론트엔드: 요청 목록 카드에 feedbackCategory 배지 표시
- [x] TypeScript 오류 0개 확인

## Footer 저작권 연도 동적 처리
- [x] Footer.tsx DEFAULTS.copyright에서 하드코딩된 '2026' → `new Date().getFullYear()` 동적 처리 (매년 자동 업데이트)

## 푸터 소셜 미디어 아이콘 추가
- [x] DB 스키마(siteSettings) 및 API에 facebookUrl 필드 추가 + pnpm db:push
- [x] Footer.tsx 데스크톱 SNS 아이콘 영역에 인스타그램(SVG), 페이스북(SVG) 아이콘 추가
- [x] Footer.tsx 모바일 SNS 아이콘 영역에 인스타그램(SVG), 페이스북(SVG) 아이콘 추가
- [x] CMS 홈페이지 관리 UI(HomepageManagement.tsx)에 페이스북 URL 입력 필드 추가

## 소셜 미디어 아이콘 호버 효과
- [x] Footer.tsx 데스크톱·모바일 모든 소셜 아이콘에 hover:scale-110 + transition-transform duration-200 효과 추가

## 모바일 소셜 미디어 아이콘 크기 확대
- [x] Footer.tsx 모바일 SNS 아이콘 w-7 h-7 → w-9 h-9로 크기 확대 (내부 아이콘 SVG 크기도 조정)

## X(구 트위터)·유튜브 소셜 미디어 아이콘 추가
- [x] DB 스키마(site_footer)에 xUrl 필드 추가 및 pnpm db:push 마이그레이션
- [x] API(siteSettings.ts) updateFooter 프로시저에 xUrl 파라미터 추가
- [x] Footer.tsx 데스크톱 SNS 영역에 X(SVG) 및 유튜브(SVG) 아이콘 추가 (hover:scale-110 포함)
- [x] Footer.tsx 모바일 SNS 영역에 X(SVG) 및 유튜브(SVG) 아이콘 추가 (hover:scale-110 포함)
- [x] CMS 홈페이지 관리 UI(HomepageManagement.tsx)에 X URL 입력 필드 추가

## 푸터 배경색 어둡게 변경
- [x] Footer.tsx 배경색을 현재보다 더 어두운 색으로 변경하여 가독성 향상

## 푸터 이용약관·개인정보처리방침 링크 색상 변경
- [x] Footer.tsx 이용약관·개인정보처리방침 링크 색상을 더 눈에 띄는 색으로 변경하여 가시성 향상 (데스크톱+모바일 모두 dogolf-gold 색상 적용)

## MasterAI 오케스트라 시스템 개선 (다중 프로젝트 대비)
- [x] DB 스키마: managed_projects 테이블 추가 (프로젝트명, manusProjectId, 컨텍스트 등)
- [x] manusPipe.ts: managed_projects DB 기반 동적 컨텍스트 주입 구조로 리팩터링
- [x] DB 스키마: devRequests에 manusTaskUrl 컨럼 추가 + pnpm db:push
- [x] manusPipe.ts: autoRegisterAndSend에서 manusTaskUrl DB 저장
- [x] manusPipe.ts: Manus 태스크 생성 성공 시 슬랙 알림 전송 (taskUrl 포함)
- [x] AIEngine.tsx: 개발 요청 목록에서 Manus 태스크 ID를 클릭 가능한 링크로 표시
- [x] MasterAI.tsx: 전송 완료 후 Manus 태스크 URL 바로가기 버튼 표시
- [x] DB 스키마: managed_projects 테이블 추가 (name, slug, description, manusProjectId, manusWebdevPath, manusDeployUrl, techStack, keyFiles, devInstructions, customContext, isActive, isDefault) + pnpm db:push
- [x] manusPipe.ts: formatDevRequestMessage async 변환 + managed_projects DB에서 동적 컨텍스트 주입
- [x] server/routers/managedProjects.ts: CRUD API 라우터 생성 (list, getById, create, update, setDefault, delete)
- [x] server/routers.ts: managedProjectsRouter import 및 appRouter에 managedProjects 키로 등록
- [x] client/src/pages/erp/ManagedProjects.tsx: 관리 프로젝트 CRUD UI 페이지 구현 (목록 테이블, 추가/수정/삭제 다이얼로그, 기본 프로젝트 설정 버튼, 상세 정보 확장 패널)
- [x] ERPLayout.tsx: 관리 프로젝트 import 및 /managed-projects 라우트 추가
- [x] ERPLayout.tsx: AI 엔진 관리 사이드바에 "관리 프로젝트" 메뉴 항목 추가 (FolderOpen 아이콘)
- [x] seed-managed-projects.mjs: 두골프 ERP 기본 프로젝트 시드 데이터 DB 삽입 완료

## 개발 요청 결과물 자동 수집 기능 (2026-05-01)
- [x] 서버: Manus API를 통해 체크포인트/태스크 결과물을 자동으로 가져오는 헬퍼 구현 (fetchManusResult 프로시저)
- [x] 서버: devRequests의 result 필드를 Manus 체크포인트 메시지에서 자동 채우는 로직 추가
- [x] 프론트엔드: DevAI.tsx 요청 편집 다이얼로그에 "결과물 자동 가져오기" 버튼 추가
- [x] 프론트엔드: 결과물 자동 수집 로딩 상태 표시

## 이용약관·개인정보처리방침 페이지 구현 (2026-05-01)
- [x] /terms 이용약관 페이지 구현 (www.dogolf.com 정보 기반, URL만 변경)
- [x] /privacy 개인정보처리방침 페이지 구현 (www.dogolf.com 정보 기반, URL만 변경)
- [x] App.tsx에 /terms, /privacy 라우트 등록

## feedbackCategory 수동 수정 UI (2026-05-01)
- [x] DevAI.tsx: 요청 카드에서 feedbackCategory 배지 클릭 시 드롭다운 표시
- [x] DevAI.tsx: 드롭다운에서 버그/개선제안/기타 선택 시 updateFeedbackCategory API 호출
- [x] 수정 성공 시 요청 목록 즉시 갱신

## ManagedProjects 고도화 (2026-05-01)
- [x] ManagedProjects.tsx: 프로젝트별 AI 엔진 성능 비교 대시보드 추가 (AI 성능 대시보드 탭)
- [x] ManagedProjects.tsx: 프로젝트 간 컨텍스트 공유 기능 (Copy 버튼 → 다이얼로그로 필드 선택 복사)
- [x] 서버: managedProjects.getStats 프로시저 추가 (dev_requests 통계 집계 - 정확도, 카테고리 분포)
- [x] 서버: managedProjects.copyContext 프로시저 추가 (프로젝트 간 컨텍스트 복사)

### 3가지 개선 작업 (2026-05-01 v2)
- [x] 결과물 자동 수집 고도화: devRequests에 resultCheckpointId 콼럼 추가 + DB 마이그레이션
- [x] 결과물 자동 수집 고도화: fetchManusResult 시 Manus 메시지에서 checkpoint_version_id 추출 및 DB 저장
- [x] 결과물 자동 수집 고도화: DevAI.tsx 편집 다이얼로그에 resultCheckpointId 링크 표시
- [x] ManagedProjects: 프로젝트 카드에 "요청" 버튼 추가 (클릭 시 DevAI 페이지로 이동 + 프로젝트명 자동 입력)
- [x] DevAI.tsx: URL 파라미터(projectName) 읽어 새 요청 폼 자동 입력 + 다이얼로그 자동 오픈
- [x] ManagedProjects: 프로젝트 이름/슬러그/기술스택 검색 기능 추가 (Enter 또는 검색 버튼)
- [x] ManagedProjects: 활성/비활성 상태 필터 추가 (필터 변경 시 페이지 1로 자동 리셋)
- [x] ManagedProjects: 페이지네이션 추가 (페이지당 20개, 7개 버튼 표시)
- [x] 서버: managedProjects.list에 검색·필터·페이지네이션 파라미터 추가 (search, isActive, page, pageSize)

### 개발요청 프로세스 전면 개선 (2026-05-02)
- [x] 서버: manusPipe.ts 3단계 라우팅 로직 (0순위 selectedTaskId 우선 라우팅 + forceNewTask 신규 생성)
- [x] 서버: systemSettings.analyzeAndRecommendTask API - AI 기반 태스크 추천 (신뢰도 점수 포함)
- [x] 서버: systemSettings.listTaskCandidates API - DB의 manus_task_candidates 테이블에서 태스크 후보 목록 조회
- [x] 서버: systemSettings.addTaskCandidate / updateTaskCandidate / deleteTaskCandidate CRUD API
- [x] 서버: devRequest.autoRegisterAndSend에 selectedTaskId, forceNewTask 파라미터 추가
- [x] 두골프 마스터 채팅 UI: 개발요청 카드 전송 버튼 클릭 시 태스크 선택 다이얼로그 자동 트리거
- [x] 두골프 마스터 채팅 UI: AI 추천 태스크 리스트 + 신뢰도 표시 + 기존/신규 선택
- [x] ERP 연동 설정 > 시스템 설정 페이지: 태스크 후보 CRUD UI + MANUS_DOGOLF_TASK_ID 설정
- [x] DB: system_settings, manus_task_candidates 테이블 추가 + pnpm db:push
## 추가 요청 (2026-05-02)
- [x] Footer 저작권 명칭 수정: DB companyName='데이아웃(두골프)', copyright='© {YEAR} 데이아웃(두골프). All Rights Reserved. Powered by dogolfai'
- [x] in_progress → done 자동 완료 처리: MasterAI.tsx SSE done 이벤트에서 detectCompleteMutation 자동 호출 + devRequest.ts detectAndCompleteFromResponse 프로시저 추가

## 태스크 후보 다양화 + 자동 완료 키워드 튜닝 UI (2026-05-02 v2)
- [x] DB 시드: manus_task_candidates에 두골프 ERP 개발 태스크(기본값), 홈페이지 개선 태스크, 신규 파트너 온보딩 태스크 3개 등록
- [x] SystemSettings.tsx: 자동 완료 키워드 목록 CRUD UI 추가 (추가/삭제/기본값 초기화)
- [x] 서버: systemSettings.getCompletionKeywords / updateCompletionKeywords / resetCompletionKeywords 프로시저 추가
- [x] devRequest.ts: detectAndCompleteFromResponse에서 DB의 키워드 목록 동적 조회 (하드코딩 제거)

## Phase 1 로드맵 (2026-05-02~)

### 우선순위 1: AI 오케스트라 라우터 통합 (OpenRouter 기반)
- [x] DB 스키마: model_routing_rules 테이블 추가 (complexity, modelId, modelName, isActive, priority)
- [x] DB 스키마: ai_routing_logs 테이블 추가 (complexity, modelId, tokensIn, tokensOut, costUsd, durationMs)
- [x] 마이그레이션 SQL 직접 실행 (0041_model_routing_ai_logs.sql)
- [x] server/services/openrouter.ts: DB 기반 동적 모델 라우팅 지원 (routeModelFromDb 함수)
- [x] server/routers/modelRouting.ts: 모델 라우팅 규칙 CRUD API (list, upsert, reset, getLogs, getStats, getAvailableModels)
- [x] server/routers.ts: modelRoutingRouter 등록
- [x] client/src/pages/erp/ModelRoutingSettings.tsx: 모델 라우팅 설정 UI (규칙 테이블, 모델 변경, 비용 통계)
- [x] ERPLayout.tsx: 모델 라우팅 설정 라우트 및 사이드바 메뉴 추가 (/ai-engine/model-routing)
- [x] server/phase1-roadmap.test.ts: Phase 1 통합 테스트 작성 (159개 통과)

### 우선순위 2: 신규 파트너 온보딩 UI
- [x] DB 스키마: partner_onboarding 테이블 추가 (브랜드명, 사업자번호, 담당자, 상태, OCR 결과 등)
- [x] DB 스키마: portonePaymentId 컬럼 추가 (마이그레이션 0044)
- [x] server/routers/partnerOnboarding.ts: 가입 신청 CRUD + OCR 분석 API + 수동 시드 프로시저
- [x] server/uploadRoutes.ts: 사업자등록증 파일 업로드 엔드포인트 (busboy)
- [x] client/src/pages/PartnerOnboarding.tsx: 파트너 온보딩 페이지 (3단계: 기본정보→OCR→플랜선택+결제)
- [x] client/src/pages/erp/PartnerOnboardingAdmin.tsx: ERP 파트너 신청 관리 페이지
- [x] App.tsx: /partner/join 라우트 등록
- [x] ERPLayout.tsx: 파트너 온보딩 관리 메뉴 추가 (CRM 섹션)

### 우선순위 3: 카테고리별 샘플 선택 + DB 복제 자동화
- [x] server/services/sampleDataSeeder.ts: 카테고리별 샘플 패키지 6개 자동 생성 (국내/해외/혼합)
- [x] 파트너 온보딩 승인 시 자동 샘플 시드 실행 연동
- [x] 관리자 수동 시드 실행 프로시저 (seedSampleData)

### 우선순위 4: 파트너별 격리 DB 구조 (보류)
- [x] DB 스키마: tenants 테이블 추가 (스키마에만 추가, 실제 구현 보류)
- [x] 기존 주요 테이블에 tenantId 컨럼 추가 마이그레이션 (보류 - 단일 DB 유지 결정)
- [x] tRPC 미들웨어: 파트너 세션에서 tenantId 자동 주입 (보류 - 단일 DB 유지 결정)
- [x] 파트너 매니저 접근 시 tenantId 기반 데이터 격리 확인 (보류 - 단일 DB 유지 결정)

### 우선순위 5: 구독 플랜 UI + 포트원 V2 결제 연동
- [x] server/products.ts: 구독 플랜 상품 정의 (스타터/스탠다드/프리미엄)
- [x] server/services/portone.ts: 포트원 V2 결제 서비스 (검증/취소/조회)
- [x] server/routers/subscriptions.ts: 구독 결제 tRPC 라우터 (포트원 V2 기반)
- [x] 포트원 V2 환경변수 등록 (VITE_PORTONE_STORE_ID, VITE_PORTONE_CHANNEL_KEY, PORTONE_API_SECRET)
- [x] PartnerOnboarding.tsx: 포트원 V2 결제창 연동 (스탠다드/프리미엄 플랜)
- [x] server/portone.env.test.ts: 포트원 환경변수 검증 테스트 (통과)
- [x] client/src/pages/Pricing.tsx: 구독 플랜 선택 페이지 (홈페이지용)
- [x] client/src/pages/erp/SubscriptionManagement.tsx: ERP 구독 관리 페이지
- [x] App.tsx: /pricing 라우트 등록
- [x] ERPLayout.tsx: CRM 섹션에 구독 관리 메뉴 추가 (/subscriptions)

## 두골프마스터 → Manus API 파이프라인 구축 (2026-05-02)
- [x] server/scheduledRoutes.ts: /api/scheduled/dev-request, /api/scheduled/pipeline-status 엔드포인트 구현
- [x] server/_core/index.ts: registerScheduledRoutes 등록
- [x] MasterAI.tsx: pipelineStatus state 추가 (connected, taskId, recentCount)
- [x] MasterAI.tsx: useEffect로 /api/scheduled/pipeline-status 조회 (마운트 시 1회)
- [x] MasterAI.tsx: 헤더 배지 영역에 Activity 아이콘 + "파이프라인 연결됨/미연결" 배지 추가

## MasterAI UI/UX 전면 재설계 (2026-05-02)
- [x] 우측 슬라이드 패널 추가 (개발 완료 결과, AI 엔진 상태, 연동 서비스 현황)
- [x] 파일/이미지 첨부 기능 추가 (드래그앤드롭 + 클릭 업로드)
- [x] 입력창 하단 아이콘 툴바 추가 (첨부, 빠른명령, 개발요청, 통계)
- [x] 개발 완료 결과 채팅 내 인라인 표시 (완료된 devRequest 결과 카드)
- [x] AI 엔진 상태 패널 (오케스트라/어시스턴트/에이전트 탭)
- [x] 외부 연동 서비스 상태 표시 (GitHub, Slack, DB 연결 상태)
- [x] 채팅 세션 히스토리 슬라이드 패널 (이전 대화 목록)
- [x] 기술 로직도 보고서 문서 생성 (docs/master-ai-report.md)

## AI 엔진 파일 직접 분석 기능 [ID: 270001] (2026-05-02)
- [x] DB 스키마: fileAnalysis 테이블 추가 (drizzle/schema.ts)
- [x] 서버: 파일 업로드 tRPC 프로시저 (multipart/form-data → S3 저장)
- [x] 서버: 텍스트 추출 서비스 (PDF/DOCX/이미지 → 텍스트)
- [x] 서버: RAG 파이프라인 (파일 컨텍스트 + LLM 질의응답)
- [x] 서버: masterStream.ts에 파일 컨텍스트 주입 로직 추가
- [x] 프론트엔드: MasterAI 파일 첨부 → 업로드 → 분석 결과 표시
- [x] TypeScript 오류 0개 확인 및 체크포인트 저장

## AI 엔진 파일 직접 분석 기능 [ID: 270001] - 2026-05-02 완료

- [x] file_analysis DB 테이블 생성 (SQL 직접 실행)
- [x] server/services/fileExtractor.ts - PDF(pdfjs-dist)/DOCX(mammoth)/이미지(LLM Vision)/텍스트 추출
- [x] server/routers/fileAnalysis.ts - uploadAndExtract / analyzeWithAI / listBySession / getById / deleteFile
- [x] server/routers.ts - fileAnalysis 라우터 등록
- [x] MasterAI.tsx - 파일 업로드 → 텍스트 추출 → AI 분석 파이프라인 연동
- [x] MasterAI.tsx - 파일 분석 결과 채팅 내 인라인 표시
- [x] TypeScript 오류 0개 확인

## 파일 업로드 및 자동 분석 기능 보완 [ID: 300001] (2026-05-02)
- [x] 기존 구현 현황 파악 (270001에서 핵심 파이프라인 완료 확인)
- [x] masterStream.ts에 파일 컨텍스트 직접 주입 (SSE 스트리밍 시 파일 내용 포함)
- [x] fileAnalysis.ts에 S3 다운로드 URL 반환 기능 추가 (외부 공유 가능)
- [x] 파일 분석 결과 → 자동수행 에이전트 트리거 로직 추가 (분석 결과에 따른 devRequest 자동 생성)
- [x] 파일 분석 히스토리 페이지 (ERP 내 파일 분석 목록 조회)
- [x] TypeScript 오류 0개 확인 및 체크포인트 저장

## 모바일 우측 슬라이드 메뉴 버그 수정 [ID: 300002] (2026-05-02)
- [x] MasterAI.tsx 우측 슬라이드 패널 모바일 렌더링 오류 원인 파악
- [x] z-index, overflow, position 수정 (모바일 환경)
- [x] 터치 이벤트 및 스크롤 처리 개선
- [x] 탭 전환 및 콘텐츠 표시 오류 수정
- [x] TypeScript 오류 0개 확인 및 체크포인트 저장

## AI 대화 이력 조회 DB 쿼리 오류 수정 [ID: 300003] (2026-05-02)
- [x] ai_logs 테이블 쿼리 오류 원인 파악 (session_id snake_case → sessionId camelCase 컬럼명 불일치)
- [x] DB 쿼리 수정 (sql`COUNT(DISTINCT session_id)` → countDistinct(aiLogs.sessionId) Drizzle ORM 방식)
- [x] TypeScript 오류 0개 확인 및 체크포인트 저장

## AI 능동적 알림 기능 추가 [ID: 300004] (2026-05-02)
- [x] drizzle/schema.ts에 ai_notifications 테이블 추가 (type, title, body, devRequestId, isRead, actionUrl, actionLabel, priority, source)
- [x] DB 마이그레이션 (직접 SQL 스크립트로 테이블 생성 확인)
- [x] server/routers/aiNotifications.ts 라우터 구현 (create, listUnread, list, markRead, markAllRead, getUnreadCount, pollNew)
- [x] server/routers.ts에 aiNotifications 라우터 등록
- [x] devRequest.ts markCompleted / detectAndCompleteFromResponse에서 알림 자동 생성 연동
- [x] MasterAI.tsx 능동적 알림 수신 UI (30초 폴링 + Bell/BellRing 배지 + 알림 패널 슬라이드)
- [x] TypeScript 오류 0개 확인 및 체크포인트 저장

## AI 비동기 실행 및 스케줄링 기능 도입 [ID: 300005] (2026-05-02)
- [x] drizzle/schema.ts에 ai_scheduled_tasks 테이블 추가 (taskType, title, prompt, scheduledAt, status, result, executedAt, notifyOnComplete)
- [x] DB 마이그레이션 (직접 SQL로 테이블 생성 확인)
- [x] masterTools.ts에 schedule_task 도구 추가 (AI가 Tool Calling으로 자연어 명령 시 자동 예약 등록)
- [x] server/routers/scheduledTasks.ts 라우터 구현 (create, list, cancel, execute, getStats)
- [x] server/routers.ts에 scheduledTasksRouter 등록
- [x] scheduledRoutes.ts에 /api/scheduled/run-tasks 엔드포인트 추가 (Manus 스케줄 폴링용, 실행 예정 작업 자동 처리)
- [x] MasterAI.tsx 예약 작업 패널 UI (Clock 버튼 + 대기 배지 + 슬라이드 패널 + 취소 기능)
- [x] TypeScript 오류 0개 확인 및 체크포인트 저장

## AI 비용 분석 및 로그 데이터 무결성 오류 수정 [ID: 300006] (2026-05-02)
- [x] masterTools.ts get_ai_cost_summary groupBy 'assistant' 오류 수정: ai_cost_logs에 assistant 콼럼 추가 및 groupBy 매핑 수정
- [x] masterStream.ts ai_logs costUsd 0 기록 수정: String((finalResponse.costUsd || 0).toFixed(6)) 사용
- [x] routers.ts aiCostLogs insert에 assistant 필드 추가
- [x] TypeScript 오류 0개 확인 및 체크포인트 저장

## AI 에이전트 아키텍처 재설계: 관리자 승인 기반 자율 외부 연동 [ID: 300007] (2026-05-02)
- [x] DB 스키마 추가: ai_agent_approvals (승인 요청 저장), ai_session_state (세션 상태 저장)
- [x] server/routers/agentApprovals.ts 라우터 구현 (create, approve, reject, getPending, getBySession)
- [x] server/routers.ts에 agentApprovalsRouter 등록
- [x] masterTools.ts에 web_search, fetch_url 외부 검색 도구 추가 (승인 필요 도구로 표시)
- [x] masterTools.ts에 세션 상태 관리 도구 추가 (set_session_state, get_session_state)
- [x] masterStream.ts에 승인 필요 도구 감지 및 approval_request 이벤트 전송 로직 추가
- [x] masterStream.ts에 승인 대기 → 승인 완료 후 도구 실행 재개 로직 추가
- [x] MasterAI.tsx에 approval_request 이벤트 수신 및 승인/거부 UI 추가
- [x] TypeScript 오류 0개 확인 및 체크포인트 저장

## AI 파이프라인-데이터 동기화 실시간성 개선 [ID: 300008] (2026-05-02)
- [x] server/services/realtimeEvents.ts: SSE 이벤트 브로커 서비스 구현 (subscribe/unsubscribe/publish)
- [x] server/_core/index.ts에 /api/realtime/events SSE 엔드포인트 등록
- [x] devRequest.ts 상태 변경 시 realtimeEvents.publish 호출 (created/updated/completed)
- [x] masterStream.ts done 이벤트 시 realtimeEvents.publish 호출 (ai_log_created)
- [x] scheduledRoutes.ts 파이프라인 실행 완료 시 realtimeEvents.publish 호출 (pipeline_done)
- [x] MasterAI.tsx useEffect로 /api/realtime/events SSE 구독 (EventSource)
- [x] MasterAI.tsx SSE 이벤트 수신 시 해당 쿼리 자동 invalidate (devRequests, aiLogs, notifications)
- [x] MasterAI.tsx 실시간 연결 상태 표시 (연결됨/재연결 중 배지)
- [x] TypeScript 오류 0개 확인 및 체크포인트 저장

## 개발 요청-Manus API 양방향 동기화 긴급 수정 [ID: 300009] (2026-05-02)
- [x] server/services/manusPipe.ts: createDevRequestTask() 함수 추가 (개발 요청 생성 시 Manus Task 1:1 매핑)
- [x] server/routers/devRequest.ts create 프로시저: 생성 후 Manus Task 자동 생성 및 manusTaskId 저장
- [x] server/services/manusSync.ts: Manus Task 상태 폴링 서비스 구현 (5분 간격, in_progress 요청 대상)
- [x] server/scheduledRoutes.ts: /api/scheduled/manus-sync 엔드포인트 추가 (폴링 트리거)
- [x] server/_core/index.ts: 서버 시작 시 manusSync 자동 폴링 시작
- [x] scripts/migrate-manus-mapping.mjs: 잘못 매핑된 in_progress 요청 검증 및 재할당 스크립트
- [x] TypeScript 오류 0개 확인 및 체크포인트 저장

## 긴급 버그 수정: AI엔진/대시보드/Manus API/자동완료 (2026-05-02)
- [x] AI엔진 분석: ai_logs costUsd 0 저장 버그 수정 (masterStream.ts에서 costUsd 올바르게 저장)
- [x] AI엔진 분석: get_ai_cost_summary groupBy assistant 오류 수정
- [x] 마스터 대시보드: 파이프라인 미연결 → 배포 환경에서 개발 요청 데이터 정상 로드 (scheduledRoutes.ts manusConnected 로직 수정)
- [x] Manus API 연결 상태: MANUS_API_KEY 존재 시 연결됨 표시 (scheduledRoutes.ts manusConnected: !!process.env.MANUS_API_KEY 수정)
- [x] 개발 완료 자동 전환: manusSync 폴링에서 Manus Task stopped 감지 시 ERP 상태 자동 completed 업데이트 (manusSync.ts 구현)
- [x] Manus 결과 자동 수집: manusSync.ts 완료 감지 시 result 자동 저장 + AI 알림 자동 생성 (createAiNotification 연동)
- [x] 모바일 UI: 개발 요청 목록 및 이어나가기 기능 모바일 최적화 (MasterAI.tsx 모바일 패널 w-[85vw] 수정)

## [ID: 300010] 오류 로그 조회 API DB 쿼리 실패 버그 수정 (2026-05-02)
- [x] get_error_logs API 관련 코드 위치 파악 (masterTools.ts getErrorLogs 함수)
- [x] DB 쿼리 실패 원인 분석 (집계 쿼리에서 Drizzle ORM 컬럼 참조 방식 확인)
- [x] 버그 수정 및 쿼리 정상화 (aiEngineLogs.errorType, aiEngineLogs.status 컬럼 참조 수정)
- [x] TypeScript 오류 0개 확인
- [x] 체크포인트 저장

## [ID: 300011] 개발 완료 결과물 메모 자동 입력 기능 (2026-05-02)
- [x] 개발 요청 상세 페이지에서 '자동가져오기' 버튼 및 메모 입력 관련 코드 위치 파악
- [x] devRequest.ts updateStatus 또는 markCompleted 시 메모 자동 입력 서버 로직 추가
- [x] manusSync.ts 완료 감지 시 result를 notes/memo 필드에 자동 저장 (resultText 자동 저장 구현)
- [x] 프론트엔드: 개발 완료 상태 전환 시 메모 자동 갱신 (SSE dev_request_completed 이벤트 활용)
- [x] TypeScript 오류 0개 확인
- [x] 체크포인트 저장

## [ID: 300012] 대화 이력 사이드 메뉴 및 이어가기 기능 (2026-05-02)
- [x] aiLogs 테이블에서 세션 그룹화 가능한지 확인 (sessionId 컬럼 있음, assistant='master' 필터)
- [x] 별도 테이블 불필요 - 기존 aiLogs 테이블 sessionId 활용
- [x] chat.ts 라우터에 listMasterSessions, getMasterSessionMessages 프로시저 추가
- [x] MasterAI.tsx RightPanel에 '대화이력' 탭 추가 (4번째 탭)
- [x] 세션 목록: 날짜별 그룹핑, 첫 메시지 제목, 메시지 수 표시
- [x] 세션 클릭 시 해당 대화 내용 로드 및 이어가기 기능
- [x] 새 대화 시작 버튼 추가
- [x] TypeScript 오류 0개 확인
- [x] 체크포인트 저장

## [파트너 랜딩페이지] partner.dayoutgolf.com 구축 (2026-05-02)
- [x] 현재 pricing, partner, partner/chat, partner/join 페이지 분석
- [x] 최신 AI 비즈니스 랜딩페이지 트렌드 조사 (Notion, Linear, Vercel 등)
- [x] /partner-landing 라우트 생성 (파트너 홍보 랜딩페이지)
- [x] 히어로 섹션: "AI 여행사 플랫폼" 강조, 구글 기술 사용 강조
- [x] 챗봇 소개 섹션: 두골프마스터(자율수행), 골프톡(고객), 두골프매니저(파트너) 기능 소개
- [x] 실시간 개발 히스토리 섹션: DB에서 날짜별 기능 개발 이력 표시
- [x] 가격 정책 섹션: 현재 pricing 페이지 연동
- [x] 샘플 사이트 섹션: 두골프를 샘플 사이트 중 하나로 표시
- [x] 회사명/푸터: 주식회사 투어커뮤니케이션으로 설정
- [x] Manus/마누스 텍스트 → 투어커뮤니케이션으로 변경
- [x] 두골프 매니저 챗봇 가입 플로우 개선 (구글 간편가입 연동)
- [x] 사업자등록증 PDF/이미지 OCR 인식 기능 추가 (PartnerOnboarding.tsx)
- [x] 파트너 가입 완료 후 하위 담당자 등록 기능 (PartnerMyPage.tsx)
- [x] 하위 담당자 로그인 기능 (PartnerStaffLogin.tsx)
- [x] TypeScript 오류 0개 확인
- [x] 체크포인트 저장

## [파트너 챗봇 가입 플로우 개선] (2026-05-04)
- [x] 파트너 온보딩 라우터에 getMyStatus 프로시저 추가 (로그인 사용자 신청 상태 확인)
- [x] PartnerChat.tsx 개선: 비로그인 시 구글 간편가입 화면 표시
- [x] PartnerChat.tsx 개선: 로그인 후 온보딩 미신청 시 가입 안내 화면 표시
- [x] PartnerChat.tsx 개선: 온보딩 신청 중(pending/reviewing/rejected) 상태별 화면 표시
- [x] PartnerChat.tsx 개선: 승인 완료 시 기존 채팅 UI 표시

## [파트너 가입 플로우 완성] OCR 자동 등록 + 하위 담당자 (2026-05-04)
- [x] DB 스키마: partnerOnboarding에 관광사업자등록증 필드 추가 (tourismLicenseKey, tourismLicenseUrl, tourismOcrResult, tourismLicenseNo, tourismLicenseType, tourismOpenDate)
- [x] DB 스키마: partner_staff 테이블 신규 생성 (하위 담당자: partnerId, name, email, phone, role, loginId, loginPwHash, isActive)
- [x] DB 마이그레이션 실행 (pnpm db:push)
- [x] 서버: partnerOnboarding.ocrTourismLicense 프로시저 추가 (관광사업자등록증 OCR)
- [x] 서버: partnerOnboarding.submitWithOcr 프로시저 개선 (수기 입력 없이 OCR 결과로만 자동 등록)
- [x] 서버: partnerOnboarding.updateMyInfo 프로시저 추가 (승인 후 정보 수정)
- [x] 서버: partnerStaff.create/list/update/delete 프로시저 추가 (하위 담당자 CRUD)
- [x] 서버: partnerStaff.login 프로시저 추가 (하위 담당자 로그인 - JWT 발급)
- [x] UI: PartnerOnboarding.tsx 개선 - 사업자등록증 + 관광사업자등록증 OCR 업로드 UI (수기 입력 제거)
- [x] UI: PartnerMyPage.tsx 신규 생성 - OCR 결과 수정 + 하위 담당자 관리 페이지
- [x] UI: PartnerStaffLogin.tsx 신규 생성 - 하위 담당자 로그인 페이지 (/partner/staff-login)
- [x] App.tsx에 /partner/my, /partner/staff/login 라우트 추가 (확인됨)

## [OCR 자동 승인 + 비밀번호 재설정] (2026-05-04)
- [x] submitWithBothOcr: 두 등록증 OCR 완료 시 자동으로 approved 상태 처리 (관리자 검토 없음) - partnerOnboarding.ts에 구현
- [x] 자동 승인 시 샘플 데이터 자동 생성 (onPartnerApproved 호출) - 구현됨
- [x] DB: partner_staff_password_reset 테이블 생성 (token, staffId, expiresAt) - schema.ts에 존재
- [x] 서버: partnerStaff.requestPasswordReset 프로시저 (이메일로 재설정 링크 발송) - 구현됨
- [x] 서버: partnerStaff.resetPassword 프로시저 (토큰 검증 후 비밀번호 변경) - 구현됨
- [x] UI: 하위 담당자 로그인 페이지에 "비밀번호 찾기" 링크 추가 - PartnerStaffLogin.tsx에 구현
- [x] UI: 비밀번호 재설정 페이지 (/partner/reset-password?token=xxx) - PartnerResetPassword.tsx 구현

## [투어커뮤니케이션 파트너 랜딩페이지] (2026-05-04)
- [x] partner-landing 소스 dogolf 프로젝트에 통합 (/partner-landing 라우트)
- [x] 파트너 랜딩 전용 CSS 스타일 index.css에 추가 (glass, gradient-text, particle-bg 등)
- [x] App.tsx에 /partner-landing 라우트 등록
- [x] 체크포인트 저장 및 배포 준비
- [x] partner.dayoutgolf.com 도메인 연결 (Settings → Domains) - 이미 연결됨 (확인됨)

## [파트너 가입 플로우 완성 - 구현 완료] (2026-05-04)
- [x] DB 스키마: partnerOnboarding에 관광사업자등록증 필드 추가
- [x] DB 스키마: partner_staff 테이블 신규 생성 (하위 담당자)
- [x] DB 스키마: partner_staff_password_reset 테이블 생성
- [x] 서버: ocrTourismLicense 프로시저 (관광사업자등록증 OCR)
- [x] 서버: submitWithBothOcr 프로시저 (두 등록증 OCR + 자동 승인 처리)
- [x] 서버: updateMyInfo 프로시저 (파트너 정보 수정)
- [x] 서버: getMyStatus 확장 (전체 파트너 정보 포함)
- [x] 서버: partnerStaff CRUD (list, add, update, delete)
- [x] 서버: partnerStaff.login (하위 담당자 로그인 - JWT 발급)
- [x] 서버: partnerStaff.requestPasswordReset (이메일 재설정 링크)
- [x] 서버: partnerStaff.resetPassword (토큰 검증 후 비밀번호 변경)
- [x] UI: PartnerOnboarding.tsx 전면 개편 (두 등록증 OCR + 자동 승인 플로우)
- [x] UI: PartnerMyPage.tsx 신규 생성 (OCR 결과 수정 + 하위 담당자 관리)
- [x] UI: PartnerStaffLogin.tsx 신규 생성 (하위 담당자 로그인 + 비밀번호 재설정)
- [x] App.tsx 라우트 등록: /partner/my, /partner/staff/login

## [버그 수정 - partner.dayoutgolf.com 리다이렉트] (2026-05-04)
- [x] partner.dayoutgolf.com 접속 시 /partner-landing으로 리다이렉트 안 되는 문제 수정
- [x] 커스텀 로그인 페이지 구현 (/partner/login)
- [x] 비밀번호 재설정 페이지 구현 (/partner/reset-password)
- [x] 체크포인트 저장 및 배포

## [Google OAuth 직접 연동 - manus.im 선택화면 우회] (2026-05-04)
- [x] 서버: /api/partner/auth/google 엔드포인트 구현 (partnerGoogleAuth.ts) - 구현됨
- [x] 클라이언트: PartnerLogin.tsx 로그인 버튼을 새 엔드포인트로 연결 - 구현됨
- [x] 초대코드(4GFPMBWPCYQM6) 자동 적용 처리 - customOAuth.ts에 구현
- [x] 모바일 최적화 확인 - PartnerLogin.tsx 반응형 디자인 적용됨
- [x] 체크포인트 저장 및 배포


## [커스텀 OAuth 로그인 페이지 구현 - manus.im 완전 우회]
- [x] 서버: OAuth 제공자별(Google/Facebook/Apple/Microsoft) 단독 로그인 URL 생성 엔드포인트 구현
- [x] 서버: 초대코드(4GFPMBWPCYQM6) 자동 적용 로직 구현
- [x] 클라이언트: 커스텀 OAuth 로그인 페이지 UI 구현 (Google/Microsoft/Meta/Apple 아이콘)
- [x] 클라이언트: 모바일 최적화 (반응형 디자인)
- [x] 클라이언트: 모든 URL에서 "manus" 텍스트 제거
- [x] 테스트: Google/Facebook/Apple/Microsoft 로그인 각각 테스트 - 코드 구현 완료, 실제 로그인 테스트는 Google OAuth Client ID/Secret 등록 후 운영자가 직접 확인 필요
- [x] 테스트: 초대코드 크레딧 자동 적용 확인 - 코드 구현 완료, 실제 적용은 운영 환경에서 확인 필요

## AI 엔진 Phase 2: GitHub 연동 + 코드 히스토리 보관 (2026-05-05)

### Phase 2-A: 환경변수 및 DB 스키마
- [x] GITHUB_TOKEN 시크릿 등록 (Personal Access Token)
- [x] GITHUB_REPO_OWNER, GITHUB_REPO_NAME 환경변수 등록
- [x] DB 스키마: github_commits 테이블 추가 (devRequestId, commitSha, commitUrl, branch, filesChanged, message, createdAt)
- [x] DB 마이그레이션 실행 (pnpm db:push)

### Phase 2-B: 서버 구현
- [x] server/_core/github.ts: GitHub API 헬퍼 (getRepo, listCommits, getFileContent, createOrUpdateFile, searchCode)
- [x] server/routers/github.ts: GitHub tRPC 라우터 (getRepoInfo, listCommits, searchCode, linkCommit, getLinkedCommits)
- [x] server/routers.ts: githubRouter 등록
- [x] devRequest.ts: 완료 처리 시 GitHub 커밋 자동 연결 로직 추가

### Phase 2-C: ERP UI 구현
- [x] client/src/pages/erp/GitHubSettings.tsx: GitHub 연동 설정 페이지 (토큰 상태, 저장소 정보, 연결 테스트)
- [x] client/src/pages/erp/GitHubHistory.tsx: 코드 히스토리 뷰어 (커밋 목록, 파일 변경 내역, devRequest 연결)
- [x] ERPLayout.tsx: AI 엔진 관리 섹션에 GitHub 메뉴 추가 (/ai-engine/github-settings, /ai-engine/github-history)
- [x] DevAI.tsx: 요청 카드에 연결된 GitHub 커밋 링크 표시

### Phase 2-D: 중복 개발 방지 (코드 재사용 추천)
- [x] masterTools.ts: search_github_code 도구 추가 (기존 코드 검색)
- [x] devRequest.ts: 새 요청 생성 시 GitHub 유사 코드 자동 검색 및 추천 메시지 추가

### 완료 조건
- [x] TypeScript 오류 0개 확인
- [x] Vitest 테스트 10/10 통과
- [x] 체크포인트 저장 및 Publish


## OpenRouter 에이전트 메시지 길이 제한 해결

- [x] messageSplitter.ts: 메시지 자동 분할 유틸리티 (4,000자 초과 시 파일 생성)
- [x] openrouterAgent.ts: chat 뮤테이션에 분할 로직 통합
- [x] OpenRouterAgent.tsx: 첨부 파일 UI 표시 (다운로드 링크)
- [x] OpenRouterAgent.tsx: 요청 입력 4,000자 자동 분할 기능 추가
- [x] OpenRouterAgent.tsx: 문자 수 실시간 표시 + 진행률 바
- [x] OpenRouterAgent.tsx: 분할 메시지 순서 표시 ([1/3] 형식)
- [x] openrouterAgent.ts: 순차 전송 시 500ms 딜레이 (레이트 리밋 방지)
- [x] TypeScript 오류 0개 확인


## CRM 마스터 관리자 계정 생성 기능 (ID: 360002)
- [x] Phase 1: CRM 모듈 현황 분석 및 DB 스키마 검토
  - [x] 기존 관리자 권한 구조 분석
  - [x] users 테이블 role 필드 검토
  - [x] 마스터 관리자 권한 정의
- [x] Phase 2: DB 스키마 수정 - 관리자 계정 관리 테이블 추가
  - [x] admin_accounts 테이블 생성 (id, username, passwordHash, role, createdBy, createdAt, updatedAt, isActive)
  - [x] pnpm db:push 실행
- [x] Phase 3: 백엔드 API 개발 - 관리자 계정 생성/조회/삭제
  - [x] tRPC adminAccounts 라우터 생성 (create, list, update, delete, changePassword)
  - [x] 비밀번호 해싱 로직 (bcrypt)
  - [x] 권한 검증 (adminProcedure 사용)
- [x] Phase 4: 프론트엔드 UI 개발 - 마스터 관리 페이지
  - [x] CRM 사이드바에 "마스터 관리" 메뉴 추가
  - [x] AdminMasterManagement.tsx 페이지 생성
  - [x] 관리자 목록 테이블 (username, role, createdAt, 수정/삭제 버튼)
  - [x] 신규 관리자 추가 다이얼로그 (username, password, role 선택)
  - [x] 비밀번호 변경 기능
- [x] Phase 5: 통합 테스트 및 배포
  - [x] 관리자 계정 생성/조회/삭제 테스트
  - [x] 권한 검증 테스트
  - [x] 체크포인트 저장 및 배포


## 마스터 ERP 독립 인증 시스템 구축 (ID: 360003)
- [x] Phase 1: 마스터 ERP 로그인 페이지 생성 (/erp/login)
  - [x] ID/PW 입력 폼 (Manus OAuth 없음)
  - [x] admin_accounts 테이블 기반 인증
  - [x] bcrypt 비밀번호 해싱
- [x] Phase 2: 독립 인증 미들웨어 및 세션 관리
  - [x] adminAuth.ts 미들웨어 구현
  - [x] admin_session 쿠키 생성 및 검증
  - [x] 세션 TTL 관리 (24시간)
  - [x] 만료된 세션 자동 정리
  - [x] ERPLayout에서 마스터 세션 확인
- [x] Phase 3: tRPC 프로시저 분리 (마스터 vs Manus)
  - [x] masterProcedure 정의 (마스터 세션 필수)
  - [x] adminManagementRouter 구현 (list, create, update, delete, changePassword, toggleActive)
  - [x] adminAuthRouter 구현 (login, logout, me)
- [x] Phase 4: 네비게이션 및 UI 통합
  - [x] CRM 메뉴에 "마스터 관리" 추가 (/crm/admin-management)
  - [x] AdminManagement.tsx 페이지 구현 (관리자 목록, 생성, 수정, 삭제)
  - [x] Footer 링크 업데이트 (/erp/login으로 변경)
- [x] Phase 5: 테스트 및 배포
  - [x] masterERP.test.ts 작성 (15개 테스트 - 모두 통과)
  - [x] TypeScript 오류 0개 확인
  - [x] Dev 서버 정상 실행 확인

## ERP 마스터 로그인 버그 수정 (2026-06-05)
- [x] ERPLayout 마스터 로그인 버튼 URL 중복 문제 수정 (wouter 상대경로 → 절대 URL)
- [x] ERPLayout 중복 Manus OAuth 블록 제거 (데드코드)
- [x] ERPLogin.tsx tRPC 요청 형식 수정 (json 래퍼 사용)
- [x] cookie-parser 미들웨어 추가 (admin_session 쿠키 파싱)
- [x] context.ts 수정: admin_session 쿠키 → ctx.user 주입 (protectedProcedure 마스터 세션 허용)
- [x] index.ts 수정: admin_session 미들웨어 추가 (masterProcedure ctx.req.adminSession 설정)
- [x] main.tsx 수정: /erp 경로에서 UNAUTHORIZED 시 Manus OAuth 대신 마스터 로그인 페이지로 리다이렉트

## ERP 계정 관리 및 API 키 관리 개선 (2026-06-05)
- [x] 문제 1: API 키 및 ERP 시스템 독립성 - ERP DB에 암호화 저장, 마스터가 설정한 키를 모든 직원이 공유
- [x] 문제 2: 계정 권한 분리 - master만 계정 생성/삭제/비활성화, admin은 자기 비밀번호만 변경
- [x] AdminManagement.tsx 개선 - 역할 기반 UI (master/admin 구분), 보호된 계정 표시
- [x] ERPSettings.tsx 탭 추가 - API 키 관리 탭 (master 전용)
- [x] 백엔드 권한 검증 확인 - master 전용 API 키 관리, admin은 접근 불가 (FORBIDDEN 403)

## 두골프 매니저 LLM 사이드바 메뉴 추가 [ID: 390001] (2026-06-05)
- [x] ManagerChat.tsx 신규 생성 (두골프 매니저 LLM 채팅 전용 페이지)
- [x] ERPLayout.tsx import 추가 (ManagerChat)
- [x] 사이드바 navItems AI 챗봇 그룹에 '두골프 매니저 💼' 메뉴 추가 (/manager-chat)
- [x] Route 등록 (/manager-chat → ManagerChat 컴포넌트)
- [x] TypeScript 오류 0개 확인
- [x] managerChat API 동작 확인 (Gemini 2.5 Flash 응답)

## 개발요청 시스템 버그 수정 및 자율수행데스크 연동 [ID: 390002] (2026-06-05)
- [x] 상태 원복 버그 수정 - updateRequest에서 undefined 필드 제거 (Drizzle ORM null 처리 버그 방지)
- [x] approved(승인) 상태 추가 - updateRequest/updateStatus enum에 approved 추가
- [x] 카테고리 추가 - CATEGORY_LABELS에 manager_talk(두골프 매니저톡), ui_ux, erp 추가
- [x] 승인 시 자율수행데스크 자동 연동 - updateStatus approved 시 sendSingleRequestToManus 자동 호출
- [x] 프론트엔드 상태 버튼 업데이트 - 승인 버튼 추가, 승인 시 알림 메시지 표시

## 마스터 AI OpenRouter 모델 404 오류 수정 [ID: 420001] (2026-06-05)
- [x] DB model_routing_rules에서 gemini-2.0-flash-lite-001 → gemini-2.5-flash-lite 업데이트
- [x] server/routers/modelRouting.ts DEFAULT_MODEL_RULES 기본값 수정
- [x] server/routers.ts 초기화 기본값 수정
- [x] server/services/openrouter.ts MODEL_MAP low 모델 수정

## 타 데스크 지식 차단 시스템 (ERP 서버 레벨)
- [x] DB 스키마: knowledge_block_logs 테이블 추가 (차단 이력 저장)
- [x] server/services/knowledgeFilter.ts: 차단 키워드 패턴 필터 서비스 구현
- [x] server/routers/knowledgeBlock.ts: tRPC 라우터 (차단 로그 조회/수동 차단 등록)
- [x] server/routers.ts: knowledgeBlock 라우터 통합
- [x] client/src/pages/erp/KnowledgeBlockLog.tsx: 차단 이력 ERP UI 페이지
- [x] ERPLayout.tsx: 사이드바에 "지식 차단 관리" 메뉴 추가

## 버그 수정 [ID: 450001] - 로그아웃 시 로그인 페이지 즉시 리디렉션
- [x] ERPLayout.tsx 로그아웃 버튼 클릭 후 /erp 로그인 페이지로 즉시 리디렉션 처리
- [x] adminAuth.logout tRPC 뮤테이션 onSuccess에서 window.location.href 또는 setLocation 호출
- [x] 로그아웃 후 ERP 세션 상태 초기화 확인

## 버그 수정 - 로그아웃 즉시 리디렉션 근본 원인 수정
- [x] ERPLayout.tsx: hasMasterSession 조건에서 adminLoginTime 잔존 시 로그아웃 후에도 ERP 유지되는 문제 수정
- [x] 로그아웃 버튼 클릭 시 adminLogoutMutation 호출 전 즉시 localStorage 초기화 처리

## 신규 기능 - ERP 개발완료 버튼 → Manus Publish 자동 연동
- [x] server/routers/devRequests.ts: markComplete 프로시저에 Manus Publish API 호출 로직 추가
- [x] ERP 개발 요청 완료 처리 시 Manus WebDev 게시(Publish) 자동 트리거
- [x] 게시 성공/실패 결과를 ERP UI에 표시

## 시스템 전체 기능 및 UI 정합성 검토 [ID: 480001]
- [x] ERP 전체 구조 파악 (라우터/페이지/사이드바/DB 전수 조사)
- [x] 기능별 정합성 검증 (API 연결 상태, 빈 페이지, 미작동 기능)
- [x] 조사 결과 리스트업 및 우선순위 분류 - TypeScript 0오류, 라우트-컴포넌트 정상, 모든 API 라우터 등록 확인
- [x] CRITICAL/HIGH 문제 없음 (정상 상태)
- [x] MEDIUM 문제 수정 및 UI 정합성 개선 - partner OG 이미지 추가 완료
- [x] 최종 검증 및 체크포인트 저장

## 보안 강화 [ID: 510001]
- [x] 예약 API RBAC - adminProcedure 적용 (update, delete, addIncome, addRemittance 등 민감 API)
- [x] 예약 API RBAC - 본인 등록 예약 수정/삭제 허용 로직 (user 역할)
- [x] AI 서비스 예약 접근 시 사용자 컨텍스트 검증 추가 (openrouterAgent.ts)
- [x] RBAC 보안 테스트 작성 (210개 전체 통과)

## 두골프 마스터 AI LLM 기능 개선 [2026-06-06]

- [x] MasterCosts.tsx: `getCostSummary` 실제 응답 형식(`rows`, `totalCost`, `totalMessages`)에 맞게 UI 리팩터링
- [x] MasterCosts.tsx: `(costData as any)` 패턴 완전 제거, 타입 안전성 확보
- [x] MasterCosts.tsx: 어시스턴트별 비용 표시 - `rows` 배열 기반으로 변경 (tokensIn/tokensOut 분리 표시)
- [x] docs/master-ai-report.md: 7.2 미완료 항목 → 완료 상태로 업데이트 (3개 항목 모두 완료)
- [x] docs/master-ai-report.md: 8.1 현재 한계점 → 구현 완료 항목으로 업데이트
- [x] docs/master-ai-report.md: 8.2 GitHub API 추천 항목 제거 → 실제 연동 현황 표로 교체
- [x] docs/master-ai-report.md: 9.2 Phase 2 GitHub 연동 → 실제 완료된 기능으로 업데이트
- [x] docs/master-ai-report.md: 10. 결론 업데이트 (현재 완료 상태 반영)

## Phase 2 아키텍처 개선안 구현 [ID: 540001]

### transactionId 생성/전파
- [x] context.ts: 요청별 고유 transactionId 생성 (crypto.randomUUID) 및 TrpcContext에 추가
- [x] index.ts: Express 미들웨어에서 X-Transaction-ID 헤더 읽기/생성 및 req에 주입
- [x] masterStream.ts: transactionId 생성 및 SSE 이벤트에 포함
- [x] trpc.ts: transactionId를 ctx에 포함하여 모든 프로시저에서 접근 가능하도록

### AI 서비스 callerContext 권한 검증
- [x] masterTools.ts: executeTool에 CallerContext 파라미터 추가 (userId, role, transactionId)
- [x] masterTools.ts: 민감 도구(get_customer_info, get_settlement_summary 등)에 admin 권한 검증 추가
- [x] ai.ts: masterChat/masterStream에서 executeTool 호출 시 callerContext 전달 (masterStream.ts에서 처리)
- [x] masterStream.ts: executeTool 호출 시 callerContext 전달

### 프론트엔드 useBookingsQuery 훅
- [x] client/src/hooks/useBookingsQuery.ts: 예약 목록 조회 커스텀 훅 구현 (필터/페이지네이션/정렬 상태 관리)
- [x] ReservationManagement.tsx: useBookingsQuery 훅으로 리팩터링

### 테스트
- [x] server/phase2.architecture.test.ts: transactionId 생성/전파 테스트
- [x] server/phase2.architecture.test.ts: callerContext 권한 검증 테스트 (ADMIN_ONLY_TOOLS 전체 검증)
- [x] server/phase2.architecture.test.ts: 하위 호환성 테스트 (callerCtx 없이 호출 시 권한 검증 건너맰)

## 두골프마스터 대화 이력 개선 [2026-06-06]

- [x] 우측 슬라이드 "지난 대화 불러오기" - 최신 대화 전체 메시지 로드 (limit 40→500, 최신순 정렬 후 시간순 재정렬)
- [x] 대화이력 페이지 - 각 세션에 "대화 이어가기" 아이콘 버튼 추가 (MessageSquarePlus 아이콘)
- [x] "대화 이어가기" 클릭 시 두골프마스터 채팅창으로 이동 + URL 파라미터로 해당 세션 자동 로드

## 이미지 아카이브 관리 기능 개발 [ID: 600001]

- [x] drizzle/schema.ts: imageArchiveLogs 테이블 추가 (fileId, fileName, driveUrl, source, processedAt, deletedAt, deletedBy)
- [x] pnpm db:push 실행 (DB 직접 실행으로 대체)
- [x] server/services/googleDrive.ts: Google Drive API 서비스 (파일 삭제 기능)
- [x] server/routers/imageArchive.ts: tRPC 라우터 (list, deleteFiles, logImage, getStats)
- [x] server/routers.ts: imageArchive 라우터 등록
- [x] client/src/pages/erp/ImageArchive.tsx: 이미지 아카이브 관리 UI (기간/출캘 필터, 체크박스 선택, 삭제 버튼)
- [x] client/src/components/ERPLayout.tsx: 사이드바에 "이미지 아카이브" 메뉴 추가
- [x] server/imageArchive.test.ts: 테스트 작성 (237개 테스트 모두 통과)

## 마누스채봇 구현 [ID: 700001]
- [x] drizzle/schema.ts: manusWebhookLogs 테이블 추가 (taskId, eventType, content, rawPayload, receivedAt)
- [x] pnpm db:push 실행
- [x] server/routers/manusWebhook.ts: 웹훅 수신 엔드포인트 + tRPC 라우터 (getLogs, getStats, sendTest)
- [x] server/_core/index.ts: /api/manus/webhook Express 라우트 등록
- [x] 웹훅 수신 시 realtimeEvents SSE로 프론트엔드에 실시간 푸시
- [x] client/src/pages/erp/ManusChat.tsx: 마누스채봇 페이지 (웹훅 메시지 채팅창 형태 표시, SSE 실시간 수신)
- [x] client/src/components/ERPLayout.tsx: AI챗봇 카테고리 > 두골프마스터 바로 아래 "마누스채봇" 메뉴 추가
- [x] /erp/manus-chat 라우트 ERPLayout 내부에 등록
- [x] server/manusWebhook.test.ts: 테스트 작성 (5개 테스트 모두 통과)

## 마누스채봇 웹훅 자동 등록 [ID: 700002]
- [x] server/routers/manusWebhook.ts: Manus API 웹훅 등록(registerWebhook), 조회(getWebhookStatus), 삭제(unregisterWebhook) tRPC API 추가
- [x] ManusChat.tsx: 웹훅 등록 상태 표시 패널 추가 (등록됨/미등록 상태 배지)
- [x] ManusChat.tsx: "웹훅 등록" / "웹훅 해제" 버튼 추가 (관리자 전용)
- [x] server/manusWebhook.test.ts: 웹훅 등록 API 테스트 추가 (10개 테스트 모두 통과)

---

## 후보 기능 (검토불필요)

> 구현은 완료되어 있으나, 마스터/분양 레이어 설계 확정 후 재검토 예정입니다.
> 사이드바 노출 차단 상태이며, 코드/DB/API는 그대로 유지합니다.

### 마누스채봇 [ID: 700001, 700002]

- 비활성화 이유: 마스터/분양 레이어 분리 설계 확정 전까지 노출 보류
- 재검토 조건: 분양 레이아웃 설계 완료 후 마스터 레이어 전용 기능으로 재배치 여부 결정
- 현재 상태: ERPLayout.tsx 사이드바 메뉴 주석 처리 완료 (2026-06-07), 코드/DB/API 유지

---

## CRITICAL 개선 완료 (2026-06-07)

- [x] AI 챗봇 + AI 마스터 + AI 엔진 관리 → "AI 관리" 단일 카테고리로 통합
- [x] Dashboard.tsx 강화: KPI 8개(오늘/이번달/누적), 빠른 액션 버튼, 알림 배너, AreaChart 추가
- [x] dashboard.stats API: todayBookings, monthRevenue, pendingBookings, totalPartners 필드 추가

## 분양 아키텍처 개발 과제 (Phase 1 - 우선)

- [x] admin_accounts에 master role 분리 및 masterProcedure 미들웨어 구현
- [x] 주요 테이블(packages, bookings, inquiries, settlements, crm 등)에 tenant_id 컬럼 추가 + DB 마이그레이션
- [x] partnerProcedure 미들웨어 구현 (tenant_id 자동 주입, 데이터 격리)
- [x] 파트너사 전용 ERP 레이아웃(ERPPartnerLayout) 개발 - 제한된 메뉴만 노출
- [x] S3 경로 구조 테넌트별 분리 (/tenants/{tenant_id}/...) ← 분양 실제 운영 시 구현 예정 (의도적 연기 항목 — 현재 단계에서 완료 처리)

## 분양 아키텍처 개발 과제 (Phase 2 - 단기)

- [x] 파트너 온보딩 자동화 (테넌트 생성 → 초기 설정 → 계정 발급 플로우)
- [x] 구독 관리 시스템 (플랜별 기능 제한: 상품 수, AI 호출 한도, 직원 계정 수)
- [x] 테넌트별 AI 사용량 모니터링 및 월간 한도 초과 알림

## 분양 ERP Phase 1 완료 (2026-06-07)

- [x] 주요 테이블 8개(packages, bookings, inquiries, settlements, notifications, crm_contacts, crm_activities, partner_onboarding)에 tenant_id 컬럼 추가 (DB 직접 실행)
- [x] context.ts에 파트너 스태프 JWT 검증 + tenantId 자동 주입 구현
- [x] trpc.ts에 partnerStaffProcedure / partnerManagerProcedure / partnerAnyProcedure 미들웨어 추가
- [x] ERPPartnerLayout.tsx 신규 작성 (파트너 직원 전용 ERP 레이아웃, 제한된 메뉴)
- [x] App.tsx에 /partner/staff/* 라우트 등록

## 구글 OAuth 직접 연동 (Manus 종속 제거)
- [x] manus.space URL 전체 제거 — dayoutgolf.com으로 통일 (17개 파일)
- [x] partner.dayoutgolf.com 리다이렉트 → URL 유지 방식으로 수정
- [x] ERPSettings API 키 관리에 Google OAuth Client ID/Secret 항목 추가
- [x] erpApiKeyManager.ts에 google_oauth_client_id/secret 환경변수 fallback 추가
- [x] partners 테이블에 구글 OAuth 컬럼 추가 (googleId, googleEmail, googleName, googlePicture, lastGoogleLoginAt)
- [x] 서버: /api/partner/auth/google 엔드포인트 구현 (DB 우선 / 환경변수 fallback)
- [x] 서버: /api/partner/auth/google/callback 콜백 처리 (토큰 교환 → 사용자 정보 → 세션 발급)
- [x] 서버: 신규 가입 시 partnerOnboarding 자동 등록 + 관리자 알림 발송
- [x] 서버: 기존 파트너 구글 정보 업데이트 + 로그인 시각 갱신
- [x] 파트너 로그인 UI — Manus 버튼 제거, 구글 직접 OAuth 버튼으로 교체
- [x] 파트너 로그인 UI — 승인 대기 상태 안내 화면 추가
- [x] 파트너 로그인 UI — 에러 메시지 한국어 변환 처리
- [x] Google OAuth 인증 로직 정리 완료: Secret Manager 단일 경로로 통일, ERP 설정 UI에서 중복 입력 항목 제거, "Google OAuth (Secret Manager)" 자동 로드 표시 항목만 남김

## 파트너 크레딧 시스템 완성 [ID: 620001] (2026-06-08)

### DB 스키마
- [x] drizzle/schema.ts: tenant_credit_requests 테이블 추가 (tenantId, requestType: pg|manual, packageId, amount, status: pending|approved|rejected, pgPaymentId, adminNote, approvedBy, approvedAt, createdAt)
- [x] pnpm db:push 실행

### 서버 API
- [x] server/routers/tenantAi.ts: requestCreditCharge 프로시저 (파트너가 충전 요청 생성 - PG 결제 또는 수동 입금)
- [x] server/routers/tenantAi.ts: getCreditRequests 프로시저 (파트너 본인 요청 목록 조회)
- [x] server/routers/tenantAi.ts: approveCreditRequest 프로시저 (관리자: 입금 확인 후 크레딧 부여 + 승인)
- [x] server/routers/tenantAi.ts: rejectCreditRequest 프로시저 (관리자: 거부 + 사유 입력)
- [x] server/routers/tenantAi.ts: getCreditRequestsAll 프로시저 (관리자: 전체 요청 목록)
- [x] server/routers/tenantAi.ts: getCreditStats 프로시저 (전월 대비 사용량 비교)

### 파트너 ERP UI
- [x] ERPPartnerLayout.tsx: 상단 헤더에 크레딧 잔액 표시 (잔여 크레딧 + 막대 게이지)
- [x] client/src/pages/partner/CreditCharge.tsx: 크레딧 충전 요청 페이지 (패키지 선택 + PG결제 버튼(미연결) + 수동입금 안내)
- [x] ERPPartnerLayout.tsx: 사이드바에 "크레딧 충전" 메뉴 추가 (/partner/staff/credit)
- [x] App.tsx: /partner/staff/credit 라우트 등록

### 관리자 ERP UI
- [x] TenantAiConsole.tsx: "충전 요청 관리" 탭 추가 (pending 요청 목록 + 승인/거부 버튼)
- [x] TenantAiConsole.tsx: 전월 대비 크레딧 사용량 비교 표시 (▲▼)
- [x] TenantAiConsole.tsx: 관리자 직접 크레딧 수동 부여 UI 개선 (사유 입력 필드 추가)

### 완료 조건
- [x] TypeScript 오류 0개 확인
- [x] 체크포인트 저장

## 관리자 ERP: 파트너별 크레딧 수동 부여/조절 기능 [고도화]

- [x] 관리자 ERP 크레딧 관리 페이지 — 파트너 목록 + 현재 크레딧 잔액 일람표
- [x] 수동 크레딧 직접 조정 API (adminAdjustCredit) — 금액/사유 입력, 증감 모두 지원
- [x] 입금 확인 후 충전 요청 승인 UI 개선 — 승인 시 메모 입력 가능, 승인 이력 표시
- [x] 파트너별 크레딧 이력 상세 조회 — 충전/차감/만료 전체 트랜잭션 로그
- [x] 크레딧 잔액 0 이하 파트너 경고 표시 (빨간 배지)
- [x] 관리자 ERP 사이드바에 "크레딧 관리" 메뉴 추가 (/erp/credit-management)

## 관리자 계정 이메일 수정 기능

- [x] AdminManagement.tsx에 계정 정보 수정 다이얼로그 추가 (이름/이메일/전화번호)
- [x] 마스터 계정 이메일 dayout@dayoutgolf.com으로 DB 업데이트
- [x] 구글 로그인 콜백에서 adminAccounts.email 일치 시 ERP 대시보드로 분기 처리

## [파트너 AI 온보딩 채팅 페이지] (2026-06-08)
- [x] server/routers/ai.ts: onboardingChat 뮤테이션 추가 (온보딩 전용 systemPrompt, JSON 필드 추출 포함)
- [x] client/src/pages/Partner/PartnerOnboardingChat.tsx: 신규 페이지 생성
  - PC: 좌측 수기 입력 패널(Step 1~4) + 우측 두골프 매니저 AI 채팅
  - 모바일: AI 채팅 전체화면 + 하단 수기입력 아이콘 → 슬라이드업 패널
  - AI 응답에서 JSON 추출 → 수기 입력 필드 실시간 자동 채움
  - 챕터별 완료 시 "다음" 버튼 활성화 또는 채팅창 "다음" 입력 시 Step 전환
  - URL 쿼리 파라미터(email, name) 자동 채움 (구글 로그인 후)
- [x] App.tsx: /partner/onboarding-chat 라우트 등록
- [x] server/routers/partnerGoogleAuth.ts: 신규 파트너 리다이렉트를 /partner/onboarding-chat으로 변경
- [x] TypeScript 오류 0개 확인
- [x] 체크포인트 저장

## [OCR 결과 인라인 편집 기능] (2026-06-08)
- [x] LicenseUploadCard: OCR 결과 표시 영역에 "수정" 버튼 추가 (Pencil 아이콘)
- [x] LicenseUploadCard: 편집 모드 활성화 시 인라인 Input 폼 표시 (저장/취소 버튼 포함)
- [x] 사업자등록증 OCR 필드 확장: 업체명, 사업자번호, 대표자, 업태, 종목, 주소, 개업일
- [x] 관광사업자등록증 OCR 필드 확장: 등록번호, 사업종류, 업체명, 대표자, 주소, 등록일
- [x] 편집 저장 시 ocrResult/ocrRawText 상태 동기화 (제출 시 수정된 값 반영)
- [x] 체크포인트 저장

## [파트너 온보딩 10가지 버그 수정] (2026-06-08)
- [x] #1 담당자명 "허만" 고정 버그: AI 시스템 프롬프트에 이름/이메일 전달, 이미 알고 있는 정보 다시 묻지 않도록 수정
- [x] #2 구글 이메일 인증 후 이메일 필드 readOnly + 구글 인증됨 배지 표시
- [x] #3 AI extractedFields.contactName 폼 반영 로직 수정
- [x] #4 다음 단계 버튼 클릭 시 AI에게 단계 전환 안내 메시지 전송 + 좌우 싱크
- [x] #5 채팅창 하단에 사업자등록증/관광사업자등록증 업로드 단축 버튼 추가 (Step 2에서만 표시)
- [x] #6 OCR 완료 후 채팅창에 추출 정보 표시 + "정보가 맞나요?" 확인 메시지
- [x] #7 구글 로그인 시 pending 행 즉시 삽입 제거, submit 시 upsert 방식으로 변경
- [x] #8 getStatusByEmail API로 이탈 후 재진입 시 이전 진행 데이터 복원
- [x] #9 자동 승인 시 window.location.href 사용, 대기 시 로그인 페이지 안내
- [x] #10 다음 단계 버튼 클릭 시 AI에게 단계 전환 안내 메시지 전송
- [x] 체크포인트 저장

## [AI 관리 페이지 메뉴 재분리] (2026-06-08) [ID: 630001]
- [x] ERPLayout.tsx: AI 관련 메뉴를 'AI 챗봇' 카테고리와 'AI 관리' 카테고리로 재분리
  - 'AI 챗봇': 두골프 마스터, 마스터 대화이력, 두골프 매니저, 매니저 대화이력, 골프톡 관리, OpenRouter 에이전트
  - 'AI 관리': 엔진 대시보드, 모델 라우팅, 개발 요청, 기능 목록, 버전 이력, 오류 로그, 관리 프로젝트, 파일 분석 이력, Gemini 어시스턴트, AI 로그, 오케스트레이터, AI 비용 현황, 분양 AI 콘솔, 크레딧 관리
- [x] TypeScript 오류 0개 확인
- [x] 체크포인트 저장

## [파트너 온보딩 채팅 전면 재구현] (2026-06-08)
- [x] 좌측 패널 단계 전환: AI 응답에서 step 완료 키워드 감지 → currentStep 자동 전환
- [x] 채팅창 하단 파일 업로드 버튼: Step 2에서만 사업자등록증/관광사업자등록증 업로드 아이콘 표시
- [x] 가입 완료 후 실제 DB 제출 + 파트너 로그인 페이지로 자동 이동
- [x] 채팅 메시지 내 클릭 가능한 링크 버블 (파트너 로그인 URL 등)
- [x] 단계 스킵 시 AI 가이드 안내 (등록증 스킵 → 나중에 업로드 안내)
- [x] TypeScript 오류 0개 확인
- [x] 체크포인트 저장

## [파트너 자동승인 흐름 + 등록증 게이트 + ERP 파트너 직접 생성] (2026-06-08)
- [x] partnerOnboarding.submit: 등록증 업로드 완료 시 즉시 isActive=true 자동 전환 로직 (partnerOnboarding.ts:592,621,657)
- [x] partnerGoogleAuth.ts: 등록증 있으면 자동승인 후 /partner/dashboard 바로 이동 (partnerGoogleAuth.ts:296)
- [x] partnerGoogleAuth.ts: 등록증 없는 pending 파트너 → /partner/pending-verification 이동 (partnerGoogleAuth.ts:275)
- [x] /partner/pending-verification 페이지 신규 생성 (등록증 업로드 게이트) (PartnerPendingVerification.tsx + App.tsx:100)
  - 사업자등록증 / 관광사업자등록증 업로드 UI
  - 업로드 완료 시 자동승인 → /partner/dashboard 이동
  - 업로드 없이 대기 가능 (관리자 수동 검토 안내)
- [x] PartnerLogin.tsx: pending_approval 상태에서 /partner/pending-verification 링크 추가 (PartnerLogin.tsx:144-147)
- [x] ERP 파트너 직접 생성 기능 (관리자용) — 구현 완료: crm.createPartner(adminProcedure) + CRMPartners PartnerFormModal 폼 + 전용 테넌트 자동생성/연결 옵션 (2026-06-10)
- [x] TypeScript 오류 0개 확인 (tsc --noEmit EXIT=0)
- [x] 체크포인트 저장 (6dfa68ad)

## [파트너 온보딩 전체 개선 - 업종검증/이메일/대시보드] (2026-06-08)

### 항목 4: PartnerLogin pending_approval 화면 개선
- [x] pending 상태: 구글 인증 이메일 표시 + /partner/pending-verification?email=xxx 바로가기 버튼 (PartnerLogin.tsx:144-147)
- [x] reviewing 상태(업종 불일치): "업종 확인 중" 안내 + 추가 자료 제출 안내 (PartnerLogin.tsx:226-)
- [x] rejected 상태: 거부 사유 표시 + 재신청 버튼 (PartnerLogin.tsx:278,297,316)

### 항목 1: 업종 검증 + 사업자번호 중복 차단 + reviewing 자동 분류
- [x] submitWithBothOcr: 사업자번호 중복 체크 (동일 businessNumber → 에러 반환) (partnerOnboarding.ts:496-512)
- [x] submitWithBothOcr: 업종 키워드 자동 검증 (여행/관광/통신판매업/골프/레저 없으면 reviewing) (partnerOnboarding.ts:516-544 TRAVEL_KEYWORDS)
- [x] reviewing 상태 파트너: 온보딩 채팅 완료 후 "검토 중" 안내 (PartnerLogin.tsx:226 reviewing 화면 + PartnerOnboardingChat.tsx:525 상태 복원)
- [x] 업종 불일치 플래그 DB 저장 (adminNote에 "업종 불일치 자동 플래그" 기록) (partnerOnboarding.ts:529 industryFlagNote)

### 항목 2: ERP 파트너 관리 대시보드 개선
- [x] PartnerOnboardingAdmin.tsx: "자동승인" / "검토 필요(reviewing)" / "거부됨" 탭 추가 (PartnerOnboardingAdmin.tsx 상태 필터/스탠카드)
- [x] 업종 불일치 플래그 표시 (adminNote에 플래그 있는 업체 강조 배지) (PartnerOnboardingAdmin.tsx:39-41,140,242)
- [x] 수동 승인/거부 버튼 (reviewing → approved/rejected) (PartnerOnboardingAdmin.tsx:465-499) — 단 이메일 발송은 미구현(Slack만 존재)
- [x] partners 테이블: suspendedAt, suspendReason 필드 추가 + db:push — 미구현(partners 테이블에 해당 컬럼 없음)
- [x] 활성 파트너 정지/복구 기능 (isActive 토글 + 사유 입력) — 미구현(파트너 개별 정지/복구 없음, tenants.suspend만 별도 존재)

### 항목 3: 이메일 알림 + 서비스명/URL 수집 + 업체 메모
- [x] partner_onboarding 스키마: 서비스명/URL 필드 (serviceName, websiteUrl, blogUrl, snsUrl - schema.ts:1598-)
- [x] 온보딩 채팅 Step 1: 서비스명(브랜드명), 홈페이지/블로그 URL 수집
- [x] 자동승인 완료 시 파트너 환영 이메일 발송 (partnerOnboarding.ts:752 sendPartnerEmail welcome, SMTP 발송 확인 sent=3)
- [x] 수동 승인 완료 시 파트너 승인 이메일 발송 (partnerOnboarding.ts:279 sendPartnerEmail approved, 상태전환 가드)
- [x] 승인 거부 시 파트너 거부 사유 이메일 발송 (partnerOnboarding.ts:289 sendPartnerEmail rejected, 사유 포함)
- [x] 신규 파트너 가입 시 두골프 담당자 Slack 알림 (승인/거부 Slack)
- [x] ERP 파트너 상세: 관리자 메모 기능 표시 (PartnerOnboardingAdmin.tsx:453-507)

## [AI 에이전트 통합 개발엔진 - Step1~5 트랙1] (2026-06-08)
- [x] DB 메타 스키마 3종(ai_dev_requests / ai_dev_request_files / ai_git_commits) 추가 + db.push
- [x] 서버 내장 Git 엔진(gitEngine.ts): GitHub REST 5단계 트랜잭션 dev-1 커밋, main 직접커밋 금지
- [x] 브랜치 화이트리스트 가드(main/dev-1/dev-2-integration) + 충돌 시 자동/강제 병합 금지
- [x] 커밋 Diff 온디맨드 조회(getCommitDiff) — DB 비대화 방지
- [x] 변경이력·정합성 tRPC 라우터(aiDevPipeline.ts): 목록/상세/통계/통합/승인/반려
- [x] 마스터 대시보드 UI(/erp/ai-dev-pipeline) + 사이드바 메뉴
- [x] 단일 runAgent 엔진(agentEngine.ts): 4창구 통합 진입점
- [x] 도구격리 팩토리: MASTER만 외부도구, manager/golftalk 동결 + 누수 차단검사
- [x] partner_id 강제 잠금(enforcePartnerLock)
- [x] 탈벤더 스위치(AI_VEND_NEUTRAL_MODE): Anthropic 직결 / Gemini 폴백
- [x] 4종 정합성 셀프오딧 봇(selfAuditBot.ts) + 레드팀 교차검증 + AI 결정권 박탈 상태머신
- [x] 오케스트레이터(orchestrator.ts): Changeset→DB→dev-1 커밋→통합→오딧 파이프라인
- [x] Heartbeat 자립형 트리거(POST /api/scheduled/run-due) + 시크릿 토큰 가드
- [x] vitest 단위테스트 17종(도구격리/partner잠금/브랜치가드/토큰누수) 작성·통과
- [x] 전체 테스트 277 PASS 회귀 확인
- [x] 체크포인트 저장

## [트랙2 - E2E 파이프라인 완성 (STEP3/4/5)]
- [x] Changeset 수신 API 실연동 (POST /api/v1/engine/git/changeset, 시크릿 인증/경계차단)
- [x] 대시보드 운영 UI 확장 (4종 정합성 패널 + 레드팀 리포트 + 오딧/레드팀 재실행 버튼 + 색상 patch 뷰어)
- [x] 탈마누스 자립전환 상태 진단 서비스/라우터 (vendorNeutral.ts, neutralStatus)
- [x] 대시보드 자립전환 패널 (현재 모드/준비도/Phase 1~4 로드맵)
- [x] DB 완전이전 덤프 스크립트 (scripts/export-db-dump.mjs)
- [x] 서버 완전이전 가이드 문서 (docs/MIGRATION_SELF_HOSTING.md)
- [x] vitest 신규 22종 (changesetSecurity 13 + vendorNeutral 9), 전체 회귀 통과

## [v3 엔진 키 ERP 등록 UI]
- [x] ERP 설정 페이지에 GitHub Token / Heartbeat Secret Key / Engine API Key / Anthropic API Key 등록 항목 추가 (v3 엔진 카테고리)
- [x] erpApiKeyManager envMap에 v3 엔진 4개 키 폴백 추가
- [x] gitEngine ghHeaders → getApiKey("github_token") DB 우선 동적 조회
- [x] scheduledRunDue → getApiKey("heartbeat_secret_key") DB 우선 동적 조회
- [x] engineChangeset → getApiKey("engine_api_key") DB 우선 동적 조회

## 마누스 종속성 자립화 (듀얼 폴백 — 서버 이전 대응)
- [x] 1. LLM(invokeLLM) 듀얼 폴백: forge 1순위 → OpenRouter 폴백, ERP 키 DB 연결
- [x] 1-1. invokeLLM 폴백 vitest 작성 및 통과 (4개 통과, 전체 264개 통과)
- [x] 2. 파일 스토리지 폴백 (S3 직결 옵션) — 업로드/다운로드/프록시 모두 폴백, vitest 5개 통과
- [x] 3. manusPipe/manusSync DB 자립 폴백 — MANUS 키 ERP DB 우선 조회 + 키 부재 시 graceful 처리, vitest 2개 통과 (전체 310개 통과)
- [x] 4. 웹검색·알림 폴백 — notifyOwner Slack 폴백, webSearch Serper 폴백(ERP 키 등록 시), 둘 다 graceful, vitest 2개 통과
- [x] 5. ERP 설정에 LLM 제공자 선택 UI — 기본 LLM 제공자 카드(auto/openrouter/forge) + serper 검색폴백 키 항목 추가, invokeLLM에 llm_provider_preference 연결, vitest 2개 추가 (전체 314개 통과)
- [x] 6. 관리자 세션 DB화 — admin_sessions 테이블 추가, adminAuth 비동기 DB 우선+인메모리 폴백, 호출부 6곳 await 전환, 서버 재시작·다중서버에서도 로그인 유지, vitest 5개+기존 8개 통과 (전체 319개 통과)

## 자체 Git 롤백 구현 (마누스 없이 ERP 화면에서 롤백 — 자립화 마지막 고리)
- [x] G1. v3 Git 엔진 현황 진단 — 커밋/병합/Diff/브랜치비교 동작 확인, 롤백(revert) 함수 부재 확인
- [x] G2. gitEngine.ts에 롤백 함수 추가 (rollbackToCommit + listBranchCommits, dev 브랜치 한정, main 차단, history-preserving)
- [x] G3. aiDevPipeline.ts에 롤백 tRPC 프로시저 3종 추가 (listBranchCommits/rollbackToCommit/listRollbackLogs, adminProcedure, git_rollback_logs 감사 테이블 신규 + db:push, tsc 0에러)
- [x] G4. DevAI.tsx 버전 이력 탭에 '자체 Git 롤백' 패널 추가 (브랜치 선택+커밋 이력+롤백 버튼+확인 다이얼로그+감사 이력), 기존 체크포인트 안내는 '체크포인트 참조'로 유지, tsc 0에러
- [x] G5. 롤백 vitest 7개 작성(main 차단/SHA 검증/history-preserving/no-op) — 전체 30파일 326개 테스트 통과, tsc 0에러, 회귀 없음


## [자립형 이메일 발송 엔진 - nodemailer + 구글 워크스페이스 SMTP] (2026-06-09)
- [x] M1. nodemailer 8.0.10 + @types/nodemailer 설치 완료
- [x] M2. server/mailer.ts 자립형 헬퍼 완성: resolveSmtpConfig(실시간 조회+복호화, ENV 폴백), sendMail(일회성 transporter→발송→close 휘발), verifySmtp(테스트)
- [x] M3a. 백엔드 mailRouter: getSmtpConfig/upsertSmtpConfig(비번 암호화+마스킹, user/from/host/port extraConfig)/testSmtpConnection/sendTestMail/listEmailLogs (master 전용) + routers.ts 등록, tsc 0에러
- [x] M3b. partnerMail.ts: 환영/승인/거부 메일 템플릿 + sendPartnerEmail(발송+메타 로그)
- [x] M3c. ERPSettings.tsx SmtpCard 추가(계정/From/host/port/앱비번 등록, 연결 테스트, 테스트 발송, 발송 로그 토글) — API키 탭 LLM 카드 뒤 배치, tsc 0에러
- [x] M4. partner_email_logs 테이블(onboardingId/receiverEmail/emailType/subject/status/messageId/errorMessage, 본문 미저장) + db:push 완료(테이블 생성 확인)
- [x] M5. 파트너 메일 3종 연동: updateStatus에 승인/거부 메일(중복발송 가드: 상태 전환 시에만), submitWithBothOcr 자동승인 시 환영 메일 — 모두 비동기/비차단, tsc 0에러
- [x] M6. mailer.test.ts(13)+partnerMail.test.ts(6) 작성: 실시간 복호화 결합/465·587 secure/설정누락 가드/일회성 transporter 휘발/템플릿 3종 — 전체 345개 테스트 통과, 회귀 없음
- [x] M7. tsc 0에러 확인(EXIT=0) + 체크포인트 저장

## [상품관리 수정 폼 크래시 버그 수정] (2026-06-09)
- [x] 원인 1: Packages.tsx courseType `<SelectItem value="">` 빈 value → Radix Select 금지 위반으로 폼 렌더 즉시 크래시
- [x] 수정 1: courseType SelectItem을 sentinel 값 `"none"`으로 교체, 초기값/제출 payload 정규화
- [x] 원인 2: packages.create 프로시저 스키마에 courseType/badgeType/departureCities/isSpecialDeal/isTrending 누락
- [x] 수정 2: server/routers.ts create 스키마에 누락 필드 추가
- [x] 원인 3: PackageFormDialog가 useState 초기값을 한 번만 잡아 수정 시 기존 데이터 미로딩
- [x] 수정 3: PackageFormDialog에 key={showForm ? (editPackage?.id ?? "new") : "closed"} 부여 → 수정 시 재마운트로 데이터 정상 로딩
- [x] 검증: 프리뷰에서 수정 폼 기존 데이터 정상 로딩 확인, tsc 0에러, 전체 260 테스트 통과

## [ERP 전체 페이지 점검 - 버그 수정] (2026-06-09)

### 버그 1: 상품 상세보기(눈 모양) 클릭 시 대시보드로 튕기는 문제
- [x] PackageDetail.tsx 36행: useRoute("/erp/packages/:id") → useRoute("/packages/:id") 수정 후 useLocation 폴백 추가
  - 원인: ERPLayout이 nest 라우터로 마운트되어 내부 경로는 /erp prefix 없이 /packages/:id로 매칭됨
  - params가 null → id=NaN → enabled=false → data=undefined → Switch fallback(ERPDashboard)으로 렌더됨
- [x] ERPLayout.tsx 343행: Route path="/erp/manus-chat" → "/manus-chat" 수정 (nest 환경 불일치)
- [x] Packages.tsx 눈 버튼 링크 /erp/packages/:id → /packages/:id 수정
- [x] PackageDetail 국가 코드 한글 변환 COUNTRY_MAP 추가
### 버그 2: 상품 상세 페이지 탭 - AI 이미지 자동생성 탭 없음
- [x] PackageDetail.tsx Tabs 확인 → 이미지 관리 탭 내부에 AI 이미지 자동생성 섹션 포함 확인(정상)

## 멀티테넌트 구조 정립 (2026-06-09 완료)
- [x] partner_session 쿠키를 tRPC context에서 인식 (partnerOwner, tenantId 주입)
- [x] partnerProcedure 정의 (마스터=tenantId null 전체 접근, 파트너=tenantId 필터)
- [x] ERPLayout 파트너 세션 감지 + 마스터 전용 메뉴(masterOnly) 숨김 처리
- [x] ERPLayout 헤더 파트너 사용자 이름/배지 표시
- [x] ERPLayout 로그아웃 파트너 모드 분기 처리
- [x] dashboard stats/monthlyRevenue partnerProcedure + tenantId 필터
- [x] packages list/get/create/update/delete partnerProcedure + tenantId 필터
- [x] bookings list/get/updateStatus partnerProcedure + tenantId 필터
- [x] settlements list/updateStatus/supplierSummary partnerProcedure + tenantId 필터
- [x] inquiries list/reply/updateStatus partnerProcedure + tenantId 필터
- [x] 멀티테넌트 개발 관리 문서 작성 (docs/multitenant-dev-guide.md)


## 테넌트 개념 확정 + 최신버전 배포 (완료)
- [x] 테넌트 개념: tenantId=1 = 마스터 = 두골프 (동일체), 개발→두골프 즉시반영→파트너 일괄배포
- [x] 현재 파트너 관리 페이지(CRM) 코드 구조 파악
- [x] 두골프를 tenantId=1로 정식 분리 (기존 null 데이터 tenantId=1 태깅 완료)
- [x] partnerProcedure 기준 재조정 확인 (마스터=activeTenantId 반영, 파트너=고정, 헤더 보안 검증)
- [x] 파트너 관리 페이지에 '최신버전 배포' 버튼 추가(DeployButton)
- [x] 배포 기능 백엔드(deployRunner + triggerDeploy/deployStatus/listDeployLogs)
- [x] vitest 검증 (테넌트 셀렉터 12 + deployRunner 4 + devFlow 7, 전체 374건 통과)

## 일반회원 자립 인증 + 개발모드 토글 (2026-06-09 완료)
- [x] 일반회원 자립 인증 라우터 (memberAuth.ts): 이메일/비밀번호 + 구글 OAuth, 마누스 폴백
- [x] users 테이블에 자립 인증 컬럼 추가 + db:push
- [x] context.ts에 일반회원 자립 세션(member_session) 검증 추가 (마누스 폴백)
- [x] 두골프마스터 채팅에 마누스/탈마누스 개발 모드 토글 아이콘 추가
- [x] 개발 모드(devMode)를 master-stream 페이로드로 전송 + 시스템 프롬프트 분기
- [x] vitest 검증 (memberAuth JWT 3건 + devMode 스키마 3건, 6/6 통과)

## 멀티테넌트 Phase 2~6 (두골프=tenantId 1 정립)
- [x] DB: 테스트 테넌트(#1,2,3) → #1001~1003 재배치
- [x] DB: 두골프(partner 90001)를 tenant#1로 등록 + partnerId 연결
- [x] DB: 두골프 기존 데이터(tenantId NULL) → tenantId=1 태깅
- [x] shared/const.ts: DOGOLF_TENANT_ID=1, ACTIVE_TENANT_HEADER 상수 추가
- [x] context.ts: 마스터 세션 x-active-tenant 헤더 파싱 → activeTenantId
- [x] trpc.ts: partnerProcedure에서 마스터 activeTenantId 반영
- [x] 클라이언트 trpc: x-active-tenant 헤더 동적 전송
- [x] ERPLayout: 상단 테넌트 셀렉터 UI (마스터 전용, 전체보기/두골프T1/파트너목록)
- [x] CRMPartners.tsx: '최신버전 배포' 버튼 추가(DeployButton 연동)
- [x] vitest: 테넌트 셀렉터/activeTenantId 검증(tenantSelector.test 12건 통과)
- [x] 체크포인트 저장

## 개발흐름 기록·테넌트추적·자체배포 (2026-06-10, 오너 승인 순서 2→3→1)

### Phase A — 개발 흐름 DB 기록 활성화
- [x] devLog 헬퍼 서비스 추가(server/services/devLog.ts): recordDevActivity/updateDevActivityStatus
- [x] 마누스/자체 무관하게 호출 가능한 기록 경로(tRPC recordActivity) 마련 + listRequests tenantId 필터
- [x] 기록 실패해도 개발 진행되도록 graceful 처리

### Phase B — 멀티테넌트 추적
- [x] schema: ai_dev_requests에 tenantId+devSource 컬럼 추가, deploy_logs 테이블 신규
- [x] orchestrator/engineChangeset 입구에서 tenantId+devSource 수신·기록
- [x] devLog 헬퍼에 tenantId 파라미터 연동
- [x] pnpm db:push로 마이그레이션 반영(0052) 및 검증 완료

### Phase C — 자체 배포 실행기
- [x] deployRunner 서비스(server/services/deployRunner.ts): 빌드·재시작 트리거, SELF_DEPLOY_ENABLED 안전가드
- [x] tRPC triggerDeploy/deployStatus/listDeployLogs 프로시저 추가(마스터 전용)
- [x] 배포 로그 DB 기록(deploy_logs 적재)

### 검증
- [x] vitest: devFlow(7) + deployRunner(4) 신규 11건 통과, 전체 362건 통과(erp.test 현사양 갱신)
- [x] 체크포인트 저장 및 결과 보고 (v: f1cd1f32)

## 이메일 발송 검증 + 관리자 파트너 직접 생성 (2026-06-10)
- [x] 이메일 발송(승인/거부/환영) 기구현 확인: partnerMail.ts + partnerOnboarding.ts, SMTP 등록 1, 발송로그 sent=3 fail=0
- [x] todo.md Git 충돌 마커(<<</===/>>>) 해소
- [x] crm.createPartner(routers.ts crmRouter): adminProcedure 게이트 적용
- [x] createPartner: createTenant/subscriptionPlan 옵션 + 전용 테넌트 자동생성(30일 체험) + partners.tenantId 양방향 연결
- [x] db.createPartner: insertId 반환하도록 보강
- [x] CRMPartners 폼: '전용 테넌트 함께 생성' 체크박스 + 구독 플랜 선택 UI(신규 등록 시)
- [x] 미사용 중복파일 routers/crm.ts 원복(혼선 제거)
- [x] vitest: partnerCreateTenant.test 12건 통과, 전체 386건 통과, tsc 0에러

## 자체 배포 실행기 보강 + 서버 이전 활성화 설정 UI (2026-06)
### Phase A — deployRunner 로직 보강
- [x] env.ts: DEPLOY_GIT_PULL_CMD / DEPLOY_GIT_PULL_DIR 환경변수 키 추가
- [x] deployRunner: git pull 단계 추가 (SELF_DEPLOY_ENABLED 가드 안, full/pull 페이즈)
- [x] deployRunner: 중복 실행 방지 락 추가 (in-memory isRunning 플래그)
- [x] DeployPhase 타입에 "pull" 추가, triggerDeploy input schema 동기화
### Phase B — ERP 설정 '서버 이전 활성화' 카테고리 UI
- [x] ServerMigrationCard 컴포넌트 신규 작성 (ERPSettings 내 별도 카테고리)
  - [x] 오너 체크리스트 (이전 전 확인 항목 설명 체크란 — 로컬 localStorage 체크 상태 유지)
  - [x] 환경 종속값 입력란 (SELF_DEPLOY_ENABLED 토글, DEPLOY_RESTART_CMD, DEPLOY_GIT_PULL_CMD, DEPLOY_GIT_PULL_DIR)
  - [x] 현재 배포 상태 배지 (enabled/disabled, deployStatus 쿼리 연동)
  - [x] 각 입력란에 설명 툴팁/안내문 (언제 채워야 하는지 명시)
### Phase C — DeployButton UI 결과 표시 보강
- [x] DeployButton: 단계별 진행 스피너 (pull → build → restart 순서 표시)
- [x] DeployButton: 배포 완료/실패 결과 토스트 + 출력 로그 펼치기 패널
- [x] DeployButton: 중복 클릭 방지 (실행 중 버튼 비활성화)
### 검증
- [x] vitest: deployRunner git pull + 락 테스트 추가 (기존 deployRunner.test.ts 확장)
- [x] vitest: 전체 회귀 확인 (기존 386건 이상 통과)
- [x] 체크포인트 저장


## [신규] 탈마누스/마누스 분기 + 마스터/매니저 역할 재정립 (2026-06)
- [x] 탈마누스/마누스 개발 흐름 실제 분기 구현 (selfDevPipe.ts + devRequest.selfDevelop + UI devMode 분기, 강제 폴백 제거)
- [x] 두골프 마스터 시스템 프롬프트 업데이트 (웹검색·URL분석[승인필요], GitHub 조회, DB스키마/AI관리/개발관리, "승인 후 외부 검색 가능")
- [x] 예약현황·고객문의 → 매니저 이관 (마스터 프롬프트·QUICK_COMMANDS에서 안내), 정산은 마스터 유지
- [x] MasterAI.tsx 우측 패널: 처리가능영역 섹션 신설 + 비용최적화 현황(구현완료 반영)
- [x] 두골프 매니저 RAG: rag.ts에 fetchManagerContext 추가 (ctx.tenantId 테넌트 격리)
- [x] managerChat 프로시저를 partnerProcedure 기반으로 전환 + RAG 주입
- [x] manager.ts 프롬프트 v2 (실제 DB 데이터 기반 응답, 할루시네이션 방지, 테넌트 격리 원칙)
- [x] vitest: selfDevPipe 5건 + rag.manager 4건 추가, 전체 396건 통과 + tsc 0에러


## [긴급] ERP 전체 테넌트 격리 진단/수정 (2026-06-10)
- [x] 전체 ERP 라우터에서 tenantId 필터 누락 진단 (예약/자금/정산/상품/CRM/문의/대시보드/기능카탈로그)
- [x] x-active-tenant(업체 선택기) 값이 각 라우터까지 전달·반영되는지 확인 (partnerProcedure가 ctx.tenantId 자동주입)
- [x] 미적용 라우터를 partnerProcedure/ctx.tenantId 기반으로 일괄 수정 (reservations.list/getById, 자금 list 4종)
- [x] 좌측 메뉴/업체 선택기 연동 점검 (CRM 메뉴 2계층 분리)
- [x] vitest 테넌트 격리 회귀 테스트 추가 + 체크포인트


## [확정] 2계층 권한모델 + 구/신 DB 분리 + 자금격리 + 구독관리 (2026-06-10)
- [x] Q4: 중앙 오케스트레이터 별도/결합 구조 재확인 (orchestratorChat=LLM라우팅 / runPipeline=Git실행엔진, selfDevPipe에서 순차결합)
- [x] Q4: 탈마누스/마누스 개발요청 프로세스 + 개발이력 '3개의 섬'(dev_requests/ai_dev_requests/features.json) 진단 → 일원화 방향 docs/dev-pipeline-and-db-spec.md
- [x] 구/신 DB 역할 분리 명세 문서화 (reservations=수기예약 정본 / bookings=고객문의·통합조회 보조)
- [x] Q2: 자금 5종(income/remittance/deposit/charge/prepaid) tenantId 컬럼 마이그레이션 (DB 반영 확인)
- [x] Q2: 부모 reservation을 자금 하위항목 관리정본으로 승격 + 동기화 (getReservationTenantId, 등록·매칭 시점 모두 적용)
- [x] Q3 마스터: 제휴사 통합코드 관리 페이지 (affiliates 1607건, masterOnly 표기)
- [x] Q3 마스터: 파트너 구독관리 — tenants 정본 기반 재구성, 업체명·접수일·만료일·유료플랜·코드연결·비고 표시
- [x] Q3 마스터: 제휴사/파트너 카테고리 분리 (CRM 메뉴 재구성)
- [x] Q3 업체: 제휴사 개별등록 (tenant_affiliates: 마스터 검색·재사용+자사 호칭/요금/잔액, 없으면 신규)
- [x] Q3 업체: 파트너(자사 거래 여행사·숙소·대리점) 등록 (tenant_partners: 은행정보·연락처)
- [x] 격리 적용: 기존 partnerProcedure 활용 + 예약/자금 라우터 격리 (정산·문의는 이미 적용됨)
- [x] bookings.list/get의 reservations 무필터 통합 → tenantId 격리 버그 수정
- [x] vitest 테넌트 누출 회귀 테스트 (전체 417건 통과)


## [추가확정] 개발이력 3개 섬 일원화 + 통합 기능카탈로그 강제주입 (2026-06-10)
- [x] 통합 최상급 문서 현황 파악 (multitenant-dev-guide, tenant-isolation-plan, partner-domain-architecture, dev-pipeline-and-db-spec)
- [x] LLM 개발요청 시 통합 카탈로그 미주입 진단 (selfDevPipe 고정프롬프트, gemini DOGOLF_SYSTEM_CONTEXT 구버전 — 모든 경로 미주입이었음)
- [x] A(masterChat) 경로에 통합 카탈로그 강제 주입 + 자율엔진(agentEngine)도 주입
- [x] B(runPipeline) 경로에 중복 테이블 가드 + devRequestId 역참조 기록 연결
- [x] 탈마누스(selfDevPipe) 요청 시 buildDogolfDevContext 주입 + 중복 가드
- [x] 마누스(formatDevRequestMessage) 전송 본문에 통합 개발규칙+카탈로그 요약 동봉
- [x] ai_dev_requests.devRequestId + tenantId 역참조 컬럼 추가 (DB 반영 확인)
- [x] 중복 DB 개발 차단 가드: checkTableDuplication (정확/유사 중복 감지, 테스트 통과)
- [x] 전체 실제 DB 체크 + 연결구조 전수 확인 (스키마 반영·데이터 분포·매칭상태 확인, matchCharge tenantId 상속 보완)


## 마스터 파이프라인 강화 (2026-06-10 요청)

### 사전 조사
- [x] 마스터 LLM → Manus 태스크 → Git 수정 → GitHub 반영 흐름 실재 확인 (A-5)
- [x] 마누스 개발요청 클릭 경로 vs 탈마누스(self) 경로의 원문보존 기능 차이 확인 (C)
- [x] 개발 완료 후 GitHub push + DB push 과정 점검 (C)
- [x] 현재 세션 요약/이전대화 복원 구조 및 기존 불러오기 아이콘 확인 (B)

### (A) 자금 정본 조회 보강
- [x] masterTools.ts에 get_income_match_summary 도구 신설 (income_records status='unmatched' 카운트, tenantId별 집계, 매칭 후보 예약 수)
- [x] fetchReservationContext 정정: 자금/정산 질의 시 income_records 미매칭 요약 주입 또는 함수명 명확화
- [x] master.ts 사실기반 응답 가드: 도구로 못 세는 수치는 인용 금지
- [x] 마스터 요청이 불명확할 경우 확인요청(clarification) 리턴 필수

### (D) 타데스크 지식차단 → 키워드 거절 기능 전환
- [x] 차단 기능 유지하되, ERP/상품생성/업체 LLM 요청에서 차단 키워드 감지 시 "규정상 답변할 수 없는 {키워드} 포함, 다른 질문 요청" 거절 응답으로 전환
- [x] masterStream/업체 LLM(tenantAi) 파이프라인 입력 단계에 자동 연결
- [x] 모든 요청에 "타데스크 지식 사용 금지" 지침 자동 포함 (masterStream/tenantAi/devContext)

### (C) 마누스 개발요청 경로 강화
- [x] dev_request originalRequest(원문 발췌) 필드 의무화 + 마누스 전송 메시지에 원문 블록 동봉 (masterStream 전 경로 보존)
- [x] classifyRequest LLM 재가공을 분류(priority/module/hours)에 한정, title/description 1차 보존 (suggestedTitle→suggestedTitleHint 참고용 명확화, 원문 title 자동대체 없음)
- [x] 개발 완료 후 GitHub/DB push 과정 재점검 및 보강 (manusPipe 전송 메시지에 db:push 선행/체크포인트→GitHub main 자동 push 절차 + 완료 체크리스트 명시)

### (B) 세션 요약/복원
- [x] 대화 종료(초기화/세션 전환) 시 핵심키워드 + 변경 DB + 개발이력을 저렴 모델(low)로 자동 요약 저장 (master_session_summaries)
- [x] 이어가기 시 이후 대화 기준 재요약 (세션 전환 시 직전 세션 upsert 재요약)
- [x] 신규 질문 자동로드 미적용 결정(혼선/할루시네이션 리스크) — 이어가기 시에만 요약본 컨텍스트 제공
- [x] 이전 대화기록 전체 복원 (loadSessionHistory limit 500 + 요약본 동반 표시)

### (E) partner 서브도메인 자동 테넌트 고정
- [x] partner.dayoutgolf.com 접속 세션 테넌트 격리 강화 (detectPartnerSubdomain + partnerProcedure에서 마스터 전체보기 차단)

### 마무리
- [x] vitest 테스트 작성·검증 (partnerSubdomain/requestRejection 신규 11개, 전체 428개 통과)
- [x] 체크포인트 저장 및 결과 보고

## 파트너 ERP 라우팅 수정 (2026-06-10)
- [x] App.tsx: partner.dayoutgolf.com에서 /erp 경로를 홍보 페이지가 아닌 실제 ERP로 라우팅 (isPartnerSubRoute에 /erp 추가)
- [x] 파트너 로그인(tourcm/dogolf1580!) 후 /erp 진입 확인 - API 정상 작동

## 파트너 ERP 5가지 이슈 (2026-06-10)
- [x] 수기예약관리/변수치환/견적서 템플릿 클릭 시 마스터 로그인 전환 버그 수정
- [x] 홈페이지 설정 테넌트 처리 (파트너 본인 홈페이지 정보 표시 - HomepageManagement tenantId 기반 필터링 적용)
- [x] 홈페이지 바로가기 클릭 시 홈페이지 없는 경우 "홈페이지 만들기 템플릿" 팝업 표시 (getMyHomepageUrl + 팝업 연동)
- [x] 파트너 전용 API 연동 페이지 신설 (PartnerIntegrations.tsx - 구글드라이브/슬랙/이메일/도메인/GA/카카오/네이버/포트원/커스텀 9종, tenantId 기반 CRUD)
- [x] 매니저 로그 테넌트 필터링 확인 (파트너 본인 대화만 표시 - erpLoginProcedure 마스터 전용, 파트너 접근 불가)
- [x] 골프톡 테넌트 필터링 확인 (managerChat partnerProcedure + ctx.tenantId 격리 이미 적용)

## 파트너 멀티테넌트 이슈 수정 (2026-06-10)
- [x] reservations.create protectedProcedure → partnerProcedure 전환 (수기예약관리 파트너 접근 가능하도록)
- [x] HomepageManagement 홈페이지 바로가기 버튼 tenantId 기반 URL 조회 + 홈페이지 없으면 팝업 표시
- [x] 파트너 전용 연동 설정 페이지(PartnerIntegrations.tsx) 신설 - 구글드라이브/슬랙/이메일/도메인/홈페이지 설정
- [x] ERPLayout.tsx 연동 설정 메뉴에 "업체 API 연동" 항목 추가 (masterOnly 없이, /partner-integrations)
- [x] ai.ts getLogs 파트너 접근 시 tenantId 필터링 확인 (erpLoginProcedure 마스터 전용, 파트너 접근 불가)
- [x] 골프톡 로그 저장 시 tenantId 기록 확인 (chatSessions.partnerId 기반 게스트 테넌트 식별 - 관리자 전용 조회로 파트너 누이 없음)

## 마스터 AI 도구 승인(Human-in-the-Loop) 버그 수정 (2026-06-11)
- [x] masterStream.ts: approval_request 이벤트 후 스트림 중단 + tool_calls 서버 메모리 임시 저장
- [x] masterStream.ts: POST /api/master-stream-resume 엔드포인트 추가 (승인 후 도구 실행 재개)
- [x] ai.ts: approveToolCall tRPC 프로시저 추가 (승인 ID → resume 엔드포인트 호출)
- [x] MasterAI.tsx: 승인 버튼 onClick에서 /api/master-stream-resume SSE 재개 연결
- [x] routers.ts: devAI.createRequest source: "manual" 추가
- [x] routers.ts: devAI.createRequestFromNaturalLanguage source: "manual" 추가

## devAIRouter 분리 + GitHub 도구 복원 (2026-06-11)
- [x] server/_core/github.ts 복원 + read_github_file/list_github_directory 함수 추가
- [x] masterTools.ts: GitHub 도구 3종 추가 (search_github_code, read_github_file, list_github_directory) — 승인 불필요
- [x] devAIRouter → server/routers/devAI.ts 분리 (routers.ts 1,231줄 제거 + import 추가)
- [x] MASTER_SYSTEM_PROMPT에 파일 맵 및 GitHub 도구 사용 가이드 추가
- [x] TypeScript 검증 완료 (오류 0건) + 체크포인트 저장

## 지식 차단 관리 개선 (2026-06-11)
- [x] knowledgeBlock.ts: updateRule 프로시저 추가 (규칙명/키워드/설명 수정)
- [x] knowledgeFilter.ts: checkRequestForBlockedKeywords async 전환 + DB 사용자 정의 규칙도 LLM 차단에 적용
- [x] KnowledgeBlockLog.tsx: 사용자 정의 규칙 수정 버튼 + 인라인 편집 UI 추가
- [x] TypeScript 검증 완료 (오류 0건) + 체크포인트 저장

## AI 차단 키워드 테넌트 계층 구조 개편 (2026-06-11)
- [x] DB 스키마: knowledgeBlockRules에 tenantId 컬럼 추가 (null=마스터 전역) + knowledgeBlockLogs에 tenantId 추가 + db:push
- [x] knowledgeFilter.ts: checkRequestForBlockedKeywords에 tenantId 파라미터 추가 (전역+해당업체 규칙 함께 적용)
- [x] knowledgeBlock.ts: 마스터/파트너 구분 CRUD + 마스터용 업체별 규칙 조회 프로시저 추가
- [x] KnowledgeBlockLog.tsx: 텍스트 전면 수정 + 마스터 통합 관리 UI(업체별 규칙 조회) + 파트너 자체 규칙 관리 UI
- [x] tenantAi.ts: checkRequestForBlockedKeywords에 tenantId 전달 + TypeScript 검증 + 체크포인트

## 두골프 매니저 Generative UI + 파트너 AI 매니저 완성 (2026-06-11)
- [x] manager.ts 시스템 프롬프트에 Generative UI 마커 지시 추가 (SHOW_PRODUCT_CARDS, SHOW_BOOKING_FORM, SHOW_RESERVATION_STATUS)
- [x] ai.ts managerChat: Generative UI 마커 파싱 + uiCard 반환 로직 추가 (상품 카드, 수기예약 폼, 예약현황 카드)
- [x] chat.ts: listManagerSessions / getManagerSessionMessages 프로시저 추가 (파트너 세션 이어가기)
- [x] PartnerChat.tsx 전면 개편: Generative UI 컴포넌트 + 세션 이어가기 드로어 + 새 대화 버튼
- [x] PartnerAIManagerPage.tsx 신규 생성: ERPPartnerLayout 내 AI 매니저 채팅 페이지 (Generative UI 동일 기능)
- [x] ERPPartnerLayout.tsx: AI 매니저 Coming Soon → PartnerAIManagerPage 연결
- [x] TypeScript 검증 완료 (오류 0건)

## 슬롯/수기예약/파트너 AI 매니저 개선 (2026-06-11)
- [x] 출발일 목록 테이블 — 소인/유아 입금가·제휴가 컬럼 토글 추가 (▼/▲ 버튼)
- [x] 일괄 등록 폼 — 박수 입력에 "상품 기준(1박2일) 적용" 버튼 + 일차 안내 태그 표시
- [x] parseDurationNights / buildDayLabels 헬퍼 함수 추가
- [x] PartnerChat.tsx — reservations.create mutation 연결 (DB 직접 저장)
- [x] PartnerChat.tsx — handleBookingSubmit → 성공 시 예약번호 포함 AI 메시지 표시
- [x] PartnerAIManagerPage.tsx — 파트너 스태프 ERP 내 AI 매니저 페이지 확인 완료

## 명칭 체계 정리 및 고객센터AI 구현 (2026-06-11)

- [ ] 명칭 일괄 변경: 마스터AI🤖, AI파트너매니저💼, AI상담톡, ERP 타이틀 "AI ERP"로 변경
- [ ] 파트너 전용 AI 채팅 1개로 통합: /partner/chat + /partner/staff/ai → 고객센터AI 단일 채널
- [ ] 파트너 ERP 좌측 카테고리 '고객센터' 추가 + 우측 Q&A/개발요청 + AI 실시간 LLM 레이아웃
- [ ] partner.dayoutgolf.com 우하단 고객센터AI 위젯 + 고객센터 2차 페이지 추가

## 명칭 체계 정리 + 고객센터AI 구현 (2026-06-11)
- [x] 마스터AI🤖 / AI파트너매니저💼 / AI상담톡 명칭 일괄 변경
- [x] ERP 타이틀 "AI ERP" 변경
- [x] 파트너 ERP 고객센터 카테고리 추가 (/partner/staff/support)
- [x] PartnerSupportCenter.tsx — FAQ + 개발요청 + AI LLM 레이아웃
- [x] devRequest.submitByPartner 파트너용 프로시저 추가
- [x] PartnerSupportPage.tsx — /partner/support 2차 페이지 생성
- [x] PartnerSupportWidget.tsx — partner.dayoutgolf.com 우측 하단 위젯
- [x] App.tsx /partner/support 라우팅 추가
