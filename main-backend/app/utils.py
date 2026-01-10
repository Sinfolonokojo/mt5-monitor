import logging
from datetime import datetime


def setup_logging(log_level: str = "INFO"):
    """Configure logging for the application"""
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )


def format_currency(value: float, currency: str = "USD") -> str:
    """Format currency value"""
    return f"{currency} {value:,.2f}"
