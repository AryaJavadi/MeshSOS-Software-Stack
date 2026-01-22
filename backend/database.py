"""
Database layer for MeshSOS Gateway
Handles SQLite initialization, migrations, and data persistence
"""

import sqlite3
from pathlib import Path
from typing import Optional
import logging

from models import MeshMessageModel, SCHEMA_VERSION

logger = logging.getLogger(__name__)

# Default database path
DEFAULT_DB_PATH = Path(__file__).parent / "meshsos.db"


def init_db(db_path: Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """
    Initialize the MeshSOS database with required tables.
    
    Creates:
    - messages: stores all incoming messages from nodes
    - routes: stores generated route plans
    - schema_version: tracks DB schema version
    
    Returns:
        sqlite3.Connection: Database connection with row_factory set
    """
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    
    # Messages table
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
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
        )
        """
    )
    
    # Index for common queries
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp 
        ON messages(timestamp DESC)
        """
    )
    
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_messages_urgency 
        ON messages(urgency DESC, timestamp DESC)
        """
    )
    
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_messages_node 
        ON messages(node_id, timestamp DESC)
        """
    )
    
    # Routes table
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            mode TEXT NOT NULL,
            depot_lat REAL NOT NULL,
            depot_lon REAL NOT NULL,
            stops_json TEXT NOT NULL,
            total_distance_km REAL,
            estimated_time_minutes REAL,
            urgent_requests_served INTEGER,
            metadata_json TEXT
        )
        """
    )
    
    # Schema version tracking
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_version (
            version TEXT PRIMARY KEY,
            applied_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
        """
    )
    
    # Record current schema version
    conn.execute(
        """
        INSERT OR IGNORE INTO schema_version (version) VALUES (?)
        """,
        (SCHEMA_VERSION,)
    )
    
    conn.commit()
    logger.info(f"Database initialized at {db_path} with schema version {SCHEMA_VERSION}")
    
    return conn


def get_db(db_path: Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """
    Get a database connection with row_factory configured.
    
    For use in API routes and services that need a fresh connection.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def insert_message(conn: sqlite3.Connection, msg: MeshMessageModel) -> int:
    """
    Insert a validated message into the database.
    
    Args:
        conn: Database connection
        msg: Validated MeshMessageModel instance
        
    Returns:
        int: ID of the inserted message
    """
    cursor = conn.execute(
        """
        INSERT INTO messages (
            node_id, timestamp, message_type, urgency,
            lat, lon, resource_type, quantity, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            msg.node_id,
            msg.timestamp,
            msg.message_type.value,
            msg.urgency,
            msg.lat,
            msg.lon,
            msg.resource_type,
            msg.quantity,
            msg.payload,
        ),
    )
    conn.commit()
    
    msg_id = cursor.lastrowid
    logger.info(
        f"Inserted message id={msg_id} from node={msg.node_id} "
        f"type={msg.message_type.value} urgency={msg.urgency}"
    )
    
    return msg_id


def get_recent_messages(
    conn: sqlite3.Connection,
    limit: int = 50
) -> list[sqlite3.Row]:
    """Get recent messages ordered by timestamp descending"""
    cursor = conn.execute(
        """
        SELECT id, node_id, timestamp, message_type, urgency,
               lat, lon, resource_type, quantity, payload
        FROM messages
        ORDER BY timestamp DESC
        LIMIT ?
        """,
        (limit,),
    )
    return cursor.fetchall()


def get_urgent_messages(
    conn: sqlite3.Connection,
    min_urgency: int = 2,
    limit: int = 100
) -> list[sqlite3.Row]:
    """Get urgent messages filtered by minimum urgency level"""
    cursor = conn.execute(
        """
        SELECT id, node_id, timestamp, message_type, urgency,
               lat, lon, resource_type, quantity, payload
        FROM messages
        WHERE urgency >= ?
        ORDER BY urgency DESC, timestamp DESC
        LIMIT ?
        """,
        (min_urgency, limit),
    )
    return cursor.fetchall()


