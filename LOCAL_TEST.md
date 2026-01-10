# Local Testing Setup

**Date**: 2026-01-09
**Purpose**: Testing all three components (VPS Agent, Main Backend, Frontend) locally on Windows before VPS deployment

---

## Environment Differences

| Component | VPS (Production) | Local (Testing) |
|-----------|-----------------|-----------------|
| OS | Linux | Windows 11 |
| Python Version | 3.10/3.11 | 3.14 |
| MetaTrader5 Version | 5.0.45 | 5.0.5488 |
| NumPy Constraint | `numpy<2` | `numpy` (latest 2.x) |
| Backend Port | 8080 | 8081 (due to permission issue) |

---

## Modified Files for Local Testing

### 1. `vps-agent/requirements.txt`
**Changed** (DO NOT COMMIT):
```
fastapi==0.109.0
uvicorn[standard]==0.27.0
MetaTrader5==5.0.5488   # Changed from 5.0.45 for Python 3.14
pydantic==2.5.3
pydantic-settings==2.1.0
python-dotenv==1.0.0
numpy                   # Changed from numpy<2 for Python 3.14
```

**Why**: Python 3.14 requires newer versions with pre-built wheels

### 2. `vps-agent/.env`
**Created** (already in .gitignore):
```env
AGENT_NAME=Local-Test
AGENT_PORT=8000
LOG_LEVEL=INFO

MT5_ACCOUNTS_JSON=[{"account_number":52605897,"password":"K0n&22QJoJjIND","server":"ICMarketsSC-Demo","display_name":"CUENTA_A"},{"account_number":52610558,"password":"Ax!dp@9HAOvkje","server":"ICMarketsSC-Demo","display_name":"CUENTA_B"},{"account_number":52676321,"password":"DPEv6H&ny4UcFD","server":"ICMarketsSC-Demo","display_name":"CUENTA_C"},{"account_number":52676322,"password":"nqZ$sE1Yf@i7$6","server":"ICMarketsSC-Demo","display_name":"CUENTA_D"},{"account_number":52676324,"password":"ki0wheLnX&r$O0","server":"ICMarketsSC-Demo","display_name":"CUENTA_E"},{"account_number":52676326,"password":"PP9!MenAiNi0av","server":"ICMarketsSC-Demo","display_name":"CUENTA_F"},{"account_number":52676329,"password":"!9QCu323xY450X","server":"ICMarketsSC-Demo","display_name":"CUENTA_G"}]
```

**Note**: Using 7 demo accounts from ICMarketsSC-Demo

### 3. `main-backend/.env`
**Created** (already in .gitignore):
```env
API_PORT=8081
API_HOST=127.0.0.1
LOG_LEVEL=INFO
AGENT_TIMEOUT=30
CACHE_TTL=60
VPS_AGENTS_JSON=[{"name":"Local-Test","url":"http://127.0.0.1:8000"}]
ALLOWED_ORIGINS=["http://localhost:5173"]
```

**Note**: Using port 8081 instead of 8080 due to Windows permission error
**Note**: AGENT_TIMEOUT increased to 30s (from 10s) because local MT5 takes longer to connect to 7 demo accounts

### 4. `main-backend/data/phases.json`
**Created** (already in .gitignore):
```json
{}
```

**Note**: Required for phase_manager to work, initially empty

### 5. `frontend/.env`
**Created** (already in .gitignore):
```env
VITE_API_BASE_URL=http://127.0.0.1:8081
```

**Note**: Points to local backend on port 8081

---

## How to Run Locally

### Prerequisites
- Python 3.14 installed
- Node.js 18+ installed
- MT5 terminal running locally (for VPS Agent to connect)

### Step 1: VPS Agent (PowerShell Window 1)

```bash
cd C:\Users\Admin\Projects\Programar_Dia\vps-agent

# Install latest versions (compatible with Python 3.14)
pip install fastapi uvicorn[standard] pydantic pydantic-settings python-dotenv MetaTrader5 numpy

# Start agent
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Test**: http://127.0.0.1:8000/accounts

### Step 2: Main Backend (PowerShell Window 2)

```bash
cd C:\Users\Admin\Projects\Programar_Dia\main-backend

# Install latest versions
pip install fastapi uvicorn pydantic pydantic-settings python-dotenv httpx

# Create data directory and empty phases file
mkdir data
echo {} > data\phases.json

# Start backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8081
```

**Test**: http://127.0.0.1:8081/api/accounts

### Step 3: Frontend (PowerShell Window 3)

```bash
cd C:\Users\Admin\Projects\Programar_Dia\frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

**Open**: http://localhost:5173

---

## Issues Fixed During Local Testing

### Issue 1: NumPy Compilation Error
**Problem**: NumPy 1.26.4 doesn't have pre-built wheels for Python 3.14, tries to compile from source
**Solution**: Use `numpy` (latest 2.x) which has wheels for Python 3.14

### Issue 2: Pydantic Core Compilation Error
**Problem**: pydantic-core 2.14.6 needs Rust compiler for Python 3.14
**Solution**: Use latest pydantic versions which have pre-built wheels

### Issue 3: Port 8080 Permission Denied
**Problem**: Windows error `[WinError 10013]` on port 8080
**Solution**: Use port 8081 instead for local testing

### Issue 4: Phase Manager Hanging
**Problem**: `from app.phase_manager import phase_manager` hangs indefinitely
**Solution**: Create `data/` directory and `phases.json` file first

### Issue 5: Empty phases.json Parse Error
**Problem**: `echo {}` creates file with BOM, causing JSON parse error
**Solution**: Error is non-fatal, phase_manager handles it gracefully

### Issue 6: Backend Timeout Fetching Accounts
**Problem**: `AGENT_TIMEOUT=10` too short for local MT5 connecting to 7 demo accounts
**Error**: `Timeout connecting to Local-Test at http://127.0.0.1:8000`
**Solution**: Increase `AGENT_TIMEOUT=30` in main-backend/.env

---

## Testing Results

✅ **VPS Agent**: Running successfully on port 8000
✅ **Main Backend**: Running successfully on port 8081
✅ **Frontend**: Running successfully on http://localhost:5173

**All 7 demo accounts visible** in VPS Agent response
**Backend successfully aggregates** data from local agent
**Frontend displays all accounts in dashboard with balance and status**

---

## Important Notes

⚠️ **DO NOT COMMIT** these changes to requirements.txt - they will break VPS deployment!

✅ **Safe to commit**: This LOCAL_TEST.md file (for documentation)

✅ **Protected by .gitignore**: All .env files and data/phases.json

**When deploying to VPS**: Use original requirements.txt with MetaTrader5==5.0.45 and numpy<2

---

## Cleanup After Testing

When done testing locally:

```bash
# Revert requirements.txt changes
cd C:\Users\Admin\Projects\Programar_Dia\vps-agent
git checkout requirements.txt

# Check git status
git status
```

Should only show new file: `LOCAL_TEST.md`
