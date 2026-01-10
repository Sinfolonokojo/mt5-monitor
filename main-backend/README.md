# MT5 Main Backend

This service aggregates data from all VPS agents and provides a unified API for the frontend.

## Setup

1. **Install Python 3.10+**:
   ```bash
   sudo apt update
   sudo apt install python3.10 python3-pip
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   nano .env
   ```

   Update the `.env` file with:
   - All 7 VPS agent URLs (with IP addresses and ports)
   - Frontend URL for CORS (Vercel URL when deployed)
   - Other settings as needed

4. **Create data directory**:
   ```bash
   mkdir -p data
   ```

5. **Run the service**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8080
   ```

6. **Test the service**:
   ```bash
   curl http://localhost:8080/api/accounts
   ```

## API Endpoints

- `GET /` - Service info
- `GET /api/accounts` - Get all aggregated account data
  - Query param: `force_refresh=true` to bypass cache
- `GET /api/agents/status` - Get status of all VPS agents
- `PUT /api/accounts/{account_number}/phase` - Update phase value
  - Body: `{"phase": "WIN"}`
- `POST /api/refresh` - Clear cache

## Deployment as System Service

Create systemd service file `/etc/systemd/system/mt5-backend.service`:

```ini
[Unit]
Description=MT5 Main Backend Service
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/main-backend
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

View logs:
```bash
journalctl -u mt5-backend -f
```

## Phase Data

Phase values are stored in `data/phases.json` and can be updated via the API.
The file is automatically created on first run if it doesn't exist.
