import React, { createContext, useContext, useReducer, Dispatch, useEffect } from 'react'
import { AppState, AppAction } from '../types'
import { reducer, initialState } from './reducer'

interface ContextValue {
  state: AppState
  dispatch: Dispatch<AppAction>
}

const DashboardContext = createContext<ContextValue | null>(null)

const STORAGE_KEY = 'meshsos-state'

function loadPersistedState(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: Partial<AppState> = JSON.parse(raw)

    // Animation state lives only in memory and cannot survive a page reload.
    // Reset in-transit vehicles to a clean state so they don't freeze.
    // We intentionally keep each vehicle's last-known location so they remain
    // visible on the map (if we snapped them all to STATION they'd be hidden
    // under the station marker).
    //   returning → available (deliveries done, vehicle is free)
    //   enroute   → loading  (keep assigned requests so responder can re-dispatch)
    if (parsed.vehicles) {
      parsed.vehicles = parsed.vehicles.map(v => {
        if (v.status === 'returning') {
          return { ...v, status: 'available', assignedRequestIds: [] }
        }
        if (v.status === 'enroute') {
          return { ...v, status: 'loading' }
        }
        return v
      })
    }

    return parsed
  } catch {}
  return {}
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const persisted = loadPersistedState()
  const hydratedInitial: AppState = {
    ...initialState,
    requests:        persisted.requests        ?? initialState.requests,
    vehicles:        persisted.vehicles        ?? initialState.vehicles,
    broadcastHistory: persisted.broadcastHistory ?? initialState.broadcastHistory,
  }

  const [state, dispatch] = useReducer(reducer, hydratedInitial)

  // Persist requests, vehicles, and broadcast history on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        requests:        state.requests,
        vehicles:        state.vehicles,
        broadcastHistory: state.broadcastHistory,
      }))
    } catch {}
  }, [state.requests, state.vehicles, state.broadcastHistory])

  return (
    <DashboardContext.Provider value={{ state, dispatch }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard(): ContextValue {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}
