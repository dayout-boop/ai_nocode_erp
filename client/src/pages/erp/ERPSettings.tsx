/**
 * ERP 통합 설정 페이지
 * - 연동 서비스 상태 확인 탭
 * - ERP API 키 관리 탭 (master 전용)
 */
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CheckCircle2, XCircle, AlertCircle, ExternalLink, RefreshCw,
  CreditCard, MessageSquare, Video, Zap, Bot, Bell, Key, Settings,
  Eye, EyeOff, Pencil, Trash2, Plus, Save, X,
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

// 지원하는 API 서비스 목록
const API_SERVICES = [
  { key: "openrouter", name: "OpenRouter", description: "AI 모델 라우팅 (GPT-4, Claude, Gemini 등)", category: "AI" },
  { key: "gemini", name: "Google Gemini", description: "Google Gemini AI API", category: "AI" },
  { key: "kakao", name: "카카오 알림톡", description: "카카오 비즈니스 알림톡 API", category: "알림" },
  { key: "slack", name: "Slack", description: "Slack 웹훅 알림", category: "알림" },
  { key: "runway", name: "Runway ML", description: "AI 영상 생성 API", category: "미디어" },
  { key: "n8n", name: "n8n", description: "워크플로우 자동화", category: "자동화" },
  { key: "manus", name: "Manus API", description: "Manus AI 에이전트 API", category: "AI" },
  { key: "pixabay", name: "Pixabay", description: "이미지 검색 API", category: "미디어" },
];

