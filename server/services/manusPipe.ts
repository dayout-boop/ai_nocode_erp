/**
 * Manus 스마트 라우팅 파이프
 *
 * 개발 요청을 Manus API로 전송할 때 지능형 라우팅을 수행합니다.
 *
 * 라우팅 로직:
 *   1. 동일 모듈에 in_progress 상태의 기존 Manus Task가 있으면
 *      → task.sendMessage (기존 스레드에 추가, 크레딧 절약)
 *   2. 없거나 만료된 경우
 *      → task.create + project_id (두골프 프로젝트 내 신규 태스크)
 *
 * 환경변수:
 *   MANUS_API_KEY        - Manus API 인증 키
 *   MANUS_PROJECT_ID     - 두골프 전용 Manus 프로젝트 ID (task.create 시 사용)
 *   MANUS_DOGOLF_TASK_ID - 레거시 호환용 (미설정 시 무시)
 */
import { eq, and, isNotNull, desc } from "drizzle-orm";
import { getDb } from "../db";
import { devRequests } from "../../drizzle/schema";

const MANUS_API_BASE = "https://api.manus.ai/v2";

function getManusApiKey(): string {
  return process.env.MANUS_API_KEY ?? "";
}

function getManusProjectId(): string {
  // MANUS_PROJECT_ID 우선, 없으면 레거시 MANUS_DOGOLF_TASK_ID 사용
  return process.env.MANUS_PROJECT_ID ?? process.env.MANUS_DOGOLF_TASK_ID ?? "";
}

// ─── 타입 정의 ────────────────────────────────────────────────────────────────
export interface ManusRoutingResult {
  success: boolean;
  routingType: "new_task" | "send_message";
  routingReason: string;
  taskId?: string;
  taskUrl?: string;
  projectId?: string;
}

// ─── 기존 활성 태스크 조회 ────────────────────────────────────────────────────
/**
 * 동일 모듈에서 in_progress 상태의 가장 최근 Manus Task를 조회합니다.
 * 72시간 이내에 생성된 태스크만 재사용합니다 (너무 오래된 태스크는 컨텍스트 손실 위험).
 */
async function findActiveTaskForModule(module: string | null | undefined): Promise<{
  taskId: string;
  devRequestId: number;
} | null> {
  if (!module) return null;

  const db = await getDb();
  if (!db) return null;

  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72시간 전

  const rows = await db
    .select({
      id: devRequests.id,
      manusTaskId: devRequests.manusTaskId,
      createdAt: devRequests.createdAt,
    })
    .from(devRequests)
    .where(
      and(
        eq(devRequests.module, module),
        eq(devRequests.status, "in_progress"),
        isNotNull(devRequests.manusTaskId)
      )
    )
    .orderBy(desc(devRequests.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row || !row.manusTaskId) return null;

  // 72시간 이내 생성된 태스크만 재사용
  if (row.createdAt < cutoff) return null;

  return { taskId: row.manusTaskId, devRequestId: row.id };
}

// ─── task.sendMessage ─────────────────────────────────────────────────────────
async function sendMessageToExistingTask(
  taskId: string,
  message: string
): Promise<{ success: boolean }> {
  const apiKey = getManusApiKey();
  if (!apiKey) return { success: false };

  try {
    const res = await fetch(`${MANUS_API_BASE}/task.sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-manus-api-key": apiKey,
      },
      body: JSON.stringify({
        task_id: taskId,
        message: {
          content: [{ type: "text", text: message }],
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[ManusPipe] sendMessage 오류 [${res.status}]: ${errBody.slice(0, 300)}`);
      return { success: false };
    }

    const data = (await res.json()) as { ok: boolean };
    if (!data.ok) {
      console.error("[ManusPipe] sendMessage 응답 오류:", JSON.stringify(data));
      return { success: false };
    }

    console.log(`[ManusPipe] 기존 태스크(${taskId})에 메시지 추가 성공`);
    return { success: true };
  } catch (err) {
    console.error("[ManusPipe] sendMessage 실패:", err);
    return { success: false };
  }
}

