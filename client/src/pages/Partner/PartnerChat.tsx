// ============================================================
// DOGOLF Partner Chat — 두골프 매니저 AI 채팅 페이지 v3.0
// Generative UI: 상품 카드, 수기예약 폼, 예약현황 카드
// 세션 이어가기: 이전 대화 목록 + 복원
// ※ Manus OAuth 독립 — partner_session 쿠키 기반 자체 인증
// ============================================================
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { usePartnerAuth } from "@/_core/hooks/usePartnerAuth";
import { partnerTrpc, createPartnerTrpcClient, createPartnerQueryClient } from "@/lib/partnerTrpc";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  Send,
  Loader2,
  ChevronLeft,
  Bot,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  History,
  X,
  ExternalLink,
  Users,
  ChevronRight,
  Package,
  ClipboardList,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";

// ─── 타입 정의 ───────────────────────────────────────────────
interface ManagerSlot {
  id: number;
  departureDate: string;
  returnDate: string | null;
  totalSlots: number;
  bookedSlots: number;
  adultPrice: string | null;
  depositPrice: string | null;
  affiliatePrice: string | null;
  status: string;
}

interface ManagerPackageCard {
  id: number;
  title: string;
  country: string;
  duration: string | null;
  roundCount: number | null;
  imageUrl: string | null;
  isPopular: boolean;
  slots: ManagerSlot[];
}

interface ReservationRow {
  id: number;
  bookingNumber: string;
  leaderName: string;
  leaderPhone: string;
  packageTitle: string | null;
  departureDate: string | null;
  adultCount: number;
  totalAmount: string | null;
  status: string;
  createdAt: Date;
}

type ManagerUiCard =
  | { type: "product_cards"; packages: ManagerPackageCard[] }
  | { type: "booking_form"; packageId: number; packageTitle: string | null }
  | { type: "reservation_status"; bookings: ReservationRow[] };

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  uiCard?: ManagerUiCard | null;
}

// ─── 상수 ────────────────────────────────────────────────────
const QUICK_QUESTIONS = [
  "오늘 예약 현황 알려줘",
  "등록 상품 목록 보여줘",
  "수기 예약 접수하고 싶어",
  "정산 현황 조회해줘",
  "ERP 사용법 안내해줘",
];

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "안녕하세요! 🤖 두골프 매니저입니다.\n\n파트너 운영에 필요한 모든 것을 도와드립니다.\n상품 조회, 예약 현황, 수기 예약 접수, 정산 안내 등 무엇이든 물어보세요!",
  timestamp: new Date(),
};

