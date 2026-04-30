/**
 * 예약별 제휴사 비용 탭 컴포넌트
 * - 제휴사별 입금가/판매가/확정시간 입력
 * - 비용 유형: golf | accommodation | transport | other
 * - 합계 집계 표시
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

// ─── 타입 정의 ────────────────────────────────────────────────
type CostType = "golf" | "accommodation" | "transport" | "other";

interface CostRow {
  affiliateId: number | null;
  affiliateName: string;
  costType: CostType;
  date: string;
  confirmedTime: string;
  unitPrice: number;
  salePrice: number;
  quantity: number;
  notes: string;
}

const COST_TYPE_LABELS: Record<CostType, string> = {
  golf: "골프",
  accommodation: "숙박",
  transport: "교통",
  other: "기타",
};

const COST_TYPE_COLORS: Record<CostType, string> = {
  golf: "bg-green-100 text-green-700",
  accommodation: "bg-blue-100 text-blue-700",
  transport: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-700",
};

function formatKRW(n: number) {
  if (!n) return "0";
  return n.toLocaleString("ko-KR");
}

// ─── 제휴사 검색 서브컴포넌트 ────────────────────────────────
function AffiliateSearchInput({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (id: number | null, name: string) => void;
}) {
  const [search, setSearch] = useState(value);
  const [show, setShow] = useState(false);

  const { data } = trpc.affiliates.list.useQuery(
    { page: 1, pageSize: 15, search, type: "all", status: "active" },
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
        placeholder="제휴사 검색 또는 직접 입력..."
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

// ─── 빈 행 생성 ───────────────────────────────────────────────
function createEmptyRow(): CostRow {
  return {
    affiliateId: null,
    affiliateName: "",
    costType: "golf",
    date: "",
    confirmedTime: "",
    unitPrice: 0,
    salePrice: 0,
    quantity: 1,
    notes: "",
  };
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
interface ReservationAffiliateCostTabProps {
  reservationId: number;
}

export default function ReservationAffiliateCostTab({
  reservationId,
}: ReservationAffiliateCostTabProps) {
  const [rows, setRows] = useState<CostRow[]>([]);
  const [initialized, setInitialized] = useState(false);

  // 기존 비용 불러오기
  const { data: existingRows, isLoading } = trpc.reservationAffiliateCosts.list.useQuery(
    { reservationId },
    { enabled: reservationId > 0 }
  );

  const upsertMut = trpc.reservationAffiliateCosts.upsert.useMutation({
    onSuccess: () => toast.success("제휴사 비용이 저장되었습니다."),
    onError: (e) => toast.error(e.message),
  });

  // 기존 데이터 로드
  useEffect(() => {
    if (!initialized && existingRows !== undefined) {
      if (existingRows.length > 0) {
        const restored: CostRow[] = existingRows.map(r => ({
          affiliateId: r.affiliateId ?? null,
          affiliateName: r.affiliate?.name ?? r.affiliateName ?? "",
          costType: (r.costType ?? "golf") as CostType,
          date: r.date ? new Date(r.date).toISOString().split("T")[0] : "",
          confirmedTime: r.confirmedTime ?? "",
          unitPrice: r.unitPrice ?? 0,
          salePrice: r.salePrice ?? 0,
          quantity: r.quantity ?? 1,
          notes: r.notes ?? "",
        }));
        setRows(restored);
      } else {
        setRows([createEmptyRow()]);
      }
      setInitialized(true);
    }
  }, [existingRows, initialized]);

  function updateRow(idx: number, updates: Partial<CostRow>) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r));
  }

  function addRow() {
    setRows(prev => [...prev, createEmptyRow()]);
  }

  function removeRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    upsertMut.mutate({
      reservationId,
      rows: rows.map(r => ({
        affiliateId: r.affiliateId,
        affiliateName: r.affiliateName || null,
        costType: r.costType,
        date: r.date || undefined,
        confirmedTime: r.confirmedTime || null,
        unitPrice: r.unitPrice,
        salePrice: r.salePrice,
        quantity: r.quantity,
        notes: r.notes || null,
      })),
    });
  }

  // 합계 계산
  const totalUnitPrice = rows.reduce((sum, r) => sum + r.unitPrice * r.quantity, 0);
  const totalSalePrice = rows.reduce((sum, r) => sum + r.salePrice * r.quantity, 0);
  const totalProfit = totalSalePrice - totalUnitPrice;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-green-600 mr-2" />
        <span className="text-sm text-gray-500">비용 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 합계 요약 */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg border">
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-0.5">총 입금가 (원가)</div>
          <div className="text-sm font-bold text-gray-800">{formatKRW(totalUnitPrice)}원</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-0.5">총 판매가</div>
          <div className="text-sm font-bold text-blue-700">{formatKRW(totalSalePrice)}원</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-0.5 flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3" /> 총 수익
          </div>
          <div className={`text-sm font-bold ${totalProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
            {totalProfit >= 0 ? "+" : ""}{formatKRW(totalProfit)}원
          </div>
        </div>
      </div>

      {/* 비용 행 목록 */}
      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={idx} className="border rounded-lg p-3 bg-white space-y-2">
            {/* 행 헤더: 제휴사 + 비용유형 + 삭제 */}
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="col-span-2">
                <Label className="text-xs text-gray-500 mb-0.5 block">제휴사</Label>
                <AffiliateSearchInput
                  value={row.affiliateName}
                  onSelect={(id, name) => updateRow(idx, { affiliateId: id, affiliateName: name })}
                />
              </div>
              <div className="flex items-end gap-1">
                <div className="flex-1">
                  <Label className="text-xs text-gray-500 mb-0.5 block">유형</Label>
                  <Select
                    value={row.costType}
                    onValueChange={v => updateRow(idx, { costType: v as CostType })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(COST_TYPE_LABELS) as CostType[]).map(ct => (
                        <SelectItem key={ct} value={ct}>{COST_TYPE_LABELS[ct]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="text-red-400 hover:text-red-600 pb-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 날짜 + 확정시간 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-500 mb-0.5 block">날짜</Label>
                <Input
                  type="date"
                  value={row.date}
                  onChange={e => updateRow(idx, { date: e.target.value })}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-0.5 block">확정시간 (티오프/체크인)</Label>
                <Input
                  value={row.confirmedTime}
                  onChange={e => updateRow(idx, { confirmedTime: e.target.value })}
                  placeholder="08:30"
                  className="h-7 text-xs"
                />
              </div>
            </div>

            {/* 입금가 + 판매가 + 수량 */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-gray-500 mb-0.5 block">입금가 (원가)</Label>
                <Input
                  type="number"
                  min={0}
                  value={row.unitPrice}
                  onChange={e => updateRow(idx, { unitPrice: Number(e.target.value) || 0 })}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-0.5 block">판매가</Label>
                <Input
                  type="number"
                  min={0}
                  value={row.salePrice}
                  onChange={e => updateRow(idx, { salePrice: Number(e.target.value) || 0 })}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-0.5 block">수량</Label>
                <Input
                  type="number"
                  min={1}
                  value={row.quantity}
                  onChange={e => updateRow(idx, { quantity: Number(e.target.value) || 1 })}
                  className="h-7 text-xs"
                />
              </div>
            </div>

            {/* 소계 표시 */}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t">
              <span>소계: 원가 {formatKRW(row.unitPrice * row.quantity)}원 / 판매 {formatKRW(row.salePrice * row.quantity)}원</span>
              <span className={`font-semibold ${(row.salePrice - row.unitPrice) * row.quantity >= 0 ? "text-green-700" : "text-red-600"}`}>
                수익 {formatKRW((row.salePrice - row.unitPrice) * row.quantity)}원
              </span>
            </div>

            {/* 비고 */}
            <Input
              value={row.notes}
              onChange={e => updateRow(idx, { notes: e.target.value })}
              placeholder="비고 (선택)"
              className="h-6 text-xs"
            />
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
          <Plus className="w-3 h-3" /> 비용 행 추가
        </button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={upsertMut.isPending}
          className="bg-green-700 hover:bg-green-800 text-white h-7 text-xs"
        >
          {upsertMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          비용 저장
        </Button>
      </div>
    </div>
  );
}
