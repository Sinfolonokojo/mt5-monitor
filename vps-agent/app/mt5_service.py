import MetaTrader5 as mt5
from typing import Optional
from datetime import datetime, timedelta
import logging
import time
from .models import AccountInfo, AccountResponse, TradeHistory, TradeHistoryResponse

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
        self.last_successful_connection = None
        self.reconnection_attempts = 0
        self.max_reconnection_attempts = 3

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

    def reconnect(self) -> bool:
        """Attempt to reconnect to MT5 terminal with retry logic"""
        logger.warning(f"Attempting to reconnect MT5 for {self.display_name}...")

        # Shutdown existing connection first
        try:
            if self.initialized:
                self.shutdown()
        except Exception as e:
            logger.error(f"Error during shutdown before reconnect: {str(e)}")

        # Try reconnecting with exponential backoff
        for attempt in range(1, self.max_reconnection_attempts + 1):
            logger.info(f"Reconnection attempt {attempt}/{self.max_reconnection_attempts} for {self.display_name}")

            if self.initialize():
                logger.info(f"✅ Reconnection successful for {self.display_name}")
                self.reconnection_attempts = 0
                self.last_successful_connection = datetime.now()
                return True

            # Wait before next attempt (exponential backoff: 2s, 4s, 8s)
            if attempt < self.max_reconnection_attempts:
                wait_time = 2 ** attempt
                logger.warning(f"Reconnection failed, waiting {wait_time}s before retry...")
                time.sleep(wait_time)

        logger.error(f"❌ All reconnection attempts failed for {self.display_name}")
        self.reconnection_attempts += 1
        return False

    def get_account_info(self) -> Optional[AccountInfo]:
        """Get info from the already-logged-in account in this terminal with auto-reconnect"""
        try:
            # Just read from already-logged-in account - NO LOGIN CALL
            account_info = mt5.account_info()
            if account_info is None:
                logger.warning(f"Failed to get account info from logged-in terminal for {self.display_name}")

                # Attempt to reconnect
                if self.reconnect():
                    # Retry getting account info after reconnection
                    account_info = mt5.account_info()
                    if account_info is None:
                        logger.error(f"Still no account info after reconnection for {self.display_name}")
                        return None
                else:
                    logger.error(f"Reconnection failed for {self.display_name}")
                    return None

            # Successfully got account info (either first try or after reconnect)
            self.last_successful_connection = datetime.now()
            self.reconnection_attempts = 0

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
            # Try reconnecting on exception as well
            if self.reconnect():
                try:
                    account_info = mt5.account_info()
                    if account_info:
                        self.last_successful_connection = datetime.now()
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
                except Exception as retry_error:
                    logger.error(f"Retry after reconnect failed: {str(retry_error)}")
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

    def get_trade_history(self, from_date: Optional[datetime] = None, days: Optional[int] = None) -> Optional[TradeHistoryResponse]:
        """
        Get detailed trade history (closed trades only)

        Args:
            from_date: Start date for fetching trades (optional, for incremental fetching)
            days: Number of days to look back (optional, ignored if from_date is provided)

        Returns:
            TradeHistoryResponse with list of closed trades
        """
        try:
            if not self.initialized:
                self.initialize()

            account_info = self.get_account_info()
            if not account_info:
                logger.error(f"Cannot get trade history - account not connected for {self.display_name}")
                return None

            # Determine start date
            filter_from_date = None  # Will be used to filter completed trades by exit_time
            if from_date is None:
                # If no from_date, use days parameter (default 30 days for initial fetch)
                days = days if days is not None else 30
                from_date = datetime.now() - timedelta(days=days)
            else:
                # For incremental fetch: store the filter date and fetch from earlier
                # We need to fetch from earlier to capture entry deals for trades that
                # opened before from_date but closed after it
                filter_from_date = from_date
                # Fetch deals from 7 days before to ensure we capture entry deals
                from_date = from_date - timedelta(days=7)

            logger.info(f"Fetching trade history for {self.display_name} from {from_date.strftime('%Y-%m-%d')}")
            if filter_from_date:
                logger.info(f"Will filter completed trades by exit_time >= {filter_from_date.strftime('%Y-%m-%d %H:%M:%S')}")

            # Get deals from specified date
            deals = mt5.history_deals_get(from_date, datetime.now())

            if deals is None or len(deals) == 0:
                logger.info(f"No deals found for {self.display_name} in last {days} days")
                return TradeHistoryResponse(
                    account_number=account_info.account_number,
                    trades=[],
                    total_trades=0,
                    total_profit=0.0,
                    total_commission=0.0
                )

            # Filter to only include actual trades (BUY=0, SELL=1)
            # Exclude balance operations, credits, etc.
            trade_deals = [deal for deal in deals if deal.type in (0, 1)]

            if not trade_deals:
                logger.info(f"No trade deals found for {self.display_name} in last {days} days")
                return TradeHistoryResponse(
                    account_number=account_info.account_number,
                    trades=[],
                    total_trades=0,
                    total_profit=0.0,
                    total_commission=0.0
                )

            # Group deals by position_id to reconstruct complete trades
            positions = {}
            for deal in trade_deals:
                pos_id = deal.position_id
                if pos_id not in positions:
                    positions[pos_id] = {'entry': None, 'exit': None}

                # Entry deal (opens position)
                if deal.entry == 0:  # DEAL_ENTRY_IN
                    positions[pos_id]['entry'] = deal
                # Exit deal (closes position)
                elif deal.entry == 1:  # DEAL_ENTRY_OUT
                    positions[pos_id]['exit'] = deal

            # Build trade history from completed positions (both entry and exit)
            trades = []
            total_profit = 0.0
            total_commission = 0.0

            for pos_id, pos_data in positions.items():
                entry_deal = pos_data['entry']
                exit_deal = pos_data['exit']

                # Only include completed trades (both entry and exit)
                if entry_deal and exit_deal:
                    # Get symbol info for pip calculation
                    symbol_info = mt5.symbol_info(entry_deal.symbol)
                    if symbol_info is None:
                        logger.warning(f"Could not get symbol info for {entry_deal.symbol}, skipping pip calculation")
                        point = 0.0001  # Default for forex pairs
                        digits = 5
                    else:
                        point = symbol_info.point
                        digits = symbol_info.digits

                    # Calculate pips
                    # For BUY: pips = (exit_price - entry_price) / point
                    # For SELL: pips = (entry_price - exit_price) / point
                    price_diff = exit_deal.price - entry_deal.price
                    if entry_deal.type == 1:  # SELL
                        price_diff = -price_diff

                    pips = price_diff / point
                    # Adjust for 3/5 digit brokers (if digits is 3 or 5, divide by 10)
                    if digits in (3, 5):
                        pips = pips / 10

                    # Determine side (entry deal type)
                    side = "BUY" if entry_deal.type == 0 else "SELL"

                    # Total commission and profit for this trade
                    trade_commission = entry_deal.commission + exit_deal.commission
                    trade_profit = exit_deal.profit  # Exit deal contains the P/L

                    # Try to get TP/SL from historical positions (may not be available)
                    # Note: MT5 history_deals_get doesn't provide TP/SL directly
                    # These would need to be fetched from orders or positions if needed
                    tp_money = None
                    sl_money = None

                    trade = TradeHistory(
                        symbol=entry_deal.symbol,
                        side=side,
                        lot=entry_deal.volume,
                        pips=round(pips, 1),
                        tp_money=tp_money,
                        sl_money=sl_money,
                        commission=round(trade_commission, 2),
                        profit=round(trade_profit, 2),
                        entry_time=datetime.fromtimestamp(entry_deal.time),
                        exit_time=datetime.fromtimestamp(exit_deal.time),
                        entry_price=entry_deal.price,
                        exit_price=exit_deal.price,
                        position_id=pos_id
                    )

                    trades.append(trade)
                    total_profit += trade_profit
                    total_commission += trade_commission

            # Filter trades by exit_time if this is an incremental fetch
            if filter_from_date:
                original_count = len(trades)
                trades = [t for t in trades if t.exit_time >= filter_from_date]
                logger.info(f"Filtered {original_count} trades to {len(trades)} trades with exit_time >= {filter_from_date.strftime('%Y-%m-%d %H:%M:%S')}")

                # Recalculate totals after filtering
                total_profit = sum(t.profit for t in trades)
                total_commission = sum(t.commission for t in trades)

            # Sort trades by exit time (most recent first)
            trades.sort(key=lambda x: x.exit_time, reverse=True)

            logger.info(f"Found {len(trades)} completed trades for {self.display_name} in last {days} days")

            return TradeHistoryResponse(
                account_number=account_info.account_number,
                trades=trades,
                total_trades=len(trades),
                total_profit=round(total_profit, 2),
                total_commission=round(total_commission, 2)
            )

        except Exception as e:
            logger.error(f"Error getting trade history for {self.display_name}: {str(e)}")
            return None
