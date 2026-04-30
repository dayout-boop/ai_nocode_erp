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
  teeTime: string | null;
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

  // 일정 자동 치환: {{일정표}} → 일자별 텍스트 블록
  let scheduleBlock = "";
  if (itineraries && itineraries.length > 0) {
    scheduleBlock = itineraries
      .map((row) => {
        const dateStr = row.date ? new Date(row.date).toLocaleDateString("ko-KR") : "";
        const dayLabel = DAY_TYPE_KO[row.dayType ?? ""] ?? row.dayType ?? "";
        const golf = row.golfAffiliateName ? `골프장: ${row.golfAffiliateName}` : "";
        const hole = row.holeCount ? `${row.holeCount}홀` : "";
        const tee = row.teeTime ? `티오프: ${row.teeTime}` : "";
        const hotel = row.accommodationAffiliateName ? `숙소: ${row.accommodationAffiliateName}` : "";
        const room = row.roomType ? `(${row.roomType})` : "";
        const fi = row.flightInfo as { airline?: string; depAirport?: string; depTime?: string; arrAirport?: string; arrTime?: string } | null;
        const flight = fi?.airline ? `항공: ${fi.airline} ${fi.depAirport ?? ""}→${fi.arrAirport ?? ""} ${fi.depTime ?? ""}-${fi.arrTime ?? ""}` : "";
        const parts = [golf, hole && golf ? `(${hole})` : hole, tee, hotel + room, flight, row.notes].filter(Boolean);
        return `[${row.dayIndex + 1}일차 ${dayLabel}${dateStr ? " " + dateStr : ""}]\n${parts.join(" / ") || "-"}`;
      })
      .join("\n\n");
  }

  return template
    .replace(/\{\{고객명\}\}/g, String(reservation.customerName ?? ""))
    .replace(/\{\{예약번호\}\}/g, String(reservation.reservationNo ?? ""))
    .replace(/\{\{출발일\}\}/g, reservation.departureDate ? new Date(reservation.departureDate as string).toLocaleDateString("ko-KR") : "")
    .replace(/\{\{귀국일\}\}/g, reservation.returnDate ? new Date(reservation.returnDate as string).toLocaleDateString("ko-KR") : "")
    .replace(/\{\{골프장\}\}/g, String(reservation.golfCourseName ?? ""))
    .replace(/\{\{인원\}\}/g, String(reservation.numberOfPeople ?? ""))
    .replace(/\{\{팀수\}\}/g, String(reservation.numberOfTeams ?? ""))
    .replace(/\{\{판매가\}\}/g, reservation.salePrice ? Number(reservation.salePrice).toLocaleString() + "원" : "")
    .replace(/\{\{1인가격\}\}/g, reservation.numberOfPeople && reservation.salePrice
      ? Math.round(Number(reservation.salePrice) / Number(reservation.numberOfPeople)).toLocaleString() + "원"
      : "")
    .replace(/\{\{담당자\}\}/g, String(reservation.managerName ?? ""))
    .replace(/\{\{연락처\}\}/g, String(reservation.phone ?? ""))
    .replace(/\{\{티타임\}\}/g, String(reservation.teeTime ?? ""))
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
                          {row.teeTime ? <span className="text-gray-400 text-xs">티오프 {row.teeTime}</span> : null}
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
