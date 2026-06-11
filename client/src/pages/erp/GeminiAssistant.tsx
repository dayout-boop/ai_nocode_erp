import { useState, useCallback, useRef } from "react";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles, Info, Zap, Code2, Database, Globe, AlertTriangle, RefreshCw,
  Package, Megaphone, MessageSquare, BarChart3, Loader2,
  ThumbsUp, ThumbsDown, CheckCircle2, Copy,
} from "lucide-react";

type GeminiRole = "user" | "model";
interface GeminiMessage { role: GeminiRole; content: string; }
interface DisplayMessage extends Message { isError?: boolean; }

// ─── 피드백 버튼 ────────────────────────────────────────────────────────────
function FeedbackButtons({ logId }: { logId?: number }) {
  const [sent, setSent] = useState<"up" | "down" | null>(null);
  const feedbackMutation = trpc.aiLogs.submitFeedback.useMutation({
    onSuccess: () => toast.success("피드백이 저장되었습니다."),
    onError: () => { toast.error("피드백 저장 실패"); setSent(null); },
  });
  if (!logId) return null;
  return (
    <div className="flex items-center gap-1 mt-1">
      <span className="text-xs text-muted-foreground">도움이 됐나요?</span>
      <button
        onClick={() => { setSent("up"); feedbackMutation.mutate({ logId, feedback: "thumbs_up" }); }}
        disabled={sent !== null}
        className={`p-1 rounded transition-colors ${sent === "up" ? "text-green-600" : "text-muted-foreground hover:text-green-600"}`}
      >
        <ThumbsUp size={13} />
      </button>
      <button
        onClick={() => { setSent("down"); feedbackMutation.mutate({ logId, feedback: "thumbs_down" }); }}
        disabled={sent !== null}
        className={`p-1 rounded transition-colors ${sent === "down" ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}
      >
        <ThumbsDown size={13} />
      </button>
      {sent && <CheckCircle2 size={12} className="text-green-500" />}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
      title="복사"
    >
      {copied ? <CheckCircle2 size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  );
}

// ─── 상품 설명 초안 ─────────────────────────────────────────────────────────
function PackageDescTab() {
  const [form, setForm] = useState({
    title: "", country: "", duration: "", roundCount: 2, region: "", extraInfo: "",
  });
  const [result, setResult] = useState<{
    description: string; highlights: string[]; includes: string[]; excludes: string[]; cacheHit: boolean;
  } | null>(null);

  const mutation = trpc.aiLogs.generatePackageDesc.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success(data.cacheHit ? "캐시에서 불러왔습니다." : "상품 설명 초안이 생성되었습니다.");
    },
    onError: (e) => toast.error(`생성 실패: ${e.message}`),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">상품명 *</Label>
          <Input placeholder="예: 태국 방콕 3박5일 골프" value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">국가 *</Label>
          <Input placeholder="예: 태국" value={form.country}
            onChange={e => setForm(p => ({ ...p, country: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">기간</Label>
          <Input placeholder="예: 3박5일" value={form.duration}
            onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">라운딩 횟수</Label>
          <Input type="number" min={1} max={10} value={form.roundCount}
            onChange={e => setForm(p => ({ ...p, roundCount: Number(e.target.value) }))} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">지역</Label>
          <Input placeholder="예: 방콕, 파타야" value={form.region}
            onChange={e => setForm(p => ({ ...p, region: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">추가 정보</Label>
          <Input placeholder="예: 5성급 호텔, 전용 버스" value={form.extraInfo}
            onChange={e => setForm(p => ({ ...p, extraInfo: e.target.value }))} className="mt-1" />
        </div>
      </div>
      <Button
        onClick={() => mutation.mutate(form)}
        disabled={!form.title || !form.country || mutation.isPending}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {mutation.isPending
          ? <><Loader2 size={14} className="animate-spin mr-2" />생성 중...</>
          : <><Sparkles size={14} className="mr-2" />AI 상품 설명 초안 생성</>}
      </Button>
      {result && (
        <div className="space-y-3 border rounded-xl p-4 bg-emerald-50/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-emerald-800">생성 결과</span>
            <div className="flex items-center gap-2">
              {result.cacheHit && <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">캐시</Badge>}
              <CopyButton text={`${result.description}\n\n하이라이트:\n${result.highlights.join("\n")}\n\n포함:\n${result.includes.join("\n")}\n\n불포함:\n${result.excludes.join("\n")}`} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">상품 설명</p>
            <p className="text-sm leading-relaxed">{result.description}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs font-medium text-emerald-700 mb-1">✨ 하이라이트</p>
              <ul className="space-y-1">{result.highlights.map((h, i) => <li key={i} className="text-xs text-muted-foreground">• {h}</li>)}</ul>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-700 mb-1">✅ 포함</p>
              <ul className="space-y-1">{result.includes.map((h, i) => <li key={i} className="text-xs text-muted-foreground">• {h}</li>)}</ul>
            </div>
            <div>
              <p className="text-xs font-medium text-red-600 mb-1">❌ 불포함</p>
              <ul className="space-y-1">{result.excludes.map((h, i) => <li key={i} className="text-xs text-muted-foreground">• {h}</li>)}</ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 마케팅 문구 ─────────────────────────────────────────────────────────────
function MarketingCopyTab() {
  const [form, setForm] = useState({
    title: "", country: "", highlights: ["", "", ""], targetAudience: "",
  });
  const [result, setResult] = useState<{
    sns: string; adCopy: string; hashtags: string[]; cacheHit: boolean;
  } | null>(null);

  const mutation = trpc.aiLogs.generateMarketingCopy.useMutation({
    onSuccess: (data) => { setResult(data); toast.success("마케팅 문구가 생성되었습니다."); },
    onError: (e) => toast.error(`생성 실패: ${e.message}`),
  });

  const highlights = form.highlights.filter(h => h.trim());

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">상품명 *</Label>
          <Input placeholder="예: 태국 방콕 골프" value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">국가 *</Label>
          <Input placeholder="예: 태국" value={form.country}
            onChange={e => setForm(p => ({ ...p, country: e.target.value }))} className="mt-1" />
        </div>
      </div>
      <div>
        <Label className="text-xs">주요 특징 (최대 3개)</Label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {form.highlights.map((h, i) => (
            <Input key={i} placeholder={`특징 ${i + 1}`} value={h}
              onChange={e => setForm(p => { const hs = [...p.highlights]; hs[i] = e.target.value; return { ...p, highlights: hs }; })} />
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs">타겟 고객</Label>
        <Input placeholder="예: 40~60대 골프 애호가" value={form.targetAudience}
          onChange={e => setForm(p => ({ ...p, targetAudience: e.target.value }))} className="mt-1" />
      </div>
      <Button
        onClick={() => mutation.mutate({ ...form, highlights })}
        disabled={!form.title || !form.country || mutation.isPending}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
      >
        {mutation.isPending
          ? <><Loader2 size={14} className="animate-spin mr-2" />생성 중...</>
          : <><Megaphone size={14} className="mr-2" />AI 마케팅 문구 생성</>}
      </Button>
      {result && (
        <div className="space-y-3 border rounded-xl p-4 bg-purple-50/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-purple-800">생성 결과</span>
            {result.cacheHit && <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">캐시</Badge>}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-purple-700">📱 SNS 게시물</p>
              <CopyButton text={result.sns} />
            </div>
            <div className="bg-white rounded-lg p-3 border text-sm leading-relaxed">{result.sns}</div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-purple-700">📢 광고 카피</p>
              <CopyButton text={result.adCopy} />
            </div>
            <div className="bg-white rounded-lg p-3 border text-sm font-semibold">{result.adCopy}</div>
          </div>
          <div>
            <p className="text-xs font-medium text-purple-700 mb-1">#️⃣ 해시태그</p>
            <div className="flex flex-wrap gap-1">
              {result.hashtags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-xs cursor-pointer"
                  onClick={() => { navigator.clipboard.writeText(tag); toast.success("복사됨"); }}>
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 문의 답변 초안 ─────────────────────────────────────────────────────────
function InquiryReplyTab() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [result, setResult] = useState<{ reply: string; tone: string; keyPoints: string[] } | null>(null);
  const { data: inquiryList } = trpc.inquiries.list.useQuery({ page: 1, limit: 20, status: "new" });
  const utils = trpc.useUtils();

  const mutation = trpc.aiLogs.generateInquiryReply.useMutation({
    onSuccess: (data) => { setResult(data); setReplyText(data.reply); toast.success("답변 초안이 생성되었습니다."); },
    onError: (e) => toast.error(`생성 실패: ${e.message}`),
  });
  const replyMutation = trpc.inquiries.reply.useMutation({
    onSuccess: () => { toast.success("답변이 저장되었습니다."); utils.inquiries.list.invalidate(); },
    onError: (e) => toast.error(`저장 실패: ${e.message}`),
  });

  const toneLabel: Record<string, string> = { formal: "공식적", friendly: "친근한", apologetic: "사과형" };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">신규 문의 선택</Label>
        <select
          className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-background"
          value={selectedId ?? ""}
          onChange={e => { setSelectedId(Number(e.target.value)); setResult(null); setReplyText(""); }}
        >
          <option value="">-- 문의를 선택하세요 --</option>
          {inquiryList?.items.map(inq => (
            <option key={inq.id} value={inq.id}>
              {inq.name}님 | {(inq.message ?? "").slice(0, 40)}...
            </option>
          ))}
        </select>
      </div>
      {selectedId && (() => {
        const inq = inquiryList?.items.find(i => i.id === selectedId);
        if (!inq) return null;
        return (
          <>
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="font-medium">고객:</span> {inq.name}</p>
              {inq.packageName && <p><span className="font-medium">관심 상품:</span> {inq.packageName}</p>}
              <p className="text-muted-foreground">{inq.message}</p>
            </div>
            <Button
              onClick={() => mutation.mutate({ inquiryId: selectedId })}
              disabled={mutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {mutation.isPending
                ? <><Loader2 size={14} className="animate-spin mr-2" />초안 생성 중...</>
                : <><MessageSquare size={14} className="mr-2" />AI 답변 초안 생성</>}
            </Button>
          </>
        );
      })()}
      {result && (
        <div className="space-y-3 border rounded-xl p-4 bg-blue-50/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-blue-800">답변 초안</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{toneLabel[result.tone] ?? result.tone}</Badge>
              <CopyButton text={replyText} />
            </div>
          </div>
          <Textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            className="min-h-[120px] text-sm bg-white"
          />
          <div>
            <p className="text-xs font-medium text-blue-700 mb-1">핵심 포인트</p>
            <div className="flex flex-wrap gap-1">
              {result.keyPoints.map((kp, i) => <Badge key={i} variant="secondary" className="text-xs">{kp}</Badge>)}
            </div>
          </div>
          <Button
            onClick={() => { if (selectedId) replyMutation.mutate({ id: selectedId, adminReply: replyText }); }}
            disabled={replyMutation.isPending || !selectedId}
            variant="outline"
            className="w-full border-blue-400 text-blue-700 hover:bg-blue-50"
          >
            {replyMutation.isPending
              ? <><Loader2 size={14} className="animate-spin mr-2" />저장 중...</>
              : "답변 적용 및 저장"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── ERP 데이터 분석 (Function Calling) ─────────────────────────────────────
function ErpAnalysisTab() {
  const [question, setQuestion] = useState("");
  const [dataType, setDataType] = useState<"packages" | "bookings" | "inquiries" | "revenue">("packages");
  const [result, setResult] = useState<{ answer: string; functionCalled: string } | null>(null);

  const mutation = trpc.aiLogs.analyzeErpData.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error(`분석 실패: ${e.message}`),
  });

  const SUGGESTED = [
    { q: "가장 인기 있는 동남아 골프 상품 3개 추천해줘", type: "packages" as const },
    { q: "이번 달 예약 현황을 요약해줘", type: "bookings" as const },
    { q: "신규 문의 중 빠른 답변이 필요한 건은?", type: "inquiries" as const },
    { q: "최근 6개월 매출 트렌드를 분석해줘", type: "revenue" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {SUGGESTED.map((s, i) => (
          <button
            key={i}
            onClick={() => { setQuestion(s.q); setDataType(s.type); }}
            className="text-left p-2 rounded-lg border text-xs hover:bg-muted/50 transition-colors leading-relaxed"
          >
            {s.q}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background shrink-0"
          value={dataType}
          onChange={e => setDataType(e.target.value as any)}
        >
          <option value="packages">상품 데이터</option>
          <option value="bookings">예약 데이터</option>
          <option value="inquiries">문의 데이터</option>
          <option value="revenue">매출 데이터</option>
        </select>
        <Input
          placeholder="AI에게 ERP 데이터를 분석해달라고 질문하세요..."
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && question.trim()) mutation.mutate({ question, dataType }); }}
        />
        <Button
          onClick={() => mutation.mutate({ question, dataType })}
          disabled={!question.trim() || mutation.isPending}
          className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
        >
          {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
        </Button>
      </div>
      {result && (
        <div className="border rounded-xl p-4 bg-amber-50/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-800">📊 {result.functionCalled} 분석 결과</span>
            <CopyButton text={result.answer} />
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.answer}</p>
        </div>
      )}
    </div>
  );
}

// ─── 채팅 탭 상수 ─────────────────────────────────────────────────────────────
const SUGGESTED_PROMPTS = [
  "현재 등록된 상품 목록과 각 상품의 이미지 현황을 알려줘",
  "신규 골프 패키지를 등록할 때 필요한 정보가 뭐야?",
  "예약 관리에서 상태를 변경하는 방법을 알려줘",
  "홈페이지와 ERP가 어떻게 연동되어 있는지 설명해줘",
];

const CAPABILITY_CARDS = [
  { icon: <Database size={16} />, title: "시스템 이해", desc: "AI ERP의 DB 구조, API, 기능을 이미 파악하고 있습니다.", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { icon: <Code2 size={16} />, title: "개발 지원", desc: "새 기능 추가, 버그 수정, 코드 구조 개선을 제안합니다.", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { icon: <Globe size={16} />, title: "운영 도움", desc: "상품 등록, 예약 처리, 정산 등 운영 업무를 안내합니다.", color: "bg-green-50 text-green-700 border-green-200" },
  { icon: <Zap size={16} />, title: "자동화 제안", desc: "반복 작업을 자동화하는 방법을 제안하고 구현을 도웁니다.", color: "bg-amber-50 text-amber-700 border-amber-200" },
];

function ErrorBubble({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
        <AlertTriangle size={14} className="text-red-500" />
      </div>
      <div className="flex-1">
        <div className="bg-red-50 border border-red-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-lg">
          <p className="text-sm text-red-700 leading-relaxed">{message}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 h-7 text-xs border-red-300 text-red-600 hover:bg-red-100 gap-1.5">
              <RefreshCw size={11} />다시 시도
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────
export default function GeminiAssistant() {
  const [geminiMessages, setGeminiMessages] = useState<GeminiMessage[]>([]);
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastModelUsed, setLastModelUsed] = useState<string | null>(null);
  const [lastWasFallback, setLastWasFallback] = useState(false);
  const [lastRegionUsed, setLastRegionUsed] = useState<string | null>(null);
  const lastUserContentRef = useRef<string | null>(null);
  const preErrorGeminiMessagesRef = useRef<GeminiMessage[]>([]);

  const askMutation = trpc.gemini.ask.useMutation({
    onError: (err) => {
      const errorMsg = err.message || "AI 응답 중 오류가 발생했습니다.";
      setDisplayMessages((prev) => [...prev, { role: "assistant", content: errorMsg, isError: true }]);
      setGeminiMessages(preErrorGeminiMessagesRef.current);
      setIsLoading(false);
    },
  });
  const createLogMutation = trpc.aiLogs.create.useMutation();

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;
    preErrorGeminiMessagesRef.current = geminiMessages;
    lastUserContentRef.current = content;
    const userMessage: GeminiMessage = { role: "user", content };
    const updatedGeminiMessages = [...geminiMessages, userMessage];
    const cleanDisplayMessages = displayMessages.filter((m) => !m.isError);
    setGeminiMessages(updatedGeminiMessages);
    setDisplayMessages([...cleanDisplayMessages, { role: "user", content }]);
    setIsLoading(true);
    try {
      const result = await askMutation.mutateAsync({ messages: updatedGeminiMessages });
      setLastModelUsed(result.modelUsed);
      setLastWasFallback(result.wasFallback);
      setLastRegionUsed(result.regionUsed ?? null);
      if (result.errorMessage) {
        setGeminiMessages(preErrorGeminiMessagesRef.current);
        setDisplayMessages([...cleanDisplayMessages, { role: "user", content }, { role: "assistant", content: result.errorMessage, isError: true }]);
        return;
      }
      if (result.wasFallback) toast.warning(`서버 과부하로 ${result.modelUsed} 모델로 전환하여 응답했습니다.`);
      const responseContent = result.wasFallback
        ? `> ⚠️ *기본 모델 과부하로 대체 모델(${result.modelUsed})을 사용했습니다.*\n\n${result.response}`
        : result.response;
      setGeminiMessages([...updatedGeminiMessages, { role: "model", content: responseContent }]);
      setDisplayMessages([...cleanDisplayMessages, { role: "user", content }, { role: "assistant", content: responseContent }]);
      createLogMutation.mutate({ query: content, response: result.response });
    } catch { /* onError에서 처리 */ } finally { setIsLoading(false); }
  }, [geminiMessages, displayMessages, isLoading, askMutation, createLogMutation]);

  const handleRetry = useCallback(() => {
    const content = lastUserContentRef.current;
    if (!content) return;
    setDisplayMessages((prev) => prev.filter((m) => !m.isError));
    setGeminiMessages(preErrorGeminiMessagesRef.current);
    setTimeout(() => sendMessage(content), 50);
  }, [sendMessage]);

  const handleReset = useCallback(() => {
    setGeminiMessages([]); setDisplayMessages([]);
    setLastModelUsed(null); setLastWasFallback(false); setLastRegionUsed(null);
    lastUserContentRef.current = null; preErrorGeminiMessagesRef.current = [];
  }, []);

  const displayModel = lastModelUsed ?? "gemini-2.5-flash";
  const regionLabel = lastRegionUsed && lastRegionUsed !== "global" && lastRegionUsed !== "none" ? lastRegionUsed : null;
  const lastMsg = displayMessages[displayMessages.length - 1];
  const hasErrorAtEnd = lastMsg?.isError === true;
  const chatMessages: Message[] = displayMessages.filter((m) => !m.isError).map(({ role, content }) => ({ role, content }));

  return (
      <div className="space-y-4 max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
            <Sparkles size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">Gemini AI 어시스턴트</h1>
              {lastWasFallback ? (
                <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs flex items-center gap-1">
                  <AlertTriangle size={10} />{displayModel} (폴백)
                </Badge>
              ) : (
                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">{displayModel}</Badge>
              )}
              {regionLabel && <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-xs">{regionLabel}</Badge>}
              {isLoading && <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-xs animate-pulse">응답 중...</Badge>}
            </div>
            <p className="text-slate-500 text-sm">상품 설명 초안, 마케팅 문구, 문의 답변, ERP 데이터 분석 — 두골프 AI 어시스턴트</p>
          </div>
        </div>

        {/* 탭 */}
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="chat" className="text-xs"><Sparkles size={12} className="mr-1" />AI 채팅</TabsTrigger>
            <TabsTrigger value="package" className="text-xs"><Package size={12} className="mr-1" />상품 설명</TabsTrigger>
            <TabsTrigger value="marketing" className="text-xs"><Megaphone size={12} className="mr-1" />마케팅</TabsTrigger>
            <TabsTrigger value="inquiry" className="text-xs"><MessageSquare size={12} className="mr-1" />문의 답변</TabsTrigger>
            <TabsTrigger value="analysis" className="text-xs"><BarChart3 size={12} className="mr-1" />데이터 분석</TabsTrigger>
          </TabsList>

          {/* AI 채팅 탭 */}
          <TabsContent value="chat" className="mt-4">
            {displayMessages.length === 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {CAPABILITY_CARDS.map((card) => (
                  <Card key={card.title} className={`border ${card.color}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1.5">{card.icon}<span className="text-xs font-semibold">{card.title}</span></div>
                      <p className="text-xs leading-relaxed opacity-80">{card.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-500" />대화
                  </CardTitle>
                  {displayMessages.length > 0 && (
                    <button onClick={handleReset} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">대화 초기화</button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <AIChatBox
                  messages={chatMessages}
                  onSendMessage={sendMessage}
                  isLoading={isLoading}
                  placeholder="AI ERP에 대해 무엇이든 물어보세요..."
                  height={hasErrorAtEnd ? 460 : 520}
                  emptyStateMessage="아래 제안된 질문을 클릭하거나 직접 입력해 보세요."
                  suggestedPrompts={SUGGESTED_PROMPTS}
                  className="border-0 rounded-none shadow-none"
                />
                {hasErrorAtEnd && lastMsg && (
                  <div className="border-t border-slate-100">
                    <ErrorBubble message={lastMsg.content} onRetry={lastUserContentRef.current ? handleRetry : undefined} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 상품 설명 탭 */}
          <TabsContent value="package" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package size={16} className="text-emerald-600" />AI 상품 설명 초안 생성
                </CardTitle>
                <p className="text-xs text-muted-foreground">패키지 기본 정보를 입력하면 AI가 상품 설명, 하이라이트, 포함/불포함 내역을 자동 생성합니다.</p>
              </CardHeader>
              <CardContent><PackageDescTab /></CardContent>
            </Card>
          </TabsContent>

          {/* 마케팅 탭 */}
          <TabsContent value="marketing" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Megaphone size={16} className="text-purple-600" />AI 마케팅 문구 생성
                </CardTitle>
                <p className="text-xs text-muted-foreground">SNS 게시물, 광고 카피, 해시태그를 자동으로 생성합니다.</p>
              </CardHeader>
              <CardContent><MarketingCopyTab /></CardContent>
            </Card>
          </TabsContent>

          {/* 문의 답변 탭 */}
          <TabsContent value="inquiry" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare size={16} className="text-blue-600" />AI 문의 답변 초안
                </CardTitle>
                <p className="text-xs text-muted-foreground">고객 문의 내용을 분석하여 맞춤형 답변 초안을 생성합니다. 개인정보는 자동으로 익명화됩니다.</p>
              </CardHeader>
              <CardContent><InquiryReplyTab /></CardContent>
            </Card>
          </TabsContent>

          {/* 데이터 분석 탭 */}
          <TabsContent value="analysis" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 size={16} className="text-amber-600" />ERP 데이터 AI 분석 (Function Calling)
                </CardTitle>
                <p className="text-xs text-muted-foreground">AI가 ERP 데이터를 직접 조회하고 분석하여 인사이트를 제공합니다.</p>
              </CardHeader>
              <CardContent><ErpAnalysisTab /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 안내 카드 */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-start gap-3">
            <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 space-y-1">
              <p className="font-semibold">Gemini AI 어시스턴트 사용 안내</p>
              <p>기본 모델: <strong>gemini-2.5-flash</strong>. 과부하 시 자동으로 <strong>gemini-1.5-flash</strong>로 전환됩니다.</p>
              <p>AI 답변에 피드백(👍/👎)을 남기면 AI 품질 개선에 활용됩니다. 개인정보는 자동으로 익명화되어 저장됩니다.</p>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
