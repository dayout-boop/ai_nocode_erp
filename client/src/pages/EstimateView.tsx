/**
 * 공개 견적서 페이지 - /estimate/:token
 * 로그인 없이 접근 가능한 고객용 견적서
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Phone, Mail, Calendar, MapPin, Users, DollarSign, CheckCircle2, XCircle, Info, Printer, Plane, Hotel, Flag } from "lucide-react";

// 일정 타입
type ItineraryItem = {
  id: number;
  dayIndex: number;
  date: Date | null;
  dayType: string | null;
  holeCount: number | null;
  /** @deprecated use estimatedTeeTime or confirmedTeeTime */
  teeTime?: string | null;
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

// 변수 치환 함수
function replaceVariables(
  template: string,
  reservation: Record<string, unknown>,
  itineraries?: ItineraryItem[]
): string {
  if (!template) return "";

  // 일정 자동 치환: {{일정표}} → 일자별 구조화 텍스트 블록
  // 미입력 항목은 자동 제외, 상품군별 일차 자동 매핑
  let scheduleBlock = "";
  if (itineraries && itineraries.length > 0) {
    scheduleBlock = itineraries
      .map((row) => {
        const dateStr = row.date ? new Date(row.date).toLocaleDateString("ko-KR") : "";
        const dayLabel = DAY_TYPE_KO[row.dayType ?? ""] ?? row.dayType ?? "";
        const dayNum = row.dayIndex + 1;
        const lines: string[] = [];

        // 헤더: N일차 [타입] (날짜)
        const header = `■ ${dayNum}일차 [${dayLabel}]${dateStr ? " (" + dateStr + ")" : ""}`;
        lines.push(header);

        // 항공 (출발일/도착일에만 표시)
        const fi = row.flightInfo as { airline?: string; depAirport?: string; depTime?: string; arrAirport?: string; arrTime?: string } | null;
        if (fi?.airline) {
          const flightStr = [fi.airline, fi.depAirport && fi.arrAirport ? `${fi.depAirport}→${fi.arrAirport}` : "", fi.depTime && fi.arrTime ? `${fi.depTime}-${fi.arrTime}` : ""].filter(Boolean).join(" ");
          lines.push(`  ✈ 항공: ${flightStr}`);
        } else if (row.dayType === "departure" || row.dayType === "arrival") {
          lines.push(`  ✈ 항공: 개별항공`);
        }

        // 골프장 (입력된 경우만)
        if (row.golfAffiliateName) {
          const teeVal = row.confirmedTeeTime || row.estimatedTeeTime || (row as any).teeTime;
          const holeStr = row.holeCount ? ` ${row.holeCount}홀` : "";
          const teeStr = teeVal ? ` / 티오프 ${teeVal}` : "";
          lines.push(`  ⛳ 골프: ${row.golfAffiliateName}${holeStr}${teeStr}`);
        }

        // 숙소 (도착일 제외, 입력된 경우만)
        if (row.accommodationAffiliateName && row.dayType !== "arrival") {
          const roomStr = row.roomType ? ` (${row.roomType}${row.roomCount ? ` ${row.roomCount}실` : ""})` : "";
          lines.push(`  🏨 숙소: ${row.accommodationAffiliateName}${roomStr}`);
        }

        // 비고
        if (row.notes) {
          lines.push(`  📝 ${row.notes}`);
        }

        return lines.join("\n");
      })
      .join("\n\n");
  }

  // N일차 개별 변수 치환: {{1일차-골프}}, {{2일차-숙소}}, {{3일차-티타임}} 등
  let result = template;
  if (itineraries && itineraries.length > 0) {
    itineraries.forEach((row) => {
      const n = row.dayIndex + 1;
      const teeVal = row.confirmedTeeTime || row.estimatedTeeTime || (row as any).teeTime || "";
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
    .replace(/\{\{티타임\}\}/g, String(reservation.confirmedTeeTime ?? reservation.estimatedTeeTime ?? (reservation as any).teeTime ?? ""))
    .replace(/\{\{숙소\}\}/g, String(reservation.accommodationName ?? ""))
    .replace(/\{\{국가\}\}/g, String(reservation.country ?? ""))
    .replace(/\{\{발송일\}\}/g, new Date().toLocaleDateString("ko-KR"))
    .replace(/\{\{일정표\}\}/g, scheduleBlock)
    .replace(/\{\{상품군\}\}/g, String(reservation.packageType ?? ""));
}

export default function EstimateView() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const { data, isLoading, error } = trpc.estimates.getByToken.useQuery(
    { token },
    { enabled: !!token }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">견적서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">견적서를 찾을 수 없습니다.</p>
          <p className="text-gray-400 text-sm mt-1">링크가 만료되었거나 잘못된 주소입니다.</p>
        </div>
      </div>
    );
  }

  const { estimate, reservation, template, itineraries } = data as typeof data & { itineraries?: ItineraryItem[] };
  if (!reservation) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">예약 정보가 없습니다.</p></div>;
  }

  const res = reservation as Record<string, unknown>;

  const includeItems = template?.includeItems ? replaceVariables(template.includeItems, res, itineraries) : null;
  const excludeItems = template?.excludeItems ? replaceVariables(template.excludeItems, res, itineraries) : null;
  const schedule = template?.schedule ? replaceVariables(template.schedule, res, itineraries) : null;
  const notes = template?.notes ? replaceVariables(template.notes, res, itineraries) : null;
  const hasItineraries = itineraries && itineraries.length > 0;

  const departureDate = res.departureDate ? new Date(res.departureDate as string).toLocaleDateString("ko-KR") : "-";
  const returnDate = res.returnDate ? new Date(res.returnDate as string).toLocaleDateString("ko-KR") : "-";
  const salePrice = res.salePrice ? Number(res.salePrice).toLocaleString() : "-";
  const perPerson = res.numberOfPeople && res.salePrice
    ? Math.round(Number(res.salePrice) / Number(res.numberOfPeople)).toLocaleString()
    : "-";

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* 인쇄 버튼 */}
      <div className="print:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Printer size={14} />
          인쇄
        </button>
      </div>

      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* 헤더 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
          {/* 상단 그린 배너 */}
          <div className="bg-gradient-to-r from-green-700 to-green-500 px-6 py-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs font-medium tracking-widest uppercase mb-1">Golf Travel Estimate</p>
                <h1 className="text-2xl font-bold">골프 여행 견적서</h1>
              </div>
              <div className="text-right">
                <p className="text-green-100 text-xs">두골프투어</p>
                <p className="text-white font-bold text-lg">DO GOLF TOUR</p>
              </div>
            </div>
          </div>

          {/* 예약 기본 정보 */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-gray-400">고객명</p>
                <p className="text-lg font-bold text-gray-900">{String(res.customerName ?? "-")}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">예약번호</p>
                <p className="text-sm font-mono font-semibold text-green-700">{String(res.reservationNo ?? "-")}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                  <Calendar size={12} /> 출발일
                </div>
                <p className="font-semibold text-gray-900 text-sm">{departureDate}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                  <Calendar size={12} /> 귀국일
                </div>
                <p className="font-semibold text-gray-900 text-sm">{returnDate}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                  <MapPin size={12} /> 골프장
                </div>
                <p className="font-semibold text-gray-900 text-sm">{String(res.golfCourseName ?? "-")}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                  <Users size={12} /> 인원
                </div>
                <p className="font-semibold text-gray-900 text-sm">{String(res.numberOfPeople ?? "-")}명</p>
              </div>
            </div>
          </div>
        </div>

        {/* 견적 금액 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={16} className="text-green-600" />
            <h2 className="font-bold text-gray-900">견적 금액</h2>
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <span className="text-gray-600 text-sm">총 금액</span>
            <span className="text-xl font-bold text-green-700">{salePrice}원</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-gray-500 text-sm">1인 금액</span>
            <span className="font-semibold text-gray-900">{perPerson}원</span>
          </div>
        </div>

        {/* 포함 사항 */}
        {includeItems && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} className="text-green-600" />
              <h2 className="font-bold text-gray-900">포함 사항</h2>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">{includeItems}</pre>
          </div>
        )}

        {/* 불포함 사항 */}
        {excludeItems && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <XCircle size={16} className="text-red-500" />
              <h2 className="font-bold text-gray-900">불포함 사항</h2>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">{excludeItems}</pre>
          </div>
        )}

        {/* 세부 일정 (템플릿 텍스트) */}
        {schedule && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-blue-600" />
              <h2 className="font-bold text-gray-900">세부 일정</h2>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">{schedule}</pre>
          </div>
        )}

        {/* 일정 테이블 (reservation_itineraries 데이터) */}
        {hasItineraries && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={16} className="text-green-600" />
              <h2 className="font-bold text-gray-900">여행 일정</h2>
            </div>
            <div className="space-y-3">
              {itineraries!.map((row, idx) => {
                const dateStr = row.date ? new Date(row.date).toLocaleDateString("ko-KR") : "";
                const dayLabel = DAY_TYPE_KO[row.dayType ?? ""] ?? row.dayType ?? "";
                const fi = row.flightInfo as { airline?: string; depAirport?: string; depTime?: string; arrAirport?: string; arrTime?: string } | null;
                return (
                  <div key={idx} className="border rounded-xl p-3 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-gray-700 bg-white border px-2 py-0.5 rounded-full">
                        {row.dayIndex + 1}일차
                      </span>
                      <span className="text-xs text-gray-500">{dayLabel}</span>
                      {dateStr && <span className="text-xs text-gray-400">{dateStr}</span>}
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 text-sm">
                      {row.golfAffiliateName && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Flag size={12} className="text-green-600 flex-shrink-0" />
                          <span className="font-medium">{row.golfAffiliateName}</span>
                          {row.holeCount ? <span className="text-gray-400 text-xs">{row.holeCount}홀</span> : null}
                          {(row.confirmedTeeTime || row.estimatedTeeTime || (row as any).teeTime) ? <span className="text-gray-400 text-xs">티오프 {row.confirmedTeeTime || row.estimatedTeeTime || (row as any).teeTime}</span> : null}
                        </div>
                      )}
                      {row.accommodationAffiliateName && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Hotel size={12} className="text-blue-600 flex-shrink-0" />
                          <span>{row.accommodationAffiliateName}</span>
                          {row.roomType ? <span className="text-gray-400 text-xs">({row.roomType})</span> : null}
                        </div>
                      )}
                      {fi?.airline && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <Plane size={12} className="text-purple-600 flex-shrink-0" />
                          <span>{fi.airline}</span>
                          {fi.depAirport && fi.arrAirport && (
                            <span className="text-gray-400 text-xs">{fi.depAirport}→{fi.arrAirport} {fi.depTime}-{fi.arrTime}</span>
                          )}
                        </div>
                      )}
                      {row.notes && (
                        <p className="text-xs text-gray-500 mt-1">{row.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 기타 안내사항 */}
        {notes && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Info size={16} className="text-gray-500" />
              <h2 className="font-bold text-gray-900">기타 안내사항</h2>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-600 leading-relaxed font-sans">{notes}</pre>
          </div>
        )}

        {/* 담당자 정보 */}
        <div className="bg-green-50 rounded-2xl border border-green-100 px-6 py-5">
          <h2 className="font-bold text-green-800 mb-3 text-sm">담당자 문의</h2>
          <div className="space-y-2">
            {!!res.managerName && (
              <div className="flex items-center gap-2 text-sm text-green-900">
                <Users size={14} className="text-green-600" />
                <span>{String(res.managerName)}</span>
              </div>
            )}
            {!!res.phone && (
              <div className="flex items-center gap-2 text-sm text-green-900">
                <Phone size={14} className="text-green-600" />
                <a href={`tel:${String(res.phone)}`} className="hover:underline">{String(res.phone)}</a>
              </div>
            )}
            {!!res.email && (
              <div className="flex items-center gap-2 text-sm text-green-900">
                <Mail size={14} className="text-green-600" />
                <a href={`mailto:${String(res.email)}`} className="hover:underline">{String(res.email)}</a>
              </div>
            )}
          </div>
        </div>

        {/* 발급일 */}
        <p className="text-center text-xs text-gray-400 mt-6">
          발급일: {new Date().toLocaleDateString("ko-KR")} · 두골프투어
        </p>
      </div>
    </div>
  );
}
