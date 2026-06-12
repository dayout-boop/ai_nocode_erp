import { describe, it, expect } from "vitest";
import { generateRecordNo, diffFields, resolveActor, resolveActorName } from "./auditLog";

describe("generateRecordNo", () => {
  it("입금/송금/예치금/충전/데파짓 prefix가 올바르게 생성된다", () => {
    const when = new Date("2026-07-15T00:00:00Z");
    expect(generateRecordNo("income", when)).toMatch(/^IN-202607-\d{4}$/);
    expect(generateRecordNo("remittance", when)).toMatch(/^OUT-202607-\d{4}$/);
    expect(generateRecordNo("deposit", when)).toMatch(/^DP-202607-\d{4}$/);
    expect(generateRecordNo("charge", when)).toMatch(/^CG-202607-\d{4}$/);
    expect(generateRecordNo("prepaid", when)).toMatch(/^PP-202607-\d{4}$/);
    expect(generateRecordNo("reservation", when)).toMatch(/^OY-202607-\d{4}$/);
  });

  it("연/월이 식별번호에 반영된다", () => {
    expect(generateRecordNo("income", new Date("2026-01-05T00:00:00Z"))).toMatch(/^IN-202601-\d{4}$/);
    expect(generateRecordNo("income", new Date("2026-12-31T00:00:00Z"))).toMatch(/^IN-202612-\d{4}$/);
  });
});

describe("diffFields", () => {
  const labels = { amount: "금액", memo: "비고", managerName: "담당자" };

  it("변경된 필드만 before/after와 함께 반환한다", () => {
    const changes = diffFields(
      { amount: 1000, memo: "a", managerName: "홍길동" },
      { amount: 2000, memo: "a", managerName: "김철수" },
      labels
    );
    expect(changes).toHaveLength(2);
    const amount = changes.find((c) => c.field === "amount");
    expect(amount).toEqual({ field: "amount", label: "금액", before: 1000, after: 2000 });
    const mgr = changes.find((c) => c.field === "managerName");
    expect(mgr?.after).toBe("김철수");
  });

  it("after에 undefined(미입력)인 필드는 변경으로 보지 않는다", () => {
    const changes = diffFields(
      { amount: 1000, memo: "a" },
      { amount: undefined, memo: "b" },
      labels
    );
    expect(changes.map((c) => c.field)).toEqual(["memo"]);
  });

  it("값이 동일하면 변경 목록에 포함되지 않는다", () => {
    const changes = diffFields({ amount: 1000 }, { amount: 1000 }, labels);
    expect(changes).toHaveLength(0);
  });

  it("Date 값은 시간(ms) 기준으로 비교한다", () => {
    const same = diffFields(
      { d: new Date("2026-07-15") },
      { d: new Date("2026-07-15") },
      { d: "날짜" }
    );
    expect(same).toHaveLength(0);
    const diff = diffFields(
      { d: new Date("2026-07-15") },
      { d: new Date("2026-08-20") },
      { d: "날짜" }
    );
    expect(diff).toHaveLength(1);
  });

  it("null과 값 사이의 변경을 감지한다", () => {
    const changes = diffFields({ memo: null }, { memo: "신규" }, labels);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({ field: "memo", label: "비고", before: null, after: "신규" });
  });
});

describe("resolveActor", () => {
  it("파트너 직원 컨텍스트를 partner_staff로 식별한다", () => {
    const actor = resolveActor({ partnerStaff: { staffId: 5, name: "직원A" } });
    expect(actor.actorType).toBe("partner_staff");
    expect(actor.actorName).toBe("직원A");
    expect(actor.actorId).toBe(5);
  });

  it("파트너 대표 컨텍스트를 partner_owner로 식별한다", () => {
    const actor = resolveActor({ partnerOwner: { partnerId: 3, name: "대표B" } });
    expect(actor.actorType).toBe("partner_owner");
    expect(actor.actorName).toBe("대표B");
  });

  it("마스터(user) 컨텍스트를 master로 식별한다", () => {
    const actor = resolveActor({ user: { id: 1, name: "마스터" } });
    expect(actor.actorType).toBe("master");
    expect(actor.actorName).toBe("마스터");
  });

  it("정보가 없으면 system으로 처리한다", () => {
    const actor = resolveActor({});
    expect(actor.actorType).toBe("system");
    expect(actor.actorName).toBeNull();
  });

  it("staff가 owner보다 우선한다(둘 다 있을 때)", () => {
    const actor = resolveActor({ partnerStaff: { staffId: 9, name: "직원" }, partnerOwner: { partnerId: 2, name: "대표" } });
    expect(actor.actorType).toBe("partner_staff");
  });

  it("resolveActorName은 표시 이름을 반환하고, 없으면 undefined", () => {
    expect(resolveActorName({ user: { id: 1, name: "관리자" } })).toBe("관리자");
    expect(resolveActorName({})).toBeUndefined();
  });
});
