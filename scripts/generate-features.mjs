/**
 * generate-features.mjs
 * 두골프 ERP 소스 코드를 스캔하여 docs/features.json을 자동 생성합니다.
 *
 * 실행: node scripts/generate-features.mjs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── 유틸리티 ────────────────────────────────────────────────────────────────
function readFile(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return "";
  return readFileSync(abs, "utf-8");
}

function now() {
  return new Date().toISOString().split("T")[0];
}

// ─── 1. App.tsx 라우트 스캔 ──────────────────────────────────────────────────
function scanRoutes() {
  const src = readFile("client/src/App.tsx");
  const routes = [];
  const routeRe = /path=\{?"([^"]+)"\}?\s+component=\{(\w+)\}/g;
  let m;
  while ((m = routeRe.exec(src)) !== null) {
    routes.push({ path: m[1], component: m[2] });
  }
  return routes;
}

// ─── 2. ERPLayout.tsx 메뉴 스캔 ─────────────────────────────────────────────
function scanMenus() {
  const src = readFile("client/src/components/ERPLayout.tsx");
  const menus = [];
  const labelRe = /label:\s*"([^"]+)",\s*href:\s*"([^"]+)"/g;
  let m;
  while ((m = labelRe.exec(src)) !== null) {
    menus.push({ label: m[1], href: m[2] });
  }
  return menus;
}

// ─── 3. DB 스키마 스캔 ──────────────────────────────────────────────────────
function scanSchema() {
  const src = readFile("drizzle/schema.ts");
  const tables = [];
  const tableRe = /export const (\w+)\s*=\s*mysqlTable\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = tableRe.exec(src)) !== null) {
    tables.push({ varName: m[1], tableName: m[2] });
  }
  return tables;
}

// ─── 4. tRPC 라우터 스캔 ────────────────────────────────────────────────────
function scanRouters() {
  const mainSrc = readFile("server/routers.ts");
  const routers = [];

  const routerRe = /const (\w+Router)\s*=\s*router\(\{/g;
  let m;
  while ((m = routerRe.exec(mainSrc)) !== null) {
    if (!routers.includes(m[1])) routers.push(m[1]);
  }

  const routersDir = join(ROOT, "server/routers");
  if (existsSync(routersDir)) {
    const files = readdirSync(routersDir).filter((f) => f.endsWith(".ts"));
    for (const f of files) {
      const src = readFile(`server/routers/${f}`);
      const re = /export const (\w+Router)\s*=\s*router\(\{/g;
      let mm;
      while ((mm = re.exec(src)) !== null) {
        if (!routers.includes(mm[1])) routers.push(mm[1]);
      }
    }
  }

  return routers;
}

// ─── 5. 카테고리 분류 로직 ──────────────────────────────────────────────────
function categorize(path, label) {
  if (!path && !label) return "기타";
  const s = ((path ?? "") + " " + (label ?? "")).toLowerCase();
  if (s.includes("ai-engine") || s.includes("ai_engine") || s.includes("orchestrat") || s.includes("openrouter")) return "AI 엔진 관리";
  if (s.includes("master-ai") || s.includes("golftalk") || s.includes("manager-admin") || s.includes("챗봇") || s.includes("chat")) return "AI 챗봇";
  if (s.includes("gemini") || s.includes("ai-logs") || s.includes("ai_logs")) return "AI 마스터";
  if (s.includes("dev-ai") || s.includes("dev_ai") || s.includes("ai-dev") || s.includes("devrequest")) return "DevAI";
  if (s.includes("package") || s.includes("상품")) return "ERP-상품관리";
  if (s.includes("booking") || s.includes("reservation") || s.includes("예약") || s.includes("estimate") || s.includes("inquiry")) return "ERP-예약관리";
  if (s.includes("finance") || s.includes("settlement") || s.includes("자금") || s.includes("정산")) return "ERP-자금/정산";
  if (s.includes("crm") || s.includes("customer") || s.includes("partner") || s.includes("affiliate")) return "ERP-CRM";
  if (s.includes("cms") || s.includes("notice") || s.includes("banner") || s.includes("variable")) return "ERP-CMS";
  if (s.includes("stripe") || s.includes("payment") || s.includes("결제")) return "외부연동-결제";
  if (s.includes("kakao") || s.includes("알림톡")) return "외부연동-카카오";
  if (s.includes("runway") || s.includes("video") || s.includes("동영상")) return "외부연동-미디어";
  if (s.includes("n8n") || s.includes("automation") || s.includes("자동화")) return "외부연동-자동화";
  if (s.includes("slack")) return "외부연동-Slack";
  if (s.includes("home") || s.includes("홈") || s.includes("gallery") || s.includes("notice")) return "고객 홈페이지";
  if (s.includes("schema") || s.includes("table") || s.includes("db") || s.includes("migration")) return "DB";
  return "ERP-기타";
}

// ─── 6. 메인 생성 로직 ──────────────────────────────────────────────────────
function generateFeatures() {
  const routes = scanRoutes();
  const menus = scanMenus();
  const tables = scanSchema();
  const routerNames = scanRouters();

  const features = [];
  let idCounter = 1;

  // 라우트 기반 기능 생성
  for (const route of routes) {
    const menuItem = menus.find(
      (m) => m.href === route.path || route.path.startsWith(m.href + "/")
    );
    const label = menuItem?.label ?? route.component;
    const category = categorize(route.path, label);
    features.push({
      id: `route-${route.path.replace(/\//g, "-").replace(/^-/, "")}`,
      name: label,
      category,
      status: "done",
      description: `${route.path} 페이지 (${route.component})`,
      module: "frontend",
      route: route.path,
      since: "2026-04-01",
      updatedAt: now(),
      tags: ["page", "route"],
    });
  }

  // tRPC 라우터 기반 기능 생성
  for (const routerName of routerNames) {
    const category = categorize(routerName, "");
    features.push({
      id: `router-${routerName}`,
      name: `API: ${routerName}`,
      category,
      status: "done",
      description: `tRPC ${routerName} 라우터`,
      module: "backend",
      since: "2026-04-01",
      updatedAt: now(),
      tags: ["api", "trpc", "router"],
    });
  }

  // DB 테이블 기반 기능 생성
  for (const table of tables) {
    features.push({
      id: `db-${table.tableName}`,
      name: `DB: ${table.tableName}`,
      category: "DB",
      status: "done",
      description: `${table.tableName} 테이블 (Drizzle ORM)`,
      module: "database",
      since: "2026-04-01",
      updatedAt: now(),
      tags: ["database", "schema"],
    });
  }

  // override 파일 병합
  const overridePath = join(ROOT, "docs/features.override.json");
  let overrides = [];
  if (existsSync(overridePath)) {
    try {
      overrides = JSON.parse(readFileSync(overridePath, "utf-8"));
    } catch (e) {
      console.warn("⚠️  features.override.json 파싱 오류:", e.message);
    }
  }

  for (const ov of overrides) {
    const idx = features.findIndex((f) => f.id === ov.id);
    if (idx >= 0) {
      features[idx] = { ...features[idx], ...ov };
    } else {
      features.push({ updatedAt: now(), ...ov });
    }
  }

  // 결과 저장
  const output = {
    generatedAt: new Date().toISOString(),
    version: "1.0.0",
    totalCount: features.length,
    features,
  };

  const outPath = join(ROOT, "docs/features.json");
  const prevContent = existsSync(outPath) ? readFileSync(outPath, "utf-8") : "{}";
  writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`✅ features.json 생성 완료: ${features.length}개 항목`);

  // CHANGELOG 갱신
  generateChangelog(features, prevContent);

  return output;
}

// ─── 7. CHANGELOG 자동 갱신 ─────────────────────────────────────────────────
function generateChangelog(features, prevContent) {
  let prevFeatures = [];
  try {
    const prev = JSON.parse(prevContent);
    prevFeatures = prev.features ?? [];
  } catch {}

  const prevIds = new Set(prevFeatures.map((f) => f.id));
  const newItems = features.filter((f) => !prevIds.has(f.id));

  const changelogPath = join(ROOT, "docs/CHANGELOG.md");
  const existing = existsSync(changelogPath) ? readFileSync(changelogPath, "utf-8") : "";

  if (newItems.length === 0 && existing) {
    console.log("ℹ️  변경 사항 없음 — CHANGELOG 갱신 생략");
    return;
  }

  const dateStr = now();
  let entry = `\n## [${dateStr}] — 자동 생성\n\n`;
  if (newItems.length > 0) {
    entry += `### 신규 추가 (${newItems.length}개)\n\n`;
    for (const item of newItems) {
      entry += `- **${item.name}** (${item.category}) — ${item.description}\n`;
    }
    entry += "\n";
  }
  entry += `> 전체 기능 수: ${features.length}개\n`;

  const header = `# 두골프 ERP 기능 변경 이력 (CHANGELOG)\n\n> 이 파일은 \`scripts/generate-features.mjs\`에 의해 자동 생성됩니다.\n`;
  // 기존 헤더 제거 후 새 항목 앞에 삽입
  const bodyWithoutHeader = existing
    .replace(/^# 두골프 ERP 기능 변경 이력[^\n]*\n\n>[^\n]*\n/, "")
    .trimStart();
  writeFileSync(changelogPath, header + entry + bodyWithoutHeader, "utf-8");
  console.log(`✅ CHANGELOG.md 갱신 완료: ${newItems.length}개 신규 항목`);
}

// ─── 실행 ────────────────────────────────────────────────────────────────────
generateFeatures();
