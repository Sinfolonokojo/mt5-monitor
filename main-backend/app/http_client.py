"""
HTTP Client Manager - Provides persistent connection pooling for all HTTP requests.

Benefits:
- Reuses TCP connections (eliminates 150-300ms handshake per request)
- HTTP/2 multiplexing (multiple requests over single connection)
- Configurable connection limits and timeouts
- Graceful shutdown handling
"""

import httpx
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class HTTPClientManager:
    """
    Singleton manager for a shared httpx.AsyncClient with connection pooling.

    Usage:
        client = await get_http_client()
        response = await client.get(url, timeout=10)
    """

    _instance: Optional["HTTPClientManager"] = None
    _client: Optional[httpx.AsyncClient] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def get_client(self) -> httpx.AsyncClient:
        """Get or create the shared HTTP client with connection pooling."""
        if self._client is None or self._client.is_closed:
            logger.info("Creating new HTTP client with connection pooling")
            self._client = httpx.AsyncClient(
                # Timeout configuration
                timeout=httpx.Timeout(
                    connect=5.0,      # Time to establish connection
                    read=30.0,        # Time to receive response
                    write=10.0,       # Time to send request
                    pool=5.0          # Time to acquire connection from pool
                ),
                # Connection pool limits
                limits=httpx.Limits(
                    max_connections=100,           # Max total connections
                    max_keepalive_connections=50,  # Max idle connections to keep
                    keepalive_expiry=30.0          # Seconds to keep idle connections
                ),
                # Enable HTTP/2 for multiplexing (multiple requests per connection)
                http2=True,
                # Follow redirects automatically
                follow_redirects=True
            )
            logger.info("HTTP client created with pool: max=100, keepalive=50")
        return self._client

    async def close(self):
        """Close the HTTP client gracefully."""
        if self._client is not None and not self._client.is_closed:
            logger.info("Closing HTTP client")
            await self._client.aclose()
            self._client = None
            logger.info("HTTP client closed")


# Global singleton instance
_manager = HTTPClientManager()


async def get_http_client() -> httpx.AsyncClient:
    """
    Get the shared HTTP client with connection pooling.

    Example:
        client = await get_http_client()
        response = await client.get("http://vps1:8000/accounts", timeout=10)
    """
    return await _manager.get_client()


async def close_http_client():
    """Close the shared HTTP client (call on app shutdown)."""
    await _manager.close()
