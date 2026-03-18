import './utils/leafletIconFix'
import { useEffect, useRef } from 'react'
import { DashboardProvider, useDashboard } from './context/DashboardContext'
import { useGatewaySocket } from './hooks/useGatewaySocket'
import { startMockGateway, SUPPLY_STATION } from './mocks/gatewayMock'
import { Vehicle } from './types'
import TopNav from './components/TopNav'
import StatBar from './components/StatBar'
import RequestsFeed from './components/RequestsFeed/RequestsFeed'
import MapView from './components/MapView/MapView'
import RightPanel from './components/RightPanel/RightPanel'

// ── Route helpers ────────────────────────────────────────────────────────────

function interpolatePath(
  path: [number, number][],
  t: number,
): { lat: number; lng: number } {
  if (path.length === 0) return SUPPLY_STATION
  if (t <= 0) return { lat: path[0][0], lng: path[0][1] }
  if (t >= 1) return { lat: path[path.length - 1][0], lng: path[path.length - 1][1] }
  const segs = path.length - 1
  const raw = t * segs
  const i = Math.floor(raw)
  const f = raw - i
  const [lat1, lng1] = path[i]
  const [lat2, lng2] = path[Math.min(i + 1, segs)]
  return { lat: lat1 + (lat2 - lat1) * f, lng: lng1 + (lng2 - lng1) * f }
}

async function fetchRoute(waypoints: { lat: number; lng: number }[]): Promise<{
  path: [number, number][]
  stopFractions: number[]   // cumulative fractions at which each intermediate stop is reached
  turnaroundFraction: number  // fraction at which the last stop is reached (start of return)
  totalDistanceKm: number
} | null> {
  try {
    const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';')
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data.routes?.[0]) return null

    const route = data.routes[0]
    const path: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
    )
    const legs: { distance: number }[] = route.legs
    const totalDist = legs.reduce((s: number, l: { distance: number }) => s + l.distance, 0)

    // Fraction at each intermediate waypoint (stop), not the final station return
    let cumDist = 0
    const stopFractions: number[] = []
    for (let i = 0; i < legs.length - 1; i++) {
      cumDist += legs[i].distance
      stopFractions.push(totalDist > 0 ? cumDist / totalDist : (i + 1) / legs.length)
    }
    const turnaroundFraction = stopFractions[stopFractions.length - 1] ?? 0.7

    return { path, stopFractions, turnaroundFraction, totalDistanceKm: totalDist / 1000 }
  } catch {
    return null
  }
}

// Straight-line fallback when OSRM is unavailable
function buildFallbackRoute(waypoints: { lat: number; lng: number }[], numStops: number) {
  const path: [number, number][] = waypoints.map(w => [w.lat, w.lng])
  const stopFractions = Array.from({ length: numStops }, (_, i) => (i + 1) / waypoints.length)
  const turnaroundFraction = stopFractions[stopFractions.length - 1] ?? 0.7
  const totalDistanceKm =
    waypoints.slice(0, -1).reduce((sum, w, i) => {
      const next = waypoints[i + 1]
      const dlat = (next.lat - w.lat) * 111
      const dlng =
        (next.lng - w.lng) * 111 * Math.cos(w.lat * (Math.PI / 180))
      return sum + Math.sqrt(dlat * dlat + dlng * dlng)
    }, 0)
  return { path, stopFractions, turnaroundFraction, totalDistanceKm }
}

// ── Active route state ───────────────────────────────────────────────────────

const STOP_PAUSE_MS   = 5_000   // how long vehicle stays at each stop
const OUTBOUND_BASE_MS = 48_000  // 0.25× speed — outbound leg always takes this long

interface ActiveRoute {
  path: [number, number][]
  stopFractions: number[]
  turnaroundFraction: number
  reqIds: string[]
  vehicleId: string
  vehicle: Vehicle          // mutable snapshot, updated each tick
  startMs: number
  travelMs: number          // pure travel time (no pauses); outbound = OUTBOUND_BASE_MS
  deliveredCount: number
  totalDistanceKm: number
  baseHoursWorked: number   // vehicle.hoursWorked at the moment of dispatch, for live calc
  pausedMs: number          // cumulative ms spent paused at stops so far
  pauseStartMs?: number     // if currently paused: when the pause started
}

// ── App ──────────────────────────────────────────────────────────────────────

