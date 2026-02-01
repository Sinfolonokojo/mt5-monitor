# Phase 1 & 2 Implementation Plan

## Overview

This document provides step-by-step implementation for:
- **Phase 1**: HTTP Connection Pooling (removes 150-300ms overhead per request)
- **Phase 2**: Smart Cache with Selective Invalidation (95%+ cache hit rate)

**Total Time**: ~12-16 hours
**Cost**: $0 (code changes only)
**Risk**: Low (can be rolled back easily)

---

## Current State Analysis

### HTTP Client Usage (10 locations)

| File | Line | Timeout | Purpose |
|------|------|---------|---------|
| `aggregator.py` | 28 | 30s | trigger_agent_refresh |
| `aggregator.py` | 43 | AGENT_TIMEOUT | fetch_agent_data |
| `aggregator.py` | 186 | AGENT_TIMEOUT | fetch_trade_history |
| `main.py` | 468 | AGENT_TIMEOUT | get_single_account |
| `main.py` | 588 | 30s | open_position |
| `main.py` | 680 | 30s | close_position |
| `main.py` | 772 | 30s | modify_position |
| `main.py` | 857 | 30s | get_open_positions |
| `main.py` | 1020 | 30s | execute_congelar_internal |
| `main.py` | 1200 | 30s | execute_transferir_internal |

### Cache Invalidation (clears ALL accounts)

| File | Line | Trigger |
|------|------|---------|
| `main.py` | 215 | update_phase |
| `main.py` | 239 | update_vs |
| `main.py` | 315 | force_refresh endpoint |
| `main.py` | 430 | invalidate_account_cache (after trades) |
| `main.py` | 612, 704, 796 | After open/close/modify trades |
| `main.py` | 1104, 1361-1362 | After versus operations |

---

# PHASE 1: HTTP Connection Pooling

## Step 1.1: Create HTTP Client Manager

Create new file `main-backend/app/http_client.py`:

```python
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
```

---

## Step 1.2: Update App Lifespan

Modify `main-backend/app/main.py` to close the HTTP client on shutdown.

### Add import at top:
```python
from .http_client import close_http_client
```

