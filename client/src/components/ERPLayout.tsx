import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  LayoutDashboard, Package, Calendar, CreditCard, Users, Megaphone,
  ChevronDown, ChevronRight, Menu, X, LogOut, Bell, ExternalLink,
  Sparkles, Zap, Bot, Plus,
  // AI 챗봇 하위
  MessageSquare, Settings2, UserCog,
  // AI 마스터 하위
  BrainCircuit, History, DollarSign,
  // AI 엔진 하위
  Gauge, ListChecks, LayoutList, GitBranch, AlertTriangle,
  // 상품관리 하위
  PackageSearch, PackagePlus,
  // 예약관리 하위
  ClipboardList, MessageCircleQuestion,
  // 정산관리 하위
  ReceiptText, Building2,
  // CRM 하위
  Search,
  // CMS 하위
  Bell as BellIcon, Image,
  // 설정
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

interface NavChild {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: NavChild[];
}

const navItems: NavItem[] = [
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 핵심 AI 카테고리 (최상단 고정)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    label: "AI 챗봇",
    icon: <Bot size={18} />,
    children: [
      { label: "두골프 마스터 🤖", href: "/erp/master-ai", icon: <MessageSquare size={14} /> },
      { label: "골프톡 관리", href: "/erp/golftalk-admin", icon: <Settings2 size={14} /> },
      { label: "두골프 매니저 관리", href: "/erp/manager-admin", icon: <UserCog size={14} /> },
    ],
  },
  {
    label: "AI 마스터",
    icon: <Sparkles size={18} />,
    children: [
      { label: "두골프 마스터 채팅", href: "/erp/master-ai", icon: <BrainCircuit size={14} /> },
      { label: "대화 이력", href: "/erp/master-ai/logs", icon: <History size={14} /> },
      { label: "AI 비용 현황", href: "/erp/master-ai/costs", icon: <DollarSign size={14} /> },
    ],
  },
  {
    label: "AI 엔진 관리",
    icon: <Zap size={18} />,
    children: [
      { label: "엔진 대시보드", href: "/erp/ai-engine", icon: <Gauge size={14} /> },
      { label: "개발 요청", href: "/erp/dev-ai?tab=requests", icon: <ListChecks size={14} /> },
      { label: "기능 목록", href: "/erp/dev-ai?tab=features", icon: <LayoutList size={14} /> },
      { label: "버전 이력", href: "/erp/dev-ai?tab=versions", icon: <GitBranch size={14} /> },
      { label: "오류 로그", href: "/erp/ai-dev-engine", icon: <AlertTriangle size={14} /> },
    ],
  },
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 운영 카테고리
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { label: "대시보드", icon: <LayoutDashboard size={18} />, href: "/erp" },
  {
    label: "상품관리",
    icon: <Package size={18} />,
    children: [
      { label: "상품 목록", href: "/erp/packages", icon: <PackageSearch size={14} /> },
      { label: "상품 등록", href: "/erp/packages/new", icon: <PackagePlus size={14} /> },
    ],
  },
  {
    label: "예약관리",
    icon: <Calendar size={18} />,
    children: [
      { label: "예약 목록", href: "/erp/bookings", icon: <ClipboardList size={14} /> },
      { label: "예약 문의", href: "/erp/inquiries", icon: <MessageCircleQuestion size={14} /> },
      { label: "수기 예약관리", href: "/erp/reservations", icon: <ClipboardList size={14} /> },
    ],
  },
  {
    label: "자금관리",
    icon: <CreditCard size={18} />,
    children: [
      { label: "자금 현황", href: "/erp/finance", icon: <ReceiptText size={14} /> },
    ],
  },
  {
    label: "정산관리",
    icon: <CreditCard size={18} />,
    children: [
      { label: "정산 목록", href: "/erp/settlements", icon: <ReceiptText size={14} /> },
      { label: "공급처별 정산", href: "/erp/settlements/suppliers", icon: <Building2 size={14} /> },
    ],
  },
  {
    label: "CRM",
    icon: <Users size={18} />,
    children: [
      { label: "고객 검색", href: "/erp/crm", icon: <Search size={14} /> },
      { label: "파트너 관리", href: "/erp/crm/partners", icon: <Building2 size={14} /> },
      { label: "제휴사 관리", href: "/erp/crm/affiliates", icon: <Building2 size={14} /> },
    ],
  },
  {
    label: "CMS",
    icon: <Megaphone size={18} />,
    children: [
      { label: "공지사항", href: "/erp/cms/notices", icon: <BellIcon size={14} /> },
      { label: "배너 관리", href: "/erp/cms/banners", icon: <Image size={14} /> },
    ],
  },
  { label: "연동 설정", icon: <Settings size={18} />, href: "/erp/settings" },
];

