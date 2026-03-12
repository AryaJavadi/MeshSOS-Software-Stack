import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, StyleSheet } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import { useBLEStore } from '@/store/bleStore';
import { spacing } from '@/constants/design';
import { MeshNode } from '@/types';
import { MeshMap } from '@/components/network/MeshMap';
import { NodeDetailList } from '@/components/network/NodeDetailList';
import { useTheme } from '@/hooks/useTheme';
import { ThemeColors } from '@/constants/themes';

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      fontFamily: 'DM Sans',
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
    liveText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.green,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontFamily: 'DM Sans',
    },
    emptyMap: {
      height: 300,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      gap: 12,
    },
    emptyEmoji: { fontSize: 36, opacity: 0.4 },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      paddingHorizontal: 40,
      fontFamily: 'DM Sans',
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontSize: 10, color: colors.textMuted, fontFamily: 'DM Sans' },
  });
}

export default function NetworkScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { network, connectionState, connectedNode } = useBLEStore();
  const isConnected = connectionState === 'connected' && network;
  const connectedNodeId = connectedNode?.nodeId;
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const LEGEND_ITEMS = [
    { color: colors.accent,  label: 'You' },
    { color: colors.green,   label: 'Online' },
    { color: colors.yellow,  label: 'Weak' },
    { color: colors.red,     label: 'Offline' },
    { color: colors.gateway, label: 'Gateway' },
  ];

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

  function handleNodePress(node: MeshNode) {
    if (!node.latitude || !node.longitude) return;
    mapRef.current?.animateToRegion(
      { latitude: node.latitude, longitude: node.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 },
      500
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Mesh Network</Text>
        {isConnected && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        )}
      </View>

      {isConnected ? (
        <MeshMap
          nodes={network.nodes}
          links={network.links}
          userLocation={userLocation ?? undefined}
          mapHeight={300}
          connectedNodeId={connectedNodeId}
          mapRef={mapRef}
        />
      ) : (
        <View style={styles.emptyMap}>
          <Text style={styles.emptyEmoji}>📡</Text>
          <Text style={styles.emptyText}>Connect to a node to see the mesh network</Text>
        </View>
      )}

      <View style={styles.legend}>
        {LEGEND_ITEMS.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {isConnected && (
          <NodeDetailList
            nodes={network.nodes}
            connectedNodeId={connectedNodeId}
            onNodePress={handleNodePress}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}