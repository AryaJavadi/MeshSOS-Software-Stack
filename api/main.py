"""
MeshSOS Backend REST API
Exposes messages, nodes, routing, and supply-request endpoints for dashboard and mobile app.
Also runs a WebSocket server at /ws so the responder dashboard receives live updates.
"""

import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import MessageOut, NodeStatus, RoutePlan
from database import (
    get_db,
    get_recent_messages,
    get_urgent_messages,
    get_node_status,
    get_active_requests,
    insert_route,
    get_recent_routes,
    DEFAULT_DB_PATH
)
from routing.engine import (
    DemandPoint,
    Location,
    Vehicle,
    generate_all_routes
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="MeshSOS Backend API",
    description="Emergency communication and supply routing system",
    version="1.0.0"
)

# CORS configuration - allow local dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── WebSocket connection manager ──────────────────────────────────────────────

class ConnectionManager:
    """Tracks all live dashboard WebSocket connections and broadcasts to them."""

    def __init__(self):
        self._clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._clients.append(ws)
        logger.info(f"Dashboard connected ({len(self._clients)} total)")

    def disconnect(self, ws: WebSocket):
        self._clients.remove(ws)
        logger.info(f"Dashboard disconnected ({len(self._clients)} remaining)")

    async def broadcast(self, message: dict):
        """Send a JSON message to every connected dashboard client."""
        dead: list[WebSocket] = []
        for ws in self._clients:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            if ws in self._clients:
                self._clients.remove(ws)


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """
    WebSocket endpoint for the responder dashboard.

    The dashboard connects here to receive real-time events:
      REQUEST_RECEIVED   — new supply request arrived from civilian app
      NODE_STATUS_UPDATED — mesh node status change (future)
    """
    await manager.connect(ws)
    try:
        while True:
            # keep the connection alive; dashboard only listens, doesn't send
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


@app.get("/")
def root():
    """API root"""
    return {
        "service": "MeshSOS Backend",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": {
            "messages": "/messages",
            "urgent": "/messages/urgent",
            "nodes": "/nodes",
            "routes": "/routes",
            "health": "/health"
        }
    }


@app.get("/health")
def health_check():
    """
    Health check endpoint.
    
    Returns system status and basic metrics.
    """
    try:
        conn = get_db(DEFAULT_DB_PATH)
        
        # Check database connectivity
        cursor = conn.execute("SELECT COUNT(*) as count FROM messages")
        total_messages = cursor.fetchone()['count']
        
        # Get last message timestamp
        cursor = conn.execute("SELECT MAX(timestamp) as last_ts FROM messages")
        last_timestamp = cursor.fetchone()['last_ts']
        
        conn.close()
        
        return {
            "status": "ok",
            "db_ok": True,
            "total_messages": total_messages,
            "last_message_timestamp": last_timestamp
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "degraded",
            "db_ok": False,
            "error": str(e)
        }


@app.get("/messages", response_model=list[MessageOut])
def list_messages(
    limit: int = Query(50, ge=1, le=500, description="Maximum number of messages to return")
):
    """
    List recent messages ordered by timestamp.
    
    Returns the most recent messages from all nodes.
    """
    try:
        conn = get_db(DEFAULT_DB_PATH)
        rows = get_recent_messages(conn, limit)
        conn.close()
        
        return [MessageOut(**dict(r)) for r in rows]
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/messages/urgent", response_model=list[MessageOut])
def list_urgent_messages(
    min_urgency: int = Query(2, ge=1, le=3, description="Minimum urgency level"),
    limit: int = Query(100, ge=1, le=500)
):
    """
    List urgent messages filtered by urgency level.
    
    Useful for dashboard triage view.
    """
    try:
        conn = get_db(DEFAULT_DB_PATH)
        rows = get_urgent_messages(conn, min_urgency, limit)
        conn.close()
        
        return [MessageOut(**dict(r)) for r in rows]
    except Exception as e:
        logger.error(f"Error fetching urgent messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/nodes", response_model=list[NodeStatus])
