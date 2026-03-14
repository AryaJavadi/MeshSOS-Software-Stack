import { Vehicle, HouseholdRequest } from '../../types'
import { useDashboard } from '../../context/DashboardContext'

const VEHICLE_STATUS_STYLES: Record<Vehicle['status'], { bg: string; border: string; color: string }> = {
  available: { bg: 'var(--color-green-dim)', border: 'var(--color-green-border)', color: 'var(--color-green)' },
  loading:   { bg: 'var(--color-yellow-dim)', border: 'var(--color-yellow-border)', color: 'var(--color-yellow)' },
  enroute:   { bg: 'var(--color-blue-dim)', border: 'var(--color-blue-border)', color: 'var(--color-blue)' },
  returning: { bg: 'var(--color-accent-dim)', border: 'var(--color-border)', color: 'var(--color-accent)' },
}

const REQUEST_STATUS_COLOR: Record<string, string> = {
  new:          'var(--color-red)',
  acknowledged: 'var(--color-yellow)',
  dispatched:   'var(--color-blue)',
  delivered:    'var(--color-green)',
}

const SUPPLY_EMOJIS: Record<string, string> = {
  water: '💧', food: '🍎', medical: '🧰', other: '✏️',
}

function formatHours(h: number): string {
  if (h < 0.017) return '0m' // < 1 min
  if (h < 1) return `${Math.round(h * 60)}m`
  return `${h.toFixed(1)}h`
}

