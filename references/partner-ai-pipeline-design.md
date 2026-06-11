# 파트너자동화AI 상품 자동생성 파이프라인 — 설계 문서

> 작성일: 2026-06-12
> 상태: 설계 확정 (1단계 개발 대기)

---

## 용어 정의

| 용어 | 설명 |
|------|------|
| **테넌트(Tenant)** | 두골프 ERP를 사용하는 각 파트너사. 두골프 본사도 테넌트1로 동일하게 취급 |
| **파트너** | 테넌트와 동일한 의미. 두골프 포함 모든 ERP 사용 업체 |
| **마스터** | 시스템 관리자 계정 (Manus OAuth 기반). 테넌트 구분 없이 전체 조회/관리 가능 |
| **파트너대표** | 해당 테넌트의 ERP 분양 가입자. 담당자 권한 관리 가능 |
| **파트너담당자** | 파트너대표가 등록한 스태프. 기본적으로 모든 기능 사용 가능 |

---

## 핵심 아키텍처 원칙

### 원칙 1 — 엔진은 공유, 데이터는 격리
- LLM, 이미지생성, 파일분석 등 AI 엔진은 모든 테넌트가 공유 사용
- DB 데이터는 반드시 `tenantId` 필터로 격리
- `partnerProcedure`에서 `ctx.tenantId`가 자동 주입됨

### 원칙 2 — 테넌트 격리 체크리스트
파트너가 접근하는 모든 `partnerProcedure`에서:
```ts
// 필수 패턴
.where(ctx.tenantId ? eq(table.tenantId, ctx.tenantId) : undefined)
// 마스터(tenantId=null)는 전체 조회, 파트너는 자신 것만
```

### 원칙 3 — 무거운 작업은 큐 기반 비동기 처리
```
파트너 요청 → createJob(type, payload, tenantId) → aiScheduledTasks 테이블 → 즉시 jobId 반환
                                                              ↓
                                                    Heartbeat 워커 (aiJobWorker.ts)
                                                              ↓
                                              type별 핸들러 분기
                                              - 'package_auto_create'
                                              - 'marketing_copy_generate'
                                              - 'image_generate'
                                              - (향후 추가)
                                                              ↓
                                              완료 → SSE 파트너 실시간 알림
```

### 원칙 4 — 담당자 권한 관리
- 기본값: 파트너대표 + 모든 담당자 = 모든 기능 사용 가능
- 파트너대표(또는 권한 위임자)가 담당자별 기능 ON/OFF 설정 가능
- 권한 체크는 `partnerProcedure` 미들웨어에서 처리

---

## 1단계 개발 범위 (카카오워크봇 제외)

### 포함 기능
1. **파트너자동화AI에서 파일/이미지 직접 업로드**
2. **AI 파일 분석 → 상품 정보 JSON 추출** (tenantId 격리)
3. **상품 초안 자동 생성** (packages 테이블, status='draft', aiGeneratedFrom 추적)
4. **파트너 검토/수정 UI** (초안 확인 → 수정 → 승인)
5. **승인 → 홈페이지 자동 배포** (파트너 내부 완결, 마스터 승인 불필요)
6. **크레딧 차감 기록** (aiInteractionLogs + tenantId)
7. **담당자 권한 관리 기본 구조** (partnerStaffPermissions 테이블 + UI)
8. **파트너 전용 SSE 실시간 알림** (작업 완료 알림)

### 제외 기능 (2단계 이후)
- 카카오워크봇 연동
- SNS 자동 배포
- 마케팅 콘텐츠 자동화
- 크레딧 정책 확정 (임시 랜덤 단가 적용)

---

## DB 변경 목록 (선행 필수)

| 테이블 | 변경 내용 | 이유 |
|--------|---------|------|
| `aiInteractionLogs` | `tenantId` VARCHAR(36) 컬럼 추가 | 파트너별 크레딧 측정 |
| `fileAnalysis` | `tenantId` VARCHAR(36) 컬럼 추가 | 파트너 파일 격리 |
| `packages` | `aiGeneratedFrom` VARCHAR(36) 컬럼 추가 (fileAnalysisId FK) | AI 생성 출처 추적 |
| `packages` | `approvalStatus` enum('pending','approved','rejected') 추가 | 파트너 내부 승인 플로우 |
| `partnerStaffPermissions` | **신규 테이블** | 담당자별 기능 권한 |

