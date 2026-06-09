/**
 * 마스터 전용 상단 테넌트 셀렉터 (방향 B).
 *
 * - 전체보기 / 두골프(T1) / 개별 파트너 테넌트 전환
 * - 선택값을 localStorage("erp_active_tenant")에 저장
 *   → main.tsx의 httpBatchLink headers()가 이를 읽어 x-active-tenant 헤더로 전송
 * - 선택 변경 시 tRPC 캐시를 무효화하기 위해 페이지를 새로고침(가장 확실한 데이터 격리)
 *
 * 보안: 이 컴포넌트는 마스터 세션에서만 렌더링한다. 파트너 세션에서는
 *      서버 partnerProcedure가 x-active-tenant 헤더를 무시하므로 영향 없음.
 */
import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Check, Globe } from "lucide-react";
import { trpc } from "@/lib/trpc";

const STORAGE_KEY = "erp_active_tenant";
const DOGOLF_TENANT_ID = 1;

/** 현재 선택된 테넌트 값 읽기 ("all" | 숫자문자열) */
function readActiveTenant(): string {
  if (typeof window === "undefined") return "all";
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "all";
  } catch {
    return "all";
  }
}

export default function TenantSelector() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>(() => readActiveTenant());
  const ref = useRef<HTMLDivElement>(null);

  // 테넌트 목록 조회 (마스터 전용 프로시저)
  const tenantsQuery = trpc.tenants.listForSelector.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (value: string) => {
    try {
      if (value === "all") {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, value);
      }
    } catch {
      // localStorage 접근 실패 시 무시
    }
    setActive(value);
    setOpen(false);
    // 데이터 전체를 새 테넌트 기준으로 다시 불러오기 위해 새로고침
    window.location.reload();
  };

  const tenants = tenantsQuery.data ?? [];
  const dogolf = tenants.find((t) => t.id === DOGOLF_TENANT_ID);
  const others = tenants.filter((t) => t.id !== DOGOLF_TENANT_ID);

  // 현재 선택 라벨 계산
  let currentLabel = "전체보기";
  if (active !== "all") {
    const sel = tenants.find((t) => String(t.id) === active);
    currentLabel = sel ? `${sel.companyName} (T${sel.id})` : `테넌트 #${active}`;
  }

  const isAll = active === "all";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
          isAll
            ? "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
        }`}
        title="보기 대상 테넌트 전환 (마스터 전용)"
      >
        {isAll ? <Globe size={13} /> : <Building2 size={13} />}
        <span className="max-w-[160px] truncate">{currentLabel}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-[100] overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            보기 대상 전환
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {/* 전체보기 */}
            <SelectorItem
              icon={<Globe size={14} className="text-slate-500" />}
              label="전체보기"
              sub="모든 테넌트 데이터"
              selected={isAll}
              onClick={() => handleSelect("all")}
            />

            {/* 두골프 (T1) - 마스터 테스트베드 */}
            {dogolf && (
              <SelectorItem
                icon={<Building2 size={14} className="text-indigo-600" />}
                label={`${dogolf.companyName} (T1)`}
                sub="마스터 · 개발 테스트베드"
                selected={active === String(dogolf.id)}
                onClick={() => handleSelect(String(dogolf.id))}
                highlight
              />
            )}

            {/* 개별 파트너 */}
            {others.length > 0 && (
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-400">파트너</div>
            )}
            {others.map((t) => (
              <SelectorItem
                key={t.id}
                icon={<Building2 size={14} className="text-emerald-600" />}
                label={`${t.companyName} (T${t.id})`}
                sub={t.isActive ? "활성" : "비활성"}
                selected={active === String(t.id)}
                onClick={() => handleSelect(String(t.id))}
              />
            ))}

            {tenantsQuery.isLoading && (
              <div className="px-3 py-3 text-center text-xs text-gray-400">불러오는 중...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectorItem({
  icon,
  label,
  sub,
  selected,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
        highlight ? "bg-indigo-50/40" : ""
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-gray-800 truncate">{label}</span>
        {sub && <span className="block text-[11px] text-gray-400 truncate">{sub}</span>}
      </span>
      {selected && <Check size={14} className="text-indigo-600 shrink-0" />}
    </button>
  );
}
