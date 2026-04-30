/**
 * 예약 일정 탭 컴포넌트
 * - 상품군 선택 (당일/1박1일/1박2일/2박3일/3박4일/3박5일/기타)
 * - 상품군 선택 시 일자별 행 자동 생성
 * - 각 행: 날짜, dayType, 골프장(제휴사 검색), 홀수(드롭박스), 티오프시간, 숙소, 항공정보
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Plane, Hotel, Flag, Anchor } from "lucide-react";
import VariablePickerButton from "@/components/VariablePickerButton";
import { toast } from "sonner";

// ─── 타입 정의 ────────────────────────────────────────────────
type DayType = "departure" | "stay" | "arrival" | "daytrip";

interface FlightInfo {
  airline: string;
  depAirport: string;
  depTime: string;
  arrAirport: string;
  arrTime: string;
}

interface ItineraryRow {
  dayIndex: number;
  date: string;
  dayType: DayType;
  golfAffiliateId: number | null;
  golfAffiliateName: string;
  holeCount: number;
  estimatedTeeTime: string;
  confirmedTeeTime: string;
  accommodationAffiliateId: number | null;
  accommodationAffiliateName: string;
  roomType: string;
  roomCount: number;
  flightInfo: FlightInfo | null;
  notes: string;
}

// ─── 상품군 정의 ──────────────────────────────────────────────
const PACKAGE_TYPES = [
  { value: "daytrip", label: "당일", nights: 0, days: 1 },
  { value: "1n1d", label: "1박1일", nights: 1, days: 2 },
  { value: "1n2d", label: "1박2일", nights: 1, days: 2 },
  { value: "2n3d", label: "2박3일", nights: 2, days: 3 },
  { value: "3n4d", label: "3박4일", nights: 3, days: 4 },
  { value: "3n5d", label: "3박5일", nights: 3, days: 5 },
  { value: "custom", label: "기타", nights: 0, days: 0 },
];

const DAY_TYPE_LABELS: Record<DayType, string> = {
  departure: "출발일",
  stay: "체류일",
  arrival: "도착일",
  daytrip: "당일",
};

const DAY_TYPE_COLORS: Record<DayType, string> = {
  departure: "bg-blue-100 text-blue-700",
  stay: "bg-green-100 text-green-700",
  arrival: "bg-purple-100 text-purple-700",
  daytrip: "bg-orange-100 text-orange-700",
};

const HOLE_OPTIONS = [
  { value: 0, label: "라운딩 없음" },
  { value: 9, label: "9홀" },
  { value: 18, label: "18홀" },
  { value: 27, label: "27홀" },
  { value: 36, label: "36홀" },
];

// ─── 빈 행 생성 ───────────────────────────────────────────────
function createEmptyRow(dayIndex: number, dayType: DayType, baseDate?: string): ItineraryRow {
  let date = "";
  if (baseDate) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + dayIndex);
    date = d.toISOString().split("T")[0];
  }
  return {
    dayIndex,
    date,
    dayType,
    golfAffiliateId: null,
    golfAffiliateName: "",
    holeCount: dayType === "arrival" ? 0 : 18,
    estimatedTeeTime: "",
    confirmedTeeTime: "",
    accommodationAffiliateId: null,
    accommodationAffiliateName: "",
    roomType: "",
    roomCount: 1,
    flightInfo: null,
    notes: "",
  };
}

// ─── 상품군에 따른 일정 자동 생성 ────────────────────────────
function generateRows(packageType: string, customNights: number, customDays: number, baseDate?: string): ItineraryRow[] {
  const pt = PACKAGE_TYPES.find(p => p.value === packageType);
  const nights = packageType === "custom" ? customNights : (pt?.nights ?? 0);
  const days = packageType === "custom" ? customDays : (pt?.days ?? 1);

  if (packageType === "daytrip") {
    return [createEmptyRow(0, "daytrip", baseDate)];
  }

  const rows: ItineraryRow[] = [];
  for (let i = 0; i < days; i++) {
    let dayType: DayType;
    if (i === 0) dayType = "departure";
    else if (i === days - 1) dayType = "arrival";
    else dayType = "stay";

    // 1박1일: 1일차 출발(라운딩 없음), 2일차 도착(라운딩)
    if (packageType === "1n1d") {
      dayType = i === 0 ? "departure" : "arrival";
    }

    rows.push(createEmptyRow(i, dayType, baseDate));
  }
  return rows;
}

// ─── 제휴사 검색 서브컴포넌트 ────────────────────────────────
function AffiliateSearchInput({
  value,
  onSelect,
  placeholder,
  affiliateType,
}: {
  value: string;
  onSelect: (id: number | null, name: string) => void;
  placeholder: string;
  affiliateType?: "all" | "golf_domestic" | "golf_overseas" | "attraction" | "hotel" | "transport" | "other";
}) {
  const [search, setSearch] = useState(value);
  const [show, setShow] = useState(false);

  const { data } = trpc.affiliates.list.useQuery(
    { page: 1, pageSize: 15, search, type: affiliateType ?? "all", status: "active" },
    { enabled: search.length >= 1 }
  );

  useEffect(() => {
    setSearch(value);
  }, [value]);

  return (
    <div className="relative">
      <Input
        value={search}
        onChange={e => { setSearch(e.target.value); setShow(true); onSelect(null, e.target.value); }}
        onFocus={() => search.length >= 1 && setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 200)}
        placeholder={placeholder}
        className="h-7 text-xs"
      />
      {show && data && data.items.length > 0 && (
        <div className="absolute z-50 w-full bg-white border rounded shadow-xl mt-0.5 max-h-32 overflow-y-auto">
          {data.items.map(aff => (
            <button
              key={aff.id}
              type="button"
              className="w-full text-left px-2 py-1.5 hover:bg-green-50 text-xs border-b last:border-0"
              onMouseDown={() => {
                setSearch(aff.name);
                onSelect(aff.id, aff.name);
                setShow(false);
              }}
            >
              <span className="font-medium">{aff.name}</span>
              {aff.country && <span className="text-gray-400 ml-1">{aff.country}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 항공 정보 입력 서브컴포넌트 ─────────────────────────────
function FlightInfoInput({
  value,
  onChange,
}: {
  value: FlightInfo | null;
  onChange: (v: FlightInfo | null) => void;
}) {
  const [open, setOpen] = useState(!!value);
  const fi = value ?? { airline: "", depAirport: "", depTime: "", arrAirport: "", arrTime: "" };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
      >
        <Plane className="w-3 h-3" /> 항공 입력
      </button>
    );
  }

  return (
    <div className="mt-1 p-2 bg-blue-50 rounded border border-blue-200 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
          <Plane className="w-3 h-3" /> 항공 정보
        </span>
        <button
          type="button"
          onClick={() => { setOpen(false); onChange(null); }}
          className="text-xs text-gray-400 hover:text-red-500"
        >
          개별항공
        </button>
      </div>
      <div className="grid grid-cols-1 gap-1">
        <Input
          value={fi.airline}
          onChange={e => onChange({ ...fi, airline: e.target.value })}
          placeholder="항공사 (예: 대한항공 KE123)"
          className="h-6 text-xs"
        />
        <div className="grid grid-cols-2 gap-1">
          <Input
            value={fi.depAirport}
            onChange={e => onChange({ ...fi, depAirport: e.target.value })}
            placeholder="출발공항 (예: ICN)"
            className="h-6 text-xs"
          />
          <Input
            value={fi.depTime}
            onChange={e => onChange({ ...fi, depTime: e.target.value })}
            placeholder="출발시간 (예: 09:00)"
            className="h-6 text-xs"
          />
          <Input
            value={fi.arrAirport}
            onChange={e => onChange({ ...fi, arrAirport: e.target.value })}
            placeholder="도착공항 (예: BKK)"
            className="h-6 text-xs"
          />
          <Input
            value={fi.arrTime}
            onChange={e => onChange({ ...fi, arrTime: e.target.value })}
            placeholder="도착시간 (예: 13:30)"
            className="h-6 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export interface ReservationItineraryTabProps {
  reservationId: number;
  departureDate?: string;
  nights?: number;
  /** 상품 기본 일정 템플릿 모드 - reservationId 대신 packageId 기준으로 동작 */
  isPackageTemplate?: boolean;
  packageId?: number;
}

