"""
Meshtastic Packet Receiver

Subscribes to all incoming Meshtastic packets via PyPubSub.
Tracks ACKs, signal metrics (RSSI/SNR), and traceroute responses.
"""

import threading
from typing import Optional


def _normalize_id(node_id: str) -> str:
    """Strip leading '!' for comparison."""
    return node_id.lstrip("!")


def _num_to_id(num: int) -> str:
    """Convert a Meshtastic numeric node ID to the hex string format (!xxxxxxxx)."""
    return f"!{num:08x}"


class PacketReceiver:
    """
    Listens for Meshtastic packets from a target node.
    Exposes wait_for_ack() for ping bursts and wait_for_traceroute() for path verification.
    """

    def __init__(self, remote_node_id: str) -> None:
        self._remote_node_id = remote_node_id

        # ACK state
        self._ack_lock = threading.Lock()
        self._ack_event = threading.Event()
        self._last_rssi: Optional[float] = None
        self._last_snr: Optional[float] = None
        self._last_hops_taken: Optional[int] = None

        # Traceroute state
        self._tr_lock = threading.Lock()
        self._tr_event = threading.Event()
        self._last_route: list[str] = []

    def subscribe(self) -> None:
        """Register this receiver with the Meshtastic pubsub system."""
        try:
            from pubsub import pub
        except ImportError:
            from PyPubSub import pub

        pub.subscribe(self._on_packet, "meshtastic.receive")

    def _on_packet(self, packet: dict, interface) -> None:
        """Called for every received Meshtastic packet."""
        try:
            from_id = str(packet.get("fromId") or packet.get("from") or "")
            portnum = packet.get("decoded", {}).get("portnum", "")
            rssi = packet.get("rxRssi")
            snr = packet.get("rxSnr")
            hop_start = packet.get("hopStart")
            hop_limit = packet.get("hopLimit")

            # ── Traceroute response ──────────────────────────────────────────
            if portnum == "TRACEROUTE_APP" or portnum == 70:
                self._handle_traceroute(packet, from_id)
                return

            # ── ACK / reply from remote node ─────────────────────────────────
            if _normalize_id(from_id) == _normalize_id(self._remote_node_id):
                hops_taken: Optional[int] = None
                if hop_start is not None and hop_limit is not None:
                    hops_taken = int(hop_start) - int(hop_limit)

                with self._ack_lock:
                    if rssi is not None:
                        self._last_rssi = float(rssi)
                    if snr is not None:
                        self._last_snr = float(snr)
                    if hops_taken is not None:
                        self._last_hops_taken = hops_taken
                self._ack_event.set()

        except Exception as e:
            print(f"  [receiver] Error handling packet: {e}")

    def _handle_traceroute(self, packet: dict, from_id: str) -> None:
        """Parse a traceroute response and store the route."""
        try:
            tr = packet.get("decoded", {}).get("traceroute", {})

            # route = intermediate nodes on the forward path (list of ints)
            route_nums: list[int] = tr.get("route", [])
            # routeBack = intermediate nodes on the return path (newer firmware)
            route_back_nums: list[int] = tr.get("routeBack", [])

            route_ids = [_num_to_id(n) for n in route_nums]
            route_back_ids = [_num_to_id(n) for n in route_back_nums]

            # Build a human-readable path:
            # base → [relays] → remote → [return relays] → base
            full_route = route_ids if route_ids else route_back_ids

            print(f"  [traceroute] from={from_id}  route={full_route}")

            with self._tr_lock:
                self._last_route = full_route
            self._tr_event.set()

        except Exception as e:
            print(f"  [traceroute] Error parsing response: {e}")

    # ── Public API ────────────────────────────────────────────────────────────

    def wait_for_ack(
        self, timeout: float
    ) -> tuple[bool, Optional[float], Optional[float], Optional[int]]:
        """
        Block until a packet from the remote node arrives or timeout expires.

        Returns:
            (received, rssi_dbm, snr_db, hops_taken)
        """
        self._ack_event.clear()
        received = self._ack_event.wait(timeout=timeout)
        with self._ack_lock:
            rssi = self._last_rssi
            snr = self._last_snr
            hops = self._last_hops_taken
        return received, rssi, snr, hops

    def reset_traceroute(self) -> None:
        """Clear traceroute state before sending a new traceroute request."""
        with self._tr_lock:
            self._last_route = []
        self._tr_event.clear()

    def wait_for_traceroute(self, timeout: float = 15.0) -> Optional[list[str]]:
        """
        Block until a traceroute response arrives or timeout expires.

        Call reset_traceroute() before sending the traceroute request to avoid
        race conditions where the response arrives before wait is entered.

        Returns:
            List of intermediate node IDs (e.g. ["!ab12cd34"]), or None on timeout.
            An empty list means the packet arrived with no intermediate hops (direct link).
        """
        received = self._tr_event.wait(timeout=timeout)
        if not received:
            return None
        with self._tr_lock:
            return list(self._last_route)

    def reset(self) -> None:
        """Clear ACK state between pings."""
        with self._ack_lock:
            self._last_rssi = None
            self._last_snr = None
            self._last_hops_taken = None
        self._ack_event.clear()
