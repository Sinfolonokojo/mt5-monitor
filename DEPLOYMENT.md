# Deployment Guide - MT5 Monitoring System

Complete step-by-step deployment guide for all components.

## Prerequisites

- 7 VPS servers with MT5 installed
- SSH access to all VPS servers
- Git installed on local machine
- Vercel account (free tier)
- Python 3.10+ on all VPS
- Node.js 18+ on local machine

## Part 1: VPS Agent Deployment

Deploy the VPS Agent on each of your 7 VPS servers. This needs to be done on ALL 7 VPS.

### Step 1.1: Install Dependencies on VPS

SSH into VPS-1:
```bash
ssh user@vps1-ip
```

Install Python and pip:
```bash
sudo apt update
sudo apt install python3.10 python3-pip -y
```

### Step 1.2: Upload VPS Agent Code

From your local machine:
```bash
cd C:\Users\Admin\Projects\Programar_Dia
scp -r vps-agent/ user@vps1-ip:/home/user/mt5-agent/
```

### Step 1.3: Configure VPS Agent

SSH back into VPS-1:
```bash
cd /home/user/mt5-agent
cp .env.example .env
nano .env
```

Update `.env` with your MT5 account credentials:
```env
AGENT_NAME=VPS-1
AGENT_PORT=8000
LOG_LEVEL=INFO

MT5_ACCOUNTS_JSON=[
  {
    "account_number": 12345678,
    "password": "YourMT5Password1",
    "server": "YourBrokerServer",
    "display_name": "Wilian FN"
  },
  {
    "account_number": 87654321,
    "password": "YourMT5Password2",
    "server": "YourBrokerServer",
    "display_name": "Yojan FN"
  },
  {
    "account_number": 11223344,
    "password": "YourMT5Password3",
    "server": "YourBrokerServer",
    "display_name": "Carlos FN"
  }
]
```

### Step 1.4: Install Python Dependencies

```bash
cd /home/user/mt5-agent
pip3 install -r requirements.txt
```

### Step 1.5: Test VPS Agent

```bash
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

In another terminal, test:
```bash
curl http://localhost:8000/accounts
```

You should see JSON data with your accounts. Press Ctrl+C to stop.

### Step 1.6: Create Systemd Service

Create service file:
```bash
sudo nano /etc/systemd/system/mt5-agent.service
```

Paste this configuration (replace `user` and paths):
```ini
[Unit]
Description=MT5 Agent Service
After=network.target

[Service]
Type=simple
User=user
WorkingDirectory=/home/user/mt5-agent
Environment="PATH=/home/user/.local/bin:/usr/local/bin:/usr/bin"
ExecStart=/usr/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Save and enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mt5-agent
sudo systemctl start mt5-agent
sudo systemctl status mt5-agent
```

### Step 1.7: Configure Firewall

```bash
sudo ufw allow 8000/tcp
sudo ufw status
```

### Step 1.8: Verify Service

```bash
journalctl -u mt5-agent -f
```

Test from local machine:
```bash
curl http://VPS1_IP:8000/accounts
```

### Step 1.9: Repeat for All 7 VPS

**IMPORTANT:** Repeat steps 1.1-1.8 for VPS-2 through VPS-7, changing:
- `AGENT_NAME` to VPS-2, VPS-3, etc.
- MT5 account credentials specific to each VPS

## Part 2: Main Backend Deployment

Deploy on one designated VPS (can be VPS-1 or a separate VPS).

### Step 2.1: Upload Main Backend Code

From local machine:
```bash
scp -r main-backend/ user@main-vps-ip:/home/user/mt5-backend/
```

### Step 2.2: Configure Main Backend

SSH into main VPS:
```bash
cd /home/user/mt5-backend
cp .env.example .env
nano .env
```

Update with all VPS agent URLs:
```env
API_PORT=8080
API_HOST=0.0.0.0
LOG_LEVEL=INFO
AGENT_TIMEOUT=10
CACHE_TTL=60

VPS_AGENTS_JSON=[
  {"name":"VPS-1","url":"http://VPS1_IP:8000"},
  {"name":"VPS-2","url":"http://VPS2_IP:8000"},
  {"name":"VPS-3","url":"http://VPS3_IP:8000"},
  {"name":"VPS-4","url":"http://VPS4_IP:8000"},
  {"name":"VPS-5","url":"http://VPS5_IP:8000"},
  {"name":"VPS-6","url":"http://VPS6_IP:8000"},
  {"name":"VPS-7","url":"http://VPS7_IP:8000"}
]

ALLOWED_ORIGINS=["http://localhost:5173"]
```

**Note:** We'll update ALLOWED_ORIGINS after deploying frontend.

### Step 2.3: Install Dependencies and Create Data Directory

```bash
cd /home/user/mt5-backend
pip3 install -r requirements.txt
mkdir -p data
```

### Step 2.4: Test Main Backend

```bash
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8080
```

Test in another terminal:
```bash
curl http://localhost:8080/api/accounts
```

You should see aggregated data from all VPS agents. Press Ctrl+C to stop.

### Step 2.5: Create Systemd Service

```bash
sudo nano /etc/systemd/system/mt5-backend.service
```

Configuration:
```ini
[Unit]
Description=MT5 Main Backend Service
After=network.target