### partnerStaffPermissions 테이블 설계
```ts
export const partnerStaffPermissions = mysqlTable('partner_staff_permissions', {
  id: int('id').primaryKey().autoincrement(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  staffId: int('staff_id').notNull(), // partnerStaff.id FK
  feature: varchar('feature', { length: 100 }).notNull(),
  // 기능 목록:
  // 'package_auto_create' - 상품 자동생성
  // 'package_approve'     - 상품 승인/배포
  // 'marketing_auto'      - 마케팅 자동화
  // 'inquiry_auto'        - 문의 자동 답변
  // 'ai_chat'             - AI 채팅
  // 'data_analysis'       - 데이터 분석
  enabled: boolean('enabled').notNull().default(true),
  updatedBy: int('updated_by'), // 설정 변경한 담당자 ID
  updatedAt: bigint('updated_at', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }),
});
```

---

## 크레딧 임시 단가 (추후 확정 예정)

| 작업 유형 | 임시 크레딧 단가 | 비고 |
|---------|--------------|------|
| 파일 분석 (fileAnalysis) | 5 크레딧 | 이미지 1장 기준 |
| 상품 초안 생성 (LLM) | 10 크레딧 | 텍스트 생성 |
| AI 이미지 생성 | 15 크레딧 | 썸네일 1장 |
| AI 채팅 (1턴) | 2 크레딧 | 질문+답변 |
| 마케팅 문구 생성 | 5 크레딧 | |
| 문의 답변 초안 | 3 크레딧 | |
| 데이터 분석 | 8 크레딧 | |

> **정책 미확정**: 전 과정 합산 차감 vs 건별 지정 차감은 추후 실제 운영 후 결정

---

## 파트너 전용 SSE 엔드포인트 설계

```
GET /api/partner/realtime/events?tenantId={tenantId}
Authorization: Partner JWT

이벤트 타입:
- job_started: { jobId, type, tenantId }
- job_progress: { jobId, step, message, progress }
- job_completed: { jobId, result, packageId }
- job_failed: { jobId, error }
- credit_deducted: { amount, balance, reason }
```

---

## 상품 자동생성 플로우 상세

```
[GeminiAssistant.tsx - 파트너자동화AI]
  ↓ 파일/이미지 업로드 (S3 저장)
  ↓
[fileAnalysis.analyzeFile] (partnerProcedure)
  - tenantId 격리
  - Gemini Vision으로 파일 분석
  - 상품 정보 JSON 추출: { title, destination, duration, price, description, highlights }
  - aiInteractionLogs에 기록 (tenantId 포함)
  - 크레딧 5 차감
  ↓
[packages.createDraft] (partnerProcedure) - 신규 프로시저
  - status='draft', approvalStatus='pending'
  - aiGeneratedFrom=fileAnalysisId
  - tenantId 격리
  ↓
[packages.generateAIImage] (partnerProcedure)
  - 상품명 기반 썸네일 AI 생성
  - 크레딧 15 차감
  ↓
[GeminiAssistant.tsx - 초안 검토 UI]
  - 생성된 상품 초안 표시
  - 파트너가 내용 수정 가능
  - "승인하여 배포" 버튼
  ↓
[packages.approveDraft] (partnerProcedure) - 신규 프로시저
  - approvalStatus='approved'
  - status='active'
  - 홈페이지 자동 노출
  ↓
[SSE 알림] → 파트너 화면에 "상품이 배포되었습니다" 알림
```

---

## 담당자 권한 관리 UI 위치

- **경로**: `/partner/staff/permissions` (ERPPartnerLayout 내)
- **접근 권한**: 파트너대표(`partnerOwner`) 또는 권한 위임된 담당자
- **기본값**: 모든 담당자 모든 기능 `enabled=true`
- **UI**: 담당자 목록 × 기능 목록 체크박스 그리드

---

## 개발 순서 (1단계)

1. **DB 스키마 변경** → `pnpm db:push`
2. **partnerStaffPermissions CRUD** (서버 + UI 기본 구조)
3. **파트너 전용 SSE 엔드포인트** 추가
4. **fileAnalysis 테넌트 격리** (partnerProcedure + tenantId 필터)
5. **packages.createDraft / approveDraft 프로시저** 신규 추가
6. **aiJobWorker.ts** (큐 기반 비동기 워커)
7. **GeminiAssistant.tsx 파이프라인 UI** 개편
   - 파일 업로드 → 분석 → 초안 생성 → 검토 → 승인 단계형 UI
8. **크레딧 차감 로직** (임시 단가 적용)
9. **빌드 검증 + 체크포인트**
