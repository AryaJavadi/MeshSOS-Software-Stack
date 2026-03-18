import { useState } from 'react'
import { useDashboard } from '../context/DashboardContext'

export default function StatBar() {
  const { state } = useDashboard()
  const [collapsed, setCollapsed] = useState(false)

  const activeRequests = state.requests.filter(r => r.status !== 'delivered').length
  const medicalFlags = state.requests.filter(r =>
    r.status !== 'delivered' && (r.supplies.includes('medical') || r.medicalProfiles.length > 0)
  ).length
  const vehiclesDeployed = state.vehicles.filter(v => v.status === 'enroute' || v.status === 'returning').length
  const vehiclesTotal = state.vehicles.length
  const nodesOnline = state.nodes.filter(n => n.status === 'online' || n.status === 'gateway').length
  const nodesTotal = state.nodes.length

  if (collapsed) {
    return (
      <div className="h-8 bg-bg2 border-b border-border flex items-center px-4 gap-0 flex-shrink-0">
        <div className="flex items-center gap-5 font-mono text-[12px] flex-1">
          <span><span className="text-yellow font-semibold">{activeRequests}</span> <span className="text-text-muted">active</span></span>
          <span className="text-border">·</span>
          <span><span className="text-red font-semibold">{medicalFlags}</span> <span className="text-text-muted">medical</span></span>
          <span className="text-border">·</span>
          <span><span className="text-blue font-semibold">{vehiclesDeployed}</span><span className="text-text-muted">/{vehiclesTotal} vehicles</span></span>
          <span className="text-border">·</span>
          <span><span className="text-green font-semibold">{nodesOnline}</span><span className="text-text-muted">/{nodesTotal} nodes</span></span>
        </div>
        <button
          onClick={() => setCollapsed(false)}
          className="text-text-muted hover:text-text-dim transition-colors text-[11px] px-2"
          title="Expand stats"
        >
          ▼
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-px bg-border border-b border-border flex-shrink-0 relative">
      {[
        { value: activeRequests,                        label: 'Active Requests',   colorVar: 'var(--color-yellow)', dimVar: 'var(--color-yellow-dim)', icon: '⚠️' },
        { value: medicalFlags,                          label: 'Medical Flags',     colorVar: 'var(--color-red)',    dimVar: 'var(--color-red-dim)',    icon: '🧰' },
        { value: `${vehiclesDeployed}/${vehiclesTotal}`,label: 'Vehicles Deployed', colorVar: 'var(--color-blue)',   dimVar: 'var(--color-blue-dim)',   icon: '🚐' },
        { value: `${nodesOnline}/${nodesTotal}`,        label: 'Nodes Online',      colorVar: 'var(--color-green)',  dimVar: 'var(--color-green-dim)',  icon: '📡' },
      ].map(card => (
        <div key={card.label} className="flex-1 bg-bg2 flex items-center gap-3 px-5 py-2.5">
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: card.dimVar }}
          >
            {card.icon}
          </div>
          <div>
            <div className="font-mono text-[20px] font-semibold leading-none" style={{ color: card.colorVar }}>
              {card.value}
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">{card.label}</div>
          </div>
        </div>
      ))}
      <button
        onClick={() => setCollapsed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-dim transition-colors text-[11px] px-2 py-1"
        title="Collapse stats"
      >
        ▲
      </button>
    </div>
  )
}
