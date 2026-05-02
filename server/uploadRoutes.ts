/**
 * 파일 업로드 라우트 (multipart/form-data)
 * POST /api/upload/storage - 일반 파일 S3 업로드
 */
import { Router, type Express } from "express";
import { storagePut } from "./storage";

export function registerUploadRoutes(app: Express) {
  const router = Router();

  /**
   * POST /api/upload/storage
   * Content-Type: multipart/form-data
   * Body: file (File), prefix (string, optional)
   * Returns: { key, url }
   */
  router.post("/storage", async (req, res) => {
    try {
      // express는 기본적으로 multipart를 파싱하지 않으므로
      // raw body를 직접 읽어서 처리하거나 busboy를 사용
      const Busboy = (await import("busboy")).default;
      const busboy = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });

      let fileBuffer: Buffer | null = null;
      let fileName = "upload";
      let mimeType = "application/octet-stream";
      let prefix = "uploads";

      busboy.on("field", (name, value) => {
        if (name === "prefix") prefix = value;
      });

      busboy.on("file", (_fieldname, file, info) => {
        const { filename, mimeType: mime } = info;
        fileName = filename;
        mimeType = mime;
        const chunks: Buffer[] = [];
        file.on("data", (chunk: Buffer) => chunks.push(chunk));
        file.on("end", () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });

      busboy.on("finish", async () => {
        if (!fileBuffer) {
          res.status(400).json({ error: "파일이 없습니다." });
          return;
        }

        const timestamp = Date.now();
        const ext = fileName.split(".").pop() ?? "bin";
        const key = `${prefix}/${timestamp}.${ext}`;

        const { url } = await storagePut(key, fileBuffer, mimeType);
        res.json({ key, url });
      });

      busboy.on("error", (err: Error) => {
        console.error("[Upload] busboy error:", err);
        res.status(500).json({ error: "파일 처리 중 오류가 발생했습니다." });
      });

      req.pipe(busboy);
    } catch (err) {
      console.error("[Upload] 오류:", err);
      res.status(500).json({ error: "업로드 실패" });
    }
  });

  app.use("/api/upload", router);
}
