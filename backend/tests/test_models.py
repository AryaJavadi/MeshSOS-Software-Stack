"""
Unit tests for MeshSOS data models
"""

import pytest
from pydantic import ValidationError
import time

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import MeshMessageModel, MessageType


def test_valid_message():
    """Test creation of valid message"""
    msg = MeshMessageModel(
        node_id="node-001",
        timestamp=int(time.time()),
        message_type=MessageType.SUPPLY_REQUEST,
        urgency=2,
        lat=43.4723,
        lon=-80.5449,
        resource_type="water",
        quantity=10,
        payload="Test message"
    )
    
    assert msg.node_id == "node-001"
    assert msg.urgency == 2
    assert msg.message_type == MessageType.SUPPLY_REQUEST


def test_minimal_message():
    """Test message with only required fields"""
    msg = MeshMessageModel(
        node_id="node-002",
        timestamp=int(time.time()),
        message_type=MessageType.SOS,
        urgency=3
    )
    
    assert msg.node_id == "node-002"
    assert msg.lat is None
    assert msg.resource_type is None


def test_urgency_validation():
    """Test urgency must be 1-3"""
    # Valid urgencies
    for urgency in [1, 2, 3]:
        msg = MeshMessageModel(
            node_id="test",
            timestamp=int(time.time()),
            message_type=MessageType.SOS,
            urgency=urgency
        )
        assert msg.urgency == urgency
    
    # Invalid urgencies
    with pytest.raises(ValidationError):
        MeshMessageModel(
            node_id="test",
            timestamp=int(time.time()),
            message_type=MessageType.SOS,
            urgency=0  # Too low
        )
    
    with pytest.raises(ValidationError):
        MeshMessageModel(
            node_id="test",
            timestamp=int(time.time()),
            message_type=MessageType.SOS,
            urgency=4  # Too high
        )


def test_lat_lon_validation():
    """Test latitude and longitude bounds"""
    # Valid coordinates
    msg = MeshMessageModel(
        node_id="test",
        timestamp=int(time.time()),
        message_type=MessageType.STATUS_UPDATE,
        urgency=1,
        lat=43.4723,
        lon=-80.5449
    )
    assert msg.lat == 43.4723
    assert msg.lon == -80.5449
    
    # Invalid latitude
    with pytest.raises(ValidationError):
        MeshMessageModel(
            node_id="test",
            timestamp=int(time.time()),
            message_type=MessageType.SOS,
            urgency=1,
            lat=91.0  # Out of range
        )
    
    # Invalid longitude
    with pytest.raises(ValidationError):
        MeshMessageModel(
            node_id="test",
            timestamp=int(time.time()),
            message_type=MessageType.SOS,
            urgency=1,
            lon=-181.0  # Out of range
        )


def test_payload_max_length():
    """Test payload length constraint"""
    # Valid payload
    msg = MeshMessageModel(
        node_id="test",
        timestamp=int(time.time()),
        message_type=MessageType.SUPPLY_REQUEST,
        urgency=2,
        payload="A" * 100  # Exactly 100 bytes
    )
    assert len(msg.payload) == 100
    
    # Payload too long
    with pytest.raises(ValidationError):
        MeshMessageModel(
            node_id="test",
            timestamp=int(time.time()),
            message_type=MessageType.SUPPLY_REQUEST,
            urgency=2,
            payload="A" * 101  # Too long
        )


def test_message_type_enum():
    """Test message type enumeration"""
    for msg_type in [MessageType.SOS, MessageType.SUPPLY_REQUEST, 
                     MessageType.STATUS_UPDATE, MessageType.BROADCAST]:
        msg = MeshMessageModel(
            node_id="test",
            timestamp=int(time.time()),
            message_type=msg_type,
            urgency=1
        )
        assert msg.message_type == msg_type


def test_json_serialization():
    """Test message can be serialized to JSON"""
    msg = MeshMessageModel(
        node_id="node-001",
        timestamp=1733184000,
        message_type=MessageType.SUPPLY_REQUEST,
        urgency=3,
        lat=43.4723,
        lon=-80.5449,
        resource_type="water",
        quantity=10,
        payload="Test"
    )
    
    json_str = msg.model_dump_json()
    assert "node-001" in json_str
    assert "supply_request" in json_str
