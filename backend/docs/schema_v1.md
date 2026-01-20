# MeshSOS Message Schema Documentation

**Schema Version**: v1  
**Last Updated**: December 2, 2025

## Overview

This document defines the canonical message format for the MeshSOS emergency communication system. All messages flowing through the system (from ESP32 nodes → LoRa → Gateway → Database → API → Dashboard) must conform to this schema.

## Message Structure

### Core Fields (Required)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `node_id` | string | 1-32 chars | Unique identifier for the sending node |
| `timestamp` | integer | > 0 | Unix epoch timestamp (seconds) when message was created |
| `message_type` | enum | See below | Type of message being sent |
| `urgency` | integer | 1-3 | Priority level: 1=low, 2=medium, 3=high |

### Optional Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `lat` | float | -90 to 90 | Latitude from GNSS (coarse, rounded) |
| `lon` | float | -180 to 180 | Longitude from GNSS (coarse, rounded) |
| `resource_type` | string | ≤ 32 chars | Type of resource (water, food, medical, etc.) |
| `quantity` | integer | 0-10000 | Quantity or number of items requested |
| `payload` | string | ≤ 100 bytes | Additional free-text message content |

### Message Types

```
sos              - Emergency SOS signal
supply_request   - Request for supplies or resources
status_update    - Node status or situational update
broadcast        - Alert/broadcast from responders to civilians
```

## Example Messages

### SOS Message (Minimal)

```json
{
  "node_id": "node-001",
  "timestamp": 1733184000,
  "message_type": "sos",
  "urgency": 3
}
```

### Supply Request (Full)

```json
{
  "node_id": "node-002",
  "timestamp": 1733184120,
  "message_type": "supply_request",
  "urgency": 2,
  "lat": 43.4723,
  "lon": -80.5449,
  "resource_type": "water",
  "quantity": 50,
  "payload": "Community shelter needs drinking water"
}
```

### Status Update

```json
{
  "node_id": "node-003",
  "timestamp": 1733184240,
  "message_type": "status_update",
  "urgency": 1,
  "lat": 43.4756,
  "lon": -80.5512,
  "payload": "All clear, no immediate needs"
}
```

### Broadcast (from responders)

```json
{
  "node_id": "gateway-001",
  "timestamp": 1733184360,
  "message_type": "broadcast",
  "urgency": 2,
  "payload": "Supply convoy arriving at community center in 30 min"
}
```

## Wire Format

### LoRa Transmission

Messages are transmitted over LoRa as:
1. **Serialized to compact JSON** (newline-terminated)
2. **UTF-8 encoded**
3. **Framed** (implementation-specific)

**Example on wire**:
```
{"node_id":"node-001","timestamp":1733184000,"message_type":"sos","urgency":3}\n
```

**Size Constraints**:
- Maximum payload: **≤ 100 bytes** after UTF-8 encoding
- Typical message size: **60-80 bytes** (with location and resource data)
- Minimal message size: **~50 bytes** (SOS only)

This ensures compatibility with LoRa bandwidth constraints and duty cycle limits.

### Database Storage

Messages are stored in SQLite with additional metadata:

```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    message_type TEXT NOT NULL,
    urgency INTEGER NOT NULL,
    lat REAL,
    lon REAL,
    resource_type TEXT,
    quantity INTEGER,
    payload TEXT,
    received_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

Note: `received_at` is added by the gateway, separate from the node's `timestamp`.

### API Response

API responses include the database `id`:

```json
{
  "id": 42,
  "node_id": "node-002",
  "timestamp": 1733184120,
  "message_type": "supply_request",
  "urgency": 2,
  "lat": 43.4723,
  "lon": -80.5449,
  "resource_type": "water",
  "quantity": 50,
  "payload": "Community shelter needs drinking water"
}
```

## Validation Rules

### Enforced by Pydantic Schema

1. **node_id**: Must be non-empty string, max 32 characters
2. **timestamp**: Must be positive integer (future dates allowed for testing)
3. **message_type**: Must be one of the four defined enum values
4. **urgency**: Must be exactly 1, 2, or 3
5. **lat**: If provided, must be -90 ≤ lat ≤ 90
6. **lon**: If provided, must be -180 ≤ lon ≤ 180
7. **resource_type**: If provided, max 32 characters
8. **quantity**: If provided, must be 0 ≤ quantity ≤ 10,000
9. **payload**: If provided, max 100 bytes (UTF-8 encoded)

### Invalid Messages

Invalid messages are **rejected** by the gateway bridge with logged warnings. They are not persisted to the database.

**Examples of invalid messages**:

```json
// Missing required field
{"node_id": "node-001", "message_type": "sos"}  // Missing urgency

