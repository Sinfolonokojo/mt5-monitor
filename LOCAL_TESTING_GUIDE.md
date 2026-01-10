# MT5 Monitor - Local Testing Guide (Multi-Terminal Architecture)

**Date**: 2026-01-10
**Purpose**: Test the new multi-terminal architecture locally on Windows before VPS deployment

---

## Overview

This guide shows how to test the redesigned VPS agent locally on your Windows machine using the multi-terminal architecture (no login/logout).

**What you'll test**:
- Multiple agent processes connecting to different MT5 terminals
- No login/logout activity (terminals stay logged in)
- Process launcher with auto-restart
- Data aggregation in main backend
- Frontend display

---

## Prerequisites

### Required Software
- ✅ Python 3.10+ (you have 3.14)
- ✅ Node.js 18+
- ✅ Multiple MT5 terminals installed and running (different brokers)
- ✅ Each terminal logged into an account

### Important Notes
- **DO NOT** use the old local testing setup from `LOCAL_TEST.md`
- This is the **NEW** architecture - completely different approach
- Each agent process connects to ONE terminal (no login needed)

---

## Step 1: Prepare MT5 Terminals

### 1.1 Ensure Terminals Are Running

Open and log into each MT5 terminal you want to monitor:

```
Example setup (3 terminals):
1. ICMarkets MT5 → Logged into account 12345678
2. FTMO MT5 → Logged into account 87654321
3. FundedNext MT5 → Logged into account 99887766
```

**Critical**: Leave all terminals **open and logged in** - don't close them!

### 1.2 Find Terminal Paths

For each terminal, find the executable path:

**Common paths**:
```
C:\Program Files\ICMarkets MT5\terminal64.exe
C:\Program Files\FTMO MetaTrader 5\terminal64.exe
C:\Program Files\MetaTrader 5\terminal64.exe
```

**How to find**:
1. Right-click MT5 icon in taskbar
2. Right-click "MetaTrader 5" in menu
3. Click "Properties"
4. Copy the path from "Target" field

---

## Step 2: Configure VPS Agent

### 2.1 Create agents.json

```bash
cd C:\Users\Admin\Projects\Programar_Dia\vps-agent
copy agents.json.example agents.json
```

### 2.2 Edit agents.json

Open `agents.json` in notepad and configure your terminals:

```json
{
  "agents": [
    {
      "name": "Local-ICMarkets",
      "port": 8000,
      "terminal_path": "C:/Program Files/ICMarkets MT5/terminal64.exe",
      "display_name": "ICMarkets Demo"
    },
    {
      "name": "Local-FTMO",
      "port": 8001,
      "terminal_path": "C:/Program Files/FTMO MetaTrader 5/terminal64.exe",
      "display_name": "FTMO Challenge 1"
    },
    {
      "name": "Local-FundedNext",
      "port": 8002,
      "terminal_path": "C:/Program Files/MetaTrader 5/terminal64.exe",
      "display_name": "FundedNext Express"
    }
  ]
}
```

**Important**:
- Use forward slashes `/` not backslashes `\` in paths
- Each agent needs a unique port (8000, 8001, 8002, etc.)
- `display_name` is what shows in the frontend UI

### 2.3 Install Python Dependencies

```bash
cd C:\Users\Admin\Projects\Programar_Dia\vps-agent

# Install latest versions (compatible with Python 3.14)
pip install fastapi uvicorn[standard] pydantic pydantic-settings python-dotenv MetaTrader5 numpy
```

---

## Step 3: Start VPS Agents

### 3.1 Run the Launcher

Open PowerShell in `vps-agent` directory:

```bash
cd C:\Users\Admin\Projects\Programar_Dia\vps-agent
python launcher.py
```

**Expected output**:
```
🚀 Starting 3 agent process(es)...
============================================================
  Starting Local-ICMarkets on port 8000...
    Terminal: C:/Program Files/ICMarkets MT5/terminal64.exe
    Account: ICMarkets Demo
    ✅ Started (PID: 12345)

  Starting Local-FTMO on port 8001...
    Terminal: C:/Program Files/FTMO MetaTrader 5/terminal64.exe
    Account: FTMO Challenge 1
    ✅ Started (PID: 12346)

  Starting Local-FundedNext on port 8002...
    Terminal: C:/Program Files/MetaTrader 5/terminal64.exe
    Account: FundedNext Express
    ✅ Started (PID: 12347)