function AppInner() {
  const { state, dispatch } = useDashboard()

  useGatewaySocket(dispatch, () => startMockGateway(dispatch))

  // Theme persistence
  useEffect(() => {
    const saved = localStorage.getItem('meshsos-theme') as 'dark' | 'light' | null
    dispatch({ type: 'SET_THEME', payload: saved ?? 'dark' })
  }, [dispatch])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark')
  }, [state.theme])

  // Seed mock infrastructure on startup — skip if requests were hydrated from localStorage
  useEffect(() => {
    if (state.requests.length > 0) return
    return startMockGateway(dispatch)
  }, [dispatch])

  // ── Vehicle route animations ─────────────────────────────────────────────
  const activeRoutes   = useRef<Map<string, ActiveRoute>>(new Map())
  const animatingVehicles = useRef<Set<string>>(new Set())
  const tickRef        = useRef<ReturnType<typeof setInterval> | null>(null)

  function startTick() {
    if (tickRef.current) return
    tickRef.current = setInterval(() => {
      if (activeRoutes.current.size === 0) {
        clearInterval(tickRef.current!)
        tickRef.current = null
        return
      }
      const now  = Date.now()
      const done: string[] = []

      activeRoutes.current.forEach(route => {
        // ── Effective travel progress (excludes pause time) ──────────────────
        const ongoingPause     = route.pauseStartMs != null ? now - route.pauseStartMs : 0
        const effectiveElapsed = (now - route.startMs) - route.pausedMs - ongoingPause
        const travelT          = Math.min(effectiveElapsed / route.travelMs, 1.0)

        // ── Pause logic: start a pause when vehicle arrives at a stop ────────
        if (
          route.pauseStartMs == null &&
          route.deliveredCount < route.stopFractions.length &&
          travelT >= route.stopFractions[route.deliveredCount]
        ) {
          route.pauseStartMs = now   // vehicle has arrived — start 5 s stop
        }

        // ── End pause and deliver the request after STOP_PAUSE_MS ────────────
        if (route.pauseStartMs != null && now - route.pauseStartMs >= STOP_PAUSE_MS) {
          route.pausedMs    += now - route.pauseStartMs
          route.pauseStartMs = undefined
          const reqId = route.reqIds[route.deliveredCount]
          dispatch({ type: 'REQUESTS_DELIVERED', payload: [reqId] })
          route.vehicle = {
            ...route.vehicle,
            assignedRequestIds: route.vehicle.assignedRequestIds.filter(id => id !== reqId),
          }
          route.deliveredCount++
        }

        // ── Spatial position: freeze at stop while pausing ───────────────────
        const spatialT =
          route.pauseStartMs != null
            ? route.stopFractions[route.deliveredCount]   // stay at stop pin
            : travelT
        const loc = interpolatePath(route.path, spatialT)

        // ── Live hours: proportional to distance travelled so far ────────────
        const distanceSoFar  = spatialT * route.totalDistanceKm
        const liveHoursWorked = route.baseHoursWorked + (5 + distanceSoFar) / 60

        // ── Status: 'returning' once past the last stop ──────────────────────
        const isReturning     = travelT > route.turnaroundFraction && route.pauseStartMs == null
        const currentStatus: Vehicle['status'] = isReturning ? 'returning' : 'enroute'

        // ── Trip complete ────────────────────────────────────────────────────
        if (travelT >= 1.0 && route.pauseStartMs == null && route.deliveredCount >= route.reqIds.length) {
          const tripHours = (5 + route.totalDistanceKm) / 60
          dispatch({
            type: 'VEHICLE_UPDATED',
            payload: {
              ...route.vehicle,
              status: 'available',
              assignedRequestIds: [],
              location: { lat: SUPPLY_STATION.lat, lng: SUPPLY_STATION.lng },
              hoursWorked: route.baseHoursWorked + tripHours,
              dispatchedAt: undefined,
            },
          })
          setTimeout(
            () => dispatch({ type: 'CLEAR_RECENTLY_DELIVERED', payload: route.reqIds }),
            5_000,
          )
          done.push(route.vehicleId)
        } else {
          // ── Tick update: position + status + live hours ──────────────────
          route.vehicle = {
            ...route.vehicle,
            location: loc,
            status: currentStatus,
            hoursWorked: liveHoursWorked,
          }
          dispatch({ type: 'VEHICLE_UPDATED', payload: { ...route.vehicle } })
        }
      })

      done.forEach(id => {
        activeRoutes.current.delete(id)
        animatingVehicles.current.delete(id)
      })
    }, 200)
  }

  useEffect(() => {
    state.vehicles.forEach(vehicle => {
      const id = vehicle.id
      const isAnimating = animatingVehicles.current.has(id)

      if (vehicle.status === 'enroute' && vehicle.assignedRequestIds.length > 0 && !isAnimating) {
        // New dispatch — start animation
        animatingVehicles.current.add(id)

        // Mark all assigned requests as 'dispatched' (yellow → blue on map)
        vehicle.assignedRequestIds.forEach(reqId =>
          dispatch({ type: 'REQUEST_STATUS_UPDATED', payload: { id: reqId, status: 'dispatched' } }),
        )

        const reqIds   = [...vehicle.assignedRequestIds]
        const stopLocs = reqIds
          .map(reqId => state.requests.find(r => r.id === reqId)?.location)
          .filter(Boolean) as { lat: number; lng: number }[]

        const waypoints = [SUPPLY_STATION, ...stopLocs, SUPPLY_STATION]
        const vehicleSnapshot: Vehicle = { ...vehicle }

        fetchRoute(waypoints).then(result => {
          // Recall may have happened while we were fetching
          if (!animatingVehicles.current.has(id)) return

          const { path, stopFractions, turnaroundFraction, totalDistanceKm } =
            result ?? buildFallbackRoute(waypoints, stopLocs.length)

          // travelMs: outbound always = OUTBOUND_BASE_MS; return is proportional
          const travelMs = OUTBOUND_BASE_MS / turnaroundFraction

          activeRoutes.current.set(id, {
            path,
            stopFractions,
            turnaroundFraction,
            reqIds,
            vehicleId: id,
            vehicle: { ...vehicleSnapshot },
            startMs: Date.now(),
            travelMs,
            deliveredCount: 0,
            totalDistanceKm,
            baseHoursWorked: vehicleSnapshot.hoursWorked,
            pausedMs: 0,
            pauseStartMs: undefined,
          })
          startTick()
        })
      } else if (isAnimating && vehicle.status === 'available') {
        // Vehicle was recalled — cancel animation and snap back to station
        activeRoutes.current.delete(id)
        animatingVehicles.current.delete(id)
        dispatch({
          type: 'VEHICLE_UPDATED',
          payload: {
            ...vehicle,
            status: 'available',
            assignedRequestIds: [],
            location: { lat: SUPPLY_STATION.lat, lng: SUPPLY_STATION.lng },
          },
        })
      }
    })
  }, [state.vehicles, state.requests, dispatch])

  // Cleanup interval on unmount
  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current) }, [])

  // Escape deselects
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
