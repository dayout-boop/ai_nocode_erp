import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'ssl={"rejectUnauthorized":true}');

async function q(label, sql) {
  const [rows] = await conn.query(sql);
  console.log(`\n=== ${label} ===`);
  console.table(rows);
}

await q('테이블별 행수', `
  SELECT
    (SELECT COUNT(*) FROM tenants) AS tenants,
    (SELECT COUNT(*) FROM partner_onboarding) AS onboarding,
    (SELECT COUNT(*) FROM partners) AS partners,
    (SELECT COUNT(*) FROM affiliates) AS affiliates
`);

await q('tenants 구독 현황', `
  SELECT id, partnerId, companyName, subscriptionPlan, subscriptionStatus,
         DATE(subscriptionExpiresAt) AS expires, billingCycle, isActive
  FROM tenants ORDER BY id
`);

await q('partner_onboarding 현황', `
  SELECT id, partnerId, companyName, status, subscriptionPlan, billingCycle, DATE(createdAt) AS createdAt
  FROM partner_onboarding ORDER BY id
`);

await q('partners ↔ tenants 연결', `
  SELECT p.id AS partnerId, p.companyName, p.tenantId, t.id AS tId, t.subscriptionPlan, t.subscriptionStatus
  FROM partners p LEFT JOIN tenants t ON t.partnerId = p.id
  ORDER BY p.id
`);

await conn.end();
console.log('\n완료');
