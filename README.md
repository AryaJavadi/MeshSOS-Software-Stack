# MeshSOS Software Stack

Infrastructure-independent emergency communication system for the MeshSOS project.

## Overview

| Component | What it is | How to run |
|---|---|---|
| **Backend API** | FastAPI REST + WebSocket server | `python -m api.main` |
| **Gateway Bridge** | Ingests LoRa packets from serial/USB | `python -m bridge.main <port>` |
| **Routing Engine** | Supply route planning | Called by the API |
| **Civilian App** | Expo React Native iOS app | `cd frontend/civilian-app && npm run ios` |
| **Responder Dashboard** | Vite + React web app | `cd frontend/responder-dashboard && npm run dev` |

---

## Running Modes

The system supports three operating modes depending on what hardware and
infrastructure is available.

### Mode 1 — Independent (no backend, no hardware)

Each app runs in isolation using its own hardcoded mock data.
Nothing needs to be running in the background.

```
Civilian App  ──── mock BLE ────▶  local ACKs only
Responder Dashboard  ──────────▶  30 seed requests loaded at startup
```

```bash
# Civilian app — mock mode on by default
cd frontend/civilian-app && npm run ios

# Responder dashboard — mock data on by default
cd frontend/responder-dashboard && npm run dev
```

Use this mode when: doing UI development on either app independently.

---

### Mode 2 — Integrated mock (no hardware required)

The civilian app posts supply requests to the local backend over HTTP.
The backend broadcasts them to the dashboard over WebSocket.
Everything works on a laptop — no LoRa hardware needed.

```
Civilian App  ──── HTTP POST ────▶  Backend API (port 8000)
                                         │
                              WebSocket broadcast (/ws)
                                         │
                                  Responder Dashboard
```

**Step 1 — backend setup (first time only):**

```bash
cd MeshSOS-Software-Stack
python3 -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Step 2 — start all three components:**

```bash
# Terminal 1 — backend (receives requests, broadcasts to dashboard)
source .venv/bin/activate
python -m api.main

# Terminal 2 — responder dashboard (live data from backend WebSocket)
cd frontend/responder-dashboard
VITE_USE_MOCK_DATA=false npm run dev

# Terminal 3 — civilian app (iOS Simulator)
cd frontend/civilian-app
npm run ios

# OR on a physical iPhone — the phone can't reach 'localhost', so pass your
# Mac's local IP (find it with: ipconfig getifaddr en0)
EXPO_PUBLIC_API_URL=http://10.0.0.31:8000 npm run ios
```

Then: fill out a supply request → tap Submit → watch it appear on the dashboard at http://localhost:5173.

> **Physical device note:** `localhost` in the app resolves to the phone, not your Mac.
> Always pass `EXPO_PUBLIC_API_URL=http://<your-mac-ip>:8000` when running on a real iPhone.
> Both the phone and Mac must be on the same Wi-Fi network.

> **Tip:** if the backend is not running when you tap Submit, the civilian app
> still shows its own local ACKs — the request just won't appear on the dashboard.
> The failure is silent and non-blocking.

---

### Mode 3 — Real hardware (full LoRa stack)

Physical ESP32 LoRa nodes + gateway device + Raspberry Pi.

```
ESP32 Node → LoRa → Gateway → USB/UART → Raspberry Pi
                                              │
                                      Gateway Bridge (Python)
                                              │
                                        SQLite Database
                                              │
                                      Backend API (FastAPI)
                                              │
                                 Dashboard / Mobile App (HTTP/WebSocket)
```

```bash
# Terminal 1 — backend API
python -m api.main

# Terminal 2 — gateway bridge (replace /dev/ttyACM0 with your serial port)
python -m bridge.main /dev/ttyACM0

# Terminal 3 — responder dashboard
cd frontend/responder-dashboard
VITE_USE_MOCK_DATA=false npm run dev

# Civilian app — disable mock BLE so it uses real Bluetooth
cd frontend/civilian-app
EXPO_PUBLIC_MOCK_MODE=false npm run ios   # physical device required
```

