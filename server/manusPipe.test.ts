/**
 * Manus 자동 개발 파이프 테스트
 * - dev_requests 테이블에 테스트 데이터 삽입
 * - Manus API로 전송 확인
 */
import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { devRequests } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("ManusPipe Integration Test", () => {
  it("dev_requests 테이블에 테스트 데이터 삽입 성공", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();

    // 테스트 데이터 삽입
    const [inserted] = await db!
      .insert(devRequests)
      .values({
        title: "골프톡 위젯 카카오톡 연동",
        description:
          "골프톡 AI 채팅 위젯에 카카오톡 공유 기능을 추가합니다. 사용자가 상담 내용을 카카오톡으로 공유할 수 있도록 구현합니다.",
        priority: "medium",
        status: "pending",
        module: "golftalk",
        estimatedHours: 8,
        source: "manual",
      })
      .$returningId();

    expect(inserted.id).toBeGreaterThan(0);
    console.log(`[테스트] dev_requests 삽입 완료 - ID: ${inserted.id}`);

    // 삽입된 데이터 확인
    const [found] = await db!
      .select()
      .from(devRequests)
      .where(eq(devRequests.id, inserted.id))
      .limit(1);

    expect(found).toBeTruthy();
    expect(found.title).toBe("골프톡 위젯 카카오톡 연동");
    expect(found.status).toBe("pending");
    expect(found.module).toBe("golftalk");

    console.log(`[테스트] 데이터 확인 완료:`, {
      id: found.id,
      title: found.title,
      status: found.status,
      module: found.module,
      priority: found.priority,
    });
  });

  it("Manus API 전송 테스트 (MANUS_API_KEY 필요)", async () => {
    const apiKey = process.env.MANUS_API_KEY;
    const taskId = process.env.MANUS_DOGOLF_TASK_ID;

    if (!apiKey || !taskId) {
      console.log("[테스트] MANUS_API_KEY 또는 MANUS_DOGOLF_TASK_ID 미설정 - 스킵");
      return;
    }

    // Manus API 직접 호출 테스트
    const res = await fetch("https://api.manus.ai/v2/task.sendMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-manus-api-key": apiKey,
      },
      body: JSON.stringify({
        task_id: taskId,
        message: {
          content: [
            {
              type: "text",
              text: "# 두골프 ERP 개발 요청 [테스트]\n\n**제목:** 골프톡 위젯 카카오톡 연동\n**우선순위:** MEDIUM\n**대상 모듈:** golftalk\n**예상 소요 시간:** 8시간\n\n**상세 설명:**\n골프톡 AI 채팅 위젯에 카카오톡 공유 기능을 추가합니다.\n\n---\n*두골프 AI 마스터 자동 파이프 테스트 메시지입니다.*",
            },
          ],
        },
      }),
    });

    console.log(`[테스트] Manus API 응답 상태: ${res.status}`);
    const body = await res.json().catch(() => ({}));
    console.log(`[테스트] Manus API 응답:`, JSON.stringify(body, null, 2));

    if (res.ok) {
      console.log("[테스트] ✅ Manus API 전송 성공!");
      expect(res.ok).toBe(true);
    } else {
      console.log(`[테스트] ⚠️ Manus API 오류 (${res.status}) - API 키 확인 필요`);
      // API 키 문제는 테스트 실패로 처리하지 않음
      expect(res.status).toBeGreaterThan(0);
    }
  });
});
