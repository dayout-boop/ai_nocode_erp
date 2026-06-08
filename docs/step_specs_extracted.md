# 두골프 v3 단계별 상세 사양 (마스터 제공 PDF 추출)

## STEP 1 — 서버 내장 Git 엔진 + 변경이력 가시화 + 메타데이터 스키마

### 1. 착수 매개변수/아키텍처 확정
- 브랜치 명명: `main`(최상위 진실원천) / `dev-1`(개별 외부 에이전트·마누스 산출 임시 격리) / `dev-2-integration`(병렬 작업을 main 결합 전 수집·검증, 삼중 확정)
- 구현 기술: 서버 내부에 git 바이너리 설치·제3자 라이브러리(isomorphic-git 등) 전면 배제. Node.js 네이티브 Fetch API로 **GitHub REST API 직접 호출** 방식. 런타임 의존성 0.
- 자기점검 1차 깊이: 외부 LLM 호출/비용 없이 무료 고속, "구조 정합성(구문오류, 아키텍처 침범 방지)" 정적 스캔만.
- 정기 트리거: 구조 정합성 매 3시간, 전체 종합 점검 매일 1회(새벽).

### 2. 서버 내장 Git 엔진 파이프라인 아키텍처
- 마누스는 GitHub 레포 직접 Push/Merge 권한 없음. 수정/생성된 소스 조각을 서버 엔진에 전달하는 '텍스트 가공 수행자'. 서버가 GitHub REST API 주체.
- 2.1 통신/인증: 환경변수 `GITHUB_TOKEN`(Fine-grained PAT, Contents: Write 필수) 독립 캡슐화. 토큰 외부 도구 노출 금지. HTTP Header:
  - `Authorization: Bearer ${process.env.GITHUB_TOKEN}`
  - `Accept: application/vnd.github+json`
  - `X-GitHub-Api-Version: 2022-11-28`
- 2.2 REST 트랜잭션 시퀀스 (runAgent 단일 라우터가 코드 반환 → dev-1에 push):
  1. 최신 커밋/Tree SHA 획득: `GET /repos/{owner}/{repo}/git/ref/heads/dev-1` → `GET /repos/{owner}/{repo}/git/commits/{commit_sha}`로 루트 Tree SHA
  2. 신규 파일 Blob 생성: `POST /repos/{owner}/{repo}/git/blobs` (반환 blob_sha 수집, 바이너리는 Base64 인코딩)
  3. 새 Tree 구축: 루트 Tree SHA + 신규 blob_sha 결합 `POST /repos/{owner}/{repo}/git/trees` (path 지정)
  4. 커밋 오브젝트 생성: `POST /repos/{owner}/{repo}/git/commits` (신규 Tree SHA + 부모 커밋 SHA=dev-1 최신, 커밋 메시지)
  5. 브랜치 Ref 업데이트: `PATCH /repos/{owner}/{repo}/git/refs/heads/dev-1` (sha 주입, `force: false` 강제로 안전 영도)
- 핵심 예외: 네트워크/API 장애로 트랜잭션 중 예외 시 → 서버 엔진 즉시 DB 메타 상태를 `FAIL`로, 메모리 코드 소스를 서버 로컬 백업 `/var/backup/ai_code/`에 파일로 격리 덤프. 마누스 연결 끊겨도 코드 영속 보존.

### 3. DB 메타데이터 스키마 (소스 본체 문자열 전문 DB 적재 금지, Diff는 Git 고유도메인)
- DB = '오케스트레이션 메타데이터 인덱스 머신'. Drizzle ORM 엄격 규격 선언.

#### 3.1 `ai_dev_requests` (에이전트 개발요청·상태 추적 마스터 테이블)
```sql
CREATE TABLE `ai_dev_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `agent_id` varchar(50) NOT NULL COMMENT '요청 수행 에이전트 식별자 (master/manager/golftalk)',
  `source_branch` varchar(100) NOT NULL DEFAULT 'dev-1',
  `target_branch` varchar(100) NOT NULL DEFAULT 'dev-2-integration',
  `status` enum('INIT','CODE_GENERATED','INTEGRITY_PASSED','INTEGRITY_FAILED','INTEGRATED','MASTER_APPROVED','MASTER_REJECTED') NOT NULL DEFAULT 'INIT',
  `error_message` text NULL COMMENT '정합성 실패 또는 API 연동 실패 시 원인 레포트',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 3.2 `ai_dev_request_files` (변경 파일 메타 통계 — Diff 문자열 미저장)
