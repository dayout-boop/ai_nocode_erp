/**
 * GitHub 코드 히스토리 뷰어
 * AI 엔진 Phase 2: 커밋 이력 조회 및 개발 요청 연결
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GitCommit,
  ExternalLink,
  Search,
  GitBranch,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileCode,
  PlusCircle,
  MinusCircle,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

export default function GitHubHistory() {
  const [page, setPage] = useState(1);
  const [branch, setBranch] = useState("main");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkCommitSha, setLinkCommitSha] = useState("");
  const [linkDevRequestId, setLinkDevRequestId] = useState("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailSha, setDetailSha] = useState("");

  const { data: branches } = trpc.github.listBranches.useQuery(undefined, { retry: false });

  const { data: commits, isLoading: isLoadingCommits, refetch } = trpc.github.listCommits.useQuery(
    { branch, perPage: 20, page },
    { retry: false }
  );

  const { data: searchResults, isLoading: isSearching } = trpc.github.searchCode.useQuery(
    { query: searchQuery, perPage: 10 },
    { enabled: searchQuery.length >= 2, retry: false }
  );

  const { data: commitDetail, isLoading: isLoadingDetail } = trpc.github.getCommitDetail.useQuery(
    { sha: detailSha },
    { enabled: detailSha.length === 40 && detailDialogOpen, retry: false }
  );

  const linkMutation = trpc.github.linkCommit.useMutation({
    onSuccess: () => {
      toast.success("커밋이 개발 요청에 연결되었습니다.");
      setLinkDialogOpen(false);
      setLinkCommitSha("");
      setLinkDevRequestId("");
    },
    onError: (err) => {
      toast.error(err.message ?? "연결에 실패했습니다.");
    },
  });

  const handleSearch = () => {
    if (searchInput.trim().length < 2) {
      toast.error("검색어를 2자 이상 입력해 주세요.");
      return;
    }
    setSearchQuery(searchInput.trim());
  };

  const handleLinkSubmit = () => {
    const devReqId = parseInt(linkDevRequestId);
    if (!linkCommitSha || linkCommitSha.length !== 40) {
      toast.error("유효한 커밋 SHA(40자)를 입력해 주세요.");
      return;
    }
    if (!devReqId || isNaN(devReqId)) {
      toast.error("유효한 개발 요청 ID를 입력해 주세요.");
      return;
    }
    linkMutation.mutate({ commitSha: linkCommitSha, devRequestId: devReqId });
  };

  const openDetailDialog = (sha: string) => {
    setDetailSha(sha);
    setDetailDialogOpen(true);
  };

  const openLinkDialog = (sha?: string) => {
    if (sha) setLinkCommitSha(sha);
    setLinkDialogOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const shortSha = (sha: string) => sha.substring(0, 7);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitCommit className="w-6 h-6" />
            코드 히스토리
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            GitHub 커밋 이력 조회 및 개발 요청 연결
          </p>
        </div>
        <Button size="sm" onClick={() => openLinkDialog()}>
          <Link2 className="w-4 h-4 mr-2" />
          커밋 연결
        </Button>
      </div>

      {/* 코드 검색 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4" />
            코드 검색 (중복 개발 방지)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="함수명, 컴포넌트명, 키워드 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              <Search className="w-4 h-4 mr-2" />
              검색
            </Button>
          </div>

          {searchQuery && (
            <div className="mt-4">
              {isSearching ? (
                <div className="text-sm text-gray-500">검색 중...</div>
              ) : searchResults ? (
                <div>
                  <div className="text-sm text-gray-600 mb-3">
                    <strong>{searchResults.totalCount}</strong>개 결과 (최대 10개 표시)
                  </div>
                  {searchResults.items.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-4">
                      검색 결과가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.items.map((item) => (
                        <div
                          key={item.sha}
                          className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border"
                        >
                          <FileCode className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {item.path}
                              </span>
                            </div>
                            {item.textMatches && item.textMatches[0] && (
                              <pre className="text-xs text-gray-500 mt-1 overflow-hidden text-ellipsis whitespace-pre-wrap line-clamp-2">
                                {item.textMatches[0].fragment}
                              </pre>
                            )}
                          </div>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={item.htmlUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 커밋 목록 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <GitCommit className="w-4 h-4" />
              커밋 이력
            </CardTitle>
            <Select value={branch} onValueChange={(v) => { setBranch(v); setPage(1); }}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <GitBranch className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((b) => (
                  <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                )) ?? (
                  <SelectItem value="main">main</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingCommits ? (
            <div className="text-sm text-gray-500 text-center py-8">커밋 이력 로딩 중...</div>
          ) : !commits || commits.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-8">커밋이 없습니다.</div>
          ) : (
            <div className="space-y-1">
              {commits.map((commit) => (
                <div
                  key={commit.sha}
                  className={`flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer ${
                    selectedCommit === commit.sha ? "bg-blue-50 border-blue-200" : ""
                  }`}
                  onClick={() => setSelectedCommit(selectedCommit === commit.sha ? null : commit.sha)}
                >
                  <GitCommit className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-blue-600">
                        {shortSha(commit.sha)}
                      </code>
                      <span className="text-sm text-gray-900 truncate flex-1">
                        {commit.message.split("\n")[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{commit.author.name}</span>
                      <span>{formatDate(commit.author.date)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={(e) => { e.stopPropagation(); openDetailDialog(commit.sha); }}
                    >
                      <FileCode className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={(e) => { e.stopPropagation(); openLinkDialog(commit.sha); }}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                      <a href={commit.htmlUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoadingCommits}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              이전
            </Button>
            <span className="text-sm text-gray-500">페이지 {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!commits || commits.length < 20 || isLoadingCommits}
            >
              다음
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 커밋 상세 다이얼로그 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCommit className="w-4 h-4" />
              커밋 상세
            </DialogTitle>
          </DialogHeader>
          {isLoadingDetail ? (
            <div className="text-sm text-gray-500 py-4">로딩 중...</div>
          ) : commitDetail ? (
            <div className="space-y-4">
              <div>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-blue-600">
                  {commitDetail.sha}
                </code>
                <p className="text-sm font-medium mt-2">{commitDetail.message}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{commitDetail.author.name}</span>
                  <span>{formatDate(commitDetail.author.date)}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-gray-600">
                  <FileCode className="w-4 h-4" />
                  {commitDetail.filesChanged}개 파일
                </span>
                <span className="flex items-center gap-1 text-green-600">
                  <PlusCircle className="w-4 h-4" />
                  +{commitDetail.additions}
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <MinusCircle className="w-4 h-4" />
                  -{commitDetail.deletions}
                </span>
              </div>

              {commitDetail.files && commitDetail.files.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">변경된 파일</h4>
                  {commitDetail.files.map((file) => (
                    <div key={file.filename} className="text-xs border rounded p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-gray-800">{file.filename}</span>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              file.status === "added" ? "default" :
                              file.status === "removed" ? "destructive" : "secondary"
                            }
                            className="text-xs"
                          >
                            {file.status === "added" ? "추가" :
                             file.status === "removed" ? "삭제" :
                             file.status === "modified" ? "수정" : file.status}
                          </Badge>
                          <span className="text-green-600">+{file.additions}</span>
                          <span className="text-red-600">-{file.deletions}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>닫기</Button>
            {commitDetail && (
              <Button asChild>
                <a href={commitDetail.htmlUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  GitHub에서 보기
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 커밋 연결 다이얼로그 */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              커밋 - 개발 요청 연결
            </DialogTitle>
            <DialogDescription>
              GitHub 커밋을 개발 요청(Dev Request)과 연결하여 코드 히스토리를 보관합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">커밋 SHA (40자)</label>
              <Input
                placeholder="예: a1b2c3d4e5f6..."
                value={linkCommitSha}
                onChange={(e) => setLinkCommitSha(e.target.value)}
                className="mt-1 font-mono text-sm"
                maxLength={40}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">개발 요청 ID</label>
              <Input
                placeholder="예: 123"
                value={linkDevRequestId}
                onChange={(e) => setLinkDevRequestId(e.target.value)}
                className="mt-1"
                type="number"
              />
              <p className="text-xs text-gray-500 mt-1">
                DevAI 페이지에서 개발 요청 ID를 확인할 수 있습니다.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>취소</Button>
            <Button
              onClick={handleLinkSubmit}
              disabled={linkMutation.isPending}
            >
              {linkMutation.isPending ? "연결 중..." : "연결"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
