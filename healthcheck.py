#!/usr/bin/env python3
"""
healthcheck.py — 에이전트 헬스체크 (엔진 v1)
=============================================
agents.py 공통 모듈을 사용해 5개 에이전트 연결을 점검.
★ Manus는 task 생성 없이 detail 조회로만 확인 (rate limit/크레딧/오염 방지).

실행:
    pip install 'httpx[http2]'
    python3 healthcheck.py
"""

import os
import sys
import json

import agents
import state as state_mod


def check_openai():
    ok, out = agents.openai_compatible(
        "Reply with only: 1", "OPENAI_API_KEY",
        "https://api.openai.com/v1", "gpt-5.5",
        token_param="max_completion_tokens", max_tokens=16)
    return "OpenAI/Codex (Rust)", ok, out


def check_deepseek():
    ok, out = agents.openai_compatible(
        "Reply with only: 1", "DEEPSEEK_API_KEY",
        "https://api.deepseek.com", "deepseek-v4-flash", max_tokens=16)
    return "DeepSeek (bulk)", ok, out


def check_gemini():
    ok, out = agents.gemini("Reply with only: 1", "GEMINI_API_KEY",
                            "gemini-3.1-pro-preview", max_tokens=16)
    return "Gemini (analysis)", ok, out


def check_cursor():
    ok, out = agents.cursor_check("CURSOR_API_KEY")
    return "Cursor (React)", ok, out


def check_manus():
    """Manus: 새 task 생성 안 함. 기존 state task_id를 detail 조회.
    state 없으면(첫 실행 전) 키만 확인하고 manual 표시."""
    if not os.environ.get("MANUS_API_KEY"):
        return "Manus (Python)", False, "MANUS_API_KEY 없음"
    tid = None
    if os.path.exists(state_mod.STATE_FILE):
        try:
            tid = json.load(open(state_mod.STATE_FILE, encoding="utf-8")).get("task_id")
        except Exception:
            pass
    if not tid:
        return "Manus (Python)", None, "state 없음 — state.py 1회 실행 후 검증됨 (생성 회피)"
    try:
        info = agents.manus_detail(tid)
        return "Manus (Python)", True, f"task.detail OK | {str(info)[:80]}"
    except Exception as e:
        return "Manus (Python)", False, f"{type(e).__name__}: {e}"


def check_claude():
    return "Claude Code (Go)", None, "CLI 경로 (REST 아님) — 별도 핸드오프"


def run():
    print("=" * 66)
    print("  엔진 v1 — 에이전트 헬스체크 (agents.py 공통모듈)")
    print("=" * 66)
    checks = [check_manus, check_openai, check_deepseek,
              check_gemini, check_cursor, check_claude]
    results = []
    for fn in checks:
        try:
            name, ok, detail = fn()
        except Exception as e:
            name, ok, detail = fn.__name__, False, f"{type(e).__name__}: {e}"
        results.append((name, ok, detail))
        icon = {True: "✅", False: "❌", None: "🔶"}[ok]
        print(f"  {icon} {name:22} {detail[:90]}")
    verified = sum(1 for _, ok, _ in results if ok is True)
    print("=" * 66)
    print(f"  verified {verified} (REST 에이전트) | 🔶=수동/별도경로")
    print("=" * 66)


if __name__ == "__main__":
    run()
