"""
Routing Engine for MeshSOS
Generates multiple candidate route plans for supply distribution

Implements three routing modes:
1. Distance-focused: Minimize total travel distance/fuel
2. Priority-focused: Maximize high-urgency requests served
3. Blended: Configurable weighted combination
"""

import math
import logging
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class Location:
    """Geographic location"""
    lat: float
    lon: float
    
    def distance_to(self, other: 'Location') -> float:
        """
        Calculate approximate distance using Haversine formula.
        
        Returns distance in kilometers.
        """
        R = 6371.0  # Earth radius in km
        
        lat1 = math.radians(self.lat)
        lat2 = math.radians(other.lat)
        dlat = math.radians(other.lat - self.lat)
        dlon = math.radians(other.lon - self.lon)
        
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c


@dataclass
class DemandPoint:
    """Demand point representing a supply request"""
    id: int
    node_id: str
    location: Location
    urgency: int  # 1-3
    resource_type: Optional[str]
    quantity: int
    timestamp: int


@dataclass
class Vehicle:
    """Vehicle for route planning"""
    depot: Location
    capacity: int = 100  # Generic capacity units


def distance_focused_route(
    demands: list[DemandPoint],
    vehicle: Vehicle
) -> dict:
    """
    Generate distance-minimizing route using nearest-neighbor heuristic.
    
    Greedy algorithm: always visit closest unvisited demand point next.
    
    Args:
        demands: List of demand points to serve
        vehicle: Vehicle configuration
        
    Returns:
        Route plan dict with stops, distance, and metrics
    """
    if not demands:
        return {
            'mode': 'distance',
            'stops': [],
            'total_distance_km': 0.0,
            'estimated_time_minutes': 0.0,
            'urgent_requests_served': 0,
            'metadata': {'algorithm': 'nearest_neighbor'}
        }
    
    current_location = vehicle.depot
    remaining = demands.copy()
    route = []
    total_distance = 0.0
    urgent_count = 0
    
    while remaining:
        # Find nearest demand point
        nearest = min(remaining, key=lambda d: current_location.distance_to(d.location))
        
        distance = current_location.distance_to(nearest.location)
        total_distance += distance
        
        route.append({
            'lat': nearest.location.lat,
            'lon': nearest.location.lon,
            'node_id': nearest.node_id,
            'resource_type': nearest.resource_type,
            'quantity': nearest.quantity,
            'urgency': nearest.urgency,
            'distance_from_prev_km': round(distance, 2)
        })
        
        if nearest.urgency >= 2:
            urgent_count += 1
        
        current_location = nearest.location
        remaining.remove(nearest)
    
    # Return to depot
    return_distance = current_location.distance_to(vehicle.depot)
    total_distance += return_distance
    
    # Estimate time: assume 40 km/h avg speed + 10 min per stop
    estimated_time = (total_distance / 40.0) * 60.0 + len(route) * 10.0
    
    return {
        'mode': 'distance',
        'depot_lat': vehicle.depot.lat,
        'depot_lon': vehicle.depot.lon,
        'stops': route,
        'total_distance_km': round(total_distance, 2),
        'estimated_time_minutes': round(estimated_time, 1),
        'urgent_requests_served': urgent_count,
        'metadata': {
            'algorithm': 'nearest_neighbor',
            'return_to_depot_km': round(return_distance, 2)
        }
    }


def priority_focused_route(
    demands: list[DemandPoint],
    vehicle: Vehicle
) -> dict:
    """
    Generate priority-maximizing route.
    
    Always serves highest urgency requests first, even at cost of distance.
    
    Args:
        demands: List of demand points to serve
        vehicle: Vehicle configuration
        
    Returns:
        Route plan dict with stops, distance, and metrics
    """
    if not demands:
        return {
            'mode': 'priority',
            'stops': [],
            'total_distance_km': 0.0,
            'estimated_time_minutes': 0.0,
            'urgent_requests_served': 0,
            'metadata': {'algorithm': 'urgency_first'}
        }
    
    # Sort by urgency (descending), then by timestamp (older first)
    sorted_demands = sorted(
        demands,
        key=lambda d: (-d.urgency, d.timestamp)
    )
    
    current_location = vehicle.depot
    route = []
    total_distance = 0.0
    urgent_count = 0
    
    for demand in sorted_demands:
        distance = current_location.distance_to(demand.location)
        total_distance += distance
        
        route.append({
            'lat': demand.location.lat,
            'lon': demand.location.lon,
            'node_id': demand.node_id,
            'resource_type': demand.resource_type,
            'quantity': demand.quantity,
            'urgency': demand.urgency,
            'distance_from_prev_km': round(distance, 2)
        })
        
        if demand.urgency >= 2:
            urgent_count += 1
        
        current_location = demand.location
    
    # Return to depot
    return_distance = current_location.distance_to(vehicle.depot)
    total_distance += return_distance
    
    # Estimate time
    estimated_time = (total_distance / 40.0) * 60.0 + len(route) * 10.0
    
    return {
        'mode': 'priority',
        'depot_lat': vehicle.depot.lat,
        'depot_lon': vehicle.depot.lon,
        'stops': route,
        'total_distance_km': round(total_distance, 2),
        'estimated_time_minutes': round(estimated_time, 1),
        'urgent_requests_served': urgent_count,
        'metadata': {
            'algorithm': 'urgency_first',
            'return_to_depot_km': round(return_distance, 2)
        }
    }


