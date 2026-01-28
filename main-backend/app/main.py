from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from datetime import datetime
import httpx
from .config import settings
from .aggregator import data_aggregator
from .cache import cache
from .phase_manager import phase_manager
from .vs_manager import vs_manager
from .versus_manager import versus_manager
from .google_sheets_service import google_sheets_service
from .trade_cache_manager import trade_cache_manager
from .account_vps_cache import account_vps_cache
from .trade_logger import trade_logger
from .models import AggregatedResponse, VPSAgentStatus, AccountData, PhaseUpdateRequest, VSUpdateRequest, TradeHistoryResponse, CreateVersusRequest, VersusStatus, VersusConfig
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


# Trading safety middleware
@app.middleware("http")
async def trading_safety_middleware(request: Request, call_next):
    """Block trading requests when trading is disabled"""
    if request.url.path.startswith("/api/accounts/") and "/trade/" in request.url.path:
        if not settings.TRADING_ENABLED:
            return JSONResponse(
                status_code=503,
                content={"detail": "Trading is currently disabled. Set TRADING_ENABLED=true in .env to enable."}
            )
    # Block versus requests when versus feature is disabled
    if request.url.path.startswith("/api/versus"):
        if not settings.VERSUS_ENABLED:
            return JSONResponse(
                status_code=503,
                content={"detail": "Versus feature is disabled. Set VERSUS_ENABLED=true in .env to enable."}
            )
    response = await call_next(request)
    return response


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

        # Update account-VPS mapping cache
        account_vps_cache.update_bulk(raw_accounts)

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
            # Debug: Log first account's phase if available
            if accounts_list:
                logger.info(f"[CACHE PATH] First account phase: {accounts_list[0].get('phase', 'MISSING')}")
        else:
            logger.info("Fetching fresh data for Google Sheets sync")
            # fetch_all_agents returns (raw_accounts as dicts, agent_statuses) tuple
            raw_accounts, agent_statuses = await data_aggregator.fetch_all_agents()
            # Enrich raw accounts with phase data
            accounts_list = []
            for raw_account in raw_accounts:
                account_dict = raw_account.copy()
                # Add phase data from phase_manager
                phase_value = phase_manager.get_phase(raw_account["account_number"])
                account_dict['phase'] = phase_value
                accounts_list.append(account_dict)
            # Debug: Log first account's phase if available
            if accounts_list:
                logger.info(f"[FRESH PATH] First account phase: {accounts_list[0].get('phase', 'MISSING')}, Account #: {accounts_list[0].get('account_number')}")

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
    account_vps_cache.clear()
    return {"status": "success", "message": "Cache cleared, next request will fetch fresh data"}


