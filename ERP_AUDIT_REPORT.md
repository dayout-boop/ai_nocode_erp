# 두골프 ERP 시스템 전체 기능 및 UI 정합성 전수 조사 보고서

**조사 일시:** 2026-06-05  
**조사 범위:** ERP 전체 페이지(50개), 사이드바 메뉴, tRPC 라우터(40+개), DB 스키마(60+ 테이블)

---

## CRITICAL (즉시 수정 필요)

### C-01. GolfTalkAdmin / ManagerAdmin — Manus OAuth 인증 충돌
- **위치:** `GolfTalkAdmin.tsx`, `ManagerAdmin.tsx`
- **문제:** `aiAssistant.getLogs`가 `protectedProcedure` 기반 `adminProcedure` 사용 → ERP 마스터 세션으로 접근 시 401 UNAUTHORIZED 발생
- **원인:** ERP는 자체 `admin_session` 쿠키 인증 사용, 해당 프로시저는 Manus OAuth `ctx.user` 필요
- **영향:** 두 페이지 모두 데이터 로드 불가

### C-02. 정산관리 > 공급처별 정산 — Route 미등록
- **위치:** 사이드바 `/settlements/suppliers` 메뉴 존재, ERPLayout Route 미등록
- **문제:** 메뉴 클릭 시 ERPDashboard(fallback)로 리디렉션됨
- **영향:** 공급처별 정산 기능 완전 접근 불가

### C-03. 상품관리 > 상품 등록 — Route 미등록
- **위치:** 사이드바 `/packages/new` 메뉴 존재, ERPLayout Route 미등록
- **문제:** `/packages/:id` Route가 `new`를 숫자로 변환 시 NaN → 상품 조회 실패
- **영향:** 사이드바 "상품 등록" 메뉴 클릭 시 빈 PackageDetail 페이지 표시

---

## HIGH (빠른 수정 필요)

### H-01. 사이드바 메뉴에 없는 Route 경로 3개
- **위치:** `/gemini`, `/ai-logs`, `/orchestrator`
- **문제:** Route는 등록되어 있으나 사이드바 메뉴에서 접근 불가 (고아 페이지)
- **영향:** GeminiAssistant, AILogs, DevAIOrchestrator 페이지 접근 방법 없음
- **수정 방안:** 사이드바 AI 엔진 관리 섹션에 메뉴 추가 또는 페이지 통합

### H-02. .v2 백업 파일 6개 — 프로덕션 코드에 혼재
- **위치:** `server/routers/*.ts.v2` (6개 파일)
- **문제:** `devRequest.ts.v2`, `fileAnalysis.ts.v2`, `partnerOnboarding.ts.v2`, `reservationInquiries.ts.v2`, `siteSettings.ts.v2`, `systemSettings.ts.v2`
- **영향:** 코드 혼란, 실수로 참조 가능성, 빌드 오염 위험
- **수정 방안:** 백업 파일 삭제 또는 `/backups/` 디렉토리로 이동

### H-03. GolfTalkAdmin / ManagerAdmin — adminProcedure를 erpLoginProcedure로 교체 필요
- **위치:** `server/routers/ai.ts`의 `getLogs`, `getCostSummary`, `getSessionMessages`
- **문제:** ERP 전용 인증 없이 Manus OAuth 필요 → ERP 마스터 로그인 사용자 접근 불가
- **수정 방안:** `erpLoginProcedure` 패턴 적용 또는 이중 인증 지원

### H-04. PackageDetail — packages/new 처리 로직 없음
- **위치:** `PackageDetail.tsx` 36-39줄
- **문제:** `id = Number('new') = NaN` → `trpc.packages.get.useQuery({ id: NaN })` 호출
- **영향:** 상품 등록 페이지가 빈 화면으로 표시됨
- **수정 방안:** `isNew = params?.id === 'new'` 분기 처리 또는 Packages.tsx 다이얼로그로 리디렉션

---

## MEDIUM (순차적 개선)

### M-01. TODO 주석 다수 — 미구현 기능
- **위치:** 전체 50개 페이지에 TODO 총 약 200개 이상
- **상위 파일:** `PackageDetail.tsx` (20개), `DevAI.tsx` (16개), `ReservationManagement.tsx` (15개), `ManagedProjects.tsx` (11개), `CRMPartners.tsx` (17개)
- **영향:** 기능 불완전, 사용자 혼란

### M-02. CMS > 자동 치환 변수 — 사이드바 메뉴에 있으나 Route는 등록됨 (정상)
- **위치:** `/cms/variables` → `ERPCMSVariables` Route 등록 확인
- **상태:** 정상 (오해 없음)

