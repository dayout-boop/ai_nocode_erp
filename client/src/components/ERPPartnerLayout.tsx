// ============================================================
// ERPPartnerLayout — 파트너사 직원 전용 ERP 레이아웃
// 파트너 스태프 JWT 로그인 후 사용하는 제한된 ERP 뷰
// 접근 가능 메뉴: 대시보드, 상품관리, 예약관리, 문의관리, AI 매니저, 내 정보
// ============================================================
import { useState, useEffect } from "react";
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
  ChevronDown,
  ChevronRight,
  Building2,
  Zap,
  Shield,
  LifeBuoy,
} from "lucide-react";
import { useMemo } from "react";
import { partnerTrpc, createPartnerTrpcClient, createPartnerQueryClient } from "@/lib/partnerTrpc";
import { QueryClientProvider } from "@tanstack/react-query";
import PartnerCreditPage from "@/pages/Partner/PartnerCreditPage";
import PartnerAIBlockPage from "@/pages/Partner/PartnerAIBlockPage";
import PartnerAIManagerPage from "@/pages/Partner/PartnerAIManagerPage";
import PartnerSupportCenter from "@/pages/Partner/PartnerSupportCenter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ─── 파트너 스태프 정보 타입 ───────────────────────────────
interface PartnerStaffInfo {
  id: number;
  name: string;
  loginId: string;
  role: "manager" | "staff";
  email?: string;
  phone?: string;
}

// ─── 로컬스토리지에서 파트너 스태프 정보 읽기 ───────────────
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

// ─── 메뉴 구성 ────────────────────────────────────────────
const navItems = [
  {
    id: "dashboard",
    label: "대시보드",
    icon: LayoutDashboard,
    href: "/partner/staff",
    roles: ["manager", "staff"] as const,
  },
  {
    id: "packages",
    label: "상품 관리",
    icon: Package,
    href: "/partner/staff/packages",
    roles: ["manager", "staff"] as const,
  },
  {
    id: "bookings",
    label: "예약 관리",
    icon: CalendarDays,
    href: "/partner/staff/bookings",
    roles: ["manager", "staff"] as const,
  },
  {
    id: "inquiries",
    label: "문의 관리",
    icon: MessageSquare,
    href: "/partner/staff/inquiries",
    roles: ["manager", "staff"] as const,
  },
  {
    id: "support",
    label: "고객센터",
    icon: LifeBuoy,
    href: "/partner/staff/support",
    roles: ["manager", "staff"] as const,
  },
  {
    id: "ai-manager",
    label: "AI파트너매니저",
    icon: Bot,
    href: "/partner/staff/ai",
    roles: ["manager", "staff"] as const,
  },
  {
    id: "credit",
    label: "AI 크레딧",
    icon: Zap,
    href: "/partner/staff/credit",
    roles: ["manager"] as const,
  },
  {
    id: "ai-block",
    label: "AI 차단 키워드",
    icon: Shield,
    href: "/partner/staff/ai-block",
    roles: ["manager"] as const,
  },
  {
    id: "mypage",
    label: "내 정보",
    icon: User,
    href: "/partner/staff/my",
    roles: ["manager", "staff"] as const,
  },
];

