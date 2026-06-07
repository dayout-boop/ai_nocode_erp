/**
 * 이미지 아카이브 관리 페이지 [ID: 600001]
 * - Google Drive에 저장된 이미지 파일 목록 조회 및 삭제
 * - 기간/출처 필터, 체크박스 다중 선택, 일괄 삭제
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Trash2,
  RefreshCw,
  ExternalLink,
  FileImage,
  Database,
  CheckSquare,
  Square,
  Filter,
  BarChart3,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SOURCE_LABELS: Record<string, string> = {
  kakaowork: "카카오워크",
  manual: "수동 등록",
  api: "API",
  all: "전체",
};

export default function ImageArchive() {
  const [page, setPage] = useState(1);
  const [source, setSource] = useState("all");
  const [isDeletedFilter, setIsDeletedFilter] = useState<string>("false");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const limit = 50;

  const queryInput = useMemo(() => ({
    source: source === "all" ? undefined : source,
    isDeleted: isDeletedFilter === "all" ? undefined : isDeletedFilter === "true",
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    limit,
  }), [source, isDeletedFilter, startDate, endDate, page, limit]);

  const { data, isLoading, refetch } = trpc.imageArchive.list.useQuery(queryInput);
  const { data: stats, refetch: refetchStats } = trpc.imageArchive.getStats.useQuery();

  const deleteMutation = trpc.imageArchive.deleteFiles.useMutation({
    onSuccess: (result) => {
      toast.success("삭제 완료", { description: result.message });
      setSelectedIds([]);
      refetch();
      refetchStats();
    },
    onError: (err) => {
      toast.error("삭제 실패", { description: err.message });
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const allSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id));
  const someSelected = selectedIds.length > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const toggleItem = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    deleteMutation.mutate({ ids: selectedIds });
    setShowDeleteDialog(false);
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">이미지 아카이브 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            Google Drive에 저장된 이미지 파일을 관리하고 삭제합니다
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { refetch(); refetchStats(); }}
          className="gap-2"
        >
          <RefreshCw size={14} />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-blue-500" />
                <div>
                  <p className="text-xs text-gray-500">전체 파일</p>
                  <p className="text-xl font-bold">{stats.total.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <FileImage size={16} className="text-green-500" />
                <div>
                  <p className="text-xs text-gray-500">보관 중</p>
                  <p className="text-xl font-bold text-green-600">{stats.active.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Trash2 size={16} className="text-red-400" />
                <div>
                  <p className="text-xs text-gray-500">삭제됨</p>
                  <p className="text-xl font-bold text-red-500">{stats.deleted.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-purple-500" />
                <div>
                  <p className="text-xs text-gray-500">출처별</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {stats.bySource.map((s) => (
                      <Badge key={s.source} variant="secondary" className="text-xs">
                        {SOURCE_LABELS[s.source] ?? s.source}: {s.cnt}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 필터 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter size={14} />
            필터
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Select value={source} onValueChange={(v) => { setSource(v); setPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="출처" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 출처</SelectItem>
                <SelectItem value="kakaowork">카카오워크</SelectItem>
                <SelectItem value="manual">수동 등록</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>

            <Select value={isDeletedFilter} onValueChange={(v) => { setIsDeletedFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="false">보관 중</SelectItem>
                <SelectItem value="true">삭제됨</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="w-36"
                placeholder="시작일"
              />
              <span className="text-gray-400 text-sm">~</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-36"
                placeholder="종료일"
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSource("all");
                setIsDeletedFilter("false");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
            >
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 액션 바 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            {allSelected ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} />}
            전체 선택
          </button>
          {someSelected && (
            <span className="text-sm text-blue-600 font-medium">
              {selectedIds.length}개 선택됨
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            총 {total.toLocaleString()}개
          </span>
          {someSelected && isDeletedFilter !== "true" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="gap-2"
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={14} />
              {selectedIds.length}개 삭제
            </Button>
          )}
        </div>
      </div>

      {/* 파일 목록 테이블 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="w-10 px-3 py-3 text-left">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-700">파일명</th>
              <th className="px-3 py-3 text-left font-medium text-gray-700 hidden md:table-cell">출처</th>
              <th className="px-3 py-3 text-left font-medium text-gray-700 hidden lg:table-cell">크기</th>
              <th className="px-3 py-3 text-left font-medium text-gray-700 hidden lg:table-cell">처리일시</th>
              <th className="px-3 py-3 text-left font-medium text-gray-700">상태</th>
              <th className="px-3 py-3 text-left font-medium text-gray-700">링크</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                  로딩 중...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  <FileImage size={32} className="mx-auto mb-2 opacity-30" />
                  <p>데이터가 없습니다</p>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b hover:bg-gray-50 transition-colors ${
                    item.isDeleted ? "opacity-50 bg-gray-50" : ""
                  } ${selectedIds.includes(item.id) ? "bg-blue-50" : ""}`}
                >
                  <td className="px-3 py-3">
                    {!item.isDeleted && (
                      <Checkbox
                        checked={selectedIds.includes(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-gray-900 truncate max-w-xs" title={item.fileName}>
                      {item.fileName}
                    </div>
                    {item.sourceDetail && (
                      <div className="text-xs text-gray-400 mt-0.5 truncate">{item.sourceDetail}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    <Badge variant="outline" className="text-xs">
                      {SOURCE_LABELS[item.source] ?? item.source}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell text-gray-500">
                    {formatFileSize(item.fileSize)}
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell text-gray-500 text-xs">
                    {formatDate(item.processedAt)}
                  </td>
                  <td className="px-3 py-3">
                    {item.isDeleted ? (
                      <div>
                        <Badge variant="destructive" className="text-xs">삭제됨</Badge>
                        {item.deletedAt && (
                          <div className="text-xs text-gray-400 mt-0.5">{formatDate(item.deletedAt)}</div>
                        )}
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">보관 중</Badge>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <a
                      href={item.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 inline-flex items-center gap-1"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            이전
          </Button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            다음
          </Button>
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>파일 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 <strong>{selectedIds.length}개</strong> 파일을 Google Drive에서 삭제합니다.
              <br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
