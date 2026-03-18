"""
Range Test Configuration

Edit these values before running the test.
Serial port can also be set via the MESHSOS_PORT environment variable.
"""

import os

# Serial port of the base node (connected to this laptop via USB)
# Examples: '/dev/cu.usbserial-...' (macOS), '/dev/ttyUSB0' (Linux), 'COM3' (Windows)
SERIAL_PORT: str = os.environ.get("MESHSOS_PORT", "/dev/cu.usbmodemF09E9E766D5C1")

# Node ID of the remote (walking) node — e.g. "!02eb0b60"
# Find this in the Meshtastic app under the Nodes tab.
REMOTE_NODE_ID: str = "!02eb0b60"

# Number of pings to send per test point (used to calculate PDR)
PINGS_PER_POINT: int = 20

# Seconds to wait for an ACK after each ping before marking as lost
ACK_TIMEOUT_S: float = 20.0

# Seconds between successive pings within a burst
PING_INTERVAL_S: float = 3.0

# Hop limit to use for test messages (1 = direct only, 3 = default, up to 8)
HOP_LIMIT: int = 3

# Directory where range_log.csv is written (relative to this file)
RESULTS_DIR: str = "results"

# ── Signal quality thresholds for SX1262 @ 915 MHz ──────────────────────────
RSSI_GOOD: int = -100       # dBm — above this is "GOOD"
RSSI_MARGINAL: int = -120   # dBm — between GOOD and this is "MARGINAL", below is "LOST"

SNR_GOOD: float = -5.0      # dB  — above this is "GOOD"
SNR_MARGINAL: float = -10.0 # dB  — between GOOD and this is "MARGINAL", below is "LOST"

# Minimum PDR (0.0–1.0) to consider a test point a PASS
PDR_PASS_THRESHOLD: float = 0.90

# ── Packet size test configuration ──────────────────────────────────────────
# Each entry is (target_bytes, label).
#
# How these sizes relate to MeshSOS and LoRa limits:
#   50  bytes — well within SF12 (~51B limit) and SF7 range
#   100 bytes — MeshSOS payload field max (enforced in models.py)
#   150 bytes — above SF12 limit, well within SF7 range
#   200 bytes — near Meshtastic SF7 practical limit (~220B)
#   250 bytes — above SF7 limit; tests firmware drop/error behaviour
#   300 bytes — above SF7 limit; further stress
#   400 bytes — stress test; expected to fail at most spreading factors
#   500 bytes — upper stress test; expected to fail
#
# Meshtastic SF7 text message limit: ~220 bytes
# Meshtastic SF12 text message limit: ~51 bytes
# If sendText() raises an exception for oversized payloads, it will be logged.
PACKET_SIZES: list[tuple[int, str]] = [
    (50,  "within_sf12_limit"),
    (100, "meshsos_payload_max"),
    (150, "above_sf12_below_sf7"),
    (200, "near_sf7_limit"),
    (250, "above_sf7_limit_low"),
    (300, "above_sf7_limit"),
    (400, "stress_test"),
    (500, "upper_stress_test"),
]
