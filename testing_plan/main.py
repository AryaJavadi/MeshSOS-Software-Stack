"""
Meshtastic Range + Packet Size Test — MeshSOS Project

Modes:
    range       — Walk node to increasing distances, press Enter at each point.
                  Logs GPS distance, RSSI, SNR, PDR → results/range_log.csv
    packet-size — Stay at a fixed location. Script automatically cycles through
                  realistic MeshSOS payload sizes and logs PDR per size.
                  → results/packet_size_log.csv

Usage:
    python main.py --port /dev/cu.usbserial-... --remote !9e766d5c --mode range
    python main.py --port /dev/cu.usbserial-... --remote !9e766d5c --mode packet-size

Engineering targets (MeshSOS spec):
    - Range:          2–10 km line-of-sight
    - PDR:            >=90% across 3 hops
    - Max hops:       <=8
    - TX power:       up to 22 dBm  (set in Meshtastic app)
    - Frequency:      915 MHz (Canada/NA)
    - Max payload:    100 bytes (payload field in MeshMessageModel)
    - Worst-case msg: ~230 bytes (all fields + full 100-char payload)
"""

from __future__ import annotations

import argparse
import math
import sys
import time
from pathlib import Path
from typing import Optional

# Allow running as: python main.py (no package install needed)
sys.path.insert(0, str(Path(__file__).parent))

import config
import logger
from receiver import PacketReceiver


# ── Haversine distance (same formula used in backend/routing/engine.py) ──────