def blended_route(
    demands: list[DemandPoint],
    vehicle: Vehicle,
    urgency_weight: float = 0.5,
    distance_weight: float = 0.5
) -> dict:
    """
    Generate blended route balancing distance and urgency.
    
    Uses weighted scoring: score = urgency_weight * urgency - distance_weight * normalized_distance
    
    Args:
        demands: List of demand points to serve
        vehicle: Vehicle configuration
        urgency_weight: Weight for urgency (0-1)
        distance_weight: Weight for distance penalty (0-1)
        
    Returns:
        Route plan dict with stops, distance, and metrics
    """
    if not demands:
        return {
            'mode': 'blended',
            'stops': [],
            'total_distance_km': 0.0,
            'estimated_time_minutes': 0.0,
            'urgent_requests_served': 0,
            'metadata': {
                'algorithm': 'weighted_scoring',
                'urgency_weight': urgency_weight,
                'distance_weight': distance_weight
            }
        }
    
    current_location = vehicle.depot
    remaining = demands.copy()
    route = []
    total_distance = 0.0
    urgent_count = 0
    
    while remaining:
        # Calculate max distance for normalization
        max_dist = max(
            current_location.distance_to(d.location)
            for d in remaining
        ) or 1.0
        
        # Score each remaining demand point
        best_demand = None
        best_score = float('-inf')
        
        for demand in remaining:
            dist = current_location.distance_to(demand.location)
            normalized_dist = dist / max_dist
            
            # Higher score = better choice
            score = (urgency_weight * demand.urgency) - (distance_weight * normalized_dist)
            
            if score > best_score:
                best_score = score
                best_demand = demand
        
        # Add best demand to route
        distance = current_location.distance_to(best_demand.location)
        total_distance += distance
        
        route.append({
            'lat': best_demand.location.lat,
            'lon': best_demand.location.lon,
            'node_id': best_demand.node_id,
            'resource_type': best_demand.resource_type,
            'quantity': best_demand.quantity,
            'urgency': best_demand.urgency,
            'distance_from_prev_km': round(distance, 2)
        })
        
        if best_demand.urgency >= 2:
            urgent_count += 1
        
        current_location = best_demand.location
        remaining.remove(best_demand)
    
    # Return to depot
    return_distance = current_location.distance_to(vehicle.depot)
    total_distance += return_distance
    
    # Estimate time
    estimated_time = (total_distance / 40.0) * 60.0 + len(route) * 10.0
    
    return {
        'mode': 'blended',
        'depot_lat': vehicle.depot.lat,
        'depot_lon': vehicle.depot.lon,
        'stops': route,
        'total_distance_km': round(total_distance, 2),
        'estimated_time_minutes': round(estimated_time, 1),
        'urgent_requests_served': urgent_count,
        'metadata': {
            'algorithm': 'weighted_scoring',
            'urgency_weight': urgency_weight,
            'distance_weight': distance_weight,
            'return_to_depot_km': round(return_distance, 2)
        }
    }


def generate_all_routes(
    demands: list[DemandPoint],
    vehicle: Vehicle,
    urgency_weight: float = 0.6,
    distance_weight: float = 0.4
) -> list[dict]:
    """
    Generate all three route modes for comparison.
    
    Returns:
        List of three route plans (distance, priority, blended)
    """
    logger.info(f"Generating routes for {len(demands)} demand points")
    
    routes = [
        distance_focused_route(demands, vehicle),
        priority_focused_route(demands, vehicle),
        blended_route(demands, vehicle, urgency_weight, distance_weight)
    ]
    
    logger.info(f"Generated {len(routes)} route options")
    
    return routes