### Update lifespan function:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduled_congelar_task

    # Startup
    logger.info("Starting Main Backend")

    # Start background task for scheduled congelar
    if settings.VERSUS_ENABLED:
        scheduled_congelar_task = asyncio.create_task(check_scheduled_congelar())
        logger.info("Scheduled congelar checker started")

    yield

    # Shutdown
    logger.info("Shutting down Main Backend")
    shutdown_event.set()

    if scheduled_congelar_task:
        try:
            await asyncio.wait_for(scheduled_congelar_task, timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning("Scheduled congelar task did not finish in time")

    # NEW: Close HTTP client pool
    await close_http_client()
    logger.info("HTTP client closed")
```

---

## Step 1.3: Update Aggregator

Modify `main-backend/app/aggregator.py`:

### Add import:
```python
from .http_client import get_http_client
```

### Replace `trigger_agent_refresh` method:
```python
async def trigger_agent_refresh(self, agent: Dict) -> bool:
    """Trigger /refresh endpoint on an agent to force MT5 reconnection"""
    agent_name = agent["name"]
    agent_url = agent["url"]

    try:
        logger.info(f"🔄 Triggering refresh for {agent_name} at {agent_url}/refresh")
        client = await get_http_client()
        response = await client.post(f"{agent_url}/refresh", timeout=30.0)
        response.raise_for_status()
        logger.info(f"✅ Successfully triggered refresh for {agent_name}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to trigger refresh for {agent_name}: {str(e)}")
        return False
```

### Replace `fetch_agent_data` method:
```python
async def fetch_agent_data(self, agent: Dict) -> Tuple[str, List[Dict], str]:
    """Fetch data from a single VPS agent with auto-recovery"""
    agent_name = agent["name"]
    agent_url = agent["url"]

    try:
        client = await get_http_client()
        logger.info(f"Fetching from {agent_name} at {agent_url}")
        response = await client.get(f"{agent_url}/accounts", timeout=settings.AGENT_TIMEOUT)
        response.raise_for_status()
        account_data = response.json()

        # In multi-terminal architecture, each agent returns a single account object
        accounts = [account_data] if isinstance(account_data, dict) else account_data

        # Check if account is disconnected
        if accounts and accounts[0].get("status") == "disconnected":
            logger.warning(f"⚠️ {agent_name} returned disconnected status")
            self.agent_failure_counts[agent_name] = self.agent_failure_counts.get(agent_name, 0) + 1

            if self.agent_failure_counts[agent_name] >= self.max_failures_before_recovery:
                logger.warning(f"🔧 Auto-recovery triggered for {agent_name}")
                recovery_success = await self.trigger_agent_refresh(agent)

                if recovery_success:
                    self.agent_failure_counts[agent_name] = 0
                    await asyncio.sleep(2)
                    retry_response = await client.get(f"{agent_url}/accounts", timeout=settings.AGENT_TIMEOUT)
                    retry_response.raise_for_status()
                    retry_data = retry_response.json()
                    accounts = [retry_data] if isinstance(retry_data, dict) else retry_data
                    logger.info(f"✅ Retry successful for {agent_name}")

            return agent_name, accounts, "online"
        else:
            self.agent_failure_counts[agent_name] = 0
            logger.info(f"Successfully fetched {len(accounts)} account(s) from {agent_name}")
            return agent_name, accounts, "online"

    except httpx.TimeoutException:
        logger.error(f"Timeout connecting to {agent_name} at {agent_url}")
        self.agent_failure_counts[agent_name] = self.agent_failure_counts.get(agent_name, 0) + 1
        return agent_name, [], "timeout"
    except httpx.ConnectError:
        logger.error(f"Connection error to {agent_name} at {agent_url}")
        self.agent_failure_counts[agent_name] = self.agent_failure_counts.get(agent_name, 0) + 1

        if self.agent_failure_counts[agent_name] >= self.max_failures_before_recovery:
            logger.warning(f"🔧 Auto-recovery triggered for offline {agent_name}")
            await self.trigger_agent_refresh(agent)
            self.agent_failure_counts[agent_name] = 0

        return agent_name, [], "offline"
    except Exception as e:
        logger.error(f"Error fetching from {agent_name}: {str(e)}")
        self.agent_failure_counts[agent_name] = self.agent_failure_counts.get(agent_name, 0) + 1
        return agent_name, [], "error"
```

### Replace `fetch_trade_history` method (inside try block):
```python
async def fetch_trade_history(self, account_number: int, from_date: str = None, days: int = None) -> Dict:
    # ... (keep existing code until the try block) ...

    try:
        client = await get_http_client()
        logger.info(f"Fetching trade history from {target_agent} at {agent_config['url']}")
        response = await client.get(
            f"{agent_config['url']}/trade-history",
            params=params,
            timeout=settings.AGENT_TIMEOUT
        )
        response.raise_for_status()
        trade_history = response.json()
        logger.info(f"Successfully fetched {trade_history.get('total_trades', 0)} trades")
        return {**trade_history, "success": True}

    except httpx.TimeoutException:
        logger.error(f"Timeout fetching trade history from {target_agent}")
        return {"error": "Request timeout", "success": False}
    except httpx.ConnectError:
        logger.error(f"Connection error to {target_agent}")
        return {"error": "Agent offline", "success": False}
    except Exception as e:
        logger.error(f"Error fetching trade history from {target_agent}: {str(e)}")
        return {"error": str(e), "success": False}
```

---

## Step 1.4: Update Main.py HTTP Calls

Add import at top of `main.py`:
```python
from .http_client import get_http_client, close_http_client
```

### Replace pattern throughout main.py:

**BEFORE:**
```python
async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.post(url, json=data)
```

**AFTER:**
```python
client = await get_http_client()
response = await client.post(url, json=data, timeout=30.0)
```

### Locations to update in main.py:

1. **Line ~468** (get_single_account):
```python
client = await get_http_client()
response = await client.get(f"{agent_config['url']}/accounts", timeout=settings.AGENT_TIMEOUT)
```

2. **Line ~588** (open_position):
```python
client = await get_http_client()
response = await client.post(f"{vps_url}/positions/open", json=request, timeout=30.0)
```

3. **Line ~680** (close_position):
```python
client = await get_http_client()
response = await client.post(f"{vps_url}/positions/close", json=request, timeout=30.0)
```

4. **Line ~772** (modify_position):
```python
client = await get_http_client()
response = await client.put(f"{vps_url}/positions/modify", json=request, timeout=30.0)
```

5. **Line ~857** (get_open_positions):
```python
client = await get_http_client()
response = await client.get(f"{vps_url}/positions", timeout=30.0)
```

6. **Line ~1020** (execute_congelar_internal):
```python
client = await get_http_client()
response_a = await client.post(f"{vps_url_a}/positions/open", json=request_a, timeout=30.0)
response_b = await client.post(f"{vps_url_b}/positions/open", json=request_b, timeout=30.0)
```

7. **Line ~1200** (execute_transferir_internal):
```python
client = await get_http_client()
response = await client.post(f"{vps_url}/positions/close", json=request, timeout=30.0)
```

---

## Step 1.5: Testing Phase 1

```bash
# Run the backend
cd main-backend
python -m uvicorn app.main:app --reload --port 8080

# Test endpoints
curl http://localhost:8080/api/accounts
curl http://localhost:8080/api/accounts/12345

# Check logs for "HTTP client created" - should only appear once
# Subsequent requests should reuse the connection
```

---

# PHASE 2: Smart Cache with Selective Invalidation

## Step 2.1: Create Smart Cache

Replace `main-backend/app/cache.py` with:

```python
"""
Smart Cache - Per-account caching with selective invalidation.

Key improvements over SimpleCache:
- Per-account storage (Dict instead of Tuple)
- Selective invalidation (only affected account, not all)
- Field-level updates (update phase without full refresh)
- Thread-safe async operations
- Cache statistics for monitoring
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Any, Tuple
from .models import AccountData, VPSAgentStatus
from .config import settings
import logging

logger = logging.getLogger(__name__)


class SmartCache:
    """
    Per-account cache with selective invalidation and field-level updates.

    Architecture:
        accounts: {account_number: (AccountData, cached_at)}
        agent_statuses: {agent_name: (VPSAgentStatus, cached_at)}

    Key Methods:
        - get_account(num) -> Get single account
        - get_all_accounts() -> Get all cached accounts
        - set_accounts(list) -> Bulk cache update
        - invalidate_account(num) -> Remove ONE account from cache
        - update_account_field(num, field, value) -> Update without invalidation
    """

    def __init__(self, ttl_seconds: int = None):
        self.ttl_seconds = ttl_seconds or settings.CACHE_TTL

        # Per-account cache: {account_number: (AccountData, cached_at)}
        self._accounts: Dict[int, Tuple[AccountData, datetime]] = {}

        # Agent status cache: {agent_name: (VPSAgentStatus, cached_at)}
        self._agent_statuses: Dict[str, Tuple[VPSAgentStatus, datetime]] = {}

        # Timestamp of last full refresh
        self._last_full_refresh: Optional[datetime] = None

        # Async lock for thread-safe operations
        self._lock = asyncio.Lock()

        logger.info(f"SmartCache initialized with TTL={self.ttl_seconds}s")

    def _is_expired(self, cached_at: datetime) -> bool:
        """Check if a cache entry is expired."""
        return datetime.now() - cached_at > timedelta(seconds=self.ttl_seconds)

    # ========== ACCOUNT OPERATIONS ==========

    async def get_account(self, account_number: int) -> Optional[AccountData]:
        """
        Get a single account from cache if valid.

        Returns None if:
            - Account not in cache
            - Account entry expired
        """
        async with self._lock:
            if account_number not in self._accounts:
                logger.debug(f"Cache miss: account {account_number} not found")
                return None

            account, cached_at = self._accounts[account_number]

            if self._is_expired(cached_at):
                del self._accounts[account_number]
                logger.debug(f"Cache miss: account {account_number} expired")
                return None

            logger.debug(f"Cache hit: account {account_number}")
            return account

    async def get_all_accounts(self) -> Optional[List[AccountData]]:
        """
        Get all cached accounts if cache is fresh.

        Returns None if:
            - No accounts cached
            - Full refresh is stale (older than TTL)
        """
        async with self._lock:
            # Check if we have a recent full refresh
            if not self._last_full_refresh:
                logger.info("Cache miss: no full refresh yet")
                return None

            if self._is_expired(self._last_full_refresh):
                logger.info(f"Cache expired (full refresh age: {datetime.now() - self._last_full_refresh})")
                return None

            # Collect valid accounts
            valid_accounts = []
            expired_keys = []

            for acc_num, (account, cached_at) in self._accounts.items():
                if not self._is_expired(cached_at):
                    valid_accounts.append(account)
                else:
                    expired_keys.append(acc_num)

            # Clean up expired entries
            for key in expired_keys:
                del self._accounts[key]

            if not valid_accounts:
                logger.info("Cache miss: all accounts expired")
                return None

            logger.info(f"Cache hit: returning {len(valid_accounts)} accounts")
            return valid_accounts

    async def set_account(self, account: AccountData):
        """Cache a single account."""
        async with self._lock:
            self._accounts[account.account_number] = (account, datetime.now())
            logger.debug(f"Cached account {account.account_number}")

    async def set_accounts(self, accounts: List[AccountData]):
        """
        Bulk cache update for multiple accounts.
        Called after fetch_all_agents().
        """
        async with self._lock:
            now = datetime.now()
            for account in accounts:
                self._accounts[account.account_number] = (account, now)
            self._last_full_refresh = now
            logger.info(f"Bulk cached {len(accounts)} accounts")

    async def invalidate_account(self, account_number: int):
        """
        Invalidate only ONE account from cache.

        This is the key improvement - after a trade, only the
        affected account is removed, not all 69 accounts.
        """
        async with self._lock:
            if account_number in self._accounts:
                del self._accounts[account_number]
                logger.info(f"Invalidated cache for account {account_number}")
            else:
                logger.debug(f"Account {account_number} not in cache (no-op)")

    async def update_account_field(self, account_number: int, field: str, value: Any) -> bool:
        """
        Update a single field on a cached account WITHOUT invalidation.

        Use cases:
            - Phase update: update_account_field(123, "phase", "F2")
            - VS update: update_account_field(123, "vs_group", "VS-1")

        Returns True if update succeeded, False if account not in cache.
        """
        async with self._lock:
            if account_number not in self._accounts:
                logger.debug(f"Cannot update field: account {account_number} not in cache")
                return False

            account, cached_at = self._accounts[account_number]

            # Check if expired
            if self._is_expired(cached_at):
                del self._accounts[account_number]
                logger.debug(f"Cannot update field: account {account_number} expired")
                return False

            # Create updated account with new field value
            account_dict = account.model_dump()
            account_dict[field] = value
            updated_account = AccountData(**account_dict)

            # Store with current timestamp (refresh TTL)
            self._accounts[account_number] = (updated_account, datetime.now())
            logger.info(f"Updated {field}={value} for account {account_number} in cache")
            return True

    # ========== AGENT STATUS OPERATIONS ==========

    async def set_agent_statuses(self, statuses: List[VPSAgentStatus]):
        """Cache agent statuses after fetch."""
        async with self._lock:
            now = datetime.now()
            for status in statuses:
                self._agent_statuses[status.agent_name] = (status, now)
            logger.debug(f"Cached {len(statuses)} agent statuses")

    async def get_agent_statuses(self) -> Optional[List[VPSAgentStatus]]:
        """Get all cached agent statuses."""
        async with self._lock:
            if not self._agent_statuses:
                return None

            valid_statuses = []
            for name, (status, cached_at) in self._agent_statuses.items():
                if not self._is_expired(cached_at):
                    valid_statuses.append(status)

            return valid_statuses if valid_statuses else None

    # ========== CACHE MANAGEMENT ==========

    async def clear(self):
        """Clear all cache (use sparingly - prefer invalidate_account)."""
        async with self._lock:
            count = len(self._accounts)
            self._accounts.clear()
            self._agent_statuses.clear()
            self._last_full_refresh = None
            logger.info(f"Cache cleared ({count} accounts removed)")

    def stats(self) -> Dict:
        """Get cache statistics for monitoring."""
        return {
            "accounts_cached": len(self._accounts),
            "agents_cached": len(self._agent_statuses),
            "last_full_refresh": self._last_full_refresh.isoformat() if self._last_full_refresh else None,
            "ttl_seconds": self.ttl_seconds
        }

    # ========== BACKWARD COMPATIBILITY ==========
    # These methods maintain compatibility with existing code during migration

    def get(self) -> Optional[Tuple[List[AccountData], List[VPSAgentStatus]]]:
        """
        DEPRECATED: Synchronous get for backward compatibility.
        Use get_all_accounts() instead.
        """
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Can't run async in sync context when loop is running
                # Return None to force refresh
                return None
            accounts = loop.run_until_complete(self.get_all_accounts())
            statuses = loop.run_until_complete(self.get_agent_statuses())
            if accounts:
                return (accounts, statuses or [])
            return None
        except:
            return None

    def set(self, data: Tuple[List[AccountData], List[VPSAgentStatus]]):
        """
        DEPRECATED: Synchronous set for backward compatibility.
        Use set_accounts() instead.
        """
        accounts, statuses = data
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Schedule for later
                asyncio.create_task(self._async_set(accounts, statuses))
            else:
                loop.run_until_complete(self._async_set(accounts, statuses))
        except:
            pass

    async def _async_set(self, accounts: List[AccountData], statuses: List[VPSAgentStatus]):
        await self.set_accounts(accounts)
        await self.set_agent_statuses(statuses)


# ========== SINGLETON INSTANCES ==========

# New smart cache (use this going forward)
smart_cache = SmartCache()

# Backward compatible alias (for gradual migration)
cache = smart_cache
```

---

## Step 2.2: Update Main.py Cache Usage

### Update imports:
```python
from .cache import smart_cache  # Add this
# Keep: from .cache import cache  (for backward compat during migration)
```

### Replace `invalidate_account_cache` function:
```python
async def invalidate_account_cache(account_number: int):
    """
    Invalidate cache for a specific account only.

    This now actually does selective invalidation instead of clearing all!
    """
    await smart_cache.invalidate_account(account_number)
```

**Note:** This function is now async, so all calls need `await`.

### Update phase update endpoint (~line 200-220):
```python
@app.put("/api/accounts/{account_number}/phase")
async def update_phase(account_number: int, request: PhaseUpdateRequest):
    """Update the phase for an account"""
    try:
        phase_manager.update_phase(account_number, request.phase)

        # Update cache in-place instead of clearing all
        updated = await smart_cache.update_account_field(
            account_number, "phase", request.phase
        )

        if not updated:
            # Account not in cache, that's okay - will be fetched on next request
            logger.debug(f"Account {account_number} not in cache for phase update")

        return {
            "account_number": account_number,
            "phase": request.phase,
            "message": "Phase updated successfully"
        }
    except Exception as e:
        logger.error(f"Error updating phase: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Update VS update endpoint (~line 225-245):
```python
@app.put("/api/accounts/{account_number}/vs")
async def update_vs(account_number: int, request: VSUpdateRequest):
    """Update the VS group for an account"""
    try:
        vs_manager.update_vs(account_number, request.vs_group)

        # Update cache in-place instead of clearing all
        updated = await smart_cache.update_account_field(
            account_number, "vs_group", request.vs_group
        )

        if not updated:
            logger.debug(f"Account {account_number} not in cache for VS update")

        return {
            "account_number": account_number,
            "vs_group": request.vs_group,
            "message": "VS updated successfully"
        }
    except Exception as e:
        logger.error(f"Error updating VS: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Update trade endpoints (open/close/modify):

Change all occurrences of:
```python
invalidate_account_cache(account_number)
```

To:
```python
await invalidate_account_cache(account_number)
```

### Update get_all_accounts endpoint to use smart_cache:
```python
@app.get("/api/accounts")
async def get_all_accounts(force_refresh: bool = False):
    """Get aggregated data from all VPS agents"""
    try:
        # Check cache first (unless force refresh)
        if not force_refresh:
            cached_accounts = await smart_cache.get_all_accounts()
            cached_statuses = await smart_cache.get_agent_statuses()

            if cached_accounts:
                # Build response from cache
                # ... existing response building logic ...
                pass

        # Cache miss or force refresh - fetch from agents
        raw_accounts, agent_statuses = await data_aggregator.fetch_all_agents()

        # Process accounts and add phase/vs data
        # ... existing processing logic ...

        # Cache the results
        await smart_cache.set_accounts(accounts)
        await smart_cache.set_agent_statuses(agent_statuses)

        # Build and return response
        # ... existing response logic ...
```

---

## Step 2.3: Add Cache Stats Endpoint (Optional but Recommended)

Add to `main.py`:
```python
@app.get("/api/cache/stats")
async def get_cache_stats():
    """Get cache statistics for monitoring"""
    return smart_cache.stats()
```

---

## Step 2.4: Testing Phase 2

```bash
# Test cache behavior
curl http://localhost:8080/api/accounts  # First call - cache miss
curl http://localhost:8080/api/accounts  # Second call - cache hit

# Test selective invalidation
curl -X PUT http://localhost:8080/api/accounts/12345/phase \
  -H "Content-Type: application/json" \
  -d '{"phase": "F2"}'

# Check that other accounts are still cached
curl http://localhost:8080/api/cache/stats
# Should show accounts_cached > 0

# Test that only one account was invalidated
curl http://localhost:8080/api/accounts  # Should be fast (cache hit for most)
```

---

# Implementation Checklist

## Phase 1: HTTP Connection Pooling

- [ ] Create `app/http_client.py`
- [ ] Add import to `app/main.py`
- [ ] Update `lifespan()` to close client on shutdown
- [ ] Add import to `app/aggregator.py`
- [ ] Update `trigger_agent_refresh()` in aggregator
- [ ] Update `fetch_agent_data()` in aggregator
- [ ] Update `fetch_trade_history()` in aggregator
- [ ] Update `get_single_account()` in main.py
- [ ] Update `open_position()` in main.py
- [ ] Update `close_position()` in main.py
- [ ] Update `modify_position()` in main.py
- [ ] Update `get_open_positions()` in main.py
- [ ] Update `execute_congelar_internal()` in main.py
- [ ] Update `execute_transferir_internal()` in main.py
- [ ] Test: Verify "HTTP client created" appears only once in logs

## Phase 2: Smart Cache

- [ ] Replace `app/cache.py` with SmartCache
- [ ] Update imports in `app/main.py`
- [ ] Make `invalidate_account_cache()` async
- [ ] Update all `invalidate_account_cache()` calls to use `await`
- [ ] Update `update_phase()` endpoint
- [ ] Update `update_vs()` endpoint
- [ ] Update `get_all_accounts()` endpoint
- [ ] Add `/api/cache/stats` endpoint
- [ ] Test: Verify selective invalidation works
- [ ] Test: Verify phase/VS updates don't clear all cache

---

# Expected Performance Improvements

| Operation | Before | After Phase 1 | After Phase 2 |
|-----------|--------|---------------|---------------|
| Single request overhead | +150-300ms | **0ms** | 0ms |
| Trade + refresh | 3-5s | 2.5-4s | **0.5-1s** |
| Phase update | 5-20s (refetch all) | 5-20s | **<200ms** |
| Cache hit after trade | 0% | 0% | **95%+** |
| 69 accounts after 1 trade | All refetched | All refetched | **68 still cached** |

---

# Rollback Plan

## Phase 1 Rollback:
```python
# Revert http_client.py usage back to:
async with httpx.AsyncClient(timeout=X) as client:
    response = await client.get(url)
```

## Phase 2 Rollback:
```python
# Restore original SimpleCache class
# Change async invalidate_account_cache back to sync
```

Both phases can be rolled back independently.

---

*Document created: 2026-02-01*
*Estimated time: 12-16 hours total*
