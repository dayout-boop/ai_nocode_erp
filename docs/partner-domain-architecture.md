# 파트너 도메인 처리 아키텍처 검토 보고서

> 작성일: 2026-06-07 | 대상 프로젝트: 두골프 ERP (dayoutgolf.com)

---

## 1. 현황 요약

현재 두골프 ERP는 단일 Manus WebDev 프로젝트(`dogolf`)로 운영되며, 아래 도메인들이 동일 서버에 연결되어 있습니다.

| 도메인 | 용도 | 현재 처리 방식 |
|---|---|---|
| `dayoutgolf.com` | 두골프 메인 홈페이지 + ERP | 기본 라우팅 |
| `www.dayoutgolf.com` | 위와 동일 (www 리다이렉트) | CNAME |
| `partner.dayoutgolf.com` | 파트너 랜딩페이지 | App.tsx에서 hostname 감지 → PartnerLandingPage 렌더링 |
| `dogolf-tour-dkz3fsmp.manus.space` | Manus 내부 배포 URL | 기존 하드코딩 → 이번 작업으로 제거 완료 |

---

## 2. 파트너 URL 처리 방식 (현재 → 권장)

### 2-1. 무료/유료 가입 후 파트너 접속 URL 처리

파트너사가 ERP + 홈페이지를 가입(무료/유료)할 때 접속 URL은 두 가지 시나리오로 나뉩니다.

**시나리오 A: 별도 도메인 연결을 원하지 않는 경우 (기본)**

파트너사는 두골프가 제공하는 서브패스 방식으로 접속합니다.

| 구분 | URL 형식 | 예시 |
|---|---|---|
| 파트너 ERP | `dayoutgolf.com/partner/staff` | 두골프 서버에서 직접 제공 |
| 파트너 홈페이지 | `dayoutgolf.com/sites/{slug}` | 추후 구현 필요 |
| 파트너 챗봇 | `dayoutgolf.com/partner/chat` | 현재 구현됨 |

이 방식은 **추가 DNS 설정 없이 즉시 사용 가능**하며, 두골프 서버 한 곳에서 모든 파트너를 관리합니다.

**시나리오 B: 별도 도메인 연결을 원하는 경우**

파트너사가 자체 도메인(예: `abc-golf.com`)을 보유한 경우, CNAME 레코드를 `dayoutgolf.com`으로 설정합니다.

```
abc-golf.com  →  CNAME  →  dayoutgolf.com
```

서버에서 `Host` 헤더로 어느 파트너인지 식별하고, 해당 파트너의 테넌트 데이터를 렌더링합니다.

---

## 3. 도메인 연결 시 일괄 반영 아키텍처 (권장 설계)

### 3-1. DB 스키마 추가 필요 항목

현재 `tenants` 테이블에 도메인 관련 컬럼이 없습니다. 아래 컬럼을 추가해야 합니다.

```sql
ALTER TABLE tenants ADD COLUMN custom_domain VARCHAR(255) NULL;
ALTER TABLE tenants ADD COLUMN subdomain VARCHAR(100) NULL;
ALTER TABLE tenants ADD COLUMN domain_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN homepage_url VARCHAR(500) NULL;
ALTER TABLE tenants ADD COLUMN erp_url VARCHAR(500) NULL;
```

### 3-2. 서버 미들웨어 처리 흐름

```
요청 수신 (Host 헤더)
    ↓
미들웨어: tenantResolver
    ├─ Host == 'dayoutgolf.com' → 두골프 메인 (tenantId = null)
    ├─ Host == 'partner.dayoutgolf.com' → 파트너 랜딩페이지
    ├─ Host == '{slug}.dayoutgolf.com' → 서브도메인으로 테넌트 조회
    └─ Host == '{custom_domain}' → custom_domain 컬럼으로 테넌트 조회
    ↓
ctx.tenantId 주입 → tRPC 프로시저에서 활용
```

### 3-3. AI 챗봇/홈페이지 일괄 반영 방식

파트너가 ERP에서 도메인을 연결하면 아래 항목들이 자동으로 업데이트됩니다.

| 항목 | 반영 방식 |
|---|---|
| AI 챗봇 접속 URL | `tenants.homepage_url` 기준으로 동적 생성 |
| 홈페이지 메타태그 | `tenants.custom_domain` 기준으로 서버 렌더링 |
| 파트너 ERP 로그인 URL | `{custom_domain}/partner/staff/login` |
| Stripe 웹훅 URL | `{custom_domain}/api/stripe/webhook` |
| 비밀번호 재설정 링크 | `{custom_domain}/partner/reset-password?token=...` |

---

## 4. 단계별 구현 로드맵

### Phase 1 (즉시 구현 가능 - 현재 완료)
- [x] `partner.dayoutgolf.com` 접속 시 URL 유지하며 파트너 랜딩페이지 렌더링
- [x] 전체 코드에서 `dogolf-tour-dkz3fsmp.manus.space` URL 제거 → `dayoutgolf.com` 통일

### Phase 2 (단기 - 1~2주)
- [ ] `tenants` 테이블에 `custom_domain`, `subdomain`, `domain_verified` 컬럼 추가
- [ ] 서버 미들웨어에 `tenantResolver` 추가 (Host 헤더 기반 테넌트 식별)
- [ ] ERP 설정 페이지에 "도메인 연결" UI 추가

### Phase 3 (중기 - 1개월)
- [ ] 서브도메인 방식 지원: `{slug}.dayoutgolf.com`
- [ ] 커스텀 도메인 DNS 검증 API (TXT 레코드 확인)
- [ ] 도메인 연결 시 AI 챗봇/홈페이지 URL 자동 업데이트

### Phase 4 (장기)
- [ ] SSL 인증서 자동 발급 (Let's Encrypt)
- [ ] 파트너별 홈페이지 독립 라우팅 (`/sites/{slug}` 또는 커스텀 도메인)

---

## 5. 현재 구현된 URL 체계 정리

이번 작업으로 정리된 최종 URL 체계입니다.

| 접속 URL | 렌더링 내용 |
|---|---|
| `dayoutgolf.com` | 두골프 홈페이지 |
| `dayoutgolf.com/erp` | 두골프 ERP (관리자) |
| `dayoutgolf.com/erp/login` | ERP 로그인 |
| `dayoutgolf.com/partner/chat` | 파트너 챗봇 (가입 문의) |
| `dayoutgolf.com/partner/join` | 파트너 가입 신청 |
| `dayoutgolf.com/partner/staff` | 파트너 직원 ERP |
| `partner.dayoutgolf.com` | 파트너 랜딩페이지 (URL 유지) |
| `partner.dayoutgolf.com/partner/chat` | 파트너 챗봇 (랜딩에서 연결) |

---

*이 보고서는 두골프 ERP 개발 AI가 자동 생성한 아키텍처 검토 문서입니다.*
