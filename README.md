# MT5 Trading Accounts Monitoring System

A comprehensive real-time web application to monitor and manage multiple MT5 trading accounts distributed across 23 VPS servers. Features a centralized dashboard with Google Sheets integration, trade history tracking, and advanced filtering capabilities.

## 🌟 Key Features

- ✅ **Real-time monitoring** of multiple MT5 accounts across 23 VPS servers
- ✅ **Centralized dashboard** - view all accounts in one place
- ✅ **Google Sheets integration** - sync account data and trade history
- ✅ **Trade history viewer** - detailed closed trade information with incremental caching
- ✅ **Advanced search & filtering** - by prop firm, account holder, or account number
- ✅ **Multiple sorting options** - by P/L, VS groups, or account holder (A-Z/Z-A)
- ✅ **Phase management** - editable phase values (F1, F2, R, WIN, custom)
- ✅ **VS Group management** - organize accounts into Virtual Stop groups
- ✅ **Mobile responsive** - works on desktop, tablet, and mobile devices
- ✅ **Auto-refresh** - silent background updates every 10 minutes
- ✅ **Export to Excel** - download account data as spreadsheet
- ✅ **Connection status tracking** - real-time connection monitoring
- ✅ **Auto-recovery** - automatic reconnection for failed agents

## 🏗️ Architecture

The system uses a distributed three-tier architecture:

### Components

1. **Frontend (React + Vite)**
   - Deployed on Vercel
   - Responsive UI for desktop and mobile
   - Real-time data visualization

2. **Main Backend (FastAPI)**
   - Hosted on **VPS1** (port 8080)
   - Aggregates data from all 23 VPS agents
   - Manages phases, VS groups, and Google Sheets sync
   - 60-second cache for performance

3. **VPS Agents (FastAPI)**
   - Deployed on all **23 VPS servers** (port 8000)
   - Each monitors local MT5 terminal
   - **VPS1** runs both backend AND agent (dual role)

### Architecture Diagram

```
[Frontend on Vercel]
    ↓
[Main Backend on VPS1:8080]
    ↓ (Parallel requests to all agents)
[23 VPS Agents]
    VPS1 → [Backend + Agent] → MT5 Terminal
    VPS2 → Agent → MT5 Terminal
    VPS3 → Agent → MT5 Terminal
    ... (VPS4 - VPS23)
    ↓
[All data aggregated and displayed]
```

**Note:** VPS1 has a unique dual role - it hosts both the main backend (coordinator) and a VPS agent (monitoring local accounts).

## 📁 Project Structure

```
Programar_Dia/
├── vps-agent/                    # VPS Agent service (deploy to all 23 VPS)
│   ├── app/
│   │   ├── main.py              # FastAPI agent application
│   │   ├── mt5_service.py       # MT5 terminal interface
│   │   └── models.py            # Data models
│   └── requirements.txt
├── main-backend/                 # Main Backend service (deploy to VPS1)
│   ├── app/
│   │   ├── main.py              # FastAPI backend application
│   │   ├── aggregator.py        # Data aggregation from all agents
│   │   ├── phase_manager.py     # Phase data management
│   │   ├── vs_manager.py        # VS group management
│   │   ├── google_sheets_service.py  # Google Sheets integration
│   │   └── trade_cache_manager.py    # Trade history caching
│   ├── data/
│   │   ├── phases.json          # Persistent phase data
│   │   ├── vs_data.json         # Persistent VS group data
│   │   └── trade_cache.json     # Trade history cache
│   ├── GOOGLE_SHEETS_SETUP.md   # Google Sheets setup guide
│   └── requirements.txt
├── frontend/                     # React frontend (deploy to Vercel)
│   ├── src/
│   │   ├── components/
│   │   │   ├── AccountsTable.jsx         # Main table component
│   │   │   ├── AccountDetailsModal.jsx   # Account details view
│   │   │   ├── TradeHistoryModal.jsx     # Trade history viewer
│   │   │   └── MobileAccountCard.jsx     # Mobile card layout
│   │   ├── services/
│   │   │   └── api.js           # API service layer
│   │   └── utils/
│   │       └── formatters.js    # Data formatting utilities
│   └── package.json
├── SISTEMA_EXPLICACION.md        # Comprehensive system documentation (Spanish)
└── README.md                     # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- MetaTrader 5 installed on each VPS
- Google Cloud account (for Sheets integration - optional)

### 1. VPS Agent Setup (Deploy to all 23 VPS)

```bash
cd vps-agent
pip install -r requirements.txt
cp .env.example .env
# Edit .env with MT5 terminal path and account info
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**VPS Agent .env Example:**
```env
AGENT_NAME=VPS-1
AGENT_PORT=8000
MT5_TERMINAL_PATH=C:/Program Files/MetaTrader 5/terminal64.exe
```

### 2. Main Backend Setup (Deploy to VPS1 only)

