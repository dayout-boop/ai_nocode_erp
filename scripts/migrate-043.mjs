import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS \`tenants\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`onboardingId\` int,
      \`partnerId\` int,
      \`slug\` varchar(100) NOT NULL,
      \`companyName\` varchar(200) NOT NULL,
      \`subscriptionPlan\` enum('starter','standard','premium') NOT NULL DEFAULT 'starter',
      \`billingCycle\` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
      \`subscriptionStatus\` enum('trial','active','suspended','cancelled') NOT NULL DEFAULT 'trial',
      \`subscriptionExpiresAt\` timestamp NULL,
      \`stripeCustomerId\` varchar(200),
      \`stripeSubscriptionId\` varchar(200),
      \`isActive\` boolean NOT NULL DEFAULT true,
      \`sampleCategory\` enum('golf_tour_domestic','golf_tour_overseas','golf_tour_mixed') DEFAULT 'golf_tour_mixed',
      \`sampleSeeded\` boolean NOT NULL DEFAULT false,
      \`memo\` text,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`tenants_id\` PRIMARY KEY(\`id\`),
      CONSTRAINT \`tenants_slug_unique\` UNIQUE(\`slug\`)
    )
  `);
  console.log("✅ tenants 테이블 생성 완료");
} catch (err) {
  if (err.code === "ER_TABLE_EXISTS_ERROR") {
    console.log("ℹ️ tenants 테이블 이미 존재");
  } else {
    console.error("❌ 오류:", err.message);
  }
} finally {
  await conn.end();
}
