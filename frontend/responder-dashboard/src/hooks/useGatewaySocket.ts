import { useEffect, useRef, Dispatch } from 'react'
import { AppAction } from '../types'

const WS_URL = (import.meta as { env: Record<string, string> }).env.VITE_GATEWAY_WS_URL ?? 'ws://localhost:8765'
const MAX_BACKOFF = 30_000

export function useGatewaySocket(dispatch: Dispatch<AppAction>) {
  const wsRef = useRef<WebSocket | null>(null)
  const backoffRef = useRef(1000)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    function connect() {
      if (!mountedRef.current) return

      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connecting' })

      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        backoffRef.current = 1000
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connected' })
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return
        try {
          const msg = JSON.parse(event.data as string)
          switch (msg.type) {
            case 'REQUEST_RECEIVED':
              dispatch({ type: 'REQUEST_RECEIVED', payload: msg.payload })
              break
            case 'REQUEST_STATUS_UPDATED':
              dispatch({ type: 'REQUEST_STATUS_UPDATED', payload: msg.payload })
              break
            case 'VEHICLE_UPDATED':
              dispatch({ type: 'VEHICLE_UPDATED', payload: msg.payload })
              break
            case 'NODE_STATUS_UPDATED':
              dispatch({ type: 'NODE_STATUS_UPDATED', payload: msg.payload })
              break
            // PACKET_RECEIVED removed — each message is a single packet
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' })
        timeoutRef.current = setTimeout(() => {
          backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF)
          connect()
        }, backoffRef.current)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      wsRef.current?.close()
    }
  }, [dispatch])
}