```bash
cd main-backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with all 23 VPS agent URLs
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

**Main Backend .env Example:**
```env
API_PORT=8080
VPS_AGENTS_JSON=[
  {"name":"VPS-1","url":"http://localhost:8000"},
  {"name":"VPS-2","url":"http://192.168.1.2:8000"},
  {"name":"VPS-3","url":"http://192.168.1.3:8000"}
  # ... (add all 23 VPS agents)
]
ALLOWED_ORIGINS=["https://your-app.vercel.app","http://localhost:5173"]
PHASE_DATA_FILE=data/phases.json

# Google Sheets (Optional)
GOOGLE_SHEETS_CREDENTIALS_FILE=credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SHEETS_WORKSHEET_NAME=MT5 Accounts
```

### 3. Google Sheets Setup (Optional)

Follow the detailed guide in `main-backend/GOOGLE_SHEETS_SETUP.md` to:
1. Create a Google Cloud project
2. Enable Google Sheets API
3. Create service account credentials
4. Share your spreadsheet with the service account
5. Configure credentials in backend

### 4. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with backend URL
npm run dev
```

**Frontend .env Example:**
```env
VITE_API_BASE_URL=http://YOUR_VPS1_IP:8080
```

### 5. Deploy Frontend to Vercel

```bash
cd frontend
npm run build
# Deploy to Vercel (via Vercel CLI or GitHub integration)
```

## 📊 Features in Detail

### 1. Real-Time Account Monitoring

View comprehensive data for all accounts:
- Current balance
- Connection status (connected/disconnected)
- Days operating (calculated from trade history)
- P/L (profit/loss) in dollars and percentage
- Open positions indicator
- Account holder name
- Prop firm (FundedNext, The5ers, FTMO, etc.)
- Phase (F1, F2, R, WIN, custom)
- VS Group (Virtual Stop grouping)

### 2. Phase Management

Organize accounts by trading phase:
- **F1**: Phase 1 evaluation
- **F2**: Phase 2 evaluation
- **R**: Recovery (drawdown)
- **WIN**: Winning/funded account
- **Custom values**: Any text you need

Edit phases directly in the UI with edit mode toggle.

### 3. VS Group Management

Organize accounts into Virtual Stop groups (max 2 accounts per group):
- **Automatic grouping**: Based on balance ranges
- **Manual overrides**: Assign custom VS groups
- **Dual display**: Shows both auto and manual values
- Risk management tool for related accounts

### 4. Trade History Viewer

View detailed closed trade information:
- Symbol, type (BUY/SELL), lot size
- Entry/exit prices and times
- Pips gained/lost
- Commission and net profit
- **Incremental caching**: Only fetches new trades since last sync
- **Initial fetch**: Last 30 days of trades
- Fast performance with persistent cache

### 5. Google Sheets Integration

Sync all data to Google Sheets with one click:
- **Account data sync**: All account information
- **Trade history sync**: Complete trade log
- **Auto-formatting**: Color-coded P/L, styled headers
- **Timestamped**: Last sync time in footer
- **Shareable**: Get spreadsheet URL to share with team

### 6. Search and Filters

Powerful search and filtering:
- **Search**: By prop firm, account holder, or account number
- **Sort by P/L**: Highest/lowest profit
- **Sort by Holder**: A-Z or Z-A (three-state toggle)
- **Sort by VS Groups**: Organize by grouping
- **Filter by trades**: Show only accounts with/without open positions

### 7. Mobile Responsive Design

Optimized for all devices:
- **Desktop**: Full table layout with all columns
- **Mobile**: Card-based layout with touch-friendly UI
- **Tablet**: Responsive breakpoint at 768px
- All features available on mobile

### 8. Auto-Refresh System

Keep data fresh automatically:
- **Manual refresh**: Button to refresh immediately
- **Auto-refresh**: Silent background update every 10 minutes
- **Smart caching**: 60-second cache for fast loading
- **Cache invalidation**: Auto-clears on data updates

### 9. Export Capabilities

Multiple export options:
- **Excel export**: Download current data as .xlsx
- **Google Sheets sync**: Live spreadsheet integration
- **Formatted data**: Properly styled and organized

## 🔧 API Endpoints

### VPS Agent Endpoints

```
GET  /                               Service info
GET  /health                         Health check
GET  /accounts                       Get account data from local MT5
GET  /trade-history?from_date=ISO   Get closed trades
POST /refresh                        Force MT5 reconnection
```

### Main Backend Endpoints

```
GET  /api/accounts                              Get all aggregated accounts
GET  /api/agents/status                         Get all VPS agents status
PUT  /api/accounts/{account_number}/phase       Update account phase
PUT  /api/accounts/{account_number}/vs          Update VS group
GET  /api/accounts/{account_number}/trade-history  Get trade history
POST /api/sync-to-sheets                        Sync to Google Sheets
POST /api/refresh                               Clear cache and refresh
```

