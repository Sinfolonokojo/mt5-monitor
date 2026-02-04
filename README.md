# MT5 Distributed Monitoring System: Technical Overview

This system is a distributed, high-concurrency monitoring solution designed to aggregate real-time data from MetaTrader 5 terminals across **23 VPS instances** into a centralized web dashboard.

## 🏗️ Architecture

The system follows a **distributed three-tier architecture** to ensure scalability and data isolation.

[Image of a three-tier software architecture diagram showing Frontend, Main Backend, and distributed VPS Agents]

### 1. Frontend (React + Vite)
* **Deployment:** Vercel (Serverless).
* **State Management:** Custom hooks for real-time data polling.
* **UI/UX:** Responsive CSS for mobile/tablet/desktop parity.
* **Features:** Data filtering, sorting by P/L, and administrative toggles for account metadata.

### 2. Main Backend (FastAPI Aggregator)
* **Deployment:** VPS1 (Coordinator Role).
* **Communication:** Parallel asynchronous HTTP requests to all 23 nodes via `httpx`.
* **Persistence:** * `phases.json`: Persistent metadata for account status.
    * `trade_cache.json`: Incremental storage for historical trade data.
* **Integration:** Google Sheets API via Service Account credentials.

### 3. VPS Agents (Local API)
* **Deployment:** Distributed across 23 VPS servers (Port 8000).
* **Role:** Direct interface with the `MetaTrader5` Python library.
* **Logic:** Local MT5 terminal monitoring, account extraction, and health check reporting.

---

## 🛠️ Data Management & Performance

| Component | Strategy |
| :--- | :--- |
| **Concurrency** | Parallel polling of all 23 nodes to minimize dashboard latency. |
| **Caching** | 60-second TTL (Time-To-Live) for account snapshots. |
| **Trade History** | Incremental sync (only pulls new tickets since the last stored timestamp). |
| **Recovery** | Automatic MT5 terminal reconnection logic within the agent service. |

---

## 📁 Repository Structure

```text
Programar_Dia/
├── vps-agent/          # MT5-to-FastAPI service (Deploy on all VPS)
│   └── app/mt5_service.py
├── main-backend/       # Central aggregator (Deploy on VPS1)
│   ├── app/aggregator.py
│   └── app/google_sheets
