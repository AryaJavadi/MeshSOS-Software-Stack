"""
Simple LoRa Node Simulator
Generates realistic MeshSOS packets for testing

Usage:
    python scripts/simulate_node.py
    python scripts/simulate_node.py | python -m bridge.main /dev/stdin
"""

import json
import random
import sys
import time
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def generate_message(node_id: str, message_num: int) -> dict:
    """
    Generate a realistic MeshSOS message.
    
    Randomly selects message type, urgency, and resource type.
    """
    now = int(time.time())
    
    # Random message type
    msg_types = ["sos", "supply_request", "supply_request", "status_update"]
    msg_type = random.choice(msg_types)
    
    # Random urgency (bias toward medium/high)
    urgency = random.choices([1, 2, 3], weights=[1, 3, 2])[0]
    
    # Random resource type
    resources = ["water", "food", "medical", "shelter", "power"]
    resource = random.choice(resources)
    
    # Random location near Waterloo, ON (43.47, -80.54)
    base_lat = 43.47
    base_lon = -80.54
    lat = base_lat + random.uniform(-0.05, 0.05)
    lon = base_lon + random.uniform(-0.05, 0.05)
    
    # Quantity
    quantity = random.randint(1, 50)
    
    msg = {
        "node_id": node_id,
        "timestamp": now,
        "message_type": msg_type,
        "urgency": urgency,
        "lat": round(lat, 6),
        "lon": round(lon, 6),
        "resource_type": resource,
        "quantity": quantity,
        "payload": f"Simulated {msg_type} #{message_num}"
    }
    
    return msg


def main():
    """
    Run simple node simulator.
    
    Generates 5 messages with 1 second delays.
    """
    node_id = sys.argv[1] if len(sys.argv) > 1 else "node-sim-001"
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    delay = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    
    print(f"# MeshSOS Node Simulator: {node_id}", file=sys.stderr)
    print(f"# Generating {count} messages with {delay}s delay", file=sys.stderr)
    
    for i in range(count):
        msg = generate_message(node_id, i + 1)
        line = json.dumps(msg) + "\n"
        
        sys.stdout.write(line)
        sys.stdout.flush()
        
        print(f"# Sent message {i+1}/{count}", file=sys.stderr)
        
        if i < count - 1:
            time.sleep(delay)
    
    print(f"# Simulation complete", file=sys.stderr)


if __name__ == "__main__":
    main()
