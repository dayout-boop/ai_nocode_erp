/**
 * 두골프-AI개발 엔진: AutoFixer
 * ─────────────────────────────────────────────────────────────────────────────
 * 수정 요청을 받아 AI가 실제 코드 수정 제안을 생성합니다.
 * 핵심 기능 수정 시에는 사용자 승인을 요구합니다.
 */

import { getDb } from "../db";
import { aiFixRequests, aiReviewResults } from "../../drizzle/schema";
import { orchestrate } from "./orchestrator";
import { eq } from "drizzle-orm";
import { CRITICAL_FILES } from "./errorWatcher";
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(process.cwd());

// ─── 파일 내용 읽기 (보안: 프로젝트 루트 내부만 허용) ────────────────────────
function safeReadFile(filePath: string): string | null {
  try {
    const absolutePath = path.resolve(PROJECT_ROOT, filePath);
    // 경로 탈출 방지
    if (!absolutePath.startsWith(PROJECT_ROOT)) return null;
    if (!fs.existsSync(absolutePath)) return null;
    const content = fs.readFileSync(absolutePath, "utf-8");
    // 최대 5000자만 읽기 (토큰 절약)
    return content.slice(0, 5000);
  } catch {
    return null;
  }
}

// ─── AI 코드 수정 제안 생성 ───────────────────────────────────────────────────
export async function generateFixCode(fixRequestId: number): Promise<{
  success: boolean;
  fixCode?: string;
  explanation?: string;
  error?: string;
}> {
  const db = await getDb();
  if (!db) return { success: false, error: "DB 연결 실패" };

  const [request] = await db.select().from(aiFixRequests).where(eq(aiFixRequests.id, fixRequestId));
  if (!request) return { success: false, error: "수정 요청을 찾을 수 없습니다." };

  // 핵심 파일 여부 확인
  const isCriticalFile = request.targetFile
    ? CRITICAL_FILES.some((cf) => request.targetFile!.includes(cf))
    : false;

  // 대상 파일 내용 읽기
  const fileContent = request.targetFile ? safeReadFile(request.targetFile) : null;

  const fixPrompt = `
두골프(DOGOLF) ERP 시스템의 다음 문제를 수정하는 코드를 생성해주세요.

**수정 요청 제목:** ${request.title}
**문제 설명:** ${request.description}
**대상 파일:** ${request.targetFile ?? "미지정"}
**대상 함수/컴포넌트:** ${request.targetFunction ?? "미지정"}
**우선순위:** ${request.priority}
**핵심 기능 여부:** ${isCriticalFile ? "예 (주의 필요)" : "아니오"}

${fileContent ? `**현재 파일 내용 (일부):**\n\`\`\`typescript\n${fileContent}\n\`\`\`` : ""}

다음 형식으로 응답해주세요:
1. **수정 코드**: 실제 수정이 필요한 코드 블록 (변경 전/후 diff 형식)
2. **수정 설명**: 무엇을 왜 수정했는지 설명
3. **주의사항**: 이 수정 적용 시 주의할 점

TypeScript/React 코드 표준을 준수하고, 기존 코드 스타일을 유지하세요.`;

  try {
    await db.update(aiFixRequests).set({ status: "in_review" }).where(eq(aiFixRequests.id, fixRequestId));

    const aiResult = await orchestrate(fixPrompt, {
      taskType: "code_review",
      systemPrompt: `당신은 두골프 ERP 시스템의 시니어 풀스택 개발자입니다.
