# VPS Auto-Reconnection Deployment Checklist

## Quick Start

### For VPS2-4 (Config Files Exist)
```powershell
# On dev machine
.\deploy-to-vps.ps1 -VPSName VPS2 -VPSAddress <IP>
```

### For VPS5-10 (Need to Create Configs First)
```powershell
# On dev machine - Create config first
.\create-vps-config.ps1 -VPSName VPS5 -FundedNextAccount 12345678 -FivePercentAccount 87654321

# Then deploy
.\deploy-to-vps.ps1 -VPSName VPS5 -VPSAddress <IP>
```

---

## Pre-Deployment Checklist

### ✅ Phase 1: Dev Machine Cleanup - COMPLETED
- [x] Deleted `launcher_service.py`
- [x] Deleted `WINDOWS_SERVICE_SETUP.md`
- [x] Verified all deployment files exist
- [x] Created deployment helper scripts

### ⏳ Phase 2: Create Missing Configs (VPS5-10)
For each VPS that needs a config:
- [ ] Run `create-vps-config.ps1` with account numbers
- [ ] Verify JSON is valid
- [ ] Review generated config file

---

## Deployment Order (Recommended)

### 🧪 Stage 1: Test Deployment (Day 1)
- [ ] **VPS2** - Deploy and monitor for 24 hours

### 📦 Stage 2: Small Batch (Day 2)
- [ ] **VPS3** - Deploy
- [ ] **VPS4** - Deploy
- [ ] Monitor both for 24 hours

### 🚀 Stage 3: Remaining VPS (Day 3+)
- [ ] **VPS5** - Deploy
- [ ] **VPS6** - Deploy
- [ ] **VPS7** - Deploy
- [ ] **VPS8** - Deploy
- [ ] **VPS9** - Deploy
- [ ] **VPS10** - Deploy

---

## Per-VPS Deployment Checklist

### VPS: __________ | IP: __________ | Date: __________

#### Before Deployment
- [ ] RDP connection established
- [ ] Current launcher is running (verify before stopping)
- [ ] Noted current MT5 connection status

#### Backup (Step 1)
```powershell
cd C:\Users\Administrator\Desktop\vps-agent
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
mkdir "backup-$timestamp"
Copy-Item .\app\*.py ".\backup-$timestamp\"
Copy-Item .\launcher.py ".\backup-$timestamp\"
Copy-Item .\agents.json ".\backup-$timestamp\"
```
- [ ] Backup created successfully
- [ ] Backup location noted: __________

#### Stop Services (Step 2)
```powershell
taskkill /F /IM python.exe
```
- [ ] Launcher stopped
- [ ] All Python processes terminated

#### Copy Files (Step 3)
**Files to copy from dev machine:**
- [ ] `app/main.py`
- [ ] `app/mt5_service.py`
- [ ] `app/models.py`
- [ ] `app/config.py`
- [ ] `app/utils.py`
- [ ] `app/__init__.py`
- [ ] `launcher.py`
- [ ] `view_logs.py`
- [ ] `requirements.txt`
- [ ] `agents-vpsX.json` → rename to `agents.json`

#### Install Dependencies (Step 4)
```powershell
cd C:\Users\Administrator\Desktop\vps-agent
pip install -r requirements.txt
```
- [ ] Dependencies installed successfully
- [ ] No error messages

#### Verify Configuration (Step 5)
```powershell
# Validate JSON
Get-Content agents.json | ConvertFrom-Json

# Check MT5 paths
Test-Path "C:/Program Files/FundedNext MT5 Terminal/terminal64.exe"
Test-Path "C:/Program Files/Five Percent Online MetaTrader 5/terminal64.exe"
```
- [ ] JSON is valid
- [ ] MT5 terminal paths exist
- [ ] Agent count matches expected: __________

