#!/usr/bin/env python3
"""
agents.py — 에이전트 호출 공통 모듈 (단일 소스)
================================================
모든 에이전트(Manus/OpenAI/DeepSeek/Gemini/Cursor)의 실제 HTTP 호출을
여기 한 곳에 모은다. healthcheck.py 와 orchestrator.py 가 이것을 import.
→ 호출 방식이 바뀌면 이 파일만 고치면 된다 (중복 제거).

모든 형식은 2026-06-15~16 실측(HTTP 200)으로 확정됨:
  Manus  v2: x-manus-api-key, /v2/task.{create,sendMessage,detail},
             body={message:{content:[{type:text,text}]}}, HTTP/2 필수
  OpenAI    : Bearer, /v1/chat/completions, max_completion_tokens (gpt-5.x)
  DeepSeek  : Bearer, /chat/completions, max_tokens
  Gemini    : ?key=, /v1beta/models/{model}:generateContent
  Cursor    : Bearer, GET /v1/me (가용확인; 코드생성은 repo 비동기)
  Claude    : CLI 별도 (REST 아님)

키는 기본 환경변수(우리 키=managed). 단 resolver가 BYOK 고객키를 주입하면
그걸 우선 사용 → 같은 코드가 고객키(BYOK)·우리키(크레딧대행) 둘 다 처리.
키 값은 코드에 하드코딩 없음.
task_id는 .manus_state.json 자동관리 (state.py).
"""

import os
import json
import urllib.request
import urllib.error


# ── HTTP 헬퍼 (urllib, 표준 라이브러리) ──────────────────
def _post(url, headers, payload, timeout=120):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    for k, v in headers.items():
        req.add_unredirected_header(k, v)   # 헤더 케이스 보존
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


def _get(url, headers, timeout=60):
    req = urllib.request.Request(url, method="GET")
    for k, v in headers.items():
        req.add_unredirected_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


# ── Manus v2 (httpx, HTTP/2 필수) ────────────────────────
MANUS_BASE = "https://api.manus.ai/v2"


def _manus_headers():
    key = os.environ.get("MANUS_API_KEY", "")
    return {"x-manus-api-key": key, "accept": "application/json",
            "content-type": "application/json"}


def _manus_content(text):
    """Manus v2 message 형식. type:text 필수(없으면 400)."""
    return {"message": {"content": [{"type": "text", "text": text}]}}


def manus_create(prompt, project_id=None):
    """POST /v2/task.create → task_id (최상위). HTTP/2 필수."""
    import httpx
    body = _manus_content(prompt)
    if project_id:
        body["project_id"] = project_id
    with httpx.Client(http2=True, timeout=60) as c:
        r = c.post(f"{MANUS_BASE}/task.create", headers=_manus_headers(), json=body)
        r.raise_for_status()
        j = r.json()
    return j.get("task_id") or j.get("data", {}).get("id")


def manus_send(task_id, prompt):
    """POST /v2/task.sendMessage → 같은 task에 이어감 (맥락 유지)."""
    import httpx
    body = {"task_id": task_id, **_manus_content(prompt)}
    with httpx.Client(http2=True, timeout=60) as c:
        r = c.post(f"{MANUS_BASE}/task.sendMessage", headers=_manus_headers(), json=body)
        r.raise_for_status()
        return r.json()


def manus_detail(task_id):
    """GET /v2/task.detail → task 상태 (생성 없음, 헬스체크용)."""
    import httpx
    with httpx.Client(http2=True, timeout=30) as c:
        r = c.get(f"{MANUS_BASE}/task.detail", headers=_manus_headers(),
                  params={"task_id": task_id})
        r.raise_for_status()
        return r.json()


# ── OpenAI 호환 (OpenAI, DeepSeek) ───────────────────────
def openai_compatible(prompt, key_env, base_url, model, token_param="max_tokens",
                      max_tokens=800, key=None):
    # key가 주입되면(resolver가 BYOK/managed 해석한 결과) 그걸 우선 사용.
    # 안 주어지면 환경변수(=우리 키, managed 기본). → 같은 코드가 두 방식 처리.
    if key is None:
        key = os.environ.get(key_env)
    if not key:
        return False, f"키 없음 (key_env={key_env})"
    payload = {"model": model, "messages": [{"role": "user", "content": prompt}]}
    payload[token_param] = max_tokens
    status, body = _post(f"{base_url}/chat/completions",
                         {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                         payload)
    if status == 200:
        try:
            return True, json.loads(body)["choices"][0]["message"]["content"]
        except Exception:
            return True, body[:200]
    return False, f"HTTP {status} | {body[:160]}"


# ── Gemini ───────────────────────────────────────────────
def gemini(prompt, key_env, model, max_tokens=800, key=None):
    if key is None:
        key = os.environ.get(key_env)
    if not key:
        return False, f"키 없음 (key_env={key_env})"
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{model}:generateContent?key={key}")
    status, body = _post(url, {"Content-Type": "application/json"},
                         {"contents": [{"parts": [{"text": prompt}]}]})
    if status == 200:
        try:
            return True, json.loads(body)["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            return True, body[:200]
    return False, f"HTTP {status} | {body[:160]}"


# ── Cursor (가용 확인; 코드생성은 repo 비동기) ────────────
def cursor_check(key_env):
    key = os.environ.get(key_env)
    if not key:
        return False, f"{key_env} 환경변수 없음"
    status, body = _get("https://api.cursor.com/v1/me",
                        {"Authorization": f"Bearer {key}", "accept": "application/json"})
    if status == 200:
        return True, "가용 확인 (React 코드생성은 repo 대상 비동기 — 다음 단계)"
    return False, f"HTTP {status} | {body[:120]}"
