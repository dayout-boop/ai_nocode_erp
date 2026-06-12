// ============================================================
// PartnerSupportPage — partner.dayoutgolf.com 고객센터 2차 페이지
// 파트너 포털에서 /partner/support 경로로 접근
// 좌측: FAQ + 개발요청 접수 + 개발요청 현황 탭 / 우측: 고객센터AI 실시간 LLM
// ============================================================
import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { partnerTrpc } from "@/lib/partnerTrpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Code2,
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Plus,
  ArrowLeft,
  ClipboardList,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ─── FAQ 데이터 ───────────────────────────────────────────
const FAQ_ITEMS = [
  {
    category: "가입/온보딩",
    icon: "🚀",
    items: [
      {
        q: "파트너 가입 절차는 어떻게 되나요?",
        a: "파트너 신청 → AI 온보딩 채팅 → 사업자 등록증 제출 → 운영팀 검토 및 승인 → ERP 접속 순서로 진행됩니다. 보통 1~2 영업일 내에 승인됩니다.",
      },
      {
        q: "사업자 등록증 외에 추가 서류가 필요한가요?",
        a: "기본적으로 사업자 등록증만 필요합니다. 여행업 등록증이 있는 경우 함께 제출하면 더 빠른 검토가 가능합니다.",
      },
      {
        q: "파트너 계정 승인 후 바로 상품을 등록할 수 있나요?",
        a: "네, 승인 즉시 ERP에 접속하여 상품 등록, 출발일 설정, 예약 관리 등 모든 기능을 사용할 수 있습니다.",
      },
    ],
  },
  {
    category: "ERP 사용",
    icon: "💻",
    items: [
      {
        q: "상품을 등록하려면 어떻게 하나요?",
        a: "ERP 로그인 → 상품관리 → 상품 등록 메뉴에서 상품명, 국가, 일정, 이미지, 가격 등을 입력하고 저장하면 됩니다.",
      },
      {
        q: "출발일과 재고를 어떻게 설정하나요?",
        a: "상품 상세 → 출발일/재고 탭에서 개별 등록 또는 일괄 등록을 사용합니다. 성인/소인/유아 가격을 판매가·입금가·제휴가로 각각 설정할 수 있습니다.",
      },
      {
        q: "직원 계정을 추가하려면 어떻게 하나요?",
        a: "ERP → 내 정보 → 직원 관리에서 직원 정보를 입력하고 권한을 설정하면 됩니다.",
      },
    ],
  },
  {
    category: "정산/수수료",
    icon: "💰",
    items: [
      {
        q: "수수료 구조는 어떻게 되나요?",
        a: "판매가(고객 결제가)와 제휴가(파트너 정산가)의 차액이 플랫폼 수수료입니다. 정확한 수수료율은 계약서를 참고하거나 운영팀에 문의해 주세요.",
      },
      {
        q: "정산 주기는 어떻게 되나요?",
        a: "기본 정산 주기는 월 1회(익월 10일)입니다. 정산 내역은 ERP → 자금관리 → 정산관리에서 확인할 수 있습니다.",
      },
    ],
  },
];

// ─── 개발요청 카테고리 ────────────────────────────────────
const DEV_CATEGORIES = [
  { value: "feature", label: "신규 기능", icon: Plus, color: "border-blue-500 bg-blue-50 text-blue-700" },
  { value: "bug", label: "버그 수정", icon: AlertCircle, color: "border-red-500 bg-red-50 text-red-700" },
  { value: "improvement", label: "기능 개선", icon: TrendingUp, color: "border-green-500 bg-green-50 text-green-700" },
  { value: "question", label: "문의", icon: HelpCircle, color: "border-yellow-500 bg-yellow-50 text-yellow-700" },
] as const;

type DevCategory = (typeof DEV_CATEGORIES)[number]["value"];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

// 개발요청 상태 레이블/색상
const APPROVAL_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:     { label: "검토중",  color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  approved:    { label: "승인",    color: "bg-blue-100 text-blue-700 border-blue-200" },
  rejected:    { label: "거부",    color: "bg-red-100 text-red-700 border-red-200" },
  in_progress: { label: "개발중",  color: "bg-purple-100 text-purple-700 border-purple-200" },
  completed:   { label: "완료",    color: "bg-green-100 text-green-700 border-green-200" },
};

