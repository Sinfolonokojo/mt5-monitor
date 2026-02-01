# MT5 Monitor - Performance Improvement Plan

## Executive Summary

This plan addresses critical performance bottlenecks identified in the MT5 Monitor system.

### Current Performance

| Operation | Current | Target | Improvement |
|-----------|---------|--------|-------------|
| Trade execution | 1-3s | 300-800ms | **3-4x faster** |
| Account refresh | 5-20s | 100-500ms | **10-40x faster** |
| Frontend updates | 10 min polling | Real-time (50ms) | **Instant** |
| Phase/VS update | 5-20s | 200ms | **25-100x faster** |

### Implementation Cost

| Resource | Cost |
|----------|------|
| Development time | ~40-50 hours |
| Additional infrastructure | $0 (code changes only) |
| Optional Redis VPS | $5/month |

---

## Phase 1: HTTP Connection Pooling (Week 1)

### Problem
Every request creates a new HTTP client, adding 150-300ms overhead.

**Current code** (`main-backend/app/main.py`):
```python
# Line 509 - Creates new client EVERY request
async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.post(f"{vps_url}/positions/open", json=request)
```

### Solution
Create a persistent HTTP client with connection pooling.

**Files to modify:**
- `main-backend/app/http_client.py` (NEW)
- `main-backend/app/main.py`
- `main-backend/app/aggregator.py`

### Implementation

#### Step 1.1: Create HTTP Client Manager

```python
# main-backend/app/http_client.py
import httpx
from contextlib import asynccontextmanager
from app.config import settings

class HTTPClientManager:
    """Manages a persistent HTTP client with connection pooling"""

    _client: httpx.AsyncClient = None

    @classmethod
    async def get_client(cls) -> httpx.AsyncClient:
        """Get or create the shared HTTP client"""
        if cls._client is None or cls._client.is_closed:
            cls._client = httpx.AsyncClient(
                timeout=httpx.Timeout(
                    connect=5.0,
                    read=30.0,
                    write=10.0,
                    pool=5.0
                ),
                limits=httpx.Limits(
                    max_connections=100,
                    max_keepalive_connections=50,
                    keepalive_expiry=30.0
                ),
                http2=True  # Enable HTTP/2 for multiplexing
            )
        return cls._client

    @classmethod
    async def close(cls):
        """Close the HTTP client gracefully"""
        if cls._client is not None:
            await cls._client.aclose()
            cls._client = None

# Convenience function
async def get_http_client() -> httpx.AsyncClient:
    return await HTTPClientManager.get_client()
```

#### Step 1.2: Update Main App Lifecycle

```python
# main-backend/app/main.py - Add to lifespan
from app.http_client import HTTPClientManager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    yield
    # Shutdown
    logger.info("Shutting down...")
    await HTTPClientManager.close()

app = FastAPI(lifespan=lifespan)
```

#### Step 1.3: Update Trade Operations

```python
# main-backend/app/main.py - Replace all httpx.AsyncClient() calls

# Before (Line 509):
async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.post(...)

# After:
from app.http_client import get_http_client

client = await get_http_client()
response = await client.post(
    f"{vps_url}/positions/open",
    json=request,
    timeout=30.0  # Override timeout per-request if needed
)
```

#### Step 1.4: Update Aggregator

```python
# main-backend/app/aggregator.py

from app.http_client import get_http_client

class DataAggregator:
    async def fetch_agent_data(self, agent: Dict) -> Tuple[str, List[AccountData], str]:
        client = await get_http_client()

        try:
            response = await client.get(
                f"{agent_url}/accounts",
                timeout=settings.AGENT_TIMEOUT
            )
            # ... rest of logic
```

### Expected Improvement

| Metric | Before | After |
|--------|--------|-------|
| Connection overhead | 150-300ms/request | 0ms (reused) |
| Memory usage | New client each time | Single shared client |
| Trade execution | 1-3s | 0.8-2.5s |

---

## Phase 2: Smart Cache with Selective Invalidation (Week 1-2)

### Problem
Current cache stores ALL accounts as single tuple. Any update clears EVERYTHING.

**Current code** (`main-backend/app/cache.py`):
```python
# Stores everything together - can't update one account
self.cached_data: Optional[Tuple[List[AccountData], List[VPSAgentStatus]]] = None

# Clears EVERYTHING on any trade
cache.clear()
```

### Solution
Per-account caching with selective invalidation.