#### Start Launcher (Step 6)
```powershell
python launcher.py
```
**Expected output:**
```
🚀 Starting X agent process(es)...
============================================================
  Starting VPSX-FundedNext on port 8000...
    ✅ Started (PID: XXXX)
  Starting VPSX-FivePercent on port 8001...
    ✅ Started (PID: YYYY)
============================================================
```
- [ ] Launcher started successfully
- [ ] All agents started (PIDs noted: __________)
- [ ] No error messages in startup

#### Wait 60-90 Seconds for Health Checks

#### Verify Health Checks (Step 7)
```powershell
# Open another PowerShell window
cd C:\Users\Administrator\Desktop\vps-agent
python view_logs.py VPSX-FundedNext
```
**Look for (every 60 seconds):**
```
INFO: Running periodic health check for VPSX-FundedNext
INFO: Health check passed for [account]
```
- [ ] Health checks appearing every 60 seconds
- [ ] Health checks passing for all accounts
- [ ] No connection errors

#### Test Endpoints (Step 8)
```powershell
Invoke-RestMethod -Uri http://localhost:8000/health
Invoke-RestMethod -Uri http://localhost:8001/health
Invoke-RestMethod -Uri http://localhost:8000/accounts
Invoke-RestMethod -Uri http://localhost:8001/accounts
```
- [ ] /health endpoint responds (port 8000)
- [ ] /health endpoint responds (port 8001)
- [ ] /accounts endpoint returns data (port 8000)
- [ ] /accounts endpoint returns data (port 8001)

#### Setup Auto-Start (Step 9)
```powershell
schtasks /create /tn "MT5Launcher" /tr "python C:\Users\Administrator\Desktop\vps-agent\launcher.py" /sc onstart /ru Administrator /rl HIGHEST /f
```
- [ ] Scheduled task created successfully
- [ ] Task verified in Task Scheduler

#### Post-Deployment Verification
- [ ] Launcher running in foreground window
- [ ] Health checks continue every 60 seconds
- [ ] No error messages in logs
- [ ] Backend can fetch from this VPS (check backend logs)

#### Notes
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## Backend Update Checklist

### On Main Backend Server (After All VPS Deployed)

#### Backup (Step 1)
```powershell
cd C:\Users\Administrator\Desktop\main-backend\app
Copy-Item aggregator.py aggregator.py.backup-$(Get-Date -Format 'yyyyMMdd')
```
- [ ] Backend aggregator.py backed up

#### Update File (Step 2)
- [ ] Copy new `aggregator.py` from dev machine
- [ ] Verify file copied successfully

#### Restart Backend (Step 3)
```powershell
# Stop current backend (Ctrl+C)
cd C:\Users\Administrator\Desktop\main-backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
```
- [ ] Backend restarted successfully
- [ ] No startup errors

#### Verify Auto-Recovery (Step 4)
**Watch logs for auto-recovery messages:**
```
INFO: 🔄 Triggering refresh for VPSX-FundedNext
INFO: ✅ Successfully triggered refresh for VPSX-FundedNext
```
- [ ] Backend fetches from all VPS successfully
- [ ] Total account count matches expected: __________
- [ ] Auto-recovery logic working (if tested)

---

## System-Wide Verification

### After All VPS Deployed

#### Health Check: All Agents Online
- [ ] Backend logs show successful fetches from all VPS
- [ ] Total account count: __________ (expected: 20)
- [ ] No timeout errors in backend logs

#### Health Check: Auto-Reconnection
**Test on one VPS:**
```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:8000/refresh
```
**Watch logs for:**
```
INFO: Refreshing MT5 connection
INFO: MT5 shutdown for [account]
INFO: MT5 initialized successfully for [account]
```
- [ ] Manual refresh test successful
- [ ] MT5 reconnection working

#### Health Check: Backend Auto-Recovery
**Simulate agent failure and verify:**
- [ ] Backend tracks consecutive failures
- [ ] Backend triggers /refresh after 2 failures
- [ ] Backend retries data fetch
- [ ] Auto-recovery messages appear in backend logs

