import { useState, useRef, useEffect, Suspense, useCallback, useMemo } from "react";
import { Link, useLocation, Switch, Route } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePartnerAuth } from "@/_core/hooks/usePartnerAuth";
import { getLoginUrl } from "@/const";
import {
  LayoutDashboard, Package, Calendar, CreditCard, Users, Megaphone,
  ChevronDown, ChevronRight, Menu, X, LogOut, Bell, ExternalLink,
  Sparkles, Zap, Plus,
  // AI 관리 하위
  MessageSquare, Settings2, UserCog,
  BrainCircuit, History, DollarSign,
  Wrench, Bot,
  Gauge, ListChecks, LayoutList, GitBranch, AlertTriangle, FolderOpen,
  // 상품관리 하위
  PackageSearch, PackagePlus,
  // 예약관리 하위
  ClipboardList, MessageCircleQuestion, FileText,
  // 정산관리 하위
  ReceiptText, Building2,
  // CRM 하위
  Search, UserPlus,
  // CMS 하위
  Bell as BellIcon, Image, Code2, Globe,
  // 설정
  Settings,
  Cpu,
  Shield,
  // 이미지 아카이브
  Archive,
  // 크레딧 관리
  Coins,
  // 3단 레이아웃 토글 아이콘
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  // 채팅
  Send, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import ERPDashboard from "@/pages/erp/Dashboard";
import ERPPackages from "@/pages/erp/Packages";
import ERPPackageDetail from "@/pages/erp/PackageDetail";
import ERPBookings from "@/pages/erp/Bookings";
import ERPInquiries from "@/pages/erp/Inquiries";
import ERPSettlements from "@/pages/erp/Settlements";
import ERPCRMCustomers from "@/pages/erp/CRMCustomers";
import ERPCRMPartners from "@/pages/erp/CRMPartners";
import ERPCMSNotices from "@/pages/erp/CMSNotices";
import ERPCMSBanners from "@/pages/erp/CMSBanners";
import ERPCMSVariables from "@/pages/erp/cms/VariableManagement";
import GeminiAssistant from "@/pages/erp/GeminiAssistant";
import AILogs from "@/pages/erp/AILogs";
import DevAI from "@/pages/erp/DevAI";
import DevAIOrchestrator from "@/pages/erp/DevAIOrchestrator";
import AIDevEngine from "@/pages/erp/AIDevEngine";
import AIDevPipeline from "@/pages/erp/AIDevPipeline";
import MasterAI from "@/pages/erp/MasterAI";
import MasterLogs from "@/pages/erp/MasterLogs";
import MasterCosts from "@/pages/erp/MasterCosts";
import AIEngine from "@/pages/erp/AIEngine";
import FeatureCatalog from "@/pages/erp/FeatureCatalog";
import HomepageManagement from "@/pages/erp/HomepageManagement";
import ReservationManagement from "@/pages/erp/ReservationManagement";
import InquiryTemplates from "@/pages/erp/InquiryTemplates";
import FinanceManagement from "@/pages/erp/FinanceManagement";
import AffiliateManagement from "@/pages/erp/AffiliateManagement";
import TenantAffiliates from "@/pages/erp/TenantAffiliates";
import TenantPartners from "@/pages/erp/TenantPartners";
import GolfTalkAdmin from "@/pages/erp/GolfTalkAdmin";
import ManagerAdmin from "@/pages/erp/ManagerAdmin";
import ERPSettings from "@/pages/erp/ERPSettings";
import SystemSettings from "@/pages/erp/SystemSettings";
import OpenRouterAgent from "@/pages/erp/OpenRouterAgent";
import CustomerEstimateTemplates from "@/pages/erp/CustomerEstimateTemplates";
import DevDashboard from "@/pages/erp/DevDashboard";
import ManagedProjects from "@/pages/erp/ManagedProjects";
import ModelRoutingSettings from "@/pages/erp/ModelRoutingSettings";
import PartnerOnboardingAdmin from "@/pages/erp/PartnerOnboardingAdmin";
import SubscriptionManagement from "@/pages/erp/SubscriptionManagement";
import FileAnalysisHistory from "@/pages/erp/FileAnalysisHistory";
import AdminManagementPage from "@/pages/erp/AdminManagement";
import ManagerChat from "@/pages/erp/ManagerChat";
import KnowledgeBlockLog from "@/pages/erp/KnowledgeBlockLog";
import ManusChat from "@/pages/erp/ManusChat";
import SettlementsSuppliers from "@/pages/erp/SettlementsSuppliers";
import TenantAiConsole from "@/pages/erp/TenantAiConsole";
import ImageArchive from "@/pages/erp/ImageArchive";
import CreditManagement from "@/pages/erp/CreditManagement";
import PartnerIntegrations from "@/pages/erp/PartnerIntegrations";
import AIChannelManagement from "@/pages/erp/AIChannelManagement";
import AIUnifiedLogs from "@/pages/erp/AIUnifiedLogs";
import AICreditManagement from "@/pages/erp/AICreditManagement";
import { AIManagerPanel } from "@/components/ERPPartnerLayout";
import { Loader2, Plug } from "lucide-react";
import TenantSelector from "@/components/TenantSelector";

// ─── 3단 레이아웃 너비 타입 ────────────────────────────────────────────────────
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

// ─── 마스터AI 패널 채팅 타입 ──────────────────────────────────────────────────
interface PanelMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  streaming?: boolean;
}

