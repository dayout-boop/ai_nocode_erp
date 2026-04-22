# 두골프 ERP × n8n 자동화 파이프라인 연동 가이드

> 이 문서는 두골프 ERP 시스템과 [n8n](https://n8n.io) 워크플로우 자동화 플랫폼을 연동하는 방법을 설명합니다.

---

## 목차

1. [개요](#1-개요)
2. [환경 변수 설정](#2-환경-변수-설정)
3. [지원 파이프라인](#3-지원-파이프라인)
4. [Webhook 페이로드 명세](#4-webhook-페이로드-명세)
5. [n8n 워크플로우 구성 예시](#5-n8n-워크플로우-구성-예시)
6. [실행 이력 조회](#6-실행-이력-조회)
7. [트러블슈팅](#7-트러블슈팅)

---

## 1. 개요

두골프 ERP는 특정 비즈니스 이벤트가 발생할 때 n8n Webhook URL로 HTTP POST 요청을 전송합니다.
n8n은 이 요청을 수신하여 SNS 자동 배포, 슬랙 알림, 정산 자동화 등 다양한 후속 작업을 처리합니다.

```
두골프 ERP ──(HTTP POST)──▶ n8n Webhook ──▶ 워크플로우 실행
                                              ├── 인스타그램 게시
                                              ├── 카카오채널 포스팅
                                              ├── 슬랙 알림
                                              └── 구글 시트 기록
```

---

## 2. 환경 변수 설정

ERP 관리자 패널 → **설정 > 시크릿** 메뉴에서 아래 환경 변수를 등록합니다.

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `N8N_WEBHOOK_URL` | n8n Webhook 트리거 URL | `https://your-n8n.com/webhook/dogolf` |

> **참고:** `N8N_WEBHOOK_URL`이 설정되지 않은 경우, 개발 모드로 동작하여 서버 콘솔에 페이로드를 출력하고 성공으로 처리합니다.

---

## 3. 지원 파이프라인

### 3.1 상품 SNS 배포 파이프라인 (`package_published`)

**트리거 조건:** ERP 상품 상세 페이지 → 자동화 탭 → "SNS 배포" 버튼 클릭

**용도:**
- 신규 골프 패키지 등록 후 인스타그램, 페이스북, 카카오채널에 자동 게시
- 상품 이미지와 설명을 소셜 미디어 형식으로 변환하여 배포

---

### 3.2 예약 확정 파이프라인 (`booking_confirmed`)

**트리거 조건:** ERP 예약 관리 → 예약 상태를 "confirmed"로 변경 시 자동 실행

**용도:**
- 예약 확정 알림 슬랙 채널 전송
- 정산 시트 자동 업데이트
- 담당자 이메일 발송

---

## 4. Webhook 페이로드 명세

모든 요청은 `Content-Type: application/json`으로 전송됩니다.

### 4.1 상품 SNS 배포 (`package_published`)

```json
{
  "event": "package_published",
  "packageId": 42,
  "title": "태국 파타야 3박 5일 골프 패키지",
  "country": "thailand",
  "region": "파타야",
  "imageUrl": "/manus-storage/pkg_image_abc123.jpg",
  "timestamp": "2026-04-23T05:00:00.000Z"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `event` | string | 이벤트 유형 (`package_published`) |
| `packageId` | number | 상품 고유 ID |
| `title` | string | 상품명 |
| `country` | string | 국가 코드 (`korea`, `thailand`, `vietnam`, `philippines`, `china`, `japan`) |
| `region` | string \| null | 지역명 |
| `imageUrl` | string \| null | 대표 이미지 URL |
| `timestamp` | string | ISO 8601 형식의 UTC 타임스탬프 |

---

### 4.2 예약 확정 (`booking_confirmed`)

```json
{
  "event": "booking_confirmed",
  "bookingId": 101,
  "bookingNumber": "BK-20260423-0001",
  "customerName": "홍길동",
  "customerPhone": "010-1234-5678",
  "packageTitle": "태국 파타야 3박 5일 골프 패키지",
  "departureDate": "2026-06-15",
  "totalAmount": 1200000,
  "totalPeople": 4,
  "timestamp": "2026-04-23T05:00:00.000Z"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `event` | string | 이벤트 유형 (`booking_confirmed`) |
| `bookingId` | number | 예약 고유 ID |
| `bookingNumber` | string | 예약 번호 |
| `customerName` | string | 고객명 |
| `customerPhone` | string | 고객 연락처 |
| `packageTitle` | string | 패키지명 |
| `departureDate` | string | 출발일 (YYYY-MM-DD) |
| `totalAmount` | number | 총 결제 금액 (원) |
| `totalPeople` | number | 총 인원 수 |
| `timestamp` | string | ISO 8601 형식의 UTC 타임스탬프 |

---

## 5. n8n 워크플로우 구성 예시

### 5.1 상품 SNS 자동 배포 워크플로우

```
[Webhook 트리거]
    │
    ▼
[Switch: event 필드 분기]
    │
    ├─ package_published
    │       │
    │       ▼
    │   [HTTP Request: 이미지 다운로드]
    │       │
    │       ▼
    │   [Code: SNS 캡션 생성]
    │       │
    │       ├─▶ [Instagram Graph API: 게시]
    │       ├─▶ [Kakao Channel API: 포스팅]
    │       └─▶ [Slack: 배포 완료 알림]
    │
    └─ booking_confirmed
            │
            ▼
        [Google Sheets: 예약 기록]
            │
            ▼
        [Slack: 예약 확정 알림]
```

### 5.2 n8n Webhook 노드 설정

1. n8n 대시보드에서 새 워크플로우 생성
2. **Webhook** 노드 추가
   - HTTP Method: `POST`
   - Path: `dogolf` (예: `/webhook/dogolf`)
   - Response Mode: `Immediately`
3. Webhook URL 복사 후 두골프 ERP 시크릿에 `N8N_WEBHOOK_URL`로 등록
4. 워크플로우 활성화 (상단 토글 ON)

### 5.3 이벤트 분기 처리 (Switch 노드)

```javascript
// Switch 노드 조건 설정
// 조건 1: {{ $json.event === 'package_published' }}
// 조건 2: {{ $json.event === 'booking_confirmed' }}
```

---

## 6. 실행 이력 조회

ERP 상품 상세 페이지 → **자동화 탭**에서 파이프라인 실행 이력을 확인할 수 있습니다.

| 컬럼 | 설명 |
|------|------|
| 파이프라인 | 실행된 파이프라인 이름 |
| 상태 | `success` / `failed` |
| 응답 코드 | n8n Webhook 응답 HTTP 상태 코드 |
| 소요 시간 | 요청 완료까지 걸린 시간 (ms) |
| 실행 시각 | 트리거 발생 시각 |

---

## 7. 트러블슈팅

### 7.1 Webhook 요청 실패

**증상:** 자동화 탭에서 `failed` 상태 표시

**확인 사항:**
1. `N8N_WEBHOOK_URL` 환경 변수가 올바르게 설정되었는지 확인
2. n8n 워크플로우가 활성화(Active) 상태인지 확인
3. n8n 서버가 외부에서 접근 가능한 URL인지 확인 (localhost 불가)
4. n8n 대시보드 → Executions 탭에서 수신 기록 확인

### 7.2 타임아웃 오류

두골프 ERP는 n8n Webhook 요청에 **30초 타임아웃**을 적용합니다.
n8n 워크플로우가 30초 이내에 응답을 반환하도록 구성하세요.

> **권장:** Webhook 노드의 Response Mode를 `Immediately`로 설정하여 수신 즉시 200 응답을 반환하고, 후속 작업은 비동기로 처리합니다.

### 7.3 개발 환경 테스트

`N8N_WEBHOOK_URL`을 설정하지 않으면 개발 모드로 동작합니다.
서버 로그에서 페이로드 내용을 확인할 수 있습니다:

```
[n8n] DEV MODE - Webhook URL 미설정
  이벤트: package_published
  페이로드: { "event": "package_published", ... }
```

---

*문서 최종 수정: 2026-04-23*

---

## 8. 출발 D-1 알림톡 자동 발송 (스케줄 파이프라인)

### 8.1 개요

출발 전날 고객에게 자동으로 알림톡을 발송하는 파이프라인입니다.
n8n의 **Schedule Trigger** 노드를 사용하여 매일 특정 시간에 두골프 ERP API를 호출하고, 내일 출발하는 예약자 목록을 조회한 뒤 카카오 알림톡을 발송합니다.

### 8.2 n8n 워크플로우 구성

```
[Schedule Trigger: 매일 오전 10시]
    │
    ▼
[HTTP Request: 내일 출발 예약 목록 조회]
  POST https://your-dogolf.manus.space/api/trpc/bookings.getDepartureTomorrow
    │
    ▼
[IF: 예약 목록이 비어있지 않은 경우]
    │
    ▼
[Loop Over Items: 각 예약에 대해]
    │
    ▼
[HTTP Request: 카카오 알림톡 발송]
  POST https://your-dogolf.manus.space/api/trpc/kakao.sendDepartureReminder
    │
    ▼
[Slack: 발송 완료 요약 알림]
```

### 8.3 Schedule Trigger 설정

n8n에서 **Schedule Trigger** 노드를 추가하고 다음과 같이 설정합니다.

| 설정 항목 | 값 | 설명 |
|-----------|-----|------|
| Trigger Interval | Days | 매일 실행 |
| Hour | 10 | 오전 10시 실행 |
| Minute | 0 | 정각 실행 |
| Timezone | Asia/Seoul | 한국 시간 기준 |

### 8.4 내일 출발 예약 조회 API

두골프 ERP에서 내일 출발 예약을 조회하는 tRPC API를 호출합니다.

**HTTP Request 노드 설정:**
```
Method: GET
URL: https://your-dogolf.manus.space/api/trpc/bookings.getDepartureTomorrow
Headers:
  Content-Type: application/json
  Cookie: {session_cookie}  ← 관리자 세션 쿠키 필요
```

**응답 예시:**
```json
{
  "result": {
    "data": [
      {
        "bookingId": 101,
        "bookingNumber": "BK-20260423-0001",
        "customerName": "홍길동",
        "customerPhone": "010-1234-5678",
        "packageTitle": "태국 파타야 3박 5일 골프 패키지",
        "departureDate": "2026-04-24",
        "totalPeople": 4,
        "meetingPoint": "인천국제공항 제1터미널 3층 F카운터"
      }
    ]
  }
}
```

### 8.5 알림톡 메시지 템플릿

```
[두골프] 내일 출발 안내

안녕하세요, {{customerName}}님!
내일 출발하는 골프 여행 일정을 안내드립니다.

📋 예약번호: {{bookingNumber}}
🏌️ 패키지: {{packageTitle}}
📅 출발일: {{departureDate}}
👥 인원: {{totalPeople}}명
📍 집결장소: {{meetingPoint}}

준비물을 꼭 확인하시고, 즐거운 골프 여행 되세요! ⛳

문의: 1668-1739 (평일 09:00~17:30)
```

### 8.6 n8n 워크플로우 JSON 템플릿

아래 JSON을 n8n에서 **Import from JSON** 기능으로 가져와 사용할 수 있습니다.

```json
{
  "name": "두골프 D-1 알림톡 자동 발송",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "hours",
              "hoursInterval": 24,
              "triggerAtHour": 10,
              "triggerAtMinute": 0
            }
          ]
        }
      },
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [240, 300]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "https://your-dogolf.manus.space/api/trpc/bookings.getDepartureTomorrow",
        "options": {
          "timeout": 30000
        }
      },
      "name": "내일 출발 예약 조회",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [460, 300]
    },
    {
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{ $json.result.data.length }}",
              "operation": "larger",
              "value2": 0
            }
          ]
        }
      },
      "name": "예약 있는 경우",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [680, 300]
    },
    {
      "parameters": {
        "fieldToSplitOut": "result.data",
        "options": {}
      },
      "name": "예약별 처리",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [900, 200]
    }
  ],
  "connections": {
    "Schedule Trigger": {
      "main": [[ { "node": "내일 출발 예약 조회", "type": "main", "index": 0 } ]]
    },
    "내일 출발 예약 조회": {
      "main": [[ { "node": "예약 있는 경우", "type": "main", "index": 0 } ]]
    },
    "예약 있는 경우": {
      "main": [[ { "node": "예약별 처리", "type": "main", "index": 0 } ]]
    }
  }
}
```

### 8.7 구현 시 주의사항

1. **인증 처리:** 두골프 ERP API는 관리자 인증이 필요합니다. n8n의 **Credentials** 기능을 사용하여 세션 쿠키 또는 API 토큰을 안전하게 관리하세요.
2. **중복 발송 방지:** 같은 예약에 대해 알림톡이 중복 발송되지 않도록 `kakao_notifications` 테이블에서 당일 발송 이력을 확인하는 로직을 추가하세요.
3. **발송 실패 처리:** 알림톡 발송 실패 시 슬랙으로 알림을 받도록 Error Trigger 노드를 추가하세요.
4. **테스트 모드:** 처음 설정 시 실제 고객 번호 대신 테스트 번호로 발송하여 동작을 확인하세요.

---

*문서 최종 수정: 2026-04-23*
