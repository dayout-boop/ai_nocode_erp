/**
 * 탈마누스 자체 개발 파이프 검증
 * - 코드생성 LLM이 빈 changeset을 반환하면 커밋 없이 중단되어야 한다
 * - ADD/MODIFY인데 content가 비면 커밋을 중단해야 한다
 * - 정상 changeset이면 runPipeline으로 전달되어야 한다
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// orchestratorChat / runPipeline / isGitEngineEnabled 모킹
const mockOrchestratorChat = vi.fn();
const mockRunPipeline = vi.fn();
const mockIsGitEngineEnabled = vi.fn();

vi.mock("./openrouter", () => ({
  orchestratorChat: (...args: unknown[]) => mockOrchestratorChat(...args),
}));
vi.mock("./orchestrator", () => ({
  runPipeline: (...args: unknown[]) => mockRunPipeline(...args),
}));
vi.mock("./gitEngine", () => ({
  isGitEngineEnabled: () => mockIsGitEngineEnabled(),
}));

import { runSelfDevelopment } from "./selfDevPipe";

function llmResponse(content: string) {
  return {
    text: content,
    model: "google/gemini-2.5-pro-preview-05-06",
    tokensIn: 100,
    tokensOut: 200,
    costUsd: 0.001,
    durationMs: 1000,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsGitEngineEnabled.mockReturnValue(true);
});

describe("runSelfDevelopment (탈마누스 자체 개발)", () => {
  it("빈 files 응답이면 커밋하지 않고 실패 반환", async () => {
    mockOrchestratorChat.mockResolvedValue(
      llmResponse(JSON.stringify({ summary: "대규모 변경 필요", files: [] }))
    );
    const result = await runSelfDevelopment({
      title: "테스트",
      description: "테스트 요청",
      requestedBy: 1,
    });
    expect(result.success).toBe(false);
    expect(mockRunPipeline).not.toHaveBeenCalled();
    expect(result.changedFiles).toEqual([]);
  });

  it("ADD인데 content가 비면 커밋 중단", async () => {
    mockOrchestratorChat.mockResolvedValue(
      llmResponse(
        JSON.stringify({
          summary: "x",
          files: [{ filePath: "a.ts", action: "ADD", content: "" }],
        })
      )
    );
    const result = await runSelfDevelopment({
      title: "t",
      description: "d",
      requestedBy: 1,
    });
    expect(result.success).toBe(false);
    expect(mockRunPipeline).not.toHaveBeenCalled();
    expect(result.message).toContain("content");
  });

  it("정상 changeset이면 runPipeline(devSource=engine, role=MASTER) 호출", async () => {
    mockOrchestratorChat.mockResolvedValue(
      llmResponse(
        JSON.stringify({
          summary: "버튼 추가",
          files: [{ filePath: "client/src/x.tsx", action: "MODIFY", content: "export const X = 1;" }],
        })
      )
    );
    mockRunPipeline.mockResolvedValue({
      requestId: 42,
      agentId: "master_engine",
      currentStage: "AUDIT_LOCK",
      integrityStatus: "SUCCESS",
      message: "정합성 통과",
    });

    const result = await runSelfDevelopment({
      title: "t",
      description: "d",
      requestedBy: 7,
    });

    expect(result.success).toBe(true);
    expect(result.pipelineRequestId).toBe(42);
    expect(mockRunPipeline).toHaveBeenCalledTimes(1);
    const callArg = mockRunPipeline.mock.calls[0][0];
    expect(callArg.devSource).toBe("engine");
    expect(callArg.context.role).toBe("MASTER");
    expect(callArg.changeset).toHaveLength(1);
  });

  it("JSON 코드블록으로 감싼 응답도 파싱", async () => {
    mockOrchestratorChat.mockResolvedValue(
      llmResponse(
        "```json\n" +
          JSON.stringify({
            summary: "s",
            files: [{ filePath: "f.ts", action: "ADD", content: "ok" }],
          }) +
          "\n```"
      )
    );
    mockRunPipeline.mockResolvedValue({
      requestId: 1,
      agentId: "master_engine",
      currentStage: "AUDIT_LOCK",
      integrityStatus: "SUCCESS",
      message: "ok",
    });
    const result = await runSelfDevelopment({ title: "t", description: "d", requestedBy: 1 });
    expect(result.success).toBe(true);
    expect(mockRunPipeline).toHaveBeenCalled();
  });

  it("Git 엔진 비활성 시 PENDING도 성공 취급(커밋 보류 안내)", async () => {
    mockIsGitEngineEnabled.mockReturnValue(false);
    mockOrchestratorChat.mockResolvedValue(
      llmResponse(
        JSON.stringify({
          summary: "s",
          files: [{ filePath: "f.ts", action: "ADD", content: "ok" }],
        })
      )
    );
    mockRunPipeline.mockResolvedValue({
      requestId: 9,
      agentId: "master_engine",
      currentStage: "CODE_SANDBOX",
      integrityStatus: "PENDING",
      message: "Git 엔진 비활성 — 메타만 기록",
    });
    const result = await runSelfDevelopment({ title: "t", description: "d", requestedBy: 1 });
    expect(result.success).toBe(true);
    expect(result.message).toContain("커밋 보류");
  });
});
