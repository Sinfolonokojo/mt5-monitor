import json
import os
import logging
import uuid
from typing import Dict, Optional, List
from threading import RLock
from datetime import datetime
from .config import settings
from .models import VersusStatus

logger = logging.getLogger(__name__)


class VersusManager:
    """Manages Versus hedging configurations - stores in JSON file"""

    def __init__(self, file_path: str = None):
        self.file_path = file_path or os.path.join(os.path.dirname(settings.PHASE_DATA_FILE), "versus_data.json")
        self.versus_configs: Dict[str, dict] = {}
        self.lock = RLock()
        self._ensure_data_directory()
        self.load_configs()

    def _ensure_data_directory(self):
        """Ensure the data directory exists"""
        directory = os.path.dirname(self.file_path)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
            logger.info(f"Created data directory: {directory}")

    def load_configs(self):
        """Load Versus configurations from JSON file"""
        with self.lock:
            try:
                if os.path.exists(self.file_path):
                    with open(self.file_path, 'r') as f:
                        self.versus_configs = json.load(f)
                    logger.info(f"Loaded {len(self.versus_configs)} Versus configs from {self.file_path}")
                else:
                    self.versus_configs = {}
                    self.save_configs()
                    logger.info(f"Created new Versus data file at {self.file_path}")
            except Exception as e:
                logger.error(f"Error loading Versus configs: {str(e)}")
                self.versus_configs = {}

    def save_configs(self):
        """Persist Versus configurations to JSON file"""
        with self.lock:
            try:
                with open(self.file_path, 'w') as f:
                    json.dump(self.versus_configs, f, indent=2, default=str)
                logger.info(f"Saved {len(self.versus_configs)} Versus configs to {self.file_path}")
            except Exception as e:
                logger.error(f"Error saving Versus configs: {str(e)}")

    def create(self, account_a: int, account_b: int, symbol: str, lots: float,
               side: str, tp_pips: float, sl_pips: float,
               scheduled_congelar: Optional[datetime] = None) -> dict:
        """
        Create a new Versus configuration.
        Returns the created config dict.
        """
        with self.lock:
            versus_id = str(uuid.uuid4())[:8]  # Short UUID for readability
            now = datetime.now().isoformat()

            config = {
                "id": versus_id,
                "account_a": account_a,
                "account_b": account_b,
                "symbol": symbol.upper(),
                "lots": lots,
                "side": side.upper(),
                "tp_pips": tp_pips,
                "sl_pips": sl_pips,
                "status": VersusStatus.PENDING.value,
                "created_at": now,
                "updated_at": now,
                "scheduled_congelar": scheduled_congelar.isoformat() if scheduled_congelar else None,
                "tickets_a": [],
                "tickets_b": [],
                "error_message": None
            }

            self.versus_configs[versus_id] = config
            self.save_configs()
            logger.info(f"Created Versus {versus_id}: Account A={account_a}, Account B={account_b}, {side} {lots} lots on {symbol}")
            return config

    def get(self, versus_id: str) -> Optional[dict]:
        """Get a Versus configuration by ID"""
        with self.lock:
            return self.versus_configs.get(versus_id)

    def get_all(self) -> List[dict]:
        """Get all Versus configurations"""
        with self.lock:
            return list(self.versus_configs.values())

    def update_status(self, versus_id: str, status: VersusStatus,
                      tickets_a: List[int] = None, tickets_b: List[int] = None,
                      error_message: str = None) -> Optional[dict]:
        """
        Update the status of a Versus configuration.
        Optionally update tickets and error message.
        """
        with self.lock:
            config = self.versus_configs.get(versus_id)
            if not config:
                logger.error(f"Versus {versus_id} not found")
                return None

            config["status"] = status.value
            config["updated_at"] = datetime.now().isoformat()

            if tickets_a is not None:
                config["tickets_a"] = tickets_a
            if tickets_b is not None:
                config["tickets_b"] = tickets_b
            if error_message is not None:
                config["error_message"] = error_message

            self.save_configs()
            logger.info(f"Updated Versus {versus_id} status to {status.value}")
            return config

    def delete(self, versus_id: str) -> bool:
        """Delete a Versus configuration"""
        with self.lock:
            if versus_id in self.versus_configs:
                del self.versus_configs[versus_id]
                self.save_configs()
                logger.info(f"Deleted Versus {versus_id}")
                return True
            logger.warning(f"Versus {versus_id} not found for deletion")
            return False

    def get_pending_scheduled(self) -> List[dict]:
        """Get all pending Versus configs with scheduled_congelar time that has passed"""
        with self.lock:
            now = datetime.now()
            pending = []
            for config in self.versus_configs.values():
                if (config["status"] == VersusStatus.PENDING.value and
                    config.get("scheduled_congelar")):
                    scheduled_time = datetime.fromisoformat(config["scheduled_congelar"])
                    if scheduled_time <= now:
                        pending.append(config)
            return pending


# Singleton instance
versus_manager = VersusManager()
