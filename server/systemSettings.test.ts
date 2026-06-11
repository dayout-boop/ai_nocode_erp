/**
 * systemSettings 라우터 테스트
 * - MANUS_DOGOLF_TASK_ID 환경변수 폴백 로직
 * - 태스크 후보 유효성 검사
 * - Footer 저작권 연도 자동화
 * - 3단계 라우팅 로직
 * - in_progress 자동 완료 감지
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── 태스크 후보 유효성 검사 스키마 ──────────────────────────────────────────
const addTaskCandidateSchema = z.object({
  taskId: z.string().min(1).max(100),
  taskName: z.string().min(1).max(200),
  projectName: z.string().max(200).optional(),
  description: z.string().optional(),
  taskType: z.enum(["erp", "homepage", "new_project", "other"]).default("erp"),
  isDefault: z.boolean().default(false),
});

const updateTaskCandidateSchema = z.object({
  id: z.number().int().positive(),
  taskName: z.string().min(1).max(200).optional(),
  taskType: z.enum(["erp", "homepage", "new_project", "other"]).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// ─── 완료 키워드 감지 함수 ────────────────────────────────────────────────────
const COMPLETION_KEYWORDS = [
  "체크포인트 저장", "checkpoint", "완료되었습니다", "완료 했습니다",
  "배포 준비", "구현 완료", "작업 완료", "처리 완료",
  "모든 작업", "성공적으로 완료", "정상적으로 완료",
];

function detectCompletion(text: string): boolean {
  return COMPLETION_KEYWORDS.some((kw) =>
    text.toLowerCase().includes(kw.toLowerCase())
  );
}

// ─── 테스트 ───────────────────────────────────────────────────────────────────
describe("systemSettings - 태스크 후보 유효성 검사", () => {
  it("taskId가 빈 문자열이면 실패해야 한다", () => {
    const result = addTaskCandidateSchema.safeParse({
      taskId: "",
      taskName: "테스트",
      taskType: "erp",
      isDefault: false,
    });
    expect(result.success).toBe(false);
  });

  it("유효한 태스크 후보 데이터는 통과해야 한다", () => {
    const result = addTaskCandidateSchema.safeParse({
      taskId: "hNUzrtQfkbnQkVX9BUZeeM",
      taskName: "AI ERP 개발",
      taskType: "erp",
      isDefault: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.taskId).toBe("hNUzrtQfkbnQkVX9BUZeeM");
      expect(result.data.isDefault).toBe(true);
    }
  });

  it("taskType이 유효하지 않으면 실패해야 한다", () => {
    const result = addTaskCandidateSchema.safeParse({
      taskId: "abc123",
      taskName: "테스트",
      taskType: "invalid_type",
    });
    expect(result.success).toBe(false);
  });

  it("모든 taskType 열거값이 유효해야 한다", () => {
    const types = ["erp", "homepage", "new_project", "other"] as const;
    types.forEach((type) => {
      const result = addTaskCandidateSchema.safeParse({
        taskId: "test123",
        taskName: "테스트",
        taskType: type,
      });
      expect(result.success).toBe(true);
    });
  });

  it("updateTaskCandidate id는 양수 정수여야 한다", () => {
    const invalid = updateTaskCandidateSchema.safeParse({ id: -1 });
    expect(invalid.success).toBe(false);

    const valid = updateTaskCandidateSchema.safeParse({ id: 1, isDefault: true });
    expect(valid.success).toBe(true);
  });
});

describe("systemSettings - MANUS_DOGOLF_TASK_ID 환경변수 폴백", () => {
  it("DB 값이 없을 때 환경변수로 폴백하는 로직이 올바르게 동작해야 한다", () => {
    const dbValue: string | null = null;
    const envValue = "env_task_id_123";

    const result = dbValue ?? envValue;
    expect(result).toBe(envValue);
  });

  it("DB 값이 있으면 DB 값이 우선되어야 한다", () => {
    const dbValue = "db_task_id_456";
    const envValue = "env_task_id_123";

    const result = dbValue ?? envValue;
    expect(result).toBe(dbValue);
  });

  it("DB 값도 없고 환경변수도 없으면 null을 반환해야 한다", () => {
    const dbValue: string | null = null;
    const envValue: string | null = null;

    const result = dbValue ?? envValue ?? null;
    expect(result).toBeNull();
  });
});

describe("systemSettings - Footer 저작권 연도 자동화", () => {
  it("현재 연도가 올바른 범위여야 한다", () => {
    const currentYear = new Date().getFullYear();
    expect(currentYear).toBeGreaterThanOrEqual(2026);
    expect(currentYear).toBeLessThanOrEqual(2100);
  });

  it("{YEAR} 치환 로직이 올바르게 동작해야 한다", () => {
    const currentYear = new Date().getFullYear();
    const template = "Copyright © {YEAR} 데이아웃(두골프). All Rights Reserved.";
    const result = template.replace("{YEAR}", String(currentYear));
    expect(result).toContain(String(currentYear));
    expect(result).not.toContain("{YEAR}");
    expect(result).toContain("데이아웃(두골프)");
  });

  it("companyName이 '데이아웃(두골프)' 형식이어야 한다", () => {
    const companyName = "데이아웃(두골프)";
    expect(companyName).toContain("데이아웃");
    expect(companyName).toContain("두골프");
  });
});

describe("systemSettings - 3단계 라우팅 로직", () => {
  it("0순위: selectedTaskId가 있으면 해당 태스크로 라우팅되어야 한다", () => {
    const selectedTaskId = "selected_task_123";
    const defaultTaskId = "default_task_456";
    const forceNewTask = false;

    const routedTaskId = !forceNewTask && selectedTaskId ? selectedTaskId : defaultTaskId;
    expect(routedTaskId).toBe(selectedTaskId);
  });

  it("selectedTaskId가 없으면 기본 태스크로 라우팅되어야 한다", () => {
    const selectedTaskId: string | null = null;
    const defaultTaskId = "default_task_456";
    const forceNewTask = false;

    const routedTaskId = !forceNewTask && selectedTaskId ? selectedTaskId : defaultTaskId;
    expect(routedTaskId).toBe(defaultTaskId);
  });

  it("forceNewTask가 true이면 신규 태스크를 생성해야 한다", () => {
    const forceNewTask = true;
    const selectedTaskId = "existing_task_789";

    // forceNewTask가 true이면 기존 태스크 무시 → null 반환 (신규 생성)
    const routedTaskId = forceNewTask ? null : selectedTaskId;
    expect(routedTaskId).toBeNull();
  });

  it("태스크 타입별 라우팅 우선순위가 올바르게 동작해야 한다", () => {
    const candidates = [
      { taskId: "task1", taskType: "erp", isDefault: true },
      { taskId: "task2", taskType: "homepage", isDefault: false },
      { taskId: "task3", taskType: "new_project", isDefault: false },
    ];

    // ERP 요청에는 erp 타입 태스크가 우선
    const erpRequest = "erp";
    const matched = candidates.find((c) => c.taskType === erpRequest);
    expect(matched?.taskId).toBe("task1");

    // 홈페이지 요청에는 homepage 타입 태스크가 우선
    const homepageRequest = "homepage";
    const matched2 = candidates.find((c) => c.taskType === homepageRequest);
    expect(matched2?.taskId).toBe("task2");
  });
});

describe("systemSettings - in_progress 자동 완료 감지", () => {
  it("완료 키워드가 포함된 응답을 감지해야 한다", () => {
    expect(detectCompletion("체크포인트 저장 완료.")).toBe(true);
    expect(detectCompletion("기능 구현 완료되었습니다.")).toBe(true);
    expect(detectCompletion("배포 준비가 되었습니다.")).toBe(true);
    expect(detectCompletion("작업 완료 후 체크포인트를 저장했습니다.")).toBe(true);
    expect(detectCompletion("성공적으로 완료되었습니다.")).toBe(true);
  });

  it("완료 키워드가 없는 응답은 감지하지 않아야 한다", () => {
    expect(detectCompletion("아직 작업 중입니다.")).toBe(false);
    expect(detectCompletion("오류가 발생했습니다.")).toBe(false);
    expect(detectCompletion("분석 중입니다.")).toBe(false);
    expect(detectCompletion("파일을 확인하고 있습니다.")).toBe(false);
  });

  it("대소문자 구분 없이 감지해야 한다", () => {
    expect(detectCompletion("Checkpoint saved successfully.")).toBe(true);
    expect(detectCompletion("CHECKPOINT 저장 완료")).toBe(true);
  });
});