**Files to modify:**
- `main-backend/app/cache.py`
- `main-backend/app/main.py`

### Implementation

#### Step 2.1: Create Smart Cache

```python
# main-backend/app/cache.py
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Any
from app.models import AccountData, VPSAgentStatus
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class SmartCache:
    """Per-account cache with selective invalidation and background refresh"""

    def __init__(self, ttl_seconds: int = None):
        self.ttl_seconds = ttl_seconds or settings.CACHE_TTL

        # Per-account cache: {account_number: (AccountData, cached_at)}
        self.accounts: Dict[int, tuple[AccountData, datetime]] = {}

        # Agent status cache
        self.agent_statuses: Dict[str, tuple[VPSAgentStatus, datetime]] = {}

        # Full refresh timestamp
        self.last_full_refresh: Optional[datetime] = None

        # Lock for thread-safe operations
        self._lock = asyncio.Lock()

    async def get_account(self, account_number: int) -> Optional[AccountData]:
        """Get single account from cache if valid"""
        async with self._lock:
            if account_number not in self.accounts:
                return None

            account, cached_at = self.accounts[account_number]
            age = datetime.now() - cached_at

            if age > timedelta(seconds=self.ttl_seconds):
                del self.accounts[account_number]
                return None

            return account

    async def get_all_accounts(self) -> Optional[List[AccountData]]:
        """Get all cached accounts if cache is fresh"""
        async with self._lock:
            if not self.last_full_refresh:
                return None

            age = datetime.now() - self.last_full_refresh
            if age > timedelta(seconds=self.ttl_seconds):
                return None

            # Return all non-expired accounts
            valid_accounts = []
            now = datetime.now()
            expired = []

            for acc_num, (account, cached_at) in self.accounts.items():
                if now - cached_at <= timedelta(seconds=self.ttl_seconds):
                    valid_accounts.append(account)
                else:
                    expired.append(acc_num)

            # Clean up expired
            for acc_num in expired:
                del self.accounts[acc_num]

            return valid_accounts if valid_accounts else None

    async def set_account(self, account: AccountData):
        """Cache a single account"""
        async with self._lock:
            self.accounts[account.account_number] = (account, datetime.now())

    async def set_accounts(self, accounts: List[AccountData]):
        """Cache multiple accounts (bulk update)"""
        async with self._lock:
            now = datetime.now()
            for account in accounts:
                self.accounts[account.account_number] = (account, now)
            self.last_full_refresh = now
            logger.info(f"Cached {len(accounts)} accounts")

    async def invalidate_account(self, account_number: int):
        """Invalidate only ONE account"""
        async with self._lock:
            if account_number in self.accounts:
                del self.accounts[account_number]
                logger.info(f"Invalidated cache for account {account_number}")

    async def update_account_field(self, account_number: int, field: str, value: Any):
        """Update a single field without full invalidation"""
        async with self._lock:
            if account_number in self.accounts:
                account, cached_at = self.accounts[account_number]
                # Create updated account
                account_dict = account.model_dump()
                account_dict[field] = value
                updated_account = AccountData(**account_dict)
                self.accounts[account_number] = (updated_account, datetime.now())
                logger.info(f"Updated {field} for account {account_number} in cache")

    async def set_agent_statuses(self, statuses: List[VPSAgentStatus]):
        """Cache agent statuses"""
        async with self._lock:
            now = datetime.now()
            for status in statuses:
                self.agent_statuses[status.agent_name] = (status, now)

    async def get_agent_statuses(self) -> Optional[List[VPSAgentStatus]]:
        """Get all agent statuses"""
        async with self._lock:
            if not self.agent_statuses:
                return None

            now = datetime.now()
            valid = []
            for name, (status, cached_at) in self.agent_statuses.items():
                if now - cached_at <= timedelta(seconds=self.ttl_seconds):
                    valid.append(status)

            return valid if valid else None

    async def clear(self):
        """Clear all cache (use sparingly)"""
        async with self._lock:
            self.accounts.clear()
            self.agent_statuses.clear()
            self.last_full_refresh = None
            logger.info("Cache cleared completely")

    def stats(self) -> Dict:
        """Get cache statistics"""
        return {
            "accounts_cached": len(self.accounts),
            "agents_cached": len(self.agent_statuses),
            "last_full_refresh": self.last_full_refresh.isoformat() if self.last_full_refresh else None,
            "ttl_seconds": self.ttl_seconds
        }


# Global instance
smart_cache = SmartCache()
```