기술 스택: React 19 + TypeScript + tRPC + Drizzle ORM + MySQL + Tailwind CSS
코드 수정 시 타입 안전성, 에러 핸들링, 성능을 고려하세요.
핵심 기능(결제, 인증, 예약) 수정 시 특히 신중하게 접근하세요.`,
      maxTokens: 2048,
      temperature: 0.2,
    });

    // 수정 코드 저장 (originalCode = 수정 전 파일 원본 코드)
    await db.update(aiFixRequests).set({
      originalCode: fileContent ?? "",
      aiFixCode: aiResult.text,
      aiFixExplanation: aiResult.text.slice(0, 500),
      status: request.isCritical || isCriticalFile ? "pending" : "in_review",
    }).where(eq(aiFixRequests.id, fixRequestId));

    return {
      success: true,
      fixCode: aiResult.text,
      explanation: aiResult.text.slice(0, 500),
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await db.update(aiFixRequests).set({ status: "failed" }).where(eq(aiFixRequests.id, fixRequestId));
    return { success: false, error: errMsg };
  }
}

// ─── ERP 기능 검색 (AI 기반) ──────────────────────────────────────────────────
export async function searchErpFeature(query: string): Promise<{
  features: Array<{
    name: string;
    description: string;
    file: string;
    route?: string;
  }>;
  aiSummary: string;
}> {
  // ERP 기능 목록 (정적 정의)
  const ERP_FEATURES = [
    { name: "예약 관리", description: "고객 예약 생성, 수정, 취소, 상태 변경", file: "client/src/pages/erp/Bookings.tsx", route: "/erp/bookings" },
    { name: "상품 관리", description: "골프 패키지 상품 등록, 수정, 삭제, 이미지 관리", file: "client/src/pages/erp/Packages.tsx", route: "/erp/packages" },
    { name: "결제 관리", description: "Stripe 결제 처리, 결제 이력 조회", file: "server/stripe.ts", route: "/erp/bookings" },
    { name: "카카오 알림톡", description: "예약 확정/취소 시 자동 알림톡 발송", file: "server/_core/kakao.ts" },
    { name: "Runway ML 동영상 생성", description: "상품 홍보 동영상 AI 자동 생성", file: "server/_core/runway.ts", route: "/erp/packages/:id" },
    { name: "AI 오케스트레이터", description: "다중 AI 모델 라우팅, 비용 최적화", file: "server/_core/orchestrator.ts", route: "/erp/ai-orchestrator" },
    { name: "두골프-AI개발 엔진", description: "자동 오류 감지, AI 수정 제안, 재검토 파이프라인", file: "client/src/pages/erp/AIDevEngine.tsx", route: "/erp/ai-dev-engine" },
    { name: "고객 관리", description: "고객 정보 조회, 예약 이력, VIP 관리", file: "client/src/pages/erp/Customers.tsx", route: "/erp/customers" },
    { name: "정산 관리", description: "공급사별 정산, 미지급 관리", file: "client/src/pages/erp/Settlements.tsx", route: "/erp/settlements" },
    { name: "문의 관리", description: "고객 문의 접수, 답변 처리", file: "client/src/pages/erp/Inquiries.tsx", route: "/erp/inquiries" },
    { name: "갤러리 관리", description: "사진 갤러리 업로드, 관리", file: "client/src/pages/erp/Gallery.tsx", route: "/erp/gallery" },
    { name: "공지사항 관리", description: "공지사항 작성, 수정, 삭제", file: "client/src/pages/erp/Notices.tsx", route: "/erp/notices" },
    { name: "대시보드", description: "예약 현황, 매출 통계, 주요 지표 요약", file: "client/src/pages/erp/Dashboard.tsx", route: "/erp/dashboard" },
  ];

  // 검색어로 필터링
  const queryLower = query.toLowerCase();
  const matched = ERP_FEATURES.filter((f) =>
    f.name.toLowerCase().includes(queryLower) ||
    f.description.toLowerCase().includes(queryLower) ||
    f.file.toLowerCase().includes(queryLower)
  );

  // AI 요약 생성
  const summaryPrompt = `두골프 ERP에서 "${query}"에 대해 검색했습니다. 
관련 기능: ${matched.map((f) => f.name).join(", ") || "없음"}
이 기능들에 대해 간단히 설명하고, 어떻게 활용할 수 있는지 2-3문장으로 안내해주세요.`;

  const aiResult = await orchestrate(summaryPrompt, {
    taskType: "text_summary",
    maxTokens: 256,
    temperature: 0.5,
  });

  return {
    features: matched.length > 0 ? matched : ERP_FEATURES,
    aiSummary: aiResult.text,
  };
}
