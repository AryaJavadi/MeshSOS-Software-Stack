import './utils/leafletIconFix'
import { useEffect, useRef } from 'react'
import { DashboardProvider, useDashboard } from './context/DashboardContext'
import { useGatewaySocket } from './hooks/useGatewaySocket'
import { startMockGateway } from './mocks/gatewayMock'
import TopNav from './components/TopNav'
import StatBar from './components/StatBar'
import RequestsFeed from './components/RequestsFeed/RequestsFeed'
import MapView from './components/MapView/MapView'
import RightPanel from './components/RightPanel/RightPanel'

const USE_MOCK = (import.meta as { env: Record<string, string> }).env.VITE_USE_MOCK_DATA === 'true'

const MODE_CONFIG = {
  view:      { bg: 'var(--color-surface)',      border: 'var(--color-border)',        color: 'var(--color-text-muted)', dot: '#4e5d6e',  label: '👁 View Mode',      hint: 'Select a vehicle from the dispatch panel to begin loading' },
  loading:   { bg: 'var(--color-yellow-dim)',   border: 'var(--color-yellow-border)', color: 'var(--color-yellow)',     dot: '#fbbf24',  label: '📦 Loading',        hint: 'Click map pins or request rows to assign to vehicle' },
  enroute:   { bg: 'var(--color-blue-dim)',     border: 'var(--color-blue-border)',   color: 'var(--color-blue)',       dot: '#60a5fa',  label: '🚐 En Route',       hint: 'Vehicle dispatched — delivering requests' },
  returning: { bg: 'var(--color-accent-dim)',   border: 'var(--color-border)',        color: 'var(--color-accent)',     dot: '#a78bfa',  label: '↩ Returning',       hint: 'Vehicle returning to base — resetting automatically' },
} as const

function ContextBanner() {
  const { state } = useDashboard()
  const selectedVehicle = state.selectedVehicleId
    ? state.vehicles.find(v => v.id === state.selectedVehicleId)
    : null

  let mode: keyof typeof MODE_CONFIG = 'view'
  let vehicleName = ''

  if (selectedVehicle) {
    vehicleName = selectedVehicle.name
    if (selectedVehicle.status === 'available' || selectedVehicle.status === 'loading') mode = 'loading'
    else if (selectedVehicle.status === 'enroute') mode = 'enroute'
    else if (selectedVehicle.status === 'returning') mode = 'returning'
  }

  const cfg = MODE_CONFIG[mode]

  return (
    <div
      className="flex-shrink-0 flex items-center gap-3 px-4 py-1.5 border-b border-border"
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>
        {cfg.label}{vehicleName ? `: ${vehicleName}` : ''}
      </span>
      <span className="text-[10px] text-text-muted">{cfg.hint}</span>
    </div>
  )
}

function AppInner() {
  const { state, dispatch } = useDashboard()

  useGatewaySocket(dispatch)

  // Initialize theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('meshsos-theme') as 'dark' | 'light' | null
    const initial = saved ?? 'dark'
    dispatch({ type: 'SET_THEME', payload: initial })
  }, [dispatch])

  // Keep the <html> dark class in sync with React state — single source of truth
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark')
  }, [state.theme])

  useEffect(() => {
    if (USE_MOCK) return startMockGateway(dispatch)
  }, [dispatch])

  // Mock auto-delivery: when a vehicle goes en route, simulate delivery after travel time
  const deliveryTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  useEffect(() => {
    if (!USE_MOCK) return
    state.vehicles.forEach(vehicle => {
      const hasTimer = deliveryTimers.current.has(vehicle.id)
      if (vehicle.status === 'enroute' && vehicle.assignedRequestIds.length > 0 && !hasTimer) {
        // Capture values for the closure
        const reqIds = [...vehicle.assignedRequestIds]
        const vehicleSnapshot = { ...vehicle }
        // Simulated travel time: ~12 seconds for demo
        const timer = setTimeout(() => {
          const returningVehicle = { ...vehicleSnapshot, status: 'returning' as const, assignedRequestIds: [] as string[] }
          dispatch({ type: 'REQUESTS_DELIVERED', payload: reqIds })
          dispatch({ type: 'VEHICLE_UPDATED', payload: returningVehicle })
          deliveryTimers.current.delete(vehicle.id)
          setTimeout(() => {
            dispatch({ type: 'CLEAR_RECENTLY_DELIVERED', payload: reqIds })
            dispatch({ type: 'VEHICLE_UPDATED', payload: { ...returningVehicle, status: 'available' } })
          }, 10_000)
        }, 12_000)
        deliveryTimers.current.set(vehicle.id, timer)
      } else if (vehicle.status !== 'enroute' && hasTimer) {
        // Vehicle was recalled before delivery — cancel the timer
        clearTimeout(deliveryTimers.current.get(vehicle.id)!)
        deliveryTimers.current.delete(vehicle.id)
      }
    })
  }, [state.vehicles, dispatch])

  // Escape deselects current request
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') {
        dispatch({ type: 'REQUEST_SELECTED', payload: null })
        dispatch({ type: 'VEHICLE_SELECTED', payload: null })
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [dispatch])

  return (
    <div className="font-sans bg-bg text-text">
      {/* Mobile guard */}
      <div className="md:hidden flex items-center justify-center min-h-screen bg-bg text-center px-8">
        <div>
          <div className="text-[40px] mb-4 opacity-30">📡</div>
          <p className="text-[16px] text-text-dim leading-relaxed">
            Dashboard requires a larger screen.
            <br />
            Please use a desktop or laptop.
          </p>
        </div>
      </div>

      {/* Full dashboard */}
      <div className="hidden md:flex md:flex-col md:h-screen md:overflow-hidden">
        <TopNav />
        <StatBar />
        <ContextBanner />
        <div className="flex flex-1 overflow-hidden">
          <RightPanel />
          <MapView />
          <RequestsFeed />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <DashboardProvider>
      <AppInner />
    </DashboardProvider>
  )
}
