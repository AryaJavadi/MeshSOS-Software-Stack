import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { HouseholdRequest } from '../../types'
import { computeTriageScore } from '../../utils/triage'
import { relativeTime } from '../../utils/time'

const STATUS_COLORS: Record<HouseholdRequest['status'], string> = {
  new: '#f87171',
  acknowledged: '#fbbf24',
  dispatched: '#60a5fa',
  delivered: '#34d399',
}

function createPinIcon(request: HouseholdRequest, isSelected: boolean): L.DivIcon {
  const color = STATUS_COLORS[request.status]
  const size = isSelected ? 28 : 22
  const border = isSelected ? '2.5px solid white' : `1.5px solid rgba(0,0,0,0.3)`

  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: ${color};
      border: ${border};
      box-shadow: 0 2px 8px rgba(0,0,0,0.4)${isSelected ? ', 0 0 0 3px rgba(167,139,250,0.4)' : ''};
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="transform: rotate(45deg); font-size: ${isSelected ? 12 : 10}px; line-height: 1;">
        ${request.supplies.includes('medical') ? '🩹' : request.supplies.includes('water') ? '💧' : '📦'}
      </span>
    </div>
  `

  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  })
}

interface Props {
  request: HouseholdRequest
  isSelected: boolean
  onSelect: () => void
}

export default function RequestPin({ request, isSelected, onSelect }: Props) {
  const score = computeTriageScore(request)
  const icon = createPinIcon(request, isSelected)

  return (
    <Marker
      position={[request.location.lat, request.location.lng]}
      icon={icon}
      eventHandlers={{ click: onSelect }}
      zIndexOffset={isSelected ? 1000 : 0}
    >
      <Popup>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, lineHeight: 1.6, color: '#e2e8f0', background: '#111722', padding: '6px 2px', minWidth: 180 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#a78bfa', marginBottom: 4 }}>{request.id}</div>
          <div>Status: <span style={{ textTransform: 'capitalize', color: STATUS_COLORS[request.status] }}>{request.status}</span></div>
          <div>Needs: {request.supplies.join(', ')}</div>
          <div>People: {request.people.infant + request.people.childAdult + request.people.senior}</div>
          <div style={{ color: '#fbbf24' }}>Score: {score.toFixed(1)}</div>
          <div style={{ color: '#4e5d6e', fontSize: 10, marginTop: 3 }}>Received {relativeTime(request.receivedAt)}</div>
        </div>
      </Popup>
    </Marker>
  )
}
