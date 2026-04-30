/**
 * VariablePickerButton
 * ─────────────────────────────────────────────────────────────────
 * 텍스트 입력란 옆에 배치하는 "변수 목록" 아이콘 버튼.
 * 클릭 시 분류별 자동 치환 변수 목록 팝오버가 열리고,
 * 변수를 클릭하면 onInsert 콜백으로 해당 변수 문자열을 전달합니다.
 *
 * 사용법:
 *   <VariablePickerButton onInsert={(v) => insertAtCursor(v)} />
 *
 * 커서 위치 삽입이 필요한 경우 ref를 함께 사용하세요.
 */

import { useState, useRef, useEffect } from "react";
import { Braces } from "lucide-react";

// ─── 변수 분류 정의 ──────────────────────────────────────────────
export interface VariableItem {
  label: string;
  value: string;
  description?: string;
}

export interface VariableCategory {
  category: string;
  color: string; // tailwind bg color class
  items: VariableItem[];
}

export const VARIABLE_CATEGORIES: VariableCategory[] = [
  {
    category: "고객 정보",
    color: "bg-blue-50 border-blue-200 text-blue-700",
    items: [
      { label: "고객명", value: "{{고객명}}", description: "예약자 이름" },
      { label: "연락처", value: "{{연락처}}", description: "예약자 전화번호" },
    ],
  },
  {
    category: "예약 정보",
    color: "bg-green-50 border-green-200 text-green-700",
    items: [
      { label: "예약번호", value: "{{예약번호}}", description: "시스템 예약번호 (예: OY-202504-1234)" },
      { label: "출발일", value: "{{출발일}}", description: "출발 날짜" },
      { label: "귀국일", value: "{{귀국일}}", description: "귀국 날짜" },
      { label: "인원", value: "{{인원}}", description: "총 여행 인원 수" },
      { label: "팀수", value: "{{팀수}}", description: "골프 팀 수" },
      { label: "국가", value: "{{국가}}", description: "여행 목적지 국가" },
      { label: "상품군", value: "{{상품군}}", description: "상품 유형 (예: 3박4일)" },
    ],
  },
  {
    category: "골프 정보",
    color: "bg-emerald-50 border-emerald-200 text-emerald-700",
    items: [
      { label: "골프장", value: "{{골프장}}", description: "골프장 이름" },
      { label: "티타임", value: "{{티타임}}", description: "티오프 시간" },
    ],
  },
  {
    category: "숙박 정보",
    color: "bg-purple-50 border-purple-200 text-purple-700",
    items: [
      { label: "숙소", value: "{{숙소}}", description: "숙소 이름" },
    ],
  },
  {
    category: "금액 정보",
    color: "bg-amber-50 border-amber-200 text-amber-700",
    items: [
      { label: "판매가", value: "{{판매가}}", description: "총 판매 금액 (원 단위 포함)" },
      { label: "1인가격", value: "{{1인가격}}", description: "1인당 가격 (판매가 ÷ 인원)" },
    ],
  },
  {
    category: "담당자 정보",
    color: "bg-slate-50 border-slate-200 text-slate-700",
    items: [
      { label: "담당자", value: "{{담당자}}", description: "담당 직원 이름" },
      { label: "발송일", value: "{{발송일}}", description: "견적서 발송 날짜 (오늘)" },
    ],
  },
  {
    category: "일정 정보",
    color: "bg-teal-50 border-teal-200 text-teal-700",
    items: [
      { label: "일정표", value: "{{일정표}}", description: "일자별 골프장·숙소·항공 일정 자동 생성" },
    ],
  },
];

// ─── 유효 변수 Set (빠른 조회용) ─────────────────────────────────
export const VALID_VARIABLE_SET: Set<string> = new Set(
  VARIABLE_CATEGORIES.flatMap((cat) => cat.items.map((item) => item.value))
);

