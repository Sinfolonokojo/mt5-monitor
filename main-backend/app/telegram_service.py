"""
Telegram Notification Service for Versus Trading operations.

Sends notifications to Telegram when congelar/transferir execute (success or failure).
Uses the shared HTTP client for connection pooling.
"""

import logging
from .config import settings
from .http_client import get_http_client

logger = logging.getLogger(__name__)

TELEGRAM_API_URL = "https://api.telegram.org/bot{token}/sendMessage"


class TelegramService:
    """Sends trade notifications to Telegram."""

    def __init__(self):
        self._token = None
        self._chat_id = None

    @property
    def enabled(self) -> bool:
        return bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID)

    async def send_message(self, text: str, parse_mode: str = "HTML"):
        """Send a message to the configured Telegram chat. Silently skips if not configured."""
        if not self.enabled:
            logger.debug("Telegram not configured, skipping notification")
            return

        try:
            url = TELEGRAM_API_URL.format(token=settings.TELEGRAM_BOT_TOKEN)
            payload = {
                "chat_id": settings.TELEGRAM_CHAT_ID,
                "text": text,
                "parse_mode": parse_mode,
            }
            client = await get_http_client()
            response = await client.post(url, json=payload, timeout=10.0)

            if response.status_code != 200:
                logger.warning(f"Telegram API returned {response.status_code}: {response.text}")
        except Exception as e:
            logger.warning(f"Failed to send Telegram notification: {e}")

    # -- Congelar notifications --

    async def notify_congelar_success(
        self, versus_id: str, label_a: str, label_b: str,
        symbol: str, lots: float, tp_usd: float, sl_usd: float
    ):
        text = (
            f"<b>CONGELAR OK</b>\n"
            f"Versus: <code>{versus_id}</code>\n"
            f"A: <code>{label_a}</code>\n"
            f"B: <code>{label_b}</code>\n"
            f"Symbol: {symbol} | Lots: {lots}\n"
            f"TP: ${tp_usd} | SL: ${sl_usd}"
        )
        await self.send_message(text)

    async def notify_congelar_failed(
        self, versus_id: str, label_a: str, label_b: str, error: str
    ):
        text = (
            f"<b>CONGELAR FAILED</b>\n"
            f"Versus: <code>{versus_id}</code>\n"
            f"A: <code>{label_a}</code>\n"
            f"B: <code>{label_b}</code>\n"
            f"Error: {error}"
        )
        await self.send_message(text)

    # -- Transferir notifications --

    async def notify_transferir_success(
        self, versus_id: str, label_a: str, label_b: str,
        symbol: str, side: str, lots: float,
        tp_usd_a: float = 0, sl_usd_a: float = 0,
        tp_usd_b: float = 0, sl_usd_b: float = 0
    ):
        text = (
            f"<b>TRANSFERIR OK</b>\n"
            f"Versus: <code>{versus_id}</code>\n"
            f"A: <code>{label_a}</code> {side}\n"
            f"B: <code>{label_b}</code>\n"
            f"Symbol: {symbol} | Lots: {lots}\n"
            f"TP/SL A: ${tp_usd_a} / ${sl_usd_a}\n"
            f"TP/SL B: ${tp_usd_b} / ${sl_usd_b}"
        )
        await self.send_message(text)

    async def notify_transferir_failed(
        self, versus_id: str, label_a: str, label_b: str, error: str
    ):
        text = (
            f"<b>TRANSFERIR FAILED</b>\n"
            f"Versus: <code>{versus_id}</code>\n"
            f"A: <code>{label_a}</code>\n"
            f"B: <code>{label_b}</code>\n"
            f"Error: {error}"
        )
        await self.send_message(text)


telegram_service = TelegramService()
