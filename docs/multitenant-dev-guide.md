# 두골프 ERP 멀티테넌트 개발 관리 가이드

> 이 문서는 두골프 ERP를 멀티테넌트 구조로 운영하기 위한 개발 규칙, 데이터 격리 방식, 마스터/파트너 기능 구분 기준을 정의합니다.
> **모든 신규 기능 개발 시 이 문서를 먼저 확인하고 규칙을 준수해야 합니다.**

---

## 1. 핵심 개념 (2026-06-09 확정)

### 계층 구조

```
[마스터] = MR.MAN (시스템 소유자)
   · 개발 / AI엔진 / 시스템설정 / 파트너관리 권한
   · 상단 테넌트 셀렉터로 "전체보기 ↔ 두골프(T1) ↔ 파트너" 전환 가능
   │
   ├── [파트너: 두골프] = tenantId 1  ← 마스터 = 두골프 (동일체)
   │      · 개발의 기본 테스트베드. 개발 즉시 반영됨
   ├── [파트너: A업체] = tenantId 2
   └── [파트너: B업체] = tenantId 3 ...
```

### tenantId 규칙

| tenantId 값 | 의미 | 접근 주체 |
|------------|------|----------|
| `1` | **마스터 = 두골프** (동일체). 개발 테스트베드 | 마스터 및 두골프 세션 |
| `2 ~ N` | 각 파트너사 데이터 | 해당 파트너만 |
| `NULL` | 전체 통합 조회용 (마스터 '전체보기' 선택 시에만) | 마스터 전용 |

- **두골프는 마스터가 운영하는 첫 번째 파트너(tenantId=1)**입니다. 데이터 관점에서 A/B업체와 동등하게 격리됩니다.
- **개발 흐름**: 개발 → 두골프(T1)에 즉시 반영 → 마스터가 두골프에서 테스트 → 검증 완료 후 파트너에 '최신버전 배포'.
- 마스터는 상단 **테넌트 셀렉터**로 현재 보는 대상을 전환합니다 (전체보기 / 두골프T1 / 특정 파트너).
- 일반 파트너는 셀렉터 없이 자신의 tenantId에 고정됩니다.
- 신규 기능 개발 시 **반드시 해당 테이블에 `tenantId` 컬럼을 추가**해야 합니다.

### 마스터 테넌트 전환 (상단 셀렉터)

마스터 세션은 요청 헤더 `x-active-tenant`로 현재 보는 테넌트를 전달합니다:

| 셀렉터 선택 | `x-active-tenant` | 적용 tenantId |
|------------|-------------------|---------------|
| 전체보기 | `all` 또는 없음 | `null` (전체 조회) |
| 두골프 | `1` | `1` |
| 특정 파트너 | `N` | `N` |

일반 파트너는 이 헤더를 무시하고 항상 자신의 tenantId로 고정됩니다 (보안).

### 인증 세션 종류

| 세션 종류 | 쿠키/헤더 | 컨텍스트 변수 | 접근 범위 |
|----------|----------|------------|---------|
| 마스터 세션 | `admin_session` 쿠키 | `ctx.isMasterSession = true` | 전체 데이터 (tenantId 무관) |
| Manus OAuth | 세션 쿠키 | `ctx.user` (role=admin) | 전체 데이터 |
| 파트너 세션 | `partner_session` 쿠키 | `ctx.partnerOwner` | 자신의 tenantId 데이터만 |
| 파트너 스태프 | `Authorization: Bearer` | `ctx.partnerStaff` | 자신의 tenantId 데이터만 |

---

## 2. 프로시저 타입 정의

### 기존 프로시저 타입

```typescript
// 마스터 전용 (두골프 관리자만)
adminProcedure         // Manus OAuth admin 또는 master session

// 파트너 스태프 전용 (JWT Bearer 토큰)
partnerStaffProcedure  // role: staff 또는 manager
partnerManagerProcedure // role: manager만

// 공개
publicProcedure
```

### 추가 필요한 프로시저 타입

```typescript
// 파트너 대표 전용 (partner_session 쿠키)
partnerOwnerProcedure  // partner_session 쿠키 검증 → ctx.partnerOwner 주입

// 파트너 공통 (대표 또는 스태프 모두 허용)
partnerProcedure       // partnerOwner 또는 partnerStaff 중 하나 있으면 허용
                       // ctx.tenantId 자동 주입
```

---

## 3. 마스터 전용 기능 목록 (파트너에게 숨김)

파트너가 ERPLayout 접속 시 아래 메뉴/기능은 **숨김 처리**합니다.

### 사이드바 메뉴 숨김 대상

| 카테고리 | 숨김 이유 |
|---------|---------|
| **AI 챗봇** 전체 | 두골프 마스터 AI, 마스터 대화이력, 골프톡 관리, OpenRouter 에이전트 |
| **AI 관리** 전체 | 엔진 대시보드, 모델 라우팅, 개발 요청, 변경이력, 오류 로그 등 |
| **CRM > 파트너 관리** | 전체 파트너 목록 (마스터만 볼 수 있음) |
| **CRM > 파트너 온보딩 관리** | 신규 파트너 가입 심사 |
| **CRM > 구독 관리** | 전체 구독 플랜 관리 |
| **CRM > 마스터 관리** | 관리자 계정 관리 |
| **연동 설정 > 시스템 설정** | 시스템 전체 설정 |
| **연동 설정 > 지식 차단 관리** | AI 지식 차단 규칙 |

