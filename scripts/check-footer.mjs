import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT id, companyName, copyright, businessNumber FROM site_footer LIMIT 5');
console.log('site_footer:', JSON.stringify(rows, null, 2));
const [rows2] = await conn.execute('SELECT settingKey, settingValue FROM site_settings WHERE settingKey IN ("companyName","businessName","businessNumber") LIMIT 10');
console.log('site_settings:', JSON.stringify(rows2, null, 2));
await conn.end();