============================================================
✅ All 3 agent(s) started successfully!

📊 Monitoring processes... Press Ctrl+C to stop all agents.
```

**Troubleshooting**:
- If port already in use: Change port in agents.json
- If terminal path wrong: Check path with Task Manager → Right-click MT5 → Open file location
- If "Failed to start": Check Python and package installation

### 3.2 Test Each Agent (New PowerShell Window)

Open a **new** PowerShell window (keep launcher running):

```bash
# Test first agent (port 8000)
curl http://localhost:8000/accounts

# Test second agent (port 8001)
curl http://localhost:8001/accounts

# Test third agent (port 8002)
curl http://localhost:8002/accounts
```

**Expected response** (single account object):
```json
{
  "account_number": 12345678,
  "account_name": "ICMarkets Demo",
  "balance": 10000.0,
  "status": "connected",
  "days_operating": 5,
  "last_updated": "2026-01-10T15:30:00"
}
```

**✅ Success**: Each endpoint returns account data
**❌ Error**: If you get error, check MT5 terminal is logged in and path is correct

### 3.3 Verify No Login Activity

**Critical test**: Verify agents are NOT logging in/out

1. Check MT5 terminal "Journal" tab
2. Note the last login timestamp
3. Wait 30 seconds
4. Refresh agents multiple times: `curl http://localhost:8000/accounts`
5. Check MT5 Journal again

**✅ Success**: No new login entries in Journal
**❌ Failure**: If new login timestamps appear, something is wrong

---

## Step 4: Configure Main Backend

### 4.1 Create .env File

```bash
cd C:\Users\Admin\Projects\Programar_Dia\main-backend
```

Create `.env` file:
```env
API_PORT=8081
API_HOST=127.0.0.1
LOG_LEVEL=INFO
AGENT_TIMEOUT=30
CACHE_TTL=60

# All local agents (UPDATE with your actual count)
VPS_AGENTS_JSON=[{"name":"Local-ICMarkets","url":"http://127.0.0.1:8000"},{"name":"Local-FTMO","url":"http://127.0.0.1:8001"},{"name":"Local-FundedNext","url":"http://127.0.0.1:8002"}]

ALLOWED_ORIGINS=["http://localhost:5173"]
```

**Note**: Adjust `VPS_AGENTS_JSON` to match the agents you configured in Step 2.2

### 4.2 Install Dependencies

```bash
cd C:\Users\Admin\Projects\Programar_Dia\main-backend
pip install fastapi uvicorn pydantic pydantic-settings python-dotenv httpx
```

### 4.3 Create Data Directory

```bash
mkdir data
echo {} > data\phases.json
```

### 4.4 Start Main Backend (New PowerShell Window)

Open a **new** PowerShell window:

```bash
cd C:\Users\Admin\Projects\Programar_Dia\main-backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8081
```

**Expected output**:
```
INFO:     Started server process [12348]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8081
```

### 4.5 Test Backend Aggregation (New PowerShell Window)

Open a **new** PowerShell window:

```bash
# Test aggregated accounts endpoint
curl http://localhost:8081/api/accounts

# Test agent status
curl http://localhost:8081/api/agents/status
```

**Expected response**:
```json
{
  "accounts": [
    {
      "row_number": 1,
      "account_number": 12345678,
      "account_name": "ICMarkets Demo",
      "balance": 10000.0,
      "status": "connected",
      "phase": "F1",
      "days_operating": 5,
      "vps_source": "Local-ICMarkets",
      "last_updated": "2026-01-10T15:30:00"
    },
    {
      "row_number": 2,
      "account_number": 87654321,
      "account_name": "FTMO Challenge 1",
      "balance": 50000.0,
      "status": "connected",
      "phase": "F1",
      "days_operating": 2,
      "vps_source": "Local-FTMO",
      "last_updated": "2026-01-10T15:30:00"
    },
    {
      "row_number": 3,
      "account_number": 99887766,
      "account_name": "FundedNext Express",
      "balance": 25000.0,
      "status": "connected",
      "phase": "F1",
      "days_operating": 8,
      "vps_source": "Local-FundedNext",
      "last_updated": "2026-01-10T15:30:00"
    }
  ],
  "total_accounts": 3,
  "connected_accounts": 3,
  "disconnected_accounts": 0,
  "total_balance": 85000.0,
  "last_refresh": "2026-01-10T15:30:00"
}
```

