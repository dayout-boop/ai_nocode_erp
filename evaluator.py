"""
evaluator.py — LLM 평가·라우팅 3층의 '주단위 집계' 엔진 (골격)

설계: arch-core llm_evaluation (즉시·누적·주단위 3층).
  - 인위적 벤치 X. 실사용 기록(C-9)의 평균으로 평가.
  - 주 1회: 누적 평균 + OpenRouter 시장데이터 교차 → 언어별 1~3위 확정.
  - 서비스 종료는 주 안 기다리고 즉시 순위서 제외 (즉시층, resolver와 연계).

이 파일은 골격: 집계·순위 로직은 동작. 실제 OpenRouter API·C-9 DB 조회는
제품 런타임(S1~S2). 지금은 인터페이스 + 메모리 시뮬.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import time


# ── 실사용 기록 1건 (C-9 기록에 태그로 쌓임) ──────────────
@dataclass
class UsageRecord:
    language: str          # go/rust/python/typescript/...
    agent: str             # 어떤 LLM
    cost: float            # 토큰·청구 (낮을수록 좋음)
    error: bool            # Exit Code != 0 (에러)
    consistency: float     # crosscheck 통과율 0~1 (높을수록 좋음)
    latency_ms: float = 0  # 지연
    region: str = ""
    ts: float = field(default_factory=time.time)


# ── 언어×LLM 누적 평균 (누적층) ───────────────────────────
@dataclass
class RunningAvg:
    n: int = 0
    cost: float = 0.0
    error_rate: float = 0.0
    consistency: float = 0.0
    latency: float = 0.0

    def update(self, r: UsageRecord):
        # 누적 평균 (rolling) — 매초 순위 안 바꾸고 평균만 갱신
        self.n += 1
        k = self.n
        self.cost += (r.cost - self.cost) / k
        self.error_rate += ((1.0 if r.error else 0.0) - self.error_rate) / k
        self.consistency += (r.consistency - self.consistency) / k
        self.latency += (r.latency_ms - self.latency) / k


@dataclass
class Ranking:
    language: str
    top3: list              # [(agent, score), ...] 1~3위
    excluded: list = field(default_factory=list)  # 종료 등 제외된 것
    source: str = ""


# ── 주단위 평가 엔진 (고정층) ─────────────────────────────
class Evaluator:
    """실사용 누적 평균 + OpenRouter 교차 → 언어별 1~3위.
    가중치는 arch-core/ dayout 수치. 여기선 기본값."""

    def __init__(self, weights: Optional[dict] = None):
        # score 가중치 (비용vs품질vs속도) — dayout 확정 전 기본값
        self.w = weights or {"cost": 0.3, "consistency": 0.4,
                             "error": 0.2, "latency": 0.1}
        # 누적 저장: {(language, agent): RunningAvg}
        self._acc: dict = {}
        # 즉시 제외 (서비스 종료) — resolver 즉시층이 표시
        self._shutdown: set = set()

    # 누적층: 실사용 기록 반영 (매 작동, 순위 변경 안 함)
    def record(self, r: UsageRecord):
        self._acc.setdefault((r.language, r.agent), RunningAvg()).update(r)

    # 즉시층 연계: 서비스 종료 즉시 제외 (주 안 기다림)
    def mark_shutdown(self, agent: str):
        self._shutdown.add(agent)

    def clear_shutdown(self, agent: str):
        self._shutdown.discard(agent)

    # 점수: 낮은 비용·에러·지연 + 높은 정합성 (0~1 정규화 가정)
    def _score(self, a: RunningAvg) -> float:
        # 비용·에러·지연은 낮을수록 좋음 → (1-값), 정합성은 그대로
        return (self.w["cost"] * (1 - min(a.cost, 1.0))
                + self.w["consistency"] * a.consistency
                + self.w["error"] * (1 - a.error_rate)
                + self.w["latency"] * (1 - min(a.latency / 10000, 1.0)))

    # 고정층: 주단위 1~3위 확정 (누적평균 + OpenRouter 교차)
    def rank(self, language: str, openrouter: Optional[dict] = None) -> Ranking:
        # 1) 우리 실사용 누적 평균 점수
        scored = []
        excluded = []
        for (lang, agent), avg in self._acc.items():
            if lang != language:
                continue
            if agent in self._shutdown:        # ★종료=즉시 제외
                excluded.append(agent)
                continue
            scored.append((agent, self._score(avg)))

        # 2) OpenRouter 시장 데이터 교차 (외부 기준 — 새 모델·가격)
        #    제품: OpenRouter API로 가용·가격 보정. 골격: 가산점 힌트만.
        if openrouter:
            for i, (agent, sc) in enumerate(scored):
                mkt = openrouter.get(agent, {})
                if mkt.get("available") is False:
                    excluded.append(agent)
                    scored[i] = (agent, -1)     # 시장서 내려간 모델 강등
                else:
                    # 시장 가격 우수면 소폭 가산 (교차 보정)
                    scored[i] = (agent, sc + mkt.get("bonus", 0.0))
            scored = [s for s in scored if s[1] >= 0]

        # 3) 1~3위
        scored.sort(key=lambda x: x[1], reverse=True)
        return Ranking(language, scored[:3], excluded,
                       "실사용 누적평균 + OpenRouter 교차")


# ── 데모 (실제 C-9 DB·OpenRouter API는 S1~S2) ─────────────
if __name__ == "__main__":
    ev = Evaluator()
    # 누적층: 실사용 기록 시뮬 (어차피 쌓이는 데이터)
    samples = [
        UsageRecord("go", "claude", cost=0.3, error=False, consistency=0.95, latency_ms=1200),
        UsageRecord("go", "claude", cost=0.3, error=False, consistency=0.92, latency_ms=1100),
        UsageRecord("go", "deepseek", cost=0.05, error=True, consistency=0.70, latency_ms=900),
        UsageRecord("go", "deepseek", cost=0.05, error=False, consistency=0.78, latency_ms=850),
        UsageRecord("go", "gpt", cost=0.25, error=False, consistency=0.88, latency_ms=1500),
    ]
    for s in samples:
        ev.record(s)

    print("=== 누적평균만 (OpenRouter 없이) ===")
    r = ev.rank("go")
    for i, (a, sc) in enumerate(r.top3, 1):
        print(f"  {i}위 {a}: {sc:.3f}")

    print("\n=== OpenRouter 교차 (deepseek 시장 우수, gpt 종료) ===")
    ev.mark_shutdown("gpt")     # 즉시층: gpt 서비스 종료 → 즉시 제외
    mkt = {"deepseek": {"available": True, "bonus": 0.1},
           "claude": {"available": True, "bonus": 0.0}}
    r2 = ev.rank("go", openrouter=mkt)
    for i, (a, sc) in enumerate(r2.top3, 1):
        print(f"  {i}위 {a}: {sc:.3f}")
    print(f"  제외: {r2.excluded}")
