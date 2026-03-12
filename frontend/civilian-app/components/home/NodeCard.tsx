import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { radius, spacing } from '@/constants/design';
import { Card } from '@/components/ui/Card';
import { NodeInfo } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { ThemeColors } from '@/constants/themes';

interface NodeCardProps {
  node: NodeInfo;
  onReplace?: () => void;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      gap: spacing.md,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.accentDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: { fontSize: 18 },
    info: { flex: 1 },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      fontFamily: 'DM Sans',
    },
    sub: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
      fontFamily: 'DM Mono',
    },
    right: { alignItems: 'flex-end', gap: 4 },
    badge: {
      backgroundColor: colors.greenDim,
      borderColor: colors.greenBorder,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.green,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      fontFamily: 'DM Sans',
    },
    changeHint: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: 'DM Mono',
    },
  });
}

export function NodeCard({ node, onReplace }: NodeCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Card style={styles.card}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>📡</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.title}>Node #{node.nodeId}</Text>
        <Text style={styles.sub}>BT · paired · in range</Text>
      </View>

      <TouchableOpacity onPress={onReplace}>
        <View style={styles.right}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Connected</Text>
          </View>
          <Text style={styles.changeHint}>tap to change</Text>
        </View>
      </TouchableOpacity>
    </Card>
  );
}
