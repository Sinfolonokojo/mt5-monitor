# MT5 Monitor - Testing Checklist

**Date**: 2026-01-10
**Architecture**: Multi-Terminal (No Login/Logout)

---

## Pre-Testing Setup

### Local Testing
- [ ] Python 3.10+ installed
- [ ] Node.js 18+ installed
- [ ] All MT5 terminals open and logged in
- [ ] Terminal paths identified
- [ ] vps-agent/agents.json created from example
- [ ] All dependencies installed

### VPS Testing
- [ ] VPS accessible via SSH
- [ ] All MT5 terminals installed and logged in
- [ ] agents.json configured with terminal paths
- [ ] Firewall ports planned (8000, 8001, 8002, etc.)
- [ ] Systemd service file prepared

---

## VPS Agent Testing

### Launcher Startup ✅
- [ ] Launcher starts without errors
- [ ] All configured agents start successfully
- [ ] Each agent shows PID in output
- [ ] No port conflicts
- [ ] Staggered startup (2-second delay between agents)

### Individual Agent Endpoints ✅
- [ ] Port 8000 responds: `curl http://localhost:8000/accounts`
- [ ] Port 8001 responds: `curl http://localhost:8001/accounts`
- [ ] Port 8002 responds: `curl http://localhost:8002/accounts`
- [ ] (Add more if you have >3 agents)
- [ ] Each returns single account object (not array)
- [ ] Account numbers are correct
- [ ] Balances are accurate

### No Login/Logout Verification ✅
- [ ] Check MT5 Journal before test
- [ ] Note last login timestamp
- [ ] Trigger 5-10 data fetches: `curl http://localhost:8000/accounts`
- [ ] Check MT5 Journal again
- [ ] **VERIFY**: No new login entries
- [ ] **VERIFY**: Terminal still logged in
- [ ] **VERIFY**: No "login" in agent logs: `journalctl -u mt5-agents -f | grep -i login`

### Process Monitoring ✅
- [ ] Launcher monitors processes (check output every 5 seconds)
- [ ] Kill one agent manually: `taskkill /PID <PID> /F`
- [ ] Launcher detects crash
- [ ] Launcher restarts agent within 5 seconds
- [ ] Restarted agent works: `curl http://localhost:8000/accounts`

### Graceful Shutdown ✅
- [ ] Press Ctrl+C in launcher
- [ ] All agents terminate gracefully
- [ ] No orphan processes: `netstat -ano | findstr :8000`
- [ ] Launcher exits cleanly

---

## Main Backend Testing

### Startup ✅
- [ ] Backend starts on port 8081 (or configured port)
- [ ] No errors in startup logs
- [ ] data/phases.json exists
- [ ] VPS_AGENTS_JSON configured correctly

### Aggregation ✅
- [ ] `/api/accounts` returns all accounts from all agents
- [ ] Total account count matches number of agents
- [ ] Each account has `vps_source` field
- [ ] Row numbers are sequential (1, 2, 3, ...)
- [ ] Summary stats are correct:
  - [ ] `total_accounts`
  - [ ] `connected_accounts`
  - [ ] `disconnected_accounts`
  - [ ] `total_balance`

### Agent Status ✅
- [ ] `/api/agents/status` returns all agents
- [ ] All agents show "healthy" status
- [ ] Response time is acceptable (<30 seconds)

### Error Handling ✅
- [ ] Stop one agent
- [ ] Backend still returns partial data
- [ ] Error logged but doesn't crash
- [ ] Restart agent → backend includes it again

### Phase Management ✅
- [ ] Update phase: `curl -X PUT http://localhost:8081/api/accounts/12345678/phase -d '{"phase":"WIN"}'`
- [ ] Get accounts → phase updated
- [ ] Check data/phases.json → phase persisted
- [ ] Restart backend → phase still there

### Cache Testing ✅
- [ ] First request takes normal time
- [ ] Second request (within CACHE_TTL) is faster
- [ ] force_refresh=true bypasses cache
- [ ] POST /api/refresh clears cache

---

## Frontend Testing

### Startup ✅
- [ ] Frontend starts on port 5173
- [ ] No build errors
- [ ] VITE_API_BASE_URL configured correctly
- [ ] Opens in browser without errors

### Display ✅
- [ ] All accounts visible in table
- [ ] Account numbers correct
- [ ] Account names match `display_name` from agents.json
- [ ] Balances display correctly (formatted with $ and decimals)
- [ ] Status dots correct (green = connected, red = disconnected)
- [ ] Days operating calculated correctly

### Summary Cards ✅
- [ ] Total accounts count correct
- [ ] Connected accounts count correct
- [ ] Disconnected accounts count correct
- [ ] Total balance sum correct
- [ ] All cards display properly

### Refresh Functionality ✅
- [ ] Click "Refresh Data" button
- [ ] Loading spinner appears
- [ ] Data updates
- [ ] Timestamp updates
- [ ] No errors in browser console

### Phase Editing ✅
- [ ] Click "Edit Phases" button
- [ ] Phase fields become editable
- [ ] Change a phase value
- [ ] Click save/submit
- [ ] Phase updates in UI
- [ ] Refresh page → phase persists
- [ ] Check backend: phase in data/phases.json

