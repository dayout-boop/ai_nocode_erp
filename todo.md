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
- [ ] DB 스키마에 package_images 테이블 추가 및 마이그레이션
- [ ] S3 이미지 업로드 tRPC API (uploadImage, deleteImage, reorderImages)
- [ ] ERP 상품 수정 화면에 이미지 업로드/삭제/순서변경 UI
- [ ] 프론트 상품 상세 페이지에 이미지 갤러리(슬라이더) 표시
