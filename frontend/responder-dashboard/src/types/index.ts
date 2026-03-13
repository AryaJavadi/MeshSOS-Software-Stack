export type SupplyType = 'water' | 'food' | 'medical' | 'other'
export type RequestStatus = 'new' | 'acknowledged' | 'dispatched' | 'delivered'
export type ConditionType = 'injury' | 'chronic' | 'disability' | 'medication' | 'mental_health' | 'other'
export type BroadcastType = 'urgent' | 'action' | 'info'

export interface MedicalProfile {
  ageTier: 'infant' | 'child_adult' | 'senior'
  count: number
  conditionType: ConditionType
  specificNeed: string
}

export interface HouseholdRequest {
  id: string
  householdId: string
  status: RequestStatus
  supplies: SupplyType[]
  people: { infant: number; childAdult: number; senior: number }
  location: { lat: number; lng: number }
  nodeId: string
  notes: string
  medicalProfiles: MedicalProfile[]
  triageScore: number
  receivedAt: string
}

export interface MeshNode {
  id: string
  status: 'online' | 'weak' | 'offline' | 'gateway'
  location: { lat: number; lng: number }
  lastSeen: string
  signalDbm: number
  hopsToGateway: number
}

export interface Vehicle {
  id: string
  name: string
  status: 'available' | 'loading' | 'enroute' | 'returning'
  cargo: { type: SupplyType; quantity: number }[]
  assignedRequestIds: string[]
  location: { lat: number; lng: number }
}

export interface BroadcastMessage {
  id: string
  type: BroadcastType
  text: string
  sentAt: string
  acknowledged: boolean
}

export interface AppState {
  requests: HouseholdRequest[]
  nodes: MeshNode[]
  vehicles: Vehicle[]
  selectedRequestId: string | null
  selectedVehicleId: string | null
  expandedRequestId: string | null
  recentlyDeliveredIds: string[]
  theme: 'dark' | 'light'
  broadcastDraft: string
  broadcastType: BroadcastType
  connectionStatus: 'connected' | 'connecting' | 'disconnected'
  broadcastHistory: BroadcastMessage[]
}

export type AppAction =
  | { type: 'REQUEST_RECEIVED'; payload: HouseholdRequest }
  | { type: 'REQUEST_STATUS_UPDATED'; payload: { id: string; status: RequestStatus } }
  | { type: 'VEHICLE_UPDATED'; payload: Vehicle }
  | { type: 'NODE_STATUS_UPDATED'; payload: MeshNode }
  | { type: 'REQUEST_SELECTED'; payload: string | null }
  | { type: 'VEHICLE_SELECTED'; payload: string | null }
  | { type: 'REQUEST_EXPANDED'; payload: string | null }
  | { type: 'BROADCAST_ACKNOWLEDGED'; payload: string }
  | { type: 'SET_THEME'; payload: 'dark' | 'light' }
  | { type: 'BROADCAST_DRAFT_CHANGED'; payload: string }
  | { type: 'BROADCAST_TYPE_CHANGED'; payload: BroadcastType }
  | { type: 'BROADCAST_SENT'; payload: BroadcastMessage }
  | { type: 'SET_CONNECTION_STATUS'; payload: 'connected' | 'connecting' | 'disconnected' }
  | { type: 'REQUESTS_DELIVERED'; payload: string[] }
  | { type: 'CLEAR_RECENTLY_DELIVERED'; payload: string[] }
