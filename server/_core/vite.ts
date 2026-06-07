import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

      // partner.dayoutgolf.com 접속 시 파트너 랜딩 전용 SEO 메타태그 주입
      const rawHost = (req.headers.host ?? '').split(':')[0];
      const isPartnerDomain = rawHost === 'partner.dayoutgolf.com';
      if (isPartnerDomain) {
        template = injectPartnerSeoMeta(template);
      }

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/**
 * partner.dayoutgolf.com 접속 시 index.html에 파트너 랜딩 전용 SEO 메타태그를 주입
 * - 리다이렉트 없이 URL 유지 서빙 → 구글이 partner.dayoutgolf.com을 독립 페이지로 색인 가능
 */
function injectPartnerSeoMeta(html: string): string {
  const partnerMeta = `
    <title>파트너 센터 - 투어커뮤니케이션 | AI가 운영하는 여행사 ERP</title>
    <meta name="description" content="AI가 운영하는 골프투어 여행사 ERP 플랫폼. 자율수행 AI 파트너 '투어커뮤니케이션 매니저'가 24시간 고객 상담, 예약 관리, 상품 생성을 자동으로 처리합니다. 무료로 시작하세요." />
    <meta name="keywords" content="골프투어 ERP, 여행사 AI, 파트너 센터, 투어커뮤니케이션, 골프 여행 관리, AI 여행사, 자율수행 AI" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://partner.dayoutgolf.com/" />
    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://partner.dayoutgolf.com/" />
    <meta property="og:title" content="파트너 센터 - AI가 운영하는 여행사 ERP" />
    <meta property="og:description" content="자율수행 AI 파트너 '투어커뮤니케이션 매니저'가 24시간 고객 상담, 예약 관리, 상품 생성을 자동으로 처리합니다." />
    <meta property="og:site_name" content="투어커뮤니케이션 파트너 센터" />
    <meta property="og:locale" content="ko_KR" />
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="파트너 센터 - AI가 운영하는 여행사 ERP" />
    <meta name="twitter:description" content="자율수행 AI 파트너 '투어커뮤니케이션 매니저'가 24시간 고객 상담, 예약 관리, 상품 생성을 자동으로 처리합니다." />`;

  // 기존 title/description 제거 후 파트너 전용 메타태그로 교체
  return html
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace('<head>', `<head>${partnerMeta}`);
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  // partner.dayoutgolf.com 접속 시 파트너 랜딩 전용 SEO 메타태그 주입
  app.use("*", (req, res) => {
    const rawHost = (req.headers.host ?? '').split(':')[0];
    const isPartnerDomain = rawHost === 'partner.dayoutgolf.com';
    const indexPath = path.resolve(distPath, "index.html");

    if (isPartnerDomain) {
      try {
        let html = fs.readFileSync(indexPath, 'utf-8');
        html = injectPartnerSeoMeta(html);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch {
        res.sendFile(indexPath);
      }
    } else {
      res.sendFile(indexPath);
    }
  });
}