def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in metres between two GPS coordinates."""
    R = 6_371_000.0  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Node GPS helpers ─────────────────────────────────────────────────────────

def _extract_lat_lon(pos: dict) -> Optional[tuple[float, float]]:
    """Extract lat/lon from a Meshtastic position dict, handling both float and integer formats."""
    # Float fields (newer firmware / Python API)
    lat = pos.get("latitude")
    lon = pos.get("longitude")
    if lat is not None and lon is not None and (lat != 0.0 or lon != 0.0):
        return float(lat), float(lon)
    # Integer fields (latitudeI/longitudeI are degrees * 1e7)
    lat_i = pos.get("latitudeI")
    lon_i = pos.get("longitudeI")
    if lat_i is not None and lon_i is not None and (lat_i != 0 or lon_i != 0):
        return lat_i / 1e7, lon_i / 1e7
    return None


def get_node_position(interface, node_id: str) -> Optional[tuple[float, float]]:
    """
    Return (lat, lon) for node_id from the Meshtastic node database,
    or None if position is unavailable.

    node_id can be a string like "!9e766d5c" or a numeric int key.
    """
    nodes = interface.nodes or {}

    # Try string key first (e.g. "!9e766d5c"), then strip leading '!'
    for key in [node_id, node_id.lstrip("!")]:
        node_data = nodes.get(key, {})
        pos = node_data.get("position", {})
        if pos:
            result = _extract_lat_lon(pos)
            if result is not None:
                return result

    # Meshtastic sometimes stores nodes by numeric ID
    for key, node_data in nodes.items():
        user = node_data.get("user", {})
        if user.get("id", "") == node_id:
            pos = node_data.get("position", {})
            if pos:
                result = _extract_lat_lon(pos)
                if result is not None:
                    return result

    return None


def _normalize(node_id: str) -> str:
    return node_id.lstrip("!").lower()


def get_my_node_id(interface) -> str:
    try:
        # Try localNode first (meshtastic >= 2.3)
        if hasattr(interface, "localNode") and interface.localNode is not None:
            num = getattr(interface.localNode, "nodeNum", None)
            if num:
                return f"!{num:08x}"
        # Fall back to myInfo dict
        info = interface.myInfo or {}
        node_id = info.get("id") or info.get("user", {}).get("id")
        if node_id:
            return node_id
        # Last resort: find our own entry in the nodes dict
        my_num = info.get("myNodeNum") or info.get("nodeNum")
        if my_num:
            return f"!{my_num:08x}"
    except Exception:
        pass
    return "unknown"


# ── Print helpers ────────────────────────────────────────────────────────────

def print_nodes(interface, filter_ids: Optional[list[str]] = None) -> None:
    nodes = interface.nodes or {}
    print(f"\n  {'Node ID':<16} {'Name':<20} {'GPS'}")
    print(f"  {'─'*16} {'─'*20} {'─'*30}")
    for node_id, node_data in nodes.items():
        if filter_ids is not None:
            user = node_data.get("user", {})
            uid = user.get("id", str(node_id))
            if not any(_normalize(uid) == _normalize(f) for f in filter_ids):
                continue
        user = node_data.get("user", {})
        pos = node_data.get("position", {})
        result = _extract_lat_lon(pos) if pos else None
        gps_str = f"{result[0]:.6f}, {result[1]:.6f}" if result else "no GPS"
        name = user.get("longName") or user.get("shortName") or "?"
        print(f"  {str(node_id):<16} {name:<20} {gps_str}")
    print()


def print_summary(session_results: list[dict]) -> None:
    if not session_results:
        print("\nNo tests completed.")
        return
    print("\n" + "═" * 85)
    print(f"  {'#':<4} {'Dist (m)':<10} {'PDR':<12} {'RSSI (dBm)':<12} {'SNR (dB)':<10} {'Route':<20} {'Result'}")
    print(f"  {'─'*4} {'─'*10} {'─'*12} {'─'*12} {'─'*10} {'─'*20} {'─'*6}")
    for r in session_results:
        dist = f"{r['distance_m']:.0f}"
        pdr = f"{r['acks']}/{r['pings']} ({r['pdr_pct']:.0f}%)"
        rssi = f"{r['rssi']:.1f}" if r["rssi"] is not None else "n/a"
        snr = f"{r['snr']:.1f}" if r["snr"] is not None else "n/a"
        result = "PASS" if r["pdr_pct"] >= config.PDR_PASS_THRESHOLD * 100 else "FAIL"
        route = r.get("route")
        if route is None:
            route_str = "unknown"
        elif len(route) == 0:
            route_str = "direct"
        else:
            route_str = " -> ".join(route)
        print(f"  {r['num']:<4} {dist:<10} {pdr:<12} {rssi:<12} {snr:<10} {route_str:<20} {result}")
    print("═" * 85)


# ── Core test loop ───────────────────────────────────────────────────────────

def run_traceroute(
    interface,
    receiver: PacketReceiver,
    remote_node_id: str,
    hop_limit: int,
    timeout: float = 15.0,
) -> Optional[list[str]]:
    """
    Send a traceroute to remote_node_id and return the list of intermediate node IDs.

    Returns:
        []        — direct link (no relays)
        [id, ...] — packet went through these relay node(s) in order
        None      — traceroute timed out (node unreachable or firmware unsupported)
    """
    print(f"  Traceroute to {remote_node_id}...", end=" ", flush=True)
    receiver.reset_traceroute()
    try:
        # Try interface.sendTraceRoute first (most common in v2.x)
        if hasattr(interface, "sendTraceRoute"):
            interface.sendTraceRoute(dest=remote_node_id, hopLimit=hop_limit)
        elif hasattr(interface, "localNode") and hasattr(interface.localNode, "sendTraceRoute"):
            interface.localNode.sendTraceRoute(dest=remote_node_id, hopLimit=hop_limit)
        else:
            print("unsupported (firmware too old)")
            return None
    except Exception as e:
        print(f"send error: {e}")
        return None

    route = receiver.wait_for_traceroute(timeout=timeout)

    if route is None:
        print("timed out")
        return None
    elif len(route) == 0:
        print("direct (no intermediate hops)")
    else:
        print(f"via {' -> '.join(route)}")

    return route


def run_ping_burst(
    interface,
    receiver: PacketReceiver,
    remote_node_id: str,
    hop_limit: int,
    pings: int,
    ping_interval: float,
    ack_timeout: float,
    test_num: int,
    distance_m: float,
    route: Optional[list[str]],
) -> tuple[int, Optional[float], Optional[float], Optional[int]]:
    """
    Send `pings` messages and count ACKs.
    Logs one 'ping' row per individual ping, returns aggregates for the summary row.

    Returns:
        (acks_received, avg_rssi, avg_snr, avg_hops_taken)
    """
    acks = 0
    rssi_readings: list[float] = []
    snr_readings: list[float] = []
    hops_readings: list[int] = []

    for i in range(1, pings + 1):
        receiver.reset()
        print(f"  Ping {i}/{pings}...", end=" ", flush=True)

        try:
            interface.sendText(
                text="RANGE_TEST_PING",
                destinationId=remote_node_id,
                wantAck=True,
            )
        except Exception as e:
            print(f"send error: {e}")
            logger.log_ping_row(
                test_num=test_num, ping_num=i, distance_m=distance_m,
                rssi=None, snr=None, hop_limit=hop_limit,
                hops_taken=None, route_path=route, delivered=False,
            )
            time.sleep(ping_interval)
            continue

        received, rssi, snr, hops = receiver.wait_for_ack(timeout=ack_timeout)

        if received:
            acks += 1
            rssi_str = f"RSSI={rssi} dBm" if rssi is not None else ""
            snr_str = f"SNR={snr} dB" if snr is not None else ""
            hops_str = f"hops={hops}" if hops is not None else ""
            print(f"ACK  {rssi_str}  {snr_str}  {hops_str}".rstrip())
            if rssi is not None:
                rssi_readings.append(rssi)
            if snr is not None:
                snr_readings.append(snr)
            if hops is not None:
                hops_readings.append(hops)
        else:
            print("LOST (timeout)")

        logger.log_ping_row(
            test_num=test_num, ping_num=i, distance_m=distance_m,
            rssi=rssi if received else None,
            snr=snr if received else None,
            hop_limit=hop_limit,
            hops_taken=hops if received else None,
            route_path=route, delivered=received,
        )

        if i < pings:
            time.sleep(ping_interval)

    avg_rssi = sum(rssi_readings) / len(rssi_readings) if rssi_readings else None
    avg_snr = sum(snr_readings) / len(snr_readings) if snr_readings else None
    avg_hops = round(sum(hops_readings) / len(hops_readings)) if hops_readings else None
    return acks, avg_rssi, avg_snr, avg_hops


def _make_payload(target_bytes: int) -> str:
    """
    Build a string of exactly target_bytes UTF-8 bytes.

    Uses a realistic MeshSOS-style prefix so the packet isn't just garbage,
    then pads with 'X' characters to hit the exact byte count.
    """
    prefix = "MESHSOS_SIZE_TEST:"
    pad_needed = target_bytes - len(prefix.encode("utf-8"))
    if pad_needed <= 0:
        return prefix[:target_bytes]
    return prefix + ("X" * pad_needed)


def run_packet_size_test(args, interface) -> None:
    """
    Packet size test mode.

    Stays at a fixed location and automatically cycles through all sizes
    defined in config.PACKET_SIZES, sending PINGS_PER_POINT pings at each.
    Logs results to results/packet_size_log.csv.
    """
    remote_id = args.remote
    hop_limit = args.hop_limit
    receiver = PacketReceiver(remote_id)
    receiver.subscribe()

    my_id = get_my_node_id(interface)
    print(f"\nBase node  : {my_id}")
    print(f"Remote node: {remote_id}")
    print(f"Hop limit  : {hop_limit}")
    print(f"Pings/size : {config.PINGS_PER_POINT}")
    print(f"ACK timeout: {config.ACK_TIMEOUT_S}s")
    print(f"\nPacket sizes to test: {[s for s, _ in config.PACKET_SIZES]} bytes\n")

    print("Waiting for nodes to appear on mesh...")
    time.sleep(3)
    print_nodes(interface, filter_ids=[my_id, remote_id])

    print("=" * 60)
    print("  Stay at your test location — sizes cycle automatically.")
    print("  Press Ctrl+C to abort.")
    print("=" * 60)

    size_results: list[dict] = []

    try:
        for target_bytes, label in config.PACKET_SIZES:
            payload = _make_payload(target_bytes)
            actual_bytes = len(payload.encode("utf-8"))

            print(f"\n── {actual_bytes} bytes  [{label}] {'─' * 30}")

            acks = 0
            rssi_readings: list[float] = []
            snr_readings: list[float] = []

            for i in range(1, config.PINGS_PER_POINT + 1):
                receiver.reset()
                print(f"  Ping {i}/{config.PINGS_PER_POINT} ({actual_bytes}B)...", end=" ", flush=True)

                try:
                    interface.sendText(
                        text=payload,
                        destinationId=remote_id,
                        wantAck=True,
                    )
                except Exception as e:
                    print(f"send error: {e}")
                    time.sleep(config.PING_INTERVAL_S)
                    continue

                received, rssi, snr, _ = receiver.wait_for_ack(timeout=config.ACK_TIMEOUT_S)

                if received:
                    acks += 1
                    rssi_str = f"RSSI={rssi} dBm" if rssi is not None else ""
                    snr_str = f"SNR={snr} dB" if snr is not None else ""
                    print(f"ACK  {rssi_str}  {snr_str}".rstrip())
                    if rssi is not None:
                        rssi_readings.append(rssi)
                    if snr is not None:
                        snr_readings.append(snr)
                else:
                    print("LOST (timeout)")

                if i < config.PINGS_PER_POINT:
                    time.sleep(config.PING_INTERVAL_S)

            avg_rssi = sum(rssi_readings) / len(rssi_readings) if rssi_readings else None
            avg_snr = sum(snr_readings) / len(snr_readings) if snr_readings else None
            pdr_pct = acks / config.PINGS_PER_POINT * 100
            pass_fail = "PASS" if pdr_pct >= config.PDR_PASS_THRESHOLD * 100 else "FAIL"

            print(f"\n  {pass_fail}  PDR={acks}/{config.PINGS_PER_POINT} ({pdr_pct:.0f}%)", end="")
            if avg_rssi is not None:
                print(f"  RSSI={avg_rssi:.1f} dBm", end="")
            if avg_snr is not None:
                print(f"  SNR={avg_snr:.1f} dB", end="")
            print()

            logger.log_packet_size_row(
                payload_bytes=actual_bytes,
                label=label,
                hop_limit=hop_limit,
                pings_sent=config.PINGS_PER_POINT,
                acks_received=acks,
                rssi=avg_rssi,
                snr=avg_snr,
            )

            size_results.append({
                "bytes": actual_bytes,
                "label": label,
                "pings": config.PINGS_PER_POINT,
                "acks": acks,
                "pdr_pct": pdr_pct,
                "rssi": avg_rssi,
                "snr": avg_snr,
            })

            # Brief pause between size tiers
            if (target_bytes, label) != config.PACKET_SIZES[-1]:
                time.sleep(2)

    except KeyboardInterrupt:
        pass

    print_packet_size_summary(size_results)


def print_packet_size_summary(size_results: list[dict]) -> None:
    if not size_results:
        print("\nNo packet size tests completed.")
        return
    print("\n" + "═" * 80)
    print(f"  {'Bytes':<8} {'Label':<30} {'PDR':<12} {'RSSI (dBm)':<12} {'SNR (dB)':<10} {'Result'}")
    print(f"  {'─'*8} {'─'*30} {'─'*12} {'─'*12} {'─'*10} {'─'*6}")
    for r in size_results:
        pdr = f"{r['acks']}/{r['pings']} ({r['pdr_pct']:.0f}%)"
        rssi = f"{r['rssi']:.1f}" if r["rssi"] is not None else "n/a"
        snr = f"{r['snr']:.1f}" if r["snr"] is not None else "n/a"
        result = "PASS" if r["pdr_pct"] >= config.PDR_PASS_THRESHOLD * 100 else "FAIL"
        print(f"  {r['bytes']:<8} {r['label']:<30} {pdr:<12} {rssi:<12} {snr:<10} {result}")

    # Find the largest size that still passes
    passing = [r for r in size_results if r["pdr_pct"] >= config.PDR_PASS_THRESHOLD * 100]
    if passing:
        max_pass = max(passing, key=lambda r: r["bytes"])
        print(f"\n  Max reliable size: {max_pass['bytes']} bytes ({max_pass['label']})")
        if max_pass["bytes"] >= 300:
            print("  Firmware handles oversized packets — check if fragmentation is occurring.")
        elif max_pass["bytes"] >= 200:
            print("  Near SF7 limit (200B) reliable. MeshSOS 100B payload spec has good headroom.")
        elif max_pass["bytes"] >= 100:
            print("  MeshSOS 100B payload max is reliable. Larger messages will degrade.")
        else:
            print("  Warning: Even MeshSOS payload max (100B) may be unreliable at this distance/SF.")
    else:
        print("\n  No sizes passed — check node connection and signal quality.")
    print("═" * 80)


def run_test(args, interface) -> None:
    remote_id = args.remote
    hop_limit = args.hop_limit
    receiver = PacketReceiver(remote_id)
    receiver.subscribe()

    my_id = get_my_node_id(interface)
    print(f"\nBase node  : {my_id}")
    print(f"Remote node: {remote_id}")
    print(f"Hop limit  : {hop_limit}")
    print(f"Pings/point: {config.PINGS_PER_POINT}")
    print(f"ACK timeout: {config.ACK_TIMEOUT_S}s\n")

    print("Waiting for nodes to appear on mesh...")
    time.sleep(3)
    print_nodes(interface, filter_ids=[my_id, remote_id])

    # Verify remote node is visible
    if get_node_position(interface, remote_id) is None:
        print(
            f"Warning: remote node {remote_id} has no GPS yet.\n"
            "Make sure both nodes have GPS lock and are on the same mesh.\n"
            "Proceeding anyway — GPS will be re-checked at each test point.\n"
        )

    session_results: list[dict] = []
    test_num = 0
    traceroute_enabled = not args.skip_traceroute

    print("=" * 60)
    print("  Press Enter when the walker is at a new test position.")
    print("  Press Ctrl+C to end the session and print summary.")
    print("=" * 60)

    try:
        while True:
            try:
                input(f"\n[Test {test_num + 1}] Press Enter to start ping burst > ")
            except EOFError:
                break

            test_num += 1
            print(f"\n── Test {test_num} ──────────────────────────────────")

            # Refresh GPS from node list
            base_pos = get_node_position(interface, my_id)
            remote_pos = get_node_position(interface, remote_id)

            base_gps = f"{base_pos[0]:.5f}, {base_pos[1]:.5f}" if base_pos else "no GPS"
            remote_gps = f"{remote_pos[0]:.5f}, {remote_pos[1]:.5f}" if remote_pos else "no GPS"
            print(f"  Base  GPS: {base_gps}")
            print(f"  Remote GPS: {remote_gps}")

            distance_m: float = 0.0
            if base_pos is not None and remote_pos is not None:
                distance_m = haversine_m(*base_pos, *remote_pos)
                if distance_m < 5.0:
                    print(f"GPS distance: {distance_m:.1f} m — nodes appear co-located (same spot or GPS drift).")
                else:
                    print(f"GPS distance: {distance_m:.1f} m ({distance_m/1000:.3f} km)")
            else:
                missing = []
                if base_pos is None:
                    missing.append("base node")
                if remote_pos is None:
                    missing.append("remote node")
                print(
                    f"Warning: GPS unavailable for {' and '.join(missing)} — "
                    "no satellite fix yet. Distance logged as 0. "
                    "Take nodes outside for a GPS lock."
                )

            # Run traceroute to confirm relay path (skip if disabled or previously timed out)
            route: Optional[list[str]] = None
            if traceroute_enabled:
                route = run_traceroute(
                    interface=interface,
                    receiver=receiver,
                    remote_node_id=remote_id,
                    hop_limit=hop_limit,
                )
                if route is None:
                    print("  [traceroute] Timed out — skipping traceroute for remaining tests.")
                    traceroute_enabled = False
            else:
                print("  [traceroute] Skipped.")

            acks, avg_rssi, avg_snr, avg_hops = run_ping_burst(
                interface=interface,
                receiver=receiver,
                remote_node_id=remote_id,
                hop_limit=hop_limit,
                pings=config.PINGS_PER_POINT,
                ping_interval=config.PING_INTERVAL_S,
                ack_timeout=config.ACK_TIMEOUT_S,
                test_num=test_num,
                distance_m=distance_m,
                route=route,
            )

            pdr_pct = acks / config.PINGS_PER_POINT * 100
            result_label = "PASS" if pdr_pct >= config.PDR_PASS_THRESHOLD * 100 else "FAIL"

            print(f"\n  Result  : {result_label}")
            print(f"  PDR     : {acks}/{config.PINGS_PER_POINT} ({pdr_pct:.0f}%)")
            if avg_rssi is not None:
                print(f"  Avg RSSI: {avg_rssi:.1f} dBm")
            if avg_snr is not None:
                print(f"  Avg SNR : {avg_snr:.1f} dB")
            if avg_hops is not None:
                print(f"  Avg hops: {avg_hops}")
            print(f"  Distance: {distance_m:.1f} m")
            if route is not None:
                route_display = "direct" if len(route) == 0 else " -> ".join(route)
                print(f"  Route   : {route_display}")

            logger.log_row(
                test_num=test_num,
                distance_m=distance_m,
                rssi=avg_rssi,
                snr=avg_snr,
                hop_limit=hop_limit,
                hops_taken=avg_hops,
                route_path=route,
                pings_sent=config.PINGS_PER_POINT,
                acks_received=acks,
            )

            session_results.append({
                "num": test_num,
                "distance_m": distance_m,
                "pings": config.PINGS_PER_POINT,
                "acks": acks,
                "pdr_pct": pdr_pct,
                "rssi": avg_rssi,
                "snr": avg_snr,
                "route": route,
            })

    except KeyboardInterrupt:
        pass

    print_summary(session_results)


# ── Entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="MeshSOS Meshtastic Range + Packet Size Test",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Range test — walk node outward, press Enter at each distance point
  python main.py --port /dev/cu.usbserial-ABC123 --remote !9e766d5c --mode range

  # Packet size test — stay put, script cycles through payload sizes automatically
  python main.py --port /dev/cu.usbserial-ABC123 --remote !9e766d5c --mode packet-size

  # Multi-hop range test with hop limit 5
  python main.py --port /dev/ttyUSB0 --remote !9e766d5c --mode range --hop-limit 5
        """,
    )
    parser.add_argument(
        "--port",
        default=config.SERIAL_PORT,
        help=f"Serial port of base node (default from config: {config.SERIAL_PORT})",
    )
    parser.add_argument(
        "--remote",
        default=config.REMOTE_NODE_ID,
        help="Node ID of the remote (walking) node, e.g. !9e766d5c",
    )
    parser.add_argument(
        "--hop-limit",
        type=int,
        default=config.HOP_LIMIT,
        help=f"Hop limit for test messages (default: {config.HOP_LIMIT})",
    )
    parser.add_argument(
        "--mode",
        choices=["range", "packet-size"],
        default="range",
        help="Test mode: 'range' (walk + GPS) or 'packet-size' (fixed location, vary payload size)",
    )
    parser.add_argument(
        "--skip-traceroute",
        action="store_true",
        default=False,
        help="Skip traceroute before each ping burst (use if remote node does not support it)",
    )
    args = parser.parse_args()

    if args.remote == "!REPLACE_ME":
        print("Error: set REMOTE_NODE_ID in config.py or pass --remote !<node_id>")
        sys.exit(1)

    try:
        import meshtastic
        import meshtastic.serial_interface
    except ImportError:
        print("Meshtastic library not installed. Run: pip install meshtastic")
        sys.exit(1)

    import os
    if not os.path.exists(args.port):
        print(f"Serial device '{args.port}' not found.")
        print("On macOS, run: ls /dev/cu.* to find your device.")
        print("On Linux, run: ls /dev/ttyUSB* /dev/ttyACM*")
        sys.exit(1)

    print(f"Connecting to base node on {args.port}...")
    interface = None
    try:
        interface = meshtastic.serial_interface.SerialInterface(devPath=args.port)
        print("Connected.")
        if args.mode == "packet-size":
            run_packet_size_test(args, interface)
        else:
            run_test(args, interface)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        if interface is not None:
            try:
                interface.close()
            except Exception:
                pass
        print("Interface closed. Done.")


if __name__ == "__main__":
    main()
