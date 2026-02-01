from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import asyncio
from .config import settings
from .mt5_service import MT5Service
from .models import (
    AccountResponse, AgentHealthResponse, TradeHistoryResponse,
    OpenPositionRequest, OpenPositionResponse, ClosePositionRequest,
    ClosePositionResponse, ModifyPositionRequest, ModifyPositionResponse,
    OpenPositionsResponse
)
from .utils import setup_logging
from datetime import datetime

# Configure logging
setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

# Initialize MT5 service with terminal path from config
mt5_service = MT5Service(
    terminal_path=settings.MT5_TERMINAL_PATH,
    display_name=settings.ACCOUNT_DISPLAY_NAME,
    account_holder=settings.ACCOUNT_HOLDER,
    prop_firm=settings.PROP_FIRM,
    initial_balance=settings.INITIAL_BALANCE
)

# Background task control
health_check_task = None
shutdown_event = asyncio.Event()


async def periodic_health_check():
    """Background task that periodically checks MT5 connection health"""
    logger.info("Starting periodic health check (every 60 seconds)")

    while not shutdown_event.is_set():
        try:
            await asyncio.sleep(60)  # Check every 60 seconds

            if shutdown_event.is_set():
                break

            logger.info(f"Running periodic health check for {settings.AGENT_NAME}")

            # Test the connection by trying to get account info
            account_info = mt5_service.get_account_info()

            if account_info:
                logger.info(f"Health check passed for {settings.ACCOUNT_DISPLAY_NAME}")
            else:
                logger.warning(f"Health check failed for {settings.ACCOUNT_DISPLAY_NAME} - connection will auto-reconnect on next request")

        except Exception as e:
            logger.error(f"Error in periodic health check: {str(e)}")

    logger.info("Periodic health check stopped")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global health_check_task

    # Startup
    logger.info(f"Starting {settings.AGENT_NAME}")
    mt5_service.initialize()

    # Start background health check
    health_check_task = asyncio.create_task(periodic_health_check())

    yield

    # Shutdown
    logger.info(f"Shutting down {settings.AGENT_NAME}")
    shutdown_event.set()

    # Wait for health check to finish
    if health_check_task:
        try:
            await asyncio.wait_for(health_check_task, timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning("Health check task did not finish in time")

    mt5_service.shutdown()


app = FastAPI(
    title=f"MT5 Agent - {settings.AGENT_NAME}",
    version="1.0.0",
    description="VPS Agent for monitoring MT5 trading accounts",
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


@app.get("/")
async def root():
    """Root endpoint - basic info"""
    return {
        "service": "MT5 VPS Agent",
        "agent_name": settings.AGENT_NAME,
        "status": "online",
        "version": "1.0.0"
    }


@app.get("/health", response_model=AgentHealthResponse)
async def health_check():
    """Health check endpoint"""
    return AgentHealthResponse(
        status="healthy" if mt5_service.initialized else "unhealthy",
        accounts_monitored=1,  # Single account per agent in multi-terminal architecture
        mt5_initialized=mt5_service.initialized,
        timestamp=datetime.now()
    )


@app.get("/accounts", response_model=AccountResponse)
async def get_accounts():
    """Get MT5 account info from this agent's terminal"""
    try:
        logger.info(f"Fetching account data for {settings.ACCOUNT_DISPLAY_NAME}")
        account = mt5_service.get_account_data()
        logger.info(f"Successfully fetched account {account.account_number}")
        return account
    except Exception as e:
        logger.error(f"Error fetching account: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch account: {str(e)}")


@app.post("/refresh")
async def refresh_mt5():
    """Force MT5 reconnection"""
    try:
        logger.info("Refreshing MT5 connection")
        mt5_service.shutdown()
        if mt5_service.initialize():
            return {"status": "success", "message": "MT5 reconnected successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to reconnect MT5")
    except Exception as e:
        logger.error(f"Error refreshing MT5: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/trade-history", response_model=TradeHistoryResponse)
async def get_trade_history(from_date: str = None, days: int = None):
    """
    Get detailed trade history (closed trades only)

    Args:
        from_date: ISO format date string to fetch trades from (optional, for incremental fetching)
        days: Number of days to look back (optional, default 90 if from_date not provided)
    """
    try:
        from datetime import datetime

        # Parse from_date if provided
        parsed_from_date = None
        if from_date:
            try:
                parsed_from_date = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
                logger.info(f"Fetching trade history from {from_date}")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid from_date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)")

        # Validate days parameter if provided
        if days is not None:
            if days < 1:
                raise HTTPException(status_code=400, detail="Days parameter must be at least 1")
            if days > 365:
                raise HTTPException(status_code=400, detail="Days parameter cannot exceed 365")

        logger.info(f"Fetching trade history for {settings.ACCOUNT_DISPLAY_NAME}")
        trade_history = mt5_service.get_trade_history(from_date=parsed_from_date, days=days)

        if trade_history is None:
            raise HTTPException(status_code=500, detail="Failed to fetch trade history")

        logger.info(f"Successfully fetched {trade_history.total_trades} trades")
        return trade_history

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching trade history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch trade history: {str(e)}")


# Trading Endpoints

@app.post("/positions/open", response_model=OpenPositionResponse)
async def open_position(request: OpenPositionRequest):
    """
    Open a new market position

    Args:
        request: OpenPositionRequest with trade parameters (symbol, lot, order_type, sl, tp, comment)

    Returns:
        OpenPositionResponse with result
    """
    try:
        logger.info(f"Opening position: {request.symbol} {request.order_type} {request.lot} lots")
        response = mt5_service.open_position(request)

        if not response.success:
            logger.error(f"Failed to open position: {response.message}")
            raise HTTPException(status_code=400, detail=response.message)

        logger.info(f"✅ Position opened successfully: Ticket {response.ticket}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error opening position: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to open position: {str(e)}")


@app.post("/positions/close", response_model=ClosePositionResponse)
async def close_position(request: ClosePositionRequest):
    """
    Close an existing position

    Args:
        request: ClosePositionRequest with ticket number

    Returns:
        ClosePositionResponse with result
    """
    try:
        logger.info(f"Closing position: Ticket {request.ticket}")
        response = mt5_service.close_position(request)

        if not response.success:
            logger.error(f"Failed to close position: {response.message}")
            raise HTTPException(status_code=400, detail=response.message)

        logger.info(f"✅ Position closed successfully: Ticket {response.ticket}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error closing position: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to close position: {str(e)}")


@app.put("/positions/modify", response_model=ModifyPositionResponse)
async def modify_position(request: ModifyPositionRequest):
    """
    Modify SL/TP on an existing position

    Args:
        request: ModifyPositionRequest with ticket and new SL/TP values

    Returns:
        ModifyPositionResponse with result
    """
    try:
        logger.info(f"Modifying position: Ticket {request.ticket}, SL={request.sl}, TP={request.tp}")
        response = mt5_service.modify_position(request)

        if not response.success:
            logger.error(f"Failed to modify position: {response.message}")
            raise HTTPException(status_code=400, detail=response.message)

        logger.info(f"✅ Position modified successfully: Ticket {response.ticket}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error modifying position: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to modify position: {str(e)}")


@app.get("/positions", response_model=OpenPositionsResponse)
async def get_open_positions():
    """
    Get all open positions for this account

    Returns:
        OpenPositionsResponse with list of open positions
    """
    try:
        logger.info(f"Fetching open positions for {settings.ACCOUNT_DISPLAY_NAME}")
        response = mt5_service.get_open_positions()

        logger.info(f"Successfully fetched {response.position_count} open positions")
        return response

    except Exception as e:
        logger.error(f"Error fetching open positions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch open positions: {str(e)}")


@app.get("/quote/{symbol}")
async def get_quote(symbol: str):
    """
    Get current bid/ask quote and spread for a symbol

    Args:
        symbol: Trading symbol (e.g., EURUSD)

    Returns:
        Quote data with bid, ask, and spread in pips
    """
    try:
        logger.info(f"Fetching quote for {symbol}")
        quote = mt5_service.get_quote(symbol)

        if quote is None:
            raise HTTPException(status_code=404, detail=f"Quote not found for {symbol}")

        logger.info(f"Quote for {symbol}: bid={quote['bid']}, ask={quote['ask']}, spread={quote['spread_pips']} pips")
        return quote

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching quote for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch quote: {str(e)}")
