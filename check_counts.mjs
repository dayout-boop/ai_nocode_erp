import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: '/home/ubuntu/dogolf/.env' });
const u = new URL(process.env.DATABASE_URL);
const conn = await createConnection({
  host: u.hostname, port: parseInt(u.port)||3306,
  user: u.username, password: u.password,
  database: u.pathname.slice(1), ssl: { rejectUnauthorized: false }
});
const tables = ['reservations','income_records','remittance_records','deposit_records','charge_records','prepaid_records'];
for (const t of tables) {
  const [[r]] = await conn.execute('SELECT COUNT(*) as cnt FROM ' + t);
  console.log(t + ': ' + r.cnt + '개');
}
await conn.end();
