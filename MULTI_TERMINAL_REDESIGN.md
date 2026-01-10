# MT5 Monitor - Multi-Terminal Architecture Redesign

**Date**: 2026-01-10
**Purpose**: Eliminate login/logout broker suspicion by connecting to already-running MT5 terminals

---

## Problem Statement

**Current Issue**: The vps-agent performs programmatic `mt5.login()` and logout for each account on every data fetch, creating suspicious login patterns that brokers may flag for fraud.

**User Setup**:
- Each VPS has 2-3 different broker terminals running (ICMarkets, FTMO, FundedNext, etc.)
- Each terminal is already open and logged into an account
- User knows the installation paths for each terminal
- Total: ~21 accounts across 7 VPS

**Goal**: Read data from already-logged-in terminals without calling `mt5.login()` at all.

---

## New Architecture

### System Components

1. **VPS Agent (Multi-Process per VPS)**
   - **One installation directory per VPS**
   - **Multiple processes** (one per broker terminal)
   - Each process connects to ONE specific terminal path
   - Each process runs on a different port (8000, 8001, 8002, etc.)
   - Reads from already-logged-in account (no login/logout)
   - Process launcher manages all agent processes

2. **Main Backend** (unchanged functionality)
   - Aggregates data from all VPS agents (now 14-21 agents instead of 7)
   - Stores and manages phase values (editable via UI)
   - Provides unified REST API to frontend
   - Handles caching for performance

3. **Frontend** (no changes needed)
   - Displays account data in table format
   - Manual refresh functionality
   - Inline editing for phase values

### Data Flow

```
MT5 Terminals (2-3 per VPS, already logged in)
  ↓
VPS Agent Processes (2-3 per VPS, each on different port)
  ↓
Main Backend (aggregates from 14-21 agents)
  ↓
Frontend (Vercel)
  ↓
User Browser
```

### Key Differences from Original

| Aspect | Original Design | New Design |
|--------|----------------|------------|
| Login Method | `mt5.login()` per account | No login - reads current account |
| Terminals per Agent | 1 (logs into multiple accounts) | 1 per agent process |
| Agents per VPS | 1 | 2-3 (one per broker) |
| Total Agents | 7 | 14-21 |
| Configuration | Account array in .env | Terminal configs in agents.json |
| Port Usage | 8000 per VPS | 8000, 8001, 8002 per VPS |

---

## Critical Code Changes

### 1. VPS Agent - MT5 Service (MAJOR CHANGES)
**File**: `vps-agent/app/mt5_service.py`

**Current Behavior** (lines 18-42):
- Calls `mt5.initialize()` without path (connects to default terminal)
- Calls `mt5.login(account_number, password, server)` for each account
- Loops through multiple accounts, logging in/out each time

**New Behavior**:
- Accept `terminal_path` parameter in `__init__()`
- Call `mt5.initialize(path=terminal_path)` to connect to specific terminal
- **Remove all `mt5.login()` calls**
- Simplify to single account per service instance (no looping)
- Just call `mt5.account_info()` to get current account data

**Code Changes**:

