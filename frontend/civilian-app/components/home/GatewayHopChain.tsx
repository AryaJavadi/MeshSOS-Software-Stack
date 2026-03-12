import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/constants/design';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';

interface GatewayHopChainProps {
  hopChain: string[];       // e.g. ['you', 'B91C', 'D7E2', 'GW-01']
  totalDistanceKm: number;
  gatewayReachable: boolean;
}

function getNodeEmoji(nodeId: string): string {
  if (nodeId === 'you') return '📱';
  if (nodeId.startsWith('GW')) return '🏛️';
  return '📡';
}

function getNodeColor(nodeId: string, index: number, total: number): string {
  if (nodeId === 'you') return colors.accent;
  if (nodeId.startsWith('GW')) return colors.gateway;
  // Last link before gateway is often weaker
  if (index === total - 2) return colors.yellow;
  return colors.green;
}

function getNodeBg(nodeId: string, index: number, total: number): string {
  if (nodeId === 'you') return colors.accentDim;
  if (nodeId.startsWith('GW')) return colors.gatewayDim;
  if (index === total - 2) return colors.yellowDim;
  return colors.greenDim;
}

export function GatewayHopChain({ hopChain, totalDistanceKm, gatewayReachable }: GatewayHopChainProps) {
  const segmentDistances = hopChain.slice(0, -1).map((_, i) => {
    // Distribute total distance roughly across hops
    const base = totalDistanceKm / (hopChain.length - 1);
    const variation = base * 0.3 * (i % 2 === 0 ? 1 : -0.5);
    return Math.max(0.3, base + variation).toFixed(1);
  });

  return (
    <Card style={styles.card}>
      <SectionLabel>Gateway Connection</SectionLabel>

      <View style={styles.chain}>
        {hopChain.map((nodeId, i) => {
          const color = getNodeColor(nodeId, i, hopChain.length);
          const bg = getNodeBg(nodeId, i, hopChain.length);
          const isLast = i === hopChain.length - 1;
          const isWeakLink = i === hopChain.length - 2;

          return (
            <React.Fragment key={nodeId}>
              {/* Node bubble */}
              <View style={styles.nodeWrap}>
                <View
                  style={[
                    styles.nodeBubble,
                    nodeId === 'you' && styles.nodeBubbleLarge,
                    nodeId.startsWith('GW') && styles.nodeBubbleLarge,
                    { backgroundColor: bg, borderColor: color },
                  ]}
                >
                  <Text style={styles.nodeEmoji}>{getNodeEmoji(nodeId)}</Text>
                </View>
                <Text style={[styles.nodeLabel, { color: color === colors.yellow ? colors.yellow : colors.textMuted }]}>
                  {nodeId === 'you' ? 'You' : nodeId}
                </Text>
              </View>

              {/* Link line */}
              {!isLast && (
                <View style={styles.linkWrap}>
                  <Text style={styles.linkDistance}>{segmentDistances[i]}km</Text>
                  <View
                    style={[
                      styles.linkLine,
                      isWeakLink ? styles.linkWeak : styles.linkStrong,
                    ]}
                  />
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {hopChain.length - 1} hop{hopChain.length - 1 !== 1 ? 's' : ''} · ~{totalDistanceKm.toFixed(1)} km total
        </Text>
        {gatewayReachable ? (
          <Text style={styles.reachable}>Reachable ✓</Text>
        ) : (
          <Text style={styles.unreachable}>Gateway Unreachable</Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
  },
  chain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  nodeWrap: {
    alignItems: 'center',
    gap: 3,
  },
  nodeBubble: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeBubbleLarge: {
    width: 32,
    height: 32,
  },
  nodeEmoji: {
    fontSize: 12,
  },
  nodeLabel: {
    fontSize: 7,
    fontFamily: 'DM Mono',
    textAlign: 'center',
  },
  linkWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  linkDistance: {
    fontSize: 8,
    color: colors.textMuted,
    fontFamily: 'DM Mono',
  },
  linkLine: {
    width: '100%',
    height: 2,
    borderRadius: 1,
  },
  linkStrong: {
    backgroundColor: colors.green,
  },
  linkWeak: {
    // Dashed via border trick
    backgroundColor: colors.yellow,
    opacity: 0.6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'DM Mono',
  },
  reachable: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.green,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: 'DM Sans',
  },
  unreachable: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.red,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: 'DM Sans',
  },
});
