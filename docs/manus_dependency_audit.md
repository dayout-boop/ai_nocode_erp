# 두골프 ERP — 마누스 플랫폼 종속성 전수조사 보고서

> 조사 일자: 2026-06-09
> 목적: ERP를 마누스 외부 서버로 이전했을 때 실제로 무엇이 끊기는가를 코드 근거로 전수 식별
> 조사 방법: `forge.manus.im`, `api.manus.ai`, `BUILT_IN_FORGE`, `OAUTH_SERVER_URL`, `manus-storage`, `MANUS_` 키워드 전수 grep + 호출 경로 추적

---

## 1. 종속성 4단계 분류

| 등급 | 의미 |
|---|---|
| 🔴 **HARD** | 마누스 서비스 살아있어야만 동작. 외부 이전 시 즉시 중단 |
| 🟡 **SOFT** | 마누스에 호출하지만 폴백/대체 가능 |
| 🟢 **INDEP** | 이미 마누스 무관. 키만 따라가면 어디서든 동작 |
| ⚪ **STATIC** | 빌드/개발 편의 플러그인. 런타임 무관 |

---

## 2. 전체 종속성 맵 (코드 확인 완료)

### 🔴 HARD — 마누스 살아있어야만 동작 (이전 시 끊김)

| 기능 | 파일 | 호출 대상 | 영향 범위 |
|---|---|---|---|
| **로그인(마누스 OAuth)** | `_core/sdk.ts`, `_core/oauth.ts` | `api.manus.im` (OAUTH_SERVER_URL) | 공개 홈페이지 useAuth 로그인 |
| **LLM(invokeLLM)** | `_core/llm.ts` | `forge.manus.im/v1/chat/completions` | OCR·개발요청AI·파일분석 등 9개 라우터 |
| **파일 스토리지** | `storage.ts`, `_core/storageProxy.ts` | `forge.manus.im/v1/storage/presign` | 모든 업로드 + `/manus-storage/*` 이미지 서빙 |
| **이미지 생성** | `_core/imageGeneration.ts` | forge | `routers.ts` 1곳 |
| **알림(notifyOwner)** | `_core/notification.ts` | `forge.manus.im` WebDevService | 크레딧 알림 등 |
| **구글맵 프록시** | `_core/map.ts` | forge | (현재 페이지 미사용) |
| **웹검색 도구** | `services/masterTools.ts` | `forge.manus.im/v1/search` | 두골프마스터 채팅의 web_search 도구 |
| **마누스 개발파이프** | `services/manusPipe.ts` | `api.manus.ai/v2` | 개발요청 전송 |
| **마누스 동기화** | `services/manusSync.ts` | `api.manus.ai/v2` | Task 상태 5분 폴링 |
| **마누스 Task생성** | `routers/settings.ts`, `scheduledRoutes.ts`, `managedProjects.ts` | `api.manus.ai/v2` | 개발요청 스케줄 |

### 🟢 INDEP — 이미 마누스 무관 (이전해도 정상)

| 기능 | 파일 | 호출 대상 |
|---|---|---|
| **두골프마스터/매니저/골프톡 채팅 (텍스트 생성)** | `masterStream.ts`, `chat.ts`, `ai.ts` | `openrouter.ai` 직결 |
| **OpenRouter 엔진** | `services/openrouter.ts` | `openrouter.ai` 직결 |
| **ERP 마스터/직원 로그인** | `_core/adminAuth.ts` | 자체 DB + bcrypt (마누스 무관) |
| **파트너 구글 로그인** | `routers/partnerGoogleAuth.ts`, `authProxy.ts` | `accounts.google.com` 직결 |
| **API 키 관리** | `erpApiKeyManager.ts` | ERP DB AES-256 암호화 |
| **구글 OAuth 키 관리** | `_core/googleSecretManager.ts` | ERP DB 우선 (Google Cloud 제거 완료) |
| **포트원 결제** | `services/portone.ts` | `api.portone.io` 직결 |
| **Stripe 결제** | `stripe.ts` | `api.stripe.com` 직결 |
| **데이터베이스** | `DATABASE_URL` | TiDB Cloud (AWS, 마누스와 독립 SaaS) |

### ⚪ STATIC — 빌드/개발 편의 (런타임 무관, 배포본에 영향 없음)

| 항목 | 위치 | 비고 |
|---|---|---|
| `vite-plugin-manus-runtime` | `vite.config.ts` | 개발 HMR 전용, 프로덕션 빌드 무관 |
| `vitePluginManusDebugCollector` | `vite.config.ts` | `.manus-logs` 수집, 개발 전용 |

---

## 3. 마스터 3개 질문에 대한 정밀 답변

### Q1. 마누스 API 연결을 ERP 내에서 하면 다른 서버 이전해도 문제없나?

