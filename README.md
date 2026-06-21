# 엔진 v1 — 다중 에이전트 오케스트레이션 (정리본)

전체를 깨끗하게 새로 만든 버전. 중복 제거: 모든 에이전트 호출은 `agents.py` 한 곳.

## 파일 구조

```
arch-core.yaml   단일 진실 (평면·언어·에이전트·모델·키이름·계약·금지/필수)
agents.py        에이전트 호출 공통 모듈 (Manus/OpenAI/DeepSeek/Gemini/Cursor)
state.py         Manus task_id 자동 관리 + owner_key 4-part (tenant:org:user:project)
resolver.py      owner_key별 키소스·연결방식·에이전트·크레딧 게이트·제품 분기 해석
crosscheck.py    L3b 경량 교차검증 (R1~R6 계약 일치 → 불일치만 재명령)
healthcheck.py   5개 에이전트 연결 점검 (Manus는 생성 없이 detail 조회, GET-only)
orchestrator.py  arch-core 메모리 캐싱 → 병렬 분배 → crosscheck 검증 연결
```

의존: orchestrator → agents + state + arch-core + crosscheck + resolver / healthcheck → agents + state / state → agents

※ arch-core는 부팅 시 1번 읽어 메모리 공유(`_ARCH_CORE` 캐시) — 1만 동시 요청이 같은 객체 읽기만 (병목 제거).

## Codespace 설치

```bash
pip install pyyaml 'httpx[http2]'
```

## Codespace Secrets (고정값만)

```
MANUS_API_KEY      OPENAI_API_KEY    DEEPSEEK_API_KEY
GEMINI_API_KEY     CURSOR_API_KEY
MANUS_PROJECT_ID = TFvPYz7kgWj247QbqgkB4r   ← 엔진 프로젝트
```
※ task_id는 Secrets에 넣지 않음 (.manus_state.json 자동 관리)
※ Secret 추가 후 Codespace 재시작해야 환경변수 주입됨

## 실행 순서

```bash
# 1. 헬스체크 (5개 연결 확인, Manus는 생성 안 함)
python3 healthcheck.py

# 2. Manus 세션 단독 테스트 (create→sendMessage 이어가기)
python3 state.py "validate_reservation 함수 Python으로"
python3 state.py "테스트 케이스 추가"          # 같은 task에 이어짐

# 3. 병렬 분배 (5개 동시, Manus는 재사용 세션)
python3 orchestrator.py
```

## 실측 확정 사실 (2026-06-15~16)

| 에이전트 | 호출 | 확정 |
|---|---|---|
| Manus | v2 `x-manus-api-key`, `/v2/task.{create,sendMessage,detail}`, `{message:{content:[{type:text,text}]}}`, HTTP/2 | 200 |
| OpenAI | Bearer, `/v1/chat/completions`, `max_completion_tokens`, gpt-5.5 | 200 |
| DeepSeek | Bearer, `/chat/completions`, `max_tokens`, deepseek-v4-flash | 200 |
| Gemini | `?key=`, `/v1beta/models/gemini-3.1-pro-preview:generateContent` | 200 |
| Cursor | Bearer, `GET /v1/me` (가용; 코드생성은 repo 비동기) | 200 |
| Claude | CLI 별도 (REST 아님) | — |

## ★ Manus 스킬 주의

Manus는 프로젝트 등록 스킬을 **프롬프트 키워드로 자동 발동**함.
`ping/test/API` 등이 의도 안 한 스킬을 트리거 (dogolf-manus-api-tester 사례 → 삭제함).
→ 엔진 프로젝트엔 불필요 스킬 두지 말 것. 필요시 enable_skills로 통제.

## 다음 단계

이번 세션 반영 (2026-06-17):
- ✅ arch-core 메모리 캐싱 (매 요청 파일읽기 병목 제거 — `_ARCH_CORE` 전역)
- ✅ owner_key 4-part (org 협업 차원 추가, C-1 결합)
- ✅ L3b 교차검증 연결 (orchestrator run() → crosscheck_all → 불일치 평면 재명령)
- ✅ resolver 게이트 연결 (dispatch 호출 전 키소스·크레딧 precheck, 잔액 부족 차단)
- ✅ 유한 재시도 루프 (재명령 → 재검증, MAX_RETRY=2, 상한 도달 시 에스컬레이션)

→ ★ S0 한바퀴 닫힘: 분배 → 게이트(키·크레딧) → 호출 → 검증 → 재명령 → 재검증 → 에스컬레이션

S0 잔여 (선택/인프라):
- ◐ L0 단계머신 강제 (선택 — 현재 평면 병렬로 동작)
- ⬜ 게이트A 풀 (lint·tsc·test 샌드박스 — 인프라 필요, S2)

