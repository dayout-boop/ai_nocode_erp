/**
 * featuresRouter — 두골프 ERP 기능 카탈로그
 * - list: features.json 읽기 (공개 — 관리자만 접근하는 ERP 페이지에서 호출)
 * - refresh: generate-features 스크립트 즉시 실행 (관리자 전용)
 * - getReport: 마크다운 보고서 텍스트 반환
 * - getChangelog: CHANGELOG.md 텍스트 반환
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { execSync } from "child_process";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";

const ROOT = join(process.cwd());

function readJson(relPath: string) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, "utf-8"));
  } catch {
    return null;
  }
}

function readText(relPath: string): string {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return "";
  return readFileSync(abs, "utf-8");
}

// 관리자 전용 미들웨어
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." });
  }
  return next({ ctx });
});

export const featuresRouter = router({
  /**
   * 기능 목록 조회 (정적 JSON 읽기)
   * 카테고리/상태 필터 지원
   */
  list: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(),
        status: z.enum(["done", "in_progress", "planned", "all"]).optional().default("all"),
        search: z.string().optional(),
      })
    )
    .query(({ input }) => {
      const data = readJson("docs/features.json");
      if (!data) {
        return { generatedAt: null, totalCount: 0, features: [] };
      }

      let features: any[] = data.features ?? [];

      if (input.category && input.category !== "all") {
        features = features.filter((f) => f.category === input.category);
      }
      if (input.status && input.status !== "all") {
        features = features.filter((f) => f.status === input.status);
      }
      if (input.search) {
        const q = input.search.toLowerCase();
        features = features.filter(
          (f) =>
            f.name?.toLowerCase().includes(q) ||
            f.description?.toLowerCase().includes(q) ||
            f.tags?.some((t: string) => t.toLowerCase().includes(q))
        );
      }

      // 카테고리 목록 (전체 데이터 기준)
      const allCategories = Array.from(
        new Set((data.features ?? []).map((f: any) => f.category))
      ).sort() as string[];

      return {
        generatedAt: data.generatedAt,
        totalCount: features.length,
        allCount: data.totalCount,
        categories: allCategories,
        features,
      };
    }),

  /**
   * generate-features 스크립트 즉시 실행 (관리자 전용)
   */
  refresh: adminProcedure.mutation(() => {
    try {
      const output = execSync("node scripts/generate-features.mjs", {
        cwd: ROOT,
        timeout: 30000,
        encoding: "utf-8",
      });
      const data = readJson("docs/features.json");
      return {
        success: true,
        message: output.trim(),
        totalCount: data?.totalCount ?? 0,
        generatedAt: data?.generatedAt ?? null,
      };
    } catch (err: any) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `스크립트 실행 실패: ${err.message}`,
      });
    }
  }),

  /**
   * 마크다운 보고서 생성 (features.json 기반)
   */
  getReport: protectedProcedure.query(() => {
    const data = readJson("docs/features.json");
    if (!data) return { markdown: "# 보고서 없음\n\nfeatures.json 파일이 없습니다." };

    const features: any[] = data.features ?? [];
    const generatedAt = data.generatedAt
      ? new Date(data.generatedAt).toLocaleDateString("ko-KR")
      : "알 수 없음";

    // 카테고리별 그룹핑
    const grouped: Record<string, any[]> = {};
    for (const f of features) {
      if (!grouped[f.category]) grouped[f.category] = [];
      grouped[f.category].push(f);
    }

    const statusLabel: Record<string, string> = {
      done: "✅ 완료",
      in_progress: "🔄 진행중",
      planned: "📋 예정",
    };

    const doneCount = features.filter((f) => f.status === "done").length;
    const inProgressCount = features.filter((f) => f.status === "in_progress").length;
    const plannedCount = features.filter((f) => f.status === "planned").length;

    let md = `# 두골프(dogolf-tour) 프로젝트 현황 정리 보고서\n\n`;
    md += `> 최종 생성일: ${generatedAt} | 전체 기능 수: ${data.totalCount}개\n\n`;
    md += `---\n\n`;
    md += `## 요약\n\n`;
    md += `| 상태 | 건수 |\n|------|------|\n`;
    md += `| ✅ 완료 | ${doneCount}개 |\n`;
    md += `| 🔄 진행중 | ${inProgressCount}개 |\n`;
    md += `| 📋 예정 | ${plannedCount}개 |\n`;
    md += `| **합계** | **${data.totalCount}개** |\n\n`;
    md += `---\n\n`;

    for (const [cat, items] of Object.entries(grouped).sort()) {
      md += `## ${cat}\n\n`;
      md += `| 기능명 | 상태 | 설명 | 최종수정 |\n|--------|------|------|----------|\n`;
      for (const item of items) {
        const status = statusLabel[item.status] ?? item.status;
        const desc = (item.description ?? "").replace(/\|/g, "｜");
        md += `| ${item.name} | ${status} | ${desc} | ${item.updatedAt ?? "-"} |\n`;
      }
      md += "\n";
    }

    md += `---\n\n`;
    md += `> 이 보고서는 \`scripts/generate-features.mjs\`에 의해 자동 생성됩니다.\n`;
    md += `> 수동 편집은 \`docs/features.override.json\`에서 진행하세요.\n`;

    return { markdown: md, generatedAt: data.generatedAt, totalCount: data.totalCount };
  }),

  /**
   * CHANGELOG.md 텍스트 반환
   */
  getChangelog: protectedProcedure.query(() => {
    const text = readText("docs/CHANGELOG.md");
    return { markdown: text || "# CHANGELOG\n\n변경 이력이 없습니다." };
  }),
});
