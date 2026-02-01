"""
Smart Cache - Per-account caching with selective invalidation.

Key improvements over SimpleCache:
- Per-account storage (Dict instead of Tuple)
- Selective invalidation (only affected account, not all)
- Field-level updates (update phase without full refresh)
- Thread-safe async operations
- Cache statistics for monitoring
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Any, Tuple
from .models import AccountData, VPSAgentStatus
from .config import settings
import logging

logger = logging.getLogger(__name__)


class SmartCache:
    """
    Per-account cache with selective invalidation and field-level updates.

    Architecture:
        accounts: {account_number: (AccountData, cached_at)}
        agent_statuses: {agent_name: (VPSAgentStatus, cached_at)}

    Key Methods:
        - get_account(num) -> Get single account
        - get_all_accounts() -> Get all cached accounts
        - set_accounts(list) -> Bulk cache update
        - invalidate_account(num) -> Remove ONE account from cache
        - update_account_field(num, field, value) -> Update without invalidation
    """

    def __init__(self, ttl_seconds: int = None):
        self.ttl_seconds = ttl_seconds or settings.CACHE_TTL

        # Per-account cache: {account_number: (AccountData, cached_at)}
        self._accounts: Dict[int, Tuple[AccountData, datetime]] = {}

        # Agent status cache: {agent_name: (VPSAgentStatus, cached_at)}
        self._agent_statuses: Dict[str, Tuple[VPSAgentStatus, datetime]] = {}

        # Timestamp of last full refresh
        self._last_full_refresh: Optional[datetime] = None

        # Async lock for thread-safe operations
        self._lock = asyncio.Lock()

        logger.info(f"SmartCache initialized with TTL={self.ttl_seconds}s")

    def _is_expired(self, cached_at: datetime) -> bool:
        """Check if a cache entry is expired."""
        return datetime.now() - cached_at > timedelta(seconds=self.ttl_seconds)

    # ========== ACCOUNT OPERATIONS ==========

    async def get_account(self, account_number: int) -> Optional[AccountData]:
        """
        Get a single account from cache if valid.

        Returns None if:
            - Account not in cache
            - Account entry expired
        """
        async with self._lock:
            if account_number not in self._accounts:
                logger.debug(f"Cache miss: account {account_number} not found")
                return None

            account, cached_at = self._accounts[account_number]

            if self._is_expired(cached_at):
                del self._accounts[account_number]
                logger.debug(f"Cache miss: account {account_number} expired")
                return None

            logger.debug(f"Cache hit: account {account_number}")
            return account

    async def get_all_accounts(self) -> Optional[List[AccountData]]:
        """
        Get all cached accounts if cache is fresh.

        Returns None if:
            - No accounts cached
            - Full refresh is stale (older than TTL)
        """
        async with self._lock:
            # Check if we have a recent full refresh
            if not self._last_full_refresh:
                logger.info("Cache miss: no full refresh yet")
                return None

            if self._is_expired(self._last_full_refresh):
                logger.info(f"Cache expired (full refresh age: {datetime.now() - self._last_full_refresh})")
                return None

            # Collect valid accounts
            valid_accounts = []
            expired_keys = []

            for acc_num, (account, cached_at) in self._accounts.items():
                if not self._is_expired(cached_at):
                    valid_accounts.append(account)
                else:
                    expired_keys.append(acc_num)

            # Clean up expired entries
            for key in expired_keys:
                del self._accounts[key]

            if not valid_accounts:
                logger.info("Cache miss: all accounts expired")
                return None

            logger.info(f"Cache hit: returning {len(valid_accounts)} accounts")
            return valid_accounts

    async def set_account(self, account: AccountData):
        """Cache a single account."""
        async with self._lock:
            self._accounts[account.account_number] = (account, datetime.now())
            logger.debug(f"Cached account {account.account_number}")

    async def set_accounts(self, accounts: List[AccountData]):
        """
        Bulk cache update for multiple accounts.
        Called after fetch_all_agents().
        """
        async with self._lock:
            now = datetime.now()
            for account in accounts:
                self._accounts[account.account_number] = (account, now)
            self._last_full_refresh = now
            logger.info(f"Bulk cached {len(accounts)} accounts")

    async def invalidate_account(self, account_number: int):
        """
        Invalidate only ONE account from cache.

        This is the key improvement - after a trade, only the
        affected account is removed, not all 69 accounts.
        """
        async with self._lock:
            if account_number in self._accounts:
                del self._accounts[account_number]
                logger.info(f"Invalidated cache for account {account_number}")
            else:
                logger.debug(f"Account {account_number} not in cache (no-op)")

    async def update_account_field(self, account_number: int, field: str, value: Any) -> bool:
        """
        Update a single field on a cached account WITHOUT invalidation.

        Use cases:
            - Phase update: update_account_field(123, "phase", "F2")
            - VS update: update_account_field(123, "vs_group", "VS-1")

        Returns True if update succeeded, False if account not in cache.
        """
        async with self._lock:
            if account_number not in self._accounts:
                logger.debug(f"Cannot update field: account {account_number} not in cache")
                return False

            account, cached_at = self._accounts[account_number]

            # Check if expired
            if self._is_expired(cached_at):
                del self._accounts[account_number]
                logger.debug(f"Cannot update field: account {account_number} expired")
                return False

            # Create updated account with new field value
            account_dict = account.model_dump()
            account_dict[field] = value
            updated_account = AccountData(**account_dict)

            # Store with current timestamp (refresh TTL)
            self._accounts[account_number] = (updated_account, datetime.now())
            logger.info(f"Updated {field}={value} for account {account_number} in cache")
            return True

    # ========== AGENT STATUS OPERATIONS ==========

    async def set_agent_statuses(self, statuses: List[VPSAgentStatus]):
        """Cache agent statuses after fetch."""
        async with self._lock:
            now = datetime.now()
            for status in statuses:
                self._agent_statuses[status.agent_name] = (status, now)
            logger.debug(f"Cached {len(statuses)} agent statuses")

    async def get_agent_statuses(self) -> Optional[List[VPSAgentStatus]]:
        """Get all cached agent statuses."""
        async with self._lock:
            if not self._agent_statuses:
                return None

            valid_statuses = []
            for name, (status, cached_at) in self._agent_statuses.items():
                if not self._is_expired(cached_at):
                    valid_statuses.append(status)

            return valid_statuses if valid_statuses else None

    # ========== CACHE MANAGEMENT ==========

    async def clear(self):
        """Clear all cache (use sparingly - prefer invalidate_account)."""
        async with self._lock:
            count = len(self._accounts)
            self._accounts.clear()
            self._agent_statuses.clear()
            self._last_full_refresh = None
            logger.info(f"Cache cleared ({count} accounts removed)")

    def stats(self) -> Dict:
        """Get cache statistics for monitoring."""
        return {
            "accounts_cached": len(self._accounts),
            "agents_cached": len(self._agent_statuses),
            "last_full_refresh": self._last_full_refresh.isoformat() if self._last_full_refresh else None,
            "ttl_seconds": self.ttl_seconds
        }

    # ========== BACKWARD COMPATIBILITY ==========
    # These methods maintain compatibility with existing code during migration

    def get(self) -> Optional[Tuple[List[AccountData], List[VPSAgentStatus]]]:
        """
        DEPRECATED: Synchronous get for backward compatibility.
        Use get_all_accounts() instead.
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Can't run async in sync context when loop is running
                # Return None to force refresh
                return None
            accounts = loop.run_until_complete(self.get_all_accounts())
            statuses = loop.run_until_complete(self.get_agent_statuses())
            if accounts:
                return (accounts, statuses or [])
            return None
        except:
            return None

    def set(self, data: Tuple[List[AccountData], List[VPSAgentStatus]]):
        """
        DEPRECATED: Synchronous set for backward compatibility.
        Use set_accounts() instead.
        """
        accounts, statuses = data
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Schedule for later
                asyncio.create_task(self._async_set(accounts, statuses))
            else:
                loop.run_until_complete(self._async_set(accounts, statuses))
        except:
            pass

    async def _async_set(self, accounts: List[AccountData], statuses: List[VPSAgentStatus]):
        await self.set_accounts(accounts)
        await self.set_agent_statuses(statuses)


# ========== SINGLETON INSTANCES ==========

# New smart cache (use this going forward)
smart_cache = SmartCache()

# Backward compatible alias (for gradual migration)
cache = smart_cache