// ─── API 키 관리 탭 ────────────────────────────────────────────────────────────
function ApiKeyManagementTab() {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showValue, setShowValue] = useState<Record<string, boolean>>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newKey, setNewKey] = useState({ serviceKey: "", serviceName: "", apiKey: "" });

  const { data: keys, isLoading, refetch } = trpc.erpApiKeys.list.useQuery(undefined, {
    retry: 1,
  });

  const upsertMutation = trpc.erpApiKeys.upsert.useMutation({
    onSuccess: () => {
      toast.success("API 키가 저장되었습니다");
      setEditingKey(null);
      setEditValue("");
      setAddingNew(false);
      setNewKey({ serviceKey: "", serviceName: "", apiKey: "" });
      refetch();
    },
    onError: (e) => toast.error(e.message || "저장 실패"),
  });

  const deleteMutation = trpc.erpApiKeys.deleteKey.useMutation({
    onSuccess: () => {
      toast.success("API 키가 삭제되었습니다 (환경변수로 폴백)");
      refetch();
    },
    onError: (e) => toast.error(e.message || "삭제 실패"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <RefreshCw size={20} className="animate-spin mr-2" />
        로딩 중...
      </div>
    );
  }

  // 권한 없음 (master가 아닌 경우)
  if (!keys && !isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6 pb-6 text-center">
          <Key size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">마스터 관리자만 API 키를 관리할 수 있습니다</p>
          <p className="text-slate-400 text-sm mt-1">admin 계정으로 로그인하세요</p>
        </CardContent>
      </Card>
    );
  }

  // 서비스 목록과 DB 키 병합
  const mergedServices = API_SERVICES.map((svc) => {
    const dbKey = keys?.find((k) => k.serviceKey === svc.key);
    return { ...svc, dbKey };
  });

  // DB에만 있는 커스텀 서비스
  const customKeys = keys?.filter((k) => !API_SERVICES.find((s) => s.key === k.serviceKey)) || [];

  return (
    <div className="space-y-4">
      {/* 안내 배너 */}
      <Card className="border-0 shadow-sm bg-amber-50 border-l-4 border-l-amber-400">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Key size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">ERP 내부 API 키 관리</p>
              <p className="text-xs text-amber-700 mt-1">
                여기서 등록한 API 키는 ERP DB에 암호화 저장됩니다. 어떤 직원 계정으로 로그인해도 마스터가 설정한 키가 사용됩니다.
                DB 키가 없으면 환경변수(Manus Secrets)로 폴백됩니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 서비스별 API 키 목록 */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">API 키 목록</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddingNew(true)}
              className="gap-1.5 text-xs"
              disabled={addingNew}
            >
              <Plus size={13} />
              커스텀 키 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* 커스텀 키 추가 폼 */}
          {addingNew && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
              <p className="text-xs font-semibold text-slate-600">새 API 키 추가</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="서비스 키 (예: my_service)"
                  value={newKey.serviceKey}
                  onChange={(e) => setNewKey({ ...newKey, serviceKey: e.target.value })}
                  className="text-sm h-8"
                />
                <Input
                  placeholder="서비스 이름 (예: My Service)"
                  value={newKey.serviceName}
                  onChange={(e) => setNewKey({ ...newKey, serviceName: e.target.value })}
                  className="text-sm h-8"
                />
              </div>
              <Input
                placeholder="API 키 값"
                value={newKey.apiKey}
                onChange={(e) => setNewKey({ ...newKey, apiKey: e.target.value })}
                className="text-sm h-8 font-mono"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setAddingNew(false); setNewKey({ serviceKey: "", serviceName: "", apiKey: "" }); }}
                  className="h-7 text-xs"
                >
                  <X size={12} className="mr-1" />취소
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!newKey.serviceKey || !newKey.apiKey) {
                      toast.error("서비스 키와 API 키를 입력하세요");
                      return;
                    }
                    upsertMutation.mutate({
                      serviceKey: newKey.serviceKey,
                      serviceName: newKey.serviceName || newKey.serviceKey,
                      apiKey: newKey.apiKey,
                    });
                  }}
                  disabled={upsertMutation.isPending}
                  className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Save size={12} className="mr-1" />저장
                </Button>
              </div>
            </div>
          )}

          {/* 기본 서비스 목록 */}
          {mergedServices.map((svc, idx) => (
            <div key={svc.key}>
              {idx > 0 && <Separator className="my-2" />}
              <ApiKeyRow
                serviceKey={svc.key}
                serviceName={svc.name}
                description={svc.description}
                category={svc.category}
                dbKey={svc.dbKey}
                editingKey={editingKey}
                editValue={editValue}
                showValue={showValue}
                onEdit={(key) => { setEditingKey(key); setEditValue(""); }}
                onSave={(key, value) => upsertMutation.mutate({ serviceKey: key, serviceName: svc.name, apiKey: value })}
                onDelete={(key) => deleteMutation.mutate({ serviceKey: key })}
                onToggleShow={(key) => setShowValue((prev) => ({ ...prev, [key]: !prev[key] }))}
                onEditValueChange={setEditValue}
                onCancelEdit={() => { setEditingKey(null); setEditValue(""); }}
                isSaving={upsertMutation.isPending}
                isDeleting={deleteMutation.isPending}
              />
            </div>
          ))}

          {/* 커스텀 서비스 목록 */}
          {customKeys.length > 0 && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-semibold text-slate-500 px-1">커스텀 서비스</p>
              {customKeys.map((k) => (
                <div key={k.serviceKey}>
                  <Separator className="my-2" />
                  <ApiKeyRow
                    serviceKey={k.serviceKey}
                    serviceName={k.serviceName}
                    description="커스텀 API 키"
                    category="기타"
                    dbKey={k}
                    editingKey={editingKey}
                    editValue={editValue}
                    showValue={showValue}
                    onEdit={(key) => { setEditingKey(key); setEditValue(""); }}
                    onSave={(key, value) => upsertMutation.mutate({ serviceKey: key, serviceName: k.serviceName, apiKey: value })}
                    onDelete={(key) => deleteMutation.mutate({ serviceKey: key })}
                    onToggleShow={(key) => setShowValue((prev) => ({ ...prev, [key]: !prev[key] }))}
                    onEditValueChange={setEditValue}
                    onCancelEdit={() => { setEditingKey(null); setEditValue(""); }}
                    isSaving={upsertMutation.isPending}
                    isDeleting={deleteMutation.isPending}
                  />
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── API 키 행 컴포넌트 ────────────────────────────────────────────────────────
function ApiKeyRow({
  serviceKey, serviceName, description, category, dbKey,
  editingKey, editValue, showValue,
  onEdit, onSave, onDelete, onToggleShow, onEditValueChange, onCancelEdit,
  isSaving, isDeleting,
}: {
  serviceKey: string;
  serviceName: string;
  description: string;
  category: string;
  dbKey?: { hasKey: boolean; apiKeyMasked?: string | null; isActive: boolean } | null;
  editingKey: string | null;
  editValue: string;
  showValue: Record<string, boolean>;
  onEdit: (key: string) => void;
  onSave: (key: string, value: string) => void;
  onDelete: (key: string) => void;
  onToggleShow: (key: string) => void;
  onEditValueChange: (val: string) => void;
  onCancelEdit: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}) {
  const isEditing = editingKey === serviceKey;
  const hasKey = dbKey?.hasKey || false;

  return (
    <div className="flex items-start gap-3 py-1">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-slate-800 text-sm">{serviceName}</span>
          <Badge className={`text-xs ${hasKey ? "bg-green-100 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
            {hasKey ? (
              <><CheckCircle2 size={10} className="mr-1" />DB 키 사용</>
            ) : (
              <><XCircle size={10} className="mr-1" />ENV 폴백</>
            )}
          </Badge>
          <Badge variant="outline" className="text-xs text-slate-400">{category}</Badge>
        </div>
        <p className="text-xs text-slate-400">{description}</p>

        {/* 현재 키 값 표시 */}
        {hasKey && dbKey?.apiKeyMasked && !isEditing && (
          <div className="mt-1.5 flex items-center gap-2">
            <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-600">
              {showValue[serviceKey] ? dbKey.apiKeyMasked : "••••••••••••"}
            </code>
            <button
              onClick={() => onToggleShow(serviceKey)}
              className="text-slate-400 hover:text-slate-600"
            >
              {showValue[serviceKey] ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        )}

        {/* 편집 폼 */}
        {isEditing && (
          <div className="mt-2 flex items-center gap-2">
            <Input
              type="text"
              placeholder="새 API 키 입력"
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              className="text-sm h-8 font-mono flex-1"
              autoFocus
            />
            <Button
              size="sm"
              onClick={() => {
                if (!editValue.trim()) {
                  toast.error("API 키를 입력하세요");
                  return;
                }
                onSave(serviceKey, editValue.trim());
              }}
              disabled={isSaving}
              className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3"
            >
              <Save size={12} className="mr-1" />저장
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancelEdit}
              className="h-8 text-xs px-2"
            >
              <X size={12} />
            </Button>
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      {!isEditing && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(serviceKey)}
            className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600"
            title={hasKey ? "키 변경" : "키 등록"}
          >
            <Pencil size={13} />
          </Button>
          {hasKey && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm(`${serviceName} API 키를 삭제하시겠습니까? 환경변수로 폴백됩니다.`)) {
                  onDelete(serviceKey);
                }
              }}
              disabled={isDeleting}
              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
              title="키 삭제 (ENV 폴백)"
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 연동 상태 탭 ────────────────────────────────────────────────────────────
function IntegrationStatusTab() {
  const [testing, setTesting] = useState<string | null>(null);

  const { data: integrationStatus, isLoading, refetch } = trpc.settings.getIntegrationStatus.useQuery();

  const testSlackMutation = trpc.settings.testSlack.useMutation({
    onSuccess: () => toast.success("Slack 테스트 메시지 전송 성공!"),
    onError: (e) => toast.error(`Slack 테스트 실패: ${e.message}`),
  });

  const testManusMutation = trpc.settings.testManus.useMutation({
    onSuccess: (d) => {
      const mode = d.routingMode === "project_scoped" ? "프로젝트 내 태스크 생성" : "독립 태스크 생성";
      toast.success(`Manus API 연결 성공! (${mode}) Task ID: ${d.taskId}`);
    },
    onError: (e) => toast.error(`Manus API 테스트 실패: ${e.message}`),
  });
  const { data: manusConfig } = trpc.settings.getManusConfig.useQuery();

  const services: ServiceStatus[] = [
    // ─── AI 핵심 서비스 ───────────────────────────────────────
    {
      name: "Gemini AI",
      key: "gemini",
      status: integrationStatus?.gemini ? "ok" : "missing",
      description: "Google Gemini AI API - 파일 분석, 이미지 인식, 텍스트 생성에 사용됩니다.",
      guideUrl: "https://makersuite.google.com/app/apikey",
      guideSteps: [
        "Google AI Studio (makersuite.google.com) 접속",
        "Get API key 클릭",
        "Create API key in new project 선택",
        "생성된 키를 복사하여 Secrets에 GEMINI_API_KEY로 등록",
      ],
      isRequired: true,
      category: "AI 핵심",
    },
    {
      name: "OpenRouter",
      key: "openrouter",
      status: integrationStatus?.openrouter ? "ok" : "missing",
      description: "다양한 AI 모델(GPT-4, Claude, Llama 등)을 하나의 API로 사용하는 라우팅 서비스입니다.",
      guideUrl: "https://openrouter.ai/keys",
      guideSteps: [
        "OpenRouter (openrouter.ai) 가입 및 로그인",
        "Keys 메뉴에서 Create Key 클릭",
        "생성된 키를 Secrets에 OPENROUTER_API_KEY로 등록",
      ],
      isRequired: true,
      category: "AI 핵심",
    },
    {
      name: "Manus API",
      key: "manus",
      status: integrationStatus?.manus ? "ok" : "missing",
      description: "Manus AI 에이전트 자동 실행 API - 두골프 마스터의 개발 요청 자동화에 사용됩니다.",
      guideUrl: "https://dayoutgolf.com/erp",
      guideSteps: [
        "Manus 계정 설정에서 API 키 발급",
        "MANUS_API_KEY로 Secrets에 등록",
        "MANUS_PROJECT_ID도 함께 등록 (크레딧 절약)",
      ],
      isRequired: false,
      category: "AI 핵심",
    },
    // ─── 결제 ────────────────────────────────────────────────
    {
      name: "Stripe",
      key: "stripe",
      status: integrationStatus?.stripe ? "ok" : "missing",
      description: "온라인 결제 처리 서비스입니다.",
      guideUrl: "https://dashboard.stripe.com/apikeys",
      guideSteps: [
        "Stripe 대시보드에서 API 키 확인",
        "STRIPE_SECRET_KEY, VITE_STRIPE_PUBLISHABLE_KEY 등록",
        "웹훅 설정 (아래 안내 참조)",
      ],
      isRequired: false,
      category: "결제",
    },
    // ─── 알림 ────────────────────────────────────────────────
    {
      name: "카카오 알림톡",
      key: "kakao",
      status: integrationStatus?.kakao ? "ok" : "missing",
      description: "카카오 비즈니스 알림톡 API - 예약 확정, 취소, 출발 알림 발송에 사용됩니다.",
      guideUrl: "https://business.kakao.com",
      guideSteps: [
        "카카오 비즈니스 계정 생성 및 채널 등록",
        "알림톡 발송 API 신청",
        "KAKAO_API_KEY, KAKAO_SENDER_KEY 등록",
      ],
      isRequired: false,
      category: "알림",
    },
    {
      name: "Slack",
      key: "slack",
      status: integrationStatus?.slack ? "ok" : "missing",
      description: "Slack 웹훅 알림 - 새 예약, 문의, 오류 발생 시 팀 채널에 알림을 보냅니다.",
      guideUrl: "https://api.slack.com/apps",
      guideSteps: [
        "Slack API 앱 생성 (api.slack.com/apps)",
        "Incoming Webhooks 활성화",
        "채널 선택 후 웹훅 URL 복사",
        "SLACK_WEBHOOK_URL로 Secrets에 등록",
      ],
      isRequired: false,
      category: "알림",
    },
    // ─── 자동화 ──────────────────────────────────────────────
    {
      name: "n8n",
      key: "n8n",
      status: integrationStatus?.n8n ? "ok" : "missing",
      description: "n8n 워크플로우 자동화 - 복잡한 업무 자동화 파이프라인 구성에 사용됩니다.",
      guideUrl: "https://n8n.io",
      guideSteps: [
        "n8n 클라우드 또는 자체 호스팅 설정",
        "API 키 발급",
        "N8N_API_KEY, N8N_BASE_URL 등록",
      ],
      isRequired: false,
      category: "자동화",
    },
    // ─── 이미지/미디어 ──────────────────────────────────────
    {
      name: "Runway ML",
      key: "runway",
      status: integrationStatus?.runway ? "ok" : "missing",
      description: "AI 영상 생성 서비스 - 골프 투어 홍보 영상 자동 생성에 사용됩니다.",
      guideUrl: "https://runwayml.com",
      guideSteps: [
        "Runway 계정 생성",
        "API 키 발급",
        "RUNWAY_API_KEY로 Secrets에 등록",
      ],
      isRequired: false,
      category: "이미지",
    },
    {
      name: "Pixabay",
      key: "pixabay",
      status: integrationStatus?.pixabay ? "ok" : "missing",
      description: "무료 이미지 검색 API - 패키지 이미지 자동 검색에 사용됩니다.",
      guideUrl: "https://pixabay.com/api/docs/",
      guideSteps: [
        "Pixabay 계정 생성",
        "API 키 발급",
        "PIXABAY_API_KEY로 Secrets에 등록",
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
    <div className="space-y-4">
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

                        {service.key === "stripe" && service.status === "ok" && (
                          <div className="mt-2 bg-blue-50 rounded-lg p-3 border border-blue-100">
                            <p className="text-xs font-semibold text-blue-700 mb-1">⚠️ Stripe 웹훅 등록 필요</p>
                            <p className="text-xs text-blue-600">
                              결제 완료 알림을 받으려면 Stripe 대시보드에서 웹훅을 등록해야 합니다.
                            </p>
                            <div className="mt-1 bg-white rounded px-2 py-1 border border-blue-200 font-mono text-xs text-slate-700 break-all">
                              https://dayoutgolf.com/api/stripe/webhook
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

      {/* Manus 스마트 라우팅 설정 현황 */}
      <Card className="border-0 shadow-sm border-l-4 border-l-indigo-500">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot size={15} className="text-indigo-600" />
            Manus 스마트 라우팅 설정 현황
          </CardTitle>
          <CardDescription className="text-xs">
            두골프 마스터에서 개발 요청 시 기존 태스크 재사용 여부를 자동 판단하여 크레딧을 절약합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-500 mb-1">API 키 상태</p>
              {manusConfig?.hasApiKey ? (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 size={12} /> 설정됨</span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-red-500 font-medium"><XCircle size={12} /> 미설정</span>
              )}
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-500 mb-1">프로젝트 ID</p>
              {manusConfig?.hasProjectId ? (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle2 size={12} /> {manusConfig.projectIdMasked}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-500 font-medium"><AlertCircle size={12} /> 미설정 (크레딧 낭비 위험)</span>
              )}
            </div>
          </div>
          <div className={`rounded-lg px-3 py-2 text-xs border ${
            manusConfig?.routingMode === "project_scoped"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-amber-50 border-amber-200 text-amber-700"
          }`}>
            <p className="font-semibold mb-0.5">
              {manusConfig?.routingMode === "project_scoped" ? "✅ 스마트 라우팅 활성화" : "⚠️ 스마트 라우팅 비활성화"}
            </p>
            <p className="opacity-80">{manusConfig?.routingDescription}</p>
          </div>
          {!manusConfig?.hasProjectId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
              <p className="font-semibold mb-1">MANUS_PROJECT_ID 설정 방법</p>
              <ol className="list-decimal list-inside space-y-0.5 opacity-80">
                <li>Manus 웹앱(manus.ai)에서 이 두골프 프로젝트 URL 확인</li>
                <li>URL에서 project ID 복사 (예: <code className="bg-blue-100 px-1 rounded">prj_xxxxxxxx</code>)</li>
                <li>Settings → Secrets에서 <code className="bg-blue-100 px-1 rounded">MANUS_PROJECT_ID</code> 등록</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 시크릿 관리 안내 */}
      <Card className="border-0 shadow-sm border-l-4 border-l-indigo-400">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Key size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-slate-800 text-sm">API 키 등록 방법</p>
              <p className="text-xs text-slate-500 mt-1">
                환경변수 기반 키는 Manus 관리 UI의 <strong>Settings → Secrets</strong>에서 등록하세요.
                ERP DB 기반 키는 위의 <strong>ERP API 키 관리</strong> 탭에서 직접 관리할 수 있습니다.
                코드에 직접 키를 입력하지 마세요.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 메인 설정 페이지 ─────────────────────────────────────────────────────────
export default function ERPSettings() {
  const [activeTab, setActiveTab] = useState("integration");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ERP 설정</h1>
        <p className="text-slate-500 text-sm mt-1">외부 서비스 연동 상태 확인 및 API 키 관리</p>
      </div>

      {/* 탭 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="integration" className="gap-2">
            <Settings size={14} />
            연동 서비스 상태
          </TabsTrigger>
          <TabsTrigger value="apikeys" className="gap-2">
            <Key size={14} />
            ERP API 키 관리
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integration">
          <IntegrationStatusTab />
        </TabsContent>

        <TabsContent value="apikeys">
          <ApiKeyManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
