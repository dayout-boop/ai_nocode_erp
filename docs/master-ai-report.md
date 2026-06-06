# 두골프 마스터 AI — 기술 로직도 및 현황 보고서

**작성일**: 2026년 5월 2일  
**작성자**: Manus AI (두골프 ERP 전담 개발 에이전트)  
**버전**: v1.0  
**대상 시스템**: dogolf-tour-dkz3fsmp.manus.space (두골프 ERP)

---

## 1. 개요 및 목적

본 보고서는 두골프 마스터(Master AI) 채팅 시스템의 현재 기술 구조, 데이터 흐름, 비용 구조, 보안 설계, 그리고 향후 확장 방향을 종합 정리한 문서입니다. 두골프 마스터는 골프투어 여행사 ERP의 핵심 관리 인터페이스로, 자연어 질의를 통해 ERP 데이터를 직접 조회하고, 개발 요청을 자동 감지하여 Manus 개발 에이전트로 전달하는 역할을 수행합니다.

---

## 2. 전체 시스템 아키텍처

### 2.1 3계층 AI 인터페이스 구조

두골프 AI 시스템은 사용자 역할에 따라 3개의 독립 채팅 인터페이스로 구성됩니다.

| 인터페이스 | 대상 | 역할 | DB 접근 범위 |
|---|---|---|---|
| **두골프 마스터 (Master)** | 관리자 (1명) | 전체 프로젝트 감독·개발 요청·분석 | 전체 DB |
| **골프톡 (GolfTalk)** | 고객 | 상품 문의·예약 상담 | 해당 프로젝트 DB만 |
| **두골프 매니저 (Manager)** | 파트너 | 파트너별 예약·정산 관리 | 해당 프로젝트 DB만 |

### 2.2 ERP 카테고리 구조

```
두골프 ERP 사이드바
├── [AI 챗봇]
│   ├── 두골프 마스터 (Master)   ← /admin/master-ai
│   ├── 골프톡 (GolfTalk)
│   └── 두골프 매니저 (Manager)
├── [AI 마스터]
│   └── 마스터 AI 관리            ← /admin/master-ai (설정)
└── [AI 엔진 관리]
    └── AI 엔진 설정              ← /admin/ai-engine
```

---

## 3. 두골프 마스터 기술 로직도

### 3.1 전체 데이터 흐름 (요청 → 응답 파이프라인)

```
사용자 입력 (채팅창)
    │
    ▼
[1] 인증 확인
    JWT 세션 쿠키 검증 → 관리자(admin) 권한 확인
    실패 시: 401/403 반환
    │
    ▼
[2] 입력 검증 (Zod Schema)
    message: 1~2000자
    sessionId: 세션 식별자
    history: 최근 20턴 히스토리
    │
    ▼
[3] 의도 분류 (Intent Classification) — RAG 경량화
    classifyIntent() 키워드 기반 분류:
    ├── needsPackages: 상품/패키지 관련
    ├── needsReservations: 예약/정산 관련
    ├── needsDevRequest: 개발 요청 감지
    └── complexity: low / medium / high
    │
    ▼
[4] RAG 컨텍스트 수집 (필요 시)
    ├── fetchPackageContext(): 활성 상품 최대 3개
    └── fetchReservationContext(): 최근 예약 (PII 마스킹)
    │
    ▼
[5] 히스토리 압축 (compressHistory)
    최근 6턴 유지 + 이전 턴 → 요약 시스템 메시지 변환
    │
    ▼
[6] Tool Calling 루프 (최대 5회)
    orchestratorChat() → OpenRouter API
    ├── 도구 호출 있음 → executeTool() 실행
    │   ├── get_bookings_summary
    │   ├── get_package_list
    │   ├── get_settlement_summary
    │   ├── get_ai_cost_summary
    │   ├── get_dev_requests
    │   ├── get_error_logs
    │   ├── get_customer_info
    │   ├── get_inquiry_summary
    │   ├── get_ai_chat_logs
    │   └── get_system_health
    └── 도구 없음 → 최종 응답 생성
    │
    ▼
[7] 스트리밍 최종 응답 (SSE)
    orchestratorChatStream() → 청크 단위 전송
    event: chunk → 실시간 텍스트 스트리밍
    event: done → 메타데이터 (모델, 토큰, 비용, 소요시간)
    │
    ▼
[8] 개발 요청 자동 감지
    응답 내 ```json { type: "dev_request" }``` 블록 파싱
    → DevRequestCard UI 자동 생성
    │
    ▼
[9] DB 로그 저장 (aiLogs 테이블)
    sessionId, userId, role, content, model, tokens, cost
```