### M-03. 자금관리 — 독립 라우터 없음, reservations 라우터에 혼재
- **위치:** `FinanceManagement.tsx` → `trpc.reservations.listIncome/listRemittance/...` 사용
- **문제:** 자금관리 기능이 reservations 라우터에 섞여 있어 유지보수 어려움
- **수정 방안:** 별도 `financeRouter` 분리 (장기 과제)

### M-04. 정산관리 — supplierSummary API 있으나 공급처별 정산 페이지 없음
- **위치:** `settlements.supplierSummary` 프로시저 존재, 전용 페이지 없음
- **문제:** 사이드바 메뉴는 있으나 Route 미등록 (C-02와 연계)

### M-05. AIDevEngine.tsx — TODO 14개, 미완성 기능 다수
- **위치:** `AIDevEngine.tsx` (1144줄, TODO 14개)
- **문제:** 오류 로그 페이지에 미구현 필터, 자동 수정 기능 등 TODO 상태

### M-06. DevAI.tsx — TODO 16개, 가장 많은 미완성 기능
- **위치:** `DevAI.tsx` (1966줄, TODO 16개)
- **문제:** 개발 요청 시스템의 핵심 페이지에 미완성 기능 다수

### M-07. GeminiAssistant.tsx — TODO 11개, 사이드바 접근 불가
- **위치:** `GeminiAssistant.tsx` (662줄, TODO 11개)
- **문제:** 사이드바 메뉴 없음 + 미완성 기능 다수

### M-08. ManagedProjects.tsx — TODO 11개
- **위치:** `ManagedProjects.tsx` (1121줄, TODO 11개)

### M-09. CRMPartners.tsx — TODO 17개 (가장 많음)
- **위치:** `CRMPartners.tsx` (1109줄, TODO 17개)

### M-10. ReservationManagement.tsx — TODO 15개
- **위치:** `ReservationManagement.tsx` (1902줄, TODO 15개)

---

## LOW (장기 개선)

### L-01. 중복 adminProcedure 정의 — ai.ts 내부 로컬 정의
- **위치:** `server/routers/ai.ts` 20-26줄, `server/_core/trpc.ts` 30줄
- **문제:** 동일한 역할의 adminProcedure가 두 곳에 정의됨
- **수정 방안:** `_core/trpc.ts`의 `adminProcedure` 사용으로 통일

### L-02. erpLoginProcedure 중복 정의 — 3개 파일에 동일 코드
- **위치:** `adminManagement.ts`, `erpApiKeys.ts`, `knowledgeBlock.ts`
- **문제:** 동일한 `erpLoginProcedure` 코드가 3곳에 복사됨
- **수정 방안:** `_core/trpc.ts` 또는 공유 파일로 추출

### L-03. 사이드바 아이콘 중복 — 자금관리/정산관리 동일 아이콘
- **위치:** ERPLayout.tsx 자금관리, 정산관리 모두 `<CreditCard>` 아이콘 사용
- **수정 방안:** 자금관리는 `<Wallet>` 또는 `<Banknote>` 아이콘으로 변경

### L-04. cms Route 리디렉션 처리 — 불필요한 window.location.replace
- **위치:** ERPLayout.tsx 309줄 `/cms` Route
- **문제:** `window.location.replace('/erp/cms/notices')` 사용 → 페이지 깜빡임
- **수정 방안:** wouter `<Redirect>` 컴포넌트 사용

---

## 요약 통계

| 우선순위 | 건수 | 즉시 수정 |
|----------|------|-----------|
| CRITICAL | 3건 | ✅ 즉시 |
| HIGH | 4건 | ✅ 빠른 수정 |
| MEDIUM | 10건 | 순차적 |
| LOW | 4건 | 장기 개선 |
| **합계** | **21건** | |

---

## 수정 우선순위 실행 계획

### Phase 1 (즉시): CRITICAL 3건
1. C-02: settlements/suppliers Route 등록 + 페이지 구현
2. C-03: packages/new Route 처리 (Packages.tsx 다이얼로그 오픈으로 리디렉션)
3. C-01: GolfTalkAdmin/ManagerAdmin API 인증 수정

### Phase 2 (빠른): HIGH 4건
4. H-01: gemini, ai-logs, orchestrator 사이드바 메뉴 추가
5. H-02: .v2 백업 파일 정리
6. H-03: ai.ts adminProcedure → erpLoginProcedure 교체
7. H-04: PackageDetail isNew 분기 처리

### Phase 3 (순차): MEDIUM 상위 3건
8. M-05: AIDevEngine TODO 핵심 기능 구현
9. M-06: DevAI TODO 핵심 기능 구현
10. M-03: 자금관리 라우터 분리 (장기)
