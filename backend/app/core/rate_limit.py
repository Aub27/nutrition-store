"""Small in-memory sliding-window rate limiter.

Good enough for a single-process / single-container deployment. When you scale to several
workers or hosts, put the limits in your reverse proxy (see deploy/nginx.conf) or swap this
class for a Redis-backed one — the interface is intentionally tiny.
"""
import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, window: float, now: float) -> deque[float]:
        q = self._hits[key]
        while q and q[0] <= now - window:
            q.popleft()
        if not q:
            self._hits.pop(key, None)
            return deque()
        return q

    def count(self, key: str, window: float) -> int:
        with self._lock:
            return len(self._prune(key, window, time.monotonic()))

    def retry_after(self, key: str, window: float) -> int:
        with self._lock:
            now = time.monotonic()
            q = self._prune(key, window, now)
            return max(1, int(q[0] + window - now) + 1) if q else 1

    def hit(self, key: str, window: float) -> None:
        with self._lock:
            self._hits[key].append(time.monotonic())

    def allow(self, key: str, limit: int, window: float) -> bool:
        """Record a hit; return False when the limit is already reached."""
        with self._lock:
            now = time.monotonic()
            q = self._prune(key, window, now)
            if len(q) >= limit:
                return False
            self._hits[key].append(now)
            return True

    def clear(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()
