import json
import os
from typing import Dict, List, Optional
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class TradeCacheManager:
    """Manages incremental trade history caching per account"""

    def __init__(self, cache_file: str = "trade_cache.json"):
        self.cache_file = Path(__file__).parent / cache_file
        self.cache: Dict[str, Dict] = self._load_cache()

    def _load_cache(self) -> Dict[str, Dict]:
        """Load trade cache from JSON file"""
        try:
            if self.cache_file.exists():
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    logger.info(f"Loaded trade cache with {len(data)} accounts")
                    return data
            else:
                logger.info("No existing trade cache file found, starting fresh")
                return {}
        except Exception as e:
            logger.error(f"Error loading trade cache: {str(e)}")
            return {}

    def _save_cache(self):
        """Save trade cache to JSON file"""
        try:
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(self.cache, f, indent=2, ensure_ascii=False)
            logger.info(f"Trade cache saved successfully ({len(self.cache)} accounts)")
        except Exception as e:
            logger.error(f"Error saving trade cache: {str(e)}")

    def get_last_sync_time(self, account_number: int) -> Optional[str]:
        """
        Get the last sync timestamp for an account

        Args:
            account_number: The account number

        Returns:
            ISO format timestamp string or None if never synced
        """
        account_key = str(account_number)
        if account_key in self.cache:
            return self.cache[account_key].get('last_sync_time')
        return None

    def get_cached_trades(self, account_number: int) -> List[Dict]:
        """
        Get cached trades for an account

        Args:
            account_number: The account number

        Returns:
            List of trade dictionaries
        """
        account_key = str(account_number)
        if account_key in self.cache:
            return self.cache[account_key].get('trades', [])
        return []

    def update_trades(self, account_number: int, new_trades: List[Dict]) -> Dict:
        """
        Update cached trades with new trades (incremental update)

        Args:
            account_number: The account number
            new_trades: List of new trade dictionaries

        Returns:
            Dictionary with merged trades and statistics
        """
        account_key = str(account_number)

        # Get existing trades
        existing_trades = self.get_cached_trades(account_number)

        # Create a map of existing trades by position_id for quick lookup
        existing_trades_map = {trade['position_id']: trade for trade in existing_trades}

        # Merge new trades (new trades overwrite existing ones with same position_id)
        for new_trade in new_trades:
            existing_trades_map[new_trade['position_id']] = new_trade

        # Convert back to list and sort by exit_time (most recent first)
        merged_trades = list(existing_trades_map.values())
        merged_trades.sort(key=lambda x: x.get('exit_time', ''), reverse=True)

        # Calculate totals
        total_profit = sum(trade.get('profit', 0) for trade in merged_trades)
        total_commission = sum(trade.get('commission', 0) for trade in merged_trades)

        # Update cache
        self.cache[account_key] = {
            'trades': merged_trades,
            'total_trades': len(merged_trades),
            'total_profit': round(total_profit, 2),
            'total_commission': round(total_commission, 2),
            'last_sync_time': datetime.now().isoformat(),
            'last_update': datetime.now().isoformat()
        }

        # Save to disk
        self._save_cache()

        logger.info(f"Updated trade cache for account {account_number}: "
                   f"{len(new_trades)} new trades, {len(merged_trades)} total trades")

        return {
            'account_number': account_number,
            'trades': merged_trades,
            'total_trades': len(merged_trades),
            'total_profit': round(total_profit, 2),
            'total_commission': round(total_commission, 2),
            'new_trades_count': len(new_trades)
        }

    def get_trade_summary(self, account_number: int) -> Dict:
        """
        Get trade summary for an account

        Args:
            account_number: The account number

        Returns:
            Dictionary with trade statistics
        """
        account_key = str(account_number)
        if account_key in self.cache:
            cache_data = self.cache[account_key]
            return {
                'account_number': account_number,
                'trades': cache_data.get('trades', []),
                'total_trades': cache_data.get('total_trades', 0),
                'total_profit': cache_data.get('total_profit', 0),
                'total_commission': cache_data.get('total_commission', 0),
                'last_sync_time': cache_data.get('last_sync_time'),
                'cached': True
            }
        else:
            return {
                'account_number': account_number,
                'trades': [],
                'total_trades': 0,
                'total_profit': 0,
                'total_commission': 0,
                'last_sync_time': None,
                'cached': False
            }

    def clear_account_cache(self, account_number: int) -> bool:
        """
        Clear trade cache for a specific account

        Args:
            account_number: The account number

        Returns:
            True if cache was cleared, False if no cache existed
        """
        account_key = str(account_number)
        if account_key in self.cache:
            del self.cache[account_key]
            self._save_cache()
            logger.info(f"Cleared trade cache for account {account_number}")
            return True
        return False

    def clear_all_cache(self):
        """Clear all trade cache"""
        self.cache = {}
        self._save_cache()
        logger.info("Cleared all trade cache")


# Singleton instance
trade_cache_manager = TradeCacheManager()