export default function ReservationItineraryTab({
  reservationId,
  departureDate,
  nights,
  isPackageTemplate,
  packageId,
}: ReservationItineraryTabProps) {
  const [packageType, setPackageType] = useState("1n2d");
  const [customNights, setCustomNights] = useState(nights ?? 1);
  const [customDays, setCustomDays] = useState((nights ?? 1) + 1);
  const [rows, setRows] = useState<ItineraryRow[]>([]);
  const [initialized, setInitialized] = useState(false);

  // 기존 일정 불러오기 (일반 모드)
  const { data: existingRows, isLoading } = trpc.reservationItineraries.list.useQuery(
    { reservationId },
    { enabled: !isPackageTemplate && reservationId > 0 }
  );

  // 상품 기본 일정 템플릿 조회
  const { data: pkgData } = trpc.packages.get.useQuery(
    { id: packageId! },
    { enabled: isPackageTemplate && !!packageId }
  );

  const upsertMut = trpc.reservationItineraries.upsert.useMutation({
    onSuccess: () => toast.success("일정이 저장되었습니다."),
    onError: (e) => toast.error(e.message),
  });

  const updatePackageMut = trpc.packages.update.useMutation({
    onSuccess: () => toast.success("상품 기본 일정 템플릿이 저장되었습니다."),
    onError: (e) => toast.error(e.message),
  });

  // 상품 템플릿 모드: pkgData에서 기본 일정 로드
  useEffect(() => {
    if (isPackageTemplate && !initialized && pkgData !== undefined) {
      const defaultItinerary = (pkgData as any)?.defaultItinerary as ItineraryRow[] | null;
      if (defaultItinerary && defaultItinerary.length > 0) {
        setRows(defaultItinerary);
        const dayCount = defaultItinerary.length;
        if (dayCount === 1 && defaultItinerary[0].dayType === "daytrip") setPackageType("daytrip");
        else if (dayCount === 2) setPackageType("1n2d");
        else if (dayCount === 3) setPackageType("2n3d");
        else if (dayCount === 4) setPackageType("3n4d");
        else if (dayCount === 5) setPackageType("3n5d");
        else { setPackageType("custom"); setCustomDays(dayCount); setCustomNights(dayCount - 1); }
      } else {
        const pt = nights !== undefined
          ? (nights === 0 ? "daytrip" : nights === 1 ? "1n2d" : nights === 2 ? "2n3d" : nights === 3 ? "3n4d" : "custom")
          : "3n4d";
        setPackageType(pt);
        setRows(generateRows(pt, nights ?? 3, (nights ?? 3) + 1, undefined));
      }
      setInitialized(true);
    }
  }, [isPackageTemplate, pkgData, initialized, nights]);

  // 기존 데이터 로드
  useEffect(() => {
    if (!isPackageTemplate && !initialized && existingRows !== undefined) {
      if (existingRows.length > 0) {
        // 기존 일정 데이터 복원
        const restored: ItineraryRow[] = existingRows.map(r => ({
          dayIndex: r.dayIndex,
          date: r.date ? new Date(r.date).toISOString().split("T")[0] : "",
          dayType: (r.dayType ?? "stay") as DayType,
          golfAffiliateId: r.golfAffiliateId ?? null,
          golfAffiliateName: r.golfAffiliate?.name ?? "",
          holeCount: r.holeCount ?? 18,
          estimatedTeeTime: r.estimatedTeeTime ?? r.teeTime ?? "",
          confirmedTeeTime: r.confirmedTeeTime ?? "",
          accommodationAffiliateId: r.accommodationAffiliateId ?? null,
          accommodationAffiliateName: r.accommodationAffiliate?.name ?? "",
          roomType: r.roomType ?? "",
          roomCount: r.roomCount ?? 1,
          flightInfo: r.flightInfo as FlightInfo | null,
          notes: r.notes ?? "",
        }));
        setRows(restored);

        // 상품군 추정
        const dayCount = restored.length;
        if (dayCount === 1 && restored[0].dayType === "daytrip") setPackageType("daytrip");
        else if (dayCount === 2) setPackageType("1n2d");
        else if (dayCount === 3) setPackageType("2n3d");
        else if (dayCount === 4) setPackageType("3n4d");
        else if (dayCount === 5) setPackageType("3n5d");
        else if (dayCount > 5) { setPackageType("custom"); setCustomDays(dayCount); setCustomNights(dayCount - 1); }
      } else {
        // 기존 데이터 없으면 기본 상품군으로 자동 생성
        const pt = nights !== undefined
          ? (nights === 0 ? "daytrip" : nights === 1 ? "1n2d" : nights === 2 ? "2n3d" : nights === 3 ? "3n4d" : "custom")
          : "1n2d";
        setPackageType(pt);
        setRows(generateRows(pt, nights ?? 1, (nights ?? 1) + 1, departureDate));
      }
      setInitialized(true);
    }
  }, [existingRows, initialized, departureDate, nights]);

  // 상품군 변경 시 행 재생성
  function handlePackageTypeChange(newType: string) {
    setPackageType(newType);
    if (newType !== "custom") {
      setRows(generateRows(newType, customNights, customDays, departureDate));
    }
  }

  function handleCustomApply() {
    setRows(generateRows("custom", customNights, customDays, departureDate));
  }

  function updateRow(idx: number, updates: Partial<ItineraryRow>) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r));
  }

  function addRow() {
    const newIdx = rows.length;
    setRows(prev => [...prev, createEmptyRow(newIdx, "stay", departureDate)]);
  }

  function removeRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, dayIndex: i })));
  }

  function handleSave() {
    if (isPackageTemplate && packageId) {
      // 상품 기본 일정 템플릿 저장
      updatePackageMut.mutate({
        id: packageId,
        defaultItinerary: rows.map(r => ({
          dayIndex: r.dayIndex,
          dayType: r.dayType,
          holeCount: r.holeCount,
          estimatedTeeTime: r.estimatedTeeTime || undefined,
          confirmedTeeTime: r.confirmedTeeTime || undefined,
          golfAffiliateId: r.golfAffiliateId,
          accommodationAffiliateId: r.accommodationAffiliateId,
          roomType: r.roomType || undefined,
          roomCount: r.roomCount,
          flightInfo: r.flightInfo,
          notes: r.notes || undefined,
        })),
      });
    } else {
      upsertMut.mutate({
        reservationId,
        rows: rows.map(r => ({
          dayIndex: r.dayIndex,
          date: r.date || undefined,
          dayType: r.dayType,
          golfAffiliateId: r.golfAffiliateId,
          holeCount: r.holeCount,
          estimatedTeeTime: r.estimatedTeeTime || null,
          confirmedTeeTime: r.confirmedTeeTime || null,
          accommodationAffiliateId: r.accommodationAffiliateId,
          roomType: r.roomType || null,
          roomCount: r.roomCount,
          flightInfo: r.flightInfo,
          notes: r.notes || null,
        })),
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-green-600 mr-2" />
        <span className="text-sm text-gray-500">일정 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 상품군 선택 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Label className="text-xs font-semibold whitespace-nowrap">상품군</Label>
        <div className="flex flex-wrap gap-1.5">
          {PACKAGE_TYPES.map(pt => (
            <button
              key={pt.value}
              type="button"
              onClick={() => handlePackageTypeChange(pt.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                packageType === pt.value
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
              }`}
            >
              {pt.label}
            </button>
          ))}
        </div>
        {packageType === "custom" && (
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              value={customNights}
              onChange={e => setCustomNights(Number(e.target.value))}
              className="w-14 h-7 text-xs text-center"
            />
            <span className="text-xs text-gray-500">박</span>
            <Input
              type="number"
              min={1}
              value={customDays}
              onChange={e => setCustomDays(Number(e.target.value))}
              className="w-14 h-7 text-xs text-center"
            />
            <span className="text-xs text-gray-500">일</span>
            <Button size="sm" variant="outline" onClick={handleCustomApply} className="h-7 text-xs">
              적용
            </Button>
          </div>
        )}
      </div>

      {/* 일정 행 목록 */}
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div key={idx} className="border rounded-lg p-3 bg-gray-50 space-y-2">
            {/* 행 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">{idx + 1}일차</span>
                <Badge className={`text-xs px-1.5 py-0 ${DAY_TYPE_COLORS[row.dayType]}`}>
                  {DAY_TYPE_LABELS[row.dayType]}
                </Badge>
                <Select
                  value={row.dayType}
                  onValueChange={v => updateRow(idx, { dayType: v as DayType })}
                >
                  <SelectTrigger className="h-6 w-20 text-xs border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="departure">출발일</SelectItem>
                    <SelectItem value="stay">체류일</SelectItem>
                    <SelectItem value="arrival">도착일</SelectItem>
                    <SelectItem value="daytrip">당일</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={row.date}
                  onChange={e => updateRow(idx, { date: e.target.value })}
                  className="h-6 text-xs w-32"
                />
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="text-red-400 hover:text-red-600 p-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 골프장 + 홀수 + 티오프 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <Label className="text-xs text-gray-500 flex items-center gap-1 mb-0.5">
                  <Flag className="w-3 h-3" /> 골프장
                </Label>
                <AffiliateSearchInput
                  value={row.golfAffiliateName}
                  onSelect={(id, name) => updateRow(idx, { golfAffiliateId: id, golfAffiliateName: name })}
                  placeholder="골프장 검색..."
                  affiliateType="golf_domestic"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-0.5 block">홀수</Label>
                <Select
                  value={String(row.holeCount)}
                  onValueChange={v => updateRow(idx, { holeCount: Number(v) })}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOLE_OPTIONS.map(h => (
                      <SelectItem key={h.value} value={String(h.value)}>{h.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-0.5 block">견적시간</Label>
                <Input
                  value={row.estimatedTeeTime}
                  onChange={e => updateRow(idx, { estimatedTeeTime: e.target.value })}
                  placeholder="08:30"
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-0.5 flex items-center gap-1 block">
                  확정시간
                  <span className="text-green-600 font-medium">(우선)</span>
                </Label>
                <Input
                  value={row.confirmedTeeTime}
                  onChange={e => updateRow(idx, { confirmedTeeTime: e.target.value })}
                  placeholder="08:30"
                  className="h-7 text-xs border-green-300 focus:border-green-500"
                />
              </div>
            </div>

            {/* 숙소 */}
            {row.dayType !== "arrival" && row.dayType !== "daytrip" && (
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <Label className="text-xs text-gray-500 flex items-center gap-1 mb-0.5">
                    <Hotel className="w-3 h-3" /> 숙소
                  </Label>
                  <AffiliateSearchInput
                    value={row.accommodationAffiliateName}
                    onSelect={(id, name) => updateRow(idx, { accommodationAffiliateId: id, accommodationAffiliateName: name })}
                    placeholder="숙소 검색..."
                    affiliateType="hotel"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-0.5 block">객실 타입</Label>
                  <Input
                    value={row.roomType}
                    onChange={e => updateRow(idx, { roomType: e.target.value })}
                    placeholder="스탠다드 더블"
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-0.5 block">객실 수</Label>
                  <Input
                    type="number"
                    min={1}
                    value={row.roomCount}
                    onChange={e => updateRow(idx, { roomCount: Number(e.target.value) || 1 })}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            )}

            {/* 항공 정보 (출발일/도착일) */}
            {(row.dayType === "departure" || row.dayType === "arrival" || row.dayType === "daytrip") && (
              <FlightInfoInput
                value={row.flightInfo}
                onChange={v => updateRow(idx, { flightInfo: v })}
              />
            )}

            {/* 비고 */}
            <div className="flex items-center gap-1">
              <Input
                value={row.notes}
                onChange={e => updateRow(idx, { notes: e.target.value })}
                placeholder="비고 (선택)"
                className="h-6 text-xs flex-1"
              />
              <VariablePickerButton
                onInsert={(variable) => updateRow(idx, { notes: (row.notes || "") + variable })}
                size="xs"
                placement="bottom-right"
              />
            </div>
          </div>
        ))}
      </div>

      {/* 행 추가 + 저장 버튼 */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={addRow}
          className="text-xs text-green-700 hover:text-green-900 flex items-center gap-1 border border-dashed border-green-400 px-2 py-1 rounded"
        >
          <Plus className="w-3 h-3" /> 일정 행 추가
        </button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={upsertMut.isPending}
          className="bg-green-700 hover:bg-green-800 text-white h-7 text-xs"
        >
          {upsertMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          일정 저장
        </Button>
      </div>
    </div>
  );
}
