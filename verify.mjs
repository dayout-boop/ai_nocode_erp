import 'dotenv/config';
import mysql from 'mysql2/promise';
const c = await mysql.createConnection(process.env.DATABASE_URL);
const [partners] = await c.query("SELECT id, companyName, loginId, tenantId, isActive, (loginPwHash IS NOT NULL) AS hasPw, googleEmail FROM partners WHERE id IN (180001,150003)");
const [tenants] = await c.query("SELECT id, companyName, partnerId, onboardingId, isActive FROM tenants WHERE id IN (1001,1002,1003)");
console.log("=== partners ==="); console.table(partners);
console.log("=== tenants ==="); console.table(tenants);
await c.end();
