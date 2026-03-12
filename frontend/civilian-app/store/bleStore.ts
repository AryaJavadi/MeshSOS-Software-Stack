import { create } from 'zustand';
import { BLEConnectionState, NodeInfo, NetworkStatus } from '@/types';

interface BLEState {
  connectionState: BLEConnectionState;
  connectedNode: NodeInfo | null;
  network: NetworkStatus | null;
  scanError: string | null;

  // Actions
  setConnectionState: (state: BLEConnectionState) => void;
  setConnectedNode: (node: NodeInfo | null) => void;
  setNetwork: (network: NetworkStatus | null) => void;
  setScanError: (error: string | null) => void;
  disconnect: () => void;
}

export const useBLEStore = create<BLEState>((set) => ({
  connectionState: 'idle',
  connectedNode: null,
  network: null,
  scanError: null,

  setConnectionState: (connectionState) => set({ connectionState }),
  setConnectedNode: (connectedNode) => set({ connectedNode }),
  setNetwork: (network) => set({ network }),
  setScanError: (scanError) => set({ scanError }),
  disconnect: () =>
    set({
      connectionState: 'disconnected',
      connectedNode: null,
      network: null,
      scanError: null,
    }),
}));
