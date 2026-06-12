// ============================================================
// ERPPartnerLayout — 파트너사 직원 전용 ERP 레이아웃 (3단 레이아웃)
// 좌측 사이드바 / 메인 콘텐츠 / 우측 AI파트너매니저 고정 패널
// ============================================================
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import {
  LayoutDashboard,
  Package,
  CalendarDays,
  MessageSquare,
  Bot,
  User,
  Menu,
  X,
  LogOut,
  Building2,
  Zap,
  Shield,
  LifeBuoy,
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  History,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { partnerTrpc, createPartnerTrpcClient, createPartnerQueryClient } from "@/lib/partnerTrpc";
import { QueryClientProvider } from "@tanstack/react-query";
import PartnerCreditPage from "@/pages/Partner/PartnerCreditPage";
import PartnerAIBlockPage from "@/pages/Partner/PartnerAIBlockPage";
import PartnerSupportCenter from "@/pages/Partner/PartnerSupportCenter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// ─── 파트너 스태프 정보 타입 ───────────────────────────────
interface PartnerStaffInfo {
  id: number;
  name: string;
  loginId: string;
  role: "manager" | "staff";
  email?: string;
  phone?: string;
}

function getPartnerStaffInfo(): PartnerStaffInfo | null {
  try {
    const raw = localStorage.getItem("partner_staff_info");
    if (!raw) return null;
    return JSON.parse(raw) as PartnerStaffInfo;
  } catch {
    return null;
  }
}

function getPartnerStaffToken(): string | null {
  return localStorage.getItem("partner_staff_token");
}

// ─── 사이드바 너비 단계 ────────────────────────────────────
type SidebarMode = "full" | "icon" | "hidden";
type AIPanelMode = "wide" | "narrow" | "icon";

const SIDEBAR_WIDTHS: Record<SidebarMode, string> = {
  full: "w-64",
  icon: "w-16",
  hidden: "w-0",
};

const AI_PANEL_WIDTHS: Record<AIPanelMode, string> = {
  wide: "w-96",
  narrow: "w-72",
  icon: "w-12",
};

// ─── 메뉴 구성 ────────────────────────────────────────────
const navItems = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard, href: "/partner/staff", roles: ["manager", "staff"] as const },
  { id: "packages", label: "상품 관리", icon: Package, href: "/partner/staff/packages", roles: ["manager", "staff"] as const },
  { id: "bookings", label: "예약 관리", icon: CalendarDays, href: "/partner/staff/bookings", roles: ["manager", "staff"] as const },
  { id: "inquiries", label: "문의 관리", icon: MessageSquare, href: "/partner/staff/inquiries", roles: ["manager", "staff"] as const },
  { id: "support", label: "고객센터", icon: LifeBuoy, href: "/partner/staff/support", roles: ["manager", "staff"] as const },
  { id: "credit", label: "AI 크레딧", icon: Zap, href: "/partner/staff/credit", roles: ["manager"] as const },
  { id: "ai-block", label: "AI 차단 키워드", icon: Shield, href: "/partner/staff/ai-block", roles: ["manager"] as const },
  { id: "mypage", label: "내 정보", icon: User, href: "/partner/staff/my", roles: ["manager", "staff"] as const },
];

// ─── AI 매니저 채팅 타입 ───────────────────────────────────
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
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  uiCard?: ManagerUiCard | null;
}

