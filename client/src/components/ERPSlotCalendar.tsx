// ============================================================
// ERPSlotCalendar — ERP용 슬롯 달력 시각화 컴포넌트
// 등록된 출발일 슬롯을 달력 형태로 시각화
// ============================================================
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Slot {
  id: number;
  departureDate: string | Date;
  returnDate?: string | Date | null;
  totalSlots: number;
  bookedSlots?: number;
  status: 'open' | 'closed' | 'sold_out';
  adultPrice?: string | null;
  priceOverride?: string | null;
  minPax?: number;
  notes?: string | null;
}

interface ERPSlotCalendarProps {
  slots: Slot[];
  onSlotClick?: (slot: Slot) => void;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-500',
  closed: 'bg-red-400',
  sold_out: 'bg-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  open: '모집중',
  closed: '마감',
  sold_out: '매진',
};

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=일
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

export default function ERPSlotCalendar({ slots, onSlotClick }: ERPSlotCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); };

  const { firstDay, daysInMonth } = getMonthDays(viewYear, viewMonth);

  // 날짜별 슬롯 맵
  const slotMap: Record<string, Slot[]> = {};
  slots.forEach((slot) => {
    const d = new Date(slot.departureDate);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!slotMap[key]) slotMap[key] = [];
    slotMap[key].push(slot);
  });

  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  // 달력 셀 배열 생성
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // 6행 맞추기
  while (cells.length % 7 !== 0) cells.push(null);

  // 이번 달 슬롯 통계
  const monthSlots = slots.filter((s) => {
    const d = new Date(s.departureDate);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });
  const openCount = monthSlots.filter(s => s.status === 'open').length;
  const closedCount = monthSlots.filter(s => s.status !== 'open').length;

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={prevMonth} className="h-8 w-8 p-0">
            <ChevronLeft size={14} />
          </Button>
          <span className="font-semibold text-slate-800 text-base min-w-[100px] text-center">
            {viewYear}년 {monthNames[viewMonth]}
          </span>
          <Button size="sm" variant="outline" onClick={nextMonth} className="h-8 w-8 p-0">
            <ChevronRight size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={goToday} className="h-8 text-xs text-slate-500">
            오늘
          </Button>
        </div>
        {/* 이번 달 통계 */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            모집중 {openCount}건
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            마감 {closedCount}건
          </span>
        </div>
      </div>

      {/* 달력 */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 bg-slate-50">
          {weekdays.map((day, i) => (
            <div
              key={day}
              className={`py-2 text-center text-xs font-semibold ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'
              }`}
            >
              {day}
            </div>
          ))}
        </div>
        {/* 날짜 셀 */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {cells.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="h-20 bg-slate-50/50" />;
            }
            const key = `${viewYear}-${viewMonth}-${day}`;
            const daySlots = slotMap[key] ?? [];
            const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
            const isPast = new Date(viewYear, viewMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const colIdx = idx % 7;

            return (
              <div
                key={day}
                className={`h-20 p-1.5 flex flex-col ${isPast ? 'bg-slate-50/70' : 'bg-white hover:bg-green-50/30'} transition-colors`}
              >
                {/* 날짜 숫자 */}
                <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-dogolf-green text-white' :
                  colIdx === 0 ? 'text-red-500' :
                  colIdx === 6 ? 'text-blue-500' :
                  isPast ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  {day}
                </div>
                {/* 슬롯 표시 */}
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {daySlots.slice(0, 2).map((slot) => {
                    const remaining = slot.totalSlots - (slot.bookedSlots ?? 0);
                    const price = slot.adultPrice ? Number(slot.adultPrice) : (slot.priceOverride ? Number(slot.priceOverride) : null);
                    return (
                      <button
                        key={slot.id}
                        onClick={() => onSlotClick?.(slot)}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-white text-[10px] leading-tight truncate ${STATUS_COLORS[slot.status]} hover:opacity-80 transition-opacity`}
                        title={`${STATUS_LABELS[slot.status]} · 잔여 ${remaining}석${price ? ` · ${price.toLocaleString()}원` : ''}`}
                      >
                        {price ? `${Math.round(price / 10000)}만` : STATUS_LABELS[slot.status]}
                        {slot.status === 'open' && ` (${remaining})`}
                      </button>
                    );
                  })}
                  {daySlots.length > 2 && (
                    <span className="text-[10px] text-slate-400 pl-1">+{daySlots.length - 2}개</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> 모집중 (잔여석)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> 마감</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-400 inline-block" /> 매진</span>
        <span className="text-slate-400">· 셀 클릭 시 수정 가능</span>
      </div>
    </div>
  );
}
