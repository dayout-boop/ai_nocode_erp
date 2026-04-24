/**
 * 골프톡 AI 최적화 개발 요청 6개 자동 등록 + Manus 전송 스크립트
 */
import { config } from 'dotenv';
config();

const MANUS_API_BASE = 'https://api.manus.ai/v2';
const MANUS_API_KEY = process.env.MANUS_API_KEY;
const MANUS_TASK_ID = process.env.MANUS_DOGOLF_TASK_ID;
const DB_URL = process.env.DATABASE_URL;

if (!MANUS_API_KEY || !MANUS_TASK_ID) {
  console.error('MANUS_API_KEY 또는 MANUS_DOGOLF_TASK_ID가 설정되지 않았습니다.');
  process.exit(1);
}

const requests = [
  {
    title: '[골프톡] 카카오톡 상담 연결 및 대화 요약 전달 기능 개발',
    description: `골프톡 AI 상담 중 고객이 원할 경우 '카카오톡 상담 연결' 아이콘을 통해 카카오톡 채널로 이동합니다.
이때 이전 골프톡 대화 내용 요약본이 상담사에게 자동으로 전달되는 시스템을 구현합니다.

구현 로직:
1. 골프톡 위젯 하단에 "카카오톡 상담사 연결" 버튼 추가
2. 버튼 클릭 시 현재 대화 내용을 AI가 요약 (chat_sessions.summary 활용)
3. 요약본을 URL 파라미터 또는 카카오톡 채널 메시지로 자동 전달
4. 카카오톡 채널 URL: https://pf.kakao.com/_xnGxlxj`,
    priority: 'high',
    module: '골프톡 AI',
    estimatedHours: 16,
  },
  {
    title: '[골프톡] AI 기반 맞춤형 골프 패키지 추천 엔진 개발',
    description: `고객이 입력한 예산, 날짜, 선호도, 인원수 등 조건을 분석하여 DB 내 패키지를 필터링하고,
가중치 기반 알고리즘을 통해 최적의 상품 3개를 추천하는 기능을 구현합니다.

구현 로직:
1. 고객 입력 분석: 예산(min/max), 출발 날짜, 여행 기간, 선호 국가, 인원수 추출
2. packages 테이블에서 조건 필터링 (package_prices 조인)
3. 가중치 기반 스코어링: 예산 적합도(40%), 날짜 가용성(30%), 인기도(20%), 특가여부(10%)
4. 상위 3개 패키지를 카드 형태로 링크와 함께 제안
5. RAG 컨텍스트에 실시간 패키지 데이터 주입`,
    priority: 'high',
    module: '골프톡 AI',
    estimatedHours: 24,
  },
  {
    title: '[골프톡] 외부 API 연동을 통한 골프장 날씨/코스 정보 제공',
    description: `기상 API와 연동하여 고객이 문의한 골프장의 실시간 날씨 및 주간 예보를 제공합니다.
또한 ERP 내 코스 상태 정보와 연동하여 안내하는 기능을 구현합니다.

구현 로직:
1. 기상청 API 또는 OpenWeatherMap API 연동 (골프장 위치 좌표 기반)
2. 골프장명 인식 시 해당 위치의 7일 예보 자동 조회
3. 코스 상태 정보 DB 구축 (packages 테이블에 golfCourseInfo 필드 추가)
4. 날씨 정보를 채팅 응답에 인라인으로 표시 (온도, 강수확률, 바람)
5. 라운딩 적합 여부 판단 메시지 추가 ("라운딩 최적 날씨입니다" 등)`,
    priority: 'medium',
    module: '골프톡 AI',
    estimatedHours: 20,
  },
  {
    title: '[골프톡] 예약 상태 추적 시스템 구현',
    description: `고객이 예약번호 또는 이름으로 자신의 예약 상태를 골프톡에서 직접 조회할 수 있는 기능을 구현합니다.

구현 로직:
1. 고객 인증: 예약번호 + 이름 조합으로 bookings 테이블 조회
2. 예약 상태 시각화: 결제대기 → 결제완료 → 예약확정 → 출발임박 → 여행완료 단계 표시
3. 상태별 필요 조치 안내:
   - 결제대기: 결제 링크 제공
   - 예약확정: 출발 D-7 체크리스트 제공
   - 출발임박: 공항 집결 정보, 준비물 안내
4. 개인정보 보호: 예약번호 + 이름 2중 인증 필수
5. 조회 결과 마스킹 처리 (전화번호 일부 숨김)`,
    priority: 'high',
    module: '골프톡 AI',
    estimatedHours: 16,
  },
  {
    title: '[골프톡] 다국어 지원 시스템 구현 (한/영/일/중)',
    description: `골프톡 AI 채팅에 4개 언어 자동 감지 및 응답 기능을 구현합니다.

구현 로직:
1. 언어 감지: 첫 메시지에서 언어 자동 감지 (한국어/영어/일본어/중국어)
2. 언어별 시스템 프롬프트 분기 처리
3. 골프 전문 용어 다국어 데이터베이스 구축:
   - 그린피, 캐디피, 카트피, 라운딩 등 용어 번역
   - 국가별 골프 문화 차이 안내
4. 언어별 응답 템플릿 구축 (FAQ 20개 × 4개 언어)
5. 채팅창 상단에 언어 선택 버튼 추가 (🇰🇷 🇺🇸 🇯🇵 🇨🇳)`,
    priority: 'medium',
    module: '골프톡 AI',
    estimatedHours: 20,
  },
  {
    title: '[골프톡] 이미지 기반 골프장 안내 기능 구현',
    description: `골프장명 언급 시 관련 이미지와 코스 정보를 채팅 내에서 카드 형태로 제공합니다.

구현 로직:
1. 골프장명 인식 시 package_images 테이블에서 관련 이미지 검색
2. 코스 레이아웃, 클럽하우스, 주요 홀 이미지를 이미지 캐러셀로 표시
3. 이미지 카드에 골프장 기본 정보 포함 (홀수, 파, 코스 레이팅)
4. 360도 뷰 링크 연동 (가능한 골프장 대상)
5. 채팅 응답에 이미지 카드 컴포넌트 렌더링 (GolfTalkWidget.tsx 확장)
6. 이미지 로딩 실패 시 Pixabay 검색으로 자동 대체`,
    priority: 'low',
    module: '골프톡 AI',
    estimatedHours: 12,
  },
];

