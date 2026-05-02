import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const db = await mysql.createConnection(process.env.DATABASE_URL);

// 현재 태스크 후보 확인
const [existing] = await db.execute('SELECT COUNT(*) as cnt FROM manus_task_candidates');
console.log('기존 태스크 후보 수:', existing[0].cnt);

// 태스크 후보 시드 데이터
const candidates = [
  {
    taskName: '두골프 ERP 개발 (현재 대화창)',
    taskId: 'hNUzrtQfkbnQkVX9BUZeeM',
    projectName: '두골프 ERP 개발',
    description: '두골프 ERP 및 홈페이지 기능 개선, 버그 수정, 신규 기능 개발. React 19 + Tailwind 4 + Express 4 + tRPC 11 + MySQL(Drizzle ORM) 스택.',
    taskType: 'erp',
    isDefault: 1,
    isActive: 1,
  },
  {
    taskName: '두골프 홈페이지 개선 전용',
    taskId: null,  // 신규 태스크 생성 필요
    projectName: '두골프 ERP 개발',
    description: '두골프 홈페이지(dayoutgolf.com) UI/UX 개선, SEO 최적화, 콘텐츠 업데이트 전용. 홈페이지 관련 요청은 이 태스크로 라우팅.',
    taskType: 'homepage',
    isDefault: 0,
    isActive: 0,  // taskId 등록 후 활성화
  },
  {
    taskName: '신규 파트너 온보딩 프로젝트',
    taskId: null,  // 신규 태스크 생성 필요
    projectName: null,  // 신규 프로젝트 생성 필요
    description: '신규 골프 사업자(여행사, 골프장, 쇼핑몰 등) 온보딩 시 자동 생성되는 태스크. 두골프 매니져 가입 심사 완료 후 자동 연동.',
    taskType: 'new_project',
    isDefault: 0,
    isActive: 0,  // 파트너 온보딩 완료 후 자동 활성화
  },
];

for (const c of candidates) {
  // 중복 확인 (name 기준)
  const [dup] = await db.execute('SELECT id FROM manus_task_candidates WHERE taskName = ?', [c.taskName]);
  if (dup.length > 0) {
    console.log(`이미 존재: ${c.taskName} (id: ${dup[0].id})`);
    continue;
  }

  await db.execute(
    `INSERT INTO manus_task_candidates 
      (taskId, taskName, projectName, description, taskType, isDefault, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [c.taskId, c.taskName, c.projectName, c.description, c.taskType, c.isDefault, c.isActive]
  );
  console.log(`등록 완료: ${c.taskName}`);
}

// 결과 확인
const [rows] = await db.execute('SELECT id, taskName, taskId, isDefault, isActive FROM manus_task_candidates');
console.log('\n=== 현재 태스크 후보 목록 ===');
rows.forEach(r => {
  console.log(`[${r.id}] ${r.taskName} | taskId: ${r.taskId || '(미설정)'} | 기본: ${r.isDefault} | 활성: ${r.isActive}`);
});

await db.end();
console.log('\n시드 완료!');