@app.get("/api/accounts/{account_number}/trade-history", response_model=TradeHistoryResponse)
async def get_trade_history(account_number: int, force_refresh: bool = False):
    """
    Get detailed trade history for a specific account with incremental caching

    Args:
        account_number: The account number to fetch history for
        force_refresh: If True, clear cache and fetch all trades from scratch
    """
    try:
        logger.info(f"Fetching trade history for account {account_number} (force_refresh={force_refresh})")

        # If force refresh, clear the cache for this account
        if force_refresh:
            trade_cache_manager.clear_account_cache(account_number)
            logger.info(f"Cache cleared for account {account_number}")

        # Get last sync time from cache
        last_sync_time = trade_cache_manager.get_last_sync_time(account_number)

        # Determine fetch strategy
        if last_sync_time:
            # Incremental fetch: only get trades since last sync
            logger.info(f"Incremental fetch: getting trades since {last_sync_time}")
            result = await data_aggregator.fetch_trade_history(account_number, from_date=last_sync_time)
        else:
            # First fetch: get last 30 days of trades
            logger.info(f"Initial fetch: getting last 30 days of trades")
            result = await data_aggregator.fetch_trade_history(account_number, days=30)

        if not result.get("success"):
            error_msg = result.get("error", "Unknown error")
            logger.error(f"Failed to fetch trade history: {error_msg}")
            raise HTTPException(status_code=404 if "not found" in error_msg.lower() else 500, detail=error_msg)

        # Remove the success flag
        result.pop("success", None)

        # Convert trade dictionaries for caching (ensure serializable)
        new_trades = result.get('trades', [])

        # Update cache with new trades (incremental merge)
        cached_result = trade_cache_manager.update_trades(account_number, new_trades)

        logger.info(f"Trade history updated: {cached_result['new_trades_count']} new, "
                   f"{cached_result['total_trades']} total trades for account {account_number}")

        # Return merged result from cache
        return TradeHistoryResponse(
            account_number=cached_result['account_number'],
            trades=cached_result['trades'],
            total_trades=cached_result['total_trades'],
            total_profit=cached_result['total_profit'],
            total_commission=cached_result['total_commission']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching trade history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch trade history: {str(e)}")


@app.post("/api/accounts/{account_number}/sync-trades-to-sheets")
async def sync_trade_history_to_sheets(account_number: int):
    """
    Sync trade history for a specific account to Google Sheets (uses cached trades)

    Args:
        account_number: The account number to sync trades for
    """
    try:
        logger.info(f"Starting Google Sheets sync for trade history of account {account_number}")

        # Get cached trade summary
        trade_history = trade_cache_manager.get_trade_summary(account_number)

        if not trade_history.get('cached') or trade_history.get('total_trades', 0) == 0:
            # No cached trades, fetch first
            logger.info(f"No cached trades found, fetching first...")
            await get_trade_history(account_number, force_refresh=False)
            # Get updated cache
            trade_history = trade_cache_manager.get_trade_summary(account_number)

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


def invalidate_account_cache(account_number: int):
    """
    Invalidate cache entry for a specific account only

    This is faster than clearing the entire cache
    """
    # For now, we clear the entire cache since our cache structure doesn't support
    # partial invalidation. In the future, consider using a dict-based cache
    # where we can delete specific keys.
    cache.clear()
    # Note: We intentionally DON'T clear account_vps_cache as VPS mapping is stable


@app.get("/api/accounts/{account_number}", response_model=AccountData)
async def get_single_account(account_number: int):
    """
    Get data for a specific account (fast, no full refresh)

    Uses cached VPS mapping to fetch only the target account's data
    """
    try:
        logger.info(f"Single account fetch requested for account {account_number}")

        # Find VPS for this account
        vps_source = account_vps_cache.get(account_number)
        logger.info(f"VPS source from cache: {vps_source}")

        if not vps_source:
            # Cache miss - fetch all to populate cache (rare case)
            logger.info(f"VPS source not in cache for account {account_number}, fetching from agents")
            await data_aggregator.fetch_all_agents()
            vps_source = account_vps_cache.get(account_number)

            if not vps_source:
                raise HTTPException(status_code=404, detail=f"Account {account_number} not found")

        # Get agent config
        agent_config = None
        for agent in settings.VPS_AGENTS:
            if agent.get("name") == vps_source:
                agent_config = agent
                break

        if not agent_config:
            raise HTTPException(status_code=500, detail=f"VPS agent configuration not found for {vps_source}")

        # Fetch just this account from the VPS agent
        async with httpx.AsyncClient(timeout=settings.AGENT_TIMEOUT) as client:
            response = await client.get(f"{agent_config['url']}/accounts")

            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch account data")

            accounts_data = response.json()

        # Find the specific account in the response
        raw_account = None

        # Case 1: Single account object (VPS agent returns just one account)
        if isinstance(accounts_data, dict) and "account_number" in accounts_data:
            if accounts_data["account_number"] == account_number:
                raw_account = accounts_data
                logger.info(f"Found account {account_number} as single object from VPS {vps_source}")
        # Case 2: Response is wrapped in an object with accounts array
        elif isinstance(accounts_data, dict) and "accounts" in accounts_data:
            for acc in accounts_data["accounts"]:
                if acc["account_number"] == account_number:
                    raw_account = acc
                    logger.info(f"Found account {account_number} in accounts array from VPS {vps_source}")
                    break
        # Case 3: Response is a list of accounts
        elif isinstance(accounts_data, list):
            for acc in accounts_data:
                if acc["account_number"] == account_number:
                    raw_account = acc
                    logger.info(f"Found account {account_number} in accounts list from VPS {vps_source}")
                    break

        if not raw_account:
            logger.error(f"Account {account_number} not found in VPS {vps_source} response. Response type: {type(accounts_data)}, keys: {accounts_data.keys() if isinstance(accounts_data, dict) else 'N/A'}")
            raise HTTPException(status_code=404, detail=f"Account {account_number} not found on VPS {vps_source}")

        raw_account["vps_source"] = vps_source

        # Build AccountData object with phase/vs enrichment
        account = AccountData(
            row_number=1,  # Not used in single account context
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

        logger.info(f"Successfully fetched single account {account_number}")
        return account

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching account {account_number}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch account: {str(e)}")


# Trading Endpoints (Proxy to VPS Agents)

@app.post("/api/accounts/{account_number}/trade/open")
async def proxy_open_position(account_number: int, request: dict):
    """
    Open a new position on the specified account (proxied to VPS agent)

    Args:
        account_number: MT5 account number
        request: OpenPositionRequest data (symbol, lot, order_type, sl, tp, comment)

    Returns:
        OpenPositionResponse from VPS agent
    """
    transaction_id = None
    try:
        # Log trade request
        transaction_id = trade_logger.log_trade_request(
            operation="OPEN_POSITION",
            account_number=account_number,
            request_data=request
        )

        # Find target VPS agent - cache stores the VPS source name (e.g., "VPS1-FundedNext")
        vps_source = account_vps_cache.get(account_number)

        if not vps_source:
            # Cache miss - refresh cache
            logger.info(f"VPS source not in cache for account {account_number}, fetching from agents")
            await data_aggregator.fetch_all_agents()
            vps_source = account_vps_cache.get(account_number)

            if not vps_source:
                error_msg = f"Account {account_number} not found in any VPS agent"
                trade_logger.log_trade_error(transaction_id, "OPEN_POSITION", account_number, error_msg)
                raise HTTPException(status_code=404, detail=error_msg)

        # Get VPS agent config by matching the name
        agent_config = None
        for agent in settings.VPS_AGENTS:
            if agent.get("name") == vps_source:
                agent_config = agent
                break

        if not agent_config:
            error_msg = f"VPS agent configuration not found for {vps_source}. Add it to VPS_AGENTS_JSON in .env"
            trade_logger.log_trade_error(transaction_id, "OPEN_POSITION", account_number, error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

        # Get the URL from the agent config
        vps_url = agent_config["url"]

        # Forward request to VPS agent
        logger.info(f"Forwarding open position request for account {account_number} to {vps_url} ({vps_source})")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{vps_url}/positions/open",
                json=request
            )

            if response.status_code != 200:
                error_msg = f"VPS agent returned error: {response.text}"
                trade_logger.log_trade_error(transaction_id, "OPEN_POSITION", account_number, error_msg)
                raise HTTPException(status_code=response.status_code, detail=error_msg)

            result = response.json()

            # Log trade response
            trade_logger.log_trade_response(
                transaction_id=transaction_id,
                operation="OPEN_POSITION",
                account_number=account_number,
                response_data=result,
                success=result.get("success", False)
            )

            # Clear cache after successful trade to ensure fresh data
            if result.get("success"):
                invalidate_account_cache(account_number)
                logger.info(f"Cache invalidated for account {account_number}")

            return result

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Error opening position: {str(e)}"
        if transaction_id:
            trade_logger.log_trade_error(transaction_id, "OPEN_POSITION", account_number, error_msg)
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)


@app.post("/api/accounts/{account_number}/trade/close")
async def proxy_close_position(account_number: int, request: dict):
    """
    Close an existing position on the specified account (proxied to VPS agent)

    Args:
        account_number: MT5 account number
        request: ClosePositionRequest data (ticket, deviation)

    Returns:
        ClosePositionResponse from VPS agent
    """
    transaction_id = None
    try:
        # Log trade request
        transaction_id = trade_logger.log_trade_request(
            operation="CLOSE_POSITION",
            account_number=account_number,
            request_data=request
        )

        # Find target VPS agent - cache stores the VPS source name
        vps_source = account_vps_cache.get(account_number)

        if not vps_source:
            # Cache miss - refresh cache
            logger.info(f"VPS source not in cache for account {account_number}, fetching from agents")
            await data_aggregator.fetch_all_agents()
            vps_source = account_vps_cache.get(account_number)

            if not vps_source:
                error_msg = f"Account {account_number} not found in any VPS agent"
                trade_logger.log_trade_error(transaction_id, "CLOSE_POSITION", account_number, error_msg)
                raise HTTPException(status_code=404, detail=error_msg)

        # Get VPS agent config by matching the name
        agent_config = None
        for agent in settings.VPS_AGENTS:
            if agent.get("name") == vps_source:
                agent_config = agent
                break

        if not agent_config:
            error_msg = f"VPS agent configuration not found for {vps_source}. Add it to VPS_AGENTS_JSON in .env"
            trade_logger.log_trade_error(transaction_id, "CLOSE_POSITION", account_number, error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

        # Get the URL from the agent config
        vps_url = agent_config["url"]

        # Forward request to VPS agent
        logger.info(f"Forwarding close position request for account {account_number} to {vps_url} ({vps_source})")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{vps_url}/positions/close",
                json=request
            )

            if response.status_code != 200:
                error_msg = f"VPS agent returned error: {response.text}"
                trade_logger.log_trade_error(transaction_id, "CLOSE_POSITION", account_number, error_msg)
                raise HTTPException(status_code=response.status_code, detail=error_msg)

            result = response.json()

            # Log trade response
            trade_logger.log_trade_response(
                transaction_id=transaction_id,
                operation="CLOSE_POSITION",
                account_number=account_number,
                response_data=result,
                success=result.get("success", False)
            )

            # Clear cache after successful trade to ensure fresh data
            if result.get("success"):
                invalidate_account_cache(account_number)
                logger.info(f"Cache invalidated for account {account_number}")

            return result

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Error closing position: {str(e)}"
        if transaction_id:
            trade_logger.log_trade_error(transaction_id, "CLOSE_POSITION", account_number, error_msg)
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)