const FEASIBILITY_MAP: Record<string, { label: string; color: string }> = {
  possible:    { label: "구현가능",    color: "text-green-600" },
  conditional: { label: "조건부가능",  color: "text-yellow-600" },
  impossible:  { label: "구현불가",    color: "text-red-600" },
  global:      { label: "전체개선",    color: "text-blue-600" },
};

// ─── AI 채팅 패널 ─────────────────────────────────────────
function AIChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "안녕하세요! 고객센터AI입니다. 🎯\n\nERP 사용 방법, 가입 절차, 정산 문의, 기능 개선 요청 등 무엇이든 질문해 주세요.\n\n왼쪽 탭에서 FAQ, 개발요청 접수, 개발요청 현황을 확인하실 수 있습니다.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `partner-support-${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);

  const managerChatMut = partnerTrpc.aiAssistant.managerChat.useMutation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      const result = await managerChatMut.mutateAsync({ message: text, sessionId, history });
      const resultTyped = result as { response: string; devRequestSubmitted?: { id: number; title: string } | null };
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: resultTyped.response ?? "응답을 받지 못했습니다.",
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      // 개발요청 자동 접수 완료 알림
      if (resultTyped.devRequestSubmitted) {
        const { id, title } = resultTyped.devRequestSubmitted;
        const noticeMsg: ChatMessage = {
          id: `dev-${Date.now()}`,
          role: "assistant",
          content: `✅ 개발요청이 접수되었습니다 (접수번호: #${id})\n\n**${title}**\n\n'개발요청 현황' 탭에서 처리 상태를 확인하실 수 있습니다.`,
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, noticeMsg]);
        toast.success(`개발요청 #${id}가 접수되었습니다.`);
      }
    } catch {
      toast.error("응답 실패. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <MessageCircle size={18} />
        <span className="font-semibold text-sm">고객센터AI</span>
        <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">실시간 상담</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs mr-2 mt-1 shrink-0">
                AI
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs mr-2 mt-1 shrink-0">
              AI
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
              <Loader2 size={16} className="animate-spin text-indigo-500" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="질문을 입력하세요..."
            className="flex-1 text-sm"
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white px-3">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">AI 답변은 참고용입니다. 정확한 사항은 운영팀에 문의하세요.</p>
      </div>
    </div>
  );
}

