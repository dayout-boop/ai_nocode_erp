import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.log('No DATABASE_URL'); process.exit(1); }

const conn = await mysql.createConnection(url);
console.log('--- reservation_itineraries ---');
const [rows] = await conn.execute('DESCRIBE reservation_itineraries');
rows.forEach(r => console.log(r.Field, '|', r.Type));
console.log('\n--- custom_variables ---');
try {
  const [rows2] = await conn.execute('DESCRIBE custom_variables');
  rows2.forEach(r => console.log(r.Field, '|', r.Type));
} catch(e) {
  console.log('custom_variables not yet created:', e.message);
}
await conn.end();
