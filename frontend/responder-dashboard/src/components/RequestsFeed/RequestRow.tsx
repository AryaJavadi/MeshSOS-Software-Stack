import React from 'react'
import { HouseholdRequest } from '../../types'
import { relativeTime } from '../../utils/time'
import { useDashboard } from '../../context/DashboardContext'

// new + acknowledged → same yellow "unassigned" treatment
const STATUS_COLOR: Record<HouseholdRequest['status'], string> = {
  new:          'var(--color-yellow)',
  acknowledged: 'var(--color-yellow)',
  dispatched:   'var(--color-blue)',
  delivered:    'var(--color-green)',
}

const STATUS_COLOR_DIM: Record<HouseholdRequest['status'], string> = {
  new:          'var(--color-yellow-dim)',
  acknowledged: 'var(--color-yellow-dim)',
  dispatched:   'var(--color-blue-dim)',
  delivered:    'var(--color-green-dim)',
}

// Supply chips — civilian app emojis + semantic CSS-variable colors
const SUPPLY_CHIPS: Record<string, { emoji: string; label: string; bg: string; border: string; color: string }> = {
  water:   { emoji: '💧', label: 'Water',   bg: 'var(--color-blue-dim)',    border: 'var(--color-border)', color: 'var(--color-blue)' },
  food:    { emoji: '🍎', label: 'Food',    bg: 'var(--color-green-dim)',   border: 'var(--color-green-border)', color: 'var(--color-green)' },
  medical: { emoji: '🧰', label: 'Medical', bg: 'var(--color-red-dim)',     border: 'var(--color-red-border)', color: 'var(--color-red)' },
  other:   { emoji: '✏️', label: 'Other',   bg: 'var(--color-surface2)',    border: 'var(--color-border)', color: 'var(--color-text-muted)' },
}

const AGE_LABEL: Record<string, string> = {
  infant: '👶 Infant',
  child_adult: '🧑 Adult',
  senior: '👴 Senior',
}

interface Props {
  request: HouseholdRequest
  isSelected: boolean
  isExpanded: boolean
  onToggleExpand: () => void
}

