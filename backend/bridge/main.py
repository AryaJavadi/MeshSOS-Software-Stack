"""
Gateway Bridge Service
Reads LoRa frames from serial port, validates, and persists to database

Usage:
    python -m bridge.main /dev/ttyUSB0
    python -m bridge.main /dev/stdin  # For testing with simulator
"""

import json
import logging
import sys
import time
from pathlib import Path
from typing import Optional, Protocol

import serial
from pydantic import ValidationError

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import MeshMessageModel
from database import init_db, insert_message

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(name)s] %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("bridge")


class SerialSource(Protocol):
    """Abstract interface for reading serial data"""
    
    def readline(self) -> bytes:
        """Read one line from source"""
        ...
    
    def close(self) -> None:
        """Close the source"""
        ...


class FileSerialSource:
    """Adapter to read from stdin or file-like object"""
    
    def __init__(self, file_obj):
        self.file = file_obj
    
    def readline(self) -> bytes:
        line = self.file.readline()
        if isinstance(line, str):
            return line.encode('utf-8')
        return line
    
    def close(self) -> None:
        if hasattr(self.file, 'close') and self.file not in (sys.stdin, sys.stdout, sys.stderr):
            self.file.close()


def parse_frame(line: bytes) -> Optional[dict]:
    """
    Parse a LoRa frame from bytes.
    
    Expected format: single line of UTF-8 JSON terminated by newline
    Example: {"node_id": "node-001", "timestamp": 1733200000, ...}\n
    
    Args:
        line: Raw bytes from serial port
        
    Returns:
        Parsed JSON dict or None if malformed
    """
    try:
        text = line.decode('utf-8').strip()
        if not text:
            return None
        
        # Skip comment lines (for debugging/testing)
        if text.startswith('#'):
            return None
            
        data = json.loads(text)
        return data
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        logger.warning(f"Malformed frame: {e} | raw={line[:100]}")
        return None


def open_serial_source(port: str, baudrate: int = 9600) -> SerialSource:
    """
    Open a serial source (real serial port or stdin).
    
    Args:
        port: Serial port path (e.g., /dev/ttyUSB0) or /dev/stdin
        baudrate: Baud rate for serial connection
        
    Returns:
        SerialSource instance
    """
    if port == "/dev/stdin":
        logger.info("Using stdin as serial source")
        return FileSerialSource(sys.stdin.buffer)
    else:
        logger.info(f"Opening serial port {port} at {baudrate} baud")
        return serial.Serial(port, baudrate=baudrate, timeout=1)


def run_bridge(
    serial_port: str,
    baudrate: int = 9600,
    db_path: Optional[Path] = None,
    retry_backoff: int = 5
) -> None:
    """
    Main bridge loop: read from serial, validate, persist.
    
    Args:
        serial_port: Path to serial device or /dev/stdin
        baudrate: Serial baud rate
        db_path: Database path (defaults to backend/meshsos.db)
        retry_backoff: Seconds to wait before reconnecting on error
    """
    # Initialize database
    if db_path is None:
        db_path = Path(__file__).parent.parent / "meshsos.db"
    
    conn = init_db(db_path)
    logger.info(f"Connected to database at {db_path}")
    
    # Statistics
    stats = {
        'received': 0,
        'validated': 0,
        'persisted': 0,
        'errors': 0
    }
    
    while True:
        try:
            # Open serial source
            source = open_serial_source(serial_port, baudrate)
            logger.info(f"Listening on {serial_port}")
            
            # Main read loop
            while True:
                try:
                    line = source.readline()
                    if not line:
                        # Timeout or EOF
                        if serial_port == "/dev/stdin":
                            # EOF on stdin, exit gracefully
                            logger.info("EOF on stdin, shutting down")
                            source.close()
                            return
                        continue
                    
                    stats['received'] += 1
                    
                    # Parse frame
                    raw = parse_frame(line)
                    if raw is None:
                        stats['errors'] += 1
                        continue
                    
                    # Validate against schema
                    try:
                        msg = MeshMessageModel(**raw)
                        stats['validated'] += 1
                    except ValidationError as e:
                        logger.warning(f"Validation error: {e}")
                        stats['errors'] += 1
                        continue
                    
                    # Persist to database
                    insert_message(conn, msg)
                    stats['persisted'] += 1
                    
                    logger.info(
                        f"✓ {msg.node_id} | {msg.message_type.value} | urgency={msg.urgency} "
                        f"| stats: rx={stats['received']} ok={stats['persisted']} err={stats['errors']}"
                    )
                    
                except KeyboardInterrupt:
                    raise
                except Exception as e:
                    logger.error(f"Error processing frame: {e}")
                    stats['errors'] += 1
                    continue
        
        except KeyboardInterrupt:
            logger.info("Shutting down bridge (Ctrl+C)")
            break
        
        except serial.SerialException as e:
            logger.error(f"Serial error: {e}")
            logger.info(f"Retrying in {retry_backoff} seconds...")
            time.sleep(retry_backoff)
        
        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            logger.info(f"Retrying in {retry_backoff} seconds...")
            time.sleep(retry_backoff)
    
    # Cleanup
    conn.close()
    logger.info(f"Final stats: {stats}")


def main():
    """CLI entry point"""
    if len(sys.argv) < 2:
        print("Usage: python -m bridge.main <serial_port> [baudrate]")
        print("Examples:")
        print("  python -m bridge.main /dev/ttyUSB0")
        print("  python -m bridge.main /dev/ttyUSB0 115200")
        print("  python -m bridge.main /dev/stdin")
        sys.exit(1)
    
    port = sys.argv[1]
    baudrate = int(sys.argv[2]) if len(sys.argv) > 2 else 9600
    
    logger.info("=" * 60)
    logger.info("MeshSOS Gateway Bridge")
    logger.info("=" * 60)
    
    run_bridge(port, baudrate)


if __name__ == "__main__":
    main()
