import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, ZoomControl, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import { useDashboard } from '../../context/DashboardContext'
import { HouseholdRequest } from '../../types'
import NodeMarker from './NodeMarker'
import VehicleMarker from './VehicleMarker'
import { SUPPLY_STATION } from '../../mocks/gatewayMock'

// Civilian-app status colors, theme-aware — new + acknowledged both yellow (unassigned)
function statusColors(theme: 'dark' | 'light'): Record<HouseholdRequest['status'], string> {
  return {
    new:          '#d29922',
    acknowledged: '#d29922',
    dispatched:   theme === 'dark' ? '#60a5fa' : '#1d4ed8',
    delivered:    theme === 'dark' ? '#3fb950' : '#16a34a',
  }
}

// Pan to expanded request
function PanToExpanded() {
  const map = useMap()
  const { state } = useDashboard()

  useEffect(() => {
    if (!state.expandedRequestId) return
    if (state.selectedVehicleId) return  // never pan while dispatching a vehicle
    const req = state.requests.find(r => r.id === state.expandedRequestId)
    if (req) {
      map.flyTo([req.location.lat, req.location.lng], Math.max(map.getZoom(), 15), {
        animate: true,
        duration: 0.8,
      })
    }
  }, [state.expandedRequestId, state.requests, map])

  return null
}

// Fit bounds on first data arrival (works for both mock seed data and live Mode 2 data)
function FitBoundsOnLoad() {
  const map = useMap()
  const { state } = useDashboard()
  const hasFit = useRef(false)

  useEffect(() => {
    if (hasFit.current) return
    const points: [number, number][] = [
      ...state.requests.map(r => [r.location.lat, r.location.lng] as [number, number]),
      ...state.nodes.map(n => [n.location.lat, n.location.lng] as [number, number]),
    ]
    if (points.length === 0) return
    hasFit.current = true
    if (points.length === 1) {
      map.setView(points[0], 14)
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] })
    }
  }, [state.requests, state.nodes, map])

  return null
}

// Clustered request pins
function ClusteredRequestPins() {
  const map = useMap()
  const { state, dispatch } = useDashboard()

  useEffect(() => {
    const COLORS = statusColors(state.theme)
    const accentColor = state.theme === 'dark' ? '#a78bfa' : '#16a34a'
    const accentDim = state.theme === 'dark' ? 'rgba(167,139,250,0.15)' : 'rgba(22,163,74,0.12)'

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 60,
      iconCreateFunction: clusterGroup => {
        const count = clusterGroup.getChildCount()
        const hasUnassigned = clusterGroup.getAllChildMarkers().some(m => {
          const req = (m as L.Marker & { _req?: HouseholdRequest })._req
          return req?.status === 'new' || req?.status === 'acknowledged'
        })
        const color = hasUnassigned ? '#d29922' : accentColor
        const bg = hasUnassigned ? 'rgba(210,153,34,0.15)' : accentDim
        return L.divIcon({
          html: `<div style="width:36px;height:36px;border-radius:50%;background:${bg};border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:${color};font-family:'DM Mono',monospace;box-shadow:0 0 12px ${bg};">${count}</div>`,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })
      },
    })

    state.requests
      .filter(r => r.status !== 'delivered' || state.recentlyDeliveredIds.includes(r.id))
      .forEach(req => {
      const color = COLORS[req.status]
      const highlight = state.selectedRequestId === req.id || state.expandedRequestId === req.id
      const size = highlight ? 28 : 22
      const border = highlight ? '2.5px solid white' : '1.5px solid rgba(0,0,0,0.25)'
      const ring = highlight ? `, 0 0 0 3px ${accentColor}55` : ''
      const emoji = req.supplies.includes('medical') || req.medicalProfiles.length > 0
        ? '🧰'
        : req.supplies.includes('water') ? '💧'
        : req.supplies.includes('other') ? '✏️'
        : '🍎'

      const icon = L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:${border};box-shadow:0 2px 8px rgba(0,0,0,0.35)${ring};display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:${highlight ? 12 : 10}px">${emoji}</span></div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size],
      })

      const marker = L.marker([req.location.lat, req.location.lng], { icon }) as L.Marker & { _req?: HouseholdRequest }
      marker._req = req
      marker.on('click', () => {
        const selectedVehicle = state.vehicles.find(v => v.id === state.selectedVehicleId)
        const inLoadingMode = selectedVehicle && (selectedVehicle.status === 'available' || selectedVehicle.status === 'loading')
        if (inLoadingMode) {
          // In loading mode, clicks only load eligible requests — never navigate away
          if (req.status !== 'delivered' && !selectedVehicle.assignedRequestIds.includes(req.id)) {
            dispatch({
              type: 'VEHICLE_UPDATED',
              payload: {
                ...selectedVehicle,
                status: selectedVehicle.status === 'available' ? 'loading' : selectedVehicle.status,
                assignedRequestIds: [...selectedVehicle.assignedRequestIds, req.id],
              },
            })
          }
          return  // never deselect the vehicle or pan the map while loading
        }
        dispatch({ type: 'REQUEST_EXPANDED', payload: req.id })
        dispatch({ type: 'REQUEST_SELECTED', payload: req.id })
      })
      marker.bindPopup(`
        <div style="font-family:'DM Mono',monospace;font-size:11px;line-height:1.6;padding:10px 12px;min-width:180px;">
          <div style="font-weight:700;font-size:13px;color:${accentColor};margin-bottom:4px;">${req.id}</div>
          <div style="color:inherit;opacity:0.7">Status: <span style="color:${color};text-transform:capitalize;">${req.status}</span></div>
          <div style="color:inherit;opacity:0.7">Needs: ${req.supplies.join(', ')}</div>
          <div style="color:inherit;opacity:0.7">People: ${req.people.infant + req.people.childAdult + req.people.senior}</div>
        </div>
      `)
      cluster.addLayer(marker)
    })

    map.addLayer(cluster)
    return () => { map.removeLayer(cluster) }
  }, [state.requests, state.selectedRequestId, state.expandedRequestId, state.recentlyDeliveredIds, state.selectedVehicleId, state.vehicles, state.theme, map, dispatch])

  return null
}