```python
# OLD (line 14-16)
def __init__(self):
    self.initialized = False
    self.account_configs = settings.MT5_ACCOUNTS

# NEW
def __init__(self, terminal_path: str, display_name: str):
    self.terminal_path = terminal_path
    self.display_name = display_name
    self.initialized = False

# OLD (line 18-26)
def initialize(self) -> bool:
    if not mt5.initialize():  # No path specified
        error = mt5.last_error()
        logger.error(f"MT5 initialization failed: {error}")
        return False
    self.initialized = True
    return True

# NEW
def initialize(self) -> bool:
    if not mt5.initialize(path=self.terminal_path):
        error = mt5.last_error()
        logger.error(f"MT5 initialization failed for {self.terminal_path}: {error}")
        return False
    self.initialized = True
    logger.info(f"MT5 initialized successfully for {self.display_name}")
    return True

# OLD (line 34-67) - Had login logic
def get_account_info(self, account_number: int, password: str, server: str):
    if not mt5.login(account_number, password=password, server=server):  # ❌ REMOVE THIS
        error = mt5.last_error()
        logger.error(f"Failed to login to account {account_number}: {error}")
        return None
    account_info = mt5.account_info()
    ...

# NEW - No parameters, no login
def get_account_info(self) -> Optional[AccountInfo]:
    # Just read from already-logged-in account
    account_info = mt5.account_info()
    if account_info is None:
        logger.error("Failed to get account info from logged-in terminal")
        return None

    return AccountInfo(
        account_number=account_info.login,
        account_name=account_info.name,
        balance=account_info.balance,
        equity=account_info.equity,
        margin=account_info.margin,
        margin_free=account_info.margin_free,
        margin_level=account_info.margin_level,
        profit=account_info.profit,
        server=account_info.server,
        company=account_info.company,
        currency=account_info.currency,
        leverage=account_info.leverage,
        trade_allowed=account_info.trade_allowed,
        connected=True
    )

# OLD (line 89-128) - Looped through multiple accounts
def get_all_accounts(self) -> List[AccountResponse]:
    for config in self.account_configs:  # ❌ REMOVE LOOP
        account_info = self.get_account_info(
            config["account_number"],
            config["password"],
            config["server"]
        )
        ...

# NEW - Single account
def get_account_data(self) -> AccountResponse:
    if not self.initialized:
        self.initialize()

    account_info = self.get_account_info()
    if account_info:
        days_op = self.calculate_days_operating()
        return AccountResponse(
            account_number=account_info.account_number,
            account_name=self.display_name,
            balance=account_info.balance,
            status="connected",
            days_operating=days_op,
            last_updated=datetime.now()
        )
    else:
        return AccountResponse(
            account_number=0,
            account_name=self.display_name,
            balance=0.0,
            status="disconnected",
            days_operating=0,
            last_updated=datetime.now()
        )

# OLD (line 132) - Singleton
mt5_service = MT5Service()

# NEW - Remove singleton, instantiate in main.py with config
# (delete this line)
```

---

### 2. VPS Agent - Configuration (MODIFIED)
**File**: `vps-agent/app/config.py`

**Changes**:
- Add `MT5_TERMINAL_PATH` setting
- Add `ACCOUNT_DISPLAY_NAME` setting
- Remove `MT5_ACCOUNTS_JSON` property

```python
class Settings(BaseSettings):
    # Agent identification
    AGENT_NAME: str = "VPS-Agent-1"
    AGENT_PORT: int = 8000

    # MT5 Terminal path (NEW)
    MT5_TERMINAL_PATH: str = ""
    ACCOUNT_DISPLAY_NAME: str = "Account"

    # CORS settings
    ALLOWED_ORIGINS: List[str] = ["*"]

    # Logging
    LOG_LEVEL: str = "INFO"

    # REMOVE THIS:
    # @property
    # def MT5_ACCOUNTS(self) -> List[Dict]:
    #     try:
    #         return json.loads(self.MT5_ACCOUNTS_JSON)
    #     except json.JSONDecodeError:
    #         return []

    class Config:
        env_file = ".env"
```

---

### 3. VPS Agent - Main App (MODIFIED)
**File**: `vps-agent/app/main.py`

**Changes**:
- Initialize mt5_service with terminal_path and display_name from config
- Change `/accounts` endpoint to return single account (not array)

