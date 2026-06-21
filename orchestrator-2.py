#!/usr/bin/env python3
"""
orchestrator.py — L0 작업 분배 엔진 (엔진 v1)
==============================================
arch-core.yaml(단일 진실) 읽어 평면별 에이전트 결정 → 병렬 동시 분배.
agents.py(호출) + state.py(Manus task 재사용) 사용.

★ Manus는 매번 새 task 만들지 않고 state.py의 재사용 세션으로 sendMessage.
  (이전 버전의 task 폭주 문제 해결)

이번 v1 범위:
  arch-core 읽어 평면→에이전트 매핑
  병렬 동시 실행 (ThreadPool)
  Manus=재사용 세션, OpenAI/DeepSeek/Gemini=직접, Cursor=가용, Claude=별도
  결합 + L3b 교차검증 = 다음

실행:
    pip install pyyaml 'httpx[http2]'
    python3 orchestrator.py
"""

import os
import sys
import time
import concurrent.futures as cf

try:
    import yaml
except ImportError:
    print("pyyaml 필요: pip install pyyaml"); sys.exit(1)

import agents
import state as state_mod
try:
    import crosscheck as crosscheck_mod   # L3b 경량 교차검증 (R1~R6)
except Exception:
    crosscheck_mod = None
try:
    import resolver as resolver_mod        # 키소스·연결방식·크레딧 게이트·제품 분기
except Exception:
    resolver_mod = None

HERE = os.path.dirname(os.path.abspath(__file__))
ARCH_CANDIDATES = [os.path.join(HERE, "arch-core.yaml"),
                   os.path.join(HERE, "..", "arch-core.yaml"), "arch-core.yaml"]

CONTRACT = """
[공통 계약 — 모든 평면이 따른다]
- 도메인: 예약. 필드: id(string,'resv_'+nanoid), tenant_id(string),
  start_at(int UTC ms), status('pending'|'confirmed'|'cancelled').
- 함수: validate_reservation(입력) -> {valid: bool, reason: string}
  규칙: tenant_id 비면 invalid / start_at 과거면 invalid /
        status 허용값 아니면 invalid / 그 외 valid.
- 출력: 코드만. 설명 금지. 해당 언어 함수 하나만.
"""

PLANE_LANG = {
    "intelligence": "Python 함수로 (dict 입출력)",
    "execution":    "Rust 함수로 (struct + 함수)",
    "control":      "Go 함수로 (struct + 함수)",
    "frontend":     "TypeScript 함수로 (interface + 함수)",
}


# A1-보강 §2: 부팅 시 1번 읽어 메모리 공유 (1만 동시 요청이 같은 객체 읽기만).
# 읽기 전용 불변 객체라 동시 접근 안전 (락 불필요).
_ARCH_CORE = None  # 모듈 전역 캐시 (최초 1번만 채워짐)


def load_arch_core():
    """arch-core.yaml을 최초 1번만 디스크에서 읽고, 이후는 메모리 객체 공유.
    반환: (core_dict, path). 매 요청 파일 open+파싱하던 병목 제거."""
    global _ARCH_CORE
    if _ARCH_CORE is not None:
        return _ARCH_CORE
    for p in ARCH_CANDIDATES:
        if os.path.exists(p):
            _ARCH_CORE = (yaml.safe_load(open(p, encoding="utf-8")), p)
            return _ARCH_CORE
    print("arch-core.yaml 못 찾음"); sys.exit(1)


def call_agent(call_kind, agent_cfg, prompt, manus_session):
    """call_kind에 따라 agents.py의 적절한 함수 호출."""
    if call_kind == "manus":
        # ★ 재사용 세션 — 새 task 안 만듦
        try:
            manus_session.send(prompt)
            return True, f"Manus 재사용 task에 전송됨 (task_id={manus_session.task_id()})"
        except Exception as e:
            return False, f"{type(e).__name__}: {e}"
    elif call_kind == "openai_compatible":
        return agents.openai_compatible(
            prompt, agent_cfg["key_env"], agent_cfg["api_base"], agent_cfg["model"],
            token_param=agent_cfg.get("token_param", "max_tokens"))
    elif call_kind == "gemini":
        return agents.gemini(prompt, agent_cfg["key_env"], agent_cfg["model"])
    elif call_kind == "cursor":
        return agents.cursor_check(agent_cfg["key_env"])
    elif call_kind == "claude_cli":
        return True, "Claude Code = CLI 경로 (REST 병렬 대상 아님, 별도 핸드오프)"
    return False, f"알 수 없는 call_kind: {call_kind}"


def dispatch(plane, agent_name, agent_cfg, lang_task, manus_session,
             product_resolver=None, owner_key=None):
    prompt = CONTRACT + f"\n[작업] validate_reservation을 {lang_task} 작성."
    kind = agent_cfg.get("call_kind", "openai_compatible")

    # ── S0 루프 연결: 호출 전 resolver 게이트 (키소스·크레딧 precheck) ──
    key_source = None
    if product_resolver is not None and owner_key is not None:
        try:
            ctx = product_resolver.build_context(owner_key, agent_name)
            key_source = ctx.key.source if hasattr(ctx.key, "source") else None
            # 크레딧 precheck: 잔액 부족이면 호출 안 함 (시작 전 차단, A3 사상)
            if hasattr(ctx.credit, "allowed") and not ctx.credit.allowed:
                return {"plane": plane, "agent": agent_name,
                        "model": agent_cfg.get("model"), "ok": False,
                        "out": f"[차단] 크레딧 부족 (owner={owner_key})",
                        "elapsed": 0.0, "blocked": True}
        except Exception as e:
            # resolver 실패는 호출 자체를 막지 않음 (게이트 부재 시 통과 — 데모 환경)
            print(f"  [정보] resolver 게이트 스킵 ({plane}): {type(e).__name__}")

    t0 = time.time()
    try:
        ok, out = call_agent(kind, agent_cfg, prompt, manus_session)
    except Exception as e:
        ok, out = False, f"{type(e).__name__}: {e}"
    return {"plane": plane, "agent": agent_name, "model": agent_cfg.get("model"),
            "ok": ok, "out": out, "elapsed": round(time.time() - t0, 1),
            "key_source": key_source}