def list_nodes():
    """
    Get status of all nodes.
    
    Returns aggregated view showing latest message from each node.
    """
    try:
        conn = get_db(DEFAULT_DB_PATH)
        nodes = get_node_status(conn)
        conn.close()
        
        return [NodeStatus(**n) for n in nodes]
    except Exception as e:
        logger.error(f"Error fetching node status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class RouteGenerationRequest(BaseModel):
    """Request to generate route plans"""
    depot_lat: float
    depot_lon: float
    vehicle_capacity: int = 100
    since_hours: int = 24
    urgency_weight: float = 0.6
    distance_weight: float = 0.4


@app.post("/routes/generate", response_model=list[RoutePlan])
def generate_routes(request: RouteGenerationRequest):
    """
    Generate multiple route plans for current active requests.
    
    Creates three route options:
    - Distance-focused (minimize fuel/distance)
    - Priority-focused (maximize urgent requests served)
    - Blended (configurable weights)
    
    Stores generated routes in database and returns them.
    """
    try:
        conn = get_db(DEFAULT_DB_PATH)
        
        # Get active requests from database
        active_requests = get_active_requests(conn, since_hours=request.since_hours)
        
        if not active_requests:
            return []
        
        # Convert to DemandPoint objects
        demands = [
            DemandPoint(
                id=req['id'],
                node_id=req['node_id'],
                location=Location(req['lat'], req['lon']),
                urgency=req['urgency'],
                resource_type=req['resource_type'],
                quantity=req['quantity'],
                timestamp=req['timestamp']
            )
            for req in active_requests
        ]
        
        # Create vehicle
        vehicle = Vehicle(
            depot=Location(request.depot_lat, request.depot_lon),
            capacity=request.vehicle_capacity
        )
        
        # Generate all route modes
        route_plans = generate_all_routes(
            demands,
            vehicle,
            urgency_weight=request.urgency_weight,
            distance_weight=request.distance_weight
        )
        
        # Store routes in database
        stored_routes = []
        for plan in route_plans:
            route_id = insert_route(
                conn,
                mode=plan['mode'],
                depot_lat=plan['depot_lat'],
                depot_lon=plan['depot_lon'],
                stops=plan['stops'],
                total_distance_km=plan['total_distance_km'],
                estimated_time_minutes=plan['estimated_time_minutes'],
                urgent_requests_served=plan['urgent_requests_served'],
                metadata=plan.get('metadata')
            )
            
            stored_routes.append(RoutePlan(
                id=route_id,
                **plan
            ))
        
        conn.close()
        
        logger.info(f"Generated and stored {len(stored_routes)} route plans")
        
        return stored_routes
    
    except Exception as e:
        logger.error(f"Error generating routes: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/routes", response_model=list[RoutePlan])
def list_routes(
    limit: int = Query(10, ge=1, le=50, description="Maximum number of routes to return")
):
    """
    List recently generated route plans.
    
    Returns the most recent route plans with all details.
    """
    try:
        conn = get_db(DEFAULT_DB_PATH)
        routes = get_recent_routes(conn, limit)
        conn.close()
        
        return [RoutePlan(**r) for r in routes]
    except Exception as e:
        logger.error(f"Error fetching routes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Supply request intake (from civilian app) ─────────────────────────────────

def _translate_supply_request(body: dict) -> dict:
    """
    Translate a SupplyRequest (civilian app shape) into a HouseholdRequest
    (responder dashboard shape).

    Civilian app field  →  Dashboard field
    ─────────────────────────────────────────
    supplyTypes         →  supplies
    people.adults       →  people.infant      (age 0–2)
    people.children     →  people.childAdult  (age 3–59)
    people.elderly      →  people.senior      (age 60+)
    additionalInfo      →  notes
    medicalDetails.*    →  medicalProfiles[]
    latitude/longitude  →  location.lat/lng
    """
    people = body.get("people", {})
    medical_details = body.get("medicalDetails") or {}

    # Build medicalProfiles array from the per-age-tier medical details
    age_tier_map = {
        "adults":   "infant",
        "children": "child_adult",
        "elderly":  "senior",
    }
    condition_map = {
        "mental": "mental_health",  # civilian uses 'mental'; dashboard uses 'mental_health'
    }

    medical_profiles = []
    for civilian_key, dashboard_tier in age_tier_map.items():
        detail = medical_details.get(civilian_key)
        if not detail:
            continue
        condition = detail.get("conditionType") or "other"
        condition = condition_map.get(condition, condition)
        specific_need = (detail.get("specificNeed") or "").strip()
        if not specific_need:
            continue
        count = people.get(civilian_key, 0)
        medical_profiles.append({
            "ageTier":       dashboard_tier,
            "count":         count,
            "conditionType": condition,
            "specificNeed":  specific_need,
        })

    # Supply type normalisation: 'shelter' and 'supplies' don't exist in the
    # dashboard schema — fall back to 'other'.
    dashboard_supply_types = {"water", "food", "medical", "other"}
    supplies = [
        s if s in dashboard_supply_types else "other"
        for s in (body.get("supplyTypes") or [])
    ]

    return {
        "id":             body["id"],
        "householdId":    body["id"],
        "status":         "new",
        "supplies":       supplies,
        "people": {
            "infant":     people.get("adults", 0),
            "childAdult": people.get("children", 0),
            "senior":     people.get("elderly", 0),
        },
        "location": {
            "lat": body["latitude"]  if body.get("latitude")  is not None else 43.4723,
            "lng": body["longitude"] if body.get("longitude") is not None else -80.5449,
        },
        "nodeId":         body.get("connectedNodeId", "MOCK"),
        "notes":          body.get("additionalInfo", ""),
        "medicalProfiles": medical_profiles,
        "triageScore":    0,
        "receivedAt":     datetime.now(timezone.utc).isoformat(),
    }


@app.post("/supply-requests", status_code=202)
async def receive_supply_request(body: dict):
    """
    Intake endpoint for civilian-app supply requests.

    The civilian app posts here after a user submits a supply request form.
    Translates the payload into the HouseholdRequest shape and broadcasts
    REQUEST_RECEIVED to all connected dashboard clients.

    The dashboard always seeds its own mock infrastructure (nodes, vehicles,
    30 background requests) on startup via startMockGateway, so the backend
    only needs to deliver the new request itself.

    Returns 202 Accepted immediately.
    """
    try:
        household_request = _translate_supply_request(body)
        lat = household_request["location"]["lat"]
        lng = household_request["location"]["lng"]

        await manager.broadcast({
            "type":    "REQUEST_RECEIVED",
            "payload": household_request,
        })
        logger.info(
            f"Supply request {household_request['id']} received at "
            f"({lat:.4f}, {lng:.4f}) — broadcast to {len(manager._clients)} client(s)"
        )
        return {"ok": True, "id": household_request["id"]}
    except KeyError as e:
        raise HTTPException(status_code=422, detail=f"Missing required field: {e}")
    except Exception as e:
        logger.error(f"Error processing supply request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── Hardware message broadcast (from gateway bridge) ─────────────────────────────

def _message_to_household_request(msg: dict) -> dict:
    """
    Convert a MeshMessage (from LoRa/bridge) into HouseholdRequest shape
    for the responder dashboard.

    Handles both:
    - Full SupplyRequest JSON in payload (from civilian app via BLE→LoRa)
    - Minimal message fields (from raw LoRa packets)
    """
    payload = (msg.get("payload") or "").strip()

    # If payload looks like a full SupplyRequest, try to translate it
    if payload.startswith("{") and "supplyTypes" in payload:
        try:
            import json
            body = json.loads(payload)
            body["connectedNodeId"] = msg.get("node_id", "unknown")
            if msg.get("latitude") is not None:
                body["latitude"] = msg["latitude"]
            if msg.get("longitude") is not None:
                body["longitude"] = msg["longitude"]
            return _translate_supply_request(body)
        except (json.JSONDecodeError, KeyError):
            pass

    # Build minimal HouseholdRequest from message fields
    node_id = msg.get("node_id", "unknown")
    ts = msg.get("timestamp") or int(datetime.now(timezone.utc).timestamp())
    msg_id = msg.get("id") or f"hw-{node_id}-{ts}"

    lat = msg.get("lat") or msg.get("latitude")
    lon = msg.get("lon") or msg.get("longitude")
    if lat is None:
        lat = 43.4723
    if lon is None:
        lon = -80.5449

    resource = msg.get("resource_type") or "other"
    supplies = [resource] if resource in ("water", "food", "medical", "other") else ["other"]

    return {
        "id": str(msg_id),
        "householdId": str(msg_id),
        "status": "new",
        "supplies": supplies,
        "people": {"infant": 0, "childAdult": 0, "senior": 0},
        "location": {"lat": lat, "lng": lon},
        "nodeId": node_id,
        "notes": payload or f"LoRa message (urgency {msg.get('urgency', 1)})",
        "medicalProfiles": [],
        "triageScore": 0,
        "receivedAt": datetime.now(timezone.utc).isoformat(),
    }


class HardwareMessageRequest(BaseModel):
    """Request body for /internal/hardware-message (from gateway bridge)."""
    id: Optional[int] = None
    node_id: str
    timestamp: int
    message_type: str
    urgency: int
    lat: Optional[float] = None
    lon: Optional[float] = None
    resource_type: Optional[str] = None
    quantity: Optional[int] = None
    payload: Optional[str] = None


@app.post("/internal/hardware-message", status_code=202)
async def receive_hardware_message(body: HardwareMessageRequest):
    """
    Called by the gateway bridge when a new message arrives from LoRa hardware.

    Converts the message to HouseholdRequest format and broadcasts
    REQUEST_RECEIVED to all connected dashboard clients.

    This enables Mode 3: civilian app → BLE → LoRa node → gateway bridge
    → this API → dashboard WebSocket.
    """
    try:
        msg = body.model_dump()
        msg["latitude"] = msg.get("lat")
        msg["longitude"] = msg.get("lon")
        household_request = _message_to_household_request(msg)

        await manager.broadcast({
            "type": "REQUEST_RECEIVED",
            "payload": household_request,
        })
        logger.info(
            f"Hardware message from {body.node_id} broadcast to dashboard "
            f"({len(manager._clients)} client(s))"
        )
        return {"ok": True, "id": household_request["id"]}
    except Exception as e:
        logger.error(f"Error processing hardware message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── Responder → Civilian broadcasts ──────────────────────────────────────────

_broadcasts: list[dict] = []


class BroadcastBody(BaseModel):
    type: str  # "urgent" | "action" | "info"
    text: str


@app.post("/broadcasts", status_code=201)
async def send_broadcast(body: BroadcastBody):
    """Responder dashboard sends a message to all civilians on the mesh."""
    msg = {
        "id": f"bc-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "type": body.type,
        "text": body.text,
        "sentAt": datetime.now(timezone.utc).isoformat(),
    }
    _broadcasts.append(msg)
    logger.info(f"Broadcast sent: [{body.type}] {body.text}")
    return msg


@app.get("/broadcasts")
def list_broadcasts(since: Optional[int] = Query(None, description="Unix ms timestamp — return only broadcasts after this")):
    """Civilian app polls this to receive messages from responders."""
    if since is None:
        return _broadcasts[-50:]
    cutoff = since / 1000
    return [b for b in _broadcasts if _parse_ts(b["sentAt"]) > cutoff]


def _parse_ts(iso: str) -> float:
    return datetime.fromisoformat(iso).timestamp()


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting MeshSOS Backend API")
    uvicorn.run(app, host="0.0.0.0", port=8000)
