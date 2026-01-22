from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
from datetime import datetime
from .config import settings
from .aggregator import data_aggregator
from .cache import cache
from .phase_manager import phase_manager
from .vs_manager import vs_manager
from .google_sheets_service import google_sheets_service
from .models import AggregatedResponse, VPSAgentStatus, AccountData, PhaseUpdateRequest, VSUpdateRequest, TradeHistoryResponse
from .utils import setup_logging
from typing import List

# Configure logging
setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MT5 Main Backend",
    version="1.0.0",
    description="Aggregates MT5 account data from multiple VPS agents"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "MT5 Main Backend",
        "status": "online",
        "vps_agents": len(settings.VPS_AGENTS),
        "version": "1.0.0"
    }


@app.get("/api/accounts", response_model=AggregatedResponse)
async def get_all_accounts(force_refresh: bool = False):
    """Get aggregated account data from all VPS agents"""
    try:
        # Check cache first
        if not force_refresh:
            cached = cache.get()
            if cached:
                accounts, _ = cached
                return build_response(accounts)

        # Fetch fresh data from all agents
        logger.info("Fetching data from all VPS agents")
        raw_accounts, agent_statuses = await data_aggregator.fetch_all_agents()

        # Enrich with phase data and create AccountData objects
        accounts = []
        row_number = 1

        for raw_account in raw_accounts:
            account = AccountData(
                row_number=row_number,
                account_number=raw_account["account_number"],
                account_name=raw_account["account_name"],
                balance=raw_account["balance"],
                status=raw_account["status"],
                phase=phase_manager.get_phase(raw_account["account_number"]),
                days_operating=raw_account["days_operating"],
                has_open_position=raw_account.get("has_open_position", False),
                vps_source=raw_account["vps_source"],
                last_updated=datetime.fromisoformat(raw_account["last_updated"].replace("Z", "+00:00")) if isinstance(raw_account["last_updated"], str) else raw_account["last_updated"],
                account_holder=raw_account.get("account_holder", "Unknown"),
                prop_firm=raw_account.get("prop_firm", "N/A"),
                initial_balance=raw_account.get("initial_balance", 100000.0),
                vs_group=vs_manager.get_vs(raw_account["account_number"])
            )
            accounts.append(account)
            row_number += 1

        # Cache the results
        cache.set((accounts, agent_statuses))

        return build_response(accounts)

    except Exception as e:
        logger.error(f"Error fetching accounts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch accounts: {str(e)}")


@app.get("/api/agents/status", response_model=List[VPSAgentStatus])
async def get_agents_status():
    """Get status of all VPS agents"""
    try:
        _, agent_statuses = await data_aggregator.fetch_all_agents()
        return agent_statuses
    except Exception as e:
        logger.error(f"Error fetching agent statuses: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/accounts/{account_number}/phase")
async def update_account_phase(account_number: int, request: PhaseUpdateRequest):
    """Update phase value for an account"""
    try:
        logger.info(f"Updating phase for account {account_number} to '{request.phase}'")
        phase_manager.update_phase(account_number, request.phase)

        # Clear cache to reflect the change immediately
        cache.clear()

        return {
            "status": "success",
            "message": f"Phase updated to '{request.phase}' for account {account_number}",
            "account_number": account_number,
            "new_phase": request.phase
        }
    except Exception as e:
        logger.error(f"Error updating phase: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/accounts/{account_number}/vs")
