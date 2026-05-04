/**
 * GitHub 연동 설정 페이지
 * AI 엔진 Phase 2: 저장소 연결 상태 확인 및 설정
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Github,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  GitBranch,
  Lock,
  Star,
  Code2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function GitHubSettings() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: connectionStatus, refetch: refetchConnection, isLoading: isLoadingConnection } =
    trpc.github.testConnection.useQuery(undefined, {
      retry: false,
    });

  const { data: repoInfo, refetch: refetchRepo, isLoading: isLoadingRepo } =
    trpc.github.getRepoInfo.useQuery(undefined, {
      enabled: connectionStatus?.ok === true,
      retry: false,
    });

  const { data: branches, isLoading: isLoadingBranches } =
    trpc.github.listBranches.useQuery(undefined, {
      enabled: connectionStatus?.ok === true,
      retry: false,
    });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchConnection();
      await refetchRepo();
      toast.success("연결 상태를 새로고침했습니다.");
    } catch {
      toast.error("새로고침 중 오류가 발생했습니다.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const isConnected = connectionStatus?.ok === true;
  const isLoading = isLoadingConnection || isRefreshing;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Github className="w-6 h-6" />
            GitHub 연동 설정
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            코드 히스토리 보관 및 중복 개발 방지를 위한 GitHub 저장소 연동
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      {/* 연결 상태 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            연결 상태
            {isLoading ? (
              <Badge variant="secondary" className="text-xs">확인 중...</Badge>
            ) : isConnected ? (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                연결됨
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                <XCircle className="w-3 h-3 mr-1" />
                연결 실패
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            GitHub Personal Access Token 및 저장소 연결 상태
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && !isConnected && (
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700">GitHub 연결에 실패했습니다</p>
                <p className="text-xs text-red-600 mt-1">
                  {connectionStatus?.error ?? "GITHUB_TOKEN 또는 저장소 정보를 확인해 주세요."}
                </p>
                <p className="text-xs text-red-500 mt-2">
                  ERP 관리자에게 문의하거나 Settings → Secrets에서 GITHUB_TOKEN을 확인하세요.
                </p>
              </div>
            </div>
          )}

          {isConnected && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">GITHUB_TOKEN</span>
                <span className="text-green-600 font-medium">유효</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">저장소 접근</span>
                <span className="text-green-600 font-medium">허용됨</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 저장소 정보 카드 */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              저장소 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingRepo ? (
              <div className="text-sm text-gray-500">저장소 정보 로딩 중...</div>
            ) : repoInfo ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{repoInfo.fullName}</h3>
                      {repoInfo.private && (
                        <Badge variant="secondary" className="text-xs">
                          <Lock className="w-3 h-3 mr-1" />
                          Private
                        </Badge>
                      )}
                    </div>
                    {repoInfo.description && (
                      <p className="text-sm text-gray-500 mt-1">{repoInfo.description}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a href={repoInfo.htmlUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      GitHub 열기
                    </a>
                  </Button>
                </div>

                <Separator />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center gap-1 text-gray-500 text-xs mb-1">
                      <GitBranch className="w-3 h-3" />
                      기본 브랜치
                    </div>
                    <div className="font-semibold text-sm text-gray-900">{repoInfo.defaultBranch}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center gap-1 text-gray-500 text-xs mb-1">
                      <Star className="w-3 h-3" />
                      Stars
                    </div>
                    <div className="font-semibold text-sm text-gray-900">{repoInfo.stargazersCount}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-gray-500 text-xs mb-1">언어</div>
                    <div className="font-semibold text-sm text-gray-900">{repoInfo.language ?? "N/A"}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-gray-500 text-xs mb-1">마지막 업데이트</div>
                    <div className="font-semibold text-sm text-gray-900">
                      {new Date(repoInfo.updatedAt).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* 브랜치 목록 */}
      {isConnected && branches && branches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              브랜치 목록
              <Badge variant="secondary" className="text-xs">{branches.length}개</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingBranches ? (
              <div className="text-sm text-gray-500">브랜치 목록 로딩 중...</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {branches.map((branch) => (
                  <Badge
                    key={branch.name}
                    variant={branch.name === repoInfo?.defaultBranch ? "default" : "outline"}
                    className="text-xs"
                  >
                    <GitBranch className="w-3 h-3 mr-1" />
                    {branch.name}
                    {branch.protected && (
                      <Lock className="w-3 h-3 ml-1 text-yellow-500" />
                    )}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 사용 안내 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-base text-blue-800">GitHub 연동 활용 방법</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 space-y-2">
          <p>
            <strong>코드 히스토리 뷰어</strong>에서 GitHub 커밋 이력을 조회하고 개발 요청과 연결할 수 있습니다.
          </p>
          <p>
            <strong>중복 개발 방지</strong>: 새 개발 요청 시 AI가 기존 코드를 검색하여 재사용 가능한 코드를 추천합니다.
          </p>
          <p>
            <strong>자동 연결</strong>: 개발 완료 처리 시 관련 커밋이 자동으로 개발 요청에 연결됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
