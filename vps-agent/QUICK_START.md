# VPS Deployment Quick Start Guide

## 🚀 Fastest Way to Deploy

### Stage 1: Test on VPS2 (Recommended Start)
```powershell
cd vps-agent
.\deploy-all-vps.ps1 -Target STAGE1
```
This deploys to VPS2 only. Monitor for 24 hours before proceeding.

### Stage 2: Deploy to VPS3-4
```powershell
.\deploy-all-vps.ps1 -Target STAGE2
```
After VPS2 is stable for 24 hours.

### Stage 3: Deploy to VPS5-9
```powershell
.\deploy-all-vps.ps1 -Target STAGE3
```
After VPS3-4 are stable for 24 hours.

---

## 📍 VPS IP Address Mapping

| VPS   | IP Address        | Status |
|-------|-------------------|--------|
| VPS2  | 89.116.26.238     | ✅ Ready |
| VPS3  | 75.119.135.121    | ✅ Ready |
| VPS4  | 178.18.247.182    | ✅ Ready |
| VPS5  | 38.242.245.51     | ⚠️ Need config |
| VPS6  | 158.220.105.27    | ⚠️ Need config |
| VPS7  | 84.247.142.140    | ⚠️ Need config |
| VPS8  | 109.199.97.31     | ⚠️ Need config |
| VPS9  | 109.199.97.222    | ⚠️ Need config |
| VPS10 | **MISSING**       | ❌ Need IP |

**Note:** You provided 8 IP addresses but VPS2-10 requires 9. Please provide the VPS10 IP address.

---

## ⚠️ Before You Start

### Create Missing Config Files (VPS5-9)

VPS5-10 don't have config files yet. Create them with actual account numbers:

```powershell
# Example for VPS5
.\create-vps-config.ps1 -VPSName VPS5 -FundedNextAccount 12345678 -FivePercentAccount 87654321

# Repeat for VPS6-9
.\create-vps-config.ps1 -VPSName VPS6 -FundedNextAccount <NUM> -FivePercentAccount <NUM>
.\create-vps-config.ps1 -VPSName VPS7 -FundedNextAccount <NUM> -FivePercentAccount <NUM>
.\create-vps-config.ps1 -VPSName VPS8 -FundedNextAccount <NUM> -FivePercentAccount <NUM>
.\create-vps-config.ps1 -VPSName VPS9 -FundedNextAccount <NUM> -FivePercentAccount <NUM>
```

### Update VPS10 IP Address

Edit `vps-addresses.json` and replace `"MISSING_IP_ADDRESS"` with the actual IP.

---

## 📋 What Each Script Does

### `deploy-all-vps.ps1` - Batch Deployment (USE THIS)
Deploys to multiple VPS in stages. Handles validation and tracking.

**Usage:**
```powershell
# Dry run to see what would happen
.\deploy-all-vps.ps1 -Target STAGE1 -DryRun

# Actual deployment
.\deploy-all-vps.ps1 -Target STAGE1

# Deploy to specific VPS
.\deploy-all-vps.ps1 -Target VPS2

# Deploy all at once (not recommended)
.\deploy-all-vps.ps1 -Target ALL
```

### `deploy-to-vps.ps1` - Single VPS Deployment
Called by `deploy-all-vps.ps1` automatically. Can also use standalone:

```powershell
.\deploy-to-vps.ps1 -VPSName VPS2 -VPSAddress 89.116.26.238
```

### `create-vps-config.ps1` - Config Generator
Creates `agents-vpsX.json` files for VPS that don't have configs.

```powershell
.\create-vps-config.ps1 -VPSName VPS5 -FundedNextAccount 12345678 -FivePercentAccount 87654321
```

### `vps-addresses.json` - IP Mapping
Contains the mapping of VPS names to IP addresses. Edit this file if IPs change.

---

## 🎯 Recommended Workflow

### Day 1: Preparation
```powershell
# 1. Create configs for VPS5-9 (need actual account numbers)
.\create-vps-config.ps1 -VPSName VPS5 -FundedNextAccount <NUM> -FivePercentAccount <NUM>
# ... repeat for VPS6-9

# 2. Add VPS10 IP to vps-addresses.json (if you have it)

# 3. Dry run to verify everything
.\deploy-all-vps.ps1 -Target STAGE1 -DryRun
```

### Day 1 Afternoon: Deploy VPS2
```powershell
.\deploy-all-vps.ps1 -Target STAGE1
# Follow on-screen instructions
# Monitor for 24 hours
```

