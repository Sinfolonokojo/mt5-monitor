"""Simple in-memory cache for account number to VPS agent mapping"""
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)


class AccountVPSCache:
    """Cache mapping account numbers to their VPS agent names"""

    def __init__(self):
        self._cache: Dict[int, str] = {}  # account_number -> vps_agent_name

    def update(self, account_number: int, vps_source: str):
        """Update the mapping for an account"""
        self._cache[account_number] = vps_source

    def update_bulk(self, accounts: list):
        """Update mappings for multiple accounts"""
        for account in accounts:
            account_number = account.get("account_number")
            vps_source = account.get("vps_source")
            if account_number and vps_source:
                self._cache[account_number] = vps_source
        logger.info(f"Updated account-VPS cache with {len(self._cache)} mappings")

    def get(self, account_number: int) -> Optional[str]:
        """Get the VPS agent name for an account"""
        return self._cache.get(account_number)

    def clear(self):
        """Clear the entire cache"""
        self._cache = {}
        logger.info("Cleared account-VPS cache")

    def size(self) -> int:
        """Get the number of cached mappings"""
        return len(self._cache)


# Singleton instance
account_vps_cache = AccountVPSCache()
