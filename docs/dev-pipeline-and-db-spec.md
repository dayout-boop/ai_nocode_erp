# 두골프 ERP — 개발 파이프라인 결합구조 & 구/신 DB 역할 분리 명세

작성일: 2026-06-10 · 대상: 두골프 ERP/홈페이지(dogolf-tour-dkz3fsmp.manus.space)

---

## 1. Q4 — 중앙 오케스트레이터 / 탈마누스 / 마누스 결합구조 재확인 결과

### 1.1 핵심 결론

중앙 오케스트레이터는 **두 가지 의미로 혼재**되어 있다. 코드를 전수 확인한 결과, "오케스트레이터"라는 이름이 서로 다른 두 계층에 붙어 있어 혼선의 원인이 된다.

| 구분 | 실제 파일/함수 | 역할 | 외부 의존 |
| --- | --- | --- | --- |
| **(A) LLM 채팅 오케스트레이터** | `services/openrouter.ts` → `orchestratorChat()` | 작업 복잡도(SIMPLE/MODERATE/COMPLEX)에 따라 OpenRouter 모델을 라우팅하고 비용을 기록하는 **순수 LLM 호출기**. 마스터/매니저 채팅, 자체 코드생성 등 모든 LLM 호출의 공통 입구. | OpenRouter API |
| **(B) 개발 파이프라인 오케스트레이터** | `services/orchestrator.ts` → `runPipeline()` | LLM이 만든 코드 변경조각(Changeset)을 받아 **dev-1 격리 커밋 → dev-2 병합 → 4종 정합성 감사**까지 수행하고 `ai_dev_requests`에 라이프사이클을 기록하는 **자체 Git 실행 엔진**. | 내장 Git 엔진(GitHub Token) |

즉 (A)는 "무엇을 생성할지", (B)는 "생성된 것을 어떻게 격리·검증·기록할지"를 담당한다. **별도 로직이되 selfDevPipe에서 순차 결합**된다.

### 1.2 탈마누스(self) 모드 실제 흐름

```
MasterAI.tsx (devMode="self")
  └─ handleSendDevRequest → trpc.devRequest.selfDevelop
        └─ devRequest.ts: selfDevelop 프로시저
              [1] devRequests(구 테이블)에 INSERT (source=master_ai, engineType=self, status=in_progress)
              [2] runSelfDevelopment(selfDevPipe.ts)
                    ├─ orchestratorChat(A)  ──→ OpenRouter로 Changeset(JSON) 생성
                    └─ runPipeline(B)       ──→ ai_dev_requests(신 테이블)에 INIT 기록
                                                  → dev-1 격리커밋 → 4종 감사 → 상태 동결
              [3] devRequests 상태 갱신 (completed | pending) + result에 요약 기록
```

- 코드 생성 주체 = **두골프 서버 자신**(OpenRouter 호출). 마누스 API를 경유하지 않는다. → IP 자체 보유 요건 충족.
- Git 엔진 비활성(Token 미설정) 시: 코드생성·메타기록까지만 진행하고 커밋 보류(graceful).

### 1.3 마누스(manus) 모드 실제 흐름

```
MasterAI.tsx (devMode="manus")
  └─ handleSendDevRequest → trpc.devRequest.autoRegisterAndSend
        └─ devRequest.ts: autoRegisterAndSend 프로시저
              [1] AI 분류(invokeLLM) → devRequests(구 테이블)에 INSERT
              [2] manusPipe.ts: 스마트 라우팅(기존 태스크 재사용 vs 신규 생성)
                    └─ Manus API로 개발 태스크 전송, manusTaskId/manusProjectId 기록
              [3] 이후 manusWebhook / manusSync 가 완료 키워드 감지 → status=completed 전환
```

- 코드 생성 주체 = **외부 마누스 에이전트**. `managedProjects`(마누스 프로젝트 매핑)와 연동된다.

### 1.4 개발이력 "3개의 섬" 진단 (확정)

현재 개발이력이 **3곳에 분산**되어 서로 연결되지 않는다:

| 섬 | 테이블/파일 | 기록 주체 | 문제점 |
| --- | --- | --- | --- |
| 섬1: 요청 원장 | `dev_requests` (devRequests) | 마누스·탈마누스 양쪽 요청의 진입점 | 신 엔진 라이프사이클(`ai_dev_requests`)과 ID로 연결되지 않음. `selfDevelop`은 양쪽에 각각 INSERT하나 상호 FK 없음 |
| 섬2: 엔진 라이프사이클 | `ai_dev_requests` + `ai_dev_request_files` + `ai_git_commits` | `runPipeline`/`devLog.recordDevActivity` | `dev_requests.id` 역참조 컬럼이 없어 "이 커밋이 어느 요청의 결과인지" 추적 단절 |
| 섬3: 기능 카탈로그 | `docs/features.json` | 수동/별도 라우터(`features.ts`) | DB 개발이력과 완전 분리. 기능↔요청 매핑 없음 |

