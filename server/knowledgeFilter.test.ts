/**
 * 두골프 ERP - 타 데스크 지식 차단 필터 테스트
 */
import { describe, it, expect } from "vitest";
import { checkKnowledge, DEFAULT_BLOCK_RULES } from "./services/knowledgeFilter";

describe("knowledgeFilter - 타 데스크 지식 차단 필터", () => {
  describe("DEFAULT_BLOCK_RULES 구조 검증", () => {
    it("기본 차단 규칙이 존재해야 한다", () => {
      expect(DEFAULT_BLOCK_RULES.length).toBeGreaterThan(0);
    });

    it("각 규칙은 ruleName, keywords, description을 가져야 한다", () => {
      for (const rule of DEFAULT_BLOCK_RULES) {
        expect(rule.ruleName).toBeTruthy();
        expect(Array.isArray(rule.keywords)).toBe(true);
        expect(rule.keywords.length).toBeGreaterThan(0);
      }
    });
  });

  describe("checkKnowledge - 타 데스크 지식 차단 감지", () => {
    it("GitHub 연동 원칙은 차단되어야 한다", () => {
      const result = checkKnowledge("GitHub 연동 및 실시간 반영 최우선 처리 원칙");
      expect(result.isBlocked).toBe(true);
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
    });

    it("PR 생성 원칙은 차단되어야 한다", () => {
      const result = checkKnowledge("PR 생성 시 본문 포함 원칙");
      expect(result.isBlocked).toBe(true);
    });

    it("L-5 인가 스텁 원칙은 차단되어야 한다", () => {
      const result = checkKnowledge("외부 LLM 호출 시 L-5 인가 스텁 선 배치 원칙");
      expect(result.isBlocked).toBe(true);
    });

    it("파일 수정 3회 중단 원칙은 차단되어야 한다", () => {
      const result = checkKnowledge("파일 수정 및 오류 발생 시 작업 중단 원칙");
      expect(result.isBlocked).toBe(true);
    });

    it("이데스크 운영 원칙은 차단되어야 한다", () => {
      const result = checkKnowledge("이데스크 운영 원칙");
      expect(result.isBlocked).toBe(true);
    });

    it("IP 보호 원칙은 차단되어야 한다", () => {
      const result = checkKnowledge("핵심 Master AI 라이센스 및 IP 보호 원칙");
      expect(result.isBlocked).toBe(true);
    });

    it("두골프 ERP 관련 지식은 차단되지 않아야 한다", () => {
      const result = checkKnowledge("두골프 골프투어 패키지 예약 관리 원칙");
      expect(result.isBlocked).toBe(false);
    });

    it("일반 개발 지식은 차단되지 않아야 한다", () => {
      const result = checkKnowledge("React 컴포넌트 최적화 기법");
      expect(result.isBlocked).toBe(false);
    });

    it("차단 결과에 knowledgeName이 포함되어야 한다", () => {
      const name = "GitHub 연동 원칙";
      const result = checkKnowledge(name);
      expect(result.knowledgeName).toBe(name);
    });

    it("차단 결과에 blockReason이 포함되어야 한다", () => {
      const result = checkKnowledge("GitHub 연동 및 실시간 반영 최우선 처리 원칙");
      expect(result.isBlocked).toBe(true);
      expect(result.blockReason).toBeTruthy();
    });
  });

  describe("checkKnowledge - 내용 기반 차단", () => {
    it("내용에 차단 키워드가 포함되면 차단되어야 한다", () => {
      const result = checkKnowledge(
        "알 수 없는 지식",
        "이 지식은 GitHub 연동 및 실시간 반영 최우선 처리 원칙에 따른 작업입니다"
      );
      expect(result.isBlocked).toBe(true);
    });

    it("내용이 없어도 이름만으로 차단 가능해야 한다", () => {
      const result = checkKnowledge("파일 수정 3회 중단 원칙");
      expect(result.isBlocked).toBe(true);
    });
  });
});