```python
# OLD (line 6)
from .mt5_service import mt5_service  # Singleton

# NEW
from .mt5_service import MT5Service

# OLD - Used singleton
# (no initialization code)

# NEW - Create instance after imports, before app creation
mt5_service = MT5Service(
    terminal_path=settings.MT5_TERMINAL_PATH,
    display_name=settings.ACCOUNT_DISPLAY_NAME
)

# OLD (line 67-78)
@app.get("/accounts", response_model=List[AccountResponse])
async def get_accounts():
    """Get all MT5 accounts info from this VPS"""
    try:
        logger.info("Fetching accounts data")
        accounts = mt5_service.get_all_accounts()  # Returns list
        logger.info(f"Successfully fetched {len(accounts)} accounts")
        return accounts
    except Exception as e:
        logger.error(f"Error fetching accounts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch accounts: {str(e)}")

# NEW
@app.get("/accounts", response_model=AccountResponse)  # Single account now
async def get_accounts():
    """Get MT5 account info from this agent's terminal"""
    try:
        logger.info("Fetching account data")
        account = mt5_service.get_account_data()  # Returns single object
        logger.info(f"Successfully fetched account {account.account_number}")
        return account
    except Exception as e:
        logger.error(f"Error fetching account: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch account: {str(e)}")
```

**Response format change**:

OLD (returned array):
```json
[
  {
    "account_number": 12345678,
    "account_name": "Wilian FN",
    "balance": -694.50,
    "status": "connected",
    "days_operating": 4,
    "last_updated": "2026-01-09T12:00:00"
  }
]
```

NEW (returns single object):
```json
{
  "account_number": 12345678,
  "account_name": "ICMarkets Account A",
  "balance": -694.50,
  "status": "connected",
  "days_operating": 4,
  "last_updated": "2026-01-09T12:00:00"
}
```

---

### 4. VPS Agent - Multi-Process Launcher (NEW FILE)
**File**: `vps-agent/launcher.py`

**Purpose**: Read terminal configurations and spawn multiple FastAPI processes

```python
import json
import subprocess
import os
import time
from pathlib import Path

def load_agent_configs():
    """Load terminal configurations from agents.json"""
    config_path = Path(__file__).parent / "agents.json"
    with open(config_path) as f:
        return json.load(f)

def start_agent(config):
    """Start a single agent process"""
    env = os.environ.copy()
    env["AGENT_NAME"] = config["name"]
    env["AGENT_PORT"] = str(config["port"])
    env["MT5_TERMINAL_PATH"] = config["terminal_path"]
    env["ACCOUNT_DISPLAY_NAME"] = config["display_name"]

    cmd = [
        "python", "-m", "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", str(config["port"])
    ]

    return subprocess.Popen(cmd, env=env)

def main():
    """Launch all agent processes"""
    configs = load_agent_configs()
    processes = []

    print(f"Starting {len(configs['agents'])} agent processes...")

    for config in configs["agents"]:
        print(f"Starting {config['name']} on port {config['port']}...")
        proc = start_agent(config)
        processes.append((config, proc))
        time.sleep(2)  # Stagger startup

    print("All agents started. Press Ctrl+C to stop.")

    try:
        # Monitor processes
        while True:
            time.sleep(5)
            for config, proc in processes:
                if proc.poll() is not None:
                    print(f"⚠️ {config['name']} crashed! Restarting...")
                    new_proc = start_agent(config)
                    processes[processes.index((config, proc))] = (config, new_proc)
    except KeyboardInterrupt:
        print("\nStopping all agents...")
        for _, proc in processes:
            proc.terminate()
        print("All agents stopped.")

if __name__ == "__main__":
    main()
```

---

### 5. VPS Agent - Terminal Configuration (NEW FILE)
**File**: `vps-agent/agents.json`

**Purpose**: Define all terminals to monitor on this VPS

**Example for VPS-1** (customize for each VPS):
```json
{
  "agents": [
    {
      "name": "VPS1-ICMarkets",
      "port": 8000,
      "terminal_path": "C:/Program Files/ICMarkets MT5/terminal64.exe",
      "display_name": "ICMarkets Account A"
    },
    {
      "name": "VPS1-FTMO",
      "port": 8001,
      "terminal_path": "C:/Program Files/FTMO MT5/terminal64.exe",
      "display_name": "FTMO Challenge 1"
    },
    {
      "name": "VPS1-FundedNext",
      "port": 8002,
      "terminal_path": "C:/Program Files/FundedNext MT5/terminal64.exe",
      "display_name": "FundedNext Express"
    }
  ]
}
```

