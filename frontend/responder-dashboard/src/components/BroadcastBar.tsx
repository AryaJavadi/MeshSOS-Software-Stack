import React from 'react'
import { useDashboard } from '../context/DashboardContext'
import { BroadcastType } from '../types'

const TYPE_STYLES: Record<BroadcastType, { active: string; inactive: string }> = {
  urgent: {
    active: 'bg-[rgba(248,113,113,0.1)] border-[rgba(248,113,113,0.3)] text-red',
    inactive: 'bg-transparent border-border text-text-muted hover:border-[rgba(255,255,255,0.15)]',
  },
  action: {
    active: 'bg-[rgba(52,211,153,0.1)] border-[rgba(52,211,153,0.3)] text-green',
    inactive: 'bg-transparent border-border text-text-muted hover:border-[rgba(255,255,255,0.15)]',
  },
  info: {
    active: 'bg-[rgba(167,139,250,0.12)] border-[rgba(167,139,250,0.25)] text-accent',
    inactive: 'bg-transparent border-border text-text-muted hover:border-[rgba(255,255,255,0.15)]',
  },
}

const CIVILIAN_COUNT = 9
const API_URL = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? 'http://localhost:8000'

export default function BroadcastBar() {
  const { state, dispatch } = useDashboard()

  async function send() {
    const text = state.broadcastDraft.trim()
    if (!text) return
    const res = await fetch(`${API_URL}/broadcasts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: state.broadcastType, text }),
    })
    const data = await res.json()
    dispatch({
      type: 'BROADCAST_SENT',
      payload: {
        id: data.id,
        type: state.broadcastType,
        text,
        sentAt: data.sentAt,
        acknowledged: false,
      },
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="h-[52px] bg-bg2 border-t border-border flex items-center px-4 gap-2.5 flex-shrink-0 z-50">
      {/* Label */}
      <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-text-muted flex-shrink-0">
        <span className="text-sm">📡</span>
        Broadcast
      </div>

      {/* Type selector */}
      <div className="flex gap-1">
        {(['urgent', 'action', 'info'] as BroadcastType[]).map(t => (
          <button
            key={t}
            onClick={() => dispatch({ type: 'BROADCAST_TYPE_CHANGED', payload: t })}
            className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide border transition-colors ${
              state.broadcastType === t
                ? TYPE_STYLES[t].active
                : TYPE_STYLES[t].inactive
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Input */}
      <input
        type="text"
        className="flex-1 bg-surface border border-border rounded px-3 py-1.5 text-[12px] text-text font-sans placeholder-text-muted outline-none focus:border-[rgba(167,139,250,0.3)] transition-colors"
        placeholder="Send a message to all civilians on the mesh network…"
        value={state.broadcastDraft}
        onChange={e => dispatch({ type: 'BROADCAST_DRAFT_CHANGED', payload: e.target.value })}
        onKeyDown={handleKeyDown}
      />

      {/* Reachable count */}
      <span className="text-[10px] text-text-muted font-mono flex-shrink-0">
        ~{CIVILIAN_COUNT} civilians reachable
      </span>

      {/* Send button */}
      <button
        onClick={send}
        disabled={!state.broadcastDraft.trim()}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded text-[12px] font-bold text-white flex-shrink-0 transition-opacity disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #a78bfa)' }}
      >
        📡 Send to All
      </button>
    </div>
  )
}
