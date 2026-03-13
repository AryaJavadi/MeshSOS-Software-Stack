import { CircleMarker, Popup } from 'react-leaflet'
import { MeshNode } from '../../types'
import { relativeTime } from '../../utils/time'

const NODE_COLORS: Record<MeshNode['status'], string> = {
  gateway: '#fbbf24',
  online: '#34d399',
  weak: '#fbbf24',
  offline: '#4e5d6e',
}

interface Props {
  node: MeshNode
}

export default function NodeMarker({ node }: Props) {
  const color = NODE_COLORS[node.status]
  const radius = node.status === 'gateway' ? 10 : 6
  const fillOpacity = node.status === 'offline' ? 0.3 : 0.85

  return (
    <CircleMarker
      center={[node.location.lat, node.location.lng]}
      radius={radius}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity,
        weight: node.status === 'gateway' ? 2.5 : 1.5,
        opacity: node.status === 'offline' ? 0.4 : 1,
      }}
    >
      <Popup className="mesh-node-popup">
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, lineHeight: 1.6, color: '#e2e8f0', background: '#111722', padding: '6px 2px', minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: color, marginBottom: 4 }}>{node.id}</div>
          <div>Status: <span style={{ color: color, textTransform: 'capitalize' }}>{node.status}</span></div>
          <div>Signal: {node.signalDbm} dBm</div>
          <div>Hops to GW: {node.hopsToGateway}</div>
          <div style={{ color: '#4e5d6e', fontSize: 10, marginTop: 3 }}>Last seen {relativeTime(node.lastSeen)}</div>
        </div>
      </Popup>
    </CircleMarker>
  )
}
