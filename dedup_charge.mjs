/**
 * charge_records 중복 제거 - 배치 방식
 */
import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');

function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port) || 3306,
    user: u.username,
    password: u.password,
    database: u.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
  };
}

async function main() {
  const conn = await createConnection(parseDbUrl(DB_URL));
  console.log('✅ DB 연결 성공');

  // charge_records 중복 제거 - 배치 방식
  console.log('\n💳 charge_records 중복 제거 중...');
  const [[before]] = await conn.execute('SELECT COUNT(*) as cnt FROM charge_records');
  console.log('  이전:', before.cnt, '개');

  // 중복 그룹 찾기 (같은 transactionDate + amount + golfCourseName)
  // 각 그룹에서 min(id)만 남기고 나머지 삭제
  const [dupGroups] = await conn.execute(`
    SELECT MIN(id) as keep_id, transactionDate, amount, golfCourseName, COUNT(*) as cnt
    FROM charge_records
    GROUP BY transactionDate, amount, golfCourseName
    HAVING COUNT(*) > 1
  `);
  
  console.log('  중복 그룹 수:', dupGroups.length, '개');
  
  let totalDeleted = 0;
  const batchSize = 100;
  
  for (let i = 0; i < dupGroups.length; i += batchSize) {
    const batch = dupGroups.slice(i, i + batchSize);
    for (const group of batch) {
      const [result] = await conn.execute(
        `DELETE FROM charge_records 
         WHERE transactionDate = ? AND amount = ? AND golfCourseName = ? AND id != ?`,
        [group.transactionDate, group.amount, group.golfCourseName, group.keep_id]
      );
      totalDeleted += result.affectedRows;
    }
    process.stdout.write(`\r  진행: ${Math.min(i + batchSize, dupGroups.length)}/${dupGroups.length} 그룹`);
  }
  console.log('');

  const [[after]] = await conn.execute('SELECT COUNT(*) as cnt FROM charge_records');
  console.log('  이후:', after.cnt, '개');
  console.log('  제거:', totalDeleted, '개');

  // 최종 결과
  console.log('\n🎉 완료!');
  console.log('='.repeat(50));
  const tables = ['reservations', 'income_records', 'remittance_records', 'deposit_records', 'charge_records', 'prepaid_records'];
  for (const t of tables) {
    const [[r]] = await conn.execute(`SELECT COUNT(*) as cnt FROM ${t}`);
    console.log(`${t}: ${r.cnt}개`);
  }

  await conn.end();
}

main().catch(e => {
  console.error('❌ 치명적 오류:', e);
  process.exit(1);
});
