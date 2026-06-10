# 파트너 로그인/테넌트 격리 복구 작업 (2026-06)

## #1 마스터가 파트너 선택 시 해당 테넌트 뷰로 전환
- [x] partnerProcedure activeTenantId 동작 확인 (이미 구현됨 — 셀렉터 선택 시 해당 테넌트 데이터만 표시)
- [x] 데이터 연결(#2/#3) 완료로 빈 화면 문제 해소

## #2 미연결 업체 tenantId 일괄 연결
- [x] tenants(1001~1003)와 partners 연결관계(partnerId/tenantId) 복구
- [x] 정석원(글로벌투어 150003↔T1001), 김주현(180001↔T1003) 양방향 연결
- [ ] 승인 시 tenantId 자동 연결 파이프라인 보강 (#5 통합 시 함께)

## #3 김주현(tourcm) 계정 복구 [최우선]
- [x] partners(180001).tenantId = 1003 연결
- [x] tenants(1003).partnerId = 180001 연결
- [x] tourcm 비밀번호 리셋 (bcrypt 신규 해시) → dogolf1580!
- [x] 로그인 → 파트너 ERP 접속 확인 (로컬 서버 HTTP 200, 세션 JWT에 tenantId:1003 포함)
- [x] 회귀 테스트 추가(partnerOnboardingFix.test.ts) — 연결 무결성 + 가입 진입점 4개 PASS
- [x] 새 ID/PW 사용자에게 전달

## #4 "무료로 시작하기" 구글인증 가입 페이지 복원
- [x] 랜딩 가입 CTA(Hero·Navbar·CTA·JoinFlow·Pricing) → 구글인증 진입점으로 통일
- [x] 구글인증 후 분기: 기가입자→대시보드, 신규→onboarding-chat, 진행중→이어가기 (서버 콜백 구현 확인)
- [x] onboarding-chat 직접 진입 시 구글 미인증 게이트 추가

## #5 파트너 가입관리 통합 → AI관리 하위 "신규 분양관리"
- [x] AI 관리 그룹 인접 위치에 "신규 분양관리" 그룹 신설
- [x] 파이프라인 순서로 하위항목 정리(①가입신청~⑥크레디트)
- [x] CRM 등 기존 중복 항목 제거(라우트 유지)

## #5 파트너 가입관리 분산 페이지 통합
- [ ] AI관리 하위 "신규 분양관리" 카테고리 신설
- [ ] 파이프라인 순서 하위 메뉴: 가입신청→구독→크레딧→AI콘솔→거래처
- [ ] 사이드바 재배치

## 마무리
- [ ] npx tsc --noEmit
- [ ] npx vitest run
- [ ] 체크포인트 저장
