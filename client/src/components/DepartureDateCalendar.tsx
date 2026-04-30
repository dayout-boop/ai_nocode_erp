// ============================================================
// DOGOLF DepartureDateCalendar — dogolf.com 참고 달력형 날짜/요금 선택 UI
// - PC: 2개월 동시 표시, 모바일: 1개월 표시
// - 마감임박(잔여 3명 이하) 빨간색 표시
// - 마감된 슬롯 "마감" 표시
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
  basePrice?: number | null;
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

function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

interface MonthCalendarProps {
  year: number;
  month: number;
  today: Date;
  slotMap: Map<string, Slot>;
  basePrice: number | null;
  selectedSlotId: number | null | undefined;
  onSelect: (slot: Slot) => void;
}

function MonthCalendar({ year, month, today, slotMap, basePrice, selectedSlotId, onSelect }: MonthCalendarProps) {
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const calendarDays = useMemo(() => buildCalendarDays(year, month), [year, month]);
  return (
    <div className="flex-1 min-w-0">
      <div className="text-center text-sm font-bold text-gray-800 font-body mb-2">
        {year}년 {month + 1}월
      </div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`text-center text-[11px] font-semibold py-1 font-body ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"}`}>
            {d}
          </div>
        ))}
      </div>
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
          const isSoldOut = slot?.status === "sold_out" || slot?.status === "closed";
          const remaining = slot ? (slot.totalSlots ?? 20) - (slot.bookedSlots ?? 0) : 0;
          const isAlmostFull = !isSoldOut && remaining > 0 && remaining <= 3;
          const price = slot?.adultPrice ? Number(slot.adultPrice) : slot?.priceOverride ? Number(slot.priceOverride) : (basePrice ?? null);
          const hasSlot = !!slot && !isPast && !isSoldOut;
          const hasSoldOutSlot = !!slot && !isPast && isSoldOut;
          return (
            <button
              key={key}
              disabled={!hasSlot}
              onClick={() => hasSlot && onSelect(slot!)}
              className={["flex flex-col items-center justify-start py-1.5 rounded-lg text-center transition-all", hasSlot ? "cursor-pointer hover:bg-green-50" : "cursor-default", isSelected ? "bg-dogolf-green text-white shadow-md" : "", hasSoldOutSlot ? "opacity-50" : "", !hasSlot && !isPast && !hasSoldOutSlot ? "opacity-30" : "", isPast ? "opacity-15 cursor-not-allowed" : ""].join(" ")}
            >
              <span className={["text-xs font-semibold leading-tight font-body", isSelected ? "text-white" : isSunday ? "text-red-500" : isSaturday ? "text-blue-500" : "text-gray-800", isToday && !isSelected ? "underline decoration-dogolf-green decoration-2" : ""].join(" ")}>
                {date.getDate()}
              </span>
              {hasSoldOutSlot ? (
                <span className="text-[9px] leading-tight text-gray-400 font-body mt-0.5">마감</span>
              ) : hasSlot && price !== null ? (
                <span className={["text-[10px] leading-tight font-number mt-0.5", isSelected ? "text-white/90" : isAlmostFull ? "text-red-500 font-semibold" : "text-dogolf-green font-semibold"].join(" ")}>
                  {formatPrice(price)}
                </span>
              ) : hasSlot ? (
                <span className={["text-[10px] leading-tight font-body mt-0.5", isSelected ? "text-white/90" : "text-green-500"].join(" ")}>예약가</span>
              ) : null}
              {isAlmostFull && !isSelected && (
                <span className="text-[8px] text-red-400 leading-none mt-0.5 font-body">잔{remaining}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DepartureDateCalendar({ slots, basePrice, onSelect, selectedSlotId }: DepartureDateCalendarProps) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const firstSlotDate = useMemo(() => { if (slots.length === 0) return today; return new Date(slots[0].departureDate); }, [slots, today]);
  const [viewYear, setViewYear] = useState(firstSlotDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(firstSlotDate.getMonth());
  const slotMap = useMemo(() => {
    const map = new Map<string, Slot>();
    slots.forEach((s) => {
      const d = new Date(s.departureDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const existing = map.get(key);
      if (!existing || (s.adultPrice && !existing.adultPrice) || (s.priceOverride && !existing.priceOverride)) map.set(key, s);
    });
    return map;
  }, [slots]);
  const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const prevMonthNav = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const nextMonthNav = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };
  const canGoPrev = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());
  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800 font-body">현재 예약 가능한 출발일이 없습니다</p>
          <p className="text-xs text-amber-600 font-body mt-1">개별 문의를 통해 원하시는 날짜를 알려주시면 맞춤 일정을 안내해 드립니다.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonthNav} disabled={!canGoPrev} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs text-gray-500 font-body">{viewYear}년 {viewMonth + 1}월 ~ {nextMonthYear}년 {nextMonth + 1}월</span>
        <button onClick={nextMonthNav} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="flex gap-4">
        <MonthCalendar year={viewYear} month={viewMonth} today={today} slotMap={slotMap} basePrice={basePrice ?? null} selectedSlotId={selectedSlotId} onSelect={(slot) => onSelect?.(slot)} />
        <div className="hidden md:block flex-1 min-w-0">
          <MonthCalendar year={nextMonthYear} month={nextMonth} today={today} slotMap={slotMap} basePrice={basePrice ?? null} selectedSlotId={selectedSlotId} onSelect={(slot) => onSelect?.(slot)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-dogolf-green" /><span className="text-[11px] text-gray-500 font-body">선택됨</span></div>
        <div className="flex items-center gap-1.5"><span className="text-[11px] text-dogolf-green font-semibold font-number">39만</span><span className="text-[11px] text-gray-500 font-body">= 예약가능</span></div>
        <div className="flex items-center gap-1.5"><span className="text-[11px] text-red-500 font-semibold font-number">잔3</span><span className="text-[11px] text-gray-500 font-body">= 마감임박</span></div>
        <div className="flex items-center gap-1.5"><CalendarDays size={11} className="text-gray-300" /><span className="text-[11px] text-gray-400 font-body">= 출발일 없음</span></div>
      </div>
    </div>
  );
}