**Configuration per agent**:
- `name`: Unique identifier for this agent instance
- `port`: Port to run this agent on (8000, 8001, 8002, etc.)
- `terminal_path`: Full path to MT5 terminal executable
- `display_name`: Human-readable account name for UI

---

### 6. Main Backend - Configuration Update
**File**: `main-backend/.env`

**Change**: Update VPS_AGENTS_JSON to include ALL agent instances (not just 7 VPS)

**Example** (assuming 7 VPS, each with 3 brokers):
```env
VPS_AGENTS_JSON=[
  {"name":"VPS1-ICMarkets","url":"http://vps1-ip:8000"},
  {"name":"VPS1-FTMO","url":"http://vps1-ip:8001"},
  {"name":"VPS1-FundedNext","url":"http://vps1-ip:8002"},
  {"name":"VPS2-ICMarkets","url":"http://vps2-ip:8000"},
  {"name":"VPS2-FTMO","url":"http://vps2-ip:8001"},
  {"name":"VPS2-FundedNext","url":"http://vps2-ip:8002"},
  {"name":"VPS3-ICMarkets","url":"http://vps3-ip:8000"},
  {"name":"VPS3-FTMO","url":"http://vps3-ip:8001"},
  {"name":"VPS3-FundedNext","url":"http://vps3-ip:8002"},
  {"name":"VPS4-ICMarkets","url":"http://vps4-ip:8000"},
  {"name":"VPS4-FTMO","url":"http://vps4-ip:8001"},
  {"name":"VPS4-FundedNext","url":"http://vps4-ip:8002"},
  {"name":"VPS5-ICMarkets","url":"http://vps5-ip:8000"},
  {"name":"VPS5-FTMO","url":"http://vps5-ip:8001"},
  {"name":"VPS5-FundedNext","url":"http://vps5-ip:8002"},
  {"name":"VPS6-ICMarkets","url":"http://vps6-ip:8000"},
  {"name":"VPS6-FTMO","url":"http://vps6-ip:8001"},
  {"name":"VPS6-FundedNext","url":"http://vps6-ip:8002"},
  {"name":"VPS7-ICMarkets","url":"http://vps7-ip:8000"},
  {"name":"VPS7-FTMO","url":"http://vps7-ip:8001"},
  {"name":"VPS7-FundedNext","url":"http://vps7-ip:8002"}
]
```

**Note**: No code changes needed in main-backend, just configuration update

---

## Deployment Steps

### Step 1: Update VPS Agent Code (Repeat for All 7 VPS)

1. **Backup current .env** (if exists):
   ```bash
   cd /path/to/vps-agent
   cp .env .env.backup  # Save old config
   ```

2. **Upload new files**:
   - Updated `app/mt5_service.py`
   - Updated `app/config.py`
   - Updated `app/main.py`
   - New `launcher.py`

3. **Create agents.json configuration**:
   ```bash
   nano agents.json
   ```

   Example for VPS-1 (customize for each VPS):
   ```json
   {
     "agents": [
       {
         "name": "VPS1-ICMarkets",
         "port": 8000,
         "terminal_path": "C:/Program Files/ICMarkets MT5/terminal64.exe",
         "display_name": "ICMarkets Account A"
       },
       {
         "name": "VPS1-FTMO",
         "port": 8001,
         "terminal_path": "C:/Program Files/FTMO MT5/terminal64.exe",
         "display_name": "FTMO Challenge 1"
       }
     ]
   }
   ```

4. **Stop old agent** (if running):
   ```bash
   # Find and kill old process
   sudo systemctl stop mt5-agent  # If using systemd
   # OR
   pkill -f "uvicorn app.main"
   ```

