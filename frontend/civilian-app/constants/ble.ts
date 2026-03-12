// MeshSOS BLE GATT Profile
// These UUIDs are placeholders — coordinate with hardware team for final values

export const MESHSOS_SERVICE_UUID = '0000ABCD-0000-1000-8000-00805F9B34FB';

export const CHARACTERISTICS = {
  // Read: returns JSON { nodeId: string, firmwareVersion: string }
  NODE_INFO: '0000AB01-0000-1000-8000-00805F9B34FB',

  // Read + Notify: returns JSON { rssi: number, hopCount: number, gatewayReachable: boolean, topology: NodeTopology[] }
  NETWORK_STATUS: '0000AB02-0000-1000-8000-00805F9B34FB',

  // Write: accepts encoded SupplyRequest JSON
  SEND_REQUEST: '0000AB03-0000-1000-8000-00805F9B34FB',

  // Notify: fires when relay ACK received { requestId: string, status: 'relayed' | 'received', relayNodeId?: string }
  REQUEST_ACK: '0000AB04-0000-1000-8000-00805F9B34FB',
} as const;

// Scanning timeout in ms
export const SCAN_TIMEOUT_MS = 15_000;

// RSSI polling interval in ms
export const RSSI_POLL_INTERVAL_MS = 3_000;

// Message retry interval in ms (when queued and connected)
export const RETRY_INTERVAL_MS = 30_000;

// RSSI signal quality thresholds (dBm)
export const RSSI_THRESHOLDS = {
  STRONG: -50,
  GOOD: -70,
  FAIR: -90,
  WEAK: -120,
} as const;

export type SignalQuality = 'strong' | 'good' | 'fair' | 'weak';

export function getRssiQuality(rssi: number): SignalQuality {
  if (rssi >= RSSI_THRESHOLDS.STRONG) return 'strong';
  if (rssi >= RSSI_THRESHOLDS.GOOD) return 'good';
  if (rssi >= RSSI_THRESHOLDS.FAIR) return 'fair';
  return 'weak';
}

export function getSignalBars(rssi: number): number {
  if (rssi >= RSSI_THRESHOLDS.STRONG) return 4;
  if (rssi >= RSSI_THRESHOLDS.GOOD) return 3;
  if (rssi >= RSSI_THRESHOLDS.FAIR) return 2;
  if (rssi >= -105) return 1;
  return 0;
}