#### Step 2.2: Update Cache Usage in Main

```python
# main-backend/app/main.py

from app.cache import smart_cache

# Replace cache invalidation after trades:

# Before (Line 531-534):
if result.get("success"):
    invalidate_account_cache(account_number)  # Clears ALL

# After:
if result.get("success"):
    await smart_cache.invalidate_account(account_number)  # Only ONE account

# For phase updates - don't invalidate, just update:
# Before:
cache.clear()

# After:
await smart_cache.update_account_field(account_number, "phase", phase_value)
```

### Expected Improvement

| Metric | Before | After |
|--------|--------|-------|
| Cache hit after trade | 0% (cleared) | 95%+ (only 1 invalidated) |
| Other accounts affected | All 69 | 0 |
| Response after trade | 5-20s | 100-200ms |

---

## Phase 3: WebSocket for Real-Time Updates (Week 2-3)

### Problem
Frontend polls every 10 minutes. No real-time feedback after trades.

### Solution
WebSocket server for instant push updates.

**Files to create/modify:**
- `main-backend/app/websocket_manager.py` (NEW)
- `main-backend/app/main.py`
- `frontend/src/services/websocket.js` (NEW)
- `frontend/src/hooks/useAccounts.js`
- `frontend/src/App.jsx`

### Implementation

#### Step 3.1: WebSocket Manager (Backend)

```python
# main-backend/app/websocket_manager.py
import asyncio
import json
from datetime import datetime
from typing import Dict, Set
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages WebSocket connections for real-time updates"""

    def __init__(self):
        # All connected clients
        self.active_connections: Set[WebSocket] = set()

        # Subscriptions by account: {account_number: set(websockets)}
        self.account_subscriptions: Dict[int, Set[WebSocket]] = {}

        # Lock for thread-safe operations
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
        logger.info(f"WebSocket connected. Total: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        async with self._lock:
            self.active_connections.discard(websocket)

            # Remove from all subscriptions
            for account_subs in self.account_subscriptions.values():
                account_subs.discard(websocket)

        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    async def subscribe_account(self, websocket: WebSocket, account_number: int):
        """Subscribe to updates for specific account"""
        async with self._lock:
            if account_number not in self.account_subscriptions:
                self.account_subscriptions[account_number] = set()
            self.account_subscriptions[account_number].add(websocket)

    async def broadcast(self, message: dict):
        """Send message to ALL connected clients"""
        if not self.active_connections:
            return

        data = json.dumps(message)
        disconnected = []

        for connection in self.active_connections.copy():
            try:
                await connection.send_text(data)
            except Exception:
                disconnected.append(connection)

        # Clean up disconnected
        for conn in disconnected:
            await self.disconnect(conn)

    async def broadcast_account_update(self, account_number: int, data: dict):
        """Send update to subscribers of specific account + all connections"""
        message = {
            "type": "account_update",
            "account_number": account_number,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        await self.broadcast(message)

    async def broadcast_trade_result(self, account_number: int, trade_type: str, result: dict):
        """Broadcast trade execution result"""
        message = {
            "type": "trade_result",
            "trade_type": trade_type,  # "open", "close", "modify"
            "account_number": account_number,
            "result": result,
            "timestamp": datetime.now().isoformat()
        }
        await self.broadcast(message)

    async def broadcast_agent_status(self, agent_name: str, status: str):
        """Broadcast agent status change"""
        message = {
            "type": "agent_status",
            "agent_name": agent_name,
            "status": status,
            "timestamp": datetime.now().isoformat()
        }
        await self.broadcast(message)

    @property
    def connection_count(self) -> int:
        return len(self.active_connections)


# Global instance
ws_manager = WebSocketManager()
```

#### Step 3.2: Add WebSocket Endpoint (Backend)

```python
# main-backend/app/main.py - Add WebSocket endpoint

from fastapi import WebSocket, WebSocketDisconnect
from app.websocket_manager import ws_manager

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, handle incoming messages
            data = await websocket.receive_text()
            message = json.loads(data)

            # Handle subscription requests
            if message.get("type") == "subscribe":
                account_number = message.get("account_number")
                if account_number:
                    await ws_manager.subscribe_account(websocket, account_number)

            # Handle ping/pong for keepalive
            elif message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await ws_manager.disconnect(websocket)
```