function generatePanelSessionId() {
  return `master-panel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── 마스터AI 패널 채팅 컴포넌트 ─────────────────────────────────────────────
function MasterAIPanelContent({ compact, currentPage }: { compact?: boolean; currentPage: string }) {
  const WELCOME: PanelMessage = {
    id: "welcome",
    role: "assistant",
    content: "안녕하세요! 🤖\n마스터AI입니다. 무엇을 도와드릴까요?",
    timestamp: new Date(),
  };

  const [messages, setMessages] = useState<PanelMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState(() => generatePanelSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // devMode localStorage에서 읽기
  const devMode = useMemo(() => {
    if (typeof window === "undefined") return "manus";
    const saved = window.localStorage.getItem("dogolf_dev_mode");
    return saved === "self" ? "self" : "manus";
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isStreaming, scrollToBottom]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: PanelMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: PanelMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsStreaming(true);

    const history = messages.filter(m => m.id !== "welcome").slice(-10).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/master-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: text.trim(),
          sessionId,
          history,
          fileContexts: [],
          devMode,
          currentPage,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "서버 오류" }));
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, streaming: false, content: `❌ ${err.error ?? "서버 오류"}` }
            : m
        ));
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === "chunk" && data.text !== undefined) {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: m.content + data.text } : m
                ));
                scrollToBottom();
              } else if (eventType === "done") {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, streaming: false } : m
                ));
              } else if (eventType === "error") {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, streaming: false, content: m.content || `❌ ${data.message}` }
                    : m
                ));
              }
            } catch { /* JSON 파싱 실패 무시 */ }
            eventType = "";
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, streaming: false, content: m.content || "❌ 연결이 끊어졌습니다." }
            : m
        ));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleNewChat = () => {
    if (isStreaming) { abortRef.current?.abort(); }
    setMessages([WELCOME]);
    setSessionId(generatePanelSessionId());
    setInput("");
    setIsStreaming(false);
  };

  const QUICK_QUESTIONS = compact
    ? ["오늘 예약 현황", "AI 비용 현황", "미처리 개발 요청"]
    : ["오늘 예약 현황 알려줘", "이번 달 AI 비용 현황", "미처리 개발 요청 목록", "시스템 오류 로그 확인"];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 툴바 */}
      <div className="bg-white border-b border-gray-200 px-3 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <BrainCircuit size={14} className="text-indigo-600" />
          </div>
          {!compact && (
            <div>
              <p className="font-bold text-gray-900 text-xs">마스터AI 🤖</p>
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
          <Link href="/erp/master-ai">
            <button title="전체 화면으로" className="p-1 rounded hover:bg-gray-100 transition-colors">
              <ExternalLink size={13} className="text-gray-500" />
            </button>
          </Link>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3 space-y-3">
          {/* 빠른 질문 */}
          {messages.length === 1 && (
            <div className="bg-indigo-50 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-indigo-700 mb-1.5">💡 빠른 질문</p>
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
                  <BrainCircuit size={12} className="text-indigo-600" />
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
                      {msg.streaming && (
                        <span className="inline-flex gap-0.5 ml-1">
                          <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                          <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                        </span>
                      )}
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

          {/* 타이핑 인디케이터 (스트리밍 중이지만 content 없을 때) */}
          {isStreaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
            <div className="flex justify-start">
              <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center mr-1.5 mt-0.5 flex-shrink-0">
                <BrainCircuit size={12} className="text-indigo-600" />
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
            placeholder={compact ? "질문하세요..." : "마스터AI에게 질문하세요..."}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-200 px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent max-h-24 overflow-y-auto"
            style={{ lineHeight: "1.4" }}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 rounded-lg p-0 flex-shrink-0"
          >
            {isStreaming ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-1">Enter 전송 · Shift+Enter 줄바꿈</p>
      </div>
    </div>
  );
}

// ─── NavItem 타입 ──────────────────────────────────────────────────────────────
interface NavChild {
  label: string;
  href: string;
  icon?: React.ReactNode;
  masterOnly?: boolean;
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: NavChild[];
  masterOnly?: boolean;
}

const navItems: NavItem[] = [
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AI 챗봇 카테고리 (최상단 고정) — 마스터AI / AI파트너매니저 대화 이력
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    label: "AI 챗봇",
    icon: <MessageSquare size={18} />,
    children: [
      { label: "마스터AI 🤖", href: "/master-ai", icon: <BrainCircuit size={14} />, masterOnly: true },
      { label: "마스터AI 로그", href: "/master-ai/logs", icon: <History size={14} />, masterOnly: true },
      { label: "AI파트너매니저 💼", href: "/manager-chat", icon: <MessageSquare size={14} />, masterOnly: true },
      { label: "AI파트너매니저 로그", href: "/manager-admin", icon: <History size={14} />, masterOnly: true },
      { label: "AI상담톡 로그", href: "/golftalk-admin", icon: <Sparkles size={14} />, masterOnly: true },
      { label: "AI 통합 로그", href: "/ai-unified-logs", icon: <History size={14} /> },
      { label: "파트너자동화AI", href: "/gemini", icon: <Wrench size={14} />, masterOnly: true },
      { label: "파트너자동화AI 로그", href: "/ai-logs", icon: <History size={14} />, masterOnly: true },
      { label: "AI 채널 관리", href: "/ai-channel-management", icon: <Bot size={14} />, masterOnly: true },
      { label: "AI 크레딧 관리 💰", href: "/ai-credit-management", icon: <Coins size={14} />, masterOnly: true },
      { label: "OpenRouter 에이전트 ⚡", href: "/openrouter-agent", icon: <Zap size={14} />, masterOnly: true },
    ],
  },
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AI 관리 카테고리 — 엔진 / 로그 / 비용 / 기타
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    label: "AI 관리",
    masterOnly: true,
    icon: <Sparkles size={18} />,
    children: [
      { label: "엔진 대시보드", href: "/ai-engine", icon: <Gauge size={14} /> },
      { label: "모델 라우팅", href: "/ai-engine/model-routing", icon: <Cpu size={14} /> },
      { label: "개발 요청", href: "/dev-ai?tab=requests", icon: <ListChecks size={14} /> },
      { label: "기능 목록", href: "/ai-engine/features", icon: <LayoutList size={14} /> },
      { label: "버전 이력", href: "/dev-ai?tab=versions", icon: <GitBranch size={14} /> },
      { label: "변경이력·정합성 🔀", href: "/ai-dev-pipeline", icon: <GitBranch size={14} /> },
      { label: "오류 로그", href: "/ai-dev-engine", icon: <AlertTriangle size={14} /> },
      { label: "관리 프로젝트", href: "/managed-projects", icon: <FolderOpen size={14} /> },
      { label: "파일 분석 이력", href: "/ai-engine/file-analysis", icon: <FileText size={14} /> },
      { label: "오케스트레이터", href: "/orchestrator", icon: <Zap size={14} /> },
    ],
  },
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 신규 분양관리 — 파트너 가입 파이프라인 순서대로 통합 (마스터 전용)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    label: "신규 분양관리",
    masterOnly: true,
    icon: <Building2 size={18} />,
    children: [
      { label: "① 신규 가입신청", href: "/partner-onboarding", icon: <UserPlus size={14} />, masterOnly: true },
      { label: "② 파트너 관리", href: "/crm/partners", icon: <Building2 size={14} />, masterOnly: true },
      { label: "③ 제휴사 통합코드", href: "/crm/affiliates", icon: <Building2 size={14} />, masterOnly: true },
      { label: "④ 구독 관리", href: "/subscriptions", icon: <CreditCard size={14} />, masterOnly: true },
      { label: "⑤ 분양 AI 콘솔 🏢", href: "/tenant-ai-console", icon: <Shield size={14} />, masterOnly: true },
    ],
  },
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 운영 카테고리
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { label: "대시보드", icon: <LayoutDashboard size={18} />, href: "/" },
  {
    label: "상품관리",
    icon: <Package size={18} />,
    children: [
      { label: "상품 목록", href: "/packages", icon: <PackageSearch size={14} /> },
      { label: "상품 등록", href: "/packages/new", icon: <PackagePlus size={14} /> },
    ],
  },
  {
    label: "예약관리",
    icon: <Calendar size={18} />,
    children: [
      { label: "예약 목록", href: "/bookings", icon: <ClipboardList size={14} /> },
      { label: "예약 문의", href: "/inquiries", icon: <MessageCircleQuestion size={14} /> },
      { label: "수기 예약관리", href: "/reservations", icon: <ClipboardList size={14} /> },
      { label: "문의 자동화 템플릿", href: "/reservations/templates", icon: <MessageCircleQuestion size={14} /> },
      { label: "고객 견적서 템플릿", href: "/reservations/estimate-templates", icon: <FileText size={14} /> },
    ],
  },
  {
    label: "자금관리",
    icon: <CreditCard size={18} />,
    children: [
      { label: "자금 현황", href: "/finance", icon: <ReceiptText size={14} /> },
    ],
  },
  {
    label: "정산관리",
    icon: <CreditCard size={18} />,
    children: [
      { label: "정산 목록", href: "/settlements", icon: <ReceiptText size={14} /> },
      { label: "공급처별 정산", href: "/settlements/suppliers", icon: <Building2 size={14} /> },
    ],
  },
  {
    label: "CRM",
    icon: <Users size={18} />,
    children: [
      { label: "고객 검색", href: "/crm", icon: <Search size={14} /> },
      { label: "우리 제휴사", href: "/crm/my-affiliates", icon: <Building2 size={14} /> },
      { label: "거래처 관리", href: "/crm/my-partners", icon: <Users size={14} /> },
      { label: "마스터 관리", href: "/crm/admin-management", icon: <Shield size={14} />, masterOnly: true },
    ],
  },
  {
    label: "CMS",
    icon: <Megaphone size={18} />,
    children: [
      { label: "홈페이지 관리", href: "/cms/homepage", icon: <Globe size={14} /> },
      { label: "공지사항", href: "/cms/notices", icon: <BellIcon size={14} /> },
      { label: "배너 관리", href: "/cms/banners", icon: <Image size={14} /> },
      { label: "자동 치환 변수", href: "/cms/variables", icon: <Code2 size={14} /> },
    ],
  },
  {
    label: "연동 설정",
    icon: <Settings size={18} />,
    children: [
      { label: "ERP 설정", href: "/settings", icon: <Settings size={14} /> },
      { label: "업체 API 연동", href: "/partner-integrations", icon: <Plug size={14} /> },
      { label: "시스템 설정", href: "/settings/system", icon: <Cpu size={14} />, masterOnly: true },
      { label: "지식 차단 관리", href: "/knowledge-block", icon: <Shield size={14} />, masterOnly: true },
      { label: "이미지 아카이브", href: "/image-archive", icon: <Archive size={14} />, masterOnly: true },
    ],
  },
];

// ─── NavItemComponent ─────────────────────────────────────────────────────────
// ⚠️ ERP 내부 메뉴는 반드시 wouter <Link>를 사용하여 SPA 내부 라우팅으로 처리해야 합니다.
function NavItemComponent({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(() => {
    if (!item.children) return false;
    return item.children.some((c) => location.startsWith(c.href));
  });

  const isActive = item.href ? location === item.href : item.children?.some((c) => location.startsWith(c.href));

  if (item.href) {
    return (
      <Link href={item.href} onClick={onNavigate}>
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
            <Link key={child.href} href={child.href} onClick={onNavigate}>
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

// ─── ERPContent (라우팅) ──────────────────────────────────────────────────────
function ERPContent() {
  const [location] = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location]);

  return (
    <main ref={mainRef} className="flex-1 overflow-auto">
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      }>
        <Switch>
          <Route path="/" component={ERPDashboard} />
          <Route path="/dashboard" component={ERPDashboard} />
          <Route path="/packages" component={ERPPackages} />
          <Route path="/packages/new" component={() => { window.location.replace('/erp/packages'); return null; }} />
          <Route path="/packages/:id" component={ERPPackageDetail} />
          <Route path="/bookings" component={ERPBookings} />
          <Route path="/inquiries" component={ERPInquiries} />
          <Route path="/settlements" component={ERPSettlements} />
          <Route path="/settlements/suppliers" component={SettlementsSuppliers} />
          <Route path="/crm" component={ERPCRMCustomers} />
          <Route path="/crm/partners" component={ERPCRMPartners} />
          <Route path="/crm/affiliates" component={AffiliateManagement} />
          <Route path="/crm/my-affiliates" component={TenantAffiliates} />
          <Route path="/crm/my-partners" component={TenantPartners} />
          <Route path="/crm/admin-management" component={AdminManagementPage} />
          <Route path="/reservations" component={ReservationManagement} />
          <Route path="/reservations/templates" component={InquiryTemplates} />
          <Route path="/reservations/estimate-templates" component={CustomerEstimateTemplates} />
          <Route path="/finance" component={FinanceManagement} />
          <Route path="/cms" component={() => { window.location.replace('/erp/cms/notices'); return null; }} />
          <Route path="/cms/notices" component={ERPCMSNotices} />
          <Route path="/cms/banners" component={ERPCMSBanners} />
          <Route path="/cms/homepage" component={HomepageManagement} />
          <Route path="/cms/variables" component={ERPCMSVariables} />
          <Route path="/gemini" component={GeminiAssistant} />
          <Route path="/ai-logs" component={AILogs} />
          <Route path="/dev-ai" component={DevAI} />
          <Route path="/orchestrator" component={DevAIOrchestrator} />
          <Route path="/ai-dev-engine" component={AIDevEngine} />
          <Route path="/master-ai" component={MasterAI} />
          <Route path="/master-ai/logs" component={MasterLogs} />
          <Route path="/master-ai/costs" component={MasterCosts} />
          <Route path="/ai-engine" component={AIEngine} />
          <Route path="/ai-engine/features" component={FeatureCatalog} />
          <Route path="/ai-engine/model-routing" component={ModelRoutingSettings} />
          <Route path="/ai-engine/file-analysis" component={FileAnalysisHistory} />
          <Route path="/partner-onboarding" component={PartnerOnboardingAdmin} />
          <Route path="/subscriptions" component={SubscriptionManagement} />
          <Route path="/golftalk-admin" component={GolfTalkAdmin} />
          <Route path="/manager-chat" component={ManagerChat} />
          <Route path="/manager-admin" component={ManagerAdmin} />
          <Route path="/settings" component={ERPSettings} />
          <Route path="/settings/system" component={SystemSettings} />
          <Route path="/knowledge-block" component={KnowledgeBlockLog} />
          <Route path="/manus-chat" component={ManusChat} />
          <Route path="/openrouter-agent" component={OpenRouterAgent} />
          <Route path="/dev-dashboard" component={DevDashboard} />
          <Route path="/managed-projects" component={ManagedProjects} />
          <Route path="/tenant-ai-console" component={TenantAiConsole} />
          <Route path="/image-archive" component={ImageArchive} />
          <Route path="/credit-management" component={CreditManagement} />
          <Route path="/ai-dev-pipeline" component={AIDevPipeline} />
          <Route path="/partner-integrations" component={PartnerIntegrations} />
          <Route path="/ai-channel-management" component={AIChannelManagement} />
          <Route path="/ai-unified-logs" component={AIUnifiedLogs} />
          <Route path="/ai-credit-management" component={AICreditManagement} />
          <Route component={ERPDashboard} />
        </Switch>
      </Suspense>
    </main>
  );
}

// ─── 메인 ERPLayout ───────────────────────────────────────────────────────────
export default function ERPLayout() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { user: partnerUser, loading: partnerLoading, isAuthenticated: isPartnerAuthenticated } = usePartnerAuth();
  const [location] = useLocation();
  const [, setLocation] = useLocation();

  // ── 3단 레이아웃 상태 ──
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("full");
  const [aiPanelMode, setAIPanelMode] = useState<AIPanelMode>("narrow");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileAIOpen, setMobileAIOpen] = useState(false);

  // ── 이번주 일정 위젯 ──
  const [showWeeklyPopup, setShowWeeklyPopup] = useState(false);
  const weeklyPopupRef = useRef<HTMLDivElement>(null);

  // ── 3단계 토글 핸들러 ──
  const cycleSidebar = () => {
    setSidebarMode(prev => prev === "full" ? "icon" : prev === "icon" ? "hidden" : "full");
  };
  const cycleAIPanel = () => {
    setAIPanelMode(prev => prev === "wide" ? "narrow" : prev === "narrow" ? "icon" : "wide");
  };

  // 마스터 ERP 로그아웃 뮤테이션
  const adminLogoutMutation = trpc.adminAuth.logout.useMutation({
    onSuccess: () => {
      localStorage.removeItem('adminLoginTime');
      window.location.href = `${window.location.origin}/erp/login`;
    },
    onError: () => {
      localStorage.removeItem('adminLoginTime');
      window.location.href = `${window.location.origin}/erp/login`;
    },
  });

  const adminSessionQuery = trpc.adminAuth.me.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });

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
    refetchInterval: 300000,
  });

  const adminLoginTime = typeof window !== 'undefined' ? localStorage.getItem('adminLoginTime') : null;
  const hasMasterSession = adminLoginTime !== null || (adminSessionQuery.data !== undefined && adminSessionQuery.data !== null);
  const isMausAuthenticated = isAuthenticated && user?.role === 'admin';
  const isPartnerMode = isPartnerAuthenticated && !hasMasterSession && !isMausAuthenticated;

  const filteredNavItems = navItems
    .filter(item => !isPartnerMode || !item.masterOnly)
    .map(item => ({
      ...item,
      children: item.children?.filter(child => !isPartnerMode || !child.masterOnly),
    }));

  if ((loading || partnerLoading) && !hasMasterSession && !adminLoginTime) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!hasMasterSession && !isMausAuthenticated && !isPartnerMode) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">마스터 ERP</h1>
          <p className="text-slate-400 mb-6">마스터 관리자 계정으로 로그인이 필요합니다.</p>
          <Button
            onClick={() => {
              const baseUrl = window.location.origin;
              window.location.href = `${baseUrl}/erp/login`;
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3"
          >
            마스터 로그인
          </Button>
        </div>
      </div>
    );
  }

  if (isMausAuthenticated && user?.role !== "admin") {
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

  // 마스터/파트너 모두 AI 패널 표시 (마스터: MasterAIPanelContent, 파트너: AIManagerPanel)
  const showAIPanel = true;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* ── 좌측 사이드바 ── */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-slate-900 z-50 flex flex-col
          transform transition-all duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"}
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarMode === "hidden" ? "lg:w-0 lg:overflow-hidden" : ""}
          ${sidebarMode === "icon" ? "lg:w-16" : ""}
          ${sidebarMode === "full" ? "lg:w-64" : ""}
        `}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Logo */}
        <div className={`flex items-center border-b border-slate-700/50 flex-shrink-0 ${sidebarMode === "icon" ? "justify-center px-2 py-5" : "gap-3 px-4 py-5"}`}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          {sidebarMode !== "icon" && (
            <div>
              <div className="text-white font-bold text-sm leading-tight">AI ERP</div>
              <div className="text-slate-400 text-xs">관리자 시스템</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {filteredNavItems.map((item) => (
            <NavItemComponent
              key={item.label}
              item={item}
              collapsed={sidebarMode === "icon"}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        {/* Bottom */}
        <div className="border-t border-slate-700/50 px-3 py-3 space-y-2">
          <Link href="/dev-dashboard" onClick={() => setMobileOpen(false)}>
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-700 cursor-pointer transition-colors">
              <ExternalLink size={16} className="shrink-0" />
              {sidebarMode !== "icon" && <span className="text-xs">개발대시보드</span>}
            </div>
          </Link>
          <a href={window.location.origin} target="_blank" rel="noopener noreferrer">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 cursor-pointer transition-colors">
              <ExternalLink size={16} className="shrink-0" />
              {sidebarMode !== "icon" && <span className="text-xs">홈페이지 보기</span>}
            </div>
          </a>
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 cursor-pointer transition-colors"
            onClick={() => {
              if (isPartnerMode) {
                fetch('/api/partner/auth/google/logout', { method: 'POST', credentials: 'include' })
                  .finally(() => { window.location.href = `${window.location.origin}/partner/login`; });
              } else {
                localStorage.removeItem('adminLoginTime');
                adminLogoutMutation.mutate();
              }
            }}
          >
            <LogOut size={16} className="shrink-0" />
            {sidebarMode !== "icon" && <span className="text-xs">{adminLogoutMutation.isPending ? '로그아웃 중...' : '로그아웃'}</span>}
          </div>
        </div>
      </aside>

      {/* 모바일 사이드바 오버레이 */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── 메인 콘텐츠 영역 ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4 flex-shrink-0">
          {/* 모바일: 햄버거 / 데스크탑: 사이드바 토글 */}
          <button
            className="text-slate-500 hover:text-slate-700 touch-manipulation lg:hidden"
            onClick={() => setMobileOpen(prev => !prev)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          {/* 데스크탑: 사이드바 3단계 토글 */}
          <button
            onClick={cycleSidebar}
            title={`사이드바: ${sidebarMode === "full" ? "아이콘으로" : sidebarMode === "icon" ? "숨기기" : "펼치기"}`}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
          >
            {sidebarMode === "hidden" ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>

          <div className="flex-1" />

          {/* 마스터 전용 테넌트 셀렉터 */}
          {!isPartnerMode && <TenantSelector />}

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
                  <Link href="/crm/partners">
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

          {/* 데스크탑: AI 패널 토글 */}
          {showAIPanel && (
            <button
              onClick={cycleAIPanel}
              title={isPartnerMode
                ? `AI파트너매니저: ${aiPanelMode === "wide" ? "좊게" : aiPanelMode === "narrow" ? "아이콘만" : "넓게"}`
                : `마스터AI 패널: ${aiPanelMode === "wide" ? "좊게" : aiPanelMode === "narrow" ? "아이콘만" : "넓게"}`
              }
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 transition-colors text-indigo-500"
            >
              {aiPanelMode === "icon" ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            </button>
          )}
          {/* 모바일: AI 아이콘 */}
          {showAIPanel && (
            <button
              onClick={() => setMobileAIOpen(true)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white shadow-md"
            >
              {isPartnerMode ? <Bot size={18} /> : <BrainCircuit size={18} />}
            </button>
          )}

          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            <Avatar className="w-8 h-8">
              <AvatarFallback className={`text-xs font-bold ${isPartnerMode ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                {(isPartnerMode ? partnerUser?.name : user?.name)?.slice(0, 2) || "관리"}
              </AvatarFallback>
            </Avatar>
            {(isPartnerMode ? partnerUser?.name : user?.name) && (
              <span className="text-sm font-medium text-slate-700 hidden sm:block">
                {isPartnerMode ? partnerUser?.name : user?.name}
              </span>
            )}
            <Badge variant="secondary" className={`text-xs hidden sm:flex ${isPartnerMode ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {isPartnerMode ? '파트너' : '관리자'}
            </Badge>
          </div>
        </header>

        {/* 페이지 콘텐츠 */}
        <ERPContent />
      </div>

      {/* ── 우측 AI 고정 패널 (데스크탑) ── */}
      {showAIPanel && (
        <aside
          className={`
            hidden lg:flex flex-col h-full bg-white border-l border-gray-200
            transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0
            ${AI_PANEL_WIDTHS[aiPanelMode]}
          `}
        >
          {aiPanelMode === "icon" ? (
            /* 아이콘 모드: 세로 아이콘 버튼만 */
            <div className="flex flex-col items-center py-4 gap-3">
              <button
                onClick={cycleAIPanel}
                title={isPartnerMode ? "AI파트너매니저 펼치기" : "마스터AI 패널 펼치기"}
                className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center hover:bg-indigo-200 transition-colors"
              >
                {isPartnerMode ? <Bot size={16} className="text-indigo-600" /> : <BrainCircuit size={16} className="text-indigo-600" />}
              </button>
              <div className="w-0.5 flex-1 bg-gray-100 rounded-full" />
            </div>
          ) : isPartnerMode ? (
            /* 파트너 모드: AI파트너매니저 */
            <AIManagerPanel compact={aiPanelMode === "narrow"} />
          ) : (
            /* 마스터 모드: 마스터AI */
            <MasterAIPanelContent compact={aiPanelMode === "narrow"} currentPage={location} />
          )}
        </aside>
      )}

      {/* ── 모바일 AI 패널 (플로팅 오버레이) ── */}
      {showAIPanel && mobileAIOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileAIOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-[90vw] max-w-sm bg-white z-50 flex flex-col shadow-2xl lg:hidden">
            {/* 모바일 AI 패널 헤더 */}
            <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0 ${isPartnerMode ? 'bg-indigo-600' : 'bg-indigo-600'}`}>
              <div className="flex items-center gap-2">
                {isPartnerMode ? <Bot size={18} className="text-white" /> : <BrainCircuit size={18} className="text-white" />}
                <span className="font-bold text-white text-sm">{isPartnerMode ? 'AI파트너매니저' : '마스터AI 🤖'}</span>
                <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
              </div>
              <button onClick={() => setMobileAIOpen(false)} className="text-white/80 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {isPartnerMode ? (
                <AIManagerPanel />
              ) : (
                <MasterAIPanelContent currentPage={location} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
