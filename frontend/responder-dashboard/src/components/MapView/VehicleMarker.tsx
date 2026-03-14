import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { Vehicle } from '../../types'
import { useDashboard } from '../../context/DashboardContext'

const STATUS_COLORS: Record<Vehicle['status'], string> = {
  available: '#34d399',
  loading:   '#fbbf24',
  enroute:   '#60a5fa',
  returning: '#a78bfa',
}

function createVehicleIcon(vehicle: Vehicle, selected: boolean): L.DivIcon {
  const color = STATUS_COLORS[vehicle.status]
  const emoji = vehicle.name.toLowerCase().includes('medic') ? '🚑' : '🚐'
  const size = selected ? 36 : 28
  const ring = selected ? `0 0 0 3px ${color}55, 0 2px 12px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)'

  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 8px;
      background: ${color}22;
      border: ${selected ? '2.5px' : '1.5px'} solid ${color};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${selected ? 17 : 14}px;
      box-shadow: ${ring};
    ">${emoji}</div>
  `

  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
  })
}

interface Props {
  vehicle: Vehicle
}

export default function VehicleMarker({ vehicle }: Props) {
  const { state, dispatch } = useDashboard()
  const selected = state.selectedVehicleId === vehicle.id
  const icon = createVehicleIcon(vehicle, selected)
  const statusColor = STATUS_COLORS[vehicle.status]

  return (
    <Marker
      position={[vehicle.location.lat, vehicle.location.lng]}
      icon={icon}
      eventHandlers={{
        click: () => dispatch({ type: 'VEHICLE_SELECTED', payload: vehicle.id }),
      }}
    >
      <Popup>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, lineHeight: 1.6, padding: '6px 2px', minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: statusColor, marginBottom: 4 }}>{vehicle.name}</div>
          <div>Status: <span style={{ textTransform: 'capitalize', color: statusColor }}>{vehicle.status}</span></div>
          <div>Cargo: {vehicle.cargo.length > 0 ? vehicle.cargo.map(c => `${c.type} ×${c.quantity}`).join(', ') : 'Empty'}</div>
          <div>Assignments: {vehicle.assignedRequestIds.length}</div>
          <div>Hours worked: {vehicle.hoursWorked < 1 ? `${Math.round(vehicle.hoursWorked * 60)}m` : `${vehicle.hoursWorked.toFixed(1)}h`}</div>
        </div>
      </Popup>
    </Marker>
  )
}
