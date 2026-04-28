/**
 * 구글 스프레드시트 데이터 → 두골프 ERP DB 이식 스크립트 (배치 최적화)
 * 실행: node migrate-spreadsheet.mjs
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
    multipleStatements: false,
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

function parseNights(str) {
  if (!str) return 0;
  const m = str.match(/(\d+)박/);
  return m ? parseInt(m[1]) : 0;
}

function parseTeams(str) {
  if (!str) return 1;
  const m = str.match(/(\d+)/);
  return m ? parseInt(m[1]) : 1;
}

function mapStatus(str) {
  if (!str) return 'pending';
  const s = str.trim();
  if (s === '확정') return 'confirmed';
  if (s === '취소') return 'cancelled';
  if (s === '완료') return 'completed';
  return 'pending';
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
        `INSERT IGNORE INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`,
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
  // 1. 내륙팩2 → reservations
  // ============================================================
  console.log('\n📋 내륙팩2 → reservations 이식 중...');
  const inlandRows = readCsv('inland_pack2');
  const inlandData = inlandRows.slice(5).filter(r => r[0] && /^\d{5,}$/.test(r[0].trim()));

  // 고유 예약번호별 합계 행 추출
  const reservationMap = new Map();
  const agentPriceMap = new Map();
  for (const row of inlandData) {
    const no = row[0].trim();
    const recipientType = (row[15] || '').trim();
    if (recipientType === '합계' && !reservationMap.has(no)) reservationMap.set(no, row);
    if (recipientType === '대리점') {
      const price = parseAmount(row[17]);
      if (price > 0) agentPriceMap.set(no, price);
    }
  }
  console.log(`  고유 예약번호: ${reservationMap.size}개`);

  // 기존 예약번호 조회
  const [existingRes] = await conn.execute('SELECT reservationNo FROM reservations');
  const existingNos = new Set(existingRes.map(r => r.reservationNo));

  const resRows = [];
  for (const [no, row] of reservationMap) {
    const reservationNo = `OY-${no}`;
    if (existingNos.has(reservationNo)) continue;
    const departureDate = parseKoreanDate(row[3]);
    if (!departureDate) continue;

    const productName = (row[2] || '미입력').trim() || '미입력';
    const nights = parseNights(row[4]);
    const teams = parseTeams(row[6]);
    const headcount = parseTeams(row[7]);
    const agentName = (row[8] || '').trim();
    const assignedTo = (row[9] || '').trim();
    const customerName = (row[10] || '미입력').trim() || '미입력';
    const customerPhone = (row[11] || '').trim();
    const status = mapStatus(row[12]);
    const profit = parseAmount(row[16]);
    const salePricePerPerson = agentPriceMap.get(no) || 0;
    const paidAmount = parseAmount(row[21]);
    const notes = (row[33] || '').trim();

    resRows.push([
      reservationNo, productName, productName, departureDate, nights, teams, headcount,
      customerName, customerPhone, agentName, assignedTo, status, profit,
      salePricePerPerson, salePricePerPerson * headcount, paidAmount, notes || null,
      'customer', now, now
    ]);
  }

  const resInserted = await batchInsert(conn, 'reservations',
    ['reservationNo', 'productName', 'golfCourseName', 'departureDate', 'nights', 'teams', 'headcount',
     'customerName', 'customerPhone', 'agentName', 'assignedTo', 'status', 'profit',
     'salePricePerPerson', 'salePriceTotal', 'paidAmount', 'notes', 'userType', 'createdAt', 'updatedAt'],
    resRows
  );
  console.log(`  ✅ 삽입: ${resInserted}개 (스킵: ${reservationMap.size - resRows.length}개)`);

  // ============================================================
  // 2. 입금 → income_records
  // ============================================================
  console.log('\n💰 입금 → income_records 이식 중...');
  const incomeRows = readCsv('income');
  // 실제 구조: [0]=빈칸, [1]=순번, [2]=예약번호(OY00004), [3]=날짜, [5]=상세내역, [7]=금액, [9]=입금자명
  const incomeData = incomeRows.slice(2).filter(r => r[3] && r[3].trim() && /\d{4}-\d{2}-\d{2}/.test(r[3]));

  const incRows = [];
  for (const row of incomeData) {
    const transactionDate = parseKoreanDate(row[3]);  // 날짜는 인덱스 3
    if (!transactionDate) continue;
    const amount = parseAmount(row[7]);  // 금액은 인덱스 7
    if (amount <= 0) continue;
    const bankName = (row[5] || '').trim();  // 상세내역(은행 계좌정보)은 인덱스 5
    const detail = (row[5] || '').trim();
    const depositorName = (row[9] || '').trim();  // 입금자명은 인덱스 9
    const reservationNoRaw = (row[2] || '').trim();  // 예약번호는 인덱스 2 (OY00004 형식)
    let reservationNo = null;
    if (reservationNoRaw && /^OY\d+$/.test(reservationNoRaw)) {
      // OY00004 → 예약번호로 변환 (DB에서 OY-XXXXXX-XXXX 형식 검색)
      reservationNo = null; // 형식이 달라 직접 매칭 불가, 추후 수동 매칭
    }
    const noMatch = (depositorName + ' ' + detail).match(/OY-\d{6}-\d{4}/);
    if (noMatch) reservationNo = noMatch[0];
    incRows.push([transactionDate, bankName, amount, depositorName, detail, reservationNo,
      reservationNo ? 'matched' : 'unmatched', now]);
  }

  const incInserted = await batchInsert(conn, 'income_records',
    ['transactionDate', 'bankName', 'amount', 'depositorName', 'detail', 'reservationNo', 'matchStatus', 'createdAt'],
    incRows
  );
  console.log(`  ✅ 삽입: ${incInserted}개`);

  // ============================================================
  // 3. 송금 → remittance_records
  // ============================================================
  console.log('\n📤 송금 → remittance_records 이식 중...');
  const remitRows = readCsv('remittance');
  // 실제 구조: [0]=빈칸, [1]=순번, [2]=예약번호(OY00004), [3]=날짜, [5]=입금은행, [7]=금액, [9]=수취인성명
  const remitData = remitRows.slice(4).filter(r => r[3] && r[3].trim() && /\d{4}-\d{2}-\d{2}/.test(r[3]));

  const remRows = [];
  for (const row of remitData) {
    const transactionDate = parseKoreanDate(row[3]);  // 날짜는 인덱스 3
    if (!transactionDate) continue;
    const amount = parseAmount(row[7]);  // 금액은 인덱스 7
    if (amount <= 0) continue;
    const recipientName = (row[9] || '').trim();  // 수취인성명은 인덱스 9
    const detail = (row[5] || '').trim();  // 입금은행/상세는 인덱스 5
    const bankName = (row[5] || '').trim();  // 입금은행은 인덱스 5
    let recipientType = 'other';
    const nameLC = recipientName.toLowerCase();
    if (nameLC.includes('골프') || nameLC.includes('cc') || nameLC.includes('gc')) recipientType = 'golf_course';
    else if (nameLC.includes('호텔') || nameLC.includes('리조트') || nameLC.includes('펜션')) recipientType = 'accommodation';
    else if (nameLC.includes('버스') || nameLC.includes('교통') || nameLC.includes('렌터카')) recipientType = 'transport';
    let reservationNo = null;
    const noMatch = (recipientName + ' ' + detail).match(/OY-\d{6}-\d{4}/);
    if (noMatch) reservationNo = noMatch[0];
    remRows.push([transactionDate, bankName, amount, recipientName, recipientType, detail,
      reservationNo, reservationNo ? 'matched' : 'unmatched', now]);
  }

  const remInserted = await batchInsert(conn, 'remittance_records',
    ['transactionDate', 'bankName', 'amount', 'recipientName', 'recipientType', 'detail',
     'reservationNo', 'matchStatus', 'createdAt'],
    remRows
  );
  console.log(`  ✅ 삽입: ${remInserted}개`);

  // ============================================================
  // 4. 예치금 → deposit_records
  // ============================================================
  console.log('\n🏦 예치금 → deposit_records 이식 중...');
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
  console.log(`  ✅ 삽입: ${depInserted}개`);

  // ============================================================
  // 5. 충전-리스트 → charge_records
  // ============================================================
  console.log('\n💳 충전-리스트 → charge_records 이식 중...');
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
  console.log(`  ✅ 삽입: ${chrInserted}개`);

  // ============================================================
  // 6. 데파짓 → prepaid_records
  // ============================================================
  console.log('\n🏌️ 데파짓 → prepaid_records 이식 중...');
  const prepaidRows = readCsv('prepaid');

  // 기존 데파짓 조회
  const [existingPrepaid] = await conn.execute('SELECT golfCourseName FROM prepaid_records');
  const existingPrepaidNames = new Set(existingPrepaid.map(r => r.golfCourseName));

  const preRows = [];
  for (const row of prepaidRows) {
    if (!row[1] || !row[1].trim()) continue;
    if (row[0] === '잔금관리') continue;
    if (row[0] !== '') continue; // 잔금관리 섹션의 빈 첫 컬럼 행만
    const golfCourseName = row[1].trim();
    if (!golfCourseName || existingPrepaidNames.has(golfCourseName)) continue;
    const remainingAmount = parseAmount(row[2]);
    if (remainingAmount < 0) continue;
    preRows.push([golfCourseName, remainingAmount, 0, remainingAmount, now, now]);
  }

  const preInserted = await batchInsert(conn, 'prepaid_records',
    ['golfCourseName', 'prepaidAmount', 'usedAmount', 'remainingAmount', 'createdAt', 'updatedAt'],
    preRows
  );
  console.log(`  ✅ 삽입: ${preInserted}개`);

  // ============================================================
  // 최종 결과
  // ============================================================
  console.log('\n🎉 이식 완료!');
  console.log('='.repeat(50));
  const [rCount] = await conn.execute('SELECT COUNT(*) as cnt FROM reservations');
  const [iCount] = await conn.execute('SELECT COUNT(*) as cnt FROM income_records');
  const [remCount] = await conn.execute('SELECT COUNT(*) as cnt FROM remittance_records');
  const [dCount] = await conn.execute('SELECT COUNT(*) as cnt FROM deposit_records');
  const [cCount] = await conn.execute('SELECT COUNT(*) as cnt FROM charge_records');
  const [pCount] = await conn.execute('SELECT COUNT(*) as cnt FROM prepaid_records');
  console.log(`reservations: ${rCount[0].cnt}개`);
  console.log(`income_records: ${iCount[0].cnt}개`);
  console.log(`remittance_records: ${remCount[0].cnt}개`);
  console.log(`deposit_records: ${dCount[0].cnt}개`);
  console.log(`charge_records: ${cCount[0].cnt}개`);
  console.log(`prepaid_records: ${pCount[0].cnt}개`);

  await conn.end();
}

main().catch(e => {
  console.error('❌ 치명적 오류:', e);
  process.exit(1);
});