#### Step 3.3: Broadcast After Trade Operations

```python
# main-backend/app/main.py - After successful trades

# In open_position endpoint (after Line 531):
if result.get("success"):
    await smart_cache.invalidate_account(account_number)
    # NEW: Broadcast to all connected frontends
    await ws_manager.broadcast_trade_result(
        account_number=account_number,
        trade_type="open",
        result=result
    )

# Same for close_position and modify_position
```

#### Step 3.4: WebSocket Client (Frontend)

```javascript
// frontend/src/services/websocket.js

class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.isConnected = false;
  }

  connect(url) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = url || this.getWebSocketUrl();
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');

      // Start keepalive ping
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      this.emit('disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  getWebSocketUrl() {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    const host = apiUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}://${host}/ws`;
  }

  handleMessage(message) {
    const { type } = message;

    switch (type) {
      case 'account_update':
        this.emit('accountUpdate', message);
        break;
      case 'trade_result':
        this.emit('tradeResult', message);
        break;
      case 'agent_status':
        this.emit('agentStatus', message);
        break;
      case 'pong':
        // Keepalive response, ignore
        break;
      default:
        console.log('Unknown message type:', type);
    }
  }

  startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  subscribe(accountNumber) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        account_number: accountNumber
      }));
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  disconnect() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsService = new WebSocketService();
export default wsService;
```

#### Step 3.5: Integrate WebSocket in React

```javascript
// frontend/src/hooks/useWebSocket.js

import { useEffect, useCallback } from 'react';
import wsService from '../services/websocket';

export function useWebSocket(onAccountUpdate, onTradeResult) {
  useEffect(() => {
    // Connect WebSocket
    wsService.connect();

    // Set up listeners
    const handleAccountUpdate = (message) => {
      if (onAccountUpdate) {
        onAccountUpdate(message.account_number, message.data);
      }
    };

    const handleTradeResult = (message) => {
      if (onTradeResult) {
        onTradeResult(message);
      }
    };

    wsService.on('accountUpdate', handleAccountUpdate);
    wsService.on('tradeResult', handleTradeResult);

    // Cleanup on unmount
    return () => {
      wsService.off('accountUpdate', handleAccountUpdate);
      wsService.off('tradeResult', handleTradeResult);
    };
  }, [onAccountUpdate, onTradeResult]);

  const subscribeToAccount = useCallback((accountNumber) => {
    wsService.subscribe(accountNumber);
  }, []);

  return {
    isConnected: wsService.isConnected,
    subscribeToAccount
  };
}
```

```javascript
// frontend/src/App.jsx - Add WebSocket integration

import { useWebSocket } from './hooks/useWebSocket';

function App() {
  const { accounts, setAccounts, refresh } = useAccounts();

  // Handle real-time updates
  const handleAccountUpdate = useCallback((accountNumber, data) => {
    setAccounts(prev => prev.map(acc =>
      acc.account_number === accountNumber
        ? { ...acc, ...data }
        : acc
    ));
  }, [setAccounts]);

  const handleTradeResult = useCallback((message) => {
    // Show notification
    showNotification(`Trade ${message.trade_type}: ${message.result.success ? 'Success' : 'Failed'}`);

    // Refresh the specific account
    refresh(message.account_number);
  }, [refresh]);

  // Connect WebSocket
  useWebSocket(handleAccountUpdate, handleTradeResult);

  // ... rest of component
}
```

### Expected Improvement

| Metric | Before | After |
|--------|--------|-------|
| Update latency | 10 minutes | **50-100ms** |
| Trade feedback | Manual refresh | **Instant notification** |
| Network requests | Continuous polling | **On-demand only** |
| User experience | Stale data | **Real-time** |

---

## Phase 4: Async File I/O (Week 3)

### Problem
Phase/VS updates block the event loop during file writes.

### Solution
Use `aiofiles` for non-blocking file operations.

### Implementation

#### Step 4.1: Install aiofiles

```bash
pip install aiofiles
```

Add to `requirements.txt`:
```
aiofiles==23.2.1
```

#### Step 4.2: Update Phase Manager

```python
# main-backend/app/phase_manager.py

