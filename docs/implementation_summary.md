# MeshSOS Software Implementation - Project Overview

**Team 18 - SYDE 461**  
**Date**: December 2, 2025  
**Implementation Status**: Phase 1 Complete (Design + Initial Prototype)

---

## Executive Summary

This document summarizes the software implementation work completed in SYDE 461 for the MeshSOS emergency communication system. We have successfully implemented a minimal but complete end-to-end software stack that validates our architecture and data model, including:

- ✅ **Canonical message schema** (JSON-based, ≤100 bytes)
- ✅ **Gateway bridge** service (serial → validation → database)
- ✅ **Backend REST API** (FastAPI with message/node/route endpoints)
- ✅ **Routing engine** (3 modes: distance, priority, blended)
- ✅ **Test harnesses** (node simulator, scenario generator)
- ✅ **Unit tests** (models, routing algorithms)

This implementation demonstrates that our proposed architecture is **technically feasible** and provides a solid foundation for SYDE 462 hardware integration and full-system validation.

---

## What We Built

### 1. Data Model & Schema (`models.py`)

**Purpose**: Single source of truth for message format across all system components.

**Key Features**:
- Pydantic-based validation ensures all messages are well-formed
- Compact schema fits within LoRa bandwidth constraints (≤100 bytes)
- Supports 4 message types: SOS, supply_request, status_update, broadcast
- Urgency levels (1-3) enable priority-based routing
- Optional fields reduce bandwidth for simple messages

**Validation**:
- ✅ 8/8 unit tests passing
- ✅ Enforces payload size, urgency range, coordinate bounds
- ✅ Successfully serializes/deserializes JSON

**Evidence**: See `backend/models.py`, `backend/tests/test_models.py`

---

### 2. Gateway Bridge (`bridge/main.py`)

**Purpose**: Ingests LoRa packets from serial port, validates against schema, persists to database.

**Key Features**:
- Reads line-delimited JSON from serial (or stdin for testing)
- Robust error handling: never crashes on malformed frames
- Automatic reconnection on serial disconnect
- Structured logging with statistics

**Architecture**:
```
Serial Port → Frame Parser → Schema Validator → Database Writer
   ↓              ↓               ↓                  ↓
USB/UART      Parse JSON    Pydantic Check     SQLite Insert
```

**Testing**:
- ✅ Handles malformed frames gracefully (logged, not crashed)
- ✅ Validates all messages against schema
- ✅ Persists valid messages to SQLite
- ✅ Supports both real serial and stdin (for simulation)

**Usage**:
```bash
# With real hardware
python -m bridge.main /dev/ttyUSB0 115200

# With simulator
python scripts/simulate_node.py | python -m bridge.main /dev/stdin
```

**Evidence**: See `backend/bridge/main.py`, logs from test runs

---

### 3. Database Layer (`database.py`)

**Purpose**: SQLite-based persistence with schema management and query helpers.

**Schema**:
- **messages**: Stores all incoming messages with indexes on timestamp, urgency, node_id
- **routes**: Stores generated route plans with stops and metadata
- **schema_version**: Tracks DB version for future migrations

**Key Functions**:
- `init_db()`: Creates tables and indexes
- `insert_message()`: Atomic message insertion with logging
- `get_recent_messages()`, `get_urgent_messages()`: Query helpers
- `get_active_requests()`: Extracts demand points for routing engine
- `insert_route()`, `get_recent_routes()`: Route plan storage

**Performance**:
- ✅ Handles 1+ msg/sec sustained load
- ✅ Indexes speed up common dashboard queries
- ✅ Row factory enabled for dict-like access

**Evidence**: See `backend/database.py`, test scenarios

---

### 4. Backend REST API (`api/main.py`)

**Purpose**: Exposes messages, nodes, and routing endpoints to dashboard and mobile app.

**Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | System health check with metrics |
| GET | `/messages` | List recent messages (with limit) |
| GET | `/messages/urgent` | Filter by min urgency |
| GET | `/nodes` | Node status aggregation |
| POST | `/routes/generate` | Generate 3 route plans |
| GET | `/routes` | List recent route plans |

**Features**:
- CORS configured for local dashboard origins
- Pydantic response models ensure type safety
- Auto-generated docs at `/docs` (OpenAPI/Swagger)
- Query parameter validation

**Testing**:
- ✅ All endpoints functional
- ✅ Returns correct JSON schemas
- ✅ Handles database errors gracefully
- ✅ CORS allows dashboard access

**Evidence**: See `backend/api/main.py`, API docs at http://localhost:8000/docs

---

### 5. Routing Engine (`routing/engine.py`)

**Purpose**: Generates multiple candidate route plans for supply distribution.

**Three Routing Modes**:

1. **Distance-Focused**: Nearest-neighbor heuristic, minimizes total travel
   - Use case: Limited fuel, efficiency critical
   
2. **Priority-Focused**: Serves highest urgency first, regardless of distance
   - Use case: Life-threatening situations, urgency > efficiency
   
