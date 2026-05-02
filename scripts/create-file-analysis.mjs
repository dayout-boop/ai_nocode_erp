import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

const sql = `
CREATE TABLE IF NOT EXISTS file_analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  fileName VARCHAR(500) NOT NULL,
  fileKey VARCHAR(500) NOT NULL,
  fileUrl VARCHAR(1000) NOT NULL,
  mimeType VARCHAR(100) NOT NULL,
  fileSize INT NOT NULL,
  extractedText TEXT,
  extractStatus ENUM('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
  extractError TEXT,
  sessionId VARCHAR(100),
  summary TEXT,
  analyzed BOOLEAN NOT NULL DEFAULT FALSE,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
`;

try {
  await conn.execute(sql);
  console.log("✅ file_analysis 테이블 생성 완료");
} catch (err) {
  console.error("❌ 테이블 생성 오류:", err.message);
} finally {
  await conn.end();
}
