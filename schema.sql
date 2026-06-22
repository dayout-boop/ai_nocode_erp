-- ============================================================
-- 제품1 자가개선 엔진 — 전체 DB 스키마 (단일 진실)
-- ============================================================
-- 목적: DB 37개 테이블을 1개 파일로 (문서 37개 폭증 방지).
--       각 테이블에 "무슨 로직으로 채워지고 쓰이는지" 주석 (깡통 방지).
-- 언어: PostgreSQL (Neon DB Pro). 다중 하이브리드 — Go/Python이 접근.
-- 격리: tenant_id 있는 테이블은 RLS 적용 (★표시).
-- 개발: 신규 AI가 외부 LLM 시켜 생성. 이 스키마가 DB 진실.
-- 보강: 각 엔진별 상세 로직은 D1~D10 설계서. DB 구조는 여기.
-- ============================================================


-- ────────────────────────────────────────────────
-- [그룹 1] 상태·테넌트 (D1 — 기반)
-- 모든 컴포넌트가 의존. owner_key 4-part, RLS 2겹.
-- ────────────────────────────────────────────────

-- 테넌트 등록·계층 (master 자가개선 / heavy 고객 / free)
CREATE TABLE tenants (
    tenant_id    TEXT PRIMARY KEY,
    type         TEXT NOT NULL,         -- 'master' | 'heavy' | 'free'
    org_default  TEXT,                  -- 협업(팀) 기본 org
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: 가입 시 1행. type으로 Neon 3계층 분기(Main/브랜치/공용).

-- ★RLS — 범용 메타데이터 (정본 단일 records + JSONB)
CREATE TABLE records (
    tenant_id    TEXT NOT NULL,         -- ★RLS 필터 키
    entity_type  TEXT NOT NULL,         -- 엔티티 종류
    id           TEXT NOT NULL,
    data         JSONB NOT NULL,        -- 가변 구조 (스키마리스)
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (tenant_id, entity_type, id)
);
-- 로직: 고객 메타데이터 전부. RLS(SET LOCAL tenant_id)로 행 격리.
-- 쓰기: DAL tenantScoped가 tenant_id 자동 주입. 읽기: RLS가 강제 필터.

-- 자가개선 작업 상태 (분배·재시도·단계)
CREATE TABLE task_state (
    owner_key    TEXT NOT NULL,         -- tenant:org:user:project
    task_id      TEXT NOT NULL,
    status       TEXT NOT NULL,         -- pending|processing|done|failed
    stage        TEXT,                  -- map|plan|execute|heal|reduce
    retry_count  INT DEFAULT 0,         -- MAX_RETRY 추적
    token_budget BIGINT,                -- 비용 강제 ceiling
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (owner_key, task_id)
);
-- 로직: orchestrator가 작업마다 1행. 재시도·단계 추적. Temporal과 동기.

-- owner_key 레지스트리 (4-part 분해·검증)
CREATE TABLE owner_keys (
    owner_key    TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    org_id       TEXT NOT NULL,         -- 협업 차원 (C-1)
    user_id      TEXT NOT NULL,
    project_id   TEXT NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: make_owner_key가 생성. 4-part 분해 캐시.

-- 세션 (마스터 AI·다중봇 인증, 500회당 데스크ID 교체)
CREATE TABLE sessions (
    session_id   TEXT PRIMARY KEY,
    owner_key    TEXT NOT NULL,
    desk_id      TEXT,                  -- 마누스 데스크ID (혼선 방지)
    call_count   INT DEFAULT 0,         -- 500회당 교체 트리거
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: 봇 인증. call_count 500 도달 시 desk_id 교체 (8단계).


-- ────────────────────────────────────────────────
-- [그룹 2] LLM 4축·평가 (D3 — 지능)
-- 언어·LLM·리전·라우팅 + 3층 평가(즉시·누적·주단위).
-- ────────────────────────────────────────────────

-- 모델 라우팅 규칙 (complexity·언어별 — 고정층 주순위)
CREATE TABLE model_routing_rules (
    id           SERIAL PRIMARY KEY,
    language     TEXT,                  -- go|rust|python|ts|'*'
    complexity   TEXT,                  -- high|medium|low
    provider     TEXT NOT NULL,         -- anthropic|openai|google|deepseek...
    model        TEXT NOT NULL,
    input_price  NUMERIC,               -- 리전·시점 가격
    output_price NUMERIC,
    is_active    BOOLEAN DEFAULT true,
    updated_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: evaluator 주단위 결과 반영. resolver가 읽어 라우팅.

-- 언어별 1~3위 순위 (고정층 — 주단위 확정)
CREATE TABLE model_ranking (
    language     TEXT NOT NULL,
    rank         INT NOT NULL,          -- 1|2|3
    agent        TEXT NOT NULL,
    score        NUMERIC,               -- f(비용·에러·정합성·지연)
    region       TEXT,
    week         TEXT NOT NULL,         -- 주 식별
    PRIMARY KEY (language, rank, week)
);
-- 로직: evaluator가 주1회 누적평균+OpenRouter 교차로 확정. resolver 우선순위.

-- LLM 비용 로그 (누적층 — 실사용 기록)
CREATE TABLE ai_cost_logs (
    id           BIGSERIAL PRIMARY KEY,
    owner_key    TEXT,
    task_id      TEXT,
    provider     TEXT,
    model        TEXT,
    tokens_in    INT,
    tokens_out   INT,
    cost_usd     NUMERIC,
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: 매 LLM 호출 1행. 평가 누적·비용 강제·재청구 근거.

-- LLM 상호작용 기록 (누적층 — 정합성·에러)
CREATE TABLE ai_interaction_logs (
    id           BIGSERIAL PRIMARY KEY,
    owner_key    TEXT,
    task_id      TEXT,
    language     TEXT,
    agent        TEXT,
    error        BOOLEAN,               -- Exit Code != 0
    consistency  NUMERIC,               -- crosscheck 통과율
    latency_ms   NUMERIC,
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: 매 작업 1행. evaluator 누적평균 입력 (score 계산).

-- 라우팅 결정 기록 (어느 LLM·리전 선택했나)
CREATE TABLE ai_routing_logs (
    id           BIGSERIAL PRIMARY KEY,
    task_id      TEXT,
    language     TEXT,
    chosen_agent TEXT,
    chosen_region TEXT,
    fallback_used BOOLEAN,              -- 폴백 발동?
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: resolver 라우팅마다 1행. 폴백·리전 전환 추적.

-- 리전 상태 (축3 — 가용·가격·성능·규제)
CREATE TABLE region_health (
    region       TEXT PRIMARY KEY,
    available    BOOLEAN,
    price_index  NUMERIC,
    latency_ms   NUMERIC,
    sovereignty  TEXT,                  -- EU 등 규제
    updated_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: 주기 측정. RegionResolver가 읽어 우수 리전 선택·폴백.


-- ────────────────────────────────────────────────
-- [그룹 3] 문서 분석 (D4 — 지능)
-- 70개 문서 등록·청킹·AST·임베딩·검색.
-- ────────────────────────────────────────────────

-- 문서 원본 메타
CREATE TABLE documents (
    doc_id       TEXT PRIMARY KEY,
    owner_key    TEXT NOT NULL,         -- ★RLS
    title        TEXT,
    source_type  TEXT,                  -- md|pdf|code|...
    uri          TEXT,                  -- S3 등 (대용량)
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: 문서 인입 시 1행. 70개 등록.

-- 청크 (chunkText — size·overlap)
CREATE TABLE doc_chunks (
    chunk_id     TEXT PRIMARY KEY,
    doc_id       TEXT NOT NULL,
    seq          INT,                   -- 순서
    content      TEXT,                  -- 청크 텍스트
    hash         TEXT,                  -- 캐싱 키 (Redis 매핑)
    ast_node     TEXT                   -- AST 노드 종류 (코드면)
);
-- 로직: 문서를 청킹·AST 슬라이싱. hash로 컨텍스트 캐싱(토큰 90%↓).

-- 임베딩 (벡터 — pgvector)
CREATE TABLE embeddings (
    chunk_id     TEXT PRIMARY KEY,
    doc_id       TEXT NOT NULL,
    vector       VECTOR(1536),          -- OpenAI embed 등
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: 청크별 임베딩. 벡터 검색(유사도)으로 컨텍스트 검색.

-- 검색 인덱스 (메타·키워드)
CREATE TABLE doc_index (
    doc_id       TEXT NOT NULL,
    keyword      TEXT,
    weight       NUMERIC,
    PRIMARY KEY (doc_id, keyword)
);
-- 로직: 키워드·메타 검색 (벡터 보완). 하이브리드 검색.

-- 파싱 캐시 (AST·추출 결과 재사용)
CREATE TABLE parse_cache (
    hash         TEXT PRIMARY KEY,      -- 입력 해시
    result       JSONB,                 -- 파싱 결과
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: 같은 입력 재파싱 방지. 비용 절감.


-- ────────────────────────────────────────────────
-- [그룹 4] 엣지 파이프 (D5 — 실행)
-- 작업 분할·fan-out·엣지 헌장.
-- ────────────────────────────────────────────────

-- 분할된 엣지 작업
CREATE TABLE edge_tasks (
    edge_id      TEXT PRIMARY KEY,
    parent_task  TEXT NOT NULL,         -- task_state.task_id
    tier         TEXT,                  -- micro|heavy (Late Binding)
    status       TEXT,
    payload_mb   NUMERIC,               -- heavy 판정
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: Plan 단계서 작업을 엣지로 분할. fan-out 단위.

-- 엣지별 동적 헌장 (폭주 방지)
CREATE TABLE edge_charter (
    edge_id      TEXT PRIMARY KEY,
    charter      TEXT,                  -- 이 엣지의 규칙 (동적 CLAUDE.md)
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: 각 엣지에 "자기 규칙만" 바인딩. 전체 망각·폭주 방지.

-- fan-out 병렬 상태
CREATE TABLE fanout_state (
    parent_task  TEXT NOT NULL,
    total_edges  INT,
    done_edges   INT,
    failed_edges INT,
    PRIMARY KEY (parent_task)
);
-- 로직: Temporal fan-out 진행 추적. 다 끝나면 Reduce.

-- 엣지 의존 (순서·선후)
CREATE TABLE task_dependency (
    edge_id      TEXT NOT NULL,
    depends_on   TEXT NOT NULL,
    PRIMARY KEY (edge_id, depends_on)
);
-- 로직: 엣지 간 의존. 순서 보장.


-- ────────────────────────────────────────────────
-- [그룹 5] 실행·자가수정 (D6·D7 — 실행)
-- 코드 생성·샌드박스 실행·Exit Code·Git·자가치유.
-- ────────────────────────────────────────────────

-- 개발 요청 (오너 또는 수요 감지)
CREATE TABLE dev_requests (
    request_id   TEXT PRIMARY KEY,
    owner_key    TEXT NOT NULL,
    title        TEXT,
    description  TEXT,
    language     TEXT,                  -- 생성할 코드 언어
    status       TEXT,                  -- pending|processing|done|rejected
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: 자가개선 시작점. 오너 요청 또는 엔진 수요 감지로 1행.

-- 생성된 코드 (LLM 산출)
CREATE TABLE code_generations (
    gen_id       TEXT PRIMARY KEY,
    request_id   TEXT NOT NULL,
    edge_id      TEXT,                  -- 어느 엣지
    language     TEXT,
    code         TEXT,                  -- 생성 코드
    status       TEXT,                  -- generated|validated|failed
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: LLM이 생성한 코드 1행. D6 실행으로 검증.

-- 실행 결과 (★결정론 오라클 — Exit Code)
CREATE TABLE execution_logs (
    exec_id      TEXT PRIMARY KEY,
    gen_id       TEXT NOT NULL,
    exit_code    INT,                   -- ★0=통과 / !=0=실패
    stdout       TEXT,
    stderr       TEXT,
    runtime_tier TEXT,                  -- micro|heavy
    executed_at  TIMESTAMPTZ DEFAULT now()
);
-- 로직: E2B 샌드박스 실행 결과. Exit Code로 결정론 판정(주관검증 X).

-- 4종 감사 결과 (정합성)
CREATE TABLE audit_results (
    audit_id     TEXT PRIMARY KEY,
    gen_id       TEXT NOT NULL,
    syntax_ok    BOOLEAN,
    logic_ok     BOOLEAN,
    security_ok  BOOLEAN,
    performance_ok BOOLEAN,
    audit_lock   BOOLEAN,               -- 마스터 승인 대기
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: SelfAuditBot 4종 검사. 통과 시 AUDIT_LOCK → 승인 대기.

-- Git 커밋 기록
CREATE TABLE git_commits (
    commit_sha   TEXT PRIMARY KEY,
    gen_id       TEXT,
    branch       TEXT,                  -- dev-1|dev-2-integration|main
    message      TEXT,
    committed_at TIMESTAMPTZ DEFAULT now()
);
-- 로직: gitEngine이 GitHub API로 커밋. dev1→dev2→main 추적.

-- 배포 로그
CREATE TABLE deploy_logs (
    deploy_id    TEXT PRIMARY KEY,
    commit_sha   TEXT,
    status       TEXT,                  -- pending|deployed|failed
    deployed_at  TIMESTAMPTZ DEFAULT now()
);
-- 로직: main 병합 후 배포. deployRunner.

-- 자가치유 요청 (실패 시 재수정)
CREATE TABLE fix_requests (
    fix_id       TEXT PRIMARY KEY,
    gen_id       TEXT NOT NULL,
    error_log    TEXT,                  -- stderr 급여
    fix_status   TEXT,                  -- pending|fixed|reescalated
    attempt      INT,                   -- 1~3차
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: Exit Code != 0 → 에러로그로 치유 LLM 호출 → 재생성. MAX_RETRY 내.

-- 롤백 로그 (반려·실패 시)
CREATE TABLE rollback_logs (
    rollback_id  TEXT PRIMARY KEY,
    commit_sha   TEXT,
    reason       TEXT,                  -- rejected|main_error
    rolled_at    TIMESTAMPTZ DEFAULT now()
);
-- 로직: 마스터 반려 또는 main 오류 시 롤백. 청정 상태 복구.


-- ────────────────────────────────────────────────
-- [그룹 6] 과금·키·연결 (D8 — 받침)
-- 크레딧·BYOK/managed·시크릿·커넥터.
-- ────────────────────────────────────────────────

-- 테넌트 크레딧 잔액
CREATE TABLE tenant_credits (
    tenant_id    TEXT PRIMARY KEY,
    balance      NUMERIC DEFAULT 0,     -- 잔액
    plan         TEXT,                  -- 플랜
    updated_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: managed 사용 시 차감. balance < 0 차단 (CreditGate).

-- 크레딧 원장 (차감·충전 기록)
CREATE TABLE credit_ledger (
    entry_id     BIGSERIAL PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    delta        NUMERIC,               -- +충전 / -차감
    reason       TEXT,                  -- llm_cost|sandbox|charge
    balance_after NUMERIC,
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: 모든 크레딧 변동 1행. 재청구·정산 근거 (원장).

-- API 키 (BYOK 고객키 / managed 우리키)
CREATE TABLE api_keys (
    key_id       TEXT PRIMARY KEY,
    owner_key    TEXT NOT NULL,         -- ★RLS
    provider     TEXT,                  -- anthropic|openai|...
    source       TEXT,                  -- 'byok' | 'managed'
    secret_ref   TEXT,                  -- 시크릿매니저 참조 (값 아님)
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: KeySourceResolver가 읽음. BYOK=무차감 / managed=차감.
-- ★실제 키값은 secrets(시크릿매니저), 여기는 참조만.

-- 시크릿 참조 (Infisical/Vault 매핑)
CREATE TABLE secrets (
    secret_ref   TEXT PRIMARY KEY,
    vault_path   TEXT,                  -- Infisical/Vault 경로
    owner_key    TEXT NOT NULL,         -- ★RLS
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: 실제 키값은 외부 시크릿매니저. DB엔 경로만 (L-5 게이트).

-- 연결 (커넥터 — OAuth·MCP 등)
CREATE TABLE connections (
    conn_id      TEXT PRIMARY KEY,
    owner_key    TEXT NOT NULL,         -- ★RLS
    service      TEXT,                  -- 연결 대상
    method       TEXT,                  -- oauth|mcp|iframe|headless
    status       TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: ConnectMethodResolver 폴백. 고객 외부 서비스 연결.


-- ────────────────────────────────────────────────
-- [그룹 7] 공통·운영 (전체)
-- 감사·설정·스케줄.
-- ────────────────────────────────────────────────

CREATE TABLE audit_logs (
    id           BIGSERIAL PRIMARY KEY,
    owner_key    TEXT,
    action       TEXT,
    resource     TEXT,
    changes      JSONB,
    created_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: 모든 중요 행위 기록 (블랙박스 — 소송방어·추적).

CREATE TABLE system_config (
    key          TEXT PRIMARY KEY,
    value        TEXT,
    type         TEXT,
    updated_at   TIMESTAMPTZ DEFAULT now()
);
-- 로직: 시스템 설정 (MAX_RETRY·token_budget·주기 등 dayout 수치).

CREATE TABLE scheduled_tasks (
    task_id      TEXT PRIMARY KEY,
    kind         TEXT,                  -- weekly_eval|audit|health
    next_run     TIMESTAMPTZ,
    last_run     TIMESTAMPTZ
);
-- 로직: 주단위 평가·감사·헬스 스케줄 (evaluator 주1회 등).


-- ============================================================
-- 테이블 수: 36개 (7개 그룹)
--   그룹1 상태테넌트 5 / 그룹2 LLM 7 / 그룹3 문서 5 /
--   그룹4 엣지 4 / 그룹5 실행자가수정 8 / 그룹6 과금키 6 / 그룹7 공통 3
-- ★RLS 적용: records·documents·api_keys·secrets·connections (tenant 격리)
-- 상세 로직: D1~D10 설계서 / DB 구조: 이 파일 (단일 진실)
-- 미정(dayout): VECTOR 차원·플랜 단가·RLS 범위·인덱스 전략
-- ============================================================
