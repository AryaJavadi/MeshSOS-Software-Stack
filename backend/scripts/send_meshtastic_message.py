#!/usr/bin/env python3
"""
Quick script to send a test message via Meshtastic.

Usage:
    python3 scripts/send_meshtastic_message.py /dev/cu.DuskySky "Hello from bridge!"
"""

import argparse
import logging
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("send_message")

def send_message(serial_port: str, message: str) -> None:
    """Send a text message via Meshtastic interface."""
    try:
        import meshtastic
        import meshtastic.serial_interface
    except ImportError as e:
        raise RuntimeError(
            "Meshtastic library not installed. "
            "Install with: pip install meshtastic"
        ) from e
    
    import os
    if not os.path.exists(serial_port):
        raise FileNotFoundError(f"Serial device '{serial_port}' not found.")
    
    logger.info(f"Connecting to Meshtastic radio on {serial_port}...")
    
    interface = None
    try:
        interface = meshtastic.serial_interface.SerialInterface(devPath=serial_port)
        
        try:
            node_id = interface.myInfo.get('user', {}).get('id', 'unknown')
            logger.info(f"Connected to node: {node_id}")
        except Exception:
            logger.info("Connected to Meshtastic device")
        
        logger.info(f"Sending message: {message}")
        interface.sendText(message)
        logger.info("✓ Message sent successfully!")
        
        # Give it a moment to send
        import time
        time.sleep(1)
        
    except Exception as e:
        logger.error(f"Failed to send message: {e}")
        raise
    finally:
        if interface is not None:
            try:
                interface.close()
            except Exception:
                pass

def main():
    parser = argparse.ArgumentParser(
        description="Send a test message via Meshtastic",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "serial_port",
        help="Serial port path (e.g., /dev/cu.DuskySky or /dev/ttyACM0)"
    )
    parser.add_argument(
        "message",
        help="Message text to send"
    )
    
    args = parser.parse_args()
    
    send_message(args.serial_port, args.message)

if __name__ == "__main__":
    main()
