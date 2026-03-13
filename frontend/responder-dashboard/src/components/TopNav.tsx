import { useState, useEffect } from 'react'
import { useDashboard } from '../context/DashboardContext'

export default function TopNav() {
  const { state, dispatch } = useDashboard()
  const [clock, setClock] = useState('')

  useEffect(() => {
    function updateClock() {
      const now = new Date()
      const h = (now.getHours() % 12 || 12).toString().padStart(2, '0')
      const m = now.getMinutes().toString().padStart(2, '0')
      const ampm = now.getHours() >= 12 ? 'PM' : 'AM'
      setClock(`${h}:${m} ${ampm}`)
    }
    updateClock()
    const id = setInterval(updateClock, 1000)
    return () => clearInterval(id)
  }, [])

  const connColor =
    state.connectionStatus === 'connected' ? 'var(--color-green)' :
    state.connectionStatus === 'connecting' ? 'var(--color-yellow)' :
    'var(--color-red)'

  const connLabel =
    state.connectionStatus === 'connected' ? 'GW-01 · Online' :
    state.connectionStatus === 'connecting' ? 'Connecting…' :
    'GW-01 · Offline'

  function toggleTheme() {
    const next = state.theme === 'dark' ? 'light' : 'dark'
    dispatch({ type: 'SET_THEME', payload: next })
    localStorage.setItem('meshsos-theme', next)
  }

  return (
    <nav className="h-11 bg-bg2 border-b border-border flex items-center px-4 flex-shrink-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-xs flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #a78bfa)' }}
        >
          📡
        </div>
        <span className="text-[14px] font-bold text-text tracking-tight">MeshSOS</span>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted bg-surface2 border border-border px-1.5 py-[2px] rounded">
          Responder Dashboard
        </span>
      </div>

      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border"
          style={{
            background: `color-mix(in srgb, ${connColor} 8%, transparent)`,
            borderColor: `color-mix(in srgb, ${connColor} 30%, transparent)`,
            color: connColor,
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: connColor }} />
          {connLabel}
        </div>

        <div className="font-mono text-[12px] text-text-muted tabular-nums">{clock}</div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[14px] bg-surface2 border border-border text-text-muted hover:text-text hover:bg-surface3 transition-colors"
          title={state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {state.theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }}
        >
          JR
        </div>
      </div>
    </nav>
  )
}
