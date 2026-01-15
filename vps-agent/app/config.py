from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Agent identification
    AGENT_NAME: str = "VPS-Agent-1"
    AGENT_PORT: int = 8000

    # MT5 Terminal configuration (NEW - for multi-terminal architecture)
    MT5_TERMINAL_PATH: str = ""
    ACCOUNT_DISPLAY_NAME: str = "Account"

    # Account metadata
    ACCOUNT_HOLDER: str = "Unknown"
    PROP_FIRM: str = "N/A"
    INITIAL_BALANCE: float = 100000.0

    # CORS settings
    ALLOWED_ORIGINS: List[str] = ["*"]

    # Logging
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignore extra environment variables from old setup


settings = Settings()
