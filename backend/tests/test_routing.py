"""
Unit tests for routing engine
"""

import pytest
import math

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from routing.engine import (
    Location,
    DemandPoint,
    Vehicle,
    distance_focused_route,
    priority_focused_route,
    blended_route,
    generate_all_routes
)


def test_location_distance():
    """Test distance calculation using Haversine"""
    # Waterloo to Toronto (approx 100 km)
    waterloo = Location(43.4643, -80.5204)
    toronto = Location(43.6532, -79.3832)
    
    distance = waterloo.distance_to(toronto)
    
    # Should be approximately 100 km
    assert 90 < distance < 110


def test_location_distance_same_point():
    """Test distance to same location is zero"""
    loc = Location(43.4723, -80.5449)
    assert loc.distance_to(loc) == 0.0


def test_distance_focused_empty():
    """Test distance route with no demands"""
    depot = Location(43.47, -80.54)
    vehicle = Vehicle(depot=depot, capacity=100)
    
    route = distance_focused_route([], vehicle)
    
    assert route['mode'] == 'distance'
    assert len(route['stops']) == 0
    assert route['total_distance_km'] == 0.0
    assert route['urgent_requests_served'] == 0


def test_distance_focused_single_demand():
    """Test distance route with single demand"""
    depot = Location(43.47, -80.54)
    vehicle = Vehicle(depot=depot)
    
    demand = DemandPoint(
        id=1,
        node_id="node-001",
        location=Location(43.48, -80.55),
        urgency=2,
        resource_type="water",
        quantity=10,
        timestamp=1733184000
    )
    
    route = distance_focused_route([demand], vehicle)
    
    assert route['mode'] == 'distance'
    assert len(route['stops']) == 1
    assert route['stops'][0]['node_id'] == "node-001"
    assert route['total_distance_km'] > 0


def test_distance_focused_multiple_demands():
    """Test distance route visits all demands"""
    depot = Location(43.47, -80.54)
    vehicle = Vehicle(depot=depot)
    
    demands = [
        DemandPoint(1, "node-001", Location(43.48, -80.55), 1, "water", 10, 1733184000),
        DemandPoint(2, "node-002", Location(43.49, -80.56), 2, "food", 20, 1733184001),
        DemandPoint(3, "node-003", Location(43.50, -80.57), 3, "medical", 5, 1733184002),
    ]
    
    route = distance_focused_route(demands, vehicle)
    
    assert len(route['stops']) == 3
    assert route['total_distance_km'] > 0
    assert route['estimated_time_minutes'] > 0


def test_priority_focused_empty():
    """Test priority route with no demands"""
    depot = Location(43.47, -80.54)
    vehicle = Vehicle(depot=depot)
    
    route = priority_focused_route([], vehicle)
    
    assert route['mode'] == 'priority'
    assert len(route['stops']) == 0


def test_priority_focused_ordering():
    """Test priority route serves high urgency first"""
    depot = Location(43.47, -80.54)
    vehicle = Vehicle(depot=depot)
    
    # Create demands with different urgencies, far apart
    demands = [
        DemandPoint(1, "node-low", Location(43.48, -80.55), 1, "water", 10, 1733184002),
        DemandPoint(2, "node-high", Location(43.50, -80.57), 3, "medical", 5, 1733184000),
        DemandPoint(3, "node-med", Location(43.49, -80.56), 2, "food", 20, 1733184001),
    ]
    
    route = priority_focused_route(demands, vehicle)
    
    # First stop should be highest urgency (3)
    assert route['stops'][0]['node_id'] == "node-high"
    assert route['stops'][0]['urgency'] == 3
    
    # Second should be medium (2)
    assert route['stops'][1]['node_id'] == "node-med"
    assert route['stops'][1]['urgency'] == 2
    
    # Last should be low (1)
    assert route['stops'][2]['node_id'] == "node-low"
    assert route['stops'][2]['urgency'] == 1


def test_priority_focused_counts_urgent():
    """Test priority route counts urgent requests"""
    depot = Location(43.47, -80.54)
    vehicle = Vehicle(depot=depot)
    
    demands = [
        DemandPoint(1, "n1", Location(43.48, -80.55), 1, "water", 10, 1733184000),
        DemandPoint(2, "n2", Location(43.49, -80.56), 2, "food", 20, 1733184001),
        DemandPoint(3, "n3", Location(43.50, -80.57), 3, "medical", 5, 1733184002),
        DemandPoint(4, "n4", Location(43.51, -80.58), 3, "medical", 5, 1733184003),
    ]
    
    route = priority_focused_route(demands, vehicle)
    
    # Should count urgency >= 2 (3 demands)
    assert route['urgent_requests_served'] == 3


def test_blended_route():
    """Test blended route with custom weights"""
    depot = Location(43.47, -80.54)
    vehicle = Vehicle(depot=depot)
    
    demands = [
        DemandPoint(1, "n1", Location(43.48, -80.55), 1, "water", 10, 1733184000),
        DemandPoint(2, "n2", Location(43.49, -80.56), 2, "food", 20, 1733184001),
        DemandPoint(3, "n3", Location(43.50, -80.57), 3, "medical", 5, 1733184002),
    ]
    
    route = blended_route(demands, vehicle, urgency_weight=0.7, distance_weight=0.3)
    
    assert route['mode'] == 'blended'
    assert len(route['stops']) == 3
    assert 'metadata' in route
    assert route['metadata']['urgency_weight'] == 0.7
    assert route['metadata']['distance_weight'] == 0.3


def test_generate_all_routes():
    """Test generating all three route modes"""
    depot = Location(43.47, -80.54)
    vehicle = Vehicle(depot=depot)
    
    demands = [
        DemandPoint(1, "n1", Location(43.48, -80.55), 1, "water", 10, 1733184000),
        DemandPoint(2, "n2", Location(43.49, -80.56), 2, "food", 20, 1733184001),
        DemandPoint(3, "n3", Location(43.50, -80.57), 3, "medical", 5, 1733184002),
    ]
    
    routes = generate_all_routes(demands, vehicle)
    
    assert len(routes) == 3
    
    # Check modes
    modes = [r['mode'] for r in routes]
    assert 'distance' in modes
    assert 'priority' in modes
    assert 'blended' in modes
    
    # All should have same number of stops
    for route in routes:
        assert len(route['stops']) == 3


def test_route_includes_distances():
    """Test that routes include distance metrics"""
    depot = Location(43.47, -80.54)
    vehicle = Vehicle(depot=depot)
    
    demands = [
        DemandPoint(1, "n1", Location(43.48, -80.55), 2, "water", 10, 1733184000),
    ]
    
    route = distance_focused_route(demands, vehicle)
    
    # Should have distance from previous for each stop
    assert 'distance_from_prev_km' in route['stops'][0]
    assert route['stops'][0]['distance_from_prev_km'] > 0
    
    # Should have total distance
    assert route['total_distance_km'] > 0
    
    # Should have estimated time
    assert route['estimated_time_minutes'] > 0
