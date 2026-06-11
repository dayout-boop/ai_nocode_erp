/**
 * AI 상품 자동생성 파이프라인 워커 [Phase 3]
 * 파일 분석 결과 → AI 상품 초안 생성 → packages 테이블 저장 (approvalStatus='pending')
 *
 * 큐 방식: 인메모리 큐 (Map<jobId, AiPackageJob>)
 * 파트너 담당자가 파일을 업로드하면 jobId를 받고, 폴링으로 진행 상태를 확인한다.
 */
import { getDb } from "../db";
import { fileAnalysis, packages } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export type AiJobStatus = "queued" | "extracting" | "generating" | "saving" | "done" | "failed";

export interface AiPackageJob {
  jobId: string;
  tenantId: number | null;
  fileAnalysisId: number;
  requestedBy: number;
  status: AiJobStatus;
  progress: number; // 0~100
  message: string;
  result?: GeneratedPackageDraft;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GeneratedPackageDraft {
  title: string;
  country: string;
  region: string;
  duration: string;
  roundCount: number;
  description: string;
  highlights: string[];
  includes: string[];
  excludes: string[];
  packageId?: number; // DB 저장 후 채워짐
}

// ─── 인메모리 큐 ──────────────────────────────────────────────────────────────

const jobQueue = new Map<string, AiPackageJob>();

/** 만료된 잡 정리 (1시간 이상 된 잡 제거) */
function cleanupExpiredJobs() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  Array.from(jobQueue.entries()).forEach(([id, job]) => {
    if (job.createdAt < oneHourAgo) {
      jobQueue.delete(id);
    }
  });
}

// 10분마다 만료 잡 정리
setInterval(cleanupExpiredJobs, 10 * 60 * 1000);

// ─── 잡 생성 ──────────────────────────────────────────────────────────────────

export function createJob(params: {
  fileAnalysisId: number;
  tenantId: number | null;
  requestedBy: number;
}): string {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: AiPackageJob = {
    jobId,
    tenantId: params.tenantId,
    fileAnalysisId: params.fileAnalysisId,
    requestedBy: params.requestedBy,
    status: "queued",
    progress: 0,
    message: "대기 중...",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobQueue.set(jobId, job);
  // 비동기로 워커 실행 (블로킹 없이)
  runJob(jobId).catch(err => {
    const j = jobQueue.get(jobId);
    if (j) {
      j.status = "failed";
      j.error = err instanceof Error ? err.message : String(err);
      j.updatedAt = Date.now();
    }
  });
  return jobId;
}

// ─── 잡 조회 ──────────────────────────────────────────────────────────────────

export function getJob(jobId: string): AiPackageJob | undefined {
  return jobQueue.get(jobId);
}

export function listJobsByTenant(tenantId: number | null): AiPackageJob[] {
  return Array.from(jobQueue.values())
    .filter(job => job.tenantId === tenantId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ─── 잡 실행 워커 ─────────────────────────────────────────────────────────────

async function runJob(jobId: string): Promise<void> {
  const job = jobQueue.get(jobId);
  if (!job) return;

  const updateJob = (patch: Partial<AiPackageJob>) => {
    const j = jobQueue.get(jobId);
    if (j) {
      Object.assign(j, patch, { updatedAt: Date.now() });
    }
  };

  try {
    // Step 1: 파일 분석 레코드 조회
    updateJob({ status: "extracting", progress: 10, message: "파일 분석 데이터 로딩 중..." });

    const db = await getDb();
    if (!db) throw new Error("DB 연결 실패");

    const [record] = await db
      .select()
      .from(fileAnalysis)
      .where(eq(fileAnalysis.id, job.fileAnalysisId))
      .limit(1);

    if (!record) throw new Error("파일 분석 레코드를 찾을 수 없습니다.");
    if (record.extractStatus !== "done" || !record.extractedText) {
      throw new Error("파일 텍스트 추출이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.");
    }

    updateJob({ progress: 25, message: "파일 내용 분석 완료. AI 상품 초안 생성 중..." });

    // Step 2: LLM으로 상품 초안 생성
    updateJob({ status: "generating", progress: 35, message: "AI가 상품 정보를 추출하고 있습니다..." });

    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `당신은 두골프 골프투어 여행사의 상품 기획 전문가입니다.
첨부된 파일(견적서, 일정표, 안내문 등)을 분석하여 ERP에 등록할 골프 패키지 상품 정보를 JSON 형식으로 추출해 주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{
  "title": "상품명 (예: 태국 방콕 3박5일 골프 패키지)",
  "country": "국가명 (예: 태국, 베트남, 필리핀, 일본, 중국, 대한민국)",
  "region": "지역명 (예: 방콕, 파타야, 다낭)",
  "duration": "기간 (예: 3박5일, 4박6일)",
  "roundCount": 라운딩 횟수 (숫자, 예: 2),
  "description": "상품 설명 (200자 내외, 한국어)",
  "highlights": ["하이라이트1", "하이라이트2", "하이라이트3"],
  "includes": ["포함사항1", "포함사항2"],
  "excludes": ["불포함사항1", "불포함사항2"]
}

파일에서 정보를 찾을 수 없는 경우 합리적인 기본값을 사용하세요.`,
        },
        {
          role: "user",
          content: `파일명: ${record.fileName}\n파일 요약: ${record.summary ?? "없음"}\n\n파일 내용:\n${record.extractedText.slice(0, 6000)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "package_draft",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              country: { type: "string" },
              region: { type: "string" },
              duration: { type: "string" },
              roundCount: { type: "integer" },
              description: { type: "string" },
              highlights: { type: "array", items: { type: "string" } },
              includes: { type: "array", items: { type: "string" } },
              excludes: { type: "array", items: { type: "string" } },
            },
            required: ["title", "country", "region", "duration", "roundCount", "description", "highlights", "includes", "excludes"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = llmResponse?.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== "string") {
      throw new Error("AI 응답을 파싱할 수 없습니다.");
    }

    const draft: GeneratedPackageDraft = JSON.parse(rawContent);
    updateJob({ progress: 70, message: "상품 초안 생성 완료. DB에 저장 중..." });

    // Step 3: packages 테이블에 저장 (approvalStatus='pending')
    updateJob({ status: "saving", progress: 80, message: "상품 초안을 DB에 저장 중..." });

    const [inserted] = await db
      .insert(packages)
      .values({
        title: draft.title,
        country: draft.country,
        region: draft.region,
        duration: draft.duration,
        roundCount: draft.roundCount,
        description: draft.description,
        status: "draft",
        tenantId: job.tenantId,
        aiGeneratedFrom: record.id,
        approvalStatus: "pending",
      })
      .$returningId();

    draft.packageId = inserted.id;

    updateJob({
      status: "done",
      progress: 100,
      message: `상품 초안이 생성되었습니다. (ID: ${inserted.id}) 파트너 대표의 승인을 기다립니다.`,
      result: draft,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateJob({
      status: "failed",
      progress: 0,
      message: `오류 발생: ${message}`,
      error: message,
    });
  }
}
