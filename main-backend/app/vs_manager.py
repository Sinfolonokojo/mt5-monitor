import json
import os
import logging
from typing import Dict, Optional, Tuple
from threading import RLock
from .config import settings

logger = logging.getLogger(__name__)


class VSManager:
    """Manages VS (Virtual Stop) values for accounts - stores in JSON file"""

    def __init__(self, file_path: str = None):
        self.file_path = file_path or os.path.join(os.path.dirname(settings.PHASE_DATA_FILE), "vs_data.json")
        self.vs_values: Dict[str, str] = {}
        self.lock = RLock()
        self._ensure_data_directory()
        self.load_vs_values()

    def _ensure_data_directory(self):
        """Ensure the data directory exists"""
        directory = os.path.dirname(self.file_path)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
            logger.info(f"Created data directory: {directory}")

    def load_vs_values(self):
        """Load VS values from JSON file"""
        with self.lock:
            try:
                if os.path.exists(self.file_path):
                    with open(self.file_path, 'r') as f:
                        self.vs_values = json.load(f)
                    logger.info(f"Loaded {len(self.vs_values)} VS values from {self.file_path}")
                else:
                    self.vs_values = {}
                    self.save_vs_values()
                    logger.info(f"Created new VS data file at {self.file_path}")
            except Exception as e:
                logger.error(f"Error loading VS values: {str(e)}")
                self.vs_values = {}

    def save_vs_values(self):
        """Persist VS values to JSON file"""
        with self.lock:
            try:
                with open(self.file_path, 'w') as f:
                    json.dump(self.vs_values, f, indent=2)
                logger.info(f"Saved {len(self.vs_values)} VS values to {self.file_path}")
            except Exception as e:
                logger.error(f"Error saving VS values: {str(e)}")

    def get_vs(self, account_number: int) -> Optional[str]:
        """Get VS value for an account (default: None)"""
        with self.lock:
            return self.vs_values.get(str(account_number))

    def update_vs(self, account_number: int, vs_value: str) -> Tuple[bool, str]:
        """
        Update VS value for an account and persist.
        Returns (success, message) tuple.
        Enforces max 2 accounts per VS group.
        """
        with self.lock:
            if vs_value and vs_value.strip():
                vs_value = vs_value.strip()

                # Check how many accounts already have this VS value
                accounts_with_this_vs = [acc for acc, val in self.vs_values.items()
                                         if val == vs_value and acc != str(account_number)]

                if len(accounts_with_this_vs) >= 2:
                    return (False, f"VS group '{vs_value}' already has 2 accounts assigned. Each VS group can only have 2 accounts.")

                self.vs_values[str(account_number)] = vs_value
                logger.info(f"Updated VS for account {account_number} to '{vs_value}'")
                self.save_vs_values()
                return (True, f"VS updated to '{vs_value}'")
            else:
                # Remove VS if empty value is provided
                if str(account_number) in self.vs_values:
                    del self.vs_values[str(account_number)]
                    logger.info(f"Removed VS for account {account_number}")
                    self.save_vs_values()
                    return (True, "VS removed")
                return (True, "No changes made")

    def get_all_vs_values(self) -> Dict[str, str]:
        """Get all VS values"""
        with self.lock:
            return self.vs_values.copy()


# Singleton instance
vs_manager = VSManager()
