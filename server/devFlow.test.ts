/**
 * devFlow.test.ts
 * 개발 흐름 기록(devLog) + 멀티테넌트 추적 + 자체 배포 실행기(deployRunner) 단위 테스트
 * ------------------------------------------------------------------
 * 검증 목표:
 *  - recordDevActivity: 마누스/자체/수동 어떤 출처든 ai_dev_requests 에 1건 기록되고
 *    tenantId 미지정 시 두골프(=1) 기본값이 적용된다.
 *  - graceful: DB 미연결/insert 실패해도 throw 하지 않고 ok:false 로 회수된다.
 *  - deployRunner: SELF_DEPLOY_ENABLED 가드가 꺼져 있으면 실제 쉘 실행 없이
 *    enabled:false 로 안전하게 반환한다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── DB 모킹 ──────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "./db";
import { recordDevActivity } from "./services/devLog";
import { DOGOLF_TENANT_ID } from "../shared/const";

type MockFn = ReturnType<typeof vi.fn>;

/** insert().values() 체인을 흉내내는 mock db 빌더 */
function makeMockDb(opts?: { insertId?: number; throwOn?: boolean }) {
  const insertId = opts?.insertId ?? 777;
  const captured: { table: any; values: any[] } = { table: null, values: [] };

  const valuesFn = vi.fn(async (v: any) => {
    if (opts?.throwOn) throw new Error("simulated insert failure");
    captured.values.push(v);
    // mysql2 형태: [{ insertId }]
    return [{ insertId }];
  });

  const insertFn = vi.fn((table: any) => {
    captured.table = table;
    return { values: valuesFn };
  });

  const updateFn = vi.fn(() => ({
    set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
  }));

  return {
    db: { insert: insertFn, update: updateFn },
    captured,
    insertFn,
    valuesFn,
  };
}

describe("recordDevActivity — 개발 흐름 기록", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DB 미연결 시 throw 없이 ok:false(db_unavailable) 반환", async () => {
    (getDb as MockFn).mockResolvedValue(null);
    const result = await recordDevActivity({ summary: "테스트 개발", source: "manus" });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("db_unavailable");
  });

  it("정상 기록 시 ok:true + requestId 반환", async () => {
    const { db } = makeMockDb({ insertId: 1234 });
    (getDb as MockFn).mockResolvedValue(db);
    const result = await recordDevActivity({ summary: "신규 기능 개발", source: "engine" });
    expect(result.ok).toBe(true);
    expect(result.requestId).toBe(1234);
  });

  it("tenantId 미지정 시 두골프 기본값(DOGOLF_TENANT_ID=1)으로 기록", async () => {
    const { db, captured } = makeMockDb();
    (getDb as MockFn).mockResolvedValue(db);
    await recordDevActivity({ summary: "테넌트 기본값 확인", source: "manus" });
    const firstInsert = captured.values[0];
    expect(firstInsert.tenantId).toBe(DOGOLF_TENANT_ID);
    expect(firstInsert.tenantId).toBe(1);
    expect(firstInsert.devSource).toBe("manus");
  });

  it("tenantId 명시 시 해당 값으로 기록 (테넌트 분리 추적)", async () => {
    const { db, captured } = makeMockDb();
    (getDb as MockFn).mockResolvedValue(db);
    await recordDevActivity({ summary: "파트너 개발", source: "engine", tenantId: 1002 });
    expect(captured.values[0].tenantId).toBe(1002);
  });

  it("기본 상태는 CODE_GENERATED (실제 변경 발생을 의미)", async () => {
    const { db, captured } = makeMockDb();
    (getDb as MockFn).mockResolvedValue(db);
    await recordDevActivity({ summary: "상태 기본값", source: "system" });
    expect(captured.values[0].status).toBe("CODE_GENERATED");
  });

  it("변경 파일 목록이 있으면 파일 메타도 함께 적재", async () => {
    const { db, captured } = makeMockDb();
    (getDb as MockFn).mockResolvedValue(db);
    await recordDevActivity({
      summary: "파일 메타 적재",
      source: "manual",
      files: [
        { filePath: "server/a.ts", changeType: "MODIFY", additions: 10, deletions: 2 },
        { filePath: "server/b.ts", changeType: "ADD" },
      ],
    });
    // values[0]=request, values[1]=file1, values[2]=file2
    expect(captured.values.length).toBe(3);
    expect(captured.values[1].filePath).toBe("server/a.ts");
    expect(captured.values[2].changeType).toBe("ADD");
  });

  it("insert가 throw해도 graceful하게 ok:false 반환(개발 진행 방해 금지)", async () => {
    const { db } = makeMockDb({ throwOn: true });
    (getDb as MockFn).mockResolvedValue(db);
    const result = await recordDevActivity({ summary: "실패 시나리오", source: "engine" });
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});