강화 대기 (Anthropic 하네스 연구):
- ⬜ 컨텍스트 리셋 + 구조화 핸드오프 (긴 작업, state.py 확장)
- ⬜ 평가자 Playwright 실제 동작 테스트 (BrowserProvider)
- ⬜ 평가자 긍정편향 억제 튜닝 (회의적 프롬프트)

- Claude Go: CLI(구독) vs API(REST) 결정

---

## 제품1 글로벌 실사용 전제 (resolver.py — 소급 불가 구조)

엔진은 "단편 호출"이 아니라 **글로벌 사용자 N명이 각자 다른 방식**을 쓰는 걸 전제.
owner_key별로 "이 사용자는 어떤 키/연결/에이전트/과금"인지 해석(resolve)해 오케스트레이션.

| 추상화 | 역할 | 지금 | 제품 단계 |
|---|---|---|---|
| KeySourceResolver | BYOK(고객키) vs managed(우리키+크레딧) 분기 | 구조+env시뮬 | 시크릿매니저+고객설정 |
| ConnectMethodResolver | OAuth→MCP→iframe→headless 폴백 | 선언만 | 실제 연결 구동 |
| AgentRouter | 작업→에이전트 (arch-core) | ✅ 작동 | ✅ |
| CreditGate | BYOK 무차감 / managed 차감·원장 | 구조 | 원장 DB |
| ProductResolver | 위를 owner_key별로 묶음 | ✅ 작동 | ✅ |

**핵심:** agents.py가 "우리 키"를 직접 안 읽음. resolver가 owner_key로 키/방식을 해석해 주입.
→ **같은 코드가 고객A(BYOK)·고객B(크레딧 대행)를 동시에 다르게 처리.**

소급 불가라 지금 박음: 키 소스 분기·owner_key 격리·**org 협업 차원(4-part)**·교차검증 연결. 실제 연결·크레딧 원장·키관리(시크릿매니저)·큐·Temporal은 제품 런타임(S1~S2, dayout 벤더).

※ owner_key = `tenant:org:user:project` (4-part). org=협업(팀) 차원, C-1 결합. 제품1은 org_default 단일, 팀 협업 시 여러 org_.

---

## 최신 동결 (2026-06, arch-core 명세 — S-15~S-17)

### 오케스트레이터 명세 (`orchestrator_spec`)
5단계 pipeline(map·plan·execute·heal·reduce) + 결정론 오라클(Exit Code, 텍스트검사 아님) + 비용강제(dual_cap) + 하네스 우선. 「95 비판분석」「97 보강」 근거.

### 인프라 확정 LOCK (`infra_confirmed`) — 이원화
| 레이어 | 마스터(24h 자가수정) | 글로벌 고객(SaaS) |
|---|---|---|
| 코어 | AWS EC2 → engine-master | engine-customer-api (Docker 2분리) |
| DB | Neon Main + JSONB | 헤비=브랜칭 / 무료=공용+RLS |
| 샌드박스 | E2B keep_alive=24h | E2B timeout=5m (8vCPU/32GB 초과→Temporal 엣지분리) |
| 큐 | Upstash master_self_improvement | customer_tasks(throttling) |
| 오케스트 | Temporal master-production | customer-production |
| Git | Forgejo→GitHub Enterprise | 고객 GitHub(Webhook) |

### LLM 4축 동적 분산 (`llm_distribution`) — 획일화 해제
- 축1 언어: `LanguageMatrixRouter` (능력 매트릭스, 새 언어 자동수용)
- 축2 LLM: OpenAI 호환 자동 수용 (벤더 무제한)
- 축3 리전: `RegionResolver` (가용·가격·성능·규제 → 폴백)
- 축4 라우팅: 언어 ∩ 가용LLM ∩ 우수리전 ∩ 예산 → 폴백체인(리전→LLM→에스컬레이션)

### 멀티모달·보안·관측 (`multimodal`·`security_layers`·`observability`)
- 멀티모달: 트랙분기(32MB/2GB)·S3·FFmpeg·Gemini File (별도 확장, 코어 아님)
- 보안 6중: STS·WORM·ClamAV·Payload Codec·멱등성·mTLS(봇간)
- 관측: Langfuse·비용강제(호출 전 ceiling)·context pruning

### 코드 반영 현황
| 명세 | 코드 |
|---|---|
| RuntimeTier·GitInfra (C-7 LOCK) | ✅ resolver |
| LanguageMatrix·Region (4축) | ✅ resolver (매트릭스 정밀화는 dayout) |
| S0 게이트·재시도 | ✅ orchestrator |
| 결정론 오라클 L2·비용강제·fan-out | ⬜ S1~S2 (인프라) |
| 멀티모달·6중보안·관측 실제 | ⬜ S1~S2 (벤더) |

**원칙:** 전부 Provider/Adapter 추상화 뒤 — 확정 벤더지만 교체 가능. 구현은 S1~S2 + dayout 세부수치.
