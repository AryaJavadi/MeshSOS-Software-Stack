import { useState, useEffect } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import DispatchBoard from './DispatchBoard'
import BroadcastPanel from './BroadcastPanel'

type Tab = 'dispatch' | 'broadcast'

export default function RightPanel() {
  const { state } = useDashboard()
  const [tab, setTab] = useState<Tab>('dispatch')
  const [collapsed, setCollapsed] = useState(true)

  // Auto-open to Dispatch tab when a vehicle is selected from the map
  useEffect(() => {
    if (state.selectedVehicleId) {
      setCollapsed(false)
      setTab('dispatch')
    }
  }, [state.selectedVehicleId])

  // Keyboard shortcut: [ to toggle (left panel)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '[') setCollapsed(c => !c)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // Collapsed: narrow strip on the LEFT
  if (collapsed) {
    return (
      <div className="flex-shrink-0 w-11 bg-bg2 border-r border-border flex flex-col items-center py-3 gap-3">
        <button
          onClick={() => setCollapsed(false)}
          className="text-text-muted hover:text-text transition-colors text-base leading-none"
          title="Expand dispatch ["
        >›</button>

        {state.selectedVehicleId && (
          <div className="w-2 h-2 rounded-full bg-accent" />
        )}

        <div className="flex-1 flex items-center">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Dispatch
          </span>
        </div>
      </div>
    )
  }

  // Expanded — LEFT panel: border-r
  return (
    <div className="w-[300px] flex-shrink-0 bg-bg2 border-r border-border flex flex-col overflow-hidden">
      {/* Header + tabs */}
      <div className="flex items-center border-b border-border flex-shrink-0">
        <button
          onClick={() => setCollapsed(true)}
          className="text-text-muted hover:text-text transition-colors text-[13px] px-3 py-2.5 leading-none border-r border-border"
          title="Collapse ["
        >
          ‹
        </button>
        <div className="flex flex-1">
          {(['dispatch', 'broadcast'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-center text-[12px] font-semibold border-b-2 transition-colors ${
                tab === t
                  ? 'text-text border-accent'
                  : 'text-text-muted border-transparent hover:text-text-dim'
              }`}
            >
              {t === 'dispatch' ? '🚐 Dispatch' : '📡 Broadcast'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'dispatch' ? <DispatchBoard /> : <BroadcastPanel />}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-border flex-shrink-0">
        <span className="text-[10px] text-text-muted">Press <kbd className="font-mono bg-surface2 px-1 py-px rounded text-[9px] border border-border">[</kbd> to collapse</span>
      </div>
    </div>
  )
}