**일원화 방향(설계):**
1. `ai_dev_requests`에 `devRequestId int`(구 원장 역참조) 컬럼 추가 → 섬1↔섬2 연결.
2. `selfDevelop`에서 `runSelfDevelopment` 호출 시 `devRequestId`를 파이프라인까지 전파(이미 input에 존재하나 `runPipeline`에 미전달) → 기록 시 함께 저장.
3. `features.json`은 읽기전용 카탈로그로 유지하되, `dev_requests.featureId`(이미 존재)로 기능 매핑을 채워 섬3 연결.

> 이 일원화는 Phase 6 이후 별도 안전 작업으로 분리한다(이번 변경의 핵심은 테넌트 격리·구독관리·2계층 거래처). 단, `ai_dev_requests.devRequestId` 컬럼 추가는 저비용이므로 Phase 3 마이그레이션에 함께 포함 가능.

---

## 2. 구/신 DB 역할 분리 명세 (사용자 결정: "기능·용도가 다른 별도 DB로 분리 관리")

### 2.1 예약 — `reservations`(구) vs `bookings`(신)

| 항목 | `reservations` (구) | `bookings` (신) |
| --- | --- | --- |
| 역할(정본) | **수기예약 ERP의 관리 정본** | **고객 홈페이지 문의 + 통합조회 보조** |
| 주 사용 화면 | `/reservations` 수기예약 화면 | 고객 문의 폼, 통합 예약 조회 |
| 주 라우터 | `reservations.create/list` | `bookings.list` |
| 자금 연결 | 자금 5종(income/remittance/deposit/charge/prepaid)의 **부모** | 없음(문의 단계) |
| 운영 방침 | 유지 — 모든 자금·정산의 관리 기준점 | 유지 — 단, `bookings.list`가 `reservations`를 **무필터로 통합하는 격리 누출 버그** 존재 → tenantId 필터 적용 필요 |

**핵심 원칙:** 두 테이블을 **합치지 않는다**. 각자 역할이 명확하다. 다만 데이터가 섞여 보이지 않도록 `bookings.list`의 reservations 통합부에 테넌트 필터를 적용한다.

### 2.2 자금 5종 — 부모 reservation 승격(사용자 결정 Q2)

`incomeRecords`, `remittanceRecords`, `depositRecords`, `chargeRecords`, `prepaidRecords`는 모두 **부모 reservation에 종속**되어야 한다.

- 현재: 5종 모두 `tenantId` 컬럼 없음 → 업체 선택 시에도 전체 노출.
- 조치: 5종에 `tenantId int default 1` 추가 + 부모 reservation의 tenantId로 백필.
- 승격: 자금 하위항목의 관리 정본은 항상 부모 `reservations` 행이며, 자금 기록 생성/조회 시 부모 reservation의 tenantId와 동기화.

---

## 3. 2계층 권한모델 확정 (사용자 결정 Q3)

### 3.1 마스터 레벨 (두골프 본사 = 테넌트 T1)

| 카테고리 | 내용 | 현재 상태 |
| --- | --- | --- |
| (1-1) 제휴사 통합코드 | 숙소·골프장·관광지·항공·교통 등 **공급원 마스터 코드** | 기존 affiliates 라우터 존재 — 파트너와 **카테고리 혼재** → 분리 필요 |
| (1-2) 파트너 구독관리 | 온보드·분양 업체의 **업체명·접수일·만료일·유료플랜·비고** | **누락** — 화면에 업체명조차 안 보임 → 신규 페이지 필요 |

### 3.2 분양 업체 레벨 (각 테넌트)

| 카테고리 | 내용 | 연결 대상 |
| --- | --- | --- |
| (2-1) 제휴사 개별등록 | 마스터 통합코드를 **검색·재사용** + **자사 호칭** 추가, 없으면 신규 등록 | 상품·예약·정산·요금 |
| (2-2) 파트너 등록 | 자사 거래 여행사·숙소·대리점 | 송금·예약·정산·요금 |

### 3.3 권한 게이트

- `tenantScopedProcedure`(신설): `protectedProcedure` 확장. `ctx.activeTenantId`를 `ctx.tenantId`로 승격. 마스터가 전체보기일 때 `null`(전체), 특정 업체 선택 시 해당 tenantId만 필터.
- `partnerProcedure`(기존): 파트너 세션은 자기 tenantId 강제. 이미 완성.

---

## 4. 이번 작업 적용 순서 (충돌 최소화)

1. **Phase 3** — 자금 5종 tenantId 마이그레이션 + (옵션) `ai_dev_requests.devRequestId` 추가.
2. **Phase 4** — 마스터 구독관리 페이지 + 제휴사/파트너 카테고리 분리.
3. **Phase 5** — 업체용 제휴사/파트너 2계층 등록·검색·재사용.
4. **Phase 6** — `tenantScopedProcedure` 신설 + 예약/자금/정산/문의 일괄 격리 + `bookings.list` 누출버그 수정.
5. **Phase 7** — vitest 테넌트 누출 회귀 테스트 + 체크포인트.

> 원칙: **기존 파일 수정만**, 중복 테이블·중복 파일 금지. 새 테이블은 명확한 필요(2계층 제휴사/파트너)일 때만.
