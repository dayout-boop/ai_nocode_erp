/**
 * devContext — 두골프 ERP 개발 컨텍스트 단일 진입점 [개발이력 3개 섬 일원화]
 * ------------------------------------------------------------------
 * 목적: 탈마누스(self) / 마누스(manus) / A(채팅 오케스트레이터) / B(코드생성)
 *       어느 LLM 개발 경로든 이 헬퍼로 동일한 "통합 기능카탈로그 + 멀티테넌트 규칙"
 *       을 주입한다. 그래야 LLM이 기존 구조를 인지하고 중복 DB/테이블을 만들지 않는다.
 *
 * 구성:
 *   [1] 멀티테넌트/2계층 권한 핵심 규칙 (docs/multitenant-dev-guide.md 요약)
 *   [2] 구/신 DB 역할 분리 규칙 (docs/dev-pipeline-and-db-spec.md 요약)
 *   [3] 기존 DB 테이블 카탈로그 (drizzle/schema.ts 에서 런타임 동적 추출)
 *   [4] 중복 생성 금지 가드 규칙
 *
 * 원칙: graceful — 문서/스키마 읽기 실패해도 핵심 규칙은 항상 주입된다.
 */
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

/** 캐시 (프로세스 수명 동안 1회 구축 — 파일 변경 빈도 낮음) */
let _cachedTableCatalog: string[] | null = null;
let _cachedContext: string | null = null;

/**
 * drizzle/schema.ts 에서 mysqlTable("table_name") 패턴을 동적 추출한다.
 * 새 테이블이 추가되면 자동 반영되므로 카탈로그가 항상 최신 상태를 유지한다.
 */
