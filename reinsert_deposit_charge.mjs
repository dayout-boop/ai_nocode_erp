/**
 * deposit_records, charge_records 재이식 스크립트
 * 기존 데이터 삭제 후 CSV에서 재삽입
 */
import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
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

function readCsv(filename) {
  const content = readFileSync(`/home/ubuntu/sheet_data/${filename}.csv`, 'utf-8');
  return parse(content, { relaxQuotes: true, skipEmptyLines: false });
}

function parseKoreanDate(str) {
  if (!str || !str.trim()) return null;
  const s = str.trim();
  const dtMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (dtMatch) return new Date(`${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}T${dtMatch[4]}:${dtMatch[5]}:${dtMatch[6]}+09:00`);
  const ymdMatch = s.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (ymdMatch) return new Date(`${parseInt(ymdMatch[1]) + 2000}-${ymdMatch[2]}-${ymdMatch[3]}T00:00:00+09:00`);
  const fullMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullMatch) return new Date(`${fullMatch[1]}-${fullMatch[2]}-${fullMatch[3]}T00:00:00+09:00`);
  return null;
}

function parseAmount(str) {
  if (!str || !str.trim()) return 0;
  const num = parseInt(str.replace(/[,\s₩]/g, '').trim());
  return isNaN(num) ? 0 : num;
}

function parseTeams(str) {
  if (!str) return 1;
  const m = str.match(/(\d+)/);
  return m ? parseInt(m[1]) : 1;
}

// 배치 INSERT 헬퍼
async function batchInsert(conn, table, columns, rows, batchSize = 200) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const placeholders = batch.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
    const values = batch.flat();
    try {
      const [result] = await conn.execute(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`,
        values
      );
      inserted += result.affectedRows;
    } catch (e) {
      console.error(`  ❌ 배치 오류 (${table}):`, e.message.substring(0, 100));
    }
    process.stdout.write(`\r  진행: ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
  }
  console.log('');
  return inserted;
}

async function main() {
  const conn = await createConnection(parseDbUrl(DB_URL));
  console.log('✅ DB 연결 성공');

  const now = new Date();

  // ============================================================
  // deposit_records 재이식
  // ============================================================
  console.log('\n🏦 deposit_records 재이식 중...');
  await conn.execute('DELETE FROM deposit_records');
  console.log('  기존 데이터 삭제 완료');

  const depositRows = readCsv('deposit');
  const depositData = depositRows.slice(5).filter(r => r[0] && r[0].trim() && r[0].trim() !== '예약번호');

  const depRows = [];
  for (const row of depositData) {
    const reservationNo = row[0] ? `OY-${row[0].trim()}` : null;
    if (!reservationNo) continue;
    let amount = 0;
    for (let i = 10; i < Math.min(row.length, 20); i++) {
      const v = parseAmount(row[i]);
      if (v > 0) { amount = v; break; }
    }
    if (amount <= 0) continue;
    let type = 'unpaid';
    const memo = row.slice(10).join(' ').toLowerCase();
    if (memo.includes('예정')) type = 'expected';
    else if (memo.includes('타건') || memo.includes('차감')) type = 'deduct_other';
    else if (memo.includes('신한') || memo.includes('충전')) type = 'deduct_shinhan';
    const memoText = row.slice(10).filter(c => c.trim()).join(', ') || null;
    depRows.push([reservationNo, type, amount, memoText, now]);
  }

  const depInserted = await batchInsert(conn, 'deposit_records',
    ['reservationNo', 'type', 'amount', 'memo', 'createdAt'],
    depRows
  );
  console.log(`  ✅ 삽입: ${depInserted}개 (원본: ${depositData.length}개)`);

  // ============================================================
  // charge_records 재이식
  // ============================================================
  console.log('\n💳 charge_records 재이식 중...');
  await conn.execute('DELETE FROM charge_records');
  console.log('  기존 데이터 삭제 완료');

  const chargeRows = readCsv('charge_list');
  const chargeData = chargeRows.slice(2).filter(r => r[1] && /^\d{5,}$/.test(r[1].trim()));

  const chrRows = [];
  for (const row of chargeData) {
    const reservationNo = row[1] ? `OY-${row[1].trim()}` : null;
    const golfCourseName = (row[3] || '').trim();
    const transactionDate = parseKoreanDate(row[2]) || now;
    let amount = 0;
    for (let i = 10; i < Math.min(row.length, 25); i++) {
      const v = parseAmount(row[i]);
      if (v > 0) { amount = v; break; }
    }
    if (amount <= 0) continue;
    const rawText = row.filter(c => c.trim()).join(', ');
    chrRows.push(['신한카드', golfCourseName, amount, transactionDate, reservationNo,
      rawText, reservationNo ? 'matched' : 'unmatched', now]);
  }

  const chrInserted = await batchInsert(conn, 'charge_records',
    ['cardCompany', 'golfCourseName', 'amount', 'transactionDate', 'reservationNo',
     'rawText', 'matchStatus', 'createdAt'],
    chrRows
  );
  console.log(`  ✅ 삽입: ${chrInserted}개 (원본: ${chargeData.length}개)`);

  // 최종 결과
  console.log('\n🎉 재이식 완료!');
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