function generateSessionId() {
  return `mgr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── AI 매니저 채팅 패널 내부 컨텐츠 ─────────────────────
function AIPanelContent({ compact }: { compact?: boolean }) {
  const staffName = (() => {
    try {
      const raw = localStorage.getItem("partner_staff_info");
      if (!raw) return "매니저";
      const info = JSON.parse(raw) as { name?: string };
      return info.name ?? "매니저";
    } catch { return "매니저"; }
  })();

  const WELCOME: ChatMessage = {
    id: "welcome",
    role: "assistant",
    content: `안녕하세요, ${staffName}님! 🤖\n파트너 운영에 필요한 모든 것을 도와드립니다.`,
    timestamp: new Date(),
  };

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = partnerTrpc.aiAssistant.managerChat.useMutation();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    try {
      const history = messages.filter(m => m.id !== "welcome").slice(-8).map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
      const result = await chatMutation.mutateAsync({ sessionId, message: text.trim(), history });
      const resultTyped = result as { response: string; uiCard?: ManagerUiCard | null; devRequestSubmitted?: { id: number; title: string } | null };
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
        uiCard: resultTyped.uiCard ?? null,
      };
      setMessages(prev => [...prev, assistantMsg]);
      // 개발요청 자동 접수 완료 알림
      if (resultTyped.devRequestSubmitted) {
        const { id, title } = resultTyped.devRequestSubmitted;
        const noticeMsg: ChatMessage = {
          id: `dev-${Date.now()}`,
          role: "assistant",
          content: `✅ **개발요청이 접수되었습니다** (접수번호: #${id})\n\n**${title}**\n\n처리 현황은 고객센터 → 개발요청 탭에서 확인하실 수 있습니다.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, noticeMsg]);
      }
    } catch {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: "일시적인 오류가 발생했습니다.\n📞 1668-1739", timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleNewChat = () => {
    setMessages([WELCOME]);
    setSessionId(generateSessionId());
    setInput("");
  };

  const QUICK_QUESTIONS = compact
    ? ["오늘 예약 현황", "상품 목록", "정산 조회"]
    : ["오늘 예약 현황 알려줘", "등록 상품 목록 보여줘", "수기 예약 접수하고 싶어", "정산 현황 조회해줘"];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 툴바 */}
      <div className="bg-white border-b border-gray-200 px-3 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Bot size={14} className="text-indigo-600" />
          </div>
          {!compact && (
            <div>
              <p className="font-bold text-gray-900 text-xs">AI파트너매니저</p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <p className="text-[10px] text-gray-500">온라인</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleNewChat} title="새 대화" className="p-1 rounded hover:bg-gray-100 transition-colors">
            <RotateCcw size={13} className="text-gray-500" />
          </button>
          <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} title="이전 대화" className="p-1 rounded hover:bg-gray-100 transition-colors">
            <History size={13} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* 이전 대화 패널 */}
      {isHistoryOpen && (
        <div className="bg-white border-b border-gray-200 p-2 flex-shrink-0">
          <p className="text-xs text-gray-500 text-center py-2">이전 대화 이어가기 기능은 AI 매니저 전체 화면에서 이용하세요.</p>
          <Link href="/partner/staff/ai">
            <button className="w-full text-xs text-indigo-600 hover:underline py-1">전체 화면으로 열기 →</button>
          </Link>
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3 space-y-3">
          {/* 빠른 질문 */}
          {messages.length === 1 && (
            <div className="bg-indigo-50 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-indigo-700 mb-1.5">💡 자주 묻는 질문</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_QUESTIONS.map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="text-[10px] bg-white border border-indigo-200 text-indigo-700 rounded-full px-2 py-1 hover:bg-indigo-50 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 메시지 목록 */}
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center mr-1.5 mt-0.5 flex-shrink-0">
                  <Bot size={12} className="text-indigo-600" />
                </div>
              )}
              <div className={`max-w-[85%] ${msg.role === "user" ? "" : "w-full"}`}>
                <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-xs max-w-none text-xs">
                      <Streamdown>{msg.content}</Streamdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                  <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-indigo-200" : "text-gray-400"}`}>
                    {msg.timestamp.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* 타이핑 인디케이터 */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center mr-1.5 mt-0.5 flex-shrink-0">
                <Bot size={12} className="text-indigo-600" />
              </div>
              <div className="bg-white rounded-xl rounded-bl-sm px-3 py-2 shadow-sm border border-gray-100">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 입력창 */}
      <div className="bg-white border-t border-gray-200 flex-shrink-0 px-2 py-2">
        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={compact ? "질문하세요..." : "AI파트너매니저에게 질문하세요..."}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-200 px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent max-h-24 overflow-y-auto"
            style={{ lineHeight: "1.4" }}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 rounded-lg p-0 flex-shrink-0"
          >
            {isTyping ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-1">Enter 전송 · Shift+Enter 줄바꿈</p>
      </div>
    </div>
  );
}

// ─── AI 패널 래퍼 (partnerTrpc Provider) ──────────────────
export function AIManagerPanel({ compact }: { compact?: boolean }) {
  const queryClient = useMemo(() => createPartnerQueryClient(), []);
  const trpcClient = useMemo(() => createPartnerTrpcClient(), []);
  return (
    <partnerTrpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AIPanelContent compact={compact} />
      </QueryClientProvider>
    </partnerTrpc.Provider>
  );
}

// ─── 사이드바 컴포넌트 ─────────────────────────────────────
function Sidebar({
  staff,
  mode,
  mobileOpen,
  onMobileClose,
}: {
  staff: PartnerStaffInfo;
  mode: SidebarMode;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const [location] = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("partner_staff_token");
    localStorage.removeItem("partner_staff_info");
    toast.success("로그아웃되었습니다.");
    window.location.href = "/partner/staff/login";
  };

  const visibleItems = navItems.filter(item =>
    (item.roles as unknown as string[]).includes(staff.role)
  );

  const isIconOnly = mode === "icon";

  return (
    <>
      {/* 모바일 오버레이 */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onMobileClose} />
      )}

      {/* 사이드바 */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-[#1a2332] text-white z-50 flex flex-col
          transform transition-all duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"}
          lg:translate-x-0 lg:static lg:z-auto
          ${mode === "hidden" ? "lg:w-0 lg:overflow-hidden" : ""}
          ${mode === "icon" ? "lg:w-16" : ""}
          ${mode === "full" ? "lg:w-64" : ""}
        `}
      >
        {/* 헤더 */}
        <div className={`flex items-center border-b border-white/10 flex-shrink-0 ${isIconOnly ? "justify-center px-2 py-4" : "justify-between px-4 py-4"}`}>
          {!isIconOnly && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">⛳</div>
              <div>
                <p className="font-bold text-sm text-white">AI ERP (파트너)</p>
                <p className="text-xs text-white/50">직원 포털</p>
              </div>
            </div>
          )}
          {isIconOnly && (
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">⛳</div>
          )}
          <button onClick={onMobileClose} className="lg:hidden text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* 직원 정보 */}
        {!isIconOnly && (
          <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-white/70" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{staff.name}</p>
                <Badge className={`text-xs px-1.5 py-0 ${staff.role === "manager" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`} variant="outline">
                  {staff.role === "manager" ? "매니저" : "직원"}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* 네비게이션 */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = item.href === "/partner/staff"
              ? location === "/partner/staff"
              : location.startsWith(item.href);
            return (
              <Link key={item.id} href={item.href}>
                <div
                  title={isIconOnly ? item.label : undefined}
                  className={`flex items-center gap-3 rounded-lg mb-1 cursor-pointer transition-colors duration-150
                    ${isIconOnly ? "justify-center px-2 py-2.5" : "px-3 py-2.5"}
                    ${isActive ? "bg-green-600 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
                  onClick={onMobileClose}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  {!isIconOnly && <span className="text-sm font-medium">{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* 크레딧 잔액 (매니저만, 아이콘 모드 제외) */}
        {staff.role === "manager" && !isIconOnly && <CreditBalanceBadge />}

        {/* 로그아웃 */}
        <div className={`px-2 py-3 border-t border-white/10 flex-shrink-0`}>
          <button
            onClick={handleLogout}
            title={isIconOnly ? "로그아웃" : undefined}
            className={`w-full flex items-center gap-3 rounded-lg text-white/60 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-150
              ${isIconOnly ? "justify-center px-2 py-2.5" : "px-3 py-2.5"}`}
          >
            <LogOut size={16} />
            {!isIconOnly && <span className="text-sm font-medium">로그아웃</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── 파트너 스태프 대시보드 ────────────────────────────────
function PartnerStaffDashboard({ staff }: { staff: PartnerStaffInfo }) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">안녕하세요, {staff.name}님 👋</h1>
        <p className="text-gray-500 text-sm mt-1">{staff.role === "manager" ? "매니저" : "직원"} 계정으로 로그인되었습니다.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "상품 관리", desc: "등록된 골프 패키지 상품을 관리합니다", icon: Package, href: "/partner/staff/packages", color: "text-green-600 bg-green-50" },
          { label: "예약 관리", desc: "고객 예약 현황을 확인하고 처리합니다", icon: CalendarDays, href: "/partner/staff/bookings", color: "text-blue-600 bg-blue-50" },
          { label: "문의 관리", desc: "고객 문의를 확인하고 답변합니다", icon: MessageSquare, href: "/partner/staff/inquiries", color: "text-purple-600 bg-purple-50" },
        ].map(card => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href}>
              <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer group">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${card.color}`}>
                  <Icon size={20} />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-green-600 transition-colors">{card.label}</h3>
                <p className="text-xs text-gray-500">{card.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── 준비 중 페이지 ────────────────────────────────────────
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Building2 size={28} className="text-gray-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-700 mb-2">{title}</h2>
      <p className="text-sm text-gray-400">현재 개발 중입니다. 곧 제공될 예정입니다.</p>
    </div>
  );
}

// ─── 내 정보 페이지 ────────────────────────────────────────
function PartnerStaffMyPage({ staff }: { staff: PartnerStaffInfo }) {
  const handleLogout = () => {
    localStorage.removeItem("partner_staff_token");
    localStorage.removeItem("partner_staff_info");
    toast.success("로그아웃되었습니다.");
    window.location.href = "/partner/staff/login";
  };
  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-bold text-gray-900 mb-6">내 정보</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div><label className="text-xs text-gray-500 font-medium">이름</label><p className="text-sm text-gray-900 mt-0.5">{staff.name}</p></div>
        <div><label className="text-xs text-gray-500 font-medium">로그인 ID</label><p className="text-sm text-gray-900 mt-0.5">{staff.loginId}</p></div>
        <div><label className="text-xs text-gray-500 font-medium">역할</label><p className="text-sm text-gray-900 mt-0.5">{staff.role === "manager" ? "매니저" : "직원"}</p></div>
        {staff.email && <div><label className="text-xs text-gray-500 font-medium">이메일</label><p className="text-sm text-gray-900 mt-0.5">{staff.email}</p></div>}
        {staff.phone && <div><label className="text-xs text-gray-500 font-medium">전화번호</label><p className="text-sm text-gray-900 mt-0.5">{staff.phone}</p></div>}
      </div>
      <div className="mt-4">
        <Button variant="outline" className="text-red-500 border-red-200 hover:bg-red-50" onClick={handleLogout}>
          <LogOut size={14} className="mr-2" />로그아웃
        </Button>
      </div>
    </div>
  );
}

// ─── 크레딧 잔액 배지 ──────────────────────────────────────
function CreditBalanceBadge() {
  const queryClient = useMemo(() => createPartnerQueryClient(), []);
  const trpcClient = useMemo(() => createPartnerTrpcClient(), []);
  return (
    <partnerTrpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <CreditBadgeInner />
      </QueryClientProvider>
    </partnerTrpc.Provider>
  );
}

function CreditBadgeInner() {
  const { data } = partnerTrpc.tenantAi.getMyCredit.useQuery(undefined, { staleTime: 60_000 });
  if (!data) return null;
  return (
    <div className="mx-2 mb-2 px-3 py-2 bg-green-900/30 rounded-lg border border-green-700/30">
      <div className="flex items-center gap-1.5">
        <Zap size={12} className="text-green-400" />
        <span className="text-xs text-green-300 font-medium">잔여 크레딧</span>
      </div>
      <p className="text-lg font-bold text-green-300 mt-0.5">{(data.aiCreditsBalance ?? 0).toLocaleString()}</p>
    </div>
  );
}

// ─── 메인 레이아웃 ─────────────────────────────────────────
export default function ERPPartnerLayout() {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("full");
  const [aiPanelMode, setAIPanelMode] = useState<AIPanelMode>("narrow");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileAIOpen, setMobileAIOpen] = useState(false);
  const [staff, setStaff] = useState<PartnerStaffInfo | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getPartnerStaffToken();
    const info = getPartnerStaffInfo();
    if (!token || !info) { window.location.href = "/partner/staff/login"; return; }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        localStorage.removeItem("partner_staff_token");
        localStorage.removeItem("partner_staff_info");
        toast.error("세션이 만료되었습니다. 다시 로그인해주세요.");
        window.location.href = "/partner/staff/login";
        return;
      }
    } catch { /* 무시 */ }
    setStaff(info);
    setChecking(false);
  }, []);

  const cycleSidebar = () => {
    setSidebarMode(prev => prev === "full" ? "icon" : prev === "icon" ? "hidden" : "full");
  };

  const cycleAIPanel = () => {
    setAIPanelMode(prev => prev === "wide" ? "narrow" : prev === "narrow" ? "icon" : "wide");
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  if (!staff) return null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* 좌측 사이드바 */}
      <Sidebar
        staff={staff}
        mode={sidebarMode}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 상단 헤더 */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* 모바일: 햄버거 */}
            <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden text-gray-600 hover:text-gray-900">
              <Menu size={20} />
            </button>
            {/* 데스크탑: 사이드바 토글 */}
            <button
              onClick={cycleSidebar}
              title={`사이드바: ${sidebarMode === "full" ? "아이콘으로" : sidebarMode === "icon" ? "숨기기" : "펼치기"}`}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            >
              {sidebarMode === "hidden" ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <span className="font-semibold text-gray-900 text-sm lg:hidden">AI ERP (파트너)</span>
          </div>

          <div className="flex items-center gap-2">
            {/* 데스크탑: AI패널 토글 */}
            <button
              onClick={cycleAIPanel}
              title={`AI패널: ${aiPanelMode === "wide" ? "좁게" : aiPanelMode === "narrow" ? "아이콘만" : "넓게"}`}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors text-indigo-500"
            >
              {aiPanelMode === "icon" ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            </button>
            {/* 모바일: AI 아이콘 */}
            <button
              onClick={() => setMobileAIOpen(true)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white shadow-md"
            >
              <Bot size={18} />
            </button>
          </div>
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto">
          <Switch>
            <Route path="/partner/staff" component={() => <PartnerStaffDashboard staff={staff} />} />
            <Route path="/partner/staff/packages" component={() => <ComingSoon title="상품 관리" />} />
            <Route path="/partner/staff/bookings" component={() => <ComingSoon title="예약 관리" />} />
            <Route path="/partner/staff/inquiries" component={() => <ComingSoon title="문의 관리" />} />
            <Route path="/partner/staff/support" component={() => <PartnerSupportCenter />} />
            <Route path="/partner/staff/ai" component={() => {
              const qc = useMemo(() => createPartnerQueryClient(), []);
              const tc = useMemo(() => createPartnerTrpcClient(), []);
              return (
                <partnerTrpc.Provider client={tc} queryClient={qc}>
                  <QueryClientProvider client={qc}>
                    <AIPanelContent />
                  </QueryClientProvider>
                </partnerTrpc.Provider>
              );
            }} />
            <Route path="/partner/staff/credit" component={() => <PartnerCreditPage />} />
            <Route path="/partner/staff/ai-block" component={() => <PartnerAIBlockPage />} />
            <Route path="/partner/staff/my" component={() => <PartnerStaffMyPage staff={staff} />} />
          </Switch>
        </main>
      </div>

      {/* 우측 AI파트너매니저 고정 패널 (데스크탑) */}
      <aside
        className={`
          hidden lg:flex flex-col h-full bg-white border-l border-gray-200
          transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0
          ${AI_PANEL_WIDTHS[aiPanelMode]}
        `}
      >
        {aiPanelMode === "icon" ? (
          /* 아이콘 모드: 세로 아이콘 버튼만 표시 */
          <div className="flex flex-col items-center py-4 gap-3">
            <button
              onClick={cycleAIPanel}
              title="AI파트너매니저 펼치기"
              className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center hover:bg-indigo-200 transition-colors"
            >
              <Bot size={16} className="text-indigo-600" />
            </button>
            <div className="w-0.5 flex-1 bg-gray-100 rounded-full" />
          </div>
        ) : (
          <AIManagerPanel compact={aiPanelMode === "narrow"} />
        )}
      </aside>

      {/* 모바일 AI 패널 (플로팅 오버레이) */}
      {mobileAIOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileAIOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-[90vw] max-w-sm bg-white z-50 flex flex-col shadow-2xl lg:hidden">
            {/* 모바일 AI 패널 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-indigo-600 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-white" />
                <span className="font-bold text-white text-sm">AI파트너매니저</span>
                <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
              </div>
              <button onClick={() => setMobileAIOpen(false)} className="text-white/80 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AIManagerPanel />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