function distKm(
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number {
  const dlat = (bLat - aLat) * 111
  const dlng = (bLng - aLng) * 111 * Math.cos(aLat * Math.PI / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

export default function DispatchBoard() {
  const { state, dispatch } = useDashboard()
  const selectedVehicleId = state.selectedVehicleId

  // All requests not yet assigned to any vehicle and not delivered
  const unassigned = state.requests.filter(r =>
    r.status !== 'delivered' &&
    !state.vehicles.some(v => v.assignedRequestIds.includes(r.id))
  )

  function loadRequest(vehicle: Vehicle, req: HouseholdRequest) {
    if (vehicle.assignedRequestIds.includes(req.id)) return
    dispatch({
      type: 'VEHICLE_UPDATED',
      payload: {
        ...vehicle,
        status: vehicle.status === 'available' ? 'loading' : vehicle.status,
        assignedRequestIds: [...vehicle.assignedRequestIds, req.id],
      },
    })
  }

  function dropRequest(vehicle: Vehicle, reqId: string) {
    const next = vehicle.assignedRequestIds.filter(id => id !== reqId)
    dispatch({
      type: 'VEHICLE_UPDATED',
      payload: {
        ...vehicle,
        status: next.length === 0 ? 'available' : vehicle.status,
        assignedRequestIds: next,
      },
    })
  }

  function dispatchVehicle(vehicle: Vehicle) {
    dispatch({ type: 'VEHICLE_UPDATED', payload: { ...vehicle, status: 'enroute', dispatchedAt: Date.now() } })
  }

  function recallVehicle(vehicle: Vehicle) {
    dispatch({ type: 'VEHICLE_UPDATED', payload: { ...vehicle, status: 'available', assignedRequestIds: [] } })
  }

  function markDelivered(reqId: string) {
    dispatch({ type: 'REQUEST_STATUS_UPDATED', payload: { id: reqId, status: 'delivered' } })
  }

  return (
    <div className="p-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-3">Vehicles</div>

      {state.vehicles.length === 0 && (
        <div className="text-text-muted text-[11px] text-center py-6">No vehicles available</div>
      )}

      {[...state.vehicles].sort((a, b) => a.hoursWorked - b.hoursWorked).map(vehicle => {
        const vstyle = VEHICLE_STATUS_STYLES[vehicle.status]
        const isSelected = selectedVehicleId === vehicle.id
        const canLoad = vehicle.status === 'available' || vehicle.status === 'loading'

        // Proximity suggestions: unassigned requests sorted by distance to this vehicle
        const suggestions: (HouseholdRequest & { distKm: number })[] = isSelected && canLoad
          ? unassigned
              .map(r => ({ ...r, distKm: distKm(vehicle.location.lat, vehicle.location.lng, r.location.lat, r.location.lng) }))
              .sort((a, b) => a.distKm - b.distKm)
              .slice(0, 5)
          : []

        return (
          <div
            key={vehicle.id}
            className="bg-surface border rounded-[10px] p-3 mb-2 cursor-pointer transition-colors"
            style={{
              borderColor: isSelected ? vstyle.border : 'var(--color-border)',
              boxShadow: isSelected ? `0 0 0 1px ${vstyle.border}` : 'none',
            }}
            onClick={() => dispatch({ type: 'VEHICLE_SELECTED', payload: isSelected ? null : vehicle.id })}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[16px]">{vehicle.name.toLowerCase().includes('medic') ? '🚑' : '🚐'}</span>
              <span className="text-[12px] font-bold text-text flex-1">{vehicle.name}</span>
              <span
                className="px-2 py-[2px] rounded-full text-[8.5px] font-bold uppercase tracking-wide border"
                style={{ background: vstyle.bg, borderColor: vstyle.border, color: vstyle.color }}
              >
                {vehicle.status === 'enroute' ? 'En Route' : vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1)}
              </span>
              <span
                className="text-[9px] font-semibold tabular-nums"
                style={{ color: vehicle.hoursWorked >= 8 ? 'var(--color-red)' : vehicle.hoursWorked >= 4 ? 'var(--color-yellow)' : 'var(--color-text-muted)' }}
                title="Hours worked this shift"
              >
                {formatHours(vehicle.hoursWorked)}
              </span>
            </div>

            {/* Auto-computed cargo summary */}
            {vehicle.cargo.length > 0 && (
              <div className="flex gap-1 flex-wrap mb-2">
                {vehicle.cargo.map((c, i) => (
                  <span key={i} className="text-[9px] font-semibold px-1.5 py-[1.5px] rounded bg-surface2 border border-border text-text-muted">
                    {SUPPLY_EMOJIS[c.type] ?? '📦'} {c.type} ×{c.quantity}
                  </span>
                ))}
              </div>
            )}

            {/* Assigned requests */}
            {vehicle.assignedRequestIds.length > 0 && (
              <div className="flex flex-col gap-1 mb-2">
                <div className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-0.5">Loaded</div>
                {vehicle.assignedRequestIds.map(reqId => {
                  const req = state.requests.find(r => r.id === reqId)
                  const statusColor = req ? REQUEST_STATUS_COLOR[req.status] : 'var(--color-text-muted)'
                  return (
                    <div key={reqId} className="flex items-center gap-2 px-2 py-1.5 bg-surface2 rounded-[8px]">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColor }} />
                      <button
                        onClick={e => { e.stopPropagation(); dispatch({ type: 'REQUEST_EXPANDED', payload: reqId }) }}
                        className="font-mono text-[9.5px] text-accent flex-1 text-left hover:opacity-70 transition-opacity"
                      >
                        {reqId}
                      </button>
                      {req && (
                        <span className="text-[9px] text-text-muted">
                          {req.supplies.map(s => SUPPLY_EMOJIS[s] ?? '📦').join(' ')}
                        </span>
                      )}
                      {req && req.status !== 'delivered' && vehicle.status === 'enroute' && (
                        <button
                          onClick={e => { e.stopPropagation(); markDelivered(reqId) }}
                          className="text-[8.5px] font-bold transition-opacity hover:opacity-70"
                          style={{ color: 'var(--color-green)' }}
                        >
                          ✓
                        </button>
                      )}
                      {req?.status === 'delivered' && (
                        <span className="text-[8.5px]" style={{ color: 'var(--color-green)' }}>✓</span>
                      )}
                      {vehicle.status !== 'enroute' && req?.status !== 'delivered' && (
                        <button
                          onClick={e => { e.stopPropagation(); dropRequest(vehicle, reqId) }}
                          className="text-[9px] font-semibold border rounded px-1.5 py-0.5 transition-opacity hover:opacity-70"
                          style={{ background: 'var(--color-red-dim)', borderColor: 'var(--color-red-border)', color: 'var(--color-red)' }}
                          title="Drop this request"
                        >
                          Drop
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Proximity suggestions — only shown when this vehicle is selected */}
            {isSelected && canLoad && (
              <div className="mb-2" onClick={e => e.stopPropagation()}>
                <div className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-1">
                  {suggestions.length > 0 ? 'Nearby requests' : 'No unassigned requests'}
                </div>
                <div className="flex flex-col gap-1">
                  {suggestions.map(r => (
                    <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 bg-surface2 rounded-[8px] border border-border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[9.5px] text-text font-semibold">{r.id}</span>
                          <span className="text-[9px] text-text-muted">· {r.distKm.toFixed(1)}km</span>
                        </div>
                        <div className="flex gap-0.5 mt-0.5">
                          {r.supplies.map(s => (
                            <span key={s} className="text-[10px]">{SUPPLY_EMOJIS[s]}</span>
                          ))}
                          {(r.supplies.includes('medical') || r.medicalProfiles.length > 0) && (
                            <span className="text-[9px] font-bold ml-0.5" style={{ color: 'var(--color-red)' }}>🩺</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => loadRequest(vehicle, r)}
                        className="text-[9px] font-semibold border rounded-[6px] px-2 py-0.5 flex-shrink-0 transition-opacity hover:opacity-80"
                        style={{ background: 'var(--color-accent-dim)', borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}
                      >
                        + Load
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
              {vehicle.status === 'loading' && vehicle.assignedRequestIds.length > 0 && (
                <button
                  onClick={() => dispatchVehicle(vehicle)}
                  className="flex-1 py-1.5 rounded-[8px] text-[10px] font-semibold border transition-opacity hover:opacity-80"
                  style={{ background: 'var(--color-blue-dim)', borderColor: 'var(--color-blue-border)', color: 'var(--color-blue)' }}
                >
                  🚐 Dispatch
                </button>
              )}
              {(vehicle.status === 'enroute' || vehicle.status === 'loading') && (
                <button
                  onClick={() => recallVehicle(vehicle)}
                  className="flex-1 py-1.5 rounded-[8px] text-[10px] font-semibold border transition-opacity hover:opacity-80"
                  style={{ background: 'var(--color-red-dim)', borderColor: 'var(--color-red-border)', color: 'var(--color-red)' }}
                >
                  ↩ Recall
                </button>
              )}
              {vehicle.status === 'returning' && (
                <div
                  className="flex-1 py-1.5 rounded-[8px] text-[10px] font-semibold border text-center"
                  style={{ background: 'var(--color-accent-dim)', borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}
                >
                  Returning…
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
