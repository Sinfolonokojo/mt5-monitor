import MetaTrader5 as mt5
from typing import List, Optional
from datetime import datetime
import logging
from .models import AccountInfo, AccountResponse
from .config import settings

logger = logging.getLogger(__name__)


class MT5Service:
    """Service for interacting with MT5 terminals"""

    def __init__(self):
        self.initialized = False
        self.account_configs = settings.MT5_ACCOUNTS

    def initialize(self) -> bool:
        """Initialize MT5 connection"""
        if not mt5.initialize():
            error = mt5.last_error()
            logger.error(f"MT5 initialization failed: {error}")
            return False
        self.initialized = True
        logger.info("MT5 initialized successfully")
        return True

    def shutdown(self):
        """Shutdown MT5 connection"""
        mt5.shutdown()
        self.initialized = False
        logger.info("MT5 shutdown")

    def get_account_info(self, account_number: int, password: str, server: str) -> Optional[AccountInfo]:
        """Connect to specific account and retrieve info"""
        try:
            # Login to account
            if not mt5.login(account_number, password=password, server=server):
                error = mt5.last_error()
                logger.error(f"Failed to login to account {account_number}: {error}")
                return None

            # Get account info
            account_info = mt5.account_info()
            if account_info is None:
                logger.error(f"Failed to get account info for {account_number}")
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
            logger.error(f"Error getting account info for {account_number}: {str(e)}")
            return None

    def calculate_days_operating(self, account_number: int) -> int:
        """Calculate days since account started operating (from first trade)"""
        try:
            # Get first trade history from a reasonable past date
            from_date = datetime(2020, 1, 1)
            deals = mt5.history_deals_get(from_date, datetime.now())

            if deals is None or len(deals) == 0:
                logger.info(f"No deals found for account {account_number}")
                return 0

            # Get first deal timestamp
            first_deal = min(deals, key=lambda x: x.time)
            first_date = datetime.fromtimestamp(first_deal.time)
            days = (datetime.now() - first_date).days
            return max(0, days)
        except Exception as e:
            logger.error(f"Error calculating days operating for account {account_number}: {str(e)}")
            return 0

    def get_all_accounts(self) -> List[AccountResponse]:
        """Get info for all configured accounts on this VPS"""
        if not self.initialized:
            self.initialize()

        accounts = []
        for config in self.account_configs:
            account_number = config["account_number"]
            logger.info(f"Fetching data for account {account_number}")

            account_info = self.get_account_info(
                account_number,
                config["password"],
                config["server"]
            )

            if account_info:
                days_op = self.calculate_days_operating(account_number)

                accounts.append(AccountResponse(
                    account_number=account_info.account_number,
                    account_name=config.get("display_name", account_info.account_name),
                    balance=account_info.balance,
                    status="connected" if account_info.connected else "disconnected",
                    days_operating=days_op,
                    last_updated=datetime.now()
                ))
            else:
                # Account failed to connect - return default values
                logger.warning(f"Account {account_number} failed to connect, returning disconnected status")
                accounts.append(AccountResponse(
                    account_number=account_number,
                    account_name=config.get("display_name", f"Account {account_number}"),
                    balance=0.0,
                    status="disconnected",
                    days_operating=0,
                    last_updated=datetime.now()
                ))

        return accounts


# Singleton instance
mt5_service = MT5Service()
