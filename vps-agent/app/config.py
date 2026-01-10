from pydantic_settings import BaseSettings
from typing import List, Dict
import json
import os


class Settings(BaseSettings):
    # Agent identification
    AGENT_NAME: str = "VPS-Agent-1"
    AGENT_PORT: int = 8000

    # MT5 Accounts configuration (JSON string from env)
    MT5_ACCOUNTS_JSON: str = "[]"

    # CORS settings
    ALLOWED_ORIGINS: List[str] = ["*"]

    # Logging
    LOG_LEVEL: str = "INFO"

    @property
    def MT5_ACCOUNTS(self) -> List[Dict]:
        """Parse MT5 accounts from JSON string"""
        try:
            return json.loads(self.MT5_ACCOUNTS_JSON)
        except json.JSONDecodeError:
            return []

    class Config:
        env_file = ".env"


settings = Settings()
