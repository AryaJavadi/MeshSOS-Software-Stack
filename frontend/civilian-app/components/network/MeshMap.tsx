import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors } from '@/constants/design';
import { MeshNode, HopLink, NodeStatus } from '@/types';

interface MeshMapProps {
  nodes: MeshNode[];
  links: HopLink[];
  userLocation?: { latitude: number; longitude: number };
  mapHeight?: number;
  connectedNodeId?: string;
  mapRef?: React.RefObject<MapView | null>;
}

const NODE_COLOR: Record<NodeStatus, string> = {
  online:  colors.green,
  weak:    colors.yellow,
  offline: colors.red,
  gateway: colors.gateway,
};

const LINK_COLOR: Record<NodeStatus, string> = {
  online:  colors.green,
  weak:    colors.yellow,
  offline: colors.textMuted,
  gateway: colors.yellow,
};

function getCoord(
  nodeId: string,
  nodes: MeshNode[],
  userLocation: { latitude: number; longitude: number }
): { latitude: number; longitude: number } | null {
  if (nodeId === 'you') return userLocation;
  const node = nodes.find((n) => n.nodeId === nodeId);
  if (!node?.latitude || !node?.longitude) return null;
  return { latitude: node.latitude, longitude: node.longitude };
}

function NodeMarkerView({ node, isConnected }: { node: MeshNode; isConnected: boolean }) {
  const color = NODE_COLOR[node.status];
  const isGateway = node.status === 'gateway';
  const isOffline = node.status === 'offline';
  const size = isGateway ? 14 : 10;
  const ringSize = size + 16;

  return (
    <View style={styles.markerWrap}>
      {/* Dot with optional connected ring */}
      <View style={styles.dotContainer}>
        {isConnected && (
          <View
            style={[
              styles.connectedRing,
              { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
            ]}
          />
        )}
        <View
          style={[
            styles.markerDot,
            {
              backgroundColor: color,
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: isOffline ? 0.4 : 1,
              borderColor: isConnected ? colors.accent : 'white',
              borderWidth: isConnected ? 2.5 : 2,
            },
          ]}
        />
      </View>

      {/* Label */}
      <View style={[styles.markerLabel, isConnected && styles.markerLabelConnected]}>
        <Text
          style={[
            styles.markerText,
            { color: isGateway ? colors.gateway : isConnected ? colors.accent : colors.text },
          ]}
        >
          {node.nodeId}
        </Text>
      </View>
    </View>
  );
}

// Default center (San Francisco) used before user location is known
const DEFAULT_LOCATION = { latitude: 37.7749, longitude: -122.4194 };

export function MeshMap({ nodes, links, userLocation, mapHeight = 280, connectedNodeId, mapRef }: MeshMapProps) {
  const center = userLocation ?? DEFAULT_LOCATION;

  return (
    <MapView
      ref={mapRef}
      style={{ height: mapHeight, width: '100%' }}
      provider={PROVIDER_DEFAULT}
      userInterfaceStyle="dark"
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass={false}
      showsScale={false}
      showsTraffic={false}
      showsBuildings={false}
      initialRegion={{
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: 0.035,
        longitudeDelta: 0.035,
      }}
    >
      {/* Connection lines */}
      {links.map((link, i) => {
        const from = getCoord(link.fromNodeId, nodes, center);
        const to   = getCoord(link.toNodeId,   nodes, center);
        if (!from || !to) return null;

        // BLE link: your phone → connected node — draw in accent purple
        const isBLELink = link.fromNodeId === 'you' && link.toNodeId === connectedNodeId;
        if (isBLELink) {
          return (
            <Polyline
              key={i}
              coordinates={[from, to]}
              strokeColor={colors.accent + 'cc'}
              strokeWidth={2.5}
              lineDashPattern={[6, 4]}
            />
          );
        }

        const toNode = nodes.find((n) => n.nodeId === link.toNodeId);
        const status = toNode?.status ?? 'online';
        const isWeak = status === 'weak' || status === 'offline';
        const baseColor = toNode ? LINK_COLOR[toNode.status] : colors.accent;
        // Append hex opacity: 99 ≈ 60%, 4d ≈ 30%
        const strokeColor = `${baseColor}${isWeak ? '4d' : '99'}`;
        return (
          <Polyline
            key={i}
            coordinates={[from, to]}
            strokeColor={strokeColor}
            strokeWidth={isWeak ? 1 : 2}
            lineDashPattern={isWeak ? [4, 6] : undefined}
          />
        );
      })}

      {/* Node markers */}
      {nodes.map((node) => {
        if (!node.latitude || !node.longitude) return null;
        return (
          <Marker
            key={node.nodeId}
            coordinate={{ latitude: node.latitude, longitude: node.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <NodeMarkerView node={node} isConnected={node.nodeId === connectedNodeId} />
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  markerWrap: {
    alignItems: 'center',
    gap: 2,
  },
  dotContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: colors.accent + '70',
    backgroundColor: colors.accent + '18',
  },
  markerDot: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  markerLabel: {
    backgroundColor: 'rgba(13,17,23,0.88)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  markerLabelConnected: {
    borderColor: colors.accent + '50',
  },
  markerText: {
    fontSize: 7,
    fontWeight: '700',
    fontFamily: 'DM Sans',
  },
});
