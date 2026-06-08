# 두골프 서버 완전이전 · 탈마누스 자립 가이드 (STEP5 §2~3)

> 목적: 마누스 구독을 중단하거나 일반 인프라(자체 VPS 등)로 이전했을 때, 두골프 ERP/홈페이지/AI 개발엔진이 **월 10만 원 안팎의 순수 유지비로 무중단 가동**되도록 한다. 외부 SaaS 의존 0, 종량제 LLM 키 교체만으로 영구 구동.

---

## 1. 이전 시 챙길 3가지 (사양 §데이터/Git 완전 이전 지침)

| # | 항목 | 획득 방법 |
|---|---|---|
| 1 | **소스코드 백업본** | GitHub 프라이빗 레포(`dev-1`/`dev-2-integration`/`main`) 그대로. 또는 ZIP 다운로드 |
| 2 | **MySQL DB 덤프** | `node scripts/export-db-dump.mjs` → `backups/dogolf-dump-*.sql` |
| 3 | **.env 비밀키 구성** | 아래 §3 환경변수 표를 새 서버 `.env`로 복제 |

세 파일만 USB 또는 프라이빗 Git 저장소에 담아 이동하면 된다.

---

## 2. 새 서버 기동 (3단계)

```bash
# (1) 소스 클론 + 의존성
git clone <PRIVATE_REPO> dogolf && cd dogolf
pnpm install      # 또는 npm install

# (2) DB 복원
mysql -u <user> -p <dbname> < backups/dogolf-dump-YYYYMMDD-HHmm.sql

# (3) .env 채운 뒤 기동
pnpm build && pnpm start    # 또는 npm run start
```

> Git 엔진·Heartbeat·AI 개발엔진은 모두 Node.js 네이티브 + DB만으로 동작하므로 추가 설치물이 없다.

---

## 3. 환경변수 — 자립 구동 핵심 (사양 §환경변수)

| 변수 | 용도 | 자립 모드 권장값 |
|---|---|---|
| `DATABASE_URL` | MySQL 연결 | 새 서버 DB 주소 |
| `JWT_SECRET` | 세션 서명 | 임의 강력 문자열 |
| `AI_VEND_NEUTRAL_MODE` | 탈벤더 스위치 | `true` (마누스 게이트웨이 우회) |
| `TARGET_LLM_PROVIDER` | LLM 공급자 | `ANTHROPIC` (또는 미지정 시 Gemini 폴백) |
| `ANTHROPIC_API_KEY` | 오너 직결 LLM 키 | 오너 종량제 키 |
| `GEMINI_API_KEY` | Gemini 직결 키(대체) | 오너 종량제 키 |
| `ENGINE_API_KEY` | Changeset 입구 인증 | 임의 강력 토큰 |
| `HEARTBEAT_SECRET_KEY` | 자립 크론 인증 | 임의 강력 토큰 |
| `GITHUB_TOKEN` / `GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME` | 서버 Git 엔진 커밋 주체 | 오너 GitHub PAT |

`AI_VEND_NEUTRAL_MODE=true` + `TARGET_LLM_PROVIDER=ANTHROPIC` + `ANTHROPIC_API_KEY` 세 값이 모두 설정되면, LLM 호출이 마누스 게이트웨이를 거치지 않고 **Anthropic API로 즉시 직결**된다(코드 변경 없이 0.1초 우회). 대시보드 'AI 변경이력·정합성 > 탈마누스 자립전환 상태' 패널에서 현재 모드/준비도/Phase를 실시간 확인할 수 있다.

---

## 4. 자립형 정기 점검 (crontab 한 줄)

마누스/외부 스케줄러 결제가 끊겨도, 일반 Linux crontab으로 영구 자립 구동:

```cron
# 3시간마다 4종 정합성 자가점검
0 */3 * * * curl -s -X POST https://<도메인>/api/scheduled/run-due \
  -H "x-due-heartbeat-token: <HEARTBEAT_SECRET_KEY>"
```

`HEARTBEAT_SECRET_KEY` 미설정 시 엔드포인트는 503(비활성)으로 응답하여 무단 호출을 차단한다.

---

## 5. Phase 1 → 4 자립 로드맵

| Phase | 시스템 상태 | 마누스 역할 | 두골프 자립 범위 |
|---|---|---|---|
| 1 | 마누스 통개발(초기 1~2개월) | 모듈 뼈대 대량 작성(의존 100%) | 파이프라인 빌드 + DB 스키마 정착 |
| 2 | 코드조각 생성 국한(과도기 1개월) | 소스블록 텍스트 생성만 | 서버 Git 엔진 형상관리 독점, API 50%↓ |
| 3 | 수동 승인·오딧 전담(이행기) | 단순 로직 지원(의존 10%↓) | 4종 봇 + Heartbeat 독자 무결성 제어 |
| 4 | 완전 독립 자립(최종 목표) | 전면 차단(구독 취소, 비용 0) | 로컬 셸 + 오너 LLM 키로 무한 구동 |

---

## 6. 무결성 원칙 (변하지 않는 규약)

- **소스 본문 DB 저장 금지**: 커밋 SHA 메타데이터만 MySQL에 인덱싱(테이블 비대화 방지).
- **main 자동 병합 금지**: 4종 정합성 통과 후에도 main 반영은 **오직 마스터 수동 승인 버튼**.
- **AI 결정권 박탈**: 레드팀/오딧은 비판·판정만 하며 코드 수정·병합 권한 없음.
- **키 원문 비노출**: 자립전환 상태 API는 설정 여부(boolean)만 반환, 키 원문은 절대 출력하지 않음.