```sql
CREATE TABLE `ai_dev_request_files` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `request_id` bigint unsigned NOT NULL,
  `file_path` varchar(500) NOT NULL COMMENT '수정된 파일의 상대 경로',
  `change_type` enum('ADD','MODIFY','DELETE') NOT NULL,
  `additions` int unsigned NOT NULL DEFAULT '0' COMMENT '추가 라인 수 통계',
  `deletions` int unsigned NOT NULL DEFAULT '0' COMMENT '삭제 라인 수 통계',
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_req_files_request_id` FOREIGN KEY (`request_id`) REFERENCES `ai_dev_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 3.3 `ai_git_commits` (GitHub 커밋 연동 메타)
```sql
CREATE TABLE `ai_git_commits` (
  `commit_sha` varchar(40) NOT NULL,
  `request_id` bigint unsigned NOT NULL,
  `author_name` varchar(100) NOT NULL DEFAULT 'DuGolf-Server-Engine',
  `commit_message` varchar(1000) NOT NULL,
  `committed_at` datetime NOT NULL,
  PRIMARY KEY (`commit_sha`),
  CONSTRAINT `fk_git_commits_request_id` FOREIGN KEY (`request_id`) REFERENCES `ai_dev_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4. 1차 구조 정합성 자가점검(Self-Audit) 봇 — 4대 규칙 (외부 LLM 0)
- 규칙1 JS/TS 컴파일러 기반 구문 무결성: `tsc --noEmit` 또는 `eslint`를 API 팩토리로 구동, 구문오류 1차 판별.
- 규칙2 아키텍처 경계선·보안 침범 스캔: 정규식/AST 파서로 `manager`/`golftalk` 소스 영역에 Core DB 연결 문자열, 유료도구 생성자(`new WebSearchTool()`) 또는 `process.env.GITHUB_TOKEN` 직접 접근 시도 식별·원천 차단.
- 규칙3 의존성 오염 원천 배제: `package.json` 또는 외부 패키지 임포트 구문(`import`/`require`) 변동 감시, 마스터 승인 없이 외부 종속성 추가 시 검사.
- 규칙4 토큰 소모 안전장치(인프라 루프 차단): 동일 파일 단시간 내 3회 이상 반복 수정 커밋 스캔, 무한 루프 추정 시 에이전트 개발 인가 정지.

### 5. 플랫폼 Heartbeat 자립형 트리거 + 마스터 가시성
- 5.1 벤더 중립 Heartbeat 엔드포인트: `POST /api/scheduled/self-audit` 외부 개방, 강력 시크릿 토큰 검증 미들웨어. 플랫폼 웹훅/crontab 등 어떤 수단이든 HTTP 호출만 발생시키면 3시간 단위 정합성 점검 + 매일 새벽 종합 동기화 루프.
- 5.2 마스터 ERP 관리자 화면 'AI 변경 이력 및 정합성 검증 대시보드':
  - [A] 변경 요청 정보 화면(DB 영역 호출): 유료 LLM 호출 없이 `ai_dev_requests`/`ai_dev_request_files` 인덱싱하여 수정일자·파일목록·정합성 패스여부 0.01초 고속 출력.
  - [B] 소스코드 Diff 화면(Git API 영역 호출): '소스 보기' 버튼 클릭 온디맨드 시점에만, `ai_git_commits`의 commit_sha 기반 `GET /repos/{owner}/{repo}/commits/{ref}` 호출하여 Diff만 실시간 받아 렌더. DB 용량 비대화 원천 차단.


---

## STEP 2 — 어시스턴트 역할 및 외부 경계선 셋업 (4창구·단일엔진 runAgent)

### 1. 단일 엔진 함수 시그니처 (TypeScript 표준 규격)
```ts
interface AgentContext {
  callerId: string;       // 호출자 고유 식별자 (마스터ID / 파트너ID / 고객ID)
  partnerId?: string;     // manager 및 golftalk 호출 시 강제 구속되는 파트너 ID
  role: 'MASTER' | 'MANAGER' | 'GOLFTALK' | 'SYSTEM';
}
interface AgentResponse {
  success: boolean;
  responseTexts: string;  // 최종 가공된 순수 텍스트 답변
  tokensUsed: number;     // 실행에 소모된 트래킹용 토큰 수
  error?: string;
}
async function runAgent(
  agentId: 'master_engine' | 'manager_engine' | 'golftalk_engine' | 'assistant_engine',
  prompt: string,
  context: AgentContext
): Promise<AgentResponse>
```

### 2. 물리적 외부 경계선(Boundary) + 도구 격리 — 에이전트별 Toolset
| 에이전트 ID | 권한계층 | 주입 도구(Toolset) 범위 | 비용 방어 메커니즘 |
|---|---|---|---|
| master_engine | MASTER(마스터) | `web_search`, `fetch_url`, `read_core_db`, `execute_git_engine` | 최종 승인자 전용 채널로 전체 자원 접근 허용 |
| manager_engine | MANAGER(입점사) | `read_service_db`, `write_service_db` (외부도구 주입 원천 차단) | 실시간 웹검색 및 외부 API 차단으로 고정비화 |
| golftalk_engine | GOLFTALK(고객용) | `read_service_db`, `generate_text_reply` (외부도구 원천 차단) | 트래픽 폭주 시 외부 API 호출비용 파급효과 0%로 차단 |
| assistant_engine | SYSTEM(내부처리) | `read_service_db`, `file_cache_reader` | 내부 크론 및 정적 파일시스템 데이터 연동만 허용 |

### 2.2 도구 인스턴스화 차단 코드 로직 (팩토리 하드코딩 게이트)
```ts
class AgentEngineFactory {
  static createLLMClient(role: string, partnerId?: string) {
    const baseOptions: any = { model: "gemini-2.5-flash", temperature: 0.2 };
    // 오직 마스터 계층에만 외부 결합 도구 주입 인가
    if (role === 'MASTER') {
      baseOptions.tools = [
        { googleSearch: {} },
        { name: "fetch_url_content", description: "외부 URL의 원문 텍스트를 크롤링" }
      ];
    } else {
      // manager, golftalk은 도구 배열 자체를 빈 값으로 동결하여 외부 호출 원천 방어
      baseOptions.tools = [];
    }
    return baseOptions;
  }
}
```

### 3. partner_id 강제 세션 잠금(Locking) 및 데이터 격리
- 하나의 Service DB 공유 아키텍처(2번 고객용 골프톡 + 3번 입점 매니저 단일 DB 스키마)에서 데이터 오염·타 입점사 정보 노출 사고 원천 방지. AI 에이전트가 생성하는 모든 SQL 쿼리에 호출자 세션의 `partner_id` 강제 바인딩.
- 3.2 SQL 인젝션·범위 침범 방지 프록시 (Drizzle ORM):
```ts
function getServiceDBProxy(context: AgentContext) {
  if (context.role !== 'MASTER' && !context.partnerId) {
    throw new Error("보안 위반: 파트너 컨텍스트 식별자가 존재하지 않습니다.");
  }
  return {
    getProducts: async () => {
      if (context.role === 'MASTER') {
        return await db.select().from(products); // 마스터는 전역 조회 허용
      }
      // 매니저 및 골프톡은 본인 계정에 속한 상품 데이터만 접근
      return await db.select().from(products).where(eq(products.partnerId, context.partnerId!));
    }
  };
}
```
- 데이터 잠금/에러 처리 필수 규정: manager_engine/golftalk_engine 내부 연산 중 partner_id 불일치하는 타 입점사 식별자나 원본 DB 테이블 명칭이 감지되면 즉시 내부 예외 발생 + 해당 요청 세션 즉시 차단(Drop).

### 4. 2단계 검증 파이프라인 연계
- 2단계 셋업이 완료되면 1단계 `ai_dev_requests` 메타 테이블의 에이전트 소스(agent_id) 필드와 유기적 연계 → 창구별 실시간 인터랙션 로그를 인덱싱. 마스터 관리자 UI 대시보드에서 어떤 창구(골프톡/매니저)에서 얼마나 트래픽·컨텍스트 연산이 비용 누수 없이 안전 스케줄링되는지 투명성 확보.


---

## STEP 3 — 3-Git 다중개발 및 서버 자립 엔진 (마누스↔Git 원천 분리)

마누스가 직접 형상관리 저장소에 커밋 푸시하는 행위 완전 배제. ERP 서버가 완전 중계 주체: dev-1(병렬 산출) → dev-2-integration(통합·검증) → main(운영 승인 병합).

### 1. 마누스 ↔ Git 원천 분리 인터페이스
- 마누스 개발 환경은 실제 GitHub 레포에 물리적 접근/Push 권한 없음. 마누스는 소스코드 상에서 생성/가공한 '소스코드 변경조각(Changeset Payload)'을 ERP 서버 내장 입구 API로 토스하는 역할만.

#### 1.1 서버 수신 Changeset API 명세 (인메모리 버퍼 수신용)
```
POST /api/v1/engine/git/changeset
Content-Type: application/json

{
  "devRequestId": 10294,            // 1단계 ai_dev_requests 테이블 연동 식별자
  "commitMessage": "feat(golftalk): 고객 골프장 정보 실시간 DB 프록시 연동 파이프 구축",
  "files": [
    {
      "filePath": "src/modules/golftalk/proxy.ts",
      "action": "MODIFY",          // ADD | MODIFY | DELETE
      "content": "export async function getIsolatedData()..." // UTF-8 또는 Base64 문자열 전문
    }
  ]
}
```

### 2. 브랜치별 계층 구조 및 역할
- `dev-1` (병렬 개발 샌드박스): 각 외부 에이전트·마누스가 생성한 날것의 변경조각이 step1 서버 Git 엔진으로 즉시 커밋 적재되는 격리 브랜치. 충돌 최소화 위해 각 요청 번호별 하부 가상 가지 커밋 트리로 정합 관리.
- `dev-2-integration` (통합·자동화 검증): dev-1 개별 변경을 하나로 모아 기계적 정합성 테스트 + 전체 시스템 컴파일 정적 빌드 수행 스테이징 브랜치.
- `main` (운영 진실원천): 두골프 서비스 실제 구동 무결성 본체. 시스템 자동 변경/직접 커밋 법적으로 전면 봉쇄, **오직 마스터(대표님)의 수동 버튼 승인(인가 승인)**에 의해서만 dev-2-integration으로부터의 Pull Request가 병합(Merge)되는 구조.

### 3. 브랜치 자동 통합·충돌 제어 로직 (GitHub REST API 기반)
정기 Heartbeat 트리거(3시간 주기)가 발동할 때 dev-1 커밋들을 dev-2-integration으로 기계적 병합:
1. 브랜치 최신 동기화: dev-2-integration 최신 커밋 확보 후 `POST /repos/{owner}/{repo}/merges` API 호출 (`base: "dev-2-integration"`, `head: "dev-1"`)
2. 정상 병합 성공(201 Created / 204 No Content): ai_dev_requests 상태 값을 `INTEGRATED`로 갱신 후 다음 단계(step4: 자기점검 루프) 토스
3. 물리적 병합 충돌(409 Conflict): 자동 병합 즉시 중단. 충돌 발생 파일 목록을 GitHub REST API 응답에서 파싱·추출 후 DB 메타데이터 오류 필드 바인딩, 상태 `INTEGRITY_FAILED`로 롤백 덤프.
- 충돌 제어 최상위 규정 (자동 병합 금지): 충돌 발생 시 AI 모델(마누스 포함)이 임의로 코드 판단·난도질·강제 병합(Force Merge) 영구 금지. 충돌 이력은 마스터 대시보드 TODO 레이어로 시각화, 오직 대표님 수동 코드 선택/반려 처리로만 해결.

### 4. 2단계 검증 게이트 결합 및 물리 구조 셋업
| 검증단계 | 가동 시점 | 물리 인프라 실행환경·검증도구 | 비용 지출 속성 |
|---|---|---|---|
| 1차 기계적 게이트 | 3시간 정기 Heartbeat 구동 시 자동 | 두골프 가상서버 내부 Node.js 환경. `vitest`, `tsc --noEmit` 이용한 구문·정적 무결성 스캔 | 0원(무료), 외부 LLM 호출 안 함 서버 자원만 |
| 2차 실사용 게이트 | dev-2-integration 병합 완료 후 최종 마스터 승인 직전 | 프리뷰 스테이징 컨테이너 환경 가동. 실제 마스터 브라우저 접속을 통한 최종 정합성 육안 스캔 | 임시 컨테이너 구동 비용만 미미하게 발생 |

#### 4.2 1차 기계적 게이트 연동 테스트 자동화 스크립트 (integrity-checker.sh)
```bash
#!/bin/bash
echo "[INFO] 1차 기계적 게이트 검증 가동"
npm run test:syntax
if [ $? -ne 0 ]; then echo "[ERROR] 구문 오류(Syntax Error) 탐지됨."; exit 1; fi
npx vitest run --dir src/modules/integrity
if [ $? -ne 0 ]; then echo "[ERROR] 비즈니스 로직 테스트 실패."; exit 1; fi
echo "[SUCCESS] 1차 기계적 정합성 무결성 패스"
exit 0
```

### 5. 1-2단계 메타데이터 레이어 정밀 동기화
- 3단계 브랜치 파이프라인 커밋이력·병합상태 로그는 step1 `ai_git_commits` 및 `ai_dev_requests`의 status(Enum)와 밀접 매핑되어 실시간 동기화. "어떤 에이전트 소스(2단계) → 어떤 파일·어느 브랜치에 묶여 검증 중(3단계)"이 마스터 ERP 가시성 통제 구역에 종속.


---

## STEP 4 — 자기점검 루프 및 필터링 셋업 (독자 4종 정합성 Self-Audit + 레드팀)

### 1. 독자적 4종 정합성 셀프오딧 봇 (외부 유료 LLM 비용 0, 서버 내부용 정적 교차 무결성)
dev-2-integration 통합 브랜치 대상 소스코드 파싱·DB 상태 양방향 크로스 스캔.
1. **DB ↔ 코드 정합성**: 2단계 단일 DB 설계 근거, 소스코드 내 테이블 쿼리문 구조가 MySQL/Drizzle 스키마 메타데이터에 실존 테이블/컬럼인지 정적 분석, 불일치 발견 시 즉각 드롭.
2. **API ↔ UI 인터페이스 정합성**: 2단계 규격화된 단일 공통 라우터 `runAgent` 입출력 엔드포인트 명세 스펙이 프론트엔드 창구(골프톡/매니저) 연동 규격 파라미터 필드와 완벽 일치하는지 규격 정합성 검증.
3. **기능 카탈로그 ↔ 실제 동작 정합성**: 기획 문서 지정 요구 기능 목록 카탈로그 대비, 실제 생성 소스코드 파일 시스템 연동 구현 핸들러가 물리적으로 매핑 매칭되어 작동하는지 누락 여부 스캔.
4. **AI 도구 ↔ 내부 핸들러 정합성**: 2단계 외부 경계선 설정 규칙 온전 유지 검증 핵심 보안 필터링. manager_engine/golftalk_engine 내부 소스코드에서 외부 웹검색/비인가 API 라이브러리 인스턴스화·도구 편법 주입 시도가 숨겨져 있는지 AST(추상 구문 트리) 토큰 파싱 통해 실시간 검출.

### 2. 분석·레드팀 교차 검증 파이프라인 (모델 분리 구조)
1차 기계 정적 스캔 패스했으나 비즈니스 로직 모순·아키텍처 규율 우회 리스크 의심될 때 선택 개입하는 '비용 통제형 레드팀 검증' 모델 분리 구조.
- 2.1 레드팀 교차 분석 메커니즘:
  1. 코드 생성한 마누스/외부 개발 에이전트와는 **완전히 독립된 물리적 경량 모델(예: Gemini 2.5 Flash 격리 인스턴스)**을 독립 검증 모델(레드팀 오딧터)로 호출.
  2. 이 레드팀 모델은 소스코드 변경 권한 완전 박탈('손'의 역할 박탈), 오직 dev-1 → dev-2-integration 커밋 로그·v3 설계 문서 입력받아 "변경 의도가 보안 규율·설계 방향성과 모순되지 않는가?"에 대한 **정밀 비판 보고서(교차 분석 근거 문서)**만 작성하는 독자 영역.

### 2.2 AI 결정권 박탈 및 마스터 수동 인가 연동 규격
레드팀 AI 포함 그 어떤 지능형 모듈도 운영 브랜치(main)에 대한 최종 커밋 병합·배포 승인 버튼 직접 호출 불가.
```ts
async function processAuditResult(requestId: number, auditReport: AuditReport) {
  if (!auditReport.isPerfect) {
    // 정합성 오류나 레드팀 위험 탐지 시 즉시 실패 마킹 및 알림
    await db.update(aiDevRequests)
      .set({ status: 'INTEGRITY_FAILED', errorMessage: auditReport.reason })
      .where(eq(aiDevRequests.id, requestId));
    return;
  }
  // 모든 기계 검사·교차 분석 통과해도 자동으로 main에 merge 안 하고,
  // 오직 마스터의 수동 최종 수락 버튼 입력을 대기하는 'INTEGRITY_PASSED' 상태로 동결 잠금
  await db.update(aiDevRequests)
    .set({ status: 'INTEGRITY_PASSED' })
    .where(eq(aiDevRequests.id, requestId));
  // 마스터 ERP 알림 및 TODO 관리 벨트로 레이어 토스
  await pushToMasterTodoDashboard(requestId, auditReport.summaryReport);
}
```

### 3. 벤더 중립적 Heartbeat 정기 트리거 엔진 (자립형 크론)
- 3.1 표준 HTTP 엔드포인트 핸들러 (Node.js/Express 호환): `POST /api/scheduled/run-due` 표준 RESTful 주소 노출, 내부 타이머 파이프 격리 가동. 외부 유료 외부 툴이나 인프라 스케줄러 결제 중단되더라도 일반 Linux 리눅스 표준 `crontab`으로 `curl -X POST https://.../run-due` 한 줄 등록하면 영구 자립 구동.
```ts
router.post('/api/scheduled/run-due', async (req, res) => {
  const secureToken = req.headers['x-due-heartbeat-token'];
  // 환경변수 저장 자립형 시크릿 비밀키 검증으로 무단 호출 차단
  if (secureToken !== process.env.HEARTBEAT_SECRET_KEY) {
    return res.status(401).json({ success: false, reason: "비인가 호출" });
  }
  try {
    // 3시간 주기 구조 정합성 정적 스캔 봇 구동
    const auditEngine = new SelfAuditBot();
    const pendingRequests = await db.select().from(aiDevRequests).where(eq(aiDevRequests.status, 'INIT'));
    for (const req of pendingRequests) {
      await auditEngine.executeFourLayerScan(req.id);
    }
    return res.status(200).json({ success: true, processedCount: pendingRequests.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
```

### 4. 1~3단계 아키텍처 레이어 종합 데이터 맵핑
| 오딧 실행 결과 | 1단계 테이블 적용(상태 필드) | 3단계 Git 브랜치 제어 액션 | 대표님 ERP 대시보드 표출(TODO 레이어) |
|---|---|---|---|
| 구문/도구 오염 검출 실패 | status = 'INTEGRITY_FAILED' 로깅 | 자동 통합 중단 및 dev-1 상태 롤백 덤프 | 🔴 [즉시 조치 요구] 보안 경계선 침범 파일 경로 표시 및 코드 수정 반려 알림 |
| 4종 정합성 완벽 패스 | status = 'INTEGRITY_PASSED' 고속 갱신 | dev-2-integration에 안전 병합 안착 후 잠금 | 🟢 [코드 승인 대기] 외부 비용 소모 0원 안전 검증 완료, "운영서버(main) 반영 승인" 버튼 활성화 |
- 지출 비용 0원으로 묶은 채 기계적 무결성·보안 필터링 100% 검증되어 승인 단추만 누르면 main에 즉시 무중단 반영되는 안전 자립형 자동화 벨트의 독점적 제어권을 마스터가 영위.


---

## STEP 5 — 오케스트레이션 최종 통합 + 점진적 탈마누스 로드맵 (100% → 0% 의존)

### 1. 1~4단계 모듈 통합 End-to-End 오케스트레이션
서버 코어 내부에서 전 단계 모듈을 스케줄링·상태머신으로 안전 이행하는 통합 엔진.
```ts
interface OrchestrationState {
  requestId: number;
  agentId: string;
  currentStage: 'INBOUND_REQUEST' | 'CODE_SANDBOX' | 'GIT_COMMITTED' | 'INTEGRATION_TEST' | 'AUDIT_LOCK' | 'MAIN_DEPLOYED';
  integrityStatus: 'PENDING' | 'SUCCESS' | 'FAILED';
}

class DueGolfEngineOrchestrator {
  // 1단계~4단계 프로세스를 무중단 연속 가동시키는 핵심 파이프라인
  async runPipeline(agentId: string, rawPrompt: string, callerContext: any): Promise<OrchestrationState> {
    // [Stage 1] 2단계 외부 경계선 및 표시 세션 잠금 가동
    const secureContext = await securityBoundaries.enforceContext(callerContext);
    // [Stage 2] 단일 핵심 라우터를 통한 코드 변동 조각(Changeset) 유도
    const changesetPayload = await runAgent(agentId, rawPrompt, secureContext);
    // [Stage 3] 1단계 DB 메타테이블 생성 및 라이프사이클 레코드 생성
    const devRequest = await db.insert(aiDevRequests).values({ agentId, status: 'INIT' }).returning();
    const requestId = devRequest[0].id;
    // [Stage 4] 1단계 및 3단계의 서버 내장 Git 엔진 가동 -> dev-1 브랜치 강제 격리 커밋 적재
    const commitSha = await serverGitEngine.pushToDev1(requestId, changesetPayload);
    // [Stage 5] 3시간 주기 또는 즉시 강제 3-Git 자동 통합 실행 -> dev-2-integration 브랜치 병합
    const isMerged = await serverGitEngine.mergeToIntegration(requestId);
    if (!isMerged) { throw new Error("3-Git 파이프라인 통합 실패: 물리적 충돌 이력 발생 (TODO 레이어 이관)"); }
    // [Stage 6] 4단계 독자적 4종 정합성 셀프오딧 봇 호출 및 레드팀 교차 검증 자동 가동
    const auditBot = new SelfAuditBot();
    const auditResult = await auditBot.executeFourLayerScan(requestId);
    if (auditResult.isPerfect) {
      await db.update(aiDevRequests).set({ status: 'INTEGRITY_PASSED' }).where(eq(aiDevRequests.id, requestId));
    } else {
      await db.update(aiDevRequests).set({ status: 'INTEGRITY_FAILED', errorMessage: auditResult.reason }).where(eq(aiDevRequests.id, requestId));
    }
    return {
      requestId, agentId,
      currentStage: auditResult.isPerfect ? 'AUDIT_LOCK' : 'INTEGRATION_TEST',
      integrityStatus: auditResult.isPerfect ? 'SUCCESS' : 'FAILED'
    };
  }
}
```

### 2~3. 점진적 의존도 감소·탈마누스(Decoupling) 로드맵 (§10)
| 단계 | 시스템 상태 | 마누스 플랫폼 역할·가동 범위 | 두골프 가상서버 자립 범위·비용 속성 |
|---|---|---|---|
| Phase 1 | 마누스 통개발 단계(초기 1~2개월) | 인프라 아키텍처 가이드라인·모듈 뼈대 소스코드 대량 작성(의존도 100%) | 1~4단계 인프라 파이프라인 물리 빌드 및 DB 메타 스키마 정착 기간(월 고정 인프라비만 발생) |
| Phase 2 | 코드 조각 작성 국한 단계(과도기 1개월) | 저장소·파이프라인 제어 권한 완전 박탈. 오직 독립 소스코드 블록(텍스트) 생성자 가동만 | 서버 내장 Git 엔진이 완벽 정착하여 형상관리 독점 주도화. 마누스 API 호출 빈도 50% 절감 |
| Phase 3 | 수동 승인·오딧 전담 단계(자립 이행기) | 단순 복잡 기능 로직 구현 지원(의존도 10% 미만 수렴) | 4종 정합성 자가점검 봇과 표준 HTTP Heartbeat 트리거가 독자적으로 백업 스캔·무결성 제어 주도 |
| Phase 4 | 완전 독립 자립 단계(최종 도달 목표) | **전면 영구 차단(구독 취소 / 비용 0원)** | 로컬 셸 스크립트 및 두골프 소유 고유 LLM API 키(종량제 몇 만 원 수준) 교체만으로 **무한 구동** |

### 3.1 마누스 결제 중단 시 0.1초 이행 완전 자립 전환 프로토콜
- 환경변수 `AI_VEND_NEUTRAL_MODE` 스캔하여 마누스 게이트웨이 건너뛰고 OpenAI/Anthropic 또는 자체 오픈소스 LLM 호스팅 서버 API로 호출 파이프라인을 온디맨드 즉시 우회 결합.
```ts
// 서버 내장 탈벤더 스위칭 인터페이스
import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
class NeutralLLMClientFactory {
  static async fetchResponse(prompt: string, context: any) {
    // 만약 마누스 결제를 멈추거나 서버를 일반 인프라로 긴급 이전했을 때 작동하는 스위치
    if (process.env.AI_VEND_NEUTRAL_MODE === 'true') {
      // 오너가 들고 이전한 독자적 LLM API 키로 0.1초 만에 우회 이행
      if (process.env.TARGET_LLM_PROVIDER === 'ANTHROPIC') {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await anthropic.messages.create({ model: "claude-3-5-sonnet-20241022", max_tokens: 4000, messages: [{ role: "user", content: prompt }] });
        return msg.content[0].text;
      } else {
        // 기본 탐재형 고성능 Gemini API 다이렉트 호출 레이어 결합
        return await nativeGeminiFetcher.callDirect(prompt, process.env.GEMINI_API_KEY);
      }
    }
    // 초기 과도기용 마누스 종속 런타임 통로 (Phase 1-2 전용)
    return await manusGateway.execute(prompt);
  }
}
```

### 데이터베이스 및 Git 저장소 완전 이전 지침
- 서버 이전 시 가상서버 백업본 파일, MySQL DB 덤프 SQL문 파일, `.env` 비밀키 구성 파일 세 가지만 USB나 프라이빗 Git 저장소에 담고 이동. 새 서버 환경에서 `npm install && npm run start` 한 줄로 전체 상담·개발 모듈이 월 10만 원 안팎 순수 유지비로 무중단 무한 가동.

### 4. 1~5단계 전체 수직 데이터 통합 무결성 체계 명세
- 입구 계층(2단계): 고객용 골프톡·매니저 창구의 외부도구 무단 주입을 물리 차단, partner_id 세션을 안전하게 락 처리.
- 수행 계층(3단계): 마누스에게서 코드 저장소 직접 접근권 차단, 서버 중심 안전 격리 브랜치 dev-1에 변경 소스코드 커밋 적재.
- 동기 계층(1단계): 소스코드 본체 전문 DB에 절대 저장 안 함 무결성 원칙으로 커밋 SHA 메타데이터 인덱스만 MySQL 테이블에 가볍게 누적 기록.
- 검증 계층(4단계): 3시간마다 크론 웹훅으로 깨어나는 자립형 셀프오딧 봇이 외부 비용 0원으로 4종 정합성 기계 스캔, AI 결정권 완전 박탈한 채 마스터 수동 승인 단추를 동결 대기.
- 이행 계층(5단계): 오케스트레이터가 전 과정 단일 상태 파이프라인으로 트래킹, 마누스 구독 해지 시 0.1초 만에 순수 네이티브 API 키 직접 결합 체계로 무중단 우회 전환.

### 신규 환경변수 정리 (step4~5)
- `HEARTBEAT_SECRET_KEY` : self-audit / run-due 엔드포인트 무단호출 차단 토큰
- `AI_VEND_NEUTRAL_MODE` : 'true' 시 마누스 게이트웨이 우회 (탈벤더)
- `TARGET_LLM_PROVIDER` : 'ANTHROPIC' | (기본 Gemini)
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` : 탈벤더용 직결 키 (GEMINI_API_KEY는 이미 존재)
