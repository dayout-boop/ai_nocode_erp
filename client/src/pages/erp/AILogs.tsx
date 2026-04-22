import { useState } from "react";
import ERPLayout from "@/components/ERPLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  MessageSquare,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const LIMIT = 15;

export default function AILogs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading, isError, refetch } = trpc.aiLogs.list.useQuery({
    page,
    limit: LIMIT,
    search: search || undefined,
  });

  const deleteMutation = trpc.aiLogs.delete.useMutation({
    onSuccess: () => {
      toast.success("로그가 삭제되었습니다.");
      utils.aiLogs.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <ERPLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
              <MessageSquare size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">AI 대화 로그</h1>
              <p className="text-sm text-slate-500">Gemini AI와의 대화 내역을 확인합니다.</p>
            </div>
          </div>
          <Badge variant="outline" className="text-slate-500 border-slate-300">
            총 {total.toLocaleString()}건
          </Badge>
        </div>

        {/* 검색 */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="질문 내용으로 검색..."
              className="pl-9 bg-white border-slate-200"
            />
          </div>
          <Button type="submit" variant="default" size="sm" className="bg-indigo-600 hover:bg-indigo-700">
            검색
          </Button>
          {search && (
            <Button type="button" variant="outline" size="sm" onClick={handleClearSearch}>
              초기화
            </Button>
          )}
        </form>

        {/* 로그 목록 */}
        {isError ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-10 flex flex-col items-center gap-3 text-red-500">
              <p className="text-sm font-medium">데이터를 불러오는 중 오류가 발생했습니다.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="text-red-600 border-red-300">
                다시 시도
              </Button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <Card className="border-dashed border-slate-200">
            <CardContent className="py-16 flex flex-col items-center gap-3 text-slate-400">
              <Sparkles size={32} className="opacity-40" />
              <p className="text-sm font-medium">
                {search ? `"${search}" 검색 결과가 없습니다.` : "아직 AI 대화 로그가 없습니다."}
              </p>
              <p className="text-xs">Gemini AI 어시스턴트와 대화하면 자동으로 저장됩니다.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const isExpanded = expandedId === log.id;
              return (
                <Card key={log.id} className="border-slate-200 hover:border-indigo-200 transition-colors">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          <User size={13} className="text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 leading-relaxed line-clamp-2">
                            {log.query}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Clock size={11} />
                              {new Date(log.createdAt).toLocaleString("ko-KR", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {log.userName && (
                              <span className="text-xs text-slate-400">{log.userName}</span>
                            )}
                            <Badge className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-600 border-purple-200">
                              {log.modelName ?? "gemini-2.5-flash"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600"
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>로그 삭제</AlertDialogTitle>
                              <AlertDialogDescription>
                                이 대화 로그를 삭제하시겠습니까? 삭제된 로그는 복구할 수 없습니다.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-500 hover:bg-red-600"
                                onClick={() => deleteMutation.mutate({ id: log.id })}
                              >
                                삭제
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>

                  {/* 응답 펼치기 */}
                  {isExpanded && (
                    <CardContent className="px-5 pb-4 pt-0">
                      <div className="mt-2 border-t border-slate-100 pt-3">
                        <div className="flex items-start gap-2">
                          <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                            <Sparkles size={12} className="text-white" />
                          </div>
                          <div className="flex-1 bg-indigo-50 rounded-xl p-3">
                            <p className="text-xs font-semibold text-indigo-700 mb-1.5">Gemini 응답</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                              {log.response}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft size={14} />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "outline"}
                    size="sm"
                    className={`h-8 w-8 p-0 text-xs ${page === pageNum ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </div>
    </ERPLayout>
  );
}
