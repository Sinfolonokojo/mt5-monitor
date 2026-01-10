from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from .config import settings
from .mt5_service import MT5Service
from .models import AccountResponse, AgentHealthResponse
from .utils import setup_logging
from datetime import datetime

# Configure logging
setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

# Initialize MT5 service with terminal path from config
mt5_service = MT5Service(
    terminal_path=settings.MT5_TERMINAL_PATH,
    display_name=settings.ACCOUNT_DISPLAY_NAME
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting {settings.AGENT_NAME}")
    mt5_service.initialize()
    yield
    # Shutdown
    logger.info(f"Shutting down {settings.AGENT_NAME}")
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
        accounts_monitored=len(settings.MT5_ACCOUNTS),
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
