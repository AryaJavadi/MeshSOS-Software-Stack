import React, { createContext, useContext, useReducer, Dispatch } from 'react'
import { AppState, AppAction } from '../types'
import { reducer, initialState } from './reducer'

interface ContextValue {
  state: AppState
  dispatch: Dispatch<AppAction>
}

const DashboardContext = createContext<ContextValue | null>(null)

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

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
