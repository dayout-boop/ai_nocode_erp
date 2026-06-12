# 두골프 ERP 전수 점검 리포트

> 점검 시작: 2026-06-12
> 목적: 분산된 기능들의 실제 작동 여부를 사용자 입장에서 브라우저+DB로 검증하고, 정상/불필요/부족/개선/중복으로 분류

## 분류 기준
- ✅ **정상**: 사용자 입장에서 클릭 시 정상 로직대로 작동
- ❌ **작동불가**: 페이지 깨짐, 에러, 기능 미작동
- 🔵 **부족**: 기능은 있으나 미완성/불완전
- 🟡 **개선**: 작동하나 UX/로직 개선 필요
- 🔴 **중복**: 다른 기능과 중복되어 통합/제거 필요
- ⚪ **불필요**: 사용되지 않거나 제거 후보

---

## A. 핵심 비즈니스 플로우 (최우선)

### A-1. 상품 생성 플로우
- [ ] 상품 목록 페이지(/packages) 로딩
- [ ] 상품 등록(/packages/new) - 폼 입력 → 저장 → DB 반영
- [ ] 상품 수정(/packages/:id) - 이미지 업로드, 가격, 옵션, 슬롯
- [ ] 상품 → 홈페이지 노출 확인

### A-2. 수기 예약 → 견적 → 예약확정 → 입금매칭 플로우
- [ ] 수기 예약관리(/reservations) 로딩
- [ ] 수기 예약 생성 → DB 저장
- [ ] 견적 단계 진행 (견적서 생성/발송)
- [ ] 예약 확정 변경 (상태 전환)
- [ ] 확정 사항 입력
- [ ] 입금 매칭 (자금관리 연동)

### A-3. 예약 문의 → 예약 전환
- [ ] 예약 문의(/inquiries) 로딩
- [ ] 문의 → 예약 전환 로직

---

## B. 파트너 신규가입 → ERP 진입 플로우

### B-1. 파트너 신규 가입 과정
- [ ] 파트너 가입 신청(/partner/join) 페이지
- [ ] 온보딩 챗봇(/partner/onboarding-chat)
- [ ] 가입신청 → DB 저장

### B-2. 마스터 승인 → 파트너 ERP 진입
- [ ] 신규 가입신청 관리(/partner-onboarding) - 마스터 승인
- [ ] 파트너 관리(/crm/partners)
- [ ] 파트너 로그인(/partner/login) → ERP 진입
- [ ] 파트너 ERP 기능 (격리/권한)

---

## C. 분산된 AI/자동화/개발요청 대시보드 (통합 검토 대상)

### C-1. AI 챗봇 그룹 (8개)
- [ ] 마스터AI(/master-ai)
- [ ] 마스터AI 로그(/master-ai/logs)
- [ ] AI파트너매니저(/manager-chat)
- [ ] 파트너자동화AI(/gemini)
- [ ] AI 통합 로그(/ai-unified-logs)
- [ ] AI 채널 관리(/ai-channel-management)
- [ ] AI 크레딧 관리(/ai-credit-management)
- [ ] OpenRouter 에이전트(/openrouter-agent)

### C-2. AI 관리 그룹 (10개)
- [ ] 엔진 대시보드(/ai-engine)
- [ ] 모델 라우팅(/ai-engine/model-routing)
- [ ] 개발 요청(/dev-ai?tab=requests)
- [ ] 기능 목록(/ai-engine/features)
- [ ] 버전 이력(/dev-ai?tab=versions)
- [ ] 변경이력·정합성(/ai-dev-pipeline)
- [ ] 오류 로그(/ai-dev-engine)
- [ ] 관리 프로젝트(/managed-projects)
- [ ] 파일 분석 이력(/ai-engine/file-analysis)
- [ ] 오케스트레이터(/orchestrator)

### C-3. 분양 AI 콘솔
- [ ] 분양 AI 콘솔(/tenant-ai-console) - 개발요청 탭

---

## D. 운영 보조 기능
- [ ] 대시보드(/) - KPI, 알림
- [ ] 자금관리(/finance)
- [ ] 정산관리(/settlements, /settlements/suppliers)
- [ ] CRM(/crm, /crm/my-affiliates, /crm/my-partners)
- [ ] CMS(/cms/homepage, /cms/notices, /cms/banners, /cms/variables)
- [ ] 연동설정(/company-manage, /settings, /partner-integrations, /settings/system)
- [ ] 구독관리(/subscriptions)
- [ ] 이미지 아카이브(/image-archive)
- [ ] 크레딧 관리(/credit-management)

