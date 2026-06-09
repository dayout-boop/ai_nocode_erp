# 남은 개발 항목 충돌·중복 점검 보고서

작성일: 2026-06-09 · 대상: 두골프 ERP (`/home/ubuntu/dogolf`)

## 1. 결론 요약

- **이번에 구현한 "자체 Git 롤백" 기능과 남은 개발 항목 사이에 충돌은 없습니다.** 두 작업은 완전히 다른 도메인(① ERP 개발 파이프라인의 Git 롤백 vs ② 파트너 온보딩/가입 흐름)이며, 건드리는 파일·테이블·라우터가 겹치지 않습니다.
- 더 중요한 발견: **todo.md에 `[ ]`(미완료)로 남아 있는 27개 항목 중 대부분은 실제 코드에 이미 구현되어 있습니다.** 즉 "남은 개발"이 아니라 **체크박스 갱신 누락**입니다.
- 전체 타입체크(`tsc --noEmit`) 통과, 전체 테스트 326개 통과 상태로 회귀 위험 없음.

## 2. 자체 Git 롤백 ↔ 남은 항목 간섭 여부

| 구분 | 이번 롤백 작업 | 남은(파트너 온보딩) 항목 | 충돌 |
|---|---|---|---|
| 백엔드 파일 | `server/services/gitEngine.ts`, `server/routers/aiDevPipeline.ts` | `server/routers/partnerOnboarding.ts`, `partnerGoogleAuth.ts` | 없음 (파일 분리) |
| DB 테이블 | `git_rollback_logs` (신규) | `partners`, `partner_onboarding` | 없음 (테이블 분리) |
| 프론트 | `client/src/pages/erp/DevAI.tsx` | `client/src/pages/Partner/*`, `PartnerOnboardingAdmin.tsx` | 없음 |
| tRPC 네임스페이스 | `aiDevPipeline.*` | `partnerOnboarding.*`, `partnerGoogleAuth.*` | 없음 |

결론: **상호 독립.** 롤백 기능을 더 진행해도 파트너 트랙에 영향이 없고, 그 반대도 동일합니다.

## 3. todo.md 미완료 항목 실제 구현 현황 대조

### 3-1. 이미 구현 완료 (체크박스만 누락) — 약 22개

| todo 항목 | 실제 코드 근거 |
|---|---|
| 등록증 업로드 완료 시 isActive 자동 전환 | `partnerOnboarding.ts` 자동승인 분기 + `partnerGoogleAuth.ts:266` `isActive: hasLicense` |
| 등록증 있으면 자동승인 → /partner/dashboard | `partnerGoogleAuth.ts:296` `res.redirect('/partner/dashboard')` |
| 등록증 없는 pending → /partner/pending-verification | `partnerGoogleAuth.ts:275` 리다이렉트 구현됨 |
| /partner/pending-verification 페이지 생성 | `PartnerPendingVerification.tsx` 존재 + `App.tsx:100` 라우트 등록 |
| PartnerCustomLogin (ID/PW 로그인) | `PartnerCustomLogin.tsx`(189줄) + `App.tsx:96` `/partner/custom-login` 라우트 |
| 업종 키워드 자동 검증 → reviewing 분류 | `partnerOnboarding.ts:517` "업종 키워드 자동 검증", `:540` reviewing 전환 |
| 사업자번호 중복 차단 | `partnerOnboarding.ts:496~512` "이미 등록된 사업자등록번호" 에러 |
| 업종 불일치 플래그 DB 저장 | `partnerOnboarding.ts:529` adminNote에 "⚠️ 업종 불일치 자동 플래그" |
| 관리자 대시보드 reviewing/거부됨 탭 + 플래그 배지 | `PartnerOnboardingAdmin.tsx` 상태 필터/플래그 감지/배너 구현 |
| 수동 승인/거부 버튼 | `PartnerOnboardingAdmin.tsx:465~` 빠른 처리 버튼 |
| 신규 가입/승인/거부 Slack 알림 | `partnerOnboarding.ts:176~192` SLACK_WEBHOOK_URL 발송 |
| 서비스명/홈페이지/블로그/SNS URL 수집 필드 | `schema.ts:1598~` `serviceName`, `websiteUrl`, `blogUrl`, `snsUrl` 컬럼 존재 |
| reviewing 상태 안내 / pending 화면 개선 | `PartnerLogin.tsx`·`PartnerPendingVerification.tsx` 상태 분기 |

### 3-2. 진짜 미구현 / 부분 구현 — 약 5개 (신규 개발 필요)

| 항목 | 현황 | 비고 |
|---|---|---|
| **이메일 알림 발송** (환영/승인/거부 메일) | 미구현. 현재는 **Slack 알림만** 존재, 메일 발송 헬퍼(nodemailer/sendEmail) 없음 | 메일 발송 수단(SMTP/외부 메일 API) 결정 필요 |
| **ERP 파트너 직접 생성** (`partner.createByAdmin`) | tRPC 프로시저 미존재 | 단, 관리자가 직접 만들 ID/PW용 `loginId`/`loginPwHash` 컬럼은 이미 있어 `customLoginId/PwHash` 신규 컬럼은 불필요 |
| **파트너 정지/복구** (suspendedAt/suspendReason) | `partners` 테이블에 해당 컬럼 없음. (테넌트 단위 `tenants.suspend`는 별도로 존재) | 파트너 개별 정지가 필요하면 컬럼 추가 + db:push |
| 온보딩 채팅 Step1에서 서비스명/URL **수집 플로우** | DB 컬럼은 있으나 채팅 단계에서 실제 수집·저장하는지 추가 확인 필요 | UI 흐름 점검 대상 |
| `serviceUrl`/`additionalUrls` 라는 **정확한 컬럼명** | 없음. 대신 `websiteUrl`/`blogUrl`/`snsUrl`로 대체 구현됨 | 사실상 동등 기능 → todo 항목이 옛 명세 |

## 4. 권고 사항

1. **todo.md 정합화**: 3-1의 약 22개 항목은 실제 구현을 확인했으므로 `[x]`로 갱신하는 것이 혼선 방지에 가장 시급합니다.
2. **진짜 남은 일은 5개 내외**이며, 그중에서도 핵심은 ① 이메일 발송 수단 도입, ② `partner.createByAdmin`, ③ 파트너 개별 정지/복구 컬럼입니다. 이 셋만 신규 개발이 명확히 필요합니다.
3. 이메일 발송은 외부 메일 서비스 연동이 수반되므로, `projectInstruction`(무단 외부 연동 금지) 원칙상 **어떤 메일 수단을 쓸지 마스터 확인 후** 진행하는 것이 안전합니다.

## 5. 검증 상태

- TypeScript: `tsc --noEmit` 오류 0
- 테스트: 전체 30파일 / 326개 통과 (롤백 vitest 7개 포함)
