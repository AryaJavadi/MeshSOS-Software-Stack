import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/constants/design';
import { getRssiQuality } from '@/constants/ble';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';

interface SignalStrengthCardProps {
  rssi: number;
}

const RSSI_MIN = -120;
const RSSI_MAX = -50;

function rssiToPercent(rssi: number): number {
  const clamped = Math.max(RSSI_MIN, Math.min(RSSI_MAX, rssi));
  return ((clamped - RSSI_MIN) / (RSSI_MAX - RSSI_MIN)) * 100;
}

const QUALITY_COLOR: Record<string, string> = {
  strong: colors.green,
  good: colors.green,
  fair: colors.yellow,
  weak: colors.red,
};

const QUALITY_LABEL: Record<string, string> = {
  strong: 'Strong',
  good: 'Good',
  fair: 'Fair',
  weak: 'Weak',
};

export function SignalStrengthCard({ rssi }: SignalStrengthCardProps) {
  const quality = getRssiQuality(rssi);
  const percent = rssiToPercent(rssi);
  const color = QUALITY_COLOR[quality];

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <SectionLabel>Signal Strength (RSSI)</SectionLabel>
        <Text style={[styles.rssiValue, { color }]}>
          {rssi} dBm · {QUALITY_LABEL[quality]}
        </Text>
      </View>

      {/* Bar */}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${percent}%`, backgroundColor: color },
          ]}
        />
      </View>

      {/* Scale labels */}
      <View style={styles.scaleRow}>
        <Text style={[styles.scaleLabel, { color: colors.red }]}>Weak −120</Text>
        <Text style={[styles.scaleLabel, { color: colors.yellow }]}>Fair −90</Text>
        <Text style={[styles.scaleLabel, { color: colors.green }]}>Good −70</Text>
        <Text style={[styles.scaleLabel, { color: colors.green }]}>Strong −50</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  rssiValue: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'DM Mono',
  },
  barTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  barFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleLabel: {
    fontSize: 9,
    fontFamily: 'DM Mono',
  },
});
