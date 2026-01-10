from typing import Optional, Tuple, List
from datetime import datetime, timedelta
import logging
from .models import AccountData, VPSAgentStatus
from .config import settings

logger = logging.getLogger(__name__)


class SimpleCache:
    """Simple in-memory cache with TTL"""

    def __init__(self, ttl_seconds: int = None):
        self.ttl_seconds = ttl_seconds or settings.CACHE_TTL
        self.cached_data: Optional[Tuple[List[AccountData], List[VPSAgentStatus]]] = None
        self.cached_at: Optional[datetime] = None

    def get(self) -> Optional[Tuple[List[AccountData], List[VPSAgentStatus]]]:
        """Get cached data if still valid"""
        if self.cached_data is None or self.cached_at is None:
            return None

        age = datetime.now() - self.cached_at
        if age > timedelta(seconds=self.ttl_seconds):
            logger.info(f"Cache expired (age: {age.seconds}s)")
            return None

        logger.info(f"Cache hit (age: {age.seconds}s)")
        return self.cached_data

    def set(self, data: Tuple[List[AccountData], List[VPSAgentStatus]]):
        """Cache the data"""
        self.cached_data = data
        self.cached_at = datetime.now()
        logger.info("Data cached")

    def clear(self):
        """Clear the cache"""
        self.cached_data = None
        self.cached_at = None
        logger.info("Cache cleared")


# Singleton instance
cache = SimpleCache()