// ─── task.create ─────────────────────────────────────────────────────────────
async function createNewTask(
  message: string,
  title: string
): Promise<{ success: boolean; taskId?: string; taskUrl?: string }> {
  const apiKey = getManusApiKey();
  if (!apiKey) {
    console.warn("[ManusPipe] MANUS_API_KEY가 설정되지 않았습니다.");
    return { success: false };
  }

  const projectId = getManusProjectId();

  try {
    const body: Record<string, unknown> = {
      message: {
        content: [{ type: "text", text: message }],
      },
      title,
    };

    // project_id가 있으면 두골프 프로젝트 내에 태스크 생성
    if (projectId) {
      body.project_id = projectId;
    }

    const res = await fetch(`${MANUS_API_BASE}/task.create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-manus-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[ManusPipe] task.create 오류 [${res.status}]: ${errBody.slice(0, 300)}`);
      return { success: false };
    }

    const data = (await res.json()) as { ok: boolean; task_id?: string; task_url?: string };
    if (!data.ok) {
      console.error("[ManusPipe] task.create 실패:", JSON.stringify(data));
      return { success: false };
    }

    console.log(`[ManusPipe] 신규 태스크 생성 성공: ${data.task_id} (project: ${projectId || "없음"})`);
    return { success: true, taskId: data.task_id, taskUrl: data.task_url };
  } catch (err) {
    console.error("[ManusPipe] task.create 실패:", err);
    return { success: false };
  }
}

// ─── 개발 요청 메시지 포맷 ────────────────────────────────────────────────────
function formatDevRequestMessage(req: {
  id: number;
  title: string;
  description: string;
  priority: string;
  module?: string | null;
  estimatedHours?: number | null;
  aiCategory?: string | null;
  aiAnalysis?: string | null;
  isFollowUp?: boolean;
  relatedDevRequestId?: number;
}): string {
  const followUpNote = req.isFollowUp
    ? `\n> ⚡ **추가 요청**: 동일 모듈(${req.module})의 기존 개발 스레드에 추가된 요청입니다. (관련 요청 ID: ${req.relatedDevRequestId})\n`
    : "";

  const aiNote = req.aiAnalysis
    ? `\n**AI 분석:**\n${req.aiAnalysis}\n`
    : "";

  return `# 두골프 ERP 개발 요청 [ID: ${req.id}]
${followUpNote}
**제목:** ${req.title}
**유형:** ${req.aiCategory ?? "미분류"}
**우선순위:** ${req.priority.toUpperCase()}
**대상 모듈:** ${req.module ?? "미지정"}
**예상 소요 시간:** ${req.estimatedHours ? `${req.estimatedHours}시간` : "미정"}
${aiNote}
**상세 설명:**
${req.description}

---
*두골프 AI 마스터가 자동 생성한 개발 요청입니다.*
*프로젝트: dogolf-tour-dkz3fsmp.manus.space (www.dayoutgolf.com)*

---
## 🛠️ 개발 환경 컨텍스트 (자동 주입)

**Manus WebDev 프로젝트:** dogolf
**소스 코드 경로:** /home/ubuntu/dogolf/
**기술 스택:** React 19 + Tailwind 4 + Express 4 + tRPC 11 + MySQL (Drizzle ORM) + TypeScript

**핵심 파일 위치:**
- 홈페이지 푸터: client/src/components/Footer.tsx
- 홈페이지 헤더: client/src/components/Header.tsx
- ERP 페이지: client/src/pages/erp/
- API 라우터: server/routers/
- DB 스키마: drizzle/schema.ts
- 전역 스타일: client/src/index.css

**개발 절차:**
1. 파일 수정 (file 도구 사용)
2. TypeScript 오류 확인: npx tsc --noEmit
3. 체크포인트 저장: webdev_save_checkpoint
4. Publish 안내`;
}

