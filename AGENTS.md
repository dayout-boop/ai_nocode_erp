# AGENTS.md — 연결·자동화 플랫폼 코어 빌드 규격 (테스트용)

> AI 코딩 에이전트를 위한 프로젝트 규격. 이 문서를 위반하는 산출물은 검증에서 Critical로 반려된다.
> **이 파일은 Traycer 실구동 테스트용이다. 목적: AGENTS.md가 실제로 읽히고, 금지패턴이 Critical로 잡히는지 검증.**

## 프로젝트

비개발자/목적 있는 유저를 위한 AI 연결·자동화 플랫폼. 메타데이터 인터프리터 기반.
산출물은 코드를 쌓지 않고 정의(데이터)를 단일 인터프리터가 해석한다.

## 절대 금지 (위반 = Critical 반려, 이유 불문)

- **DB**: `mysql`, `mysqlTable`, `mysqlEnum`, `mysql2`, `sqlite`, `sqliteTable` — **PostgreSQL만 허용**
- **API 스택**: `@trpc/*`, `createTRPCRouter`, `publicProcedure`, `protectedProcedure` — tRPC 금지
- **PK**: `autoincrement`, `serial`, `AUTO_INCREMENT`, 정수 PK — 의미적 `varchar` ID만
- **금액**: `decimal`/`float`/`double` 금액 필드 — 정수 최소단위(`integer`)만
- **시간**: 저장에 `Date()`/`timestamp`/로컬시간 — UTC ms `bigint`만
- **시크릿**: API 키 평문 하드코딩(`sk-...` 리터럴) — 시크릿 매니저 key_id 참조만
- **격리 우회**: `BYPASSRLS`, `tenant_id` 필터 없는 데이터 SQL
- **자기학습**: `self-learning`, `fine-tune`, `online training` — 모델 자기개선 없음

## 필수 규격 (충족해야 통과)

- DB = **PostgreSQL** (`pg`/`postgres`/`pgTable`, Supabase/Neon 클라이언트 허용)
- 공유 단일 테이블 `records(tenant_id, entity_type_id, id, data jsonb, created_at, updated_at)`
- 테넌트 격리 = **RLS 정책 + 앱레벨 tenant_id 주입**(둘 다). 모든 데이터 SQL은 tenant_id 전제
- PK = 의미적 varchar(접두사_nanoid), 시간 = `bigint`(UTC ms), 금액 = `integer`
- 식별자 접두사: `tenant_`/`user_`/`conn_`/`wf_`/`run_`/`secret_`
- 커넥터 ID = `conn_<능력>_<벤더>_v<주버전>` (예: `conn_oauth_google_v1`)
- 외부 연결(OAuth/API 키)은 단일 게이트 경유, 자격증명은 암호화 보관(평문 X)
- 구조 변경 = 정의(데이터) 추가, DDL 아님

## 구조 규칙 (위반 = Critical)
- 순환 의존 금지 (A->B->A)
- 레이어 역류 금지 (domain -> ui)
- 내부 침투 금지 — 모듈은 공개 인터페이스(index)로만 통신

## 빌드 통과 조건
- 컴파일/타입체크 통과, 단위 테스트 통과, 린트 통과
- DB 변경 시: RLS 침투 테스트(타 테넌트 행 조회 차단) 통과