export default function RequestRow({ request, isSelected, isExpanded, onToggleExpand }: Props) {
  const { state, dispatch } = useDashboard()
  const statusColor = STATUS_COLOR[request.status]
  const statusColorDim = STATUS_COLOR_DIM[request.status]
  const hasMedical = request.supplies.includes('medical') || request.medicalProfiles.length > 0
  const totalPeople = request.people.infant + request.people.childAdult + request.people.senior
  // Loading mode: a vehicle is selected and available to load
  const selectedVehicle = state.selectedVehicleId
    ? state.vehicles.find(v => v.id === state.selectedVehicleId)
    : null
  const loadingModeActive = !!(selectedVehicle && (selectedVehicle.status === 'available' || selectedVehicle.status === 'loading'))
  const alreadyOnSelected = selectedVehicle?.assignedRequestIds.includes(request.id) ?? false
  const assignedVehicle = state.vehicles.find(v => v.assignedRequestIds.includes(request.id))

  function loadToVehicle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!selectedVehicle || alreadyOnSelected) return
    dispatch({
      type: 'VEHICLE_UPDATED',
      payload: {
        ...selectedVehicle,
        status: selectedVehicle.status === 'available' ? 'loading' : selectedVehicle.status,
        assignedRequestIds: [...selectedVehicle.assignedRequestIds, request.id],
      },
    })
  }

  const accentBorder = isExpanded || isSelected

  return (
    <div
      className="w-full text-left border-b border-border transition-colors"
      style={{
        borderLeft: `3px solid ${accentBorder ? 'var(--color-accent)' : statusColor}`,
        background: isExpanded ? 'var(--color-accent-dim)' : isSelected ? 'var(--color-surface)' : undefined,
      }}
    >
      {/* Clickable header */}
      <button
        onClick={onToggleExpand}
        className="w-full text-left px-3.5 py-3 hover:bg-surface transition-colors"
      >
        {/* Row 1: ID + time + chevron */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[13px] font-semibold text-text">{request.id}</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted font-mono tabular-nums" title={request.receivedAt}>
              {relativeTime(request.receivedAt)}
            </span>
            <span className="text-[10px] text-text-muted">{isExpanded ? '▼' : '▶'}</span>
          </div>
        </div>

        {/* Row 2: supply chips — civilian app pill style */}
        <div className="flex gap-1.5 flex-wrap mb-2">
          {request.supplies.map(s => {
            const chip = SUPPLY_CHIPS[s] ?? SUPPLY_CHIPS.other
            return (
              <span
                key={s}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                style={{ background: chip.bg, borderColor: chip.border, color: chip.color }}
              >
                {chip.emoji} {chip.label}
              </span>
            )
          })}
          {/* Medical flag when not already shown via medical supply chip */}
          {hasMedical && !request.supplies.includes('medical') && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
              style={{ background: 'var(--color-red-dim)', borderColor: 'var(--color-red-border)', color: 'var(--color-red)' }}
            >
              🧰 Medical
            </span>
          )}
        </div>

        {/* Row 3: people count + medical flag + node */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-dim">
            {totalPeople} {totalPeople === 1 ? 'person' : 'people'}
            {hasMedical && <span className="ml-1.5" style={{ color: 'var(--color-red)' }}>· 🩺</span>}
          </span>
          <span className="text-[11px] text-text-muted font-mono ml-auto">{request.nodeId}</span>
        </div>

        {/* Row 4: dispatched/delivered badge + vehicle tag */}
        {(request.status === 'dispatched' || request.status === 'delivered' || assignedVehicle) && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {(request.status === 'dispatched' || request.status === 'delivered') && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
                style={{ background: statusColorDim, borderColor: `${statusColor}40`, color: statusColor }}
              >
                {request.status === 'dispatched' ? 'Dispatched' : 'Delivered'}
              </span>
            )}
            {assignedVehicle && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
                style={{ background: 'var(--color-blue-dim)', borderColor: 'var(--color-blue-border)', color: 'var(--color-blue)' }}
              >
                🚐 {assignedVehicle.name}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Loading mode action */}
      {loadingModeActive && request.status !== 'delivered' && (
        <div className="px-3.5 pb-2.5">
          {alreadyOnSelected ? (
            <div
              className="w-full py-1.5 rounded-[8px] text-[11px] font-semibold border text-center"
              style={{ background: 'var(--color-green-dim)', borderColor: 'var(--color-green-border)', color: 'var(--color-green)' }}
            >
              ✓ On {selectedVehicle!.name}
            </div>
          ) : (
            <button
              onClick={loadToVehicle}
              className="w-full py-1.5 rounded-[8px] text-[11px] font-semibold border transition-opacity hover:opacity-80"
              style={{ background: 'var(--color-accent-dim)', borderColor: 'var(--color-border)', color: 'var(--color-accent)' }}
            >
              + Load onto {selectedVehicle!.name}
            </button>
          )}
        </div>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3.5 pb-3 pt-2.5 border-t border-border flex flex-col gap-2">
          {/* Location */}
          <div className="font-mono text-[11px] text-text-muted">
            📍 {request.location.lat.toFixed(4)}°N, {Math.abs(request.location.lng).toFixed(4)}°W
            <span className="ml-1.5 opacity-60">via {request.nodeId}</span>
          </div>

          {/* People breakdown */}
          <div className="text-[12px] text-text-dim flex flex-wrap gap-2">
            {request.people.infant > 0 && (
              <span>👶 {request.people.infant} infant{request.people.infant > 1 ? 's' : ''}</span>
            )}
            {request.people.childAdult > 0 && (
              <span>🧑 {request.people.childAdult} adult{request.people.childAdult > 1 ? 's' : ''}</span>
            )}
            {request.people.senior > 0 && (
              <span>👴 {request.people.senior} senior{request.people.senior > 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Medical profiles */}
          {request.medicalProfiles.length > 0 && (
            <div className="flex flex-col gap-1">
              {request.medicalProfiles.map((profile, i) => (
                <div key={i} className="text-[11px] leading-snug" style={{ color: 'var(--color-red)' }}>
                  🧰 {AGE_LABEL[profile.ageTier]} — {profile.specificNeed}
                </div>
              ))}
            </div>
          )}

          {/* Notes / Other request details */}
          {request.notes && (
            <div className="flex flex-col gap-1">
              {request.supplies.includes('other') && (
                <div className="text-[9px] font-bold uppercase tracking-[1.2px]" style={{ color: 'var(--color-text-muted)' }}>
                  ✏️ Other Details
                </div>
              )}
              <div
                className="text-[11px] leading-relaxed border-l-2 pl-2"
                style={{
                  borderColor: request.supplies.includes('other') ? 'var(--color-yellow)' : 'var(--color-border)',
                  color: request.supplies.includes('other') ? 'var(--color-text-dim)' : 'var(--color-text-muted)',
                  fontStyle: request.supplies.includes('other') ? 'normal' : 'italic',
                }}
              >
                {request.notes}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
