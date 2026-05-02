import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await conn.execute('DESCRIBE partner_onboarding');
  console.log('partner_onboarding fields:', rows.map(r => r.Field).join(', '));
} catch(e) {
  console.log('partner_onboarding not found:', e.message);
  // 직접 CREATE
  await conn.execute(`CREATE TABLE IF NOT EXISTS partner_onboarding (
    id int AUTO_INCREMENT PRIMARY KEY,
    status ENUM('pending','reviewing','approved','rejected','active') NOT NULL DEFAULT 'pending',
    companyName varchar(200) NOT NULL,
    businessNumber varchar(20),
    ceoName varchar(100),
    businessType varchar(100),
    businessItem varchar(100),
    address text,
    contactName varchar(100) NOT NULL,
    contactEmail varchar(320) NOT NULL,
    contactPhone varchar(30),
    businessLicenseKey varchar(500),
    businessLicenseUrl varchar(500),
    ocrRawText text,
    ocrResult text,
    sampleCategory ENUM('golf_tour_domestic','golf_tour_overseas','golf_tour_mixed') DEFAULT 'golf_tour_mixed',
    subscriptionPlan ENUM('starter','standard','premium') DEFAULT 'starter',
    billingCycle ENUM('monthly','yearly') DEFAULT 'monthly',
    stripeSessionId varchar(200),
    stripeSubscriptionId varchar(200),
    partnerId int,
    adminNote text,
    reviewedBy varchar(200),
    reviewedAt timestamp NULL,
    createdAt timestamp NOT NULL DEFAULT (now()),
    updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
  )`);
  console.log('Created partner_onboarding table');
}
await conn.end();
