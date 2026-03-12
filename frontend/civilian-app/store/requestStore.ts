import { create } from 'zustand';
import { SupplyRequest, RequestStatus, RequestAck } from '@/types';

interface RequestState {
  requests: SupplyRequest[];
  draft: Partial<SupplyRequest> | null;

  // Actions
  addRequest: (request: SupplyRequest) => void;
  updateRequestStatus: (id: string, status: RequestStatus, extra?: Partial<SupplyRequest>) => void;
  applyAck: (ack: RequestAck) => void;
  setDraft: (draft: Partial<SupplyRequest> | null) => void;
  clearDraft: () => void;
}

export const useRequestStore = create<RequestState>((set) => ({
  requests: [],
  draft: null,

  addRequest: (request) =>
    set((state) => ({ requests: [request, ...state.requests] })),

  updateRequestStatus: (id, status, extra = {}) =>
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === id ? { ...r, status, updatedAt: Date.now(), ...extra } : r
      ),
    })),

  applyAck: (ack) =>
    set((state) => ({
      requests: state.requests.map((r) => {
        if (r.id !== ack.requestId) return r;
        if (ack.status === 'relayed') {
          return { ...r, status: 'relayed', relayedAt: ack.timestamp, relayNodeId: ack.relayNodeId, updatedAt: Date.now() };
        }
        if (ack.status === 'received') {
          return { ...r, status: 'received', receivedAt: ack.timestamp, updatedAt: Date.now() };
        }
        return r;
      }),
    })),

  setDraft: (draft) => set({ draft }),
  clearDraft: () => set({ draft: null }),
}));
