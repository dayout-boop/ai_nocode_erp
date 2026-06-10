/**
 * 파트너 전용 연동 설정 페이지
 * - 구글 드라이브, 슬랙, 이메일, 도메인, 홈페이지 등 업체별 API 연동 관리
 * - tenantId 기반 멀티테넌트 처리
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plug, Plus, Trash2, RefreshCw, CheckCircle2, XCircle,
  Clock, AlertCircle, Globe, Mail, MessageSquare,
  HardDrive, Link2, Settings2, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── 서비스 카탈로그 ─────────────────────────────────────────────
const SERVICE_CATALOG = [
  {
    id: "google_drive",
    label: "구글 드라이브",
    icon: <HardDrive size={20} className="text-blue-500" />,
    description: "예약 서류, 이미지, 계약서 등을 구글 드라이브에 자동 저장",
    placeholder_key: "Google Service Account JSON 또는 OAuth 토큰",
    placeholder_config: '{"folder_id": "your_folder_id"}',
    category: "스토리지",
  },
  {
    id: "slack",
    label: "슬랙 (Slack)",
    icon: <MessageSquare size={20} className="text-purple-500" />,
    description: "예약 알림, 문의 접수 등을 슬랙 채널로 실시간 전송",
    placeholder_key: "Slack Webhook URL",
    placeholder_config: '{"channel": "#예약알림"}',
    category: "알림",
  },
  {
    id: "email_smtp",
    label: "이메일 SMTP",
    icon: <Mail size={20} className="text-orange-500" />,
    description: "예약 확인, 견적서 등을 자동 이메일 발송",
    placeholder_key: "SMTP 비밀번호 또는 앱 비밀번호",
    placeholder_config: '{"host": "smtp.gmail.com", "port": 587, "user": "your@email.com"}',
    category: "알림",
  },
  {
    id: "custom_domain",
    label: "도메인 설정",
    icon: <Globe size={20} className="text-green-500" />,
    description: "업체 전용 도메인 연결 및 DNS 설정",
    placeholder_key: "도메인 인증 토큰 (선택)",
    placeholder_config: '{"domain": "yourdomain.com"}',
    category: "홈페이지",
  },
  {
    id: "homepage_ga",
    label: "홈페이지 Google Analytics",
    icon: <Globe size={20} className="text-yellow-500" />,
    description: "업체 홈페이지 방문자 통계 연동",
    placeholder_key: "GA4 Measurement ID (G-XXXXXXXX)",
    placeholder_config: "",
    category: "홈페이지",
  },
  {
    id: "kakao_channel",
    label: "카카오 채널",
    icon: <MessageSquare size={20} className="text-yellow-400" />,
    description: "카카오 채널 연동으로 고객 문의 자동 연결",
    placeholder_key: "카카오 채널 ID",
    placeholder_config: "",
    category: "알림",
  },
  {
    id: "naver_blog",
    label: "네이버 블로그/플레이스",
    icon: <Link2 size={20} className="text-green-600" />,
    description: "네이버 블로그 및 플레이스 연동",
    placeholder_key: "네이버 API 키",
    placeholder_config: '{"client_id": "your_client_id"}',
    category: "마케팅",
  },
  {
    id: "portone",
    label: "포트원 (결제)",
    icon: <Settings2 size={20} className="text-blue-600" />,
    description: "온라인 결제 연동 (카드, 계좌이체 등)",
    placeholder_key: "포트원 API Secret",
    placeholder_config: '{"store_id": "your_store_id", "channel_key": "your_channel_key"}',
    category: "결제",
  },
  {
    id: "custom",
    label: "커스텀 API",
    icon: <Plug size={20} className="text-gray-500" />,
    description: "두골프 매니저에게 개발 요청할 커스텀 API 연동",
    placeholder_key: "API 키 또는 토큰",
    placeholder_config: '{"endpoint": "https://api.example.com"}',
    category: "기타",
  },
];

const CATEGORIES = ["전체", "스토리지", "알림", "홈페이지", "마케팅", "결제", "기타"];

function statusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 size={12} className="mr-1" />연결됨</Badge>;
    case "error":
      return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle size={12} className="mr-1" />오류</Badge>;
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200"><Clock size={12} className="mr-1" />검토 중</Badge>;
    case "disabled":
      return <Badge className="bg-gray-100 text-gray-500 border-gray-200"><AlertCircle size={12} className="mr-1" />비활성</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── 연동 등록/수정 다이얼로그 ────────────────────────────────────
function UpsertDialog({
  open,
  onClose,
  editItem,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  editItem?: { id?: number; serviceName: string; serviceLabel?: string | null; configJson?: string | null } | null;
  onSuccess: () => void;
}) {
  const [serviceName, setServiceName] = useState(editItem?.serviceName ?? "");
  const [serviceLabel, setServiceLabel] = useState(editItem?.serviceLabel ?? "");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [configJson, setConfigJson] = useState(editItem?.configJson ?? "");

  const catalog = SERVICE_CATALOG.find((s) => s.id === serviceName);

  const upsertMutation = trpc.tenantAi.upsertMyApiConnection.useMutation({
    onSuccess: () => {
      toast.success(editItem?.id ? "연동 정보가 수정되었습니다." : "연동이 등록되었습니다. 두골프 매니저 AI가 분석 후 안내드립니다.");
      onSuccess();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!serviceName) { toast.error("서비스를 선택해주세요."); return; }
    upsertMutation.mutate({
      id: editItem?.id,
      serviceName,
      serviceLabel: serviceLabel || catalog?.label || serviceName,
      apiKey: apiKey || undefined,
      apiSecret: apiSecret || undefined,
      configJson: configJson || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug size={18} className="text-dogolf-green" />
            {editItem?.id ? "연동 수정" : "새 연동 추가"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!editItem?.id && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">서비스 선택</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dogolf-green"
                value={serviceName}
                onChange={(e) => {
                  setServiceName(e.target.value);
                  const cat = SERVICE_CATALOG.find((s) => s.id === e.target.value);
                  if (cat) { setServiceLabel(cat.label); setConfigJson(cat.placeholder_config); }
                }}
              >
                <option value="">-- 서비스 선택 --</option>
                {SERVICE_CATALOG.map((s) => (
                  <option key={s.id} value={s.id}>{s.label} ({s.category})</option>
                ))}
              </select>
              {catalog && (
                <p className="text-xs text-gray-500 mt-1">{catalog.description}</p>
              )}
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">표시명 (선택)</label>
            <Input
              value={serviceLabel}
              onChange={(e) => setServiceLabel(e.target.value)}
              placeholder={catalog?.label ?? "서비스 표시명"}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              API 키 / 토큰 {editItem?.id && <span className="text-gray-400">(변경 시만 입력)</span>}
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={catalog?.placeholder_key ?? "API 키 또는 토큰"}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              API 시크릿 {editItem?.id && <span className="text-gray-400">(변경 시만 입력)</span>}
            </label>
            <Input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="API 시크릿 (있는 경우)"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">추가 설정 (JSON)</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-dogolf-green resize-none"
              rows={3}
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              placeholder={catalog?.placeholder_config ?? '{"key": "value"}'}
            />
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
            <strong>안내:</strong> 연동 등록 후 두골프 매니저 AI가 자동으로 분석하여 활용 방안을 제안합니다. 개발이 필요한 경우 마스터 승인 후 진행됩니다.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            className="bg-dogolf-green hover:bg-dogolf-green-dark"
            onClick={handleSubmit}
            disabled={upsertMutation.isPending}
          >
            {upsertMutation.isPending ? "저장 중..." : (editItem?.id ? "수정" : "등록")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 연동 카드 ────────────────────────────────────────────────────
function IntegrationCard({
  item,
  onEdit,
  onDelete,
}: {
  item: {
    id: number;
    serviceName: string;
    serviceLabel?: string | null;
    status: string;
    lastTestedAt?: Date | null;
    lastError?: string | null;
    aiAnalysisMemo?: string | null;
    isActive: boolean;
    configJson?: string | null;
    apiKeyMasked?: string | null;
  };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const catalog = SERVICE_CATALOG.find((s) => s.id === item.serviceName);

  return (
    <div className="border rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 border">
              {catalog?.icon ?? <Plug size={20} className="text-gray-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">{item.serviceLabel ?? catalog?.label ?? item.serviceName}</span>
                {statusBadge(item.status)}
              </div>
              {catalog && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{catalog.description}</p>
              )}
              {item.apiKeyMasked && (
                <p className="text-xs text-gray-400 mt-0.5 font-mono">키: {item.apiKeyMasked}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0">
              <Settings2 size={14} />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">
              <Trash2 size={14} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="h-8 w-8 p-0">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="border-t px-4 py-3 bg-gray-50 rounded-b-xl space-y-2">
          {item.lastTestedAt && (
            <p className="text-xs text-gray-500">마지막 테스트: {new Date(item.lastTestedAt).toLocaleString()}</p>
          )}
          {item.lastError && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
              <strong>오류:</strong> {item.lastError}
            </div>
          )}
          {item.aiAnalysisMemo && (
            <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-700">
              <strong>두골프 AI 분석:</strong> {item.aiAnalysisMemo}
            </div>
          )}
          {item.configJson && (
            <div>
              <p className="text-xs text-gray-500 mb-1">설정:</p>
              <pre className="text-xs bg-white border rounded p-2 overflow-x-auto">{item.configJson}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────
export default function PartnerIntegrations() {
  const [activeCategory, setActiveCategory] = useState("전체");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editItem, setEditItem] = useState<{
    id?: number;
    serviceName: string;
    serviceLabel?: string | null;
    configJson?: string | null;
  } | null>(null);

  const { data: connections, refetch, isLoading } = trpc.tenantAi.getMyApiConnections.useQuery();

  const deleteMutation = trpc.tenantAi.deleteMyApiConnection.useMutation({
    onSuccess: () => { toast.success("연동이 삭제되었습니다."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const handleDelete = (id: number) => {
    if (!confirm("이 연동을 삭제하시겠습니까?")) return;
    deleteMutation.mutate({ id });
  };

  const filtered = (connections ?? []).filter((c) => {
    if (activeCategory === "전체") return true;
    const cat = SERVICE_CATALOG.find((s) => s.id === c.serviceName);
    return cat?.category === activeCategory;
  });

  // 카탈로그에 없는 서비스도 표시
  const connectedServiceIds = new Set((connections ?? []).map((c) => c.serviceName));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Plug size={24} className="text-dogolf-green" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">연동 설정</h1>
              <p className="text-gray-500 text-sm mt-0.5">구글 드라이브, 슬랙, 이메일 등 외부 서비스를 두골프 ERP와 연동합니다.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw size={14} className="mr-1" /> 새로고침
            </Button>
            <Button
              size="sm"
              className="bg-dogolf-green hover:bg-dogolf-green-dark"
              onClick={() => { setEditItem(null); setShowAddDialog(true); }}
            >
              <Plus size={14} className="mr-1" /> 연동 추가
            </Button>
          </div>
        </div>
      </div>

      {/* 안내 배너 */}
      <div className="bg-gradient-to-r from-dogolf-green/10 to-blue-50 border border-dogolf-green/20 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-dogolf-green/20 flex items-center justify-center flex-shrink-0">
            <Plug size={16} className="text-dogolf-green" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">API 연동 안내</p>
            <p className="text-xs text-gray-600">
              연동 등록 시 두골프 매니저 AI가 자동으로 활용 방안을 분석합니다.
              개발이 필요한 기능은 마스터 승인 후 업체 맞춤 개발로 진행됩니다.
              API 키는 암호화되어 안전하게 저장됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat
                ? "bg-dogolf-green text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 연동 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> 불러오는 중...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Plug size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">등록된 연동이 없습니다.</p>
          <p className="text-sm mt-1">위의 "연동 추가" 버튼을 눌러 첫 연동을 등록해보세요.</p>
          <Button
            className="mt-4 bg-dogolf-green hover:bg-dogolf-green-dark"
            onClick={() => { setEditItem(null); setShowAddDialog(true); }}
          >
            <Plus size={14} className="mr-1" /> 첫 연동 추가
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <IntegrationCard
              key={item.id}
              item={item}
              onEdit={() => { setEditItem({ id: item.id, serviceName: item.serviceName, serviceLabel: item.serviceLabel, configJson: item.configJson }); setShowAddDialog(true); }}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      )}

      {/* 미연동 서비스 카탈로그 */}
      {activeCategory === "전체" && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">연동 가능한 서비스</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SERVICE_CATALOG.filter((s) => !connectedServiceIds.has(s.id)).map((s) => (
              <div
                key={s.id}
                className="border rounded-xl p-4 bg-white hover:border-dogolf-green/50 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => {
                  setEditItem({ serviceName: s.id, serviceLabel: s.label });
                  setShowAddDialog(true);
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center border">
                    {s.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{s.label}</p>
                    <Badge variant="outline" className="text-xs">{s.category}</Badge>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{s.description}</p>
                <div className="mt-3 flex items-center gap-1 text-xs text-dogolf-green font-medium">
                  <Plus size={12} /> 연동 추가
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 다이얼로그 */}
      {showAddDialog && (
        <UpsertDialog
          open={showAddDialog}
          onClose={() => { setShowAddDialog(false); setEditItem(null); }}
          editItem={editItem}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
