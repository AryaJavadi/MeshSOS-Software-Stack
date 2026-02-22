# MeshSOS Dashboard — Developer Guide

This document describes what the MeshSOS dashboard needs to do and how to connect it to the backend API.

---

## Overview

The dashboard is the visual gateway for emergency responders to:
- Monitor incoming messages from the LoRa mesh network
- View node status and locations
- Generate and compare supply distribution routes
- Triage urgent requests (SOS, supply needs)

---

## Connecting to the Backend

### Base URL

| Environment | Base URL |
|-------------|----------|
| **Local development** (API on Mac) | `http://localhost:8000` |
| **Pi gateway** (API on Raspberry Pi) | `http://192.168.2.2:8000` |

Use an environment variable or config so you can switch between them:

```javascript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
// or for Create React App: process.env.REACT_APP_API_URL
```

### CORS

The API allows requests from:
- `http://localhost:3000` (Create React App default)
- `http://localhost:5173` (Vite default)
- `http://127.0.0.1:3000`
- `http://127.0.0.1:5173`

If you use a different port, you’ll need to add it to the CORS config in `backend/api/main.py`.

### Interactive API Docs

Open `{BASE_URL}/docs` for Swagger UI to explore and test all endpoints.

---

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Service info and endpoint list |
| GET | `/health` | Health check, message count, last activity |
| GET | `/messages` | Recent messages (query: `?limit=50`) |
| GET | `/messages/urgent` | Urgent messages (query: `?min_urgency=2&limit=100`) |
| GET | `/nodes` | Node status (latest per node) |
| POST | `/routes/generate` | Generate 3 route plans (distance, priority, blended) |
| GET | `/routes` | Recently generated routes (query: `?limit=10`) |

---

## Data Models

### Message (`/messages`, `/messages/urgent`)

```typescript
interface Message {
  id: number;
  node_id: string;
  timestamp: number;           // Unix seconds
  message_type: 'sos' | 'supply_request' | 'status_update' | 'broadcast';
  urgency: 1 | 2 | 3;         // 1=low, 2=medium, 3=high
  lat?: number;
  lon?: number;
  resource_type?: string;     // e.g. "water", "food", "medical"
  quantity?: number;
  payload?: string;           // Free text, max 100 chars
}
```

### Node Status (`/nodes`)

```typescript
interface NodeStatus {
  node_id: string;
  last_seen: number;          // Unix timestamp
  last_message_type: string;
  last_urgency: number;
  last_lat?: number;
  last_lon?: number;
  message_count: number;
}
```

### Route Plan (`/routes`, `/routes/generate`)

```typescript
interface RouteStop {
  lat: number;
  lon: number;
  node_id: string;
  resource_type?: string;
  quantity?: number;
  urgency: number;
  distance_from_prev_km: number;
}

interface RoutePlan {
  id?: number;
  created_at?: number;
  mode: 'distance' | 'priority' | 'blended';
  depot_lat: number;
  depot_lon: number;
  stops: RouteStop[];
  total_distance_km: number;
  estimated_time_minutes: number;
  urgent_requests_served: number;
  metadata?: Record<string, unknown>;
}
```

### Health (`/health`)

```typescript
interface Health {
  status: 'ok' | 'degraded';
  db_ok: boolean;
  total_messages?: number;
  last_message_timestamp?: number;
  error?: string;
}
```

---

## Dashboard Features to Implement

### 1. Messages View
- List recent messages with filters (e.g. by type, urgency)
- Show node ID, timestamp, type, urgency, payload
- Highlight SOS (urgency 3) and supply requests (urgency 2)
- Optional: sort by timestamp (newest first)
- Optional: link to map location when `lat`/`lon` present

### 2. Nodes View
- List nodes with last seen time, last message type, urgency, message count
- Show location (`last_lat`, `last_lon`) when available
- Optional: simple “active / stale” indicator based on `last_seen`

### 3. Map View
- Plot nodes and message locations on a map (Leaflet, Mapbox, or Google Maps)
- Use `lat`/`lon` from messages and nodes
- Color-code by urgency (e.g. red=3, orange=2, gray=1)
- Optional: cluster markers when zoomed out

### 4. Routing View
- Form to call `POST /routes/generate`:
  - Depot lat/lon (or pick on map)
  - Optional: `vehicle_capacity`, `since_hours`, `urgency_weight`, `distance_weight`
- Display the 3 returned route plans (distance, priority, blended)
- Draw routes on the map (depot → stops → depot)
- Show total distance, estimated time, urgent requests served
- Allow selecting a preferred route for display or export

### 5. System Health
- Periodic `GET /health` (e.g. every 30s)
- Show status, message count, last activity
- Show error message if status is `degraded`

---

## Route Generation Request

To generate routes, send:

```json
POST /routes/generate
Content-Type: application/json

{
  "depot_lat": 43.47,
  "depot_lon": -80.54,
  "vehicle_capacity": 100,
  "since_hours": 24,
  "urgency_weight": 0.6,
  "distance_weight": 0.4
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| depot_lat | number | required | Depot latitude |
| depot_lon | number | required | Depot longitude |
| vehicle_capacity | number | 100 | Vehicle capacity (units) |
| since_hours | number | 24 | Only include requests from last N hours |
| urgency_weight | number | 0.6 | Blended mode: weight for urgency |
| distance_weight | number | 0.4 | Blended mode: weight for distance |

Response: array of 3 `RoutePlan` objects (distance, priority, blended).

---

## Real-Time Updates (Future)

The API currently uses REST only. For live updates, options are:
- Poll `GET /messages` and `GET /nodes` (e.g. every 5–10 seconds)
- Later: add WebSocket support in the backend and subscribe to new messages/nodes

---

## Example Fetch Usage

```javascript
// Get messages
const messages = await fetch(`${API_BASE}/messages?limit=50`).then(r => r.json());

// Get urgent messages (urgency 2+)
const urgent = await fetch(`${API_BASE}/messages/urgent?min_urgency=2`).then(r => r.json());

// Get nodes
const nodes = await fetch(`${API_BASE}/nodes`).then(r => r.json());

// Generate routes
const routes = await fetch(`${API_BASE}/routes/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    depot_lat: 43.47,
    depot_lon: -80.54
  })
}).then(r => r.json());

// Get recent routes
const recentRoutes = await fetch(`${API_BASE}/routes?limit=10`).then(r => r.json());
```

---

## Suggested Tech Stack

- **Framework:** React (Vite or CRA) or Vue — both work with existing CORS config
- **Map:** React-Leaflet, Mapbox GL JS, or Google Maps
- **Styling:** Tailwind, MUI, or plain CSS
- **State:** React Query/SWR for API calls, or local state

---

## Quick Start Checklist

1. [ ] Start backend API (`python -m api.main` or access Pi at `http://192.168.2.2:8000`)
2. [ ] Create app with `npm create vite@latest dashboard -- --template react` (or similar)
3. [ ] Set `VITE_API_URL` to `http://localhost:8000` or `http://192.168.2.2:8000`
4. [ ] Implement messages list (fetch `/messages`)
5. [ ] Implement nodes list (fetch `/nodes`)
6. [ ] Add map and plot nodes/messages with coordinates
7. [ ] Add route generation form and map visualization
8. [ ] Add health indicator (fetch `/health` periodically)
