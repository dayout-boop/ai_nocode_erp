// ============================================================
// DOGOLF DepartureDateCalendar — dogolf.com 참고 달력형 날짜/요금 선택 UI
// - 오늘 이후 날짜만 표시
// - 슬롯 있는 날짜: 요금 표시 + 클릭 선택
// - 슬롯 없는 날짜: 회색 비활성
// - 슬롯 없는 상품: "개별 문의" 안내
// ============================================================
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, AlertCircle } from "lucide-react";

interface Slot {
  id: number;
  departureDate: Date | string;
  returnDate?: Date | string | null;
  totalSlots?: number | null;
  minPax?: number | null;
  bookedSlots?: number | null;
  status: string;
  priceOverride?: string | null;
  adultPrice?: string | null;
  childPrice?: string | null;
  infantPrice?: string | null;
  notes?: string | null;
}

interface DepartureDateCalendarProps {
  slots: Slot[];
  basePrice?: number | null; // packagePrices 최저가 (슬롯 priceOverride 없을 때 폴백)
  onSelect?: (slot: Slot | null) => void;
  selectedSlotId?: number | null;
}

function formatPrice(price: number): string {
  if (price >= 10000) {
    const man = price / 10000;
    return man % 1 === 0 ? `${man}만` : `${man.toFixed(1)}만`;
  }
  return price.toLocaleString();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function DepartureDateCalendar({
  slots,
  basePrice,
  onSelect,
  selectedSlotId,
}: DepartureDateCalendarProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // 초기 월: 첫 번째 슬롯의 월 또는 현재 월
  const firstSlotDate = useMemo(() => {
    if (slots.length === 0) return today;
    const d = new Date(slots[0].departureDate);
    return d;
  }, [slots, today]);

  const [viewYear, setViewYear] = useState(firstSlotDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(firstSlotDate.getMonth()); // 0-indexed

  // 슬롯을 날짜별 Map으로 변환
  const slotMap = useMemo(() => {
    const map = new Map<string, Slot>();
    slots.forEach((s) => {
      const d = new Date(s.departureDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      // 같은 날짜에 여러 슬롯이 있으면 priceOverride가 있는 것 우선
      const existing = map.get(key);
      if (!existing || (s.priceOverride && !existing.priceOverride)) {
        map.set(key, s);
      }
    });
    return map;
  }, [slots]);

  // 현재 보기 월의 달력 데이터 생성
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startDow = firstDay.getDay(); // 0=일
    const days: (Date | null)[] = [];
    // 앞 빈칸
    for (let i = 0; i < startDow; i++) days.push(null);
    // 날짜
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(viewYear, viewMonth, d));
    }
    return days;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // 이전 달 비활성화: 현재 월 이전으로 못 가게
  const canGoPrev = viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  // 슬롯 없는 상품
  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800 font-body">현재 예약 가능한 출발일이 없습니다</p>
          <p className="text-xs text-amber-600 font-body mt-1">
            개별 문의를 통해 원하시는 날짜를 알려주시면 맞춤 일정을 안내해 드립니다.
          </p>
        </div>
      </div>
    );
  }

  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="select-none">
      {/* 달력 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold text-gray-800 font-body">
          {viewYear}년 {viewMonth + 1}월
        </span>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[11px] font-semibold py-1 font-body ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-y-1">
        {calendarDays.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} />;

          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          const slot = slotMap.get(key);
          const isPast = date < today;
          const isToday = isSameDay(date, today);
          const isSunday = date.getDay() === 0;
          const isSaturday = date.getDay() === 6;
          const isSelected = slot && slot.id === selectedSlotId;

          // 가격 결정 (adultPrice > priceOverride > basePrice 순서)
          const price = slot?.adultPrice
            ? Number(slot.adultPrice)
            : slot?.priceOverride
            ? Number(slot.priceOverride)
            : (basePrice ?? null);

          const hasSlot = !!slot && !isPast;

          return (
            <button
              key={key}
              disabled={!hasSlot}
              onClick={() => hasSlot && onSelect?.(slot!)}
              className={[
                "flex flex-col items-center justify-start py-1.5 rounded-lg text-center transition-all",
                hasSlot ? "cursor-pointer hover:bg-green-50" : "cursor-default",
                isSelected ? "bg-dogolf-green text-white shadow-md" : "",
                !hasSlot && !isPast ? "opacity-40" : "",
                isPast ? "opacity-20 cursor-not-allowed" : "",
              ].join(" ")}
            >
              <span className={[
                "text-xs font-semibold leading-tight font-body",
                isSelected ? "text-white" :
                  isSunday ? "text-red-500" :
                  isSaturday ? "text-blue-500" :
                  "text-gray-800",
                isToday && !isSelected ? "underline decoration-dogolf-green decoration-2" : "",
              ].join(" ")}>
                {date.getDate()}
              </span>
              {hasSlot && price !== null ? (
                <span className={[
                  "text-[10px] leading-tight font-number mt-0.5",
                  isSelected ? "text-white/90" : "text-dogolf-green font-semibold",
                ].join(" ")}>
                  {formatPrice(price)}
                </span>
              ) : hasSlot ? (
                <span className={[
                  "text-[10px] leading-tight font-body mt-0.5",
                  isSelected ? "text-white/90" : "text-green-500",
                ].join(" ")}>
                  예약가
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-dogolf-green" />
          <span className="text-[11px] text-gray-500 font-body">선택됨</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-dogolf-green font-semibold font-number">39만</span>
          <span className="text-[11px] text-gray-500 font-body">= 예약가능 (가격)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarDays size={11} className="text-gray-300" />
          <span className="text-[11px] text-gray-400 font-body">= 출발일 없음</span>
        </div>
      </div>
    </div>
  );
}
