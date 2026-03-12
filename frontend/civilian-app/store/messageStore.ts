import { create } from 'zustand';
import { GatewayMessage } from '@/types';

interface MessageState {
  messages: GatewayMessage[];
  unreadCount: number;
  lastSyncedAt: number | null;
  lastSyncedNodeId: string | null;
  addMessage: (msg: GatewayMessage) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setLastSynced: (nodeId: string, timestamp: number) => void;
  clearMessages: () => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  messages: [],
  unreadCount: 0,
  lastSyncedAt: null,
  lastSyncedNodeId: null,

  addMessage: (msg) =>
    set((state) => ({
      messages: [{ ...msg, read: false }, ...state.messages],
      unreadCount: state.unreadCount + 1,
      lastSyncedAt: Date.now(),
    })),

  markRead: (id) =>
    set((state) => {
      const messages = state.messages.map((m) =>
        m.id === id ? { ...m, read: true } : m
      );
      return { messages, unreadCount: messages.filter((m) => !m.read).length };
    }),

  markAllRead: () =>
    set((state) => ({
      messages: state.messages.map((m) => ({ ...m, read: true })),
      unreadCount: 0,
    })),

  setLastSynced: (nodeId, timestamp) =>
    set({ lastSyncedNodeId: nodeId, lastSyncedAt: timestamp }),

  clearMessages: () =>
    set({ messages: [], unreadCount: 0, lastSyncedAt: null, lastSyncedNodeId: null }),
}));
