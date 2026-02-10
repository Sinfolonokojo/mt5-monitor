import MetaTrader5 as mt5
from typing import Optional
from datetime import datetime, timedelta
import logging
import time
import threading
from .models import (
    AccountInfo, AccountResponse, TradeHistory, TradeHistoryResponse,
    OpenPositionRequest, OpenPositionResponse, ClosePositionRequest,
    ClosePositionResponse, ModifyPositionRequest, ModifyPositionResponse,
    OpenPosition, OpenPositionsResponse
)

logger = logging.getLogger(__name__)

# Global lock to serialize all MT5 API calls (MT5 library is not thread-safe)
_mt5_lock = threading.Lock()


class MT5Service:
    """Service for interacting with a specific MT5 terminal (already logged in)"""

    @staticmethod
    def _get_filling_mode(symbol_info):
        """Auto-detect the correct filling mode for a symbol."""
        filling = symbol_info.filling_mode
        if filling & 1:  # ORDER_FILLING_FOK supported
            return mt5.ORDER_FILLING_FOK
        elif filling & 2:  # ORDER_FILLING_IOC supported
            return mt5.ORDER_FILLING_IOC
        else:
            return mt5.ORDER_FILLING_RETURN

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
        with _mt5_lock:
            return self._get_account_data_unlocked()

    def _get_account_data_unlocked(self) -> AccountResponse:
        """Internal: get account data while holding the MT5 lock."""
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
        """Get detailed trade history (thread-safe)."""
        with _mt5_lock:
            return self._get_trade_history_unlocked(from_date, days)

    def _get_trade_history_unlocked(self, from_date: Optional[datetime] = None, days: Optional[int] = None) -> Optional[TradeHistoryResponse]:
        """
        Internal: get trade history while holding the MT5 lock.

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

    # Trading Methods

    def validate_symbol(self, symbol: str) -> tuple[bool, str]:
        """
        Validate that a symbol exists and is tradeable

        Returns:
            (success, message) tuple
        """
        try:
            symbol_info = mt5.symbol_info(symbol)
            if symbol_info is None:
                return False, f"Symbol {symbol} not found"

            # Try to enable symbol if not visible
            if not symbol_info.visible:
                if not mt5.symbol_select(symbol, True):
                    return False, f"Failed to enable symbol {symbol}"
                # Re-fetch symbol info after enabling
                symbol_info = mt5.symbol_info(symbol)

            # Check if trading is allowed
            if not symbol_info.trade_mode == mt5.SYMBOL_TRADE_MODE_FULL:
                return False, f"Trading not allowed for symbol {symbol}"

            return True, "Symbol valid"

        except Exception as e:
            logger.error(f"Error validating symbol {symbol}: {str(e)}")
            return False, f"Error validating symbol: {str(e)}"

    def open_position(self, request: OpenPositionRequest) -> OpenPositionResponse:
        """Open a new market position (thread-safe)."""
        with _mt5_lock:
            return self._open_position_unlocked(request)

    def _open_position_unlocked(self, request: OpenPositionRequest) -> OpenPositionResponse:
        """
        Internal: open a new market position

        Args:
            request: OpenPositionRequest with trade parameters

        Returns:
            OpenPositionResponse with result
        """
        try:
            # Safety checks
            if not self.initialized:
                return OpenPositionResponse(
                    success=False,
                    message="MT5 not initialized",
                    error_code=-1
                )

            account_info = mt5.account_info()
            if account_info is None:
                return OpenPositionResponse(
                    success=False,
                    message="Failed to get account info",
                    error_code=-2
                )

            if not account_info.trade_allowed:
                return OpenPositionResponse(
                    success=False,
                    message="Trading not allowed on this account",
                    error_code=-3
                )

            # Validate symbol
            is_valid, msg = self.validate_symbol(request.symbol)
            if not is_valid:
                return OpenPositionResponse(
                    success=False,
                    message=msg,
                    error_code=-4
                )

            symbol_info = mt5.symbol_info(request.symbol)

            # Check lot size limits
            if request.lot < symbol_info.volume_min:
                return OpenPositionResponse(
                    success=False,
                    message=f"Lot size {request.lot} below minimum {symbol_info.volume_min}",
                    error_code=-5
                )

            if request.lot > symbol_info.volume_max:
                return OpenPositionResponse(
                    success=False,
                    message=f"Lot size {request.lot} above maximum {symbol_info.volume_max}",
                    error_code=-6
                )

            # Get current price
            tick = mt5.symbol_info_tick(request.symbol)
            if tick is None:
                return OpenPositionResponse(
                    success=False,
                    message="Failed to get current price",
                    error_code=-7
                )

            # Determine order type and price
            if request.order_type.upper() == "BUY":
                order_type = mt5.ORDER_TYPE_BUY
                price = tick.ask
            elif request.order_type.upper() == "SELL":
                order_type = mt5.ORDER_TYPE_SELL
                price = tick.bid
            else:
                return OpenPositionResponse(
                    success=False,
                    message=f"Invalid order type: {request.order_type}. Must be BUY or SELL",
                    error_code=-8
                )

            # Check margin requirement (150% safety buffer)
            margin_required = mt5.order_calc_margin(order_type, request.symbol, request.lot, price)
            if margin_required is None:
                logger.warning(f"Could not calculate margin for {request.symbol}, proceeding anyway")
            elif margin_required * 1.5 > account_info.margin_free:
                return OpenPositionResponse(
                    success=False,
                    message=f"Insufficient margin. Required: {margin_required * 1.5:.2f}, Available: {account_info.margin_free:.2f}",
                    error_code=-9
                )

            # Build order request
            order_request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": request.symbol,
                "volume": request.lot,
                "type": order_type,
                "price": price,
                "deviation": 20,
                "magic": 234000,
                "comment": request.comment or "MT5Monitor",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": self._get_filling_mode(symbol_info),
            }

            # Convert SL/TP from pips to price levels
            if request.sl is not None or request.tp is not None:
                # Calculate pip value based on symbol digits
                point = symbol_info.point
                digits = symbol_info.digits
                # For 3/5 digit brokers, 1 pip = 10 points; for 2/4 digit, 1 pip = 1 point
                pip_size = point * 10 if digits in (3, 5) else point

                # Check minimum stop level (in points)
                stop_level_points = symbol_info.trade_stops_level * point
                if stop_level_points == 0:
                    # Some brokers report 0, use spread as minimum
                    stop_level_points = (tick.ask - tick.bid) * 2

                if request.sl is not None:
                    sl_distance = request.sl * pip_size
                    if sl_distance < stop_level_points:
                        return OpenPositionResponse(
                            success=False,
                            message=f"SL {request.sl} pips too close. Minimum: {stop_level_points / pip_size:.1f} pips",
                            error_code=-11
                        )
                    if request.order_type.upper() == "BUY":
                        order_request["sl"] = round(price - sl_distance, digits)
                    else:
                        order_request["sl"] = round(price + sl_distance, digits)
                    logger.info(f"SL: {request.sl} pips -> price {order_request['sl']}")

                if request.tp is not None:
                    tp_distance = request.tp * pip_size
                    if request.order_type.upper() == "BUY":
                        order_request["tp"] = round(price + tp_distance, digits)
                    else:
                        order_request["tp"] = round(price - tp_distance, digits)
                    logger.info(f"TP: {request.tp} pips -> price {order_request['tp']}")

            # Send order
            logger.info(f"Sending order: {order_request}")
            result = mt5.order_send(order_request)

            if result is None:
                error = mt5.last_error()
                return OpenPositionResponse(
                    success=False,
                    message=f"order_send failed: {error}",
                    error_code=-10
                )

            if result.retcode != mt5.TRADE_RETCODE_DONE:
                return OpenPositionResponse(
                    success=False,
                    message=f"Order failed: {result.comment}",
                    error_code=result.retcode
                )

            logger.info(f"✅ Position opened successfully: Ticket={result.order}, Price={result.price}")

            return OpenPositionResponse(
                success=True,
                ticket=result.order,
                message=f"Position opened successfully",
                price=result.price,
                error_code=0
            )

        except Exception as e:
            logger.error(f"Error opening position: {str(e)}")
            return OpenPositionResponse(
                success=False,
                message=f"Exception: {str(e)}",
                error_code=-999
            )

    def close_position(self, request: ClosePositionRequest) -> ClosePositionResponse:
        """Close an existing position (thread-safe)."""
        with _mt5_lock:
            return self._close_position_unlocked(request)

    def _close_position_unlocked(self, request: ClosePositionRequest) -> ClosePositionResponse:
        """
        Internal: close an existing position

        Args:
            request: ClosePositionRequest with ticket number

        Returns:
            ClosePositionResponse with result
        """
        try:
            # Safety checks
            if not self.initialized:
                return ClosePositionResponse(
                    success=False,
                    ticket=request.ticket,
                    message="MT5 not initialized"
                )

            # Get position
            position = mt5.positions_get(ticket=request.ticket)
            if position is None or len(position) == 0:
                return ClosePositionResponse(
                    success=False,
                    ticket=request.ticket,
                    message=f"Position {request.ticket} not found"
                )

            position = position[0]

            # Check if trading is allowed
            account_info = mt5.account_info()
            if account_info and not account_info.trade_allowed:
                return ClosePositionResponse(
                    success=False,
                    ticket=request.ticket,
                    message="Trading not allowed on this account"
                )

            # Get symbol info and current price
            symbol_info = mt5.symbol_info(position.symbol)
            tick = mt5.symbol_info_tick(position.symbol)
            if tick is None or symbol_info is None:
                return ClosePositionResponse(
                    success=False,
                    ticket=request.ticket,
                    message="Failed to get symbol info or current price"
                )

            # Create opposite order to close position
            if position.type == mt5.POSITION_TYPE_BUY:
                order_type = mt5.ORDER_TYPE_SELL
                price = tick.bid
            else:
                order_type = mt5.ORDER_TYPE_BUY
                price = tick.ask

            # Build close request
            close_request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": position.symbol,
                "volume": position.volume,
                "type": order_type,
                "position": request.ticket,
                "price": price,
                "deviation": request.deviation or 20,
                "magic": 234000,
                "comment": "Close by MT5Monitor",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": self._get_filling_mode(symbol_info),
            }

            # Send close order
            logger.info(f"Closing position {request.ticket}: {close_request}")
            result = mt5.order_send(close_request)

            if result is None:
                error = mt5.last_error()
                return ClosePositionResponse(
                    success=False,
                    ticket=request.ticket,
                    message=f"order_send failed: {error}"
                )

            if result.retcode != mt5.TRADE_RETCODE_DONE:
                return ClosePositionResponse(
                    success=False,
                    ticket=request.ticket,
                    message=f"Close failed: {result.comment}"
                )

            logger.info(f"✅ Position {request.ticket} closed successfully at {result.price}")

            return ClosePositionResponse(
                success=True,
                ticket=request.ticket,
                message="Position closed successfully",
                close_price=result.price
            )

        except Exception as e:
            logger.error(f"Error closing position {request.ticket}: {str(e)}")
            return ClosePositionResponse(
                success=False,
                ticket=request.ticket,
                message=f"Exception: {str(e)}"
            )

    def modify_position(self, request: ModifyPositionRequest) -> ModifyPositionResponse:
        """Modify SL/TP on an existing position (thread-safe)."""
        with _mt5_lock:
            return self._modify_position_unlocked(request)

    def _modify_position_unlocked(self, request: ModifyPositionRequest) -> ModifyPositionResponse:
        """
        Internal: modify SL/TP on an existing position

        Args:
            request: ModifyPositionRequest with ticket and new SL/TP

        Returns:
            ModifyPositionResponse with result
        """
        try:
            # Safety checks
            if not self.initialized:
                return ModifyPositionResponse(
                    success=False,
                    ticket=request.ticket,
                    message="MT5 not initialized"
                )

            # Get position
            position = mt5.positions_get(ticket=request.ticket)
            if position is None or len(position) == 0:
                return ModifyPositionResponse(
                    success=False,
                    ticket=request.ticket,
                    message=f"Position {request.ticket} not found"
                )

            position = position[0]

            # Use existing SL/TP if not provided in request
            new_sl = request.sl if request.sl is not None else position.sl
            new_tp = request.tp if request.tp is not None else position.tp

            # Build modify request
            modify_request = {
                "action": mt5.TRADE_ACTION_SLTP,
                "symbol": position.symbol,
                "position": request.ticket,
                "sl": new_sl,
                "tp": new_tp,
            }

            # Send modify order
            logger.info(f"Modifying position {request.ticket}: SL={new_sl}, TP={new_tp}")
            result = mt5.order_send(modify_request)

            if result is None:
                error = mt5.last_error()
                return ModifyPositionResponse(
                    success=False,
                    ticket=request.ticket,
                    message=f"order_send failed: {error}"
                )

            if result.retcode != mt5.TRADE_RETCODE_DONE:
                return ModifyPositionResponse(
                    success=False,
                    ticket=request.ticket,
                    message=f"Modify failed: {result.comment}"
                )

            logger.info(f"✅ Position {request.ticket} modified successfully")

            return ModifyPositionResponse(
                success=True,
                ticket=request.ticket,
                message="Position modified successfully",
                new_sl=new_sl,
                new_tp=new_tp
            )

        except Exception as e:
            logger.error(f"Error modifying position {request.ticket}: {str(e)}")
            return ModifyPositionResponse(
                success=False,
                ticket=request.ticket,
                message=f"Exception: {str(e)}"
            )

    def get_open_positions(self) -> OpenPositionsResponse:
        """Get all open positions for this account (thread-safe)."""
        with _mt5_lock:
            return self._get_open_positions_unlocked()

    def _get_open_positions_unlocked(self) -> OpenPositionsResponse:
        """Internal: get open positions while holding the MT5 lock."""
        empty = OpenPositionsResponse(account_number=0, positions=[], total_profit=0.0, position_count=0)

        try:
            if not self.initialized:
                self.initialize()

            # Get account info first (same pattern as get_account_data which works reliably)
            account_info = self.get_account_info()
            if not account_info:
                logger.error(f"get_open_positions: account not connected for {self.display_name}")
                return empty

            account_number = account_info.account_number

            # Get positions — same simple call as has_open_positions() which works fine
            positions = mt5.positions_get()

            if positions is None:
                error = mt5.last_error()
                logger.warning(f"get_open_positions: positions_get() returned None for {self.display_name}, error: {error}")
                # Simple retry with small delay, no destructive shutdown/reinit
                time.sleep(0.5)
                positions = mt5.positions_get()

            if positions is None:
                logger.error(f"get_open_positions: Still no positions after retry for {self.display_name}")
                return OpenPositionsResponse(account_number=account_number, positions=[], total_profit=0.0, position_count=0)

            logger.info(f"get_open_positions: {self.display_name} (account {account_number}) has {len(positions)} positions")

            open_positions = []
            total_profit = 0.0

            for pos in positions:
                tick = mt5.symbol_info_tick(pos.symbol)
                if tick:
                    current_price = tick.bid if pos.type == mt5.POSITION_TYPE_BUY else tick.ask
                else:
                    current_price = getattr(pos, 'price_current', pos.price_open)

                position_type = "BUY" if pos.type == mt5.POSITION_TYPE_BUY else "SELL"

                open_position = OpenPosition(
                    ticket=pos.ticket,
                    symbol=pos.symbol,
                    type=position_type,
                    volume=pos.volume,
                    open_price=pos.price_open,
                    current_price=current_price,
                    sl=pos.sl if pos.sl > 0 else None,
                    tp=pos.tp if pos.tp > 0 else None,
                    profit=pos.profit,
                    swap=getattr(pos, 'swap', 0.0),
                    commission=getattr(pos, 'commission', 0.0),
                    open_time=datetime.fromtimestamp(pos.time)
                )

                open_positions.append(open_position)
                total_profit += pos.profit

            return OpenPositionsResponse(
                account_number=account_number,
                positions=open_positions,
                total_profit=round(total_profit, 2),
                position_count=len(open_positions)
            )

        except Exception as e:
            logger.error(f"Error getting open positions for {self.display_name}: {str(e)}")
            return empty

    def get_quote(self, symbol: str) -> Optional[dict]:
        """
        Get current bid/ask quote and spread for a symbol

        Args:
            symbol: Trading symbol (e.g., EURUSD)

        Returns:
            Dict with bid, ask, spread_points, spread_pips, pip_value
        """
        try:
            if not self.initialized:
                self.initialize()

            # Ensure symbol is selected
            symbol_info = mt5.symbol_info(symbol)
            if symbol_info is None:
                logger.error(f"Symbol {symbol} not found")
                return None

            if not symbol_info.visible:
                if not mt5.symbol_select(symbol, True):
                    logger.error(f"Failed to select symbol {symbol}")
                    return None

            # Get tick data
            tick = mt5.symbol_info_tick(symbol)
            if tick is None:
                logger.error(f"Failed to get tick for {symbol}")
                return None

            # Calculate spread - determine pip value based on symbol type
            symbol_upper = symbol.upper()
            if "JPY" in symbol_upper:
                pip_value = 0.01
            elif symbol_upper.startswith(("BTC", "ETH", "XRP", "LTC", "BCH", "XAU", "XAG")):
                # Crypto and metals use different pip values
                pip_value = 1.0 if symbol_upper.startswith(("BTC", "ETH")) else 0.01
            else:
                pip_value = 0.0001
            spread_points = tick.ask - tick.bid
            spread_pips = spread_points / pip_value

            # Get trade_tick_value for USD conversion (USD profit per 1 point per 1 lot)
            trade_tick_value = symbol_info.trade_tick_value if symbol_info.trade_tick_value else 1.0
            point = symbol_info.point

            return {
                "symbol": symbol,
                "bid": tick.bid,
                "ask": tick.ask,
                "spread_points": round(spread_points, 6),
                "spread_pips": round(spread_pips, 2),
                "pip_value": pip_value,
                "trade_tick_value": trade_tick_value,
                "point": point,
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Error getting quote for {symbol}: {str(e)}")
            return None