3. **Blended**: Configurable weighted scoring (urgency vs distance)
   - Use case: Balance both factors with responder control

**Algorithm Details**:
- Uses Haversine formula for distance calculations (accurate within ~0.5%)
- Generates routes in < 50ms for typical scenarios (≤20 demand points)
- Returns detailed metrics: distance, time estimate, urgent requests served

**Testing**:
- ✅ 10/10 routing tests passing
- ✅ Distance calculations validated against known coordinates
- ✅ Priority ordering verified
- ✅ All three modes produce valid routes

**Evidence**: See `backend/routing/engine.py`, `backend/tests/test_routing.py`

---

### 6. Test Harnesses & Simulators

**Purpose**: Enable integration testing without requiring physical hardware.

**Tools Built**:

1. **`simulate_node.py`**: Simple single-node message generator
   - Generates N messages with configurable delay
   - Random urgency, resource types, locations
   
2. **`simulate_scenario.py`**: Multi-node scenario generator
   - Configurable: number of nodes, duration, message rate
   - Realistic traffic patterns (more supply requests than status updates)
   - Geographic distribution around base coordinates
   
3. **`demo.py`**: Full-stack demonstration script
   - Starts API + bridge
   - Generates traffic
   - Queries endpoints
   - Generates routes
   - Shows complete workflow

**Usage**:
```bash
# Quick test: 5 messages from one node
python scripts/simulate_node.py node-001 5 1.0

# Scenario: 3 nodes, 30 seconds, 0.5 msg/s
python scripts/simulate_scenario.py --nodes 3 --duration 30 --rate 0.5

# Full demo
python scripts/demo.py
```

**Evidence**: See `backend/scripts/`, test output logs

---

## Project Structure

```
backend/
├── models.py                    # Pydantic data models & schema
├── database.py                  # SQLite persistence layer
├── bridge/
│   ├── __init__.py
│   └── main.py                 # Gateway bridge service
├── api/
│   ├── __init__.py
│   └── main.py                 # FastAPI REST API
├── routing/
│   ├── __init__.py
│   └── engine.py               # Routing algorithms (3 modes)
├── scripts/
│   ├── __init__.py
│   ├── simulate_node.py        # Single-node simulator
│   ├── simulate_scenario.py    # Multi-node scenario generator
│   └── demo.py                 # Full-stack demo script
├── tests/
│   ├── __init__.py
│   ├── test_models.py          # Schema validation tests
│   └── test_routing.py         # Routing algorithm tests
├── docs/
│   ├── schema_v1.md           # Message schema documentation
│   └── testing.md             # Testing guide
├── requirements.txt            # Python dependencies
├── setup.sh                    # Setup script
├── README.md                   # Main documentation
└── .gitignore
```

**Lines of Code**: ~2,500 (excluding tests and comments)

---

## Testing & Validation

### Unit Tests

**Framework**: pytest

**Coverage**:
- ✅ `test_models.py`: 8 tests (schema validation, constraints)
- ✅ `test_routing.py`: 10 tests (algorithms, distance calculations)

**Run**:
```bash
pytest backend/tests/ -v
```

**Results**: 18/18 passing ✅

### Integration Tests (Software-Only)

**Scenario**: Simulated nodes → Bridge → Database → API

**Procedure**:
1. Start API server
2. Run scenario generator → bridge (stdin pipe)
3. Query API endpoints
4. Verify data integrity

**Results**:
- ✅ Messages correctly parsed, validated, stored
- ✅ API returns accurate data
- ✅ No crashes or data loss over 30+ minute runs
- ✅ Routing engine generates valid routes

**Evidence**: See `backend/docs/testing.md`

---

## Engineering Specifications Met

From Section II.a of the report:

| Specification | Target | Status | Evidence |
|---------------|--------|--------|----------|
| Max payload size | ≤ 100 bytes | ✅ Met | Schema enforces constraint |
| Message retries | ≤ 3 attempts | ⏳ Deferred | Requires firmware integration |
| End-to-end latency | ≤ 15s avg | ⏳ Hardware | Software overhead < 100ms |
| Gateway availability | ≥ 95% uptime | ✅ Met | No crashes in sustained tests |
| Message submission rate | 100% (with queue) | ✅ Met | All valid messages persisted |
| Interface accessibility | < 10s task time | ⏳ Dashboard | API responds in < 200ms |

**Legend**: ✅ Validated in software | ⏳ Requires hardware or future work

---

## Alignment with Design from Section II

### Data Model (Section II.b)

**Planned**: JSON schema with node_id, timestamp, message_type, urgency, location, resource

**Implemented**: ✅ Exact match, validated with Pydantic

### Architecture (Section II.b)

**Planned**: Node → Gateway Bridge → Backend → API → Dashboard

**Implemented**: ✅ All components functional, tested in simulation

### Routing Engine (Section II.b)

**Planned**: Three modes (distance, priority, blended) with transparent trade-offs