// ─── 사이드바 컴포넌트 ─────────────────────────────────────
function Sidebar({
  staff,
  isOpen,
  onClose,
}: {
  staff: PartnerStaffInfo;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [location] = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("partner_staff_token");
    localStorage.removeItem("partner_staff_info");
    toast.success("로그아웃되었습니다.");
    window.location.href = "/partner/staff/login";
  };

  const visibleItems = navItems.filter((item) =>
    (item.roles as unknown as string[]).includes(staff.role)
  );

  return (
    <>
      {/* 모바일 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-[#1a2332] text-white z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              ⛳
            </div>
            <div>
              <p className="font-bold text-sm text-white">AI ERP (파트너)</p>
              <p className="text-xs text-white/50">직원 포털</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-white/60 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* 직원 정보 */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
              <User size={14} className="text-white/70" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {staff.name}
              </p>
              <div className="flex items-center gap-1">
                <Badge
                  className={`text-xs px-1.5 py-0 ${
                    staff.role === "manager"
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  }`}
                  variant="outline"
                >
                  {staff.role === "manager" ? "매니저" : "직원"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/partner/staff"
                ? location === "/partner/staff"
                : location.startsWith(item.href);

            return (
              <Link key={item.id} href={item.href}>
                <div
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 cursor-pointer
                    transition-colors duration-150
                    ${
                      isActive
                        ? "bg-green-600 text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }
                  `}
                  onClick={onClose}
                >
                  <Icon size={16} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* 크레딧 잔액 (매니저만) */}
        {staff.role === "manager" && <CreditBalanceBadge />}

        {/* 하단 로그아웃 */}
        <div className="px-2 py-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-150"
          >
            <LogOut size={16} />
            <span className="text-sm font-medium">로그아웃</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── 파트너 스태프 대시보드 (기본 홈) ─────────────────────
function PartnerStaffDashboard({ staff }: { staff: PartnerStaffInfo }) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          안녕하세요, {staff.name}님 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {staff.role === "manager" ? "매니저" : "직원"} 계정으로 로그인되었습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            label: "상품 관리",
            desc: "등록된 골프 패키지 상품을 관리합니다",
            icon: Package,
            href: "/partner/staff/packages",
            color: "text-green-600 bg-green-50",
          },
          {
            label: "예약 관리",
            desc: "고객 예약 현황을 확인하고 처리합니다",
            icon: CalendarDays,
            href: "/partner/staff/bookings",
            color: "text-blue-600 bg-blue-50",
          },
          {
            label: "문의 관리",
            desc: "고객 문의를 확인하고 답변합니다",
            icon: MessageSquare,
            href: "/partner/staff/inquiries",
            color: "text-purple-600 bg-purple-50",
          },
          {
            label: "AI 매니저",
            desc: "AI 어시스턴트와 업무를 처리합니다",
            icon: Bot,
            href: "/partner/staff/ai",
            color: "text-orange-600 bg-orange-50",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href}>
              <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer group">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${card.color}`}
                >
                  <Icon size={20} />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-green-600 transition-colors">
                  {card.label}
                </h3>
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
        <div>
          <label className="text-xs text-gray-500 font-medium">이름</label>
          <p className="text-sm text-gray-900 mt-0.5">{staff.name}</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">로그인 ID</label>
          <p className="text-sm text-gray-900 mt-0.5">{staff.loginId}</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">역할</label>
          <p className="text-sm text-gray-900 mt-0.5">
            {staff.role === "manager" ? "매니저" : "직원"}
          </p>
        </div>
        {staff.email && (
          <div>
            <label className="text-xs text-gray-500 font-medium">이메일</label>
            <p className="text-sm text-gray-900 mt-0.5">{staff.email}</p>
          </div>
        )}
        {staff.phone && (
          <div>
            <label className="text-xs text-gray-500 font-medium">전화번호</label>
            <p className="text-sm text-gray-900 mt-0.5">{staff.phone}</p>
          </div>
        )}
      </div>
      <div className="mt-4">
        <Button
          variant="outline"
          className="text-red-500 border-red-200 hover:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut size={14} className="mr-2" />
          로그아웃
        </Button>
      </div>
    </div>
  );
}

// ─── 크레딧 잔액 배지 (사이드바 하단) ──────────────────────────
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
  const { data } = partnerTrpc.tenantAi.getMyCredit.useQuery(undefined, {
    staleTime: 60_000,
  });
  if (!data) return null;
  return (
    <div className="mx-2 mb-2 px-3 py-2 bg-green-900/30 rounded-lg border border-green-700/30">
      <div className="flex items-center gap-1.5">
        <Zap size={12} className="text-green-400" />
        <span className="text-xs text-green-300 font-medium">잔여 크레딧</span>
      </div>
      <p className="text-lg font-bold text-green-300 mt-0.5">
        {(data.aiCreditsBalance ?? 0).toLocaleString()}
      </p>
    </div>
  );
}

// ─── 메인 레이아웃 ─────────────────────────────────────────
export default function ERPPartnerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [staff, setStaff] = useState<PartnerStaffInfo | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getPartnerStaffToken();
    const info = getPartnerStaffInfo();

    if (!token || !info) {
      window.location.href = "/partner/staff/login";
      return;
    }

    // JWT 만료 여부 간단 체크 (payload 디코딩)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        localStorage.removeItem("partner_staff_token");
        localStorage.removeItem("partner_staff_info");
        toast.error("세션이 만료되었습니다. 다시 로그인해주세요.");
        window.location.href = "/partner/staff/login";
        return;
      }
    } catch {
      // 디코딩 실패 시 무시
    }

    setStaff(info);
    setChecking(false);
  }, []);

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
      {/* 사이드바 */}
      <Sidebar
        staff={staff}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 상단 헤더 (모바일) */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900"
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold text-gray-900 text-sm">AI ERP (파트너)</span>
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto">
          <Switch>
            <Route path="/partner/staff" component={() => <PartnerStaffDashboard staff={staff} />} />
            <Route path="/partner/staff/packages" component={() => <ComingSoon title="상품 관리" />} />
            <Route path="/partner/staff/bookings" component={() => <ComingSoon title="예약 관리" />} />
            <Route path="/partner/staff/inquiries" component={() => <ComingSoon title="문의 관리" />} />
            <Route path="/partner/staff/support" component={() => <PartnerSupportCenter />} />
            <Route path="/partner/staff/ai" component={() => <PartnerAIManagerPage />} />
            <Route path="/partner/staff/credit" component={() => <PartnerCreditPage />} />
            <Route path="/partner/staff/ai-block" component={() => <PartnerAIBlockPage />} />
            <Route path="/partner/staff/my" component={() => <PartnerStaffMyPage staff={staff} />} />
          </Switch>
        </main>
      </div>
    </div>
  );
}