def run():
    core, path = load_arch_core()
    agents_cfg, planes = core["agents"], core["planes"]

    print("=" * 72)
    print("  L0 작업 분배 엔진 v1 — arch-core 기반 병렬 동시 실행")
    print(f"  단일 진실: {os.path.relpath(path)}")
    print("=" * 72)

    # Manus 재사용 세션 준비 (한 번만 생성, 이후 재사용)
    manus_session = None
    if any(planes.get(p, {}).get("agent") and
           agents_cfg.get(planes[p]["agent"], {}).get("call_kind") == "manus"
           for p in PLANE_LANG):
        try:
            manus_session = state_mod.ManusSession()
        except Exception as e:
            print(f"  [경고] Manus 세션 준비 실패: {e}")

    # ── S0 루프 연결: ProductResolver + owner_key (키소스·크레딧 게이트) ──
    product_resolver = None
    owner_key = None
    if resolver_mod is not None:
        try:
            product_resolver = resolver_mod.ProductResolver(core)
            owner_key = state_mod.make_owner_key()  # 4-part (tenant:org:user:project)
            print(f"  resolver 게이트 활성 (owner={owner_key})")
        except Exception as e:
            print(f"  [정보] resolver 게이트 비활성: {type(e).__name__}")

    jobs = []
    for plane, lang in PLANE_LANG.items():
        if plane not in planes:
            continue
        an = planes[plane]["agent"]
        jobs.append((plane, an, agents_cfg[an], lang))

    print("  분배:")
    for pn, an, ac, _ in jobs:
        print(f"    - {pn:14} → {an} ({ac.get('model')}) [{ac.get('call_kind')}]")
    print("-" * 72)

    t0 = time.time()
    results = {}
    with cf.ThreadPoolExecutor(max_workers=max(1, len(jobs))) as ex:
        futs = {ex.submit(dispatch, p, a, c, l, manus_session,
                          product_resolver, owner_key): p
                for p, a, c, l in jobs}
        for fut in cf.as_completed(futs):
            r = fut.result()
            results[r["plane"]] = r
            print(f"  [{'OK ' if r['ok'] else 'ERR'}] {r['plane']:14} "
                  f"{r['agent']:14} ({r['elapsed']:>5}s)")
    total = round(time.time() - t0, 1)
    print("-" * 72)
    print(f"  병렬 소요: {total}s")
    print("=" * 72)

    for plane, r in results.items():
        print(f"\n### {plane} → {r['agent']} ({r['model']}) {'OK' if r['ok'] else 'ERR'}")
        print("-" * 50)
        print((r["out"] or "")[:600])

    ok = sum(1 for r in results.values() if r["ok"])
    print("\n" + "=" * 72)
    print(f"  성공 {ok}/{len(results)} | 병렬 {total}s")
    print("=" * 72)

    # ── S0 루프 연결: L3b 교차검증 + 유한 재시도 (재명령→재검증) ──
    # 병렬 분배 결과를 신뢰하지 않고 검증 → 불일치 평면만 재명령, 상한까지 반복.
    if crosscheck_mod is None:
        print("  [정보] crosscheck 모듈 미연결 — 검증 생략")
        return {"results": results, "crosscheck_pass": None, "redo": [], "retries": 0}

    MAX_RETRY = 2  # 유한 재시도 상한 (무한 루프 방지; 수치는 dayout)
    job_map = {p: (p, a, c, l) for p, a, c, l in jobs}
    retries = 0
    try:
        all_pass, redo = crosscheck_mod.crosscheck_all(results)
        while not all_pass and retries < MAX_RETRY:
            redo_planes = [c.plane for c in redo]
            print(f"  → 재명령 대상 {redo_planes} (재시도 {retries+1}/{MAX_RETRY}, 통과 평면 유지)")
            # 불일치 평면만 재 dispatch (통과 평면은 그대로)
            with cf.ThreadPoolExecutor(max_workers=max(1, len(redo_planes))) as ex:
                rf = {ex.submit(dispatch, *job_map[p], manus_session,
                                product_resolver, owner_key): p
                      for p in redo_planes if p in job_map}
                for fut in cf.as_completed(rf):
                    r = fut.result()
                    results[r["plane"]] = r  # 결과 갱신
            retries += 1
            all_pass, redo = crosscheck_mod.crosscheck_all(results)  # 재검증

        if all_pass:
            print(f"  ✅ 전 평면 계약 일치 (재시도 {retries}회)")
        else:
            print(f"  ⚠ 상한({MAX_RETRY}) 도달 — 잔여 불일치 {[c.plane for c in redo]} → 운영자 에스컬레이션")
        return {"results": results, "crosscheck_pass": all_pass,
                "redo": [c.plane for c in redo], "retries": retries}
    except Exception as e:
        print(f"  [경고] 교차검증/재시도 단계 실패: {type(e).__name__}: {e}")
        return {"results": results, "crosscheck_pass": None, "redo": [], "retries": retries}


if __name__ == "__main__":
    run()
