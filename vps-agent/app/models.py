from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AccountInfo(BaseModel):
    """Detailed MT5 account information"""
    account_number: int
    account_name: str
    balance: float
    equity: float
    margin: float
    margin_free: float
    margin_level: float
    profit: float
    server: str
    company: str
    currency: str
    leverage: int
    trade_allowed: bool
    connected: bool


class AccountResponse(BaseModel):
    """Simplified account response for API"""
    account_number: int
    account_name: str
    balance: float
    status: str  # "connected" or "disconnected"
    days_operating: int
    has_open_position: bool
    last_updated: datetime
    account_holder: Optional[str] = "Unknown"
    prop_firm: Optional[str] = "N/A"
    initial_balance: Optional[float] = 100000.0


class AgentHealthResponse(BaseModel):
    """Health check response"""
    status: str
    accounts_monitored: int
    mt5_initialized: bool
    timestamp: datetime


class TradeHistory(BaseModel):
    """Individual trade history record"""
    symbol: str
    side: str  # "BUY" or "SELL"
    lot: float
    pips: float
    tp_money: Optional[float] = None
    sl_money: Optional[float] = None
    commission: float
    profit: float
    entry_time: datetime
    exit_time: datetime
    entry_price: float
    exit_price: float
    position_id: int


class TradeHistoryResponse(BaseModel):
    """Response containing trade history for an account"""
    account_number: int
    trades: list[TradeHistory]
    total_trades: int
    total_profit: float
    total_commission: float


# Trading Models

class OpenPositionRequest(BaseModel):
    """Request to open a new position"""
    symbol: str
    lot: float
    order_type: str  # "BUY" or "SELL"
    sl: Optional[float] = None
    tp: Optional[float] = None
    comment: Optional[str] = "MT5Monitor"


class ClosePositionRequest(BaseModel):
    """Request to close an existing position"""
    ticket: int
    deviation: Optional[int] = 20


class ModifyPositionRequest(BaseModel):
    """Request to modify SL/TP on an existing position"""
    ticket: int
    sl: Optional[float] = None
    tp: Optional[float] = None


class OpenPositionResponse(BaseModel):
    """Response after opening a position"""
    success: bool
    ticket: Optional[int] = None
    message: str
    price: Optional[float] = None
    error_code: Optional[int] = None


class ClosePositionResponse(BaseModel):
    """Response after closing a position"""
    success: bool
    ticket: int
    message: str
    close_price: Optional[float] = None


class ModifyPositionResponse(BaseModel):
    """Response after modifying a position"""
    success: bool
    ticket: int
    message: str
    new_sl: Optional[float] = None
    new_tp: Optional[float] = None


class OpenPosition(BaseModel):
    """Represents an open position"""
    ticket: int
    symbol: str
    type: str  # "BUY" or "SELL"
    volume: float
    open_price: float
    current_price: float
    sl: Optional[float] = None
    tp: Optional[float] = None
    profit: float
    swap: float
    commission: float = 0.0
    open_time: datetime


class OpenPositionsResponse(BaseModel):
    """Response containing all open positions for an account"""
    account_number: int
    positions: list[OpenPosition]
    total_profit: float
    position_count: int
