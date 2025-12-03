"""
Scenario-based LoRa Traffic Generator
Generates realistic multi-node traffic patterns for testing

Usage:
    python scripts/simulate_scenario.py --nodes 5 --duration 60 --rate 1.0
"""

import argparse
import json
import random
import sys
import time
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))


class ScenarioGenerator:
    """Generates realistic disaster scenario traffic"""
    
    def __init__(self, num_nodes: int, base_lat: float = 43.47, base_lon: float = -80.54):
        self.num_nodes = num_nodes
        self.base_lat = base_lat
        self.base_lon = base_lon
        
        # Generate node positions
        self.nodes = {}
        for i in range(num_nodes):
            node_id = f"node-{i+1:03d}"
            self.nodes[node_id] = {
                'lat': base_lat + random.uniform(-0.1, 0.1),
                'lon': base_lon + random.uniform(-0.1, 0.1),
                'last_message': 0
            }
    
    def generate_message(self, node_id: str) -> dict:
        """Generate a message from specified node"""
        now = int(time.time())
        node = self.nodes[node_id]
        
        # Message type distribution based on disaster scenario
        # More supply requests than status updates
        msg_types = ["sos", "supply_request", "supply_request", "supply_request", "status_update"]
        msg_type = random.choice(msg_types)
        
        # Urgency distribution: some critical, mostly medium
        urgency = random.choices([1, 2, 3], weights=[2, 5, 3])[0]
        
        # Resource types
        resources = ["water", "food", "medical", "shelter", "power", "communications"]
        resource = random.choice(resources)
        
        # Vary quantity based on resource type
        if resource == "water":
            quantity = random.randint(5, 100)  # liters
        elif resource == "food":
            quantity = random.randint(10, 200)  # meals
        elif resource == "medical":
            quantity = random.randint(1, 20)  # kits
        else:
            quantity = random.randint(1, 50)
        
        msg = {
            "node_id": node_id,
            "timestamp": now,
            "message_type": msg_type,
            "urgency": urgency,
            "lat": round(node['lat'], 6),
            "lon": round(node['lon'], 6),
            "resource_type": resource,
            "quantity": quantity,
            "payload": f"Scenario message from {node_id}"
        }
        
        node['last_message'] = now
        
        return msg
    
    def run(self, duration_seconds: int, messages_per_second: float):
        """
        Run scenario for specified duration.
        
        Args:
            duration_seconds: How long to run
            messages_per_second: Average message rate
        """
        print(f"# Scenario: {self.num_nodes} nodes, {duration_seconds}s, {messages_per_second} msg/s", file=sys.stderr)
        
        start_time = time.time()
        message_count = 0
        
        # Calculate inter-message delay
        delay = 1.0 / messages_per_second if messages_per_second > 0 else 1.0
        
        while time.time() - start_time < duration_seconds:
            # Select random node
            node_id = random.choice(list(self.nodes.keys()))
            
            # Generate and output message
            msg = self.generate_message(node_id)
            line = json.dumps(msg) + "\n"
            
            sys.stdout.write(line)
            sys.stdout.flush()
            
            message_count += 1
            
            if message_count % 10 == 0:
                elapsed = time.time() - start_time
                rate = message_count / elapsed
                print(f"# Sent {message_count} messages | {rate:.2f} msg/s", file=sys.stderr)
            
            # Wait before next message
            time.sleep(delay)
        
        elapsed = time.time() - start_time
        actual_rate = message_count / elapsed
        print(f"# Scenario complete: {message_count} messages in {elapsed:.1f}s ({actual_rate:.2f} msg/s)", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Generate realistic LoRa scenario traffic")
    parser.add_argument("--nodes", type=int, default=5, help="Number of nodes")
    parser.add_argument("--duration", type=int, default=60, help="Duration in seconds")
    parser.add_argument("--rate", type=float, default=1.0, help="Messages per second")
    parser.add_argument("--lat", type=float, default=43.47, help="Base latitude")
    parser.add_argument("--lon", type=float, default=-80.54, help="Base longitude")
    
    args = parser.parse_args()
    
    generator = ScenarioGenerator(args.nodes, args.lat, args.lon)
    generator.run(args.duration, args.rate)


if __name__ == "__main__":
    main()