/**
 * 텍스트에서 {{변수명}} 패턴을 추출하고
 * 유효하지 않은 변수 목록을 반환합니다.
 *
 * @param texts 검사할 텍스트 배열 (여러 필드를 한 번에 검사)
 * @returns 잘못된 변수 문자열 배열 (중복 제거)
 */
export function validateVariables(texts: string[]): string[] {
  const pattern = /\{\{([^}]+)\}\}/g;
  const invalid = new Set<string>();
  for (const text of texts) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const full = `{{${match[1]}}}`;
      if (!VALID_VARIABLE_SET.has(full)) {
        invalid.add(full);
      }
    }
  }
  return Array.from(invalid);
}

// ─── 컴포넌트 ────────────────────────────────────────────────────
interface VariablePickerButtonProps {
  /** 변수 클릭 시 호출되는 콜백 */
  onInsert: (variable: string) => void;
  /** 버튼 크기 (기본 sm) */
  size?: "xs" | "sm" | "md";
  /** 팝오버 열리는 방향 (기본 bottom-left) */
  placement?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  /** 표시할 카테고리 필터 (미지정 시 전체 표시) */
  categories?: string[];
}

export default function VariablePickerButton({
  onInsert,
  size = "sm",
  placement = "bottom-left",
  categories,
}: VariablePickerButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filteredCategories = categories
    ? VARIABLE_CATEGORIES.filter((c) => categories.includes(c.category))
    : VARIABLE_CATEGORIES;

  const sizeClass = {
    xs: "w-5 h-5 text-[10px]",
    sm: "w-6 h-6 text-xs",
    md: "w-7 h-7 text-sm",
  }[size];

  const iconSize = { xs: 10, sm: 12, md: 14 }[size];

  // 팝오버 위치
  const placementClass = {
    "bottom-left": "top-full left-0 mt-1",
    "bottom-right": "top-full right-0 mt-1",
    "top-left": "bottom-full left-0 mb-1",
    "top-right": "bottom-full right-0 mb-1",
  }[placement];

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* 아이콘 버튼 */}
      <button
        type="button"
        title="변수 목록"
        onClick={() => setOpen((v) => !v)}
        className={`${sizeClass} inline-flex items-center justify-center rounded border border-green-300 bg-green-50 text-green-600 hover:bg-green-100 hover:border-green-400 transition-colors flex-shrink-0`}
      >
        <Braces size={iconSize} />
      </button>

      {/* 팝오버 */}
      {open && (
        <div
          className={`absolute ${placementClass} z-50 w-80 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden`}
          style={{ maxHeight: "420px", overflowY: "auto" }}
        >
          {/* 헤더 */}
          <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Braces size={13} className="text-green-600" />
              <span className="text-xs font-semibold text-gray-700">자동 치환 변수 목록</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-xs px-1"
            >
              ✕
            </button>
          </div>

          {/* 변수 목록 */}
          <div className="p-2 space-y-2">
            {filteredCategories.map((cat) => (
              <div key={cat.category}>
                {/* 카테고리 헤더 */}
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">
                  {cat.category}
                </div>
                {/* 변수 아이템 테이블 */}
                <div className="rounded-lg border border-gray-100 overflow-hidden">
                  <table className="w-full text-xs">
                    <tbody>
                      {cat.items.map((item, idx) => (
                        <tr
                          key={item.value}
                          className={`cursor-pointer hover:bg-green-50 transition-colors ${
                            idx !== cat.items.length - 1 ? "border-b border-gray-100" : ""
                          }`}
                          onClick={() => {
                            onInsert(item.value);
                            setOpen(false);
                          }}
                        >
                          <td className="py-1.5 pl-2 pr-1 w-24">
                            <code
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono border ${cat.color}`}
                            >
                              {item.value}
                            </code>
                          </td>
                          <td className="py-1.5 px-2 text-gray-500 text-[11px]">
                            {item.description ?? item.label}
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            <span className="text-[10px] text-green-500 font-medium">삽입</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* 푸터 안내 */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 px-3 py-1.5">
            <p className="text-[10px] text-gray-400">
              변수를 클릭하면 커서 위치에 삽입됩니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
