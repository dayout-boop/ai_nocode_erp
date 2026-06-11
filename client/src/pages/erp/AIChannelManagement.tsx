// ============================================================
// AI 채널 통합 관리 페이지
// 마스터 ERP AI 관리 카테고리 — 5개 AI 채널의 명칭·DB 매핑·
// 프롬프트 키·라우팅 경로를 한눈에 관리
// ============================================================
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, Wrench, LifeBuoy, BrainCircuit, ExternalLink } from "lucide-react";
import { Link } from "wouter";

// ─── AI 채널 정의 ────────────────────────────────────────────
const AI_CHANNELS = [
  {
    id: "master",
    name: "마스터AI",
    emoji: "🤖",
    icon: BrainCircuit,
    iconColor: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
    description: "관리자 전용 최고 권한 AI. 코드 수정, 파일 분석, 도구 실행 등 전 기능 지원.",
    dbAssistantKey: "master",
    promptFile: "server/services/prompts/master.ts",
    routePath: "/master-ai",
    logPath: "/master-ai/logs",
    accessLevel: "마스터 전용",
    status: "운영 중",
    statusColor: "bg-green-100 text-green-700",
    creditPolicy: "비용 발생 (모델별 과금)",
    features: ["Human-in-the-Loop 도구 승인", "GitHub 연동", "스트리밍 SSE", "세션 이어가기"],
  },
  {
    id: "manager",
    name: "AI파트너매니저",
    emoji: "💼",
    icon: Bot,
    iconColor: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
    description: "파트너사 스태프 전용 업무 지원 AI. 예약 처리, 상품 안내, Generative UI 카드 제공.",
    dbAssistantKey: "manager",
    promptFile: "server/services/prompts/manager.ts",
    routePath: "/manager-chat",
    logPath: "/manager-admin",
    accessLevel: "파트너 스태프",
    status: "운영 중",
    statusColor: "bg-green-100 text-green-700",
    creditPolicy: "무료 제공 (크레딧 차감 없음)",
    features: ["Generative UI 카드", "수기예약 DB 저장", "세션 이어가기", "파트너 ERP 연동"],
  },
  {
    id: "golftalk",
    name: "AI상담톡",
    emoji: "",
    icon: Sparkles,
    iconColor: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    badgeClass: "bg-green-100 text-green-700 border-green-200",
    description: "고객용 AI 상담 챗봇. 상품 안내, 예약 문의, 골프 투어 정보 제공.",
    dbAssistantKey: "golftalk",
    promptFile: "server/services/prompts/golfTalk.ts",
    routePath: "/golftalk-admin",
    logPath: "/golftalk-admin",
    accessLevel: "일반 고객",
    status: "운영 중",
    statusColor: "bg-green-100 text-green-700",
    creditPolicy: "무료 제공 (크레딧 차감 없음)",
    features: ["상품 캐러셀 Generative UI", "예약자 폼 Generative UI", "차단 키워드 필터링"],
  },
  {
    id: "support",
    name: "고객센터AI",
    emoji: "",
    icon: LifeBuoy,
    iconColor: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    badgeClass: "bg-orange-100 text-orange-700 border-orange-200",
    description: "파트너사 전용 고객센터 AI. FAQ 안내, 개발 요청 접수, ERP 사용법 지원.",
    dbAssistantKey: "support",
    promptFile: "server/routers/devRequest.ts (submitByPartner)",
    routePath: "/partner/staff/support",
    logPath: "/partner/staff/support",
    accessLevel: "파트너 스태프",
    status: "운영 중",
    statusColor: "bg-green-100 text-green-700",
    creditPolicy: "무료 제공 (크레딧 차감 없음)",
    features: ["FAQ 자동 응답", "개발 요청 접수", "파트너 ERP 우하단 위젯", "2차 페이지 지원"],
  },
  {
    id: "gemini",
    name: "파트너자동화AI",
    emoji: "",
    icon: Wrench,
    iconColor: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    badgeClass: "bg-indigo-100 text-indigo-700 border-indigo-200",
    description: "파트너사 업무 자동화 AI. 상품 설명 초안, 마케팅 문구, 문의 답변 초안 생성.",
    dbAssistantKey: "gemini",
    promptFile: "server/_core/llm.ts (invokeLLM)",
    routePath: "/gemini",
    logPath: "/ai-logs",
    accessLevel: "파트너 스태프 + 마스터",
    status: "운영 중",
    statusColor: "bg-green-100 text-green-700",
    creditPolicy: "파트너 크레딧 차감 (사용량 기반)",
    features: ["멀티탭 (채팅/문서/번역/분석)", "리전 폴백 로드밸런싱", "대화 로그 저장", "파일 업로드 분석"],
  },
] as const;

