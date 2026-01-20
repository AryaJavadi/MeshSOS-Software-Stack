"""
MeshSOS Backend REST API
Exposes messages, nodes, and routing endpoints for dashboard and mobile app
"""

import logging
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
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


if __name__ == "__main__":
    import uvicorn
    
    logger.info("Starting MeshSOS Backend API")
    uvicorn.run(app, host="0.0.0.0", port=8000)
