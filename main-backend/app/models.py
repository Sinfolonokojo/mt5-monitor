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
