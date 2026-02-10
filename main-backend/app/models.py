from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class AccountData(BaseModel):
    """Account data with phase information"""
    row_number: int
    account_number: int
    account_name: str
    balance: float
    status: str
    phase: str
    days_operating: int
    has_open_position: bool
    vps_source: str
    last_updated: datetime
    account_holder: Optional[str] = "Unknown"
    prop_firm: Optional[str] = "N/A"
    initial_balance: Optional[float] = 100000.0
    vs_group: Optional[str] = None


class AggregatedResponse(BaseModel):
    """Aggregated response with all accounts and summary"""
    accounts: List[AccountData]
    total_accounts: int
    connected_accounts: int
    disconnected_accounts: int
    total_balance: float
    last_refresh: datetime


class VPSAgentStatus(BaseModel):
    """VPS Agent status information"""
    agent_name: str
    agent_url: str
    status: str  # "online", "offline", "timeout", "error"
    accounts_count: int
    last_checked: datetime


class PhaseUpdateRequest(BaseModel):
    """Request to update phase value"""
    phase: str


class VSUpdateRequest(BaseModel):
    """Request to update VS value"""
    vs_group: str


class TradeHistory(BaseModel):
    """Individual trade history record"""
    symbol: str
    side: str
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
    trades: List[TradeHistory]
    total_trades: int
    total_profit: float
    total_commission: float


# Versus Trading Models
from enum import Enum


class VersusStatus(str, Enum):
    """Status values for a Versus configuration"""
    PENDING = "pending"
    CONGELADO = "congelado"
    TRANSFERIDO = "transferido"
    COMPLETED = "completed"
    ERROR = "error"


class VersusConfig(BaseModel):
    """A Versus hedging configuration"""
    id: str
    account_a: int
    account_b: int
    symbol: str
    lots: float
    side: str  # "BUY" or "SELL" - Account A's direction
    tp_usd_a: float  # Take Profit in USD for Account A
    sl_usd_a: float  # Stop Loss in USD for Account A
    tp_usd_b: float  # Take Profit in USD for Account B
    sl_usd_b: float  # Stop Loss in USD for Account B
    status: VersusStatus = VersusStatus.PENDING
    created_at: datetime
    updated_at: datetime
    scheduled_congelar: Optional[datetime] = None  # Optional scheduled time for congelar
    scheduled_transferir: Optional[datetime] = None  # Optional scheduled time for transferir
    tickets_a: List[int] = []  # Trade tickets on Account A
    tickets_b: List[int] = []  # Trade tickets on Account B
    error_message: Optional[str] = None


class CreateVersusRequest(BaseModel):
    """Request to create a new Versus"""
    account_a: int
    account_b: int
    symbol: str = "EURUSD"
    lots: float
    side: str  # "BUY" or "SELL"
    tp_usd_a: float  # Take Profit in USD for Account A
    sl_usd_a: float  # Stop Loss in USD for Account A
    tp_usd_b: float  # Take Profit in USD for Account B
    sl_usd_b: float  # Stop Loss in USD for Account B
    scheduled_congelar: Optional[datetime] = None
    scheduled_transferir: Optional[datetime] = None
    holder_a: Optional[str] = ""
    prop_firm_a: Optional[str] = ""
    holder_b: Optional[str] = ""
    prop_firm_b: Optional[str] = ""