### Day 2: Deploy VPS3-4
```powershell
# After VPS2 is stable for 24 hours
.\deploy-all-vps.ps1 -Target STAGE2
# Monitor for 24 hours
```

### Day 3+: Deploy VPS5-9
```powershell
# After VPS3-4 are stable for 24 hours
.\deploy-all-vps.ps1 -Target STAGE3
```

### After All Deployments: Update Backend
Follow the backend update section in `DEPLOYMENT_CHECKLIST.md`

---

## 🔧 Manual Deployment (Alternative)

If you prefer manual control:

```powershell
# Deploy to VPS2
.\deploy-to-vps.ps1 -VPSName VPS2 -VPSAddress 89.116.26.238

# Deploy to VPS3
.\deploy-to-vps.ps1 -VPSName VPS3 -VPSAddress 75.119.135.121

# ... and so on
```

---

## ✅ What You'll Do on Each VPS

When you run the deployment script, it will guide you through:

1. **RDP to the VPS** (using the IP address)
2. **Backup current files** (automatic timestamp)
3. **Stop the launcher** (taskkill)
4. **Copy new files** (via RDP or file transfer)
5. **Install dependencies** (`pip install -r requirements.txt`)
6. **Start the launcher** (`python launcher.py`)
7. **Verify health checks** (appear every 60 seconds)
8. **Test endpoints** (http://localhost:8000/health)
9. **Setup auto-start** (Task Scheduler)

Each VPS takes about **10-15 minutes**.

---

## 🆘 Troubleshooting

### Missing Config Files
```powershell
# Create them
.\create-vps-config.ps1 -VPSName VPS5 -FundedNextAccount <NUM> -FivePercentAccount <NUM>
```

### Wrong IP Address
Edit `vps-addresses.json` and update the IP for that VPS.

### Deployment Failed
- Check the backup folder on the VPS: `vps-agent\backup-YYYYMMDD-HHMMSS\`
- Rollback instructions in `DEPLOYMENT_CHECKLIST.md`
- Try deploying again

### Health Checks Not Appearing
- Wait 60-90 seconds after starting launcher
- Check logs: `python view_logs.py VPSX-FundedNext`
- Verify MT5 terminal paths exist

---

## 📊 Monitoring After Deployment

### Check All VPS Are Responding
On your main backend server:
```powershell
# Watch backend logs for successful fetches
# Should see: "Successfully fetched X account(s) from VPSX-FundedNext"
```

### Check Health Checks on Each VPS
RDP to VPS and run:
```powershell
cd C:\Users\Administrator\Desktop\vps-agent
python view_logs.py VPSX-FundedNext
```

Look for every 60 seconds:
```
INFO: Running periodic health check for VPSX-FundedNext
INFO: Health check passed for [account]
```

### Test Auto-Reconnection
On one VPS:
```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:8000/refresh
```

Watch logs for:
```
INFO: Refreshing MT5 connection
INFO: MT5 shutdown for [account]
INFO: MT5 initialized successfully for [account]
```

---

## 🎯 Success Criteria

After deploying to all VPS:
- ✅ All agents respond to `/health` endpoint
- ✅ Health checks appear every 60 seconds in logs
- ✅ Backend successfully fetches from all agents
- ✅ No manual restarts needed for 24+ hours
- ✅ Auto-reconnection works when tested
- ✅ Frontend shows all accounts without errors

---

## 📞 Need Help?

- **Full deployment guide:** `DEPLOYMENT_CHECKLIST.md`
- **Detailed instructions:** Run `.\deploy-to-vps.ps1` for step-by-step guide
- **Rollback procedure:** See `DEPLOYMENT_CHECKLIST.md` section

---

## ⚡ TL;DR - Just Deploy!

```powershell
# 1. Create configs for VPS5-9 first (need account numbers!)
.\create-vps-config.ps1 -VPSName VPS5 -FundedNextAccount <NUM> -FivePercentAccount <NUM>

# 2. Deploy in stages (recommended)
.\deploy-all-vps.ps1 -Target STAGE1  # VPS2 only
# Wait 24 hours, monitor...

.\deploy-all-vps.ps1 -Target STAGE2  # VPS3-4
# Wait 24 hours, monitor...

.\deploy-all-vps.ps1 -Target STAGE3  # VPS5-9
# Monitor all

# 3. Update backend (see DEPLOYMENT_CHECKLIST.md)
```

**Estimated Total Time:** 2-3 hours for all VPS
**Risk Level:** Low (proven on VPS1, easy rollback)
