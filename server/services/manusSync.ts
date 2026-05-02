/**
 * Manus Task 상태 폴링 기반 양방향 동기화 서비스 (300009)
 * - in_progress 상태의 개발 요청에 대해 Manus Task 상태를 주기적으로 확인
 * - Manus Task가 'stopped' 상태이면 ERP dev_requests 상태를 'completed'로 업데이트
 * - 5분 간격 폴링 (서버 시작 시 자동 실행)
 */
import { getDb } from "../db";
import { devRequests } from "../../drizzle/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { createAiNotification } from "../routers/aiNotifications";
import { publish } from "./realtimeEvents";

const MANUS_API_BASE = "https://api.manus.ai/v2";
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5분
let syncTimer: ReturnType<typeof setInterval> | null = null;

function getManusApiKey(): string {
  return process.env.MANUS_API_KEY ?? "";
}

/**
 * Manus Task의 최신 상태를 조회합니다.
 * task.listMessages를 통해 status_update 이벤트를 확인합니다.
 */
async function getManusTaskStatus(taskId: string): Promise<{
  agentStatus: "running" | "waiting" | "stopped" | "error" | "unknown";
  lastMessage?: string;
} | null> {
  const apiKey = getManusApiKey();
  if (!apiKey) return null;

  try {
    const url = new URL(`${MANUS_API_BASE}/task.listMessages`);
    url.searchParams.set("task_id", taskId);
    url.searchParams.set("order", "desc");
    url.searchParams.set("limit", "50");

    const res = await fetch(url.toString(), {
      headers: {
        "x-manus-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.warn(`[ManusSync] task.listMessages 오류 [${res.status}] taskId: ${taskId}`);
      return null;
    }

    const data = (await res.json()) as {
      ok: boolean;
      messages?: Array<{
        type: string;
        status_update?: {
          agent_status: string;
          status_detail?: unknown;
        };
        content?: Array<{ type: string; text?: string }>;
        assistant_message?: { content: string };
      }>;
    };

    if (!data.ok || !data.messages) return null;

    // status_update 이벤트에서 agent_status 추출
    let detectedStatus: "running" | "waiting" | "stopped" | "error" | null = null;
    for (const msg of data.messages) {
      if (msg.type === "status_update" && msg.status_update) {
        const agentStatus = msg.status_update.agent_status as string;
        if (agentStatus === "stopped" || agentStatus === "running" || agentStatus === "waiting" || agentStatus === "error") {
          detectedStatus = agentStatus as "running" | "waiting" | "stopped" | "error";
          break;
        }
      }
    }

    // assistant_message에서 최신 텍스트 추출 (완료 결과물용)
    let lastMessage: string | undefined;
    for (const msg of data.messages) {
      // 형식 1: assistant_message.content (문자열)
      if (msg.type === "assistant_message" && msg.assistant_message?.content) {
        lastMessage = msg.assistant_message.content.slice(0, 2000);
        break;
      }
      // 형식 2: content 배열에서 text 추출
      if (msg.type === "assistant_message" && msg.content) {
        const textContent = msg.content.find((c) => c.type === "text");
        if (textContent?.text) {
          lastMessage = textContent.text.slice(0, 2000);
          break;
        }
      }
    }

    if (detectedStatus) {
      return { agentStatus: detectedStatus, lastMessage };
    }

    // status_update 없이 assistant_message만 있으면 stopped로 간주
    if (lastMessage) {
      return { agentStatus: "stopped", lastMessage };
    }

    return { agentStatus: "unknown" };
  } catch (e) {
    console.error(`[ManusSync] getManusTaskStatus 오류 (taskId: ${taskId}):`, e);
    return null;
  }
}

/**
 * in_progress 상태의 모든 개발 요청에 대해 Manus Task 상태를 동기화합니다.
 */
export async function syncManusTaskStatuses(): Promise<{
  checked: number;
  completed: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) return { checked: 0, completed: 0, errors: 0 };

  const apiKey = getManusApiKey();
  if (!apiKey) {
    console.warn("[ManusSync] MANUS_API_KEY 미설정 - 동기화 건너뜀");
    return { checked: 0, completed: 0, errors: 0 };
  }

  // manusTaskId가 있는 in_progress 요청 조회
  const inProgressRequests = await db
    .select()
    .from(devRequests)
    .where(
      and(
        eq(devRequests.status, "in_progress"),
        isNotNull(devRequests.manusTaskId)
      )
    )
    .limit(20); // 한 번에 최대 20개 처리

  let checked = 0;
  let completed = 0;
  let errors = 0;

  for (const req of inProgressRequests) {
    if (!req.manusTaskId) continue;
    checked++;

    try {
      const taskStatus = await getManusTaskStatus(req.manusTaskId);
      if (!taskStatus) {
        errors++;
        continue;
      }

      // Manus Task가 완료(stopped)되면 ERP 상태 업데이트
      if (taskStatus.agentStatus === "stopped") {
        // Manus Task 완료 시 result 자동 저장 (300011: 전체 assistant 응답 저장)
        const resultText = taskStatus.lastMessage
          ? `[Manus 자동 수집 - ${new Date().toLocaleString('ko-KR')}]\n\n${taskStatus.lastMessage}`
          : null;
        await db
          .update(devRequests)
          .set({
            status: "completed",
            ...(resultText && !req.result ? { result: resultText } : {}),
            updatedAt: new Date(),
          })
          .where(eq(devRequests.id, req.id));

        completed++;
        console.log(`[ManusSync] 완료 동기화: devRequest #${req.id} (manusTask: ${req.manusTaskId})`);

        // 실시간 이벤트 발행
        publish("dev_request_completed", { id: req.id, title: req.title, source: "manus_sync" });

        // AI 알림 생성
        const priorityMap: Record<string, "critical" | "high" | "medium" | "low"> = {
          critical: "critical", high: "high", medium: "medium", low: "low",
        };
        createAiNotification({
          type: "dev_complete",
          title: `[Manus 동기화] 개발 완료: ${req.title}`,
          body: `Manus Task 완료 감지 → ERP 상태 자동 업데이트\n개발 요청 [ID: ${req.id}] '${req.title}'이(가) 완료되었습니다.`,
          devRequestId: req.id,
          actionUrl: "/erp/dev-requests",
          actionLabel: "개발 요청 목록 보기",
          priority: priorityMap[req.priority ?? "medium"] ?? "medium",
          source: "system",
        }).catch((e: unknown) => console.error("[ManusSync] 알림 생성 실패:", e));
      }

      // Manus Task가 오류 상태이면 로그만 기록 (상태는 유지)
      if (taskStatus.agentStatus === "error") {
        console.warn(`[ManusSync] Manus Task 오류 상태: devRequest #${req.id} (manusTask: ${req.manusTaskId})`);
        errors++;
      }

      // API rate limit 방지 (0.3초 간격)
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.error(`[ManusSync] 동기화 오류 (devRequest #${req.id}):`, e);
      errors++;
    }
  }

  if (checked > 0) {
    console.log(`[ManusSync] 동기화 완료: 확인=${checked}, 완료=${completed}, 오류=${errors}`);
  }

  return { checked, completed, errors };
}

/**
 * 주기적 폴링 시작 (서버 시작 시 호출)
 */
export function startManusSync(): void {
  if (syncTimer) {
    console.log("[ManusSync] 이미 실행 중");
    return;
  }

  console.log(`[ManusSync] 폴링 시작 (${POLL_INTERVAL_MS / 1000 / 60}분 간격)`);

  // 서버 시작 후 1분 뒤 첫 실행 (서버 안정화 대기)
  setTimeout(() => {
    syncManusTaskStatuses().catch((e) => console.error("[ManusSync] 초기 동기화 오류:", e));
  }, 60 * 1000);

  // 이후 5분 간격으로 반복
  syncTimer = setInterval(() => {
    syncManusTaskStatuses().catch((e) => console.error("[ManusSync] 주기 동기화 오류:", e));
  }, POLL_INTERVAL_MS);
}

/**
 * 폴링 중지
 */
export function stopManusSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log("[ManusSync] 폴링 중지");
  }
}
