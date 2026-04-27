#!/usr/bin/env node
/**
 * oyeo 골프장 데이터를 두골프 ERP DB에 직접 삽입
 */
import { readFileSync } from 'fs';
import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env 로드
config({ path: join(__dirname, '../dogolf/.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

// 데이터 로드
const rawData = JSON.parse(readFileSync(join(__dirname, 'golf_data_fixed.json'), 'utf-8'));

console.log(`Loaded ${rawData.length} golf courses`);

// DB 연결
const conn = await createConnection(DATABASE_URL);
console.log('DB connected');

// 기존 oyeo 데이터 확인
const [existing] = await conn.execute('SELECT COUNT(*) as cnt FROM affiliates WHERE oyeoId IS NOT NULL');
const existingCount = existing[0].cnt;
console.log(`Existing oyeo affiliates: ${existingCount}`);

if (existingCount > 0) {
  console.log('Oyeo data already exists. Skipping...');
  await conn.end();
  process.exit(0);
}

// 배치 삽입
const batchSize = 100;
let inserted = 0;

for (let i = 0; i < rawData.length; i += batchSize) {
  const batch = rawData.slice(i, i + batchSize);
  
  const values = batch.map(g => [
    g.type === 'golf_domestic' ? 'golf_domestic' : 'golf_overseas', // category
    g.name || '',                          // name
    g.region || null,                      // region
    g.country || null,                     // country
    null,                                  // address
    null,                                  // phone
    null,                                  // email
    null,                                  // website
    null,                                  // contactPerson
    null,                                  // contactName
    null,                                  // contactPhone
    g.type || 'golf_domestic',             // type
    'direct',                              // contractType
    null,                                  // supplyPrice
    18,                                    // holeCount
    1,                                     // courseCount
    0,                                     // greenFeeMin
    0,                                     // greenFeeMax
    0,                                     // prepaidBalance
    0,                                     // depositBalance
    'active',                              // status
    null,                                  // notes
    g.oyeoId || null,                      // oyeoId
    g.oyeoCode || null,                    // oyeoCode
    g.nameEn || null,                      // nameEn
    g.continent || null,                   // continent
    g.lat || null,                         // lat
    g.lng || null,                         // lng
    true,                                  // isActive
  ]);
  
  const placeholders = values.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
  const flatValues = values.flat();
  
  await conn.execute(
    `INSERT INTO affiliates (category, name, region, country, address, phone, email, website, contactPerson, contactName, contactPhone, type, contractType, supplyPrice, holeCount, courseCount, greenFeeMin, greenFeeMax, prepaidBalance, depositBalance, status, notes, oyeoId, oyeoCode, nameEn, continent, lat, lng, isActive) VALUES ${placeholders}`,
    flatValues
  );
  
  inserted += batch.length;
  console.log(`Inserted ${inserted}/${rawData.length}...`);
}

console.log(`\nDone! Total inserted: ${inserted}`);

// 통계
const [stats] = await conn.execute('SELECT type, COUNT(*) as cnt FROM affiliates WHERE oyeoId IS NOT NULL GROUP BY type');
console.log('Stats:', stats);

await conn.end();
