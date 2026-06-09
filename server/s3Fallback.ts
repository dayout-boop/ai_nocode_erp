/**
 * S3 직결 폴백 (마누스 forge 스토리지 없이 자립)
 *
 * 우선순위:
 *  1) ERP DB(erpApiKeyManager: serviceKey="s3")의 extraConfig 자격증명
 *  2) 환경변수 (S3_* / AWS_*)
 *
 * forge가 살아있으면 storage.ts가 forge를 먼저 쓰고, 실패/부재 시에만
 * 이 모듈로 폴백한다. 자격증명이 전혀 없으면 isS3Configured()가 false를
 * 반환하므로, 마누스 환경에서는 기존 동작에 아무 영향이 없다.
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface S3Settings {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** 선택: MinIO 등 S3 호환 엔드포인트 */
  endpoint?: string;
  /** 선택: 퍼블릭 CDN/베이스 URL (지정 시 다운로드에 우선 사용) */
  publicBaseUrl?: string;
}

/** ERP DB(extraConfig) → 환경변수 순으로 S3 설정 해석 */
export async function resolveS3Settings(): Promise<S3Settings | null> {
  // 1) ERP DB extraConfig
  try {
    const { getApiConfig } = await import("./erpApiKeyManager");
    const cfg = await getApiConfig("s3");
    if (cfg.bucket && cfg.region && cfg.accessKeyId && cfg.secretAccessKey) {
      return {
        bucket: cfg.bucket,
        region: cfg.region,
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
        endpoint: cfg.endpoint || undefined,
        publicBaseUrl: cfg.publicBaseUrl || undefined,
      };
    }
  } catch {
    // DB 조회 실패 시 환경변수로 폴백
  }

  // 2) 환경변수
  const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || "";
  const region = process.env.S3_REGION || process.env.AWS_REGION || "";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "";
  const secretAccessKey =
    process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "";

  if (bucket && region && accessKeyId && secretAccessKey) {
    return {
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
      endpoint: process.env.S3_ENDPOINT || undefined,
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || undefined,
    };
  }

  return null;
}

/** S3 폴백 사용 가능 여부 */
export async function isS3Configured(): Promise<boolean> {
  return (await resolveS3Settings()) !== null;
}

function buildClient(s: S3Settings): S3Client {
  return new S3Client({
    region: s.region,
    credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey },
    ...(s.endpoint ? { endpoint: s.endpoint, forcePathStyle: true } : {}),
  });
}

/** S3에 직접 업로드 */
export async function s3Put(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const settings = await resolveS3Settings();
  if (!settings) throw new Error("S3 설정 없음 (ERP 설정의 s3 또는 환경변수 필요)");

  const client = buildClient(settings);
  const body = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);

  await client.send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  // 다운로드 경로는 동일하게 /manus-storage/{key} 사용 (프록시가 라우팅)
  return { key, url: `/manus-storage/${key}` };
}

/** S3 프리사인 GET URL (다운로드 프록시 폴백용) */
export async function s3GetSignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const settings = await resolveS3Settings();
  if (!settings) throw new Error("S3 설정 없음 (ERP 설정의 s3 또는 환경변수 필요)");

  // 퍼블릭 베이스 URL이 지정되면 그것을 우선 사용 (CDN 등)
  if (settings.publicBaseUrl) {
    return `${settings.publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }

  const client = buildClient(settings);
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: settings.bucket, Key: key }),
    { expiresIn },
  );
}
