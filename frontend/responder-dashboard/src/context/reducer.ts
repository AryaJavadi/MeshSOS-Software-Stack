import { AppState, AppAction, HouseholdRequest, MeshNode, Vehicle, SupplyType } from '../types'

export const initialState: AppState = {
  requests: [],
  nodes: [],
  vehicles: [],
  selectedRequestId: null,
  selectedVehicleId: null,
  expandedRequestId: null,
  recentlyDeliveredIds: [],
  theme: 'dark',
  broadcastDraft: '',
  broadcastType: 'urgent',
  connectionStatus: 'disconnected',
  broadcastHistory: [],
}

function upsertById<T extends { id: string }>(arr: T[], item: T): T[] {
  const idx = arr.findIndex(x => x.id === item.id)
  if (idx === -1) return [item, ...arr]
  const next = [...arr]
  next[idx] = item
  return next
}

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'REQUEST_RECEIVED':
      return { ...state, requests: upsertById<HouseholdRequest>(state.requests, action.payload) }

    case 'REQUEST_STATUS_UPDATED':
      return {
        ...state,
        requests: state.requests.map(r =>
          r.id === action.payload.id ? { ...r, status: action.payload.status } : r
        ),
      }

    case 'VEHICLE_UPDATED': {
      // Cargo is always derived from the supplies of assigned requests (unlimited truck capacity)
      const v = action.payload
      const tally: Partial<Record<SupplyType, number>> = {}
      v.assignedRequestIds.forEach(reqId => {
        const req = state.requests.find(r => r.id === reqId)
        req?.supplies.forEach(s => { tally[s] = (tally[s] ?? 0) + 1 })
      })
      const cargo: Vehicle['cargo'] = (Object.entries(tally) as [SupplyType, number][])
        .map(([type, quantity]) => ({ type, quantity }))
      return { ...state, vehicles: upsertById<Vehicle>(state.vehicles, { ...v, cargo }) }
    }

    case 'NODE_STATUS_UPDATED':
      return { ...state, nodes: upsertById<MeshNode>(state.nodes, action.payload) }

    case 'REQUEST_SELECTED':
      return { ...state, selectedRequestId: action.payload, selectedVehicleId: null }

    case 'VEHICLE_SELECTED':
      return { ...state, selectedVehicleId: action.payload, selectedRequestId: null }

    case 'REQUEST_EXPANDED':
      return { ...state, expandedRequestId: action.payload }

    case 'SET_THEME':
      return { ...state, theme: action.payload }

    case 'BROADCAST_DRAFT_CHANGED':
      return { ...state, broadcastDraft: action.payload }

    case 'BROADCAST_TYPE_CHANGED':
      return { ...state, broadcastType: action.payload }

    case 'BROADCAST_SENT':
      return {
        ...state,
        broadcastDraft: '',
        broadcastHistory: [action.payload, ...state.broadcastHistory],
      }

    case 'BROADCAST_ACKNOWLEDGED':
      return {
        ...state,
        broadcastHistory: state.broadcastHistory.map(m =>
          m.id === action.payload ? { ...m, acknowledged: true } : m
        ),
      }

    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload }

    case 'REQUESTS_DELIVERED':
      return {
        ...state,
        requests: state.requests.map(r =>
          action.payload.includes(r.id) ? { ...r, status: 'delivered' } : r
        ),
        recentlyDeliveredIds: [...state.recentlyDeliveredIds, ...action.payload],
      }

    case 'CLEAR_RECENTLY_DELIVERED':
      return {
        ...state,
        recentlyDeliveredIds: state.recentlyDeliveredIds.filter(id => !action.payload.includes(id)),
      }

    case 'RESET_STATE':
      return { ...initialState, theme: state.theme }

    default:
      return state
  }
}