def get_node_status(conn: sqlite3.Connection) -> list[dict]:
    """
    Get latest status for each node.
    
    Returns aggregated view showing last message from each node.
    """
    cursor = conn.execute(
        """
        SELECT 
            node_id,
            MAX(timestamp) as last_seen,
            COUNT(*) as message_count
        FROM messages
        GROUP BY node_id
        ORDER BY last_seen DESC
        """
    )
    
    nodes = []
    for row in cursor.fetchall():
        # Get the latest message details for this node
        detail_cursor = conn.execute(
            """
            SELECT message_type, urgency, lat, lon
            FROM messages
            WHERE node_id = ?
            ORDER BY timestamp DESC
            LIMIT 1
            """,
            (row['node_id'],)
        )
        detail = detail_cursor.fetchone()
        
        nodes.append({
            'node_id': row['node_id'],
            'last_seen': row['last_seen'],
            'message_count': row['message_count'],
            'last_message_type': detail['message_type'] if detail else None,
            'last_urgency': detail['urgency'] if detail else None,
            'last_lat': detail['lat'] if detail else None,
            'last_lon': detail['lon'] if detail else None,
        })
    
    return nodes


def get_active_requests(
    conn: sqlite3.Connection,
    since_hours: int = 24
) -> list[dict]:
    """
    Get active supply requests for routing engine.
    
    Filters messages to extract unserved demand points.
    
    Args:
        conn: Database connection
        since_hours: Only consider messages from last N hours
        
    Returns:
        List of demand points with location, resource, urgency
    """
    cutoff = f"-{since_hours} hours"
    cursor = conn.execute(
        """
        SELECT id, node_id, timestamp, message_type, urgency,
               lat, lon, resource_type, quantity
        FROM messages
        WHERE message_type IN ('supply_request', 'sos')
          AND timestamp >= strftime('%s', 'now', ?)
          AND lat IS NOT NULL
          AND lon IS NOT NULL
        ORDER BY urgency DESC, timestamp DESC
        """,
        (cutoff,),
    )
    
    requests = []
    for row in cursor.fetchall():
        requests.append({
            'id': row['id'],
            'node_id': row['node_id'],
            'lat': row['lat'],
            'lon': row['lon'],
            'urgency': row['urgency'],
            'resource_type': row['resource_type'],
            'quantity': row['quantity'] or 1,
            'timestamp': row['timestamp'],
        })
    
    return requests


def insert_route(
    conn: sqlite3.Connection,
    mode: str,
    depot_lat: float,
    depot_lon: float,
    stops: list[dict],
    total_distance_km: float,
    estimated_time_minutes: float,
    urgent_requests_served: int,
    metadata: Optional[dict] = None
) -> int:
    """Insert a generated route plan into the database"""
    import json
    
    cursor = conn.execute(
        """
        INSERT INTO routes (
            mode, depot_lat, depot_lon, stops_json,
            total_distance_km, estimated_time_minutes,
            urgent_requests_served, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            mode,
            depot_lat,
            depot_lon,
            json.dumps(stops),
            total_distance_km,
            estimated_time_minutes,
            urgent_requests_served,
            json.dumps(metadata) if metadata else None,
        ),
    )
    conn.commit()
    
    route_id = cursor.lastrowid
    logger.info(
        f"Inserted route id={route_id} mode={mode} "
        f"stops={len(stops)} distance={total_distance_km:.2f}km"
    )
    
    return route_id


def get_recent_routes(conn: sqlite3.Connection, limit: int = 10) -> list[dict]:
    """Get recently generated route plans"""
    import json
    
    cursor = conn.execute(
        """
        SELECT id, created_at, mode, depot_lat, depot_lon,
               stops_json, total_distance_km, estimated_time_minutes,
               urgent_requests_served, metadata_json
        FROM routes
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    )
    
    routes = []
    for row in cursor.fetchall():
        routes.append({
            'id': row['id'],
            'created_at': row['created_at'],
            'mode': row['mode'],
            'depot_lat': row['depot_lat'],
            'depot_lon': row['depot_lon'],
            'stops': json.loads(row['stops_json']),
            'total_distance_km': row['total_distance_km'],
            'estimated_time_minutes': row['estimated_time_minutes'],
            'urgent_requests_served': row['urgent_requests_served'],
            'metadata': json.loads(row['metadata_json']) if row['metadata_json'] else None,
        })
    
    return routes
