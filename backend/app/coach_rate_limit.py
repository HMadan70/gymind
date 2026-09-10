"""
Per-authenticated-user rate limiting for POST /coach.

Deliberately separate from app/rate_limit.py: that limiter keys by client IP
(appropriate for /auth/login and /auth/register, which run before a user is
known), but Coach is authenticated, and the task this module was built for
is explicit that the key must come from backend-verified identity - a
client-supplied id could be spoofed, and IP-keying would let one user across
several networks each get a fresh budget while punishing everyone behind a
shared IP (NAT, campus wifi, etc). So this keys by current_user.id, which
only exists after auth.require_profile has already verified the JWT.

In-memory, single-process. Documented limitations, not hidden:
- counters are lost on process restart
- not shared across multiple worker processes if this app is ever run with
  more than one uvicorn/gunicorn worker
- not usable across multiple hosts
This app currently runs as one FastAPI process behind Docker Compose, so
that's an acceptable, explicitly-scoped tradeoff. Introducing Redis to fix
a scaling problem this deployment doesn't have would be the wrong kind of
complexity for what this is; revisit if/when the app actually runs multiple
workers or hosts.
"""
import os
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, status

REQUESTS = int(os.getenv("COACH_RATE_LIMIT_REQUESTS", "10"))
WINDOW_SECONDS = int(os.getenv("COACH_RATE_LIMIT_WINDOW_SECONDS", "60"))

_lock = Lock()
_hits: dict[int, deque] = defaultdict(deque)


def check_coach_rate_limit(user_id: int) -> None:
    """
    Sliding window: raises 429 (with Retry-After) if `user_id` has already
    made REQUESTS calls in the trailing WINDOW_SECONDS. Callers must check
    this before doing anything else - no DB write, no provider call - so a
    rejected request has no side effect at all.
    """
    now = time.monotonic()
    with _lock:
        hits = _hits[user_id]
        while hits and now - hits[0] >= WINDOW_SECONDS:
            hits.popleft()

        if len(hits) >= REQUESTS:
            retry_after = max(1, int(WINDOW_SECONDS - (now - hits[0])))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many Coach requests. Please try again shortly.",
                headers={"Retry-After": str(retry_after)},
            )

        hits.append(now)
