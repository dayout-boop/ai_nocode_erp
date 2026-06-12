// ============================================================
// PartnerSupportCenter — 파트너 ERP 고객센터AI 페이지
// 좌측: Q&A 탭 / 개발요청 탭
// 우측: AI 실시간 LLM 채팅 (파트너 온보딩 스타일)
// ============================================================
import { useState, useRef, useEffect } from "react";
import { partnerTrpc } from "@/lib/partnerTrpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Wrench,
  TrendingUp,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

// ─── FAQ 데이터 ───────────────────────────────────────────
const FAQ_ITEMS = [
  {
    category: "예약/상품",
    icon: "🏌️",
    items: [
      {
        q: "출발일 슬롯을 추가하려면 어떻게 하나요?",
        a: "상품관리 > 해당 상품 > 출발일/재고 탭에서 '개별 등록' 또는 '일괄 등록'을 사용하세요. 일괄 등록 시 날짜 범위와 요일 패턴을 설정하면 한 번에 여러 날짜를 등록할 수 있습니다.",
      },
      {
        q: "예약 상태를 변경하려면 어떻게 하나요?",
        a: "예약관리 > 예약 목록에서 해당 예약을 클릭 후 상태(확정/취소/대기)를 변경할 수 있습니다. 변경 시 고객에게 자동 알림이 발송됩니다.",
      },
      {
        q: "소인/유아 가격은 어디서 설정하나요?",
        a: "출발일/재고 탭에서 슬롯 등록 시 성인/소인/유아 가격을 각각 판매가·입금가·제휴가로 설정할 수 있습니다. 목록에서 '소인/유아 ▼' 버튼을 클릭하면 상세 가격이 표시됩니다.",
      },
    ],
  },
  {
    category: "정산/결제",
    icon: "💰",
    items: [
      {
        q: "정산 내역은 어디서 확인하나요?",
        a: "자금관리 > 정산관리 메뉴에서 기간별 정산 내역을 확인할 수 있습니다. 엑셀 다운로드도 지원합니다.",
      },
      {
        q: "입금가와 제휴가의 차이는 무엇인가요?",
        a: "입금가(입금가)는 고객이 실제 입금하는 금액이고, 제휴가(파트너가)는 파트너사에 정산되는 금액입니다. 판매가는 홈페이지에 표시되는 공개 가격입니다.",
      },
    ],
  },
  {
    category: "시스템/계정",
    icon: "⚙️",
    items: [
      {
        q: "직원 계정을 추가하려면 어떻게 하나요?",
        a: "내 정보 > 직원 관리 메뉴에서 직원 이메일을 입력하고 권한(매니저/스태프)을 설정하면 초대 이메일이 발송됩니다.",
      },
      {
        q: "AI 크레딧은 어떻게 충전하나요?",
        a: "AI 크레딧 메뉴에서 현재 잔량을 확인하고, 충전 요청을 보낼 수 있습니다. 운영팀 검토 후 처리됩니다.",
      },
    ],
  },
];

// ─── 개발요청 카테고리 ────────────────────────────────────
const DEV_CATEGORIES = [
  { value: "feature", label: "신규 기능", icon: Plus, color: "bg-blue-100 text-blue-700" },
  { value: "bug", label: "버그 수정", icon: AlertCircle, color: "bg-red-100 text-red-700" },
  { value: "improvement", label: "기능 개선", icon: TrendingUp, color: "bg-green-100 text-green-700" },
  { value: "question", label: "문의", icon: HelpCircle, color: "bg-yellow-100 text-yellow-700" },
] as const;

type DevCategory = (typeof DEV_CATEGORIES)[number]["value"];

// ─── 채팅 메시지 타입 ─────────────────────────────────────
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

// ─── AI 채팅 패널 ─────────────────────────────────────────
function AIChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "안녕하세요! 고객센터AI입니다. 🎯\n\nERP 사용 방법, 예약·정산 문의, 기능 개선 요청 등 무엇이든 질문해 주세요. 왼쪽 FAQ에서 자주 묻는 질문을 먼저 확인하시면 더 빠르게 해결할 수 있습니다.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `support-${Date.now()}`);
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
          content: `✅ 개발요청이 접수되었습니다 (접수번호: #${id})\n\n**${title}**\n\n위의 '개발요청' 탭에서 처리 현황을 확인하실 수 있습니다.`,
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, noticeMsg]);
        toast.success(`개발요청 #${id}가 접수되었습니다.`);
      }
    } catch {
      toast.error("AI 응답 실패. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <MessageCircle size={18} />
        <span className="font-semibold text-sm">고객센터AI</span>
        <Badge className="ml-auto bg-white/20 text-white text-xs border-0">실시간 상담</Badge>
      </div>

      {/* 메시지 영역 */}
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

      {/* 입력 영역 */}
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
    <div className="space-y-4">
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

// ─── 개발요청 패널 ────────────────────────────────────────
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
        <p className="text-gray-500 text-sm mb-6">운영팀이 검토 후 연락드리겠습니다.</p>
        <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
          추가 요청하기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-gray-500 mb-3">
          ERP 기능 개선, 신규 기능 요청, 버그 신고 등을 접수하세요. 운영팀이 검토 후 처리 방향을 안내드립니다.
        </p>
      </div>

      {/* 카테고리 선택 */}
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
                  category === cat.value
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                <Icon size={14} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 제목 */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">제목 *</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="요청 내용을 간략히 입력하세요"
          className="text-sm"
          maxLength={200}
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/200</p>
      </div>

      {/* 내용 */}
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

      <Button
        onClick={handleSubmit}
        disabled={submitMut.isPending}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        {submitMut.isPending ? (
          <>
            <Loader2 size={14} className="animate-spin mr-2" />
            접수 중...
          </>
        ) : (
          <>
            <Send size={14} className="mr-2" />
            요청 접수
          </>
        )}
      </Button>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────
export default function PartnerSupportCenter() {
  const [leftTab, setLeftTab] = useState<"faq" | "devrequest">("faq");

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 페이지 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <MessageCircle size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">고객센터</h1>
            <p className="text-xs text-gray-500">FAQ · 개발요청 · AI 실시간 상담</p>
          </div>
        </div>
      </div>

      {/* 본문 — 좌/우 분할 */}
      <div className="flex-1 overflow-hidden flex gap-0">
        {/* 좌측 패널 */}
        <div className="w-[420px] shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden">
          {/* 탭 */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setLeftTab("faq")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                leftTab === "faq"
                  ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <HelpCircle size={14} />
              자주 묻는 질문
            </button>
            <button
              onClick={() => setLeftTab("devrequest")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                leftTab === "devrequest"
                  ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Code2 size={14} />
              개발 요청
            </button>
          </div>

          {/* 탭 콘텐츠 */}
          <div className="flex-1 overflow-y-auto p-4">
            {leftTab === "faq" ? <FAQPanel /> : <DevRequestPanel />}
          </div>
        </div>

        {/* 우측 AI 채팅 패널 */}
        <div className="flex-1 p-4 overflow-hidden">
          <AIChatPanel />
        </div>
      </div>
    </div>
  );
}