---

## 점검 결과 기록

(아래에 각 항목 검증 결과를 기록)

---

## DB 데이터 현황 (사전 확인)

| 테이블 | 레코드 수 | 비고 |
|--------|-----------|------|
| packages | 55 | 정상 |
| reservations (수기예약) | 2,049 | 대량 |
| bookings | 0 | 비어있음 |
| inquiries | 1 | 거의 없음 |
| tenants | 5 | T1(본사)+T1001/T1002/T1003/T60001 |
| settlements | 0 | 비어있음 |

**핵심 발견 A**: 실제 예약은 reservations(2,049)에 집중. 대시보드 KPI가 bookings(0) 기준이면 실제 업무 미반영 → 데이터 소스 점검 필요.

---

## [트랙1] 마스터 입장 점검 결과

### T1-1. 테넌트 전환 드롭다운 — ✅ 정상
- 드롭다운: 전체보기 / 두골프(T1, 마스터·테스트베드) / 파트너[정석원(구글,T1001), 정석원(T1002), 김주현(T1003), 투어커뮤니케이션(T60001)]
- 데이터 격리 정상: 전체보기=56상품, T60001 전환→"등록된 상품 없음"으로 격리됨
- **판정**: 사용자가 우려한 "본사+파트너 겹침"은 버그 아님 = "전체보기"의 의도된 합산 동작. 개별 테넌트 선택 시 정상 격리됨.

### T1-2. 상품관리 — ✅ 정상 (정책 검토 필요)
- 목록 55개, 페이지네이션 작동 / 등록 모달 성공+DB반영 확인
- ⚠️ 마스터(본사)는 상품 생성 주체가 아니라는 사용자 의견 → 마스터 화면 "상품 등록" 버튼 노출 정책 재검토 권고

### T1-3. 수기 예약관리(/reservations) — ❌→✅ 핵심 버그 발견·수정

**증상**: 첫 진입 시 예약 목록 "0건", 요약 카드 전부 0원/0건 (실제 DB 2,049건 존재)

**원인 규명 (단계적 검증)**:
1. 백엔드 `reservations.list` API: 직접 호출 시 total 2,049건 정상 반환 (정상)
2. `reservations.summary` API: 총 2,049건, 확정 1,965, 대기 83, 이번달매출 5,219만원 정상 반환 (정상)
3. superjson 직렬화/역직렬화: 정상
4. 인증(auth.me, adminAuth.me): admin/role=admin 정상
5. → **결론: 백엔드 완전 정상, 클라이언트 React Query 캐시에 빈 결과(0건)가 굳는 문제**

**근본 원인**:
- `client/src/main.tsx`의 `new QueryClient()`에 **기본 옵션이 전혀 없었음**
- 첫 페이지 진입(또는 테넌트 전환 후 reload) 시점에 인증 쿠키 attach 전/`x-active-tenant` 헤더 상태에서 쿼리가 먼저 발사 → 빈 결과가 캐시됨
- `staleTime` 기본 무한 + 자동 refetch 없음 → **0건이 영구 유지**, 화면 갱신 안 됨

**수정 (main.tsx)**:
```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: "always",   // 마운트마다 최신 재요청
      retry: 2,                    // 일시적 실패 자동 재시도
      retryDelay: (a) => Math.min(1000 * 2 ** a, 5000),
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  },
});
```

**검증 결과**: 첫 진입 시 잠깐 0건 → 자동 refetch로 2,049건 정상 표시 확인. **전역 적용이므로 모든 화면(대시보드/예약/정산 등)에 동일 효과.**

**잔여 개선점(🟡)**: "0건 → 데이터" 전환 시 깜빡임 존재 → 로딩 스켈레톤/`keepPreviousData` 보강 권장

### T1-4. 대시보드 데이터 소스 이원화 — 🔴 구조적 문제 (핵심 발견 B)
- `dashboard.stats`, `dashboard.monthlyRevenue`는 **`bookings` 테이블** 조회
- 실제 예약 데이터는 전부 **`reservations` 테이블(2,049건)**, `bookings`는 0건
- → 대시보드 매출/예약 통계가 **실제 업무를 전혀 반영하지 못함** (전부 0)
- **조치 필요**: 대시보드 통계를 `reservations` 기준으로 재배선하거나, 두 테이블 관계 정의 필요 (Phase 6에서 처리)
