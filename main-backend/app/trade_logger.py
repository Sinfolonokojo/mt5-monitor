import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
import uuid

logger = logging.getLogger(__name__)


class TradeLogger:
    """Audit logger for all trading operations"""

    def __init__(self, log_dir: str = "trade_logs"):
        """
        Initialize trade logger

        Args:
            log_dir: Directory to store trade logs (default: "trade_logs")
        """
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)
        logger.info(f"Trade logger initialized. Logs will be saved to: {self.log_dir.absolute()}")

    def _get_log_file(self) -> Path:
        """Get log file path for today"""
        today = datetime.now().strftime("%Y-%m-%d")
        return self.log_dir / f"trades_{today}.jsonl"

    def _write_log(self, log_entry: Dict[str, Any]) -> None:
        """
        Write log entry to file

        Args:
            log_entry: Dictionary containing log data
        """
        try:
            log_file = self._get_log_file()
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e:
            logger.error(f"Failed to write trade log: {str(e)}")

    def log_trade_request(
        self,
        operation: str,
        account_number: int,
        request_data: Dict[str, Any],
        user_id: str = "system"
    ) -> str:
        """
        Log trade request before execution

        Args:
            operation: Operation type (e.g., "OPEN_POSITION", "CLOSE_POSITION", "MODIFY_POSITION")
            account_number: MT5 account number
            request_data: Trade request parameters
            user_id: User ID (default "system" for MVP)

        Returns:
            transaction_id: Unique identifier for this trade
        """
        transaction_id = str(uuid.uuid4())

        log_entry = {
            "transaction_id": transaction_id,
            "timestamp": datetime.now().isoformat(),
            "operation": operation,
            "account_number": account_number,
            "user_id": user_id,
            "status": "pending",
            "request": request_data,
            "response": None
        }

        self._write_log(log_entry)
        logger.info(f"Trade request logged: {transaction_id} - {operation} for account {account_number}")

        return transaction_id

    def log_trade_response(
        self,
        transaction_id: str,
        operation: str,
        account_number: int,
        response_data: Dict[str, Any],
        success: bool,
        user_id: str = "system"
    ) -> None:
        """
        Log trade response after execution

        Args:
            transaction_id: Transaction ID from log_trade_request
            operation: Operation type
            account_number: MT5 account number
            response_data: Trade response data
            success: Whether the trade was successful
            user_id: User ID (default "system" for MVP)
        """
        status = "success" if success else "failed"

        log_entry = {
            "transaction_id": transaction_id,
            "timestamp": datetime.now().isoformat(),
            "operation": operation,
            "account_number": account_number,
            "user_id": user_id,
            "status": status,
            "request": None,
            "response": response_data
        }

        self._write_log(log_entry)
        logger.info(f"Trade response logged: {transaction_id} - {status}")

    def log_trade_error(
        self,
        transaction_id: str,
        operation: str,
        account_number: int,
        error_message: str,
        user_id: str = "system"
    ) -> None:
        """
        Log trade error

        Args:
            transaction_id: Transaction ID from log_trade_request
            operation: Operation type
            account_number: MT5 account number
            error_message: Error message
            user_id: User ID (default "system" for MVP)
        """
        log_entry = {
            "transaction_id": transaction_id,
            "timestamp": datetime.now().isoformat(),
            "operation": operation,
            "account_number": account_number,
            "user_id": user_id,
            "status": "error",
            "request": None,
            "response": {"error": error_message}
        }

        self._write_log(log_entry)
        logger.error(f"Trade error logged: {transaction_id} - {error_message}")


# Global trade logger instance
trade_logger = TradeLogger()