// Route lines from vehicle to assigned requests / station
const VEHICLE_LINE_COLORS: Record<string, string> = {
  loading:   '#fbbf24',
  enroute:   '#60a5fa',
  returning: '#a78bfa',
}

function VehicleRoutes() {
  const { state } = useDashboard()

  const lines: JSX.Element[] = []
  state.vehicles
    .filter(v => v.status === 'loading' || v.status === 'enroute' || v.status === 'returning')
    .forEach(vehicle => {
      const isSelected = state.selectedVehicleId === vehicle.id
      const color = VEHICLE_LINE_COLORS[vehicle.status] ?? '#60a5fa'
      const weight = isSelected ? 2.5 : 1.5
      const opacity = isSelected ? 0.9 : 0.45

      if (vehicle.status === 'returning') {
        // Draw a line from the vehicle back to the supply station
        lines.push(
          <Polyline
            key={`${vehicle.id}-return`}
            positions={[
              [vehicle.location.lat, vehicle.location.lng],
              [SUPPLY_STATION.lat, SUPPLY_STATION.lng],
            ]}
            pathOptions={{ color, weight, opacity, dashArray: '6 4' }}
          />,
        )
      } else {
        vehicle.assignedRequestIds.forEach(reqId => {
          const req = state.requests.find(r => r.id === reqId)
          if (!req) return
          lines.push(
            <Polyline
              key={`${vehicle.id}-${reqId}`}
              positions={[
                [vehicle.location.lat, vehicle.location.lng],
                [req.location.lat, req.location.lng],
              ]}
              pathOptions={{
                color,
                weight,
                opacity,
                dashArray: vehicle.status === 'loading' ? '8 6' : undefined,
              }}
            />,
          )
        })
      }
    })

  return <>{lines}</>
}

function StationMarker() {
  const { state } = useDashboard()
  const isDark = state.theme === 'dark'
  const color = isDark ? '#f0b429' : '#b45309'
  const icon = L.divIcon({
    html: `<div style="width:32px;height:32px;border-radius:6px;background:${color}22;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 10px rgba(0,0,0,0.35);">🏭</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  })
  return (
    <Marker position={[SUPPLY_STATION.lat, SUPPLY_STATION.lng]} icon={icon}>
      <Popup>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, lineHeight: 1.6, padding: '6px 2px', minWidth: 140 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color, marginBottom: 4 }}>Supply Station</div>
          <div>Base for all supply vehicles</div>
        </div>
      </Popup>
    </Marker>
  )
}

export default function MapView() {
  const { state } = useDashboard()
  const isDark = state.theme === 'dark'

  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

  const COLORS = statusColors(state.theme)
  const center: [number, number] = [43.4723, -80.5449]

  return (
    <div className="flex-1 overflow-hidden relative">
      <MapContainer
        center={center}
        zoom={13}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          key={tileUrl}
          url={tileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />
        <ZoomControl position="bottomright" />
        <FitBoundsOnLoad />
        <PanToExpanded />
        <VehicleRoutes />
        <ClusteredRequestPins />
        {state.nodes.map(node => <NodeMarker key={node.id} node={node} />)}
        {state.vehicles.map(vehicle => <VehicleMarker key={vehicle.id} vehicle={vehicle} />)}
        <StationMarker />
      </MapContainer>

      {/* Map legend */}
      <div
        className="absolute bottom-3 left-3 z-[1000] rounded-[10px] p-3 pointer-events-none border border-border"
        style={{ background: isDark ? 'rgba(13,17,23,0.92)' : 'rgba(245,245,240,0.95)' }}
      >
        <div className="text-[8.5px] font-bold uppercase tracking-[1px] text-text-muted mb-1.5">Request Status</div>
        {[
          { color: COLORS.new,        label: 'Unassigned' },
          { color: COLORS.dispatched, label: 'Dispatched' },
          { color: COLORS.delivered,  label: 'Delivered' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5 text-[10px] text-text-dim mb-0.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
            {item.label}
          </div>
        ))}
        <div className="text-[8.5px] font-bold uppercase tracking-[1px] text-text-muted mt-2 mb-1.5">Network</div>
        {[
          { color: isDark ? '#f0b429' : '#d29922', label: 'Gateway', sq: true },
          { color: isDark ? '#3fb950' : '#16a34a', label: 'Node online' },
          { color: '#7d8590', label: 'Node offline' },
          { color: isDark ? '#60a5fa' : '#1d4ed8', label: 'Vehicle', sq: true },
          { color: isDark ? '#f0b429' : '#b45309', label: 'Supply station', sq: true },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5 text-[10px] text-text-dim mb-0.5">
            <div
              className="w-2 h-2 flex-shrink-0"
              style={{
                background: item.sq ? `${item.color}25` : item.color,
                border: item.sq ? `1px solid ${item.color}` : 'none',
                borderRadius: item.sq ? 2 : '50%',
              }}
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
}
