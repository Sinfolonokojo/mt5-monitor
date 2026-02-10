from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
import asyncio
from datetime import datetime, timezone
import httpx
import hmac
import hashlib
import base64
import time
from pydantic import BaseModel
from .config import settings
from .aggregator import data_aggregator
from .cache import cache, smart_cache
from .http_client import get_http_client, close_http_client
from .phase_manager import phase_manager
from .vs_manager import vs_manager
from .versus_manager import versus_manager
from .google_sheets_service import google_sheets_service
from .trade_cache_manager import trade_cache_manager
from .account_vps_cache import account_vps_cache
from .trade_logger import trade_logger
from .telegram_service import telegram_service
from .models import AggregatedResponse, VPSAgentStatus, AccountData, PhaseUpdateRequest, VSUpdateRequest, TradeHistoryResponse, CreateVersusRequest, VersusStatus, VersusConfig
from .utils import setup_logging
from typing import List

# Configure logging
setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


# Auth models
class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    success: bool
    token: str = None
    message: str = None


# Auth helper functions
def generate_token() -> str:
    """Generate a signed token with timestamp"""
    timestamp = str(int(time.time()))
    signature = hmac.new(
        settings.SESSION_SECRET.encode(),
        timestamp.encode(),
        hashlib.sha256
    ).hexdigest()
    token_data = f"{timestamp}.{signature}"
    return base64.b64encode(token_data.encode()).decode()


def verify_token(token: str) -> bool:
    """Verify a token's signature and expiration"""
    try:
        token_data = base64.b64decode(token.encode()).decode()
        parts = token_data.split(".")
        if len(parts) != 2:
            return False

        timestamp, signature = parts

        # Verify signature
        expected_signature = hmac.new(
            settings.SESSION_SECRET.encode(),
            timestamp.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_signature):
            return False

        # Check expiration (24 hours default)
        token_time = int(timestamp)
        current_time = int(time.time())
        expiry_seconds = settings.TOKEN_EXPIRY_HOURS * 3600

        if current_time - token_time > expiry_seconds:
            return False

        return True
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        return False

async def get_account_label(account_number: int, versus_config: dict = None, ab: str = None) -> str:
    """Build a label like 'FN - John Doe' from versus config or cached account data."""
    # Prefer versus config (always available, set at creation)
    if versus_config and ab in ("a", "b"):
        holder = versus_config.get(f"holder_{ab}", "")
        prop_firm = versus_config.get(f"prop_firm_{ab}", "")
        if holder and prop_firm:
            return f"{prop_firm} - {holder}"
    # Fallback: try cache
    account = await smart_cache.get_account(account_number)
    if account and account.prop_firm and account.account_holder:
        return f"{account.prop_firm} - {account.account_holder}"
    return str(account_number)


# Background task control
scheduled_versus_task = None
shutdown_event = asyncio.Event()


