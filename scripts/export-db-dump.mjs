/**
 * 두골프 서버 완전이전 — MySQL DB 덤프 스크립트 [STEP5 §데이터/Git 완전 이전 지침]
 * ------------------------------------------------------------------
 * 마누스 구독 해지/서버 이전 시, DATABASE_URL 이 가리키는 DB 전체를
 * 단일 .sql 파일로 덤프한다. 새 서버에서 import 하면 그대로 복원된다.
 *
 *   node scripts/export-db-dump.mjs
 *   → ./backups/dogolf-dump-YYYYMMDD-HHmm.sql 생성
 *
 * 의존성: mysqldump(시스템) 또는 mysql2(폴백). 외부 SaaS 의존 0.
 * 보안: 출력 .sql 에는 비즈니스 데이터가 포함되므로 프라이빗 저장소/USB로만 이동.
 */
import { execFile } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const execFileAsync = promisify(execFile);

function parseDbUrl(url) {
  // mysql://user:pass@host:port/dbname
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || "3306",
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  };
}

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const outDir = path.resolve("backups");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `dogolf-dump-${stamp}.sql`);

const cfg = parseDbUrl(process.env.DATABASE_URL);

async function dumpViaMysqldump() {
  const args = [
    `-h${cfg.host}`,
    `-P${cfg.port}`,
    `-u${cfg.user}`,
    `-p${cfg.password}`,
    "--single-transaction",
    "--no-tablespaces",
    "--set-gtid-purged=OFF",
    cfg.database,
  ];
  const { stdout } = await execFileAsync("mysqldump", args, { maxBuffer: 1024 * 1024 * 512 });
  const fs = await import("node:fs/promises");
  await fs.writeFile(outFile, stdout);
}

/** mysqldump 미설치 시 순수 JS 폴백 — 테이블별 CREATE + INSERT 생성 */
async function dumpViaJs() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const ws = createWriteStream(outFile);
  const write = (s) => new Promise((res) => ws.write(s, res));
  await write(`-- dogolf JS fallback dump @ ${stamp}\nSET FOREIGN_KEY_CHECKS=0;\n\n`);
  const [tables] = await conn.query("SHOW TABLES");
  const key = Object.keys(tables[0] ?? {})[0];
  for (const row of tables) {
    const t = row[key];
    const [[{ "Create Table": ddl }]] = await conn.query(`SHOW CREATE TABLE \`${t}\``);
    await write(`DROP TABLE IF EXISTS \`${t}\`;\n${ddl};\n\n`);
    const [rows] = await conn.query(`SELECT * FROM \`${t}\``);
    for (const r of rows) {
      const cols = Object.keys(r).map((c) => `\`${c}\``).join(",");
      const vals = Object.values(r)
        .map((v) => (v === null ? "NULL" : typeof v === "number" ? v : `'${String(v).replace(/'/g, "''")}'`))
        .join(",");
      await write(`INSERT INTO \`${t}\` (${cols}) VALUES (${vals});\n`);
    }
    await write("\n");
  }
  await write("SET FOREIGN_KEY_CHECKS=1;\n");
  await new Promise((res) => ws.end(res));
  await conn.end();
}

try {
  try {
    await dumpViaMysqldump();
    console.log(`✅ mysqldump 완료 → ${outFile}`);
  } catch {
    console.log("ℹ️ mysqldump 미사용 가능 — JS 폴백으로 덤프합니다.");
    await dumpViaJs();
    console.log(`✅ JS 폴백 덤프 완료 → ${outFile}`);
  }
  console.log("⚠️ 이 파일에는 운영 데이터가 포함됩니다. 프라이빗 저장소/USB로만 이동하세요.");
} catch (e) {
  console.error("❌ 덤프 실패:", e.message);
  process.exit(1);
}
