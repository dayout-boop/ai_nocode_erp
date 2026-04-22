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
- [ ] OpenRouter API 키 시크릿 등록 (OPENROUTER_API_KEY)
- [ ] server/_core/orchestrator.ts 구현
  - [ ] 작업 복잡도 분류 로직 (SIMPLE / MODERATE / COMPLEX)
  - [ ] 모델 라우팅 테이블 (SIMPLE→GPT-4o mini, MODERATE→Gemini 1.5 Pro, COMPLEX→Claude 3.5 Sonnet)
  - [ ] 프롬프트 캐싱 (시스템 프롬프트 해시 기반 인메모리 캐시)
  - [ ] OpenRouter API 호출 함수 (에러 핸들링, 재시도 2회)
  - [ ] 비용 계산 로직 (입력/출력 토큰 × 모델별 단가)
  - [ ] 비용 로그 DB 저장
- [ ] drizzle/schema.ts - ai_cost_logs 테이블 추가 (model, inputTokens, outputTokens, costUsd, taskType, cacheHit)
- [ ] pnpm db:push 실행
- [ ] server/routers.ts - orchestrator 라우터 추가 (ask, getCostStats, getModelPricing)
- [ ] DevAI.tsx - 오케스트레이터 탭 추가
  - [ ] 모델 자동 선택 채팅 UI (작업 유형 선택 드롭다운)
  - [ ] 비용 대시보드 (일별/모델별 비용 차트)
  - [ ] 캐시 히트율 통계
  - [ ] 모델별 단가 테이블
