/**
 * BLEService — real LoRa node integration via react-native-ble-plx.
 *
 * This file contains only the production BLE logic.
 * For mock / simulator usage, see services/mockBle.ts.
 * To switch modes, set MOCK_MODE in config.ts.
 */

import { Platform } from 'react-native';
import { BleManager, Device, Characteristic, BleError } from 'react-native-ble-plx';
import { useBLEStore } from '@/store/bleStore';
import { useRequestStore } from '@/store/requestStore';
import { useMessageStore } from '@/store/messageStore';
import {
  MESHSOS_SERVICE_UUID,
  CHARACTERISTICS,
  SCAN_TIMEOUT_MS,
  RSSI_POLL_INTERVAL_MS,
} from '@/constants/ble';
import { clearAllRequests } from './messageQueue';
import { NetworkStatus, NodeInfo, RequestAck, SupplyRequest } from '@/types';
import { IBLEService } from './bleInterface';
import { MockBLEService } from './mockBle';
import { MOCK_MODE } from '@/config';

// ─── Real BLE service ─────────────────────────────────────────────────────────

class BLEService implements IBLEService {
  private manager: BleManager | null = null;
  private connectedDevice: Device | null = null;
  private rssiTimer: ReturnType<typeof setInterval> | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;

  initialize() {
    if (Platform.OS === 'web') return;
    this.manager = new BleManager();
  }

  destroy() {
    this.stopScan();
    this.clearTimers();
    if (this.manager) {
      this.manager.destroy();
      this.manager = null;
    }
  }

  // ─── Scanning ──────────────────────────────────────────────────────────────

  async startScan() {
    if (!this.manager) return;
    const { setConnectionState, setScanError } = useBLEStore.getState();

    setConnectionState('scanning');
    setScanError(null);

    this.scanTimer = setTimeout(() => {
      this.stopScan();
      const state = useBLEStore.getState();
      if (state.connectionState === 'scanning') {
        setConnectionState('idle');
        setScanError('No MeshSOS node found nearby. Make sure the device is powered on and within 10m.');
      }
    }, SCAN_TIMEOUT_MS);

    this.manager.startDeviceScan(
      [MESHSOS_SERVICE_UUID],
      { allowDuplicates: false },
      (error: BleError | null, device: Device | null) => {
        if (error) {
          setScanError(error.message);
          setConnectionState('error');
          return;
        }
        if (device) {
          this.stopScan();
          this.connectToDevice(device);
        }
      }
    );
  }

  stopScan() {
    if (this.manager) this.manager.stopDeviceScan();
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
  }

  // ─── Connection ────────────────────────────────────────────────────────────

  private async connectToDevice(device: Device) {
    const { setConnectionState, setConnectedNode, setNetwork, setScanError } = useBLEStore.getState();

    try {
      setConnectionState('connecting');
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      this.connectedDevice = connected;

      const nodeInfoChar = await connected.readCharacteristicForService(
        MESHSOS_SERVICE_UUID,
        CHARACTERISTICS.NODE_INFO
      );
      const nodeInfo: NodeInfo = JSON.parse(
        Buffer.from(nodeInfoChar.value ?? '', 'base64').toString('utf8')
      );

      const netChar = await connected.readCharacteristicForService(
        MESHSOS_SERVICE_UUID,
        CHARACTERISTICS.NETWORK_STATUS
      );
      const network: NetworkStatus = JSON.parse(
        Buffer.from(netChar.value ?? '', 'base64').toString('utf8')
      );

      setConnectedNode({ ...nodeInfo, deviceId: device.id });
      setNetwork(network);
      setConnectionState('connected');

      this.subscribeNetworkStatus(connected);
      this.subscribeRequestAck(connected);
      this.startRssiPoll(connected);
    } catch (err: any) {
      setScanError(err.message ?? 'Failed to connect to node');
      setConnectionState('error');
    }
  }

  private subscribeNetworkStatus(device: Device) {
    device.monitorCharacteristicForService(
      MESHSOS_SERVICE_UUID,
      CHARACTERISTICS.NETWORK_STATUS,
      (err: BleError | null, char: Characteristic | null) => {
        if (err || !char?.value) return;
        const network: NetworkStatus = JSON.parse(
          Buffer.from(char.value, 'base64').toString('utf8')
        );
        useBLEStore.getState().setNetwork(network);
      }
    );
  }

  private subscribeRequestAck(device: Device) {
    device.monitorCharacteristicForService(
      MESHSOS_SERVICE_UUID,
      CHARACTERISTICS.REQUEST_ACK,
      (err: BleError | null, char: Characteristic | null) => {
        if (err || !char?.value) return;
        const ack: RequestAck = JSON.parse(
          Buffer.from(char.value, 'base64').toString('utf8')
        );
        useRequestStore.getState().applyAck(ack);
      }
    );
  }

  private startRssiPoll(device: Device) {
    this.rssiTimer = setInterval(async () => {
      try {
        const updatedDevice = await device.readRSSI();
        const rssi = updatedDevice.rssi ?? 0;
        const current = useBLEStore.getState().network;
        if (current) {
          useBLEStore.getState().setNetwork({ ...current, rssi });
        }
      } catch {
        this.handleDisconnect();
      }
    }, RSSI_POLL_INTERVAL_MS);
  }

  private clearTimers() {
    if (this.rssiTimer) { clearInterval(this.rssiTimer); this.rssiTimer = null; }
  }

  private handleDisconnect() {
    this.clearTimers();
    useRequestStore.getState().clearRequests();
    clearAllRequests();
    useBLEStore.getState().disconnect();
  }

  // ─── Sending requests ──────────────────────────────────────────────────────

  async sendRequest(request: SupplyRequest): Promise<boolean> {
    if (!this.connectedDevice) return false;
    try {
      const encoded = Buffer.from(JSON.stringify(request), 'utf8').toString('base64');
      await this.connectedDevice.writeCharacteristicWithResponseForService(
        MESHSOS_SERVICE_UUID,
        CHARACTERISTICS.SEND_REQUEST,
        encoded
      );
      return true;
    } catch {
      return false;
    }
  }

  disconnect() {
    this.connectedDevice?.cancelConnection();
    this.handleDisconnect();
  }

  get isConnected(): boolean {
    return useBLEStore.getState().connectionState === 'connected';
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────
// Flip MOCK_MODE in config.ts to switch between mock and real hardware.

export const bleService: IBLEService = MOCK_MODE ? new MockBLEService() : new BLEService();
