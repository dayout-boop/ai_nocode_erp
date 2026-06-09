import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 스토리지 S3 직결 폴백 검증
 *  1) S3 자격증명이 환경변수에 있으면 resolveS3Settings가 설정을 반환
 *  2) 자격증명이 전혀 없으면 isS3Configured=false (마누스 환경 무영향)
 *  3) MinIO 엔드포인트/퍼블릭 베이스 URL 옵션 해석
 *
 * 실제 S3 네트워크 호출은 하지 않고, 설정 해석 로직만 검증한다.
 */

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
  // ERP DB 조회를 비활성화 (환경변수 경로만 테스트)
  vi.doMock("./erpApiKeyManager", () => ({
    getApiConfig: async () => ({}),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("./erpApiKeyManager");
  process.env = { ...ORIGINAL_ENV };
});

describe("S3 직결 폴백 설정 해석", () => {
  it("S3 환경변수가 모두 있으면 설정을 반환한다", async () => {
    process.env.S3_BUCKET = "my-bucket";
    process.env.S3_REGION = "ap-northeast-2";
    process.env.S3_ACCESS_KEY_ID = "AKIA_TEST";
    process.env.S3_SECRET_ACCESS_KEY = "secret_test";

    const { resolveS3Settings, isS3Configured } = await import("./s3Fallback");
    const settings = await resolveS3Settings();

    expect(settings).not.toBeNull();
    expect(settings?.bucket).toBe("my-bucket");
    expect(settings?.region).toBe("ap-northeast-2");
    expect(await isS3Configured()).toBe(true);
  });

  it("AWS_* 표준 환경변수도 인식한다", async () => {
    process.env.AWS_S3_BUCKET = "aws-bucket";
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "AKIA_AWS";
    process.env.AWS_SECRET_ACCESS_KEY = "secret_aws";

    const { resolveS3Settings } = await import("./s3Fallback");
    const settings = await resolveS3Settings();

    expect(settings?.bucket).toBe("aws-bucket");
    expect(settings?.region).toBe("us-east-1");
  });

  it("자격증명이 전혀 없으면 null (마누스 환경 무영향)", async () => {
    delete process.env.S3_BUCKET;
    delete process.env.S3_REGION;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    delete process.env.AWS_S3_BUCKET;
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    const { resolveS3Settings, isS3Configured } = await import("./s3Fallback");

    expect(await resolveS3Settings()).toBeNull();
    expect(await isS3Configured()).toBe(false);
  });

  it("MinIO 엔드포인트와 퍼블릭 베이스 URL 옵션을 해석한다", async () => {
    process.env.S3_BUCKET = "minio-bucket";
    process.env.S3_REGION = "us-east-1";
    process.env.S3_ACCESS_KEY_ID = "minio";
    process.env.S3_SECRET_ACCESS_KEY = "minio123";
    process.env.S3_ENDPOINT = "https://minio.example.com";
    process.env.S3_PUBLIC_BASE_URL = "https://cdn.example.com";

    const { resolveS3Settings } = await import("./s3Fallback");
    const settings = await resolveS3Settings();

    expect(settings?.endpoint).toBe("https://minio.example.com");
    expect(settings?.publicBaseUrl).toBe("https://cdn.example.com");
  });

  it("퍼블릭 베이스 URL이 있으면 프리사인 없이 직접 URL을 만든다", async () => {
    process.env.S3_BUCKET = "minio-bucket";
    process.env.S3_REGION = "us-east-1";
    process.env.S3_ACCESS_KEY_ID = "minio";
    process.env.S3_SECRET_ACCESS_KEY = "minio123";
    process.env.S3_PUBLIC_BASE_URL = "https://cdn.example.com";

    const { s3GetSignedUrl } = await import("./s3Fallback");
    const url = await s3GetSignedUrl("folder/file.png");

    expect(url).toBe("https://cdn.example.com/folder/file.png");
  });
});
