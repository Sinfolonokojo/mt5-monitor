from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from .config import settings
from .mt5_service import mt5_service
from .models import AccountResponse, AgentHealthResponse
from .utils import setup_logging
from typing import List
from datetime import datetime

# Configure logging
setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


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


@app.get("/accounts", response_model=List[AccountResponse])
async def get_accounts():
    """Get all MT5 accounts info from this VPS"""
    try:
        logger.info("Fetching accounts data")
        accounts = mt5_service.get_all_accounts()
        logger.info(f"Successfully fetched {len(accounts)} accounts")
        return accounts
    except Exception as e:
        logger.error(f"Error fetching accounts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch accounts: {str(e)}")


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
