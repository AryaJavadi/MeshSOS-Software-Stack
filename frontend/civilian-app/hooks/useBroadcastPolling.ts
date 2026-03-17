import { useEffect, useRef } from 'react';
import { useMessageStore } from '@/store/messageStore';
import { API_URL } from '@/config';
import { GatewayMessageType } from '@/types';

const POLL_INTERVAL_MS = 5000;

/**
 * Polls GET /broadcasts?since=<ms> every 5 seconds and adds new messages
 * to the civilian app's message feed.
 */
export function useBroadcastPolling() {
  const lastSeenRef = useRef<number>(Date.now());
  const addMessage = useMessageStore((s) => s.addMessage);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`${API_URL}/broadcasts?since=${lastSeenRef.current}`);
        if (!res.ok) return;
        const data: { id: string; type: string; text: string; sentAt: string }[] = await res.json();
        if (data.length === 0) return;

        for (const msg of data) {
          addMessage({
            id: msg.id,
            timestamp: new Date(msg.sentAt).getTime(),
            fromNodeId: 'GW-01',
            content: msg.text,
            type: msg.type as GatewayMessageType,
          });
        }
        lastSeenRef.current = Date.now();
      } catch {
        // network not available — silently ignore
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [addMessage]);
}
