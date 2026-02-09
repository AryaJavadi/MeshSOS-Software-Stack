"""
Meshtastic Bridge Service

Uses Meshtastic Python API to connect to ESP32S3 + SX1262 LoRa nodes and
persists received messages into the MeshSOS SQLite database.

This bridge leverages Meshtastic's full API - minimal custom code needed.
Messages are automatically decoded by Meshtastic, we just convert to our schema.

Usage:
    python -m bridge.meshtastic_bridge /dev/ttyACM0
    python -m bridge.meshtastic_bridge /dev/ttyUSB0 --baudrate 115200
"""

# This is for Meshtastic hardware (our case)

from __future__ import annotations

import argparse
import json
import logging
import sys
import threading
import time
from pathlib import Path
from typing import Any, Optional

from pydantic import ValidationError

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from database import init_db, insert_message
from models import MeshMessageModel, MessageType

logger = logging.getLogger("meshtastic_bridge")

DB_LOCK = threading.Lock()


def _safe_truncate_utf8(s: str, max_bytes: int) -> str:
    """Truncate string to max_bytes UTF-8 encoding."""
    b = s.encode("utf-8", errors="ignore")
    if len(b) <= max_bytes:
        return s
    return b[:max_bytes].decode("utf-8", errors="ignore")


def convert_meshtastic_message_to_mesh_message(
    interface: Any,
    packet: dict[str, Any],
    message: str,
) -> Optional[MeshMessageModel]:
    """
    Convert a Meshtastic text message into a MeshMessageModel.
    
    Uses Meshtastic's decoded message directly - minimal parsing needed.
    
    Args:
        interface: Meshtastic interface instance (for node info)
        packet: Raw packet dict from Meshtastic
        message: Decoded text message from Meshtastic
        
    Returns:
        MeshMessageModel or None if message should be ignored
    """
    if not message or not message.strip():
        return None
    
    message = message.strip()
    
    # Preferred path: payload is JSON matching our canonical schema
    if message.startswith("{") and message.endswith("}"):
        try:
            raw = json.loads(message)
            # Validate against our schema
            return MeshMessageModel(**raw)
        except (json.JSONDecodeError, ValidationError) as e:
            logger.debug(f"Message not valid JSON schema: {e}")
            # Fall through to broadcast path
    
    # Fallback: store as broadcast/SOS with best-effort metadata
    # Extract node info from Meshtastic's node database
    from_id = "unknown"
    lat = None
    lon = None
    
    try:
        from_id = str(packet.get("fromId") or packet.get("from") or "unknown")

        # Look up position from Meshtastic's node database
        if interface and hasattr(interface, "nodes") and interface.nodes:
            node_data = interface.nodes.get(from_id, {})
            position = node_data.get("position", {})
            if position:
                lat = position.get("latitude")
                lon = position.get("longitude")
                if lat is not None and lon is not None:
                    logger.debug(f"Position for {from_id}: {lat}, {lon}")
    except Exception as e:
        logger.debug(f"Could not extract node info: {e}")
        from_id = str(packet.get("fromId", packet.get("from", "unknown")))
    
    # Extract timestamp
    rx_time = packet.get("rxTime") or packet.get("rx_time") or int(time.time())
    try:
        rx_time = int(rx_time)
    except Exception:
        rx_time = int(time.time())
    
    # Heuristic: detect SOS/HELP messages
    upper = message.upper()
    if "SOS" in upper or "HELP" in upper or "EMERGENCY" in upper:
        msg_type = MessageType.SOS
        urgency = 3
    elif "SUPPLY" in upper or "WATER" in upper or "FOOD" in upper or "MEDICAL" in upper:
        msg_type = MessageType.SUPPLY_REQUEST
        urgency = 2
    else:
        msg_type = MessageType.BROADCAST
        urgency = 1
    
    return MeshMessageModel(
        node_id=from_id,
        timestamp=rx_time,
        message_type=msg_type,
        urgency=urgency,
        lat=lat,
        lon=lon,
        payload=_safe_truncate_utf8(message, 100),
    )


