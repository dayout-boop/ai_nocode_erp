#!/usr/bin/env python3
"""
crosscheck.py — L3b 교차검증 (병렬 결합 후 "불일치만" 탐지)
============================================================
병렬로 생성된 각 평면 코드(Rust/Python/Go/TS)가 arch-core의 contract를
지켰는지 자동 검사. 틀린 소켓만 탐지 → 그 평면에만 재명령.
= "병렬 일괄 + diff 수정" 루프의 마지막 조각.

빌드스펙 §4.2 게이트 B + arch-core cross_check R6(계약 일치).
지금은 계약 키워드 존재 검사(경량). 풀 AST 검사는 S1 단계.

검사 방식 (경량, 의존성 0):
  계약이 요구하는 "필드명·함수명·규칙 키워드"가 각 코드에 다 있나 확인.
  없으면 = 불일치 = 그 평면 재명령 대상.
"""

import re
from dataclasses import dataclass, field
from typing import List


@dataclass
class Contract:
    """검사 기준 — arch-core contract에서 추출한 필수 요소."""
    function_name: str               # 있어야 할 함수명
    fields: List[str]                # 있어야 할 필드명
    rule_keywords: List[str]         # 규칙 구현 흔적 (키워드)


@dataclass
class CheckResult:
    plane: str
    agent: str
    passed: bool
    missing_fields: List[str] = field(default_factory=list)
    missing_function: bool = False
    missing_rules: List[str] = field(default_factory=list)

    @property
    def needs_redo(self) -> bool:
        return not self.passed

    def feedback(self) -> str:
        """재명령용 구조화 피드백 (빌드스펙 §4.4)."""
        parts = []
        if self.missing_function:
            parts.append("계약 함수 없음")
        if self.missing_fields:
            parts.append(f"필드 누락: {', '.join(self.missing_fields)}")
        if self.missing_rules:
            parts.append(f"규칙 미구현 추정: {', '.join(self.missing_rules)}")
        return " / ".join(parts) if parts else "계약 일치"


# 예약 도메인 계약 (arch-core contracts에서. orchestrator의 CONTRACT와 동일 기준)
RESERVATION_CONTRACT = Contract(
    function_name="validate_reservation",
    fields=["tenant_id", "start_at", "status"],
    rule_keywords=["tenant_id", "start_at", "status"],  # 규칙이 이 필드들을 검사하는지
)


def check_code(plane: str, agent: str, code: str,
               contract: Contract = RESERVATION_CONTRACT) -> CheckResult:
    """한 평면의 코드가 계약을 지켰나 검사 (대소문자·언어 무관 키워드)."""
    if not code:
        return CheckResult(plane, agent, passed=False, missing_function=True,
                           missing_fields=list(contract.fields),
                           missing_rules=list(contract.rule_keywords))
    low = code.lower()

    # 1. 함수명 (validate_reservation / validateReservation 등 변형 허용)
    fn_variants = [contract.function_name,
                   contract.function_name.replace("_", ""),
                   _camel(contract.function_name)]
    missing_fn = not any(v.lower() in low for v in fn_variants)

    # 2. 필드 (snake/camel 변형 허용)
    missing_fields = []
    for f in contract.fields:
        variants = [f, f.replace("_", ""), _camel(f)]
        if not any(v.lower() in low for v in variants):
            missing_fields.append(f)

    # 3. 규칙 키워드 (필드가 코드에서 실제 참조되는지 = 규칙 구현 흔적)
    missing_rules = []
    for kw in contract.rule_keywords:
        variants = [kw, kw.replace("_", ""), _camel(kw)]
        # 필드 선언 외에 "검사 로직"에 등장하는지: 단순히 1회 초과 등장으로 근사
        count = sum(low.count(v.lower()) for v in set(variants))
        if count < 2:  # 선언 1 + 사용 1 이상이어야 규칙 구현으로 봄
            missing_rules.append(kw)

    passed = not missing_fn and not missing_fields and not missing_rules
    return CheckResult(plane, agent, passed,
                       missing_fields=missing_fields,
                       missing_function=missing_fn,
                       missing_rules=missing_rules)


def crosscheck_all(results: dict, contract: Contract = RESERVATION_CONTRACT):
    """orchestrator 결과(plane→{agent,out})를 받아 전 평면 교차검증.
    반환: (전체통과여부, [재명령 대상 평면들])."""
    checks = []
    for plane, r in results.items():
        code = r.get("out", "") if r.get("ok") else ""
        checks.append(check_code(plane, r.get("agent", "?"), code, contract))

    redo = [c for c in checks if c.needs_redo]
    print("=" * 66)
    print("  L3b 교차검증 — 계약 일치 (불일치만 재명령)")
    print("=" * 66)
    for c in checks:
        icon = "✅" if c.passed else "❌"
        print(f"  {icon} {c.plane:14} {c.agent:14} {c.feedback()}")
    print("-" * 66)
    if redo:
        print(f"  재명령 대상: {[c.plane for c in redo]}")
        print("  → 통과 평면은 그대로, 이들만 같은 task에 수정 명령(맥락유지)")
    else:
        print("  전 평면 계약 일치 ✅ — 결합 가능")
    print("=" * 66)
    return (len(redo) == 0), redo


def _camel(snake: str) -> str:
    parts = snake.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


if __name__ == "__main__":
    # 데모: 일부러 한 평면을 불일치로
    demo = {
        "execution": {"ok": True, "agent": "codex_rust", "out": """
            pub struct Reservation { pub tenant_id: String, pub start_at: i64, pub status: String }
            pub fn validate_reservation(r: &Reservation) -> bool {
                if r.tenant_id.is_empty() { return false; }
                if r.start_at < now() { return false; }
                if !valid_status(&r.status) { return false; }
                true
            }"""},
        "intelligence": {"ok": True, "agent": "manus", "out": """
            def validate_reservation(data):
                if not data['tenant_id']: return {'valid': False}
                return {'valid': True}"""},  # start_at·status 규칙 누락 → 불일치
        "frontend": {"ok": True, "agent": "cursor", "out": ""},  # 빈 코드 → 불일치
    }
    crosscheck_all(demo)
