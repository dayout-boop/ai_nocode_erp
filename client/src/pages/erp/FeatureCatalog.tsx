/**
 * FeatureCatalog.tsx
 * AI ERP 기능 카탈로그 — /erp/ai-engine/features
 * - 카테고리별 그룹핑 테이블
 * - 검색 / 카테고리 필터 / 상태 필터
 * - 보고서 보기 (마크다운 렌더) + MD 다운로드
 * - 관리자 전용 새로고침 버튼
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  RefreshCw, Download, FileText, Search, LayoutList, BookOpen,
  CheckCircle2, Clock, CalendarClock, ChevronDown, ChevronRight,
} from "lucide-react";

// ─── 타입 ────────────────────────────────────────────────────────────────────
interface Feature {
  id: string;
  name: string;
  category: string;
  status: "done" | "in_progress" | "planned";
  description: string;
  module?: string;
  route?: string;
  since?: string;
  updatedAt?: string;
  tags?: string[];
}

// ─── 상태 배지 ────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "done") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
        <CheckCircle2 size={11} /> 완료
      </Badge>
    );
  }
  if (status === "in_progress") {
    return (
      <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1">
        <Clock size={11} /> 진행중
      </Badge>
    );
  }
  return (
    <Badge className="bg-gray-100 text-gray-600 border-gray-200 gap-1">
      <CalendarClock size={11} /> 예정
    </Badge>
  );
}

// ─── 카테고리 색상 ────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  "AI 엔진 관리": "bg-violet-50 border-violet-200 text-violet-700",
  "AI 챗봇": "bg-purple-50 border-purple-200 text-purple-700",
  "AI 마스터": "bg-indigo-50 border-indigo-200 text-indigo-700",
  "DevAI": "bg-cyan-50 border-cyan-200 text-cyan-700",
  "ERP-상품관리": "bg-green-50 border-green-200 text-green-700",
  "ERP-예약관리": "bg-teal-50 border-teal-200 text-teal-700",
  "ERP-자금/정산": "bg-yellow-50 border-yellow-200 text-yellow-700",
  "ERP-CRM": "bg-orange-50 border-orange-200 text-orange-700",
  "ERP-CMS": "bg-pink-50 border-pink-200 text-pink-700",
  "ERP-대시보드": "bg-sky-50 border-sky-200 text-sky-700",
  "ERP-설정": "bg-slate-50 border-slate-200 text-slate-700",
  "ERP-기타": "bg-gray-50 border-gray-200 text-gray-600",
  "DB": "bg-amber-50 border-amber-200 text-amber-700",
  "고객 홈페이지": "bg-lime-50 border-lime-200 text-lime-700",
  "외부연동-결제": "bg-rose-50 border-rose-200 text-rose-700",
  "외부연동-카카오": "bg-yellow-50 border-yellow-200 text-yellow-700",
  "외부연동-미디어": "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700",
  "외부연동-자동화": "bg-emerald-50 border-emerald-200 text-emerald-700",
  "외부연동-Slack": "bg-red-50 border-red-200 text-red-700",
};

function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category] ?? "bg-gray-50 border-gray-200 text-gray-600";
  return <Badge variant="outline" className={`text-xs ${cls}`}>{category}</Badge>;
}

// ─── 카테고리 그룹 테이블 ─────────────────────────────────────────────────────
function CategoryGroup({ category, features }: { category: string; features: Feature[] }) {
  const [open, setOpen] = useState(true);
  const doneCount = features.filter((f) => f.status === "done").length;

  return (
    <div className="border border-border rounded-lg overflow-hidden mb-3">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="font-semibold text-sm">{category}</span>
          <CategoryBadge category={category} />
        </div>
        <span className="text-xs text-muted-foreground">
          {doneCount}/{features.length} 완료
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground w-[200px]">기능명</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground w-[80px]">상태</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">설명</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground w-[90px]">모듈</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground w-[90px]">수정일</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr
                  key={f.id}
                  className={`border-b border-border/50 last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                >
                  <td className="px-4 py-2.5 font-medium">{f.name}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={f.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs leading-relaxed">{f.description}</td>
                  <td className="px-4 py-2.5">
                    {f.module && (
                      <Badge variant="outline" className="text-xs">{f.module}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{f.updatedAt ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 마크다운 렌더 (간단 버전) ────────────────────────────────────────────────
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="prose prose-sm max-w-none text-foreground">
      {lines.map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold mt-6 mb-3">{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-semibold mt-5 mb-2 border-b pb-1">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-4 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("> ")) return <blockquote key={i} className="border-l-4 border-muted pl-3 text-muted-foreground italic my-2">{line.slice(2)}</blockquote>;
        if (line.startsWith("---")) return <hr key={i} className="my-4 border-border" />;
        if (line.startsWith("| ")) {
          // 테이블 행 — 간단 렌더
          const cells = line.split("|").filter((c) => c.trim() !== "");
          if (cells.every((c) => /^[-: ]+$/.test(c))) return null; // 구분선 행 스킵
          return (
            <div key={i} className="flex gap-0 text-xs border-b border-border/50">
              {cells.map((c, j) => (
                <div key={j} className="flex-1 px-2 py-1 min-w-[80px]">{c.trim()}</div>
              ))}
            </div>
          );
        }
        if (line.startsWith("- ")) return <li key={i} className="ml-4 list-disc text-sm">{line.slice(2)}</li>;
        if (line === "") return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function FeatureCatalog() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "done" | "in_progress" | "planned">("all");
  const [activeTab, setActiveTab] = useState("catalog");

  // 기능 목록 조회
  const { data, isLoading, refetch } = trpc.features.list.useQuery({
    category: categoryFilter === "all" ? undefined : categoryFilter,
    status: statusFilter,
    search: search || undefined,
  });

  // 보고서 조회
  const { data: reportData, isLoading: reportLoading } = trpc.features.getReport.useQuery(
    undefined,
    { enabled: activeTab === "report" }
  );

  // CHANGELOG 조회
  const { data: changelogData, isLoading: changelogLoading } = trpc.features.getChangelog.useQuery(
    undefined,
    { enabled: activeTab === "changelog" }
  );

  // 새로고침 뮤테이션 (관리자 전용)
  const refreshMutation = trpc.features.refresh.useMutation({
    onSuccess: (result) => {
      toast.success(`기능 목록 갱신 완료 — ${result.totalCount}개 항목`);
      refetch();
    },
    onError: (err) => {
      toast.error(`갱신 실패: ${err.message}`);
    },
  });

  // 카테고리별 그룹핑
  const grouped = useMemo(() => {
    const features: Feature[] = data?.features ?? [];
    const map: Record<string, Feature[]> = {};
    for (const f of features) {
      if (!map[f.category]) map[f.category] = [];
      map[f.category].push(f);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  // MD 다운로드
  function downloadMd(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 통계
  const doneCount = (data?.features ?? []).filter((f: Feature) => f.status === "done").length;
  const inProgressCount = (data?.features ?? []).filter((f: Feature) => f.status === "in_progress").length;
  const plannedCount = (data?.features ?? []).filter((f: Feature) => f.status === "planned").length;

  return (
      <div className="p-6 space-y-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <LayoutList size={20} className="text-violet-500" />
              기능 카탈로그
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI ERP 전체 기능 목록 — 소스 코드 자동 집계
              {data?.generatedAt && (
                <span className="ml-2 text-xs text-amber-600">
                  (마지막 스캔: {new Date(data.generatedAt).toLocaleString("ko-KR")} · 최신 반영은 소스 재스캔 버튼을 눌러주세요)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                className="gap-1.5"
              >
                <RefreshCw size={14} className={refreshMutation.isPending ? "animate-spin" : ""} />
                소스 재스캔
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => reportData?.markdown && downloadMd(reportData.markdown, `dogolf-report-${new Date().toISOString().split("T")[0]}.md`)}
              className="gap-1.5"
            >
              <Download size={14} />
              MD 다운로드
            </Button>
          </div>
        </div>

        {/* KPI 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "전체 기능", value: data?.allCount ?? 0, color: "text-foreground" },
            { label: "완료", value: doneCount, color: "text-emerald-600" },
            { label: "진행중", value: inProgressCount, color: "text-blue-600" },
            { label: "예정", value: plannedCount, color: "text-gray-500" },
          ].map((item) => (
            <Card key={item.label} className="py-3">
              <CardContent className="p-0 text-center">
                <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 탭 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="catalog" className="gap-1.5">
              <LayoutList size={14} /> 기능 목록
            </TabsTrigger>
            <TabsTrigger value="report" className="gap-1.5">
              <FileText size={14} /> 보고서
            </TabsTrigger>
            <TabsTrigger value="changelog" className="gap-1.5">
              <BookOpen size={14} /> 변경 이력
            </TabsTrigger>
          </TabsList>

          {/* ── 기능 목록 탭 ── */}
          <TabsContent value="catalog" className="mt-4 space-y-4">
            {/* 필터 바 */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="기능명, 설명, 태그 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 text-sm w-[160px]">
                  <SelectValue placeholder="카테고리" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 카테고리</SelectItem>
                  {(data?.categories ?? []).map((cat: string) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="h-8 text-sm w-[120px]">
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  <SelectItem value="done">완료</SelectItem>
                  <SelectItem value="in_progress">진행중</SelectItem>
                  <SelectItem value="planned">예정</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-1">
                {data?.totalCount ?? 0}개 표시
              </span>
            </div>

            {/* 카테고리별 그룹 */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <RefreshCw size={18} className="animate-spin mr-2" /> 로딩 중...
              </div>
            ) : grouped.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground text-sm">
                검색 결과가 없습니다.
              </div>
            ) : (
              grouped.map(([cat, items]) => (
                <CategoryGroup key={cat} category={cat} features={items} />
              ))
            )}
          </TabsContent>

          {/* ── 보고서 탭 ── */}
          <TabsContent value="report" className="mt-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">AI ERP 현황 보고서</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reportData?.markdown && downloadMd(reportData.markdown, `dogolf-report-${new Date().toISOString().split("T")[0]}.md`)}
                  className="gap-1.5"
                >
                  <Download size={13} /> MD 다운로드
                </Button>
              </CardHeader>
              <CardContent>
                {reportLoading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <RefreshCw size={16} className="animate-spin mr-2" /> 보고서 생성 중...
                  </div>
                ) : (
                  <SimpleMarkdown text={reportData?.markdown ?? ""} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 변경 이력 탭 ── */}
          <TabsContent value="changelog" className="mt-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">CHANGELOG</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => changelogData?.markdown && downloadMd(changelogData.markdown, "CHANGELOG.md")}
                  className="gap-1.5"
                >
                  <Download size={13} /> MD 다운로드
                </Button>
              </CardHeader>
              <CardContent>
                {changelogLoading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <RefreshCw size={16} className="animate-spin mr-2" /> 로딩 중...
                  </div>
                ) : (
                  <SimpleMarkdown text={changelogData?.markdown ?? ""} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}