// Invalid urgency
{"node_id": "node-001", "timestamp": 1733184000, "message_type": "sos", "urgency": 5}

// Invalid coordinates
{"node_id": "node-001", "timestamp": 1733184000, "message_type": "sos", "urgency": 2, "lat": 95.0}

// Payload too long
{"node_id": "node-001", "timestamp": 1733184000, "message_type": "sos", "urgency": 2, "payload": "A very long string exceeding 100 bytes when encoded in UTF-8..."}
```

## Schema Evolution

### Version Management

- Current version: **v1**
- Version stored in database: `schema_version` table
- Future versions will be backward-compatible or include migration scripts

### Future Considerations

Potential additions for SYDE 462 or beyond:

- `message_id`: Unique UUID for deduplication
- `hop_count`: Number of LoRa hops taken
- `rssi`: Signal strength at gateway
- `battery_level`: Node battery percentage
- `status_flags`: Bit flags for node state
- `parent_message_id`: For threading/replies

## Implementation

### Python (Pydantic Model)

```python
from pydantic import BaseModel, Field
from enum import Enum

class MessageType(str, Enum):
    SOS = "sos"
    SUPPLY_REQUEST = "supply_request"
    STATUS_UPDATE = "status_update"
    BROADCAST = "broadcast"

class MeshMessageModel(BaseModel):
    node_id: str = Field(..., min_length=1, max_length=32)
    timestamp: int = Field(..., gt=0)
    message_type: MessageType
    urgency: int = Field(..., ge=1, le=3)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)
    resource_type: Optional[str] = Field(None, max_length=32)
    quantity: Optional[int] = Field(None, ge=0, le=10000)
    payload: Optional[str] = Field(None, max_length=100)
```

### Arduino/ESP32 (Example)

```cpp
// Simplified example
struct MeshMessage {
    char node_id[33];
    uint32_t timestamp;
    char message_type[16];  // "sos", "supply_request", etc.
    uint8_t urgency;        // 1-3
    float lat;
    float lon;
    char resource_type[33];
    uint16_t quantity;
    char payload[101];
};

// Serialize to JSON
String serializeMessage(MeshMessage& msg) {
    StaticJsonDocument<256> doc;
    doc["node_id"] = msg.node_id;
    doc["timestamp"] = msg.timestamp;
    doc["message_type"] = msg.message_type;
    doc["urgency"] = msg.urgency;
    if (msg.lat != 0) doc["lat"] = msg.lat;
    if (msg.lon != 0) doc["lon"] = msg.lon;
    if (strlen(msg.resource_type) > 0) doc["resource_type"] = msg.resource_type;
    if (msg.quantity > 0) doc["quantity"] = msg.quantity;
    if (strlen(msg.payload) > 0) doc["payload"] = msg.payload;
    
    String output;
    serializeJson(doc, output);
    return output + "\n";
}
```

## Testing

See `backend/tests/test_models.py` for comprehensive schema validation tests.

## References

- Pydantic documentation: https://docs.pydantic.dev/
- LoRa payload size considerations: Limited by data rate and duty cycle
- Engineering specifications: See project report Section II.a
