import { describe, it, expect } from "vitest";
import {
  buildDuplicateMessage,
  isDuplicateMessage,
  parseDuplicateMessage,
  DUPLICATE_RESERVATION_PREFIX,
} from "../shared/duplicateWarning";

describe("duplicateWarning 유틸", () => {
  it("buildDuplicateMessage는 예약번호를 콤마로 이어 prefix와 결합한다", () => {
    expect(buildDuplicateMessage(["OY-1", "OY-2"])).toBe(`${DUPLICATE_RESERVATION_PREFIX}OY-1,OY-2`);
  });

  it("buildDuplicateMessage는 빈 값/falsy를 제거한다", () => {
    expect(buildDuplicateMessage(["OY-1", "", "OY-3"])).toBe(`${DUPLICATE_RESERVATION_PREFIX}OY-1,OY-3`);
  });

  it("isDuplicateMessage는 중복 메시지를 true로 판별한다", () => {
    expect(isDuplicateMessage(`${DUPLICATE_RESERVATION_PREFIX}OY-1`)).toBe(true);
  });

  it("isDuplicateMessage는 일반 에러/undefined를 false로 판별한다", () => {
    expect(isDuplicateMessage("서버 오류가 발생했습니다")).toBe(false);
    expect(isDuplicateMessage(undefined)).toBe(false);
    expect(isDuplicateMessage(null)).toBe(false);
  });

  it("parseDuplicateMessage는 예약번호 배열을 추출한다", () => {
    expect(parseDuplicateMessage(`${DUPLICATE_RESERVATION_PREFIX}OY-1, OY-2 ,OY-3`)).toEqual([
      "OY-1",
      "OY-2",
      "OY-3",
    ]);
  });

  it("parseDuplicateMessage는 중복 메시지가 아니면 null을 반환한다", () => {
    expect(parseDuplicateMessage("something else")).toBeNull();
  });

  it("parseDuplicateMessage는 번호가 비어도 빈 배열을 반환한다", () => {
    expect(parseDuplicateMessage(`${DUPLICATE_RESERVATION_PREFIX}`)).toEqual([]);
  });
});
