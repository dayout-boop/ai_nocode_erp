import mysql from 'mysql2/promise';
const c = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('ai_dev_requests','ai_dev_request_files','ai_git_commits')");
console.log(rows);
await c.end();
