/**
 * MockBLEService — simulates a connected MeshSOS LoRa node.
 *
 * Used when MOCK_MODE = true (see config.ts). No Bluetooth hardware required.
 * Provides realistic latency, RSSI drift, ACK delivery, and incoming messages
 * so the full UI/UX can be developed and demoed without physical hardware.
 */

import * as Location from 'expo-location';
import { useBLEStore } from '@/store/bleStore';
import { useRequestStore } from '@/store/requestStore';
import { useMessageStore } from '@/store/messageStore';
import { NetworkStatus, NodeInfo, SupplyRequest } from '@/types';
import { RSSI_POLL_INTERVAL_MS } from '@/constants/ble';
import { IBLEService } from './bleInterface';
import { API_URL } from '@/config';

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_NODE: NodeInfo = {
  deviceId: 'mock-device-001',
  nodeId: 'A2F4',
  firmwareVersion: '1.0.0-mock',
};

function buildMockNetwork(baseLat: number, baseLon: number): NetworkStatus {
  const now = Date.now();
  return {
    rssi: -71,
    hopCount: 3,
    gatewayReachable: true,
    totalDistanceKm: 4.1,
    hopChain: ['you', 'B91C', 'D7E2', 'GW-01'],
    nodes: [
      { nodeId: 'B91C',  status: 'online',  rssi: -68,  hopCount: 1, distanceKm: 0.8, mapX: 0.72, mapY: 0.30, latitude: baseLat + 0.003, longitude: baseLon + 0.005, lastSeenAt: now },
      { nodeId: 'C44D',  status: 'weak',    rssi: -84,  hopCount: 1, distanceKm: 1.3, mapX: 0.25, mapY: 0.33, latitude: baseLat - 0.004, longitude: baseLon - 0.003, lastSeenAt: now - 8 * 60 * 1000 },
      { nodeId: 'D7E2',  status: 'online',  rssi: -76,  hopCount: 2, distanceKm: 2.4, mapX: 0.75, mapY: 0.67, latitude: baseLat + 0.006, longitude: baseLon + 0.008, lastSeenAt: now - 3 * 60 * 1000 },
      { nodeId: 'F5A1',  status: 'offline', rssi: -115, hopCount: 1, distanceKm: 2.1, mapX: 0.25, mapY: 0.73, latitude: baseLat - 0.007, longitude: baseLon - 0.006, lastSeenAt: now - 31 * 60 * 1000 },
      { nodeId: 'GW-01', status: 'gateway', rssi: -82,  hopCount: 3, distanceKm: 4.1, mapX: 0.88, mapY: 0.18, latitude: baseLat + 0.010, longitude: baseLon + 0.015, lastSeenAt: now - 5 * 60 * 1000 },
    ],
    links: [
      { fromNodeId: 'you',  toNodeId: 'B91C',  rssi: -68 },
      { fromNodeId: 'you',  toNodeId: 'C44D',  rssi: -84 },
      { fromNodeId: 'you',  toNodeId: 'D7E2',  rssi: -76 },
      { fromNodeId: 'you',  toNodeId: 'F5A1',  rssi: -115 },
      { fromNodeId: 'B91C', toNodeId: 'GW-01', rssi: -72 },
      { fromNodeId: 'D7E2', toNodeId: 'GW-01', rssi: -80 },
    ],
  };
}

// ─── MockBLEService ───────────────────────────────────────────────────────────

export class MockBLEService implements IBLEService {
  private rssiTimer: ReturnType<typeof setInterval> | null = null;
  private messageTimers: ReturnType<typeof setTimeout>[] = [];

  initialize() {
    // Nothing to set up in mock mode
  }