5. **Test launcher**:
   ```bash
   python launcher.py
   ```

   Should see:
   ```
   Starting 2 agent processes...
   Starting VPS1-ICMarkets on port 8000...
   Starting VPS1-FTMO on port 8001...
   All agents started. Press Ctrl+C to stop.
   ```

6. **Test each agent**:
   ```bash
   curl http://localhost:8000/accounts
   curl http://localhost:8001/accounts
   ```

   Each should return a single account object (not array).

7. **Create systemd service** (for auto-start):
   ```bash
   sudo nano /etc/systemd/system/mt5-agents.service
   ```

   Content:
   ```ini
   [Unit]
   Description=MT5 Multi-Agent Launcher
   After=network.target

   [Service]
   Type=simple
   User=youruser
   WorkingDirectory=/path/to/vps-agent
   ExecStart=/usr/bin/python3 launcher.py
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

8. **Enable and start**:
   ```bash
   sudo systemctl enable mt5-agents
   sudo systemctl start mt5-agents
   sudo systemctl status mt5-agents
   ```

9. **Open firewall ports**:
   ```bash
   sudo ufw allow 8000/tcp
   sudo ufw allow 8001/tcp
   sudo ufw allow 8002/tcp  # If you have 3 agents
   ```

---

### Step 2: Update Main Backend

1. **Update .env** with all agent URLs:
   ```bash
   cd /path/to/main-backend
   nano .env
   ```

   Update `VPS_AGENTS_JSON` with all 14-21 agents (see example in section 6).

2. **Restart backend**:
   ```bash
   sudo systemctl restart mt5-backend
   # OR
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
   ```

3. **Test aggregation**:
   ```bash
   curl http://localhost:8080/api/accounts
   ```

   Should now show all 21 accounts from all agents.

---

### Step 3: Frontend (No Changes Needed)

Frontend code doesn't need updates - it already handles the data structure correctly.

---

## Verification Checklist

### On Each VPS:
- [ ] All MT5 terminals are open and logged in
- [ ] agents.json configured with correct terminal paths
- [ ] launcher.py successfully starts all processes
- [ ] Each agent port responds to curl (8000, 8001, 8002, etc.)
- [ ] Each /accounts endpoint returns single account object
- [ ] No login/logout activity in MT5 terminal logs
- [ ] Systemd service configured and enabled

### On Main Backend:
- [ ] VPS_AGENTS_JSON contains all 14-21 agent URLs
- [ ] /api/accounts returns all accounts from all agents
- [ ] /api/agents/status shows all agents as healthy
- [ ] Total account count matches expected (21)

### On Frontend:
- [ ] All 21 accounts visible in table
- [ ] Account names match display_name from agents.json
- [ ] Balances update correctly on refresh
- [ ] Phase editing still works

---

## Testing the No-Login Behavior

**Verification that login/logout is eliminated**:

1. **Monitor MT5 terminal logs** (before refresh):
   - Check broker's account history/login logs
   - Note current login timestamp

2. **Trigger data refresh** from frontend:
   - Click "Refresh Data" button

3. **Check MT5 terminal again**:
   - ✅ **Success**: No new login/logout entries
   - ❌ **Failure**: New login timestamp appears (code still calling login())

4. **Monitor agent logs**:
   ```bash
   # Should NOT see any login messages
   journalctl -u mt5-agents -f | grep -i login
   ```

   Should be empty - no login activity.

---

## Rollback Plan

If issues occur, rollback procedure:

1. **Stop new launcher**:
   ```bash
   sudo systemctl stop mt5-agents
   ```

2. **Restore old configuration**:
   ```bash
   cd /path/to/vps-agent
   git checkout app/  # Revert code changes
   cp .env.backup .env  # Restore old config
   ```

3. **Start old agent**:
   ```bash
   sudo systemctl start mt5-agent
   ```

4. **Revert main backend .env**:
   - Change VPS_AGENTS_JSON back to 7 VPS URLs

---

## Migration Path (Gradual Rollout)

**Recommended**: Deploy to 1 VPS first, test thoroughly, then expand.

1. **Week 1**: Deploy to VPS-1 only
   - Configure agents.json for VPS-1
   - Update main backend to include VPS-1's 3 agents + old 6 VPS
   - Monitor for issues

2. **Week 2**: If stable, deploy to VPS-2 and VPS-3
   - Update main backend configuration
   - Monitor broker activity

3. **Week 3**: Deploy to remaining VPS (4-7)

This gradual approach minimizes risk.

---

## Summary

### Files to Modify

**vps-agent/app/mt5_service.py** (MAJOR CHANGES):
- Add `terminal_path` and `display_name` to `__init__()`
- Change `initialize()` to use `mt5.initialize(path=terminal_path)`
- Remove `mt5.login()` calls completely
- Simplify `get_account_info()` to no parameters (read current account)
- Replace `get_all_accounts()` with `get_account_data()` for single account

**vps-agent/app/config.py** (MODIFIED):
- Add `MT5_TERMINAL_PATH` setting
- Add `ACCOUNT_DISPLAY_NAME` setting
- Remove `MT5_ACCOUNTS_JSON` property

**vps-agent/app/main.py** (MODIFIED):
- Initialize `MT5Service` with terminal_path and display_name from settings
- Change `/accounts` endpoint response from List to single AccountResponse object

**vps-agent/launcher.py** (NEW):
- Create multi-process launcher that reads agents.json
- Spawns uvicorn process for each terminal configuration
- Monitors and restarts crashed processes

**vps-agent/agents.json** (NEW):
- Configuration file defining all terminals on this VPS
- Each entry: name, port, terminal_path, display_name

**main-backend/.env** (MODIFIED):
- Update `VPS_AGENTS_JSON` to include all 14-21 agent URLs (not just 7)

### Files NOT Modified

- main-backend/app/* (no code changes)
- frontend/* (no changes)
- vps-agent/requirements.txt (unchanged)

### Critical Files Referenced

- `vps-agent/app/mt5_service.py` - Lines 14-16, 18-26, 34-67, 89-128, 132
- `vps-agent/app/config.py` - Lines 12-27
- `vps-agent/app/main.py` - Lines 6, 67-78

### Success Criteria

✅ No `mt5.login()` calls in code
✅ All MT5 terminals stay logged in (no login/logout activity)
✅ Each agent process connects to ONE specific terminal path
✅ Main backend aggregates from all 14-21 agents successfully
✅ Frontend displays all accounts correctly
✅ Broker account logs show no suspicious login patterns

### Risk Assessment

**Low Risk**:
- Main backend only needs configuration update (no code changes)
- Frontend needs no changes
- VPS agent changes are well-isolated to MT5 integration

**Medium Risk**:
- Multi-process launcher is new component (could have bugs)
- Terminal path detection might vary by broker/VPS

**Mitigation**:
- Gradual rollout (1 VPS at a time)
- Keep old code as rollback option
- Test thoroughly on VPS-1 before expanding

### Implementation Time Estimate

- Code changes: 2-3 hours
- Testing on 1 VPS: 1 hour
- Deployment to all 7 VPS: 2-3 hours
- **Total: 1 day**

---

---

## Implementation Status

**Document created**: 2026-01-10
**Implementation completed**: 2026-01-10

### ✅ Changes Completed

1. **vps-agent/app/mt5_service.py** - Fully rewritten
   - ✅ Removed all `mt5.login()` calls
   - ✅ Added `terminal_path` and `display_name` parameters to `__init__()`
   - ✅ Updated `initialize()` to use `mt5.initialize(path=terminal_path)`
   - ✅ Simplified `get_account_info()` to read from logged-in account (no parameters)
   - ✅ Replaced `get_all_accounts()` with `get_account_data()` for single account
   - ✅ Removed singleton instance

2. **vps-agent/app/config.py** - Updated
   - ✅ Added `MT5_TERMINAL_PATH` setting
   - ✅ Added `ACCOUNT_DISPLAY_NAME` setting
   - ✅ Removed `MT5_ACCOUNTS_JSON` and `MT5_ACCOUNTS` property
   - ✅ Cleaned up unused imports (json, Dict)

3. **vps-agent/app/main.py** - Updated
   - ✅ Imported `MT5Service` class instead of singleton
   - ✅ Created instance with `terminal_path` and `display_name` from settings
   - ✅ Changed `/accounts` endpoint response from `List[AccountResponse]` to single `AccountResponse`
   - ✅ Removed unused `List` import

4. **vps-agent/launcher.py** - Created
   - ✅ Multi-process manager with process monitoring
   - ✅ Reads configuration from `agents.json`
   - ✅ Spawns uvicorn processes with environment variables
   - ✅ Auto-restarts crashed processes
   - ✅ Graceful shutdown on Ctrl+C

5. **vps-agent/agents.json.example** - Created
   - ✅ Example configuration with 3 broker terminals
   - ✅ Shows structure for ICMarkets, FTMO, FundedNext

6. **.gitignore** - Updated
   - ✅ Added `vps-agent/agents.json` to ignore VPS-specific configs

### 📋 Next Steps for Deployment

1. **Test Locally** (Optional - if you have MT5 on Windows):
   - Copy `vps-agent/agents.json.example` to `vps-agent/agents.json`
   - Update with your local MT5 terminal paths
   - Run `python vps-agent/launcher.py`
   - Test endpoints: `curl http://localhost:8000/accounts`