@app.put("/api/accounts/{account_number}/trade/modify")
async def proxy_modify_position(account_number: int, request: dict):
    """
    Modify SL/TP on an existing position (proxied to VPS agent)

    Args:
        account_number: MT5 account number
        request: ModifyPositionRequest data (ticket, sl, tp)

    Returns:
        ModifyPositionResponse from VPS agent
    """
    transaction_id = None
    try:
        # Log trade request
        transaction_id = trade_logger.log_trade_request(
            operation="MODIFY_POSITION",
            account_number=account_number,
            request_data=request
        )

        # Find target VPS agent - cache stores the VPS source name
        vps_source = account_vps_cache.get(account_number)

        if not vps_source:
            # Cache miss - refresh cache
            logger.info(f"VPS source not in cache for account {account_number}, fetching from agents")
            await data_aggregator.fetch_all_agents()
            vps_source = account_vps_cache.get(account_number)

            if not vps_source:
                error_msg = f"Account {account_number} not found in any VPS agent"
                trade_logger.log_trade_error(transaction_id, "MODIFY_POSITION", account_number, error_msg)
                raise HTTPException(status_code=404, detail=error_msg)

        # Get VPS agent config by matching the name
        agent_config = None
        for agent in settings.VPS_AGENTS:
            if agent.get("name") == vps_source:
                agent_config = agent
                break

        if not agent_config:
            error_msg = f"VPS agent configuration not found for {vps_source}. Add it to VPS_AGENTS_JSON in .env"
            trade_logger.log_trade_error(transaction_id, "MODIFY_POSITION", account_number, error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

        # Get the URL from the agent config
        vps_url = agent_config["url"]

        # Forward request to VPS agent
        logger.info(f"Forwarding modify position request for account {account_number} to {vps_url} ({vps_source})")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.put(
                f"{vps_url}/positions/modify",
                json=request
            )

            if response.status_code != 200:
                error_msg = f"VPS agent returned error: {response.text}"
                trade_logger.log_trade_error(transaction_id, "MODIFY_POSITION", account_number, error_msg)
                raise HTTPException(status_code=response.status_code, detail=error_msg)

            result = response.json()

            # Log trade response
            trade_logger.log_trade_response(
                transaction_id=transaction_id,
                operation="MODIFY_POSITION",
                account_number=account_number,
                response_data=result,
                success=result.get("success", False)
            )

            # Clear cache after successful trade to ensure fresh data
            if result.get("success"):
                invalidate_account_cache(account_number)
                logger.info(f"Cache invalidated for account {account_number}")

            return result

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Error modifying position: {str(e)}"
        if transaction_id:
            trade_logger.log_trade_error(transaction_id, "MODIFY_POSITION", account_number, error_msg)
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)


