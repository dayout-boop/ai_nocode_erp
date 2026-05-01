// #240001 요청을 현재 두골프 ERP 대화창으로 재전송
import { config } from 'dotenv';
config({ path: '.env' });

const MANUS_API_BASE = 'https://api.manus.ai/v2';
const apiKey = process.env.MANUS_API_KEY;
const dogolfTaskId = process.env.MANUS_DOGOLF_TASK_ID;

console.log('API Key:', apiKey ? '설정됨 (' + apiKey.slice(0, 8) + '...)' : '없음');
console.log('MANUS_DOGOLF_TASK_ID:', dogolfTaskId || '없음');

if (!apiKey || !dogolfTaskId) {
  console.error('필수 환경변수 없음 - 서버 환경에서 실행 필요');
  process.exit(1);
}

const message = `[두골프 개발 요청 #240001] 홈페이지 푸터 저작권 연도 및 파트너명 자동화

**요청 내용:**
홈페이지 푸터의 저작권 연도가 매년 자동으로 업데이트되고, 파트너사명이 동적으로 표시되도록 기능을 개선합니다. 현재 하드코딩된 연도와 파트너명을 변수로 대체하여 유지보수 효율성을 높이는 것을 목표로 합니다. 변경 형식: Copyright © {{올해}} {{파트너:회사명}}. All Rights Reserved Powered by dogolfai

**우선순위:** medium
**모듈:** 홈페이지 (Front-end)
**상태:** in_progress (재전송)`;

const res = await fetch(MANUS_API_BASE + '/task.sendMessage', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-manus-api-key': apiKey,
  },
  body: JSON.stringify({
    task_id: dogolfTaskId,
    message: {
      content: [{ type: 'text', text: message }],
    },
  }),
});

const text = await res.text();
console.log('Status:', res.status);
console.log('Response:', text.slice(0, 500));
