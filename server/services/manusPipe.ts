/**
 * Manus 자동 개발 파이프
 *
 * dev_requests 테이블의 pending 요청을 Manus API로 자동 전송합니다.
 * 두골프 마스터 AI가 개발 요청을 감지했을 때 자동 등록 + 전송합니다.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { devRequests } from "../../drizzle/schema";

const MANUS_API_BASE = "https://api.manus.ai/v2";

function getManusApiKey(): string {
  return process.env.MANUS_API_KEY ?? "";
}

function getManusTaskId(): string {
  return process.env.MANUS_DOGOLF_TASK_ID ?? "";
}

/**
 * Manus API로 새 태스크 생성 (task.create)
 * task.sendMessage는 기존 태스크에 메시지 추가용이므로,
 * 개발 요청은 독립 태스크로 생성하는 것이 올바른 방식
 */
async function sendToManus(_taskId: string, message: string): Promise<{ success: boolean; taskId?: string }> {
  const apiKey = getManusApiKey();
  if (!apiKey) {
    console.warn("[ManusPipe] MANUS_API_KEY가 설정되지 않았습니다.");
    return { success: false };
  }

  try {
    // task.create: 독립 태스크로 개발 요청 전송
    const res = await fetch(`${MANUS_API_BASE}/task.create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-manus-api-key": apiKey,
      },
      body: JSON.stringify({
        message: {
          content: [{ type: "text", text: message }],
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[ManusPipe] API 오류 [${res.status}]: ${errBody.slice(0, 300)}`);
      return { success: false };
    }

    const data = (await res.json()) as { ok: boolean; task_id?: string; task_url?: string };
    if (!data.ok) {
      console.error("[ManusPipe] task.create 실패:", JSON.stringify(data));
      return { success: false };
    }
    console.log(`[ManusPipe] 태스크 생성 성공: ${data.task_id} - ${data.task_url}`);
    return { success: true, taskId: data.task_id };
  } catch (err) {
    console.error("[ManusPipe] 전송 실패:", err);
    return { success: false };
  }
}

/**
 * 개발 요청을 Manus 전송용 메시지로 포맷
 */
function formatDevRequestMessage(req: {
  id: number;
  title: string;
  description: string;
  priority: string;
  module?: string | null;
  estimatedHours?: number | null;
}): string {
  return `# 두골프 ERP 개발 요청 [ID: ${req.id}]

**제목:** ${req.title}
**우선순위:** ${req.priority.toUpperCase()}
**대상 모듈:** ${req.module ?? "미지정"}
**예상 소요 시간:** ${req.estimatedHours ? `${req.estimatedHours}시간` : "미정"}

**상세 설명:**
${req.description}

---
*두골프 AI 마스터가 자동 생성한 개발 요청입니다.*`;
}

/**
 * pending 상태의 개발 요청을 Manus API로 자동 전송
 */
export async function sendPendingRequestsToManus(): Promise<{
  sent: number;
  failed: number;
  results: Array<{ id: number; success: boolean; manusTaskId?: string }>;
}> {
  const db = await getDb();
  if (!db) return { sent: 0, failed: 0, results: [] };

  const taskId = getManusTaskId();
  if (!taskId) {
    console.warn("[ManusPipe] MANUS_DOGOLF_TASK_ID가 설정되지 않았습니다.");
    return { sent: 0, failed: 0, results: [] };
  }

  // source가 master_ai이고 pending인 요청만 처리
  const pendingRequests = await db
    .select()
    .from(devRequests)
    .where(eq(devRequests.status, "pending"))
    .limit(10);

  const results: Array<{ id: number; success: boolean; manusTaskId?: string }> = [];
  let sent = 0;
  let failed = 0;

  for (const req of pendingRequests) {
    const message = formatDevRequestMessage({
      id: req.id,
      title: req.title,
      description: req.description,
      priority: req.priority,
      module: req.module,
      estimatedHours: req.estimatedHours,
    });

    const result = await sendToManus(taskId, message);

    if (result.success) {
      // manus_task_id 업데이트, status를 in_progress로 변경
      await db
        .update(devRequests)
        .set({
          manusTaskId: result.taskId ?? taskId,
          status: "in_progress",
          updatedAt: new Date(),
        })
        .where(eq(devRequests.id, req.id));

      results.push({ id: req.id, success: true, manusTaskId: result.taskId });
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

/**
 * 두골프 마스터 AI가 개발 요청을 감지했을 때 자동 등록 + Manus 전송
 */
export async function autoRegisterAndSend(devRequest: {
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  module: string;
  estimatedHours: number;
  requestedBy?: number;
}): Promise<{ devRequestId: number; manusTaskId: string; success: boolean }> {
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
    })
    .$returningId();

  const devRequestId = inserted.id;

  // 2. Manus API로 전송
  const taskId = getManusTaskId();
  if (!taskId || !getManusApiKey()) {
    console.warn("[ManusPipe] Manus API 설정 없음 - DB 등록만 완료");
    return { devRequestId, manusTaskId: "", success: false };
  }

  const message = formatDevRequestMessage({
    id: devRequestId,
    title: devRequest.title,
    description: devRequest.description,
    priority: devRequest.priority,
    module: devRequest.module,
    estimatedHours: devRequest.estimatedHours,
  });

  const result = await sendToManus(taskId, message);

  if (result.success) {
    await db
      .update(devRequests)
      .set({
        manusTaskId: result.taskId ?? taskId,
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(eq(devRequests.id, devRequestId));
  }

  return {
    devRequestId,
    manusTaskId: result.taskId ?? taskId,
    success: result.success,
  };
}

/**
 * 단일 개발 요청을 Manus로 수동 전송 (UI에서 "Manus에 전송" 버튼)
 */
export async function sendSingleRequestToManus(devRequestId: number): Promise<{
  success: boolean;
  manusTaskId?: string;
}> {
  const db = await getDb();
  if (!db) return { success: false };

  const [req] = await db.select().from(devRequests).where(eq(devRequests.id, devRequestId)).limit(1);
  if (!req) return { success: false };

  const taskId = getManusTaskId();
  if (!taskId) return { success: false };

  const message = formatDevRequestMessage({
    id: req.id,
    title: req.title,
    description: req.description,
    priority: req.priority,
    module: req.module,
    estimatedHours: req.estimatedHours,
  });

  const result = await sendToManus(taskId, message);

  if (result.success) {
    await db
      .update(devRequests)
      .set({
        manusTaskId: result.taskId ?? taskId,
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(eq(devRequests.id, devRequestId));
  }

  return { success: result.success, manusTaskId: result.taskId };
}
