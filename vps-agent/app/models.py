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
    last_updated: datetime


class AgentHealthResponse(BaseModel):
    """Health check response"""
    status: str
    accounts_monitored: int
    mt5_initialized: bool
    timestamp: datetime
