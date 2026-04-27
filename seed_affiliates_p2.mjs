import { readFileSync } from 'fs';
import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
const conn = await createConnection(DATABASE_URL);

const rawData = JSON.parse(readFileSync(join(__dirname, 'golf_data_page2.json'), 'utf-8'));
console.log(`Loaded ${rawData.length} golf courses`);

// 이미 있는 oyeoId 확인
const [existing] = await conn.execute('SELECT oyeoId FROM affiliates WHERE oyeoId IS NOT NULL');
const existingIds = new Set(existing.map(r => r.oyeoId));
const newData = rawData.filter(g => !existingIds.has(g.oyeoId));
console.log(`New to insert: ${newData.length}`);

if (newData.length === 0) {
  console.log('No new data to insert');
  await conn.end();
  process.exit(0);
}

const batchSize = 100;
let inserted = 0;
for (let i = 0; i < newData.length; i += batchSize) {
  const batch = newData.slice(i, i + batchSize);
  const values = batch.map(g => [
    g.type === 'golf_domestic' ? 'golf_domestic' : 'golf_overseas',
    g.name || '', g.region || null, g.country || null,
    null, null, null, null, null, null, null,
    g.type || 'golf_domestic', 'direct', null, 18, 1, 0, 0, 0, 0, 'active', null,
    g.oyeoId || null, g.oyeoCode || null, g.nameEn || null,
    g.continent || null, g.lat || null, g.lng || null, true,
  ]);
  const placeholders = values.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
  await conn.execute(
    `INSERT INTO affiliates (category, name, region, country, address, phone, email, website, contactPerson, contactName, contactPhone, type, contractType, supplyPrice, holeCount, courseCount, greenFeeMin, greenFeeMax, prepaidBalance, depositBalance, status, notes, oyeoId, oyeoCode, nameEn, continent, lat, lng, isActive) VALUES ${placeholders}`,
    values.flat()
  );
  inserted += batch.length;
  console.log(`Inserted ${inserted}/${newData.length}...`);
}

const [stats] = await conn.execute('SELECT type, COUNT(*) as cnt FROM affiliates WHERE oyeoId IS NOT NULL GROUP BY type');
console.log('Total stats:', stats);
await conn.end();