  async startScan() {
    const { setConnectionState, setScanError, setConnectedNode, setNetwork } = useBLEStore.getState();

    setConnectionState('scanning');
    setScanError(null);

    // Simulate a realistic 2-second scan delay
    await new Promise((r) => setTimeout(r, 2000));

    // Use real GPS if available so mock nodes appear near the user's actual location
    let baseLat = 37.7749;
    let baseLon = -122.4194;
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        baseLat = loc.coords.latitude;
        baseLon = loc.coords.longitude;
      }
    } catch {}

    setConnectedNode(MOCK_NODE);
    setNetwork(buildMockNetwork(baseLat, baseLon));
    setConnectionState('connected');

    this.startMockRssiPoll();
    this.scheduleMockMessages();
  }

  stopScan() {
    // No-op: mock scan completes immediately after the simulated delay
  }

  async sendRequest(request: SupplyRequest): Promise<boolean> {
    // Simulate transmission delay, then deliver ACKs at realistic intervals
    await new Promise((r) => setTimeout(r, 1000));

    // Forward to local backend so the request appears on the responder dashboard.
    // Non-fatal: if the backend is not running the civilian app still works fine.
    const connectedNode = useBLEStore.getState().connectedNode;
    try {
      await fetch(`${API_URL}/supply-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          connectedNodeId: connectedNode?.nodeId ?? 'MOCK',
        }),
      });
    } catch {
      // Backend not running — mock ACKs still fire normally
    }

    const t1 = setTimeout(() => {
      useRequestStore.getState().applyAck({
        requestId: request.id,
        status: 'relayed',
        relayNodeId: 'B91C',
        timestamp: Date.now(),
      });
    }, 3000);

    const t2 = setTimeout(() => {
      useRequestStore.getState().applyAck({
        requestId: request.id,
        status: 'received',
        timestamp: Date.now(),
      });
    }, 8000);

    this.messageTimers.push(t1, t2);
    return true;
  }

  disconnect() {
    this.clearTimers();
    useBLEStore.getState().disconnect();
  }

  destroy() {
    this.stopScan();
    this.clearTimers();
  }

  get isConnected(): boolean {
    return useBLEStore.getState().connectionState === 'connected';
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private startMockRssiPoll() {
    this.rssiTimer = setInterval(() => {
      const current = useBLEStore.getState().network;
      if (!current) return;
      // Gentle ±2 dBm drift for realism
      const drift = Math.floor(Math.random() * 5) - 2;
      const newRssi = Math.max(-95, Math.min(-50, current.rssi + drift));
      useBLEStore.getState().setNetwork({ ...current, rssi: newRssi });
    }, RSSI_POLL_INTERVAL_MS);
  }

  private scheduleMockMessages() {
    const session = Date.now();
    const { addMessage, setLastSynced, markAllRead } = useMessageStore.getState();

    // Seed historical messages immediately so the activity feed is pre-populated
    addMessage({ id: `mock-hist-${session}-a`, timestamp: session - 13 * 60 * 1000, fromNodeId: 'GW-01', content: 'Request received. Emergency teams are being coordinated for your area.', type: 'info' });
    addMessage({ id: `mock-hist-${session}-b`, timestamp: session - 9 * 60 * 1000,  fromNodeId: 'GW-01', content: 'Supply drop (water + food rations) is en route to your location. ETA: ~25 minutes.', type: 'action' });
    addMessage({ id: `mock-hist-${session}-c`, timestamp: session - 3 * 60 * 1000,  fromNodeId: 'GW-01', content: 'URGENT: Please move to Oak Street Community Center. Medical assistance and additional supplies are available there.', type: 'urgent' });
    markAllRead();
    setLastSynced('B91C', session - 60 * 1000);

    // Schedule new messages that arrive during the session (these come in unread)
    const t1 = setTimeout(() => {
      addMessage({ id: `mock-msg-${session}-1`, timestamp: Date.now(), fromNodeId: 'GW-01', content: 'Update: A second supply team has been dispatched. Estimated arrival in 10 minutes.', type: 'action' });
      setLastSynced('B91C', Date.now());
    }, 20000);

    const t2 = setTimeout(() => {
      addMessage({ id: `mock-msg-${session}-2`, timestamp: Date.now(), fromNodeId: 'GW-01', content: 'All clear in your sector. Please confirm you have received supplies.', type: 'info' });
      setLastSynced('B91C', Date.now());
    }, 40000);

    this.messageTimers.push(t1, t2);
  }

  private clearTimers() {
    if (this.rssiTimer) { clearInterval(this.rssiTimer); this.rssiTimer = null; }
    this.messageTimers.forEach(clearTimeout);
    this.messageTimers = [];
  }
}
