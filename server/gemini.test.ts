import { describe, it, expect } from "vitest";
import { validateGeminiApiKey, geminiChat } from "./_core/gemini";

describe("Gemini API", () => {
  it("API 키가 환경변수에 설정되어 있어야 한다", () => {
    expect(process.env.GEMINI_API_KEY).toBeTruthy();
    expect(process.env.GEMINI_API_KEY).not.toBe("");
  });

  it("Gemini API 키가 유효하고 응답을 반환해야 한다", async () => {
    const isValid = await validateGeminiApiKey();
    expect(isValid).toBe(true);
  }, 30_000);

  it("두골프 시스템 컨텍스트로 채팅이 가능해야 한다", async () => {
    const response = await geminiChat({
      messages: [
        {
          role: "user",
          content: "두골프 ERP에서 상품을 등록하려면 어떤 API를 사용해야 하나요? 한 문장으로 답해주세요.",
        },
      ],
    });
    expect(response).toBeTruthy();
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(10);
  }, 30_000);
});
