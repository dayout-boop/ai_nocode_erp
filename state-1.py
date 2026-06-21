#!/usr/bin/env python3
"""
state.py — Manus task 세션 관리 (글로벌 다중사용자 전제)
========================================================
글로벌 전제 (글로벌_다중사용자_인프라확대_설계.md):
  1.1 stateless: 상태를 저장소 추상화(Store)에 둔다. 지금은 파일 백엔드지만
      나중에 Redis/Postgres로 *내부만* 교체 — 호출부 불변.
  1.2 owner_key: 모든 세션에 (tenant_id, user_id, project_id) 부착.
      → 사용자별 격리·과금·정리의 키. 처음부터 박는다(소급 불가).

원칙:
  - project_id = Codespace Secrets 고정 (MANUS_PROJECT_ID)
  - task_id    = Store가 owner_key별로 자동 관리 (사람 손 안 탐)
  - 옵션 A: 상태 없으면 첫 호출 때 create
  - 500회 순환
"""

import os
import json

import agents

HERE = os.path.dirname(os.path.abspath(__file__))
MAX_CALLS = int(os.environ.get("MANUS_MAX_CALLS", "500"))
PROJECT_ID = os.environ.get("MANUS_PROJECT_ID")


# ── 저장소 추상화 (글로벌 전제 1.1) ─────────────────────
# 지금은 파일 백엔드. 나중에 RedisStore/PostgresStore로 교체해도
# 아래 get/set 인터페이스만 같으면 호출부(ManusSession)는 안 바뀐다.
class Store:
    """owner_key별 상태 저장소. 다중인프라 전환 시 이 클래스 내부만 교체."""

    def get(self, owner_key):
        raise NotImplementedError

    def set(self, owner_key, value):
        raise NotImplementedError


class FileStore(Store):
    """파일 백엔드 (단일 머신용 임시). owner_key별 파일 분리."""

    def __init__(self, base_dir=None):
        self.base = base_dir or HERE

    def _path(self, owner_key):
        safe = owner_key.replace("/", "_").replace(":", "_")
        return os.path.join(self.base, f".manus_state_{safe}.json")

    def get(self, owner_key):
        p = self._path(owner_key)
        if os.path.exists(p):
            try:
                return json.load(open(p, encoding="utf-8"))
            except Exception:
                pass
        return {"task_id": None, "call_count": 0}

    def set(self, owner_key, value):
        json.dump(value, open(self._path(owner_key), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)


# 기본 저장소 (나중에 환경변수로 RedisStore 등 선택 가능)
def default_store():
    return FileStore()


# ── Late Binding 등급별 저장소 (C-7 최종 정본) ──
# 런타임 등급(micro/heavy)에 따라 상태 저장소도 동적 선택 가능.
# micro=휘발성(짧은 TTL·파일/Redis), heavy=영속(Postgres·VM 디스크).
# resolver.RuntimeTierResolver가 등급 판정 → 여기서 저장소 매칭.
def store_for_tier(tier: str):
    """등급별 저장소 동적 선택 (인터페이스 동일 → 호출부 불변).
    제품 런타임: micro→Redis(휘발), heavy→Postgres(영속). 지금은 FileStore 공통."""
    # 엔진 단계: 구조만 (실제 Redis/Postgres는 제품 인프라·벤더 어댑터)
    return default_store()


# ── owner_key (글로벌 전제 1.2) ─────────────────────────
def make_owner_key(tenant_id=None, org_id=None, user_id=None, project_id=None):
    """모든 세션의 격리 키. (tenant, org, user, project) 조합.
    C-1 결합: org 차원을 지금 예약 — 팀 협업·제품2 tenant_type 확장 시 소급 불가 방지.
    제품1은 org_default 단일, 팀 협업 시 여러 org_. 샤드키는 tenant 그대로(org는 내부)."""
    t = tenant_id or os.environ.get("ENGINE_TENANT_ID", "tenant_local")
    o = org_id or os.environ.get("ENGINE_ORG_ID", "org_default")
    u = user_id or os.environ.get("ENGINE_USER_ID", "user_local")
    p = project_id or PROJECT_ID or "proj_default"
    return f"{t}:{o}:{u}:{p}"


# ── Manus 세션 (stateless 워커 — 상태는 Store에) ─────────
class ManusSession:
    """owner_key별 Manus task 재사용. 워커는 상태를 안 들고, Store에서 읽고 씀."""

    def __init__(self, owner_key=None, store=None):
        if not os.environ.get("MANUS_API_KEY"):
            raise RuntimeError("MANUS_API_KEY 없음")
        self.store = store or default_store()
        self.owner_key = owner_key or make_owner_key()
        self.state = self.store.get(self.owner_key)
        if not self.state.get("task_id"):
            tid = agents.manus_create("엔진 작업 세션 초기화", PROJECT_ID)
            self.state = {"task_id": tid, "call_count": 0, "owner_key": self.owner_key}
            self.store.set(self.owner_key, self.state)
            print(f"[NEW TASK] {tid}")
        print(f"[SESSION] owner={self.owner_key} task_id={self.state['task_id']} "
              f"count={self.state['call_count']}")

    def send(self, prompt):
        if self.state["call_count"] >= MAX_CALLS:
            tid = agents.manus_create(prompt, PROJECT_ID)
            self.state = {"task_id": tid, "call_count": 0, "owner_key": self.owner_key}
            self.store.set(self.owner_key, self.state)
            print(f"[ROTATE] 새 task {tid}")
        result = agents.manus_send(self.state["task_id"], prompt)
        self.state["call_count"] += 1
        self.store.set(self.owner_key, self.state)
        print(f"[CALL #{self.state['call_count']}] task_id={self.state['task_id']}")
        return result

    def task_id(self):
        return self.state.get("task_id")

    def status(self):
        info = agents.manus_detail(self.state["task_id"])
        d = info.get("data", info)
        title = (d.get("metadata", {}) or {}).get("task_title") or d.get("task_title") or d.get("title")
        print(f"[STATUS] owner={self.owner_key} {self.state['task_id']} | {title} | status={d.get('status')}")
        return info


if __name__ == "__main__":
    import sys
    s = ManusSession()
    s.status()
    if len(sys.argv) > 1:
        print(f"\n전송: {sys.argv[1][:50]}")
        out = s.send(sys.argv[1])
        print(json.dumps(out, ensure_ascii=False)[:300])