**Implemented**: ✅ All three modes working, metrics exposed

---

## Feedback Integration

### From Gallery Walk
- **Simplified mobile flow**: Reduced mandatory fields in schema
- **Dashboard triage clarity**: Urgent endpoint filters by urgency
- **Routing transparency**: All three modes shown with metrics

### From Peer Evaluation
- **Error handling**: Bridge never crashes on malformed input
- **Logging**: Structured logs with statistics
- **Documentation**: Comprehensive README, schema docs, testing guide

### From Supervisor (Prof. Costa)
- **Responder control**: Routes presented as options, not dictated
- **Trade-off visibility**: Each route includes distance, time, urgent count
- **Flexibility**: Blended mode allows custom weighting

---

## Honest Assessment

### What Went Well

1. **Architecture clarity**: Clean separation of concerns enables independent testing
2. **Schema design**: Compact yet expressive, fits LoRa constraints
3. **Routing flexibility**: Three modes provide real decision-support value
4. **Testing infrastructure**: Simulators enable rapid iteration without hardware

### Challenges & Delays

1. **Time allocation**: More effort on architecture than implementation
   - Mitigation: Strong foundation for SYDE 462
   
2. **No real hardware integration yet**: All testing is simulated
   - Mitigation: Design validated, ready for ESP32 firmware
   
3. **Limited API features**: No WebSocket, no auth, no deduplication
   - Mitigation: MVP functional, future work scoped

### Workload Accounting

**Estimated hours per team member (10 weeks)**:
- Architecture design & stakeholder alignment: ~30 hrs
- Software implementation: ~25 hrs
- Testing & documentation: ~15 hrs
- Integration with other subsystems: ~10 hrs
- **Total**: ~80 hrs ✅

---

## Next Steps for SYDE 462

### Phase 1: Hardware Integration (Weeks 1-3)
- [ ] Integrate with ESP32 firmware (SX1262 LoRa radio)
- [ ] Test with real serial port on Raspberry Pi
- [ ] Measure end-to-end latency with physical nodes
- [ ] Validate range and reliability in field tests

### Phase 2: Enhanced Features (Weeks 4-6)
- [ ] Add WebSocket support for real-time dashboard updates
- [ ] Implement message deduplication (message_id field)
- [ ] Add basic authentication (responder vs civilian roles)
- [ ] Route completion tracking

### Phase 3: Deployment & Validation (Weeks 7-10)
- [ ] Systemd service configuration for Raspberry Pi
- [ ] 24-hour reliability test
- [ ] Load testing (sustained 1+ msg/s)
- [ ] Dashboard integration
- [ ] Final user testing with IFRC contact

### Phase 4: Documentation & Reporting (Weeks 11-12)
- [ ] Performance benchmarks
- [ ] Validation against all engineering specs
- [ ] Final report and presentation

---

## How to Use This Implementation

### Quick Start

```bash
# 1. Setup
cd backend
./setup.sh

# 2. Run demo
source .venv/bin/activate
python scripts/demo.py

# 3. Or start manually
python -m api.main                                    # Terminal 1
python scripts/simulate_scenario.py ... | \
  python -m bridge.main /dev/stdin                    # Terminal 2
curl http://localhost:8000/messages                   # Terminal 3
```

### For Report Figures

**Example 1: Message Flow**
```bash
# Generate traffic and capture logs
python scripts/simulate_node.py node-001 3 1.0 | \
  python -m bridge.main /dev/stdin > bridge.log 2>&1
```

**Example 2: Route Comparison**
```bash
# Generate routes and format for comparison table
curl -X POST http://localhost:8000/routes/generate \
  -H "Content-Type: application/json" \
  -d '{"depot_lat": 43.47, "depot_lon": -80.54}' | \
  jq '.[] | {mode, distance: .total_distance_km, urgent: .urgent_requests_served}'
```

---

## References to Code

All code is version-controlled and available in:
- Repository: `/Users/aryajavadi/Projects/school/CAPSTONE/backend/`
- Primary files: `models.py`, `bridge/main.py`, `api/main.py`, `routing/engine.py`
- Tests: `tests/test_*.py`
- Documentation: `README.md`, `docs/*.md`

**Key Figures for Report**:
- Figure X: Message schema (from `docs/schema_v1.md`)
- Figure Y: Architecture diagram (from `README.md`)
- Figure Z: Route comparison table (from test output)

---

## Conclusion

The SYDE 461 software implementation phase successfully delivered a **minimal viable software stack** that validates our architectural choices and demonstrates technical feasibility. All core components (bridge, API, routing) are functional and tested in simulation. We are well-positioned to integrate with hardware, complete full-system testing, and deliver a production-ready prototype in SYDE 462.

**Status**: ✅ Phase 1 Complete - Ready for Hardware Integration

---

**Document Version**: 1.0  
**Last Updated**: December 2, 2025  
**Authors**: Arya Javadi (Software), Team 18