---

## Mode Quick Reference

| | Mode 1 — Independent | Mode 2 — Integrated mock | Mode 3 — Real hardware |
|---|---|---|---|
| Backend running? | No | **Yes** | **Yes** |
| LoRa hardware? | No | No | **Yes** |
| Civilian app flag | `MOCK_MODE=true` (default) | `MOCK_MODE=true` (default) | `MOCK_MODE=false` |
| Dashboard flag | `VITE_USE_MOCK_DATA=true` (default) | **`VITE_USE_MOCK_DATA=false`** | **`VITE_USE_MOCK_DATA=false`** |
| Requests flow to dashboard? | No | **Yes** | **Yes** |

---

## Backend Setup

```bash
python3 -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Run the Backend

```bash
python -m api.main
# or with auto-reload during development:
uvicorn api.main:app --reload --port 8000
```

- REST docs: http://localhost:8000/docs
- WebSocket: `ws://localhost:8000/ws` (dashboard connects here)

### Simulate traffic (no hardware)

```bash
# Terminal 1 — backend
python -m api.main

# Terminal 2 — simulator piped through bridge
python scripts/simulate_scenario.py --nodes 3 --duration 30 --rate 0.5 | python -m bridge.main /dev/stdin

# Terminal 3 — query the API
curl http://localhost:8000/messages
curl http://localhost:8000/messages/urgent
curl http://localhost:8000/nodes
```

---

## Frontend

### Civilian App (iOS — Expo React Native)

Requires macOS + Xcode. See [frontend/civilian-app/README.md](frontend/civilian-app/README.md) for
prerequisites and device setup.

```bash
cd frontend/civilian-app
npm install
npx pod-install       # first time only
npm run ios           # launches iOS Simulator, mock mode on by default
```

| Flag | Effect |
|---|---|
| _(default)_ | Mock BLE — no hardware needed, ACKs are simulated locally. Requests are also POSTed to the backend if it is running. |
| `EXPO_PUBLIC_MOCK_MODE=false npm run ios` | Real BLE — requires a physical iOS device and a MeshSOS LoRa node within Bluetooth range. |

---

### Responder Dashboard (Web — Vite + React)

No special setup. Runs in any browser.

```bash
cd frontend/responder-dashboard
npm install
npm run dev    # → http://localhost:5173
```

| Flag | Effect |
|---|---|
| _(default)_ | `VITE_USE_MOCK_DATA=true` — loads 30 hardcoded seed requests at startup. No backend needed. |
| `VITE_USE_MOCK_DATA=false npm run dev` | Connects to `ws://localhost:8000/ws`. Receives live requests from the civilian app via the backend. |

---

## Components

### Gateway Bridge (`bridge/main.py`)

- Reads line-delimited JSON from serial port
- Validates messages using Pydantic schema
- Persists to SQLite database
- Resilient: handles disconnects, malformed frames, validation errors
- Supports `/dev/stdin` for testing with simulators

### Backend API (`api/main.py`)

REST endpoints:

- `GET /health` — system health check
- `GET /messages` — list recent messages
- `GET /messages/urgent` — filter urgent messages
- `GET /nodes` — node status aggregation
- `POST /supply-requests` — intake supply request from civilian app; broadcasts to dashboard
- `POST /routes/generate` — generate route plans
- `GET /routes` — list recent routes

WebSocket:

- `WS /ws` — real-time event stream for the responder dashboard

### Routing Engine (`routing/engine.py`)

Three routing modes:

1. **Distance-focused**: Nearest-neighbor heuristic, minimizes total distance
2. **Priority-focused**: Serves highest urgency first, regardless of distance
3. **Blended**: Configurable weighted scoring (urgency vs distance)

Uses Haversine formula for distance calculations.

### Simulators (`scripts/`)

- `simulate_node.py`: Simple single-node message generator
- `simulate_scenario.py`: Multi-node scenario generator with configurable traffic patterns

