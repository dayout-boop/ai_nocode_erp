/**
 * EstimatePreviewPanel.tsx
 * 견적서 실시간 미리보기 패널
 * - 예약 ID + 템플릿 ID를 받아 변수 치환 결과를 즉시 렌더링
 * - DB에 저장하지 않음 (순수 미리보기 전용)
 * - 예약 목록 / 예약 수정 모달에서 슬라이드-인 패널로 사용
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  X, RefreshCw, Printer, ExternalLink, CheckCircle2, XCircle,
  Calendar, DollarSign, Flag, Hotel, Plane, Info, Users,
} from "lucide-react";

// ─── 타입 ────────────────────────────────────────────────────────────────────
type ItineraryItem = {
  id: number;
  dayIndex: number;
  date: Date | null;
  dayType: string | null;
  holeCount: number | null;
  estimatedTeeTime?: string | null;
  confirmedTeeTime?: string | null;
  roomType: string | null;
  roomCount: number | null;
  flightInfo: unknown;
  notes: string | null;
  golfAffiliateName: string | null;
  accommodationAffiliateName: string | null;
};

const DAY_TYPE_KO: Record<string, string> = {
  departure: "출발일",
  stay: "체류일",
  arrival: "도착일",
  daytrip: "당일",
};

// ─── 변수 치환 함수 (EstimateView.tsx와 동일 로직) ────────────────────────────
function replaceVariables(
  template: string,
  reservation: Record<string, unknown>,
  itineraries?: ItineraryItem[]
): string {
  // {{일정표}} 블록 생성
  let scheduleBlock = "";
  if (itineraries && itineraries.length > 0) {
    scheduleBlock = itineraries
      .map((row) => {
        const dateStr = row.date ? new Date(row.date).toLocaleDateString("ko-KR") : "";
        const dayLabel = DAY_TYPE_KO[row.dayType ?? ""] ?? row.dayType ?? "";
        const n = row.dayIndex + 1;
        const teeVal = row.confirmedTeeTime || row.estimatedTeeTime || "";
        const fi = row.flightInfo as { airline?: string; depAirport?: string; depTime?: string; arrAirport?: string; arrTime?: string } | null;

        const lines: string[] = [];
        lines.push(`【${n}일차 ${dayLabel}${dateStr ? ` (${dateStr})` : ""}】`);

        if (row.golfAffiliateName) {
          const holePart = row.holeCount ? ` ${row.holeCount}홀` : "";
          const teePart = teeVal ? ` 티오프 ${teeVal}` : "";
          lines.push(`  ⛳ ${row.golfAffiliateName}${holePart}${teePart}`);
        }
        if (row.accommodationAffiliateName) {
          const roomPart = row.roomType ? ` (${row.roomType})` : "";
          lines.push(`  🏨 ${row.accommodationAffiliateName}${roomPart}`);
        }
        if (fi?.airline) {
          lines.push(`  ✈️ ${fi.airline} ${fi.depAirport ?? ""}→${fi.arrAirport ?? ""} ${fi.depTime ?? ""}-${fi.arrTime ?? ""}`.trim());
        }
        if (row.notes) {
          lines.push(`  📝 ${row.notes}`);
        }
        return lines.join("\n");
      })
      .join("\n\n");
  }

  // N일차 개별 변수 치환
  let result = template;
  if (itineraries && itineraries.length > 0) {
    itineraries.forEach((row) => {
      const n = row.dayIndex + 1;
      const teeVal = row.confirmedTeeTime || row.estimatedTeeTime || "";
      const fi = row.flightInfo as { airline?: string; depAirport?: string; depTime?: string; arrAirport?: string; arrTime?: string } | null;
      result = result
        .replace(new RegExp(`\\{\\{${n}일차-골프\\}\\}`, "g"), row.golfAffiliateName ?? "")
        .replace(new RegExp(`\\{\\{${n}일차-숙소\\}\\}`, "g"), row.accommodationAffiliateName ?? "")
        .replace(new RegExp(`\\{\\{${n}일차-티타임\\}\\}`, "g"), teeVal)
        .replace(new RegExp(`\\{\\{${n}일차-홀수\\}\\}`, "g"), row.holeCount ? String(row.holeCount) + "홀" : "")
        .replace(new RegExp(`\\{\\{${n}일차-항공\\}\\}`, "g"), fi?.airline ? `${fi.airline} ${fi.depAirport ?? ""}→${fi.arrAirport ?? ""} ${fi.depTime ?? ""}-${fi.arrTime ?? ""}`.trim() : "개별항공")
        .replace(new RegExp(`\\{\\{${n}일차-날짜\\}\\}`, "g"), row.date ? new Date(row.date).toLocaleDateString("ko-KR") : "");
    });
  }
  template = result;

  return template
    .replace(/\{\{고객명\}\}/g, String(reservation.customerName ?? ""))
    .replace(/\{\{예약번호\}\}/g, String(reservation.reservationNo ?? ""))
    .replace(/\{\{출발일\}\}/g, reservation.departureDate ? new Date(reservation.departureDate as string).toLocaleDateString("ko-KR") : "")
    .replace(/\{\{귀국일\}\}/g, reservation.returnDate ? new Date(reservation.returnDate as string).toLocaleDateString("ko-KR") : "")
    .replace(/\{\{골프장\}\}/g, String(reservation.golfCourseName ?? ""))
    .replace(/\{\{인원\}\}/g, String(reservation.numberOfPeople ?? ""))
    .replace(/\{\{팀수\}\}/g, String(reservation.numberOfTeams ?? ""))
    .replace(/\{\{판매가\}\}/g, reservation.salePriceTotal ? Number(reservation.salePriceTotal).toLocaleString() + "원" : (reservation.salePrice ? Number(reservation.salePrice).toLocaleString() + "원" : ""))
    .replace(/\{\{입금가\}\}/g, reservation.depositPrice ? Number(reservation.depositPrice).toLocaleString() + "원" : (reservation.paidAmount ? Number(reservation.paidAmount).toLocaleString() + "원" : ""))
    .replace(/\{\{제휴가\}\}/g, reservation.remittedAmount ? Number(reservation.remittedAmount).toLocaleString() + "원" : "")
    .replace(/\{\{결제상태\}\}/g, (() => {
      const ps = reservation.paymentStatus as string | undefined;
      if (ps === "paid") return "완납";
      if (ps === "partial") return "부분납";
      if (ps === "unpaid") return "미납";
      return ps ?? "";
    })())
    .replace(/\{\{1인가격\}\}/g, reservation.numberOfPeople && (reservation.salePriceTotal || reservation.salePrice)
      ? Math.round(Number(reservation.salePriceTotal ?? reservation.salePrice) / Number(reservation.numberOfPeople)).toLocaleString() + "원"
      : "")
    .replace(/\{\{담당자\}\}/g, String(reservation.managerName ?? reservation.assignedTo ?? ""))
    .replace(/\{\{연락처\}\}/g, String(reservation.customerPhone ?? reservation.phone ?? ""))
    .replace(/\{\{이메일\}\}/g, String(reservation.customerEmail ?? reservation.email ?? ""))
    .replace(/\{\{견적시간\}\}/g, String(reservation.estimatedTeeTime ?? ""))
    .replace(/\{\{확정시간\}\}/g, String(reservation.confirmedTeeTime ?? ""))
    .replace(/\{\{티타임\}\}/g, String(reservation.confirmedTeeTime ?? reservation.estimatedTeeTime ?? ""))
    .replace(/\{\{숙소\}\}/g, String(reservation.accommodationName ?? ""))
    .replace(/\{\{국가\}\}/g, String(reservation.country ?? ""))
    .replace(/\{\{발송일\}\}/g, new Date().toLocaleDateString("ko-KR"))
    .replace(/\{\{일정표\}\}/g, scheduleBlock)
    .replace(/\{\{상품군\}\}/g, String(reservation.packageType ?? ""));
}

// ─── 섹션 렌더러 ─────────────────────────────────────────────────────────────
function PreviewSection({
  icon,
  title,
  content,
  iconColor = "text-green-600",
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
  iconColor?: string;
}) {
  if (!content?.trim()) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <span className={iconColor}>{icon}</span>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">{content}</pre>
    </div>
  );
}

// ─── 일정 테이블 ─────────────────────────────────────────────────────────────
function ItineraryTable({ itineraries }: { itineraries: ItineraryItem[] }) {
  if (!itineraries || itineraries.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-blue-600" />
        <h3 className="font-semibold text-gray-900 text-sm">여행 일정</h3>
      </div>
      <div className="space-y-2">
        {itineraries.map((row, idx) => {
          const dateStr = row.date ? new Date(row.date).toLocaleDateString("ko-KR") : "";
          const dayLabel = DAY_TYPE_KO[row.dayType ?? ""] ?? row.dayType ?? "";
          const fi = row.flightInfo as { airline?: string; depAirport?: string; depTime?: string; arrAirport?: string; arrTime?: string } | null;
          const teeVal = row.confirmedTeeTime || row.estimatedTeeTime || "";
          return (
            <div key={idx} className="border rounded-lg p-3 bg-gray-50">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold bg-white border px-2 py-0.5 rounded-full text-gray-700">
                  {row.dayIndex + 1}일차
                </span>
                <span className="text-xs text-gray-500">{dayLabel}</span>
                {dateStr && <span className="text-xs text-gray-400">{dateStr}</span>}
              </div>
              <div className="space-y-1 text-xs">
                {row.golfAffiliateName && (
                  <div className="flex items-center gap-1.5 text-gray-700">
                    <Flag size={10} className="text-green-600 flex-shrink-0" />
                    <span className="font-medium">{row.golfAffiliateName}</span>
                    {row.holeCount && <span className="text-gray-400">{row.holeCount}홀</span>}
                    {teeVal && <span className="text-gray-400">티오프 {teeVal}</span>}
                    {row.confirmedTeeTime && (
                      <Badge className="text-[10px] h-4 bg-emerald-100 text-emerald-700 border-emerald-200">확정</Badge>
                    )}
                    {!row.confirmedTeeTime && row.estimatedTeeTime && (
                      <Badge className="text-[10px] h-4 bg-yellow-100 text-yellow-700 border-yellow-200">견적</Badge>
                    )}
                  </div>
                )}
                {row.accommodationAffiliateName && (
                  <div className="flex items-center gap-1.5 text-gray-700">
                    <Hotel size={10} className="text-blue-600 flex-shrink-0" />
                    <span>{row.accommodationAffiliateName}</span>
                    {row.roomType && <span className="text-gray-400">({row.roomType})</span>}
                  </div>
                )}
                {fi?.airline && (
                  <div className="flex items-center gap-1.5 text-gray-700">
                    <Plane size={10} className="text-purple-600 flex-shrink-0" />
                    <span>{fi.airline} {fi.depAirport ?? ""}→{fi.arrAirport ?? ""} {fi.depTime ?? ""}-{fi.arrTime ?? ""}</span>
                  </div>
                )}
                {row.notes && (
                  <div className="flex items-start gap-1.5 text-gray-500">
                    <Info size={10} className="mt-0.5 flex-shrink-0" />
                    <span>{row.notes}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 메인 패널 컴포넌트 ───────────────────────────────────────────────────────
interface EstimatePreviewPanelProps {
  reservationId: number;
  reservationNo?: string;
  customerName?: string;
  onClose: () => void;
}

export default function EstimatePreviewPanel({
  reservationId,
  reservationNo,
  customerName,
  onClose,
}: EstimatePreviewPanelProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>(undefined);

  // 템플릿 목록 조회
  const { data: templates } = trpc.customerEstimateTemplates.list.useQuery();

  // 미리보기 데이터 조회 (previewByReservation)
  const { data, isLoading, error, refetch } = trpc.estimates.previewByReservation.useQuery(
    { reservationId, templateId: selectedTemplateId },
    { enabled: !!reservationId }
  );

  // 변수 치환 결과 계산
  const rendered = useMemo(() => {
    if (!data?.reservation || !data?.template) return null;
    const res = data.reservation as Record<string, unknown>;
    const tmpl = data.template;
    const itineraries = (data.itineraries ?? []) as ItineraryItem[];

    return {
      includeItems: tmpl.includeItems ? replaceVariables(tmpl.includeItems, res, itineraries) : null,
      excludeItems: tmpl.excludeItems ? replaceVariables(tmpl.excludeItems, res, itineraries) : null,
      schedule: tmpl.schedule ? replaceVariables(tmpl.schedule, res, itineraries) : null,
      notes: tmpl.notes ? replaceVariables(tmpl.notes, res, itineraries) : null,
    };
  }, [data]);

  const reservation = data?.reservation as Record<string, unknown> | undefined;
  const itineraries = (data?.itineraries ?? []) as ItineraryItem[];

  // 금액 계산
  const salePrice = reservation?.salePriceTotal
    ? Number(reservation.salePriceTotal).toLocaleString()
    : reservation?.salePrice
    ? Number(reservation.salePrice).toLocaleString()
    : null;

  const depositPrice = reservation?.depositPrice
    ? Number(reservation.depositPrice).toLocaleString()
    : reservation?.paidAmount
    ? Number(reservation.paidAmount).toLocaleString()
    : null;

  const paymentStatusLabel = (() => {
    const ps = reservation?.paymentStatus as string | undefined;
    if (ps === "paid") return { label: "완납", cls: "bg-emerald-100 text-emerald-700" };
    if (ps === "partial") return { label: "부분납", cls: "bg-yellow-100 text-yellow-700" };
    if (ps === "unpaid") return { label: "미납", cls: "bg-red-100 text-red-700" };
    return null;
  })();

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div>
          <h2 className="font-bold text-gray-900 text-sm">견적서 미리보기</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {reservationNo && <span className="font-mono mr-1">{reservationNo}</span>}
            {customerName && <span>{customerName}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            className="h-7 w-7 p-0"
            title="새로고침"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-7 w-7 p-0"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* 템플릿 선택 */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">템플릿:</span>
          <Select
            value={selectedTemplateId ? String(selectedTemplateId) : "auto"}
            onValueChange={(v) => setSelectedTemplateId(v === "auto" ? undefined : Number(v))}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder="자동 선택 (최다 사용)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">자동 선택 (최다 사용)</SelectItem>
              {(templates ?? []).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                  {t.useCount ? <span className="text-gray-400 ml-1">({t.useCount}회)</span> : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data?.template && (
          <p className="text-[11px] text-gray-400 mt-1">
            적용 템플릿: <span className="font-medium text-gray-600">{data.template.name}</span>
          </p>
        )}
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw size={18} className="animate-spin mr-2" />
            <span className="text-sm">불러오는 중...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-16 text-red-400">
            <XCircle size={18} className="mr-2" />
            <span className="text-sm">{error.message}</span>
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            {/* 예약 기본 정보 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-green-600" />
                <h3 className="font-semibold text-gray-900 text-sm">예약 정보</h3>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {[
                  { label: "고객명", value: String(reservation?.customerName ?? "-") },
                  { label: "예약번호", value: String(reservation?.reservationNo ?? "-") },
                  { label: "출발일", value: reservation?.departureDate ? new Date(reservation.departureDate as string).toLocaleDateString("ko-KR") : "-" },
                  { label: "귀국일", value: reservation?.returnDate ? new Date(reservation.returnDate as string).toLocaleDateString("ko-KR") : "-" },
                  { label: "인원", value: reservation?.numberOfPeople ? `${reservation.numberOfPeople}명` : "-" },
                  { label: "국가", value: String(reservation?.country ?? "-") },
                ].map((item) => (
                  <div key={item.label} className="flex gap-1">
                    <span className="text-gray-400 w-14 flex-shrink-0">{item.label}</span>
                    <span className="text-gray-800 font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 금액 정보 */}
            {(salePrice || depositPrice || paymentStatusLabel) && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={14} className="text-green-600" />
                  <h3 className="font-semibold text-gray-900 text-sm">금액 정보</h3>
                </div>
                <div className="space-y-1.5 text-xs">
                  {salePrice && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">판매가</span>
                      <span className="font-bold text-green-700">{salePrice}원</span>
                    </div>
                  )}
                  {depositPrice && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">입금가</span>
                      <span className="font-semibold text-gray-800">{depositPrice}원</span>
                    </div>
                  )}
                  {paymentStatusLabel && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">결제상태</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${paymentStatusLabel.cls}`}>
                        {paymentStatusLabel.label}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 템플릿 없음 안내 */}
            {!data.template && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-3 text-xs text-yellow-700">
                등록된 견적서 템플릿이 없습니다. 먼저 템플릿을 생성해주세요.
              </div>
            )}

            {/* 포함/불포함/일정/유의사항 */}
            {rendered?.includeItems && (
              <PreviewSection
                icon={<CheckCircle2 size={14} />}
                title="포함 사항"
                content={rendered.includeItems}
                iconColor="text-green-600"
              />
            )}
            {rendered?.excludeItems && (
              <PreviewSection
                icon={<XCircle size={14} />}
                title="불포함 사항"
                content={rendered.excludeItems}
                iconColor="text-red-500"
              />
            )}
            {rendered?.schedule && (
              <PreviewSection
                icon={<Calendar size={14} />}
                title="세부 일정"
                content={rendered.schedule}
                iconColor="text-blue-600"
              />
            )}

            {/* 일정 테이블 */}
            <ItineraryTable itineraries={itineraries} />

            {rendered?.notes && (
              <PreviewSection
                icon={<Info size={14} />}
                title="유의 사항"
                content={rendered.notes}
                iconColor="text-orange-500"
              />
            )}

            {/* 미입력 변수 경고 */}
            {rendered && (
              <UnreplacedVarWarning
                texts={[rendered.includeItems, rendered.excludeItems, rendered.schedule, rendered.notes]}
              />
            )}
          </>
        )}
      </div>

      {/* 하단 액션 */}
      {data?.reservation && (
        <div className="px-4 py-3 bg-white border-t border-gray-200 flex-shrink-0 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 flex-1"
            onClick={() => window.print()}
          >
            <Printer size={13} /> 인쇄
          </Button>
          <Button
            size="sm"
            className="gap-1.5 flex-1 bg-dogolf-green hover:bg-dogolf-green-dark text-white"
            onClick={() => {
              // 실제 견적서 발행 (토큰 생성)
              const url = `/erp/reservations?preview=${reservationId}`;
              window.open(url, "_blank");
            }}
          >
            <ExternalLink size={13} /> 견적서 발행
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── 미치환 변수 경고 ─────────────────────────────────────────────────────────
function UnreplacedVarWarning({ texts }: { texts: (string | null | undefined)[] }) {
  const unreplaced = useMemo(() => {
    const all = texts.filter(Boolean).join("\n");
    const matches = all.match(/\{\{[^}]+\}\}/g);
    if (!matches) return [];
    return Array.from(new Set(matches));
  }, [texts]);

  if (unreplaced.length === 0) return null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-3">
      <p className="text-xs font-semibold text-orange-700 mb-1.5">미치환 변수 ({unreplaced.length}개)</p>
      <div className="flex flex-wrap gap-1">
        {unreplaced.map((v) => (
          <span key={v} className="text-[11px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-mono">
            {v}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-orange-500 mt-1.5">예약 정보 또는 일정 데이터를 입력하면 자동으로 치환됩니다.</p>
    </div>
  );
}
