# 두골프 ERP 구조 진단 + 테넌트 격리 종합 (작업 기준 단일 문서)

> 2026-06-10 · 78개 테이블 + 전체 라우터 + 호출 화면을 코드로 전수 추적한 결과. **추측 없음.**
> 원칙: **신규 테이블/파일 만들지 않는다. 기존 라우터에만 격리 적용. 구/신 이원화는 정본을 하나로 확정하고 나머지는 통합/폐기 표시.**

---

## 1. "예약·정산·문의는 1개가 아니다" — 실제 구조

### 1-1. 예약 (2개 흐름)
| | bookings (신) | reservations (구) |
|---|---|---|
| ERP 화면 | `/bookings` 예약 목록 (`Bookings.tsx`) | `/reservations` 수기 예약관리 (`ReservationManagement.tsx`, `useBookingsQuery`) |
| 생성 경로 | ERP에서 직접(현재 insert 헬퍼 미발견) | `reservations.create` (수기 입력) |
| 고객 홈페이지 문의 | `Inquiry.tsx` → `bookings.createInquiry` → **실제론 `inquiries` 테이블에 저장** | - |
| tenantId 컬럼 | O | O |
| 격리 | 본체 O (partnerProcedure) | **X (protectedProcedure, 0건)** |
| **치명 버그** | `bookings.list`가 `reservations`(confirmed)를 **무필터로 합침** → 격리 우회, 전체 누출 | - |

### 1-2. 정산/자금 (2계층)
| 테이블 | 용도 | 화면 | tenantId | 격리 |
|---|---|---|---|---|
| settlements | 공급사 정산 | Settlements.tsx | O | **O (완료)** |
| incomeRecords | 입금 | FinanceManagement.tsx | X | X |
| remittanceRecords | 송금 | FinanceManagement.tsx | affiliateId만 | X |
| depositRecords | 예치금 | FinanceManagement.tsx | X | X |
| chargeRecords | 충전-사용 | FinanceManagement.tsx | X | X |
| prepaidRecords | 선결제 | FinanceManagement.tsx | affiliateId만 | X |

### 1-3. 문의 (2종, 용도 다름)
| 테이블 | 용도 | tenantId | 격리 |
|---|---|---|---|
| inquiries | 고객 홈페이지 견적 문의 | O | RAG만 O |
| reservationInquiries | ERP 예약 건별 문의/메모 | X | X |

---

## 2. 사용자(권한)별 처리 흐름

| 사용자 | 인증 | 보는 데이터 범위 |
|---|---|---|
| 마스터(admin) 전체보기 | adminAccounts/users.role=admin | 전 테넌트 합계 (활성테넌트=all→null) |
| 마스터 + 특정 업체 선택 | + `x-active-tenant: T번호` | 해당 테넌트만 |
| 파트너 대표 | partners 쿠키 세션 | 본인 tenantId만 (헤더 무시) |
| 파트너 직원 | partnerStaff JWT | 소속 tenantId만 |
| 고객(비로그인) | publicProcedure | 자기 문의 제출만 (조회 불가) |

→ 인프라(`context.activeTenantId`, `partnerProcedure→ctx.tenantId`)는 **이미 완비**. 라우터가 안 쓰는 게 문제.

---

## 3. "개발 요청마다 정리 안 되는" 원인 — 3개의 분리된 섬

```
[devRequests/aiDevRequests]  ─X─  [features.json(docs/)]  ─X─  [실제 코드]
   개발요청 기록                    기능 카탈로그 화면              소스
```
- 기능 카탈로그는 DB `features` 테이블이 아니라 **`docs/features.json` 파일**을 읽음.
- "소스 재스캔" = 로컬 `scripts/generate-features.mjs` execSync 실행 → **배포 환경(manus.space)에서 실행 불가/미반영**.
- 개발 요청(devRequests)과 카탈로그가 **연결 안 됨** → 개발해도 카탈로그에 자동 누적 안 됨.
- managedProjects / devFeatures / devRequests / devVersions가 **각각 따로** 존재 → 개발 이력이 한 곳에 안 모임.

---

## 4. 확정 필요 사항 (사용자 결정)

- **Q1. 예약 정본**: 운영 정본을 `reservations`(구)로 단일화하고 `bookings`(신)는 고객문의/통합조회 보조로 둘지? 또는 `bookings`로 통합?
- **Q2. 자금 5종(income/remittance/deposit/charge/prepaid)**: tenantId 컬럼 추가(마이그레이션) vs 부모 reservation 경유 격리(데이터 무이동)?
- **Q3. CRM 거래처(partners)/제휴사(affiliates)**: 마스터 공통 자원으로 격리 제외 vs 테넌트별 분리?
- **Q4. 기능 카탈로그/개발이력**: features.json 파일 방식 유지 vs DB 기반(devRequests 연동)으로 일원화?

---

## 5. 작업 방침 (승인 후, 신규 파일 없이)
1. `trpc.ts`에 `tenantScopedProcedure` 1개 추가(기존 partnerProcedure 로직 재사용).
2. B그룹(예약/자금/정산/문의/견적/일정/상품) 기존 라우터 쿼리에 공통 tenantId 필터 적용.
3. `bookings.list`의 reservations 통합부에 tenantId 필터 추가(치명 버그 수정).
4. 자금 5종은 Q2 결정에 따라 처리.
5. vitest로 테넌트 누출 회귀 테스트.
