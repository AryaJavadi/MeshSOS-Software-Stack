# MeshSOS Backend

Infrastructure-independent emergency communication system backend for the MeshSOS project.

## Overview

This backend implements:
- **Gateway Bridge**: Ingests LoRa packets from serial port, validates, and persists to database
- **REST API**: Exposes messages, nodes, and routing endpoints for dashboard and mobile app
- **Routing Engine**: Generates multiple route plans for supply distribution (distance-focused, priority-focused, blended)

## Architecture

```
ESP32 Node → LoRa → Gateway (Wireless Tracker) → USB/UART → Raspberry Pi
                                                              ↓
                                                      Gateway Bridge (Python)
                                                              ↓
                                                        SQLite Database
                                                              ↓
                                                      Backend API (FastAPI)
                                                              ↓
                                            Dashboard / Mobile App (HTTP/WebSocket)
```

## Quick Start

### 1. Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Run Gateway Bridge

**Option A: Meshtastic Bridge (for real ESP32S3 + SX1262 hardware)**

```bash
# Connect ESP32 to Pi via USB, then:
python -m bridge.meshtastic_bridge /dev/ttyACM0
# Or if device is /dev/ttyUSB0:
python -m bridge.meshtastic_bridge /dev/ttyUSB0 --baudrate 115200
```

**Option B: Generic Serial Bridge (for custom firmware or testing)**

```bash
# With real serial port (expects newline-delimited JSON)
python -m bridge.main /dev/ttyUSB0

# With simulator (for testing)
python scripts/simulate_node.py | python -m bridge.main /dev/stdin
```

### 2b. Run Meshtastic Bridge (Real Hardware)

If your ESP32S3 + SX1262 nodes are running **Meshtastic**, the recommended gateway flow is:
- Raspberry Pi connects to a Meshtastic radio via USB/serial
- This service listens for Meshtastic packets and stores them into the same `meshsos.db`

```bash
# Example (device path may be /dev/ttyACM0 or /dev/ttyUSB0)
python -m bridge.meshtastic_bridge /dev/ttyACM0 --baudrate 115200
```

**Payload format recommendation**:
- Send a TEXT message whose payload is JSON matching `MeshMessageModel` (see `models.py`)
- If the payload is not valid JSON, it will be stored as a `broadcast` (or `sos` if it contains "SOS"/"HELP")

### 3. Run Backend API

```bash
python -m api.main
# Or using uvicorn directly:
uvicorn api.main:app --reload --port 8000
```

Visit: http://localhost:8000/docs for interactive API documentation.

### 4. Test with Simulator

```bash
# Terminal 1: Start API
python -m api.main

# Terminal 2: Run simulator → bridge
python scripts/simulate_scenario.py --nodes 3 --duration 30 --rate 0.5 | python -m bridge.main /dev/stdin

# Terminal 3: Query API
curl http://localhost:8000/messages
curl http://localhost:8000/messages/urgent
curl http://localhost:8000/nodes
```

## Components

### Data Model (`models.py`)

Canonical message schema (v1) shared across all components:

```python
{
  "node_id": "node-001",
  "timestamp": 1733184000,
  "message_type": "supply_request",
  "urgency": 3,  # 1=low, 2=medium, 3=high
  "lat": 43.4723,
  "lon": -80.5449,
  "resource_type": "water",
  "quantity": 10,
  "payload": "Optional text message"
}
```

### Gateway Bridge

**`bridge/meshtastic_bridge.py`** (Recommended for Meshtastic hardware)
- Uses Meshtastic Python API - minimal custom code needed
- Connects to ESP32S3 + SX1262 nodes via USB serial
- Automatically decodes Meshtastic packets (text, position, etc.)
- Converts to MeshMessageModel schema and persists to database
- Leverages Meshtastic's node database for GPS/location data

**`bridge/main.py`** (For custom firmware or testing)
- Reads line-delimited JSON from serial port
- Validates messages using Pydantic schema
- Persists to SQLite database
- Resilient: handles disconnects, malformed frames, validation errors
- Supports `/dev/stdin` for testing with simulators

### Backend API (`api/main.py`)

REST endpoints:

- `GET /health` - System health check
- `GET /messages` - List recent messages
- `GET /messages/urgent` - Filter urgent messages
- `GET /nodes` - Node status aggregation
- `POST /routes/generate` - Generate route plans
- `GET /routes` - List recent routes

### Routing Engine (`routing/engine.py`)

Three routing modes:

1. **Distance-focused**: Nearest-neighbor heuristic, minimizes total distance
2. **Priority-focused**: Serves highest urgency first, regardless of distance
3. **Blended**: Configurable weighted scoring (urgency vs distance)

Uses Haversine formula for distance calculations.

### Simulators (`scripts/`)

- `simulate_node.py`: Simple single-node message generator
- `simulate_scenario.py`: Multi-node scenario generator with configurable traffic patterns

## Database Schema

### `messages` table
- Stores all incoming messages from nodes
- Indexes on timestamp, urgency, node_id for fast queries

### `routes` table
- Stores generated route plans
- JSON fields for stops and metadata

### `schema_version` table
- Tracks database schema version

## Testing

### Unit Tests (coming in SYDE 462)

```bash
pytest tests/
```

### Integration Test (Manual)

```bash
# 1. Start API
python -m api.main

# 2. Generate traffic
python scripts/simulate_scenario.py --nodes 5 --duration 60 --rate 1.0 | python -m bridge.main /dev/stdin

# 3. Verify messages stored
curl http://localhost:8000/messages | jq '.[] | {node_id, urgency, resource_type}'

# 4. Generate routes
curl -X POST http://localhost:8000/routes/generate \
  -H "Content-Type: application/json" \
  -d '{
    "depot_lat": 43.47,
    "depot_lon": -80.54,
    "vehicle_capacity": 100,
    "since_hours": 1
  }' | jq

# 5. View generated routes
curl http://localhost:8000/routes | jq
```

## Deployment (Raspberry Pi)

### Setup Script

```bash
#!/bin/bash
# deploy.sh

# Install dependencies
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv

# Create virtual environment
python3 -m venv /opt/meshsos/venv
source /opt/meshsos/venv/bin/activate
pip install -r /opt/meshsos/backend/requirements.txt

# Create systemd services
sudo cp meshsos-bridge.service /etc/systemd/system/
sudo cp meshsos-api.service /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable meshsos-bridge meshsos-api
sudo systemctl start meshsos-bridge meshsos-api
```

### Systemd Service Files (to be created)

See `docs/deployment_pi.md` for detailed deployment instructions.

## Development

### Project Structure

```
backend/
├── models.py              # Data models and schema
├── database.py            # Database layer
├── bridge/
│   ├── __init__.py
│   └── main.py           # Gateway bridge service
├── api/
│   ├── __init__.py
│   └── main.py           # FastAPI application
├── routing/
│   ├── __init__.py
│   └── engine.py         # Routing algorithms
├── scripts/
│   ├── __init__.py
│   ├── simulate_node.py
│   └── simulate_scenario.py
├── tests/                # Unit and integration tests
├── requirements.txt
└── README.md
```

### Code Style

- Follow PEP 8
- Use type hints
- Document functions with docstrings
- Keep functions focused and testable

## Engineering Specifications Validation

### Message Performance
- ✓ Payload size: ≤ 100 bytes (enforced by schema validation)
- ⏳ End-to-end latency: ≤ 15s (to be measured in hardware tests)

### System Integration
- ✓ Gateway bridge handles malformed frames gracefully
- ✓ API exposes all required endpoints
- ✓ Database schema supports message types and routing

### Routing
- ✓ Three route modes implemented
- ⏳ Computation time: < 2s on Raspberry Pi (to be benchmarked)

## Next Steps (SYDE 462)

1. **Hardware Integration**
   - Test with real ESP32 LoRa nodes
   - Measure end-to-end latency
   - Validate range and reliability

2. **Testing & Validation**
   - Unit tests for all components
   - Load testing (sustained 1 msg/s)
   - 24-hour reliability test

3. **Deployment**
   - Systemd service configuration
   - Raspberry Pi deployment scripts
   - Monitoring and logging

4. **Dashboard Integration**
   - WebSocket support for real-time updates
   - Route visualization
   - Network health display

## License

University of Waterloo - SYDE 461/462 Capstone Project
Team #18 - MeshSOS
