import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT id, username, role, isActive FROM admin_accounts LIMIT 10');
console.log(JSON.stringify(rows, null, 2));
await conn.end();
