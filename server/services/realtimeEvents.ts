/**
 * 실시간 이벤트 브로커 (SSE 기반)
 *
 * 서버 측 이벤트 발행(publish) 및 클라이언트 구독(subscribe) 관리.
 * 파이프라인 실행 결과, 개발 요청 상태 변경, AI 대화 이력 생성 등
 * 주요 이벤트를 즉시 클라이언트에 푸시하여 폴링 지연을 제거합니다.
 */

import type { Response } from "express";

// ─── 이벤트 타입 정의 ──────────────────────────────────────────────────────────

export type RealtimeEventType =
  | "dev_request_created"    // 개발 요청 신규 등록
  | "dev_request_updated"    // 개발 요청 상태 변경 (in_progress, completed, rejected)
  | "dev_request_completed"  // 개발 요청 완료
  | "ai_log_created"         // AI 대화 이력 저장 완료
  | "pipeline_done"          // 파이프라인 실행 완료
  | "notification_created"   // 알림 생성
  | "scheduled_task_done"    // 예약 작업 완료
  | "approval_requested"     // 승인 요청 생성
  | "approval_resolved"      // 승인 요청 처리 완료
  | "heartbeat"             // 연결 유지용 핑
  | "migration_completed";   // 마이그레이션 완료

export interface RealtimeEvent {
  type: RealtimeEventType;
  data: Record<string, unknown>;
  timestamp: number;
}

// ─── 구독자 관리 ───────────────────────────────────────────────────────────────

interface Subscriber {
  id: string;
  userId: number;
  res: Response;
  connectedAt: number;
}

const subscribers = new Map<string, Subscriber>();

// ─── 구독자 등록 / 해제 ────────────────────────────────────────────────────────

export function subscribe(subscriberId: string, userId: number, res: Response): void {
  // SSE 헤더 설정
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // nginx 버퍼링 비활성화
  res.flushHeaders();

  // 연결 확인 이벤트 즉시 전송
  sendToClient(res, {
    type: "heartbeat",
    data: { message: "connected", subscriberId },
    timestamp: Date.now(),
  });

  subscribers.set(subscriberId, {
    id: subscriberId,
    userId,
    res,
    connectedAt: Date.now(),
  });

  console.log(`[realtimeEvents] 구독자 연결: ${subscriberId} (userId=${userId}), 총 ${subscribers.size}명`);

  // 클라이언트 연결 종료 시 구독 해제
  res.on("close", () => {
    unsubscribe(subscriberId);
  });
}

export function unsubscribe(subscriberId: string): void {
  if (subscribers.has(subscriberId)) {
    subscribers.delete(subscriberId);
    console.log(`[realtimeEvents] 구독자 해제: ${subscriberId}, 총 ${subscribers.size}명`);
  }
}

// ─── 이벤트 발행 ───────────────────────────────────────────────────────────────

/**
 * 모든 구독자에게 이벤트 브로드캐스트
 */
export function publish(type: RealtimeEventType, data: Record<string, unknown>): void {
  if (subscribers.size === 0) return;

  const event: RealtimeEvent = {
    type,
    data,
    timestamp: Date.now(),
  };

  let sent = 0;
  const toRemove: string[] = [];

  for (const [id, sub] of Array.from(subscribers)) {
    try {
      sendToClient(sub.res, event);
      sent++;
    } catch (err) {
      console.warn(`[realtimeEvents] 전송 실패 (${id}):`, err);
      toRemove.push(id);
    }
  }

  // 전송 실패한 구독자 정리
  for (const id of toRemove) {
    subscribers.delete(id);
  }

  if (sent > 0) {
    console.log(`[realtimeEvents] 이벤트 발행: ${type} → ${sent}명`);
  }
}

/**
 * 특정 사용자에게만 이벤트 전송
 */
export function publishToUser(userId: number, type: RealtimeEventType, data: Record<string, unknown>): void {
  const event: RealtimeEvent = {
    type,
    data,
    timestamp: Date.now(),
  };

  for (const [id, sub] of Array.from(subscribers)) {
    if (sub.userId === userId) {
      try {
        sendToClient(sub.res, event);
      } catch (err) {
        console.warn(`[realtimeEvents] 사용자 전송 실패 (${id}):`, err);
        subscribers.delete(id);
      }
    }
  }
}

// ─── SSE 포맷 전송 ─────────────────────────────────────────────────────────────

function sendToClient(res: Response, event: RealtimeEvent): void {
  const data = JSON.stringify(event);
  res.write(`event: ${event.type}\ndata: ${data}\n\n`);
  // Node.js HTTP 응답 버퍼 즉시 플러시
  if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
    (res as unknown as { flush: () => void }).flush();
  }
}

// ─── 하트비트 (연결 유지) ──────────────────────────────────────────────────────

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat(intervalMs = 25_000): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    if (subscribers.size > 0) {
      publish("heartbeat", { ts: Date.now() });
    }
  }, intervalMs);
  console.log("[realtimeEvents] 하트비트 시작 (25초 간격)");
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ─── 구독자 통계 ───────────────────────────────────────────────────────────────

export function getStats(): { count: number; subscribers: { id: string; userId: number; connectedAt: number }[] } {
  return {
    count: subscribers.size,
    subscribers: Array.from(subscribers.values()).map(s => ({
      id: s.id,
      userId: s.userId,
      connectedAt: s.connectedAt,
    })),
  };
}