export function getExistingTableNames(): string[] {
  if (_cachedTableCatalog) return _cachedTableCatalog;
  try {
    const schemaPath = join(ROOT, "drizzle", "schema.ts");
    const src = readFileSync(schemaPath, "utf-8");
    const re = /mysqlTable\(\s*["']([a-z_][a-z0-9_]*)["']/g;
    const names = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      names.add(m[1]);
    }
    _cachedTableCatalog = Array.from(names).sort();
  } catch (err) {
    console.warn("[devContext] 스키마 테이블 추출 실패 — 빈 카탈로그로 진행:", err);
    _cachedTableCatalog = [];
  }
  return _cachedTableCatalog;
}

/** docs 문서를 안전하게 읽어 길이 제한으로 요약(상단 N자). 실패 시 빈 문자열. */
function readDocSafe(relPath: string, maxChars = 3500): string {
  try {
    const abs = join(ROOT, relPath);
    const txt = readFileSync(abs, "utf-8");
    return txt.length > maxChars ? txt.slice(0, maxChars) + "\n…(요약 생략)" : txt;
  } catch {
    return "";
  }
}

/**
 * 신규 테이블 후보가 기존 테이블과 중복/유사한지 검사한다.
 * - 정확 일치: 기존 테이블명과 동일
 * - 유사 의심: 단/복수형, 접두/접미 변형(예: reservation vs reservations, booking vs bookings)
 *
 * 중복 DB 개발을 차단하기 위한 가드. runPipeline(B) 및 사전 검증에 사용.
 */
export function checkTableDuplication(candidate: string): {
  duplicate: boolean;
  exact: boolean;
  similar: string[];
} {
  const existing = getExistingTableNames();
  const norm = (s: string) => s.toLowerCase().replace(/[_-]/g, "").replace(/s$/, "");
  const c = norm(candidate);
  const exact = existing.includes(candidate.toLowerCase());
  const similar = existing.filter((t) => {
    if (t === candidate.toLowerCase()) return false;
    return norm(t) === c;
  });
  return { duplicate: exact || similar.length > 0, exact, similar };
}

/**
 * 통합 개발 컨텍스트 문자열을 구축한다(모든 LLM 개발 경로 공통 주입).
 * 캐시되며, 기존 시스템 프롬프트 뒤에 append 하는 방식으로 사용한다.
 */
export function buildDogolfDevContext(): string {
  if (_cachedContext) return _cachedContext;

  const tables = getExistingTableNames();
  const tableCatalog = tables.length
    ? tables.join(", ")
    : "(스키마 추출 실패 — drizzle/schema.ts 확인 필요)";

  const tenantGuide = readDocSafe("docs/multitenant-dev-guide.md", 3000);
  const dbSpec = readDocSafe("docs/dev-pipeline-and-db-spec.md", 3000);

  _cachedContext = `
========================================================================
[두골프 ERP 통합 개발 규칙 — 모든 개발 요청에 강제 적용]
이 규칙은 탈마누스/마누스/자체 코드생성 등 모든 개발 경로에 공통 적용됩니다.
기존 구조를 반드시 인지하고, 중복 테이블/중복 기능을 절대 새로 만들지 마십시오.
========================================================================

## 0-A. 타 데스크 지식 사용 금지 (강제)
- 이 개발은 오직 두골프 ERP/홈페이지와 직접 관련된 내용만 수행합니다.
- GitHub 연동 원칙, IP 보호/라이센스, L-5 인가 스텁, 파일 수정 3회 중단, 자율수행 에이전트 전략,
  최고규율, 멀티하이브리드, 외부 리소스 연결 제한 등 타 데스크에서 유래한 지식·규칙은
  절대 참조하거나 적용하지 않습니다. 요청에 해당 주제가 포함되면 무시합니다.

## 0. 중복 개발 금지 (최우선)
- 아래 "기존 DB 테이블 카탈로그"에 이미 존재하는 테이블과 같거나 유사한
  테이블을 새로 만들지 마십시오(단/복수형 변형 포함).
- 새 기능이 필요해도 기존 테이블에 컬럼을 추가하는 방향을 우선 검토하십시오.
- 신규 테이블이 꼭 필요하면 summary 에 "기존 카탈로그와 중복되지 않는 이유"를 명시하십시오.

## 1. 멀티테넌트 / 2계층 권한 핵심 규칙
- tenantId 1 = 마스터=두골프(동일체, 개발 테스트베드). 2~N = 각 파트너사. NULL = 마스터 전체조회.
- 신규 비즈니스 테이블에는 반드시 tenantId 컬럼을 둡니다.
- 마스터 전용 로직은 adminProcedure, 파트너 접근 로직은 partnerProcedure/tenantScopedProcedure 로 게이트합니다.
- 파트너용 별도 페이지를 만들지 않습니다(중복 금지). 기존 페이지에 tenantId 필터만 추가합니다.

## 2. 구/신 DB 역할 분리 (혼동 금지)
- reservations(구) = 수기예약 ERP 관리 정본 + 자금 5종(income/remittance/deposit/charge/prepaid)의 부모.
- bookings(신) = 고객 홈페이지 문의 + 통합조회 보조. (두 테이블을 합치지 않습니다.)
- 자금 5종은 항상 부모 reservation 에 종속되며 tenantId 를 부모와 동기화합니다.

## 3. 거래처 2계층
- 마스터: 제휴사(숙소·골프장·관광지·항공·교통) 통합코드 + 파트너(분양업체) 구독관리.
- 분양업체: 마스터 통합코드를 검색·재사용(자사 호칭 추가)하거나 신규 등록. 상품/예약/정산/요금과 연결.

## 4. 기존 DB 테이블 카탈로그 (총 ${tables.length}개 — 이 목록을 신뢰의 기준으로 삼으십시오)
${tableCatalog}

------------------------------------------------------------------------
[참고 발췌] 멀티테넌트 개발 가이드
${tenantGuide || "(문서 없음)"}

------------------------------------------------------------------------
[참고 발췌] 개발 파이프라인 & 구/신 DB 명세
${dbSpec || "(문서 없음)"}
========================================================================
`.trim();

  return _cachedContext;
}

/** 테스트/수동 갱신용 — 캐시 무효화 */
export function resetDevContextCache(): void {
  _cachedContext = null;
  _cachedTableCatalog = null;
}