def run_meshtastic_bridge(
    serial_port: str,
    baudrate: int = 115200,
    db_path: Optional[Path] = None,
) -> None:
    """
    Main bridge loop using Meshtastic API.
    
    Uses Meshtastic's pubsub system to receive messages automatically.
    """
    if db_path is None:
        db_path = Path(__file__).parent / "meshsos.db"

    conn = init_db(db_path)
    logger.info(f"Connected to database at {db_path}")

    try:
        # Import Meshtastic - it handles all the heavy lifting
        import meshtastic
        import meshtastic.serial_interface
        # Meshtastic uses PyPubSub (installed as dependency of meshtastic)
        # Try both possible import names
        try:
            from pubsub import pub
        except ImportError:
            try:
                from PyPubSub import pub
            except ImportError:
                raise ImportError(
                    "PyPubSub not found. Meshtastic should install it automatically. "
                    "Try: pip install --upgrade meshtastic"
                )
    except ImportError as e:
        raise RuntimeError(
            "Meshtastic library not installed. "
            "Install with: pip install meshtastic"
        ) from e

    stats = {"rx": 0, "stored": 0, "ignored": 0, "errors": 0}

    def on_receive(packet: dict[str, Any], interface: Any) -> None:
        """Callback when Meshtastic receives a message."""
        stats["rx"] += 1
        
        try:
            # Meshtastic decodes the message for us
            decoded = packet.get("decoded", {})
            message_text = decoded.get("text", "")
            
            if not message_text:
                stats["ignored"] += 1
                return
            
            # Convert to our schema
            msg = convert_meshtastic_message_to_mesh_message(interface, packet, message_text)

            if msg is None:
                stats["ignored"] += 1
                return

            # Fill in position from cached position packets if still missing
            if msg.lat is None and msg.node_id in node_positions:
                msg.lat = node_positions[msg.node_id]["lat"]
                msg.lon = node_positions[msg.node_id]["lon"]

            # Store in database
            with DB_LOCK:
                insert_message(conn, msg)
            stats["stored"] += 1
            
            logger.info(
                f"✓ {msg.node_id} | {msg.message_type.value} | urgency={msg.urgency} "
                f"| stats: rx={stats['rx']} stored={stats['stored']} ignored={stats['ignored']} err={stats['errors']}"
            )
        except Exception as e:
            stats["errors"] += 1
            logger.error(f"Error handling packet: {e}", exc_info=True)

    # Track latest known positions from position packets
    node_positions = {}

    def on_position(packet: dict[str, Any], interface: Any) -> None:
        """Callback when Meshtastic receives a position update."""
        try:
            from_id = str(packet.get("fromId") or packet.get("from") or "unknown")
            decoded = packet.get("decoded", {})
            position = decoded.get("position", {})
            if position:
                lat = position.get("latitude")
                lon = position.get("longitude")
                if lat is not None and lon is not None:
                    node_positions[from_id] = {"lat": lat, "lon": lon}
                    logger.info(f"📍 Position update: {from_id} @ {lat:.6f}, {lon:.6f}")
        except Exception as e:
            logger.debug(f"Error handling position packet: {e}")

    # Check if device exists before attempting connection
    import os
    if not os.path.exists(serial_port):
        available = list_available_devices()
        error_msg = f"Serial device '{serial_port}' not found.\n"
        if available:
            error_msg += f"\nAvailable devices:\n"
            for dev in available:
                error_msg += f"  - {dev}\n"
            error_msg += f"\nTry: python -m bridge.meshtastic_bridge {available[0]}"
        else:
            error_msg += (
                f"\nOn Linux/Raspberry Pi, common devices are:\n"
                f"  - /dev/ttyACM0 (USB CDC)\n"
                f"  - /dev/ttyUSB0 (USB serial)\n"
                f"  - /dev/ttyS0 (hardware serial)\n"
                f"\nOn macOS, devices are typically:\n"
                f"  - /dev/cu.usbserial-* or /dev/cu.usbmodem*\n"
                f"  - /dev/cu.DuskySky (Meshtastic device)\n"
                f"\nList devices with: python -m bridge.meshtastic_bridge --list-devices"
            )
        raise FileNotFoundError(error_msg)
    
    logger.info(f"Connecting to Meshtastic radio on {serial_port} @ {baudrate}...")
    
    interface = None
    try:
        # Meshtastic handles connection, protocol, decoding - we just subscribe
        # SerialInterface auto-detects baudrate, so we only need devPath
        interface = meshtastic.serial_interface.SerialInterface(devPath=serial_port)
        
        # Subscribe to receive events - Meshtastic does the rest
        pub.subscribe(on_receive, "meshtastic.receive.text")
        pub.subscribe(on_position, "meshtastic.receive.position")
        
        logger.info("Listening for Meshtastic messages (Ctrl+C to stop)")
        try:
            node_id = interface.myInfo.get('user', {}).get('id', 'unknown')
            logger.info(f"Connected to node: {node_id}")
        except Exception:
            logger.info("Connected to Meshtastic device")
        
        # Keep running - Meshtastic handles message reception in background
        # Also accept typed input to send messages from this terminal
        logger.info("Type a message and press Enter to send, or Ctrl+C to stop")
        try:
            while True:
                try:
                    line = input()
                    if line.strip():
                        interface.sendText(line.strip())
                        logger.info(f"→ Sent: {line.strip()}")
                except EOFError:
                    break
        except KeyboardInterrupt:
            logger.info("Shutting down Meshtastic bridge (Ctrl+C)")
    except FileNotFoundError as e:
        logger.error(str(e))
        raise
    except Exception as e:
        logger.error(f"Failed to connect to Meshtastic device: {e}")
        raise
    finally:
        if interface is not None:
            try:
                interface.close()
            except Exception:
                pass
        conn.close()
        logger.info(f"Final stats: {stats}")


