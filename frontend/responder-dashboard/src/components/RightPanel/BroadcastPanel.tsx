import { BroadcastType } from '../../types'
import { useDashboard } from '../../context/DashboardContext'
import { relativeTime } from '../../utils/time'

const TYPE_CONFIG: Record<BroadcastType, { label: string; emoji: string; colorVar: string; dimVar: string; borderVar: string }> = {
  urgent: { label: 'Urgent', emoji: '🚨', colorVar: 'var(--color-red)',    dimVar: 'var(--color-red-dim)',    borderVar: 'var(--color-red-border)' },
  action: { label: 'Action', emoji: '📢', colorVar: 'var(--color-yellow)', dimVar: 'var(--color-yellow-dim)', borderVar: 'var(--color-yellow-border)' },
  info:   { label: 'Info',   emoji: 'ℹ️',  colorVar: 'var(--color-blue)',   dimVar: 'var(--color-blue-dim)',   borderVar: 'var(--color-blue-border)' },
}

const API_URL = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? 'http://localhost:8000'

export default function BroadcastPanel() {
  const { state, dispatch } = useDashboard()
  const draft = state.broadcastDraft
  const type = state.broadcastType
  const config = TYPE_CONFIG[type]

  async function send() {
    const text = draft.trim()
    if (!text) return
    const res = await fetch(`${API_URL}/broadcasts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, text }),
    })
    const data = await res.json()
    dispatch({
      type: 'BROADCAST_SENT',
      payload: {
        id: data.id,
        type,
        text,
        sentAt: data.sentAt,
        acknowledged: false,
      },
    })
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Type selector */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[1.2px] text-text-muted mb-2">Message Type</div>
        <div className="flex gap-1.5">
          {(Object.entries(TYPE_CONFIG) as [BroadcastType, typeof config][]).map(([t, cfg]) => (
            <button
              key={t}
              onClick={() => dispatch({ type: 'BROADCAST_TYPE_CHANGED', payload: t })}
              className="flex-1 py-2 rounded-[8px] text-[11px] font-semibold border transition-colors"
              style={
                type === t
                  ? { background: cfg.dimVar, borderColor: cfg.borderVar, color: cfg.colorVar }
                  : { background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }
              }
            >
              {cfg.emoji} {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message input */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[1.2px] text-text-muted mb-2">Message</div>
        <textarea
          value={draft}
          onChange={e => dispatch({ type: 'BROADCAST_DRAFT_CHANGED', payload: e.target.value.slice(0, 100) })}
          onKeyDown={handleKey}
          placeholder="Type a message to send to civilians on the mesh network…"
          rows={4}
          maxLength={100}
          className="w-full bg-surface border border-border rounded-[10px] px-3 py-2.5 text-[13px] text-text placeholder-text-muted resize-none focus:outline-none focus:border-accent transition-colors"
        />
        <div className="flex justify-between text-[10px] text-text-muted mt-1">
          <span>⌘↩ to send</span>
          <span>{draft.length}/100</span>
        </div>
      </div>

      {/* Send button */}
      <button
        onClick={send}
        disabled={!draft.trim()}
        className="w-full py-3 rounded-[10px] text-[14px] font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: config.dimVar, borderColor: config.borderVar, color: config.colorVar }}
      >
        {config.emoji} Broadcast {config.label}
      </button>

      {/* Broadcast history */}
      {state.broadcastHistory.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[11px] font-bold uppercase tracking-[1.2px] text-text-muted">Sent</div>
          </div>
          <div className="flex flex-col gap-2">
            {state.broadcastHistory.map(msg => {
              const cfg = TYPE_CONFIG[msg.type]
              return (
                <div
                  key={msg.id}
                  className="rounded-[10px] px-3 py-2.5 border"
                  style={{
                    background: cfg.dimVar,
                    borderColor: cfg.borderVar,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cfg.colorVar }}>
                      {cfg.emoji} {cfg.label}
                    </span>
                    <span className="text-[10px] text-text-muted ml-auto">{relativeTime(msg.sentAt)}</span>
                  </div>
                  <div className="text-[12px] leading-relaxed text-text-dim">
                    {msg.text}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
