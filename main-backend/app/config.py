from pydantic_settings import BaseSettings
from typing import List, Dict
import json


class Settings(BaseSettings):
    # Server settings
    API_PORT: int = 8080
    API_HOST: str = "0.0.0.0"

    # VPS Agents configuration (JSON string)
    VPS_AGENTS_JSON: str = "[]"

    # CORS settings
    ALLOWED_ORIGINS: List[str] = ["*"]

    # Timeout settings
    AGENT_TIMEOUT: int = 10  # seconds

    # Cache settings
    CACHE_TTL: int = 60  # seconds

    # Logging
    LOG_LEVEL: str = "INFO"

    # Phase data file path
    PHASE_DATA_FILE: str = "data/phases.json"

    # Google Sheets Integration (Optional)
    GOOGLE_SHEETS_CREDENTIALS_FILE: str = "credentials.json"
    GOOGLE_SHEETS_SPREADSHEET_ID: str = ""
    GOOGLE_SHEETS_WORKSHEET_NAME: str = "MT5 Accounts"

    # Trading Safety Settings
    TRADING_ENABLED: bool = False  # Set to True to enable trading
    DEMO_MODE_ONLY: bool = True  # Set to False to allow live trading (not implemented yet)

    # Versus Feature Settings
    VERSUS_ENABLED: bool = False  # Set to True to enable Versus hedging feature

    @property
    def VPS_AGENTS(self) -> List[Dict]:
        """Parse VPS agents from JSON string"""
        try:
            return json.loads(self.VPS_AGENTS_JSON)
        except json.JSONDecodeError:
            return []

    class Config:
        env_file = ".env"


settings = Settings()
