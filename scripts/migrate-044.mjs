import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // portonePaymentId 컬럼 추가 (없으면)
  await conn.execute(`
    ALTER TABLE partner_onboarding 
    ADD COLUMN IF NOT EXISTS portonePaymentId VARCHAR(200) NULL
  `);
  console.log("✅ portonePaymentId 컬럼 추가 완료");
} catch (e) {
  if (e.code === "ER_DUP_FIELDNAME") {
    console.log("ℹ️ portonePaymentId 컬럼이 이미 존재합니다.");
  } else {
    throw e;
  }
} finally {
  await conn.end();
}
