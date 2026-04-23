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