---

## Monitoring Schedule

### Day 1 (Deployment Day)
- [ ] All VPS agents respond to /health
- [ ] Health check logs every 60 seconds
- [ ] Backend fetches from all agents
- [ ] No connection errors in logs

### Day 2-7 (First Week)
- [ ] No manual restarts needed
- [ ] Auto-reconnection logs if MT5 disconnects
- [ ] Backend auto-recovery triggers work
- [ ] All agents remain stable

### Week 2+ (Ongoing)
- [ ] Monitor for recurring disconnections
- [ ] Review health check logs for patterns
- [ ] Verify auto-reconnection success rate

---

## Rollback Procedure

### If Deployment Fails on Any VPS

```powershell
cd C:\Users\Administrator\Desktop\vps-agent

# Stop new launcher
taskkill /F /IM python.exe

# Find backup folder
dir backup-*

# Restore from backup (replace YYYYMMDD-HHMMSS with actual folder)
Copy-Item .\backup-YYYYMMDD-HHMMSS\*.py .\app\ -Force
Copy-Item .\backup-YYYYMMDD-HHMMSS\launcher.py .\ -Force
Copy-Item .\backup-YYYYMMDD-HHMMSS\agents.json .\ -Force

# Start old launcher
python launcher.py
```

- [ ] Old files restored
- [ ] Old launcher started successfully
- [ ] System operational with old code

---

## Files Deployed

### VPS Agent Files (9 files)
1. ✅ `app/main.py` - Health checks + /refresh endpoint
2. ✅ `app/mt5_service.py` - Auto-reconnection logic
3. ✅ `app/models.py` - Data models
4. ✅ `app/config.py` - Configuration
5. ✅ `app/utils.py` - Logging utilities
6. ✅ `app/__init__.py` - Package init
7. ✅ `launcher.py` - Process monitoring
8. ✅ `view_logs.py` - Log viewer
9. ✅ `requirements.txt` - Dependencies

### Configuration Files (Per VPS)
- ✅ VPS1: `agents-vps1.json` (reference only, already deployed)
- ✅ VPS2: `agents-vps2.json` → rename to `agents.json`
- ✅ VPS3: `agents-vps3.json` → rename to `agents.json`
- ✅ VPS4: `agents-vps4.json` → rename to `agents.json`
- ⏳ VPS5-10: Create configs using `create-vps-config.ps1`

### Backend File
- ✅ `main-backend/app/aggregator.py` - Auto-recovery logic

---

## Contact & Support

### Helper Scripts Created
- `deploy-to-vps.ps1` - Deployment helper with validation
- `create-vps-config.ps1` - Config file generator for VPS5-10

### Usage Examples
```powershell
# Create config for VPS5
.\create-vps-config.ps1 -VPSName VPS5 -FundedNextAccount 12345678

# Deploy to VPS2 (dry run first)
.\deploy-to-vps.ps1 -VPSName VPS2 -VPSAddress 192.168.1.100 -DryRun

# Deploy to VPS2 (actual deployment)
.\deploy-to-vps.ps1 -VPSName VPS2 -VPSAddress 192.168.1.100
```

---

## Expected Results

### Before Deployment
- ❌ VPS2-10 constantly disconnecting
- ❌ Manual restarts needed multiple times per day
- ❌ No automatic recovery
- ❌ "No account found" errors in frontend

### After Deployment
- ✅ Auto-reconnection within 60 seconds
- ✅ Proactive health monitoring every 60 seconds
- ✅ Backend auto-recovery after 2 failures
- ✅ Process crash auto-restart
- ✅ No manual intervention needed
- ✅ Stable, continuous operation

---

**Deployment Time Per VPS:** ~10-15 minutes
**Total Deployment Time (VPS2-10):** ~2-3 hours
**Risk Level:** Low (proven on VPS1, easy rollback)