### 3.2 개발 요청 → Manus 전송 파이프라인

```
DevRequestCard "스마트 전송" 클릭
    │
    ▼
[A] 태스크 선택 다이얼로그
    ├── AI 추천: analyzeAndRecommendTask() LLM 분석
    ├── 기존 태스크 목록 표시 (manusTaskCandidates DB)
    └── 사용자 선택 또는 신규 생성
    │
    ▼
[B] autoRegisterAndSend()
    ├── 개발 요청 DB 저장 (devRequests 테이블)
    └── smartSendToManus() 호출
    │
    ▼
[C] smartSendToManus() — 스마트 라우팅
    ├── 사용자 선택 태스크 있음 → sendMessageToExistingTask()
    ├── 72시간 내 동일 모듈 활성 태스크 있음 → 재사용 (비용 절약)
    └── 없음 → createNewTask() 신규 생성
    │
    ▼
[D] Manus API 호출
    POST https://api.manus.ai/v2/task.sendMessage
    또는
    POST https://api.manus.ai/v2/task.create
    │
    ▼
[E] 라우팅 결과 저장
    manusTaskId, manusProjectId, manusRoutingType, manusRoutingReason
    → devRequests 테이블 업데이트
    │
    ▼
[F] 완료 감지 (자동)
    detectAndCompleteFromResponse():
    AI 응답 텍스트에서 완료 키워드 감지
    → devRequests.status = 'completed' 자동 업데이트
```

### 3.3 두골프마스터 → 개발 에이전트 파이프라인 (별도)

```
두골프마스터 LLM 채팅
    │
    ▼
POST /api/scheduled/dev-request
    │
    ├── 인증: app_session_id 쿠키 검증
    ├── devRequests DB 저장
    ├── Manus API: task.sendMessage (MANUS_DOGOLF_TASK_ID)
    └── Slack 알림 (선택)
    │
    ▼
이 개발 에이전트 태스크 (hNUzrtQfkbnQkVX9BUZeeM)
    │
    ▼
WebDev 코드 수정 → 배포
```

---

## 4. AI 모델 라우팅 및 비용 구조

### 4.1 복잡도별 모델 매핑

| 복잡도 | 모델 | 용도 | 예상 비용/1K토큰 |
|---|---|---|---|
| **high** | `google/gemini-2.5-pro-preview` | 복잡한 분석, 상세 개발 요청 | ~$0.0035 |
| **medium** | `google/gemini-2.5-flash` | 일반 질의, 정산 분석 | ~$0.0003 |
| **low** | `google/gemini-2.0-flash-lite` | 단순 조회, 분류 | ~$0.0001 |

### 4.2 비용 최적화 적용 현황

현재 시스템에는 다음 비용 절감 메커니즘이 적용되어 있습니다.

**적용 중인 최적화:**
- **RAG 경량화**: 키워드 기반 의도 분류로 불필요한 DB 조회 차단
- **히스토리 압축**: 오래된 대화 턴을 요약 메시지로 압축 (토큰 절약)
- **복잡도 기반 모델 스위칭**: 단순 질의는 저가형 모델로 자동 라우팅
- **Prompt Caching**: 시스템 프롬프트에 캐싱 메타데이터 적용
- **72시간 태스크 재사용**: 동일 모듈 개발 요청 시 기존 Manus 태스크 재사용

**미적용 (향후 도입 권장):**
- 벡터 DB 기반 시맨틱 RAG (현재 키워드 기반)
- 응답 캐싱 (동일 질의 재사용)
- 배치 처리 (다중 파트너 요청 통합)

---

## 5. 보안 설계

### 5.1 인증 및 권한

| 레이어 | 방식 | 적용 범위 |
|---|---|---|
| **세션 인증** | JWT 서명 쿠키 (`app_session_id`) | 모든 API 엔드포인트 |
| **역할 기반 접근** | `role: admin` 확인 | 두골프 마스터 전용 |
| **파이프라인 인증** | 세션 쿠키 (user 레벨 허용) | `/api/scheduled/*` |

### 5.2 개인정보 보호

응답 생성 전 다음 PII 마스킹이 자동 적용됩니다.

- 전화번호: `010-****-5678` 형식으로 마스킹
- 이메일: `us**@example.com` 형식으로 마스킹
- 카드번호: 전체 마스킹