async def update_account_vs(account_number: int, request: VSUpdateRequest):
    """Update VS (Virtual Stop) value for an account"""
    try:
        logger.info(f"Updating VS for account {account_number} to '{request.vs_group}'")
        success, message = vs_manager.update_vs(account_number, request.vs_group)

        if not success:
            raise HTTPException(status_code=400, detail=message)

        # Clear cache to reflect the change immediately
        cache.clear()

        return {
            "status": "success",
            "message": message,
            "account_number": account_number,
            "new_vs": request.vs_group
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating VS: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sync-to-sheets")
async def sync_to_google_sheets():
    """Sync current account data to Google Sheets"""
    try:
        logger.info("Starting Google Sheets sync")

        # Get current account data
        cached_data = cache.get()
        if cached_data:
            # Cache stores a tuple (accounts, agent_statuses)
            accounts, agent_statuses = cached_data
            logger.info("Using cached data for Google Sheets sync")
            # Cached accounts are AccountData objects, convert to dict
            accounts_list = [account.dict() for account in accounts]
        else:
            logger.info("Fetching fresh data for Google Sheets sync")
            # fetch_all_agents returns (raw_accounts as dicts, agent_statuses) tuple
            raw_accounts, agent_statuses = await data_aggregator.fetch_all_agents()
            # raw_accounts are already dictionaries
            accounts_list = raw_accounts

        # Construct the data dict that google_sheets_service expects
        data = {
            "accounts": accounts_list,
            "total_accounts": len(accounts_list),
            "agent_statuses": agent_statuses,
            "last_refresh": datetime.now().isoformat()
        }

        # Sync to Google Sheets
        result = google_sheets_service.sync_accounts(data)

        if result.get("success"):
            logger.info(f"Successfully synced {result.get('accounts_synced', 0)} accounts to Google Sheets")
            return result
        else:
            logger.error(f"Google Sheets sync failed: {result.get('error')}")
            raise HTTPException(status_code=500, detail=result.get('error', 'Unknown error'))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing to Google Sheets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/refresh")
async def force_refresh():
    """Clear cache and force data refresh"""
    cache.clear()
    return {"status": "success", "message": "Cache cleared, next request will fetch fresh data"}


@app.get("/api/accounts/{account_number}/trade-history", response_model=TradeHistoryResponse)
async def get_trade_history(account_number: int, days: int = 30):
    """
    Get detailed trade history for a specific account

    Args:
        account_number: The account number to fetch history for
        days: Number of days to look back (default 30, max 90)
    """
    try:
        # Validate days parameter
        if days < 1:
            raise HTTPException(status_code=400, detail="Days parameter must be at least 1")
        if days > 90:
            raise HTTPException(status_code=400, detail="Days parameter cannot exceed 90")

        logger.info(f"Fetching trade history for account {account_number} (last {days} days)")

        # Fetch trade history from the appropriate VPS agent
        result = await data_aggregator.fetch_trade_history(account_number, days)

        if not result.get("success"):
            error_msg = result.get("error", "Unknown error")
            logger.error(f"Failed to fetch trade history: {error_msg}")
            raise HTTPException(status_code=404 if "not found" in error_msg.lower() else 500, detail=error_msg)

        # Remove the success flag before returning
        result.pop("success", None)

        logger.info(f"Successfully fetched {result.get('total_trades', 0)} trades for account {account_number}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching trade history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch trade history: {str(e)}")


@app.post("/api/accounts/{account_number}/sync-trades-to-sheets")
async def sync_trade_history_to_sheets(account_number: int, days: int = 30):
    """
    Sync trade history for a specific account to Google Sheets

    Args:
        account_number: The account number to sync trades for
        days: Number of days to look back (default 30)
    """
    try:
        logger.info(f"Starting Google Sheets sync for trade history of account {account_number}")

        # Fetch trade history
        trade_history = await data_aggregator.fetch_trade_history(account_number, days)

        if not trade_history.get("success"):
            error_msg = trade_history.get("error", "Unknown error")
            logger.error(f"Failed to fetch trade history: {error_msg}")
            raise HTTPException(status_code=404 if "not found" in error_msg.lower() else 500, detail=error_msg)

        # Remove success flag
        trade_history.pop("success", None)

        # Sync to Google Sheets
        result = google_sheets_service.sync_trade_history(trade_history)

        if result.get("success"):
            logger.info(f"Successfully synced {result.get('trades_synced', 0)} trades to Google Sheets")
            return result
        else:
            logger.error(f"Google Sheets sync failed: {result.get('error')}")
            raise HTTPException(status_code=500, detail=result.get('error', 'Unknown error'))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing trade history to Google Sheets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def build_response(accounts: List[AccountData]) -> AggregatedResponse:
    """Build aggregated response from account data"""
    connected = sum(1 for a in accounts if a.status == "connected")
    total_balance = sum(a.balance for a in accounts)

    return AggregatedResponse(
        accounts=accounts,
        total_accounts=len(accounts),
        connected_accounts=connected,
        disconnected_accounts=len(accounts) - connected,
        total_balance=total_balance,
        last_refresh=datetime.now()
    )
