#!/usr/bin/env python3
"""
MeshSOS Quick Demo
Demonstrates the complete software stack in action

This script:
1. Starts the backend API
2. Generates simulated traffic
3. Queries the API to show results
4. Generates route plans
"""

import subprocess
import time
import sys
import os
import signal
import requests
import json
from pathlib import Path

# Colors for terminal output
GREEN = '\033[92m'
BLUE = '\033[94m'
YELLOW = '\033[93m'
RED = '\033[91m'
RESET = '\033[0m'
BOLD = '\033[1m'


def print_header(text):
    print(f"\n{BOLD}{BLUE}{'='*60}{RESET}")
    print(f"{BOLD}{BLUE}{text:^60}{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}\n")


def print_step(num, text):
    print(f"{BOLD}{GREEN}[Step {num}]{RESET} {text}")


def print_info(text):
    print(f"{BLUE}ℹ{RESET}  {text}")


def print_success(text):
    print(f"{GREEN}✓{RESET}  {text}")


def print_error(text):
    print(f"{RED}✗{RESET}  {text}")


def wait_for_api(base_url="http://localhost:8000", timeout=10):
    """Wait for API to be ready"""
    print_info(f"Waiting for API at {base_url}...")
    
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = requests.get(f"{base_url}/health", timeout=1)
            if resp.status_code == 200:
                print_success("API is ready")
                return True
        except:
            time.sleep(0.5)
    
    print_error("API failed to start")
    return False


def main():
    # Change to backend directory
    backend_dir = Path(__file__).parent.parent
    os.chdir(backend_dir)
    
    print_header("MeshSOS Quick Demo")
    print("This demo showcases the complete software stack:\n")
    print("  • Gateway Bridge (serial → database)")
    print("  • Backend API (REST endpoints)")
    print("  • Routing Engine (route generation)")
    print("  • Simulators (realistic traffic)")
    print()
    
    api_process = None
    bridge_process = None
    
    try:
        # Step 1: Start API
        print_step(1, "Starting Backend API")
        api_process = subprocess.Popen(
            [sys.executable, "-m", "api.main"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        
        if not wait_for_api():
            print_error("Failed to start API. Exiting.")
            return
        
        # Step 2: Start simulator → bridge
        print_step(2, "Generating simulated traffic (10 messages over 15 seconds)")
        
        sim_cmd = [sys.executable, "scripts/simulate_scenario.py", 
                   "--nodes", "3", "--duration", "15", "--rate", "0.7"]
        bridge_cmd = [sys.executable, "-m", "bridge.main", "/dev/stdin"]
        
        # Pipe simulator into bridge
        sim_process = subprocess.Popen(sim_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        bridge_process = subprocess.Popen(bridge_cmd, stdin=sim_process.stdout, 
                                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        # Close sim_process stdout in parent to allow SIGPIPE
        sim_process.stdout.close()
        
        # Wait for simulation to complete
        print_info("Simulating emergency scenario...")
        sim_process.wait()
        time.sleep(2)  # Let bridge finish processing
        
        # Terminate bridge
        bridge_process.send_signal(signal.SIGINT)
        bridge_process.wait(timeout=3)
        
        print_success("Traffic generation complete")
        
        # Step 3: Query API
        print_step(3, "Querying API endpoints")
        time.sleep(1)
        
        base_url = "http://localhost:8000"
        
        # Get all messages
        print_info("GET /messages")
        resp = requests.get(f"{base_url}/messages")
        messages = resp.json()
        print(f"  → {len(messages)} messages stored")
        
        if messages:
            print(f"\n{YELLOW}Sample message:{RESET}")
            sample = messages[0]
            print(f"  Node: {sample['node_id']}")
            print(f"  Type: {sample['message_type']}")
            print(f"  Urgency: {sample['urgency']}")
            print(f"  Location: ({sample.get('lat', 'N/A')}, {sample.get('lon', 'N/A')})")
            print(f"  Resource: {sample.get('resource_type', 'N/A')} x{sample.get('quantity', 'N/A')}")
        
        # Get urgent messages
        print_info("\nGET /messages/urgent")
        resp = requests.get(f"{base_url}/messages/urgent?min_urgency=2")
        urgent = resp.json()
        print(f"  → {len(urgent)} urgent messages (urgency ≥ 2)")
        
        # Get node status
        print_info("\nGET /nodes")
        resp = requests.get(f"{base_url}/nodes")
        nodes = resp.json()
        print(f"  → {len(nodes)} active nodes")
        for node in nodes:
            print(f"    • {node['node_id']}: {node['message_count']} messages, urgency={node.get('last_urgency', '?')}")
        
        # Step 4: Generate routes
        print_step(4, "Generating route plans")
        
        route_request = {
            "depot_lat": 43.47,
            "depot_lon": -80.54,
            "vehicle_capacity": 100,
            "since_hours": 1,
            "urgency_weight": 0.6,
            "distance_weight": 0.4
        }
        
        print_info("POST /routes/generate")
        resp = requests.post(
            f"{base_url}/routes/generate",
            json=route_request,
            headers={"Content-Type": "application/json"}
        )
        
        if resp.status_code == 200:
            routes = resp.json()
            print_success(f"Generated {len(routes)} route plans\n")
            
            for route in routes:
                mode = route['mode']
                distance = route['total_distance_km']
                time_min = route['estimated_time_minutes']
                urgent = route['urgent_requests_served']
                stops = len(route['stops'])
                
                print(f"{YELLOW}{mode.upper()} Route:{RESET}")
                print(f"  • Stops: {stops}")
                print(f"  • Distance: {distance:.2f} km")
                print(f"  • Est. time: {time_min:.1f} minutes")
                print(f"  • Urgent requests served: {urgent}")
                print()
        else:
            print_error(f"Route generation failed: {resp.status_code}")
        
        # Step 5: Success
        print_header("Demo Complete!")
        print_success("All systems operational")
        print()
        print(f"Next steps:")
        print(f"  • View API docs: http://localhost:8000/docs")
        print(f"  • Run tests: pytest tests/")
        print(f"  • Read documentation: backend/README.md")
        print()
        
    except KeyboardInterrupt:
        print("\n\nDemo interrupted by user")
    
    except Exception as e:
        print_error(f"Demo failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup
        print_info("Cleaning up...")
        
        if bridge_process and bridge_process.poll() is None:
            bridge_process.terminate()
            bridge_process.wait(timeout=2)
        
        if api_process and api_process.poll() is None:
            api_process.terminate()
            api_process.wait(timeout=2)
        
        print_success("Cleanup complete")


if __name__ == "__main__":
    main()
