# MT5 Trading Accounts Monitoring System

A comprehensive web application to monitor MT5 trading account balances across multiple VPS servers.

## Architecture

- **VPS Agent** (Python FastAPI) - Runs on each VPS, monitors local MT5 accounts
- **Main Backend** (Python FastAPI) - Aggregates data from all VPS agents
- **Frontend** (React + Vite) - User interface deployed on Vercel

## Project Structure

```
Programar_Dia/
├── vps-agent/          # VPS Agent service (deploy to each VPS)
├── main-backend/       # Main Backend service (deploy to one VPS)
├── frontend/           # React frontend (deploy to Vercel)
└── docs/              # Documentation
```

## Quick Start

### 1. VPS Agent Setup (Repeat for all 7 VPS)

```bash
cd vps-agent
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your MT5 account credentials
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. Main Backend Setup

```bash
cd main-backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with all VPS agent URLs
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with backend URL
npm run dev
```

## Features

✅ Monitor ~21 MT5 accounts across 7 VPS servers
✅ Real-time balance and connection status
✅ Auto-calculated days operating (from first trade)
✅ Editable phase values (F1/VS/WIN/numbers) via UI
✅ Manual refresh functionality
✅ Summary statistics dashboard
✅ Graceful error handling
✅ Responsive design

## Deployment

See detailed deployment instructions in:
- `vps-agent/README.md` - VPS Agent deployment
- `main-backend/README.md` - Main Backend deployment
- `frontend/README.md` - Frontend deployment to Vercel
- `DEPLOYMENT.md` - Complete deployment guide

## Configuration

### VPS Agent (.env)
```env
AGENT_NAME=VPS-1
AGENT_PORT=8000
MT5_ACCOUNTS_JSON=[{"account_number":12345678,"password":"pass","server":"Server1","display_name":"Account Name"}]
```

### Main Backend (.env)
```env
API_PORT=8080
VPS_AGENTS_JSON=[{"name":"VPS-1","url":"http://192.168.1.100:8000"}]
ALLOWED_ORIGINS=["https://your-app.vercel.app"]
```

### Frontend (.env)
```env
VITE_API_BASE_URL=http://YOUR_VPS_IP:8080
```

## API Endpoints

### VPS Agent
- `GET /` - Service info
- `GET /health` - Health check
- `GET /accounts` - Get all accounts on this VPS
- `POST /refresh` - Force MT5 reconnection

### Main Backend
- `GET /api/accounts` - Get all aggregated accounts
- `GET /api/agents/status` - Get VPS agents status
- `PUT /api/accounts/{id}/phase` - Update account phase
- `POST /api/refresh` - Clear cache

## Technology Stack

**Backend:**
- Python 3.10+
- FastAPI
- MetaTrader5 library
- httpx (async HTTP client)

**Frontend:**
- React 18
- Vite 5
- Vanilla CSS

**Deployment:**
- VPS Agents & Main Backend: Systemd services on VPS
- Frontend: Vercel

## Development

### Prerequisites
- Python 3.10+
- Node.js 18+
- MT5 installed on VPS (for agents)

### Running Locally

1. **Start VPS Agent** (simulated):
   ```bash
   cd vps-agent
   uvicorn app.main:app --reload
   ```

2. **Start Main Backend**:
   ```bash
   cd main-backend
   uvicorn app.main:app --port 8080 --reload
   ```

3. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

## Troubleshooting

### VPS Agent not connecting to MT5
- Ensure MT5 is running on the VPS
- Check MT5 credentials in .env file
- Verify MT5 terminal allows API access

### Main Backend can't reach VPS agents
- Check VPS agent URLs in main-backend .env
- Ensure firewall allows port 8000 on VPS
- Verify network connectivity between VPS servers

### Frontend can't connect to backend
- Check VITE_API_BASE_URL in frontend .env
- Verify CORS settings in main-backend (ALLOWED_ORIGINS)
- Check main backend is running and accessible

## Support

For issues or questions:
1. Check the individual README files in each component folder
2. Review the DEPLOYMENT.md guide
3. Check application logs using `journalctl -u [service-name] -f`

## License

Private use only.
