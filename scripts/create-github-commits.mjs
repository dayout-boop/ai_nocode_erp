import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS github_commits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      devRequestId INT,
      commitSha VARCHAR(40) NOT NULL,
      commitMessage TEXT NOT NULL,
      authorName VARCHAR(100),
      authorEmail VARCHAR(320),
      committedAt TIMESTAMP,
      branch VARCHAR(100) DEFAULT 'main',
      filesChanged INT DEFAULT 0,
      additions INT DEFAULT 0,
      deletions INT DEFAULT 0,
      commitUrl VARCHAR(500),
      filesData JSON,
      linkType ENUM('auto', 'manual') NOT NULL DEFAULT 'manual',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ github_commits 테이블 생성 완료');
} catch (e) {
  console.error('❌ 오류:', e.message);
} finally {
  await conn.end();
}