@app.get("/api/accounts/{account_number}/positions")
async def get_account_positions(account_number: int):
    """
    Get all open positions for the specified account (proxied to VPS agent)

    Args:
        account_number: MT5 account number

    Returns:
        OpenPositionsResponse from VPS agent
    """
    try:
        # Find target VPS agent - cache stores the VPS source name
        vps_source = account_vps_cache.get(account_number)

        if not vps_source:
            # Cache miss - refresh cache
            logger.info(f"VPS source not in cache for account {account_number}, fetching from agents")
            await data_aggregator.fetch_all_agents()
            vps_source = account_vps_cache.get(account_number)

            if not vps_source:
                raise HTTPException(
                    status_code=404,
                    detail=f"Account {account_number} not found in any VPS agent"
                )

        # Get VPS agent config by matching the name
        agent_config = None
        for agent in settings.VPS_AGENTS:
            if agent.get("name") == vps_source:
                agent_config = agent
                break

        if not agent_config:
            raise HTTPException(
                status_code=500,
                detail=f"VPS agent configuration not found for {vps_source}. Add it to VPS_AGENTS_JSON in .env"
            )

        # Get the URL from the agent config
        vps_url = agent_config["url"]

        # Forward request to VPS agent
        logger.info(f"Fetching open positions for account {account_number} from {vps_url} ({vps_source})")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{vps_url}/positions")

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"VPS agent returned error: {response.text}"
                )

            result = response.json()
            logger.info(f"Found {result.get('position_count', 0)} open positions for account {account_number}")
            return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching positions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch positions: {str(e)}")


