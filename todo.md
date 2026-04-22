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
