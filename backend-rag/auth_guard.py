"""Authentication for the FastAPI RAG server (ICT306 requirements AU1, I2, I3, A1).

Sessions are issued and revoked by the Node server. Rather than duplicating the signing key here,
every request is validated by asking Node who the session cookie belongs to (/api/me). That keeps
logout, role changes and expiry authoritative in one place, and fails closed if Node is unreachable.
"""
import hmac
import os
import threading
import time
from collections import defaultdict, deque

import requests
from fastapi import HTTPException, Request

NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:5000")
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def forward_cookies(request: Request) -> dict:
    return {k: v for k, v in request.cookies.items() if k in ("sid", "csrf")}


def current_user(request: Request) -> dict:
    sid = request.cookies.get("sid")
    if not sid:
        raise HTTPException(status_code=401, detail="Authentication required.")
    try:
        r = requests.get(f"{NODE_BACKEND_URL}/api/me", cookies={"sid": sid}, timeout=5)
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="Authentication service unavailable.")  # fail closed
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Authentication required.")
    data = r.json()
    if request.method not in _SAFE_METHODS:
        header = request.headers.get("x-csrf-token", "")
        cookie = request.cookies.get("csrf", "")
        if not header or not hmac.compare_digest(header, cookie):
            raise HTTPException(status_code=403, detail="Invalid CSRF token.")
    return {"email": data["email"], "role": data["role"], "name": data.get("name", ""), "cookies": forward_cookies(request)}


def require_roles(*roles):
    def dependency(request: Request) -> dict:
        user = current_user(request)
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="You do not have permission to do that.")
        return user
    return dependency


# --- A1: per-user rate limit for the expensive model endpoints ------------------------------------
_hits = defaultdict(deque)
_lock = threading.Lock()
CHAT_LIMIT = int(os.getenv("CHAT_RATE_LIMIT", "20"))
CHAT_WINDOW_SECONDS = 60


def check_rate_limit(key: str, limit: int = None, window: int = CHAT_WINDOW_SECONDS):
    limit = limit or CHAT_LIMIT
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and q[0] <= now - window:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")
        q.append(now)


def reset_rate_limits():
    with _lock:
        _hits.clear()