**답: "키를 ERP DB에 넣는 것"과 "마누스 서버에 호출하는 것"은 다른 문제다.**

- ✅ **키(인증정보)를 ERP DB에 저장하면** → 어느 서버로 옮겨도 키는 따라간다. 서버 이전 자체는 문제없음.
- 🔴 **그러나 위 HARD 10개 기능은 여전히 `forge.manus.im` / `api.manus.im` / `api.manus.ai`에 실제 HTTP 호출을 보낸다.** 마누스 서비스가 살아있어야만 동작한다.
- **결론**: 키를 ERP에 넣는다고 종속이 사라지지 않는다. **호출 대상 자체를 마누스 외 경로로 바꾸거나 폴백을 둬야** 진짜 "어디서든 동작"이 된다.

### Q2. 이 3개(invokeLLM/manusPipe/manusSync) 변경 시 두골프마스터/매니저/골프톡에 문제(응답 지연·연동 불가) 생기나?

**답: 텍스트 채팅 자체는 영향 없음(교차검증 완료). 단, 한 가지 예외 발견.**

코드 교차검증 결과:
- `masterStream.ts`, `chat.ts`, `ai.ts` → **invokeLLM / geminiAIService를 전혀 호출하지 않음**. 100% OpenRouter 직결. → **invokeLLM 바꿔도 채팅 응답 속도·연동에 변화 0.**
- `manusPipe`/`manusSync`는 채팅과 코드상 무관 → **영향 0.**

⚠️ **그러나 새로 발견한 예외**: 두골프마스터 채팅의 **`web_search` 도구(웹검색)**는 `forge.manus.im/v1/search`를 사용합니다. 채팅 "대화"는 멀쩡하지만, 마스터가 채팅 중 **웹검색을 시킬 때** 마누스 없으면 그 도구만 실패합니다. (대화 자체는 정상, 검색 결과만 빈값)

### Q3. 기존 방식 + 어디서든 동작, 2개 다 되게 하려면? (추천)

**답: "듀얼 폴백(이중화) + ERP 제공자 선택" — 단, 적용 대상을 LLM 3개에서 HARD 전체로 확장해야 진짜 자립.**

처음 제안(invokeLLM·manusPipe·manusSync 3개)만으로는 부족합니다. 진짜 "어디서든 동작"하려면 아래까지 폴백이 필요합니다:

| HARD 기능 | 1순위(기존) | 폴백(자립) | 우선순위 |
|---|---|---|---|
| invokeLLM | forge | OpenRouter | ★ 높음 (9개 라우터) |
| 웹검색 도구 | forge search | OpenRouter/외부 검색 | ★ 중간 |
| manusPipe/Sync | api.manus.ai | DB 자립 상태관리 | ★ 높음 |
| 파일 스토리지 | forge presign | S3 직결(자체 버킷) | ★ 높음 (업로드/이미지) |
| 이미지 생성 | forge | OpenRouter 이미지/생략 | 낮음 (1곳) |
| 알림 | forge | Slack(이미 보유) | 중간 |
| 로그인 OAuth | api.manus.im | 자체 구글 OAuth(이미 보유) | 중간 |
| 구글맵 | forge | (미사용, 보류) | 없음 |

---

## 4. 추가 발견 리스크 (전체 기능 점검)

1. **파일 스토리지가 가장 큰 숨은 종속**: 단순 LLM뿐 아니라 **모든 파일 업로드와 홈페이지 이미지 서빙(`/manus-storage/*`)이 forge presign에 의존**. 이전 시 이미지가 안 뜨고 업로드가 막힘. → LLM보다 영향이 클 수 있음.
2. **ERP 관리자 세션이 인메모리 Map(`adminSessions`)**: 서버 재시작/다중 인스턴스 시 세션 휘발. 이전·확장 시 로그인 풀림. → DB 세션 또는 JWT로 전환 권장(이전과 직결되는 구조적 약점).
3. **로그인 OAuth는 공개 홈페이지(useAuth)만 마누스 의존**, ERP 관리자 로그인은 이미 자체 DB. 파트너는 자체 구글. → 영향이 생각보다 작음.

---

## 5. 권장 실행 순서 (마스터 확인 필요)

1. **LLM 듀얼 폴백** (invokeLLM → forge 실패 시 OpenRouter) + ERP 키 DB 연결
2. **파일 스토리지 폴백** (S3 직결 옵션) — 영향 큼, 우선순위 상향 권장
3. **manusPipe/manusSync DB 자립 폴백**
4. **웹검색·알림 폴백** (Slack 이미 보유)
5. **ERP 설정에 제공자 선택 UI**
6. (선택) 관리자 세션 DB화 — 구조 안정성
