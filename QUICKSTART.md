# Quick Start Guide - MT5 Monitor

Get your MT5 monitoring system running in 15 minutes!

## Overview

You'll deploy 3 components:
1. **VPS Agent** (on each of 7 VPS) - Reads MT5 data
2. **Main Backend** (on 1 VPS) - Aggregates data
3. **Frontend** (on Vercel) - User interface

## Step 1: Test VPS Agent Locally (5 min)

On VPS-1:
```bash
cd /path/to/upload/vps-agent
pip3 install -r requirements.txt
cp .env.example .env
nano .env
```

Update with ONE MT5 account for testing:
```env
AGENT_NAME=VPS-1
MT5_ACCOUNTS_JSON=[{"account_number":YOUR_ACCOUNT,"password":"YOUR_PASSWORD","server":"YOUR_SERVER","display_name":"Test Account"}]
```

Run:
```bash
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Test (in another terminal):
```bash
curl http://localhost:8000/accounts
```

✅ You should see JSON with your account data!

## Step 2: Test Main Backend (3 min)

On your main VPS:
```bash
cd /path/to/upload/main-backend
pip3 install -r requirements.txt
mkdir -p data
cp .env.example .env
nano .env
```

Update with VPS-1 URL:
```env
VPS_AGENTS_JSON=[{"name":"VPS-1","url":"http://VPS1_IP:8000"}]
```

Run:
```bash
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8080
```

Test:
```bash
curl http://localhost:8080/api/accounts
```

✅ You should see the same account data!

## Step 3: Test Frontend Locally (5 min)

On your local machine:
```bash
cd frontend
npm install
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_BASE_URL=http://MAIN_BACKEND_IP:8080
```

Run:
```bash
npm run dev
```

Open browser: http://localhost:5173

✅ You should see your MT5 account in the table!

## Step 4: Configure Remaining VPS (Variable time)

For VPS-2 through VPS-7:
1. Upload vps-agent folder
2. Update .env with that VPS's MT5 accounts
3. Change AGENT_NAME to VPS-2, VPS-3, etc.
4. Install and run

Update main backend .env to include all 7 VPS URLs.

## Step 5: Make it Permanent

### VPS Agent (on each VPS):
```bash
sudo nano /etc/systemd/system/mt5-agent.service
```

Paste the service config from DEPLOYMENT.md, then:
```bash
sudo systemctl enable mt5-agent
sudo systemctl start mt5-agent
```

### Main Backend:
Same process, use `mt5-backend.service` instead.

### Frontend:
```bash
cd frontend
git init
git add .
git commit -m "Initial commit"
```

Push to GitHub, then deploy on Vercel.

## Next Steps

1. Update main backend CORS with Vercel URL
2. Add all your MT5 accounts to each VPS agent
3. Test phase editing in the UI
4. Set up monitoring

## Troubleshooting

**VPS Agent won't start:**
- Check MT5 is running
- Verify credentials in .env
- Check logs: `journalctl -u mt5-agent -f`

**Backend can't reach agent:**
- Check firewall: `sudo ufw allow 8000`
- Test connectivity: `curl http://VPS_IP:8000/health`

**Frontend errors:**
- Check VITE_API_BASE_URL is correct
- Verify backend CORS includes frontend URL

## Helpful Commands

View logs:
```bash
journalctl -u mt5-agent -f
journalctl -u mt5-backend -f
```

Restart services:
```bash
sudo systemctl restart mt5-agent
sudo systemctl restart mt5-backend
```

Test endpoints:
```bash
curl http://localhost:8000/accounts
curl http://localhost:8080/api/accounts
```

## Done!

Your MT5 monitoring system is now running. You can:
- View all accounts at your Vercel URL
- Click "Refresh Data" to update
- Click "Edit Phases" to modify phase values
- See summary statistics

For detailed deployment instructions, see DEPLOYMENT.md
