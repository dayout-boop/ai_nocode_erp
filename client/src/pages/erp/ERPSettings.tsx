/**
 * ERP 통합 설정 페이지
 * 모든 외부 서비스 연동 상태 확인 및 설정 가이드 제공
 */
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, XCircle, AlertCircle, ExternalLink, RefreshCw,
  CreditCard, MessageSquare, Video, Zap, Bot, Bell, Key, Settings
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ServiceStatus {
  name: string;
  key: string;
  status: "ok" | "missing" | "invalid" | "checking";
  description: string;
  guideUrl?: string;
  guideSteps?: string[];
  isRequired: boolean;
  category: string;
}

export default function ERPSettings() {
  const [testing, setTesting] = useState<string | null>(null);

  const { data: integrationStatus, isLoading, refetch } = trpc.settings.getIntegrationStatus.useQuery();

  const testSlackMutation = trpc.settings.testSlack.useMutation({
    onSuccess: () => toast.success("Slack 테스트 메시지 전송 성공!"),
    onError: (e) => toast.error(`Slack 테스트 실패: ${e.message}`),
  });

  const testManusMutation = trpc.settings.testManus.useMutation({
    onSuccess: (d) => toast.success(`Manus API 연결 성공! Task ID: ${d.taskId}`),
    onError: (e) => toast.error(`Manus API 테스트 실패: ${e.message}`),
  });

  const services: ServiceStatus[] = [
    // ─── AI 핵심 서비스 ───────────────────────────────────────
    {
      name: "Gemini AI",
      key: "gemini",
      status: integrationStatus?.gemini ? "ok" : "missing",
      description: "두골프 마스터 AI, 골프톡, 매니저 AI의 핵심 엔진. 상품 설명 자동 생성, 고객 상담 등에 사용됩니다.",
      isRequired: true,
      category: "AI 핵심",
    },
    {
      name: "OpenRouter",
      key: "openrouter",
      status: integrationStatus?.openrouter ? "ok" : "missing",
      description: "AI 모델 라우팅 허브. 태스크 복잡도에 따라 최적 모델을 자동 선택합니다.",
      guideUrl: "https://openrouter.ai/keys",
      guideSteps: [
        "openrouter.ai 회원가입",
        "API Keys 메뉴에서 키 생성",
        "ERP 시크릿 관리에서 OPENROUTER_API_KEY 등록",
      ],
      isRequired: true,
      category: "AI 핵심",
    },
    // ─── 결제 ───────────────────────────────────────────────
    {
      name: "Stripe 결제",
      key: "stripe",
      status: integrationStatus?.stripe ? "ok" : "missing",
      description: "온라인 결제 처리. 예약금 결제, 잔금 결제에 사용됩니다. 현재 테스트 모드로 설정되어 있습니다.",
      guideUrl: "https://dashboard.stripe.com/webhooks",
      guideSteps: [
        "Stripe 대시보드 → Developers → Webhooks",
        "'Add endpoint' 클릭",
        `엔드포인트 URL 입력: https://dogolf-tour-dkz3fsmp.manus.space/api/stripe/webhook`,
        "이벤트 선택: payment_intent.succeeded, payment_intent.payment_failed",
        "생성된 Webhook Secret을 STRIPE_WEBHOOK_SECRET에 등록",
      ],
      isRequired: false,
      category: "결제",
    },
    // ─── 알림 ───────────────────────────────────────────────
    {
      name: "카카오 알림톡 (Solapi)",
      key: "kakao",
      status: integrationStatus?.kakao ? "ok" : "missing",
      description: "예약 확정, 취소, 출발 D-7 알림을 고객 카카오톡으로 자동 발송합니다.",
      guideUrl: "https://solapi.com",
      guideSteps: [
        "solapi.com 회원가입 및 사업자 인증",
        "카카오 비즈니스 채널 연동 (카카오 비즈니스 계정 필요)",
        "알림톡 템플릿 등록 및 심사 완료",
        "API 키 발급 → KAKAO_API_KEY 등록",
        "발신 프로필 키 → KAKAO_SENDER_KEY 등록",
      ],
      isRequired: false,
      category: "알림",
    },
    {
      name: "Slack 알림",
      key: "slack",
      status: integrationStatus?.slack ? "ok" : "missing",
      description: "개발 요청, 오류 감지, 시스템 알림을 Slack 채널로 전송합니다.",
      guideUrl: "https://api.slack.com/apps",
      guideSteps: [
        "api.slack.com → 'Create New App' → 'From scratch'",
        "앱 이름 입력 (예: 두골프 ERP) → 워크스페이스 선택",
        "'Incoming Webhooks' 활성화",
        "'Add New Webhook to Workspace' → 채널 선택",
        "생성된 Webhook URL (https://hooks.slack.com/...) 복사",
        "SLACK_WEBHOOK_URL에 등록",
      ],
      isRequired: false,
      category: "알림",
    },
    // ─── 자동화 ─────────────────────────────────────────────
    {
      name: "Runway ML 동영상 생성",
      key: "runway",
      status: integrationStatus?.runway ? "ok" : "missing",
      description: "패키지 이미지를 10초 골프여행 홍보 동영상으로 자동 변환합니다. 미설정 시 개발 모드(더미 데이터)로 동작합니다.",
      guideUrl: "https://app.runwayml.com/account/api-keys",
      guideSteps: [
        "runwayml.com 회원가입 (월 $15~$35 플랜 필요)",
        "Account → API Keys에서 키 생성",
        "RUNWAY_API_KEY에 등록",
      ],
      isRequired: false,
      category: "자동화",
    },
    {
      name: "n8n 자동화",
      key: "n8n",
      status: integrationStatus?.n8n ? "ok" : "missing",
      description: "패키지 등록 시 인스타그램, 카카오채널 등 SNS에 자동 배포합니다. 미설정 시 개발 모드로 동작합니다.",
      guideUrl: "https://n8n.io",
      guideSteps: [
        "n8n.io 클라우드 가입 또는 자체 서버 설치",
        "Webhook 노드로 워크플로우 생성",
        "생성된 Webhook URL을 N8N_WEBHOOK_URL에 등록",
      ],
      isRequired: false,
      category: "자동화",
    },
    // ─── 개발 파이프 ─────────────────────────────────────────
    {
      name: "Manus API",
      key: "manus",
      status: integrationStatus?.manus ? "ok" : "missing",
      description: "두골프 마스터 AI가 감지한 개발 요청을 Manus 에이전트로 자동 전송합니다.",
      isRequired: false,
      category: "개발 파이프",
    },
    {
      name: "Pixabay 이미지",
      key: "pixabay",
      status: integrationStatus?.pixabay ? "ok" : "missing",
      description: "패키지 이미지 탭에서 무료 골프 이미지를 검색하고 자동 등록합니다.",
      guideUrl: "https://pixabay.com/api/docs/",
      guideSteps: [
        "pixabay.com 회원가입",
        "API 키 발급 (무료)",
        "PIXABAY_API_KEY에 등록",
      ],
      isRequired: false,
      category: "이미지",
    },
  ];

  const categories = services.reduce<string[]>((acc, s) => {
    if (!acc.includes(s.category)) acc.push(s.category);
    return acc;
  }, []);

  const getStatusBadge = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "ok":
        return <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle2 size={11} />연결됨</Badge>;
      case "missing":
        return <Badge className="bg-slate-100 text-slate-500 border-slate-200 gap-1"><XCircle size={11} />미설정</Badge>;
      case "invalid":
        return <Badge className="bg-red-100 text-red-700 border-red-200 gap-1"><AlertCircle size={11} />오류</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-600 border-blue-200 gap-1"><RefreshCw size={11} className="animate-spin" />확인 중</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "AI 핵심": return <Bot size={16} className="text-purple-600" />;
      case "결제": return <CreditCard size={16} className="text-blue-600" />;
      case "알림": return <Bell size={16} className="text-amber-600" />;
      case "자동화": return <Zap size={16} className="text-orange-600" />;
      case "개발 파이프": return <Settings size={16} className="text-slate-600" />;
      case "이미지": return <Video size={16} className="text-indigo-600" />;
      default: return <Key size={16} className="text-slate-500" />;
    }
  };

  const okCount = services.filter((s) => s.status === "ok").length;
  const totalCount = services.length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">연동 서비스 설정</h1>
          <p className="text-slate-500 text-sm mt-1">외부 서비스 연동 상태를 확인하고 설정 방법을 안내합니다.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw size={14} />
          새로고침
        </Button>
      </div>

      {/* 전체 상태 요약 */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-white">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center border">
              <span className="text-xl font-bold text-slate-700">{okCount}/{totalCount}</span>
            </div>
            <div>
              <p className="font-semibold text-slate-800">서비스 연동 현황</p>
              <p className="text-sm text-slate-500">
                {okCount === totalCount
                  ? "모든 서비스가 정상 연결되어 있습니다."
                  : `${totalCount - okCount}개 서비스가 미설정 상태입니다.`}
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-xs"
                onClick={() => {
                  setTesting("slack");
                  testSlackMutation.mutate();
                  setTimeout(() => setTesting(null), 3000);
                }}
                disabled={!integrationStatus?.slack || testSlackMutation.isPending}
              >
                <MessageSquare size={12} />
                Slack 테스트
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-xs"
                onClick={() => {
                  setTesting("manus");
                  testManusMutation.mutate();
                  setTimeout(() => setTesting(null), 5000);
                }}
                disabled={!integrationStatus?.manus || testManusMutation.isPending}
              >
                <Bot size={12} />
                Manus 테스트
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 카테고리별 서비스 목록 */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
          <p>연동 상태 확인 중...</p>
        </div>
      ) : (
        categories.map((category) => {
          const categoryServices = services.filter((s) => s.category === category);
          return (
            <Card key={category} className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {getCategoryIcon(category)}
                  {category}
                  <span className="text-xs font-normal text-slate-400 ml-1">
                    ({categoryServices.filter((s) => s.status === "ok").length}/{categoryServices.length} 연결됨)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryServices.map((service, idx) => (
                  <div key={service.key}>
                    {idx > 0 && <Separator className="my-3" />}
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-800 text-sm">{service.name}</span>
                          {getStatusBadge(service.status)}
                          {service.isRequired && (
                            <Badge className="bg-red-50 text-red-600 border-red-200 text-xs">필수</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{service.description}</p>

                        {/* 설정 방법 (미설정 시 표시) */}
                        {service.status !== "ok" && service.guideSteps && (
                          <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <p className="text-xs font-semibold text-slate-600 mb-2">설정 방법</p>
                            <ol className="space-y-1">
                              {service.guideSteps.map((step, i) => (
                                <li key={i} className="text-xs text-slate-600 flex gap-2">
                                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                                    {i + 1}
                                  </span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                            {service.guideUrl && (
                              <a
                                href={service.guideUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                <ExternalLink size={11} />
                                공식 사이트 바로가기
                              </a>
                            )}
                          </div>
                        )}

                        {/* Stripe 웹훅 특별 안내 */}
                        {service.key === "stripe" && service.status === "ok" && (
                          <div className="mt-2 bg-blue-50 rounded-lg p-3 border border-blue-100">
                            <p className="text-xs font-semibold text-blue-700 mb-1">⚠️ Stripe 웹훅 등록 필요</p>
                            <p className="text-xs text-blue-600">
                              결제 완료 알림을 받으려면 Stripe 대시보드에서 웹훅을 등록해야 합니다.
                            </p>
                            <div className="mt-1 bg-white rounded px-2 py-1 border border-blue-200 font-mono text-xs text-slate-700 break-all">
                              https://dogolf-tour-dkz3fsmp.manus.space/api/stripe/webhook
                            </div>
                            <a
                              href="https://dashboard.stripe.com/webhooks"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-xs text-blue-700 hover:text-blue-900 font-medium"
                            >
                              <ExternalLink size={11} />
                              Stripe 웹훅 설정하기
                            </a>
                          </div>
                        )}

                        {/* 카카오 알림톡 템플릿 코드 안내 */}
                        {service.key === "kakao" && service.status !== "ok" && (
                          <div className="mt-2 bg-amber-50 rounded-lg p-3 border border-amber-100">
                            <p className="text-xs font-semibold text-amber-700 mb-1">등록 필요한 알림톡 템플릿</p>
                            <div className="space-y-1">
                              {[
                                { code: "DOGOLF_BOOKING_CONFIRMED", label: "예약 확정 알림" },
                                { code: "DOGOLF_BOOKING_CANCELLED", label: "예약 취소 알림" },
                                { code: "DOGOLF_DEPARTURE_REMINDER", label: "출발 D-7 알림" },
                              ].map((t) => (
                                <div key={t.code} className="flex items-center gap-2">
                                  <span className="text-xs text-amber-600">{t.label}:</span>
                                  <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-amber-200 text-amber-800 font-mono">
                                    {t.code}
                                  </code>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* 시크릿 관리 안내 */}
      <Card className="border-0 shadow-sm border-l-4 border-l-indigo-400">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Key size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-slate-800 text-sm">API 키 등록 방법</p>
              <p className="text-xs text-slate-500 mt-1">
                모든 API 키는 Manus 관리 UI의 <strong>Settings → Secrets</strong> 에서 안전하게 등록할 수 있습니다.
                코드에 직접 키를 입력하지 마세요.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