[Service]
Type=simple
User=user
WorkingDirectory=/home/user/mt5-backend
Environment="PATH=/home/user/.local/bin:/usr/local/bin:/usr/bin"
ExecStart=/usr/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8080
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mt5-backend
sudo systemctl start mt5-backend
sudo systemctl status mt5-backend
```

### Step 2.6: Configure Firewall

```bash
sudo ufw allow 8080/tcp
```

### Step 2.7: Verify

Test from local machine:
```bash
curl http://MAIN_BACKEND_IP:8080/api/accounts
```

## Part 3: Frontend Deployment to Vercel

### Step 3.1: Prepare Frontend

On local machine:
```bash
cd C:\Users\Admin\Projects\Programar_Dia\frontend
```

Copy environment file:
```bash
cp .env.example .env.production
```

Edit `.env.production`:
```env
VITE_API_BASE_URL=http://MAIN_BACKEND_IP:8080
```

### Step 3.2: Initialize Git Repository

```bash
git init
git add .
git commit -m "Initial commit - MT5 Monitor Frontend"
```

### Step 3.3: Create GitHub Repository

Using GitHub CLI:
```bash
gh repo create mt5-monitor-frontend --private
git remote add origin https://github.com/YOUR_USERNAME/mt5-monitor-frontend.git
git push -u origin main
```

Or manually:
1. Go to https://github.com/new
2. Create repository `mt5-monitor-frontend`
3. Follow instructions to push existing repository

### Step 3.4: Deploy to Vercel

**Option A: Vercel Website**

1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variable: `VITE_API_BASE_URL` = `http://MAIN_BACKEND_IP:8080`
5. Click "Deploy"

**Option B: Vercel CLI**

```bash
npm install -g vercel
vercel login
vercel
```

Follow prompts and add environment variable when asked.

### Step 3.5: Update Backend CORS

After Vercel deployment, you'll get a URL like: `https://mt5-monitor-abc123.vercel.app`

SSH into main backend VPS:
```bash
nano /home/user/mt5-backend/.env
```

Update ALLOWED_ORIGINS:
```env
ALLOWED_ORIGINS=["https://mt5-monitor-abc123.vercel.app","http://localhost:5173"]
```

Restart backend:
```bash
sudo systemctl restart mt5-backend
```

## Part 4: Verification & Testing

### Test 1: VPS Agents

For each VPS:
```bash
curl http://VPS_IP:8000/health
```

Should return `{"status":"healthy",...}`

### Test 2: Main Backend

```bash
curl http://MAIN_BACKEND_IP:8080/api/accounts
```

Should return JSON with all accounts from all VPS.

### Test 3: Frontend

1. Open Vercel URL in browser
2. Click "Refresh Data" button
3. Verify all accounts appear in table
4. Check summary cards show correct totals

### Test 4: Phase Editing

1. Click "Edit Phases" button
2. Click on a phase badge to edit
3. Change value and save
4. Refresh page - verify change persists
5. Check `main-backend/data/phases.json` file

### Test 5: Error Handling

Stop one VPS agent:
```bash
sudo systemctl stop mt5-agent
```

Refresh frontend - should still show other accounts.

Restart:
```bash
sudo systemctl start mt5-agent
```

## Monitoring & Logs

### View VPS Agent Logs
```bash
journalctl -u mt5-agent -f
```

### View Main Backend Logs
```bash
journalctl -u mt5-backend -f
```

### View Vercel Logs
Go to Vercel dashboard → Your project → Deployments → Click on deployment → Logs

## Updating the Application

### Update VPS Agent
```bash
scp -r vps-agent/ user@vps-ip:/home/user/mt5-agent/
sudo systemctl restart mt5-agent
```

### Update Main Backend
```bash
scp -r main-backend/ user@main-vps:/home/user/mt5-backend/
sudo systemctl restart mt5-backend
```

### Update Frontend
```bash
git add .
git commit -m "Update frontend"
git push
```

Vercel auto-deploys on push.

## Troubleshooting

### VPS Agent Issues

**Problem:** MT5 connection fails
- Verify MT5 is running
- Check credentials in .env
- Ensure MT5 allows API connections

**Problem:** Service won't start
```bash
journalctl -u mt5-agent -n 50
```

### Main Backend Issues

**Problem:** Can't connect to VPS agents
- Check VPS agent URLs in .env
- Verify firewall allows port 8000
- Test: `curl http://VPS_IP:8000/health`

**Problem:** Phase updates not persisting
- Check `data/` directory permissions
- Verify phases.json is writable

### Frontend Issues

**Problem:** Can't connect to backend
- Verify `VITE_API_BASE_URL` in Vercel environment variables
- Check backend CORS settings
- Test backend: `curl http://BACKEND_IP:8080/api/accounts`

**Problem:** Build fails on Vercel
- Check build logs in Vercel dashboard
- Verify package.json is correct
- Ensure all dependencies are listed

## Security Recommendations

1. **Use VPN or Private Network**
   - Don't expose VPS agents to public internet
   - Use VPN for VPS-to-VPS communication

2. **Secure Credentials**
   - Never commit .env files
   - Use strong MT5 passwords
   - Restrict .env file permissions: `chmod 600 .env`

3. **CORS Configuration**
   - Update ALLOWED_ORIGINS to only include your Vercel URL
   - Remove localhost from production

4. **Firewall**
   - Only allow necessary ports
   - Consider IP whitelisting

## Cost Summary

- **VPS Servers:** Already owned
- **Vercel:** Free tier (sufficient for this app)
- **GitHub:** Free (private repos)
- **Total Additional Cost:** $0/month

## Support

If you encounter issues:
1. Check logs using `journalctl -u [service-name] -f`
2. Verify all services are running: `systemctl status [service-name]`
3. Test connectivity between components
4. Review configuration files for typos

Your MT5 monitoring system is now fully deployed and operational! 🚀
