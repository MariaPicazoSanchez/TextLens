import os
import time
from collections import defaultdict

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# ── Trusted proxies (for real-IP extraction) ──────────────────────────────────
# Set TRUSTED_PROXIES in .env as a comma-separated list of proxy IPs, e.g.:
#   TRUSTED_PROXIES=127.0.0.1,10.0.0.1
# Leave unset (or empty) when running without a reverse proxy.
_trusted_proxies: set[str] = {
    ip.strip()
    for ip in os.getenv("TRUSTED_PROXIES", "").split(",")
    if ip.strip()
}


def _get_client_ip(request: Request) -> str:
    peer = request.client.host if request.client else None

    if peer in _trusted_proxies:
        # X-Forwarded-For: client, proxy1, proxy2  →  take leftmost (real client)
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()

    return peer or "unknown"


# ── Security headers ──────────────────────────────────────────────────────────

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.update(_SECURITY_HEADERS)
        return response


# ── Body size limit ───────────────────────────────────────────────────────────
# /upload is excluded — file size is already enforced inside the route handler.
_BODY_LIMIT_BYTES = 100 * 1024  # 100 KB for JSON endpoints


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return await call_next(request)

        if request.url.path.startswith("/upload"):
            return await call_next(request)

        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > _BODY_LIMIT_BYTES:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request body too large."},
            )

        return await call_next(request)


# ── Rate limiter ──────────────────────────────────────────────────────────────

_LIMITS = {
    "ai":     {"max_requests": 20, "window": 60},
    "upload": {"max_requests": 10, "window": 60},
}

_AI_PREFIXES     = ("/analyze", "/translate", "/chat", "/compare", "/detect")
_UPLOAD_PREFIXES = ("/upload",)
_SKIP_PATHS      = ("/ping",)


def _category(path: str) -> str | None:
    if path in _SKIP_PATHS:
        return None
    if any(path.startswith(p) for p in _UPLOAD_PREFIXES):
        return "upload"
    if any(path.startswith(p) for p in _AI_PREFIXES):
        return "ai"
    return None


class RateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        # category → ip → [timestamp, ...]
        self._store: dict[str, dict[str, list[float]]] = defaultdict(
            lambda: defaultdict(list)
        )

    def _check(self, ip: str, category: str) -> tuple[bool, int]:
        cfg = _LIMITS[category]
        max_req, window = cfg["max_requests"], cfg["window"]
        now = time.monotonic()
        cutoff = now - window

        bucket = self._store[category][ip]
        recent = [t for t in bucket if t > cutoff]

        if len(recent) >= max_req:
            retry_after = int(recent[0] + window - now) + 1
            self._store[category][ip] = recent
            return False, retry_after

        recent.append(now)
        self._store[category][ip] = recent
        return True, 0

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        category = _category(request.url.path)
        if category is None:
            return await call_next(request)

        ip = _get_client_ip(request)
        allowed, retry_after = self._check(ip, category)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
                headers={"Retry-After": str(retry_after)},
            )

        return await call_next(request)