// ─── FAQ 패널 ─────────────────────────────────────────────
function FAQPanel() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {FAQ_ITEMS.map((cat) => (
        <div key={cat.category}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{cat.icon}</span>
            <h3 className="font-semibold text-gray-700 text-sm">{cat.category}</h3>
          </div>
          <div className="space-y-1.5">
            {cat.items.map((item, idx) => {
              const key = `${cat.category}-${idx}`;
              const isOpen = openItems.has(key);
              return (
                <div key={key} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                  <button
                    onClick={() => toggle(key)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm text-gray-800 font-medium pr-2">{item.q}</span>
                    {isOpen ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 text-sm text-gray-600 leading-relaxed bg-indigo-50 border-t border-indigo-100">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 개발요청 접수 패널 ────────────────────────────────────
function DevRequestPanel() {
  const [category, setCategory] = useState<DevCategory>("feature");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMut = partnerTrpc.devRequest.submitByPartner.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setTitle("");
      setDescription("");
      toast.success("개발 요청이 접수되었습니다. 검토 후 안내드리겠습니다.");
    },
    onError: () => {
      toast.error("요청 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    },
  });

  const handleSubmit = () => {
    if (!title.trim() || title.trim().length < 5) {
      toast.error("제목을 5자 이상 입력해 주세요.");
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      toast.error("내용을 10자 이상 입력해 주세요.");
      return;
    }
    submitMut.mutate({ title: title.trim(), description: description.trim(), category });
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 size={48} className="text-green-500 mb-4" />
        <h3 className="font-bold text-gray-800 text-lg mb-2">요청이 접수되었습니다!</h3>
        <p className="text-gray-500 text-sm mb-6">운영팀이 검토 후 연락드리겠습니다.<br />왼쪽 탭에서 처리 현황을 확인하세요.</p>
        <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
          추가 요청하기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        ERP 기능 개선, 신규 기능 요청, 버그 신고 등을 접수하세요. 운영팀이 검토 후 처리 방향을 안내드립니다.
      </p>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">요청 유형</label>
        <div className="grid grid-cols-2 gap-2">
          {DEV_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                  category === cat.value ? cat.color : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                <Icon size={14} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">제목 *</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="요청 내용을 간략히 입력하세요" className="text-sm" maxLength={200} />
        <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/200</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">상세 내용 *</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="현재 상황, 원하는 기능, 발생한 문제 등을 자세히 설명해 주세요."
          className="text-sm min-h-[120px] resize-none"
          maxLength={2000}
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/2000</p>
      </div>

      <Button onClick={handleSubmit} disabled={submitMut.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
        {submitMut.isPending ? (
          <><Loader2 size={14} className="animate-spin mr-2" />접수 중...</>
        ) : (
          <><Send size={14} className="mr-2" />요청 접수</>
        )}
      </Button>
    </div>
  );
}

// ─── 개발요청 현황 패널 ────────────────────────────────────
function DevStatusPanel() {
  const { data: requests = [], isLoading, refetch, isFetching } = partnerTrpc.devRequest.listByPartner.useQuery(
    { limit: 30, offset: 0 },
    { refetchOnWindowFocus: false }
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">고객센터AI를 통해 접수된 개발요청 현황입니다.</p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <RefreshCw size={11} className={isFetching ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
          <ClipboardList size={36} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">접수된 개발요청이 없습니다.</p>
          <p className="text-xs mt-1">개발요청 탭에서 새 요청을 접수해 보세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const status = APPROVAL_STATUS_MAP[req.approvalStatus] ?? { label: req.approvalStatus, color: "bg-gray-100 text-gray-600 border-gray-200" };
            const feasibility = req.feasibility ? FEASIBILITY_MAP[req.feasibility] : null;
            const when = req.createdAt ? new Date(req.createdAt).toLocaleDateString("ko-KR") : "-";
            const completedWhen = req.completedAt ? new Date(req.completedAt).toLocaleDateString("ko-KR") : null;
            return (
              <div key={req.id} className="border border-gray-200 rounded-lg bg-white p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 leading-snug flex-1">{req.title}</p>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${status.color}`}>
                    {status.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {feasibility && (
                    <span className={`text-[10px] font-medium ${feasibility.color}`}>{feasibility.label}</span>
                  )}
                  {req.isGlobalImprovement && (
                    <span className="text-[10px] text-blue-500 font-medium">🌐 전체 업체 공통 개선</span>
                  )}
                  <span className="text-[10px] text-gray-400 ml-auto">접수: {when}</span>
                  {completedWhen && (
                    <span className="text-[10px] text-green-600">완료: {completedWhen}</span>
                  )}
                </div>
                {req.approvalMemo && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded px-2.5 py-1.5 text-xs text-indigo-700">
                    💬 {req.approvalMemo}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────
export default function PartnerSupportPage() {
  const [leftTab, setLeftTab] = useState<"faq" | "devrequest" | "devstatus">("faq");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/partner/dashboard">
            <button className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm transition-colors">
              <ArrowLeft size={16} />
              돌아가기
            </button>
          </Link>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <MessageCircle size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg leading-tight">고객센터</h1>
              <p className="text-xs text-gray-500">FAQ · 개발요청 접수 · 개발요청 현황 · AI 실시간 상담</p>
            </div>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex gap-6 h-[calc(100vh-120px)]">
          {/* 좌측 패널 */}
          <div className="w-[420px] shrink-0 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setLeftTab("faq")}
                className={`flex-1 flex items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${
                  leftTab === "faq" ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <HelpCircle size={12} />
                자주 묻는 질문
              </button>
              <button
                onClick={() => setLeftTab("devrequest")}
                className={`flex-1 flex items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${
                  leftTab === "devrequest" ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Code2 size={12} />
                개발 요청
              </button>
              <button
                onClick={() => setLeftTab("devstatus")}
                className={`flex-1 flex items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${
                  leftTab === "devstatus" ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <ClipboardList size={12} />
                요청 현황
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {leftTab === "faq" && <FAQPanel />}
              {leftTab === "devrequest" && <DevRequestPanel />}
              {leftTab === "devstatus" && <DevStatusPanel />}
            </div>
          </div>

          {/* 우측 AI 채팅 */}
          <div className="flex-1 overflow-hidden">
            <AIChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