function NavItemComponent({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(() => {
    if (!item.children) return false;
    return item.children.some((c) => location.startsWith(c.href));
  });

  const isActive = item.href ? location === item.href : item.children?.some((c) => location.startsWith(c.href));

  if (item.href) {
    return (
      <Link href={item.href}>
        <div
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
            isActive
              ? "bg-indigo-600 text-white"
              : "text-slate-300 hover:bg-slate-700 hover:text-white"
          }`}
        >
          <span className="shrink-0">{item.icon}</span>
          {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
        </div>
      </Link>
    );
  }

  return (
    <div>
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 touch-manipulation ${
          isActive ? "text-white" : "text-slate-300 hover:bg-slate-700 hover:text-white"
        }`}
        onClick={() => setOpen(!open)}
        onTouchEnd={(e) => {
          e.preventDefault();
          setOpen((prev) => !prev);
        }}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && (
          <>
            <span className="text-sm font-medium flex-1">{item.label}</span>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </>
        )}
      </div>
      {!collapsed && open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-700/60 pl-3">
          {item.children?.map((child) => (
            <Link key={child.href} href={child.href}>
              <div
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                  location === child.href || location.startsWith(child.href + "?")
                    ? "bg-indigo-600/80 text-white font-medium"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {child.icon && (
                  <span className="shrink-0 opacity-70">{child.icon}</span>
                )}
                <span>{child.label}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ERPLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 이번주 일정 위젯 상태
  const [showWeeklyPopup, setShowWeeklyPopup] = useState(false);
  const weeklyPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (weeklyPopupRef.current && !weeklyPopupRef.current.contains(e.target as Node)) {
        setShowWeeklyPopup(false);
      }
    };
    if (showWeeklyPopup) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showWeeklyPopup]);

  const statsQuery = trpc.dashboard.stats.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 60000,
  });

  const weeklySchedulesQuery = trpc.crm.getWeeklySchedules.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 300000, // 5분마다 갱신
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LayoutDashboard size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">두골프 ERP</h1>
          <p className="text-slate-400 mb-6">관리자 전용 시스템입니다. 로그인이 필요합니다.</p>
          <a href={getLoginUrl()}>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3">
              관리자 로그인
            </Button>
          </a>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-white mb-2">접근 권한 없음</h1>
          <p className="text-slate-400 mb-6">관리자 계정으로만 접근 가능합니다.</p>
          <Button variant="outline" onClick={logout} className="text-white border-slate-600">
            로그아웃
          </Button>
        </div>
      </div>
    );
  }

  const newInquiriesCount = statsQuery.data?.newInquiries || 0;
  const pendingBookingsCount = statsQuery.data?.pendingBookings || 0;

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 ${
          sidebarCollapsed ? "w-16" : "w-64"
        } transition-transform duration-200 ease-out will-change-transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          {!sidebarCollapsed && (
            <div>
              <div className="text-white font-bold text-sm leading-tight">두골프 ERP</div>
              <div className="text-slate-400 text-xs">관리자 시스템</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavItemComponent key={item.label} item={item} collapsed={sidebarCollapsed} />
          ))}
        </nav>

        {/* Bottom */}
        <div className="border-t border-slate-700/50 px-3 py-3 space-y-2">
          <a href="/" target="_blank" rel="noopener noreferrer">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 cursor-pointer transition-colors">
              <ExternalLink size={16} className="shrink-0" />
              {!sidebarCollapsed && <span className="text-xs">홈페이지 보기</span>}
            </div>
          </a>
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 cursor-pointer transition-colors"
            onClick={logout}
          >
            <LogOut size={16} className="shrink-0" />
            {!sidebarCollapsed && <span className="text-xs">로그아웃</span>}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity duration-200 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onTouchStart={() => setMobileOpen(false)}
        onClick={() => setMobileOpen(false)}
      />

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-h-screen transition-[margin] duration-200 ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4">
          {/* 모바일: 사이드바 오버레이 토글 / 데스크탑: 사이드바 접기 */}
          <button
            className="text-slate-500 hover:text-slate-700 touch-manipulation"
            onTouchEnd={(e) => {
              // 모바일 터치: click 이벤트 지연(300ms) 없이 즉시 반응
              e.preventDefault();
              e.stopPropagation();
              setMobileOpen((prev) => !prev);
            }}
            onClick={() => {
              // 데스크탑(lg 이상): 사이드바 너비 토글
              if (window.matchMedia('(min-width: 1024px)').matches) {
                setSidebarCollapsed((prev) => !prev);
              }
            }}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex-1" />

          {/* Notification badges */}
          {pendingBookingsCount > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs px-3 py-1.5 rounded-full border border-amber-200">
              <Calendar size={12} />
              <span>대기 예약 {pendingBookingsCount}건</span>
            </div>
          )}

          {/* 이번주 일정 위젯 */}
          <div className="relative" ref={weeklyPopupRef}>
            <button
              onClick={() => setShowWeeklyPopup((v) => !v)}
              className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs px-3 py-1.5 rounded-full border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              <Calendar size={12} />
              <span>이번주 일정 {weeklySchedulesQuery.data?.length ?? 0}건</span>
            </button>

            {showWeeklyPopup && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-[100] overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <Calendar size={14} className="text-emerald-600" />
                    이번주 일정 ({weeklySchedulesQuery.data?.length ?? 0}건)
                  </h3>
                  <button onClick={() => setShowWeeklyPopup(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                  {!weeklySchedulesQuery.data || weeklySchedulesQuery.data.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm">이번주 일정이 없습니다</div>
                  ) : (
                    weeklySchedulesQuery.data.map((s) => {
                      const start = new Date(s.startDate);
                      return (
                        <div key={s.id} className="px-4 py-2.5 hover:bg-gray-50">
                          <div className="flex items-start gap-2">
                            <div
                              className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                              style={{ backgroundColor: s.color || '#16a34a' }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                              <p className="text-xs text-gray-400">
                                {start.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                                {' '}{start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              {s.assignedTo && (
                                <p className="text-xs text-gray-400">담당: {s.assignedTo}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                  <Link href="/erp/crm/partners">
                    <button
                      onClick={() => setShowWeeklyPopup(false)}
                      className="w-full text-xs text-emerald-600 font-medium hover:underline flex items-center justify-center gap-1"
                    >
                      <Plus size={12} /> 파트너 관리로 이동
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {newInquiriesCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 text-red-700 text-xs px-3 py-1.5 rounded-full border border-red-200">
              <Bell size={12} />
              <span>새 문의 {newInquiriesCount}건</span>
            </div>
          )}

          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">
                {user?.name?.slice(0, 2) || "관리"}
              </AvatarFallback>
            </Avatar>
            {user?.name && (
              <span className="text-sm font-medium text-slate-700 hidden sm:block">{user.name}</span>
            )}
            <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700 hidden sm:flex">
              관리자
            </Badge>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