// ─── 채널 카드 컴포넌트 ─────────────────────────────────────
function ChannelCard({ channel }: { channel: (typeof AI_CHANNELS)[number] }) {
  const Icon = channel.icon;
  return (
    <Card className={`border ${channel.borderColor} hover:shadow-md transition-shadow`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${channel.bgColor} rounded-xl flex items-center justify-center`}>
              <Icon size={20} className={channel.iconColor} />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-gray-900">
                {channel.name} {channel.emoji}
              </CardTitle>
              <Badge className={`text-xs mt-0.5 ${channel.badgeClass}`} variant="outline">
                {channel.accessLevel}
              </Badge>
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${channel.statusColor}`}>
            {channel.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600 leading-relaxed">{channel.description}</p>

        {/* DB 매핑 정보 */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-gray-400 w-20 shrink-0">DB 키</span>
            <code className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono">
              {channel.dbAssistantKey}
            </code>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-400 w-20 shrink-0">프롬프트</span>
            <code className="text-gray-700 bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono text-[11px] break-all">
              {channel.promptFile}
            </code>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-400 w-20 shrink-0">라우팅</span>
            <code className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
              {channel.routePath}
            </code>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-400 w-20 shrink-0">크레딧</span>
            <span className="text-gray-700">{channel.creditPolicy}</span>
          </div>
        </div>

        {/* 주요 기능 태그 */}
        <div className="flex flex-wrap gap-1.5">
          {channel.features.map((feat) => (
            <span
              key={feat}
              className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"
            >
              {feat}
            </span>
          ))}
        </div>

        {/* 바로가기 링크 */}
        <div className="flex items-center gap-2 pt-1">
          <Link href={channel.routePath}>
            <span className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer">
              <ExternalLink size={11} />
              채널 바로가기
            </span>
          </Link>
          {channel.logPath !== channel.routePath && (
            <Link href={channel.logPath}>
              <span className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 cursor-pointer">
                <ExternalLink size={11} />
                로그 보기
              </span>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export default function AIChannelManagement() {
  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bot className="text-indigo-600" size={24} />
          AI 채널 관리
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          AI ERP의 모든 AI 채널 명칭·DB 매핑·프롬프트 키·라우팅 경로를 한눈에 확인합니다.
        </p>
      </div>

      {/* 명칭 체계 요약 */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">AI 채널 명칭 체계 원칙</p>
          <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
            <li>플랫폼 자체 명칭(AI ERP)과 테넌트 명칭(두골프) 혼용 금지</li>
            <li>로그 페이지 명칭 = 채널명 + " 로그" (예: 마스터AI 로그, AI파트너매니저 로그)</li>
            <li>AI파트너매니저·고객센터AI·AI상담톡은 무료 제공 (크레딧 차감 없음)</li>
            <li>개발 요청이 개별 업체 전용 기능으로 분류될 때만 비용 추정 후 파트너 동의 차감</li>
          </ul>
        </CardContent>
      </Card>

      {/* 채널 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {AI_CHANNELS.map((channel) => (
          <ChannelCard key={channel.id} channel={channel} />
        ))}
      </div>

      {/* DB 어시스턴트 키 매핑 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">DB 어시스턴트 키 매핑 테이블</CardTitle>
          <p className="text-xs text-gray-500">
            aiAssistantLogs 테이블의 <code className="bg-gray-100 px-1 rounded">assistant</code> 컬럼 값 기준
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">채널명</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">DB 키 값</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">접근 권한</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">로그 경로</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {AI_CHANNELS.map((ch) => (
                  <tr key={ch.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-800">
                      {ch.name} {ch.emoji}
                    </td>
                    <td className="py-2.5 px-3">
                      <code className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono text-xs">
                        {ch.dbAssistantKey}
                      </code>
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 text-xs">{ch.accessLevel}</td>
                    <td className="py-2.5 px-3">
                      <Link href={ch.logPath}>
                        <span className="text-blue-600 hover:underline text-xs cursor-pointer font-mono">
                          {ch.logPath}
                        </span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
