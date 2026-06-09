import type { Express, Response } from "express";
import { ENV } from "./env";

/**
 * /manus-storage/{key} 다운로드 프록시
 *  1순위: 마누스 forge presign GET → 307 redirect (기존 방식)
 *  폴백 : forge 부재/실패 + ERP S3 설정 존재 시 S3 프리사인 GET으로 redirect
 * 마누스 환경에서는 기존 동작과 100% 동일.
 */
function isForgeAvailable(): boolean {
  return !!ENV.forgeApiUrl && !!ENV.forgeApiKey;
}

async function tryS3Redirect(key: string, res: Response): Promise<boolean> {
  try {
    const { isS3Configured, s3GetSignedUrl } = await import("../s3Fallback");
    if (!(await isS3Configured())) return false;
    const url = await s3GetSignedUrl(key);
    if (!url) return false;
    res.set("Cache-Control", "no-store");
    res.redirect(307, url);
    return true;
  } catch (err) {
    console.error("[StorageProxy] S3 폴백 실패:", err);
    return false;
  }
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // forge 부재 → S3 직결 폴백 시도
    if (!isForgeAvailable()) {
      if (await tryS3Redirect(key, res)) return;
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl!.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        if (await tryS3Redirect(key, res)) return;
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        if (await tryS3Redirect(key, res)) return;
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      if (await tryS3Redirect(key, res)) return;
      res.status(502).send("Storage proxy error");
    }
  });
}