// ─── 스마트 라우팅 핵심 함수 ──────────────────────────────────────────────────
/**
 * 스마트 라우팅으로 Manus에 개발 요청을 전송합니다.
 *
 * 1. 동일 모듈의 활성 태스크 조회
 * 2. 있으면 → task.sendMessage (기존 스레드 추가)
 * 3. 없으면 → task.create + project_id (신규 태스크)
 */
export async function smartSendToManus(req: {
  id: number;
  title: string;
  description: string;
  priority: string;
  module?: string | null;
  estimatedHours?: number | null;
  aiCategory?: string | null;
  aiAnalysis?: string | null;
}): Promise<ManusRoutingResult> {
  const apiKey = getManusApiKey();
  if (!apiKey) {
    return {
      success: false,
      routingType: "new_task",
      routingReason: "MANUS_API_KEY 미설정",
    };
  }

  // 1. 동일 모듈 활성 태스크 조회
  const activeTask = await findActiveTaskForModule(req.module);

  if (activeTask) {
    // 2. 기존 태스크에 메시지 추가 (sendMessage)
    const message = formatDevRequestMessage({
      ...req,
      isFollowUp: true,
      relatedDevRequestId: activeTask.devRequestId,
    });

    const result = await sendMessageToExistingTask(activeTask.taskId, message);

    if (result.success) {
      return {
        success: true,
        routingType: "send_message",
        routingReason: `동일 모듈(${req.module}) 활성 태스크 재사용 (ID: ${activeTask.devRequestId})`,
        taskId: activeTask.taskId,
      };
    }
    // sendMessage 실패 시 신규 생성으로 폴백
    console.warn("[ManusPipe] sendMessage 실패, 신규 태스크 생성으로 폴백");
  }

  // 3. 신규 태스크 생성 (task.create + project_id)
  const message = formatDevRequestMessage(req);
  const title = `[두골프] ${req.aiCategory ?? "개발요청"}: ${req.title.slice(0, 60)}`;
  const result = await createNewTask(message, title);

  const projectId = getManusProjectId();
  const routingReason = activeTask
    ? `sendMessage 실패 후 신규 생성 (project: ${projectId || "없음"})`
    : `동일 모듈 활성 태스크 없음, 신규 생성 (project: ${projectId || "없음"})`;

  return {
    success: result.success,
    routingType: "new_task",
    routingReason,
    taskId: result.taskId,
    taskUrl: result.taskUrl,
    projectId: projectId || undefined,
  };
}

