# AGENTS.md — 마스터AI(new) 작동 규칙 (Spec-ai-engine, 최신)

> **위상:** 이 레포에서 코드를 생성·검증하는 마스터AI(new)와 모든 에이전트가 반드시 따르는 규칙. engine_v1 골격·arch-core.yaml·schema.sql과 한 세트(설계도).
> **단일 진실:** arch-core.yaml(계약·라우팅) · schema.sql(DB 36테이블) · engine_v1 .py(골격). 충돌 시 이 셋이 우선.
> **읽는 순서:** AGENTS.md(이 파일) → arch-core.yaml → schema.sql → engine_v1 골격 → D1~D10 설계서.

---

## 0. ★ 프로젝트 구조 (헷갈리지 말 것)

```
프로젝트명: ai_nocode_saas_erp
  ├ 제품1 = AI 연결·자동화 플랫폼 (소비자 — 나중)
  └ 제품2 = 메인 ERP 빌더 (소비자 — 제품1 후)

Specwire ERP = 마스터 백오피스 (관리자 콘솔, 제품 아님)
  = 제품1·2를 만들고 운영·관리하는 본거지 (★지금 만들 토대)

engine_v1 (제2 Traycer) = 제품을 만드는 개발 도구 (★제품 아님)
  = 이 레포의 .py 골격 = 마스터AI(new)에게 줄 설계도/명세

두골프(Dugolf) = 참조·검증용. ★코드 재사용·이식 금지 (검증된 로직 흐름만 참조).
```

### 0.1 마스터AI(new)의 역할
```
마스터AI(new) = engine_v1 골격(설계도)을 읽고 →
  작업 단위로 분할 → 외부 LLM/마누스에 분배 →
  Specwire ERP의 런타임 엔진(Go/Rust/Python)을 생성·검증 →
  마누스 클라우드(track_b)에서 빌드·테스트·자가치유 → GitHub 커밋

★엔진 언어(이 골격 .py·구현 .ts) ≠ 결과물 언어(Go/Rust/Python). 지휘자 ≠ 연주자.
```

---

## 1. ★ 5평면 (한 언어로 전부 X — 기능 성질로 배치)

```
평면          언어·런타임         책임
Frontend     React19+Tailwind4   좌 라이브뷰어·우 AI UI (+ React Flow)
Edge         Go + gRPC           진입·인증·테넌트식별·라우팅·레이트리밋
Control      Go + PostgreSQL     인스턴스화·과금·승격·스펙레지스트리·검증게이트
Execution    Rust + Wasm         워크플로우 실행·Saga보상·신뢰불가 격리·Temporal워커
Intelligence Python + LLM        페르소나AI·자연어→WorkflowSpec (L-5 게이트)
DB           PostgreSQL          단일 records·JSONB·RLS·DDL-0·owner_key

측정채택(격리 적용, 전면 X): Pkl(입구 스키마)·Zig(S3 바이트)·Mojo(에러시그니처)
```

### 1.1 ★ import 경계 방향 (위반 = Critical 차단)
```
edge → control / control → execution·intelligence
execution → intelligence / intelligence → (최하위, 위로 import 금지)
frontend → control(API)만
→ 위반 시 빌드 실패 처리 (import-linter·cargo·go 정적분석)
```

---

## 2. ★ DB 규칙 (schema.sql = 36테이블 단일 진실)

```
- 단일 records 테이블 + JSONB (스키마리스, 고객마다 테이블 X)
- DDL-0: 신규 테넌트 = INSERT only (CREATE TABLE·ALTER 금지)
- RLS 2겹: tenant_id 필터 (SET LOCAL) — 남의 테넌트 데이터 못 봄
- owner_key 4-part: tenant:org:user:project (make_owner_key 생성)
- DAL tenantScoped가 tenant_id 자동 주입 (수동 금지)

36테이블 7그룹:
  G1 상태·테넌트(5) G2 LLM(6~7) G3 문서(5) G4 엣지(4)
  G5 실행·자가수정(8) G6 과금·키(6) G7 공통(2~3)
→ 테이블 추가·변경은 schema.sql 수정 (코드에 임의 DDL 금지)
```

---

## 3. ★ 인프라 (arch-core.yaml = 벤더 단일 진실)

```
코어:     AWS EC2 (서울) → Docker 2분리 (master 자가수정 / customer)
DB:       Neon DB Pro (PostgreSQL, 서버리스 브랜칭)
샌드박스:  E2B Pro (Go·Rust·Python 멀티런타임, master keep24h/customer 5m)
캐시·큐:  Upstash Redis Premium
오케스트: Temporal Cloud (durable·끊김복구·비용상한)
내부 Git: Forgejo → Squash → GitHub
관측:     Langfuse + OpenTelemetry
방어:     Cloudflare WAF → Clerk/Auth0 → mTLS

★전부 Provider/Adapter 추상화 뒤 (벤더 변경 = 어댑터 1개, 요금제 = 0줄)
  SandboxProvider·StateStore·QueueProvider·GitProvider·CloudProvider·SecretProvider
```

