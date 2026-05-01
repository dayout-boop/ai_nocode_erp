import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.log('No DATABASE_URL'); process.exit(1); }

const conn = await mysql.createConnection(url);
console.log('--- system_settings ---');
try {
  const [rows] = await conn.execute('DESCRIBE system_settings');
  rows.forEach(r => console.log(r.Field, '|', r.Type));
} catch(e) {
  console.log('system_settings not found:', e.message);
}
console.log('\n--- manus_task_candidates ---');
try {
  const [rows2] = await conn.execute('DESCRIBE manus_task_candidates');
  rows2.forEach(r => console.log(r.Field, '|', r.Type));
} catch(e) {
  console.log('manus_task_candidates not found:', e.message);
}
await conn.end();