# Versus Trading Endpoints

@app.get("/api/versus")
async def get_all_versus():
    """Get all Versus configurations"""
    try:
        configs = versus_manager.get_all()
        return {"versus_list": configs, "count": len(configs)}
    except Exception as e:
        logger.error(f"Error fetching Versus list: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/versus/feature-status")
async def get_versus_feature_status():
    """Get whether the Versus feature is enabled (for frontend)"""
    return {"enabled": settings.VERSUS_ENABLED}


@app.post("/api/versus")
async def create_versus(request: CreateVersusRequest):
    """Create a new Versus configuration"""
    try:
        # Validate accounts exist
        if request.account_a == request.account_b:
            raise HTTPException(status_code=400, detail="Account A and Account B must be different")

        if request.lots <= 0:
            raise HTTPException(status_code=400, detail="Lots must be greater than 0")

        if request.side.upper() not in ["BUY", "SELL"]:
            raise HTTPException(status_code=400, detail="Side must be BUY or SELL")

        config = versus_manager.create(
            account_a=request.account_a,
            account_b=request.account_b,
            symbol=request.symbol,
            lots=request.lots,
            side=request.side,
            tp_pips=request.tp_pips,
            sl_pips=request.sl_pips,
            scheduled_congelar=request.scheduled_congelar
        )

        return {"status": "success", "versus": config}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating Versus: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/versus/{versus_id}")
async def delete_versus(versus_id: str):
    """Delete/cancel a Versus configuration"""
    try:
        config = versus_manager.get(versus_id)
        if not config:
            raise HTTPException(status_code=404, detail=f"Versus {versus_id} not found")

        # Only allow deletion of pending or error status
        if config["status"] not in [VersusStatus.PENDING.value, VersusStatus.ERROR.value]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete Versus in {config['status']} status. Only pending or error Versus can be deleted."
            )

        success = versus_manager.delete(versus_id)
        if success:
            return {"status": "success", "message": f"Versus {versus_id} deleted"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete Versus")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting Versus: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/versus/{versus_id}/congelar")
