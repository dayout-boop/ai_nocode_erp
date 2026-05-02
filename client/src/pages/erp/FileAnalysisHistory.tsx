/**
 * 파일 분석 히스토리 페이지
 * AI 엔진 > 파일 분석 목록 조회
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Image,
  File,
  Loader2,
  Search,
  Download,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const FILE_TYPE_ICON: Record<string, React.ReactNode> = {
  pdf: <FileText size={16} className="text-red-500" />,
  docx: <FileText size={16} className="text-blue-500" />,
  doc: <FileText size={16} className="text-blue-500" />,
  image: <Image size={16} className="text-green-500" />,
  text: <File size={16} className="text-gray-500" />,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  extracting: "추출 중",
  extracted: "추출 완료",
  analyzing: "분석 중",
  completed: "완료",
  error: "오류",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  extracting: "bg-yellow-100 text-yellow-700",
  extracted: "bg-blue-100 text-blue-700",
  analyzing: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-600",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number | Date | null) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface FileRecord {
  id: number;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  extractStatus: string;
  summary: string | null;
  analyzed: boolean;
  createdAt: Date;
  // 선택적 필드 (서버에서 내려즌 때 있을 수 있음)
  sessionId?: string | null;
  storageKey?: string | null;
  analysisResult?: string | null;
  extractedText?: string | null;
}

function FileRow({ file }: { file: FileRecord }) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();

  const deleteMutation = trpc.fileAnalysis.deleteFile.useMutation({
    onSuccess: () => {
      toast.success("파일이 삭제되었습니다.");
      utils.fileAnalysis.listBySession.invalidate();
    },
    onError: (err) => toast.error(`삭제 실패: ${err.message}`),
  });

  const downloadQuery = trpc.fileAnalysis.getDownloadUrl.useQuery(
    { id: file.id },
    { enabled: false }
  );

  const handleDownload = async () => {
    const result = await downloadQuery.refetch();
    if (result.data?.downloadUrl) {
      window.open(result.data.downloadUrl, "_blank");
    } else {
      toast.error("다운로드 URL을 가져올 수 없습니다.");
    }
  };

  // mimeType에서 파일 유형 파악
  const fileTypeKey = file.mimeType?.includes("pdf") ? "pdf"
    : file.mimeType?.includes("word") || file.mimeType?.includes("docx") ? "docx"
    : file.mimeType?.includes("image") ? "image"
    : "text";
  const icon = FILE_TYPE_ICON[fileTypeKey] ?? <File size={16} className="text-gray-400" />;
  const hasStorageKey = !!file.storageKey || !!file.fileUrl;

  return (
    <div className="border border-gray-100 rounded-xl bg-white hover:border-indigo-200 transition-colors">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{file.fileName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400">{file.fileSize ? formatBytes(file.fileSize) : "-"}</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400">{formatDate(file.createdAt)}</span>
            {file.sessionId && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-400 font-mono truncate max-w-[120px]">{file.sessionId}</span>
              </>
            )}
          </div>
        </div>
        <Badge className={`text-xs shrink-0 ${STATUS_COLORS[file.extractStatus] ?? "bg-gray-100 text-gray-600"}`}>
          {STATUS_LABELS[file.extractStatus] ?? file.extractStatus}
        </Badge>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setExpanded(!expanded)}
            title="상세 보기"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
          {hasStorageKey && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700"
              onClick={handleDownload}
              title="다운로드"
            >
              <Download size={14} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
            onClick={() => {
              if (confirm(`"${file.fileName}" 파일을 삭제하시겠습니까?`)) {
                deleteMutation.mutate({ id: file.id });
              }
            }}
            title="삭제"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50 rounded-b-xl">
          {file.summary && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                <Eye size={11} />
                AI 요약
              </p>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{file.summary}</p>
            </div>
          )}
          {file.analysisResult && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">분석 결과</p>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{file.analysisResult}</p>
            </div>
          )}
          {file.extractedText && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">추출 텍스트 (일부)</p>
              <p className="text-xs text-gray-500 leading-relaxed font-mono bg-white border border-gray-200 rounded-lg p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {file.extractedText.slice(0, 500)}{file.extractedText.length > 500 ? "..." : ""}
              </p>
            </div>
          )}
          {!file.summary && !file.analysisResult && !file.extractedText && (
            <p className="text-xs text-gray-400">분석 결과가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function FileAnalysisHistory() {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, isLoading, refetch } = trpc.fileAnalysis.listBySession.useQuery(
    { sessionId: undefined, limit },
    { refetchOnWindowFocus: false }
  );

  const files = (data?.files ?? []) as unknown as FileRecord[];
  const total = data?.files?.length ?? 0;

  const filtered = search
    ? files.filter((f) =>
        f.fileName.toLowerCase().includes(search.toLowerCase()) ||
        (f.summary ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : files;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={20} className="text-indigo-600" />
            파일 분석 히스토리
          </h1>
          <p className="text-sm text-gray-500 mt-1">AI가 분석한 파일 목록을 조회합니다.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="flex items-center gap-1.5"
        >
          <RefreshCw size={13} />
          새로고침
        </Button>
      </div>

      {/* 검색 */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="파일명 또는 요약 내용으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 text-sm"
        />
      </div>

      {/* 통계 배지 */}
      <div className="flex items-center gap-3 mb-4">
        <Badge variant="outline" className="text-xs">전체 {total}개</Badge>
        <Badge variant="outline" className="text-xs text-green-600 border-green-200">
          완료 {files.filter((f) => f.extractStatus === "completed").length}개
        </Badge>
        <Badge variant="outline" className="text-xs text-red-500 border-red-200">
          오류 {files.filter((f) => f.extractStatus === "error").length}개
        </Badge>
      </div>

      {/* 파일 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" />
          로딩 중...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">파일 분석 이력이 없습니다.</p>
          <p className="text-xs mt-1">두골프 마스터에서 파일을 첨부하여 분석을 시작하세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((file) => (
            <FileRow key={file.id} file={file} />
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {!search && total > limit && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            이전
          </Button>
          <span className="text-sm text-gray-500">
            {offset + 1}–{Math.min(offset + limit, total)} / {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
