"""Simple in-memory cache with TTL."""
import time
import logging

log = logging.getLogger("influx.cache")


class Cache:
    def __init__(self, ttl_seconds=300):
        self.ttl = ttl_seconds
        self.store = {}

    def get(self, key: str):
        """Get a cached value, return None if expired or missing."""
        if key not in self.store:
            return None
        value, timestamp = self.store[key]
        if time.time() - timestamp > self.ttl:
            del self.store[key]
            return None
        return value

    def set(self, key: str, value):
        """Cache a value."""
        self.store[key] = (value, time.time())

    def invalidate(self, pattern: str = ""):
        """Invalidate entries matching pattern (prefix-based)."""
        if not pattern:
            self.store.clear()
        else:
            to_delete = [k for k in self.store if k.startswith(pattern)]
            for k in to_delete:
                del self.store[k]


cache = Cache()
