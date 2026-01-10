import json
import os
import logging
from typing import Dict
from threading import Lock
from .config import settings

logger = logging.getLogger(__name__)


class PhaseManager:
    """Manages phase values for accounts - stores in JSON file"""

    def __init__(self, file_path: str = None):
        self.file_path = file_path or settings.PHASE_DATA_FILE
        self.phases: Dict[str, str] = {}
        self.lock = Lock()
        self._ensure_data_directory()
        self.load_phases()

    def _ensure_data_directory(self):
        """Ensure the data directory exists"""
        directory = os.path.dirname(self.file_path)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
            logger.info(f"Created data directory: {directory}")

    def load_phases(self):
        """Load phases from JSON file"""
        with self.lock:
            try:
                if os.path.exists(self.file_path):
                    with open(self.file_path, 'r') as f:
                        self.phases = json.load(f)
                    logger.info(f"Loaded {len(self.phases)} phase values from {self.file_path}")
                else:
                    self.phases = {}
                    self.save_phases()
                    logger.info(f"Created new phase data file at {self.file_path}")
            except Exception as e:
                logger.error(f"Error loading phases: {str(e)}")
                self.phases = {}

    def save_phases(self):
        """Persist phases to JSON file"""
        with self.lock:
            try:
                with open(self.file_path, 'w') as f:
                    json.dump(self.phases, f, indent=2)
                logger.info(f"Saved {len(self.phases)} phase values to {self.file_path}")
            except Exception as e:
                logger.error(f"Error saving phases: {str(e)}")

    def get_phase(self, account_number: int) -> str:
        """Get phase for an account (default: 'F1')"""
        with self.lock:
            return self.phases.get(str(account_number), "F1")

    def update_phase(self, account_number: int, phase_value: str):
        """Update phase value for an account and persist"""
        with self.lock:
            self.phases[str(account_number)] = phase_value
            logger.info(f"Updated phase for account {account_number} to '{phase_value}'")
        self.save_phases()

    def get_all_phases(self) -> Dict[str, str]:
        """Get all phase values"""
        with self.lock:
            return self.phases.copy()


# Singleton instance
phase_manager = PhaseManager()