### 5.3 입력 제한

- 메시지 최대 2,000자
- Tool Calling 최대 5회 반복 (무한 루프 방지)
- 히스토리 최대 20턴 (컨텍스트 폭발 방지)

---

## 6. 현재 기능 도구 목록 (10개)

두골프 마스터가 직접 조회 가능한 ERP 데이터 도구입니다.

| 도구명 | 조회 대상 | 주요 반환값 |
|---|---|---|
| `get_bookings_summary` | 예약 현황 | 기간별 건수, 금액, 상태별 분류 |
| `get_package_list` | 상품 목록 | 활성 패키지, 국가, 가격, 재고 |
| `get_settlement_summary` | 정산 현황 | 미정산/완료 금액, 파트너별 집계 |
| `get_ai_cost_summary` | AI 비용 | 모델별 토큰/비용, 기간별 추이 |
| `get_dev_requests` | 개발 요청 | 상태별 목록, 우선순위, 소요시간 |
| `get_error_logs` | 오류 로그 | 최근 에러, 빈도, 심각도 |
| `get_customer_info` | 고객 정보 | 마스킹된 연락처, 예약 이력 |
| `get_inquiry_summary` | 문의 현황 | 미처리/처리 건수, 유형별 분류 |
| `get_ai_chat_logs` | AI 대화 로그 | 세션별 대화 이력, 비용 |
| `get_system_health` | 시스템 상태 | DB 연결, 서비스 상태, 응답시간 |

---

## 7. 테스트 현황

### 7.1 파이프라인 연동 테스트 결과

**2026년 5월 2일 수행된 테스트:**

| 테스트 항목 | 결과 | 비고 |
|---|---|---|
| 두골프마스터 → Manus API task.sendMessage | **성공** | 파이프라인 정상 작동 확인 |
| `/api/scheduled/pipeline-status` 응답 | **성공** | 연결 상태 배지 정상 표시 |
| SSE 스트리밍 응답 | **성공** | 실시간 청크 전송 확인 |
| Tool Calling (DB 조회) | **성공** | 10개 도구 정상 작동 |
| 개발 요청 자동 감지 | **성공** | JSON 블록 파싱 정상 |
| 태스크 선택 다이얼로그 | **성공** | AI 추천 + 수동 선택 |

### 7.2 미완료 / 오류 항목

| 항목 | 상태 | 원인 |
|---|---|---|
| 홈페이지 푸터 저작권 자동화 | **완료** | Footer.tsx DB 연동으로 동적 관리 가능 |
| MasterCosts 데이터 형식 불일치 | **수정 완료** | `getCostSummary` 실제 응답 형식(`rows`, `totalCost`, `totalMessages`)에 맞게 UI 리팩터링, `(costData as any)` 패턴 완전 제거 |
| 이전 대화 이어가기 기능 | **구현 완료** | `loadSessionHistory` 프로시저 추가, 채팅 히스토리 탭에서 원클릭 이어가기 버튼 구현 |

---

## 8. 추천 서비스 및 비용 절감 방향 (2번 요청)

### 8.1 현재 채팅 UI/UX 한계점

현재 두골프 마스터 채팅 인터페이스는 기본적인 텍스트 기반 대화에 최적화되어 있으나, 다음 기능이 부재합니다.

위에 나열된 기능들은 이후 개발 사이클을 통해 대부분 구현 완료되었습니다.

- **파일/이미지 첨부**: 구현 완료 (드래그앤드롭 + S3 업로드, PDF/DOCX/이미지 분석)
- **개발 완료 결과 인라인 표시**: 구현 완료 (완료된 devRequest 결과 카드)
- **AI 엔진 통합 관리 UI**: 구현 완료 (오케스트라/어시스턴트/에이전트 탭)
- **외부 서비스 연결 상태 표시**: 구현 완료 (Slack, DB 연결 상태 패널)
- **슬라이드 패널**: 구현 완료 (우측 슬라이드 패널)
- **이전 대화 이어가기**: 구현 완료 (채팅 히스토리 탭 원클릭 이어가기)

### 8.2 현재 연동 현황 및 향후 개선 방향

