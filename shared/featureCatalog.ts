/**
 * 기능 권한 카탈로그 (서버 ↔ 클라이언트 공유 · 단일 소스)
 * ============================================================
 * [목적]
 *   파트너 담당자(직원)별로 ON/OFF 할 수 있는 "기능 권한"의 단일 정의 지점.
 *   서버(검증·기본값)와 UI(목록·그룹·NEW 배지)가 오직 이 파일만 참조한다.
 *
 * [신규 기능 추가 방법] — 이게 핵심입니다.
 *   새 기능이 생기면 아래 FEATURE_CATALOG 배열에 항목 한 줄만 추가하면 됩니다.
 *   그러면 권한 설정 화면, 카테고리 그룹핑, 기본 허용(enabled=true),
 *   "NEW" 배지가 모두 자동으로 최신화됩니다. (별도 마이그레이션/DB 작업 불필요)
 *
 * [기본값 규칙]
 *   partner_staff_permissions 테이블에 해당 (staffId, feature) 행이 없으면
 *   기본 enabled=true 로 간주한다. 즉 신규 기능은 자동으로 "허용" 상태로 즉시 편입되며,
 *   대표가 명시적으로 끌 때만 OFF 행이 생성된다.
 *   (참고: 일부 민감 기능은 defaultEnabled=false 로 지정해 기본 차단할 수 있다.)
 *
 * [카테고리]
 *   category 값으로 화면이 자동 그룹핑된다. CATEGORY_ORDER 로 표시 순서를 제어한다.
 *
 * [NEW 배지]
 *   since(추가 일자, YYYY-MM-DD)를 기준으로 NEW_BADGE_DAYS(기본 30일) 이내면
 *   화면에 "NEW" 배지가 표시되어 대표가 새 권한 항목을 인지할 수 있다.
 */

export interface FeatureDef {
  /** 기능 식별자 (영구 불변, DB의 feature 컬럼에 저장됨) */
  key: string;
  /** 화면 표시 라벨 */
  label: string;
  /** 분류 카테고리 (화면 자동 그룹핑 기준) */
  category: string;
  /** 기본 허용 여부 (행이 없을 때 적용, 기본 true) */
  defaultEnabled?: boolean;
  /** 기능 추가 일자 (YYYY-MM-DD). NEW 배지 판정에 사용 */
  since?: string;
  /** 기능 설명 (선택, 툴팁 등) */
  description?: string;
}

/** 카테고리 표시 순서 (없는 카테고리는 뒤에 자동 배치) */
export const CATEGORY_ORDER: string[] = [
  "예약 관리",
  "자금 관리",
  "상품 관리",
  "고객 관리",
  "파일 관리",
  "AI 자동화",
  "기타",
];

/** NEW 배지를 표시할 기간 (일) */
export const NEW_BADGE_DAYS = 30;

/**
 * 기능 카탈로그 — 신규 기능은 여기에 한 줄만 추가하세요.
 * key 는 한 번 정하면 절대 바꾸지 마세요 (DB 저장값과 매칭됨).
 */
export const FEATURE_CATALOG: FeatureDef[] = [
  // ── 예약 관리 ──
  { key: "booking_manage", label: "예약 관리 (등록/수정)", category: "예약 관리", since: "2026-06-01" },
  { key: "booking_void", label: "예약 삭제(취소 상태 전환)", category: "예약 관리", since: "2026-06-12" },

  // ── 자금 관리 ──
  { key: "finance_manage", label: "자금 등록 (입금/송금/예치/충전/선충전)", category: "자금 관리", since: "2026-06-12" },
  { key: "finance_void", label: "자금 삭제(취소 상태 전환)", category: "자금 관리", since: "2026-06-12" },

  // ── 상품 관리 ──
  { key: "package_manage", label: "상품 관리 (등록/수정)", category: "상품 관리", since: "2026-06-01" },

  // ── 고객 관리 ──
  { key: "inquiry_manage", label: "문의 관리 및 답변", category: "고객 관리", since: "2026-06-01" },

  // ── 파일 관리 ──
  { key: "file_analysis", label: "파일 분석 업로드", category: "파일 관리", since: "2026-06-01" },

  // ── AI 자동화 ──
  { key: "ai_package_pipeline", label: "AI 상품 자동생성 파이프라인", category: "AI 자동화", since: "2026-06-01" },
  { key: "ai_package_desc", label: "AI 상품 설명 초안 생성", category: "AI 자동화", since: "2026-06-01" },
  { key: "ai_marketing_copy", label: "AI 마케팅 문구 생성", category: "AI 자동화", since: "2026-06-01" },
  { key: "ai_inquiry_reply", label: "AI 문의 답변 초안 생성", category: "AI 자동화", since: "2026-06-01" },
  { key: "ai_erp_analysis", label: "AI ERP 데이터 분석", category: "AI 자동화", since: "2026-06-01" },
];

export type FeatureKey = string;

/** 카탈로그를 객체 맵으로 (key → FeatureDef) */
export const FEATURE_MAP: Record<string, FeatureDef> = Object.fromEntries(
  FEATURE_CATALOG.map((f) => [f.key, f]),
);

/** 유효한 기능 key 인지 검증 (서버 입력 검증용) */
export function isValidFeatureKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(FEATURE_MAP, key);
}

/** 특정 기능의 기본 허용 여부 (행이 없을 때 적용) */
export function getDefaultEnabled(key: string): boolean {
  const def = FEATURE_MAP[key];
  // 카탈로그에 없는(이미 폐기된) key 도 기본 허용으로 간주해 잠금 사고를 방지
  if (!def) return true;
  return def.defaultEnabled !== false;
}

/**
 * 특정 기능이 NEW(최근 추가)인지 판정.
 * @param key 기능 key
 * @param now 기준 시각 (테스트 주입용, 기본 현재)
 */
export function isNewFeature(key: string, now: Date = new Date()): boolean {
  const def = FEATURE_MAP[key];
  if (!def?.since) return false;
  const since = new Date(def.since + "T00:00:00Z").getTime();
  if (Number.isNaN(since)) return false;
  const diffDays = (now.getTime() - since) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= NEW_BADGE_DAYS;
}

/** 카테고리 정렬 비교값 (CATEGORY_ORDER 기준, 없으면 뒤로) */
export function categorySortIndex(category: string): number {
  const idx = CATEGORY_ORDER.indexOf(category);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

/**
 * DB 저장 권한 행(없으면 기본값)과 카탈로그를 병합해
 * 화면/검증에서 바로 쓸 수 있는 "효과적 권한 목록"을 만든다.
 * @param savedRows DB의 (feature, enabled) 행 목록
 * @param now NEW 배지 판정 기준 시각 (선택)
 */
export interface EffectivePermission {
  feature: string;
  label: string;
  category: string;
  enabled: boolean;
  isNew: boolean;
}

export function mergePermissions(
  savedRows: Array<{ feature: string; enabled: boolean }>,
  now: Date = new Date(),
): EffectivePermission[] {
  const savedMap = new Map(savedRows.map((r) => [r.feature, r.enabled]));
  return [...FEATURE_CATALOG]
    .sort((a, b) => {
      const ci = categorySortIndex(a.category) - categorySortIndex(b.category);
      return ci !== 0 ? ci : a.label.localeCompare(b.label, "ko");
    })
    .map((f) => ({
      feature: f.key,
      label: f.label,
      category: f.category,
      enabled: savedMap.has(f.key) ? savedMap.get(f.key)! : getDefaultEnabled(f.key),
      isNew: isNewFeature(f.key, now),
    }));
}