import aiofiles
import asyncio
import json
from pathlib import Path
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class AsyncPhaseManager:
    """Async phase manager with non-blocking file I/O"""

    def __init__(self, file_path: str = "data/phases.json"):
        self.file_path = Path(__file__).parent / file_path
        self.phases: Dict[str, str] = {}
        self._lock = asyncio.Lock()
        self._loaded = False

    async def _ensure_loaded(self):
        """Ensure phases are loaded from disk"""
        if not self._loaded:
            await self.load_phases()
            self._loaded = True

    async def load_phases(self):
        """Load phases from JSON file asynchronously"""
        try:
            self.file_path.parent.mkdir(parents=True, exist_ok=True)

            if self.file_path.exists():
                async with aiofiles.open(self.file_path, 'r') as f:
                    content = await f.read()
                    self.phases = json.loads(content)
                    logger.info(f"Loaded {len(self.phases)} phases")
            else:
                self.phases = {}
                logger.info("No phases file found, starting fresh")
        except Exception as e:
            logger.error(f"Error loading phases: {e}")
            self.phases = {}

    async def save_phases(self):
        """Save phases to JSON file asynchronously"""
        try:
            self.file_path.parent.mkdir(parents=True, exist_ok=True)

            async with aiofiles.open(self.file_path, 'w') as f:
                await f.write(json.dumps(self.phases, indent=2))

            logger.debug("Phases saved successfully")
        except Exception as e:
            logger.error(f"Error saving phases: {e}")

    async def get_phase(self, account_number: int) -> str:
        """Get phase for an account"""
        async with self._lock:
            await self._ensure_loaded()
            return self.phases.get(str(account_number), "F1")

    async def update_phase(self, account_number: int, phase_value: str):
        """Update phase and save asynchronously"""
        async with self._lock:
            await self._ensure_loaded()
            self.phases[str(account_number)] = phase_value
            logger.info(f"Updated phase for {account_number}: {phase_value}")

        # Save outside lock to not block reads
        await self.save_phases()

    async def get_all_phases(self) -> Dict[str, str]:
        """Get all phases"""
        async with self._lock:
            await self._ensure_loaded()
            return self.phases.copy()


# Global instance
async_phase_manager = AsyncPhaseManager()
```

#### Step 4.3: Same Pattern for VS Manager

```python
# main-backend/app/vs_manager.py - Same async pattern as phase_manager
```

#### Step 4.4: Background Save with Debounce

For high-frequency updates, add debounced saving:

```python
# main-backend/app/async_debounce.py

import asyncio
from typing import Callable, Awaitable

class AsyncDebouncer:
    """Debounce async function calls"""

    def __init__(self, delay: float = 1.0):
        self.delay = delay
        self._task: asyncio.Task = None

    async def call(self, func: Callable[[], Awaitable]):
        """Call function after delay, canceling previous pending calls"""
        if self._task:
            self._task.cancel()

        self._task = asyncio.create_task(self._delayed_call(func))

    async def _delayed_call(self, func: Callable[[], Awaitable]):
        try:
            await asyncio.sleep(self.delay)
            await func()
        except asyncio.CancelledError:
            pass


# Usage in phase_manager:
class AsyncPhaseManager:
    def __init__(self):
        self._save_debouncer = AsyncDebouncer(delay=2.0)

    async def update_phase(self, account_number: int, phase_value: str):
        async with self._lock:
            self.phases[str(account_number)] = phase_value

        # Debounced save - won't block, batches rapid updates
        await self._save_debouncer.call(self.save_phases)
```

### Expected Improvement

| Metric | Before | After |
|--------|--------|-------|
| File write blocking | 50-500ms | 0ms (async) |
| Rapid updates | Each blocks | Batched saves |
| API response time | Includes I/O wait | Immediate response |

---

## Phase 5: Frontend Optimizations (Week 3-4)

### 5.1 Optimistic UI Updates

```javascript
// frontend/src/hooks/useAccounts.js

const openPosition = useCallback(async (accountNumber, tradeData) => {
  // Optimistic update - show pending state immediately
  setAccounts(prev => prev.map(acc =>
    acc.account_number === accountNumber
      ? { ...acc, _pendingTrade: true }
      : acc
  ));

  try {
    const result = await apiService.openPosition(accountNumber, tradeData);

    if (result.success) {
      // Update with real data when confirmed
      setAccounts(prev => prev.map(acc =>
        acc.account_number === accountNumber
          ? { ...acc, _pendingTrade: false, has_open_position: true }
          : acc
      ));
    } else {
      // Rollback on failure
      setAccounts(prev => prev.map(acc =>
        acc.account_number === accountNumber
          ? { ...acc, _pendingTrade: false }
          : acc
      ));
      throw new Error(result.message);
    }

    return result;
  } catch (error) {
    // Rollback on error
    setAccounts(prev => prev.map(acc =>
      acc.account_number === accountNumber
        ? { ...acc, _pendingTrade: false }
        : acc
    ));
    throw error;
  }
}, [setAccounts]);
```

### 5.2 Reduce Auto-Refresh Interval (with WebSocket backup)

```javascript
// frontend/src/App.jsx

