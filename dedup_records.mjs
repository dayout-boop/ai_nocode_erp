/**
 * 중복 레코드 제거 스크립트
 * income_records, remittance_records, deposit_records, charge_records 중복 제거
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

  // income_records 중복 제거 (transactionDate + amount + depositorName 기준)
  console.log('\n💰 income_records 중복 제거 중...');
  const [incBefore] = await conn.execute('SELECT COUNT(*) as cnt FROM income_records');
  console.log('  이전:', incBefore[0].cnt, '개');
  
  await conn.execute(`
    DELETE t1 FROM income_records t1
    INNER JOIN income_records t2
    WHERE t1.id > t2.id
      AND t1.transactionDate = t2.transactionDate
      AND t1.amount = t2.amount
      AND t1.depositorName = t2.depositorName
  `);
  
  const [incAfter] = await conn.execute('SELECT COUNT(*) as cnt FROM income_records');
  console.log('  이후:', incAfter[0].cnt, '개');
  console.log('  제거:', incBefore[0].cnt - incAfter[0].cnt, '개');

  // remittance_records 중복 제거 (transactionDate + amount + recipientName 기준)
  console.log('\n📤 remittance_records 중복 제거 중...');
  const [remBefore] = await conn.execute('SELECT COUNT(*) as cnt FROM remittance_records');
  console.log('  이전:', remBefore[0].cnt, '개');
  
  await conn.execute(`
    DELETE t1 FROM remittance_records t1
    INNER JOIN remittance_records t2
    WHERE t1.id > t2.id
      AND t1.transactionDate = t2.transactionDate
      AND t1.amount = t2.amount
      AND t1.recipientName = t2.recipientName
  `);
  
  const [remAfter] = await conn.execute('SELECT COUNT(*) as cnt FROM remittance_records');
  console.log('  이후:', remAfter[0].cnt, '개');
  console.log('  제거:', remBefore[0].cnt - remAfter[0].cnt, '개');

  // deposit_records 중복 제거 (reservationNo + type + amount 기준)
  console.log('\n🏦 deposit_records 중복 제거 중...');
  const [depBefore] = await conn.execute('SELECT COUNT(*) as cnt FROM deposit_records');
  console.log('  이전:', depBefore[0].cnt, '개');
  
  await conn.execute(`
    DELETE t1 FROM deposit_records t1
    INNER JOIN deposit_records t2
    WHERE t1.id > t2.id
      AND t1.reservationNo = t2.reservationNo
      AND t1.type = t2.type
      AND t1.amount = t2.amount
  `);
  
  const [depAfter] = await conn.execute('SELECT COUNT(*) as cnt FROM deposit_records');
  console.log('  이후:', depAfter[0].cnt, '개');
  console.log('  제거:', depBefore[0].cnt - depAfter[0].cnt, '개');

  // charge_records 중복 제거 (transactionDate + amount + golfCourseName 기준)
  console.log('\n💳 charge_records 중복 제거 중...');
  const [chrBefore] = await conn.execute('SELECT COUNT(*) as cnt FROM charge_records');
  console.log('  이전:', chrBefore[0].cnt, '개');
  
  await conn.execute(`
    DELETE t1 FROM charge_records t1
    INNER JOIN charge_records t2
    WHERE t1.id > t2.id
      AND t1.transactionDate = t2.transactionDate
      AND t1.amount = t2.amount
      AND t1.golfCourseName = t2.golfCourseName
  `);
  
  const [chrAfter] = await conn.execute('SELECT COUNT(*) as cnt FROM charge_records');
  console.log('  이후:', chrAfter[0].cnt, '개');
  console.log('  제거:', chrBefore[0].cnt - chrAfter[0].cnt, '개');

  // 최종 결과
  console.log('\n🎉 중복 제거 완료!');
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