async def execute_congelar(versus_id: str):
    """
    Execute the Congelar step:
    1. Open BUY on Account A (X lots, no SL/TP)
    2. Open SELL on Account A (X lots, no SL/TP)
    3. Store tickets, set status = "congelado"
    """
    try:
        config = versus_manager.get(versus_id)
        if not config:
            raise HTTPException(status_code=404, detail=f"Versus {versus_id} not found")

        if config["status"] != VersusStatus.PENDING.value:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot congelar Versus in {config['status']} status. Must be pending."
            )

        account_a = config["account_a"]
        symbol = config["symbol"]
        lots = config["lots"]

        logger.info(f"Executing Congelar for Versus {versus_id}: Opening BUY and SELL on account {account_a}")

        # Find VPS for Account A
        vps_source = account_vps_cache.get(account_a)
        if not vps_source:
            await data_aggregator.fetch_all_agents()
            vps_source = account_vps_cache.get(account_a)
            if not vps_source:
                raise HTTPException(status_code=404, detail=f"Account {account_a} not found in any VPS agent")

        agent_config = None
        for agent in settings.VPS_AGENTS:
            if agent.get("name") == vps_source:
                agent_config = agent
                break

        if not agent_config:
            raise HTTPException(status_code=500, detail=f"VPS agent config not found for {vps_source}")

        vps_url = agent_config["url"]
        tickets_a = []

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Open BUY position
            buy_request = {
                "symbol": symbol,
                "lot": lots,
                "order_type": "BUY",
                "comment": f"Versus-{versus_id}-BUY"
            }
            buy_response = await client.post(f"{vps_url}/positions/open", json=buy_request)

            if buy_response.status_code != 200:
                raise HTTPException(status_code=buy_response.status_code, detail=f"Failed to open BUY: {buy_response.text}")

            buy_result = buy_response.json()
            if not buy_result.get("success"):
                raise HTTPException(status_code=500, detail=f"Failed to open BUY: {buy_result.get('message', 'Unknown error')}")

            buy_ticket = buy_result.get("ticket")
            tickets_a.append(buy_ticket)
            logger.info(f"Versus {versus_id}: BUY opened with ticket {buy_ticket}")

            # Open SELL position
            sell_request = {
                "symbol": symbol,
                "lot": lots,
                "order_type": "SELL",
                "comment": f"Versus-{versus_id}-SELL"
            }
            sell_response = await client.post(f"{vps_url}/positions/open", json=sell_request)

            if sell_response.status_code != 200:
                # Rollback: close the BUY position
                logger.error(f"Versus {versus_id}: SELL failed, rolling back BUY ticket {buy_ticket}")
                try:
                    await client.post(f"{vps_url}/positions/close", json={"ticket": buy_ticket})
                except Exception as rollback_error:
                    logger.error(f"Rollback failed: {rollback_error}")
                raise HTTPException(status_code=sell_response.status_code, detail=f"Failed to open SELL: {sell_response.text}")

            sell_result = sell_response.json()
            if not sell_result.get("success"):
                # Rollback: close the BUY position
                logger.error(f"Versus {versus_id}: SELL failed, rolling back BUY ticket {buy_ticket}")
                try:
                    await client.post(f"{vps_url}/positions/close", json={"ticket": buy_ticket})
                except Exception as rollback_error:
                    logger.error(f"Rollback failed: {rollback_error}")
                raise HTTPException(status_code=500, detail=f"Failed to open SELL: {sell_result.get('message', 'Unknown error')}")

            sell_ticket = sell_result.get("ticket")
            tickets_a.append(sell_ticket)
            logger.info(f"Versus {versus_id}: SELL opened with ticket {sell_ticket}")

        # Update status to congelado
        updated_config = versus_manager.update_status(
            versus_id,
            VersusStatus.CONGELADO,
            tickets_a=tickets_a
        )

        # Clear cache for account A
        invalidate_account_cache(account_a)

        return {
            "status": "success",
            "message": f"Congelado: BUY and SELL opened on Account A",
            "versus": updated_config,
            "tickets": tickets_a
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing Congelar: {str(e)}")
        versus_manager.update_status(versus_id, VersusStatus.ERROR, error_message=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/versus/{versus_id}/transferir")
async def execute_transferir(versus_id: str):
    """
    Execute the Transferir step:
    1. Close opposite trade on Account A (if side=BUY, close SELL ticket)
    2. Modify remaining trade on Account A with TP and SL (price-based)
    3. Open 2 trades on Account B (opposite direction, X/2 lots each)
       - TP = Account A's SL (mirrored)
       - SL = Account A's TP (mirrored)
    4. Store tickets, set status = "transferido"
    """
    try:
        config = versus_manager.get(versus_id)
        if not config:
            raise HTTPException(status_code=404, detail=f"Versus {versus_id} not found")

        if config["status"] != VersusStatus.CONGELADO.value:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transferir Versus in {config['status']} status. Must be congelado."
            )

        account_a = config["account_a"]
        account_b = config["account_b"]
        symbol = config["symbol"]
        lots = config["lots"]
        side = config["side"]  # Account A's direction
        tp_pips = config["tp_pips"]
        sl_pips = config["sl_pips"]
        tickets_a = config["tickets_a"]

        if len(tickets_a) != 2:
            raise HTTPException(status_code=400, detail=f"Expected 2 tickets on Account A, found {len(tickets_a)}")

        logger.info(f"Executing Transferir for Versus {versus_id}")

        # Find VPS for accounts
        vps_a = account_vps_cache.get(account_a)
        vps_b = account_vps_cache.get(account_b)

        if not vps_a or not vps_b:
            await data_aggregator.fetch_all_agents()
            vps_a = account_vps_cache.get(account_a)
            vps_b = account_vps_cache.get(account_b)

        if not vps_a:
            raise HTTPException(status_code=404, detail=f"Account {account_a} not found")
        if not vps_b:
            raise HTTPException(status_code=404, detail=f"Account {account_b} not found")

        # Get VPS configs
        agent_config_a = None
        agent_config_b = None
        for agent in settings.VPS_AGENTS:
            if agent.get("name") == vps_a:
                agent_config_a = agent
            if agent.get("name") == vps_b:
                agent_config_b = agent

        if not agent_config_a:
            raise HTTPException(status_code=500, detail=f"VPS config not found for {vps_a}")
        if not agent_config_b:
            raise HTTPException(status_code=500, detail=f"VPS config not found for {vps_b}")

        vps_url_a = agent_config_a["url"]
        vps_url_b = agent_config_b["url"]

        async with httpx.AsyncClient(timeout=30.0) as client:
            # First, get open positions on Account A to identify which ticket is which
            positions_response = await client.get(f"{vps_url_a}/positions")
            if positions_response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to get positions from Account A")

            positions_data = positions_response.json()
            positions = positions_data.get("positions", [])

            # Find our tickets and their details
            buy_ticket = None
            sell_ticket = None
            current_price = None

            for pos in positions:
                if pos.get("ticket") in tickets_a:
                    if pos.get("type") == "BUY":
                        buy_ticket = pos.get("ticket")
                        current_price = pos.get("price_current")
                    elif pos.get("type") == "SELL":
                        sell_ticket = pos.get("ticket")
                        if current_price is None:
                            current_price = pos.get("price_current")

            if buy_ticket is None or sell_ticket is None:
                raise HTTPException(status_code=400, detail="Could not identify BUY and SELL tickets on Account A")

            if current_price is None:
                raise HTTPException(status_code=400, detail="Could not determine current price")

            # Determine pip value (for forex pairs, typically 0.0001 for most, 0.01 for JPY pairs)
            pip_value = 0.01 if "JPY" in symbol.upper() else 0.0001

            # Calculate TP and SL prices based on side
            if side == "BUY":
                # Account A keeps BUY, close SELL
                ticket_to_close = sell_ticket
                remaining_ticket = buy_ticket
                # For BUY: TP is above current, SL is below
                tp_price_a = current_price + (tp_pips * pip_value)
                sl_price_a = current_price - (sl_pips * pip_value)
                # Account B opens SELL (opposite), mirrored TP/SL
                opposite_side = "SELL"
                tp_price_b = sl_price_a  # B's TP is A's SL
                sl_price_b = tp_price_a  # B's SL is A's TP
            else:  # SELL
                # Account A keeps SELL, close BUY
                ticket_to_close = buy_ticket
                remaining_ticket = sell_ticket
                # For SELL: TP is below current, SL is above
                tp_price_a = current_price - (tp_pips * pip_value)
                sl_price_a = current_price + (sl_pips * pip_value)
                # Account B opens BUY (opposite), mirrored TP/SL
                opposite_side = "BUY"
                tp_price_b = sl_price_a  # B's TP is A's SL
                sl_price_b = tp_price_a  # B's SL is A's TP

            # Round prices to 5 decimal places (or 3 for JPY pairs)
            decimals = 3 if "JPY" in symbol.upper() else 5
            tp_price_a = round(tp_price_a, decimals)
            sl_price_a = round(sl_price_a, decimals)
            tp_price_b = round(tp_price_b, decimals)
            sl_price_b = round(sl_price_b, decimals)

            logger.info(f"Versus {versus_id}: Closing ticket {ticket_to_close}, keeping {remaining_ticket}")
            logger.info(f"Account A TP: {tp_price_a}, SL: {sl_price_a}")
            logger.info(f"Account B (2x {lots/2} lots {opposite_side}) TP: {tp_price_b}, SL: {sl_price_b}")

            # Step 1: Close opposite trade on Account A
            close_response = await client.post(f"{vps_url_a}/positions/close", json={"ticket": ticket_to_close})
            if close_response.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Failed to close opposite position: {close_response.text}")

            close_result = close_response.json()
            if not close_result.get("success"):
                raise HTTPException(status_code=500, detail=f"Failed to close position: {close_result.get('message')}")

            logger.info(f"Versus {versus_id}: Closed ticket {ticket_to_close}")

            # Step 2: Modify remaining trade on Account A with TP and SL
            modify_response = await client.put(f"{vps_url_a}/positions/modify", json={
                "ticket": remaining_ticket,
                "tp": tp_price_a,
                "sl": sl_price_a
            })
            if modify_response.status_code != 200:
                logger.warning(f"Failed to modify position: {modify_response.text}")
                # Continue anyway - position is open, just without SL/TP

            # Step 3: Open 2 trades on Account B
            half_lots = round(lots / 2, 2)
            tickets_b = []

            for i in range(2):
                open_b_request = {
                    "symbol": symbol,
                    "lot": half_lots,
                    "order_type": opposite_side,
                    "tp": tp_price_b,
                    "sl": sl_price_b,
                    "comment": f"Versus-{versus_id}-B{i+1}"
                }
                open_b_response = await client.post(f"{vps_url_b}/positions/open", json=open_b_request)

                if open_b_response.status_code != 200:
                    versus_manager.update_status(versus_id, VersusStatus.ERROR,
                        error_message=f"Failed to open trade {i+1} on Account B")
                    raise HTTPException(status_code=500, detail=f"Failed to open trade on Account B: {open_b_response.text}")

                open_b_result = open_b_response.json()
                if not open_b_result.get("success"):
                    versus_manager.update_status(versus_id, VersusStatus.ERROR,
                        error_message=f"Failed to open trade {i+1} on Account B: {open_b_result.get('message')}")
                    raise HTTPException(status_code=500, detail=f"Failed to open trade on Account B")

                tickets_b.append(open_b_result.get("ticket"))
                logger.info(f"Versus {versus_id}: Opened {opposite_side} on Account B with ticket {open_b_result.get('ticket')}")

        # Update status to transferido
        updated_config = versus_manager.update_status(
            versus_id,
            VersusStatus.TRANSFERIDO,
            tickets_a=[remaining_ticket],
            tickets_b=tickets_b
        )

        # Clear cache for both accounts
        invalidate_account_cache(account_a)
        invalidate_account_cache(account_b)

        return {
            "status": "success",
            "message": f"Transferido: Account A has 1 {side} trade, Account B has 2 {opposite_side} trades",
            "versus": updated_config,
            "account_a_ticket": remaining_ticket,
            "account_b_tickets": tickets_b,
            "prices": {
                "account_a": {"tp": tp_price_a, "sl": sl_price_a},
                "account_b": {"tp": tp_price_b, "sl": sl_price_b}
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing Transferir: {str(e)}")
        versus_manager.update_status(versus_id, VersusStatus.ERROR, error_message=str(e))
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
