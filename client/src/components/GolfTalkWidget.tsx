// ============================================================
// DOGOLF GolfTalk Widget v4.0 — Generative UI 지원
// 상품 캐러셀 | 예약자 폼 | 예약 조회 카드 | 빠른답변
// ============================================================
import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Send, Loader2, MessageCircle, Phone, ChevronLeft, ChevronRight,
  Users, CalendarDays, Search, CheckCircle2, ExternalLink,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import DepartureDateCalendar from "./DepartureDateCalendar";

// ─── 타입 정의 ───────────────────────────────────────────────
interface PackageCardData {
  id: number;
  title: string;
  country: string;
  duration: string | null;
  roundCount: number | null;
  imageUrl: string | null;
  isPopular: boolean;
  slots: Array<{
    id: number;
    departureDate: string;
    returnDate: string | null;
    totalSlots: number;
    bookedSlots: number;
    adultPrice: string | null;
    status: string;
  }>;
}

type UiCard =
  | { type: "product_cards"; packages: PackageCardData[] }
  | { type: "booking_form"; packageId: number; packageTitle: string | null }
  | { type: "booking_lookup" };

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  quickReplies?: string[];
  isFollowUp?: boolean;
  uiCard?: UiCard | null;
}

// ─── 상수 ────────────────────────────────────────────────────
const QUICK_QUESTIONS = [
  "추천 골프 패키지 알려줘",
  "태국 골프 여행 일정은?",
  "예약 방법이 궁금해요",
  "가성비 패키지 추천",
];

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "안녕하세요! ⛳ 골프톡입니다.\n두골프의 AI 골프 여행 전문 상담사예요. 패키지 추천, 예약 안내, 골프 정보 무엇이든 물어보세요!",
  timestamp: new Date(),
  quickReplies: QUICK_QUESTIONS,
};