### 파트너에게 표시되는 메뉴

| 카테고리 | 표시 여부 | 비고 |
|---------|---------|-----|
| 대시보드 | ✅ | tenantId 기반 통계 |
| 상품관리 | ✅ | 자신의 tenantId 상품만 |
| 예약관리 | ✅ | 자신의 tenantId 예약만 |
| 자금관리 | ✅ | 자신의 tenantId 자금만 |
| 정산관리 | ✅ | 자신의 tenantId 정산만 |
| CRM > 고객 검색 | ✅ | 자신의 tenantId 고객만 |
| CRM > 제휴사 관리 | ✅ | 자신의 tenantId 제휴사만 |
| CMS > 홈페이지 관리 | ✅ | 자신의 홈페이지 설정 |
| CMS > 공지사항 | ✅ | 자신의 tenantId 공지만 |
| CMS > 배너 관리 | ✅ | 자신의 tenantId 배너만 |
| 연동 설정 > ERP 설정 | ✅ | 자신의 API 설정 |
| AI 매니저 (두골프 매니저) | ✅ | 파트너용 AI 상담 |

---

## 4. DB 테이블별 tenantId 현황

### ✅ tenantId 컬럼 있음 (격리 준비 완료)

| 테이블 | 용도 |
|-------|-----|
| `packages` | 골프 패키지 상품 |
| `bookings` | 예약 |
| `travelers` | 여행자 정보 |
| `settlements` | 정산 |
| `inquiries` | 예약 문의 |
| `notices` | 공지사항 |
| `banners` | 배너 |
| `ai_logs` | AI 로그 |
| `ai_cost_logs` | AI 비용 |
| `ai_routing_logs` | AI 라우팅 |
| `manus_webhook_logs` | 웹훅 로그 |
| `tenant_ai_credits` | AI 크레딧 |
| `tenant_api_connections` | API 연동 |
| `tenant_api_dev_requests` | API 개발 요청 |
| `tenant_credit_requests` | 크레딧 충전 요청 |

### ❌ tenantId 컬럼 없음 (향후 추가 필요)

| 테이블 | 우선순위 | 비고 |
|-------|---------|-----|
| `reservations` | 높음 | 수기 예약 |
| `reservation_inquiries` | 높음 | 예약 문의 |
| `income_records` | 높음 | 수입 기록 |
| `remittance_records` | 높음 | 송금 기록 |
| `affiliates` | 중간 | 제휴사 |
| `site_settings` | 중간 | 사이트 설정 |
| `custom_variables` | 중간 | 자동 치환 변수 |

---

## 5. 신규 기능 개발 체크리스트

기능을 개발할 때마다 아래 항목을 반드시 확인합니다.

```
[ ] 1. DB 테이블에 tenantId 컬럼 추가 (없는 경우)
[ ] 2. 프로시저 타입 선택:
       - 마스터 전용 → adminProcedure
       - 파트너 접근 가능 → partnerProcedure (신규 추가 예정)
[ ] 3. 쿼리에 tenantId 필터 추가:
       - 마스터: tenantId 필터 없음 (전체 조회)
       - 파트너: WHERE tenantId = ctx.tenantId
[ ] 4. INSERT 시 tenantId 자동 주입:
       - 마스터: tenantId = null
       - 파트너: tenantId = ctx.tenantId
[ ] 5. ERPLayout 메뉴에서 마스터 전용 여부 표시 (masterOnly: true)
[ ] 6. 파트너 접근 시 UI에서 해당 메뉴 숨김 확인
```

---

## 6. 파트너 세션 처리 흐름

```
파트너 로그인 (아이디/비밀번호 또는 구글)
    ↓
POST /api/partner/auth/email/login
또는 GET /api/partner/auth/google/callback
    ↓
partner_session 쿠키 발급 (JWT: partnerId, tenantId, role='partner_owner')
    ↓
브라우저 → /erp 접속 (ERPLayout)
    ↓
ERPLayout: partner_session 쿠키 감지
    → 마스터 전용 메뉴 숨김
    → 파트너 모드로 렌더링
    ↓
tRPC 요청 시 context.ts에서 partner_session 쿠키 파싱
    → ctx.partnerOwner = { partnerId, tenantId, ... }
    → ctx.tenantId = tenantId
    ↓
partnerProcedure: ctx.tenantId로 데이터 필터링
```

---

## 7. 개발 시 주의사항

1. **중복 기능 금지**: 파트너용 별도 페이지를 만들지 않습니다. ERPLayout의 기존 페이지를 그대로 사용하고 tenantId 필터만 추가합니다.

2. **마스터 데이터 보호**: 파트너가 `tenantId = null` 데이터에 접근하면 403 에러를 반환합니다.

3. **두골프 본사 tenantId**: 두골프 본사는 마스터 세션으로 접근하므로 `tenantId = null` 데이터를 봅니다. 향후 두골프 본사도 파트너로 전환 시 별도 tenantId를 부여합니다.

4. **신규 기능 배포 시**: 두골프 ERP에서 개발/테스트 후 배포하면 모든 파트너에게 자동 적용됩니다 (tenantId 필터가 적용된 상태로).

5. **구독 플랜 한도**: 파트너의 구독 플랜(starter/standard/premium)에 따라 기능 한도를 적용합니다 (maxPackages, maxBookingsPerMonth 등).