---

## 4. ★ 자가수정 (결정론 — 주관검증 금지)

```
L2_deterministic: 샌드박스 실제 실행 → Exit Code 판정 (LLM 주관검증 금지)
  도구: 컴파일러(go·cargo·pytest) + 린터(ruff·clippy·eslint) + Playwright
heal: Exit Code 오라클 + Temporal 영속 + ★비용 상한 (무한루프 방지)

자가수정 6대 필수:
  SandboxProvider(write→execute 심장) · Exit Code 오라클 · StateStore
  · GitProvider · 수요감지(C-9) · 적용게이트(C-8 크리티컬 3레벨 사람승인)
흐름: 감지→기획→생성(4축)→E2B실행(Exit Code)→치유→Squash→GitHub
```

---

## 5. ★ 마누스 세션 (호출 규칙)

```
데스크 = task (같은 것, id = task_id)
  API 키 = 동일값 (트랙A·B 공용)
  트랙A(두골프): project_id 고정 + task_id 고정 (★트랙B 사용 금지)
  트랙B(마스터AI new): project_id 고정 + task_id 가변(500회 순환)

호출(agents.py 검증본):
  manus_create(prompt, project_id) → task_id (HTTP/2 필수, x-manus-api-key)
  manus_send(task_id, prompt) → 같은 task 이어감 (크레딧 절약)
  state.py: MAX_CALLS=500 → 도달 시 새 task (call_count 리셋)
키: 환경변수(MANUS_API_KEY 등) 기본, resolver가 BYOK 주입 시 우선
  → 키 값 코드 하드코딩 금지 (P1-4 브로커)

범위 제한(무한루프 방지): 작업 단위마다 MAX_RETRY + token_budget + cutoff
  → 초과 시 에스컬레이션 (사람). "되면 되게"는 범위 안에서만.
```

---

## 6. ★ 금지 패턴 (위반 = Critical)

```
❌ MySQL (PostgreSQL만)            ❌ tRPC (gRPC만, 진입 외)
❌ 고객마다 테이블 (단일 records)   ❌ 임의 DDL (DDL-0, INSERT only)
❌ 모델 자기학습·파인튜닝 (P-10: 모델 안 변함, 사람이 데이터 바꿈)
❌ 키 평문 하드코딩 (ERP 암호화·환경변수만)
❌ 두골프 TS 코드 이식 (참조만)     ❌ import 경계 역방향
❌ eval·임의코드 실행 (닫힌 DSL ~15동사, sandbox.run 예외)
❌ LLM 주관검증을 통과 기준으로 (Exit Code 결정론만)
❌ 트랙B가 트랙A 키·task_id 사용 (격리)
```

---

## 7. ★ 작업 원칙 (마스터AI new·에이전트)

```
1. 단일 진실 우선: arch-core·schema·골격과 충돌하는 코드 생성 금지
2. 작업 단위 분할: 설계서를 작은 단위로 (DAL→RLS·owner_key→세션 등 의존순)
3. 검증은 결정론: Exit Code·린터·계약(import-linter)으로만 통과 판정
4. 범위 제한: 각 단위 MAX_RETRY·token_budget — 무한루프 방지
5. 추측 금지: vendor·기술 주장은 실측(실행)으로 — 단어 존재 ≠ 기능 작동
6. 컴포넌트 과소평가 금지: 엔진~8·DB36·소켓5·화면5~8·로직25~30
7. 결과물 언어 = Go/Rust/Python (평면별), 이 골격(.py)은 설계도일 뿐
```

---

## 8. 한 줄 요약

```
이 레포 = engine_v1 골격(설계도, 제품 아님). 마스터AI(new)가 이걸 읽고
  Specwire ERP 런타임 엔진(Go/Rust/Python)을 5평면대로 생성·검증.
단일 진실: arch-core(계약·벤더) · schema.sql(36테이블·DDL0·RLS·owner_key) · 골격(.py).
5평면: React·Go·Rust·Python·PG / import 경계 역방향 = Critical.
인프라: Neon·E2B·Temporal·Upstash·Forgejo·AWS, 전부 Provider 추상화.
자가수정: Exit Code 결정론 + Temporal 영속 + 비용상한, 6대 필수.
마누스: 데스크=task, 트랙B project_id 고정·task_id 가변(500순환), 범위제한.
금지: MySQL·tRPC·임의DDL·자기학습(P-10)·평문키·두골프이식·경계역방향·주관검증·eval.
두골프 = 참조만(이식 금지). 추측 금지(실측). 컴포넌트 과소평가 금지.
```
