/**
 * AI ERP 에이전트 헤드리스 실행 예제
 * 터미널에서 직접 실행: npx tsx server/agent/headless.ts
 */
import { createAgent } from './agent.js';
import { dogolfTools } from './tools.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? '';

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

async function main() {
  console.log('🤖 AI ERP 에이전트 시작...\n');

  const agent = createAgent({
    apiKey: OPENROUTER_API_KEY,
    model: 'openrouter/auto',
    instructions: `당신은 AI ERP 전문 AI 어시스턴트입니다.
두골프는 국내외 골프투어 전문 여행사로, 태국/베트남/필리핀/한국 등 다양한 골프 패키지를 제공합니다.
ERP 시스템에서 예약관리, 재무관리, 상품관리, AI 기능 등을 담당합니다.
항상 한국어로 응답하며, 정확하고 친절하게 안내합니다.`,
    tools: dogolfTools,
    maxSteps: 3,
  });

  // 이벤트 훅 등록
  agent.on('thinking:start', () => {
    process.stdout.write('⏳ 처리 중...');
  });

  agent.on('stream:delta', (delta: string) => {
    process.stdout.write(delta);
  });

  agent.on('stream:end', () => {
    console.log('\n');
  });

  agent.on('tool:call', (name: string, args: unknown) => {
    console.log(`\n🔧 도구 호출: ${name}`, JSON.stringify(args));
  });

  agent.on('tool:result', (name: string, result: unknown) => {
    console.log(`✅ 도구 결과: ${name}`, JSON.stringify(result).substring(0, 100) + '...');
  });

  agent.on('error', (err: Error) => {
    console.error('\n❌ 오류:', err.message);
  });

  // 테스트 질문들
  const questions = [
    '현재 시간이 몇 시야?',
    'AI ERP에서 예약관리는 어떻게 해?',
    '태국 골프 패키지를 찾아줘',
  ];

  for (const q of questions) {
    console.log(`\n👤 사용자: ${q}`);
    console.log('🤖 에이전트: ');
    try {
      await agent.send(q);
    } catch (e) {
      console.error('오류:', e);
    }
  }

  console.log('\n✅ 에이전트 테스트 완료');
  console.log('📊 대화 이력:', agent.getMessages().length, '개 메시지');
}

main().catch(console.error);