// ─── 단일 요청 전송 (UI "Manus에 전송" 버튼) ─────────────────────────────────
export async function sendSingleRequestToManus(devRequestId: number): Promise<{
  success: boolean;
  manusTaskId?: string;
  routingType?: string;
  routingReason?: string;
}> {
  const db = await getDb();
  if (!db) return { success: false };

  const [req] = await db.select().from(devRequests).where(eq(devRequests.id, devRequestId)).limit(1);
  if (!req) return { success: false };

  const result = await smartSendToManus({
    id: req.id,
    title: req.title,
    description: req.description,
    priority: req.priority,
    module: req.module,
    estimatedHours: req.estimatedHours,
    aiCategory: req.aiCategory,
    aiAnalysis: req.aiAnalysis,
  });

  if (result.success) {
    await db
      .update(devRequests)
      .set({
        manusTaskId: result.taskId ?? req.manusTaskId,
        manusProjectId: result.projectId ?? null,
        manusRoutingType: result.routingType,
        manusRoutingReason: result.routingReason,
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(eq(devRequests.id, devRequestId));
  }

  return {
    success: result.success,
    manusTaskId: result.taskId,
    routingType: result.routingType,
    routingReason: result.routingReason,
  };
}

// ─── pending 전체 일괄 전송 ───────────────────────────────────────────────────
export async function sendPendingRequestsToManus(): Promise<{
  sent: number;
  failed: number;
  results: Array<{
    id: number;
    success: boolean;
    manusTaskId?: string;
    routingType?: string;
    routingReason?: string;
  }>;
}> {
  const db = await getDb();
  if (!db) return { sent: 0, failed: 0, results: [] };

  const pendingRequests = await db
    .select()
    .from(devRequests)
    .where(eq(devRequests.status, "pending"))
    .limit(10);

  const results: Array<{
    id: number;
    success: boolean;
    manusTaskId?: string;
    routingType?: string;
    routingReason?: string;
  }> = [];
  let sent = 0;
  let failed = 0;

  for (const req of pendingRequests) {
    const result = await smartSendToManus({
      id: req.id,
      title: req.title,
      description: req.description,
      priority: req.priority,
      module: req.module,
      estimatedHours: req.estimatedHours,
      aiCategory: req.aiCategory,
      aiAnalysis: req.aiAnalysis,
    });

    if (result.success) {
      await db
        .update(devRequests)
        .set({
          manusTaskId: result.taskId ?? undefined,
          manusProjectId: result.projectId ?? null,
          manusRoutingType: result.routingType,
          manusRoutingReason: result.routingReason,
          status: "in_progress",
          updatedAt: new Date(),
        })
        .where(eq(devRequests.id, req.id));

      results.push({
        id: req.id,
        success: true,
        manusTaskId: result.taskId,
        routingType: result.routingType,
        routingReason: result.routingReason,
      });
      sent++;
    } else {
      results.push({ id: req.id, success: false });
      failed++;
    }

    // API rate limit 방지 (0.5초 간격)
    await new Promise((r) => setTimeout(r, 500));
  }

  return { sent, failed, results };
}

// ─── 자동 등록 + 스마트 전송 (두골프 마스터 AI 연동) ─────────────────────────
export async function autoRegisterAndSend(devRequest: {
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  module: string;
  estimatedHours: number;
  requestedBy?: number;
  aiCategory?: string;
  aiAnalysis?: string;
}): Promise<{
  devRequestId: number;
  manusTaskId: string;
  routingType: string;
  routingReason: string;
  success: boolean;
}> {
  const db = await getDb();
  if (!db) throw new Error("DB 연결 실패");

  // 1. dev_requests 테이블에 등록
  const [inserted] = await db
    .insert(devRequests)
    .values({
      title: devRequest.title,
      description: devRequest.description,
      priority: devRequest.priority,
      status: "pending",
      module: devRequest.module,
      estimatedHours: devRequest.estimatedHours,
      createdBy: devRequest.requestedBy,
      source: "master_ai",
      aiAnalyzed: true,
      aiCategory: devRequest.aiCategory,
      aiAnalysis: devRequest.aiAnalysis,
    })
    .$returningId();

  const devRequestId = inserted.id;

  // 2. Manus 스마트 라우팅으로 전송
  if (!getManusApiKey()) {
    console.warn("[ManusPipe] Manus API 설정 없음 - DB 등록만 완료");
    return { devRequestId, manusTaskId: "", routingType: "new_task", routingReason: "API 키 없음", success: false };
  }

  const result = await smartSendToManus({
    id: devRequestId,
    title: devRequest.title,
    description: devRequest.description,
    priority: devRequest.priority,
    module: devRequest.module,
    estimatedHours: devRequest.estimatedHours,
    aiCategory: devRequest.aiCategory,
    aiAnalysis: devRequest.aiAnalysis,
  });

  if (result.success) {
    await db
      .update(devRequests)
      .set({
        manusTaskId: result.taskId ?? undefined,
        manusProjectId: result.projectId ?? null,
        manusRoutingType: result.routingType,
        manusRoutingReason: result.routingReason,
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(eq(devRequests.id, devRequestId));
  }

  return {
    devRequestId,
    manusTaskId: result.taskId ?? "",
    routingType: result.routingType,
    routingReason: result.routingReason,
    success: result.success,
  };
}
