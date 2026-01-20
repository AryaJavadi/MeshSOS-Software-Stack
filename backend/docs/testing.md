# MeshSOS Testing Guide

## Testing Strategy

This document outlines the testing approach for the MeshSOS backend software.

## Test Categories

### 1. Unit Tests

**Purpose**: Verify individual components work correctly in isolation.

**Location**: `backend/tests/`

**Run**:
```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

**Coverage**:
- ✓ `test_models.py`: Data model validation, schema constraints
- ✓ `test_routing.py`: Routing algorithms, distance calculations
- ⏳ `test_database.py`: Database operations (to be implemented)
- ⏳ `test_bridge.py`: Frame parsing, validation (to be implemented)

### 2. Integration Tests (Without Hardware)

**Purpose**: Verify end-to-end data flow using simulators.

**Test Scenario**: Simulated nodes → Bridge → Database → API

**Steps**:

```bash
# Terminal 1: Start API
cd backend
source .venv/bin/activate
python -m api.main

# Terminal 2: Run simulator → bridge
python scripts/simulate_scenario.py --nodes 3 --duration 30 --rate 0.5 | python -m bridge.main /dev/stdin

# Terminal 3: Verify data flow
curl http://localhost:8000/messages | jq 'length'  # Should show messages
curl http://localhost:8000/nodes | jq              # Should show 3 nodes
```

**Expected Results**:
- Bridge logs show successful message parsing and persistence
- API returns messages with correct schema
- No validation errors or crashes

### 3. Hardware-in-the-Loop Tests

**Purpose**: Verify integration with real ESP32 LoRa nodes.

**Prerequisites**:
- At least 2 ESP32 nodes with LoRa
- Wireless Tracker connected to Raspberry Pi via USB

**Test Procedure**:

```bash
# 1. Identify serial port
ls /dev/tty.usbserial-* # macOS
ls /dev/ttyUSB*         # Linux/Raspberry Pi

# 2. Start bridge with real hardware
python -m bridge.main /dev/ttyUSB0 115200

# 3. Trigger messages from nodes (via node firmware)

# 4. Verify reception
curl http://localhost:8000/messages | jq
```

**Metrics to Measure**:
- Message delivery success rate (target: ≥ 90%)
- End-to-end latency (target: ≤ 15 s)
- Packet loss across hops
- Range vs. success rate

### 4. Performance and Robustness Tests

**Purpose**: Validate system behavior under sustained load.

**Test: 30-Minute Sustained Load**

```bash
# Generate 1 msg/s for 30 minutes (1800 messages total)
python scripts/simulate_scenario.py --nodes 5 --duration 1800 --rate 1.0 | python -m bridge.main /dev/stdin
```

**Monitor**:
- Bridge uptime (should not crash)
- Memory usage (should stay stable)
- Database size growth
- API response times

**Expected Results**:
- 0 crashes
- All messages persisted
- API response time < 200ms at p95

**Test: High-Urgency Burst**

```bash
# Modify simulator to generate burst of urgent messages
# Verify routing engine prioritizes correctly
curl -X POST http://localhost:8000/routes/generate \
  -H "Content-Type: application/json" \
  -d '{"depot_lat": 43.47, "depot_lon": -80.54, "since_hours": 1}'
```

### 5. Routing Algorithm Validation

**Purpose**: Verify routing engine produces correct and useful route plans.

**Test Cases**:

**Case 1: Distance-focused should minimize travel**
```python
# Create scenario with distant high-priority point
# Distance route should skip it if far
# Priority route should include it
```

**Case 2: Priority-focused serves urgent first**
```python
# Multiple urgency levels spread across map
# Verify priority route visits urgency=3 first
```

**Case 3: All routes visit all demands**
```python
# No demand should be skipped in any route mode
# (in current implementation)
```

**Benchmark on Raspberry Pi**:
```bash
# Measure computation time for realistic scenario
time python -c "
import sys
sys.path.insert(0, 'backend')
from routing.engine import *
from database import get_db, get_active_requests

conn = get_db()
requests = get_active_requests(conn, since_hours=24)
# Convert to DemandPoints and generate routes
# Should complete in < 2 seconds
"
```

## Test Data Generation

### Small Scenario (Quick Test)
```bash
python scripts/simulate_node.py node-001 5 1.0 | python -m bridge.main /dev/stdin
```

### Medium Scenario (Integration Test)
```bash
python scripts/simulate_scenario.py --nodes 5 --duration 60 --rate 1.0
```

### Large Scenario (Stress Test)
```bash
python scripts/simulate_scenario.py --nodes 20 --duration 300 --rate 2.0
```

## Validation Checklist

### Data Model
- [x] Schema validation works
- [x] Payload size constraint enforced (≤ 100 bytes)
- [x] Urgency range validated (1-3)
- [x] Lat/lon bounds validated
- [x] JSON serialization works

### Bridge
- [x] Parses line-delimited JSON
- [x] Handles malformed frames gracefully
- [x] Persists valid messages to DB
- [x] Logs statistics
- [ ] Reconnects on serial disconnect (needs hardware test)
- [ ] Handles EOF on stdin correctly

### API
- [x] All endpoints functional
- [x] CORS configured
- [x] Schema validation on responses
- [ ] WebSocket support (future)
- [ ] Authentication (future)

### Routing
- [x] Three route modes implemented
- [x] Distance calculations correct (Haversine)
- [x] Urgent request counting works
- [ ] Computation time < 2s on Pi (needs benchmark)
- [ ] Route quality meets expectations (needs evaluation)

### Database
- [x] Schema created correctly
- [x] Indexes improve query performance
- [x] Message insertion fast
- [ ] Handles concurrent access (needs test)
- [ ] Database size manageable after long runs

## Known Issues / Future Work

1. **No message deduplication**: Same message can be inserted multiple times
2. **No authentication**: API is wide open
3. **No request "completion" tracking**: Routes are generated but fulfillment not tracked
4. **Limited error recovery**: Some error cases may need better handling
5. **No WebSocket**: Dashboard must poll for updates

## Test Report Template

```markdown
## Test Run: [Date]

**Environment**:
- Hardware: [Raspberry Pi 4 / macOS / Linux]
- Python version: [3.11]
- Test type: [Unit / Integration / Hardware / Performance]

**Procedure**:
[Steps taken]

**Results**:
- Messages sent: [N]
- Messages received: [M]
- Success rate: [M/N]
- Average latency: [Xs]
- Errors: [list any errors]

**Observations**:
[Any issues, unexpected behavior, or notes]

**Conclusion**:
[Pass / Fail / Partial]
```

## Continuous Testing (Future)

For SYDE 462, consider:
- GitHub Actions CI running unit tests on every commit
- Nightly integration tests with simulators
- Weekly hardware-in-the-loop tests
- Performance regression tracking
