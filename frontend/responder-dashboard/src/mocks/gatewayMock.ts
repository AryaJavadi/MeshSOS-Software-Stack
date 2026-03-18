import { Dispatch } from 'react'
import { AppAction, HouseholdRequest, MeshNode, Vehicle } from '../types'

// Supply station: Waterloo Fire Station 1, 216 Weber St N
const C = { lat: 43.4773, lng: -80.5180 }

function minsAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString()
}

// ── Mesh nodes ──
const SEED_NODES: MeshNode[] = [
  { id: 'GW-01', status: 'gateway', location: { lat: C.lat,          lng: C.lng         }, lastSeen: new Date().toISOString(),                         signalDbm: -45, hopsToGateway: 0 },
  { id: 'N-NE1', status: 'online',  location: { lat: C.lat + 0.025,  lng: C.lng + 0.032 }, lastSeen: new Date().toISOString(),                         signalDbm: -62, hopsToGateway: 1 },
  { id: 'N-NE2', status: 'weak',    location: { lat: C.lat + 0.038,  lng: C.lng + 0.048 }, lastSeen: new Date(Date.now() - 4 * 60_000).toISOString(),  signalDbm: -83, hopsToGateway: 2 },
  { id: 'N-SE1', status: 'online',  location: { lat: C.lat - 0.022,  lng: C.lng + 0.030 }, lastSeen: new Date().toISOString(),                         signalDbm: -70, hopsToGateway: 1 },
  { id: 'N-SW1', status: 'online',  location: { lat: C.lat - 0.018,  lng: C.lng - 0.032 }, lastSeen: new Date().toISOString(),                         signalDbm: -67, hopsToGateway: 1 },
  { id: 'N-W1',  status: 'online',  location: { lat: C.lat + 0.010,  lng: C.lng - 0.040 }, lastSeen: new Date().toISOString(),                         signalDbm: -68, hopsToGateway: 1 },
  { id: 'N-W2',  status: 'offline', location: { lat: C.lat - 0.008,  lng: C.lng - 0.045 }, lastSeen: new Date(Date.now() - 45 * 60_000).toISOString(), signalDbm: -99, hopsToGateway: 3 },
]

// ── 5 supply vehicles — all based at the supply station (gateway) ──
export const SUPPLY_STATION = C
export const SEED_VEHICLES: Vehicle[] = [
  { id: 'V-01', name: 'Supply 01', status: 'available', cargo: [], assignedRequestIds: [], location: C, hoursWorked: 0 },
  { id: 'V-02', name: 'Supply 02', status: 'available', cargo: [], assignedRequestIds: [], location: C, hoursWorked: 0 },
  { id: 'V-03', name: 'Supply 03', status: 'available', cargo: [], assignedRequestIds: [], location: C, hoursWorked: 0 },
  { id: 'V-04', name: 'Supply 04', status: 'available', cargo: [], assignedRequestIds: [], location: C, hoursWorked: 0 },
  { id: 'V-05', name: 'Supply 05', status: 'available', cargo: [], assignedRequestIds: [], location: C, hoursWorked: 0 },
]