function generateSessionId() {
  return `mgr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatPrice(price: string | null): string {
  if (!price) return "";
  const n = Number(price);
  if (isNaN(n)) return "";
  if (n >= 10000) {
    const man = n / 10000;
    return man % 1 === 0 ? `${man}만원` : `${man.toFixed(1)}만원`;
  }
  return `${n.toLocaleString()}원`;
}

function formatDate(dateStr: string | null | Date): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", weekday: "short" });
}

function statusLabel(status: string): { text: string; cls: string } {
  const map: Record<string, { text: string; cls: string }> = {
    pending: { text: "대기", cls: "bg-yellow-100 text-yellow-700" },
    confirmed: { text: "확정", cls: "bg-green-100 text-green-700" },
    cancelled: { text: "취소", cls: "bg-red-100 text-red-700" },
    completed: { text: "완료", cls: "bg-gray-100 text-gray-600" },
  };
  return map[status] ?? { text: status, cls: "bg-gray-100 text-gray-600" };
}

// ─── 상품 카드 컴포넌트 ──────────────────────────────────────
function ManagerProductCarousel({ packages }: { packages: ManagerPackageCard[] }) {
  const [idx, setIdx] = useState(0);
  const pkg = packages[idx];
  if (!pkg) return null;

  const availableSlots = pkg.slots.filter((s) => s.status === "open" && s.totalSlots - s.bookedSlots > 0);
  const minPrice = availableSlots.length > 0
    ? Math.min(...availableSlots.map((s) => Number(s.adultPrice ?? 0)).filter(Boolean))
    : null;

  return (
    <div className="mt-2 rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-indigo-700 font-body flex items-center gap-1">
          <Package size={12} />
          등록 상품 ({packages.length}개)
        </p>
        {packages.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="w-5 h-5 rounded-full border border-indigo-200 flex items-center justify-center hover:bg-indigo-50 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={10} className="text-indigo-600" />
            </button>
            <span className="text-[10px] text-indigo-600 font-number">{idx + 1}/{packages.length}</span>
            <button
              onClick={() => setIdx((i) => Math.min(packages.length - 1, i + 1))}
              disabled={idx === packages.length - 1}
              className="w-5 h-5 rounded-full border border-indigo-200 flex items-center justify-center hover:bg-indigo-50 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={10} className="text-indigo-600" />
            </button>
          </div>
        )}
      </div>
      <div className="relative">
        {pkg.imageUrl ? (
          <img src={pkg.imageUrl} alt={pkg.title} className="w-full h-28 object-cover" />
        ) : (
          <div className="w-full h-28 bg-gradient-to-br from-indigo-100 to-green-100 flex items-center justify-center">
            <span className="text-3xl">⛳</span>
          </div>
        )}
        {pkg.isPopular && (
          <span className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">인기</span>
        )}
        {minPrice && (
          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-lg font-number">
            {formatPrice(String(minPrice))}~
          </span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-gray-900 text-sm font-body leading-tight">{pkg.title}</p>
            <p className="text-xs text-gray-500 font-body mt-0.5">
              {pkg.country} · {pkg.duration ?? "기간 미정"} · {pkg.roundCount ?? 0}라운드
            </p>
          </div>
          <a
            href={`/erp/packages/${pkg.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-body bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
          >
            <ExternalLink size={10} />
            상세
          </a>
        </div>
        {availableSlots.length > 0 ? (
          <div className="mt-2">
            <p className="text-[10px] text-gray-400 font-body mb-1">출발 가능일</p>
            <div className="flex flex-wrap gap-1">
              {availableSlots.slice(0, 4).map((s) => (
                <span
                  key={s.id}
                  className="text-[10px] bg-green-50 border border-green-200 text-green-700 rounded-md px-2 py-0.5 font-number"
                >
                  {formatDate(s.departureDate)} · 잔{s.totalSlots - s.bookedSlots}
                </span>
              ))}
              {availableSlots.length > 4 && (
                <span className="text-[10px] text-gray-400 font-body">+{availableSlots.length - 4}개</span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-gray-400 font-body mt-2">현재 예약 가능한 출발일이 없습니다</p>
        )}
      </div>
      {packages.length > 1 && (
        <div className="flex justify-center gap-1 pb-2">
          {packages.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`rounded-full transition-all ${i === idx ? "w-4 h-1.5 bg-indigo-500" : "w-1.5 h-1.5 bg-gray-300"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 수기 예약 폼 컴포넌트 ───────────────────────────────────
function ManagerBookingFormCard({
  packageId,
  packageTitle,
  managerName,
  onSubmit,
}: {
  packageId: number;
  packageTitle: string | null;
  managerName: string;
  onSubmit: (data: { customerName: string; customerPhone: string; pax: number; memo: string; managerName: string }) => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pax, setPax] = useState(2);
  const [memo, setMemo] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!customerName.trim() || !customerPhone.trim()) return;
    setSubmitted(true);
    onSubmit({ customerName: customerName.trim(), customerPhone: customerPhone.trim(), pax, memo: memo.trim(), managerName });
  };

  if (submitted) {
    return (
      <div className="mt-2 rounded-2xl border border-green-100 bg-green-50 px-4 py-4 flex items-start gap-3">
        <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-green-800 font-body">수기 예약이 접수되었습니다!</p>
          <p className="text-xs text-green-700 font-body mt-1">담당자: {managerName} · 고객: {customerName} ({customerPhone})</p>
          <p className="text-xs text-green-600 font-body mt-0.5">ERP 예약 관리에서 확인하실 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-2xl border border-green-100 bg-white shadow-sm overflow-hidden">
      <div className="px-3 py-2.5 bg-green-50 border-b border-green-100">
        <p className="text-xs font-semibold text-green-700 font-body">
          ✍️ 수기 예약 접수{packageTitle && <span className="ml-1 text-green-600">— {packageTitle}</span>}
        </p>
      </div>
      <div className="px-3 py-3 space-y-2.5">
        <div className="bg-indigo-50 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-[10px] text-indigo-500 font-body">담당자</span>
          <span className="text-xs font-bold text-indigo-700 font-body">{managerName}</span>
          <span className="text-[10px] text-indigo-400 font-body ml-auto">자동 입력</span>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 font-body mb-1 block">고객 이름 *</label>
          <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="홍길동"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 font-body" />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 font-body mb-1 block">고객 연락처 *</label>
          <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="010-0000-0000"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 font-body" />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 font-body mb-1 block flex items-center gap-1"><Users size={10} /> 인원 (성인)</label>
          <div className="flex items-center gap-2">
            <button onClick={() => setPax((p) => Math.max(1, p - 1))} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 font-bold transition-colors">−</button>
            <span className="text-sm font-bold text-gray-800 font-number w-6 text-center">{pax}</span>
            <button onClick={() => setPax((p) => Math.min(50, p + 1))} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 font-bold transition-colors">+</button>
            <span className="text-xs text-gray-400 font-body">명</span>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 font-body mb-1 block">메모 (출발일, 특이사항 등)</label>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="희망 출발일, 특이사항, 추가 요청사항 등" rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-400 font-body" />
        </div>
        <button onClick={handleSubmit} disabled={!customerName.trim() || !customerPhone.trim()}
          className="w-full py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-body">
          수기 예약 접수하기
        </button>
      </div>
    </div>
  );
}

// ─── 예약 현황 카드 컴포넌트 ─────────────────────────────────
function ReservationStatusCard({ bookings }: { bookings: ReservationRow[] }) {
  if (bookings.length === 0) {
    return (
      <div className="mt-2 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 text-center">
        <ClipboardList size={20} className="text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500 font-body">조회된 예약이 없습니다</p>
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
      <div className="px-3 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-blue-700 font-body flex items-center gap-1">
          <ClipboardList size={12} />
          최근 예약 현황 ({bookings.length}건)
        </p>
        <a href="/erp/reservations" target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-blue-600 hover:text-blue-800 font-body flex items-center gap-0.5">
          전체보기 <ExternalLink size={9} />
        </a>
      </div>
      <div className="divide-y divide-gray-50">
        {bookings.map((b) => {
          const st = statusLabel(b.status);
          return (
            <div key={b.id} className="px-3 py-2.5 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-800 font-number">{b.bookingNumber}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-body ${st.cls}`}>{st.text}</span>
                </div>
                <p className="text-[11px] text-gray-500 font-body truncate mt-0.5">
                  {b.leaderName} · {b.packageTitle ?? "상품 미지정"} · {b.adultCount}명
                </p>
                {b.departureDate && <p className="text-[10px] text-gray-400 font-body">출발 {formatDate(b.departureDate)}</p>}
              </div>
              {b.totalAmount && <span className="text-xs font-bold text-gray-700 font-number flex-shrink-0">{formatPrice(b.totalAmount)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 세션 이어가기 드로어 ────────────────────────────────────
function SessionHistoryDrawer({
  isOpen,
  onClose,
  onSelectSession,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
}) {
  const { data, isLoading } = partnerTrpc.chat.listManagerSessions.useQuery(
    { limit: 20 },
    { enabled: isOpen }
  );
  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-20" onClick={onClose} />}
      <div className={`fixed top-0 right-0 h-full w-72 bg-white shadow-xl z-30 transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="font-bold text-gray-900 text-sm font-body flex items-center gap-2">
            <History size={16} className="text-indigo-600" />
            이전 대화 이어가기
          </p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-52px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-indigo-500" />
            </div>
          ) : !data?.sessions?.length ? (
            <div className="text-center py-8 px-4">
              <History size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400 font-body">이전 대화 내역이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.sessions.map((s) => (
                <button key={s.sessionId} onClick={() => { onSelectSession(s.sessionId); onClose(); }}
                  className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors">
                  <p className="text-sm text-gray-800 font-body truncate leading-tight">{s.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400 font-body">
                      {new Date(s.lastMessageAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
                    </span>
                    <span className="text-[10px] text-gray-400 font-body">{s.messageCount}개 메시지</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── 비로그인 화면 ─────────────────────────────────────────────────────
function NotLoggedInView() {
  if (typeof window !== "undefined") { window.location.replace("/partner/login"); }
  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/50 text-sm">로그인 페이지로 이동 중...</p>
      </div>
    </div>
  );
}

// ─── 온보딩 신청 대기 화면 ─────────────────────────────────────────────────────
function OnboardingPendingView({ status, companyName, adminNote }: { status: string; companyName: string; adminNote?: string | null }) {
  const statusConfig: Record<string, { icon: React.ReactNode; bg: string; border: string; title: string; desc: string }> = {
    pending: { icon: <Clock size={24} className="text-yellow-500" />, bg: "bg-yellow-50", border: "border-yellow-200", title: "심사 대기 중", desc: "파트너 신청서를 검토하고 있습니다. 영업일 기준 1~3일 내 결과를 안내드립니다." },
    reviewing: { icon: <Clock size={24} className="text-blue-500" />, bg: "bg-blue-50", border: "border-blue-200", title: "심사 진행 중", desc: "담당자가 신청 내용을 검토하고 있습니다. 곧 연락드리겠습니다." },
    rejected: { icon: <XCircle size={24} className="text-red-500" />, bg: "bg-red-50", border: "border-red-200", title: "신청 반려", desc: adminNote ?? "신청이 반려되었습니다. 내용을 수정하여 재신청해 주세요." },
  };
  const cfg = statusConfig[status] ?? { icon: <Clock size={24} className="text-gray-500" />, bg: "bg-gray-50", border: "border-gray-200", title: "처리 중", desc: "신청 상태를 확인 중입니다." };
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-6 text-center`}>
          <div className="flex justify-center mb-3">{cfg.icon}</div>
          <h2 className="font-bold text-gray-900 text-lg font-body mb-2">{cfg.title}</h2>
          <p className="text-gray-600 text-sm font-body leading-relaxed">{cfg.desc}</p>
          {companyName && <p className="text-xs text-gray-400 font-body mt-3">업체명: {companyName}</p>}
        </div>
        <p className="text-center text-xs text-gray-400 font-body mt-4">문의: 1668-1739 (평일 09:00~17:30)</p>
      </div>
    </div>
  );
}

// ─── 온보딩 시작 화면 ─────────────────────────────────────────────────────
function OnboardingStartView({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-green-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 font-display-ko mb-2">{userName} 님, 환영합니다!</h1>
          <p className="text-gray-500 text-sm font-body">{userEmail} · 로그인 완료</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="font-bold text-gray-900 text-base font-body mb-2">파트너 가입 신청</h2>
          <p className="text-gray-500 text-sm font-body mb-4">사업자등록증을 업로드하면 AI가 자동으로 정보를 인식하고 ERP + 홈페이지를 생성합니다.</p>
          <div className="space-y-2">
            {["STEP 1 · 기본 정보 입력", "STEP 2 · 사업자등록증 업로드 (AI OCR 자동 인식)", "STEP 3 · 구독 플랜 선택", "STEP 4 · ERP + 홈페이지 자동 생성"].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-indigo-600">{i + 1}</span>
                </div>
                <span className="text-sm text-gray-600 font-body">{step}</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => navigate("/partner/join")}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold font-body py-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-base">
          <Upload size={18} />
          파트너 가입 신청하기
        </button>
        <p className="text-center text-xs text-gray-400 font-body mt-4">약 5분 소요 · 신용카드 불필요 · 무료로 시작</p>
      </div>
    </div>
  );
}

// ─── 메인 채팅 컴포넌트 ──────────────────────────────────────
function PartnerChatContent() {
  const { user, loading, isAuthenticated } = usePartnerAuth();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = partnerTrpc.aiAssistant.managerChat.useMutation();

  const { data: onboardingStatus, isLoading: onboardingLoading } =
    partnerTrpc.partnerOnboarding.getMyStatus.useQuery(undefined, {
      enabled: isAuthenticated,
      retry: false,
    });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (isAuthenticated && (onboardingStatus?.status === "approved" || onboardingStatus?.status === "active")) {
      inputRef.current?.focus();
    }
  }, [isAuthenticated, onboardingStatus]);

  if (loading || (isAuthenticated && onboardingLoading)) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-green-600" size={32} /></div>;
  }
  if (!isAuthenticated) return <NotLoggedInView />;
  if (!onboardingStatus?.hasApplication) return <OnboardingStartView userName={user?.name ?? "파트너"} userEmail={user?.email ?? ""} />;

  const activeStatus = onboardingStatus.status;
  if (activeStatus === "pending" || activeStatus === "reviewing" || activeStatus === "rejected") {
    return <OnboardingPendingView status={activeStatus} companyName={onboardingStatus.data?.companyName ?? ""} adminNote={onboardingStatus.data?.adminNote} />;
  }

  const managerName = user?.name ?? "파트너";

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    try {
      const history = messages.filter((m) => m.id !== "welcome").slice(-8)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      const result = await chatMutation.mutateAsync({ sessionId, message: text.trim(), history });
      const assistantMsg: Message = {
        id: `a-${Date.now()}`, role: "assistant", content: result.response,
        timestamp: new Date(), uiCard: (result as { response: string; uiCard?: ManagerUiCard | null }).uiCard ?? null,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: "죄송합니다. 일시적인 오류가 발생했습니다.\n\n📞 파트너 지원: 1668-1739", timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleSelectSession = async (selectedSessionId: string) => {
    setLoadingSession(true);
    try {
      const response = await fetch(`/api/trpc/chat.getManagerSessionMessages?input=${encodeURIComponent(JSON.stringify({ json: { sessionId: selectedSessionId, limit: 100 } }))}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const msgs = data?.result?.data?.json?.messages ?? data?.result?.data?.messages ?? [];
        if (msgs.length > 0) {
          const restored: Message[] = msgs.map((m: { id: number; role: string; content: string; createdAt: string }) => ({
            id: `restored-${m.id}`, role: m.role as "user" | "assistant",
            content: m.content, timestamp: new Date(m.createdAt),
          }));
          setMessages([{ id: "session-restored", role: "assistant", content: `📂 이전 대화를 불러왔습니다. (${restored.length}개 메시지)`, timestamp: new Date() }, ...restored]);
          setSessionId(selectedSessionId);
        }
      }
    } catch (e) { console.error("[PartnerChat] 세션 복원 실패:", e); }
    finally { setLoadingSession(false); }
  };

  const handleNewChat = () => { setMessages([WELCOME_MESSAGE]); setSessionId(generateSessionId()); setInput(""); };

  const handleBookingSubmit = (data: { customerName: string; customerPhone: string; pax: number; memo: string; managerName: string }) => {
    sendMessage(`수기 예약을 접수했습니다. 고객: ${data.customerName}, 연락처: ${data.customerPhone}, 인원: ${data.pax}명, 담당자: ${data.managerName}${data.memo ? `, 메모: ${data.memo}` : ""}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/partner">
            <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Bot size={18} className="text-indigo-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm font-body">두골프 매니저</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <p className="text-xs text-gray-500 font-body">AI 파트너 지원</p>
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-400 font-body hidden sm:block">{managerName} 님</span>
            <button onClick={handleNewChat} title="새 대화 시작" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <RotateCcw size={16} className="text-gray-500" />
            </button>
            <button onClick={() => setIsHistoryOpen(true)} title="이전 대화 이어가기" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <History size={16} className="text-gray-500" />
            </button>
          </div>
        </div>
      </header>

      {loadingSession && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 flex items-center gap-2">
          <Loader2 size={12} className="animate-spin text-indigo-500" />
          <span className="text-xs text-indigo-600 font-body">이전 대화를 불러오는 중...</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {messages.length === 1 && (
            <div className="bg-indigo-50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-indigo-700 font-body mb-2">💡 자주 묻는 질문</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((q) => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="text-xs bg-white border border-indigo-200 text-indigo-700 rounded-full px-3 py-1.5 hover:bg-indigo-50 transition-colors font-body">{q}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                  <Bot size={16} className="text-indigo-600" />
                </div>
              )}
              <div className={`max-w-[78%] ${msg.role === "user" ? "" : "w-full"}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "bg-indigo-600 text-white rounded-br-sm" : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"}`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none"><Streamdown>{msg.content}</Streamdown></div>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                  <p className={`text-xs mt-1.5 ${msg.role === "user" ? "text-indigo-200" : "text-gray-400"}`}>
                    {msg.timestamp.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {msg.uiCard && (
                  <div className="mt-1">
                    {msg.uiCard.type === "product_cards" && <ManagerProductCarousel packages={msg.uiCard.packages} />}
                    {msg.uiCard.type === "booking_form" && (
                      <ManagerBookingFormCard packageId={msg.uiCard.packageId} packageTitle={msg.uiCard.packageTitle} managerName={managerName} onSubmit={handleBookingSubmit} />
                    )}
                    {msg.uiCard.type === "reservation_status" && <ReservationStatusCard bookings={msg.uiCard.bookings} />}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                <Bot size={16} className="text-indigo-600" />
              </div>
              <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-white border-t border-gray-200 sticky bottom-0">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="파트너 운영 관련 질문을 입력하세요..." rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm font-body focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent max-h-32 overflow-y-auto"
              style={{ lineHeight: "1.4" }} />
            <Button onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping}
              className="w-11 h-11 bg-indigo-600 hover:bg-indigo-700 rounded-xl p-0 flex-shrink-0">
              {isTyping ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </Button>
          </div>
          <p className="text-xs text-gray-400 font-body text-center mt-1.5">Enter 전송 · Shift+Enter 줄바꿈</p>
        </div>
      </div>

      <SessionHistoryDrawer isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} onSelectSession={handleSelectSession} />
    </div>
  );
}

// ─── 래퍼 (partnerTrpc Provider) ─────────────────────────────────────────────
export default function PartnerChat() {
  const queryClient = useMemo(() => createPartnerQueryClient(), []);
  const trpcClient = useMemo(() => createPartnerTrpcClient(), []);
  return (
    <partnerTrpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <PartnerChatContent />
      </QueryClientProvider>
    </partnerTrpc.Provider>
  );
}
