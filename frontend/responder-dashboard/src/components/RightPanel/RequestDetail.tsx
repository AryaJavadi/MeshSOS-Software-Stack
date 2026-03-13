import { HouseholdRequest, RequestStatus } from '../../types'
import { relativeTime } from '../../utils/time'
import { useDashboard } from '../../context/DashboardContext'

const STATUS_COLOR: Record<RequestStatus, string> = {
  new: 'var(--color-red)',
  acknowledged: 'var(--color-yellow)',
  dispatched: 'var(--color-blue)',
  delivered: 'var(--color-green)',
}

const STATUS_COLOR_DIM: Record<RequestStatus, string> = {
  new: 'var(--color-red-dim)',
  acknowledged: 'var(--color-yellow-dim)',
  dispatched: 'var(--color-blue-dim)',
  delivered: 'var(--color-green-dim)',
}

const STATUS_NEXT: Partial<Record<RequestStatus, { label: string; next: RequestStatus }>> = {
  new: { label: '✓ Acknowledge', next: 'acknowledged' },
  acknowledged: { label: '🚐 Dispatch Vehicle', next: 'dispatched' },
  dispatched: { label: '✓ Mark Delivered', next: 'delivered' },
}

// Civilian app supply labels + emojis
const SUPPLY_CHIPS: Record<string, { emoji: string; label: string; bg: string; border: string; color: string }> = {
  water:   { emoji: '💧', label: 'Water',   bg: 'var(--color-blue-dim)',   border: 'var(--color-border)', color: 'var(--color-blue)' },
  food:    { emoji: '🍎', label: 'Food',    bg: 'var(--color-green-dim)',  border: 'var(--color-green-border)', color: 'var(--color-green)' },
  medical: { emoji: '🧰', label: 'Medical', bg: 'var(--color-red-dim)',    border: 'var(--color-red-border)', color: 'var(--color-red)' },
  other:   { emoji: '✏️', label: 'Other',   bg: 'var(--color-surface2)',   border: 'var(--color-border)', color: 'var(--color-text-muted)' },
}

const CONDITION_LABELS: Record<string, string> = {
  injury: 'Injury',
  chronic: 'Chronic',
  disability: 'Disability',
  medication: 'Medication',
  mental_health: 'Mental health',
  other: 'Other',
}

const AGE_LABELS: Record<string, string> = {
  infant: '👶 Infant',
  child_adult: '🧑 Adult',
  senior: '👴 Senior',
}

interface Props {
  request: HouseholdRequest
}

export default function RequestDetail({ request }: Props) {
  const { dispatch } = useDashboard()
  const totalPeople = request.people.infant + request.people.childAdult + request.people.senior
  const nextAction = STATUS_NEXT[request.status]
  const statusColor = STATUS_COLOR[request.status]
  const statusColorDim = STATUS_COLOR_DIM[request.status]

  function setStatus(status: RequestStatus) {
    dispatch({ type: 'REQUEST_STATUS_UPDATED', payload: { id: request.id, status } })
  }

  function close() {
    dispatch({ type: 'REQUEST_SELECTED', payload: null })
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="font-mono text-[15px] font-bold text-text">{request.id}</div>
          <div className="text-[12px] text-text-muted mt-0.5" title={request.receivedAt}>
            {relativeTime(request.receivedAt)} · via {request.nodeId}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer"
            style={{ background: statusColorDim, borderColor: `${statusColor}40`, color: statusColor }}
            onClick={() => nextAction && setStatus(nextAction.next)}
            title={nextAction ? `Click to: ${nextAction.label}` : undefined}
          >
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </span>
          <button
            onClick={close}
            className="text-text-muted hover:text-text transition-colors text-[13px] w-7 h-7 flex items-center justify-center rounded-[10px] bg-surface border border-border"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Primary action button */}
      {nextAction && (
        <button
          onClick={() => setStatus(nextAction.next)}
          className="w-full py-3 rounded-[10px] text-[14px] font-semibold border transition-colors mb-4"
          style={{ background: statusColorDim, borderColor: `${statusColor}40`, color: statusColor }}
        >
          {nextAction.label}
        </button>
      )}

      {/* Supplies */}
      <div className="mb-4">
        <div className="text-[11px] font-bold uppercase tracking-[1.2px] text-text-muted mb-2">Needs</div>
        <div className="flex gap-2 flex-wrap">
          {request.supplies.map(s => {
            const chip = SUPPLY_CHIPS[s] ?? SUPPLY_CHIPS.other
            return (
              <span
                key={s}
                className="px-3 py-1.5 rounded-full text-[12px] font-semibold border"
                style={{ background: chip.bg, borderColor: chip.border, color: chip.color }}
              >
                {chip.emoji} {chip.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* Household */}
      <div className="mb-4">
        <div className="text-[11px] font-bold uppercase tracking-[1.2px] text-text-muted mb-2">Household</div>
        <div className="text-[14px] text-text">
          {totalPeople} {totalPeople === 1 ? 'person' : 'people'}
          {request.people.infant > 0 && <span className="ml-2">· 👶 {request.people.infant} infant</span>}
          {request.people.senior > 0 && <span className="ml-2">· 👴 {request.people.senior} senior</span>}
        </div>
      </div>

      {/* Location */}
      <div className="mb-4">
        <div className="text-[11px] font-bold uppercase tracking-[1.2px] text-text-muted mb-2">Location</div>
        <div className="font-mono text-[13px] text-accent">
          {request.location.lat.toFixed(4)}°N, {Math.abs(request.location.lng).toFixed(4)}°W
        </div>
      </div>

      {/* Notes */}
      {request.notes && (
        <div className="mb-4">
          <div className="text-[11px] font-bold uppercase tracking-[1.2px] text-text-muted mb-2">Notes</div>
          <div className="text-[13px] text-text-dim leading-relaxed bg-surface rounded-[10px] px-3 py-2.5 border border-border">
            {request.notes}
          </div>
        </div>
      )}

      {/* Medical profiles */}
      {request.medicalProfiles.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] font-bold uppercase tracking-[1.2px] text-text-muted mb-2">Medical</div>
          <div className="flex flex-col gap-2">
            {request.medicalProfiles.map((profile, i) => (
              <div key={i} className="bg-surface rounded-[10px] px-3 py-2.5 border border-border">
                <div className="text-[13px] font-semibold text-text">
                  {AGE_LABELS[profile.ageTier]}
                  {profile.count > 1 && ` (${profile.count})`}
                </div>
                <div className="text-[12px] text-text-muted mt-1">
                  {CONDITION_LABELS[profile.conditionType]} — {profile.specificNeed}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dismiss */}
      <button
        onClick={close}
        className="w-full py-2 rounded-[10px] text-[13px] font-medium border border-border text-text-muted hover:text-text hover:bg-surface transition-colors"
      >
        Dismiss
      </button>
    </div>
  )
}
