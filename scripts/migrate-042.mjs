import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

const sql = readFileSync('./drizzle/0042_partner_onboarding.sql', 'utf8');
const stmts = sql.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'));

const conn = await createConnection(process.env.DATABASE_URL);
for (const stmt of stmts) {
  try {
    await conn.execute(stmt);
    console.log('OK:', stmt.slice(0, 60));
  } catch(e) {
    console.log('ERR:', e.message.slice(0, 80));
  }
}
await conn.end();
console.log('Done');
