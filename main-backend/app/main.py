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
from .google_sheets_service import google_sheets_service
from .trade_cache_manager import trade_cache_manager
from .account_vps_cache import account_vps_cache
from .trade_logger import trade_logger
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
