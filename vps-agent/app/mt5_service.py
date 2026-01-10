import MetaTrader5 as mt5
from typing import Optional
from datetime import datetime
import logging
from .models import AccountInfo, AccountResponse

logger = logging.getLogger(__name__)


class MT5Service:
    """Service for interacting with a specific MT5 terminal (already logged in)"""

    def __init__(self, terminal_path: str, display_name: str):
        """
        Initialize service for a specific terminal

        Args:
            terminal_path: Full path to MT5 terminal executable
            display_name: Human-readable name for this account
        """
        self.terminal_path = terminal_path
        self.display_name = display_name
        self.initialized = False

    def initialize(self) -> bool:
        """Initialize MT5 connection to specific terminal"""
        if not mt5.initialize(path=self.terminal_path):
            error = mt5.last_error()
            logger.error(f"MT5 initialization failed for {self.terminal_path}: {error}")
            return False
        self.initialized = True
        logger.info(f"MT5 initialized successfully for {self.display_name} at {self.terminal_path}")
        return True

    def shutdown(self):
        """Shutdown MT5 connection"""
        mt5.shutdown()
        self.initialized = False
        logger.info(f"MT5 shutdown for {self.display_name}")

    def get_account_info(self) -> Optional[AccountInfo]:
        """Get info from the already-logged-in account in this terminal"""
        try:
            # Just read from already-logged-in account - NO LOGIN CALL
            account_info = mt5.account_info()
            if account_info is None:
                logger.error(f"Failed to get account info from logged-in terminal for {self.display_name}")
                return None

            return AccountInfo(
                account_number=account_info.login,
                account_name=account_info.name,
                balance=account_info.balance,
                equity=account_info.equity,
                margin=account_info.margin,
                margin_free=account_info.margin_free,
                margin_level=account_info.margin_level,
                profit=account_info.profit,
                server=account_info.server,
                company=account_info.company,
                currency=account_info.currency,
                leverage=account_info.leverage,
                trade_allowed=account_info.trade_allowed,
                connected=True
            )
        except Exception as e:
            logger.error(f"Error getting account info for {self.display_name}: {str(e)}")
            return None

    def calculate_days_operating(self) -> int:
        """Calculate days since account started operating (from first trade)"""
        try:
            # Get first trade history from a reasonable past date
            from_date = datetime(2020, 1, 1)
            deals = mt5.history_deals_get(from_date, datetime.now())

            if deals is None or len(deals) == 0:
                logger.info(f"No deals found for {self.display_name}")
                return 0

            # Get first deal timestamp
            first_deal = min(deals, key=lambda x: x.time)
            first_date = datetime.fromtimestamp(first_deal.time)
            days = (datetime.now() - first_date).days
            return max(0, days)
        except Exception as e:
            logger.error(f"Error calculating days operating for {self.display_name}: {str(e)}")
            return 0

    def get_account_data(self) -> AccountResponse:
        """Get data for the single account in this terminal"""
        if not self.initialized:
            self.initialize()

        account_info = self.get_account_info()
        if account_info:
            days_op = self.calculate_days_operating()

            return AccountResponse(
                account_number=account_info.account_number,
                account_name=self.display_name,
                balance=account_info.balance,
                status="connected",
                days_operating=days_op,
                last_updated=datetime.now()
            )
        else:
            # Account failed to connect - return default values
            logger.warning(f"{self.display_name} failed to connect, returning disconnected status")
            return AccountResponse(
                account_number=0,
                account_name=self.display_name,
                balance=0.0,
                status="disconnected",
                days_operating=0,
                last_updated=datetime.now()
            )