| 서비스 | 현황 | 비고 |
|---|---|---|
| **Slack Webhook** | ✅ 구현 완료 | 개발 완료 알림 자동 발송 |
| **Manus API 파이프라인** | ✅ 구현 완료 | 개발 요청 자동 전송, 태스크 선택 다이얼로그 |
| **OpenRouter (AI 라우팅)** | ✅ 구현 완료 | DB 기반 동적 모델 라우팅, 비용 로깅 |
| **S3 파일 스토리지** | ✅ 구현 완료 | 파일 첨부 분석, 이미지 업로드 |
| **n8n 자동화** | ✅ 구현 완료 | 상품 SNS 자동배포 파이프라인 |
| **Pinecone / Qdrant** | 미구현 | 벡터 DB RAG — 향후 토큰 절감 목적 검토 가능 |

### 8.3 1,000개 파트너 확장 시 비용 구조

현재 구조에서 파트너 1,000개 운영 시 예상 문제점과 해결 방향입니다.

**현재 구조의 한계:**
- Manus 크레딧 소모가 파트너 수에 비례하여 선형 증가
- 각 파트너 요청마다 새 태스크 생성 시 크레딧 폭발적 증가
- 컨텍스트 히스토리 관리 부재로 중복 개발 발생

**권장 해결 방향:**
1. **자체 AI 엔진 우선 처리**: Gemini/OpenRouter로 80%의 단순 요청 처리 → Manus는 실제 코드 수정 필요 시에만 호출 (현재 구현 완료)
2. **파트너별 독립 DB 격리**: 테넌트 구조로 파트너 데이터 분리 (현재 단일 DB 유지 결정, 향후 검토)
3. **배치 처리**: 유사한 요청을 묶어 한 번의 Manus 호출로 처리
4. **벡터 DB RAG 도입**: Pinecone/Qdrant 기반 시맨틱 검색으로 토큰 소모 절감 (향후 검토)

---

## 9. 자체 AI 엔진 확장 로드맵 (3번 요청)

### 9.1 목표 아키텍처: 두골프 AI 오케스트레이터

```
사용자 요청 (두골프 마스터 채팅)
    │
    ▼
[오케스트레이터 레이어] — 자체 개발
    ├── 요청 분류 (단순/복잡/개발)
    ├── 캐시 확인 (동일 요청 재사용)
    └── 모델 라우팅
         │
    ┌────┼────────────────┐
    ▼    ▼                ▼
[챗봇]  [어시스턴트]    [에이전트]
 골프톡  두골프마스터    개발 에이전트
 (저가)  (중간)         (Manus, 고가)
    │    │                │
    └────┴────────────────┘
         │
    ▼
[결과 통합 및 저장]
    ├── GitHub 코드 저장
    ├── DB 로그 기록
    └── Slack/알림 발송
```

### 9.2 단계별 구현 계획

| 단계 | 내용 | 예상 크레딧 절감 |
|---|---|---|
| **Phase 1** (현재) | 기본 파이프라인 완성, Tool Calling 10개 | 기준점 |
| **Phase 2** | 파일 첨부 분석, 슬라이드 패널, 이전 대화 이어가기 | 완료 |
| **Phase 3** | 벡터 DB RAG, 시맨틱 검색 | 향후 검토 (추가 30% 절감 예상) |
| **Phase 4** | 자체 오케스트레이터, 배치 처리 | 향후 검토 (추가 20% 절감 예상) |
| **Phase 5** | 파트너별 독립 에이전트 | 장기 로드맵 (1,000개 파트너 지원 목표) |

---

## 10. 결론

두골프 마스터 AI 시스템은 현재 **기본 파이프라인이 완성된 상태**입니다. 사용자 입력부터 ERP DB 조회, Manus 개발 에이전트 전송, 완료 감지까지의 전체 흐름이 작동하고 있습니다.

현재 두골프 마스터 AI 시스템은 **파일 첨부 분석, 슬라이드 패널, 이전 대화 이어가기, AI 능동적 알림, 비동기 스케줄링** 등 주요 기능이 모두 구현 완료된 상태입니다. MasterCosts 데이터 형식 불일치도 수정 완료되어 타입 안전성이 확보되었습니다.

향후 우선 과제는 **벡터 DB 기반 시맨틱 RAG 도입**으로, 이를 통해 토큰 소모를 추가로 절감할 수 있을 것으로 예상됩니다. 1,000개 파트너 확장을 위해서는 자체 AI 오케스트레이터 고도화 및 파트너별 DB 격리 구조 도입이 장기 로드맵으로 검토됩니다.

---

*본 보고서는 2026년 5월 2일 최초 작성 후, 2026년 6월 기준 구현 완료 항목을 반영하여 업데이트되었습니다.*