### Responsive Design ✅
- [ ] Table displays on desktop
- [ ] Table displays on tablet (if applicable)
- [ ] Columns are readable
- [ ] No horizontal scrolling issues

### Error Handling ✅
- [ ] Stop backend
- [ ] Frontend shows error message
- [ ] Restart backend
- [ ] Click retry → data loads

---

## End-to-End Testing

### Complete Data Flow ✅
1. [ ] Update account balance in MT5 terminal
2. [ ] Click "Refresh Data" in frontend
3. [ ] New balance appears in UI
4. [ ] No login/logout in MT5 Journal

### Multi-User Testing ✅
- [ ] Open 2-3 browser tabs
- [ ] Click refresh in all tabs
- [ ] All tabs update successfully
- [ ] No race conditions or errors

### Long-Running Stability ✅
- [ ] Run system for 30+ minutes
- [ ] No memory leaks
- [ ] No process crashes
- [ ] Data remains accurate

---

## Performance Testing

### Response Times ✅
- [ ] VPS agent response: <2 seconds per account
- [ ] Main backend aggregation: <30 seconds for all agents
- [ ] Frontend load: <1 second
- [ ] Refresh operation: <30 seconds

### Load Testing ✅
- [ ] 10 rapid requests to backend → no errors
- [ ] 5 concurrent browser refreshes → all succeed
- [ ] Agents handle multiple simultaneous requests

---

## Security Testing

### No Credentials Exposed ✅
- [ ] No passwords in agents.json (only terminal paths)
- [ ] No passwords in logs
- [ ] No credentials in frontend responses
- [ ] .env files not in git

### CORS Configuration ✅
- [ ] Frontend can access backend
- [ ] Other origins are blocked (if configured)
- [ ] ALLOWED_ORIGINS set correctly

---

## Deployment Testing (VPS Only)

### Systemd Service ✅
- [ ] Service file created
- [ ] Service enabled: `sudo systemctl enable mt5-agents`
- [ ] Service starts: `sudo systemctl start mt5-agents`
- [ ] Service status healthy: `sudo systemctl status mt5-agents`
- [ ] Logs accessible: `journalctl -u mt5-agents -f`

### Auto-Start on Reboot ✅
- [ ] Reboot VPS
- [ ] Service starts automatically
- [ ] All agents running
- [ ] Data accessible from frontend

### Firewall Configuration ✅
- [ ] Ports opened: `sudo ufw allow 8000/tcp`
- [ ] Agent accessible from other machines (if needed)
- [ ] Backend accessible from frontend

---

## Rollback Testing

### Rollback Procedure ✅
- [ ] Stop new launcher: `sudo systemctl stop mt5-agents`
- [ ] Restore old code: `git checkout app/`
- [ ] Restore old .env: `cp .env.backup .env`
- [ ] Start old agent: `sudo systemctl start mt5-agent`
- [ ] Verify old system works

---

## Documentation Verification

### User Guides ✅
- [ ] MULTI_TERMINAL_REDESIGN.md is complete
- [ ] LOCAL_TESTING_GUIDE.md is accurate
- [ ] Deployment steps are clear
- [ ] Troubleshooting section is helpful

### Code Comments ✅
- [ ] mt5_service.py has clear docstrings
- [ ] launcher.py has explanatory comments
- [ ] Config files have inline comments

---

## Final Checklist Before Production

### Pre-Production ✅
- [ ] All tests passed
- [ ] No login/logout verified on ALL VPS
- [ ] Performance is acceptable
- [ ] Error handling works
- [ ] Auto-restart confirmed
- [ ] Logs are clean (no unexpected errors)

### Production Readiness ✅
- [ ] Systemd services configured on all VPS
- [ ] Firewall rules applied
- [ ] Main backend .env updated with all agent URLs
- [ ] Frontend deployed to Vercel (or updated VITE_API_BASE_URL)
- [ ] Monitoring in place
- [ ] Rollback plan ready

### Post-Deployment Monitoring ✅
- [ ] Check broker account logs after 24 hours
- [ ] No suspicious activity flags
- [ ] All accounts remain logged in
- [ ] No unexpected disconnections
- [ ] System stable for 1 week

---

## Issue Tracking

### Issues Found During Testing

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| _Example: Port 8000 timeout_ | Medium | Fixed | Increased AGENT_TIMEOUT to 30s |
|  |  |  |  |
|  |  |  |  |

### Lessons Learned

1.
2.
3.

---

## Sign-Off

### Local Testing
- **Tester**: _______________
- **Date**: _______________
- **Result**: ☐ Pass ☐ Fail
- **Notes**: _______________

### VPS-1 Testing
- **Tester**: _______________
- **Date**: _______________
- **Result**: ☐ Pass ☐ Fail
- **Notes**: _______________

### Full Deployment
- **Tester**: _______________
- **Date**: _______________
- **Result**: ☐ Pass ☐ Fail
- **Notes**: _______________

---

**Checklist created**: 2026-01-10
**Last updated**: 2026-01-10