def list_available_devices() -> list[str]:
    """List available serial devices on the system."""
    import glob
    devices = []
    
    # Linux/Raspberry Pi devices
    linux_patterns = ["/dev/ttyACM*", "/dev/ttyUSB*", "/dev/ttyS*"]
    for pattern in linux_patterns:
        devices.extend(glob.glob(pattern))
    
    # macOS devices
    mac_patterns = ["/dev/cu.usbserial*", "/dev/cu.usbmodem*", "/dev/cu.*"]
    for pattern in mac_patterns:
        devices.extend(glob.glob(pattern))
    
    # Filter out common non-serial devices
    filtered = [d for d in devices if not any(x in d for x in [
        "Bluetooth", "wlan", "eth", "lo", "pty"
    ])]
    
    return sorted(set(filtered))


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(name)s] %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    parser = argparse.ArgumentParser(
        description="MeshSOS Meshtastic Bridge",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # On Raspberry Pi:
  python -m bridge.meshtastic_bridge /dev/ttyACM0
  
  # On macOS:
  python -m bridge.meshtastic_bridge /dev/cu.DuskySky
  
  # List available devices:
  python -m bridge.meshtastic_bridge --list-devices
        """
    )
    parser.add_argument(
        "serial_port",
        nargs="?",
        help="Serial port path (e.g., /dev/ttyACM0 or /dev/cu.usbserial-*)"
    )
    parser.add_argument(
        "--baudrate",
        type=int,
        default=115200,
        help="Serial baud rate (usually auto-detected by Meshtastic)"
    )
    parser.add_argument(
        "--list-devices",
        action="store_true",
        help="List available serial devices and exit"
    )
    
    args = parser.parse_args()
    
    if args.list_devices:
        devices = list_available_devices()
        if devices:
            print("Available serial devices:")
            for dev in devices:
                print(f"  {dev}")
        else:
            print("No serial devices found.")
        return
    
    if not args.serial_port:
        parser.error("serial_port is required (use --list-devices to see available devices)")
    
    run_meshtastic_bridge(args.serial_port, baudrate=args.baudrate)


if __name__ == "__main__":
    main()

