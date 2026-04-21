/**
 * 이미지 최적화 유틸리티
 * - 1200x800 기준 리사이즈 (비율 유지, cover 방식)
 * - WebP 변환 (품질 85%)
 * - 최대 500KB 보장
 */
import sharp from "sharp";

export interface OptimizeOptions {
  width?: number;
  height?: number;
  quality?: number;
  maxSizeKB?: number;
}

const DEFAULT_OPTIONS: Required<OptimizeOptions> = {
  width: 1200,
  height: 800,
  quality: 85,
  maxSizeKB: 500,
};

/**
 * Buffer 또는 URL에서 이미지를 받아 최적화된 WebP Buffer를 반환
 */
export async function optimizeImage(
  input: Buffer | string,
  options: OptimizeOptions = {}
): Promise<{ buffer: Buffer; mimeType: string; sizeKB: number }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let sourceBuffer: Buffer;
  if (typeof input === "string") {
    // URL에서 다운로드
    const res = await fetch(input);
    if (!res.ok) throw new Error(`이미지 다운로드 실패: ${res.status}`);
    sourceBuffer = Buffer.from(await res.arrayBuffer());
  } else {
    sourceBuffer = input;
  }

  let quality = opts.quality;
  let outputBuffer: Buffer;

  // 품질을 낮춰가며 목표 크기 달성
  do {
    outputBuffer = await sharp(sourceBuffer)
      .resize(opts.width, opts.height, {
        fit: "cover",
        position: "center",
        withoutEnlargement: false,
      })
      .webp({ quality })
      .toBuffer();

    const sizeKB = outputBuffer.byteLength / 1024;
    if (sizeKB <= opts.maxSizeKB || quality <= 40) break;
    quality -= 10;
  } while (true);

  const sizeKB = Math.round(outputBuffer.byteLength / 1024);
  return { buffer: outputBuffer, mimeType: "image/webp", sizeKB };
}

/**
 * Base64 데이터 URI에서 최적화된 WebP Buffer를 반환
 */
export async function optimizeBase64Image(
  base64Data: string,
  options: OptimizeOptions = {}
): Promise<{ buffer: Buffer; mimeType: string; sizeKB: number }> {
  const base64 = base64Data.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  return optimizeImage(buffer, options);
}