**✅ Success**: All accounts from all agents aggregated
**❌ Error**: Check agent URLs in .env match running agents

---

## Step 5: Configure and Start Frontend

### 5.1 Create .env File

```bash
cd C:\Users\Admin\Projects\Programar_Dia\frontend
```

Create `.env` file:
```env
VITE_API_BASE_URL=http://127.0.0.1:8081
```

### 5.2 Install Dependencies

```bash
cd C:\Users\Admin\Projects\Programar_Dia\frontend
npm install
```

### 5.3 Start Frontend (New PowerShell Window)

Open a **new** PowerShell window:

```bash
cd C:\Users\Admin\Projects\Programar_Dia\frontend
npm run dev
```

**Expected output**:
```
VITE v5.0.0  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 5.4 Test in Browser

Open browser: **http://localhost:5173**

**Expected**:
- ✅ All 3 accounts displayed in table
- ✅ Account names match `display_name` from agents.json
- ✅ Balances show correctly
- ✅ Status shows "Connected" (green dot)
- ✅ Summary cards show totals

**Test functionality**:
1. Click "Refresh Data" → Accounts update
2. Click "Edit Phases" → Toggle edit mode
3. Change a phase value → Click save
4. Refresh page → Phase persists

---

## Step 6: Test Auto-Restart Feature

### 6.1 Crash an Agent

In the PowerShell window running the launcher:

1. Find a process ID from startup logs (e.g., PID: 12345)
2. Kill it manually:
   ```bash
   # In a new PowerShell window
   taskkill /PID 12345 /F
   ```

### 6.2 Verify Auto-Restart

Watch the launcher window:

**Expected output**:
```
⚠️  Local-ICMarkets crashed with code 1!
    Restarting in 5 seconds...
    ✅ Restarted (PID: 12350)
```

### 6.3 Test Frontend Still Works

Refresh browser → All accounts still visible (restarted agent reconnected)

**✅ Success**: Launcher auto-restarts crashed processes
**❌ Failure**: If agent doesn't restart, check launcher logs

---

## Step 7: Stop All Services

### 7.1 Stop Launcher

In the launcher PowerShell window:
- Press **Ctrl+C**

**Expected output**:
```
🛑 Stopping all agents...
  Stopping Local-ICMarkets (PID: 12345)...
  Stopping Local-FTMO (PID: 12346)...
  Stopping Local-FundedNext (PID: 12347)...
✅ All agents stopped.
```

### 7.2 Stop Main Backend

In the main backend PowerShell window:
- Press **Ctrl+C**

### 7.3 Stop Frontend

In the frontend PowerShell window:
- Press **Ctrl+C**

---

## Verification Checklist

After testing, verify:

### VPS Agent ✅
- [ ] Launcher starts all configured agents
- [ ] Each agent endpoint responds (8000, 8001, 8002, etc.)
- [ ] Each endpoint returns single account object (not array)
- [ ] No login/logout in MT5 terminal Journal
- [ ] Crashed agents auto-restart within 5 seconds
- [ ] Graceful shutdown on Ctrl+C

### Main Backend ✅
- [ ] Starts successfully on port 8081
- [ ] /api/accounts returns all agents' data aggregated
- [ ] /api/agents/status shows all agents healthy
- [ ] Total account count matches number of agents
- [ ] No errors in backend logs

### Frontend ✅
- [ ] All accounts visible in table
- [ ] Account names match display_name from agents.json
- [ ] Balances display correctly
- [ ] Status indicators work (green/red dots)
- [ ] Refresh button updates data
- [ ] Phase editing works and persists

### Architecture ✅
- [ ] No `mt5.login()` calls in logs
- [ ] MT5 terminals stay logged in (no new logins)
- [ ] Each agent connects to ONE terminal only
- [ ] Multiple agents can run on different ports simultaneously

---

## Troubleshooting

### Issue 1: "Port already in use"

**Error**: `OSError: [Errno 48] Address already in use`

**Solution**:
1. Find process using port: `netstat -ano | findstr :8000`
2. Kill process: `taskkill /PID <PID> /F`
3. Or change port in agents.json

### Issue 2: "Failed to get account info"

**Error**: Agent returns `"status": "disconnected"`

**Causes**:
- MT5 terminal not logged in
- Wrong terminal path in agents.json
- MT5 terminal closed

**Solution**:
1. Open MT5 terminal
2. Log into account
3. Verify terminal path in agents.json
4. Restart launcher

### Issue 3: "Backend timeout"

**Error**: `Timeout connecting to Local-ICMarkets`

**Causes**:
- Agent not running
- Agent URL wrong in backend .env
- AGENT_TIMEOUT too short

**Solution**:
1. Check agent is running: `curl http://localhost:8000/accounts`
2. Verify URL in backend .env matches
3. Increase AGENT_TIMEOUT=30 in backend .env