// ── 30 requests — 6 per cluster, each near its respective vehicle ──
export const SEED_REQUESTS: HouseholdRequest[] = [

  // ── Cluster A: near Supply 01 (NE) ──
  {
    id: 'HH:A1F2', householdId: 'HH:A1F2', status: 'new',
    supplies: ['medical', 'water'],
    people: { infant: 1, childAdult: 2, senior: 1 },
    location: { lat: C.lat + 0.029, lng: C.lng + 0.038 },
    nodeId: 'N-NE1',
    notes: '',
    medicalProfiles: [
      { ageTier: 'infant',  count: 1, conditionType: 'chronic',    specificNeed: 'Formula + vitamin D drops — running out today' },
      { ageTier: 'senior',  count: 1, conditionType: 'medication', specificNeed: 'Daily insulin — 2 doses remaining' },
    ],
    triageScore: 0, receivedAt: minsAgo(8),
  },
  {
    id: 'HH:A2E9', householdId: 'HH:A2E9', status: 'new',
    supplies: ['medical', 'food'],
    people: { infant: 0, childAdult: 1, senior: 2 },
    location: { lat: C.lat + 0.035, lng: C.lng + 0.044 },
    nodeId: 'N-NE2',
    notes: '',
    medicalProfiles: [
      { ageTier: 'senior', count: 1, conditionType: 'mental_health', specificNeed: 'Dementia — needs calm familiar responder, do not startle' },
      { ageTier: 'senior', count: 1, conditionType: 'medication',    specificNeed: 'Blood pressure medication — 1 day supply left' },
    ],
    triageScore: 0, receivedAt: minsAgo(22),
  },
  {
    id: 'HH:A3C7', householdId: 'HH:A3C7', status: 'new',
    supplies: ['medical'],
    people: { infant: 0, childAdult: 3, senior: 0 },
    location: { lat: C.lat + 0.027, lng: C.lng + 0.045 },
    nodeId: 'N-NE1',
    notes: '',
    medicalProfiles: [
      { ageTier: 'child_adult', count: 1, conditionType: 'injury', specificNeed: 'Arm fracture + concussion, needs splint and eval' },
    ],
    triageScore: 0, receivedAt: minsAgo(14),
  },
  {
    id: 'HH:A4B5', householdId: 'HH:A4B5', status: 'new',
    supplies: ['water', 'food'],
    people: { infant: 0, childAdult: 4, senior: 0 },
    location: { lat: C.lat + 0.033, lng: C.lng + 0.036 },
    nodeId: 'N-NE1',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(31),
  },
  {
    id: 'HH:A5D3', householdId: 'HH:A5D3', status: 'new',
    supplies: ['other'],
    people: { infant: 0, childAdult: 2, senior: 1 },
    location: { lat: C.lat + 0.030, lng: C.lng + 0.041 },
    nodeId: 'N-NE2',
    notes: 'Blankets, portable cot, and candles for the household',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(45),
  },
  {
    id: 'HH:A6G8', householdId: 'HH:A6G8', status: 'new',
    supplies: ['water', 'medical'],
    people: { infant: 2, childAdult: 3, senior: 0 },
    location: { lat: C.lat + 0.037, lng: C.lng + 0.040 },
    nodeId: 'N-NE2',
    notes: '',
    medicalProfiles: [
      { ageTier: 'infant',      count: 2, conditionType: 'chronic', specificNeed: 'Formula and oral rehydration sachets' },
      { ageTier: 'child_adult', count: 1, conditionType: 'injury',  specificNeed: 'Postpartum infection, fever 38.9°C — needs antibiotics' },
    ],
    triageScore: 0, receivedAt: minsAgo(6),
  },

  // ── Cluster B: near Supply 02 (N) ──
  {
    id: 'HH:B1A4', householdId: 'HH:B1A4', status: 'new',
    supplies: ['water', 'food'],
    people: { infant: 0, childAdult: 3, senior: 1 },
    location: { lat: C.lat + 0.040, lng: C.lng + 0.006 },
    nodeId: 'N-NE1',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(18),
  },
  {
    id: 'HH:B2C6', householdId: 'HH:B2C6', status: 'new',
    supplies: ['food', 'water'],
    people: { infant: 1, childAdult: 2, senior: 0 },
    location: { lat: C.lat + 0.044, lng: C.lng + 0.014 },
    nodeId: 'N-NE1',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(9),
  },
  {
    id: 'HH:B3E2', householdId: 'HH:B3E2', status: 'new',
    supplies: ['water'],
    people: { infant: 0, childAdult: 3, senior: 0 },
    location: { lat: C.lat + 0.038, lng: C.lng + 0.008 },
    nodeId: 'N-NE1',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(38),
  },
  {
    id: 'HH:B4F9', householdId: 'HH:B4F9', status: 'new',
    supplies: ['food', 'water'],
    people: { infant: 0, childAdult: 0, senior: 2 },
    location: { lat: C.lat + 0.046, lng: C.lng + 0.004 },
    nodeId: 'N-NE2',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(54),
  },
  {
    id: 'HH:B5D7', householdId: 'HH:B5D7', status: 'new',
    supplies: ['other'],
    people: { infant: 1, childAdult: 2, senior: 0 },
    location: { lat: C.lat + 0.042, lng: C.lng + 0.012 },
    nodeId: 'N-NE2',
    notes: 'Diapers size 2, baby wipes, change of baby clothes',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(27),
  },
  {
    id: 'HH:B6H2', householdId: 'HH:B6H2', status: 'new',
    supplies: ['medical'],
    people: { infant: 0, childAdult: 1, senior: 1 },
    location: { lat: C.lat + 0.036, lng: C.lng + 0.016 },
    nodeId: 'N-NE1',
    notes: '',
    medicalProfiles: [
      { ageTier: 'senior', count: 1, conditionType: 'chronic', specificNeed: 'Oxygen concentrator — generator fuel critically low' },
    ],
    triageScore: 0, receivedAt: minsAgo(11),
  },

  // ── Cluster C: near Supply 03 (SE) ──
  {
    id: 'HH:C1B3', householdId: 'HH:C1B3', status: 'new',
    supplies: ['water', 'food'],
    people: { infant: 0, childAdult: 5, senior: 1 },
    location: { lat: C.lat - 0.024, lng: C.lng + 0.028 },
    nodeId: 'N-SE1',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(20),
  },
  {
    id: 'HH:C2A7', householdId: 'HH:C2A7', status: 'new',
    supplies: ['food'],
    people: { infant: 0, childAdult: 2, senior: 2 },
    location: { lat: C.lat - 0.030, lng: C.lng + 0.025 },
    nodeId: 'N-SE1',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(33),
  },
  {
    id: 'HH:C3D8', householdId: 'HH:C3D8', status: 'new',
    supplies: ['water'],
    people: { infant: 0, childAdult: 2, senior: 0 },
    location: { lat: C.lat - 0.026, lng: C.lng + 0.032 },
    nodeId: 'N-SE1',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(41),
  },
  {
    id: 'HH:C4E5', householdId: 'HH:C4E5', status: 'new',
    supplies: ['medical'],
    people: { infant: 0, childAdult: 2, senior: 0 },
    location: { lat: C.lat - 0.022, lng: C.lng + 0.034 },
    nodeId: 'N-SE1',
    notes: '',
    medicalProfiles: [
      { ageTier: 'child_adult', count: 1, conditionType: 'other', specificNeed: 'Postpartum recovery, possible infection, needs eval' },
    ],
    triageScore: 0, receivedAt: minsAgo(12),
  },
  {
    id: 'HH:C5F1', householdId: 'HH:C5F1', status: 'new',
    supplies: ['other'],
    people: { infant: 0, childAdult: 3, senior: 1 },
    location: { lat: C.lat - 0.020, lng: C.lng + 0.026 },
    nodeId: 'N-SE1',
    notes: 'Generator fuel or battery pack for CPAP machine',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(29),
  },
  {
    id: 'HH:C6G4', householdId: 'HH:C6G4', status: 'new',
    supplies: ['food', 'water'],
    people: { infant: 1, childAdult: 2, senior: 0 },
    location: { lat: C.lat - 0.028, lng: C.lng + 0.030 },
    nodeId: 'N-SE1',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(17),
  },

  // ── Cluster D: near Supply 04 (SW) ──
  {
    id: 'HH:D1A2', householdId: 'HH:D1A2', status: 'new',
    supplies: ['medical', 'water'],
    people: { infant: 0, childAdult: 1, senior: 1 },
    location: { lat: C.lat - 0.020, lng: C.lng - 0.030 },
    nodeId: 'N-SW1',
    notes: '',
    medicalProfiles: [
      { ageTier: 'senior', count: 1, conditionType: 'disability', specificNeed: 'Wheelchair-bound, insulin-dependent — 1 dose left, critical' },
    ],
    triageScore: 0, receivedAt: minsAgo(5),
  },
  {
    id: 'HH:D2B8', householdId: 'HH:D2B8', status: 'new',
    supplies: ['food', 'water'],
    people: { infant: 0, childAdult: 4, senior: 0 },
    location: { lat: C.lat - 0.025, lng: C.lng - 0.038 },
    nodeId: 'N-SW1',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(24),
  },
  {
    id: 'HH:D3C5', householdId: 'HH:D3C5', status: 'new',
    supplies: ['water'],
    people: { infant: 0, childAdult: 2, senior: 1 },
    location: { lat: C.lat - 0.016, lng: C.lng - 0.033 },
    nodeId: 'N-SW1',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(37),
  },
  {
    id: 'HH:D4E1', householdId: 'HH:D4E1', status: 'new',
    supplies: ['food'],
    people: { infant: 0, childAdult: 1, senior: 2 },
    location: { lat: C.lat - 0.022, lng: C.lng - 0.040 },
    nodeId: 'N-SW1',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(52),
  },
  {
    id: 'HH:D5F6', householdId: 'HH:D5F6', status: 'new',
    supplies: ['other'],
    people: { infant: 2, childAdult: 2, senior: 0 },
    location: { lat: C.lat - 0.018, lng: C.lng - 0.036 },
    nodeId: 'N-SW1',
    notes: 'Formula, diapers size 1, waterproof mattress cover',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(16),
  },
  {
    id: 'HH:D6G3', householdId: 'HH:D6G3', status: 'new',
    supplies: ['medical'],
    people: { infant: 0, childAdult: 2, senior: 0 },
    location: { lat: C.lat - 0.026, lng: C.lng - 0.034 },
    nodeId: 'N-SW1',
    notes: '',
    medicalProfiles: [
      { ageTier: 'child_adult', count: 1, conditionType: 'injury', specificNeed: 'Deep laceration, needs cleaning, dressing, stitches' },
    ],
    triageScore: 0, receivedAt: minsAgo(10),
  },

  // ── Cluster E: near Supply 05 (W) ──
  {
    id: 'HH:E1B9', householdId: 'HH:E1B9', status: 'new',
    supplies: ['food', 'water'],
    people: { infant: 1, childAdult: 3, senior: 0 },
    location: { lat: C.lat + 0.009, lng: C.lng - 0.046 },
    nodeId: 'N-W1',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(17),
  },
  {
    id: 'HH:E2C4', householdId: 'HH:E2C4', status: 'new',
    supplies: ['water'],
    people: { infant: 0, childAdult: 2, senior: 0 },
    location: { lat: C.lat + 0.003, lng: C.lng - 0.045 },
    nodeId: 'N-W1',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(41),
  },
  {
    id: 'HH:E3D7', householdId: 'HH:E3D7', status: 'new',
    supplies: ['medical'],
    people: { infant: 0, childAdult: 2, senior: 0 },
    location: { lat: C.lat + 0.007, lng: C.lng - 0.042 },
    nodeId: 'N-W1',
    notes: '',
    medicalProfiles: [
      { ageTier: 'child_adult', count: 1, conditionType: 'other', specificNeed: 'Postpartum recovery, possible infection, needs eval' },
    ],
    triageScore: 0, receivedAt: minsAgo(12),
  },
  {
    id: 'HH:E4A6', householdId: 'HH:E4A6', status: 'new',
    supplies: ['other'],
    people: { infant: 0, childAdult: 3, senior: 1 },
    location: { lat: C.lat + 0.002, lng: C.lng - 0.038 },
    nodeId: 'N-W1',
    notes: 'Generator fuel or battery pack for CPAP machine',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(29),
  },
  {
    id: 'HH:E5H1', householdId: 'HH:E5H1', status: 'new',
    supplies: ['food'],
    people: { infant: 0, childAdult: 1, senior: 2 },
    location: { lat: C.lat + 0.011, lng: C.lng - 0.044 },
    nodeId: 'N-W1',
    notes: '',
    medicalProfiles: [],
    triageScore: 0, receivedAt: minsAgo(62),
  },
  {
    id: 'HH:E6F3', householdId: 'HH:E6F3', status: 'new',
    supplies: ['medical', 'water'],
    people: { infant: 0, childAdult: 1, senior: 1 },
    location: { lat: C.lat + 0.005, lng: C.lng - 0.048 },
    nodeId: 'N-W2',
    notes: '',
    medicalProfiles: [
      { ageTier: 'senior', count: 1, conditionType: 'chronic', specificNeed: 'Kidney disease, missed 2 dialysis, urgent med contact' },
    ],
    triageScore: 0, receivedAt: minsAgo(7),
  },
]

export function startMockGateway(dispatch: Dispatch<AppAction>): () => void {
  const timeouts: ReturnType<typeof setTimeout>[] = []

  SEED_NODES.forEach(node => dispatch({ type: 'NODE_STATUS_UPDATED', payload: node }))
  SEED_VEHICLES.forEach(vehicle => dispatch({ type: 'VEHICLE_UPDATED', payload: vehicle }))

  // Stagger request seeding for a natural load-in feel
  SEED_REQUESTS.forEach((req, i) => {
    const t = setTimeout(() => {
      dispatch({ type: 'REQUEST_RECEIVED', payload: req })
    }, i * 80)
    timeouts.push(t)
  })

  dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connected' })

  return () => timeouts.forEach(clearTimeout)
}
