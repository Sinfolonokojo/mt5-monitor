import MetaTrader5 as mt5
from typing import Optional
from datetime import datetime, timedelta
import logging
from .models import AccountInfo, AccountResponse

logger = logging.getLogger(__name__)


class MT5Service:
    """Service for interacting with a specific MT5 terminal (already logged in)"""

    def __init__(self, terminal_path: str, display_name: str, account_holder: str = "Unknown",
                 prop_firm: str = "N/A", initial_balance: float = 100000.0):
        """
        Initialize service for a specific terminal

        Args:
            terminal_path: Full path to MT5 terminal executable
            display_name: Human-readable name for this account
            account_holder: Name of the account holder
            prop_firm: Prop firm abbreviation (e.g., 'FN', 'T5', 'FT')
            initial_balance: Initial account balance
        """
        self.terminal_path = terminal_path
        self.display_name = display_name
        self.account_holder = account_holder
        self.prop_firm = prop_firm
        self.initial_balance = initial_balance
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

    def has_open_positions(self) -> bool:
        """Check if the account has any open positions"""
        try:
            positions = mt5.positions_get()
            if positions is None:
                return False
            return len(positions) > 0
        except Exception as e:
            logger.error(f"Error checking open positions for {self.display_name}: {str(e)}")
            return False

    def calculate_days_operating(self) -> int:
        """Calculate number of unique days where at least one position was open"""
        try:
            # Get trade history from a reasonable past date
            from_date = datetime(2020, 1, 1)
            deals = mt5.history_deals_get(from_date, datetime.now())

            if deals is None or len(deals) == 0:
                logger.info(f"No deals found for {self.display_name}")
                return 0

            # Filter to only include actual trades (BUY=0, SELL=1)
            # Exclude balance operations (BALANCE=2), credits, bonuses, etc.
            trade_deals = [deal for deal in deals if deal.type in (0, 1)]

            if not trade_deals:
                logger.info(f"No trade deals found for {self.display_name}")
                return 0

            # Group deals by position_id to track position lifetimes
            positions = {}
            for deal in trade_deals:
                pos_id = deal.position_id
                if pos_id not in positions:
                    positions[pos_id] = {'entry': None, 'exit': None}

                # Entry deal (opens position)
                if deal.entry == 0:  # DEAL_ENTRY_IN
                    positions[pos_id]['entry'] = deal.time
                # Exit deal (closes position)
                elif deal.entry == 1:  # DEAL_ENTRY_OUT
                    positions[pos_id]['exit'] = deal.time

            # Collect all days when at least one position was open
            days_with_open_positions = set()

            for pos_id, pos_data in positions.items():
                if pos_data['entry']:
                    entry_time = datetime.fromtimestamp(pos_data['entry'])
                    # If no exit, position is still open (use current time)
                    exit_time = datetime.fromtimestamp(pos_data['exit']) if pos_data['exit'] else datetime.now()

                    # Add all dates between entry and exit (inclusive)
                    current_date = entry_time.date()
                    end_date = exit_time.date()

                    while current_date <= end_date:
                        days_with_open_positions.add(current_date)
                        current_date += timedelta(days=1)

            return len(days_with_open_positions)
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
            has_open_pos = self.has_open_positions()

            return AccountResponse(
                account_number=account_info.account_number,
                account_name=self.display_name,
                balance=account_info.balance,
                status="connected",
                days_operating=days_op,
                has_open_position=has_open_pos,
                last_updated=datetime.now(),
                account_holder=self.account_holder,
                prop_firm=self.prop_firm,
                initial_balance=self.initial_balance
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
                has_open_position=False,
                last_updated=datetime.now(),
                account_holder=self.account_holder,
                prop_firm=self.prop_firm,
                initial_balance=self.initial_balance
            )