async def check_scheduled_versus():
    """Background task that checks for pending scheduled congelar and transferir, and executes them"""
    logger.info("Starting scheduled versus checker (every 30 seconds)")

    while not shutdown_event.is_set():
        try:
            await asyncio.sleep(30)  # Check every 30 seconds

            if shutdown_event.is_set():
                break

            if not settings.VERSUS_ENABLED:
                continue

            # Check scheduled congelar
            pending_congelar = versus_manager.get_pending_scheduled()

            if pending_congelar:
                logger.info(f"Found {len(pending_congelar)} scheduled congelar(s) ready to execute")

            for config in pending_congelar:
                versus_id = config["id"]
                logger.info(f"Executing scheduled Congelar for Versus {versus_id}")

                try:
                    await execute_congelar_internal(versus_id)
                    logger.info(f"Scheduled Congelar completed for Versus {versus_id}")
                except Exception as e:
                    logger.error(f"Failed scheduled Congelar for Versus {versus_id}: {str(e)}")
                    versus_manager.update_status(versus_id, VersusStatus.ERROR, error_message=str(e))
                    try:
                        label_a = await get_account_label(config.get("account_a", 0), config, "a")
                        label_b = await get_account_label(config.get("account_b", 0), config, "b")
                        await telegram_service.notify_congelar_failed(
                            versus_id, label_a, label_b, str(e)
                        )
                    except Exception:
                        pass

            # Check scheduled transferir
            pending_transferir = versus_manager.get_pending_scheduled_transferir()

            if pending_transferir:
                logger.info(f"Found {len(pending_transferir)} scheduled transferir(s) ready to execute")

            for config in pending_transferir:
                versus_id = config["id"]
                logger.info(f"Executing scheduled Transferir for Versus {versus_id}")

                try:
                    await execute_transferir_internal(versus_id)
                    logger.info(f"Scheduled Transferir completed for Versus {versus_id}")
                except Exception as e:
                    logger.error(f"Failed scheduled Transferir for Versus {versus_id}: {str(e)}")
                    versus_manager.update_status(versus_id, VersusStatus.ERROR, error_message=str(e))
                    try:
                        label_a = await get_account_label(config.get("account_a", 0), config, "a")
                        label_b = await get_account_label(config.get("account_b", 0), config, "b")
                        await telegram_service.notify_transferir_failed(
                            versus_id, label_a, label_b, str(e)
                        )
                    except Exception:
                        pass

        except Exception as e:
            logger.error(f"Error in scheduled versus checker: {str(e)}")

    logger.info("Scheduled versus checker stopped")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduled_versus_task

    # Startup
    logger.info("Starting Main Backend")

    # Start background task for scheduled congelar/transferir
    if settings.VERSUS_ENABLED:
        scheduled_versus_task = asyncio.create_task(check_scheduled_versus())
        logger.info("Scheduled versus checker started")

    yield

    # Shutdown
    logger.info("Shutting down Main Backend")
    shutdown_event.set()

    if scheduled_versus_task:
        try:
            await asyncio.wait_for(scheduled_versus_task, timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning("Scheduled versus task did not finish in time")

    # Close HTTP client pool
    await close_http_client()
    logger.info("HTTP client closed")


app = FastAPI(
    title="MT5 Main Backend",
    version="1.0.0",
    description="Aggregates MT5 account data from multiple VPS agents",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Helper function to create CORS-enabled error responses
def cors_error_response(status_code: int, detail: str, request: Request) -> JSONResponse:
    """Create a JSONResponse with CORS headers for error responses"""
    origin = request.headers.get("origin", "*")
    # Check if origin is allowed
    if "*" in settings.ALLOWED_ORIGINS or origin in settings.ALLOWED_ORIGINS:
        allowed_origin = origin
    else:
        allowed_origin = settings.ALLOWED_ORIGINS[0] if settings.ALLOWED_ORIGINS else "*"

    return JSONResponse(
        status_code=status_code,
        content={"detail": detail},
        headers={
            "Access-Control-Allow-Origin": allowed_origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )


# Auth middleware - must be BEFORE other middlewares (runs first)
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Check authentication for protected endpoints"""
    # Skip auth for OPTIONS requests (CORS preflight)
    if request.method == "OPTIONS":
        return await call_next(request)

    # Skip auth for these paths
    public_paths = [
        "/",
        "/api/auth/login",
        "/api/auth/verify",
        "/docs",
        "/openapi.json",
        "/redoc",
    ]

    path = request.url.path

    # Skip auth for public paths
    if path in public_paths or path.startswith("/docs") or path.startswith("/redoc"):
        return await call_next(request)

    # Check Authorization header
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return cors_error_response(401, "Missing authorization header", request)

    if not auth_header.startswith("Bearer "):
        return cors_error_response(401, "Invalid authorization header format", request)

    token = auth_header[7:]  # Remove "Bearer " prefix

    if not verify_token(token):
        return cors_error_response(401, "Invalid or expired token", request)

    return await call_next(request)


# Trading safety middleware
@app.middleware("http")
async def trading_safety_middleware(request: Request, call_next):
    """Block trading requests when trading is disabled"""
    # Skip for OPTIONS requests (CORS preflight)
    if request.method == "OPTIONS":
        return await call_next(request)

    if request.url.path.startswith("/api/accounts/") and "/trade/" in request.url.path:
        if not settings.TRADING_ENABLED:
            return cors_error_response(
                503,
                "Trading is currently disabled. Set TRADING_ENABLED=true in .env to enable.",
                request
            )
    # Block versus requests when versus feature is disabled
    if request.url.path.startswith("/api/versus"):
        if not settings.VERSUS_ENABLED:
            return cors_error_response(
                503,
                "Versus feature is disabled. Set VERSUS_ENABLED=true in .env to enable.",
                request
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


# Auth endpoints
@app.post("/api/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Authenticate with password and receive session token"""
    if request.password == settings.APP_PASSWORD:
        token = generate_token()
        logger.info("Successful login")
        return LoginResponse(success=True, token=token, message="Login successful")
    else:
        logger.warning("Failed login attempt")
        return JSONResponse(
            status_code=401,
            content={"success": False, "message": "Invalid password"}
        )


@app.post("/api/auth/logout")
async def logout():
    """Logout endpoint (client should clear token)"""
    return {"success": True, "message": "Logged out successfully"}


@app.get("/api/auth/verify")
async def verify_auth(request: Request):
    """Verify if current token is valid"""
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        return {"valid": False, "message": "No token provided"}

    token = auth_header[7:]

    if verify_token(token):
        return {"valid": True, "message": "Token is valid"}
    else:
        return {"valid": False, "message": "Token is invalid or expired"}


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

        # Update cache in-place instead of clearing all
        updated = await smart_cache.update_account_field(
            account_number, "phase", request.phase
        )

        if not updated:
            # Account not in cache, that's okay - will be fetched on next request
            logger.debug(f"Account {account_number} not in cache for phase update")

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

        # Update cache in-place instead of clearing all
        updated = await smart_cache.update_account_field(
            account_number, "vs_group", request.vs_group
        )

        if not updated:
            logger.debug(f"Account {account_number} not in cache for VS update")

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
    await smart_cache.clear()
    account_vps_cache.clear()
    return {"status": "success", "message": "Cache cleared, next request will fetch fresh data"}


@app.get("/api/cache/stats")
async def get_cache_stats():
    """Get cache statistics for monitoring"""
    return smart_cache.stats()


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


async def invalidate_account_cache(account_number: int):
    """
    Invalidate cache entry for a specific account only.

    This now performs SELECTIVE invalidation - only the affected account
    is removed from cache, not all accounts.
    """
    await smart_cache.invalidate_account(account_number)
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
        client = await get_http_client()
        response = await client.get(f"{agent_config['url']}/accounts", timeout=settings.AGENT_TIMEOUT)

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

        client = await get_http_client()
        response = await client.post(
            f"{vps_url}/positions/open",
            json=request,
            timeout=30.0
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
            await invalidate_account_cache(account_number)
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

        client = await get_http_client()
        response = await client.post(
            f"{vps_url}/positions/close",
            json=request,
            timeout=30.0
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
            await invalidate_account_cache(account_number)
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

        client = await get_http_client()
        response = await client.put(
            f"{vps_url}/positions/modify",
            json=request,
            timeout=30.0
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
            await invalidate_account_cache(account_number)
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

        client = await get_http_client()
        response = await client.get(f"{vps_url}/positions", timeout=30.0)

        if response.status_code == 404:
            # Handle 404 gracefully - endpoint might not exist in older VPS agent versions
            # or MT5 might not be connected - return empty positions
            logger.warning(f"VPS agent returned 404 for positions endpoint, returning empty positions for account {account_number}")
            return {
                "account_number": account_number,
                "positions": [],
                "total_profit": 0.0,
                "position_count": 0
            }

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
    except httpx.TimeoutException:
        # Handle timeout gracefully - VPS agent might be slow or unresponsive
        logger.warning(f"Timeout fetching positions for account {account_number}, returning empty positions")
        return {
            "account_number": account_number,
            "positions": [],
            "total_profit": 0.0,
            "position_count": 0
        }
    except httpx.ConnectError:
        # Handle connection error gracefully - VPS agent might be down
        logger.warning(f"Connection error fetching positions for account {account_number}, returning empty positions")
        return {
            "account_number": account_number,
            "positions": [],
            "total_profit": 0.0,
            "position_count": 0
        }
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
            tp_usd_a=request.tp_usd_a,
            sl_usd_a=request.sl_usd_a,
            tp_usd_b=request.tp_usd_b,
            sl_usd_b=request.sl_usd_b,
            scheduled_congelar=request.scheduled_congelar,
            scheduled_transferir=request.scheduled_transferir,
            holder_a=request.holder_a or "",
            prop_firm_a=request.prop_firm_a or "",
            holder_b=request.holder_b or "",
            prop_firm_b=request.prop_firm_b or "",
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

        # All statuses can be deleted

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


async def execute_congelar_internal(versus_id: str) -> dict:
    """
    Internal function to execute Congelar step.
    Can be called from API endpoint or background scheduler.
    Raises Exception on failure (not HTTPException).
    """
    config = versus_manager.get(versus_id)
    if not config:
        raise Exception(f"Versus {versus_id} not found")

    if config["status"] != VersusStatus.PENDING.value:
        raise Exception(f"Cannot congelar Versus in {config['status']} status. Must be pending.")

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
            raise Exception(f"Account {account_a} not found in any VPS agent")

    agent_config = None
    for agent in settings.VPS_AGENTS:
        if agent.get("name") == vps_source:
            agent_config = agent
            break

    if not agent_config:
        raise Exception(f"VPS agent config not found for {vps_source}")

    vps_url = agent_config["url"]
    tickets_a = []

    # Get TP/SL config for Account A (in USD)
    tp_usd_a = config["tp_usd_a"]
    sl_usd_a = config["sl_usd_a"]

    client = await get_http_client()

    # Get current price and tick value to calculate TP/SL
    quote_response = await client.get(f"{vps_url}/quote/{symbol}", timeout=30.0)
    if quote_response.status_code != 200:
        raise Exception(f"Failed to get quote for {symbol}")

    quote_data = quote_response.json()
    trade_tick_value = quote_data.get("trade_tick_value", 1.0)
    point = quote_data.get("point", 0.00001)
    pip_value = quote_data.get("pip_value", 0.0001)

    # Convert USD to pips (VPS agent open_position expects pips, not price levels)
    pips_per_point = pip_value / point  # e.g., 10 for 5-digit broker
    usd_per_pip = trade_tick_value * pips_per_point * lots
    if usd_per_pip <= 0:
        raise Exception(f"Invalid pip value calculation for {symbol}")

    tp_pips = tp_usd_a / usd_per_pip
    sl_pips = sl_usd_a / usd_per_pip

    logger.info(f"Versus {versus_id}: USD TP=${tp_usd_a}, SL=${sl_usd_a} -> {tp_pips:.1f} pips TP, {sl_pips:.1f} pips SL (usd_per_pip={usd_per_pip:.4f})")

    # Open BUY position with TP/SL in pips
    buy_request = {
        "symbol": symbol,
        "lot": lots,
        "order_type": "BUY",
        "tp": round(tp_pips, 1),
        "sl": round(sl_pips, 1),
        "comment": f"Versus-{versus_id}-BUY"
    }
    buy_response = await client.post(f"{vps_url}/positions/open", json=buy_request, timeout=30.0)

    if buy_response.status_code != 200:
        raise Exception(f"Failed to open BUY: {buy_response.text}")

    buy_result = buy_response.json()
    if not buy_result.get("success"):
        raise Exception(f"Failed to open BUY: {buy_result.get('message', 'Unknown error')}")

    buy_ticket = buy_result.get("ticket")
    tickets_a.append(buy_ticket)
    logger.info(f"Versus {versus_id}: BUY opened with ticket {buy_ticket} (TP/SL included)")

    # Open SELL position with TP/SL in pips (same values, VPS agent handles direction)
    sell_request = {
        "symbol": symbol,
        "lot": lots,
        "order_type": "SELL",
        "tp": round(tp_pips, 1),
        "sl": round(sl_pips, 1),
        "comment": f"Versus-{versus_id}-SELL"
    }
    sell_response = await client.post(f"{vps_url}/positions/open", json=sell_request, timeout=30.0)

    if sell_response.status_code != 200:
        # Rollback: close the BUY position
        logger.error(f"Versus {versus_id}: SELL failed, rolling back BUY ticket {buy_ticket}")
        try:
            await client.post(f"{vps_url}/positions/close", json={"ticket": buy_ticket}, timeout=30.0)
        except Exception as rollback_error:
            logger.error(f"Rollback failed: {rollback_error}")
        raise Exception(f"Failed to open SELL: {sell_response.text}")

    sell_result = sell_response.json()
    if not sell_result.get("success"):
        # Rollback: close the BUY position
        logger.error(f"Versus {versus_id}: SELL failed, rolling back BUY ticket {buy_ticket}")
        try:
            await client.post(f"{vps_url}/positions/close", json={"ticket": buy_ticket}, timeout=30.0)
        except Exception as rollback_error:
            logger.error(f"Rollback failed: {rollback_error}")
        raise Exception(f"Failed to open SELL: {sell_result.get('message', 'Unknown error')}")

    sell_ticket = sell_result.get("ticket")
    tickets_a.append(sell_ticket)
    logger.info(f"Versus {versus_id}: SELL opened with ticket {sell_ticket} (TP/SL included)")

    # Update status to congelado
    updated_config = versus_manager.update_status(
        versus_id,
        VersusStatus.CONGELADO,
        tickets_a=tickets_a
    )

    # Clear cache for account A
    await invalidate_account_cache(account_a)

    # Fire-and-forget notification
    try:
        label_a = await get_account_label(account_a, config, "a")
        label_b = await get_account_label(config["account_b"], config, "b")
        await telegram_service.notify_congelar_success(
            versus_id, label_a, label_b,
            symbol, lots, tp_usd_a, sl_usd_a
        )
    except Exception:
        pass

    return {
        "status": "success",
        "message": f"Congelado: BUY and SELL opened on Account A",
        "versus": updated_config,
        "tickets": tickets_a
    }


@app.post("/api/versus/{versus_id}/congelar")
async def execute_congelar(versus_id: str):
    """
    Execute the Congelar step:
    1. Open BUY on Account A with TP/SL
    2. Open SELL on Account A with TP/SL
    3. Store tickets, set status = "congelado"
    """
    try:
        result = await execute_congelar_internal(versus_id)
        return result
    except Exception as e:
        logger.error(f"Error executing Congelar: {str(e)}")
        config = versus_manager.get(versus_id)
        versus_manager.update_status(versus_id, VersusStatus.ERROR, error_message=str(e))
        try:
            label_a = await get_account_label(config["account_a"], config, "a") if config else "0"
            label_b = await get_account_label(config["account_b"], config, "b") if config else "0"
            await telegram_service.notify_congelar_failed(
                versus_id, label_a, label_b, str(e)
            )
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))


async def execute_transferir_internal(versus_id: str) -> dict:
    """
    Internal function to execute Transferir step.
    Can be called from API endpoint or background scheduler.
    Raises Exception on failure (not HTTPException).
    """
    config = versus_manager.get(versus_id)
    if not config:
        raise Exception(f"Versus {versus_id} not found")

    if config["status"] != VersusStatus.CONGELADO.value:
        raise Exception(f"Cannot transferir Versus in {config['status']} status. Must be congelado.")

    account_a = config["account_a"]
    account_b = config["account_b"]
    symbol = config["symbol"]
    lots = config["lots"]
    side = config["side"]  # Account A's direction
    tp_usd_a = config["tp_usd_a"]
    sl_usd_a = config["sl_usd_a"]
    tp_usd_b = config["tp_usd_b"]
    sl_usd_b = config["sl_usd_b"]
    tickets_a = config["tickets_a"]

    if len(tickets_a) != 2:
        raise Exception(f"Expected 2 tickets on Account A, found {len(tickets_a)}")

    logger.info(f"Executing Transferir for Versus {versus_id}")

    # Find VPS for accounts
    vps_a = account_vps_cache.get(account_a)
    vps_b = account_vps_cache.get(account_b)

    if not vps_a or not vps_b:
        await data_aggregator.fetch_all_agents()
        vps_a = account_vps_cache.get(account_a)
        vps_b = account_vps_cache.get(account_b)

    if not vps_a:
        raise Exception(f"Account {account_a} not found")
    if not vps_b:
        raise Exception(f"Account {account_b} not found")

    # Get VPS configs
    agent_config_a = None
    agent_config_b = None
    for agent in settings.VPS_AGENTS:
        if agent.get("name") == vps_a:
            agent_config_a = agent
        if agent.get("name") == vps_b:
            agent_config_b = agent

    if not agent_config_a:
        raise Exception(f"VPS config not found for {vps_a}")
    if not agent_config_b:
        raise Exception(f"VPS config not found for {vps_b}")

    vps_url_a = agent_config_a["url"]
    vps_url_b = agent_config_b["url"]

    client = await get_http_client()

    # Congelar always stores tickets_a as [buy_ticket, sell_ticket]
    buy_ticket = int(tickets_a[0])
    sell_ticket = int(tickets_a[1])
    logger.info(f"Versus {versus_id}: BUY ticket={buy_ticket}, SELL ticket={sell_ticket}")

    # Try to get positions for commission data (non-fatal if it fails)
    positions = []
    try:
        positions_response = await client.get(f"{vps_url_a}/positions", timeout=30.0)
        if positions_response.status_code == 200:
            positions_data = positions_response.json()
            positions = positions_data.get("positions", [])
            logger.info(f"Versus {versus_id}: Account A returned {len(positions)} positions")
        else:
            logger.warning(f"Versus {versus_id}: Failed to get positions (status {positions_response.status_code}), commission will be 0")
    except Exception as e:
        logger.warning(f"Versus {versus_id}: Failed to get positions: {e}, commission will be 0")

    # Determine decimals based on symbol type
    symbol_upper = symbol.upper()
    if "JPY" in symbol_upper:
        decimals = 3
    elif symbol_upper.startswith(("BTC", "ETH", "XRP", "LTC", "BCH", "XAU", "XAG")):
        decimals = 2
    else:
        decimals = 5

    # Fetch quote from broker (includes trade_tick_value for USD conversion)
    quote_response = await client.get(f"{vps_url_a}/quote/{symbol}", timeout=30.0)
    if quote_response.status_code != 200:
        raise Exception(f"Failed to get quote for {symbol}")

    quote_data = quote_response.json()
    spread_pips = quote_data.get("spread_pips", 0)
    trade_tick_value = quote_data.get("trade_tick_value", 1.0)
    point = quote_data.get("point", 0.00001)
    pip_value = quote_data.get("pip_value", 0.0001)

    # Get current price from quote (bid for BUY side, ask for SELL side)
    current_bid = quote_data.get("bid", 0)
    current_ask = quote_data.get("ask", 0)
    current_price = current_bid if side == "BUY" else current_ask
    logger.info(f"Versus {versus_id}: Current spread for {symbol}: {spread_pips} pips, bid={current_bid}, ask={current_ask}, using price={current_price} for side={side}")

    if current_price <= 0:
        raise Exception(f"Invalid current price from quote: bid={current_bid}, ask={current_ask}")

    # Convert USD to pips
    pips_per_point = pip_value / point  # e.g., 10 for 5-digit broker
    usd_per_pip = trade_tick_value * pips_per_point * lots
    if usd_per_pip <= 0:
        raise Exception(f"Invalid pip value calculation for {symbol}")

    # Get per-lot commission from Account A's positions
    commission_per_lot = 0.0
    for p in positions:
        if p.get("commission", 0) != 0:
            commission_per_lot = abs(p["commission"]) / p.get("volume", lots)
            break

    # Forward commission = Account B open + close (2 sides × commission_per_lot × lots)
    total_forward_commission_usd = commission_per_lot * lots * 2
    commission_pips = total_forward_commission_usd / usd_per_pip if usd_per_pip > 0 else 0

    logger.info(f"Versus {versus_id}: Commission per lot: ${commission_per_lot}, total forward: ${total_forward_commission_usd}, in pips: {commission_pips}")

    tp_pips_b = tp_usd_b / usd_per_pip
    sl_pips_b = sl_usd_b / usd_per_pip

    # Calculate TP and SL based on side
    # Account A modify_position expects PRICE LEVELS
    # Account B open_position expects PIPS
    if side == "BUY":
        # Account A keeps BUY, close SELL
        ticket_to_close = sell_ticket
        remaining_ticket = buy_ticket

        # BUY: subtract spread and commission (TP closer to market price)
        new_tp_pips_a = sl_pips_b - spread_pips - commission_pips
        new_sl_pips_a = tp_pips_b - spread_pips - commission_pips
        tp_price_a = round(current_price + (new_tp_pips_a * pip_value), decimals)
        sl_price_a = round(current_price - (new_sl_pips_a * pip_value), decimals)

        # Account B opens SELL (opposite) with adjusted TP/SL in PIPS
        opposite_side = "SELL"
        tp_pips_b_send = round(tp_pips_b - spread_pips - commission_pips, 1)
        sl_pips_b_send = round(sl_pips_b - spread_pips - commission_pips, 1)
    else:  # SELL
        # Account A keeps SELL, close BUY
        ticket_to_close = buy_ticket
        remaining_ticket = sell_ticket

        # SELL: add spread, subtract commission
        new_tp_pips_a = sl_pips_b + spread_pips - commission_pips
        new_sl_pips_a = tp_pips_b + spread_pips - commission_pips
        tp_price_a = round(current_price - (new_tp_pips_a * pip_value), decimals)
        sl_price_a = round(current_price + (new_sl_pips_a * pip_value), decimals)

        # Account B opens BUY (opposite) with adjusted TP/SL in PIPS
        opposite_side = "BUY"
        tp_pips_b_send = round(tp_pips_b + spread_pips - commission_pips, 1)
        sl_pips_b_send = round(sl_pips_b + spread_pips - commission_pips, 1)

    logger.info(f"Versus {versus_id}: Closing ticket {ticket_to_close}, keeping {remaining_ticket}")
    logger.info(f"Account A TP: {tp_price_a}, SL: {sl_price_a} (modify with price levels)")
    logger.info(f"Account B ({opposite_side}) TP: {tp_pips_b_send} pips, SL: {sl_pips_b_send} pips (USD: tp=${tp_usd_b}, sl=${sl_usd_b})")

    # Step 1: Close opposite trade on Account A
    close_response = await client.post(f"{vps_url_a}/positions/close", json={"ticket": ticket_to_close}, timeout=30.0)
    if close_response.status_code != 200:
        raise Exception(f"Failed to close opposite position: {close_response.text}")

    close_result = close_response.json()
    if not close_result.get("success"):
        raise Exception(f"Failed to close position: {close_result.get('message')}")

    logger.info(f"Versus {versus_id}: Closed ticket {ticket_to_close}")

    # Step 2: Modify remaining trade on Account A with TP and SL
    modify_response = await client.put(f"{vps_url_a}/positions/modify", json={
        "ticket": remaining_ticket,
        "tp": tp_price_a,
        "sl": sl_price_a
    }, timeout=30.0)
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
            "tp": tp_pips_b_send,
            "sl": sl_pips_b_send,
            "comment": f"Versus-{versus_id}-B{i+1}"
        }
        open_b_response = await client.post(f"{vps_url_b}/positions/open", json=open_b_request, timeout=30.0)

        if open_b_response.status_code != 200:
            versus_manager.update_status(versus_id, VersusStatus.ERROR,
                error_message=f"Failed to open trade {i+1} on Account B")
            raise Exception(f"Failed to open trade on Account B: {open_b_response.text}")

        open_b_result = open_b_response.json()
        if not open_b_result.get("success"):
            versus_manager.update_status(versus_id, VersusStatus.ERROR,
                error_message=f"Failed to open trade {i+1} on Account B: {open_b_result.get('message')}")
            raise Exception(f"Failed to open trade on Account B")

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
    await invalidate_account_cache(account_a)
    await invalidate_account_cache(account_b)

    # Fire-and-forget notification
    try:
        label_a = await get_account_label(account_a, config, "a")
        label_b = await get_account_label(account_b, config, "b")
        # Show adjusted TP/SL (Account A's TP/SL now comes from B's values with spread/commission)
        adjusted_tp_usd_a = round(new_tp_pips_a * usd_per_pip, 2)
        adjusted_sl_usd_a = round(new_sl_pips_a * usd_per_pip, 2)
        adjusted_tp_usd_b = round(tp_pips_b_send * usd_per_pip, 2)
        adjusted_sl_usd_b = round(sl_pips_b_send * usd_per_pip, 2)
        await telegram_service.notify_transferir_success(
            versus_id, label_a, label_b,
            symbol, side, lots,
            tp_usd_a=adjusted_tp_usd_a, sl_usd_a=adjusted_sl_usd_a,
            tp_usd_b=adjusted_tp_usd_b, sl_usd_b=adjusted_sl_usd_b
        )
    except Exception:
        pass

    return {
        "status": "success",
        "message": f"Transferido: Account A has 1 {side} trade, Account B has 2 {opposite_side} trades",
        "versus": updated_config,
        "account_a_ticket": remaining_ticket,
        "account_b_tickets": tickets_b,
        "prices": {
            "account_a": {"tp": tp_price_a, "sl": sl_price_a},
            "account_b": {"tp_pips": tp_pips_b_send, "sl_pips": sl_pips_b_send}
        }
    }


@app.post("/api/versus/{versus_id}/transferir")
async def execute_transferir(versus_id: str):
    """
    Execute the Transferir step:
    1. Close opposite trade on Account A (if side=BUY, close SELL ticket)
    2. Modify remaining trade on Account A with TP and SL (price-based)
    3. Open 2 trades on Account B (opposite direction, X/2 lots each)
    4. Store tickets, set status = "transferido"
    """
    try:
        result = await execute_transferir_internal(versus_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing Transferir: {str(e)}")
        config = versus_manager.get(versus_id)
        versus_manager.update_status(versus_id, VersusStatus.ERROR, error_message=str(e))
        try:
            label_a = await get_account_label(config["account_a"], config, "a") if config else "0"
            label_b = await get_account_label(config["account_b"], config, "b") if config else "0"
            await telegram_service.notify_transferir_failed(
                versus_id, label_a, label_b, str(e)
            )
        except Exception:
            pass
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