### Issue 4: Frontend shows 0 accounts

**Causes**:
- Backend not running
- Wrong API URL in frontend .env
- CORS error

**Solution**:
1. Check backend running: `curl http://localhost:8081/api/accounts`
2. Verify VITE_API_BASE_URL=http://127.0.0.1:8081
3. Check browser console for CORS errors
4. Restart frontend: `npm run dev`

### Issue 5: "MetaTrader5 module not found"

**Error**: `ModuleNotFoundError: No module named 'MetaTrader5'`

**Solution**:
```bash
pip install MetaTrader5
# Or for Python 3.14, install latest:
pip install --upgrade MetaTrader5
```

---

## Performance Testing

### Load Test: Multiple Refreshes

Test how the system handles rapid requests:

```bash
# Bash (WSL or Git Bash)
for i in {1..10}; do
  echo "Request $i"
  curl http://localhost:8081/api/accounts
  sleep 1
done
```

**Expected**: All requests succeed, no errors

### Concurrency Test: Multiple Clients

Open 3 browser tabs to http://localhost:5173

Click "Refresh Data" in all tabs simultaneously

**Expected**: All tabs update successfully

---

## Comparison: Old vs New Architecture

| Aspect | Old (LOCAL_TEST.md) | New (This Guide) |
|--------|---------------------|------------------|
| **Login Method** | `mt5.login()` per account | No login |
| **Agents per Machine** | 1 | 2-3+ (one per terminal) |
| **Endpoint Response** | Array of accounts | Single account |
| **Configuration** | .env with account passwords | agents.json with terminal paths |
| **Process Management** | Single uvicorn | Multi-process launcher |
| **Broker Suspicion** | ⚠️ High (frequent logins) | ✅ None |

---

## Next Steps

After successful local testing:

1. **Document your setup**:
   - Record terminal paths
   - Note which accounts are on which brokers
   - Document any issues encountered

2. **Prepare for VPS deployment**:
   - Review MULTI_TERMINAL_REDESIGN.md
   - Plan which VPS to deploy first (gradual rollout)
   - Prepare agents.json for each VPS

3. **Clean up local test**:
   - You can keep agents.json locally (it's in .gitignore)
   - Or delete it if done testing: `rm vps-agent/agents.json`

---

## Safety Notes

### What's Safe to Keep
- ✅ `vps-agent/agents.json` (in .gitignore)
- ✅ `main-backend/.env` (in .gitignore)
- ✅ `frontend/.env` (in .gitignore)
- ✅ `main-backend/data/phases.json` (in .gitignore)

### What NOT to Commit
- ❌ `vps-agent/agents.json` (contains terminal paths)
- ❌ Any `.env` files (contain configuration)
- ❌ `main-backend/data/phases.json` (contains phase data)

These are already protected by .gitignore ✅

---

## Summary

You've successfully tested:
- ✅ Multi-process VPS agent launcher
- ✅ Multiple agents connecting to different terminals
- ✅ No login/logout activity (brokers won't flag)
- ✅ Process auto-restart on crashes
- ✅ Main backend aggregation from multiple agents
- ✅ Frontend display of all accounts
- ✅ Complete end-to-end data flow

**Ready for VPS deployment!** 🚀

---

**Document created**: 2026-01-10
**Last updated**: 2026-01-10
**Status**: Ready for testing
