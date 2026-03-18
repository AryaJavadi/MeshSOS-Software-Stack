"""
CSV Result Logger

Appends one row per test point to results/range_log.csv.
Writes the header automatically on first run.
"""

import csv
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import config

COLUMNS = [
    "row_type",      # "ping" for individual pings, "summary" for burst aggregate
    "timestamp",
    "test_num",
    "ping_num",      # ping index within burst (1–N); blank for summary rows
    "distance_m",
    "rssi_dbm",
    "snr_db",
    "hop_limit",
    "hops_taken",
    "route_path",
    "pings_sent",    # always 1 for ping rows, N for summary rows
    "acks_received",
    "pdr_pct",
    "delivered",
    "signal_quality",
]


def _signal_quality(rssi: Optional[float], snr: Optional[float]) -> str:
    if rssi is None:
        return "LOST"
    if rssi > config.RSSI_GOOD and (snr is None or snr > config.SNR_GOOD):
        return "GOOD"
    if rssi > config.RSSI_MARGINAL:
        return "MARGINAL"
    return "LOST"


def _csv_path() -> Path:
    results_dir = Path(__file__).parent / config.RESULTS_DIR
    results_dir.mkdir(parents=True, exist_ok=True)
    return results_dir / "range_log.csv"


def _route_str(route_path: Optional[list[str]]) -> str:
    if route_path is None:
        return "unknown"
    if len(route_path) == 0:
        return "direct"
    return " -> ".join(route_path)


def _append_row(row: dict) -> Path:
    csv_file = _csv_path()
    write_header = not csv_file.exists() or os.path.getsize(csv_file) == 0
    with open(csv_file, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        if write_header:
            writer.writeheader()
        writer.writerow(row)
    return csv_file


def log_ping_row(
    test_num: int,
    ping_num: int,
    distance_m: float,
    rssi: Optional[float],
    snr: Optional[float],
    hop_limit: int,
    hops_taken: Optional[int],
    route_path: Optional[list[str]],
    delivered: bool,
) -> None:
    """Append one row per individual ping to range_log.csv."""
    row = {
        "row_type": "ping",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "test_num": test_num,
        "ping_num": ping_num,
        "distance_m": round(distance_m, 1),
        "rssi_dbm": round(rssi, 1) if rssi is not None else "",
        "snr_db": round(snr, 1) if snr is not None else "",
        "hop_limit": hop_limit,
        "hops_taken": hops_taken if hops_taken is not None else "",
        "route_path": _route_str(route_path),
        "pings_sent": 1,
        "acks_received": 1 if delivered else 0,
        "pdr_pct": 100.0 if delivered else 0.0,
        "delivered": delivered,
        "signal_quality": _signal_quality(rssi, snr),
    }
    _append_row(row)


def log_row(
    test_num: int,
    distance_m: float,
    rssi: Optional[float],
    snr: Optional[float],
    hop_limit: int,
    hops_taken: Optional[int],
    route_path: Optional[list[str]],
    pings_sent: int,
    acks_received: int,
) -> None:
    """Append one summary row (aggregate of the full ping burst) to range_log.csv."""
    pdr_pct = round(acks_received / pings_sent * 100, 1) if pings_sent > 0 else 0.0
    delivered = acks_received > 0

    row = {
        "row_type": "summary",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "test_num": test_num,
        "ping_num": "",
        "distance_m": round(distance_m, 1),
        "rssi_dbm": round(rssi, 1) if rssi is not None else "",
        "snr_db": round(snr, 1) if snr is not None else "",
        "hop_limit": hop_limit,
        "hops_taken": hops_taken if hops_taken is not None else "",
        "route_path": _route_str(route_path),
        "pings_sent": pings_sent,
        "acks_received": acks_received,
        "pdr_pct": pdr_pct,
        "delivered": delivered,
        "signal_quality": _signal_quality(rssi, snr),
    }

    csv_file = _append_row(row)
    print(f"  [log] Saved → {csv_file}")


# ── Packet size log ───────────────────────────────────────────────────────────

PACKET_SIZE_COLUMNS = [
    "timestamp",
    "payload_bytes",
    "label",
    "hop_limit",
    "pings_sent",
    "acks_received",
    "pdr_pct",
    "delivered",
    "avg_rssi_dbm",
    "avg_snr_db",
    "signal_quality",
    "pass_fail",
]


def log_packet_size_row(
    payload_bytes: int,
    label: str,
    hop_limit: int,
    pings_sent: int,
    acks_received: int,
    rssi: Optional[float],
    snr: Optional[float],
) -> None:
    """Append one result row to results/packet_size_log.csv."""
    pdr_pct = round(acks_received / pings_sent * 100, 1) if pings_sent > 0 else 0.0
    delivered = acks_received > 0
    pass_fail = "PASS" if pdr_pct >= config.PDR_PASS_THRESHOLD * 100 else "FAIL"

    row = {
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "payload_bytes": payload_bytes,
        "label": label,
        "hop_limit": hop_limit,
        "pings_sent": pings_sent,
        "acks_received": acks_received,
        "pdr_pct": pdr_pct,
        "delivered": delivered,
        "avg_rssi_dbm": round(rssi, 1) if rssi is not None else "",
        "avg_snr_db": round(snr, 1) if snr is not None else "",
        "signal_quality": _signal_quality(rssi, snr),
        "pass_fail": pass_fail,
    }

    results_dir = Path(__file__).parent / config.RESULTS_DIR
    results_dir.mkdir(parents=True, exist_ok=True)
    csv_file = results_dir / "packet_size_log.csv"
    write_header = not csv_file.exists() or os.path.getsize(csv_file) == 0

    with open(csv_file, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=PACKET_SIZE_COLUMNS)
        if write_header:
            writer.writeheader()
        writer.writerow(row)

    print(f"  [log] Saved → {csv_file}")
