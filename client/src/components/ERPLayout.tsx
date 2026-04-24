import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  LayoutDashboard, Package, Calendar, CreditCard, Users, Megaphone,
  ChevronDown, ChevronRight, Menu, X, LogOut, Bell, ExternalLink, Sparkles, Zap, Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: { label: string; href: string }[];
}

const navItems: NavItem[] = [
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 핵심 AI 카테고리 (최상단 고정)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    label: "AI 챗봇",
    icon: <Bot size={18} />,
    children: [
      { label: "두골프 마스터 🤖", href: "/erp/master-ai" },
      { label: "골프톡 관리", href: "/erp/golftalk-admin" },
      { label: "두골프 매니저 관리", href: "/erp/manager-admin" },
    ],
  },
  {
    label: "AI 마스터",
    icon: <Sparkles size={18} />,
    children: [
      { label: "두골프 마스터 채팅", href: "/erp/master-ai" },
      { label: "대화 이력", href: "/erp/master-ai/logs" },
      { label: "AI 비용 현황", href: "/erp/master-ai/costs" },
    ],
  },
  {
    label: "AI 엔진 관리",
    icon: <Zap size={18} />,
    children: [
      { label: "엔진 대시보드", href: "/erp/ai-engine" },
      { label: "개발 요청", href: "/erp/dev-ai?tab=requests" },
      { label: "기능 목록", href: "/erp/dev-ai?tab=features" },
      { label: "버전 이력", href: "/erp/dev-ai?tab=versions" },
      { label: "오류 로그", href: "/erp/ai-dev-engine" },
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
      { label: "상품 목록", href: "/erp/packages" },
      { label: "상품 등록", href: "/erp/packages/new" },
    ],
  },
  {
    label: "예약관리",
    icon: <Calendar size={18} />,
    children: [
      { label: "예약 목록", href: "/erp/bookings" },
      { label: "예약 문의", href: "/erp/inquiries" },
    ],
  },
  {
    label: "정산관리",
    icon: <CreditCard size={18} />,
    children: [
      { label: "정산 목록", href: "/erp/settlements" },
      { label: "공급처별 정산", href: "/erp/settlements/suppliers" },
    ],
  },
  {
    label: "CRM",
    icon: <Users size={18} />,
    children: [
      { label: "고객 검색", href: "/erp/crm" },
    ],
  },
  {
    label: "CMS",
    icon: <Megaphone size={18} />,
    children: [
      { label: "공지사항", href: "/erp/cms/notices" },
      { label: "배너 관리", href: "/erp/cms/banners" },
    ],
  },
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
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
          isActive ? "text-white" : "text-slate-300 hover:bg-slate-700 hover:text-white"
        }`}
        onClick={() => setOpen(!open)}
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
        <div className="ml-7 mt-1 space-y-0.5">
          {item.children?.map((child) => (
            <Link key={child.href} href={child.href}>
              <div
                className={`px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                  location === child.href
                    ? "bg-indigo-600/80 text-white font-medium"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {child.label}
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

  const statsQuery = trpc.dashboard.stats.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 60000,
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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 transition-all duration-300 ${
          sidebarCollapsed ? "w-16" : "w-60"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
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
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-60"}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4">
          <button
            className="text-slate-500 hover:text-slate-700 lg:block"
            onClick={() => {
              setSidebarCollapsed(!sidebarCollapsed);
              setMobileOpen(!mobileOpen);
            }}
          >
            <Menu size={20} />
          </button>

          <div className="flex-1" />

          {/* Notification badges */}
          {pendingBookingsCount > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs px-3 py-1.5 rounded-full border border-amber-200">
              <Calendar size={12} />
              <span>대기 예약 {pendingBookingsCount}건</span>
            </div>
          )}
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
