import { SupplyRequest } from '@/types';

/**
 * Contract that both MockBLEService and BLEService (real) must satisfy.
 * When adding a new transport (e.g. USB serial, Wi-Fi), implement this
 * interface and swap it in via MOCK_MODE / config.ts.
 */
export interface IBLEService {
  /** One-time setup. Called from the root layout on app start. */
  initialize(): void;

  /** Start scanning for a nearby MeshSOS node. */
  startScan(): Promise<void>;

  /** Abort an in-progress scan. */
  stopScan(): void;

  /** Transmit a supply request to the connected node. Returns true on success. */
  sendRequest(request: SupplyRequest): Promise<boolean>;

  /** Gracefully close the active connection. */
  disconnect(): void;

  /** Full teardown — called when the app is unmounted. */
  destroy(): void;

  /** True when a node is currently connected. */
  readonly isConnected: boolean;
}