---

## Database Schema

### `messages` table
- Stores all incoming messages from nodes
- Indexes on timestamp, urgency, node_id for fast queries

### `routes` table
- Stores generated route plans
- JSON fields for stops and metadata

### `schema_version` table
- Tracks database schema version

---

## Deployment (Raspberry Pi)

`systemd` auto-start works after one-time setup (`enable`). You do not need to run setup commands on every reboot.

### 1) One-time setup

```bash
cd /home/syde-capstone/backend

sudo apt-get update
sudo apt-get install -y python3-venv
python3 -m venv /home/syde-capstone/backend/.venv
/home/syde-capstone/backend/.venv/bin/pip install -r /home/syde-capstone/backend/requirements.txt
```

Create env config:

```bash
cat > /home/syde-capstone/backend/meshsos.env << 'EOF'
MESHSOS_BRIDGE_SERIAL_PORT=/dev/ttyACM0
MESHSOS_BRIDGE_BAUDRATE=115200
MESHSOS_API_HOST=0.0.0.0
MESHSOS_API_PORT=8000
EOF
```

Install and enable service files:

```bash
sudo cp /home/syde-capstone/backend/meshsos-bridge.service /etc/systemd/system/
sudo cp /home/syde-capstone/backend/meshsos-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable meshsos-bridge meshsos-api
sudo systemctl restart meshsos-bridge meshsos-api
```

### 2) Verify services

```bash
systemctl is-active meshsos-bridge meshsos-api
curl http://127.0.0.1:8000/health
sudo journalctl -u meshsos-bridge -f
sudo journalctl -u meshsos-api -f
```

---

## Project Structure

```
MeshSOS-Software-Stack/
├── api/                         # FastAPI REST + WebSocket server
├── backend/                     # Python backend modules
│   ├── models.py                # Data models and schema
│   ├── database.py              # Database layer
│   └── bridge/                  # Gateway bridge service
├── routing/                     # Routing engine (distance / priority / blended)
├── scripts/                     # Simulators and helper scripts
├── tests/                       # Unit and integration tests
├── frontend/
│   ├── civilian-app/            # Expo React Native iOS app (civilian-facing)
│   │   ├── app/                 # Expo Router screens
│   │   ├── components/          # UI components
│   │   ├── services/            # BLE service, mock service, message queue
│   │   ├── store/               # Zustand state stores
│   │   ├── config.ts            # MOCK_MODE flag (EXPO_PUBLIC_MOCK_MODE env var)
│   │   └── README.md
│   └── responder-dashboard/     # Vite + React web dashboard (responder-facing)
│       ├── src/
│       │   ├── components/      # MapView, RequestsFeed, RightPanel, etc.
│       │   ├── context/         # DashboardContext + reducer
│       │   ├── hooks/           # useGatewaySocket (WebSocket /ws)
│       │   ├── mocks/           # gatewayMock — seed data for standalone mode
│       │   ├── types/
│       │   └── utils/
│       ├── .env.development     # VITE_GATEWAY_WS_URL, VITE_USE_MOCK_DATA
│       └── package.json
├── docs/
│   └── webapp-design-spec.md    # Colour, typography, and component design tokens
├── requirements.txt
└── README.md
```

---

## Engineering Specifications Validation

### Message Performance
- ✓ Payload size: ≤ 100 bytes (enforced by schema validation)
- ⏳ End-to-end latency: ≤ 15s (to be measured in hardware tests)

### System Integration
- ✓ Gateway bridge handles malformed frames gracefully
- ✓ API exposes all required endpoints
- ✓ Supply requests flow from civilian app to dashboard (WebSocket)
- ✓ Database schema supports message types and routing

### Routing
- ✓ Three route modes implemented
- ⏳ Computation time: < 2s on Raspberry Pi (to be benchmarked)

---

## License

University of Waterloo - SYDE 461/462 Capstone Project
Team #18 - MeshSOS