2. **Deploy to VPS-1** (First Deployment):
   - Upload modified vps-agent code to VPS-1
   - Create `agents.json` with VPS-1's terminal configurations
   - Run launcher manually to test: `python launcher.py`
   - Verify no login/logout in MT5 terminal logs
   - Create systemd service for auto-start
   - Update main-backend .env with new VPS-1 agent URLs

3. **Monitor and Verify**:
   - Check broker account logs for no suspicious login activity
   - Monitor agent logs: `journalctl -u mt5-agents -f`
   - Test frontend displays all accounts correctly

4. **Gradual Rollout** (Recommended):
   - Week 1: VPS-1 only (monitor closely)
   - Week 2: VPS-2 and VPS-3 (if VPS-1 stable)
   - Week 3: Remaining VPS (4-7)

### 🔍 Verification Commands

**On VPS (after deployment)**:
```bash
# Check launcher status
sudo systemctl status mt5-agents

# View logs
journalctl -u mt5-agents -f

# Test each agent
curl http://localhost:8000/accounts
curl http://localhost:8001/accounts
curl http://localhost:8002/accounts

# Search for login activity (should be empty)
journalctl -u mt5-agents -f | grep -i login
```

**From main backend**:
```bash
# Test aggregation
curl http://localhost:8080/api/accounts

# Check agent status
curl http://localhost:8080/api/agents/status
```

### ⚠️ Important Notes

- **DO NOT COMMIT** `vps-agent/agents.json` (already in .gitignore)
- **KEEP** `vps-agent/agents.json.example` for reference
- **ROLLBACK PLAN**: Original code still in git history if needed
- **TERMINAL REQUIREMENT**: All MT5 terminals must be open and logged in before starting agents

### 🎯 Success Indicators

You'll know the redesign is successful when:
1. ✅ No `mt5.login()` in logs
2. ✅ MT5 terminal stays logged in (no login/logout timestamps)
3. ✅ All accounts visible in frontend
4. ✅ Broker doesn't flag suspicious activity
5. ✅ Agent processes restart automatically if crashed

---

**Implementation completed**: 2026-01-10
**Ready for deployment**: VPS testing phase