async function sendToManus(message) {
  const res = await fetch(`${MANUS_API_BASE}/task.sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-manus-api-key': MANUS_API_KEY,
    },
    body: JSON.stringify({
      task_id: MANUS_TASK_ID,
      message: {
        content: [{ type: 'text', text: message }],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Manus API 오류 [${res.status}]: ${err.slice(0, 200)}`);
  }
  return await res.json();
}

function formatMessage(req, index) {
  return `# 두골프 골프톡 AI 최적화 개발 요청 [${index + 1}/6]

**제목:** ${req.title}
**우선순위:** ${req.priority.toUpperCase()}
**대상 모듈:** ${req.module}
**예상 소요 시간:** ${req.estimatedHours}시간

**상세 설명:**
${req.description}

---
*두골프 골프톡 AI 최적화 계획에 따른 자동 등록 요청입니다.*`;
}

async function main() {
  console.log(`\n🚀 골프톡 AI 최적화 개발 요청 ${requests.length}개 Manus 전송 시작\n`);
  console.log(`📌 대상 태스크: ${MANUS_TASK_ID}\n`);

  const results = [];

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    console.log(`[${i + 1}/${requests.length}] 전송 중: ${req.title}`);

    try {
      const message = formatMessage(req, i);
      const result = await sendToManus(message);
      console.log(`  ✅ 전송 성공`);
      results.push({ index: i + 1, title: req.title, success: true, result });
    } catch (err) {
      console.error(`  ❌ 전송 실패: ${err.message}`);
      results.push({ index: i + 1, title: req.title, success: false, error: err.message });
    }

    // rate limit 방지
    if (i < requests.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('\n📊 전송 결과 요약:');
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`  성공: ${succeeded}개 / 실패: ${failed}개`);

  if (failed > 0) {
    console.log('\n❌ 실패 항목:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - [${r.index}] ${r.title}: ${r.error}`);
    });
  }

  console.log('\n✅ 완료!');
}

main().catch(err => {
  console.error('스크립트 실행 오류:', err);
  process.exit(1);
});