function generateSessionId() {
  return `gt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── 파싱 유틸 ───────────────────────────────────────────────
function parseQuickReplies(content: string): { cleanContent: string; quickReplies: string[]; isFollowUp: boolean } {
  const quickMatch = content.match(/\[빠른답변:\s*([^\]]+)\]/);
  const followMatch = content.match(/\[후속질문:\s*([^\]]+)\]/);
  const match = quickMatch || followMatch;
  const isFollowUp = Boolean(!quickMatch && followMatch);
  if (!match) return { cleanContent: content, quickReplies: [], isFollowUp: false };
  const quickReplies = match[1].split("|").map((s) => s.trim()).filter(Boolean);
  const cleanContent = content.replace(/\[(빠른답변|후속질문):\s*[^\]]+\]/, "").trim();
  return { cleanContent, quickReplies, isFollowUp };
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

// ─── 상품 캐러셀 카드 ────────────────────────────────────────
function ProductCarousel({ packages, onSelectPackage }: {
  packages: PackageCardData[];
  onSelectPackage: (pkg: PackageCardData) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const pkg = packages[idx];
  if (!pkg) return null;

  const cheapestSlot = pkg.slots.reduce<PackageCardData["slots"][0] | null>((min, s) => {
    if (!s.adultPrice) return min;
    if (!min || Number(s.adultPrice) < Number(min.adultPrice ?? "9999999999")) return s;
    return min;
  }, null);

  return (
    <div className="mt-2 rounded-2xl border border-green-100 bg-white shadow-sm overflow-hidden">
      {/* 상단 네비게이션 */}
      <div className="flex items-center justify-between px-3 py-2 bg-green-50 border-b border-green-100">
        <span className="text-xs font-semibold text-green-700 font-body">
          ⛳ 추천 패키지 {idx + 1} / {packages.length}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => { setIdx((i) => (i - 1 + packages.length) % packages.length); setSelectedSlotId(null); }}
            disabled={packages.length <= 1}
            className="w-6 h-6 rounded-full bg-white border border-green-200 flex items-center justify-center hover:bg-green-100 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={12} />
          </button>
          <button
            onClick={() => { setIdx((i) => (i + 1) % packages.length); setSelectedSlotId(null); }}
            disabled={packages.length <= 1}
            className="w-6 h-6 rounded-full bg-white border border-green-200 flex items-center justify-center hover:bg-green-100 disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* 상품 이미지 */}
      {pkg.imageUrl && (
        <div className="relative h-32 overflow-hidden">
          <img src={pkg.imageUrl} alt={pkg.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          {pkg.isPopular && (
            <span className="absolute top-2 left-2 bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-body">
              인기
            </span>
          )}
          <div className="absolute bottom-2 left-3 right-3">
            <p className="text-white font-bold text-sm font-body leading-tight line-clamp-1">{pkg.title}</p>
            <p className="text-white/80 text-xs font-body">{pkg.country} · {pkg.duration ?? ""} · {pkg.roundCount ?? 0}라운드</p>
          </div>
        </div>
      )}
      {!pkg.imageUrl && (
        <div className="px-3 pt-3 pb-1">
          <p className="font-bold text-sm text-gray-800 font-body">{pkg.title}</p>
          <p className="text-xs text-gray-500 font-body">{pkg.country} · {pkg.duration ?? ""} · {pkg.roundCount ?? 0}라운드</p>
        </div>
      )}

      {/* 가격 표시 */}
      {cheapestSlot?.adultPrice && (
        <div className="px-3 py-2 flex items-center gap-1">
          <span className="text-xs text-gray-500 font-body">성인 1인</span>
          <span className="text-base font-bold text-green-600 font-number">{formatPrice(cheapestSlot.adultPrice)}~</span>
        </div>
      )}

      {/* 출발일 달력 */}
      {pkg.slots.length > 0 && (
        <div className="px-3 pb-3">
          <p className="text-[11px] text-gray-500 font-body mb-2 flex items-center gap-1">
            <CalendarDays size={11} /> 출발일을 선택하세요
          </p>
          <DepartureDateCalendar
            slots={pkg.slots.map((s) => ({
              ...s,
              departureDate: new Date(s.departureDate),
              returnDate: s.returnDate ? new Date(s.returnDate) : null,
            }))}
            basePrice={cheapestSlot?.adultPrice ? Number(cheapestSlot.adultPrice) : null}
            selectedSlotId={selectedSlotId}
            onSelect={(slot) => setSelectedSlotId(slot?.id ?? null)}
          />
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="px-3 pb-3 flex gap-2">
        <button
          onClick={() => onSelectPackage(pkg)}
          className="flex-1 py-2 bg-green-600 text-white text-xs font-semibold rounded-xl hover:bg-green-700 transition-colors font-body"
        >
          이 상품으로 예약 문의
        </button>
        <a
          href={`/packages/${pkg.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-2 border border-green-200 text-green-700 text-xs font-semibold rounded-xl hover:bg-green-50 transition-colors font-body"
        >
          <ExternalLink size={11} />
          상세보기
        </a>
      </div>

      {/* 페이지 인디케이터 */}
      {packages.length > 1 && (
        <div className="flex justify-center gap-1 pb-2">
          {packages.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIdx(i); setSelectedSlotId(null); }}
              className={`rounded-full transition-all ${i === idx ? "w-4 h-1.5 bg-green-500" : "w-1.5 h-1.5 bg-gray-300"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 예약자 정보 입력 폼 ─────────────────────────────────────
function BookingFormCard({ packageId, packageTitle, onSubmit }: {
  packageId: number;
  packageTitle: string | null;
  onSubmit: (data: { name: string; phone: string; pax: number; message: string }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pax, setPax] = useState(2);
  const [memo, setMemo] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!name.trim() || !phone.trim()) return;
    setSubmitted(true);
    onSubmit({ name: name.trim(), phone: phone.trim(), pax, message: memo.trim() });
  };

  if (submitted) {
    return (
      <div className="mt-2 rounded-2xl border border-green-100 bg-green-50 px-4 py-4 flex items-start gap-3">
        <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-green-800 font-body">예약 문의가 접수되었습니다!</p>
          <p className="text-xs text-green-700 font-body mt-1">담당자가 확인 후 빠르게 연락드리겠습니다. 📞 1668-1739</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-2xl border border-green-100 bg-white shadow-sm overflow-hidden">
      <div className="px-3 py-2.5 bg-green-50 border-b border-green-100">
        <p className="text-xs font-semibold text-green-700 font-body">
          📋 예약 문의 정보 입력
          {packageTitle && <span className="ml-1 text-green-600">— {packageTitle}</span>}
        </p>
      </div>
      <div className="px-3 py-3 space-y-2.5">
        <div>
          <label className="text-[11px] text-gray-500 font-body mb-1 block">예약자 이름 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 font-body"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 font-body mb-1 block">연락처 *</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 font-body"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 font-body mb-1 block flex items-center gap-1">
            <Users size={10} /> 인원 (성인)
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPax((p) => Math.max(1, p - 1))}
              className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 font-bold transition-colors"
            >−</button>
            <span className="text-sm font-bold text-gray-800 font-number w-6 text-center">{pax}</span>
            <button
              onClick={() => setPax((p) => Math.min(20, p + 1))}
              className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 font-bold transition-colors"
            >+</button>
            <span className="text-xs text-gray-400 font-body">명</span>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 font-body mb-1 block">추가 요청사항</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="희망 출발일, 특이사항 등"
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-400 font-body"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !phone.trim()}
          className="w-full py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-body"
        >
          예약 문의 접수하기
        </button>
      </div>
    </div>
  );
}

// ─── 예약 조회 카드 ──────────────────────────────────────────
function BookingLookupCard({ onLookup }: { onLookup: (query: string) => void }) {
  const [query, setQuery] = useState("");
  return (
    <div className="mt-2 rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
      <div className="px-3 py-2.5 bg-blue-50 border-b border-blue-100">
        <p className="text-xs font-semibold text-blue-700 font-body">🔍 예약 조회</p>
      </div>
      <div className="px-3 py-3 space-y-2.5">
        <div>
          <label className="text-[11px] text-gray-500 font-body mb-1 block">예약번호 또는 예약자 이름</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && query.trim() && onLookup(query.trim())}
            placeholder="예약번호 또는 이름 입력"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 font-body"
          />
        </div>
        <button
          onClick={() => query.trim() && onLookup(query.trim())}
          disabled={!query.trim()}
          className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-body flex items-center justify-center gap-2"
        >
          <Search size={14} />
          예약 조회하기
        </button>
      </div>
    </div>
  );
}

// ─── 메인 위젯 ───────────────────────────────────────────────
export default function GolfTalkWidget({ packageId }: { packageId?: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatMutation = trpc.aiAssistant.golfTalkChat.useMutation();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("openGolfTalk", handler);
    return () => window.removeEventListener("openGolfTalk", handler);
  }, []);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isOpen && isMobile) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isTyping) return;
      const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text.trim(), timestamp: new Date() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);
      try {
        const history = messages.filter((m) => m.id !== "welcome").slice(-8).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
        const result = await chatMutation.mutateAsync({ sessionId, message: text.trim(), history, packageId });
        const { cleanContent, quickReplies, isFollowUp } = parseQuickReplies(result.response);
        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: cleanContent,
          timestamp: new Date(),
          quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
          isFollowUp,
          uiCard: (result as any).uiCard ?? null,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errMsg: Message = {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. 📞 전화 상담: 1668-1739",
          timestamp: new Date(),
          quickReplies: ["카카오톡 연결", "전화 상담 연결"],
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsTyping(false);
      }
    },
    [chatMutation, isTyping, messages, packageId, sessionId]
  );

  const handleQuickReply = (reply: string) => {
    if (reply === "카카오톡 연결") { window.open("https://pf.kakao.com/_xnGxlxj", "_blank"); return; }
    if (reply === "전화 상담 연결") { window.location.href = "tel:1668-1739"; return; }
    sendMessage(reply);
  };

  const handlePackageSelect = (pkg: PackageCardData) => {
    sendMessage(`${pkg.title} 상품으로 예약 문의하고 싶어요`);
  };

  const handleBookingFormSubmit = (data: { name: string; phone: string; pax: number; message: string }) => {
    sendMessage(`예약 문의 접수: 예약자 ${data.name}, 연락처 ${data.phone}, 인원 ${data.pax}명${data.message ? `, 요청사항: ${data.message}` : ""}`);
  };

  const handleBookingLookup = (query: string) => {
    sendMessage(`예약 조회: ${query}`);
  };

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const currentQuickReplies = lastAssistantMsg?.quickReplies;
  const isCurrentFollowUp = lastAssistantMsg?.isFollowUp ?? false;

  return (
    <>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[9998] bg-black/40 md:hidden" onClick={() => setIsOpen(false)} />
          <div
            className={[
              "fixed z-[9999] bg-white flex flex-col overflow-hidden",
              "inset-0 md:inset-auto",
              "md:bottom-6 md:right-6",
              "md:w-[480px] md:h-[720px]",
              "md:rounded-2xl md:shadow-2xl md:border md:border-gray-100",
              "animate-in slide-in-from-bottom-4 duration-300",
            ].join(" ")}
          >
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 py-3.5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">⛳</div>
                <div>
                  <p className="text-white font-bold text-base font-body">AI상담톡</p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                    <p className="text-green-100 text-xs font-body">AI 골프 여행 전문 상담사 · 24시간 운영</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://pf.kakao.com/_xnGxlxj"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-body px-3 py-1.5 rounded-full transition-colors"
                >
                  <Phone size={13} />
                  <span className="hidden sm:inline">카카오톡</span>
                </a>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* 안내 배너 */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-green-50 border-b border-green-100 flex-shrink-0">
              <span className="text-xs text-green-700 font-body">💡 패키지 추천, 예약 안내, 요금 문의 등 무엇이든 물어보세요!</span>
            </div>

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50" style={{ overscrollBehavior: "contain" }}>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-base mr-2.5 mt-0.5 flex-shrink-0 shadow-sm">⛳</div>
                  )}
                  <div className="max-w-[85%] flex flex-col gap-1">
                    {msg.content && (
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                          msg.role === "user"
                            ? "bg-green-600 text-white rounded-br-sm"
                            : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                    )}
                    {/* Generative UI 카드 렌더링 */}
                    {msg.uiCard?.type === "product_cards" && (
                      <ProductCarousel packages={msg.uiCard.packages} onSelectPackage={handlePackageSelect} />
                    )}
                    {msg.uiCard?.type === "booking_form" && (
                      <BookingFormCard
                        packageId={msg.uiCard.packageId}
                        packageTitle={msg.uiCard.packageTitle}
                        onSubmit={handleBookingFormSubmit}
                      />
                    )}
                    {msg.uiCard?.type === "booking_lookup" && (
                      <BookingLookupCard onLookup={handleBookingLookup} />
                    )}
                  </div>
                </div>
              ))}

              {/* 타이핑 인디케이터 */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-base mr-2.5 mt-0.5 flex-shrink-0 shadow-sm">⛳</div>
                  <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
                    <div className="flex gap-1.5 items-center">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 빠른 답변 버튼 */}
            {currentQuickReplies && !isTyping && (
              <div className="px-3 py-2.5 bg-white border-t border-gray-100 flex-shrink-0">
                {isCurrentFollowUp && (
                  <p className="text-[10px] text-gray-400 font-body mb-2 px-0.5">💡 다음으로 궁금하신 게 있으신가요?</p>
                )}
                <div className="flex gap-1.5 flex-wrap">
                  {currentQuickReplies.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleQuickReply(q)}
                      className={`text-xs rounded-full px-3 py-1.5 transition-colors font-body ${
                        isCurrentFollowUp
                          ? "bg-green-50 border border-green-300 text-green-800 hover:bg-green-100"
                          : "bg-white border border-green-200 text-green-700 hover:bg-green-50"
                      }`}
                    >
                      {isCurrentFollowUp ? "🔍 " : ""}{q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 입력창 */}
            <div className="px-3 py-3 bg-white border-t border-gray-100 flex-shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                  placeholder="메시지를 입력하세요..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent overflow-y-auto"
                  style={{ lineHeight: "1.5", maxHeight: "96px" }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isTyping}
                  className="w-11 h-11 bg-green-600 text-white rounded-xl flex items-center justify-center hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-sm"
                >
                  {isTyping ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 font-body text-center mt-1.5">Enter 전송 · Shift+Enter 줄바꿈</p>
            </div>
          </div>
        </>
      )}

      {/* 플로팅 버튼 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-4 sm:right-6 z-[9998] flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all duration-300 font-body font-semibold text-sm bg-green-600 text-white hover:bg-green-700 hover:shadow-xl hover:scale-105"
        >
          <MessageCircle size={18} />
          <span>AI상담톡</span>
        </button>
      )}
    </>
  );
}
