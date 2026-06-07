/**
 * 이미지 아카이브 관리 테스트 [ID: 600001]
 * - imageArchiveRouter의 주요 프로시저 단위 테스트
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// getDb 모킹
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// googleDrive 서비스 모킹
vi.mock("./services/googleDrive", () => ({
  deleteDriveFile: vi.fn(),
  getDriveFileInfo: vi.fn(),
  listDriveFiles: vi.fn(),
}));

import { getDb } from "./db";
import { deleteDriveFile } from "./services/googleDrive";

const mockGetDb = vi.mocked(getDb);
const mockDeleteDriveFile = vi.mocked(deleteDriveFile);

// 공통 DB mock 헬퍼
function createMockDb(overrides: Record<string, any> = {}) {
  const base = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return base;
}

describe("이미지 아카이브 라우터", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDb 연결 실패 처리", () => {
    it("DB 연결 실패 시 list는 빈 결과를 반환해야 한다", async () => {
      mockGetDb.mockResolvedValue(null);

      const { imageArchiveRouter } = await import("./routers/imageArchive");
      const caller = imageArchiveRouter.createCaller({
        user: { id: 1, name: "admin", role: "admin" } as any,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.list({ page: 1, limit: 50 });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("DB 연결 실패 시 getStats는 기본값을 반환해야 한다", async () => {
      mockGetDb.mockResolvedValue(null);

      const { imageArchiveRouter } = await import("./routers/imageArchive");
      const caller = imageArchiveRouter.createCaller({
        user: { id: 1, name: "admin", role: "admin" } as any,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.getStats();
      expect(result.total).toBe(0);
      expect(result.deleted).toBe(0);
      expect(result.active).toBe(0);
      expect(result.bySource).toEqual([]);
    });
  });

  describe("logImage", () => {
    it("이미지 로그를 정상적으로 등록해야 한다", async () => {
      const mockDb = createMockDb();
      mockGetDb.mockResolvedValue(mockDb as any);

      const { imageArchiveRouter } = await import("./routers/imageArchive");
      const caller = imageArchiveRouter.createCaller({
        user: null,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.logImage({
        driveFileId: "abc123",
        fileName: "test.jpg",
        driveUrl: "https://drive.google.com/file/d/abc123",
        source: "kakaowork",
        sourceDetail: "테스트 채널",
      });

      expect(result.success).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalled();
    });

    it("processedAt이 없으면 현재 시각을 사용해야 한다", async () => {
      const mockDb = createMockDb();
      mockGetDb.mockResolvedValue(mockDb as any);

      const { imageArchiveRouter } = await import("./routers/imageArchive");
      const caller = imageArchiveRouter.createCaller({
        user: null,
        req: {} as any,
        res: {} as any,
      });

      const before = new Date();
      await caller.logImage({
        driveFileId: "xyz789",
        fileName: "image.png",
        driveUrl: "https://drive.google.com/file/d/xyz789",
      });
      const after = new Date();

      // values 호출 시 processedAt이 Date 객체여야 함
      const valuesCall = mockDb.values.mock.calls[0][0];
      expect(valuesCall.processedAt).toBeInstanceOf(Date);
      expect(valuesCall.processedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(valuesCall.processedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("deleteFiles", () => {
    it("Drive 삭제 성공 시 deleted 카운트가 증가해야 한다", async () => {
      const mockFile = {
        id: 1,
        driveFileId: "file001",
        fileName: "test.jpg",
        isDeleted: false,
      };

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockFile]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
      };
      mockGetDb.mockResolvedValue(mockDb as any);
      mockDeleteDriveFile.mockResolvedValue(true);

      const { imageArchiveRouter } = await import("./routers/imageArchive");
      const caller = imageArchiveRouter.createCaller({
        user: { id: 1, name: "admin", role: "admin" } as any,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.deleteFiles({ ids: [1] });
      expect(result.deleted).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.success).toBe(true);
    });

    it("Drive 삭제 실패 시 failed 카운트가 증가하고 DB는 처리되어야 한다", async () => {
      const mockFile = {
        id: 2,
        driveFileId: "file002",
        fileName: "fail.jpg",
        isDeleted: false,
      };

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockFile]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
      };
      mockGetDb.mockResolvedValue(mockDb as any);
      mockDeleteDriveFile.mockResolvedValue(false);

      const { imageArchiveRouter } = await import("./routers/imageArchive");
      const caller = imageArchiveRouter.createCaller({
        user: { id: 1, name: "admin", role: "admin" } as any,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.deleteFiles({ ids: [2] });
      expect(result.deleted).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.failedFiles).toContain("fail.jpg");
      // DB는 여전히 처리됨
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("삭제할 파일이 없으면 실패 메시지를 반환해야 한다", async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
      };
      mockGetDb.mockResolvedValue(mockDb as any);

      const { imageArchiveRouter } = await import("./routers/imageArchive");
      const caller = imageArchiveRouter.createCaller({
        user: { id: 1, name: "admin", role: "admin" } as any,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.deleteFiles({ ids: [999] });
      expect(result.success).toBe(false);
      expect(result.deleted).toBe(0);
    });
  });
});