## 💾 Data Management

### Persistent Storage

1. **phases.json**: Account phase assignments
2. **vs_data.json**: Manual VS group overrides
3. **trade_cache.json**: Trade history with incremental sync
4. **credentials.json**: Google Sheets API credentials (not in git)

### Caching Strategy

- **Account data**: 60-second TTL in-memory cache
- **Trade history**: Persistent file-based cache with incremental updates
- **Phase/VS data**: Persistent JSON files with thread-safe locks

## 🛠️ Technology Stack

**Backend:**
- Python 3.10+
- FastAPI (async web framework)
- MetaTrader5 library (MT5 integration)
- httpx (async HTTP client)
- gspread (Google Sheets API)
- google-auth (Authentication)

**Frontend:**
- React 18 (UI framework)
- Vite 5 (build tool)
- Vanilla CSS (styling)
- Custom hooks (useAccounts)

**Deployment:**
- **VPS Agents**: Systemd services on 23 VPS servers
- **Main Backend**: Systemd service on VPS1
- **Frontend**: Vercel (serverless)

## 🔐 Security

- **Credentials protection**: credentials.json in .gitignore
- **Environment variables**: Sensitive data in .env files
- **CORS configuration**: Restricted origins in backend
- **API authentication**: Service account for Google Sheets
- **Local settings**: .claude/settings.local.json excluded from git

## 🚨 Troubleshooting

### VPS Agent Issues

**Agent not connecting to MT5:**
- Ensure MT5 terminal is running
- Check MT5_TERMINAL_PATH in .env
- Verify MT5 API access is enabled
- Check firewall allows agent to access MT5

**Agent showing as offline:**
- Check agent service is running: `systemctl status vps-agent`
- Verify network connectivity
- Check agent logs: `journalctl -u vps-agent -f`

### Main Backend Issues

**Can't reach VPS agents:**
- Verify VPS agent URLs in VPS_AGENTS_JSON
- Check firewall allows port 8000 on all VPS
- Test connectivity: `curl http://VPS_IP:8000/health`
- Check backend logs: `journalctl -u main-backend -f`

**Google Sheets sync failing:**
- Verify credentials.json exists and is valid
- Check spreadsheet ID is correct
- Ensure service account has access to spreadsheet
- Review GOOGLE_SHEETS_SETUP.md guide

### Frontend Issues

**Can't connect to backend:**
- Check VITE_API_BASE_URL in .env
- Verify CORS settings in backend (ALLOWED_ORIGINS)
- Check backend is running and accessible
- Test backend: `curl http://BACKEND_IP:8080/api/accounts`

**Data not updating:**
- Check browser console for errors
- Verify backend is receiving requests
- Try manual refresh button
- Clear browser cache

## 📈 Performance Optimization

- **Parallel fetching**: All 23 VPS agents contacted simultaneously
- **Smart caching**: 60-second TTL reduces repeated queries
- **Incremental trade history**: Only fetch new trades since last sync
- **Responsive lazy loading**: Mobile cards load efficiently
- **Background updates**: Auto-refresh doesn't block UI

## 🔄 System Updates

### Updating VPS Agents

```bash
cd vps-agent
git pull
pip install -r requirements.txt --upgrade
sudo systemctl restart vps-agent
```

### Updating Main Backend

```bash
cd main-backend
git pull
pip install -r requirements.txt --upgrade
sudo systemctl restart main-backend
```

### Updating Frontend

```bash
cd frontend
git pull
npm install
npm run build
# Push to Vercel (auto-deploys)
```

## 📚 Documentation

- **SISTEMA_EXPLICACION.md**: Comprehensive system explanation (Spanish, non-technical)
- **main-backend/GOOGLE_SHEETS_SETUP.md**: Google Sheets integration guide
- **Component READMEs**: Detailed docs in each folder

## 🤝 Contributing

This is a private project. For authorized contributors:

1. Work on feature branches (e.g., `feature/new-feature`)
2. Test locally before committing
3. Use descriptive commit messages
4. Create pull requests for review

## 📝 Development Workflow

### Local Development

1. **Start VPS Agent** (simulated):
   ```bash
   cd vps-agent
   uvicorn app.main:app --reload --port 8000
   ```

2. **Start Main Backend**:
   ```bash
   cd main-backend
   uvicorn app.main:app --reload --port 8080
   ```

3. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

### Production Deployment

See individual component README files for detailed deployment instructions.

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review component-specific README files
3. Check SISTEMA_EXPLICACION.md for architecture details
4. Review application logs using journalctl
5. Contact system administrator

## 📄 License

Private use only. All rights reserved.

---

**System Status**: Production
**VPS Count**: 23 servers
**Last Updated**: January 2025
**Architecture**: Distributed monitoring with centralized aggregation
