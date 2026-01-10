from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Agent identification
    AGENT_NAME: str = "VPS-Agent-1"
    AGENT_PORT: int = 8000

    # MT5 Terminal configuration (NEW - for multi-terminal architecture)
    MT5_TERMINAL_PATH: str = ""
    ACCOUNT_DISPLAY_NAME: str = "Account"

    # CORS settings
    ALLOWED_ORIGINS: List[str] = ["*"]

    # Logging
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"


settings = Settings()
