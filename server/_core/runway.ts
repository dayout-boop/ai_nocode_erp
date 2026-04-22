/**
 * Runway ML 동영상 생성 모듈
 * 상품 이미지 → 15초 홍보 동영상 자동 생성
 * 
 * Runway Gen-3 Alpha Turbo API 사용
 * RUNWAY_API_KEY 환경변수 필요
 * 미설정 시 개발 모드로 더미 데이터 반환
 */

import { ENV } from "./env";

const RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_API_VERSION = "2024-11-06";

// ─── 타입 정의 ───────────────────────────────────────────────────
export interface RunwayGenerationRequest {
  imageUrl: string;           // 입력 이미지 URL
  packageTitle: string;       // 패키지 제목 (프롬프트 생성용)
  country: string;            // 국가 (프롬프트 생성용)
  region?: string;            // 지역 (선택)
  durationSec?: 5 | 10;      // 동영상 길이 (5 또는 10초, 기본 10초)
}

export interface RunwayGenerationResult {
  success: boolean;
  taskId?: string;
  status?: "pending" | "processing" | "succeeded" | "failed";
  videoUrl?: string;
  error?: string;
}

export interface RunwayTaskStatus {
  id: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  progress?: number;
  output?: string[];
  error?: string;
}

// ─── 골프 여행 프롬프트 빌더 ─────────────────────────────────────
function buildGolfVideoPrompt(params: {
  packageTitle: string;
  country: string;
  region?: string;
}): string {
  const countryMap: Record<string, string> = {
    korea: "Korea",
    thailand: "Thailand",
    vietnam: "Vietnam",
    philippines: "Philippines",
    china: "China",
    japan: "Japan",
  };
  const countryEn = countryMap[params.country] ?? params.country;

  return `Cinematic golf travel promotional video. Beautiful ${countryEn} golf course, ${params.region ? params.region + " region, " : ""}lush green fairways, blue sky. Smooth camera movement panning across the course. Professional golfers in action. Luxury resort atmosphere. High-quality 4K footage. Vibrant colors, golden hour lighting. Travel advertisement style.`;
}

// ─── Runway API 호출 ─────────────────────────────────────────────
async function runwayApiCall(endpoint: string, method: "GET" | "POST", body?: object): Promise<unknown> {
  const apiKey = ENV.runwayApiKey;
  if (!apiKey) {
    throw new Error("RUNWAY_API_KEY not configured");
  }

  const response = await fetch(`${RUNWAY_API_BASE}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Runway-Version": RUNWAY_API_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Runway API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// ─── 동영상 생성 시작 ────────────────────────────────────────────
export async function generateGolfVideo(
  request: RunwayGenerationRequest
): Promise<RunwayGenerationResult> {
  const apiKey = ENV.runwayApiKey;

  // 개발 모드: API 키 미설정 시 더미 데이터 반환
  if (!apiKey) {
    console.log("[Runway] DEV MODE - 실제 생성 없음");
    console.log(`  패키지: ${request.packageTitle} (${request.country})`);
    console.log(`  이미지: ${request.imageUrl}`);
    return {
      success: true,
      taskId: `dev_task_${Date.now()}`,
      status: "pending",
    };
  }

  try {
    const prompt = buildGolfVideoPrompt({
      packageTitle: request.packageTitle,
      country: request.country,
      region: request.region,
    });

    // Runway Gen-3 Alpha Turbo: 이미지 → 동영상
    const payload = {
      model: "gen3a_turbo",
      promptImage: request.imageUrl,
      promptText: prompt,
      duration: request.durationSec ?? 10,
      ratio: "1280:768", // 16:9 와이드스크린
      watermark: false,
    };

    const result = await runwayApiCall("/image_to_video", "POST", payload) as { id: string };
    console.log(`[Runway] 동영상 생성 시작: taskId=${result.id}`);

    return {
      success: true,
      taskId: result.id,
      status: "pending",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Runway] 동영상 생성 실패: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

// ─── 생성 상태 조회 ──────────────────────────────────────────────
export async function getVideoGenerationStatus(taskId: string): Promise<RunwayTaskStatus> {
  const apiKey = ENV.runwayApiKey;

  // 개발 모드
  if (!apiKey || taskId.startsWith("dev_task_")) {
    return {
      id: taskId,
      status: "succeeded",
      progress: 100,
      output: ["https://example.com/dev-golf-video.mp4"],
    };
  }

  try {
    const result = await runwayApiCall(`/tasks/${taskId}`, "GET") as {
      id: string;
      status: string;
      progress?: number;
      output?: string[];
      failure?: string;
    };

    return {
      id: result.id,
      status: result.status as RunwayTaskStatus["status"],
      progress: result.progress,
      output: result.output,
      error: result.failure,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return {
      id: taskId,
      status: "failed",
      error: errorMsg,
    };
  }
}

// ─── 생성 취소 ───────────────────────────────────────────────────
export async function cancelVideoGeneration(taskId: string): Promise<boolean> {
  const apiKey = ENV.runwayApiKey;
  if (!apiKey || taskId.startsWith("dev_task_")) return true;

  try {
    await runwayApiCall(`/tasks/${taskId}/cancel`, "POST");
    return true;
  } catch {
    return false;
  }
}
