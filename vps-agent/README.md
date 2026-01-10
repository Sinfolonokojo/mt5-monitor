# MT5 VPS Agent

This service runs on each VPS and monitors local MT5 trading accounts.

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
   - Your agent name (e.g., VPS-1, VPS-2)
   - MT5 account credentials (account numbers, passwords, servers)
   - Display names for each account

4. **Run the service**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

5. **Test the service**:
   ```bash
   curl http://localhost:8000/accounts
   ```

## API Endpoints

- `GET /` - Service info
- `GET /health` - Health check
- `GET /accounts` - Get all account data
- `POST /refresh` - Force MT5 reconnection

## Deployment as System Service

Create systemd service file `/etc/systemd/system/mt5-agent.service`:

```ini
[Unit]
Description=MT5 Agent Service
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/mt5-agent
ExecStart=/usr/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mt5-agent
sudo systemctl start mt5-agent
sudo systemctl status mt5-agent
```

View logs:
```bash
journalctl -u mt5-agent -f
```
