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
    vps_source: str
    last_updated: datetime


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