useEffect(() => {
  // With WebSocket, we only need periodic refresh as backup
  // Reduce from 10 minutes to 2 minutes
  const timer = setInterval(() => {
    refresh();
  }, 120000); // 2 minutes backup refresh

  return () => clearInterval(timer);
}, [refresh]);
```

### 5.3 Single Account Refresh

```javascript
// frontend/src/services/api.js

async refreshAccount(accountNumber) {
  const response = await fetch(
    `${API_BASE_URL}/api/accounts/${accountNumber}?force_refresh=true`
  );
  return response.json();
}
```

```javascript
// frontend/src/hooks/useAccounts.js

const refreshAccount = useCallback(async (accountNumber) => {
  try {
    const updatedAccount = await apiService.refreshAccount(accountNumber);
    setAccounts(prev => prev.map(acc =>
      acc.account_number === accountNumber ? updatedAccount : acc
    ));
  } catch (error) {
    console.error('Failed to refresh account:', error);
  }
}, [setAccounts]);
```

### 5.4 React Query for Better Caching (Optional)

```bash
npm install @tanstack/react-query
```

```javascript
// frontend/src/hooks/useAccounts.js with React Query

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useAccounts() {
  const queryClient = useQueryClient();

  const { data: accounts, isLoading, refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiService.fetchAccounts(),
    staleTime: 60000, // Consider data fresh for 1 minute
    refetchInterval: 120000, // Refetch every 2 minutes
  });

  const openPositionMutation = useMutation({
    mutationFn: ({ accountNumber, data }) =>
      apiService.openPosition(accountNumber, data),
    onSuccess: (result, { accountNumber }) => {
      // Invalidate only this account
      queryClient.invalidateQueries(['accounts', accountNumber]);
    },
  });

  return {
    accounts,
    isLoading,
    refresh: refetch,
    openPosition: openPositionMutation.mutate,
  };
}
```

---

## Implementation Schedule

| Week | Phase | Tasks | Hours |
|------|-------|-------|-------|
| 1 | Phase 1 | HTTP Connection Pooling | 6h |
| 1-2 | Phase 2 | Smart Cache | 10h |
| 2-3 | Phase 3 | WebSocket Backend | 10h |
| 3 | Phase 3 | WebSocket Frontend | 8h |
| 3 | Phase 4 | Async File I/O | 6h |
| 3-4 | Phase 5 | Frontend Optimizations | 8h |
| 4 | Testing | Integration Testing | 6h |
| **Total** | | | **54h** |

---

## Performance Targets

| Metric | Current | After Phase 1-2 | After All Phases |
|--------|---------|-----------------|------------------|
| Trade execution | 1-3s | 0.8-2s | **0.3-0.8s** |
| Account refresh | 5-20s | 0.5-2s | **0.1-0.5s** |
| Frontend update | 10 min | 2 min | **50-100ms** |
| Phase update | 5-20s | 0.2-0.5s | **0.1-0.2s** |

---

## Testing Checklist

- [ ] Connection pooling works across multiple requests
- [ ] Cache invalidates only affected accounts
- [ ] WebSocket connects and receives updates
- [ ] WebSocket reconnects after disconnect
- [ ] Trades reflect immediately in UI
- [ ] Async file saves don't block API
- [ ] No race conditions in cache updates
- [ ] Performance metrics meet targets

---

## Rollback Plan

Each phase can be rolled back independently:

1. **Phase 1**: Revert to `async with httpx.AsyncClient()`
2. **Phase 2**: Revert to `SimpleCache` class
3. **Phase 3**: Remove WebSocket endpoint, frontend falls back to polling
4. **Phase 4**: Revert to synchronous file I/O
5. **Phase 5**: Revert frontend changes

---

*Document created: 2026-02-01*
*Estimated completion: 4 weeks*
*Cost: $0 (code changes only)*
